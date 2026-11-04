/// <reference types="chrome" />
/**
 * Service worker: wires the Controller to chrome.* APIs. Listeners are registered
 * synchronously at top level, as Manifest V3 requires.
 */
import { Controller, type PairingCode, type Platform, type StoredState } from "./controller";
import { RULE_IDS, originsFor, type DnrRule } from "./rules";

declare const __LIFEOS_ORIGINS__: string[];

const STATE_KEY = "state";
const CODE_KEY = "pairingCode";
const ALARM = "lifeos-reconcile";

const platform: Platform = {
  version: chrome.runtime.getManifest().version,
  now: () => Date.now(),
  randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
  async sha256Hex(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  },
  async load() {
    return ((await chrome.storage.local.get(STATE_KEY))[STATE_KEY] as StoredState | undefined) ?? null;
  },
  async save(state) {
    await chrome.storage.local.set({ [STATE_KEY]: state });
  },
  // Session storage: in memory only, cleared when the browser closes.
  async loadCode() {
    return ((await chrome.storage.session.get(CODE_KEY))[CODE_KEY] as PairingCode | undefined) ?? null;
  },
  async saveCode(code) {
    if (code) await chrome.storage.session.set({ [CODE_KEY]: code });
    else await chrome.storage.session.remove(CODE_KEY);
  },
  async setRules(rules: DnrRule[]) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [...RULE_IDS],
      addRules: rules as chrome.declarativeNetRequest.Rule[],
    });
  },
  async setAlarm(at) {
    await chrome.alarms.clear(ALARM);
    if (at !== null) await chrome.alarms.create(ALARM, { when: Math.max(at, Date.now() + 1000) });
  },
  hasHostPermission: (domain) => chrome.permissions.contains({ origins: originsFor([domain]) }),
};

const controller = new Controller(platform, __LIFEOS_ORIGINS__);

chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  controller
    .handleExternal(msg, sender.origin)
    .then(sendResponse)
    .catch(() => sendResponse({ ok: false, error: "bad_request" }));
  return true;
});

export type PopupRequest =
  | { type: "popup:status" }
  | { type: "popup:createCode" }
  | { type: "popup:pause"; minutes: number }
  | { type: "popup:resume" }
  | { type: "popup:enabled"; enabled: boolean }
  | { type: "popup:mode"; mode: "block" | "redirect" }
  | { type: "popup:unpair" };

async function handlePopup(msg: PopupRequest) {
  switch (msg.type) {
    case "popup:createCode":
      return { code: await controller.createPairingCode(), id: chrome.runtime.id };
    case "popup:pause":
      await controller.pauseFor(Math.max(1, Math.min(240, msg.minutes)) * 60_000);
      break;
    case "popup:resume":
      await controller.resumeNow();
      break;
    case "popup:enabled":
      await controller.setEnabled(msg.enabled);
      break;
    case "popup:mode":
      await controller.setMode(msg.mode);
      break;
    case "popup:unpair":
      await controller.unpair();
      break;
  }
  const s = await controller.state();
  return { status: await controller.status(), origin: s.pairing?.origin ?? null, domains: s.desired?.domains ?? [], id: chrome.runtime.id };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Only our own extension pages (popup) may use these.
  let host = "";
  try {
    host = new URL(sender.url ?? "").host;
  } catch {
    /* no url */
  }
  if (sender.id !== chrome.runtime.id || host !== chrome.runtime.id) return false;
  handlePopup(msg as PopupRequest).then(sendResponse, () => sendResponse(null));
  return true;
});

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === ALARM) void controller.reconcile();
});
chrome.runtime.onStartup.addListener(() => void controller.reconcile());
chrome.runtime.onInstalled.addListener(() => void controller.reconcile());
chrome.permissions.onAdded.addListener(() => void controller.reconcile());
chrome.permissions.onRemoved.addListener(() => void controller.reconcile());
