"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { focusMinutesByDay, focusTotals, habitRates, plannedVsDone, tasksCompletedByDay, windowDates, type DayValue } from "@lifeos/domain";
import { formatDateShort, formatWeekday, pct } from "@/lib/format";
import { useToday } from "@/lib/hooks";
import { useData } from "@/lib/store";
import { AnimatedNumber, Card, EmptyState, PageHeader, ProgressBar, Segmented } from "../ui";

type Range = "7" | "30";

function Bars({ values, color, fill, unit, label }: { values: DayValue[]; color: string; fill: string; unit: string; label: string }) {
  const max = Math.max(1, ...values.map((v) => v.value));
  const narrow = values.length > 10;
  const n = values.length;
  // Trend line through the real daily values (same scale as the bars).
  const points = values.map((v, i) => `${((i + 0.5) / n) * 100},${100 - (v.value / max) * 100}`).join(" ");
  const barsDone = Math.min(n * 0.015, 0.3) + 0.5;
  return (
    <figure>
      <div className="relative flex h-40 items-end gap-[3px]" aria-hidden>
        {values.map((v, i) => (
          <div key={v.date} className="group relative flex h-full flex-1 flex-col justify-end">
            {/* Springs up from the baseline to its real height on load/range change; later data changes ease the height. */}
            <motion.div
              className="origin-bottom rounded-t-lg transition-[height] duration-500 ease-out"
              style={{ height: `${(v.value / max) * 100}%`, minHeight: v.value ? 4 : 2, background: v.value ? `linear-gradient(to top, ${fill}, ${color})` : "rgb(29 26 22 / 0.07)" }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ type: "spring", stiffness: 210, damping: 18, delay: Math.min(i * 0.015, 0.3) }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-lg border border-white bg-panel px-2 py-1 text-[11px] whitespace-nowrap shadow-[var(--shadow-soft)] group-hover:block">
              {formatDateShort(v.date)}: {v.value} {unit}
            </div>
          </div>
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          <motion.polyline
            points={points}
            fill="none"
            stroke="#0f6b5c"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.75 }}
            transition={{ duration: 0.9, delay: barsDone, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
      </div>
      <div className="mt-1.5 flex gap-[3px]" aria-hidden>
        {values.map((v, i) => (
          <div key={v.date} className="flex-1 text-center text-[10px] text-ink-3">
            {narrow ? (i % 5 === 0 ? formatDateShort(v.date).split(" ")[1] : "") : formatWeekday(v.date, "narrow")}
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {values.map((v) => (
            <tr key={v.date}>
              <th scope="row">{formatDateShort(v.date)}</th>
              <td>
                {v.value} {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function Definition({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 border-t border-line pt-2.5 text-[11px] leading-relaxed text-ink-3">{children}</p>;
}

export function InsightsView() {
  const data = useData();
  const { today, tz } = useToday();
  const [range, setRange] = useState<Range>("7");
  const dates = useMemo(() => windowDates(today, Number(range)), [today, range]);
  const windowLabel = `${formatDateShort(dates[0]!)} – ${formatDateShort(dates[dates.length - 1]!)}`;

  const focus = useMemo(() => focusMinutesByDay(data.focusSessions, dates, tz), [data.focusSessions, dates, tz]);
  const totals = useMemo(() => focusTotals(data.focusSessions, dates, tz), [data.focusSessions, dates, tz]);
  const completed = useMemo(() => tasksCompletedByDay(data.tasks, dates, tz), [data.tasks, dates, tz]);
  const pvd = useMemo(() => plannedVsDone(data.tasks, dates), [data.tasks, dates]);
  const habits = useMemo(() => habitRates(data.habits, data.habitEntries, dates, today), [data.habits, data.habitEntries, dates, today]);
  const completedTotal = completed.reduce((n, d) => n + d.value, 0);

  return (
    <div>
      <PageHeader
        title="Insights"
        subtitle={`${windowLabel} · calculated from your saved records in ${tz.replace(/_/g, " ")}`}
        actions={<Segmented<Range> label="Date range" value={range} onChange={setRange} options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }]} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Focus time", totals.activeMinutes ? `${Math.floor(totals.activeMinutes / 60)}h ${totals.activeMinutes % 60}m` : "0m"],
          ["Sessions", `${totals.sessions}`, totals.sessions ? `${totals.completed} completed` : undefined],
          ["Tasks completed", `${completedTotal}`],
          ["Planned → done", pvd.planned ? pct(pvd.done / pvd.planned) : "—", pvd.planned ? `${pvd.done} of ${pvd.planned}` : "nothing planned"],
        ].map(([label, value, hint]) => (
          <Card key={label} className="p-4">
            <div className="text-xs text-ink-3">{label}</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight tabular">
              <AnimatedNumber value={value!} />
            </div>
            {hint ? <div className="text-xs text-ink-3">{hint}</div> : null}
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card aria-labelledby="focus-chart">
          <h2 id="focus-chart" className="mb-4 text-[13px] font-medium tracking-wide text-ink-2 uppercase">
            Focus minutes per day
          </h2>
          {totals.sessions ? <Bars key={range} values={focus} color="#f2b75a" fill="#ffe9a6" unit="min" label="Focus minutes per day" /> : <EmptyState title="No focus sessions in this window">Sessions you complete, end or interrupt appear here.</EmptyState>}
          <Definition>Active focus time of saved sessions, by the day each session started. Paused time and breaks are excluded.{totals.averageMinutes !== null ? ` Average session: ${totals.averageMinutes} min.` : ""}</Definition>
        </Card>

        <Card aria-labelledby="tasks-chart">
          <h2 id="tasks-chart" className="mb-4 text-[13px] font-medium tracking-wide text-ink-2 uppercase">
            Tasks completed per day
          </h2>
          {completedTotal ? <Bars key={range} values={completed} color="#6fd0a2" fill="#c8f0dc" unit="tasks" label="Tasks completed per day" /> : <EmptyState title="No tasks completed in this window" />}
          <Definition>Tasks marked done on each day. A task reopened later no longer counts.</Definition>
        </Card>

        <Card aria-labelledby="habit-rates" className="lg:col-span-2">
          <h2 id="habit-rates" className="mb-4 text-[13px] font-medium tracking-wide text-ink-2 uppercase">
            Habit completion
          </h2>
          {habits.length ? (
            <ul className="grid gap-x-8 gap-y-4 md:grid-cols-2">
              {habits.map(({ habit, rate }) => (
                <li key={habit.id}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{habit.title}</span>
                    <span className="shrink-0 text-xs text-ink-3 tabular">{rate.due ? `${rate.completed}/${rate.due} due days · ${pct(rate.ratio)}` : "not due in this window"}</span>
                  </div>
                  <ProgressBar value={rate.ratio} label={`${habit.title} completion rate`} color="bg-sticky-pink" />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No active habits" />
          )}
          <Definition>Completed due days ÷ due days in the window. Unscheduled and paused days aren&apos;t due; today counts only once it&apos;s done.</Definition>
        </Card>
      </div>
    </div>
  );
}
