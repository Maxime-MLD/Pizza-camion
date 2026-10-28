-- APPROVED TEST PROJECT ONLY. Requires an unused 'spare' fixture. Never run in Production.
-- pg_cron provides an independent connection because MCP serializes its own SQL calls.
begin;
do $guard$ begin
 if not exists(select 1 from forno_private.test_environment where project_ref='brzcvncsycdpsrvulqss') then raise exception 'NOT_TEST'; end if;
 if exists(select 1 from public.orders where pickup_slot_id=(select fixtures->>'spare' from forno_private.test_environment)) then raise exception 'FIXTURE_ALREADY_USED'; end if;
end $guard$;
update public.pickup_slots set capacity=2 where id=(select fixtures->>'spare' from forno_private.test_environment);
update forno_private.test_environment set fixtures=fixtures||jsonb_build_object('_parallelKey',gen_random_uuid());
select cron.schedule('forno-test-concurrency','5 seconds',$job$
do $a$
declare m forno_private.test_environment; payload jsonb; receipt jsonb; evidence jsonb; a_pid integer:=pg_backend_pid();
begin
 select * into strict m from forno_private.test_environment where project_ref='brzcvncsycdpsrvulqss';
 -- One-shot: retain the job/history but prevent a repeat after this transaction commits.
 perform cron.alter_job(job_id:=(select jobid from cron.job where jobname='forno-test-concurrency'),active:=false);
 payload=jsonb_build_object('idempotencyKey',m.fixtures->>'_parallelKey','serviceId','forno-test-'||(clock_timestamp() at time zone 'Europe/Paris')::date,'slotId',m.fixtures->>'spare','date',((clock_timestamp() at time zone 'Europe/Paris')::date)::text,'village','Village de test','lines',jsonb_build_array(jsonb_build_object('pizzaId','capri','quantity',2)),'customer',jsonb_build_object('firstName','Test','lastName','Parallel','phone','+33600000000','comment','FORNO_TEST_ONLY','privacyAcknowledged',true));
 receipt=public.forno_create_order(payload,repeat('4',64),repeat('5',64));
 perform pg_sleep(10);
 select jsonb_agg(jsonb_build_object('blockedPid',pid,'waitType',wait_event_type,'waitEvent',wait_event,'blockers',pg_blocking_pids(pid))) into evidence from pg_stat_activity where a_pid=any(pg_blocking_pids(pid));
 update forno_private.test_environment set fixtures=fixtures||jsonb_build_object('_parallelA',jsonb_build_object('pid',a_pid,'receipt',receipt,'observedWaiters',evidence,'observedAt',clock_timestamp()));
 perform pg_sleep(2);
end $a$;
$job$);
commit;
begin;
do $b$
declare m forno_private.test_environment; started timestamptz; result text; payload jsonb;
begin
 perform pg_sleep(7);
 select * into strict m from forno_private.test_environment where project_ref='brzcvncsycdpsrvulqss';
 payload=jsonb_build_object('idempotencyKey',gen_random_uuid(),'serviceId','forno-test-'||(clock_timestamp() at time zone 'Europe/Paris')::date,'slotId',m.fixtures->>'spare','date',((clock_timestamp() at time zone 'Europe/Paris')::date)::text,'village','Village de test','lines',jsonb_build_array(jsonb_build_object('pizzaId','capri','quantity',2)),'customer',jsonb_build_object('firstName','Test','lastName','Parallel','phone','+33600000000','comment','FORNO_TEST_ONLY','privacyAcknowledged',true));
 started=clock_timestamp();
 begin
  perform public.forno_create_order(payload,repeat('6',64),repeat('7',64));result='UNEXPECTED_SUCCESS';
 exception when raise_exception then get stacked diagnostics result=message_text;end;
 if result<>'SLOT_FULL' then raise exception 'UNEXPECTED_RESULT: %',result; end if;
 update forno_private.test_environment set fixtures=fixtures||jsonb_build_object('_parallelB',jsonb_build_object('pid',pg_backend_pid(),'result',result,'startedAt',started,'finishedAt',clock_timestamp(),'waitSeconds',extract(epoch from (clock_timestamp()-started))));
 select * into strict m from forno_private.test_environment;
 if not exists(select 1 from jsonb_array_elements(m.fixtures#>'{_parallelA,observedWaiters}') w where (w->>'blockedPid')::integer=pg_backend_pid() and w->>'waitType'='Lock') then raise exception 'NO_OBSERVED_LOCK_WAIT'; end if;
 if (select count(*) from public.orders where pickup_slot_id=m.fixtures->>'spare')<>1 then raise exception 'OVERBOOKING'; end if;
end $b$;
select fixtures->'_parallelA' session_a,fixtures->'_parallelB' session_b from forno_private.test_environment;
commit;
