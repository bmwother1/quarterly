-- Quarterly · let a student delete their own account, completely
--
-- Row-level security lets someone delete their own rows in `profile`,
-- `plan_state`, `app_event` and `push_subscription`. It does not let them delete
-- their row in `auth.users`, which is in a schema the anon key cannot reach.
--
-- That gap is not academic. Without this function, "delete everything" leaves an
-- email address on a server the student cannot reach, and the privacy page
-- cannot honestly say the data is gone. It is also the request a university's
-- procurement review will ask about first.
--
-- `security definer` is what makes this work: the function runs with the
-- owner's rights rather than the caller's, so it can reach `auth.users`. That
-- makes it the most dangerous kind of function to write, and the three lines
-- below are what keep it safe:
--
--   * it takes no arguments, so there is nothing to inject
--   * it deletes `auth.uid()` and nothing else, so a caller cannot name a victim
--   * `search_path` is pinned, so a caller cannot shadow `auth.users` with their
--     own table and redirect the delete
--
-- Every table references auth.users with `on delete cascade`, so removing that
-- one row takes the profile, the plan, the telemetry and the push subscriptions
-- with it.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- auth.uid() is null when called without a session. Deleting `where id = null`
  -- matches nothing, so an unauthenticated call is already a no-op, but failing
  -- loudly beats a silent success on an operation this destructive.
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

-- Signed-in callers only. `anon` must never reach this.
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
