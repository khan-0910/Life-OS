"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { minutesInTz, todayInTz, type ISODate } from "@lifeos/domain";
import { useData } from "./store";

/** Current time, refreshed every `intervalMs` and immediately when the tab becomes visible. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, intervalMs);
    const onVis = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [intervalMs]);
  return now;
}

export function useTimeZone(): string {
  return useData().settings.timeZone;
}

/** Today's date in the user's configured time zone; rolls over at local midnight. */
export function useToday(): { today: ISODate; minutes: number; now: number; tz: string } {
  const tz = useTimeZone();
  const now = useNow(30_000);
  return { today: todayInTz(tz, now), minutes: minutesInTz(now, tz), now, tz };
}

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

/** True when focus is in a text field — keyboard shortcuts should stand down. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}
