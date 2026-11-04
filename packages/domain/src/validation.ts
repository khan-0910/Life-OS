import { isISODate, type ISODate } from "./time";
import type { BlockKind, Priority, TaskStatus } from "./types";

export const LIMITS = {
  title: 200,
  notes: 10_000,
  reviewNote: 20_000,
  estimateMinutes: 24 * 60,
  focusMinutes: 240,
  breakMinutes: 120,
  domainsPerList: 200,
} as const;

/** Trim, collapse internal whitespace, strip control characters, cap length. */
export function cleanTitle(value: unknown, max: number = LIMITS.title): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Keep newlines, strip other control characters, cap length. */
export function cleanText(value: unknown, max: number = LIMITS.notes): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, max);
}

export function cleanDate(value: unknown): ISODate | null {
  return isISODate(value) ? value : null;
}

export function cleanInt(value: unknown, min: number, max: number): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r < min || r > max) return null;
  return r;
}

const PRIORITIES: readonly Priority[] = ["high", "medium", "low", "none"];
const STATUSES: readonly TaskStatus[] = ["todo", "doing", "done"];
const KINDS: readonly BlockKind[] = ["focus", "meeting", "admin", "personal"];

export function isPriority(v: unknown): v is Priority {
  return PRIORITIES.includes(v as Priority);
}
export function isTaskStatus(v: unknown): v is TaskStatus {
  return STATUSES.includes(v as TaskStatus);
}
export function isBlockKind(v: unknown): v is BlockKind {
  return KINDS.includes(v as BlockKind);
}

export interface TaskDraft {
  title: string;
  notes: string;
  priority: Priority;
  dueDate: ISODate | null;
  plannedFor: ISODate | null;
  estimateMinutes: number | null;
  projectId: string | null;
  goalId: string | null;
}

export type Result<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

export function validateTaskDraft(input: Record<string, unknown>): Result<TaskDraft> {
  const errors: Record<string, string> = {};
  const title = cleanTitle(input.title);
  if (!title) errors.title = "Give the task a title.";
  const dueDate = input.dueDate ? cleanDate(input.dueDate) : null;
  if (input.dueDate && !dueDate) errors.dueDate = "Use a valid date.";
  const plannedFor = input.plannedFor ? cleanDate(input.plannedFor) : null;
  if (input.plannedFor && !plannedFor) errors.plannedFor = "Use a valid date.";
  let estimateMinutes: number | null = null;
  if (input.estimateMinutes !== undefined && input.estimateMinutes !== null && input.estimateMinutes !== "") {
    estimateMinutes = cleanInt(input.estimateMinutes, 1, LIMITS.estimateMinutes);
    if (estimateMinutes === null) errors.estimateMinutes = "Estimate must be 1–1440 minutes.";
  }
  const priority = isPriority(input.priority) ? input.priority : "none";
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      title,
      notes: cleanText(input.notes),
      priority,
      dueDate,
      plannedFor,
      estimateMinutes,
      projectId: typeof input.projectId === "string" && input.projectId ? input.projectId : null,
      goalId: typeof input.goalId === "string" && input.goalId ? input.goalId : null,
    },
  };
}
