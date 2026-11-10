"use client";

/**
 * Scroll story below the hero. Each chapter uses a different choreography so
 * the page doesn't repeat one fade-up: a scroll-scrubbed schedule, a blooming
 * habit field, task→goal connectors, a clip-path "threshold" into Focus, drawn
 * charts and flipping privacy cards. Illustrations use an example day and say so.
 * Reduced motion: everything is shown in its final state.
 */
import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { CalendarDays, Download, EyeOff, Globe, HardDrive, Monitor, Repeat, Target, Timer, ChartColumn } from "lucide-react";
import { cx } from "../ui";
import { EnterLink } from "./enter-link";
import { ProximityLine } from "./bits-scenes";

const EASE = [0.22, 1, 0.36, 1] as const;

function Chapter({ id, eyebrow, icon, title, body, children, flip, tone }: { id: string; eyebrow: string; icon: ReactNode; title: ReactNode; body: ReactNode; children: ReactNode; flip?: boolean; tone: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mx-auto grid max-w-6xl scroll-mt-24 items-center gap-10 px-5 py-20 sm:px-8 md:grid-cols-2 md:py-28">
      <motion.div
        className={cx(flip && "md:order-2")}
        initial={{ opacity: 0, x: flip ? 40 : -40 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        <p className={cx("inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold", tone)}>
          {icon} {eyebrow}
        </p>
        <h2 id={`${id}-title`} className="mt-4 font-[family-name:var(--font-display)] text-[34px] leading-[1.08] font-black tracking-[-0.04em] text-ink sm:text-[44px]">
          {title}
        </h2>
        <div className="mt-4 max-w-md text-[16px] leading-relaxed text-ink-2">{body}</div>
      </motion.div>
      <div className={cx("relative", flip && "md:order-1")}>{children}</div>
    </section>
  );
}

const panel = "rounded-3xl border-2 border-ink bg-panel p-5 shadow-[8px_8px_0_0_#1d1a16]";

// ---------- 1. Plan: scroll-scrubbed schedule ----------

function ScrubSchedule() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const blocks = [
    { label: "Deep work · Website", start: 0, h: 2, cls: "bg-butter border-[#e8b45c] text-[#5a3800]" },
    { label: "Lunch walk", start: 2.5, h: 1, cls: "bg-mint border-[#86d6af] text-[#11573a]" },
    { label: "Weekly sync", start: 4, h: 0.75, cls: "bg-powder border-[#f2a65a] text-[#6b2e0a]" },
    { label: "Admin & email", start: 5.25, h: 1, cls: "bg-lavender border-[#e6b98a] text-[#5a3800]" },
  ];
  const line = useTransform(scrollYProgress, [0.2, 1], [0, 1]);
  return (
    <div ref={ref} className={panel}>
      <div className="mb-3 flex items-center justify-between text-[12px] font-semibold text-ink-3">
        <span>Thursday · example</span>
        <span>9 AM – 4 PM</span>
      </div>
      <div className="relative h-[300px]">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="absolute inset-x-0 flex items-center gap-2 text-[11px] text-ink-3" style={{ top: i * 40 }}>
            <span className="w-8 text-right tabular">{((8 + i) % 12) + 1}</span>
            <span className="h-px flex-1 bg-ink/[0.08]" />
          </div>
        ))}
        {blocks.map((b, i) => (
          <ScrubBlock key={b.label} index={i} progress={scrollYProgress} reduce={reduce} className={b.cls} top={b.start * 40 + 2} height={b.h * 40 - 4} label={b.label} />
        ))}
        <div className="absolute right-0 left-10 flex items-center" style={{ top: 3.4 * 40 }}>
          <span className="dayline-head size-3 rounded-full" />
          <motion.span className="dayline-rule h-[3px] flex-1 origin-left" style={{ scaleX: reduce ? 1 : line }} />
        </div>
      </div>
    </div>
  );
}

function ScrubBlock({ index, progress, reduce, className, top, height, label }: { index: number; progress: ReturnType<typeof useScroll>["scrollYProgress"]; reduce: boolean; className: string; top: number; height: number; label: string }) {
  const start = 0.1 + index * 0.15;
  const x = useTransform(progress, [start, start + 0.35], [index % 2 ? 120 : -120, 0]);
  const rotate = useTransform(progress, [start, start + 0.35], [index % 2 ? 6 : -6, 0]);
  const opacity = useTransform(progress, [start, start + 0.25], [0, 1]);
  return (
    <motion.div
      className={cx("absolute right-1 left-12 rounded-xl border px-3 py-1.5 text-[12px] font-semibold shadow-sm", className)}
      style={{ top, height, ...(reduce ? {} : { x, rotate, opacity }) }}
    >
      {label}
    </motion.div>
  );
}

// ---------- 2. Habits: a blooming field and a growing path ----------

const FIELD = Array.from({ length: 35 }, (_, i) => ![4, 11, 12, 23, 30].includes(i));

function HabitField() {
  return (
    <div className={panel}>
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[14px] font-semibold text-ink">Morning pages</p>
        <p className="text-[12px] text-ink-3">5 weeks · example</p>
      </div>
      <div className="relative">
        <motion.div className="grid grid-cols-7 gap-2" initial="off" whileInView="on" viewport={{ once: true, amount: 0.5 }}>
          {FIELD.map((done, i) => {
            const r = Math.floor(i / 7);
            const c = i % 7;
            const dist = Math.hypot(r - 2, c - 3);
            return (
              <motion.span
                key={i}
                className={cx("aspect-square rounded-lg", done ? "bg-linear-135 from-[#ff8fa3] to-[#ffb38a]" : "bg-ink/[0.06]")}
                variants={{
                  off: { scale: 0.2, opacity: 0, rotate: -20 },
                  on: { scale: 1, opacity: 1, rotate: 0, transition: { type: "spring", stiffness: 380, damping: 16, delay: dist * 0.08 } },
                }}
              />
            );
          })}
        </motion.div>
      </div>
      {/* The streak as a growing path: connected marks for the last 12 due days. */}
      <svg viewBox="0 0 480 40" className="mt-5 w-full overflow-visible" aria-hidden>
        <motion.line x1="12" y1="20" x2="468" y2="20" stroke="url(#streak-line)" strokeWidth="4" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.2, delay: 0.5, ease: EASE }} />
        <defs>
          <linearGradient id="streak-line" x1="0" x2="1">
            <stop offset="0" stopColor="#ff8fa3" />
            <stop offset="1" stopColor="#ffb38a" />
          </linearGradient>
        </defs>
        {Array.from({ length: 12 }, (_, i) => (
          <motion.circle
            key={i}
            cx={12 + i * 41.5}
            cy="20"
            r={i === 11 ? 9 : 6}
            fill={i === 11 ? "#fff" : "#ffb38a"}
            stroke={i === 11 ? "#ffb38a" : "none"}
            strokeWidth="3"
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 420, damping: 14, delay: 0.55 + i * 0.09 }}
          />
        ))}
      </svg>
      <div className="mt-4 flex gap-6 text-[13px]">
        <p>
          <span className="block text-2xl font-semibold text-violet">12</span> day streak
        </p>
        <p>
          <span className="block text-2xl font-semibold text-sage">86%</span> of due days
        </p>
      </div>
    </div>
  );
}

// ---------- 3. Goals: tasks flow into progress ----------

const CHIPS = ["Draft 4-week plan", "Buy running shoes", "First 10 km run", "Book a race"];

function GoalFlow() {
  return (
    <motion.div className={cx(panel, "relative")} initial="off" whileInView="on" viewport={{ once: true, amount: 0.45 }}>
      <div className="relative aspect-[2/1] w-full">
        <svg viewBox="0 0 600 300" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          {CHIPS.map((_, i) => {
            const y = 40 + i * 73;
            return (
              <motion.path
                key={i}
                d={`M232 ${y} C 330 ${y}, 360 150, 432 150`}
                fill="none"
                stroke={["#ff8fa3", "#ff9a62", "#ffb38a", "#ff8a4c"][i]}
                strokeWidth="3"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                variants={{ off: { pathLength: 0, opacity: 0 }, on: { pathLength: 1, opacity: 1, transition: { duration: 0.8, delay: 0.3 + i * 0.18, ease: EASE } } }}
              />
            );
          })}
        </svg>
        {CHIPS.map((t, i) => (
          <motion.div
            key={t}
            className="absolute left-0 flex w-[38%] -translate-y-1/2 items-center gap-2 rounded-xl border border-line bg-panel px-2.5 py-2 text-[12px] font-medium text-ink shadow-sm"
            style={{ top: `${((40 + i * 73) / 300) * 100}%` }}
            variants={{ off: { opacity: 0, x: -30 }, on: { opacity: 1, x: 0, transition: { delay: i * 0.1, duration: 0.5, ease: EASE } } }}
          >
            <motion.span
              className="grid size-4 shrink-0 place-items-center rounded-full border"
              variants={{
                off: { backgroundColor: "rgba(0,0,0,0)", borderColor: "rgb(29 26 22 / 0.3)" },
                on: i < 3 ? { backgroundColor: "#23805a", borderColor: "#23805a", transition: { delay: 0.9 + i * 0.25 } } : {},
              }}
            />
            <span className="truncate">{t}</span>
          </motion.div>
        ))}
        <div className="absolute top-1/2 right-[3%] grid size-[30%] -translate-y-1/2 place-items-center">
          <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden>
            <defs>
              <linearGradient id="goal-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#ff8fa3" />
                <stop offset="1" stopColor="#ff8a4c" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r="48" fill="#fffdf9" stroke="rgb(29 26 22 / 0.08)" strokeWidth="12" />
            <motion.circle cx="60" cy="60" r="48" fill="none" stroke="url(#goal-ring)" strokeWidth="12" strokeLinecap="round" variants={{ off: { pathLength: 0 }, on: { pathLength: 0.75, transition: { duration: 1.2, delay: 1.2, ease: EASE } } }} />
          </svg>
          <div className="relative text-center">
            <p className="text-xl font-semibold text-ink">3/4</p>
            <p className="text-[10px] text-ink-3">tasks</p>
          </div>
        </div>
      </div>
      <p className="mt-2 text-[12px] text-ink-3">Example goal. Your progress counts only tasks you link and finish.</p>
    </motion.div>
  );
}

// ---------- 4. Focus: crossing a threshold ----------

function FocusBand() {
  const reduce = useReducedMotion() ?? false;
  return (
    <section id="focus" aria-labelledby="focus-title" className="scroll-mt-24 px-3 py-10 sm:px-6">
      <motion.div
        className="relative mx-auto max-w-6xl overflow-hidden rounded-[36px] border-[3px] border-ink bg-sticky-yellow shadow-[10px_10px_0_0_#1d1a16] px-6 py-16 sm:px-12 md:py-24"
        initial={reduce ? false : { clipPath: "inset(12% 8% 12% 8% round 48px)", opacity: 0.6 }}
        whileInView={{ clipPath: "inset(0% 0% 0% 0% round 36px)", opacity: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 1, ease: EASE }}
      >
        <div aria-hidden className="ambient-breathe absolute -top-24 left-1/3 size-[420px] rounded-full bg-[radial-gradient(circle,#ff8fa3,transparent_65%)] opacity-50" />
        <div className="relative grid items-center gap-12 md:grid-cols-2">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-[12px] font-semibold text-violet">
              <Timer size={13} /> Focus
            </p>
            <h2 id="focus-title" className="mt-4 font-[family-name:var(--font-display)] text-[36px] leading-[1.06] font-black tracking-[-0.04em] text-ink sm:text-[48px]">
              Step into a quieter room
            </h2>
            <p className="mt-4 max-w-md text-[16px] leading-relaxed text-ink-2">
              Start a session and the planner recedes. The timer keeps exact time from saved timestamps, so a sleeping tab or a refresh never loses your place. One button always stops everything.
            </p>
            <ul className="mt-6 space-y-2.5 text-[14px] text-ink-2">
              <li className="flex gap-2.5">
                <Globe size={17} className="mt-0.5 shrink-0 text-violet" /> Optional browser extension for Chrome and Edge blocks only the sites you choose, only during focus.
              </li>
              <li className="flex gap-2.5">
                <Monitor size={17} className="mt-0.5 shrink-0 text-violet" /> A Windows companion that gently flags distracting apps is in development.
              </li>
            </ul>
          </div>
          <div className="relative mx-auto grid size-[280px] place-items-center sm:size-[340px]">
            <svg viewBox="0 0 200 200" className="absolute inset-0 -rotate-90" aria-hidden>
              <defs>
                <linearGradient id="band-ring" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#ffb38a" />
                  <stop offset="0.5" stopColor="#ff8fa3" />
                  <stop offset="1" stopColor="#ff8a4c" />
                </linearGradient>
              </defs>
              <circle cx="100" cy="100" r="86" fill="rgb(255 255 255 / 0.55)" stroke="rgb(29 26 22 / 0.08)" strokeWidth="10" />
              <motion.circle cx="100" cy="100" r="86" fill="none" stroke="url(#band-ring)" strokeWidth="10" strokeLinecap="round" initial={{ pathLength: reduce ? 0.62 : 0 }} whileInView={{ pathLength: 0.62 }} viewport={{ once: true }} transition={{ duration: 2, ease: EASE, delay: 0.4 }} />
            </svg>
            <div className="spin-slow absolute inset-[3%]" aria-hidden>
              <span className="dayline-head absolute top-0 left-1/2 size-3.5 -translate-x-1/2 rounded-full" />
            </div>
            <div className="relative text-center">
              <p className="text-[12px] font-semibold text-violet">Focus · example</p>
              <p className="font-mono text-5xl font-medium text-ink tabular">18:24</p>
              <p className="mt-1 text-[12px] text-ink-3">ends 10:42 AM</p>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

// ---------- 5. Insights: drawn charts ----------

const BARS = [32, 54, 41, 70, 48, 86, 64];

function InsightsChart() {
  const pts = BARS.map((v, i) => `${30 + i * 60},${170 - v * 1.6}`).join(" ");
  return (
    <motion.div className={panel} initial="off" whileInView="on" viewport={{ once: true, amount: 0.5 }}>
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[14px] font-semibold text-ink">Focus minutes · last 7 days</p>
        <p className="text-[12px] text-ink-3">Illustration</p>
      </div>
      <svg viewBox="0 0 420 190" className="w-full" aria-hidden>
        {BARS.map((v, i) => (
          <motion.rect
            key={i}
            x={12 + i * 60}
            width="36"
            rx="8"
            fill={["#ffd8c2", "#ffe9a6", "#c8f0dc", "#fde2c4", "#efe3cc", "#ffd3de", "#c8f0dc"][i]}
            style={{ transformOrigin: `${30 + i * 60}px 170px` }}
            y={170 - v * 1.6}
            height={v * 1.6}
            variants={{ off: { scaleY: 0 }, on: { scaleY: 1, transition: { type: "spring", stiffness: 200, damping: 18, delay: i * 0.07 } } }}
          />
        ))}
        <motion.polyline points={pts} fill="none" stroke="#0f6b5c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" variants={{ off: { pathLength: 0 }, on: { pathLength: 1, transition: { duration: 1.1, delay: 0.6, ease: EASE } } }} />
        {BARS.map((v, i) => (
          <motion.circle key={i} cx={30 + i * 60} cy={170 - v * 1.6} r="4.5" fill="#fff" stroke="#0f6b5c" strokeWidth="2.5" variants={{ off: { scale: 0 }, on: { scale: 1, transition: { delay: 0.7 + i * 0.12, type: "spring", stiffness: 400 } } }} />
        ))}
      </svg>
      <div className="mt-2 grid grid-cols-7 text-center text-[11px] text-ink-3">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
    </motion.div>
  );
}

// ---------- 6. Privacy: flipping cards ----------

function PrivacyCards() {
  const items = [
    { icon: <HardDrive size={20} />, title: "Stays on this device", body: "Local mode keeps everything in your browser. No account, no upload.", tone: "from-mint to-powder" },
    { icon: <EyeOff size={20} />, title: "No tracking", body: "No analytics, no third-party scripts, not even web fonts.", tone: "from-lavender to-blush" },
    { icon: <Download size={20} />, title: "Yours to take", body: "Export everything as JSON or delete it all, any time.", tone: "from-butter to-peach" },
  ];
  return (
    <section id="privacy" aria-labelledby="privacy-title" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 sm:px-8">
      <motion.h2
        id="privacy-title"
        className="text-center font-[family-name:var(--font-display)] text-[34px] leading-tight font-black tracking-[-0.04em] text-ink sm:text-[44px]"
        initial={{ opacity: 0, scale: 0.94 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        Private by default
      </motion.h2>
      <div className="mt-10 grid gap-5 [perspective:1200px] md:grid-cols-3">
        {items.map((it, i) => (
          <motion.article
            key={it.title}
            className={cx("lift rounded-3xl border-2 border-ink bg-linear-150 p-6", it.tone)}
            initial={{ opacity: 0, rotateY: -50, y: 30 }}
            whileInView={{ opacity: 1, rotateY: 0, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ type: "spring", stiffness: 110, damping: 16, delay: i * 0.12 }}
          >
            <span className="grid size-10 place-items-center rounded-2xl bg-white/80 text-ink">{it.icon}</span>
            <h3 className="mt-4 text-lg font-semibold text-ink">{it.title}</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{it.body}</p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

export function Story() {
  return (
    <div id="story">
      <Chapter
        id="plan"
        eyebrow="Plan"
        tone="bg-butter/70 text-amber"
        icon={<CalendarDays size={13} />}
        title={
          <>
            Give every task <span className="ink-gradient">a place in time</span>
          </>
        }
        body={<p>Drag work onto a day or week grid, nudge blocks with your keyboard, and watch the Dayline move through your schedule. Unfinished work never moves without asking you.</p>}
      >
        <ScrubSchedule />
      </Chapter>
      <Chapter
        id="habits"
        flip
        eyebrow="Habits"
        tone="bg-lavender/80 text-violet"
        icon={<Repeat size={13} />}
        title={
          <>
            Habits that <span className="ink-gradient">bloom</span>, not punish
          </>
        }
        body={<p>Daily or chosen weekdays. Pause when life happens: paused and unscheduled days never break a streak. Every day you show up leaves a mark.</p>}
      >
        <HabitField />
      </Chapter>
      <Chapter
        id="goals"
        eyebrow="Goals & projects"
        tone="bg-blush/80 text-rose"
        icon={<Target size={13} />}
        title={
          <>
            Progress you <span className="ink-gradient">actually earned</span>
          </>
        }
        body={<p>Link tasks to a project or goal and progress fills from finished work — never a number you type in.</p>}
      >
        <GoalFlow />
      </Chapter>
      <FocusBand />
      <Chapter
        id="insights"
        flip
        eyebrow="Insights"
        tone="bg-mint/80 text-sage"
        icon={<ChartColumn size={13} />}
        title={
          <>
            Honest trends, <span className="ink-gradient">drawn from your days</span>
          </>
        }
        body={<p>Focus minutes, finished tasks and habit rates over 7 or 30 days — every chart states its window and how it&apos;s calculated, and uses only your records.</p>}
      >
        <InsightsChart />
      </Chapter>
      <PrivacyCards />
      <section aria-labelledby="final-title" className="px-3 pb-16 sm:px-6">
        <motion.div
          className="relative mx-auto max-w-6xl overflow-hidden rounded-[36px] border-[3px] border-ink bg-tomato px-6 py-16 shadow-[10px_10px_0_0_#1d1a16] text-center sm:py-20"
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ type: "spring", stiffness: 90, damping: 18 }}
        >
          <div aria-hidden className="spin-slow absolute -top-40 -right-40 size-96 rounded-full border-[28px] border-sticky-yellow/60" />
          <h2 id="final-title" className="relative font-[family-name:var(--font-display)] text-[40px] leading-tight tracking-[-0.04em] text-ink sm:text-[64px]">
            <ProximityLine text="Your day is waiting" toColor="#fff7e0" />
          </h2>
          <div aria-hidden className="relative mx-auto mt-4 h-1.5 w-48 rounded-full bg-ink" />
          <p className="relative mx-auto mt-5 max-w-md text-[17px] font-semibold text-ink">Start with a blank page or explore a clearly labeled sample plan. You can remove the sample any time.</p>
          <div className="relative mt-8 flex justify-center">
            <EnterLink variant="ghost" />
          </div>
        </motion.div>
      </section>
    </div>
  );
}
