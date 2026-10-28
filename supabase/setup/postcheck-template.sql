-- Read-only after approved setup. No real order is created and no maintenance is executed.
begin transaction read only;
select 'pizzas' as object,count(*) as rows from public.pizzas
union all select 'services',count(*) from public.services
union all select 'pickup_slots',count(*) from public.pickup_slots
union all select 'orders',count(*) from public.orders
union all select 'order_items',count(*) from public.order_items;

with expected(id,name,description,price_cents,available) as (values
TODO_CATALOGUE_VALUES
)
select e.id,case when p.id is null then 'MISSING' when (p.name,p.description,p.price_cents) is distinct from (e.name,e.description,e.price_cents) then 'MISMATCH' else 'OK' end as catalogue_check,
  p.name,p.description,p.price_cents,p.available,
  case when not e.available then 'PRICE_CONFIRMATION_REQUIRED' else 'VERIFIED_SOURCE_PRICE' end as price_source
from expected e left join public.pizzas p using(id) order by e.id;

select id,service_date,village,address,opening_time,closing_time,status,orders_enabled
from public.services order by service_date;
select s.service_date,s.village,count(ps.id) as slots,min(ps.pickup_time) as first_slot,max(ps.pickup_time) as last_slot,
  min(ps.capacity) as min_capacity,max(ps.capacity) as max_capacity
from public.services s left join public.pickup_slots ps on ps.service_id=s.id group by s.id order by s.service_date;
select public.forno_pickup_slots(1) as todays_readonly_availability;

-- Fail visibly on an unsafe permission drift. Checks inspect ACLs rather than reading PII.
do $verify_forno$
declare t record; r text; p record; expected_execute boolean;
begin
  for t in select c.oid,c.relrowsecurity,n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind in ('r','p') and ((n.nspname='public' and c.relname in ('pizzas','services','pickup_slots','orders','order_items')) or n.nspname='forno_private') loop
    if not t.relrowsecurity then raise exception 'RLS_DISABLED: %.%',t.nspname,t.relname; end if;
    foreach r in array array['anon','authenticated','service_role'] loop
      if has_table_privilege(r,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
        raise exception 'EXCESSIVE_TABLE_PRIVILEGE: % on %.%',r,t.nspname,t.relname;
      end if;
    end loop;
  end loop;
  for p in select fn.oid,fn.proname,fn.prosecdef,fn.proconfig from pg_proc fn join pg_namespace n on n.oid=fn.pronamespace where n.nspname='public' and fn.proname like 'forno\_%' escape '\' loop
    if not p.prosecdef then raise exception 'UNEXPECTED_RPC_SECURITY_MODE: %',p.proname; end if;
    if not ('search_path=""'=any(coalesce(p.proconfig,array[]::text[]))) then raise exception 'RPC_SEARCH_PATH_NOT_EMPTY: %',p.proname; end if;
    if has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE') then raise exception 'PUBLIC_RPC_EXECUTE: %',p.proname; end if;
    expected_execute:=p.proname in ('forno_rate_limit','forno_pickup_slots','forno_create_order','forno_recover_order');
    if has_function_privilege('service_role',p.oid,'EXECUTE')<>expected_execute then raise exception 'WRONG_SERVICE_ROLE_EXECUTE: %',p.proname; end if;
  end loop;
  if (select count(*) from public.pizzas)<>13 then raise exception 'CATALOGUE_COUNT_MISMATCH'; end if;
  if exists(with expected(id,name,description,price_cents,available) as (values
TODO_CATALOGUE_VALUES
  ) select 1 from expected e left join public.pizzas actual using(id)
    where actual.id is null or (actual.name,actual.description,actual.price_cents) is distinct from (e.name,e.description,e.price_cents))
  then raise exception 'CATALOGUE_SOURCE_MISMATCH: review instead of overwriting'; end if;
  if exists(select 1 from public.services where orders_enabled) then raise exception 'ORDERS_ALREADY_ENABLED: review before opening to customers'; end if;
  if exists(select 1 from public.pizzas where id in ('montagnarde','norvegienne') and available) then raise exception 'UNCONFIRMED_PRICES_ENABLED: confirm original tariffs first'; end if;
  if exists(select 1 from cron.job where jobname='forno-order-maintenance' and active) then raise exception 'MAINTENANCE_ALREADY_ACTIVE: review retention and scheduling before launch'; end if;
  raise notice 'FORNO_ACL_RLS_CHECKS_PASSED';
end $verify_forno$;

select extname,extversion from pg_extension where extname='pg_cron';
select jobid,jobname,schedule,active,username from cron.job where jobname='forno-order-maintenance';
select version,filename,sha256,applied_at from forno_private.manual_migrations order by version;
commit;
