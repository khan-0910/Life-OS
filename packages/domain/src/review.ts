import { completedOn, isOpen } from "./tasks";
import type { ISODate } from "./time";
import type { Task } from "./types";

export interface DaySummary {
  /** Tasks planned for, or due on, the date. */
  planned: Task[];
  /** Tasks completed on the date (user tz), planned or not. */
  completed: Task[];
  /** Planned tasks still open — candidates to move. */
  unfinished: Task[];
}

export function summarizeDay(tasks: Task[], date: ISODate, tz: string): DaySummary {
  const planned = tasks.filter((t) => t.plannedFor === date || t.dueDate === date);
  return {
    planned,
    completed: tasks.filter((t) => completedOn(t, date, tz)),
    unfinished: planned.filter(isOpen),
  };
}
