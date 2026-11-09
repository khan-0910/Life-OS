"use client";

/**
 * The "board" layer of the landing page: a dotted whiteboard with draggable
 * sticky notes and live connectors, a velocity-skewed template marquee, a
 * night band of goal templates with animated previews, a scroll progress
 * ribbon and a pointer glow. Everything is decorative and labeled "example";
 * reduced motion shows final states with no loops, drag tilt or glow.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from "motion/react";
import { ArrowRight, Grid3x3, MousePointer2, Route, Sparkles, Target, Waypoints } from "lucide-react";
import { cx } from "../ui";

const EASE = [0.22, 1, 0.36, 1] as const;

// ---------- Scroll progress + pointer glow ----------

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 160, damping: 30, restDelta: 0.001 });
  return <motion.div aria-hidden className="dayline-fill fixed inset-x-0 top-0 z-50 h-1 origin-left" style={{ scaleX }} />;
}

/** Sets --mx/--my for the .spotlight hover glow. */
function spot(e: ReactPointerEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
}

// ---------- Marquee ----------

const WORDS = ["SMART goals", "OKRs", "Mandala chart", "Wheel of life", "Roadmaps", "Habits", "Focus", "Time blocks"];

export function TemplateMarquee() {
  const reduce = useReducedMotion() ?? false;
  const { scrollY } = useScroll();
  const v = useSpring(useVelocity(scrollY), { stiffness: 120, damping: 40 });
  const skew = useTransform(v, [-2500, 0, 2500], [10, 0, -10], { clamp: true });
  const row = (reverse: boolean, outline: boolean) => (
    <div className="flex overflow-hidden">
      <motion.div className={cx("marquee-track flex shrink-0 gap-10 pr-10 whitespace-nowrap", reverse && "reverse")} style={reduce ? undefined : { skewX: skew }}>
        {[...WORDS, ...WORDS].map((w, i) => (
          <span key={i} className={cx("inline-flex items-center gap-10 font-[family-name:var(--font-display)] text-[48px] leading-none font-black tracking-[-0.04em] sm:text-[84px]", outline ? "text-outline text-ink" : "hot-text")}>
            {w}
            <Sparkles aria-hidden className={cx("size-8 sm:size-12", i % 2 ? "text-hot" : "text-electric")} strokeWidth={2.5} />
          </span>
        ))}
      </motion.div>
    </div>
  );
  return (
    <section aria-label="What LifeOS covers" className="relative -rotate-2 border-y-4 border-ink bg-sticky-yellow py-6 sm:py-8">
      <p className="sr-only">{WORDS.join(", ")}</p>
      <div aria-hidden className="flex flex-col gap-3">
        {row(false, false)}
        {row(true, true)}
      </div>
    </section>
  );
}

// ---------- Whiteboard with draggable stickies ----------

type Note = { id: string; text: string; fx: number; fy: number; w: number; color: string; r: number; big?: boolean };

const NOTES: Note[] = [
  { id: "goal", text: "Run a half marathon by June", fx: 0.5, fy: 0.46, w: 210, color: "bg-sticky-yellow", r: -2, big: true },
  { id: "a", text: "Run 3× a week", fx: 0.16, fy: 0.2, w: 150, color: "bg-sticky-pink", r: -6 },
  { id: "b", text: "Sign up for the race", fx: 0.84, fy: 0.18, w: 160, color: "bg-sticky-blue", r: 5 },
  { id: "c", text: "Stretch 10 min daily", fx: 0.13, fy: 0.78, w: 160, color: "bg-sticky-green", r: 4 },
  { id: "d", text: "Long run every Sunday", fx: 0.86, fy: 0.78, w: 165, color: "bg-sticky-orange", r: -5 },
  { id: "e", text: "Sleep by 11", fx: 0.5, fy: 0.9, w: 130, color: "bg-sticky-lime", r: 3 },
];

function useNoteMotion() {
  return { x: useMotionValue(0), y: useMotionValue(0) };
}

function Connector({ from, to, size, drawn, i }: { from: { n: Note; x: MotionValue<number>; y: MotionValue<number> }; to: { n: Note; x: MotionValue<number>; y: MotionValue<number> }; size: { w: MotionValue<number>; h: MotionValue<number> }; drawn: boolean; i: number }) {
  const d = useTransform([from.x, from.y, to.x, to.y, size.w, size.h], (v: number[]) => {
    const [ax, ay, bx, by, w, h] = v as [number, number, number, number, number, number];
    const x0 = from.n.fx * w + ax;
    const y0 = from.n.fy * h + ay;
    const x1 = to.n.fx * w + bx;
    const y1 = to.n.fy * h + by;
    const mx = (x0 + x1) / 2;
    return `M${x0} ${y0} C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}`;
  });
  return (
    <motion.path
      d={d}
      fill="none"
      stroke="#1d1a16"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeDasharray="1 0"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={drawn ? { pathLength: 1, opacity: 0.85 } : undefined}
      transition={{ duration: 0.9, delay: 0.6 + i * 0.12, ease: EASE }}
    />
  );
}

function GhostCursor({ label, color, path, delay }: { label: string; color: string; path: { x: string[]; y: string[] }; delay: number }) {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute top-0 left-0 z-20"
      initial={{ left: path.x[0], top: path.y[0], opacity: 0 }}
      animate={{ left: path.x, top: path.y, opacity: 1 }}
      transition={{ duration: 12, delay, repeat: Infinity, repeatType: "mirror", ease: "easeInOut", opacity: { duration: 0.4, delay } }}
    >
      <MousePointer2 size={22} fill={color} color="#12301f" strokeWidth={1.5} />
      <span className="ml-4 inline-block rounded-md px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-night" style={{ background: color }}>
        {label}
      </span>
    </motion.div>
  );
}

export function Whiteboard() {
  const reduce = useReducedMotion() ?? false;
  const section = useRef<HTMLElement>(null);
  const board = useRef<HTMLDivElement>(null);
  const inView = useInView(board, { once: true, amount: 0.35 });
  const w = useMotionValue(900);
  const h = useMotionValue(520);
  const m = [useNoteMotion(), useNoteMotion(), useNoteMotion(), useNoteMotion(), useNoteMotion(), useNoteMotion()];
  const notes = NOTES.map((n, i) => ({ n, ...m[i]! }));

  const { scrollYProgress } = useScroll({ target: section, offset: ["start end", "center center"] });
  const tilt = useTransform(scrollYProgress, [0, 1], [22, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.86, 1]);

  useEffect(() => {
    const el = board.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (!e) return;
      w.set(e.contentRect.width);
      h.set(e.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h]);

  return (
    <section ref={section} id="board" aria-labelledby="board-title" className="relative mx-auto max-w-6xl scroll-mt-24 px-5 pt-24 pb-16 sm:px-8">
      <motion.div className="mx-auto max-w-2xl text-center" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.6 }} transition={{ duration: 0.7, ease: EASE }}>
        <p className="inline-flex items-center gap-2 rounded-full bg-night px-3 py-1 text-[12px] font-bold tracking-wide text-sticky-yellow uppercase">
          <Waypoints size={14} aria-hidden /> Goal board
        </p>
        <h2 id="board-title" className="mt-4 font-[family-name:var(--font-display)] text-[40px] leading-[1.02] font-black tracking-[-0.04em] text-ink sm:text-[64px]">
          Think on a board.
          <br />
          <span className="hot-text">Act in a planner.</span>
        </h2>
        <p className="mt-4 text-[17px] text-ink-2">Break a big goal into sticky-note steps, then turn them into real tasks with one click in the Goal Studio. Go on — drag the notes.</p>
      </motion.div>

      <div style={{ perspective: 1400 }} className="mt-12">
        <motion.div style={reduce ? undefined : { rotateX: tilt, scale }} className="ring-glow rounded-[2rem] shadow-[0_50px_120px_-40px_rgb(15_107_92/0.55)]">
          <div ref={board} role="img" aria-label="Example goal board: a half-marathon goal linked to five sticky-note steps." className="dot-grid relative h-[560px] overflow-hidden rounded-[calc(2rem-2px)] bg-[#fffdf6] sm:h-[520px]">
            <span className="absolute top-4 left-5 z-10 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-ink-3 shadow-sm">Example board</span>
            <svg aria-hidden className="absolute inset-0 size-full overflow-visible">
              {notes.slice(1).map((to, i) => (
                <Connector key={to.n.id} from={notes[0]!} to={to} size={{ w, h }} drawn={inView || reduce} i={i} />
              ))}
            </svg>
            {notes.map(({ n, x, y }, i) => (
              <motion.div
                key={n.id}
                className="absolute"
                style={{ left: `${n.fx * 100}%`, top: `${n.fy * 100}%`, width: n.w, marginLeft: -n.w / 2, marginTop: n.big ? -70 : -48, zIndex: n.big ? 3 : 2 }}
                initial={reduce ? false : { opacity: 0, scale: 0.2, rotate: n.r * 8, y: -120 }}
                animate={inView || reduce ? { opacity: 1, scale: 1, rotate: n.r, y: 0 } : undefined}
                transition={{ type: "spring", stiffness: 220, damping: 14, delay: n.big ? 0.05 : 0.25 + i * 0.09 }}
              >
                <motion.div
                  drag={!reduce}
                  dragConstraints={board}
                  dragElastic={0.18}
                  dragMomentum
                  style={{ x, y }}
                  whileHover={reduce ? undefined : { scale: 1.05, rotate: -n.r }}
                  whileDrag={{ scale: 1.12, rotate: 0, zIndex: 30, cursor: "grabbing" }}
                  className={cx(
                    "sticky relative cursor-grab touch-none rounded-[4px] p-4 font-[family-name:var(--font-display)] leading-tight font-bold text-night select-none",
                    n.color,
                    n.big ? "min-h-[140px] text-[22px]" : "min-h-[96px] text-[16px]",
                  )}
                >
                  {n.big ? (
                    <span className="mb-2 flex items-center gap-1 text-[11px] font-black tracking-widest uppercase opacity-70">
                      <Target size={12} aria-hidden /> Goal
                    </span>
                  ) : null}
                  {n.text}
                </motion.div>
              </motion.div>
            ))}
            {!reduce ? (
              <>
                <GhostCursor label="You" color="#ff9ec7" delay={1.2} path={{ x: ["20%", "42%", "70%", "30%"], y: ["60%", "30%", "55%", "40%"] }} />
                <GhostCursor label="Future you" color="#ffb38a" delay={2} path={{ x: ["75%", "60%", "25%", "55%"], y: ["40%", "70%", "50%", "22%"] }} />
              </>
            ) : null}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ---------- Night band: template previews ----------

function MandalaPreview({ on }: { on: boolean }) {
  const colors = ["bg-sticky-pink", "bg-sticky-blue", "bg-sticky-green", "bg-sticky-orange", "bg-sticky-yellow", "bg-sticky-lime", "bg-sticky-blue", "bg-sticky-pink", "bg-sticky-green"];
  return (
    <div className="grid grid-cols-9 gap-[3px]" aria-hidden>
      {Array.from({ length: 81 }, (_, i) => {
        const r = Math.floor(i / 9);
        const c = i % 9;
        const block = Math.floor(r / 3) * 3 + Math.floor(c / 3);
        const dist = Math.hypot(r - 4, c - 4);
        const center = r === 4 && c === 4;
        return (
          <motion.span
            key={i}
            className={cx("aspect-square rounded-[3px]", center ? "bg-white" : colors[block], (r % 3 === 1 && c % 3 === 1) || center ? "opacity-100" : "opacity-60")}
            initial={{ scale: 0, opacity: 0 }}
            animate={on ? { scale: 1, opacity: 1 } : undefined}
            transition={{ type: "spring", stiffness: 300, damping: 16, delay: dist * 0.07 }}
          />
        );
      })}
    </div>
  );
}

const WHEEL_A = [7, 5, 8, 4, 6, 7, 3, 6];
const WHEEL_B = [8, 6, 7, 6, 7, 8, 6, 7];

function wheelPoints(vals: number[], r: number, c: number) {
  return vals
    .map((v, i) => {
      const a = (i / vals.length) * Math.PI * 2 - Math.PI / 2;
      return `${c + Math.cos(a) * (v / 10) * r},${c + Math.sin(a) * (v / 10) * r}`;
    })
    .join(" ");
}

function WheelPreview({ on }: { on: boolean }) {
  const reduce = useReducedMotion() ?? false;
  const [flip, setFlip] = useState(false);
  useEffect(() => {
    if (!on || reduce) return;
    const id = window.setInterval(() => document.visibilityState === "visible" && setFlip((f) => !f), 2600);
    return () => window.clearInterval(id);
  }, [on, reduce]);
  return (
    <svg viewBox="0 0 200 200" className="mx-auto w-full max-w-[220px]" aria-hidden>
      {[2, 4, 6, 8, 10].map((v) => (
        <circle key={v} cx="100" cy="100" r={v * 8.5} fill="none" stroke="rgb(255 255 255 / 0.12)" />
      ))}
      {WHEEL_A.map((_, i) => {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        return <line key={i} x1="100" y1="100" x2={100 + Math.cos(a) * 85} y2={100 + Math.sin(a) * 85} stroke="rgb(255 255 255 / 0.12)" />;
      })}
      <motion.polygon
        fill="rgb(255 158 199 / 0.45)"
        stroke="#ff9ec7"
        strokeWidth="2.5"
        strokeLinejoin="round"
        initial={{ points: wheelPoints(WHEEL_A.map(() => 0), 85, 100) }}
        animate={on ? { points: wheelPoints(flip ? WHEEL_B : WHEEL_A, 85, 100) } : undefined}
        transition={{ type: "spring", stiffness: 90, damping: 12 }}
      />
      {(flip ? WHEEL_B : WHEEL_A).map((v, i) => {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        return <motion.circle key={i} r="4.5" fill="#ffd84d" animate={on ? { cx: 100 + Math.cos(a) * (v / 10) * 85, cy: 100 + Math.sin(a) * (v / 10) * 85 } : { cx: 100, cy: 100 }} transition={{ type: "spring", stiffness: 90, damping: 12 }} />;
      })}
    </svg>
  );
}

function OkrPreview({ on }: { on: boolean }) {
  const krs = [
    ["Publish 12 posts", 0.75, "bg-sticky-green"],
    ["Reach 1k readers", 0.42, "bg-sticky-blue"],
    ["Guest on 2 podcasts", 0.5, "bg-sticky-orange"],
  ] as const;
  return (
    <div aria-hidden className="space-y-3">
      <p className="text-[13px] font-bold text-sticky-yellow">O · Grow the newsletter</p>
      {krs.map(([label, v, c], i) => (
        <div key={label}>
          <div className="mb-1 flex justify-between text-[12px] text-white/80">
            <span>{label}</span>
            <span className="tabular">{Math.round(v * 100)}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
            <motion.div className={cx("h-full origin-left rounded-full", c)} initial={{ scaleX: 0 }} animate={on ? { scaleX: v } : undefined} transition={{ type: "spring", stiffness: 60, damping: 14, delay: 0.2 + i * 0.15 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SmartPreview({ on }: { on: boolean }) {
  const letters = [
    ["S", "Specific", "bg-sticky-pink"],
    ["M", "Measurable", "bg-sticky-yellow"],
    ["A", "Achievable", "bg-sticky-green"],
    ["R", "Relevant", "bg-sticky-blue"],
    ["T", "Time-bound", "bg-sticky-lime"],
  ] as const;
  return (
    <div aria-hidden className="flex justify-between gap-1.5" style={{ perspective: 600 }}>
      {letters.map(([l, , c], i) => (
        <motion.div
          key={l}
          className={cx("flex flex-1 flex-col items-center rounded-xl py-3 text-night", c)}
          initial={{ rotateY: 180, opacity: 0 }}
          animate={on ? { rotateY: 0, opacity: 1 } : undefined}
          transition={{ type: "spring", stiffness: 140, damping: 13, delay: i * 0.12 }}
        >
          <span className="font-[family-name:var(--font-display)] text-[30px] leading-none font-black">{l}</span>
        </motion.div>
      ))}
    </div>
  );
}

function RoadmapPreview({ on }: { on: boolean }) {
  const stops = [
    [20, 70, "Jan"],
    [90, 30, "Mar"],
    [170, 62, "May"],
    [250, 24, "Aug"],
  ] as const;
  return (
    <svg viewBox="0 0 280 100" className="w-full" aria-hidden>
      <motion.path
        d="M20 70 C 50 70, 60 30, 90 30 S 140 62, 170 62 S 220 24, 250 24"
        fill="none"
        stroke="url(#road)"
        strokeWidth="5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={on ? { pathLength: 1 } : undefined}
        transition={{ duration: 1.4, ease: EASE }}
      />
      <defs>
        <linearGradient id="road" x1="0" x2="1">
          <stop offset="0" stopColor="#ffd84d" />
          <stop offset="0.5" stopColor="#ff9ec7" />
          <stop offset="1" stopColor="#ffb38a" />
        </linearGradient>
      </defs>
      {stops.map(([x, y, label], i) => (
        <motion.g key={label} initial={{ opacity: 0, scale: 0 }} animate={on ? { opacity: 1, scale: 1 } : undefined} transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.3 + i * 0.3 }} style={{ originX: `${x}px`, originY: `${y}px` }}>
          <circle cx={x} cy={y} r="8" fill="#12301f" stroke="#ffd84d" strokeWidth="3" />
          <text x={x} y={y + 24} textAnchor="middle" fontSize="11" fontWeight="700" fill="rgb(255 255 255 / 0.85)">
            {label}
          </text>
        </motion.g>
      ))}
    </svg>
  );
}

type TemplateCard = { id: string; title: string; blurb: string; icon: ReactNode; span: string; preview: (on: boolean) => ReactNode };

const CARDS: TemplateCard[] = [
  { id: "mandala", title: "Mandala chart", blurb: "One core goal, eight supporting areas, sixty-four actions.", icon: <Grid3x3 size={16} />, span: "md:col-span-2 md:row-span-2", preview: (on) => <MandalaPreview on={on} /> },
  { id: "wheel", title: "Wheel of life", blurb: "Rate eight life areas and see where to grow.", icon: <Sparkles size={16} />, span: "md:col-span-2", preview: (on) => <WheelPreview on={on} /> },
  { id: "okr", title: "OKR", blurb: "An objective with measurable key results.", icon: <Target size={16} />, span: "md:col-span-2", preview: (on) => <OkrPreview on={on} /> },
  { id: "smart", title: "SMART goal", blurb: "Specific, measurable, achievable, relevant, time-bound.", icon: <Sparkles size={16} />, span: "md:col-span-2", preview: (on) => <SmartPreview on={on} /> },
  { id: "roadmap", title: "Goal roadmap", blurb: "Milestones on a timeline, each with a date.", icon: <Route size={16} />, span: "md:col-span-2", preview: (on) => <RoadmapPreview on={on} /> },
];

function TemplateTile({ card, i }: { card: TemplateCard; i: number }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const on = useInView(ref, { once: true, amount: 0.4 });
  return (
    <motion.div
      className={cx(card.span)}
      initial={{ opacity: 0, y: 60, rotate: i % 2 ? 3 : -3 }}
      whileInView={{ opacity: 1, y: 0, rotate: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ type: "spring", stiffness: 120, damping: 18, delay: (i % 3) * 0.08 }}
    >
      <Link
        ref={ref}
        href={`/studio?t=${card.id}`}
        onPointerMove={spot}
        className="spotlight group flex h-full flex-col justify-between gap-6 rounded-3xl border border-white/12 bg-night-2/80 p-6 transition-[transform,border-color] duration-300 ease-[var(--ease-spring)] hover:-translate-y-1.5 hover:border-sticky-yellow/60"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[17px] font-bold text-white">
              <span className="grid size-8 place-items-center rounded-lg bg-sticky-yellow text-night" aria-hidden>
                {card.icon}
              </span>
              {card.title}
            </p>
            <p className="mt-2 max-w-xs text-[14px] text-white/75">{card.blurb}</p>
          </div>
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-white/20 text-white transition-[transform,background-color,color] duration-300 group-hover:rotate-[-45deg] group-hover:bg-sticky-yellow group-hover:text-night" aria-hidden>
            <ArrowRight size={16} />
          </span>
        </div>
        <div className={cx("flex items-center", card.id === "mandala" && "flex-1")}>
          <div className="w-full">{card.preview(on)}</div>
        </div>
        <span className="sr-only">Open the {card.title} template in the Goal Studio</span>
      </Link>
    </motion.div>
  );
}

export function NightTemplates() {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 30%"] });
  const radius = useTransform(scrollYProgress, [0, 1], ["6%", "150%"]);
  const clip = useTransform(radius, (r) => `circle(${r} at 50% 0%)`);
  return (
    <motion.section
      ref={ref}
      id="templates"
      aria-labelledby="templates-title"
      className="dot-grid-night relative overflow-hidden bg-night py-24 text-white sm:py-32"
      style={reduce ? undefined : { clipPath: clip }}
    >
      <div aria-hidden className="aurora pointer-events-none absolute -top-1/2 left-1/2 size-[1100px] -translate-x-1/2 rounded-full opacity-30 [mask-image:radial-gradient(circle,black,transparent_62%)]" />
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.6 }} transition={{ duration: 0.8, ease: EASE }} className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-sticky-yellow/50 px-3 py-1 text-[12px] font-bold tracking-wide text-sticky-yellow uppercase">
            <Sparkles size={14} aria-hidden /> Goal Studio · 5 templates
          </p>
          <h2 id="templates-title" className="mt-5 font-[family-name:var(--font-display)] text-[44px] leading-[0.98] font-black tracking-[-0.045em] sm:text-[76px]">
            Pick a frame.
            <br />
            <span className="vivid-text">Watch it come alive.</span>
          </h2>
          <p className="mt-5 max-w-xl text-[17px] text-white/80">Classic goal-setting frameworks, rebuilt as interactive canvases. Fill one in and LifeOS turns it into a real goal with linked tasks.</p>
        </motion.div>
        <div className="mt-14 grid auto-rows-[minmax(240px,auto)] gap-4 md:grid-cols-6">
          {CARDS.map((c, i) => (
            <TemplateTile key={c.id} card={c} i={i} />
          ))}
        </div>
        <motion.div className="mt-12 flex justify-center" initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 200, damping: 16 }}>
          <Link
            href="/studio"
            className="group relative inline-flex h-14 items-center gap-3 rounded-2xl bg-sticky-yellow px-7 text-[16px] font-black text-night shadow-[0_0_0_6px_rgb(255_216_77/0.2),0_20px_50px_-12px_rgb(255_216_77/0.6)] transition-transform duration-300 ease-[var(--ease-spring)] hover:-translate-y-1 hover:scale-[1.03] active:scale-[0.98]"
          >
            <span aria-hidden className="pulse-ring absolute inset-0 rounded-2xl border-2 border-sticky-yellow" />
            Open the Goal Studio
            <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
          </Link>
        </motion.div>
      </div>
    </motion.section>
  );
}
