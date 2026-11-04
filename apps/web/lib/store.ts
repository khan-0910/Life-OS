"use client";

/**
 * Local-first persistence for LifeOS (Local mode).
 *
 * All planner data lives in this browser's localStorage under one versioned key.
 * Every mutation is read-modify-write against the latest stored copy, so two open
 * tabs never overwrite each other's changes with a stale snapshot. Other tabs are
 * notified through the `storage` event. If the browser refuses to save (quota,
 * privacy mode), the change stays in memory and the UI shows a persistent warning
 * with an export option — input is never silently dropped.
 */
import { useSyncExternalStore } from "react";
import {
  systemTimeZone,
  isValidTimeZone,
  type Blocklist,
  type DailyReview,
  type FocusPreset,
  type FocusRun,
  type FocusSession,
  type Goal,
  type Habit,
  type HabitEntry,
  type ISODate,
  type Project,
  type Task,
  type TimeBlock,
  type BreakBlocking,
} from "@lifeos/domain";

export const STORAGE_KEY = "lifeos:data";
export const SCHEMA_VERSION = 1;

export interface ExtensionPairing {
  extensionId: string;
  /** Pairing secret returned by the extension. Sent only to that extension. */
  secret: string;
  pairedAt: string;
}

export interface CompanionPairing {
  secret: string;
  pairedAt: string;
  enabled: boolean;
}

export interface Settings {
  displayName: string;
  timeZone: string;
  weekStartsOn: 0 | 1;
  focus: {
    autoStartBreak: boolean;
    breakBlocking: BreakBlocking;
    defaultPresetId: string | null;
  };
  extension: ExtensionPairing | null;
  companion: CompanionPairing | null;
  /** Date on which the user chose "leave for now" on the rollover prompt. */
  rolloverDismissedOn: ISODate | null;
}

export interface LifeData {
  version: number;
  settings: Settings;
  tasks: Task[];
  timeBlocks: TimeBlock[];
  habits: Habit[];
  habitEntries: HabitEntry[];
  goals: Goal[];
  projects: Project[];
  reviews: DailyReview[];
  focusPresets: FocusPreset[];
  focusSessions: FocusSession[];
  activeRun: FocusRun | null;
  blocklists: Blocklist[];
}

export type StoreStatus = "loading" | "ready" | "error";

export interface StoreState {
  status: StoreStatus;
  data: LifeData;
  loadError: string | null;
  saveError: string | null;
}

export const DEFAULT_PRESETS: FocusPreset[] = [
  { id: "preset-deep", name: "Deep work", focusMinutes: 50, breakMinutes: 10, blocklistId: null },
  { id: "preset-classic", name: "Classic", focusMinutes: 25, breakMinutes: 5, blocklistId: null },
  { id: "preset-sprint", name: "Quick sprint", focusMinutes: 15, breakMinutes: 3, blocklistId: null },
];

export function emptyData(): LifeData {
  return {
    version: SCHEMA_VERSION,
    settings: {
      displayName: "",
      timeZone: systemTimeZone(),
      weekStartsOn: 1,
      focus: { autoStartBreak: true, breakBlocking: "pause", defaultPresetId: "preset-classic" },
      extension: null,
      companion: null,
      rolloverDismissedOn: null,
    },
    tasks: [],
    timeBlocks: [],
    habits: [],
    habitEntries: [],
    goals: [],
    projects: [],
    reviews: [],
    focusPresets: DEFAULT_PRESETS.map((p) => ({ ...p })),
    focusSessions: [],
    activeRun: null,
    blocklists: [],
  };
}

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Accept stored or imported data, filling defaults for anything missing. */
export function migrate(raw: unknown): LifeData {
  const base = emptyData();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<LifeData>;
  if (typeof r.version === "number" && r.version > SCHEMA_VERSION) {
    throw new Error("This data was saved by a newer version of LifeOS.");
  }
  const s = (r.settings ?? {}) as Partial<Settings>;
  return {
    version: SCHEMA_VERSION,
    settings: {
      ...base.settings,
      ...s,
      timeZone: isValidTimeZone(s.timeZone) ? s.timeZone : base.settings.timeZone,
      weekStartsOn: s.weekStartsOn === 0 ? 0 : 1,
      focus: { ...base.settings.focus, ...(s.focus ?? {}) },
    },
    tasks: arr(r.tasks),
    timeBlocks: arr(r.timeBlocks),
    habits: arr(r.habits),
    habitEntries: arr(r.habitEntries),
    goals: arr(r.goals),
    projects: arr(r.projects),
    reviews: arr(r.reviews),
    focusPresets: r.focusPresets && Array.isArray(r.focusPresets) ? r.focusPresets : base.focusPresets,
    focusSessions: arr(r.focusSessions),
    activeRun: r.activeRun ?? null,
    blocklists: arr(r.blocklists),
  };
}

let state: StoreState = { status: "loading", data: emptyData(), loadError: null, saveError: null };
const SERVER_STATE: StoreState = state;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function readStored(): LifeData | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? migrate(JSON.parse(raw)) : null;
}

let storageListenerAttached = false;

export function hydrate(): void {
  try {
    const data = readStored() ?? emptyData();
    state = { status: "ready", data, loadError: null, saveError: state.saveError };
  } catch (e) {
    state = {
      ...state,
      status: "error",
      loadError: e instanceof Error ? e.message : "Stored data could not be read.",
    };
  }
  if (!storageListenerAttached && typeof window !== "undefined") {
    storageListenerAttached = true;
    window.addEventListener("storage", (ev) => {
      if (ev.key === STORAGE_KEY || ev.key === null) hydrate();
    });
  }
  emit();
}

/**
 * Apply a mutation to the freshest copy of the data and persist it.
 * Returns false (and leaves state unchanged) when the store is not ready.
 */
export function update(mutator: (draft: LifeData) => void): boolean {
  if (state.status !== "ready") return false;
  let base = state.data;
  try {
    base = readStored() ?? base;
  } catch {
    // Unreadable storage: keep working from memory; the save below reports the problem.
  }
  const next = structuredClone(base);
  mutator(next);
  let saveError: string | null = null;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    saveError =
      "This browser is refusing to save LifeOS data (storage full or blocked). Recent changes are only in this tab — export your data from Settings before closing it.";
  }
  state = { ...state, data: next, saveError };
  emit();
  return true;
}

export function getState(): StoreState {
  return state;
}

/** Replace everything (import / delete). */
export function replaceAll(data: LifeData): void {
  state = { ...state, status: "ready", loadError: null };
  update((d) => {
    Object.assign(d, structuredClone(data));
  });
}

export function resetLoadError(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  hydrate();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useStore(): StoreState {
  return useSyncExternalStore(subscribe, getState, () => SERVER_STATE);
}

export function useData(): LifeData {
  return useStore().data;
}
