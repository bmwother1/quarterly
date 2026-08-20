-- Quarterly · initial schema
--
-- Three tables, doing three different jobs. Worth being explicit about why it
-- isn't one:
--
--   plan_state  the student's schedule, stored as a JSON blob
--   app_event   append-only telemetry, the only thing that can measure retention
--   push_subscription  where to send a notification
--
-- The plan is a blob on purpose. It mirrors the local store exactly, so sync is
-- "write the same object to a second place" rather than a schema translation
-- that has to be kept in step with the client for the rest of the project's
-- life. Nothing queries inside a plan; the analytics that matter live in
-- app_event, where they can be indexed properly.
--
-- Every table is row-level-secured to the owner. This holds a real person's
-- whole schedule, and the anon key is public by design — RLS is the only thing
-- standing between one student and everyone else's data.

-- ─── profiles ──────────────────────────────────────────────────────
create table if not exists public.profile (
  id          uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  -- IANA zone, e.g. America/Los_Angeles. The scheduler is meaningless without it.
  timezone    text not null default 'America/Los_Angeles',
  -- Set once, at signup, to answer "did the students who joined in week 0 stay?"
  cohort_week date not null default date_trunc('week', now())::date
);

alter table public.profile enable row level security;

create policy "own profile" on public.profile
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- ─── the plan itself ───────────────────────────────────────────────
create table if not exists public.plan_state (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  state       jsonb not null,
  -- Last-write-wins between devices. Good enough: a student editing the same
  -- schedule on two devices at the same moment is not a real scenario, and
  -- anything better costs conflict resolution nobody will ever see.
  updated_at  timestamptz not null default now(),
  -- Guards against an older client overwriting a newer state after a reconnect.
  revision    bigint not null default 1
);

alter table public.plan_state enable row level security;

create policy "own plan" on public.plan_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── telemetry ─────────────────────────────────────────────────────
-- The whole project turns on week-4 retention and nothing currently measures it.
-- Deliberately thin: what happened, when, and nothing about *what* the work was.
create table if not exists public.app_event (
  id        bigserial primary key,
  user_id   uuid not null references auth.users(id) on delete cascade,
  -- 'opened' | 'planned' | 'block_done' | 'block_skipped' | 'block_moved' | 'feed_synced'
  kind      text not null,
  at        timestamptz not null default now(),
  -- Small numeric facts only: minutes, counts. Never titles or course names.
  detail    jsonb
);

alter table public.app_event enable row level security;

create policy "own events" on public.app_event
  for select using (auth.uid() = user_id);

create policy "insert own events" on public.app_event
  for insert with check (auth.uid() = user_id);

create index if not exists app_event_user_at on public.app_event (user_id, at desc);
create index if not exists app_event_kind_at on public.app_event (kind, at desc);

-- ─── push ──────────────────────────────────────────────────────────
create table if not exists public.push_subscription (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth_key    text not null,
  timezone    text not null default 'America/Los_Angeles',
  created_at  timestamptz not null default now(),
  -- Cleared when a send fails permanently, so dead endpoints stop being retried.
  disabled_at timestamptz
);

alter table public.push_subscription enable row level security;

create policy "own subscriptions" on public.push_subscription
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── retention, as a view ──────────────────────────────────────────
-- The number the project lives or dies on, computed rather than eyeballed.
-- Week 0 is the week the student signed up; "retained" means they opened the
-- app at all during week N.
create or replace view public.weekly_retention as
select
  p.cohort_week,
  floor(extract(epoch from (e.at - p.created_at)) / 604800)::int as week_number,
  count(distinct e.user_id) as active_users
from public.profile p
join public.app_event e on e.user_id = p.id
where e.kind = 'opened'
group by 1, 2
order by 1, 2;
