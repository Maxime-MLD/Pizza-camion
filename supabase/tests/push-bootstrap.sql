-- Isolated Test only. No secret value is returned, logged or exported.
-- Run after deploying forno-push-worker; do not apply this fixture to Production.
do $$
declare token text; secret_id uuid;
begin
 if not exists(select 1 from forno_private.test_environment where project_ref='brzcvncsycdpsrvulqss') then raise exception 'TEST_ENVIRONMENT_REQUIRED'; end if;
 if (select worker_secret_id is null from forno_private.push_config where singleton) then
  token=encode(extensions.gen_random_bytes(32),'hex');
  select vault.create_secret(token,'forno_push_worker_token','Test-only Edge worker authentication') into secret_id;
  update forno_private.push_config set worker_secret_id=secret_id,worker_hash=sha256(convert_to(token,'UTF8')) where singleton;
 end if;
 update forno_private.push_config set enabled=true,worker_url='https://brzcvncsycdpsrvulqss.supabase.co/functions/v1/forno-push-worker',vapid_subject='https://pizza-two-bay.vercel.app/' where singleton;
 -- This scheduler sends/retries push only. It never runs order maintenance.
 perform cron.alter_job((select jobid from cron.job where jobname='forno-push-outbox'),active:=true);
 perform forno_private.wake_push_worker();
end $$;
