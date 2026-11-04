# Device integrations

A normal web page cannot block other sites or watch other apps. LifeOS uses two separate, optional helpers, and the planner only reports what they tell it. It never claims something is blocked because a timer is running.

---

## Browser extension (Chrome and Edge, Manifest V3)

Code: `apps/extension`. Core logic: `src/controller.ts` (no `chrome.*` calls; unit tested). Wiring: `src/background.ts`.

### What it does

While LifeOS says a focus session wants blocking, the extension installs Declarative Net Request rules for the chosen domains (and their subdomains). The browser applies them itself; the extension never sees requests, page contents or history. By default blocked pages show the browser's own error page. Optionally, it can show a calm LifeOS page instead, which needs per-site access for each blocked domain.

### Permissions

| Permission | Why |
| --- | --- |
| `declarativeNetRequest` | Ask the browser to block listed domains |
| `storage` | Remember the pairing (hash only) and the current block window |
| `alarms` | Remove rules at the window's end even if LifeOS is closed |
| `optional_host_permissions: *://*/*` | Requested **per domain** only when the user turns on the LifeOS block page; never broad by default |
| `externally_connectable` | Only the LifeOS origin(s) from the build can message it |

No `tabs`, `history`, `cookies`, `webRequest`, `scripting` or content scripts.

### Pairing (local, no account needed)

1. The user opens the extension popup → **Pair with LifeOS**. The extension creates an 8-character one-time code (5 minutes, 5 attempts, stored in session memory) and shows its own extension ID.
2. The user pastes the ID and code into LifeOS → Settings. LifeOS calls `chrome.runtime.sendMessage(extensionId, {type: "pair", code})`.
3. The extension checks the sender origin (manifest `externally_connectable`, re-checked in code against the exact origin with port), checks the code in constant time, and replies with a new random 256-bit secret. It stores only `sha256(secret)` and the origin.
4. LifeOS keeps the secret in its local data and includes it in every later message.

### Messages (`packages/domain/src/protocol.ts`)

- `hello` → version and whether this origin is paired.
- `state {secret, state: {sessionId, blocking, domains, until}}` → applies rules; replies with the extension's real status.
- `status {secret}` → status only.
- `unpair {secret}` → forgets pairing and removes rules.

Domains are re-normalized in the extension; at most 200; `until` is capped at 4 hours ahead.

### Fail-open behavior

Rules always have an end time. LifeOS sends the expected end of blocking while running; while paused it sends a 15-minute lease and renews it every minute while the page is open. An alarm removes the rules at that time. If LifeOS is closed, the browser restarts, or the session ends, blocking stops on its own. Blocking can never get stuck on.

### User controls

Popup: pause 15 minutes, turn off, toggle the LifeOS block page, unpair. LifeOS: Emergency stop (ends the session and immediately sends "stop blocking"), Disconnect and revoke in Settings. Removing the extension removes everything.

### Threat model (summary)

| Threat | Mitigation |
| --- | --- |
| A random website tries to control blocking | `externally_connectable` limits senders to LifeOS origins; secret required |
| Another app on `localhost:3000` (shared dev port) | Needs the pairing secret, which only the paired LifeOS page holds |
| Secret leaks from extension storage | Only a hash is stored |
| Brute-forcing the pairing code | 5 attempts, 5-minute expiry, single use |
| Stuck blocking | Every rule set expires; at most 4 hours |

### Manual verification (Chrome or Edge on this PC)

1. `npm run dev`, build and load `apps/extension/dist` unpacked.
2. Pair via popup → Settings. Expect "Connected" in Settings and on the Focus page.
3. Create a blocklist with `example.com`; start a 1-minute preset with it. Visiting `https://example.com` and `https://www.example.com` should be blocked. The Focus page should say "Blocking 1 site until …".
4. Pause from the popup: the site loads; LifeOS shows "Paused".
5. Emergency stop in LifeOS: the site loads within a second.
6. Start again, close the LifeOS tab, wait past the end time: the site loads.
7. Turn on the LifeOS block page in the popup, grant the per-site prompt, start a session: the LifeOS page appears instead of the error.
8. Unpair in the popup: LifeOS shows "Pairing lost". Disconnect in LifeOS: the popup shows "Not paired".
9. Edge: repeat steps 1–3 in `edge://extensions`.

### Future: account-based pairing

When cloud sync exists, the extension will pair with the account instead of the open page: the signed-in user calls `create_pairing_code(kind)`, the extension calls `redeem_pairing_code(code, name)` (anon) and receives a device token stored hashed server-side, then polls `device_focus_state(token)`, which returns only `{blocking, until, domains}`. Tokens are device-scoped, expire after 90 days, and are revoked with `revoke_device(id)`. These functions exist in `supabase/migrations` and are tested; the extension client for them is not written yet. The Supabase service key never goes into the extension, and the user's own session is never shared with it.

---

## Windows companion (Tauri 2)

Code: `apps/desktop`. Rust core: `src-tauri/src` (`matcher.rs`, `guard.rs`, `deeplink.rs`, `monitor.rs`, `config.rs`, `lib.rs`).

### What it does

- Runs visibly with a tray icon ("idle" / "focus guard ON"). Closing the window keeps it in the tray; **Quit** in the tray exits. It can always be quit or uninstalled.
- While the focus guard is on (started in the companion or by a signed LifeOS link), it checks the foreground window's process file name once a second. Nothing is checked while the guard is off.
- If that file name is on the user's list, it shows an always-on-top reminder window with: **Back to LifeOS**, **Allow for 5 minutes**, **Stop focus guard**, and — only if the user turned it on for that app — **Close app**, which sends a normal close request (`WM_CLOSE`, like clicking X). The app may ask to save or refuse. Processes are never killed.
- The guard always has an end time (max 4 hours) and turns itself off.

### Never

Force-kill, block Windows/system/security/accessibility/terminal tools (hard-coded list plus anything under `%SystemRoot%`), hide itself, prevent exit or uninstall, inject into processes, install drivers, read window titles or contents, capture keystrokes or screenshots, or request elevation. It is **best-effort and can be bypassed**; it's a reminder, not enforcement.

### Pairing and links (no network port)

The companion generates a 32-byte secret (base64url) on first run. The user pastes it into LifeOS → Settings. When the user starts, resumes, skips or ends a session, LifeOS opens:

```
lifeos-companion://focus?action=start|stop&until=<ms>&iat=<ms>&nonce=<hex>&sig=<hex>
sig = HMAC-SHA256(secret, "lifeos-companion/v1\n{action}\n{until}\n{iat}\n{nonce}")
```

The companion checks the signature (constant time), rejects links older than 2 minutes, reused nonces, unknown parameters and `until` more than 4 hours ahead. Links can only start or stop the guard — they cannot change the app list or settings. **Reset pairing** in the companion invalidates the old secret. The TypeScript and Rust implementations share a test vector.

Limits, stated in the UI: LifeOS cannot confirm the companion received a link, and pausing in LifeOS doesn't extend the companion's end time (resuming sends a new link). The browser asks before opening the app.

### IPC and capabilities

Commands are declared in `build.rs` and granted per window: the settings window gets the settings commands; the overlay window gets only `get_interruption` and `overlay_action`. Every input is validated in Rust (minutes 1–240, `.exe` names, protected list, label length, https-or-localhost URL, max 100 apps). Both windows load bundled local files only, with a strict CSP; no remote content.

### Data

`config.json` in the app's config folder: the app list, pairing secret and LifeOS address. Detection results are kept in memory only. Nothing is uploaded.

### Manual verification (Windows 10/11 with Rust + MSVC installed)

1. `cd apps/desktop/src-tauri && cargo test` — matcher, guard, deep link (shared vector) and config tests pass.
2. `npm run tauri:dev -w @lifeos/desktop`. The tray icon appears; tooltip says idle.
3. Add an installed app outside `C:\Windows`, such as `spotify.exe` or `code.exe`. Adding `taskmgr.exe` is refused. (`notepad.exe` can be added but never triggers, because it runs from `C:\Windows`.)
4. **Guard 25 min**, switch to the listed app: the reminder appears within ~1 s. Test each button. "Close app" appears only when enabled for that app and closes it normally.
5. Tray → **Stop focus guard now**: the reminder disappears and checking stops.
6. Pair with LifeOS (Settings → Windows companion), start a focus session in the browser, allow the link prompt: the companion shows "On until …, started by LifeOS". End the session: it turns off.
7. Reset pairing; old links are rejected ("bad signature").
8. Build the installer with `npm run tauri:build -w @lifeos/desktop` and confirm install, scheme registration and uninstall.
