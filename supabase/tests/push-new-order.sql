-- Run only after BOTH physical devices have subscribed. Test data only.
-- Uses the real order RPC; no public checkout/Turnstile bypass endpoint is added.
-- Service acceptance is restored before commit, so other connections never see it open.
begin;
do $$
declare s public.services; payload jsonb; receipt jsonb; slot_id text;
begin
 if not exists(select 1 from forno_private.test_environment where project_ref='brzcvncsycdpsrvulqss') then raise exception 'TEST_ENVIRONMENT_REQUIRED'; end if;
 if (select count(*) from forno_private.push_subscriptions where active)<2 then raise exception 'TWO_PHYSICAL_SUBSCRIPTIONS_REQUIRED'; end if;
 if (select fixtures ? '_pushPhysicalOrder' from forno_private.test_environment) then raise exception 'PHYSICAL_ORDER_ALREADY_CREATED'; end if;
 select * into strict s from public.services where service_date=(clock_timestamp() at time zone 'Europe/Paris')::date and id like 'forno-test-%' for update;
 if s.orders_enabled then raise exception 'TEST_SERVICE_MUST_BE_CLOSED'; end if;
 update public.services set status='open',orders_enabled=true where id=s.id;
 select x->>'id' into slot_id from jsonb_array_elements(public.forno_pickup_slots(3)->'slots') x where x->>'state'='available' order by x->>'pickupTime' limit 1;
 if slot_id is null then raise exception 'NO_CURRENT_TEST_SLOT'; end if;
 payload=jsonb_build_object('idempotencyKey',gen_random_uuid(),'serviceId',s.id,'slotId',slot_id,'date',s.service_date::text,'village',s.village,'lines',jsonb_build_array(jsonb_build_object('pizzaId','capri','quantity',1),jsonb_build_object('pizzaId','maestro','quantity',2)),'customer',jsonb_build_object('firstName','Test','lastName','Push','phone','+33600000000','comment','FORNO_PUSH_PHYSICAL_TEST','privacyAcknowledged',true));
 receipt=public.forno_create_order(payload,encode(extensions.gen_random_bytes(32),'hex'),encode(extensions.gen_random_bytes(32),'hex'));
 update public.services set status=s.status,orders_enabled=s.orders_enabled where id=s.id;
 update forno_private.test_environment set fixtures=fixtures||jsonb_build_object('_pushPhysicalOrder',receipt->>'orderNumber') where project_ref='brzcvncsycdpsrvulqss';
end $$;
select jsonb_build_object('reference',fixtures->>'_pushPhysicalOrder','serviceClosed',not exists(select 1 from public.services where orders_enabled)) as synthetic_receipt from forno_private.test_environment where project_ref='brzcvncsycdpsrvulqss';
commit;
