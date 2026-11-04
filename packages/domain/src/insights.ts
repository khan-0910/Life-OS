/**
 * Insights are computed only from stored records. Definitions:
 * - Tasks completed per day: tasks whose completedAt falls on that date (user tz).
 *   A task reopened later no longer counts.
 * - Focus minutes per day: active (unpaused) focus time of saved sessions,
 *   attributed to the date the session started.
 * - Planned vs done: tasks planned for a date in the window; "done" if completed.
 * - Habit rate: see habits.ts completionRate.
 */
import { completionRate, doneDates, type Rate } from "./habits";
import { addDays, dateInTz, dateRange, type ISODate } from "./time";
import type { FocusSession, Habit, HabitEntry, Task } from "./types";

export interface DayValue {
  date: ISODate;
  value: number;
}

/** The `days` calendar dates ending on `end` (inclusive). */
export function windowDates(end: ISODate, days: number): ISODate[] {
  return dateRange(addDays(end, -(Math.max(1, days) - 1)), end);
}

export function tasksCompletedByDay(tasks: Task[], dates: ISODate[], tz: string): DayValue[] {
  const counts = new Map<ISODate, number>(dates.map((d) => [d, 0]));
  for (const t of tasks) {
    if (t.status !== "done" || !t.completedAt) continue;
    const d = dateInTz(t.completedAt, tz);
    if (counts.has(d)) counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return dates.map((date) => ({ date, value: counts.get(date) ?? 0 }));
}

export function focusMinutesByDay(sessions: FocusSession[], dates: ISODate[], tz: string): DayValue[] {
  const mins = new Map<ISODate, number>(dates.map((d) => [d, 0]));
  for (const s of sessions) {
    const d = dateInTz(s.startedAt, tz);
    if (mins.has(d)) mins.set(d, (mins.get(d) ?? 0) + s.activeMs / 60_000);
  }
  return dates.map((date) => ({ date, value: Math.round(mins.get(date) ?? 0) }));
}

export interface FocusTotals {
  sessions: number;
  completed: number;
  activeMinutes: number;
  averageMinutes: number | null;
}

export function focusTotals(sessions: FocusSession[], dates: ISODate[], tz: string): FocusTotals {
  const set = new Set(dates);
  const inRange = sessions.filter((s) => set.has(dateInTz(s.startedAt, tz)));
  const activeMinutes = Math.round(inRange.reduce((n, s) => n + s.activeMs, 0) / 60_000);
  return {
    sessions: inRange.length,
    completed: inRange.filter((s) => s.outcome === "completed").length,
    activeMinutes,
    averageMinutes: inRange.length ? Math.round(activeMinutes / inRange.length) : null,
  };
}

export function plannedVsDone(tasks: Task[], dates: ISODate[]): { planned: number; done: number } {
  const set = new Set(dates);
  const planned = tasks.filter((t) => t.plannedFor !== null && set.has(t.plannedFor));
  return { planned: planned.length, done: planned.filter((t) => t.status === "done").length };
}

export function habitRates(
  habits: Habit[],
  entries: HabitEntry[],
  dates: ISODate[],
  today: ISODate,
): { habit: Habit; rate: Rate }[] {
  const from = dates[0];
  const to = dates[dates.length - 1];
  if (!from || !to) return [];
  return habits
    .filter((h) => !h.archivedAt)
    .map((habit) => ({ habit, rate: completionRate(habit, doneDates(entries, habit.id), from, to, today) }));
}
