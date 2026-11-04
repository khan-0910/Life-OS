"use client";

import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CalendarClock, Clock3, Flag, PencilLine, Timer } from "lucide-react";
import { addDays, isOverdue, type ISODate, type Priority, type Task } from "@lifeos/domain";
import { createTask, deleteTask, setTaskStatus, toggleTask, updateTask, type TaskInput } from "@/lib/actions";
import { relativeDay } from "@/lib/format";
import { fxTrail } from "@/lib/fx";
import { holdCompleted, releaseHold, t as motionT } from "@/lib/motion";
import { useData } from "@/lib/store";
import { Button, CheckButton, Dialog, Field, IconButton, Input, Segmented, Select, Textarea, cx } from "./ui";
import { toast } from "./toast";

export const PRIORITY_LABEL: Record<Priority, string> = { high: "High", medium: "Medium", low: "Low", none: "None" };
const PRIORITY_COLOR: Record<Priority, string> = { high: "text-rose", medium: "text-amber", low: "text-sky", none: "text-ink-3" };

/**
 * Saves immediately; the row then holds in place, checked, for a beat, and a
 * pastel trail flies from the check to the daily progress ring (presentation only).
 */
export function completeWithUndo(task: Task, from?: Element | null) {
  const nowDone = toggleTask(task.id);
  if (nowDone) {
    holdCompleted(task.id);
    fxTrail(from, '[data-fx-target="tasks"]', ["#6fd0a2", "#ff8a4c", "#ffb38a"]);
    toast(`Completed “${task.title}”`, {
      action: {
        label: "Undo",
        run: () => {
          releaseHold(task.id);
          toggleTask(task.id);
        },
      },
    });
  } else releaseHold(task.id);
}

export function TaskRow({
  task,
  today,
  onEdit,
  showFocus = true,
  compact,
  holding = false,
}: {
  task: Task;
  today: ISODate;
  onEdit: (t: Task) => void;
  showFocus?: boolean;
  compact?: boolean;
  /** Just completed and still shown in its old list. */
  holding?: boolean;
}) {
  const data = useData();
  const project = task.projectId ? data.projects.find((p) => p.id === task.projectId) : null;
  const done = task.status === "done";
  const overdue = isOverdue(task, today);
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 14, height: 0, paddingTop: 0, paddingBottom: 0, transition: { ...motionT.panel, opacity: motionT.ui } }}
      transition={motionT.ui}
      className={cx("group relative flex items-start gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-ink/[0.03]", compact && "py-1.5")}
    >
      {/* Completion accent: a soft sage wash while the row holds, then it slides away. */}
      <motion.span aria-hidden className="pointer-events-none absolute inset-0 rounded-xl bg-sage/[0.09]" initial={false} animate={{ opacity: holding ? 1 : 0 }} transition={motionT.ui} />
      <div className="relative pt-0.5">
        <CheckButton checked={done} onToggle={(e) => completeWithUndo(task, e.currentTarget)} label={`${done ? "Reopen" : "Complete"} ${task.title}`} />
      </div>
      <div className="relative min-w-0 flex-1">
        <button type="button" onClick={() => onEdit(task)} className="block max-w-full text-left">
          <span className={cx("text-sm leading-5 transition-colors duration-300", done ? "text-ink-3 line-through decoration-ink-3/60" : "text-ink")}>{task.title}</span>
        </button>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-3">
          {task.priority !== "none" && !done ? (
            <span className={cx("inline-flex items-center gap-1", PRIORITY_COLOR[task.priority])}>
              <Flag size={11} aria-hidden /> {PRIORITY_LABEL[task.priority]}
            </span>
          ) : null}
          {task.dueDate ? (
            <span className={cx("inline-flex items-center gap-1", overdue && "text-rose")}>
              <CalendarClock size={11} aria-hidden /> {overdue ? "Overdue · " : "Due "}
              {relativeDay(task.dueDate, today)}
            </span>
          ) : null}
          {task.plannedFor && task.plannedFor !== today ? <span>Planned {relativeDay(task.plannedFor, today)}</span> : null}
          {task.estimateMinutes ? (
            <span className="inline-flex items-center gap-1">
              <Clock3 size={11} aria-hidden /> {task.estimateMinutes} min
            </span>
          ) : null}
          {project ? <span className="truncate">{project.title}</span> : null}
        </div>
      </div>
      <div className="relative flex items-center gap-0.5 opacity-100 transition-opacity lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
        {showFocus && !done ? (
          <Link href={`/focus?task=${encodeURIComponent(task.id)}`} aria-label={`Focus on ${task.title}`} title="Focus on this" className="inline-flex size-8 items-center justify-center rounded-lg text-ink-3 hover:bg-hover hover:text-amber">
            <Timer size={15} />
          </Link>
        ) : null}
        <IconButton label={`Edit ${task.title}`} onClick={() => onEdit(task)}>
          <PencilLine size={15} />
        </IconButton>
      </div>
    </motion.li>
  );
}

export function TaskList({
  tasks,
  today,
  onEdit,
  empty,
  compact,
  held,
}: {
  tasks: Task[];
  today: ISODate;
  onEdit: (t: Task) => void;
  empty?: ReactNode;
  compact?: boolean;
  held?: ReadonlySet<string>;
}) {
  if (!tasks.length && empty) return <>{empty}</>;
  return (
    <ul className="-mx-2.5 flex flex-col">
      <AnimatePresence initial={false}>
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} today={today} onEdit={onEdit} compact={compact} holding={held?.has(t.id)} />
        ))}
      </AnimatePresence>
    </ul>
  );
}

// ---------- Editor ----------

function toInput(t: Task | null, defaults: Partial<Task>): Record<string, string> {
  const src = { ...(t ?? {}), ...(!t ? defaults : {}) } as Partial<Task>;
  return {
    title: src.title ?? "",
    notes: src.notes ?? "",
    status: src.status ?? "todo",
    priority: src.priority ?? "none",
    dueDate: src.dueDate ?? "",
    plannedFor: src.plannedFor ?? "",
    estimateMinutes: src.estimateMinutes ? String(src.estimateMinutes) : "",
    projectId: src.projectId ?? "",
    goalId: src.goalId ?? "",
  };
}

export function TaskEditor({ task, open, onClose, defaults = {} }: { task: Task | null; open: boolean; onClose: () => void; defaults?: Partial<Task> }) {
  return open ? <TaskEditorInner key={task?.id ?? "new"} task={task} onClose={onClose} defaults={defaults} /> : null;
}

function TaskEditorInner({ task, onClose, defaults }: { task: Task | null; onClose: () => void; defaults: Partial<Task> }) {
  const data = useData();
  const [form, setForm] = useState(() => toInput(task, defaults));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const input: TaskInput = { ...form, estimateMinutes: form.estimateMinutes || null, dueDate: form.dueDate || null, plannedFor: form.plannedFor || null };
    const r = task ? updateTask(task.id, input) : createTask(input);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    // Status goes through setTaskStatus so completedAt stays truthful.
    if (task && form.status !== task.status) setTaskStatus(task.id, form.status as Task["status"]);
    toast(task ? "Task saved" : "Task added");
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={task ? "Edit task" : "New task"}
      wide
      footer={
        <>
          {task ? (
            <Button
              variant={confirmDelete ? "danger" : "ghost"}
              className="mr-auto"
              onClick={() => {
                if (!confirmDelete) return setConfirmDelete(true);
                deleteTask(task.id);
                toast("Task deleted");
                onClose();
              }}
            >
              {confirmDelete ? "Confirm delete" : "Delete"}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="task-form">
            {task ? "Save" : "Add task"}
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" error={errors.title} className="sm:col-span-2">
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.title} autoFocus value={form.title} onChange={set("title")} maxLength={200} />}
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          {(id) => <Textarea id={id} value={form.notes} onChange={set("notes")} rows={3} />}
        </Field>
        <Field label="Status">
          {(id) => (
            <Select id={id} value={form.status} onChange={set("status")} disabled={!task}>
              <option value="todo">To do</option>
              <option value="doing">In progress</option>
              <option value="done">Done</option>
            </Select>
          )}
        </Field>
        <Field label="Priority">
          {(id) => (
            <Select id={id} value={form.priority} onChange={set("priority")}>
              {(["high", "medium", "low", "none"] as const).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Planned for" hint="The day you mean to work on it." error={errors.plannedFor}>
          {(id, d) => <Input id={id} type="date" aria-describedby={d} value={form.plannedFor} onChange={set("plannedFor")} />}
        </Field>
        <Field label="Due date" error={errors.dueDate}>
          {(id, d) => <Input id={id} type="date" aria-describedby={d} value={form.dueDate} onChange={set("dueDate")} />}
        </Field>
        <Field label="Estimate (minutes)" error={errors.estimateMinutes}>
          {(id, d) => <Input id={id} type="number" inputMode="numeric" min={1} max={1440} aria-describedby={d} aria-invalid={!!errors.estimateMinutes} value={form.estimateMinutes} onChange={set("estimateMinutes")} />}
        </Field>
        <Field label="Project">
          {(id) => (
            <Select id={id} value={form.projectId} onChange={set("projectId")}>
              <option value="">No project</option>
              {data.projects
                .filter((p) => p.status !== "archived" || p.id === form.projectId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
            </Select>
          )}
        </Field>
        <Field label="Goal" className="sm:col-span-2" hint="Link directly to a goal, or through a project.">
          {(id, d) => (
            <Select id={id} aria-describedby={d} value={form.goalId} onChange={set("goalId")}>
              <option value="">No goal</option>
              {data.goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

// ---------- Quick capture ----------

type When = "today" | "tomorrow" | "someday" | "date";

export function QuickCapture({ open, onClose, today }: { open: boolean; onClose: () => void; today: ISODate }) {
  return open ? <QuickCaptureInner onClose={onClose} today={today} /> : null;
}

function QuickCaptureInner({ onClose, today }: { onClose: () => void; today: ISODate }) {
  const data = useData();
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState<When>("today");
  const [date, setDate] = useState(addDays(today, 2));
  const [priority, setPriority] = useState<Priority>("none");
  const [projectId, setProjectId] = useState("");
  const [keepOpen, setKeepOpen] = useState(false);
  const [error, setError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);
  const plannedFor = useMemo(() => (when === "today" ? today : when === "tomorrow" ? addDays(today, 1) : when === "date" ? date : null), [when, today, date]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = createTask({ title, plannedFor, priority, projectId: projectId || null });
    if (!r.ok) {
      setError(r.errors.title ?? Object.values(r.errors)[0]);
      return;
    }
    toast("Task captured");
    if (keepOpen) {
      setTitle("");
      setError(undefined);
      inputRef.current?.focus();
    } else onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Quick capture"
      description="A plain, fast form. Type the task; set the day and priority with the controls."
      footer={
        <>
          <label className="mr-auto inline-flex items-center gap-2 text-[13px] text-ink-3">
            <input type="checkbox" checked={keepOpen} onChange={(e) => setKeepOpen(e.target.checked)} className="accent-[var(--color-sage)]" />
            Keep open
          </label>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="capture-form">
            Add task
          </Button>
        </>
      }
    >
      <form id="capture-form" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Task" error={error}>
          {(id, d) => <Input ref={inputRef} id={id} aria-describedby={d} aria-invalid={!!error} autoFocus placeholder="What needs doing?" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />}
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-2">When</span>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented<When>
              label="When"
              value={when}
              onChange={setWhen}
              options={[
                { value: "today", label: "Today" },
                { value: "tomorrow", label: "Tomorrow" },
                { value: "date", label: "Pick date" },
                { value: "someday", label: "Someday" },
              ]}
            />
            {when === "date" ? <Input type="date" aria-label="Planned date" className="w-auto!" value={date} min={today} onChange={(e) => setDate(e.target.value)} /> : null}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink-2">Priority</span>
            <Segmented<Priority>
              label="Priority"
              size="sm"
              value={priority}
              onChange={setPriority}
              options={[
                { value: "none", label: "None" },
                { value: "low", label: "Low" },
                { value: "medium", label: "Med" },
                { value: "high", label: "High" },
              ]}
            />
          </div>
          <Field label="Project">
            {(id) => (
              <Select id={id} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">No project</option>
                {data.projects
                  .filter((p) => p.status === "active")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        </div>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
