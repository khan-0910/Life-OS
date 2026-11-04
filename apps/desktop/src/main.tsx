import { StrictMode, useCallback, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { api, errorText, onEvent, type StateView } from "./ipc";
import "./styles.css";

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function App() {
  const [state, setState] = useState<StateView | null>(null);
  const [error, setError] = useState<string>();
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(() => api.getState().then(setState, (e) => setError(errorText(e))), []);
  useEffect(() => {
    refresh();
    const un = onEvent("state-changed", refresh);
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      void un.then((f) => f());
      clearInterval(t);
    };
  }, [refresh]);

  const run = (p: Promise<StateView>) =>
    p.then(
      (s) => {
        setState(s);
        setError(undefined);
      },
      (e) => setError(errorText(e)),
    );

  if (!state) return <main className="wrap">{error ? <p role="alert" className="error">{error}</p> : <p className="muted">Loading…</p>}</main>;
  const active = state.guardUntil !== null && state.guardUntil > now;

  return (
    <main className="wrap">
      <header className="head">
        <div>
          <h1>LifeOS Companion</h1>
          <p className="muted">A visible focus reminder for Windows. Runs in the tray; quit any time from the tray menu.</p>
        </div>
      </header>

      {!state.supported ? (
        <p role="alert" className="warn">App detection only works on Windows. On this system the companion can't see the foreground app.</p>
      ) : null}

      <section className={`card status ${active ? "on" : ""}`} aria-live="polite">
        <div>
          <p className="label">Focus guard</p>
          <p className="big">{active ? `On until ${time(state.guardUntil!)}` : "Off"}</p>
          <p className="muted small">{active ? (state.source === "lifeOs" ? "Started by LifeOS." : "Started here.") : "Start it here, or from a LifeOS focus session."}</p>
        </div>
        {active ? (
          <button className="danger big-btn" onClick={() => run(api.stopGuard())}>
            Stop focus guard now
          </button>
        ) : (
          <div className="row">
            <button onClick={() => run(api.startGuard(25))}>Guard 25 min</button>
            <button onClick={() => run(api.startGuard(50))}>Guard 50 min</button>
          </div>
        )}
      </section>

      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
      {state.lastLink ? <p className={`small ${state.lastLink.ok ? "muted" : "warn-text"}`}>{`${time(state.lastLink.at)} — ${state.lastLink.detail}`}</p> : null}

      <Apps state={state} run={run} />
      <Pairing />
      <WebUrl state={state} run={run} />

      <section className="card">
        <h2>What this app does — and doesn't</h2>
        <ul className="small muted list">
          <li>Only while the focus guard is on, it checks which app is in front once a second and compares its file name to your list.</li>
          <li>If it matches, it shows a reminder window. It never force-quits anything. Closing an app is opt-in per app and asks the app to close normally.</li>
          <li>Windows, security, accessibility and terminal tools can never be listed.</li>
          <li>Nothing leaves this computer: no app names, window titles or activity are uploaded.</li>
          <li>It's best-effort, not a lock. You can quit it, uninstall it or ignore it at any time.</li>
        </ul>
      </section>
    </main>
  );
}

function Apps({ state, run }: { state: StateView; run: (p: Promise<StateView>) => void }) {
  const [label, setLabel] = useState("");
  const [exe, setExe] = useState("");
  const [allowClose, setAllowClose] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(api.addRule(label, exe, allowClose));
    setLabel("");
    setExe("");
    setAllowClose(false);
  };
  return (
    <section className="card">
      <h2>Apps to interrupt</h2>
      {state.rules.length ? (
        <ul className="rules">
          {state.rules.map((r) => (
            <li key={r.id}>
              <div>
                <strong>{r.label}</strong>
                <span className="mono small muted"> {r.exe}</span>
              </div>
              <label className="check small">
                <input type="checkbox" checked={r.allowClose} onChange={(e) => run(api.setRuleClose(r.id, e.target.checked))} /> Offer “close app”
              </label>
              <button className="ghost" onClick={() => run(api.removeRule(r.id))} aria-label={`Remove ${r.label}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">No apps yet. Add the programs that pull you away, like discord.exe or steam.exe.</p>
      )}
      <form onSubmit={submit} className="add">
        <label>
          <span className="label">Name</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Discord" maxLength={60} />
        </label>
        <label>
          <span className="label">Program file (.exe)</span>
          <input value={exe} onChange={(e) => setExe(e.target.value)} placeholder="discord.exe" required spellCheck={false} />
        </label>
        <label className="check small">
          <input type="checkbox" checked={allowClose} onChange={(e) => setAllowClose(e.target.checked)} /> Let the reminder offer to close it (normal close only)
        </label>
        <button type="submit" className="primary">
          Add app
        </button>
      </form>
      <p className="muted small">Tip: find the file name in Task Manager → Details.</p>
    </section>
  );
}

function Pairing() {
  const [secret, setSecret] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  return (
    <section className="card">
      <h2>Pair with LifeOS</h2>
      <p className="muted small">
        In LifeOS → Settings → Windows companion, paste this secret. LifeOS uses it to sign the links it opens, so other websites can't control this app. Links are one-time and expire after 2 minutes.
      </p>
      {secret ? (
        <code className="secret" aria-label="Pairing secret">
          {secret}
        </code>
      ) : null}
      <div className="row">
        <button onClick={() => (secret ? setSecret(null) : api.getPairingSecret().then(setSecret))}>{secret ? "Hide secret" : "Show secret"}</button>
        {secret ? <button onClick={() => navigator.clipboard.writeText(secret)}>Copy</button> : null}
        <button
          className={confirm ? "danger" : "ghost"}
          onClick={() => {
            if (!confirm) return setConfirm(true);
            setConfirm(false);
            void api.resetPairing().then(setSecret);
          }}
        >
          {confirm ? "Confirm: new secret, unpair LifeOS" : "Reset pairing"}
        </button>
      </div>
    </section>
  );
}

function WebUrl({ state, run }: { state: StateView; run: (p: Promise<StateView>) => void }) {
  const [url, setUrl] = useState(state.webUrl);
  return (
    <section className="card">
      <h2>LifeOS address</h2>
      <p className="muted small">“Back to LifeOS” on the reminder opens this page in your browser.</p>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          run(api.setWebUrl(url));
        }}
      >
        <input value={url} onChange={(e) => setUrl(e.target.value)} aria-label="LifeOS address" className="grow" spellCheck={false} />
        <button type="submit">Save</button>
      </form>
    </section>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
