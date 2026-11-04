"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { onFx, type FxEvent } from "@/lib/fx";

type Active = FxEvent & { id: number };

const CURTAIN_MIN_MS = 520;
const CURTAIN_MAX_MS = 1600;

/**
 * Root-level effects layer (lives in the root layout, so it survives route
 * changes). Never intercepts input: pointer-events are off everywhere.
 */
export function FxLayer() {
  const [effects, setEffects] = useState<Active[]>([]);
  const pathname = usePathname();
  const curtainStart = useRef<{ id: number; at: number; path: string } | null>(null);

  // Pause ambient CSS loops while the tab is hidden.
  useEffect(() => {
    const sync = () => document.documentElement.toggleAttribute("data-hidden", document.visibilityState === "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  useEffect(
    () =>
      onFx((e) => {
        setEffects((list) => [...list.filter((x) => x.kind !== e.kind || e.kind === "trail"), e]);
        if (e.kind === "enter") curtainStart.current = { id: e.id, at: performance.now(), path: window.location.pathname };
        const life = e.kind === "trail" ? 900 : e.kind === "threshold" ? 1100 : e.kind === "burst" ? 1500 : CURTAIN_MAX_MS;
        window.setTimeout(() => setEffects((list) => list.filter((x) => x.id !== e.id)), life);
      }),
    [],
  );

  // Lift the curtain once the destination route has rendered (and a minimum beat has passed).
  useEffect(() => {
    const c = curtainStart.current;
    if (!c || pathname === c.path) return;
    const wait = Math.max(0, CURTAIN_MIN_MS - (performance.now() - c.at));
    const t = window.setTimeout(() => {
      setEffects((list) => list.filter((x) => x.id !== c.id));
      curtainStart.current = null;
    }, wait);
    return () => window.clearTimeout(t);
  }, [pathname]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[100]">
      <AnimatePresence>
        {effects.map((e) =>
          e.kind === "enter" ? (
            <EnterCurtain key={e.id} x={e.x} y={e.y} />
          ) : e.kind === "threshold" ? (
            <Threshold key={e.id} colors={e.colors} />
          ) : e.kind === "burst" ? (
            <Burst key={e.id} x={e.x} y={e.y} />
          ) : (
            <Trail key={e.id} from={e.from} target={e.target} colors={e.colors} />
          ),
        )}
      </AnimatePresence>
    </div>
  );
}

function EnterCurtain({ x, y }: { x: number; y: number }) {
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) + 40;
  return (
    <motion.div
      className="absolute inset-0"
      initial={{ clipPath: `circle(0px at ${x}px ${y}px)` }}
      animate={{ clipPath: `circle(${r}px at ${x}px ${y}px)` }}
      exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }}
      transition={{ duration: 0.52, ease: [0.65, 0, 0.35, 1] }}
      style={{
        background: "repeating-linear-gradient(-45deg, rgb(29 26 22 / 0.06) 0 2px, transparent 2px 14px), #ffc83d",
      }}
    >
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-[10vw]">
        <svg viewBox="0 0 1000 40" className="h-10 w-full overflow-visible" preserveAspectRatio="none">
          <defs>
            <linearGradient id="curtain-dayline" x1="0" x2="1">
              <stop offset="0" stopColor="#ff9a62" />
              <stop offset="0.35" stopColor="#ff8fa3" />
              <stop offset="0.65" stopColor="#ffb38a" />
              <stop offset="1" stopColor="#ff8a4c" />
            </linearGradient>
          </defs>
          <motion.path
            d="M0 20 C 200 -6, 320 46, 500 20 S 820 -6, 1000 20"
            fill="none"
            stroke="url(#curtain-dayline)"
            strokeWidth="5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.7, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <motion.p
          className="mt-4 text-center font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-ink"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.4 }}
        >
          Opening your day…
        </motion.p>
      </div>
    </motion.div>
  );
}

function Threshold({ colors }: { colors: [string, string] }) {
  return (
    <motion.div
      className="absolute inset-0"
      style={{ background: `radial-gradient(circle at 50% 45%, ${colors[0]}, ${colors[1]} 45%, transparent 75%)` }}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: [0, 0.55, 0], scale: [0.6, 1.15, 1.35] }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1], times: [0, 0.35, 1] }}
    />
  );
}

function Trail({ from, target, colors }: { from: DOMRect; target: string; colors: string[] }) {
  const to = document.querySelector(target)?.getBoundingClientRect();
  if (!to) return null;
  const x0 = from.left + from.width / 2;
  const y0 = from.top + from.height / 2;
  const x1 = to.left + to.width / 2;
  const y1 = to.top + to.height / 2;
  // Arc upward between the two points.
  const mx = (x0 + x1) / 2;
  const my = Math.min(y0, y1) - Math.max(60, Math.abs(x1 - x0) * 0.25);
  return (
    <>
      {colors.map((c, i) => (
        <motion.span
          key={i}
          className="absolute top-0 left-0 rounded-full"
          style={{ width: 12 - i * 2, height: 12 - i * 2, marginLeft: -(6 - i), marginTop: -(6 - i), background: c, boxShadow: `0 0 12px ${c}` }}
          initial={{ x: x0, y: y0, opacity: 0, scale: 0.4 }}
          animate={{ x: [x0, mx, x1], y: [y0, my, y1], opacity: [0, 1, 1, 0], scale: [0.4, 1, 0.6] }}
          transition={{ duration: 0.72, delay: i * 0.05, ease: [0.45, 0, 0.25, 1], times: [0, 0.5, 1] }}
        />
      ))}
    </>
  );
}

const BURST_COLORS = ["#ffd84d", "#ff9ec7", "#ffb38a", "#8ff0b0", "#ffb36b", "#b8d96b", "#0f6b5c", "#ff5a36"];

/** Deterministic spread (no Math.random in render): 28 paper squares fanning out and falling. */
function Burst({ x, y }: { x: number; y: number }) {
  const pieces = Array.from({ length: 28 }, (_, i) => {
    const angle = (i / 28) * Math.PI * 2 + (i % 3) * 0.21;
    const dist = 120 + ((i * 37) % 140);
    return {
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist - 60,
      rot: ((i * 73) % 360) - 180,
      size: 7 + (i % 4) * 3,
      color: BURST_COLORS[i % BURST_COLORS.length]!,
      round: i % 5 === 0,
    };
  });
  return (
    <>
      <motion.span
        className="absolute top-0 left-0 rounded-full border-4 border-[#ffd84d]"
        style={{ width: 40, height: 40, marginLeft: -20, marginTop: -20, x, y }}
        initial={{ scale: 0.3, opacity: 1 }}
        animate={{ scale: 5, opacity: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      />
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute top-0 left-0"
          style={{ width: p.size, height: p.round ? p.size : p.size * 1.3, marginLeft: -p.size / 2, background: p.color, borderRadius: p.round ? 999 : 2 }}
          initial={{ x, y, opacity: 1, rotate: 0, scale: 0.4 }}
          animate={{ x: [x, x + p.dx, x + p.dx * 1.1], y: [y, y + p.dy, y + p.dy + 220], rotate: p.rot * 3, opacity: [1, 1, 0], scale: 1 }}
          transition={{ duration: 1.35, ease: [0.2, 0.7, 0.4, 1], times: [0, 0.35, 1] }}
        />
      ))}
    </>
  );
}
