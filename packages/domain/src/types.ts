import type { ISODate, Instant } from "./time";

export type TaskStatus = "todo" | "doing" | "done";
export type Priority = "high" | "medium" | "low" | "none";

export interface Task {
  id: string;
  title: string;
  notes: string;
  status: TaskStatus;
  priority: Priority;
  /** Deadline (all-day). */
  dueDate: ISODate | null;
  /** The day the user intends to work on it (all-day). Never moved automatically. */
  plannedFor: ISODate | null;
  estimateMinutes: number | null;
  projectId: string | null;
  goalId: string | null;
  createdAt: Instant;
  updatedAt: Instant;
  completedAt: Instant | null;
}

export type BlockKind = "focus" | "meeting" | "admin" | "personal";

export interface TimeBlock {
  id: string;
  title: string;
  start: Instant;
  end: Instant;
  kind: BlockKind;
  taskId: string | null;
  notes: string;
  createdAt: Instant;
  updatedAt: Instant;
}

export type HabitSchedule = { type: "daily" } | { type: "weekdays"; days: number[] };

/** A pause covers [start, end): `end` is the date the habit resumes. `end: null` = still paused. */
export interface HabitPause {
  start: ISODate;
  end: ISODate | null;
}

export interface Habit {
  id: string;
  title: string;
  description: string;
  schedule: HabitSchedule;
  startDate: ISODate;
  pauses: HabitPause[];
  color: string;
  archivedAt: Instant | null;
  createdAt: Instant;
  updatedAt: Instant;
}

export interface HabitEntry {
  id: string;
  habitId: string;
  date: ISODate;
  createdAt: Instant;
}

export type GoalStatus = "active" | "achieved" | "archived";

/** A goal is an outcome. Progress comes from tasks linked to it directly or via its projects. */
export interface Goal {
  id: string;
  title: string;
  why: string;
  targetDate: ISODate | null;
  status: GoalStatus;
  createdAt: Instant;
  updatedAt: Instant;
}

export type ProjectStatus = "active" | "done" | "archived";

/** A project is a body of work. Progress comes from its own linked tasks. */
export interface Project {
  id: string;
  title: string;
  notes: string;
  goalId: string | null;
  dueDate: ISODate | null;
  status: ProjectStatus;
  createdAt: Instant;
  updatedAt: Instant;
}

export interface DailyReview {
  id: string;
  date: ISODate;
  /** Private user note. Never logged or sent anywhere. */
  note: string;
  plannedTaskIds: string[];
  completedTaskIds: string[];
  movedTaskIds: string[];
  createdAt: Instant;
  updatedAt: Instant;
}

export interface Blocklist {
  id: string;
  name: string;
  /** Normalized registrable hostnames, e.g. "youtube.com". */
  domains: string[];
  createdAt: Instant;
  updatedAt: Instant;
}

export interface FocusPreset {
  id: string;
  name: string;
  focusMinutes: number;
  breakMinutes: number;
  blocklistId: string | null;
}

export type FocusPhase = "focus" | "break" | "ready";

/**
 * The live focus run. All timing derives from these persisted fields, so a
 * suspended tab, reload or restart recovers the exact remaining time.
 */
export interface FocusRun {
  id: string;
  presetName: string;
  focusMs: number;
  breakMs: number;
  taskId: string | null;
  projectId: string | null;
  blocklistId: string | null;
  phase: FocusPhase;
  /** Epoch ms the current phase began. */
  phaseStartedAt: number;
  phasePlannedMs: number;
  /** Active ms accrued in this phase before `runningSince`. */
  accruedMs: number;
  /** Epoch ms the current running segment began; null while paused. */
  runningSince: number | null;
  pausedAt: number | null;
  /** Total paused ms in this phase. Never counted as focus. */
  pausedMs: number;
  cycle: number;
}

export type SessionOutcome = "completed" | "ended_early" | "interrupted";

export interface FocusSession {
  id: string;
  runId: string;
  startedAt: Instant;
  endedAt: Instant;
  activeMs: number;
  pausedMs: number;
  plannedMs: number;
  outcome: SessionOutcome;
  presetName: string;
  taskId: string | null;
  projectId: string | null;
  cycle: number;
}
