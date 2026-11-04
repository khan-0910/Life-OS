"use client";

/**
 * One-shot visual effects drawn by <FxLayer/> above everything. Purely
 * presentational: callers have already changed state before emitting, and an
 * effect never calls back into app logic. Every emitter is a no-op under
 * reduced motion.
 */

export type FxEvent =
  | { kind: "enter"; x: number; y: number }
  | { kind: "trail"; from: DOMRect; target: string; colors: string[] }
  | { kind: "threshold"; colors: [string, string] }
  | { kind: "burst"; x: number; y: number };

type Listener = (e: FxEvent & { id: number }) => void;
const listeners = new Set<Listener>();
let seq = 0;

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function onFx(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function emit(e: FxEvent): void {
  if (prefersReducedMotion()) return;
  const withId = { ...e, id: ++seq };
  listeners.forEach((l) => l(withId));
}

/** Pastel curtain from the click point while the planner loads (navigation is not delayed). */
export function fxEnter(x: number, y: number): void {
  emit({ kind: "enter", x, y });
}

/** A short comet trail from an element to a target (e.g. a completed task → daily progress). */
export function fxTrail(from: Element | null | undefined, target: string, colors: string[]): void {
  if (!from || typeof document === "undefined" || !document.querySelector(target)) return;
  emit({ kind: "trail", from: from.getBoundingClientRect(), target, colors });
}

/** The focus threshold: a soft color bloom across the screen as a session starts. */
export function fxThreshold(colors: [string, string]): void {
  emit({ kind: "threshold", colors });
}

/** A sticky-note confetti burst from an element (e.g. a template just became a real goal). */
export function fxBurst(from: Element | null | undefined): void {
  if (!from) return;
  const r = from.getBoundingClientRect();
  emit({ kind: "burst", x: r.left + r.width / 2, y: r.top + r.height / 2 });
}
