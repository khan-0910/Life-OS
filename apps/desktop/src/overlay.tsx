import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api, errorText, onEvent, type Interruption, type OverlayAction } from "./ipc";
import "./styles.css";

function Overlay() {
  const [info, setInfo] = useState<Interruption | null>(null);
  const [error, setError] = useState<string>();
  const refresh = useCallback(() => api.getInterruption().then(setInfo, () => setInfo(null)), []);

  useEffect(() => {
    refresh();
    const un = onEvent("interruption", refresh);
    return () => void un.then((f) => f());
  }, [refresh]);

  const act = (a: OverlayAction) => api.overlayAction(a).then(() => setError(undefined), (e) => setError(errorText(e)));

  return (
    <main className="overlay" role="alertdialog" aria-labelledby="ov-title" aria-describedby="ov-body">
      <p className="eyebrow">LifeOS focus session</p>
      <h1 id="ov-title">{info ? `${info.label} is on your focus list` : "Focus session in progress"}</h1>
      <p id="ov-body" className="muted">You asked to be reminded when this app comes up during focus. It's still open — this is a reminder, not a lock.</p>
      <div className="col">
        <button className="primary" autoFocus onClick={() => act("back")}>
          Back to LifeOS
        </button>
        <div className="row">
          <button onClick={() => act("snooze")}>Allow for 5 minutes</button>
          {info?.allowClose ? <button onClick={() => act("close_app")}>Close {info.label}</button> : null}
        </div>
        <button className="danger" onClick={() => act("stop_guard")}>
          Stop focus guard
        </button>
      </div>
      {error ? (
        <p role="alert" className="error small">
          {error}
        </p>
      ) : null}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Overlay />
  </StrictMode>,
);
