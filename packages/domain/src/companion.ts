/**
 * Signed deep links for the Windows companion (local pairing, no network port).
 *
 *   lifeos-companion://focus?action=start&until=<ms>&iat=<ms>&nonce=<hex>&sig=<hex>
 *
 * sig = HMAC-SHA256(key = UTF-8 bytes of the pairing secret, message = canonical
 * string below), lowercase hex. The companion verifies the signature, rejects
 * links issued more than 2 minutes ago or in the future, rejects reused nonces,
 * and caps `until` at 4 hours ahead. The Rust implementation must match
 * `canonicalCompanionMessage` exactly (shared test vector in companion.test.ts).
 */

export const COMPANION_SCHEME = "lifeos-companion";
export type CompanionAction = "start" | "break" | "stop";

export interface CompanionCommand {
  action: CompanionAction;
  /** Epoch ms when the companion should stop guarding (0 for stop). */
  until: number;
  iat: number;
  nonce: string;
}

export function canonicalCompanionMessage(c: CompanionCommand): string {
  return `lifeos-companion/v1\n${c.action}\n${c.until}\n${c.iat}\n${c.nonce}`;
}

function hex(buf: ArrayBuffer | Uint8Array): string {
  return Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomNonce(bytes = 12): string {
  const b = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(b);
  return hex(b);
}

export async function signCompanionCommand(c: CompanionCommand, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await globalThis.crypto.subtle.sign("HMAC", key, enc.encode(canonicalCompanionMessage(c))));
}

export async function buildCompanionLink(c: CompanionCommand, secret: string): Promise<string> {
  const sig = await signCompanionCommand(c, secret);
  const q = new URLSearchParams({
    action: c.action,
    until: String(c.until),
    iat: String(c.iat),
    nonce: c.nonce,
    sig,
  });
  return `${COMPANION_SCHEME}://focus?${q.toString()}`;
}

/** Companion pairing secrets are 43-char base64url strings (32 random bytes). */
export function isCompanionSecret(v: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(v.trim());
}
