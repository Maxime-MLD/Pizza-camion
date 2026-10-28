-- Approved synthetic tests ONLY on forno-pizza-test. No Production data or secrets.
begin;
do $tests$
declare marker forno_private.test_environment; d date; service_id text;
  request jsonb; invalid jsonb; receipt jsonb; repeated jsonb; availability jsonb;
  key uuid:=gen_random_uuid(); expiry_key uuid:=gen_random_uuid(); expected text; actual text;
  initial_count integer; refusals integer:=0;
begin
 select * into strict marker from forno_private.test_environment where singleton and project_ref='brzcvncsycdpsrvulqss';
 d=(clock_timestamp() at time zone 'Europe/Paris')::date;service_id='forno-test-'||d;
 select count(*) into initial_count from public.orders;
 if initial_count<>0 then raise exception 'TEST_ALREADY_STARTED: do not duplicate orders'; end if;
 request=jsonb_build_object('idempotencyKey',key,'serviceId',service_id,'slotId',marker.fixtures->>'retention',
   'date',d,'village','Village de test','lines',jsonb_build_array(jsonb_build_object('pizzaId','capri','quantity',2,'unitPriceCents',1)),
   'totalCents',1,'customer',jsonb_build_object('firstName','Test','lastName','Integration','phone','+33600000000','comment','FORNO_TEST_ONLY','privacyAcknowledged',true));
 receipt=public.forno_create_order(request,repeat('a',64),repeat('b',64));
 if receipt->>'status'<>'pending' or (receipt->>'totalCents')::integer<>2000 or receipt->>'orderNumber' !~ '^F-[0-9]+$' then raise exception 'BAD_RECEIPT'; end if;
 if (select count(*) from public.order_items i join public.orders o on o.id=i.order_id where o.idempotency_key=key and i.unit_price_cents=1000 and i.quantity=2 and i.line_total_cents=2000)<>1 then raise exception 'BAD_LINE_SNAPSHOT'; end if;
 repeated=public.forno_create_order(request,repeat('a',64),repeat('b',64));
 if repeated->>'orderNumber'<>receipt->>'orderNumber' or (select count(*) from public.orders)<>initial_count+1 then raise exception 'DUPLICATE_ORDER'; end if;
 begin
   perform public.forno_create_order(request,repeat('c',64),repeat('b',64));
   raise exception 'EXPECTED_IDEMPOTENCY_CONFLICT';
 exception when raise_exception then
   get stacked diagnostics actual=message_text;
   if actual<>'IDEMPOTENCY_CONFLICT' then raise; end if;
   refusals=refusals+1;
 end;
 for invalid,expected in select * from (values
   (jsonb_build_object('village','Other village'),'WRONG_SERVICE'),
   (jsonb_build_object('date',(d+1)::text),'WRONG_SERVICE'),
   (jsonb_build_object('serviceId','forno-test-'||(d+1)),'WRONG_SERVICE'),
   (jsonb_build_object('slotId',marker.fixtures->>'disabled'),'SLOT_UNAVAILABLE'),
   (jsonb_build_object('slotId',service_id||'@past'),'SLOT_EXPIRED'),
   (jsonb_build_object('lines',jsonb_build_array(jsonb_build_object('pizzaId','capri','quantity',-1))),'INVALID_QUANTITY'),
   (jsonb_build_object('lines',jsonb_build_array(jsonb_build_object('pizzaId','capri','quantity',1.5))),'INVALID_QUANTITY'),
   (jsonb_build_object('lines',jsonb_build_array(jsonb_build_object('pizzaId','capri','quantity',21))),'INVALID_QUANTITY'),
   (jsonb_build_object('lines',jsonb_build_array(jsonb_build_object('pizzaId','norvegienne','quantity',1))),'PIZZA_UNAVAILABLE')
 ) as checks(patch,error) loop
   begin
     perform public.forno_create_order(request||invalid||jsonb_build_object('idempotencyKey',gen_random_uuid()),repeat('a',64),repeat('b',64));
     raise exception 'EXPECTED_BUSINESS_REFUSAL';
   exception when raise_exception then
     get stacked diagnostics actual=message_text;
     if actual<>expected then raise exception 'WRONG_REFUSAL: expected %, got %',expected,actual; end if;
     refusals=refusals+1;
   end;
 end loop;
 -- A closed service must reject; this temporary update is restored inside the same transaction.
 update public.services set orders_enabled=false where id=service_id;
 begin
   perform public.forno_create_order(request||jsonb_build_object('idempotencyKey',gen_random_uuid()),repeat('a',64),repeat('b',64));
   raise exception 'EXPECTED_SERVICE_CLOSED';
 exception when raise_exception then
   get stacked diagnostics actual=message_text;if actual<>'SERVICE_CLOSED' then raise; end if;refusals=refusals+1;
 end;
 update public.services set orders_enabled=true where id=service_id;
 -- Preserve a synthetic accepted order for the retention / capacity test.
 update public.orders set status='accepted',pending_expires_at=clock_timestamp()-interval '1 second',created_at=clock_timestamp()-interval '31 days' where idempotency_key=key;
 update public.pickup_slots set capacity=2 where id=marker.fixtures->>'retention';
 availability=public.forno_pickup_slots(1);
 if not exists(select 1 from jsonb_array_elements(availability->'slots') s where s->>'id'=marker.fixtures->>'retention' and s->>'state'='full') then raise exception 'ACCEPTED_CAPACITY_LOST'; end if;
 perform public.forno_create_order(request||jsonb_build_object('idempotencyKey',expiry_key,'slotId',marker.fixtures->>'expiry'),repeat('a',64),repeat('d',64));
 update public.orders set pending_expires_at=clock_timestamp()-interval '1 second' where idempotency_key=expiry_key;
 availability=public.forno_pickup_slots(2);
 if not exists(select 1 from jsonb_array_elements(availability->'slots') s where s->>'id'=marker.fixtures->>'expiry' and s->>'state'='available') then raise exception 'EXPIRED_CAPACITY_NOT_RELEASED'; end if;
 if (select status from public.orders where idempotency_key=expiry_key)<>'pending' then raise exception 'MAINTENANCE_RAN_EARLY'; end if;
 update forno_private.test_environment set fixtures=fixtures||jsonb_build_object('_sql',jsonb_build_object(
   'validOrder',receipt->>'orderNumber','idempotencyKey',key,'expiryKey',expiry_key,'businessRefusals',refusals,
   'priceRecalculated',true,'linesVerified',true,'idempotence',true,'acceptedCapacity',true,'expiredCapacityBeforeCron',true)) where singleton;
end $tests$;
commit;
