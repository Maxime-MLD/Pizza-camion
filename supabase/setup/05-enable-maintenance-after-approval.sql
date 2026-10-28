-- Separate approval required: activates automatic expiry + anonymisation after retention_days.
-- Review the retention duration and all affected rows first. This is NOT part of initial setup.
-- Never execute this until the real integration/cron tests and operational parameters are validated.
begin;
do $enable_forno_maintenance$
declare job_id bigint;
begin
  select jobid into strict job_id from cron.job
    where jobname='forno-order-maintenance' and username=current_user;
  perform cron.alter_job(job_id:=job_id,active:=true);
end $enable_forno_maintenance$;
commit;
