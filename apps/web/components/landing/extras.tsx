"use client";

/**
 * Extra landing choreography: a rolling circular badge, letter-level playful
 * type, a scroll-scrubbed manifesto, a pinned horizontal "rolling" feature
 * track, an odometer of example numbers, a giant rolling wordmark, magnetic
 * buttons and a hand-drawn scribble. Decorative only; illustrations say
 * "example". Reduced motion renders every piece in its final, static state.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  motion,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from "motion/react";
import { CalendarDays, ChartColumn, Flower2, LayoutTemplate, Repeat, Target, Timer } from "lucide-react";
import { cx } from "../ui";

const EASE = [0.22, 1, 0.36, 1] as const;

// ---------- Rolling circular badge ----------

export function RollingBadge({ text = "plan · bloom · focus · repeat · ", className }: { text?: string; className?: string }) {
  const reduce = useReducedMotion() ?? false;
  const rot = useMotionValue(0);
  const box = useRef<HTMLDivElement>(null);
  const onScreen = useInView(box);
  const { scrollY } = useScroll();
  const vel = useVelocity(scrollY);
  useAnimationFrame((_, delta) => {
    if (reduce || !onScreen) return;
    // Base spin plus a kick from scroll speed (either direction).
    rot.set(rot.get() + (delta / 1000) * (18 + Math.min(Math.abs(vel.get()) * 0.08, 240)));
  });
  return (
    <div ref={box} aria-hidden className={cx("relative size-36 sm:size-40", className)}>
      <motion.svg viewBox="0 0 200 200" className="size-full" style={{ rotate: rot }}>
        <defs>
          <path id="badge-circle" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
        </defs>
        <circle cx="100" cy="100" r="98" fill="#ffc83d" stroke="#1d1a16" strokeWidth="3" />
        <text fontSize="19" fontWeight="700" letterSpacing="3" fill="#1d1a16" style={{ fontFamily: "var(--font-bricolage)", textTransform: "uppercase" }}>
          <textPath href="#badge-circle">{text.repeat(2)}</textPath>
        </text>
      </motion.svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="wobble grid size-14 place-items-center rounded-full border-[3px] border-ink bg-tomato text-canvas" style={{ ["--r" as string]: "-8deg" }}>
          <Flower2 size={24} strokeWidth={2.5} />
        </span>
      </div>
    </div>
  );
}

// ---------- Playful letters: hover hop + variable-weight wave ----------

const HOPS = [-14, 10, -8, 12, -10, 7, -12, 9];

/** Splits text into letters that hop and tilt on hover; `wave` adds a rolling weight wave. */
export function PlayLetters({ text, className, wave, delay = 0 }: { text: string; className?: string; wave?: boolean; delay?: number }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <span className={cx("inline-block", className)} aria-label={text} role="text">
      {Array.from(text).map((ch, i) => (
        <motion.span
          key={i}
          aria-hidden
          className={cx("inline-block origin-bottom", wave && !reduce && "wght-wave")}
          style={wave ? { animationDelay: `${delay + i * 0.12}s` } : undefined}
          whileHover={reduce ? undefined : { y: -16, rotate: HOPS[i % HOPS.length], scale: 1.12, transition: { type: "spring", stiffness: 500, damping: 9 } }}
        >
          {ch === " " ? " " : ch}
        </motion.span>
      ))}
    </span>
  );
}

// ---------- Scribble underline ----------

export function Scribble({ className, delay = 1.1, color = "#ff5a36" }: { className?: string; delay?: number; color?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 300 30" preserveAspectRatio="none" className={cx("pointer-events-none absolute -bottom-3 left-0 h-[0.32em] w-full overflow-visible", className)}>
      <motion.path
        d="M4 18 C 60 4, 110 28, 160 14 S 250 6, 296 16 M 30 24 C 90 14, 170 30, 270 20"
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, delay, ease: EASE }}
      />
    </svg>
  );
}

// ---------- Magnetic wrapper ----------

export function Magnetic({ children, strength = 0.35, className }: { children: ReactNode; strength?: number; className?: string }) {
  const reduce = useReducedMotion() ?? false;
  const x = useSpring(0, { stiffness: 220, damping: 14, mass: 0.4 });
  const y = useSpring(0, { stiffness: 220, damping: 14, mass: 0.4 });
  return (
    <motion.div
      className={cx("inline-block", className)}
      style={reduce ? undefined : { x, y }}
      onPointerMove={(e) => {
        if (reduce || e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

// ---------- Scroll-scrubbed manifesto ----------

const MANIFESTO: (string | { sticker: string; tone: string; icon: ReactNode })[] = [
  "Most",
  "planners",
  "ask",
  "you",
  "to",
  "be",
  "a",
  "machine.",
  "LifeOS",
  "is",
  "a",
  "daybook:",
  "a",
  "place",
  "to",
  { sticker: "plan", tone: "bg-sticky-yellow", icon: <CalendarDays size={18} /> },
  "your",
  "hours,",
  { sticker: "grow", tone: "bg-sticky-green", icon: <Repeat size={18} /> },
  "small",
  "habits,",
  "chase",
  { sticker: "goals", tone: "bg-sticky-pink", icon: <Target size={18} /> },
  "that",
  "matter",
  "and",
  { sticker: "focus", tone: "bg-sticky-blue", icon: <Timer size={18} /> },
  "when",
  "it",
  "counts.",
];

function ManifestoWord({ word, progress, range }: { word: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.14, 1]);
  const y = useTransform(progress, range, [8, 0]);
  return (
    <motion.span className="mr-[0.25em] inline-block" style={{ opacity, y }}>
      {word}
    </motion.span>
  );
}

function ManifestoSticker({ s, progress, range, i }: { s: { sticker: string; tone: string; icon: ReactNode }; progress: MotionValue<number>; range: [number, number]; i: number }) {
  const scale = useTransform(progress, range, [0, 1]);
  const rotate = useTransform(progress, range, [i % 2 ? 40 : -40, i % 2 ? 4 : -5]);
  return (
    <motion.span
      className={cx("mr-[0.25em] inline-flex -translate-y-[0.08em] items-center gap-1.5 rounded-full border-[3px] border-ink px-4 align-middle text-[0.72em] leading-[1.35] not-italic shadow-[3px_3px_0_0_#1d1a16]", s.tone)}
      style={{ scale, rotate }}
    >
      {s.icon}
      {s.sticker}
    </motion.span>
  );
}

export function Manifesto() {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 60%"] });
  const n = MANIFESTO.length;
  const plain = MANIFESTO.map((w) => (typeof w === "string" ? w : w.sticker)).join(" ");
  return (
    <section ref={ref} aria-label="Why LifeOS" className="mx-auto max-w-5xl px-5 py-28 sm:px-8 sm:py-40">
      <p className="sr-only">{plain}</p>
      <p aria-hidden className="font-[family-name:var(--font-display)] text-[34px] leading-[1.18] font-semibold tracking-[-0.025em] text-ink sm:text-[58px]">
        {MANIFESTO.map((w, i) => {
          const range: [number, number] = [i / n, Math.min(1, (i + 2.5) / n)];
          if (reduce) return typeof w === "string" ? <span key={i} className="mr-[0.25em]">{w}</span> : <span key={i} className={cx("mr-[0.25em] inline-flex items-center gap-1.5 rounded-full border-[3px] border-ink px-4 align-middle text-[0.72em]", w.tone)}>{w.icon}{w.sticker}</span>;
          return typeof w === "string" ? <ManifestoWord key={i} word={w} progress={scrollYProgress} range={range} /> : <ManifestoSticker key={i} s={w} progress={scrollYProgress} range={range} i={i} />;
        })}
      </p>
    </section>
  );
}

// ---------- Pinned horizontal rolling track ----------

const ROLL = [
  { n: "01", title: "Plan the day in time", body: "Drag tasks onto a time grid. Blocks snap, resize and settle.", tone: "bg-sticky-yellow", icon: <CalendarDays size={28} /> },
  { n: "02", title: "Habits that bloom", body: "Daily or weekday schedules with honest streaks and a history you can backfill.", tone: "bg-sticky-green", icon: <Repeat size={28} /> },
  { n: "03", title: "Goals with real progress", body: "Progress comes only from linked tasks — never a slider you drag.", tone: "bg-sticky-pink", icon: <Target size={28} /> },
  { n: "04", title: "Focus in a quieter room", body: "A timer that survives reloads, with optional site blocking.", tone: "bg-sticky-blue", icon: <Timer size={28} /> },
  { n: "05", title: "Insights from real records", body: "7 and 30-day trends with stated definitions.", tone: "bg-sticky-orange", icon: <ChartColumn size={28} /> },
  { n: "06", title: "Templates that become plans", body: "SMART, OKR, mandala, wheel of life and roadmaps in the Goal Studio.", tone: "bg-sticky-lime", icon: <LayoutTemplate size={28} /> },
];

function RollCard({ c, i, progress }: { c: (typeof ROLL)[number]; i: number; progress: MotionValue<number> }) {
  // Each card rolls (rotates) a little as the track slides past.
  const rotate = useTransform(progress, [0, 1], [i % 2 ? 9 : -9, i % 2 ? -7 : 7]);
  const y = useTransform(progress, [0, 0.5, 1], [i % 2 ? 40 : -30, 0, i % 2 ? -30 : 40]);
  return (
    <motion.article style={{ rotate, y }} className={cx("flex h-[56vh] max-h-[460px] min-h-[340px] w-[78vw] max-w-[420px] shrink-0 flex-col justify-between rounded-[2rem] border-[3px] border-ink p-7 shadow-[8px_8px_0_0_#1d1a16]", c.tone)}>
      <div className="flex items-start justify-between">
        <span className="font-[family-name:var(--font-display)] text-[84px] leading-none font-black italic tracking-[-0.06em] text-ink">{c.n}</span>
        <span className="grid size-14 place-items-center rounded-2xl border-[3px] border-ink bg-canvas text-ink">{c.icon}</span>
      </div>
      <div>
        <h3 className="font-[family-name:var(--font-display)] text-[30px] leading-[1.02] font-bold tracking-[-0.03em] text-ink">{c.title}</h3>
        <p className="mt-3 text-[16px] leading-snug font-medium text-ink/80">{c.body}</p>
      </div>
    </motion.article>
  );
}

export function RollingTrack() {
  const reduce = useReducedMotion() ?? false;
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const distance = useMotionValue(0);
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.4 });
  const x = useTransform([smooth, distance], (v: number[]) => -(v[0]! * v[1]!));
  const titleX = useTransform(smooth, [0, 1], ["0%", "-30%"]);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => distance.set(Math.max(0, el.scrollWidth - window.innerWidth + 48));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [distance]);

  if (reduce) {
    return (
      <section aria-labelledby="roll-title" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <h2 id="roll-title" className="mb-10 font-[family-name:var(--font-display)] text-[44px] font-black tracking-[-0.04em] text-ink">Everything, in one daybook</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {ROLL.map((c) => (
            <article key={c.n} className={cx("rounded-[2rem] border-[3px] border-ink p-7", c.tone)}>
              <p className="font-[family-name:var(--font-display)] text-[48px] font-black italic">{c.n}</p>
              <h3 className="font-[family-name:var(--font-display)] text-[26px] font-bold">{c.title}</h3>
              <p className="mt-2 text-[16px] text-ink/80">{c.body}</p>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section ref={section} aria-labelledby="roll-title" className="relative h-[420vh]">
      <div className="sticky top-0 flex h-dvh flex-col justify-center overflow-hidden">
        <motion.h2 id="roll-title" style={{ x: titleX }} className="pointer-events-none mb-6 pl-6 font-[family-name:var(--font-display)] text-[64px] leading-none font-black tracking-[-0.05em] whitespace-nowrap text-ink/90 sm:text-[120px]">
          Everything, in <span className="hot-text">one daybook</span> →
        </motion.h2>
        <motion.div ref={track} style={{ x }} className="flex w-max gap-8 py-10 pr-[10vw] pl-6 sm:pl-[8vw]">
          {ROLL.map((c, i) => (
            <RollCard key={c.n} c={c} i={i} progress={smooth} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ---------- Odometer of example numbers ----------

function Digit({ d, on, delay }: { d: number; on: boolean; delay: number }) {
  return (
    <span className="relative inline-block h-[1em] w-[0.62em] overflow-hidden align-bottom">
      <motion.span className="absolute inset-x-0 top-0 flex flex-col" initial={{ y: "0em" }} animate={on ? { y: `${-d - 10}em` } : undefined} transition={{ duration: 1.8, delay, ease: [0.16, 1, 0.3, 1] }}>
        {Array.from({ length: 20 }, (_, i) => (
          <span key={i} className="block h-[1em] text-center leading-none">
            {i % 10}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

function Odometer({ value, on, delay }: { value: number; on: boolean; delay: number }) {
  const reduce = useReducedMotion() ?? false;
  const digits = String(value).split("").map(Number);
  if (reduce) return <span>{value}</span>;
  return (
    <span aria-hidden>
      {digits.map((d, i) => (
        <Digit key={i} d={d} on={on} delay={delay + i * 0.12} />
      ))}
    </span>
  );
}

const STATS = [
  { v: 128, label: "tasks finished", tone: "bg-sticky-yellow" },
  { v: 42, label: "focus hours", tone: "bg-sticky-blue" },
  { v: 21, label: "day habit streak", tone: "bg-sticky-green" },
  { v: 6, label: "goals moving", tone: "bg-sticky-pink" },
];

export function OdometerStrip() {
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref, { once: true, amount: 0.5 });
  return (
    <section aria-labelledby="odo-title" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h2 id="odo-title" className="font-[family-name:var(--font-display)] text-[40px] leading-none font-black tracking-[-0.04em] text-ink sm:text-[60px]">
          A month, <span className="hot-text">rolled up</span>
        </h2>
        <span className="font-hand rotate-[-4deg] text-[26px] text-ink-2">← an example month, not real data</span>
      </div>
      <div ref={ref} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATS.map((s, i) => (
          <motion.div
            key={s.label}
            className={cx("rounded-[1.6rem] border-[3px] border-ink p-6 shadow-[6px_6px_0_0_#1d1a16]", s.tone)}
            initial={{ opacity: 0, y: 50, rotate: i % 2 ? 6 : -6 }}
            whileInView={{ opacity: 1, y: 0, rotate: i % 2 ? 1.5 : -1.5 }}
            whileHover={{ rotate: 0, y: -6, transition: { type: "spring", stiffness: 400, damping: 12 } }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ type: "spring", stiffness: 160, damping: 14, delay: i * 0.08 }}
          >
            <p className="font-[family-name:var(--font-display)] text-[64px] leading-none font-black tracking-[-0.05em] text-ink tabular sm:text-[80px]">
              <span className="sr-only">{s.v}</span>
              <Odometer value={s.v} on={on} delay={0.15 + i * 0.15} />
            </p>
            <p className="mt-2 text-[15px] font-semibold text-ink/80">{s.label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ---------- Giant rolling wordmark ----------

export function GiantWordmark() {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref, { once: true, amount: 0.4 });
  const [hover, setHover] = useState(-1);
  const letters = Array.from("LifeOS");
  const tones = ["#ff5a36", "#ffc83d", "#7fd8a4", "#ffb38a", "#ff8fa3", "#c4e06b"];
  return (
    <div ref={ref} aria-hidden className="relative overflow-hidden px-4 pt-10" style={{ perspective: 900 }}>
      <div className="flex justify-center font-[family-name:var(--font-display)] text-[26vw] leading-[0.8] font-black tracking-[-0.07em] select-none">
        {letters.map((ch, i) => (
          <motion.span
            key={i}
            className="inline-block origin-bottom"
            style={{ color: hover === i ? tones[i] : "#1d1a16", WebkitTextStroke: "3px #1d1a16", transition: "color 200ms" }}
            initial={reduce ? false : { y: "70%", rotateX: -90, opacity: 0 }}
            animate={on || reduce ? { y: "0%", rotateX: 0, opacity: 1 } : undefined}
            transition={{ type: "spring", stiffness: 140, damping: 13, delay: i * 0.08 }}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(-1)}
            whileHover={reduce ? undefined : { y: "-8%", rotate: i % 2 ? 6 : -6, transition: { type: "spring", stiffness: 500, damping: 10 } }}
          >
            {ch}
          </motion.span>
        ))}
      </div>
    </div>
  );
}
