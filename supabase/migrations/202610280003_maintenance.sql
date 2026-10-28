-- Supabase supports pg_cron. Migration intentionally fails if scheduling cannot be installed.
-- Do not enable orders without confirming this job runs successfully.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('forno-order-maintenance','* * * * *','select public.forno_maintenance()');
