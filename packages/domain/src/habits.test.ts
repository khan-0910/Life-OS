import { describe, expect, it } from "vitest";
import {
  completionRate,
  currentStreak,
  dayState,
  isHabitDue,
  longestStreak,
  pauseHabit,
  resumeHabit,
} from "./habits";
import type { Habit } from "./types";

function habit(over: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    title: "Read",
    description: "",
    schedule: { type: "daily" },
    startDate: "2026-10-01",
    pauses: [],
    color: "sage",
    archivedAt: null,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    ...over,
  };
}

const set = (...d: string[]) => new Set(d);

describe("habit streaks", () => {
  it("counts consecutive completed due days", () => {
    const done = set("2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30");
    expect(currentStreak(habit(), done, "2026-10-30")).toBe(4);
  });

  it("does not break the streak for today while today is still open", () => {
    const done = set("2026-10-28", "2026-10-29");
    expect(currentStreak(habit(), done, "2026-10-30")).toBe(2);
  });

  it("breaks on a missed due day", () => {
    const done = set("2026-10-26", "2026-10-28", "2026-10-29");
    expect(currentStreak(habit(), done, "2026-10-30")).toBe(2);
  });

  it("skips unscheduled weekdays instead of breaking", () => {
    // Mon/Wed/Fri habit. 2026-10-30 is a Friday.
    const h = habit({ schedule: { type: "weekdays", days: [1, 3, 5] } });
    const done = set("2026-10-26", "2026-10-28", "2026-10-30");
    expect(currentStreak(h, done, "2026-10-30")).toBe(3);
    expect(isHabitDue(h, "2026-10-29")).toBe(false);
  });

  it("does not punish paused days", () => {
    const h = habit({ pauses: [{ start: "2026-10-20", end: "2026-10-27" }] });
    const done = set("2026-10-18", "2026-10-19", "2026-10-27", "2026-10-28", "2026-10-29");
    expect(currentStreak(h, done, "2026-10-30")).toBe(5);
    expect(dayState(h, done, "2026-10-22", "2026-10-30")).toBe("paused");
  });

  it("ignores completions on non-due days for streaks but shows them as extra", () => {
    const h = habit({ schedule: { type: "weekdays", days: [1] } }); // Mondays
    const done = set("2026-10-25"); // Sunday
    expect(currentStreak(h, done, "2026-10-30")).toBe(0);
    expect(dayState(h, done, "2026-10-25", "2026-10-30")).toBe("extra");
  });

  it("never counts days before the start date", () => {
    const h = habit({ startDate: "2026-10-29" });
    expect(currentStreak(h, set("2026-10-28", "2026-10-29"), "2026-10-30")).toBe(1);
  });

  it("computes the longest streak", () => {
    const done = set("2026-10-01", "2026-10-02", "2026-10-03", "2026-10-05");
    expect(longestStreak(habit(), done, "2026-10-06")).toBe(3);
  });
});

describe("completion rate", () => {
  it("divides completed due days by due days, excluding open today", () => {
    const r = completionRate(habit(), set("2026-10-28", "2026-10-29"), "2026-10-27", "2026-10-30", "2026-10-30");
    expect(r).toEqual({ completed: 2, due: 3, ratio: 2 / 3 });
  });

  it("is null when nothing was due", () => {
    const h = habit({ pauses: [{ start: "2026-10-01", end: null }] });
    expect(completionRate(h, set(), "2026-10-10", "2026-10-20", "2026-10-30").ratio).toBeNull();
  });
});

describe("pause and resume", () => {
  it("opens and closes a pause", () => {
    const h = habit();
    const paused = { ...h, pauses: pauseHabit(h, "2026-10-30") };
    expect(isHabitDue(paused, "2026-10-30")).toBe(false);
    const resumed = { ...paused, pauses: resumeHabit(paused, "2026-11-02") };
    expect(isHabitDue(resumed, "2026-11-01")).toBe(false);
    expect(isHabitDue(resumed, "2026-11-02")).toBe(true);
  });

  it("drops a pause that is resumed on the day it started", () => {
    const h = { ...habit(), pauses: [{ start: "2026-10-30", end: null }] };
    expect(resumeHabit(h, "2026-10-30")).toEqual([]);
  });
});
