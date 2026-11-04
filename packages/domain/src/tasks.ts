import { dateInTz, type ISODate } from "./time";
import type { Priority, Task } from "./types";

export const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2, none: 3 };

export function isOpen(task: Task): boolean {
  return task.status !== "done";
}

export function isOverdue(task: Task, today: ISODate): boolean {
  return isOpen(task) && task.dueDate !== null && task.dueDate < today;
}

/** Open tasks that need attention today: due today/earlier, or planned for today. */
export function isDueToday(task: Task, today: ISODate): boolean {
  if (!isOpen(task)) return false;
  return (task.dueDate !== null && task.dueDate <= today) || task.plannedFor === today;
}

/**
 * Unfinished tasks planned for an earlier day. These are offered for rollover;
 * nothing is moved until the user chooses.
 */
export function rolloverCandidates(tasks: Task[], today: ISODate): Task[] {
  return tasks.filter((t) => isOpen(t) && t.plannedFor !== null && t.plannedFor < today);
}

export function completedOn(task: Task, date: ISODate, tz: string): boolean {
  return task.status === "done" && task.completedAt !== null && dateInTz(task.completedAt, tz) === date;
}

export type TaskScope = "all" | "today" | "overdue" | "upcoming" | "unscheduled";

export interface TaskFilter {
  status?: "open" | "done" | "all";
  scope?: TaskScope;
  priority?: Priority | "any";
  projectId?: string | "any";
  query?: string;
}

export function filterTasks(tasks: Task[], filter: TaskFilter, today: ISODate): Task[] {
  const q = filter.query?.trim().toLowerCase() ?? "";
  return tasks.filter((t) => {
    const status = filter.status ?? "open";
    if (status === "open" && !isOpen(t)) return false;
    if (status === "done" && isOpen(t)) return false;
    if (filter.priority && filter.priority !== "any" && t.priority !== filter.priority) return false;
    if (filter.projectId && filter.projectId !== "any" && t.projectId !== filter.projectId) return false;
    switch (filter.scope ?? "all") {
      case "today":
        if (!isDueToday(t, today) && t.plannedFor !== today) return false;
        break;
      case "overdue":
        if (!isOverdue(t, today)) return false;
        break;
      case "upcoming":
        if (!((t.dueDate && t.dueDate > today) || (t.plannedFor && t.plannedFor > today))) return false;
        break;
      case "unscheduled":
        if (t.dueDate || t.plannedFor) return false;
        break;
    }
    if (q && !t.title.toLowerCase().includes(q) && !t.notes.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Open before done; then priority, earliest due date, then oldest first. */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (isOpen(a) !== isOpen(b)) return isOpen(a) ? -1 : 1;
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (p !== 0) return p;
    const ad = a.dueDate ?? "9999-12-31";
    const bd = b.dueDate ?? "9999-12-31";
    if (ad !== bd) return ad < bd ? -1 : 1;
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
  });
}
