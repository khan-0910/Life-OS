/**
 * Extension core, independent of the chrome.* APIs so it can be unit tested.
 *
 * Security model (see docs/INTEGRATIONS.md):
 * - Only origins listed at build time can send messages (manifest
 *   `externally_connectable`, re-checked here).
 * - Pairing needs a one-time code shown in the extension popup (5 minutes,
 *   5 attempts). On success the extension returns a random 256-bit secret and
 *   stores only its SHA-256 hash. Every later message must carry the secret.
 * - Block state always has an end time, capped at 4 hours. Rules are removed at
 *   that time by an alarm, even if LifeOS never sends another message.
 * - Stored on device: pairing hash and origin, the current block list and end
 *   time, user pause/enable/mode. No browsing data.
 */
import {
  MAX_BLOCK_WINDOW_MS,
  PAIRING_CODE_MAX_ATTEMPTS,
  PAIRING_CODE_TTL_MS,
  collapseDomains,
  isExtRequest,
  normalizeDomain,
  type DesiredBlockState,
  type ExtResponse,
  type ExtStatus,
} from "@lifeos/domain";
import { buildRules, type DnrRule } from "./rules";

export const MAX_DOMAINS = 200;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export interface StoredState {
  pairing: { secretHash: string; origin: string; label: string; pairedAt: number } | null;
  enabled: boolean;
  mode: "block" | "redirect";
  desired: DesiredBlockState | null;
  userPausedUntil: number | null;
  applied: { domains: number; until: number | null };
}

export interface PairingCode {
  code: string;
  expiresAt: number;
  attempts: number;
}

export interface Platform {
  version: string;
  now(): number;
  randomBytes(n: number): Uint8Array;
  sha256Hex(text: string): Promise<string>;
  load(): Promise<StoredState | null>;
  save(state: StoredState): Promise<void>;
  loadCode(): Promise<PairingCode | null>;
  saveCode(code: PairingCode | null): Promise<void>;
  setRules(rules: DnrRule[]): Promise<void>;
  /** Schedule the next reconcile, or clear it with null. */
  setAlarm(at: number | null): Promise<void>;
  hasHostPermission(domain: string): Promise<boolean>;
}

export const DEFAULT_STATE: StoredState = {
  pairing: null,
  enabled: true,
  mode: "block",
  desired: null,
  userPausedUntil: null,
  applied: { domains: 0, until: null },
};

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Constant-time comparison for equal-length strings. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function sanitizeDomains(input: string[]): string[] {
  const out: string[] = [];
  for (const raw of input) {
    const r = normalizeDomain(raw);
    if (r.ok) out.push(r.domain);
  }
  return collapseDomains(out).slice(0, MAX_DOMAINS);
}

export class Controller {
  constructor(
    private readonly p: Platform,
    private readonly allowedOrigins: string[],
  ) {}

  async state(): Promise<StoredState> {
    return { ...DEFAULT_STATE, ...((await this.p.load()) ?? {}) };
  }

  private async write(patch: Partial<StoredState>): Promise<StoredState> {
    const next = { ...(await this.state()), ...patch };
    await this.p.save(next);
    return next;
  }

  async status(): Promise<ExtStatus> {
    const s = await this.state();
    const now = this.p.now();
    return {
      version: this.p.version,
      paired: !!s.pairing,
      enabled: s.enabled,
      active: s.applied.domains > 0,
      ruleDomains: s.applied.domains,
      until: s.applied.until,
      userPausedUntil: s.userPausedUntil && s.userPausedUntil > now ? s.userPausedUntil : null,
      mode: s.mode,
    };
  }

  /** Recompute and install rules from stored state. Idempotent. */
  async reconcile(): Promise<StoredState> {
    const s = await this.state();
    const now = this.p.now();
    const paused = s.userPausedUntil !== null && s.userPausedUntil > now;
    const d = s.desired;
    const live = !!s.pairing && s.enabled && !!d && d.blocking && d.until > now && d.domains.length > 0;
    let rules: DnrRule[] = [];
    if (live && !paused) {
      const redirect: string[] = [];
      if (s.mode === "redirect") {
        for (const dom of d.domains) if (await this.p.hasHostPermission(dom)) redirect.push(dom);
      }
      rules = buildRules(d.domains, redirect);
    }
    await this.p.setRules(rules);
    const wake = [live ? d.until : null, paused ? s.userPausedUntil : null].filter((x): x is number => x !== null);
    await this.p.setAlarm(wake.length ? Math.min(...wake) : null);
    const applied = rules.length && d ? { domains: d.domains.length, until: d.until } : { domains: 0, until: null };
    // Forget an expired session entirely.
    const desired = d && d.until > now ? d : null;
    return this.write({ applied, desired, userPausedUntil: paused ? s.userPausedUntil : null });
  }

  // ---------- popup actions ----------

  async createPairingCode(): Promise<PairingCode> {
    const bytes = this.p.randomBytes(8);
    const code = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
    const pc = { code, expiresAt: this.p.now() + PAIRING_CODE_TTL_MS, attempts: 0 };
    await this.p.saveCode(pc);
    return pc;
  }

  async setEnabled(enabled: boolean) {
    await this.write({ enabled });
    return this.reconcile();
  }

  async pauseFor(ms: number) {
    await this.write({ userPausedUntil: this.p.now() + Math.min(ms, MAX_BLOCK_WINDOW_MS) });
    return this.reconcile();
  }

  async resumeNow() {
    await this.write({ userPausedUntil: null });
    return this.reconcile();
  }

  async setMode(mode: "block" | "redirect") {
    await this.write({ mode });
    return this.reconcile();
  }

  async unpair() {
    await this.p.saveCode(null);
    await this.write({ pairing: null, desired: null, userPausedUntil: null });
    return this.reconcile();
  }

  // ---------- messages from LifeOS ----------

  async handleExternal(msg: unknown, origin: string | undefined): Promise<ExtResponse> {
    if (!origin || !this.allowedOrigins.includes(origin)) return { ok: false, error: "origin_not_allowed" };
    if (!isExtRequest(msg)) return { ok: false, error: "bad_request" };

    if (msg.type === "hello") {
      const s = await this.state();
      return { ok: true, type: "hello", version: this.p.version, paired: !!s.pairing && s.pairing.origin === origin };
    }

    if (msg.type === "pair") return this.pair(msg.code, msg.label, origin);

    const s = await this.state();
    if (!s.pairing) return { ok: false, error: "not_paired" };
    const hash = await this.p.sha256Hex(msg.secret);
    if (s.pairing.origin !== origin || !safeEqual(hash, s.pairing.secretHash)) return { ok: false, error: "bad_secret" };

    if (msg.type === "status") return { ok: true, type: "status", status: await this.status() };
    if (msg.type === "unpair") {
      await this.unpair();
      return { ok: true, type: "unpaired" };
    }
    // state
    const now = this.p.now();
    const st = msg.state;
    const domains = st.blocking ? sanitizeDomains(st.domains) : [];
    const desired: DesiredBlockState | null =
      st.blocking && domains.length && st.until > now
        ? { sessionId: st.sessionId, blocking: true, domains, until: Math.min(st.until, now + MAX_BLOCK_WINDOW_MS) }
        : null;
    await this.write({ desired });
    await this.reconcile();
    return { ok: true, type: "status", status: await this.status() };
  }

  private async pair(code: string, label: string, origin: string): Promise<ExtResponse> {
    const pc = await this.p.loadCode();
    const now = this.p.now();
    if (!pc) return { ok: false, error: "bad_code" };
    if (pc.expiresAt < now) {
      await this.p.saveCode(null);
      return { ok: false, error: "code_expired" };
    }
    if (pc.attempts >= PAIRING_CODE_MAX_ATTEMPTS) {
      await this.p.saveCode(null);
      return { ok: false, error: "too_many_attempts" };
    }
    const given = code.trim().toUpperCase();
    if (!safeEqual(given, pc.code)) {
      const attempts = pc.attempts + 1;
      await this.p.saveCode(attempts >= PAIRING_CODE_MAX_ATTEMPTS ? null : { ...pc, attempts });
      return { ok: false, error: attempts >= PAIRING_CODE_MAX_ATTEMPTS ? "too_many_attempts" : "bad_code" };
    }
    await this.p.saveCode(null); // single use
    const secret = base64url(this.p.randomBytes(32));
    await this.write({
      pairing: { secretHash: await this.p.sha256Hex(secret), origin, label: label.slice(0, 80), pairedAt: now },
      desired: null,
    });
    await this.reconcile();
    return { ok: true, type: "paired", secret, status: await this.status() };
  }
}
