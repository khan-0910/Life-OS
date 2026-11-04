import { describe, expect, it } from "vitest";
import { buildCompanionLink, canonicalCompanionMessage, isCompanionSecret, signCompanionCommand } from "./companion";
import { isExtRequest } from "./protocol";

// Shared with apps/desktop/src-tauri/src/deeplink.rs — keep both in sync.
const VECTOR = {
  secret: "dGVzdC1zZWNyZXQtZm9yLWxpZmVvcy1jb21wYW5pb24",
  command: { action: "start" as const, until: 1793350800000, iat: 1793349000000, nonce: "00112233445566778899aabb" },
  sig: "2e05c61299b0356232071a4cd967591ad5c817dd2cfbe392ef2398b5e1bc08a2",
};

describe("companion deep links", () => {
  it("uses the documented canonical message", () => {
    expect(canonicalCompanionMessage(VECTOR.command)).toBe(
      "lifeos-companion/v1\nstart\n1793350800000\n1793349000000\n00112233445566778899aabb",
    );
  });

  it("matches the shared HMAC test vector", async () => {
    expect(await signCompanionCommand(VECTOR.command, VECTOR.secret)).toBe(VECTOR.sig);
  });

  it("builds a link carrying every signed field", async () => {
    const url = new URL(await buildCompanionLink(VECTOR.command, VECTOR.secret));
    expect(url.protocol).toBe("lifeos-companion:");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      action: "start",
      until: "1793350800000",
      iat: "1793349000000",
      nonce: VECTOR.command.nonce,
      sig: VECTOR.sig,
    });
  });

  it("recognizes companion secrets", () => {
    expect(isCompanionSecret(VECTOR.secret)).toBe(true);
    expect(isCompanionSecret("short")).toBe(false);
  });
});

describe("extension protocol guard", () => {
  it("accepts well-formed messages and rejects others", () => {
    expect(isExtRequest({ v: 1, type: "hello" })).toBe(true);
    expect(
      isExtRequest({
        v: 1,
        type: "state",
        secret: "x",
        state: { sessionId: null, blocking: true, domains: ["a.com"], until: 1 },
      }),
    ).toBe(true);
    expect(isExtRequest({ v: 2, type: "hello" })).toBe(false);
    expect(isExtRequest({ v: 1, type: "state", secret: "x", state: { blocking: "yes" } })).toBe(false);
    expect(isExtRequest({ v: 1, type: "eval", code: "x" })).toBe(false);
    expect(isExtRequest(null)).toBe(false);
  });
});
