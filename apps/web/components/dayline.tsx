"use client";

/**
 * The Dayline: LifeOS's one visual idea for "now". A thin sage line with a bright
 * head. It appears as the day's progress on Today, as the current-time rule in
 * the planner, and as the head on the focus ring (ProgressRing `head`).
 * It moves only when the minute changes — it never pulses or loops.
 */
import { motion } from "motion/react";
import { dateInTz, minutesInTz, toMs, type ISODate, type TimeBlock } from "@lifeos/domain";
import { formatMinutes } from "@/lib/format";
import { useCalm } from "@/lib/motion";
import { BLOCK_STYLE } from "./block-style";
import { cx } from "./ui";

const DEFAULT_START = 7 * 60;
const DEFAULT_END = 22 * 60;

function minuteOf(instant: string, date: ISODate, tz: string, fallback: number): number {
  return dateInTz(instant, tz) === date ? minutesInTz(instant, tz) : fallback;
}

/** Today's progress through the planned day, with blocks as ticks. */
export function DaylineBar({ blocks, date, now, tz, arrival }: { blocks: TimeBlock[]; date: ISODate; now: number; tz: string; arrival: boolean }) {
  const calm = useCalm();
  const spans = blocks.map((b) => ({ b, s: minuteOf(b.start, date, tz, 0), e: minuteOf(b.end, date, tz, 1440) }));
  const start = Math.min(DEFAULT_START, ...spans.map((x) => Math.floor(x.s / 60) * 60));
  const end = Math.max(DEFAULT_END, ...spans.map((x) => Math.ceil(x.e / 60) * 60));
  const span = Math.max(60, end - start);
  const nowMin = minutesInTz(now, tz);
  const p = Math.min(1, Math.max(0, (nowMin - start) / span));
  const left = spans.filter((x) => toMs(x.b.end) > now).length;
  const grow = arrival && !calm;

  return (
    <div
      role="img"
      aria-label={`Day progress: ${Math.round(p * 100)}% of ${formatMinutes(start)}–${formatMinutes(end % 1440)} has passed. ${left} time block${left === 1 ? "" : "s"} left.`}
      className="relative overflow-x-clip px-2 pt-5 pb-1"
    >
      <div className="relative h-1.5 rounded-full bg-ink/[0.07]">
        {spans.map(({ b, s, e }) => (
          <span
            key={b.id}
            aria-hidden
            className={cx("absolute -top-[4px] h-[14px] rounded-[4px] opacity-80", BLOCK_STYLE[b.kind].bar, toMs(b.end) <= now && "opacity-25")}
            style={{ left: `${(Math.max(s, start) - start) / span * 100}%`, width: `max(3px, ${(Math.min(e, end) - Math.max(s, start)) / span * 100}%)` }}
          />
        ))}
        <motion.div
          aria-hidden
          className="dayline-fill absolute inset-y-0 left-0 w-full origin-left rounded-full"
          initial={grow ? { scaleX: 0 } : false}
          animate={{ scaleX: p }}
          transition={{ duration: grow ? 1.1 : 0.6, ease: [0.22, 1, 0.36, 1], delay: grow ? 0.25 : 0 }}
        />
        {p > 0 && p < 1 ? (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            initial={grow ? { x: "0%" } : false}
            animate={{ x: `${p * 100}%` }}
            transition={{ duration: grow ? 1.1 : 0.6, ease: [0.22, 1, 0.36, 1], delay: grow ? 0.25 : 0 }}
          >
            <span className="dayline-head absolute top-1/2 -left-[7px] size-[14px] -translate-y-1/2 rounded-full" />
            <span className="absolute -top-5 -left-6 w-12 text-center text-[10px] font-semibold text-violet tabular">{formatMinutes(nowMin)}</span>
          </motion.div>
        ) : null}
      </div>
      <div aria-hidden className="mt-1.5 flex justify-between text-[10px] text-ink-3 tabular">
        <span>{formatMinutes(start)}</span>
        <span>{formatMinutes(end % 1440)}</span>
      </div>
    </div>
  );
}

/** The planner's current-time rule. Moves with a transform once a minute. */
export function NowRule({ top }: { top: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center transition-transform duration-700 ease-[var(--ease-soft)]" style={{ transform: `translateY(${top}px)` }}>
      <span className="dayline-head ambient-breathe -ml-[6px] size-3 shrink-0 rounded-full" />
      <span className="dayline-rule h-[2px] flex-1" />
    </div>
  );
}
