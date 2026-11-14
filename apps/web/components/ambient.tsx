"use client";

import { cx } from "./ui";

export type AmbientMood = "day" | "focus" | "break" | "landing";

const MOODS: Record<AmbientMood, [string, string, string, string]> = {
  day: ["#f8d9b8", "#e3ebe0", "#f6e2a8", "#efe3cc"],
  focus: ["#f6dcc6", "#d6e6dc", "#efe3cc", "#eadfca"],
  break: ["#f9d9a8", "#f6c9c0", "#f9e3a1", "#f8cdb4"],
  landing: ["#ffd9a8", "#e3ebe0", "#ffe8a3", "#f8cdb4"],
};

/**
 * Slow drifting pastel color fields behind the UI. Radial gradients (no blur
 * filter) moved by CSS transforms; paused when the tab is hidden and removed
 * under reduced motion (the static gradient stays).
 */
export function AmbientField({ mood = "day", className }: { mood?: AmbientMood; className?: string }) {
  const [a, b, c, d] = MOODS[mood];
  const blob = (color: string) => `radial-gradient(circle at center, ${color} 0%, ${color}00 68%)`;
  return (
    <div aria-hidden className={cx("pointer-events-none fixed inset-0 -z-10 overflow-hidden", className)}>
      <div className="ambient-blob transition-[background] duration-1000" style={{ width: "62vmax", height: "62vmax", left: "-18vmax", top: "-22vmax", background: blob(a), opacity: 0.75 }} />
      <div className="ambient-blob transition-[background] duration-1000" style={{ width: "58vmax", height: "58vmax", right: "-20vmax", top: "-8vmax", background: blob(b), opacity: 0.8 }} />
      <div className="ambient-blob transition-[background] duration-1000" style={{ width: "54vmax", height: "54vmax", left: "18vw", bottom: "-30vmax", background: blob(c), opacity: 0.7 }} />
      <div className="ambient-blob transition-[background] duration-1000" style={{ width: "36vmax", height: "36vmax", right: "8vw", bottom: "-6vmax", background: blob(d), opacity: 0.55, animationDelay: "-12s" }} />
    </div>
  );
}
