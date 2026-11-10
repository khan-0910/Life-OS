"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Globe, Monitor, OctagonX, Pause, PencilLine, Play, Plus, SkipForward, Square } from "lucide-react";
import { activeElapsedMs, blockingUntil, dateInTz, newId, remainingMs, sortTasks, type FocusPreset, type FocusRun } from "@lifeos/domain";
import { deletePreset, endFocus, nextFocus, pauseFocus, resumeFocus, savePreset, skipFocusPhase, startFocus, updateSettings } from "@/lib/actions";
import { formatCountdown, formatDateTime, formatDuration, formatTime } from "@/lib/format";
import { useNow, useToday } from "@/lib/hooks";
import { notifyCompanion, useCompanionLastSend, useExtensionConnection } from "@/lib/integrations";
import { fxThreshold } from "@/lib/fx";
import { t as motionT } from "@/lib/motion";
import { getState, useData } from "@/lib/store";
import { toast } from "../toast";
import { Badge, Button, Card, Dialog, EmptyState, Field, IconButton, Input, PageHeader, ProgressRing, SectionTitle, Select, cx } from "../ui";

/** Focus is cool lavender→sky; breaks warm to peach→butter; ready settles into mint. */
const PHASE = {
  focus: { label: "Focus", color: "#ffb38a", gradient: ["#ffb38a", "#ff8a4c"] as [string, string], glow: "#f6dcc6", text: "text-violet" },
  break: { label: "Break", color: "#ff9a62", gradient: ["#ff9a62", "#f2b75a"] as [string, string], glow: "#ffe2b8", text: "text-amber" },
  ready: { label: "Ready", color: "#6fd0a2", gradient: ["#6fd0a2", "#ff8a4c"] as [string, string], glow: "#c8f0dc", text: "text-sage" },
} as const;

/** Tell the companion what the current run implies. Called only from user actions. */
function syncCompanion(run: FocusRun | null) {
  const d = getState().data;
  if (!d.settings.companion?.enabled) return;
  const bb = d.settings.focus.breakBlocking;
  const guarding = run && (run.phase === "focus" || (run.phase === "break" && bb === "keep")) && run.runningSince !== null;
  void notifyCompanion(d.settings.companion, guarding ? "start" : "stop", guarding ? blockingUntil(run, Date.now(), bb) : 0).catch(() =>
    toast("Couldn't open the companion link.", { tone: "error" }),
  );
}

const after = (fn: () => void) => () => {
  fn();
  syncCompanion(getState().data.activeRun);
};

export function FocusView() {
  const data = useData();
  const run = data.activeRun;
  const active = !!run;

  // Focus mode: while a session exists, the rest of the planner recedes (dimmed,
  // still fully usable; hover/focus brings it back). Presentation only.
  useEffect(() => {
    if (!active) return;
    document.documentElement.setAttribute("data-focus-mode", "");
    return () => document.documentElement.removeAttribute("data-focus-mode");
  }, [active]);

  return (
    <div>
      <div className="recede">
        <PageHeader title="Focus" subtitle="Timing comes from saved timestamps — refreshing or closing the tab won't lose your place." />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="flex flex-col gap-6">
          {/* popLayout: the new panel (with Emergency stop) mounts at once; the old one exits on top. */}
          <AnimatePresence mode="popLayout" initial={false}>
            {run ? (
              <motion.div key="run" initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0, transition: motionT.ritual }} exit={{ opacity: 0, scale: 0.98, transition: motionT.micro }}>
                <ActiveRun run={run} />
              </motion.div>
            ) : (
              <motion.div key="start" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: motionT.panel }} exit={{ opacity: 0, scale: 0.98, transition: motionT.micro }}>
                <StartPanel />
              </motion.div>
            )}
          </AnimatePresence>
          <div className="recede">
            <History />
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <IntegrationsCard />
          <div className="recede">
            <Presets />
          </div>
        </div>
      </div>
    </div>
  );
}

function StartPanel() {
  const data = useData();
  const params = useSearchParams();
  const initialTask = params.get("task") ?? "";
  const presets = data.focusPresets;
  const [presetId, setPresetId] = useState(data.settings.focus.defaultPresetId ?? presets[0]?.id ?? "");
  const preset = presets.find((p) => p.id === presetId) ?? presets[0];
  const [taskId, setTaskId] = useState(data.tasks.some((t) => t.id === initialTask) ? initialTask : "");
  const [blocklistId, setBlocklistId] = useState(preset?.blocklistId ?? "");
  const conn = useExtensionConnection();
  const openTasks = sortTasks(data.tasks.filter((t) => t.status !== "done"));
  const list = data.blocklists.find((b) => b.id === blocklistId);

  const start = () => {
    if (!preset) return;
    const task = data.tasks.find((t) => t.id === taskId);
    const run = startFocus({ preset, taskId: taskId || null, projectId: task?.projectId ?? null, blocklistId: blocklistId || null });
    syncCompanion(run);
    // Crossing the threshold: a soft lavender bloom (visual only; the session has already started).
    fxThreshold(["#efe3cc", "#fde2c4"]);
  };

  if (!preset) {
    return (
      <Card>
        <EmptyState title="No focus presets">Create a preset on the right to start a session.</EmptyState>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-5">
      <div>
        <SectionTitle>Start a session</SectionTitle>
        <div role="radiogroup" aria-label="Preset" className="grid gap-2 sm:grid-cols-3">
          {presets.map((p) => {
            const active = p.id === preset.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setPresetId(p.id);
                  setBlocklistId(p.blocklistId ?? "");
                }}
                className={cx("rounded-xl border px-3.5 py-3 text-left transition-colors", active ? "border-amber/50 bg-amber/[0.07]" : "border-line hover:border-line-strong hover:bg-raised")}
              >
                <span className="block text-sm font-medium">{p.name}</span>
                <span className="text-xs text-ink-3 tabular">
                  {p.focusMinutes} min focus · {p.breakMinutes ? `${p.breakMinutes} min break` : "no break"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Working on (optional)">
          {(id) => (
            <Select id={id} value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">No specific task</option>
              {openTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label="Block websites"
          hint={
            !blocklistId
              ? "No website blocking for this session."
              : conn.kind === "connected" && conn.status.enabled
                ? `The extension will block ${list?.domains.length ?? 0} site${list?.domains.length === 1 ? "" : "s"}.`
                : "The browser extension isn't connected — sites will NOT be blocked."
          }
        >
          {(id, d) => (
            <Select id={id} aria-describedby={d} value={blocklistId} onChange={(e) => setBlocklistId(e.target.value)}>
              <option value="">None</option>
              {data.blocklists.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.domains.length})
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" onClick={start} className="bg-sticky-yellow text-ink shadow-[3px_3px_0_0_#1d1a16] hover:shadow-[5px_5px_0_0_#1d1a16]">
          <Play size={16} aria-hidden /> Start {preset.focusMinutes}-minute focus
        </Button>
        {!data.blocklists.length ? (
          <Link href="/settings#blocklists" className="text-[13px] text-ink-3 hover:text-ink">
            Create a blocklist →
          </Link>
        ) : null}
      </div>
    </Card>
  );
}

function ActiveRun({ run }: { run: FocusRun }) {
  const data = useData();
  const now = useNow(500);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const phase = PHASE[run.phase];
  const remaining = remainingMs(run, now);
  const elapsed = activeElapsedMs(run, now);
  const ratio = run.phase === "ready" ? 1 : run.phasePlannedMs ? elapsed / run.phasePlannedMs : 0;
  const paused = run.runningSince === null && run.phase !== "ready";
  const task = run.taskId ? data.tasks.find((t) => t.id === run.taskId) : null;
  const list = run.blocklistId ? data.blocklists.find((b) => b.id === run.blocklistId) : null;

  const running = run.runningSince !== null && run.phase !== "ready";

  return (
    <Card className="relative overflow-hidden">
      {/* Ambient cue: a soft phase-colored glow that breathes slowly only while the clock runs.
          Opacity-only CSS animation; independent of timer math; off under reduced motion. */}
      <div
        aria-hidden
        className={cx("pointer-events-none absolute -top-28 left-1/2 size-[440px] -translate-x-1/2 rounded-full transition-[opacity] duration-700", running && "ambient-breathe", paused && "opacity-40")}
        style={{ background: `radial-gradient(circle, ${phase.glow}, transparent 68%)` }}
      />
      <div className="relative flex flex-col items-center gap-6 py-4">
        <div className="text-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={`${run.phase}-${paused}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={motionT.ui}
              className={cx("text-sm font-medium", phase.text)}
            >
              {phase.label}
              {paused ? " · paused" : ""}
              {run.phase !== "ready" ? ` · round ${run.cycle}` : ""}
            </motion.p>
          </AnimatePresence>
          <p className="mt-1 text-[13px] text-ink-3">
            {run.presetName}
            {task ? ` · ${task.title}` : ""}
          </p>
        </div>

        {/* Linear timing: the ring flows with the clock instead of stepping each tick. */}
        <div className={cx("relative grid place-items-center transition-[filter] duration-700", paused && "saturate-[0.35]")}>
        {/* Orbiting markers: an outer dotted orbit turns slowly while the clock runs (independent of timer math). */}
        <svg aria-hidden viewBox="0 0 320 320" className={cx("pointer-events-none absolute size-[300px] text-violet/40", running && "spin-slow")}>
          <circle cx="160" cy="160" r="152" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 12" strokeLinecap="round" />
          <circle cx="160" cy="8" r="5" fill={phase.color} />
          <circle cx="12" cy="160" r="3.5" fill={phase.gradient[1]} />
        </svg>
        <ProgressRing value={ratio} size={264} stroke={12} gradient={phase.gradient} timing="linear" head={running} label={`${phase.label}: ${formatCountdown(remaining)} remaining`}>
          <div className="text-center">
            <div className={cx("font-mono text-[54px] leading-none font-medium tracking-tight tabular transition-opacity duration-300", paused && "opacity-60")} aria-hidden>
              {run.phase === "ready" ? "—" : formatCountdown(remaining)}
            </div>
            <div className="mt-2 text-xs text-ink-3">
              {run.phase === "ready" ? "Break finished" : run.runningSince !== null ? `ends ${formatTime(now + remaining, data.settings.timeZone)}` : "timer paused"}
            </div>
          </div>
        </ProgressRing>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {/* One button element (keeps keyboard focus across pause/resume); only its label crossfades.
              The state change itself is immediate. */}
          {(() => {
            const primary =
              run.phase === "ready"
                ? { key: "next", variant: "primary" as const, onClick: after(nextFocus), className: "bg-sticky-yellow text-ink shadow-[3px_3px_0_0_#1d1a16] hover:shadow-[5px_5px_0_0_#1d1a16]", icon: <Play size={16} aria-hidden />, label: "Start next focus" }
                : paused
                  ? { key: "resume", variant: "primary" as const, onClick: after(resumeFocus), className: "", icon: <Play size={16} aria-hidden />, label: run.phase === "break" && elapsed === 0 ? "Start break" : "Resume" }
                  : { key: "pause", variant: "secondary" as const, onClick: after(pauseFocus), className: "", icon: <Pause size={16} aria-hidden />, label: "Pause" };
            return (
              <Button variant={primary.variant} size="lg" onClick={primary.onClick} className={primary.className}>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span key={primary.key} className="inline-flex items-center gap-2" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={motionT.micro}>
                    {primary.icon} {primary.label}
                  </motion.span>
                </AnimatePresence>
              </Button>
            );
          })()}
          {run.phase !== "ready" ? (
            <Button size="lg" variant="ghost" onClick={after(skipFocusPhase)}>
              <SkipForward size={16} aria-hidden /> {run.phase === "focus" ? "Skip to break" : "Skip break"}
            </Button>
          ) : null}
          <Button
            size="lg"
            variant={confirmEnd ? "danger" : "ghost"}
            onBlur={() => setConfirmEnd(false)}
            onClick={() => {
              if (!confirmEnd && run.phase === "focus") return setConfirmEnd(true);
              after(() => endFocus("ended_early"))();
              toast("Session ended");
            }}
          >
            <Square size={15} aria-hidden /> {confirmEnd ? "End and save" : "End"}
          </Button>
        </div>

        <div className="w-full border-t border-line pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink-3">{list ? `Blocklist: ${list.name} (${list.domains.length} sites)` : "No website blocking this session."}</p>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                after(() => endFocus("interrupted"))();
                toast("Emergency stop: session ended and blocking released");
              }}
            >
              <OctagonX size={14} aria-hidden /> Emergency stop
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function IntegrationsCard() {
  const data = useData();
  const conn = useExtensionConnection();
  const lastSend = useCompanionLastSend();
  const tz = data.settings.timeZone;
  const now = useNow(30_000);

  const ext = (() => {
    switch (conn.kind) {
      case "not_configured":
        return { tone: "neutral" as const, label: "Not set up", body: "Websites are not blocked. Pair the LifeOS extension in Settings." };
      case "checking":
        return { tone: "neutral" as const, label: "Checking…", body: "" };
      case "not_detected":
        return { tone: "rose" as const, label: "Disconnected", body: `${conn.detail} Websites are not being blocked.` };
      case "pairing_lost":
        return { tone: "rose" as const, label: "Pairing lost", body: "The extension no longer recognizes this LifeOS. Pair again in Settings." };
      case "error":
        return { tone: "rose" as const, label: "Error", body: conn.detail };
      case "connected": {
        const s = conn.status;
        if (!s.enabled) return { tone: "amber" as const, label: "Turned off", body: "Blocking is switched off in the extension." };
        if (s.userPausedUntil && s.userPausedUntil > now) return { tone: "amber" as const, label: "Paused", body: `Paused from the extension until ${formatTime(s.userPausedUntil, tz)}.` };
        return s.active
          ? { tone: "sage" as const, label: "Blocking", body: `Blocking ${s.ruleDomains} site${s.ruleDomains === 1 ? "" : "s"} until ${s.until ? formatTime(s.until, tz) : "the session ends"} (reported by the extension).` }
          : { tone: "sage" as const, label: "Connected", body: "Ready. No sites are blocked right now." };
      }
    }
  })();

  return (
    <Card aria-labelledby="integrations-title">
      <SectionTitle id="integrations-title" action={<Link href="/settings#integrations" className="text-[13px] text-ink-3 hover:text-ink">Manage →</Link>}>
        Device integrations
      </SectionTitle>
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <Globe size={18} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium">
              Browser extension <Badge tone={ext.tone}>{ext.label}</Badge>
            </div>
            {ext.body ? <p className="mt-0.5 text-xs text-ink-3">{ext.body}</p> : null}
          </div>
        </div>
        <div className="flex gap-3">
          <Monitor size={18} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium">
              Windows companion{" "}
              <Badge tone={data.settings.companion?.enabled ? "sky" : "neutral"}>{data.settings.companion ? (data.settings.companion.enabled ? "Paired" : "Off") : "Not set up"}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-ink-3">
              {data.settings.companion?.enabled
                ? lastSend
                  ? `Last sent “${lastSend.action}” at ${formatTime(lastSend.sentAt, tz)}. LifeOS can't confirm delivery — check the companion's tray icon.`
                  : "Commands are sent as signed links when you start, resume, skip or end. Delivery can't be confirmed from the browser."
                : "Apps are not being watched. Pair the companion in Settings."}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

const OUTCOME = {
  completed: { label: "Completed", tone: "sage" },
  ended_early: { label: "Ended early", tone: "amber" },
  interrupted: { label: "Interrupted", tone: "rose" },
} as const;

function History() {
  const data = useData();
  const { today, tz } = useToday();
  const sessions = useMemo(() => [...data.focusSessions].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)), [data.focusSessions]);
  const todayMs = sessions.filter((s) => dateInTz(s.startedAt, tz) === today).reduce((n, s) => n + s.activeMs, 0);
  const shown = sessions.slice(0, 12);

  return (
    <Card aria-labelledby="history-title">
      <SectionTitle id="history-title" hint="Active focus time only — pauses and breaks are never counted. Sessions under a minute aren't saved.">
        Session history
      </SectionTitle>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-line px-3 py-2.5">
          <div className="text-xs text-ink-3">Today</div>
          <div className="text-lg font-semibold tabular">{formatDuration(todayMs)}</div>
        </div>
        <div className="rounded-xl border border-line px-3 py-2.5">
          <div className="text-xs text-ink-3">All saved sessions</div>
          <div className="text-lg font-semibold tabular">{sessions.length}</div>
        </div>
      </div>
      {shown.length ? (
        <ul className="flex flex-col divide-y divide-line">
          {shown.map((s) => {
            const task = s.taskId ? data.tasks.find((t) => t.id === s.taskId) : null;
            const o = OUTCOME[s.outcome];
            return (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{task?.title ?? s.presetName}</div>
                  <div className="text-xs text-ink-3">
                    {formatDateTime(s.startedAt, tz)} – {formatTime(s.endedAt, tz)}
                    {s.pausedMs >= 60_000 ? ` · paused ${formatDuration(s.pausedMs)}` : ""}
                  </div>
                </div>
                <span className="text-sm font-medium tabular">{formatDuration(s.activeMs)}</span>
                <Badge tone={o.tone}>{o.label}</Badge>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="No sessions yet">Completed, ended and interrupted sessions appear here with their real times.</EmptyState>
      )}
    </Card>
  );
}

function Presets() {
  const data = useData();
  const [editing, setEditing] = useState<FocusPreset | null>(null);
  return (
    <Card aria-labelledby="presets-title">
      <SectionTitle
        id="presets-title"
        action={
          <Button size="sm" variant="ghost" onClick={() => setEditing({ id: newId(), name: "", focusMinutes: 30, breakMinutes: 5, blocklistId: null })}>
            <Plus size={14} aria-hidden /> Preset
          </Button>
        }
      >
        Presets
      </SectionTitle>
      <ul className="flex flex-col gap-1">
        {data.focusPresets.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-ink/[0.03]">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm">
                {p.name}
                {data.settings.focus.defaultPresetId === p.id ? <Badge>Default</Badge> : null}
              </div>
              <div className="text-xs text-ink-3 tabular">
                {p.focusMinutes}/{p.breakMinutes} min{p.blocklistId ? ` · ${data.blocklists.find((b) => b.id === p.blocklistId)?.name ?? "blocklist"}` : ""}
              </div>
            </div>
            <IconButton label={`Edit ${p.name}`} onClick={() => setEditing(p)}>
              <PencilLine size={15} />
            </IconButton>
          </li>
        ))}
      </ul>
      {editing ? <PresetEditor key={editing.id} preset={editing} isNew={!data.focusPresets.some((p) => p.id === editing.id)} onClose={() => setEditing(null)} /> : null}
    </Card>
  );
}

function PresetEditor({ preset, isNew, onClose }: { preset: FocusPreset; isNew: boolean; onClose: () => void }) {
  const data = useData();
  const [form, setForm] = useState({ name: preset.name, focusMinutes: String(preset.focusMinutes), breakMinutes: String(preset.breakMinutes), blocklistId: preset.blocklistId ?? "" });
  const [isDefault, setIsDefault] = useState(data.settings.focus.defaultPresetId === preset.id);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const r = savePreset({ id: preset.id, name: form.name, focusMinutes: Number(form.focusMinutes), breakMinutes: Number(form.breakMinutes), blocklistId: form.blocklistId || null });
    if (!r.ok) return setErrors(r.errors);
    if (isDefault) updateSettings({ focus: { ...data.settings.focus, defaultPresetId: preset.id } });
    onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={isNew ? "New preset" : "Edit preset"}
      footer={
        <>
          {!isNew && data.focusPresets.length > 1 ? (
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() => {
                deletePreset(preset.id);
                onClose();
              }}
            >
              Delete
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="preset-form">
            Save
          </Button>
        </>
      }
    >
      <form id="preset-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={errors.name} className="sm:col-span-2">
          {(id, d) => <Input id={id} aria-describedby={d} autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} />}
        </Field>
        <Field label="Focus (minutes)" error={errors.focusMinutes}>
          {(id, d) => <Input id={id} aria-describedby={d} type="number" min={1} max={240} value={form.focusMinutes} onChange={(e) => setForm({ ...form, focusMinutes: e.target.value })} />}
        </Field>
        <Field label="Break (minutes)" error={errors.breakMinutes}>
          {(id, d) => <Input id={id} aria-describedby={d} type="number" min={0} max={120} value={form.breakMinutes} onChange={(e) => setForm({ ...form, breakMinutes: e.target.value })} />}
        </Field>
        <Field label="Default blocklist" className="sm:col-span-2">
          {(id) => (
            <Select id={id} value={form.blocklistId} onChange={(e) => setForm({ ...form, blocklistId: e.target.value })}>
              <option value="">None</option>
              {data.blocklists.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <label className="inline-flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="accent-[var(--color-sage)]" /> Use as default preset
        </label>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
