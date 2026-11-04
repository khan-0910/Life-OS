"use client";

/**
 * All writes go through these functions. Inputs are validated/normalized with the
 * shared domain rules before they reach storage; ids are generated here.
 */
import {
  LIMITS,
  cleanDate,
  cleanInt,
  cleanText,
  cleanTitle,
  endRun,
  isBlockKind,
  newId,
  pauseHabit,
  pauseRun,
  reconcile,
  resumeHabit,
  resumeRun,
  skipPhase,
  startNextFocus,
  startRun,
  validateTaskDraft,
  type Blocklist,
  type BlockKind,
  type FocusPreset,
  type FocusRun,
  type Goal,
  type Habit,
  type HabitSchedule,
  type ISODate,
  type Project,
  type Task,
  type TaskDraft,
  type TimeBlock,
} from "@lifeos/domain";
import { getState, update, type LifeData, type Settings } from "./store";

const nowIso = () => new Date().toISOString();

// ---------- Tasks ----------

export type TaskInput = Partial<Record<keyof TaskDraft, unknown>>;

export function createTask(input: TaskInput): { ok: true; id: string } | { ok: false; errors: Record<string, string> } {
  const r = validateTaskDraft(input as Record<string, unknown>);
  if (!r.ok) return r;
  const id = newId();
  const t = nowIso();
  update((d) => {
    d.tasks.push({ id, ...r.value, status: "todo", createdAt: t, updatedAt: t, completedAt: null });
  });
  return { ok: true, id };
}

export function updateTask(id: string, input: TaskInput): { ok: true } | { ok: false; errors: Record<string, string> } {
  const current = getState().data.tasks.find((x) => x.id === id);
  if (!current) return { ok: false, errors: { title: "This task no longer exists." } };
  const r = validateTaskDraft({ ...current, ...input } as Record<string, unknown>);
  if (!r.ok) return r;
  update((d) => {
    const task = d.tasks.find((x) => x.id === id);
    if (task) Object.assign(task, r.value, { updatedAt: nowIso() });
  });
  return { ok: true };
}

export function setTaskStatus(id: string, status: Task["status"]): void {
  update((d) => {
    const task = d.tasks.find((x) => x.id === id);
    if (!task) return;
    task.status = status;
    task.completedAt = status === "done" ? (task.completedAt ?? nowIso()) : null;
    task.updatedAt = nowIso();
  });
}

export function toggleTask(id: string): boolean {
  const task = getState().data.tasks.find((x) => x.id === id);
  if (!task) return false;
  const done = task.status !== "done";
  setTaskStatus(id, done ? "done" : "todo");
  return done;
}

export function deleteTask(id: string): void {
  update((d) => {
    d.tasks = d.tasks.filter((x) => x.id !== id);
    for (const b of d.timeBlocks) if (b.taskId === id) b.taskId = null;
  });
}

/** Explicit, user-chosen rollover. `date: null` moves tasks to the backlog. */
export function planTasksFor(ids: string[], date: ISODate | null): void {
  const set = new Set(ids);
  update((d) => {
    for (const t of d.tasks) {
      if (set.has(t.id)) {
        t.plannedFor = date;
        t.updatedAt = nowIso();
      }
    }
  });
}

// ---------- Time blocks ----------

export interface BlockInput {
  title: string;
  start: string;
  end: string;
  kind: BlockKind;
  taskId: string | null;
  notes: string;
}

function validBlock(input: BlockInput): string | null {
  const s = Date.parse(input.start);
  const e = Date.parse(input.end);
  if (Number.isNaN(s) || Number.isNaN(e)) return "Choose a start and end time.";
  if (e - s < 15 * 60_000) return "A block must be at least 15 minutes long.";
  if (e - s > 24 * 3_600_000) return "A block can be at most 24 hours long.";
  return null;
}

export function createBlock(input: BlockInput): { ok: true; id: string } | { ok: false; error: string } {
  const error = validBlock(input);
  if (error) return { ok: false, error };
  const id = newId();
  const t = nowIso();
  update((d) => {
    d.timeBlocks.push({
      id,
      title: cleanTitle(input.title) || "Untitled block",
      start: new Date(input.start).toISOString(),
      end: new Date(input.end).toISOString(),
      kind: isBlockKind(input.kind) ? input.kind : "focus",
      taskId: input.taskId,
      notes: cleanText(input.notes),
      createdAt: t,
      updatedAt: t,
    });
  });
  return { ok: true, id };
}

export function updateBlock(id: string, patch: Partial<BlockInput>): { ok: true } | { ok: false; error: string } {
  const current = getState().data.timeBlocks.find((b) => b.id === id);
  if (!current) return { ok: false, error: "This block no longer exists." };
  const merged: BlockInput = { ...current, ...patch };
  const error = validBlock(merged);
  if (error) return { ok: false, error };
  update((d) => {
    const b = d.timeBlocks.find((x) => x.id === id);
    if (!b) return;
    b.title = cleanTitle(merged.title) || "Untitled block";
    b.start = new Date(merged.start).toISOString();
    b.end = new Date(merged.end).toISOString();
    b.kind = isBlockKind(merged.kind) ? merged.kind : b.kind;
    b.taskId = merged.taskId;
    b.notes = cleanText(merged.notes);
    b.updatedAt = nowIso();
  });
  return { ok: true };
}

export function moveBlockTimes(id: string, times: Pick<TimeBlock, "start" | "end">) {
  return updateBlock(id, times);
}

export function deleteBlock(id: string): void {
  update((d) => {
    d.timeBlocks = d.timeBlocks.filter((b) => b.id !== id);
  });
}

// ---------- Habits ----------

export interface HabitInput {
  title: string;
  description: string;
  schedule: HabitSchedule;
  startDate: ISODate;
  color: string;
}

function cleanSchedule(s: HabitSchedule): HabitSchedule | null {
  if (s.type === "daily") return { type: "daily" };
  const days = [...new Set(s.days.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort();
  return days.length ? { type: "weekdays", days } : null;
}

export function saveHabit(id: string | null, input: HabitInput): { ok: true; id: string } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const title = cleanTitle(input.title);
  if (!title) errors.title = "Name the habit.";
  const schedule = cleanSchedule(input.schedule);
  if (!schedule) errors.schedule = "Pick at least one day.";
  const startDate = cleanDate(input.startDate);
  if (!startDate) errors.startDate = "Use a valid start date.";
  if (Object.keys(errors).length || !schedule || !startDate) return { ok: false, errors };
  const hid = id ?? newId();
  const t = nowIso();
  update((d) => {
    const existing = d.habits.find((h) => h.id === hid);
    if (existing) {
      Object.assign(existing, { title, description: cleanText(input.description, 500), schedule, startDate, color: input.color, updatedAt: t });
    } else {
      d.habits.push({
        id: hid,
        title,
        description: cleanText(input.description, 500),
        schedule,
        startDate,
        pauses: [],
        color: input.color,
        archivedAt: null,
        createdAt: t,
        updatedAt: t,
      });
    }
  });
  return { ok: true, id: hid };
}

/** Record or remove a completion for a date. Future dates are refused. */
export function setHabitDone(habitId: string, date: ISODate, done: boolean, today: ISODate): void {
  if (date > today) return;
  update((d) => {
    const exists = d.habitEntries.some((e) => e.habitId === habitId && e.date === date);
    if (done && !exists) d.habitEntries.push({ id: newId(), habitId, date, createdAt: nowIso() });
    if (!done) d.habitEntries = d.habitEntries.filter((e) => !(e.habitId === habitId && e.date === date));
  });
}

function patchHabit(id: string, fn: (h: Habit) => void) {
  update((d) => {
    const h = d.habits.find((x) => x.id === id);
    if (h) {
      fn(h);
      h.updatedAt = nowIso();
    }
  });
}

export const pauseHabitNow = (id: string, today: ISODate) => patchHabit(id, (h) => (h.pauses = pauseHabit(h, today)));
export const resumeHabitNow = (id: string, today: ISODate) => patchHabit(id, (h) => (h.pauses = resumeHabit(h, today)));
export const archiveHabit = (id: string, archived: boolean) => patchHabit(id, (h) => (h.archivedAt = archived ? nowIso() : null));

export function deleteHabit(id: string): void {
  update((d) => {
    d.habits = d.habits.filter((h) => h.id !== id);
    d.habitEntries = d.habitEntries.filter((e) => e.habitId !== id);
  });
}

// ---------- Goals & projects ----------

export function saveGoal(
  id: string | null,
  input: Pick<Goal, "title" | "why" | "targetDate" | "status">,
): { ok: true; id: string } | { ok: false; errors: Record<string, string> } {
  const title = cleanTitle(input.title);
  if (!title) return { ok: false, errors: { title: "Name the goal." } };
  const gid = id ?? newId();
  const t = nowIso();
  update((d) => {
    const g = d.goals.find((x) => x.id === gid);
    const values = { title, why: cleanText(input.why, 2000), targetDate: cleanDate(input.targetDate), status: input.status };
    if (g) Object.assign(g, values, { updatedAt: t });
    else d.goals.push({ id: gid, ...values, createdAt: t, updatedAt: t });
  });
  return { ok: true, id: gid };
}

export function deleteGoal(id: string): void {
  update((d) => {
    d.goals = d.goals.filter((g) => g.id !== id);
    for (const p of d.projects) if (p.goalId === id) p.goalId = null;
    for (const t of d.tasks) if (t.goalId === id) t.goalId = null;
  });
}

export function saveProject(
  id: string | null,
  input: Pick<Project, "title" | "notes" | "goalId" | "dueDate" | "status">,
): { ok: true; id: string } | { ok: false; errors: Record<string, string> } {
  const title = cleanTitle(input.title);
  if (!title) return { ok: false, errors: { title: "Name the project." } };
  const pid = id ?? newId();
  const t = nowIso();
  update((d) => {
    const p = d.projects.find((x) => x.id === pid);
    const goalId = input.goalId && d.goals.some((g) => g.id === input.goalId) ? input.goalId : null;
    const values = { title, notes: cleanText(input.notes, 5000), goalId, dueDate: cleanDate(input.dueDate), status: input.status };
    if (p) Object.assign(p, values, { updatedAt: t });
    else d.projects.push({ id: pid, ...values, createdAt: t, updatedAt: t });
  });
  return { ok: true, id: pid };
}

export function deleteProject(id: string): void {
  update((d) => {
    d.projects = d.projects.filter((p) => p.id !== id);
    for (const t of d.tasks) if (t.projectId === id) t.projectId = null;
  });
}

// ---------- Daily review ----------

export function saveReview(input: {
  date: ISODate;
  note: string;
  plannedTaskIds: string[];
  completedTaskIds: string[];
  movedTaskIds: string[];
}): void {
  const t = nowIso();
  update((d) => {
    const r = d.reviews.find((x) => x.date === input.date);
    const values = { ...input, note: cleanText(input.note, LIMITS.reviewNote) };
    if (r) Object.assign(r, values, { updatedAt: t });
    else d.reviews.push({ id: newId(), ...values, createdAt: t, updatedAt: t });
  });
}

// ---------- Focus ----------

function focusOpts(d: LifeData) {
  return { autoStartBreak: d.settings.focus.autoStartBreak, newId };
}

/** Bring the persisted run up to date. Safe to call often and from several tabs. */
export function reconcileFocus(now = Date.now()): void {
  const run = getState().data.activeRun;
  if (!run) return;
  const probe = reconcile(run, now, focusOpts(getState().data));
  if (!probe.sessions.length && JSON.stringify(probe.run) === JSON.stringify(run)) return;
  update((d) => {
    if (!d.activeRun) return;
    const r = reconcile(d.activeRun, now, focusOpts(d));
    d.activeRun = r.run;
    d.focusSessions.push(...r.sessions);
  });
}

export interface StartFocusInput {
  preset: FocusPreset;
  taskId: string | null;
  projectId: string | null;
  blocklistId: string | null;
}

export function startFocus(input: StartFocusInput): FocusRun | null {
  let started: FocusRun | null = null;
  const now = Date.now();
  update((d) => {
    if (d.activeRun) {
      const r = endRun(d.activeRun, now, "ended_early", { newId });
      d.focusSessions.push(...r.sessions);
    }
    started = startRun(
      {
        id: newId(),
        presetName: input.preset.name,
        focusMinutes: input.preset.focusMinutes,
        breakMinutes: input.preset.breakMinutes,
        taskId: input.taskId,
        projectId: input.projectId,
        blocklistId: input.blocklistId,
      },
      now,
    );
    d.activeRun = started;
  });
  return started;
}

function withRun(fn: (run: FocusRun, d: LifeData, now: number) => void): void {
  const now = Date.now();
  update((d) => {
    if (!d.activeRun) return;
    const r = reconcile(d.activeRun, now, focusOpts(d));
    d.focusSessions.push(...r.sessions);
    d.activeRun = r.run;
    if (d.activeRun) fn(d.activeRun, d, now);
  });
}

export const pauseFocus = () => withRun((run, d, now) => (d.activeRun = pauseRun(run, now)));
export const resumeFocus = () => withRun((run, d, now) => (d.activeRun = resumeRun(run, now)));
export const nextFocus = () => withRun((run, d, now) => (d.activeRun = startNextFocus(run, now)));

export function skipFocusPhase(): void {
  withRun((run, d, now) => {
    const r = skipPhase(run, now, focusOpts(d));
    d.activeRun = r.run;
    d.focusSessions.push(...r.sessions);
  });
}

export function endFocus(outcome: "ended_early" | "interrupted"): void {
  withRun((run, d, now) => {
    const r = endRun(run, now, outcome, { newId });
    d.activeRun = null;
    d.focusSessions.push(...r.sessions);
  });
}

export function savePreset(preset: FocusPreset): { ok: true } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const name = cleanTitle(preset.name, 60);
  if (!name) errors.name = "Name the preset.";
  const focusMinutes = cleanInt(preset.focusMinutes, 1, LIMITS.focusMinutes);
  if (focusMinutes === null) errors.focusMinutes = `Focus must be 1–${LIMITS.focusMinutes} minutes.`;
  const breakMinutes = cleanInt(preset.breakMinutes, 0, LIMITS.breakMinutes);
  if (breakMinutes === null) errors.breakMinutes = `Break must be 0–${LIMITS.breakMinutes} minutes.`;
  if (Object.keys(errors).length || focusMinutes === null || breakMinutes === null) return { ok: false, errors };
  update((d) => {
    const next = { ...preset, name, focusMinutes, breakMinutes };
    const i = d.focusPresets.findIndex((p) => p.id === preset.id);
    if (i >= 0) d.focusPresets[i] = next;
    else d.focusPresets.push(next);
  });
  return { ok: true };
}

export function deletePreset(id: string): void {
  update((d) => {
    d.focusPresets = d.focusPresets.filter((p) => p.id !== id);
    if (d.settings.focus.defaultPresetId === id) d.settings.focus.defaultPresetId = d.focusPresets[0]?.id ?? null;
  });
}

// ---------- Blocklists ----------

export function saveBlocklist(id: string | null, name: string, domains: string[]): string {
  const bid = id ?? newId();
  const t = nowIso();
  update((d) => {
    const b = d.blocklists.find((x) => x.id === bid);
    const values: Pick<Blocklist, "name" | "domains"> = {
      name: cleanTitle(name, 60) || "Blocklist",
      domains: domains.slice(0, LIMITS.domainsPerList),
    };
    if (b) Object.assign(b, values, { updatedAt: t });
    else d.blocklists.push({ id: bid, ...values, createdAt: t, updatedAt: t });
  });
  return bid;
}

export function deleteBlocklist(id: string): void {
  update((d) => {
    d.blocklists = d.blocklists.filter((b) => b.id !== id);
    for (const p of d.focusPresets) if (p.blocklistId === id) p.blocklistId = null;
  });
}

// ---------- Settings ----------

export function updateSettings(patch: Partial<Settings>): void {
  update((d) => {
    d.settings = { ...d.settings, ...patch, focus: { ...d.settings.focus, ...(patch.focus ?? {}) } };
  });
}
