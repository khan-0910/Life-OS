# LifeOS

A bright, animated personal life planner: plan today and the week, manage tasks and time blocks, build habits, move goals and projects forward, run focus sessions, and review honest trends. Two optional device integrations help during focus: a browser extension that blocks chosen websites, and a Windows companion that notices chosen apps.

The web planner is the center. It runs in **Local mode**: all data stays in this browser. Cloud accounts and sync are designed (schema, RLS and device pairing are written and tested) but not wired into the web app yet.

## Status

| Area | State | Notes |
| --- | --- | --- |
| Landing page (`/`) | Done | Animated hero, interactive preview, scroll story, curtain transition into the planner |
| Pastel visual system + motion | Done | See `docs/MOTION.md`; full reduced-motion mode |
| Today dashboard | Done | Progress, priorities, due/planned tasks, schedule, habits, next action, explicit rollover, daily review |
| Plan (day / week / tasks) | Done | Time grid with drag to create/move/resize, keyboard moves, editor dialog; task search and filters |
| Habits | Done | Daily or weekday schedules, pause/resume, archive, history calendar with backfill, documented streaks |
| Goals and projects | Done | Progress computed only from linked tasks |
| Goal Studio (`/studio`) | Done | SMART, OKR, mandala chart, wheel of life and roadmap templates that create real goals, projects and tasks |
| Focus timer | Done | Timestamp-based, survives reload/suspension, pause accounting, presets, history, emergency stop |
| Insights | Done | 7/30-day windows with stated definitions, from real records only |
| Settings and data | Done | Time zone, week start, focus behavior, blocklists, pairing, JSON export/import, delete all |
| Browser extension (MV3) | Done, manual browser check pending | Pairing, DNR rules, expiry, pause/off, optional redirect page, unpair; unit tested |
| Windows companion (Tauri 2) | Written, **not compiled here** | No Rust toolchain on the build machine. UI builds and type-checks; Rust has unit tests that have not been run |
| Supabase schema + RLS | Done (tested in PGlite) | Migrations, owner policies, cross-user FK protection, device pairing RPCs |
| Cloud sync / sign-in in the web app | Not started | Next milestone; see `docs/ARCHITECTURE.md` |

## Quick start

Requirements: Node 22.12+ (developed on Node 26) and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000 for the landing page, then **Open LifeOS**. A first visit offers a blank start or clearly labeled sample data (removable in Settings → Your data); returning browsers go straight to their planner. App URLs such as `/today` and `/plan` work directly.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Web app dev server on port 3000 |
| `npm test` | All unit tests: domain rules, web store, extension, database RLS |
| `npm run typecheck` | TypeScript checks for every workspace |
| `npm run build` | Production build of the web app and the extension |
| `npm run build -w @lifeos/extension` | Build the unpacked extension into `apps/extension/dist` |
| `npm run build:desktop-ui` | Build the companion's web UI |
| `npm run tauri:build -w @lifeos/desktop` | Build the Windows companion (needs Rust + MSVC, see below) |

## Layout

```
packages/domain   Shared types, validation, time-zone rules, streaks, progress, focus timer, domain normalization, pairing contracts
apps/web          Next.js App Router planner (React 19, Tailwind 4, Motion)
apps/extension    Manifest V3 extension for Chrome and Edge (esbuild)
apps/desktop      Tauri 2 Windows companion (Rust core + React UI)
supabase          SQL migrations and Row Level Security tests (PGlite)
docs              Architecture, time and streak rules, integrations, privacy, motion system
```

## Browser extension

```bash
npm run build -w @lifeos/extension
# For a deployed LifeOS, list its origin(s):
# LIFEOS_ORIGINS=https://lifeos.example.com npm run build -w @lifeos/extension
```

1. Open `chrome://extensions` (or `edge://extensions`), turn on Developer mode, choose **Load unpacked**, and pick `apps/extension/dist`.
2. Click the extension's toolbar button → **Pair with LifeOS**. It shows its ID and a one-time code.
3. In LifeOS → Settings → Browser extension, paste both and pair.
4. Create a blocklist, pick it when starting a focus session, and check that the Focus page shows **Blocking** as reported by the extension.

Details, permissions and the full manual test list are in [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).

## Windows companion

Building needs the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/): Rust (stable, MSVC target), Microsoft C++ Build Tools and WebView2 (preinstalled on Windows 11).

```bash
cd apps/desktop
npm run tauri:dev     # development
npm run tauri:build   # installer in src-tauri/target/release/bundle
cd src-tauri && cargo test   # Rust unit tests (matcher, guard, deep links, config)
```

Pair it by copying the secret from the companion's **Pair with LifeOS** section into LifeOS → Settings → Windows companion.

## Environment variables

None are required for Local mode. See [.env.example](.env.example) for the variables reserved for cloud sync.

## Database

`supabase/migrations` holds the schema. `npm test -w @lifeos/supabase` applies it to an in-memory Postgres (PGlite) with a small shim of Supabase's `auth` schema and runs allow/deny tests. To use it with a real project: `supabase link` then `supabase db push` (Supabase CLI), and never put the service-role key in client code.

## Troubleshooting

- **The project is in OneDrive.** Syncing `node_modules` and `.next` is slow and can lock files. Exclude them from sync or move the repo outside OneDrive.
- **`npm warn install-scripts … not yet covered by allowScripts`.** npm 11 skipped the post-install scripts of `esbuild` and `unrs-resolver`. Builds and tests pass without them; run `npm install-scripts approve esbuild` if you prefer.
- **Extension shows "Disconnected" in LifeOS.** The extension must be built with the exact origin you open LifeOS from (`LIFEOS_ORIGINS`), and you must use Chrome or Edge.
- **Companion links do nothing.** The browser asks before opening `lifeos-companion://` links; allow it. In dev, the scheme is registered when `tauri dev` starts.

## Known limitations

- Local mode only: data lives in one browser on one device. Use Export regularly.
- No sign-in or sync yet, so the database device-pairing flow isn't used by the apps yet. The extension pairs directly with the open LifeOS page instead.
- The companion has not been compiled or run; treat it as unverified until `cargo test` and a manual check pass on Windows.
- Website and app blocking are best-effort and can be bypassed by design.
