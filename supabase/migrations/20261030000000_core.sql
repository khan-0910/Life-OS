-- LifeOS core schema.
-- Every user-data table carries user_id, has Row Level Security enabled, and is
-- reachable only by the `authenticated` role for the owner's own rows. `anon`
-- gets no table access at all. Child rows reference parents through composite
-- (id, user_id) keys, so a user cannot link their rows to someone else's.
-- Devices never use a user session: they hold a hashed, revocable, device-scoped
-- token that can only read the current focus block state (see functions below).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create function public.sha256_hex(p text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex')
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 40),
  time_zone text not null default 'UTC' check (char_length(time_zone) between 1 and 64),
  week_starts_on smallint not null default 1 check (week_starts_on in (0, 1)),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  why text not null default '' check (char_length(why) <= 2000),
  target_date date,
  status text not null default 'active' check (status in ('active', 'achieved', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  notes text not null default '' check (char_length(notes) <= 5000),
  goal_id uuid,
  due_date date,
  status text not null default 'active' check (status in ('active', 'done', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete set null (goal_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  notes text not null default '' check (char_length(notes) <= 10000),
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  priority text not null default 'none' check (priority in ('high', 'medium', 'low', 'none')),
  due_date date,          -- all-day: calendar date in the user's time zone
  planned_for date,       -- all-day: never moved automatically
  estimate_minutes integer check (estimate_minutes between 1 and 1440),
  project_id uuid,
  goal_id uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check ((status = 'done') = (completed_at is not null)),
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete set null (project_id),
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete set null (goal_id)
);

create table public.time_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  kind text not null default 'focus' check (kind in ('focus', 'meeting', 'admin', 'personal')),
  task_id uuid,
  notes text not null default '' check (char_length(notes) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at + interval '15 minutes' and ends_at <= starts_at + interval '24 hours'),
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete set null (task_id)
);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 500),
  schedule jsonb not null default '{"type":"daily"}'::jsonb check (schedule ->> 'type' in ('daily', 'weekdays')),
  start_date date not null,
  pauses jsonb not null default '[]'::jsonb check (jsonb_typeof(pauses) = 'array'),
  color text not null default 'sage' check (color in ('sage', 'amber', 'violet', 'sky')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.habit_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null,
  entry_date date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, entry_date),
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete cascade
);

create table public.daily_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  review_date date not null,
  note text not null default '' check (char_length(note) <= 20000), -- private
  planned_task_ids uuid[] not null default '{}',
  completed_task_ids uuid[] not null default '{}',
  moved_task_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, review_date)
);

create table public.blocklists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  domains text[] not null default '{}' check (cardinality(domains) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.focus_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  focus_minutes integer not null check (focus_minutes between 1 and 240),
  break_minutes integer not null check (break_minutes between 0 and 120),
  blocklist_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (blocklist_id, user_id) references public.blocklists (id, user_id) on delete set null (blocklist_id)
);

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  run_id uuid not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  active_ms bigint not null check (active_ms >= 0),
  paused_ms bigint not null default 0 check (paused_ms >= 0),
  planned_ms bigint not null check (planned_ms > 0),
  outcome text not null check (outcome in ('completed', 'ended_early', 'interrupted')),
  preset_name text not null default '' check (char_length(preset_name) <= 60),
  task_id uuid,
  project_id uuid,
  cycle integer not null default 1 check (cycle >= 1),
  created_at timestamptz not null default now(),
  check (ended_at >= started_at),
  -- Active focus can never exceed the wall-clock span of the session (1 s tolerance).
  check (active_ms <= extract(epoch from (ended_at - started_at)) * 1000 + 1000),
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete set null (task_id),
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete set null (project_id)
);

-- The one thing devices may learn: whether to block right now, until when, from which list.
create table public.focus_state (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  run_id uuid,
  blocking boolean not null default false,
  blocklist_id uuid,
  until timestamptz,
  updated_at timestamptz not null default now(),
  check (not blocking or (until is not null and blocklist_id is not null)),
  foreign key (blocklist_id, user_id) references public.blocklists (id, user_id) on delete set null (blocklist_id)
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('browser_extension', 'windows_companion')),
  name text not null default '' check (char_length(name) <= 80),
  token_hash text not null unique,   -- sha256 of the device token; the token itself is never stored
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create table public.device_pairing_codes (
  code_hash text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('browser_extension', 'windows_companion')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes (ownership filters and date-range queries)
-- ---------------------------------------------------------------------------

create index goals_user_idx on public.goals (user_id);
create index projects_user_idx on public.projects (user_id);
create index tasks_user_planned_idx on public.tasks (user_id, planned_for);
create index tasks_user_due_idx on public.tasks (user_id, due_date);
create index tasks_project_idx on public.tasks (project_id) where project_id is not null;
create index time_blocks_user_start_idx on public.time_blocks (user_id, starts_at);
create index habits_user_idx on public.habits (user_id);
create index habit_entries_user_date_idx on public.habit_entries (user_id, entry_date);
create index blocklists_user_idx on public.blocklists (user_id);
create index focus_presets_user_idx on public.focus_presets (user_id);
create index focus_sessions_user_start_idx on public.focus_sessions (user_id, started_at);
create index devices_user_idx on public.devices (user_id);
create index pairing_codes_user_idx on public.device_pairing_codes (user_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['profiles','goals','projects','tasks','time_blocks','habits','daily_reviews','blocklists','focus_presets','focus_state']
  loop
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', t || '_touch', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security and grants
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['profiles','goals','projects','tasks','time_blocks','habits','habit_entries','daily_reviews','blocklists','focus_presets','focus_sessions','focus_state']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format($p$create policy owner_all on public.%I for all to authenticated
                     using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$, t);
  end loop;
end $$;

-- Devices: owners may list their devices (never the token hash) — changes go through functions.
alter table public.devices enable row level security;
alter table public.devices force row level security;
revoke all on public.devices from anon, authenticated;
grant select (id, kind, name, created_at, last_seen_at, expires_at, revoked_at) on public.devices to authenticated;
create policy owner_read on public.devices for select to authenticated using (user_id = (select auth.uid()));

-- Pairing codes: no direct access for anyone but the functions below.
alter table public.device_pairing_codes enable row level security;
alter table public.device_pairing_codes force row level security;
revoke all on public.device_pairing_codes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Device pairing (security definer; each validates its own inputs)
-- ---------------------------------------------------------------------------

-- Signed-in user asks for a one-time code to type into a device. 10 minutes, single use.
create function public.create_pairing_code(p_kind text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_code text;
begin
  if v_user is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_kind not in ('browser_extension', 'windows_companion') then raise exception 'bad kind' using errcode = '22023'; end if;
  delete from public.device_pairing_codes where user_id = v_user and (kind = p_kind or expires_at < now());
  -- 12 hex chars (48 bits) from the server CSPRNG.
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  insert into public.device_pairing_codes (code_hash, user_id, kind, expires_at)
  values (public.sha256_hex(v_code), v_user, p_kind, now() + interval '10 minutes');
  return v_code;
end $$;

-- Device exchanges the code for its own token. The token is returned once and stored only as a hash.
create function public.redeem_pairing_code(p_code text, p_name text)
returns table (device_id uuid, token text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.device_pairing_codes;
  v_token text;
  v_id uuid;
  v_exp timestamptz := now() + interval '90 days';
begin
  if p_code is null or char_length(p_code) > 32 then raise exception 'invalid code' using errcode = '22023'; end if;
  delete from public.device_pairing_codes c
   where c.code_hash = public.sha256_hex(upper(trim(p_code))) and c.expires_at > now()
  returning * into v_row;
  if v_row.user_id is null then raise exception 'invalid or expired code' using errcode = '28000'; end if;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.devices (user_id, kind, name, token_hash, expires_at)
  values (v_row.user_id, v_row.kind, left(coalesce(p_name, ''), 80), public.sha256_hex(v_token), v_exp)
  returning id into v_id;
  return query select v_id, v_token, v_exp;
end $$;

-- Device reads only: block now?, until when, which domains. Nothing else about the user.
create function public.device_focus_state(p_token text)
returns table (blocking boolean, until timestamptz, domains text[])
language plpgsql security definer set search_path = '' as $$
declare
  v_dev public.devices;
begin
  if p_token is null or char_length(p_token) > 128 then raise exception 'invalid token' using errcode = '28000'; end if;
  update public.devices d set last_seen_at = now()
   where d.token_hash = public.sha256_hex(p_token) and d.revoked_at is null and d.expires_at > now()
  returning * into v_dev;
  if v_dev.id is null then raise exception 'invalid token' using errcode = '28000'; end if;
  return query
    select coalesce(s.blocking and s.until > now(), false) as blocking,
           case when s.blocking and s.until > now() then s.until end,
           case when s.blocking and s.until > now() then coalesce(b.domains, '{}') else '{}'::text[] end
      from (select v_dev.user_id as uid) u
      left join public.focus_state s on s.user_id = u.uid
      left join public.blocklists b on b.id = s.blocklist_id and b.user_id = u.uid;
end $$;

create function public.revoke_device(p_device_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  update public.devices set revoked_at = now()
   where id = p_device_id and user_id = auth.uid() and revoked_at is null;
  get diagnostics v_n = row_count;
  return v_n = 1;
end $$;

-- Remove all of the caller's planner data (account deletion also cascades from auth.users).
create function public.delete_my_data() returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not signed in' using errcode = '42501'; end if;
  delete from public.focus_sessions where user_id = v_user;
  delete from public.focus_state where user_id = v_user;
  delete from public.focus_presets where user_id = v_user;
  delete from public.time_blocks where user_id = v_user;
  delete from public.habit_entries where user_id = v_user;
  delete from public.habits where user_id = v_user;
  delete from public.daily_reviews where user_id = v_user;
  delete from public.tasks where user_id = v_user;
  delete from public.projects where user_id = v_user;
  delete from public.goals where user_id = v_user;
  delete from public.blocklists where user_id = v_user;
  delete from public.devices where user_id = v_user;
  delete from public.device_pairing_codes where user_id = v_user;
  delete from public.profiles where user_id = v_user;
end $$;

revoke all on function public.create_pairing_code(text), public.redeem_pairing_code(text, text), public.device_focus_state(text),
  public.revoke_device(uuid), public.delete_my_data(), public.sha256_hex(text), public.touch_updated_at() from public, anon, authenticated;
grant execute on function public.create_pairing_code(text), public.revoke_device(uuid), public.delete_my_data() to authenticated;
grant execute on function public.redeem_pairing_code(text, text), public.device_focus_state(text) to anon, authenticated;
