// Typed wrappers for the companion's Rust commands. Every input is validated again in Rust.
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface AppRule {
  id: string;
  label: string;
  exe: string;
  allowClose: boolean;
}

export interface Interruption {
  exe: string;
  label: string;
  allowClose: boolean;
}

export interface LinkEvent {
  at: number;
  ok: boolean;
  detail: string;
}

export interface StateView {
  guardUntil: number | null;
  source: "manual" | "lifeOs" | null;
  rules: AppRule[];
  webUrl: string;
  interruption: Interruption | null;
  lastLink: LinkEvent | null;
  supported: boolean;
}

export type OverlayAction = "back" | "snooze" | "close_app" | "stop_guard";

export const api = {
  getState: () => invoke<StateView>("get_state"),
  startGuard: (minutes: number) => invoke<StateView>("start_guard", { minutes }),
  stopGuard: () => invoke<StateView>("stop_guard"),
  addRule: (label: string, exe: string, allowClose: boolean) => invoke<StateView>("add_rule", { label, exe, allowClose }),
  removeRule: (id: string) => invoke<StateView>("remove_rule", { id }),
  setRuleClose: (id: string, allowClose: boolean) => invoke<StateView>("set_rule_close", { id, allowClose }),
  setWebUrl: (url: string) => invoke<StateView>("set_web_url", { url }),
  getPairingSecret: () => invoke<string>("get_pairing_secret"),
  resetPairing: () => invoke<string>("reset_pairing"),
  getInterruption: () => invoke<Interruption | null>("get_interruption"),
  overlayAction: (action: OverlayAction) => invoke<void>("overlay_action", { action }),
};

export function onEvent(name: "state-changed" | "interruption", cb: () => void): Promise<UnlistenFn> {
  return listen(name, cb);
}

export const errorText = (e: unknown) => (typeof e === "string" ? e : e instanceof Error ? e.message : "Something went wrong.");
