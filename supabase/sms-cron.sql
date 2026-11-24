-- Sends queued SMS (patient notices, booking reminders) every minute.
-- Run once in the SQL editor after the "dyh" Edge Function is deployed.
-- Replace YOUR-REF with your project ref (the part before .supabase.co).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('dyh-send-sms') where exists (select 1 from cron.job where jobname = 'dyh-send-sms');
select cron.schedule('dyh-send-sms', '* * * * *', $$
  select net.http_post(
    url := 'https://YOUR-REF.supabase.co/functions/v1/dyh',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"action": "drainSms"}'::jsonb)
  where exists (select 1 from public.sms_outbox where status = 'queued')
$$);
