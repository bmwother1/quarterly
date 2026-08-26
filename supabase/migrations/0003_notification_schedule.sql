-- Quarterly · run the notification sender every ten minutes
--
-- Why this exists rather than a Vercel cron: the engine's best notice is
-- `next-up`, which fires only when a block starts within fifteen minutes and is
-- deliberately exempt from the daily cap, because a nudge that arrives after
-- the block has started is worthless. Vercel's free tier caps cron at once a
-- day, and a once-daily call catches that fifteen-minute window only by
-- coincidence. Checked against the real engine: a block four hours away
-- produces nothing at all.
--
-- pg_cron is included on Supabase's free tier and can run as often as needed,
-- so the whole thing stays free.
--
-- The route itself decides whether anyone is due. Calling it often is cheap and
-- `nextNotice` returning null is the common, correct answer.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- The bearer token the route checks, kept in Vault rather than inline. A secret
-- pasted into the cron command is readable by anyone who can select from
-- cron.job, which is a larger group than it looks.
select vault.create_secret(
  'REPLACE_WITH_CRON_SECRET',
  'quarterly_cron_secret',
  'Bearer token for /api/notify'
);

select cron.schedule(
  'quarterly-notify',
  '*/10 * * * *',
  $$
  select net.http_get(
    url := 'https://REPLACE_WITH_DOMAIN/api/notify',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'quarterly_cron_secret')
    ),
    timeout_milliseconds := 30000
  );
  $$
);

-- To check it is running:
--   select * from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 10;
--
-- To stop it:
--   select cron.unschedule('quarterly-notify');
