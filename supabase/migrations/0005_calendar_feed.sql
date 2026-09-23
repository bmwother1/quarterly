-- Heron · calendar links, synced to the account, encrypted
--
-- Until now a remembered calendar link lived only in the browser that saved it.
-- That broke the case that matters: paste Canvas on a laptop, and the phone,
-- where the student actually uses Heron, can never refresh it. See
-- context/decisions.md, 2026-09-23.
--
-- A feed URL is a password to a student's whole schedule, so this table never
-- holds one in the clear:
--
--   sealed   the URL, AES-256-GCM encrypted by /api/feeds with FEED_LINK_KEY,
--            a key that lives in Vercel and never in this database
--   link_id  an HMAC of the URL, so a row can be found without storing it
--
-- host, label and kind are plain because the app shows them on screen and none
-- of them opens anything. The path of a feed URL is the secret; the host is not.
--
-- Owner-only RLS like every other table, and it cascades from auth.users, so
-- delete_own_account() (0002) removes these with everything else.

create table if not exists public.calendar_feed (
  user_id        uuid not null references auth.users(id) on delete cascade,
  link_id        text not null,
  sealed         text not null,
  host           text not null,
  label          text not null,
  kind           text not null check (kind in ('assignments', 'events')),
  source_key     text,
  remembered_at  timestamptz not null default now(),
  fetched_at     timestamptz,
  primary key (user_id, link_id)
);

alter table public.calendar_feed enable row level security;

create policy "own calendar links" on public.calendar_feed
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- "Automatically expose new tables" is off for this project, so nothing reaches
-- this table without a grant. Only the student, through /api/feeds. The
-- notification sender (service_role) has no reason to read links, and gets no
-- grant.
grant select, insert, update, delete on public.calendar_feed to authenticated;
