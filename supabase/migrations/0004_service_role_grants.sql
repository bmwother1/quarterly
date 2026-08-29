-- Quarterly · let the notification sender read the tables it sends from
--
-- `0001` grants every table to `authenticated` and nothing to `service_role`,
-- which was correct for everything that existed then: the whole product ran in
-- the browser as the signed-in student, and a grant nobody needs is exposure
-- nobody audited.
--
-- The notification sender is the first thing that is not a student. It runs on
-- a schedule with no session, reads every subscription, and decides what to
-- send. It cannot do that as `authenticated`, because there is no `auth.uid()`
-- to be.
--
-- The failure this fixes is a quiet one. `service_role` bypasses RLS, so it
-- looks like it should be able to reach anything, and this project has
-- "automatically expose new tables" off, so the default grants that would
-- normally hide the problem were never there. The route authenticated
-- correctly, then returned `permission denied for table push_subscription`
-- every ten minutes into a log nobody was reading. RLS decides which rows; a
-- grant decides whether the table can be reached at all, and only the second
-- one was missing.
--
-- Granted narrowly, to the two tables the sender touches and the four verbs it
-- uses. It never inserts and never deletes:
--
--   push_subscription  select, to find who to send to
--                      update, to disable a subscription the browser threw away
--   plan_state         select, to decide whether anything is worth sending
--                      update, to stamp lastNotifiedAt so "one a day" holds
--
-- `app_event` and `profile` are deliberately absent. The sender does not read
-- them, and telemetry that a server process can rewrite is not a measurement.

grant usage on schema public to service_role;

grant select, update on public.push_subscription to service_role;
grant select, update on public.plan_state        to service_role;
