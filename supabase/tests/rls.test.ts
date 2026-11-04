/**
 * Runs the real migrations in PGlite (Postgres compiled to WASM) with a minimal
 * shim of Supabase's auth schema and roles, then checks allow/deny behavior for
 * signed-in owners, other users and unauthenticated (anon) callers.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";

const SHIM = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  insert into auth.users values ('${A}'), ('${B}');
`;

let db: PGlite;

/** Run `sql` as a Supabase role, like PostgREST does for a request. */
async function as<T = Record<string, unknown>>(who: "anon" | typeof A | typeof B, sql: string, params: unknown[] = []): Promise<T[]> {
  const role = who === "anon" ? "anon" : "authenticated";
  const sub = who === "anon" ? "" : who;
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [sub]);
  await db.exec(`set role ${role}`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SHIM);
  const dir = join(import.meta.dirname, "..", "migrations");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, f), "utf8"));
  }
}, 60_000);

describe("migrations", () => {
  it("enable RLS on every public table", async () => {
    const rows = (await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' order by 1`,
    )).rows;
    expect(rows.length).toBe(14);
    expect(rows.filter((r) => !r.relrowsecurity)).toEqual([]);
  });
});

describe("ownership", () => {
  let taskId = "";
  let projectId = "";

  it("lets a user create and read their own rows", async () => {
    [{ id: projectId }] = await as<{ id: string }>(A, `insert into public.projects (title) values ('A project') returning id`);
    [{ id: taskId }] = await as<{ id: string }>(A, `insert into public.tasks (title, project_id) values ('A task', $1) returning id`, [projectId]);
    const rows = await as(A, `select title, user_id from public.tasks`);
    expect(rows).toEqual([{ title: "A task", user_id: A }]);
  });

  it("hides other users' rows and makes their updates/deletes no-ops", async () => {
    expect(await as(B, `select * from public.tasks`)).toEqual([]);
    expect(await as(B, `update public.tasks set title = 'hacked' where id = $1 returning id`, [taskId])).toEqual([]);
    expect(await as(B, `delete from public.tasks where id = $1 returning id`, [taskId])).toEqual([]);
    expect(await as(A, `select title from public.tasks where id = $1`, [taskId])).toEqual([{ title: "A task" }]);
  });

  it("refuses writing rows owned by someone else", async () => {
    await expect(as(B, `insert into public.tasks (user_id, title) values ($1, 'planted')`, [A])).rejects.toThrow(/row-level security/);
    await expect(as(A, `update public.tasks set user_id = $1 where id = $2`, [B, taskId])).rejects.toThrow(/row-level security/);
  });

  it("refuses linking to another user's project, even by id", async () => {
    await expect(as(B, `insert into public.tasks (title, project_id) values ('sneaky', $1)`, [projectId])).rejects.toThrow(/foreign key/);
  });

  it("denies all table access to unauthenticated callers", async () => {
    for (const t of ["tasks", "habits", "daily_reviews", "focus_sessions", "devices", "device_pairing_codes", "profiles"]) {
      await expect(as("anon", `select * from public.${t}`), t).rejects.toThrow(/permission denied/);
    }
    await expect(as("anon", `insert into public.tasks (title) values ('x')`)).rejects.toThrow(/permission denied/);
  });

  it("enforces data rules in the database", async () => {
    await expect(as(A, `insert into public.tasks (title, status) values ('done but no time', 'done')`)).rejects.toThrow(/check constraint/);
    await expect(
      as(A, `insert into public.focus_sessions (run_id, started_at, ended_at, active_ms, planned_ms, outcome)
             values (gen_random_uuid(), now(), now() + interval '10 minutes', 3600000, 1500000, 'completed')`),
    ).rejects.toThrow(/check constraint/);
  });

  it("keeps tasks when their project is deleted", async () => {
    await as(A, `delete from public.projects where id = $1`, [projectId]);
    expect(await as(A, `select project_id, user_id from public.tasks where id = $1`, [taskId])).toEqual([{ project_id: null, user_id: A }]);
  });
});

describe("device pairing", () => {
  let token = "";
  let deviceId = "";

  it("issues a one-time code only to signed-in users", async () => {
    await expect(as("anon", `select public.create_pairing_code('browser_extension')`)).rejects.toThrow(/permission denied/);
    const [{ code }] = await as<{ code: string }>(A, `select public.create_pairing_code('browser_extension') as code`);
    expect(code).toMatch(/^[0-9A-F]{12}$/);
    const rows = await as<{ device_id: string; token: string }>("anon", `select * from public.redeem_pairing_code($1, 'Chrome on laptop')`, [code.toLowerCase()]);
    token = rows[0]!.token;
    deviceId = rows[0]!.device_id;
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    // single use
    await expect(as("anon", `select * from public.redeem_pairing_code($1, 'again')`, [code])).rejects.toThrow(/invalid or expired/);
  });

  it("stores only a hash and never exposes it", async () => {
    const raw = (await db.query<{ token_hash: string }>(`select token_hash from public.devices`)).rows;
    expect(raw.map((r) => r.token_hash)).not.toContain(token);
    await expect(as(A, `select token_hash from public.devices`)).rejects.toThrow(/permission denied/);
    expect(await as(A, `select id, kind, name from public.devices`)).toEqual([{ id: deviceId, kind: "browser_extension", name: "Chrome on laptop" }]);
    expect(await as(B, `select id from public.devices`)).toEqual([]);
  });

  it("lets the device read only the current block state", async () => {
    expect(await as("anon", `select * from public.device_focus_state($1)`, [token])).toEqual([{ blocking: false, until: null, domains: [] }]);
    const [{ id: list }] = await as<{ id: string }>(A, `insert into public.blocklists (name, domains) values ('Social', '{youtube.com,reddit.com}') returning id`);
    await as(A, `insert into public.focus_state (blocking, blocklist_id, until) values (true, $1, now() + interval '25 minutes')`, [list]);
    const [state] = await as<{ blocking: boolean; domains: string[] }>("anon", `select * from public.device_focus_state($1)`, [token]);
    expect(state).toMatchObject({ blocking: true, domains: ["youtube.com", "reddit.com"] });
    await expect(as("anon", `select * from public.device_focus_state('not-a-token')`)).rejects.toThrow(/invalid token/);
  });

  it("stops blocking on its own once `until` has passed", async () => {
    await as(A, `update public.focus_state set until = now() - interval '1 minute'`);
    expect(await as("anon", `select * from public.device_focus_state($1)`, [token])).toEqual([{ blocking: false, until: null, domains: [] }]);
  });

  it("revokes: only the owner can, and the token stops working", async () => {
    expect(await as(B, `select public.revoke_device($1) as ok`, [deviceId])).toEqual([{ ok: false }]);
    expect(await as(A, `select public.revoke_device($1) as ok`, [deviceId])).toEqual([{ ok: true }]);
    await expect(as("anon", `select * from public.device_focus_state($1)`, [token])).rejects.toThrow(/invalid token/);
  });

  it("rejects expired codes", async () => {
    const [{ code }] = await as<{ code: string }>(A, `select public.create_pairing_code('windows_companion') as code`);
    await db.query(`update public.device_pairing_codes set expires_at = now() - interval '1 second'`);
    await expect(as("anon", `select * from public.redeem_pairing_code($1, 'pc')`, [code])).rejects.toThrow(/invalid or expired/);
  });
});

describe("data deletion", () => {
  it("removes only the caller's data", async () => {
    await as(B, `insert into public.tasks (title) values ('B task')`);
    await as(A, `select public.delete_my_data()`);
    expect(await as(A, `select id from public.tasks`)).toEqual([]);
    expect(await as(B, `select title from public.tasks`)).toEqual([{ title: "B task" }]);
  });
});
