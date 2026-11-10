"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Archive, ArchiveRestore, CalendarDays, Pause, PencilLine, Play, Plus, Repeat } from "lucide-react";
import {
  addDays,
  completionRate,
  currentStreak,
  dayState,
  doneDates,
  isHabitDue,
  isPausedOn,
  longestStreak,
  startOfWeek,
  type DayState,
  type Habit,
  type HabitSchedule,
  type ISODate,
} from "@lifeos/domain";
import { archiveHabit, deleteHabit, pauseHabitNow, resumeHabitNow, saveHabit, setHabitDone } from "@/lib/actions";
import { formatDateLong, formatDateShort, formatWeekday, pct } from "@/lib/format";
import { useToday } from "@/lib/hooks";
import { motion } from "motion/react";
import { useBump } from "@/lib/motion";
import { useData } from "@/lib/store";
import { toast } from "../toast";
import { AnimatedNumber, Badge, Button, Card, CheckButton, Dialog, EmptyState, Field, IconButton, Input, PageHeader, ProgressRing, Textarea, cx } from "../ui";

export const HABIT_COLORS = ["sage", "amber", "violet", "sky"] as const;
export const HABIT_TONE: Record<string, (typeof HABIT_COLORS)[number]> = { sage: "sage", amber: "amber", violet: "violet", sky: "sky" };
/** Mid-pastel marks: lively on cream; every value is also shown as text. */
const COLOR_NAME: Record<string, string> = { sage: "Green", amber: "Ochre", violet: "Jade", sky: "Raspberry" };
const COLOR_VAR: Record<string, string> = { sage: "#3fb583", amber: "#e09a2b", violet: "#2a9d7f", sky: "#e2557a" };
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function scheduleLabel(s: HabitSchedule): string {
  if (s.type === "daily") return "Every day";
  if (s.days.length === 5 && [1, 2, 3, 4, 5].every((d) => s.days.includes(d))) return "Weekdays";
  return s.days.map((d) => DAY_NAMES[d]).join(", ");
}

const STATE_LABEL: Record<DayState, string> = {
  done: "Done",
  missed: "Missed",
  open: "Due today, not done yet",
  not_due: "Not scheduled",
  paused: "Paused",
  extra: "Done on an unscheduled day (doesn't count toward streak)",
  future: "Upcoming",
  before_start: "Before start",
};

function DayCell({ state, color, size = "sm" }: { state: DayState; color: string; size?: "sm" | "md" }) {
  const base = size === "sm" ? "size-3.5 rounded-[4px]" : "size-7 rounded-md";
  const styles: Partial<Record<DayState, React.CSSProperties>> = {
    done: { background: color },
    extra: { background: `color-mix(in srgb, ${color} 40%, transparent)` },
    missed: { background: "rgb(238 143 128 / 0.16)", boxShadow: "inset 0 0 0 1px rgb(238 143 128 / 0.35)" },
    open: { boxShadow: `inset 0 0 0 1.5px ${color}` },
    paused: { background: "repeating-linear-gradient(45deg, rgb(29 26 22 / 0.10) 0 2px, transparent 2px 5px)" },
    not_due: { background: "rgb(29 26 22 / 0.04)" },
    future: { background: "transparent", boxShadow: "inset 0 0 0 1px rgb(29 26 22 / 0.05)" },
    before_start: { background: "transparent" },
  };
  const filled = state === "done" || state === "extra";
  // Pops only when a cell becomes filled (initial={false}: never on first paint, so long histories don't cascade).
  return (
    <motion.span
      className={cx("inline-block transition-[background,box-shadow] duration-300", base)}
      style={styles[state]}
      initial={false}
      animate={filled ? { scale: [1, 1.3, 1] } : { scale: 1 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
    />
  );
}

export function HabitsView() {
  const data = useData();
  const { today } = useToday();
  const [editor, setEditor] = useState<{ habit: Habit | null } | null>(null);
  const [historyFor, setHistoryFor] = useState<Habit | null>(null);
  const active = data.habits.filter((h) => !h.archivedAt);
  const archived = data.habits.filter((h) => h.archivedAt);

  return (
    <div>
      <PageHeader
        title="Habits"
        subtitle="Small, repeatable things. Streaks count scheduled days only."
        actions={
          <Button variant="primary" onClick={() => setEditor({ habit: null })}>
            <Plus size={15} aria-hidden /> New habit
          </Button>
        }
      />
      {active.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map((h) => (
            <HabitCard key={h.id} habit={h} today={today} onEdit={() => setEditor({ habit: h })} onHistory={() => setHistoryFor(h)} />
          ))}
        </div>
      ) : (
        <EmptyState icon={<Repeat size={22} />} title="No habits yet" action={<Button variant="primary" onClick={() => setEditor({ habit: null })}>Create a habit</Button>}>
          Pick something small you want to do on a regular schedule — every day, or only on chosen weekdays.
        </EmptyState>
      )}

      <details className="mt-8 rounded-2xl border border-line px-5 py-4 text-sm">
        <summary className="cursor-pointer font-medium text-ink-2 select-none">How streaks and rates are counted</summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[13px] text-ink-3">
          <li>A day is a calendar date in your time zone ({data.settings.timeZone.replace(/_/g, " ")}), set in Settings.</li>
          <li>A habit is due on scheduled weekdays from its start date, except while paused.</li>
          <li>Current streak: consecutive due days completed, counting back from today. Unscheduled and paused days are skipped — they never break a streak. Today doesn&apos;t break it until the day is over.</li>
          <li>Completions on unscheduled days are kept and shown as lighter cells, but don&apos;t count toward streaks or rates.</li>
          <li>30-day rate: completed due days ÷ due days in the last 30 days (today counts only once it&apos;s done).</li>
        </ul>
      </details>

      {archived.length ? (
        <section className="mt-8" aria-labelledby="archived-title">
          <h2 id="archived-title" className="mb-3 text-[13px] font-medium text-ink-2">
            Archived
          </h2>
          <ul className="flex flex-col gap-1.5">
            {archived.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-2.5">
                <span className="text-sm text-ink-2">{h.title}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => archiveHabit(h.id, false)}>
                    <ArchiveRestore size={14} aria-hidden /> Restore
                  </Button>
                  <ConfirmDelete onConfirm={() => deleteHabit(h.id)} label={h.title} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <HabitEditor state={editor} today={today} onClose={() => setEditor(null)} />
      <HabitHistory habit={historyFor ? (data.habits.find((h) => h.id === historyFor.id) ?? null) : null} today={today} onClose={() => setHistoryFor(null)} />
    </div>
  );
}

function ConfirmDelete({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  const [armed, setArmed] = useState(false);
  return (
    <Button size="sm" variant={armed ? "danger" : "ghost"} onClick={() => (armed ? onConfirm() : setArmed(true))} onBlur={() => setArmed(false)} aria-label={armed ? `Confirm deleting ${label} and its history` : `Delete ${label}`}>
      {armed ? "Delete forever" : "Delete"}
    </Button>
  );
}

function HabitCard({ habit, today, onEdit, onHistory }: { habit: Habit; today: ISODate; onEdit: () => void; onHistory: () => void }) {
  const data = useData();
  const done = useMemo(() => doneDates(data.habitEntries, habit.id), [data.habitEntries, habit.id]);
  const streak = currentStreak(habit, done, today);
  const best = longestStreak(habit, done, today);
  const rate = completionRate(habit, done, addDays(today, -29), today, today);
  const paused = isPausedOn(habit, today);
  const due = isHabitDue(habit, today);
  const checked = done.has(today);
  const color = COLOR_VAR[habit.color] ?? COLOR_VAR.sage!;
  const strip = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  // Completing a due day connects the check to the history: the rate ring bumps once.
  const ringScope = useBump<HTMLDivElement>(rate.completed);

  return (
    <Card lift as="article" className="flex flex-col gap-4" aria-label={habit.title}>
      <div className="flex items-start gap-3">
        <CheckButton tone={HABIT_TONE[habit.color] ?? "sage"} size={26} checked={checked} onToggle={() => setHabitDone(habit.id, today, !checked, today)} label={`${habit.title}: ${checked ? "undo today's completion" : due ? "mark done today" : "log today anyway (not scheduled)"}`} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-medium">{habit.title}</h3>
          <p className="text-xs text-ink-3">
            {scheduleLabel(habit.schedule)}
            {!due && !paused ? " · not due today" : ""}
          </p>
        </div>
        {paused ? <Badge tone="violet">Paused</Badge> : null}
      </div>

      <div className="flex items-center gap-4">
        <div ref={ringScope}>
          <ProgressRing value={rate.ratio} color={color} size={54} label={`30-day completion rate ${pct(rate.ratio)}`}>
            <span className="text-[11px] font-medium tabular">
              <AnimatedNumber value={pct(rate.ratio)} />
            </span>
          </ProgressRing>
        </div>
        <dl className="grid flex-1 grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-ink-3">Current streak</dt>
            <dd className="text-lg font-semibold tabular">
              <AnimatedNumber value={streak} />
            </dd>
          </div>
          <div>
            <dt className="text-ink-3">Best</dt>
            <dd className="text-lg font-semibold text-ink-2 tabular">{best}</dd>
          </div>
        </dl>
      </div>

      <div>
        <div className="flex justify-between gap-[3px]" role="list" aria-label="Last 14 days">
          {strip.map((d) => {
            const s = dayState(habit, done, d, today);
            return (
              <span key={d} role="listitem" title={`${formatDateShort(d)}: ${STATE_LABEL[s]}`} aria-label={`${formatDateShort(d)}: ${STATE_LABEL[s]}`}>
                <DayCell state={s} color={color} />
              </span>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] text-ink-3">{rate.due ? `${rate.completed} of ${rate.due} due days in the last 30` : "No due days in the last 30"}</p>
      </div>

      <div className="-mx-1 mt-auto flex flex-wrap gap-1 border-t border-line pt-3">
        <Button size="sm" variant="ghost" onClick={onHistory}>
          <CalendarDays size={14} aria-hidden /> History
        </Button>
        <Button size="sm" variant="ghost" onClick={() => (paused ? resumeHabitNow(habit.id, today) : pauseHabitNow(habit.id, today))}>
          {paused ? <Play size={14} aria-hidden /> : <Pause size={14} aria-hidden />} {paused ? "Resume" : "Pause"}
        </Button>
        <span className="ml-auto flex gap-1">
          <IconButton label={`Edit ${habit.title}`} onClick={onEdit}>
            <PencilLine size={15} />
          </IconButton>
          <IconButton
            label={`Archive ${habit.title}`}
            onClick={() => {
              archiveHabit(habit.id, true);
              toast(`Archived “${habit.title}”`, { action: { label: "Undo", run: () => archiveHabit(habit.id, false) } });
            }}
          >
            <Archive size={15} />
          </IconButton>
        </span>
      </div>
    </Card>
  );
}

function HabitHistory({ habit, today, onClose }: { habit: Habit | null; today: ISODate; onClose: () => void }) {
  const data = useData();
  if (!habit) return null;
  const done = doneDates(data.habitEntries, habit.id);
  const color = COLOR_VAR[habit.color] ?? COLOR_VAR.sage!;
  const weeks = 12;
  const first = startOfWeek(addDays(today, -(weeks - 1) * 7), data.settings.weekStartsOn);
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(first, i));
  const rate90 = completionRate(habit, done, addDays(today, -89), today, today);

  return (
    <Dialog open onClose={onClose} wide title={habit.title} description={`${scheduleLabel(habit.schedule)} · since ${formatDateLong(habit.startDate)}`}>
      <p className="mb-3 text-[13px] text-ink-3">Select a past day to record or remove a completion. Future days can&apos;t be logged.</p>
      <div className="overflow-x-auto pb-2">
        <div className="inline-grid grid-flow-col gap-1" style={{ gridTemplateRows: "repeat(7, auto)" }}>
          {days.map((d) => {
            const s = dayState(habit, done, d, today);
            const future = d > today;
            return (
              <button
                key={d}
                type="button"
                disabled={future}
                onClick={() => setHabitDone(habit.id, d, !done.has(d), today)}
                aria-pressed={done.has(d)}
                aria-label={`${formatWeekday(d)} ${formatDateShort(d)}: ${STATE_LABEL[s]}`}
                title={`${formatDateShort(d)}: ${STATE_LABEL[s]}`}
                className="rounded-md disabled:cursor-default"
              >
                <DayCell state={s} color={color} size="md" />
              </button>
            );
          })}
        </div>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-ink-3">
        {(["done", "extra", "missed", "open", "not_due", "paused"] as DayState[]).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <DayCell state={s} color={color} /> {STATE_LABEL[s].split(" (")[0]}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-ink-2">
        90-day rate: <strong className="font-semibold text-ink">{pct(rate90.ratio)}</strong> ({rate90.completed} of {rate90.due} due days)
      </p>
    </Dialog>
  );
}

function HabitEditor({ state, today, onClose }: { state: { habit: Habit | null } | null; today: ISODate; onClose: () => void }) {
  if (!state) return null;
  return <HabitEditorInner key={state.habit?.id ?? "new"} habit={state.habit} today={today} onClose={onClose} />;
}

function HabitEditorInner({ habit, today, onClose }: { habit: Habit | null; today: ISODate; onClose: () => void }) {
  const [title, setTitle] = useState(habit?.title ?? "");
  const [description, setDescription] = useState(habit?.description ?? "");
  const [type, setType] = useState<HabitSchedule["type"]>(habit?.schedule.type ?? "daily");
  const [days, setDays] = useState<number[]>(habit?.schedule.type === "weekdays" ? habit.schedule.days : [1, 2, 3, 4, 5]);
  const [startDate, setStartDate] = useState(habit?.startDate ?? today);
  const [color, setColor] = useState(habit?.color ?? "sage");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const r = saveHabit(habit?.id ?? null, { title, description, schedule: type === "daily" ? { type } : { type, days }, startDate, color });
    if (!r.ok) return setErrors(r.errors);
    toast(habit ? "Habit saved" : "Habit created");
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={habit ? "Edit habit" : "New habit"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="habit-form">
            Save
          </Button>
        </>
      }
    >
      <form id="habit-form" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Habit" error={errors.title}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.title} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Walk 20 minutes" maxLength={200} />}
        </Field>
        <Field label="Why (optional)">{(id) => <Textarea id={id} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Schedule</legend>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="radio" name="sched" checked={type === "daily"} onChange={() => setType("daily")} className="accent-[var(--color-sage)]" /> Every day
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="radio" name="sched" checked={type === "weekdays"} onChange={() => setType("weekdays")} className="accent-[var(--color-sage)]" /> Specific days
            </label>
          </div>
          {type === "weekdays" ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Days of the week">
              {DAY_NAMES.map((n, i) => {
                const on = days.includes(i);
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setDays((ds) => (on ? ds.filter((x) => x !== i) : [...ds, i]))}
                    className={cx("h-8 w-11 rounded-lg border text-xs font-medium transition-colors", on ? "border-sage/50 bg-sage/15 text-sage" : "border-line-strong text-ink-3 hover:text-ink")}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          ) : null}
          {errors.schedule ? <p className="mt-1.5 text-xs text-rose">{errors.schedule}</p> : null}
        </fieldset>
        <Field label="Start date" hint="Days before this never count as missed." error={errors.startDate}>
          {(id, d) => <Input id={id} type="date" aria-describedby={d} value={startDate} onChange={(e) => setStartDate(e.target.value)} />}
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Color</legend>
          <div className="flex gap-2">
            {HABIT_COLORS.map((c) => (
              <button key={c} type="button" aria-pressed={color === c} aria-label={COLOR_NAME[c]} onClick={() => setColor(c)} className={cx("size-7 rounded-full border-2 transition-transform", color === c ? "scale-110 border-ink" : "border-transparent")} style={{ background: COLOR_VAR[c] }} />
            ))}
          </div>
        </fieldset>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
