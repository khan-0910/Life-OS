/// <reference types="chrome" />
import type { ExtStatus } from "@lifeos/domain";
import type { PopupRequest } from "./background";
import { originsFor } from "./rules";

interface View {
  status: ExtStatus;
  origin: string | null;
  domains: string[];
  id: string;
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const send = <T>(msg: PopupRequest) => chrome.runtime.sendMessage(msg) as Promise<T>;
const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function el(tag: string, text?: string, cls?: string): HTMLElement {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

function button(label: string, onClick: () => void, cls = ""): HTMLButtonElement {
  const b = el("button", label, cls) as HTMLButtonElement;
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

async function render(view?: View) {
  const v = view ?? (await send<View>({ type: "popup:status" }));
  const root = $("#app");
  root.replaceChildren();
  const s = v.status;

  if (!s.paired) {
    root.append(el("p", "Not paired. Websites are not being blocked.", "muted"));
    root.append(
      button("Pair with LifeOS", async () => {
        const r = await send<{ code: { code: string; expiresAt: number }; id: string }>({ type: "popup:createCode" });
        root.replaceChildren(
          el("p", "In LifeOS → Settings → Browser extension, enter:", "muted"),
          el("div", "Extension ID", "label"),
          el("code", r.id, "mono"),
          el("div", "Pairing code", "label"),
          el("code", r.code.code, "code"),
          el("p", `Expires at ${time(r.code.expiresAt)}. Single use.`, "muted small"),
          button("Done", () => void render(), "ghost"),
        );
      }, "primary"),
    );
    return;
  }

  const head = el("p", "", "status");
  const paused = s.userPausedUntil !== null;
  head.textContent = !s.enabled
    ? "Turned off — nothing is blocked."
    : paused
      ? `Paused by you until ${time(s.userPausedUntil!)}.`
      : s.active
        ? `Blocking ${s.ruleDomains} site${s.ruleDomains === 1 ? "" : "s"} until ${time(s.until!)}.`
        : "Connected. Nothing is blocked right now.";
  head.dataset.state = !s.enabled || paused ? "warn" : s.active ? "on" : "idle";
  root.append(head, el("p", `Paired with ${v.origin}`, "muted small"));

  const row = el("div", undefined, "row");
  if (s.enabled) {
    row.append(paused ? button("Resume blocking", async () => render(await send({ type: "popup:resume" }))) : button("Pause 15 min", async () => render(await send({ type: "popup:pause", minutes: 15 }))));
  }
  row.append(button(s.enabled ? "Turn off" : "Turn on", async () => render(await send({ type: "popup:enabled", enabled: !s.enabled }))));
  root.append(row);

  const mode = el("label", undefined, "check");
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = s.mode === "redirect";
  box.addEventListener("change", async () => {
    if (box.checked && v.domains.length) {
      // Narrow, per-domain permission, requested only with a user click.
      const granted = await chrome.permissions.request({ origins: originsFor(v.domains) });
      if (!granted) {
        box.checked = false;
        return;
      }
    }
    render(await send({ type: "popup:mode", mode: box.checked ? "redirect" : "block" }));
  });
  mode.append(box, document.createTextNode(" Show a LifeOS page instead of the browser's error page"));
  root.append(mode, el("p", "Needs access to each blocked site (asked per site). Without it, sites are simply blocked.", "muted small"));

  root.append(
    button(
      "Unpair",
      async () => {
        if (confirm("Unpair from LifeOS? Blocking stops and LifeOS must be paired again.")) render(await send({ type: "popup:unpair" }));
      },
      "danger",
    ),
  );
}

void render();
