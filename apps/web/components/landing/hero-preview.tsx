"use client";

/**
 * The hero's live preview, assembled from LifeOS's own interface pieces
 * (schedule blocks, task rows, habit marks, focus ring, daily progress) with
 * an example day. Each card arrives on its own path, then floats; on desktop
 * the stage tilts with the pointer. Reduced motion: final layout, no movement.
 */
import { useEffect, useState, type ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from "motion/react";
import { Check, Flag, Timer } from "lucide-react";
import { cx } from "../ui";

const EASE = [0.22, 1, 0.36, 1] as const;

function usePointerTilt(enabled: boolean) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 120, damping: 18, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 120, damping: 18, mass: 0.6 });
  useEffect(() => {
    if (!enabled || !window.matchMedia("(pointer: fine)").matches) return;
    const onMove = (e: PointerEvent) => {
      mx.set((e.clientX / window.innerWidth) * 2 - 1);
      my.set((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [enabled, mx, my]);
  return { sx, sy };
}

function Layer({
  sx,
  sy,
  depth,
  className,
  from,
  delay,
  float,
  children,
}: {
  sx: MotionValue<number>;
  sy: MotionValue<number>;
  depth: number;
  className: string;
  from: Record<string, number>;
  delay: number;
  float: string;
  children: ReactNode;
}) {
  const x = useTransform(sx, (v) => v * depth * 16);
  const y = useTransform(sy, (v) => v * depth * 12);
  return (
    <motion.div className={cx("absolute", className)} style={{ x, y, zIndex: Math.round(depth * 10) }}>
      <motion.div initial={{ opacity: 0, ...from }} animate={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 140, damping: 18, mass: 0.9, delay }}>
        <div className="float-y" style={{ animationDelay: float }}>
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}

const card = "rounded-2xl border-2 border-ink bg-panel shadow-[5px_5px_0_0_#1d1a16]";

export function HeroPreview() {
  const reduce = useReducedMotion() ?? false;
  const { sx, sy } = usePointerTilt(!reduce);
  const rotateY = useTransform(sx, (v) => v * 7);
  const rotateX = useTransform(sy, (v) => v * -5);
  const [checked, setChecked] = useState(reduce);

  useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(() => setChecked(true), 2600);
    return () => window.clearTimeout(t);
  }, [reduce]);

  return (
    <div className="relative mx-auto aspect-[1/0.95] w-full max-w-[560px] [perspective:1400px]" role="img" aria-label="Preview of the LifeOS planner: an example day with a schedule, tasks, a habit streak, a focus timer and daily progress.">
      <motion.div className="absolute inset-0" style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}>
        {/* Schedule (back) */}
        <Layer sx={sx} sy={sy} depth={0.4} className="top-[4%] left-0 w-[46%]" from={{ x: -80, rotate: -6 }} delay={0.15} float="-1s">
          <div className={cx(card, "p-3")}>
            <p className="mb-2 text-[11px] font-semibold text-ink-3">Schedule</p>
            <div className="relative h-44">
              {[9, 10, 11, 12, 1].map((h, i) => (
                <div key={h} className="absolute inset-x-0 flex items-center gap-2 text-[10px] text-ink-3" style={{ top: i * 36 }}>
                  <span className="w-6 text-right tabular">{h}</span>
                  <span className="h-px flex-1 bg-ink/10" />
                </div>
              ))}
              {[
                { top: 6, h: 54, label: "Deep work", cls: "bg-butter border-[#e8b45c] text-[#5a3800]", from: { x: -40 } },
                { top: 74, h: 30, label: "Team sync", cls: "bg-powder border-[#f2a65a] text-[#6b2e0a]", from: { y: -30 } },
                { top: 116, h: 44, label: "Walk", cls: "bg-mint border-[#86d6af] text-[#11573a]", from: { scale: 0.6 } },
              ].map((b, i) => (
                <motion.div
                  key={b.label}
                  className={cx("absolute right-1 left-9 rounded-lg border px-2 py-1 text-[10px] font-semibold", b.cls)}
                  style={{ top: b.top, height: b.h }}
                  initial={{ opacity: 0, ...b.from }}
                  animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 180, damping: 16, delay: 0.7 + i * 0.22 }}
                >
                  {b.label}
                </motion.div>
              ))}
              <motion.div className="absolute right-0 left-7 flex items-center" style={{ top: 64 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}>
                <span className="dayline-head size-2.5 rounded-full" />
                <span className="dayline-rule h-[2px] flex-1" />
              </motion.div>
            </div>
          </div>
        </Layer>

        {/* Today (center) */}
        <Layer sx={sx} sy={sy} depth={0.75} className="top-[26%] left-[20%] w-[60%]" from={{ y: 70, scale: 0.92 }} delay={0.3} float="-3s">
          <div className={cx(card, "p-4")}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] text-ink-3">Today</p>
                <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">Thursday, May 14</p>
              </div>
              <MiniRing value={checked ? 0.67 : 0.33} label={checked ? "2/3" : "1/3"} />
            </div>
            <svg viewBox="0 0 300 16" className="mt-2 h-4 w-full overflow-visible">
              <defs>
                <linearGradient id="hero-dayline" x1="0" x2="1">
                  <stop offset="0" stopColor="#ff9a62" />
                  <stop offset="0.4" stopColor="#ff8fa3" />
                  <stop offset="0.75" stopColor="#ffb38a" />
                  <stop offset="1" stopColor="#ff8a4c" />
                </linearGradient>
              </defs>
              <line x1="0" y1="8" x2="300" y2="8" stroke="rgb(29 26 22 / 0.08)" strokeWidth="3" strokeLinecap="round" />
              <motion.path d="M0 8 L 170 8" stroke="url(#hero-dayline)" strokeWidth="3.5" strokeLinecap="round" fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.3, delay: 0.8, ease: EASE }} />
              <motion.circle cx="170" cy="8" r="5" fill="#fff" stroke="#ffb38a" strokeWidth="2.5" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 2.0, type: "spring", stiffness: 300 }} />
            </svg>
            <ul className="mt-3 space-y-1.5">
              {[
                { t: "Sketch the About page", tag: "High", done: checked },
                { t: "Book the dentist", tag: "Due today", done: true },
                { t: "Water the plants", tag: "Planned", done: false },
              ].map((row, i) => (
                <motion.li
                  key={row.t}
                  className={cx("relative flex items-center gap-2.5 rounded-xl px-2 py-1.5", i === 0 && checked && "bg-mint/50")}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 + i * 0.12, duration: 0.5, ease: EASE }}
                >
                  <span className={cx("grid size-[18px] shrink-0 place-items-center rounded-full border transition-colors duration-300", row.done ? "border-sage bg-sage" : "border-ink/30")}>
                    {row.done ? <Check size={11} strokeWidth={3.5} className="text-white" /> : null}
                  </span>
                  <span className={cx("min-w-0 flex-1 truncate text-[12px] transition-colors duration-300", row.done ? "text-ink-3 line-through" : "text-ink")}>{row.t}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-rose">{i === 0 ? <Flag size={9} /> : null}</span>
                  <span className="text-[10px] text-ink-3">{row.tag}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </Layer>

        {/* Habit (front right) */}
        <Layer sx={sx} sy={sy} depth={1} className="top-[2%] right-0 w-[40%]" from={{ x: 90, rotate: 7 }} delay={0.5} float="-5s">
          <div className={cx(card, "p-3")}>
            <p className="text-[12px] font-semibold text-ink">Read 20 pages</p>
            <p className="text-[10px] text-ink-3">Every day</p>
            <div className="mt-2 grid grid-cols-7 gap-1">
              {Array.from({ length: 14 }, (_, i) => {
                const done = ![3, 9].includes(i);
                return (
                  <motion.span
                    key={i}
                    className={cx("aspect-square rounded-[5px]", done ? "bg-[#e2557a]" : "bg-ink/[0.07]")}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 420, damping: 14, delay: 1.1 + i * 0.05 }}
                  />
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-ink-2">
              <span className="font-semibold text-violet">4</span> day streak
            </p>
          </div>
        </Layer>

        {/* Focus (bottom right) */}
        <Layer sx={sx} sy={sy} depth={1.25} className="right-[4%] bottom-[2%] w-[42%]" from={{ y: 90, rotate: -4 }} delay={0.7} float="-2s">
          <div className={cx(card, "flex items-center gap-3 p-3")}>
            <FocusRing />
            <div>
              <p className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet">
                <Timer size={10} /> Focus · round 2
              </p>
              <p className="font-mono text-2xl font-medium text-ink tabular">18:24</p>
              <p className="text-[10px] text-ink-3">Sketch the About page</p>
            </div>
          </div>
        </Layer>

        {/* Progress chip (front left) */}
        <Layer sx={sx} sy={sy} depth={1.4} className="bottom-[10%] left-[2%] w-[34%]" from={{ scale: 0.5, y: 30 }} delay={0.95} float="-4s">
          <div className={cx(card, "p-3")}>
            <p className="text-[10px] font-semibold text-ink-3">Goal · Half marathon</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/[0.07]">
              <motion.div className="h-full rounded-full dayline-fill" initial={{ width: "0%" }} animate={{ width: "58%" }} transition={{ duration: 1.4, delay: 1.4, ease: EASE }} />
            </div>
            <p className="mt-1.5 text-[11px] text-ink-2">7 of 12 linked tasks</p>
          </div>
        </Layer>
      </motion.div>
    </div>
  );
}

function MiniRing({ value, label }: { value: number; label: string }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid size-11 place-items-center">
      <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="rgb(29 26 22 / 0.08)" strokeWidth="4.5" />
        <motion.circle cx="22" cy="22" r={r} fill="none" stroke="#23805a" strokeWidth="4.5" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value) }} transition={{ duration: 0.9, ease: EASE, delay: 0.6 }} />
      </svg>
      <motion.span key={label} className="text-[10px] font-semibold text-ink tabular" initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        {label}
      </motion.span>
    </div>
  );
}

function FocusRing() {
  const r = 24;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 60 60" className="absolute inset-0 -rotate-90">
        <defs>
          <linearGradient id="hero-focus" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffb38a" />
            <stop offset="1" stopColor="#ff8a4c" />
          </linearGradient>
        </defs>
        <circle cx="30" cy="30" r={r} fill="none" stroke="rgb(29 26 22 / 0.08)" strokeWidth="5" />
        <motion.circle cx="30" cy="30" r={r} fill="none" stroke="url(#hero-focus)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * 0.3 }} transition={{ duration: 1.8, delay: 1, ease: EASE }} />
      </svg>
      <div className="spin-slow absolute inset-0">
        <span className="dayline-head absolute top-0 left-1/2 size-2 -translate-x-1/2 rounded-full" />
      </div>
    </div>
  );
}
