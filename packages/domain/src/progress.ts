/**
 * Progress is computed only from linked tasks — never entered by hand.
 * - Project progress: done ÷ all tasks whose projectId is the project.
 * - Goal progress: done ÷ the union of tasks linked to the goal directly and tasks
 *   in projects linked to the goal (each task counted once).
 * `ratio` is null when there is no linked work, so the UI can say so instead of 0%.
 */
import type { Project, Task } from "./types";

export interface Progress {
  done: number;
  total: number;
  ratio: number | null;
}

function summarize(tasks: Task[]): Progress {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  return { done, total, ratio: total === 0 ? null : done / total };
}

export function projectTasks(projectId: string, tasks: Task[]): Task[] {
  return tasks.filter((t) => t.projectId === projectId);
}

export function goalTasks(goalId: string, projects: Project[], tasks: Task[]): Task[] {
  const projectIds = new Set(projects.filter((p) => p.goalId === goalId).map((p) => p.id));
  return tasks.filter((t) => t.goalId === goalId || (t.projectId !== null && projectIds.has(t.projectId)));
}

export function projectProgress(projectId: string, tasks: Task[]): Progress {
  return summarize(projectTasks(projectId, tasks));
}

export function goalProgress(goalId: string, projects: Project[], tasks: Task[]): Progress {
  return summarize(goalTasks(goalId, projects, tasks));
}
