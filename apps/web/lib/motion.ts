"use client";

/**
 * LifeOS motion vocabulary. See docs/MOTION.md.
 *
 * Roles:
 *  - micro   (checks, presses, bumps)          ~140 ms
 *  - ui      (state swaps, crossfades)         ~220 ms
 *  - panel   (sections, dialogs, layout)       ~320 ms, interruptible
 *  - ritual  (entering/leaving Focus)          ~560 ms, never blocking
 * Curves: `ease.out` for opacity/state; `spring.settle` for anything spatial.
 */
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useAnimate, useReducedMotion, type Transition, type Variants } from "motion/react";

export const ease = {
  out: [0.22, 1, 0.36, 1] as [number, number, number, number],
  inOut: [0.65, 0, 0.35, 1] as [number, number, number, number],
};

export const dur = { micro: 0.14, ui: 0.22, panel: 0.32, ritual: 0.56 } as const;

export const spring = {
  /** Drag previews and snapping: quick, no wobble. */
  snap: { type: "spring", stiffness: 700, damping: 48, mass: 0.6 } satisfies Transition,
  /** Drops, layout changes, panels: a soft settle with a hint of weight. */
  settle: { type: "spring", stiffness: 380, damping: 30, mass: 0.8 } satisfies Transition,
};

export const t = {
  micro: { duration: dur.micro, ease: ease.out } satisfies Transition,
  ui: { duration: dur.ui, ease: ease.out } satisfies Transition,
  panel: { duration: dur.panel, ease: ease.out } satisfies Transition,
  ritual: { duration: dur.ritual, ease: ease.out } satisfies Transition,
};

/** Focal-hierarchy reveal: parent staggers a few direct children only. */
export const reveal: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: t.panel },
};

export const revealGroup = (stagger = 0.07, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

/** Brief scale "bump" used when a real value increases. */
export const bump = { scale: [1, 1.07, 1], transition: { duration: 0.42, ease: ease.out } };

/** How long a just-completed row stays visible, checked, before moving away. */
export const COMPLETE_HOLD_MS = 650;

/**
 * True when the user asked the OS for reduced motion. Components use it to skip
 * holds, bumps, lifts and ambient effects; semantic state never waits on it.
 */
export function useCalm(): boolean {
  return useReducedMotion() ?? false;
}

function prefersReduced(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Scale-bump the returned element whenever `value` increases (a real change, never on mount). */
export function useBump<T extends Element = HTMLDivElement>(value: number) {
  const [scope, animate] = useAnimate<T>();
  const calm = useCalm();
  const prev = useRef(value);
  useEffect(() => {
    if (value > prev.current && !calm && scope.current) {
      animate(scope.current, { scale: [1, 1.07, 1] }, { duration: 0.42, ease: ease.out });
    }
    prev.current = value;
  }, [value, calm, animate, scope]);
  return scope;
}

// ---- Completion hold ----
// A task completed from a list stays in place, checked, for COMPLETE_HOLD_MS
// before it moves to "completed". The task is already saved as done; this only
// delays where the row is drawn. Skipped entirely under reduced motion.

const held = new Set<string>();
let heldSnapshot: ReadonlySet<string> = new Set();
const EMPTY: ReadonlySet<string> = new Set();
const heldSubs = new Set<() => void>();
const emitHeld = () => {
  heldSnapshot = new Set(held);
  heldSubs.forEach((f) => f());
};

export function holdCompleted(id: string): void {
  if (prefersReduced()) return;
  held.add(id);
  emitHeld();
  window.setTimeout(() => {
    if (held.delete(id)) emitHeld();
  }, COMPLETE_HOLD_MS);
}

export function releaseHold(id: string): void {
  if (held.delete(id)) emitHeld();
}

export function getHeldCompletions(): ReadonlySet<string> {
  return heldSnapshot;
}

export function useHeldCompletions(): ReadonlySet<string> {
  return useSyncExternalStore(
    (cb) => {
      heldSubs.add(cb);
      return () => heldSubs.delete(cb);
    },
    getHeldCompletions,
    () => EMPTY,
  );
}

let arrived = false;
/**
 * The composed arrival plays once per page load. Read with `useState(isFirstArrival)`
 * and call `useMarkArrived()` so StrictMode's double render can't consume it.
 */
export function isFirstArrival(): boolean {
  return !arrived;
}
export function useMarkArrived(): void {
  useEffect(() => {
    arrived = true;
  }, []);
}
