import { beforeEach, describe, expect, it } from "vitest";

// Minimal browser stand-ins for the local store.
const mem = new Map<string, string>();
let failWrites = false;
Object.assign(globalThis, {
  window: {
    localStorage: {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (failWrites) throw new Error("QuotaExceededError");
        mem.set(k, v);
      },
      removeItem: (k: string) => mem.delete(k),
    },
    addEventListener: () => {},
  },
});

const { STORAGE_KEY, getState, hydrate, migrate, update } = await import("./store");
const actions = await import("./actions");

const stored = () => JSON.parse(mem.get(STORAGE_KEY)!);

beforeEach(() => {
  mem.clear();
  failWrites = false;
  hydrate();
});

describe("migrate", () => {
  it("fills defaults and repairs an invalid time zone", () => {
    const d = migrate({ version: 1, settings: { timeZone: "Mars/Olympus" }, tasks: "nope" });
    expect(d.tasks).toEqual([]);
    expect(d.focusPresets.length).toBeGreaterThan(0);
    expect(d.settings.timeZone).not.toBe("Mars/Olympus");
  });

  it("refuses data from a newer schema instead of guessing", () => {
    expect(() => migrate({ version: 99 })).toThrow(/newer version/);
  });
});

describe("task flow", () => {
  it("creates, completes, reopens and edits a task, persisting each step", () => {
    const r = actions.createTask({ title: "  Write   report ", plannedFor: "2026-10-30", priority: "high" });
    expect(r.ok).toBe(true);
    const id = (r as { id: string }).id;
    expect(stored().tasks[0]).toMatchObject({ title: "Write report", status: "todo", completedAt: null });

    expect(actions.toggleTask(id)).toBe(true);
    expect(stored().tasks[0].status).toBe("done");
    expect(stored().tasks[0].completedAt).toBeTypeOf("string");

    expect(actions.toggleTask(id)).toBe(false);
    expect(stored().tasks[0]).toMatchObject({ status: "todo", completedAt: null });

    expect(actions.updateTask(id, { estimateMinutes: "0" })).toMatchObject({ ok: false });
    expect(actions.updateTask(id, { estimateMinutes: "45" })).toEqual({ ok: true });
    expect(stored().tasks[0].estimateMinutes).toBe(45);
  });

  it("moves tasks only when asked (explicit rollover)", () => {
    const { id } = actions.createTask({ title: "Old", plannedFor: "2026-10-28" }) as { id: string };
    expect(stored().tasks[0].plannedFor).toBe("2026-10-28");
    actions.planTasksFor([id], "2026-10-30");
    expect(stored().tasks[0].plannedFor).toBe("2026-10-30");
  });

  it("deleting a task unlinks its time blocks", () => {
    const { id } = actions.createTask({ title: "Linked" }) as { id: string };
    actions.createBlock({ title: "Work", start: "2026-10-30T09:00:00Z", end: "2026-10-30T10:00:00Z", kind: "focus", taskId: id, notes: "" });
    actions.deleteTask(id);
    expect(stored().timeBlocks[0].taskId).toBeNull();
  });

  it("rejects blocks shorter than 15 minutes", () => {
    expect(actions.createBlock({ title: "x", start: "2026-10-30T09:00:00Z", end: "2026-10-30T09:10:00Z", kind: "focus", taskId: null, notes: "" })).toMatchObject({ ok: false });
  });
});

describe("habits", () => {
  it("records a completion once and refuses future dates", () => {
    const r = actions.saveHabit(null, { title: "Read", description: "", schedule: { type: "daily" }, startDate: "2026-10-01", color: "sage" });
    const id = (r as { id: string }).id;
    actions.setHabitDone(id, "2026-10-30", true, "2026-10-30");
    actions.setHabitDone(id, "2026-10-30", true, "2026-10-30");
    actions.setHabitDone(id, "2026-10-31", true, "2026-10-30");
    expect(stored().habitEntries.map((e: { date: string }) => e.date)).toEqual(["2026-10-30"]);
    actions.setHabitDone(id, "2026-10-30", false, "2026-10-30");
    expect(stored().habitEntries).toEqual([]);
  });

  it("requires at least one weekday for weekday schedules", () => {
    expect(actions.saveHabit(null, { title: "Gym", description: "", schedule: { type: "weekdays", days: [] }, startDate: "2026-10-01", color: "sage" })).toMatchObject({
      ok: false,
      errors: { schedule: expect.any(String) },
    });
  });
});

describe("storage safety", () => {
  it("never overwrites another tab's newer write with a stale copy", () => {
    actions.createTask({ title: "From tab A" });
    // Another tab writes directly to storage; this tab hasn't reloaded.
    const other = stored();
    other.tasks.push({ ...other.tasks[0], id: "tab-b-task", title: "From tab B" });
    mem.set(STORAGE_KEY, JSON.stringify(other));
    actions.createTask({ title: "From tab A again" });
    expect(stored().tasks.map((t: { title: string }) => t.title)).toEqual(["From tab A", "From tab B", "From tab A again"]);
  });

  it("keeps changes in memory and reports when the browser refuses to save", () => {
    failWrites = true;
    actions.createTask({ title: "Unsaved" });
    expect(getState().saveError).toMatch(/refusing to save/);
    expect(getState().data.tasks.map((t) => t.title)).toEqual(["Unsaved"]);
    failWrites = false;
    update(() => {});
    expect(getState().saveError).toBeNull();
  });
});

describe("focus via the store", () => {
  it("starts, ends early and saves a truthful session", () => {
    const preset = getState().data.focusPresets[0]!;
    const run = actions.startFocus({ preset, taskId: null, projectId: null, blocklistId: null });
    expect(run).not.toBeNull();
    // Pretend 10 minutes passed by shifting the persisted start back.
    const d = stored();
    d.activeRun.phaseStartedAt -= 600_000;
    d.activeRun.runningSince -= 600_000;
    mem.set(STORAGE_KEY, JSON.stringify(d));
    actions.endFocus("ended_early");
    const s = stored();
    expect(s.activeRun).toBeNull();
    expect(s.focusSessions).toHaveLength(1);
    expect(s.focusSessions[0].outcome).toBe("ended_early");
    expect(Math.round(s.focusSessions[0].activeMs / 60_000)).toBe(10);
  });
});
