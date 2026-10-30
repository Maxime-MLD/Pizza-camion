-- Two real PostgreSQL sessions via pg_cron, Test only; no provider sends.
-- Run only before physical-device subscription. Synthetic device is revoked afterwards.
begin;
do $$
declare owner uuid; device uuid; event uuid;
begin
 if not exists(select 1 from forno_private.test_environment where project_ref='brzcvncsycdpsrvulqss') then raise exception 'TEST_ENVIRONMENT_REQUIRED'; end if;
 if exists(select 1 from forno_private.push_subscriptions where active) then raise exception 'DEVICE_TESTS_ALREADY_STARTED'; end if;
 if (select fixtures ? '_pushParallelA' from forno_private.test_environment) then raise exception 'ALREADY_TESTED'; end if;
 perform cron.alter_job((select jobid from cron.job where jobname='forno-push-outbox'),active:=false);
 select user_id into strict owner from forno_private.admin_users where active limit 1;
 insert into forno_private.push_subscriptions(owner_id,endpoint,endpoint_hash,p256dh,auth_key,label) values(owner,'https://fcm.googleapis.com/send/FORNO_CONCURRENCY_SQL_ONLY',sha256(convert_to('FORNO_CONCURRENCY_SQL_ONLY','UTF8')),repeat('A',87),repeat('A',22),'SQL concurrency fixture') returning id into device;
 insert into forno_private.push_events(kind,target_device,expires_at) values('test',device,clock_timestamp()+interval '5 minutes') returning id into event;
 update forno_private.test_environment set fixtures=fixtures||jsonb_build_object('_pushDevice',device,'_pushEvent',event) where project_ref='brzcvncsycdpsrvulqss';
end $$;
select cron.schedule('forno-push-test-concurrency','5 seconds',$job$
do $a$
declare secret text; batch jsonb; evidence jsonb; a_pid integer=pg_backend_pid();
begin
 perform cron.alter_job((select jobid from cron.job where jobname='forno-push-test-concurrency'),active:=false);
 select decrypted_secret into strict secret from vault.decrypted_secrets where id=(select worker_secret_id from forno_private.push_config where singleton);
 batch=public.forno_push_worker(secret,'claim');
 if batch is null or batch#>>'{device,id}'<>(select fixtures->>'_pushDevice' from forno_private.test_environment) then raise exception 'CLAIM_FAILED'; end if;
 perform pg_sleep(10);
 select jsonb_agg(jsonb_build_object('blockedPid',pid,'waitType',wait_event_type,'blockers',pg_blocking_pids(pid))) into evidence from pg_stat_activity where a_pid=any(pg_blocking_pids(pid));
 update forno_private.test_environment set fixtures=fixtures||jsonb_build_object('_pushParallelA',jsonb_build_object('pid',a_pid,'lease',batch->>'lease','observedWaiters',evidence,'at',clock_timestamp())) where project_ref='brzcvncsycdpsrvulqss';
 perform pg_sleep(2);
end $a$;
$job$);
commit;
begin;
do $b$
declare secret text; batch jsonb; started timestamptz; m forno_private.test_environment;
begin
 perform pg_sleep(7);
 select decrypted_secret into strict secret from vault.decrypted_secrets where id=(select worker_secret_id from forno_private.push_config where singleton);
 started=clock_timestamp();batch=public.forno_push_worker(secret,'claim');
 if batch is not null then raise exception 'DOUBLE_CLAIM'; end if;
 select * into strict m from forno_private.test_environment where project_ref='brzcvncsycdpsrvulqss';
 if not exists(select 1 from jsonb_array_elements(m.fixtures#>'{_pushParallelA,observedWaiters}') w where (w->>'blockedPid')::integer=pg_backend_pid() and w->>'waitType'='Lock') then raise exception 'NO_OBSERVED_LOCK_WAIT'; end if;
 if (select count(*) from forno_private.push_deliveries where event_id=(m.fixtures->>'_pushEvent')::uuid)<>1 then raise exception 'DUPLICATE_DELIVERY'; end if;
 if not exists(select 1 from forno_private.push_deliveries where event_id=(m.fixtures->>'_pushEvent')::uuid and status='processing' and attempts=1) then raise exception 'UNEXPECTED_ATTEMPTS'; end if;
 perform forno_private.push_revoke((m.fixtures->>'_pushDevice')::uuid,'sql_concurrency_fixture_done');
 update forno_private.test_environment set fixtures=fixtures||jsonb_build_object('_pushParallelB',jsonb_build_object('pid',pg_backend_pid(),'secondClaimNull',true,'startedAt',started,'finishedAt',clock_timestamp(),'waitSeconds',extract(epoch from(clock_timestamp()-started)))) where project_ref='brzcvncsycdpsrvulqss';
 perform cron.alter_job((select jobid from cron.job where jobname='forno-push-outbox'),active:=true);
end $b$;
select fixtures->'_pushParallelA' session_a,fixtures->'_pushParallelB' session_b from forno_private.test_environment where project_ref='brzcvncsycdpsrvulqss';
commit;
