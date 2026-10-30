-- Real PostgreSQL Test checks; every synthetic row and pg_net request rolls back.
begin;
do $$
declare actor uuid; sid uuid=gen_random_uuid(); device uuid; secret text; batch jsonb; old_lease text; event_count integer;
begin
 if not exists(select 1 from forno_private.test_environment where project_ref='brzcvncsycdpsrvulqss') then raise exception 'TEST_ENVIRONMENT_REQUIRED'; end if;
 select user_id into strict actor from forno_private.admin_users where active limit 1;
 insert into auth.sessions(id,user_id) values(sid,actor);
 select decrypted_secret into strict secret from vault.decrypted_secrets where id=(select worker_secret_id from forno_private.push_config where singleton);
 device=(public.forno_push_admin(actor,sid,'subscribe',jsonb_build_object('endpoint','https://fcm.googleapis.com/send/FORNO_TRANSACTION_ROLLBACK_ONLY','p256dh',repeat('A',87),'auth',repeat('A',22),'label','SQL rollback test'))->>'deviceId')::uuid;
 perform public.forno_push_admin(actor,sid,'test',jsonb_build_object('deviceId',device));
 batch=public.forno_push_worker(secret,'claim');
 if batch is null or (batch#>>'{device,id}')::uuid<>device then raise exception 'CLAIM_FAILED'; end if;
 if public.forno_push_worker(secret,'claim') is not null then raise exception 'DOUBLE_CLAIM'; end if;
 old_lease=batch->>'lease';
 perform public.forno_push_worker(secret,'finish',jsonb_build_object('deviceId',device,'lease',old_lease,'status',503));
 if not exists(select 1 from forno_private.push_deliveries where device_id=device and status='pending' and attempts=1 and next_attempt_at>clock_timestamp()) then raise exception 'RETRY_FAILED'; end if;
 update forno_private.push_deliveries set next_attempt_at=clock_timestamp()-interval '1 second' where device_id=device;
 batch=public.forno_push_worker(secret,'claim');
 perform public.forno_push_worker(secret,'finish',jsonb_build_object('deviceId',device,'lease',old_lease,'status',410));
 if not exists(select 1 from forno_private.push_subscriptions where id=device and active) then raise exception 'STALE_ACK_REVOKED'; end if;
 perform public.forno_push_worker(secret,'finish',jsonb_build_object('deviceId',device,'lease',batch->>'lease','status',410));
 if exists(select 1 from forno_private.push_subscriptions where id=device and (active or endpoint is not null or p256dh is not null or auth_key is not null)) then raise exception 'REVOKE_FAILED'; end if;
 -- A normal order insertion creates exactly one outbox event in the same transaction.
 select count(*) into event_count from forno_private.push_events;
 insert into public.orders(service_id,pickup_slot_id,customer_first_name,customer_last_name,customer_phone,customer_note,total_cents,pizza_count,idempotency_key,pending_expires_at,status) select service_id,id,'Test','Only','+33600000000','FORNO_TEST_ONLY',1000,1,gen_random_uuid(),clock_timestamp()+interval '15 minutes','pending' from public.pickup_slots order by id limit 1;
 if (select count(*) from forno_private.push_events)<>event_count+1 then raise exception 'OUTBOX_FAILED'; end if;
end $$;
select jsonb_build_object('transactionalOutbox',true,'leaseFencing',true,'retry',true,'permanent410',true,'doubleClaimBlocked',true,'allFixturesRolledBack',true) as verified;
rollback;
