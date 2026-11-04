"use client";

import { useMemo, useState, type FormEvent } from "react";
import { FolderKanban, PencilLine, Plus, Target } from "lucide-react";
import { goalProgress, goalTasks, projectProgress, projectTasks, sortTasks, type Goal, type GoalStatus, type Project, type ProjectStatus, type Task } from "@lifeos/domain";
import { deleteGoal, deleteProject, saveGoal, saveProject } from "@/lib/actions";
import { relativeDay } from "@/lib/format";
import { useToday } from "@/lib/hooks";
import { useData } from "@/lib/store";
import { TaskEditor, TaskList } from "../tasks";
import { toast } from "../toast";
import { AnimatedNumber, Badge, Button, Card, Dialog, EmptyState, Field, IconButton, Input, PageHeader, ProgressBar, ProgressRing, Select, Textarea, cx } from "../ui";

type Detail = { kind: "goal"; id: string } | { kind: "project"; id: string };

export function GoalsView() {
  const data = useData();
  const { today } = useToday();
  const [goalEditor, setGoalEditor] = useState<{ goal: Goal | null } | null>(null);
  const [projectEditor, setProjectEditor] = useState<{ project: Project | null; goalId?: string } | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const goals = data.goals.filter((g) => showArchived || g.status !== "archived");
  const projects = data.projects.filter((p) => showArchived || p.status !== "archived");

  return (
    <div>
      <PageHeader
        title="Goals"
        subtitle="Goals are outcomes; projects are bodies of work. Progress comes only from linked tasks."
        actions={
          <>
            <Button onClick={() => setProjectEditor({ project: null })}>
              <Plus size={15} aria-hidden /> Project
            </Button>
            <Button variant="primary" onClick={() => setGoalEditor({ goal: null })}>
              <Plus size={15} aria-hidden /> Goal
            </Button>
          </>
        }
      />

      <section aria-labelledby="goals-title">
        <h2 id="goals-title" className="mb-3 text-[13px] font-medium tracking-wide text-ink-2 uppercase">
          Goals
        </h2>
        {goals.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {goals.map((g) => {
              const prog = goalProgress(g.id, data.projects, data.tasks);
              const linkedProjects = data.projects.filter((p) => p.goalId === g.id);
              return (
                <Card lift as="article" key={g.id} className="flex gap-4">
                  <ProgressRing value={prog.ratio} size={64} stroke={7} gradient={["#ff8fa3", "#ff8a4c"]} label={`${g.title} progress: ${prog.done} of ${prog.total} tasks`}>
                    <span className="text-xs font-medium tabular">{prog.ratio === null ? "—" : <AnimatedNumber value={`${Math.round(prog.ratio * 100)}%`} />}</span>
                  </ProgressRing>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" className="text-left text-[15px] font-medium hover:underline" onClick={() => setDetail({ kind: "goal", id: g.id })}>
                        {g.title}
                      </button>
                      <IconButton label={`Edit ${g.title}`} onClick={() => setGoalEditor({ goal: g })}>
                        <PencilLine size={15} />
                      </IconButton>
                    </div>
                    {g.why ? <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-3">{g.why}</p> : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                      <span>{prog.total ? `${prog.done} of ${prog.total} linked tasks done` : "No linked tasks yet"}</span>
                      {g.targetDate ? <Badge tone={g.targetDate < today && g.status === "active" ? "rose" : "neutral"}>Target {relativeDay(g.targetDate, today)}</Badge> : null}
                      {g.status !== "active" ? <Badge tone={g.status === "achieved" ? "sage" : "neutral"}>{g.status}</Badge> : null}
                    </div>
                    {linkedProjects.length ? <p className="mt-2 truncate text-xs text-ink-3">Projects: {linkedProjects.map((p) => p.title).join(", ")}</p> : null}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={<Target size={22} />} title="No goals yet" action={<Button variant="primary" onClick={() => setGoalEditor({ goal: null })}>Add a goal</Button>}>
            Describe an outcome you want. Link tasks or projects to it and its progress fills in from real work.
          </EmptyState>
        )}
      </section>

      <section aria-labelledby="projects-title" className="mt-10">
        <h2 id="projects-title" className="mb-3 text-[13px] font-medium tracking-wide text-ink-2 uppercase">
          Projects
        </h2>
        {projects.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => {
              const prog = projectProgress(p.id, data.tasks);
              const goal = data.goals.find((g) => g.id === p.goalId);
              return (
                <Card lift as="article" key={p.id} className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" className="text-left text-sm font-medium hover:underline" onClick={() => setDetail({ kind: "project", id: p.id })}>
                      {p.title}
                    </button>
                    <IconButton label={`Edit ${p.title}`} onClick={() => setProjectEditor({ project: p })}>
                      <PencilLine size={15} />
                    </IconButton>
                  </div>
                  <ProgressBar value={prog.ratio} label={`${p.title} progress`} color={p.status === "done" ? "bg-sticky-green" : "bg-sticky-orange"} />
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                    <span className="tabular">{prog.total ? <><AnimatedNumber value={`${prog.done}/${prog.total}`} /> tasks</> : "No tasks yet"}</span>
                    {p.dueDate ? <Badge tone={p.dueDate < today && p.status === "active" ? "rose" : "neutral"}>Due {relativeDay(p.dueDate, today)}</Badge> : null}
                    {goal ? <Badge tone="violet">{goal.title}</Badge> : null}
                    {p.status !== "active" ? <Badge>{p.status}</Badge> : null}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={<FolderKanban size={22} />} title="No projects yet">
            Group related tasks into a project, optionally under a goal.
          </EmptyState>
        )}
      </section>

      {data.goals.some((g) => g.status === "archived") || data.projects.some((p) => p.status === "archived") ? (
        <Button size="sm" variant="ghost" className="mt-6" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? "Hide archived" : "Show archived"}
        </Button>
      ) : null}

      <GoalEditor state={goalEditor} onClose={() => setGoalEditor(null)} />
      <ProjectEditor state={projectEditor} onClose={() => setProjectEditor(null)} />
      <DetailDialog detail={detail} today={today} onClose={() => setDetail(null)} onAddProject={(goalId) => setProjectEditor({ project: null, goalId })} />
    </div>
  );
}

function DetailDialog({ detail, today, onClose, onAddProject }: { detail: Detail | null; today: string; onClose: () => void; onAddProject: (goalId: string) => void }) {
  const data = useData();
  const [editing, setEditing] = useState<Task | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const item = detail ? (detail.kind === "goal" ? data.goals.find((g) => g.id === detail.id) : data.projects.find((p) => p.id === detail.id)) : null;
  const tasks = useMemo(() => {
    if (!detail) return [];
    return sortTasks(detail.kind === "goal" ? goalTasks(detail.id, data.projects, data.tasks) : projectTasks(detail.id, data.tasks));
  }, [detail, data.projects, data.tasks]);
  if (!detail || !item) return null;
  const done = tasks.filter((t) => t.status === "done").length;
  return (
    <>
      <Dialog
        open={!taskOpen}
        onClose={onClose}
        wide
        title={item.title}
        description={tasks.length ? `${done} of ${tasks.length} linked tasks done${detail.kind === "goal" ? " (direct and via projects)" : ""}` : "No linked tasks yet"}
        footer={
          <>
            {detail.kind === "goal" ? (
              <Button variant="ghost" className="mr-auto" onClick={() => onAddProject(detail.id)}>
                + Project under this goal
              </Button>
            ) : null}
            <Button
              variant="primary"
              onClick={() => {
                setEditing(null);
                setTaskOpen(true);
              }}
            >
              <Plus size={15} aria-hidden /> Linked task
            </Button>
          </>
        }
      >
        <TaskList
          tasks={tasks}
          today={today}
          onEdit={(t) => {
            setEditing(t);
            setTaskOpen(true);
          }}
          empty={<EmptyState title="Nothing linked yet">Add a task here, or set its {detail.kind} in the task editor.</EmptyState>}
        />
      </Dialog>
      <TaskEditor open={taskOpen} task={editing} onClose={() => setTaskOpen(false)} defaults={detail.kind === "goal" ? { goalId: detail.id } : { projectId: detail.id }} />
    </>
  );
}

function GoalEditor({ state, onClose }: { state: { goal: Goal | null } | null; onClose: () => void }) {
  if (!state) return null;
  return <GoalEditorInner key={state.goal?.id ?? "new"} goal={state.goal} onClose={onClose} />;
}

function GoalEditorInner({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const [form, setForm] = useState({ title: goal?.title ?? "", why: goal?.why ?? "", targetDate: goal?.targetDate ?? "", status: goal?.status ?? ("active" as GoalStatus) });
  const [error, setError] = useState<string>();
  const [armed, setArmed] = useState(false);
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const r = saveGoal(goal?.id ?? null, { ...form, targetDate: form.targetDate || null });
    if (!r.ok) return setError(r.errors.title);
    toast(goal ? "Goal saved" : "Goal added");
    onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={goal ? "Edit goal" : "New goal"}
      footer={
        <>
          {goal ? (
            <Button
              variant={armed ? "danger" : "ghost"}
              className="mr-auto"
              onClick={() => {
                if (!armed) return setArmed(true);
                deleteGoal(goal.id);
                toast("Goal deleted — linked tasks and projects were kept");
                onClose();
              }}
            >
              {armed ? "Confirm delete" : "Delete"}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="goal-form">
            Save
          </Button>
        </>
      }
    >
      <form id="goal-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Goal" error={error} className="sm:col-span-2">
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!error} autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} />}
        </Field>
        <Field label="Why it matters" className="sm:col-span-2">
          {(id) => <Textarea id={id} rows={2} value={form.why} onChange={(e) => setForm({ ...form, why: e.target.value })} />}
        </Field>
        <Field label="Target date">{(id) => <Input id={id} type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />}</Field>
        <Field label="Status">
          {(id) => (
            <Select id={id} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as GoalStatus })}>
              <option value="active">Active</option>
              <option value="achieved">Achieved</option>
              <option value="archived">Archived</option>
            </Select>
          )}
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

function ProjectEditor({ state, onClose }: { state: { project: Project | null; goalId?: string } | null; onClose: () => void }) {
  if (!state) return null;
  return <ProjectEditorInner key={state.project?.id ?? `new-${state.goalId ?? ""}`} project={state.project} goalId={state.goalId} onClose={onClose} />;
}

function ProjectEditorInner({ project, goalId, onClose }: { project: Project | null; goalId?: string; onClose: () => void }) {
  const data = useData();
  const [form, setForm] = useState({
    title: project?.title ?? "",
    notes: project?.notes ?? "",
    goalId: project?.goalId ?? goalId ?? "",
    dueDate: project?.dueDate ?? "",
    status: project?.status ?? ("active" as ProjectStatus),
  });
  const [error, setError] = useState<string>();
  const [armed, setArmed] = useState(false);
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const r = saveProject(project?.id ?? null, { ...form, goalId: form.goalId || null, dueDate: form.dueDate || null });
    if (!r.ok) return setError(r.errors.title);
    toast(project ? "Project saved" : "Project added");
    onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={project ? "Edit project" : "New project"}
      footer={
        <>
          {project ? (
            <Button
              variant={armed ? "danger" : "ghost"}
              className="mr-auto"
              onClick={() => {
                if (!armed) return setArmed(true);
                deleteProject(project.id);
                toast("Project deleted — its tasks were kept");
                onClose();
              }}
            >
              {armed ? "Confirm delete" : "Delete"}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="project-form">
            Save
          </Button>
        </>
      }
    >
      <form id="project-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Project" error={error} className="sm:col-span-2">
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!error} autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} />}
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          {(id) => <Textarea id={id} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}
        </Field>
        <Field label="Goal">
          {(id) => (
            <Select id={id} value={form.goalId} onChange={(e) => setForm({ ...form, goalId: e.target.value })}>
              <option value="">No goal</option>
              {data.goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Due date">{(id) => <Input id={id} type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />}</Field>
        <Field label="Status" className={cx("sm:col-span-2")}>
          {(id) => (
            <Select id={id} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}>
              <option value="active">Active</option>
              <option value="done">Done</option>
              <option value="archived">Archived</option>
            </Select>
          )}
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
