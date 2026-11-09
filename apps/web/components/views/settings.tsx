"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { Download, Globe, Monitor, ShieldCheck, Trash2, Upload } from "lucide-react";
import { isCompanionSecret, parseDomainList, systemTimeZone, type Blocklist } from "@lifeos/domain";
import { deleteBlocklist, saveBlocklist, updateSettings } from "@/lib/actions";
import { formatDateTime, formatTime } from "@/lib/format";
import { EXTENSION_ID_RE, describeExtError, extensionConnection, notifyCompanion, sendToExtension, useExtensionConnection } from "@/lib/integrations";
import { hasSampleData, removeSampleData } from "@/lib/seed";
import { emptyData, migrate, replaceAll, useData, type LifeData } from "@/lib/store";
import { toast } from "../toast";
import { Badge, Button, Card, Field, Input, PageHeader, Segmented, Select, Switch, Textarea } from "../ui";
import HoldButton from "@/components/bits/HoldButton";

function Section({ id, title, description, children }: { id: string; title: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20">
      <Card className="grid gap-6 md:grid-cols-[240px_1fr]">
        <div>
          <h2 id={`${id}-title`} className="font-[family-name:var(--font-display)] text-[19px] font-bold tracking-[-0.01em]">
            {title}
          </h2>
          {description ? <div className="mt-1 text-[13px] text-ink-3">{description}</div> : null}
        </div>
        <div className="flex min-w-0 flex-col gap-5">{children}</div>
      </Card>
    </section>
  );
}

export function SettingsView() {
  return (
    <div>
      <PageHeader title="Settings" subtitle="Everything here is stored in this browser (Local mode)." />
      <div className="flex flex-col gap-5">
        <ProfileSection />
        <FocusSection />
        <BlocklistsSection />
        <ExtensionSection />
        <CompanionSection />
        <DataSection />
      </div>
    </div>
  );
}

function ProfileSection() {
  const data = useData();
  const s = data.settings;
  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [s.timeZone];
    }
  }, [s.timeZone]);
  const sys = systemTimeZone();
  return (
    <Section id="profile" title="Profile & time" description="Your time zone decides what “today” means for tasks, habits, streaks and insights.">
      <Field label="Display name (optional)">
        {(id) => <Input id={id} value={s.displayName} maxLength={40} onChange={(e) => updateSettings({ displayName: e.target.value.slice(0, 40) })} />}
      </Field>
      <Field
        label="Time zone"
        hint={
          <>
            Timed blocks keep their exact moment; all-day dates stay on the same calendar date.
            {sys !== s.timeZone ? (
              <>
                {" "}
                This device is in {sys}.{" "}
                <button type="button" className="text-sage hover:underline" onClick={() => updateSettings({ timeZone: sys })}>
                  Use it
                </button>
              </>
            ) : null}
          </>
        }
      >
        {(id, d) => (
          <Select id={id} aria-describedby={d} value={s.timeZone} onChange={(e) => updateSettings({ timeZone: e.target.value })}>
            {(zones.includes(s.timeZone) ? zones : [s.timeZone, ...zones]).map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ink-2">Week starts on</span>
        <Segmented<"1" | "0">
          label="Week starts on"
          value={String(s.weekStartsOn) as "1" | "0"}
          onChange={(v) => updateSettings({ weekStartsOn: v === "0" ? 0 : 1 })}
          options={[
            { value: "1", label: "Monday" },
            { value: "0", label: "Sunday" },
          ]}
        />
      </div>
    </Section>
  );
}

function FocusSection() {
  const f = useData().settings.focus;
  return (
    <Section id="focus" title="Focus behavior" description="How sessions move between phases and what integrations do on breaks.">
      <Switch label="Start breaks automatically" description="When off, the break waits for you to start it." checked={f.autoStartBreak} onChange={(v) => updateSettings({ focus: { ...f, autoStartBreak: v } })} />
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ink-2">During breaks</span>
        <Segmented<"pause" | "keep">
          label="Blocking during breaks"
          value={f.breakBlocking}
          onChange={(v) => updateSettings({ focus: { ...f, breakBlocking: v } })}
          options={[
            { value: "pause", label: "Pause blocking" },
            { value: "keep", label: "Keep blocking" },
          ]}
        />
        <p className="text-xs text-ink-3">Blocking always stops when a session ends, on emergency stop, and on its own at the planned end time if LifeOS is closed.</p>
      </div>
    </Section>
  );
}

const SUGGESTED = ["youtube.com", "reddit.com", "x.com", "instagram.com", "facebook.com", "tiktok.com", "news.ycombinator.com", "netflix.com"];

function BlocklistsSection() {
  const data = useData();
  const [creating, setCreating] = useState(false);
  return (
    <Section id="blocklists" title="Website blocklists" description="Choose a list for a preset or session. Blocking a domain also blocks its subdomains. Only applied by the paired browser extension.">
      {data.blocklists.map((b) => (
        <BlocklistEditor key={b.id} list={b} />
      ))}
      {creating ? (
        <BlocklistEditor list={null} onDone={() => setCreating(false)} />
      ) : (
        <Button className="w-fit" onClick={() => setCreating(true)}>
          + New blocklist
        </Button>
      )}
    </Section>
  );
}

function BlocklistEditor({ list, onDone }: { list: Blocklist | null; onDone?: () => void }) {
  const [name, setName] = useState(list?.name ?? "Distractions");
  const [text, setText] = useState(list?.domains.join("\n") ?? "");
  const [armed, setArmed] = useState(false);
  const parsed = useMemo(() => parseDomainList(text), [text]);
  const dirty = !list || name !== list.name || parsed.domains.join() !== list.domains.join();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    saveBlocklist(list?.id ?? null, name, parsed.domains);
    setText(parsed.domains.join("\n"));
    toast(`Saved ${parsed.domains.length} domain${parsed.domains.length === 1 ? "" : "s"}`);
    onDone?.();
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-line p-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <Field label="List name">{(id) => <Input id={id} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />}</Field>
        <div className="flex items-end gap-2">
          {list ? (
            <Button variant={armed ? "danger" : "ghost"} onBlur={() => setArmed(false)} onClick={() => (armed ? deleteBlocklist(list.id) : setArmed(true))}>
              {armed ? "Confirm delete" : "Delete"}
            </Button>
          ) : (
            <Button variant="ghost" onClick={onDone}>
              Cancel
            </Button>
          )}
          <Button variant="primary" type="submit" disabled={!dirty}>
            Save
          </Button>
        </div>
      </div>
      <Field label="Domains" className="mt-4" hint="One per line (or separated by commas). URLs are fine — only the domain is kept." error={parsed.errors.length ? parsed.errors.map((e) => `“${e.input}”: ${e.error}`).join(" ") : undefined}>
        {(id, d) => <Textarea id={id} aria-describedby={d} rows={4} spellCheck={false} className="font-mono text-[13px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="youtube.com" />}
      </Field>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {SUGGESTED.filter((s) => !parsed.domains.includes(s)).map((s) => (
          <button key={s} type="button" onClick={() => setText((t) => `${t.trim()}\n${s}`.trim())} className="rounded-md border border-line px-2 py-0.5 text-xs text-ink-3 hover:border-line-strong hover:text-ink">
            + {s}
          </button>
        ))}
      </div>
    </form>
  );
}

function ExtensionSection() {
  const data = useData();
  const pairing = data.settings.extension;
  const conn = useExtensionConnection();
  const [extId, setExtId] = useState(pairing?.extensionId ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const pair = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    const id = extId.trim();
    if (!EXTENSION_ID_RE.test(id)) return setError("The extension ID is 32 lowercase letters (a–p). Copy it from the extension's popup.");
    setBusy(true);
    try {
      const resp = await sendToExtension(id, { type: "pair", code: code.trim().toUpperCase(), label: "LifeOS web" });
      if (resp.ok && resp.type === "paired") {
        updateSettings({ extension: { extensionId: id, secret: resp.secret, pairedAt: new Date().toISOString() } });
        extensionConnection.set({ kind: "connected", status: resp.status, checkedAt: Date.now() });
        setCode("");
        toast("Browser extension paired");
      } else if (!resp.ok) setError(describeExtError(resp.error));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the extension.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (pairing) {
      try {
        await sendToExtension(pairing.extensionId, { type: "unpair", secret: pairing.secret });
      } catch {
        toast("The extension wasn't reachable. Unpair it from its popup too.", { tone: "error" });
      }
    }
    updateSettings({ extension: null });
    toast("Extension disconnected");
  };

  const statusBadge =
    conn.kind === "connected" ? <Badge tone="sage">{conn.status.active ? "Blocking now" : "Connected"}</Badge> : pairing ? <Badge tone="rose">{conn.kind === "pairing_lost" ? "Pairing lost" : "Not reachable"}</Badge> : <Badge>Not paired</Badge>;

  return (
    <section id="integrations" className="scroll-mt-20">
      <Card className="grid gap-6 md:grid-cols-[240px_1fr]">
        <div>
          <h2 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-[19px] font-bold tracking-[-0.01em]">
            <Globe size={16} aria-hidden /> Browser extension
          </h2>
          <p className="mt-1 text-[13px] text-ink-3">Blocks the domains on your chosen list during focus. Chrome and Edge (Manifest V3).</p>
          <div className="mt-3">{statusBadge}</div>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {pairing ? (
            <>
              <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
                <div>
                  <dt className="text-ink-3">Extension ID</dt>
                  <dd className="font-mono text-xs break-all">{pairing.extensionId}</dd>
                </div>
                <div>
                  <dt className="text-ink-3">Paired</dt>
                  <dd>{formatDateTime(pairing.pairedAt, data.settings.timeZone)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-ink-3">Last report from the extension</dt>
                  <dd>
                    {conn.kind === "connected"
                      ? `${formatTime(conn.checkedAt, data.settings.timeZone)} — ${conn.status.enabled ? (conn.status.active ? `blocking ${conn.status.ruleDomains} sites` : "no rules active") : "turned off in the extension"}`
                      : conn.kind === "not_detected" || conn.kind === "error"
                        ? conn.detail
                        : conn.kind === "pairing_lost"
                          ? "The extension forgot this pairing (it was unpaired or reinstalled). Disconnect and pair again."
                          : "Waiting…"}
                  </dd>
                </div>
              </dl>
              <Button variant="danger" className="w-fit" onClick={disconnect}>
                Disconnect and revoke
              </Button>
            </>
          ) : (
            <form onSubmit={pair} className="flex flex-col gap-4">
              <ol className="list-decimal space-y-1 pl-5 text-[13px] text-ink-2">
                <li>Build and load the extension (see docs/INTEGRATIONS.md), then open its popup.</li>
                <li>Click “Pair with LifeOS”. Copy the extension ID and the one-time code shown.</li>
                <li>Paste both here. The code expires after 5 minutes.</li>
              </ol>
              <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                <Field label="Extension ID">{(id) => <Input id={id} value={extId} onChange={(e) => setExtId(e.target.value)} spellCheck={false} className="font-mono text-xs" autoComplete="off" />}</Field>
                <Field label="Pairing code">{(id) => <Input id={id} value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} className="font-mono uppercase" autoComplete="off" maxLength={12} />}</Field>
              </div>
              {error ? (
                <p role="alert" className="text-sm text-rose">
                  {error}
                </p>
              ) : null}
              <Button variant="primary" type="submit" className="w-fit" disabled={busy || !extId || !code}>
                {busy ? "Pairing…" : "Pair extension"}
              </Button>
            </form>
          )}
          <details className="rounded-xl border border-line px-4 py-3 text-[13px]">
            <summary className="flex cursor-pointer items-center gap-2 font-medium text-ink-2 select-none">
              <ShieldCheck size={14} aria-hidden /> Permissions and privacy
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-3">
              <li>
                <strong className="text-ink-2">declarativeNetRequest</strong>: lets the browser block listed domains itself. The extension never sees page contents or your history.
              </li>
              <li>
                <strong className="text-ink-2">storage, alarms</strong>: remembers the pairing (only a hash of the secret) and removes rules at the session&apos;s end time.
              </li>
              <li>Optional per-site access is requested only if you turn on “show a LifeOS page instead of an error”.</li>
              <li>Only this LifeOS address can message the extension, and only with the pairing secret. Unpair from either side at any time.</li>
            </ul>
          </details>
        </div>
      </Card>
    </section>
  );
}

function CompanionSection() {
  const data = useData();
  const pairing = data.settings.companion;
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string>();
  return (
    <Section
      id="companion"
      title="Windows companion"
      description={
        <>
          <span className="flex items-center gap-1.5">
            <Monitor size={14} aria-hidden /> Optional desktop app that notices listed apps during focus.
          </span>
          <span className="mt-2 block">Best-effort and transparent: it shows a reminder overlay. It cannot and does not lock you out.</span>
        </>
      }
    >
      {pairing ? (
        <>
          <Switch label="Send focus sessions to the companion" description="LifeOS opens a signed lifeos-companion:// link when you start, resume, skip or end. Your browser may ask to allow it." checked={pairing.enabled} onChange={(v) => updateSettings({ companion: { ...pairing, enabled: v } })} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => notifyCompanion(pairing, "stop", 0).then(() => toast("Sent a test “stop” link"))}>Send test link</Button>
            <Button variant="danger" onClick={() => updateSettings({ companion: null })}>
              Forget companion
            </Button>
          </div>
          <p className="text-xs text-ink-3">To fully revoke, also choose “Reset pairing” in the companion — that invalidates the old secret.</p>
        </>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!isCompanionSecret(secret)) return setError("Paste the 43-character pairing secret shown in the companion's Settings.");
            updateSettings({ companion: { secret: secret.trim(), pairedAt: new Date().toISOString(), enabled: true } });
            setSecret("");
            toast("Companion paired");
          }}
        >
          <Field label="Pairing secret from the companion" error={error} hint="Stored only in this browser. Used to sign links so other websites can't control the companion.">
            {(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="off" spellCheck={false} value={secret} onChange={(e) => setSecret(e.target.value)} className="font-mono text-xs" />}
          </Field>
          <Button variant="primary" type="submit" className="w-fit" disabled={!secret}>
            Pair companion
          </Button>
        </form>
      )}
    </Section>
  );
}

function DataSection() {
  const data = useData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<LifeData | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [importError, setImportError] = useState<string>();

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lifeos-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (file: File | undefined) => {
    setImportError(undefined);
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("That file is too large to be a LifeOS export.");
      setPendingImport(migrate(JSON.parse(await file.text())));
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "That file couldn't be read.");
    }
  };

  const counts = `${data.tasks.length} tasks · ${data.timeBlocks.length} blocks · ${data.habits.length} habits · ${data.goals.length} goals · ${data.projects.length} projects · ${data.focusSessions.length} focus sessions · ${data.reviews.length} reviews`;

  return (
    <Section
      id="data"
      title="Your data"
      description="Local mode: stored in this browser's storage on this device. Nothing is uploaded, and there are no analytics. Cloud sync is not available in this build."
    >
      <p className="text-[13px] text-ink-2">{counts}</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={exportData}>
          <Download size={15} aria-hidden /> Export everything (JSON)
        </Button>
        <Button onClick={() => fileRef.current?.click()}>
          <Upload size={15} aria-hidden /> Import…
        </Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        {hasSampleData(data) ? (
          <Button variant="ghost" onClick={() => (removeSampleData(), toast("Sample data removed"))}>
            Remove sample data
          </Button>
        ) : null}
      </div>
      {importError ? (
        <p role="alert" className="text-sm text-rose">
          {importError}
        </p>
      ) : null}
      {pendingImport ? (
        <div role="alert" className="rounded-xl border border-amber/30 bg-amber/5 p-4 text-sm">
          <p>
            Replace everything in this browser with the imported file ({pendingImport.tasks.length} tasks, {pendingImport.habits.length} habits)? Export first if you want a backup.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              variant="primary"
              onClick={() => {
                replaceAll(pendingImport);
                setPendingImport(null);
                toast("Data imported");
              }}
            >
              Replace with import
            </Button>
            <Button variant="ghost" onClick={() => setPendingImport(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      <div className="rounded-xl border border-rose/25 p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-rose">
          <Trash2 size={15} aria-hidden /> Delete all LifeOS data in this browser
        </p>
        <p className="mt-1 text-xs text-ink-3">Removes every task, habit, goal, session, review, blocklist and pairing. This can&apos;t be undone. Unpair integrations first so they forget this browser too.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input aria-label='Type "DELETE" to confirm' placeholder='Type "DELETE"' className="w-40" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          {/* React Bits HoldButton: after typing DELETE, press and hold (or hold Enter/Space) to erase. */}
          <HoldButton
            size="sm"
            holdTime={1600}
            backgroundColor="#a92f15"
            fillColor="#1d1a16"
            textColor="#ffffff"
            fillTextColor="#ffc83d"
            disabled={confirmText !== "DELETE"}
            doneLabel="Deleted"
            resetAfter={1800}
            onHold={() => {
              replaceAll(emptyData());
              setConfirmText("");
              toast("All data deleted");
            }}
          >
            Hold to delete everything
          </HoldButton>
        </div>
      </div>
    </Section>
  );
}
