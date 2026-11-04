# Privacy and data

Tasks, routines, goals, reviews and focus history are treated as sensitive personal data.

## Where data lives today

| Data | Where | Leaves the device? |
| --- | --- | --- |
| Planner data (tasks, blocks, habits, goals, projects, reviews, presets, sessions, blocklists, settings) | This browser's `localStorage` (`lifeos:data`) | No |
| Extension pairing secret | LifeOS local data (plain) and the extension (SHA-256 hash only) | No |
| Extension state | `chrome.storage.local`: pairing hash and origin, current block domains and end time, pause/off/mode. Pairing codes in session memory | No |
| Companion settings | `config.json` in the app config folder: app list, pairing secret, LifeOS address | No |
| Companion detections | Memory only, while the guard is on | No |

There is no sign-in, no server storage, no analytics, no third-party fonts or scripts, and no logging of notes or secrets. Daily review notes are private and never sent anywhere.

## What the integrations can see

- **Extension:** only the list of domains to block and an end time. It cannot read pages, requests, cookies or history.
- **Companion:** only the executable file name/path of the foreground window, only while the guard is on, compared locally against your list. Never window titles, contents, keystrokes or screenshots.

## Your controls

- **Export:** Settings → Your data → Export everything (JSON).
- **Import:** replaces local data after confirmation.
- **Delete:** Settings → Your data → type DELETE. Unpair integrations first so they forget this browser.
- **Revoke integrations:** Disconnect in Settings, Unpair in the extension popup, Reset pairing in the companion. Removing the extension or uninstalling the companion deletes their data.

## When cloud sync arrives

Synced: the planner records listed above, under Row Level Security so only the owner can read or write them. Devices get a separate, hashed, revocable token that can read only "block now? until when? which domains?". Server logs must not include request bodies. Account deletion will remove all rows (cascade from the auth user).
