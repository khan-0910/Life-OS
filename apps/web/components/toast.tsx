"use client";

import { useEffect, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";

export interface Toast {
  id: number;
  message: string;
  tone?: "neutral" | "error";
  action?: { label: string; run: () => void };
}

let toasts: Toast[] = [];
let seq = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());

export function toast(message: string, opts: Omit<Toast, "id" | "message"> = {}): void {
  const t = { id: ++seq, message, ...opts };
  toasts = [...toasts.slice(-2), t];
  emit();
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function ToastItem({ t }: { t: Toast }) {
  useEffect(() => {
    const timer = setTimeout(() => dismiss(t.id), t.action ? 6000 : 3500);
    return () => clearTimeout(timer);
  }, [t]);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 28, scale: 0.9, rotate: -2 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, y: 10, scale: 0.95, transition: { duration: 0.16 } }}
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
      className={`pointer-events-auto flex items-center gap-3 rounded-2xl border-2 px-4 py-2.5 text-sm font-medium shadow-[4px_4px_0_0_#1d1a16] ${
        t.tone === "error" ? "border-ink bg-blush text-rose" : "border-ink bg-sticky-yellow text-ink"
      }`}
    >
      <span>{t.message}</span>
      {t.action ? (
        <button
          type="button"
          className="rounded-md px-2 py-0.5 font-bold text-ink underline decoration-2 underline-offset-2 hover:bg-ink/10"
          onClick={() => {
            t.action?.run();
            dismiss(t.id);
          }}
        >
          {t.action.label}
        </button>
      ) : null}
      <button type="button" aria-label="Dismiss" className="text-ink-3 hover:text-ink" onClick={() => dismiss(t.id)}>
        <X size={14} />
      </button>
    </motion.li>
  );
}

export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => toasts,
    () => toasts,
  );
  return (
    <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 lg:bottom-6">
      <ul className="flex flex-col items-center gap-2">
        <AnimatePresence initial={false}>
          {list.map((t) => (
            <ToastItem key={t.id} t={t} />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
