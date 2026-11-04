import { createHash, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_BLOCK_WINDOW_MS, type ExtResponse } from "@lifeos/domain";
import { Controller, type PairingCode, type Platform, type StoredState } from "./controller";
import { buildRules, type DnrRule } from "./rules";

const ORIGIN = "http://localhost:3000";

class FakePlatform implements Platform {
  version = "0.1.0";
  t = Date.parse("2026-10-30T09:00:00Z");
  stored: StoredState | null = null;
  code: PairingCode | null = null;
  rules: DnrRule[] = [];
  alarm: number | null = null;
  granted = new Set<string>();
  now = () => this.t;
  randomBytes = (n: number) => new Uint8Array(randomBytes(n));
  sha256Hex = async (s: string) => createHash("sha256").update(s).digest("hex");
  load = async () => this.stored;
  save = async (s: StoredState) => void (this.stored = structuredClone(s));
  loadCode = async () => this.code;
  saveCode = async (c: PairingCode | null) => void (this.code = c);
  setRules = async (r: DnrRule[]) => void (this.rules = r);
  setAlarm = async (at: number | null) => void (this.alarm = at);
  hasHostPermission = async (d: string) => this.granted.has(d);
}

let p: FakePlatform;
let c: Controller;

async function pair(): Promise<string> {
  const { code } = await c.createPairingCode();
  const r = await c.handleExternal({ v: 1, type: "pair", code: code.toLowerCase(), label: "test" }, ORIGIN);
  if (!r.ok || r.type !== "paired") throw new Error(`pair failed: ${JSON.stringify(r)}`);
  return r.secret;
}

const state = (secret: string, domains: string[], untilMin: number, blocking = true) => ({
  v: 1 as const,
  type: "state" as const,
  secret,
  state: { sessionId: "run1", blocking, domains, until: p.t + untilMin * 60_000 },
});

beforeEach(() => {
  p = new FakePlatform();
  c = new Controller(p, [ORIGIN]);
});

describe("message origin and shape", () => {
  it("rejects origins that are not allowed", async () => {
    expect(await c.handleExternal({ v: 1, type: "hello" }, "https://evil.example")).toEqual({ ok: false, error: "origin_not_allowed" });
    expect(await c.handleExternal({ v: 1, type: "hello" }, undefined)).toEqual({ ok: false, error: "origin_not_allowed" });
  });

  it("rejects malformed messages", async () => {
    expect(await c.handleExternal({ type: "state" }, ORIGIN)).toEqual({ ok: false, error: "bad_request" });
  });
});

describe("pairing", () => {
  it("pairs with a valid code and stores only a hash of the secret", async () => {
    const secret = await pair();
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(JSON.stringify(p.stored)).not.toContain(secret);
    expect(p.stored?.pairing?.origin).toBe(ORIGIN);
    expect(p.code).toBeNull(); // single use
  });

  it("refuses a reused, wrong or expired code", async () => {
    const { code } = await c.createPairingCode();
    expect(await c.handleExternal({ v: 1, type: "pair", code: "WRONGCOD", label: "x" }, ORIGIN)).toEqual({ ok: false, error: "bad_code" });
    p.t += 6 * 60_000;
    expect(await c.handleExternal({ v: 1, type: "pair", code, label: "x" }, ORIGIN)).toEqual({ ok: false, error: "code_expired" });
    expect(await c.handleExternal({ v: 1, type: "pair", code, label: "x" }, ORIGIN)).toEqual({ ok: false, error: "bad_code" });
  });

  it("locks out after too many wrong attempts", async () => {
    const { code } = await c.createPairingCode();
    let last: ExtResponse | null = null;
    for (let i = 0; i < 5; i++) last = await c.handleExternal({ v: 1, type: "pair", code: "AAAAAAAA", label: "x" }, ORIGIN);
    expect(last).toEqual({ ok: false, error: "too_many_attempts" });
    expect(await c.handleExternal({ v: 1, type: "pair", code, label: "x" }, ORIGIN)).toEqual({ ok: false, error: "bad_code" });
  });

  it("requires the secret for state and refuses before pairing", async () => {
    expect(await c.handleExternal(state("nope", ["a.com"], 25), ORIGIN)).toEqual({ ok: false, error: "not_paired" });
    await pair();
    expect(await c.handleExternal(state("wrong-secret", ["a.com"], 25), ORIGIN)).toEqual({ ok: false, error: "bad_secret" });
    expect(p.rules).toEqual([]);
  });
});

describe("block rules", () => {
  it("installs normalized rules with an expiry alarm", async () => {
    const secret = await pair();
    const r = await c.handleExternal(state(secret, ["https://www.YouTube.com/x", "m.youtube.com", "reddit.com", "not a domain"], 25), ORIGIN);
    expect(r).toMatchObject({ ok: true, type: "status", status: { active: true, ruleDomains: 2 } });
    expect(p.rules).toEqual(buildRules(["reddit.com", "youtube.com"], []));
    expect(p.alarm).toBe(p.t + 25 * 60_000);
  });

  it("caps the block window at four hours", async () => {
    const secret = await pair();
    await c.handleExternal(state(secret, ["a.com"], 24 * 60), ORIGIN);
    expect(p.alarm).toBe(p.t + MAX_BLOCK_WINDOW_MS);
  });

  it("removes rules on its own when the end time passes (fail open)", async () => {
    const secret = await pair();
    await c.handleExternal(state(secret, ["a.com"], 25), ORIGIN);
    p.t += 26 * 60_000;
    await c.reconcile();
    expect(p.rules).toEqual([]);
    expect((await c.status()).active).toBe(false);
    expect(p.alarm).toBeNull();
  });

  it("clears rules when LifeOS says blocking stopped", async () => {
    const secret = await pair();
    await c.handleExternal(state(secret, ["a.com"], 25), ORIGIN);
    await c.handleExternal(state(secret, [], 0, false), ORIGIN);
    expect(p.rules).toEqual([]);
  });

  it("honors the user's pause and off switch, then restores", async () => {
    const secret = await pair();
    await c.handleExternal(state(secret, ["a.com"], 60), ORIGIN);
    await c.pauseFor(15 * 60_000);
    expect(p.rules).toEqual([]);
    expect(p.alarm).toBe(p.t + 15 * 60_000);
    p.t += 16 * 60_000;
    await c.reconcile();
    expect(p.rules).toHaveLength(1);
    await c.setEnabled(false);
    expect(p.rules).toEqual([]);
  });

  it("redirects only domains with granted host permission", async () => {
    const secret = await pair();
    p.granted.add("a.com");
    await c.setMode("redirect");
    await c.handleExternal(state(secret, ["a.com", "b.com"], 25), ORIGIN);
    expect(p.rules).toEqual(buildRules(["a.com", "b.com"], ["a.com"]));
    expect(p.rules.map((r) => r.action.type)).toEqual(["block", "redirect", "block"]);
  });

  it("revokes: unpair clears pairing and rules, old secret stops working", async () => {
    const secret = await pair();
    await c.handleExternal(state(secret, ["a.com"], 25), ORIGIN);
    expect(await c.handleExternal({ v: 1, type: "unpair", secret }, ORIGIN)).toEqual({ ok: true, type: "unpaired" });
    expect(p.rules).toEqual([]);
    expect(await c.handleExternal(state(secret, ["a.com"], 25), ORIGIN)).toEqual({ ok: false, error: "not_paired" });
  });
});
