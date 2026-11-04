# Architecture

## Workspaces

npm workspaces, each buildable on its own.

- **`packages/domain`** — pure TypeScript: entity types, input validation, time-zone math, task filters, block layout, habit streaks, progress, the focus state machine, insights, domain normalization, and the extension/companion message contracts. No DOM, React or Node APIs, so the web app, extension and companion UI share one set of rules.
- **`apps/web`** — Next.js 16 App Router. `/` is the landing page (`components/landing/*`, no app shell). Planner routes live in the `(app)` route group, whose layout renders the shell; URLs are unchanged. The root layout holds only the FX layer. Pages are thin server components that render client views (`components/views/*`). Tailwind 4 tokens in `app/globals.css`; Motion for transitions (with `MotionConfig reducedMotion="user"`).
- **`apps/extension`** — MV3 service worker + popup, bundled with esbuild. Logic in a chrome-free `Controller` for testing.
- **`apps/desktop`** — Tauri 2: Rust core with narrow typed commands; React UI for settings and the reminder overlay.
- **`supabase`** — SQL migrations and PGlite-based RLS tests.

## Web data flow (Local mode)

```
UI component ──calls──▶ lib/actions.ts ──validates with @lifeos/domain──▶ lib/store.ts update()
                                                                          │ read latest copy from localStorage
                                                                          │ apply mutation to a clone
                                                                          │ write back (or report a save error)
UI ◀── useStore() (useSyncExternalStore) ◀── emit ◀───────────────────────┘
other tabs ◀── "storage" event ── re-hydrate
```

- One versioned document under `localStorage["lifeos:data"]`. `migrate()` fills defaults and refuses data from a newer schema.
- Read-modify-write on every change means two tabs never overwrite each other with stale copies.
- If the browser refuses to save, changes stay in memory and a persistent banner offers export — input is never silently dropped.
- Loading, error (unreadable data, with retry and an explicit "start fresh"), empty (first run) and offline states are handled in the shell.

## Focus engine

`components/shell.tsx` mounts:

- `FocusEngine`: every second while a run exists, calls `reconcileFocus()`, which applies due transitions from the persisted timestamps (idempotent; safe across tabs). Also updates the tab title and announces phase changes to screen readers.
- `ExtensionSync`: computes the desired block state (`blockingDesired`/`blockingUntil`) and sends it to a paired extension when it changes and every minute (lease renewal). The UI shows what the extension reports.

Companion links are sent from user actions on the Focus page (browsers require a user gesture to open an app).

## Key decisions

- **Local-first now, cloud later.** No Supabase project or credentials exist yet, so the planner works fully offline in one browser. The schema mirrors the local entities (snake_case) so a sync layer can map 1:1.
- **Calendar dates vs instants** are separate types everywhere (see `TIME_AND_STREAKS.md`).
- **Progress is derived**, never typed in.
- **No natural-language parsing** in quick capture: a plain, fast form with explicit day and priority controls.
- **No third-party requests at runtime**: fonts (Fraunces, Bricolage Grotesque, Caveat) are self-hosted by `next/font` at build time; no analytics, no CDNs.
- **Fail-open integrations**: every block window has an end time enforced on the device.

## Database (Supabase)

`supabase/migrations/20261030000000_core.sql`:

- Tables for profiles, goals, projects, tasks, time blocks, habits, habit entries, daily reviews, blocklists, focus presets, focus sessions, focus state, devices and pairing codes.
- Every user table: `user_id` defaulting to `auth.uid()`, RLS enabled and forced, `owner_all` policy (`user_id = auth.uid()` for using and with check), privileges revoked from `anon` and granted to `authenticated` only.
- Composite foreign keys `(parent_id, user_id)` stop a user from linking rows to another user's parents. `ON DELETE SET NULL (column)` keeps child rows when a parent is deleted.
- Check constraints mirror domain rules (lengths, enums, done ⇔ completed_at, block length 15 min–24 h, active focus ≤ wall-clock span).
- Device functions (`security definer`, fixed `search_path`): `create_pairing_code`, `redeem_pairing_code`, `device_focus_state`, `revoke_device`, plus `delete_my_data`.

Tests (`supabase/tests/rls.test.ts`) apply the migration to PGlite with a shim of Supabase's `auth.uid()`, `anon` and `authenticated`, then check owner access, cross-user denial, anon denial, constraint enforcement, pairing, token hashing, expiry and revocation.

## Next milestone: accounts and sync

1. Add `@supabase/supabase-js` and `@supabase/ssr`; magic-link sign-in; profile time zone.
2. A sync layer behind `lib/store.ts`: push local changes with `updated_at`; on conflict (server `updated_at` newer than the local base), keep both and ask the user — never overwrite silently.
3. Write `focus_state` on focus transitions; switch the extension and companion to account pairing via the device RPCs.
4. Server-side export and account deletion (`delete_my_data` + auth user deletion through a server route with the service key, server-only).
