"use client";

/**
 * Optional sample data, loaded only when the user asks for it. Every record id
 * starts with "sample-" so it can be removed later without touching real data.
 */
import { addDays, todayInTz, toInstant, weekday, zonedTimeToMs, type ISODate } from "@lifeos/domain";
import { update, type LifeData } from "./store";

const SAMPLE = "sample-";

export function isSampleId(id: string): boolean {
  return id.startsWith(SAMPLE);
}

export function hasSampleData(d: LifeData): boolean {
  return [d.tasks, d.habits, d.goals, d.projects, d.timeBlocks].some((list) => list.some((x) => isSampleId(x.id)));
}

export function loadSampleData(): void {
  update((d) => {
    const tz = d.settings.timeZone;
    const today = todayInTz(tz);
    const at = (date: ISODate, h: number, m = 0) => toInstant(zonedTimeToMs(date, h * 60 + m, tz));
    const created = at(addDays(today, -14), 9);

    d.goals.push(
      { id: `${SAMPLE}g-run`, title: "Run a half marathon", why: "Feel strong and steady again.", targetDate: addDays(today, 120), status: "active", createdAt: created, updatedAt: created },
      { id: `${SAMPLE}g-site`, title: "Publish a personal website", why: "One place to share my work.", targetDate: addDays(today, 45), status: "active", createdAt: created, updatedAt: created },
    );
    d.projects.push(
      { id: `${SAMPLE}p-train`, title: "Base training block", notes: "", goalId: `${SAMPLE}g-run`, dueDate: addDays(today, 28), status: "active", createdAt: created, updatedAt: created },
      { id: `${SAMPLE}p-site`, title: "Website v1", notes: "Simple, fast, honest.", goalId: `${SAMPLE}g-site`, dueDate: addDays(today, 21), status: "active", createdAt: created, updatedAt: created },
    );

    const task = (
      id: string,
      title: string,
      extra: Partial<LifeData["tasks"][number]> = {},
    ): LifeData["tasks"][number] => ({
      id: `${SAMPLE}t-${id}`,
      title,
      notes: "",
      status: "todo",
      priority: "none",
      dueDate: null,
      plannedFor: null,
      estimateMinutes: null,
      projectId: null,
      goalId: null,
      createdAt: created,
      updatedAt: created,
      completedAt: null,
      ...extra,
    });
    const yesterday = addDays(today, -1);
    d.tasks.push(
      task("outline", "Outline the About page", { priority: "high", plannedFor: today, estimateMinutes: 50, projectId: `${SAMPLE}p-site` }),
      task("domain", "Renew domain name", { priority: "high", dueDate: today, estimateMinutes: 10, projectId: `${SAMPLE}p-site` }),
      task("shoes", "Buy running shoes", { priority: "medium", plannedFor: yesterday, projectId: `${SAMPLE}p-train` }),
      task("plan", "Draft 4-week running plan", { status: "done", plannedFor: yesterday, completedAt: at(yesterday, 18), projectId: `${SAMPLE}p-train` }),
      task("photos", "Pick three portfolio photos", { plannedFor: addDays(today, 1), projectId: `${SAMPLE}p-site` }),
      task("dentist", "Book dentist appointment", { priority: "low", dueDate: addDays(today, 5) }),
      task("long-run", "First 10 km long run", { plannedFor: addDays(today, 2), goalId: `${SAMPLE}g-run` }),
      task("taxes", "Gather tax documents", { priority: "medium" }),
      task("hosting", "Choose hosting", { status: "done", completedAt: at(addDays(today, -3), 16), projectId: `${SAMPLE}p-site` }),
    );

    d.timeBlocks.push(
      { id: `${SAMPLE}b-1`, title: "Write: About page", start: at(today, 9), end: at(today, 10, 30), kind: "focus", taskId: `${SAMPLE}t-outline`, notes: "", createdAt: created, updatedAt: created },
      { id: `${SAMPLE}b-2`, title: "Lunch walk", start: at(today, 12, 30), end: at(today, 13, 15), kind: "personal", taskId: null, notes: "", createdAt: created, updatedAt: created },
      { id: `${SAMPLE}b-3`, title: "Weekly sync", start: at(today, 14), end: at(today, 14, 30), kind: "meeting", taskId: null, notes: "", createdAt: created, updatedAt: created },
      { id: `${SAMPLE}b-4`, title: "Admin & email", start: at(today, 16), end: at(today, 17), kind: "admin", taskId: null, notes: "", createdAt: created, updatedAt: created },
      { id: `${SAMPLE}b-5`, title: "Photo selection", start: at(addDays(today, 1), 10), end: at(addDays(today, 1), 11), kind: "focus", taskId: `${SAMPLE}t-photos`, notes: "", createdAt: created, updatedAt: created },
    );

    const habitStart = addDays(today, -21);
    d.habits.push(
      { id: `${SAMPLE}h-read`, title: "Read 20 pages", description: "", schedule: { type: "daily" }, startDate: habitStart, pauses: [], color: "sage", archivedAt: null, createdAt: created, updatedAt: created },
      { id: `${SAMPLE}h-strength`, title: "Strength training", description: "", schedule: { type: "weekdays", days: [1, 3, 5] }, startDate: habitStart, pauses: [], color: "amber", archivedAt: null, createdAt: created, updatedAt: created },
      { id: `${SAMPLE}h-meditate`, title: "Meditate 10 minutes", description: "", schedule: { type: "daily" }, startDate: habitStart, pauses: [{ start: addDays(today, -9), end: addDays(today, -5) }], color: "violet", archivedAt: null, createdAt: created, updatedAt: created },
    );
    for (let i = 1; i <= 21; i++) {
      const date = addDays(today, -i);
      if (i !== 6) d.habitEntries.push({ id: `${SAMPLE}e-r${i}`, habitId: `${SAMPLE}h-read`, date, createdAt: created });
      if ([1, 3, 5].includes(weekday(date)) && i !== 10) d.habitEntries.push({ id: `${SAMPLE}e-s${i}`, habitId: `${SAMPLE}h-strength`, date, createdAt: created });
      if ((i < 5 || i > 9) && i % 3 !== 0) d.habitEntries.push({ id: `${SAMPLE}e-m${i}`, habitId: `${SAMPLE}h-meditate`, date, createdAt: created });
    }

    for (let i = 1; i <= 6; i++) {
      const date = addDays(today, -i);
      const start = zonedTimeToMs(date, 9 * 60 + 30, tz);
      const active = (i % 3 === 0 ? 18 : 25) * 60_000;
      d.focusSessions.push({
        id: `${SAMPLE}f-${i}`,
        runId: `${SAMPLE}run-${i}`,
        startedAt: toInstant(start),
        endedAt: toInstant(start + active + (i % 2) * 120_000),
        activeMs: active,
        pausedMs: (i % 2) * 120_000,
        plannedMs: 25 * 60_000,
        outcome: i % 3 === 0 ? "ended_early" : "completed",
        presetName: "Classic",
        taskId: null,
        projectId: `${SAMPLE}p-site`,
        cycle: 1,
      });
    }

    d.blocklists.push({
      id: `${SAMPLE}bl-social`,
      name: "Social & video",
      domains: ["youtube.com", "reddit.com", "x.com", "instagram.com"],
      createdAt: created,
      updatedAt: created,
    });
  });
}

export function removeSampleData(): void {
  update((d) => {
    const keep = <T extends { id: string }>(list: T[]) => list.filter((x) => !isSampleId(x.id));
    d.tasks = keep(d.tasks);
    d.timeBlocks = keep(d.timeBlocks);
    d.habits = keep(d.habits);
    d.habitEntries = keep(d.habitEntries);
    d.goals = keep(d.goals);
    d.projects = keep(d.projects);
    d.focusSessions = keep(d.focusSessions);
    d.blocklists = keep(d.blocklists);
    for (const p of d.focusPresets) if (p.blocklistId && isSampleId(p.blocklistId)) p.blocklistId = null;
    for (const t of d.tasks) {
      if (t.projectId && isSampleId(t.projectId)) t.projectId = null;
      if (t.goalId && isSampleId(t.goalId)) t.goalId = null;
    }
    for (const b of d.timeBlocks) if (b.taskId && isSampleId(b.taskId)) b.taskId = null;
  });
}
