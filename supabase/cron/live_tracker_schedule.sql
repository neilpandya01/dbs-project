-- Wingmates: schedule the live tracker. Run ONCE in Supabase -> SQL Editor, after you have
--   1. run migrations/20261122000000_live_tracking.sql,
--   2. deployed the function:   supabase functions deploy live-tracker --no-verify-jwt
--   3. set its password:        supabase secrets set CRON_SECRET=<a long random string>
--   4. turned on the pg_cron and pg_net extensions (Database -> Extensions).
--
-- Replace the two placeholders below before running. Do not commit the real values: the password goes into
-- Supabase Vault, so it is not stored in your code.
--   YOUR_PROJECT_REF       the part of your project URL before .supabase.co
--   THE_SAME_CRON_SECRET   exactly what you passed to `supabase secrets set CRON_SECRET=...`

select vault.create_secret('THE_SAME_CRON_SECRET', 'live_tracker_secret');

-- every minute; each run works for about 50 seconds
select cron.schedule(
  'live-tracker',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/live-tracker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'live_tracker_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- To stop:  select cron.unschedule('live-tracker');
