"use client";

/**
 * Device integrations as seen from the web app.
 *
 * Browser extension: talks over `chrome.runtime.sendMessage(extensionId, …)`, which
 * only works when the extension lists this origin in `externally_connectable`.
 * Status is what the extension itself reports — LifeOS never assumes sites are
 * blocked because a timer is running.
 *
 * Windows companion: one-way signed deep links. The browser cannot confirm the
 * companion received them, and the UI says so.
 */
import { useSyncExternalStore } from "react";
import {
  EXTENSION_PROTOCOL,
  buildCompanionLink,
  randomNonce,
  type ExtRequest,
  type ExtResponse,
  type ExtStatus,
} from "@lifeos/domain";
import type { CompanionPairing } from "./store";

// ---------- tiny observable ----------

function observable<T>(initial: T) {
  let value = initial;
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) {
      value = next;
      for (const s of subs) s();
    },
    subscribe(cb: () => void) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  };
}

// ---------- Browser extension ----------

export type ExtensionConnection =
  | { kind: "not_configured" }
  | { kind: "checking" }
  | { kind: "not_detected"; detail: string }
  | { kind: "pairing_lost" }
  | { kind: "connected"; status: ExtStatus; checkedAt: number }
  | { kind: "error"; detail: string };

export const extensionConnection = observable<ExtensionConnection>({ kind: "not_configured" });

export function useExtensionConnection(): ExtensionConnection {
  return useSyncExternalStore(extensionConnection.subscribe, extensionConnection.get, () => ({ kind: "not_configured" }) as const);
}

export const EXTENSION_ID_RE = /^[a-p]{32}$/;

interface ChromeRuntimeLike {
  sendMessage: (id: string, msg: unknown, cb: (resp: unknown) => void) => void;
  lastError?: { message?: string };
}

function chromeRuntime(): ChromeRuntimeLike | null {
  const rt = (globalThis as { chrome?: { runtime?: Partial<ChromeRuntimeLike> } }).chrome?.runtime;
  return rt && typeof rt.sendMessage === "function" ? (rt as ChromeRuntimeLike) : null;
}

export class ExtensionUnavailable extends Error {}

type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;

export function sendToExtension(
  extensionId: string,
  msg: DistributiveOmit<ExtRequest, "v">,
  timeoutMs = 2500,
): Promise<ExtResponse> {
  return new Promise((resolve, reject) => {
    if (!EXTENSION_ID_RE.test(extensionId)) {
      reject(new ExtensionUnavailable("That doesn't look like an extension ID (32 letters a–p)."));
      return;
    }
    const rt = chromeRuntime();
    if (!rt) {
      reject(
        new ExtensionUnavailable(
          "No LifeOS extension is reachable from this page. Install it in Chrome or Edge, and make sure this site's address is allowed in its build.",
        ),
      );
      return;
    }
    const timer = setTimeout(() => reject(new ExtensionUnavailable("The extension did not answer.")), timeoutMs);
    try {
      rt.sendMessage(extensionId, { v: EXTENSION_PROTOCOL, ...msg }, (resp) => {
        clearTimeout(timer);
        const err = rt.lastError;
        if (err || !resp) {
          reject(new ExtensionUnavailable(err?.message ?? "The extension did not answer."));
          return;
        }
        resolve(resp as ExtResponse);
      });
    } catch (e) {
      clearTimeout(timer);
      reject(new ExtensionUnavailable(e instanceof Error ? e.message : "Could not reach the extension."));
    }
  });
}

export function describeExtError(error: string): string {
  switch (error) {
    case "bad_code":
      return "That pairing code is not correct.";
    case "code_expired":
      return "That pairing code has expired. Generate a new one in the extension.";
    case "too_many_attempts":
      return "Too many wrong codes. Generate a new code in the extension.";
    case "not_paired":
    case "bad_secret":
      return "The extension no longer recognizes this LifeOS. Pair again.";
    case "origin_not_allowed":
      return "The extension does not accept messages from this address.";
    default:
      return "The extension rejected the request.";
  }
}

// ---------- Windows companion ----------

export interface CompanionSend {
  action: "start" | "stop";
  until: number;
  sentAt: number;
}

export const companionLastSend = observable<CompanionSend | null>(null);

export function useCompanionLastSend(): CompanionSend | null {
  return useSyncExternalStore(companionLastSend.subscribe, companionLastSend.get, () => null);
}

/**
 * Open a signed deep link to the companion. Must be called from a user action;
 * the browser may ask the user to allow opening the app.
 */
export async function notifyCompanion(pairing: CompanionPairing | null, action: "start" | "stop", until: number): Promise<void> {
  if (!pairing?.enabled || typeof window === "undefined") return;
  const now = Date.now();
  const link = await buildCompanionLink({ action, until: action === "stop" ? 0 : Math.round(until), iat: now, nonce: randomNonce() }, pairing.secret);
  window.location.href = link;
  companionLastSend.set({ action, until, sentAt: now });
}
