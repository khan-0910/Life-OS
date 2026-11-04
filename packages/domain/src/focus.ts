/**
 * Focus timer state machine. Pure: every function takes `now` (epoch ms) and
 * returns new state. Remaining time is always derived from persisted timestamps,
 * never from a counting interval, so tab suspension, reloads and restarts recover
 * exactly. Paused time is tracked separately and never counted as focus.
 *
 * Session recording rules:
 * - "completed": the focus phase reached its planned duration. endedAt is the exact
 *   instant it did, even if the app was closed at the time.
 * - "ended_early": the user ended or skipped the focus phase.
 * - "interrupted": emergency stop, or a run left paused for longer than 12 hours
 *   (closed at the moment it was paused).
 * - Focus segments shorter than one minute are not saved.
 * - Breaks are never recorded as focus.
 */
import { HOUR_MS, MINUTE_MS, toInstant } from "./time";
import type { FocusRun, FocusSession, SessionOutcome } from "./types";

export const MIN_RECORDED_FOCUS_MS = MINUTE_MS;
export const ABANDON_AFTER_PAUSE_MS = 12 * HOUR_MS;
/** While paused, integrations receive a short renewable lease instead of an end time. */
export const PAUSED_LEASE_MS = 15 * MINUTE_MS;

export interface StartParams {
  id: string;
  presetName: string;
  focusMinutes: number;
  breakMinutes: number;
  taskId: string | null;
  projectId: string | null;
  blocklistId: string | null;
}

export interface FocusOptions {
  autoStartBreak: boolean;
  newId: () => string;
}

export interface Transition {
  run: FocusRun | null;
  sessions: FocusSession[];
}

export function startRun(p: StartParams, now: number): FocusRun {
  return {
    id: p.id,
    presetName: p.presetName,
    focusMs: Math.round(p.focusMinutes * MINUTE_MS),
    breakMs: Math.round(p.breakMinutes * MINUTE_MS),
    taskId: p.taskId,
    projectId: p.projectId,
    blocklistId: p.blocklistId,
    phase: "focus",
    phaseStartedAt: now,
    phasePlannedMs: Math.round(p.focusMinutes * MINUTE_MS),
    accruedMs: 0,
    runningSince: now,
    pausedAt: null,
    pausedMs: 0,
    cycle: 1,
  };
}

export function isRunning(run: FocusRun): boolean {
  return run.runningSince !== null;
}

export function activeElapsedMs(run: FocusRun, now: number): number {
  const live = run.runningSince !== null ? Math.max(0, now - run.runningSince) : 0;
  return Math.min(run.phasePlannedMs, run.accruedMs + live);
}

export function remainingMs(run: FocusRun, now: number): number {
  return Math.max(0, run.phasePlannedMs - activeElapsedMs(run, now));
}

/** Expected wall-clock end of the current phase, or null while paused/ready. */
export function phaseEndsAt(run: FocusRun, now: number): number | null {
  if (run.phase === "ready" || run.runningSince === null) return null;
  return now + remainingMs(run, now);
}

function pausedTotal(run: FocusRun, at: number): number {
  return run.pausedMs + (run.pausedAt !== null ? Math.max(0, at - run.pausedAt) : 0);
}

function session(
  run: FocusRun,
  endedAt: number,
  activeMs: number,
  outcome: SessionOutcome,
  newId: () => string,
): FocusSession[] {
  if (run.phase !== "focus" || activeMs < MIN_RECORDED_FOCUS_MS) return [];
  return [
    {
      id: newId(),
      runId: run.id,
      startedAt: toInstant(run.phaseStartedAt),
      endedAt: toInstant(endedAt),
      activeMs,
      pausedMs: pausedTotal(run, endedAt),
      plannedMs: run.phasePlannedMs,
      outcome,
      presetName: run.presetName,
      taskId: run.taskId,
      projectId: run.projectId,
      cycle: run.cycle,
    },
  ];
}

function toBreak(run: FocusRun, at: number, autoStart: boolean): FocusRun {
  if (run.breakMs <= 0) return toReady(run, at);
  return {
    ...run,
    phase: "break",
    phaseStartedAt: at,
    phasePlannedMs: run.breakMs,
    accruedMs: 0,
    runningSince: autoStart ? at : null,
    pausedAt: autoStart ? null : at,
    pausedMs: 0,
  };
}

function toReady(run: FocusRun, at: number): FocusRun {
  return {
    ...run,
    phase: "ready",
    phaseStartedAt: at,
    phasePlannedMs: 0,
    accruedMs: 0,
    runningSince: null,
    pausedAt: null,
    pausedMs: 0,
  };
}

export function pauseRun(run: FocusRun, now: number): FocusRun {
  if (run.phase === "ready" || run.runningSince === null) return run;
  return { ...run, accruedMs: activeElapsedMs(run, now), runningSince: null, pausedAt: now };
}

export function resumeRun(run: FocusRun, now: number): FocusRun {
  if (run.phase === "ready" || run.runningSince !== null) return run;
  return {
    ...run,
    pausedMs: pausedTotal(run, now),
    runningSince: now,
    pausedAt: null,
  };
}

/**
 * Apply every transition that has become due by `now`: a finished focus phase is
 * recorded as completed at its exact end instant and moves to a break; a finished
 * break moves to "ready". Runs paused too long are closed as interrupted.
 */
export function reconcile(run: FocusRun, now: number, opts: FocusOptions): Transition {
  const sessions: FocusSession[] = [];
  let cur: FocusRun = run;
  for (let i = 0; i < 4; i++) {
    if (cur.phase === "ready") {
      if (now - cur.phaseStartedAt > ABANDON_AFTER_PAUSE_MS) return { run: null, sessions };
      break;
    }
    if (cur.runningSince !== null) {
      if (cur.accruedMs + (now - cur.runningSince) < cur.phasePlannedMs) break;
      const endedAt = cur.runningSince + (cur.phasePlannedMs - cur.accruedMs);
      if (cur.phase === "focus") {
        sessions.push(...session(cur, endedAt, cur.phasePlannedMs, "completed", opts.newId));
        cur = toBreak(cur, endedAt, opts.autoStartBreak);
      } else {
        cur = toReady(cur, endedAt);
      }
      continue;
    }
    if (cur.pausedAt !== null && now - cur.pausedAt > ABANDON_AFTER_PAUSE_MS) {
      sessions.push(...session(cur, cur.pausedAt, cur.accruedMs, "interrupted", opts.newId));
      return { run: null, sessions };
    }
    break;
  }
  return { run: cur, sessions };
}

/** Skip: focus → saved as ended early, break starts now; break → ready; ready → next focus. */
export function skipPhase(run: FocusRun, now: number, opts: FocusOptions): Transition {
  if (run.phase === "focus") {
    const s = session(run, now, activeElapsedMs(run, now), "ended_early", opts.newId);
    return { run: toBreak(run, now, true), sessions: s };
  }
  if (run.phase === "break") return { run: toReady(run, now), sessions: [] };
  return { run: startNextFocus(run, now), sessions: [] };
}

export function startNextFocus(run: FocusRun, now: number): FocusRun {
  return {
    ...run,
    phase: "focus",
    phaseStartedAt: now,
    phasePlannedMs: run.focusMs,
    accruedMs: 0,
    runningSince: now,
    pausedAt: null,
    pausedMs: 0,
    cycle: run.phase === "ready" || run.phase === "break" ? run.cycle + 1 : run.cycle,
  };
}

/** End the run. A focus phase in progress is saved with its true active time. */
export function endRun(
  run: FocusRun,
  now: number,
  outcome: Exclude<SessionOutcome, "completed">,
  opts: Pick<FocusOptions, "newId">,
): Transition {
  return { run: null, sessions: session(run, now, activeElapsedMs(run, now), outcome, opts.newId) };
}

export type BreakBlocking = "pause" | "keep";

/** Whether device integrations should be blocking right now. */
export function blockingDesired(run: FocusRun | null, breakBlocking: BreakBlocking): boolean {
  if (!run || !run.blocklistId) return false;
  if (run.phase === "focus") return true;
  return run.phase === "break" && breakBlocking === "keep";
}

/**
 * When integrations must stop blocking on their own if they hear nothing more.
 * Running: the expected end of blocking. Paused: a short lease the app renews.
 */
export function blockingUntil(run: FocusRun, now: number, breakBlocking: BreakBlocking): number {
  const end = phaseEndsAt(run, now);
  if (end === null) return now + PAUSED_LEASE_MS;
  if (run.phase === "focus" && breakBlocking === "keep") return end + run.breakMs;
  return end;
}
