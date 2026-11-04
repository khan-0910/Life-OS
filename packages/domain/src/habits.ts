/**
 * Habit rules (documented in docs/TIME_AND_STREAKS.md).
 *
 * - A "day" is a calendar date in the user's configured time zone.
 * - A habit is DUE on a date when the date is on/after its start date, falls on a
 *   scheduled weekday, and is not inside a pause.
 * - CURRENT STREAK counts consecutive due days with a completion, walking back from
 *   today. Days that are not due (unscheduled weekdays, paused days) are skipped:
 *   they neither add to nor break the streak. Today, if due but not yet completed,
 *   is "open" and does not break the streak.
 * - Completions recorded on non-due days are kept and shown in history as "extra",
 *   but they do not count toward streaks or completion rate.
 * - COMPLETION RATE = completed due days ÷ due days in the window, excluding today
 *   unless it is already complete. Undefined (null) when no days were due.
 */
import { addDays, dateRange, weekday, type ISODate } from "./time";
import type { Habit, HabitEntry } from "./types";

const MAX_LOOKBACK_DAYS = 3660;

export function isPausedOn(habit: Habit, date: ISODate): boolean {
  return habit.pauses.some((p) => date >= p.start && (p.end === null || date < p.end));
}

export function isPausedNow(habit: Habit, today: ISODate): boolean {
  return isPausedOn(habit, today);
}

export function isScheduledOn(habit: Habit, date: ISODate): boolean {
  if (habit.schedule.type === "daily") return true;
  return habit.schedule.days.includes(weekday(date));
}

export function isHabitDue(habit: Habit, date: ISODate): boolean {
  if (date < habit.startDate) return false;
  if (isPausedOn(habit, date)) return false;
  return isScheduledOn(habit, date);
}

export function doneDates(entries: HabitEntry[], habitId: string): Set<ISODate> {
  const s = new Set<ISODate>();
  for (const e of entries) if (e.habitId === habitId) s.add(e.date);
  return s;
}

export function currentStreak(habit: Habit, done: Set<ISODate>, today: ISODate): number {
  let streak = 0;
  let d = today;
  for (let i = 0; i < MAX_LOOKBACK_DAYS && d >= habit.startDate; i++) {
    if (isHabitDue(habit, d)) {
      if (done.has(d)) streak++;
      else if (d !== today) break;
    }
    d = addDays(d, -1);
  }
  return streak;
}

export function longestStreak(habit: Habit, done: Set<ISODate>, today: ISODate): number {
  if (today < habit.startDate) return 0;
  let best = 0;
  let run = 0;
  for (const d of dateRange(habit.startDate, today)) {
    if (!isHabitDue(habit, d)) continue;
    if (done.has(d)) {
      run++;
      best = Math.max(best, run);
    } else if (d !== today) {
      run = 0;
    }
  }
  return best;
}

export interface Rate {
  completed: number;
  due: number;
  ratio: number | null;
}

export function completionRate(
  habit: Habit,
  done: Set<ISODate>,
  from: ISODate,
  to: ISODate,
  today: ISODate,
): Rate {
  const end = to < today ? to : today;
  let completed = 0;
  let due = 0;
  if (from > end) return { completed, due, ratio: null };
  for (const d of dateRange(from, end)) {
    if (!isHabitDue(habit, d)) continue;
    if (d === today && !done.has(d)) continue; // today is still open
    due++;
    if (done.has(d)) completed++;
  }
  return { completed, due, ratio: due === 0 ? null : completed / due };
}

export type DayState =
  | "done"
  | "missed"
  | "open"
  | "not_due"
  | "paused"
  | "extra"
  | "future"
  | "before_start";

export function dayState(habit: Habit, done: Set<ISODate>, date: ISODate, today: ISODate): DayState {
  if (date > today) return "future";
  if (date < habit.startDate) return done.has(date) ? "extra" : "before_start";
  if (isPausedOn(habit, date)) return done.has(date) ? "extra" : "paused";
  if (!isScheduledOn(habit, date)) return done.has(date) ? "extra" : "not_due";
  if (done.has(date)) return "done";
  return date === today ? "open" : "missed";
}

export function history(
  habit: Habit,
  done: Set<ISODate>,
  from: ISODate,
  to: ISODate,
  today: ISODate,
): { date: ISODate; state: DayState }[] {
  return dateRange(from, to).map((date) => ({ date, state: dayState(habit, done, date, today) }));
}

/** Start a pause today. No-op if already paused. */
export function pauseHabit(habit: Habit, today: ISODate): Habit["pauses"] {
  if (isPausedOn(habit, today)) return habit.pauses;
  return [...habit.pauses, { start: today, end: null }];
}

/** End any open pause; the habit is due again from today. */
export function resumeHabit(habit: Habit, today: ISODate): Habit["pauses"] {
  return habit.pauses
    .map((p) => (p.end === null ? { ...p, end: today } : p))
    .filter((p) => p.end === null || p.end > p.start);
}
