"use client";

import Counter from "@/components/bits/Counter";
import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CalendarPlus, ClipboardCheck, Eye, Repeat, Target, Timer } from "lucide-react";
import {
  blocksOnDate,
  completedOn,
  currentStreak,
  dateInTz,
  doneDates,
  isDueToday,
  isHabitDue,
  rolloverCandidates,
  sortTasks,
  toMs,
  type Task,
} from "@lifeos/domain";
import { setHabitDone } from "@/lib/actions";
import { fxTrail } from "@/lib/fx";
import { formatDateLong, formatDuration, formatTime } from "@/lib/format";
import { useToday } from "@/lib/hooks";
import { loadSampleData } from "@/lib/seed";
import { isFirstArrival, reveal, revealGroup, t as motionT, useBump, useHeldCompletions, useMarkArrived } from "@/lib/motion";
import { useData } from "@/lib/store";
import { BLOCK_STYLE } from "../block-style";
import { DaylineBar } from "../dayline";
import { DailyReviewDialog, RolloverPanel } from "../review";
import { TaskEditor, TaskList } from "../tasks";
import { AnimatedNumber, Button, Card, CheckButton, EmptyState, ProgressRing, SectionTitle, cx } from "../ui";
import { HABIT_TONE, scheduleLabel } from "./habits";

export function TodayView() {
  const data = useData();
  const { today, now, tz } = useToday();
  const [editing, setEditing] = useState<Task | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const openEditor = (t: Task | null) => {
    setEditing(t);
    setEditorOpen(true);
  };

  const held = useHeldCompletions();
  const [arrival] = useState(isFirstArrival);
  useMarkArrived();

  const view = useMemo(() => {
    // Truth: counts, progress and next action use saved state only.
    const relevant = data.tasks.filter((t) => isDueToday(t, today));
    const doneToday = data.tasks.filter((t) => completedOn(t, today, tz));
    const topOpen = sortTasks(relevant);
    // Presentation: a just-completed task keeps its slot (drawn checked) during the hold.
    const byId = new Map(data.tasks.map((t) => [t.id, t]));
    const listed = sortTasks(
      data.tasks.map((t) => (held.has(t.id) && t.status === "done" ? { ...t, status: "todo" as const, completedAt: null } : t)).filter((t) => isDueToday(t, today)),
    ).map((t) => byId.get(t.id)!);
    const priorities = listed.filter((t) => t.priority === "high").slice(0, 3);
    const rest = listed.filter((t) => !priorities.includes(t));
    const doneList = doneToday.filter((t) => !held.has(t.id));
    const blocks = blocksOnDate(data.timeBlocks, today, tz);
    const habits = data.habits.filter((h) => !h.archivedAt && isHabitDue(h, today));
    const habitsDone = habits.filter((h) => data.habitEntries.some((e) => e.habitId === h.id && e.date === today));
    const focusMs = data.focusSessions.filter((s) => dateInTz(s.startedAt, tz) === today).reduce((n, s) => n + s.activeMs, 0);
    const rollover = rolloverCandidates(data.tasks, today);
    return { relevant, doneToday, doneList, topOpen, priorities, rest, blocks, habits, habitsDone, focusMs, rollover };
  }, [data, today, tz, held]);

  const isEmpty = !data.tasks.length && !data.habits.length && !data.timeBlocks.length && !data.goals.length;
  if (isEmpty) return <FirstRun />;

  const taskTotal = view.relevant.length + view.doneToday.length;
  const taskRatio = taskTotal ? view.doneToday.length / taskTotal : null;
  const habitRatio = view.habits.length ? view.habitsDone.length / view.habits.length : null;
  const current = view.blocks.find((b) => toMs(b.start) <= now && toMs(b.end) > now);
  const upcoming = view.blocks.find((b) => toMs(b.start) > now);
  const topTask = view.topOpen.find((t) => t.priority === "high") ?? view.topOpen[0];
  const showRollover = view.rollover.length > 0 && data.settings.rolloverDismissedOn !== today;

  const next = data.activeRun
    ? { title: "Focus session in progress", detail: data.activeRun.presetName, href: "/focus", cta: "Open timer" }
    : current
      ? { title: current.title, detail: `Now · until ${formatTime(current.end, tz)}`, href: current.taskId ? `/focus?task=${current.taskId}` : "/focus", cta: "Start focus" }
      : topTask
        ? { title: topTask.title, detail: upcoming ? `Then “${upcoming.title}” at ${formatTime(upcoming.start, tz)}` : "Your top open task", href: `/focus?task=${topTask.id}`, cta: "Focus on this" }
        : upcoming
          ? { title: upcoming.title, detail: `Starts at ${formatTime(upcoming.start, tz)}`, href: "/plan", cta: "View plan" }
          : { title: "Nothing scheduled", detail: "Plan a block or capture a task to get going.", href: "/plan", cta: "Open planner" };

  return (
    <motion.div className="flex flex-col gap-6" variants={revealGroup(0.08)} initial={arrival ? "hidden" : false} animate="show">
      <motion.header variants={reveal} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-ink-3">
              {/* The page names its context instead of greeting (unslop): "Today", or "Sam's day" with a display name. */}
              {data.settings.displayName ? `${data.settings.displayName}'s day` : "Today"}
            </p>
            <h1 className="mt-0.5 font-[family-name:var(--font-display)] text-[32px] leading-tight font-black tracking-[-0.03em] sm:text-[40px]">{formatDateLong(today)}</h1>
          </div>
          <Button onClick={() => setReviewOpen(true)}>
            <ClipboardCheck size={15} aria-hidden /> {data.reviews.some((r) => r.date === today) ? "Edit today's review" : "Review the day"}
          </Button>
        </div>
        <DaylineBar blocks={view.blocks} date={today} now={now} tz={tz} arrival={arrival} />
      </motion.header>

      <motion.div variants={reveal} className="grid gap-4 md:grid-cols-[1.25fr_1fr]">
        <Card lift className="flex flex-col justify-between gap-5" aria-labelledby="progress-title">
          <h2 id="progress-title" className="sr-only">
            Daily progress
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <Stat fxTarget="tasks" gradient={["#6fd0a2", "#ff8a4c"]} ring={taskRatio} label="Tasks" value={`${view.doneToday.length}/${taskTotal}`} count={[view.doneToday.length, taskTotal]} hint="done today" bumpOn={view.doneToday.length} />
            <Stat fxTarget="habits" gradient={["#ff8fa3", "#ffb38a"]} ring={habitRatio} label="Habits" value={`${view.habitsDone.length}/${view.habits.length}`} count={[view.habitsDone.length, view.habits.length]} hint="due today" bumpOn={view.habitsDone.length} />
            <Stat fxTarget="focus" gradient={["#ff9a62", "#f2b75a"]} ring={null} label="Focus" value={view.focusMs ? formatDuration(view.focusMs) : "0 min"} hint="saved sessions" bumpOn={view.focusMs} />
          </div>
        </Card>

        <Card lift className="relative overflow-hidden" aria-labelledby="next-title">
          <div aria-hidden className="ambient-breathe pointer-events-none absolute -top-20 -right-16 size-56 rounded-full bg-[radial-gradient(circle,#ffd3de,transparent_65%)]" />
          <h2 id="next-title" className="text-[13px] font-medium text-ink-2">
            Next action
          </h2>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={next.title + next.cta} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={motionT.ui}>
              <NextAction {...next} />
            </motion.div>
          </AnimatePresence>
        </Card>
      </motion.div>

      <AnimatePresence initial={false}>
        {showRollover ? (
          // Collapses its own height and the flex gap, so nothing below jumps.
          <motion.div
            key="rollover"
            className="overflow-hidden"
            initial={{ opacity: 0, height: 0, marginTop: -24 }}
            animate={{ opacity: 1, height: "auto", marginTop: 0 }}
            exit={{ opacity: 0, height: 0, marginTop: -24 }}
            transition={motionT.panel}
          >
            <RolloverPanel key={view.rollover.map((t) => t.id).join()} tasks={view.rollover} today={today} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div variants={reveal} className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card lift aria-labelledby="prio-title">
            <SectionTitle id="prio-title" hint="High-priority work due or planned today.">
              Priorities
            </SectionTitle>
            <TaskList
              tasks={view.priorities}
              today={today}
              onEdit={openEditor}
              held={held}
              empty={<p className="text-sm text-ink-3">No high-priority tasks today. Mark one as High to pin it here.</p>}
            />
          </Card>
          <Card lift aria-labelledby="tasks-title">
            <SectionTitle
              id="tasks-title"
              hint="Due today or earlier, or planned for today."
              action={
                <Button size="sm" variant="ghost" onClick={() => openEditor(null)}>
                  + Task
                </Button>
              }
            >
              Due &amp; planned
            </SectionTitle>
            <TaskList
              tasks={view.rest}
              today={today}
              onEdit={openEditor}
              held={held}
              empty={<EmptyState title={view.priorities.length ? "That's everything for today" : "Nothing due today"}>Capture a task with N, or pull one forward from the Plan view.</EmptyState>}
            />
            {view.doneList.length ? (
              <details className="mt-3 border-t border-line pt-3">
                <summary className="cursor-pointer text-[13px] text-ink-3 select-none hover:text-ink">
                  Completed today (<AnimatedNumber value={view.doneList.length} />)
                </summary>
                <div className="mt-2">
                  <TaskList tasks={view.doneList} today={today} onEdit={openEditor} compact />
                </div>
              </details>
            ) : null}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card lift aria-labelledby="sched-title">
            <SectionTitle
              id="sched-title"
              action={
                <Link href="/plan" className="text-[13px] text-ink-3 hover:text-ink">
                  Open planner →
                </Link>
              }
            >
              Schedule
            </SectionTitle>
            {view.blocks.length ? (
              <ol className="relative flex flex-col gap-1.5">
                {view.blocks.map((b) => {
                  const past = toMs(b.end) <= now;
                  const live = toMs(b.start) <= now && !past;
                  return (
                    <li key={b.id} className={cx("flex items-stretch gap-3 rounded-xl px-2 py-1.5 transition-colors duration-500", live && "bg-ink/[0.04]")}>
                      <span className="w-[68px] shrink-0 pt-0.5 text-right text-xs text-ink-3 tabular">{formatTime(b.start, tz)}</span>
                      <span aria-hidden className={cx("relative w-1 shrink-0 rounded-full transition-opacity duration-500", BLOCK_STYLE[b.kind].bar, past && "opacity-40")}>
                        {live ? <span className="dayline-head absolute top-1/2 left-1/2 size-2 -translate-1/2 rounded-full" /> : null}
                      </span>
                      <span className={cx("min-w-0 flex-1", past && "text-ink-3")}>
                        <span className="block truncate text-sm">{b.title}</span>
                        <span className="text-xs text-ink-3">
                          until {formatTime(b.end, tz)}
                          {live ? " · now" : ""}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <EmptyState icon={<CalendarPlus size={20} />} title="No time blocks today" action={<Link href="/plan" className="text-sm text-sage hover:underline">Plan your day</Link>} />
            )}
          </Card>

          <Card lift aria-labelledby="habits-title">
            <SectionTitle
              id="habits-title"
              action={
                <Link href="/habits" className="text-[13px] text-ink-3 hover:text-ink">
                  All habits →
                </Link>
              }
            >
              Habits due today
            </SectionTitle>
            {view.habits.length ? (
              <ul className="flex flex-col gap-1">
                {view.habits.map((h) => {
                  const done = doneDates(data.habitEntries, h.id);
                  const checked = done.has(today);
                  return (
                    <li key={h.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-ink/[0.03]">
                      <CheckButton tone={HABIT_TONE[h.color] ?? "sage"} checked={checked} onToggle={(e) => {
                          setHabitDone(h.id, today, !checked, today);
                          if (!checked) fxTrail(e.currentTarget, '[data-fx-target="habits"]', ["#ff8fa3", "#ffb38a", "#ff9a62"]);
                        }}
                        label={`${h.title} done today`} size={22} />
                      <div className="min-w-0 flex-1">
                        <div className={cx("truncate text-sm", checked && "text-ink-3")}>{h.title}</div>
                        <div className="text-xs text-ink-3">{scheduleLabel(h.schedule)}</div>
                      </div>
                      <span className="text-xs text-ink-3 tabular" title="Current streak (due days)">
                        <AnimatedNumber value={currentStreak(h, done, today)} /> day streak
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon={<Repeat size={20} />} title={data.habits.length ? "No habits due today" : "No habits yet"}>
                {data.habits.length ? "Scheduled days and pauses are respected." : <Link href="/habits" className="text-sage hover:underline">Create your first habit</Link>}
              </EmptyState>
            )}
          </Card>
        </div>
      </motion.div>

      <TaskEditor open={editorOpen} task={editing} onClose={() => setEditorOpen(false)} defaults={{ plannedFor: today }} />
      <DailyReviewDialog open={reviewOpen} onClose={() => setReviewOpen(false)} date={today} tz={tz} />
    </motion.div>
  );
}

function Stat({
  ring,
  gradient,
  label,
  value,
  hint,
  bumpOn,
  fxTarget,
  count,
}: {
  ring: number | null;
  gradient: [string, string];
  label: string;
  value: string;
  hint: string;
  bumpOn: number;
  /** Completion trails fly to this ring. */
  fxTarget: string;
  /** [done, total]: rolls "done" like an odometer instead of sliding the whole label. */
  count?: [number, number];
}) {
  // The ring and its figure answer a real increase with one small bump.
  const scope = useBump<HTMLDivElement>(bumpOn);
  return (
    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
      <div ref={scope} data-fx-target={fxTarget} className="rounded-full">
        <ProgressRing value={ring} gradient={gradient} stroke={6} label={`${label}: ${value} ${hint}`} size={56}>
          <span className="text-[11px] font-medium text-ink-2 tabular">{ring === null ? "" : <Counter value={Math.round(ring * 100)} suffix="%" fontSize="1em" fontWeight={600} textColor="#4a443b" fade={0} />}</span>
        </ProgressRing>
      </div>
      <div>
        <div className="text-xs text-ink-3">{label}</div>
        <div className="text-lg leading-6 font-semibold tabular">
          {count ? <Counter value={count[0]} suffix={`/${count[1]}`} fontSize="1em" fontWeight={700} textColor="#1d1a16" fade={0} /> : <AnimatedNumber value={value} />}
        </div>
        <div className="text-[11px] text-ink-3">{hint}</div>
      </div>
    </div>
  );
}

function NextAction({ title, detail, href, cta }: { title: string; detail: string; href: string; cta: string }) {
  return (
    <div className="relative mt-3 flex h-full flex-col gap-4">
      <div>
        <p className="text-lg leading-snug font-medium text-ink">{title}</p>
        <p className="mt-1 text-[13px] text-ink-3">{detail}</p>
      </div>
      <Link href={href} className="inline-flex h-9 w-fit items-center gap-2 rounded-lg border-2 border-ink bg-sticky-yellow px-3.5 text-sm font-semibold text-ink shadow-[3px_3px_0_0_#1d1a16] transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-[5px_5px_0_0_#1d1a16] active:scale-[0.97]">
        <Timer size={15} aria-hidden /> {cta} <ArrowRight size={14} aria-hidden className="nudge-x" />
      </Link>
    </div>
  );
}

function FirstRun() {
  return (
    <div className="mx-auto max-w-2xl py-6 sm:py-12">
      <p className="text-sm text-sage">Today</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-[40px] leading-tight font-black tracking-[-0.03em]">
        Your daybook is <span className="ink-gradient">ready</span>
      </h1>
      <p className="mt-3 text-[15px] text-ink-2">
        Your Today screen fills in as you add tasks, time blocks and habits. You&apos;re in <strong className="font-medium text-ink">Local mode</strong>: everything stays in this browser, nothing is uploaded.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <FirstStep icon={<ClipboardCheck size={18} />} title="Capture a task" body="Press N anywhere." href="#" onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "n" }))} />
        <FirstStep icon={<Repeat size={18} />} title="Start a habit" body="Daily or on chosen days." href="/habits" />
        <FirstStep icon={<Target size={18} />} title="Set a goal" body="Progress comes from linked tasks." href="/goals" />
      </div>
      <div className="mt-8 rounded-2xl border border-line p-5">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Eye size={16} className="text-ink-3" aria-hidden /> Want to look around first?
        </p>
        <p className="mt-1 text-[13px] text-ink-3">Load a small, clearly labeled sample plan. You can remove all of it later from Settings → Data.</p>
        <Button className="mt-4" onClick={loadSampleData}>
          Load sample data
        </Button>
      </div>
    </div>
  );
}

function FirstStep({ icon, title, body, href, onClick }: { icon: React.ReactNode; title: string; body: string; href: string; onClick?: () => void }) {
  const inner = (
    <>
      <span className="text-sage">{icon}</span>
      <span className="mt-3 block text-sm font-medium">{title}</span>
      <span className="mt-0.5 block text-xs text-ink-3">{body}</span>
    </>
  );
  const cls = "lift block rounded-3xl border-2 border-ink bg-panel p-4 text-left";
  return onClick ? (
    <button type="button" className={cls} onClick={onClick}>
      {inner}
    </button>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}
