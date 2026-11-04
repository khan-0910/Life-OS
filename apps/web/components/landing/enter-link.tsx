"use client";

import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { fxEnter } from "@/lib/fx";
import { STORAGE_KEY } from "@/lib/store";
import { cx } from "../ui";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** null while unknown (server render), then whether this browser already has a LifeOS planner. */
export function useReturning(): boolean | null {
  const raw = useSyncExternalStore(subscribe, readRaw, () => undefined);
  return useMemo(() => {
    if (raw === undefined) return null;
    if (!raw) return false;
    try {
      const d = JSON.parse(raw) as Record<string, unknown>;
      return ["tasks", "habits", "timeBlocks", "goals", "projects"].some((k) => Array.isArray(d[k]) && (d[k] as unknown[]).length > 0);
    } catch {
      return false;
    }
  }, [raw]);
}

/**
 * The way into the planner. A real link (works without JS, new tab, keyboard);
 * on a plain click it also plays the pastel curtain while Next navigates —
 * navigation is never delayed by the effect.
 */
export function EnterLink({ children, className, variant = "primary" }: { children?: ReactNode; className?: string; variant?: "primary" | "ghost" }) {
  const returning = useReturning();
  return (
    <Link
      href="/today"
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        const r = e.currentTarget.getBoundingClientRect();
        fxEnter(r.left + r.width / 2, r.top + r.height / 2);
      }}
      className={cx(
        "group relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-2xl px-6 text-[15px] font-semibold transition-[transform,box-shadow] duration-300 ease-[var(--ease-spring)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",
        variant === "primary"
          ? "border-2 border-ink bg-ink text-canvas shadow-[4px_4px_0_0_var(--color-tomato)] hover:shadow-[6px_6px_0_0_var(--color-tomato)]"
          : "border-2 border-ink bg-panel text-ink shadow-[4px_4px_0_0_#1d1a16]",
        className,
      )}
    >
      {variant === "primary" ? (
        <span aria-hidden className="dayline-shimmer absolute inset-x-0 bottom-0 h-[3px] opacity-90" />
      ) : null}
      <span className="relative">{children ?? (returning ? "Open my planner" : "Open LifeOS")}</span>
      <ArrowRight size={17} aria-hidden className="relative transition-transform duration-300 group-hover:translate-x-1" />
    </Link>
  );
}
