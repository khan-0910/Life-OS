/**
 * Message contract between the LifeOS web app and the browser extension
 * (local pairing over `externally_connectable`). See docs/INTEGRATIONS.md.
 *
 * Only the LifeOS origin(s) baked into the extension manifest can send these.
 * Every message after pairing carries the pairing secret; the extension stores
 * only its SHA-256 hash. Block state always carries `until`: the extension
 * removes its rules at that time even if it never hears from LifeOS again.
 */
import { HOUR_MS } from "./time";

export const EXTENSION_PROTOCOL = 1 as const;
/** The extension refuses block windows longer than this. */
export const MAX_BLOCK_WINDOW_MS = 4 * HOUR_MS;
export const PAIRING_CODE_TTL_MS = 5 * 60_000;
export const PAIRING_CODE_MAX_ATTEMPTS = 5;

export interface DesiredBlockState {
  sessionId: string | null;
  blocking: boolean;
  domains: string[];
  /** Epoch ms after which the extension must stop blocking on its own. */
  until: number;
}

export type ExtRequest =
  | { v: 1; type: "hello" }
  | { v: 1; type: "pair"; code: string; label: string }
  | { v: 1; type: "status"; secret: string }
  | { v: 1; type: "state"; secret: string; state: DesiredBlockState }
  | { v: 1; type: "unpair"; secret: string };

export type ExtError =
  | "bad_request"
  | "not_paired"
  | "bad_secret"
  | "bad_code"
  | "code_expired"
  | "too_many_attempts"
  | "origin_not_allowed";

export interface ExtStatus {
  version: string;
  paired: boolean;
  /** User switched the integration off in the extension. */
  enabled: boolean;
  /** Block rules are installed right now. */
  active: boolean;
  ruleDomains: number;
  until: number | null;
  /** User paused blocking from the extension until this time. */
  userPausedUntil: number | null;
  mode: "block" | "redirect";
}

export type ExtResponse =
  | { ok: true; type: "hello"; version: string; paired: boolean }
  | { ok: true; type: "paired"; secret: string; status: ExtStatus }
  | { ok: true; type: "status"; status: ExtStatus }
  | { ok: true; type: "unpaired" }
  | { ok: false; error: ExtError };

export function isExtRequest(v: unknown): v is ExtRequest {
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  if (m.v !== EXTENSION_PROTOCOL || typeof m.type !== "string") return false;
  switch (m.type) {
    case "hello":
      return true;
    case "pair":
      return typeof m.code === "string" && m.code.length <= 32 && typeof m.label === "string" && m.label.length <= 80;
    case "status":
    case "unpair":
      return typeof m.secret === "string" && m.secret.length <= 128;
    case "state": {
      if (typeof m.secret !== "string" || m.secret.length > 128) return false;
      const s = m.state as Record<string, unknown> | null;
      return (
        !!s &&
        typeof s === "object" &&
        typeof s.blocking === "boolean" &&
        typeof s.until === "number" &&
        Number.isFinite(s.until) &&
        Array.isArray(s.domains) &&
        s.domains.length <= 500 &&
        s.domains.every((d) => typeof d === "string" && d.length <= 253) &&
        (s.sessionId === null || (typeof s.sessionId === "string" && s.sessionId.length <= 64))
      );
    }
    default:
      return false;
  }
}
