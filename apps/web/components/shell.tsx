"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MotionConfig, motion } from "motion/react";
import { CalendarDays, ChartColumn, HardDrive, Plus, Repeat, LayoutTemplate, Settings, Sun, Target, Timer, TriangleAlert, WifiOff } from "lucide-react";
import { blockingDesired, blockingUntil, remainingMs } from "@lifeos/domain";
import { reconcileFocus } from "@/lib/actions";
import { spring } from "@/lib/motion";
import { formatCountdown, formatDateLong } from "@/lib/format";
import { isTyping, useNow, useOnline, useToday } from "@/lib/hooks";
import { describeExtError, extensionConnection, sendToExtension } from "@/lib/integrations";
import { hydrate, resetLoadError, useStore } from "@/lib/store";
import { AmbientField, type AmbientMood } from "./ambient";
import { QuickCapture } from "./tasks";
import { Toaster } from "./toast";
import { Button, Kbd, Skeleton, cx } from "./ui";

const NAV = [
  { href: "/today", label: "Today", icon: Sun },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/habits", label: "Habits", icon: Repeat },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/studio", label: "Studio", icon: LayoutTemplate },
  { href: "/focus", label: "Focus", icon: Timer },
  { href: "/insights", label: "Insights", icon: ChartColumn },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

const PHASE_LABEL = { focus: "Focus", break: "Break", ready: "Ready" } as const;

/** Keeps the persisted focus run current, updates the tab title and announces phase changes. */
function FocusEngine() {
  const { status, data } = useStore();
  const run = data.activeRun;
  const now = useNow(run ? 1000 : 60_000);
  const [announcement, setAnnouncement] = useState("");
  const lastPhase = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "ready" || !run) return;
    reconcileFocus();
    const id = window.setInterval(() => reconcileFocus(), 1000);
    const onVis = () => document.visibilityState === "visible" && reconcileFocus();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [status, run]);

  useEffect(() => {
    const phase = run ? run.phase : null;
    if (lastPhase.current !== null && phase !== lastPhase.current) {
      setAnnouncement(
        phase === "break" ? "Focus complete. Break started." : phase === "ready" ? "Break finished. Ready for the next focus." : phase === "focus" ? "Focus started." : "Focus session ended.",
      );
    }
    lastPhase.current = phase;
  }, [run]);

  useEffect(() => {
    if (!run) {
      if (document.title.includes("·")) document.title = "LifeOS";
      return;
    }
    document.title = run.phase === "ready" ? "Ready · LifeOS" : `${formatCountdown(remainingMs(run, now))} · ${PHASE_LABEL[run.phase]}${run.runningSince === null ? " (paused)" : ""} — LifeOS`;
  }, [run, now]);

  return (
    <div aria-live="assertive" className="sr-only">
      {announcement}
    </div>
  );
}

/** Pushes the desired block state to a paired browser extension and records what it reports. */
function ExtensionSync() {
  const { status, data } = useStore();
  const pairing = data.settings.extension;
  const run = data.activeRun;
  const breakBlocking = data.settings.focus.breakBlocking;
  const list = run?.blocklistId ? data.blocklists.find((b) => b.id === run.blocklistId) : undefined;
  // `tick` renews the lease every minute.
  const tick = useNow(60_000);
  const lastSent = useRef("");
  const sendSeq = useRef(0);

  useEffect(() => {
    if (status !== "ready") return;
    if (!pairing) {
      extensionConnection.set({ kind: "not_configured" });
      return;
    }
    // Computed here (not during render) so `until` always uses the real current time.
    const now = Date.now();
    const blocking = blockingDesired(run, breakBlocking) && !!list && list.domains.length > 0;
    const desired = {
      sessionId: run?.id ?? null,
      blocking,
      domains: blocking && list ? list.domains : [],
      until: blocking && run ? blockingUntil(run, now, breakBlocking) : now,
    };
    const key = `${pairing.extensionId}|${pairing.secret}|${desired.sessionId}|${desired.blocking}|${desired.domains.join(",")}|${Math.round(desired.until / 60_000)}|${tick}`;
    if (key === lastSent.current) return;
    lastSent.current = key;
    // Only the newest request's reply may update the status.
    const seq = ++sendSeq.current;
    sendToExtension(pairing.extensionId, { type: "state", secret: pairing.secret, state: desired })
      .then((resp) => {
        if (seq !== sendSeq.current) return;
        if (resp.ok && resp.type === "status") extensionConnection.set({ kind: "connected", status: resp.status, checkedAt: Date.now() });
        else if (!resp.ok && (resp.error === "bad_secret" || resp.error === "not_paired")) extensionConnection.set({ kind: "pairing_lost" });
        else if (!resp.ok) extensionConnection.set({ kind: "error", detail: describeExtError(resp.error) });
      })
      .catch((e: Error) => seq === sendSeq.current && extensionConnection.set({ kind: "not_detected", detail: e.message }));
  }, [status, pairing, run, list, breakBlocking, tick]);

  return null;
}

function FocusChip() {
  const { data } = useStore();
  const run = data.activeRun;
  const now = useNow(run ? 1000 : 60_000);
  if (!run) return null;
  const color = run.phase === "focus" ? "text-amber border-amber/30 bg-amber/10" : run.phase === "break" ? "text-sky border-sky/30 bg-sky/10" : "text-sage border-sage/30 bg-sage/10";
  return (
    <Link href="/focus" className={cx("inline-flex h-8 items-center gap-2 rounded-lg border px-2.5 text-[13px] font-medium tabular", color)}>
      <Timer size={14} aria-hidden />
      <span>{PHASE_LABEL[run.phase]}</span>
      {run.phase !== "ready" ? <span className="font-mono">{formatCountdown(remainingMs(run, now))}</span> : null}
      {run.runningSince === null && run.phase !== "ready" ? <span className="text-ink-3">paused</span> : null}
    </Link>
  );
}

function StatusPills() {
  const online = useOnline();
  return (
    <div className="flex items-center gap-2">
      {!online ? (
        <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs text-ink-2" role="status">
          <WifiOff size={13} aria-hidden /> Offline — local data still works
        </span>
      ) : null}
    </div>
  );
}

function Sidebar({ pathname }: { pathname: string }) {
  return (
    <motion.nav
      aria-label="Main"
      className="recede glass sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-r-2 border-ink px-3 py-5 lg:flex"
      initial={{ x: -24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 26 }}
    >
      <Link href="/" className="group mb-7 flex items-center gap-2.5 px-2.5" title="LifeOS home">
        <span aria-hidden className="grid size-8 place-items-center rounded-xl border-2 border-ink bg-sticky-yellow text-ink transition-transform duration-500 ease-[var(--ease-spring)] group-hover:rotate-[20deg]">
          <svg viewBox="0 0 20 20" width="15" height="15">
            <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2.2" />
            <path d="M10 3a7 7 0 0 1 7 7h-7z" fill="currentColor" />
          </svg>
        </span>
        <span className="font-[family-name:var(--font-display)] text-[16px] font-semibold tracking-tight">LifeOS</span>
      </Link>
      <ul className="flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx("group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors", active ? "text-ink" : "text-ink-3 hover:text-ink")}
              >
                {/* The selected pill travels between items. */}
                {active ? <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl border-2 border-ink bg-sticky-yellow shadow-[3px_3px_0_0_#1d1a16]" transition={spring.settle} /> : null}
                <motion.span
                  className="relative"
                  initial={false}
                  animate={active ? { rotate: [0, -14, 10, 0], scale: [1, 1.18, 1] } : { rotate: 0, scale: 1 }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Icon size={17} className="transition-transform duration-300 group-hover:-translate-y-px" aria-hidden />
                </motion.span>
                <span className="relative">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto rounded-2xl border-2 border-ink bg-mint px-3 py-2.5 text-xs text-ink-2">
        <div className="mb-0.5 flex items-center gap-1.5 font-medium text-ink-2">
          <HardDrive size={13} aria-hidden /> Local mode
        </div>
        Data is stored in this browser only.{" "}
        <Link href="/settings#data" className="text-sage hover:underline">
          Export
        </Link>
      </div>
    </motion.nav>
  );
}

function MobileNav({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Main" className="recede glass fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="grid grid-cols-8">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className={cx("relative flex h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium", active ? "text-ink" : "text-ink-3")}>
                {active ? <motion.span layoutId="mnav-active" className="absolute inset-x-1.5 inset-y-1.5 rounded-xl border-2 border-ink bg-sticky-yellow" transition={spring.settle} /> : null}
                <Icon size={18} aria-hidden className="relative" />
                <span className="relative">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function LoadingView() {
  return (
    <div aria-busy="true" aria-label="Loading your planner" className="flex flex-col gap-4">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-4 w-40" />
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

function LoadErrorView({ message }: { message: string }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div role="alert" className="mx-auto mt-16 max-w-lg rounded-2xl border border-rose/30 bg-rose/5 p-6">
      <h1 className="flex items-center gap-2 text-lg font-semibold text-rose">
        <TriangleAlert size={18} aria-hidden /> LifeOS couldn&apos;t read your saved data
      </h1>
      <p className="mt-2 text-sm text-ink-2">{message}</p>
      <p className="mt-2 text-sm text-ink-3">Nothing has been changed or deleted. Try again first; if it keeps failing, you can start fresh (this erases the unreadable data in this browser).</p>
      <div className="mt-5 flex gap-2">
        <Button variant="primary" onClick={() => hydrate()}>
          Try again
        </Button>
        <Button variant="danger" onClick={() => (confirm ? resetLoadError() : setConfirm(true))}>
          {confirm ? "Erase and start fresh" : "Start fresh…"}
        </Button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/today";
  const { status, loadError, saveError } = useStore();
  const { today, tz } = useToday();
  const [capture, setCapture] = useState(false);
  const runPhase = useStore().data.activeRun?.phase;
  // The ambient field follows the activity: cool lavender in focus, warm peach on break.
  const mood: AmbientMood = pathname.startsWith("/focus") && runPhase ? (runPhase === "break" ? "break" : "focus") : "day";

  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target) && !document.querySelector("dialog[open]")) {
        e.preventDefault();
        setCapture(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <AmbientField mood={mood} />
      <a href="#main" className="sr-only z-50 rounded-lg bg-ink px-3 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <div className="flex min-h-dvh">
        <Sidebar pathname={pathname} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="glass sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b-2 border-ink px-4 sm:px-6 lg:px-10">
            <div className="flex min-w-0 items-center gap-3">
              <span className="truncate text-[13px] text-ink-3">{status === "ready" ? `${formatDateLong(today)} · ${tz.replace(/_/g, " ")}` : " "}</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusPills />
              <FocusChip />
              <Button variant="primary" size="sm" onClick={() => setCapture(true)} disabled={status !== "ready"} aria-keyshortcuts="n">
                <Plus size={15} aria-hidden /> <span className="hidden sm:inline">Add task</span>
                <span className="hidden lg:inline">
                  <Kbd>N</Kbd>
                </span>
              </Button>
            </div>
          </header>
          {saveError ? (
            <div role="alert" className="border-b border-rose/30 bg-rose/10 px-4 py-2.5 text-[13px] text-rose sm:px-6 lg:px-10">
              <TriangleAlert size={14} className="mr-1.5 inline" aria-hidden />
              {saveError}{" "}
              <Link href="/settings#data" className="underline">
                Export now
              </Link>
            </div>
          ) : null}
          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1240px] flex-1 px-4 pt-6 pb-28 outline-none sm:px-6 lg:px-10 lg:pt-9 lg:pb-16">
            {status === "loading" ? <LoadingView /> : status === "error" ? <LoadErrorView message={loadError ?? "Unknown error."} /> : children}
          </main>
        </div>
      </div>
      <MobileNav pathname={pathname} />
      {status === "ready" ? (
        <>
          <FocusEngine />
          <ExtensionSync />
          <QuickCapture open={capture} onClose={() => setCapture(false)} today={today} />
        </>
      ) : null}
      <Toaster />
    </MotionConfig>
  );
}
