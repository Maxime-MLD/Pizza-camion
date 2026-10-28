-- TEST PROJECT ONLY: brzcvncsycdpsrvulqss. Requires the separately installed test marker.
-- No customer records are seeded. This script never selects from Production.
begin;
do $fixtures$
declare d date:=(clock_timestamp() at time zone 'Europe/Paris')::date;
  first_pickup timestamp; service_id text; tomorrow_id text; fixture_map jsonb:='{}';
  scenario text; pickup timestamp; slot_id text; n integer:=0;
begin
  if not exists(select 1 from forno_private.test_environment where singleton and project_ref='brzcvncsycdpsrvulqss') then
    raise exception 'NOT_THE_APPROVED_TEST_ENVIRONMENT';
  end if;
  if exists(select 1 from public.orders) then raise exception 'EXISTING_TEST_ORDERS: do not overwrite fixtures'; end if;
  first_pickup=date_trunc('hour',(clock_timestamp() at time zone 'Europe/Paris')+interval '45 minutes')
    +ceil(extract(minute from (clock_timestamp() at time zone 'Europe/Paris')+interval '45 minutes')/15)*interval '15 minutes';
  if first_pickup+interval '105 minutes'>(d+time '23:44') then raise exception 'TOO_LATE_FOR_TODAY_TESTS'; end if;
  service_id='forno-test-'||d;tomorrow_id='forno-test-'||(d+1);
  insert into public.services(id,service_date,village,address,opening_time,closing_time,status,orders_enabled)
  values(service_id,d,'Village de test',null,'00:00','23:59','open',true),
    (tomorrow_id,d+1,'Village de test demain',null,'18:00','21:30','scheduled',false);
  foreach scenario in array array['browser','concurrency','idempotency','expiry','disabled','retention','rollback','spare'] loop
    pickup=first_pickup+n*interval '15 minutes';
    slot_id=service_id||'@'||to_char(pickup,'HH24:MI');
    insert into public.pickup_slots(id,service_id,pickup_time,capacity,enabled)
      values(slot_id,service_id,pickup::time,case when scenario in ('browser','spare','retention') then 8 else 2 end,scenario<>'disabled');
    fixture_map=fixture_map||jsonb_build_object(scenario,slot_id);n=n+1;
  end loop;
  insert into public.pickup_slots values(service_id||'@past',service_id,'00:00',2,true);
  update forno_private.test_environment set fixtures=fixture_map where singleton;
end $fixtures$;
commit;
