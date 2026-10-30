-- GENERATED; review docs/production-readiness.md and obtain approval before execution.
-- Target ONLY: forno-pizza / fqjkkjvrklpzhwmswlsy, selected explicitly in the connector.
-- No Test seeds, accounts, sessions, subscriptions, orders, prices or service changes.
-- No live service or scheduler is enabled. This transaction is additive and atomic.
begin;
select pg_advisory_xact_lock(hashtextextended('forno-production-release-v1',0));
do $release$
declare m record; stored text; known boolean;
begin
 if to_regclass('forno_private.test_environment') is not null then raise exception 'TEST_DATABASE_REFUSED'; end if;
 if to_regclass('forno_private.manual_migrations') is null then raise exception 'BASELINE_RECONCILIATION_REQUIRED'; end if;
 for m in select * from(values
('202610280001','202610280001_orders.sql','7d36203c44c07027f8012df0a7006075e308e3d11315fceb1c29e7b53d95b6f7'),
('202610280002','202610280002_catalogue.sql','570254e5031a78a751d6c8e61353782705c66d3a702309d1542fd75402034bc8'),
('202610280003','202610280003_maintenance.sql','00998561c9b2747c3f80cef4f70d588e0c02f4904593d54b84f714965e75c7c4'),
('20261028095508','20261028095508_harden_forno_data_api.sql','b174b2cdeae79335d7fd3fcd1f579d7c51d8d38e4654023f5ed3c9283687d743')
 ) b(version,filename,sha256) loop
  select sha256 into stored from forno_private.manual_migrations where version=m.version;
  if stored is distinct from m.sha256 then raise exception 'BASELINE_CHECKSUM_MISMATCH: %',m.filename; end if;
 end loop;
 if (select count(*) from public.pizzas)<>13 then raise exception 'CATALOGUE_REVIEW_REQUIRED'; end if;
 if exists(select 1 from public.services where orders_enabled and service_date>=(clock_timestamp() at time zone 'Europe/Paris')::date) then raise exception 'CLOSE_CURRENT_SERVICES_FIRST'; end if;
 if exists(select 1 from public.services where id like 'forno-test-%') then raise exception 'SYNTHETIC_SERVICE_REFUSED'; end if;
 create table if not exists forno_private.production_environment(singleton boolean primary key default true check(singleton),project_ref text not null check(project_ref='fqjkkjvrklpzhwmswlsy'));
 alter table forno_private.production_environment enable row level security;
 revoke all on forno_private.production_environment from public,anon,authenticated,service_role;
 insert into forno_private.production_environment(project_ref) values('fqjkkjvrklpzhwmswlsy') on conflict(singleton) do nothing;
 -- BEGIN NATIVE PG_NET PREPARATION
 -- A fresh extension is installed directly in extensions; the historic relocation
 -- migration below becomes a no-op. Refuse to drop an existing installation.
 if exists(select 1 from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pg_net' and n.nspname<>'extensions') then raise exception 'PG_NET_SCHEMA_REVIEW_REQUIRED'; end if;
 create extension if not exists pg_net with schema extensions;
 -- END NATIVE PG_NET PREPARATION
 for m in select * from(values
('20261029091206','20261029091206_forno_private_admin.sql','d4d718c59a92800b47280e198b6eaa06cc4110648d0ed604141a4b14ca54844f', $migration_20261029091206$-- No administrator is seeded. Grants are owner-controlled, independent of user metadata.
create table forno_private.admin_users (
 user_id uuid primary key references auth.users(id) on delete cascade,
 active boolean not null default true, created_at timestamptz not null default now()
);
create table forno_private.admin_audit (
 id bigint generated always as identity primary key,
 actor_id uuid references auth.users(id) on delete set null,
 action text not null, resource_id text not null, changes jsonb not null,
 created_at timestamptz not null default now()
);
create index admin_audit_resource on forno_private.admin_audit(resource_id,created_at desc);
alter table forno_private.settings add column admin_revision bigint not null default 0;
alter table forno_private.admin_users enable row level security;
alter table forno_private.admin_audit enable row level security;
revoke all on forno_private.admin_users,forno_private.admin_audit from public,anon,authenticated,service_role;
revoke all on sequence forno_private.admin_audit_id_seq from public,anon,authenticated,service_role;

-- Called only after /auth/v1/user verified the access token server-side.
-- Also check the actual session row, so a revoked session cannot keep using a JWT.
create function forno_private.require_admin(p_actor uuid,p_session uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_actor is null or p_session is null or not exists(
  select 1 from forno_private.admin_users a join auth.sessions s on s.user_id=a.user_id
  where a.user_id=p_actor and a.active and s.id=p_session
    and (s.not_after is null or s.not_after>clock_timestamp())
 ) then raise exception 'ADMIN_FORBIDDEN'; end if;
end $$;
revoke all on function forno_private.require_admin(uuid,uuid) from public,anon,authenticated,service_role;

create function public.forno_admin_session(p_actor uuid,p_session uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin perform forno_private.require_admin(p_actor,p_session); return true; end $$;

create function public.forno_admin_read(p_actor uuid,p_session uuid,p_view text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare today date:=(clock_timestamp() at time zone 'Europe/Paris')::date; result jsonb;
begin
 perform forno_private.require_admin(p_actor,p_session);
 if p_view='orders' then
  select jsonb_build_object('date',today,'serverNow',clock_timestamp(),
   'service',(select jsonb_build_object('id',id,'village',village,'date',service_date,'openingTime',to_char(opening_time,'HH24:MI'),'closingTime',to_char(closing_time,'HH24:MI'),'status',status,'ordersEnabled',orders_enabled) from public.services where service_date=today),
   'orders',coalesce((select jsonb_agg(x.data order by x.priority,x.pickup,x.received) from (
    select jsonb_build_object('id',o.id,'reference',o.order_number,'status',case when o.status='pending' and o.pending_expires_at<=clock_timestamp() then 'cancelled' else o.status end,
     'expired',o.status='pending' and o.pending_expires_at<=clock_timestamp(),
     'pickupTime',to_char(ps.pickup_time,'HH24:MI'),'receivedAt',o.created_at,'expiresAt',o.pending_expires_at,
     'firstName',case when o.personal_data_purged_at is null then o.customer_first_name end,
     'lastName',case when o.personal_data_purged_at is null then o.customer_last_name end,
     'phone',case when o.personal_data_purged_at is null then o.customer_phone end,
     'note',case when o.personal_data_purged_at is null then o.customer_note end,'totalCents',o.total_cents,
     'lines',(select jsonb_agg(jsonb_build_object('name',pizza_name_snapshot,'quantity',quantity) order by pizza_name_snapshot) from public.order_items where order_id=o.id)) data,
     case when o.status='pending' and o.pending_expires_at>clock_timestamp() then 0 when o.status='accepted' then 1 when o.status='preparing' then 2 when o.status='ready' then 3 else 4 end priority,
     ps.pickup_time pickup,o.created_at received
    from public.orders o join public.services s on s.id=o.service_id join public.pickup_slots ps on ps.id=o.pickup_slot_id
    where s.service_date=today order by priority,ps.pickup_time,o.created_at limit 500
   )x),'[]'::jsonb)) into result;
 elsif p_view='planning' then
  select jsonb_build_object('services',coalesce(jsonb_agg(data order by service_date),'[]'::jsonb)) into result from (
   select s.service_date,jsonb_build_object('id',s.id,'date',s.service_date,'village',s.village,'status',s.status,'ordersEnabled',s.orders_enabled,'updatedAt',s.updated_at,
    'openingTime',to_char(s.opening_time,'HH24:MI'),'closingTime',to_char(s.closing_time,'HH24:MI'),
    'slots',coalesce((select jsonb_agg(jsonb_build_object('id',ps.id,'time',to_char(ps.pickup_time,'HH24:MI'),'capacity',ps.capacity,'enabled',ps.enabled,
     'used',(select coalesce(sum(pizza_count),0) from public.orders o where o.pickup_slot_id=ps.id and (o.status in ('accepted','preparing','ready','completed') or (o.status='pending' and o.pending_expires_at>clock_timestamp())))) order by ps.pickup_time)
     from public.pickup_slots ps where ps.service_id=s.id),'[]'::jsonb)) data
   from public.services s where s.service_date between today and today+90 order by s.service_date limit 90
  )x;
 elsif p_view='settings' then
  select jsonb_build_object('minimumLeadMinutes',minimum_lead_minutes,'defaultSlotCapacity',default_slot_capacity,'slotIntervalMinutes',slot_interval_minutes,'revision',admin_revision) into result from forno_private.settings;
 else raise exception 'ADMIN_INVALID'; end if;
 return result;
end $$;

create function public.forno_admin_change(p_actor uuid,p_session uuid,p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.orders; s public.services; ps public.pickup_slots; cfg forno_private.settings;
 new_status text; before_data jsonb; after_data jsonb; resource text; used integer; new_capacity integer; op time; cl time; t timestamptz;
begin
 perform forno_private.require_admin(p_actor,p_session);
 if jsonb_typeof(p_data) is distinct from 'object' then raise exception 'ADMIN_INVALID'; end if;
 if p_action='transition' then
  -- Same lock order as checkout: service -> slot -> order. Read IDs without locking first.
  select * into o from public.orders where id=(p_data->>'id')::uuid;
  if not found then raise exception 'ADMIN_NOT_FOUND'; end if;
  perform 1 from public.services where id=o.service_id for update;
  perform 1 from public.pickup_slots where id=o.pickup_slot_id for update;
  select * into o from public.orders where id=o.id for update;
  new_status=p_data->>'status';
  if o.status is distinct from p_data->>'expected' then raise exception 'ADMIN_CONFLICT'; end if;
  if o.status='pending' and o.pending_expires_at<=clock_timestamp() then raise exception 'ADMIN_EXPIRED'; end if;
  if not coalesce((o.status='pending' and new_status in ('accepted','rejected')) or
   (o.status='accepted' and new_status='preparing') or (o.status='preparing' and new_status='ready') or
   (o.status='ready' and new_status='completed'),false) then raise exception 'ADMIN_TRANSITION'; end if;
  update public.orders set status=new_status where id=o.id and status=o.status;
  before_data=jsonb_build_object('status',o.status);after_data=jsonb_build_object('status',new_status);resource=o.id::text;
 elsif p_action in ('open','close','cancel','hours','capacity') then
  select * into s from public.services where id=p_data->>'id' for update;
  t=clock_timestamp();
  if not found then raise exception 'ADMIN_NOT_FOUND'; end if;
  if s.service_date<(t at time zone 'Europe/Paris')::date then raise exception 'ADMIN_PAST'; end if;
  if s.updated_at is distinct from (p_data->>'expectedUpdatedAt')::timestamptz then raise exception 'ADMIN_CONFLICT'; end if;
  resource=s.id;
  if p_action in ('open','close','cancel') then
   if s.status='cancelled' then raise exception 'ADMIN_CONFLICT'; end if;
   if p_action='open' then
    -- Opening is allowed only on an explicitly marked Test database. Never Production.
    if to_regclass('forno_private.test_environment') is null then raise exception 'ADMIN_OPEN_LOCKED'; end if;
    if not exists(select 1 from forno_private.test_environment where project_ref='brzcvncsycdpsrvulqss') then raise exception 'ADMIN_OPEN_LOCKED'; end if;
    if t >= (s.service_date+s.closing_time) at time zone 'Europe/Paris' then raise exception 'ADMIN_PAST'; end if;
   end if;
   if p_action='cancel' and exists(select 1 from public.orders where service_id=s.id and (status in ('accepted','preparing','ready') or (status='pending' and pending_expires_at>t))) then raise exception 'ADMIN_ACTIVE_ORDERS'; end if;
   before_data=jsonb_build_object('status',s.status,'ordersEnabled',s.orders_enabled);
   update public.services set orders_enabled=(p_action='open'),status=case when p_action='cancel' then 'cancelled' when p_action='open' then 'open' else status end where id=s.id returning * into s;
   after_data=jsonb_build_object('status',s.status,'ordersEnabled',s.orders_enabled);
  elsif p_action='hours' then
   if s.status='cancelled' or s.service_date<=(t at time zone 'Europe/Paris')::date then raise exception 'ADMIN_PAST'; end if;
   if exists(select 1 from public.orders where service_id=s.id) then raise exception 'ADMIN_HAS_ORDERS'; end if;
   if coalesce(p_data->>'openingTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(p_data->>'closingTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'ADMIN_INVALID'; end if;
   op=(p_data->>'openingTime')::time;cl=(p_data->>'closingTime')::time;
   select * into cfg from forno_private.settings for share;
   if op>=cl or cl-op<make_interval(mins=>cfg.closing_margin_minutes+cfg.slot_interval_minutes) then raise exception 'ADMIN_INVALID'; end if;
   before_data=jsonb_build_object('openingTime',s.opening_time,'closingTime',s.closing_time);
   update public.services set opening_time=op,closing_time=cl where id=s.id;
   -- Preserve existing rows; historical slot IDs are never deleted.
   update public.pickup_slots set enabled=false where service_id=s.id;
   insert into public.pickup_slots(id,service_id,pickup_time,capacity,enabled)
    select s.id||'@'||to_char(g,'HH24:MI'),s.id,g::time,cfg.default_slot_capacity,true
    from generate_series(s.service_date+op,s.service_date+cl-make_interval(mins=>cfg.closing_margin_minutes),make_interval(mins=>cfg.slot_interval_minutes)) g
    on conflict(service_id,pickup_time) do update set enabled=true;
   after_data=jsonb_build_object('openingTime',op,'closingTime',cl);
  else
   select * into ps from public.pickup_slots where id=p_data->>'slotId' and service_id=s.id for update;
   if not found then raise exception 'ADMIN_NOT_FOUND'; end if;
   if (s.service_date+ps.pickup_time) at time zone 'Europe/Paris'<=t then raise exception 'ADMIN_PAST'; end if;
   if jsonb_typeof(p_data->'capacity') is distinct from 'number' or coalesce(p_data->>'capacity','') !~ '^[1-9][0-9]{0,2}$' then raise exception 'ADMIN_INVALID'; end if;
   new_capacity=(p_data->>'capacity')::integer;
   if new_capacity>200 then raise exception 'ADMIN_INVALID'; end if;
   if ps.capacity is distinct from (p_data->>'expectedCapacity')::integer then raise exception 'ADMIN_CONFLICT'; end if;
   select coalesce(sum(pizza_count),0) into used from public.orders where pickup_slot_id=ps.id and (status in ('accepted','preparing','ready','completed') or (status='pending' and pending_expires_at>t));
   if new_capacity<used then raise exception 'ADMIN_CAPACITY'; end if;
   update public.pickup_slots set capacity=new_capacity where id=ps.id;
   resource=ps.id;before_data=jsonb_build_object('capacity',ps.capacity);after_data=jsonb_build_object('capacity',new_capacity);
  end if;
 elsif p_action='settings' then
  select * into cfg from forno_private.settings for update;
  if cfg.admin_revision is distinct from (p_data->>'revision')::bigint then raise exception 'ADMIN_CONFLICT'; end if;
  if coalesce(p_data->>'minimumLeadMinutes','') !~ '^[0-9]{1,3}$' or coalesce(p_data->>'defaultSlotCapacity','') !~ '^[1-9][0-9]{0,2}$' or coalesce(p_data->>'slotIntervalMinutes','') !~ '^[1-9][0-9]?$' then raise exception 'ADMIN_INVALID'; end if;
  if exists(select 1 from public.orders where status in ('accepted','preparing','ready') or (status='pending' and pending_expires_at>clock_timestamp())) and cfg.minimum_lead_minutes<>(p_data->>'minimumLeadMinutes')::integer then raise exception 'ADMIN_ACTIVE_ORDERS'; end if;
  before_data=jsonb_build_object('minimumLeadMinutes',cfg.minimum_lead_minutes,'defaultSlotCapacity',cfg.default_slot_capacity,'slotIntervalMinutes',cfg.slot_interval_minutes);
  update forno_private.settings set minimum_lead_minutes=(p_data->>'minimumLeadMinutes')::integer,default_slot_capacity=(p_data->>'defaultSlotCapacity')::integer,slot_interval_minutes=(p_data->>'slotIntervalMinutes')::integer,admin_revision=admin_revision+1;
  after_data=jsonb_build_object('minimumLeadMinutes',(p_data->>'minimumLeadMinutes')::integer,'defaultSlotCapacity',(p_data->>'defaultSlotCapacity')::integer,'slotIntervalMinutes',(p_data->>'slotIntervalMinutes')::integer);resource='settings';
 else raise exception 'ADMIN_INVALID'; end if;
 insert into forno_private.admin_audit(actor_id,action,resource_id,changes) values(p_actor,p_action,resource,jsonb_build_object('before',before_data,'after',after_data));
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.forno_admin_session(uuid,uuid),public.forno_admin_read(uuid,uuid,text),public.forno_admin_change(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.forno_admin_session(uuid,uuid),public.forno_admin_read(uuid,uuid,text),public.forno_admin_change(uuid,uuid,text,jsonb) to service_role;
$migration_20261029091206$),
('20261029092544','20261029092544_harden_admin_settings_concurrency.sql','1a346feb51ed830383acc47c819da9eeb5eeed9328d818ef2a3f374a9fe8d1bf', $migration_20261029092544$-- Atomic expiry check and serialization of live preparation-rule changes. No seed data.
create or replace function public.forno_admin_change(p_actor uuid,p_session uuid,p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.orders; s public.services; ps public.pickup_slots; cfg forno_private.settings;
 new_status text; before_data jsonb; after_data jsonb; resource text; used integer; new_capacity integer; op time; cl time; t timestamptz;
begin
 perform forno_private.require_admin(p_actor,p_session);
 if jsonb_typeof(p_data) is distinct from 'object' then raise exception 'ADMIN_INVALID'; end if;
 if p_action='transition' then
  -- Same lock order as checkout: service -> slot -> order. Read IDs without locking first.
  select * into o from public.orders where id=(p_data->>'id')::uuid;
  if not found then raise exception 'ADMIN_NOT_FOUND'; end if;
  perform 1 from public.services where id=o.service_id for update;
  perform 1 from public.pickup_slots where id=o.pickup_slot_id for update;
  select * into o from public.orders where id=o.id for update;
  new_status=p_data->>'status';
  if o.status is distinct from p_data->>'expected' then raise exception 'ADMIN_CONFLICT'; end if;
  if o.status='pending' and o.pending_expires_at<=clock_timestamp() then raise exception 'ADMIN_EXPIRED'; end if;
  if not coalesce((o.status='pending' and new_status in ('accepted','rejected')) or
   (o.status='accepted' and new_status='preparing') or (o.status='preparing' and new_status='ready') or
   (o.status='ready' and new_status='completed'),false) then raise exception 'ADMIN_TRANSITION'; end if;
  update public.orders set status=new_status where id=o.id and status=o.status
   and (status<>'pending' or pending_expires_at>clock_timestamp());
  if not found then raise exception 'ADMIN_EXPIRED'; end if;
  before_data=jsonb_build_object('status',o.status);after_data=jsonb_build_object('status',new_status);resource=o.id::text;
 elsif p_action in ('open','close','cancel','hours','capacity') then
  select * into s from public.services where id=p_data->>'id' for update;
  t=clock_timestamp();
  if not found then raise exception 'ADMIN_NOT_FOUND'; end if;
  if s.service_date<(t at time zone 'Europe/Paris')::date then raise exception 'ADMIN_PAST'; end if;
  if s.updated_at is distinct from (p_data->>'expectedUpdatedAt')::timestamptz then raise exception 'ADMIN_CONFLICT'; end if;
  resource=s.id;
  if p_action in ('open','close','cancel') then
   if s.status='cancelled' then raise exception 'ADMIN_CONFLICT'; end if;
   if p_action='open' then
    -- Opening is allowed only on an explicitly marked Test database. Never Production.
    if to_regclass('forno_private.test_environment') is null then raise exception 'ADMIN_OPEN_LOCKED'; end if;
    if not exists(select 1 from forno_private.test_environment where project_ref='brzcvncsycdpsrvulqss') then raise exception 'ADMIN_OPEN_LOCKED'; end if;
    if t >= (s.service_date+s.closing_time) at time zone 'Europe/Paris' then raise exception 'ADMIN_PAST'; end if;
   end if;
   if p_action='cancel' and exists(select 1 from public.orders where service_id=s.id and (status in ('accepted','preparing','ready') or (status='pending' and pending_expires_at>t))) then raise exception 'ADMIN_ACTIVE_ORDERS'; end if;
   before_data=jsonb_build_object('status',s.status,'ordersEnabled',s.orders_enabled);
   update public.services set orders_enabled=(p_action='open'),status=case when p_action='cancel' then 'cancelled' when p_action='open' then 'open' else status end where id=s.id returning * into s;
   after_data=jsonb_build_object('status',s.status,'ordersEnabled',s.orders_enabled);
  elsif p_action='hours' then
   if s.status='cancelled' or s.service_date<=(t at time zone 'Europe/Paris')::date then raise exception 'ADMIN_PAST'; end if;
   if exists(select 1 from public.orders where service_id=s.id) then raise exception 'ADMIN_HAS_ORDERS'; end if;
   if coalesce(p_data->>'openingTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(p_data->>'closingTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'ADMIN_INVALID'; end if;
   op=(p_data->>'openingTime')::time;cl=(p_data->>'closingTime')::time;
   select * into cfg from forno_private.settings for share;
   if op>=cl or cl-op<make_interval(mins=>cfg.closing_margin_minutes+cfg.slot_interval_minutes) then raise exception 'ADMIN_INVALID'; end if;
   before_data=jsonb_build_object('openingTime',s.opening_time,'closingTime',s.closing_time);
   update public.services set opening_time=op,closing_time=cl where id=s.id;
   -- Preserve existing rows; historical slot IDs are never deleted.
   update public.pickup_slots set enabled=false where service_id=s.id;
   insert into public.pickup_slots(id,service_id,pickup_time,capacity,enabled)
    select s.id||'@'||to_char(g,'HH24:MI'),s.id,g::time,cfg.default_slot_capacity,true
    from generate_series(s.service_date+op,s.service_date+cl-make_interval(mins=>cfg.closing_margin_minutes),make_interval(mins=>cfg.slot_interval_minutes)) g
    on conflict(service_id,pickup_time) do update set enabled=true;
   after_data=jsonb_build_object('openingTime',op,'closingTime',cl);
  else
   select * into ps from public.pickup_slots where id=p_data->>'slotId' and service_id=s.id for update;
   if not found then raise exception 'ADMIN_NOT_FOUND'; end if;
   if (s.service_date+ps.pickup_time) at time zone 'Europe/Paris'<=t then raise exception 'ADMIN_PAST'; end if;
   if jsonb_typeof(p_data->'capacity') is distinct from 'number' or coalesce(p_data->>'capacity','') !~ '^[1-9][0-9]{0,2}$' then raise exception 'ADMIN_INVALID'; end if;
   new_capacity=(p_data->>'capacity')::integer;
   if new_capacity>200 then raise exception 'ADMIN_INVALID'; end if;
   if ps.capacity is distinct from (p_data->>'expectedCapacity')::integer then raise exception 'ADMIN_CONFLICT'; end if;
   select coalesce(sum(pizza_count),0) into used from public.orders where pickup_slot_id=ps.id and (status in ('accepted','preparing','ready','completed') or (status='pending' and pending_expires_at>t));
   if new_capacity<used then raise exception 'ADMIN_CAPACITY'; end if;
   update public.pickup_slots set capacity=new_capacity where id=ps.id;
   resource=ps.id;before_data=jsonb_build_object('capacity',ps.capacity);after_data=jsonb_build_object('capacity',new_capacity);
  end if;
 elsif p_action='settings' then
  -- Match checkout/hours lock order. Close services before changing the live delay,
  -- so an in-flight checkout cannot commit using an obsolete preparation rule.
  perform 1 from public.services where service_date>=(clock_timestamp() at time zone 'Europe/Paris')::date order by id for update;
  select * into cfg from forno_private.settings for update;
  if cfg.admin_revision is distinct from (p_data->>'revision')::bigint then raise exception 'ADMIN_CONFLICT'; end if;
  if coalesce(p_data->>'minimumLeadMinutes','') !~ '^[0-9]{1,3}$' or coalesce(p_data->>'defaultSlotCapacity','') !~ '^[1-9][0-9]{0,2}$' or coalesce(p_data->>'slotIntervalMinutes','') !~ '^[1-9][0-9]?$' then raise exception 'ADMIN_INVALID'; end if;
  if cfg.minimum_lead_minutes<>(p_data->>'minimumLeadMinutes')::integer and exists(select 1 from public.services where service_date>=(clock_timestamp() at time zone 'Europe/Paris')::date and orders_enabled) then raise exception 'ADMIN_OPEN_SERVICES'; end if;
  if exists(select 1 from public.orders where status in ('accepted','preparing','ready') or (status='pending' and pending_expires_at>clock_timestamp())) and cfg.minimum_lead_minutes<>(p_data->>'minimumLeadMinutes')::integer then raise exception 'ADMIN_ACTIVE_ORDERS'; end if;
  before_data=jsonb_build_object('minimumLeadMinutes',cfg.minimum_lead_minutes,'defaultSlotCapacity',cfg.default_slot_capacity,'slotIntervalMinutes',cfg.slot_interval_minutes);
  update forno_private.settings set minimum_lead_minutes=(p_data->>'minimumLeadMinutes')::integer,default_slot_capacity=(p_data->>'defaultSlotCapacity')::integer,slot_interval_minutes=(p_data->>'slotIntervalMinutes')::integer,admin_revision=admin_revision+1;
  after_data=jsonb_build_object('minimumLeadMinutes',(p_data->>'minimumLeadMinutes')::integer,'defaultSlotCapacity',(p_data->>'defaultSlotCapacity')::integer,'slotIntervalMinutes',(p_data->>'slotIntervalMinutes')::integer);resource='settings';
 else raise exception 'ADMIN_INVALID'; end if;
 insert into forno_private.admin_audit(actor_id,action,resource_id,changes) values(p_actor,p_action,resource,jsonb_build_object('before',before_data,'after',after_data));
 return jsonb_build_object('ok',true);
end $$;
$migration_20261029092544$),
('20261030051016','20261030051016_fix_admin_singleton_update.sql','525d6cf3603f08ef992c622fe327183236b3ca31bbc0340335579b3d66cb7e00', $migration_20261030051016$-- Explicit singleton predicate: compatible with PostgREST safeupdate and revision checks.
create or replace function public.forno_admin_change(p_actor uuid,p_session uuid,p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.orders; s public.services; ps public.pickup_slots; cfg forno_private.settings;
 new_status text; before_data jsonb; after_data jsonb; resource text; used integer; new_capacity integer; op time; cl time; t timestamptz;
begin
 perform forno_private.require_admin(p_actor,p_session);
 if jsonb_typeof(p_data) is distinct from 'object' then raise exception 'ADMIN_INVALID'; end if;
 if p_action='transition' then
  -- Same lock order as checkout: service -> slot -> order. Read IDs without locking first.
  select * into o from public.orders where id=(p_data->>'id')::uuid;
  if not found then raise exception 'ADMIN_NOT_FOUND'; end if;
  perform 1 from public.services where id=o.service_id for update;
  perform 1 from public.pickup_slots where id=o.pickup_slot_id for update;
  select * into o from public.orders where id=o.id for update;
  new_status=p_data->>'status';
  if o.status is distinct from p_data->>'expected' then raise exception 'ADMIN_CONFLICT'; end if;
  if o.status='pending' and o.pending_expires_at<=clock_timestamp() then raise exception 'ADMIN_EXPIRED'; end if;
  if not coalesce((o.status='pending' and new_status in ('accepted','rejected')) or
   (o.status='accepted' and new_status='preparing') or (o.status='preparing' and new_status='ready') or
   (o.status='ready' and new_status='completed'),false) then raise exception 'ADMIN_TRANSITION'; end if;
  update public.orders set status=new_status where id=o.id and status=o.status
   and (status<>'pending' or pending_expires_at>clock_timestamp());
  if not found then raise exception 'ADMIN_EXPIRED'; end if;
  before_data=jsonb_build_object('status',o.status);after_data=jsonb_build_object('status',new_status);resource=o.id::text;
 elsif p_action in ('open','close','cancel','hours','capacity') then
  select * into s from public.services where id=p_data->>'id' for update;
  t=clock_timestamp();
  if not found then raise exception 'ADMIN_NOT_FOUND'; end if;
  if s.service_date<(t at time zone 'Europe/Paris')::date then raise exception 'ADMIN_PAST'; end if;
  if s.updated_at is distinct from (p_data->>'expectedUpdatedAt')::timestamptz then raise exception 'ADMIN_CONFLICT'; end if;
  resource=s.id;
  if p_action in ('open','close','cancel') then
   if s.status='cancelled' then raise exception 'ADMIN_CONFLICT'; end if;
   if p_action='open' then
    -- Opening is allowed only on an explicitly marked Test database. Never Production.
    if to_regclass('forno_private.test_environment') is null then raise exception 'ADMIN_OPEN_LOCKED'; end if;
    if not exists(select 1 from forno_private.test_environment where project_ref='brzcvncsycdpsrvulqss') then raise exception 'ADMIN_OPEN_LOCKED'; end if;
    if t >= (s.service_date+s.closing_time) at time zone 'Europe/Paris' then raise exception 'ADMIN_PAST'; end if;
   end if;
   if p_action='cancel' and exists(select 1 from public.orders where service_id=s.id and (status in ('accepted','preparing','ready') or (status='pending' and pending_expires_at>t))) then raise exception 'ADMIN_ACTIVE_ORDERS'; end if;
   before_data=jsonb_build_object('status',s.status,'ordersEnabled',s.orders_enabled);
   update public.services set orders_enabled=(p_action='open'),status=case when p_action='cancel' then 'cancelled' when p_action='open' then 'open' else status end where id=s.id returning * into s;
   after_data=jsonb_build_object('status',s.status,'ordersEnabled',s.orders_enabled);
  elsif p_action='hours' then
   if s.status='cancelled' or s.service_date<=(t at time zone 'Europe/Paris')::date then raise exception 'ADMIN_PAST'; end if;
   if exists(select 1 from public.orders where service_id=s.id) then raise exception 'ADMIN_HAS_ORDERS'; end if;
   if coalesce(p_data->>'openingTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(p_data->>'closingTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'ADMIN_INVALID'; end if;
   op=(p_data->>'openingTime')::time;cl=(p_data->>'closingTime')::time;
   select * into cfg from forno_private.settings for share;
   if op>=cl or cl-op<make_interval(mins=>cfg.closing_margin_minutes+cfg.slot_interval_minutes) then raise exception 'ADMIN_INVALID'; end if;
   before_data=jsonb_build_object('openingTime',s.opening_time,'closingTime',s.closing_time);
   update public.services set opening_time=op,closing_time=cl where id=s.id;
   -- Preserve existing rows; historical slot IDs are never deleted.
   update public.pickup_slots set enabled=false where service_id=s.id;
   insert into public.pickup_slots(id,service_id,pickup_time,capacity,enabled)
    select s.id||'@'||to_char(g,'HH24:MI'),s.id,g::time,cfg.default_slot_capacity,true
    from generate_series(s.service_date+op,s.service_date+cl-make_interval(mins=>cfg.closing_margin_minutes),make_interval(mins=>cfg.slot_interval_minutes)) g
    on conflict(service_id,pickup_time) do update set enabled=true;
   after_data=jsonb_build_object('openingTime',op,'closingTime',cl);
  else
   select * into ps from public.pickup_slots where id=p_data->>'slotId' and service_id=s.id for update;
   if not found then raise exception 'ADMIN_NOT_FOUND'; end if;
   if (s.service_date+ps.pickup_time) at time zone 'Europe/Paris'<=t then raise exception 'ADMIN_PAST'; end if;
   if jsonb_typeof(p_data->'capacity') is distinct from 'number' or coalesce(p_data->>'capacity','') !~ '^[1-9][0-9]{0,2}$' then raise exception 'ADMIN_INVALID'; end if;
   new_capacity=(p_data->>'capacity')::integer;
   if new_capacity>200 then raise exception 'ADMIN_INVALID'; end if;
   if ps.capacity is distinct from (p_data->>'expectedCapacity')::integer then raise exception 'ADMIN_CONFLICT'; end if;
   select coalesce(sum(pizza_count),0) into used from public.orders where pickup_slot_id=ps.id and (status in ('accepted','preparing','ready','completed') or (status='pending' and pending_expires_at>t));
   if new_capacity<used then raise exception 'ADMIN_CAPACITY'; end if;
   update public.pickup_slots set capacity=new_capacity where id=ps.id;
   resource=ps.id;before_data=jsonb_build_object('capacity',ps.capacity);after_data=jsonb_build_object('capacity',new_capacity);
  end if;
 elsif p_action='settings' then
  -- Match checkout/hours lock order. Close services before changing the live delay,
  -- so an in-flight checkout cannot commit using an obsolete preparation rule.
  perform 1 from public.services where service_date>=(clock_timestamp() at time zone 'Europe/Paris')::date order by id for update;
  select * into cfg from forno_private.settings for update;
  if cfg.admin_revision is distinct from (p_data->>'revision')::bigint then raise exception 'ADMIN_CONFLICT'; end if;
  if coalesce(p_data->>'minimumLeadMinutes','') !~ '^[0-9]{1,3}$' or coalesce(p_data->>'defaultSlotCapacity','') !~ '^[1-9][0-9]{0,2}$' or coalesce(p_data->>'slotIntervalMinutes','') !~ '^[1-9][0-9]?$' then raise exception 'ADMIN_INVALID'; end if;
  if cfg.minimum_lead_minutes<>(p_data->>'minimumLeadMinutes')::integer and exists(select 1 from public.services where service_date>=(clock_timestamp() at time zone 'Europe/Paris')::date and orders_enabled) then raise exception 'ADMIN_OPEN_SERVICES'; end if;
  if exists(select 1 from public.orders where status in ('accepted','preparing','ready') or (status='pending' and pending_expires_at>clock_timestamp())) and cfg.minimum_lead_minutes<>(p_data->>'minimumLeadMinutes')::integer then raise exception 'ADMIN_ACTIVE_ORDERS'; end if;
  before_data=jsonb_build_object('minimumLeadMinutes',cfg.minimum_lead_minutes,'defaultSlotCapacity',cfg.default_slot_capacity,'slotIntervalMinutes',cfg.slot_interval_minutes);
  update forno_private.settings set minimum_lead_minutes=(p_data->>'minimumLeadMinutes')::integer,default_slot_capacity=(p_data->>'defaultSlotCapacity')::integer,slot_interval_minutes=(p_data->>'slotIntervalMinutes')::integer,admin_revision=admin_revision+1
   where singleton=true and admin_revision=cfg.admin_revision;
  if not found then raise exception 'ADMIN_CONFLICT'; end if;
  after_data=jsonb_build_object('minimumLeadMinutes',(p_data->>'minimumLeadMinutes')::integer,'defaultSlotCapacity',(p_data->>'defaultSlotCapacity')::integer,'slotIntervalMinutes',(p_data->>'slotIntervalMinutes')::integer);resource='settings';
 else raise exception 'ADMIN_INVALID'; end if;
 insert into forno_private.admin_audit(actor_id,action,resource_id,changes) values(p_actor,p_action,resource,jsonb_build_object('before',before_data,'after',after_data));
 return jsonb_build_object('ok',true);
end $$;
$migration_20261030051016$),
('20261030055421','20261030055421_forno_push_outbox.sql','b00a4af4ccacb67723b0af0e6948dac0e7fc4639292e5ab1f6e90a34521d643d', $migration_20261030055421$-- Private push capability; disabled until the isolated environment is configured.
create table forno_private.push_config (
 singleton boolean primary key default true check(singleton), enabled boolean not null default false,
 worker_url text, worker_secret_id uuid, worker_hash bytea, vapid_secret_id uuid, vapid_public_key text,
 vapid_subject text, last_wake_at timestamptz,
 check(worker_url is null or worker_url ~ '^https://[a-z0-9]{20}\.supabase\.co/functions/v1/forno-push-worker$'),
 check(vapid_public_key is null or vapid_public_key ~ '^[A-Za-z0-9_-]{87}$')
);
insert into forno_private.push_config default values;
create table forno_private.push_subscriptions (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references forno_private.admin_users(user_id) on delete cascade,
 endpoint text, endpoint_hash bytea unique, p256dh text, auth_key text,
 label text not null check(length(label) between 1 and 80), active boolean not null default true,
 created_at timestamptz not null default now(), activated_at timestamptz not null default now(), last_used_at timestamptz,
 last_test_at timestamptz, revoked_at timestamptz, revoked_reason text,
 check(not active or (endpoint is not null and p256dh is not null and auth_key is not null))
);
create index push_subscriptions_owner on forno_private.push_subscriptions(owner_id,active);
create table forno_private.push_events (
 id uuid primary key default gen_random_uuid(), order_id uuid unique references public.orders(id) on delete cascade,
 kind text not null check(kind in ('orders','test')),
 target_device uuid references forno_private.push_subscriptions(id) on delete cascade,
 created_at timestamptz not null default now(), expires_at timestamptz not null,
 check((kind='orders' and order_id is not null and target_device is null) or (kind='test' and order_id is null and target_device is not null))
);
create index push_events_expiry on forno_private.push_events(expires_at);
create table forno_private.push_deliveries (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references forno_private.push_events(id) on delete cascade,
 device_id uuid not null references forno_private.push_subscriptions(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','processing','sent','cancelled','failed')),
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
 lease uuid, lease_until timestamptz, provider_status integer, last_error text,
 sent_at timestamptz, unique(event_id,device_id)
);
create index push_delivery_due on forno_private.push_deliveries(next_attempt_at) where status in ('pending','processing');
alter table forno_private.push_config enable row level security;
alter table forno_private.push_subscriptions enable row level security;
alter table forno_private.push_events enable row level security;
alter table forno_private.push_deliveries enable row level security;
revoke all on forno_private.push_config,forno_private.push_subscriptions,forno_private.push_events,forno_private.push_deliveries from public,anon,authenticated,service_role;

create function forno_private.push_revoke(p_device uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 update forno_private.push_subscriptions set active=false,endpoint=null,endpoint_hash=null,p256dh=null,auth_key=null,revoked_at=clock_timestamp(),revoked_reason=p_reason where id=p_device;
 update forno_private.push_deliveries set status='cancelled',lease=null,lease_until=null where device_id=p_device and status in ('pending','processing');
end $$;
create function forno_private.push_admin_revoked() returns trigger language plpgsql security definer set search_path='' as $$
declare device record;
begin
 if not new.active then for device in select id from forno_private.push_subscriptions where owner_id=new.user_id and active order by id for update loop perform forno_private.push_revoke(device.id,'admin_revoked'); end loop; end if;
 return new;
end $$;
create trigger admin_push_revoked after update of active on forno_private.admin_users for each row execute function forno_private.push_admin_revoked();

-- Stub replaced by pg_net integration. The outbox itself is independent of networking.
create function forno_private.wake_push_worker() returns void language plpgsql security definer set search_path='' as $$begin return; end $$;
create function forno_private.push_order_inserted() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='pending' then
  insert into forno_private.push_events(order_id,kind,expires_at) values(new.id,'orders',new.pending_expires_at) on conflict(order_id) do nothing;
  -- A wake failure never rolls back checkout: the durable outbox is retried by the scheduler.
  begin perform forno_private.wake_push_worker();exception when others then null;end;
 end if;
 return new;
end $$;
create trigger order_push_outbox after insert on public.orders for each row execute function forno_private.push_order_inserted();

create function public.forno_push_admin(p_actor uuid,p_session uuid,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg forno_private.push_config; sub forno_private.push_subscriptions; endpoint_value text; hash bytea; device uuid;
begin
 perform forno_private.require_admin(p_actor,p_session);
 select * into cfg from forno_private.push_config;
 if p_action='status' then
  return jsonb_build_object('enabled',cfg.enabled,'ready',cfg.enabled and cfg.vapid_public_key is not null,'publicKey',cfg.vapid_public_key,
   'devices',coalesce((select jsonb_agg(jsonb_build_object('id',id,'label',label,'active',active,'createdAt',created_at,'lastUsedAt',last_used_at,'reason',revoked_reason) order by created_at desc) from forno_private.push_subscriptions where owner_id=p_actor),'[]'::jsonb));
 end if;
 if p_action='revoke' then
  select * into sub from forno_private.push_subscriptions where id=(p_data->>'deviceId')::uuid and owner_id=p_actor for update;
  if not found then raise exception 'PUSH_FORBIDDEN'; end if;
  perform forno_private.push_revoke(sub.id,'owner_removed');return jsonb_build_object('ok',true);
 end if;
 if not cfg.enabled then raise exception 'PUSH_DISABLED'; end if;
 if cfg.vapid_public_key is null then raise exception 'PUSH_NOT_READY'; end if;
 if p_action='subscribe' then
  endpoint_value=p_data->>'endpoint';
  if coalesce(endpoint_value,'') !~ '^https://(fcm\.googleapis\.com|([a-zA-Z0-9-]+\.)*push\.services\.mozilla\.com|([a-zA-Z0-9-]+\.)*push\.apple\.com|([a-zA-Z0-9-]+\.)+notify\.windows\.com)/[^[:space:]]+$'
   or length(endpoint_value)>2048 or coalesce(p_data->>'p256dh','') !~ '^[A-Za-z0-9_-]{87}$' or coalesce(p_data->>'auth','') !~ '^[A-Za-z0-9_-]{22}$'
   or length(btrim(coalesce(p_data->>'label',''))) not between 1 and 80 then raise exception 'PUSH_INVALID'; end if;
  hash=sha256(convert_to(endpoint_value,'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended('push:'||p_actor::text,0));
  select * into sub from forno_private.push_subscriptions where endpoint_hash=hash for update;
  if found then
   if sub.owner_id<>p_actor then raise exception 'PUSH_CONFLICT'; end if;
   update forno_private.push_subscriptions set p256dh=p_data->>'p256dh',auth_key=p_data->>'auth',label=btrim(p_data->>'label'),last_used_at=clock_timestamp() where id=sub.id;
   return jsonb_build_object('deviceId',sub.id);
  end if;
  if (select count(*) from forno_private.push_subscriptions where owner_id=p_actor and active)>=10 then raise exception 'PUSH_DEVICE_LIMIT'; end if;
  insert into forno_private.push_subscriptions(owner_id,endpoint,endpoint_hash,p256dh,auth_key,label) values(p_actor,endpoint_value,hash,p_data->>'p256dh',p_data->>'auth',btrim(p_data->>'label')) returning id into device;
  return jsonb_build_object('deviceId',device);
 elsif p_action='test' then
  select * into sub from forno_private.push_subscriptions where id=(p_data->>'deviceId')::uuid and owner_id=p_actor and active for update;
  if not found then raise exception 'PUSH_FORBIDDEN'; end if;
  if sub.last_test_at>clock_timestamp()-interval '1 minute' then raise exception 'PUSH_RATE_LIMITED'; end if;
  update forno_private.push_subscriptions set last_test_at=clock_timestamp() where id=sub.id;
  insert into forno_private.push_events(kind,target_device,expires_at) values('test',sub.id,clock_timestamp()+interval '5 minutes');
  begin perform forno_private.wake_push_worker();exception when others then null;end;
  return jsonb_build_object('queued',true);
 end if;
 raise exception 'PUSH_INVALID';
end $$;

create function forno_private.require_push_worker(p_token text) returns void language plpgsql security definer set search_path='' as $$
begin
 if coalesce(p_token,'') !~ '^[a-f0-9]{64}$' or not exists(select 1 from forno_private.push_config where enabled and worker_hash=sha256(convert_to(p_token,'UTF8'))) then raise exception 'PUSH_WORKER_FORBIDDEN'; end if;
end $$;

create function public.forno_push_worker(p_token text,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg forno_private.push_config; sub forno_private.push_subscriptions; ids uuid[]; token uuid; picked_kind text; rows jsonb; code integer; delay_seconds integer;
begin
 perform forno_private.require_push_worker(p_token);
 if p_action='claim' then
  -- Independent of request delivery. Exactly one logical delivery per event/device.
  insert into forno_private.push_deliveries(event_id,device_id)
   select e.id,s.id from forno_private.push_events e join forno_private.push_subscriptions s on s.active
    join forno_private.admin_users a on a.user_id=s.owner_id and a.active
    left join public.orders o on o.id=e.order_id
   where e.expires_at>clock_timestamp() and
    ((e.kind='orders' and s.activated_at<=e.created_at and o.status='pending' and o.pending_expires_at>clock_timestamp()) or(e.kind='test' and e.target_device=s.id))
   on conflict(event_id,device_id) do nothing;
  -- Lock one device before its deliveries, consistently with revoke/finish. Never
  -- lock delivery rows globally before device rows: concurrent revocation must not deadlock.
  select s.* into sub from forno_private.push_subscriptions s join forno_private.admin_users a on a.user_id=s.owner_id and a.active
   where s.active and exists(select 1 from forno_private.push_deliveries d where d.device_id=s.id and
    ((d.status='pending' and d.next_attempt_at<=clock_timestamp()) or(d.status='processing' and d.lease_until<=clock_timestamp())))
   order by s.last_used_at nulls first,s.id for update of s skip locked limit 1;
  if not found then return null; end if;
  update forno_private.push_deliveries set status='pending',lease=null,lease_until=null where device_id=sub.id and status='processing' and lease_until<=clock_timestamp() and attempts<6;
  update forno_private.push_deliveries set status='failed',last_error='ATTEMPTS_EXHAUSTED',lease=null,lease_until=null where device_id=sub.id and attempts>=6 and (status='pending' or(status='processing' and lease_until<=clock_timestamp()));
  update forno_private.push_deliveries d set status='cancelled',lease=null,lease_until=null where device_id=sub.id and status in ('pending','processing') and exists(
   select 1 from forno_private.push_events e left join public.orders o on o.id=e.order_id
   where e.id=d.event_id and (e.expires_at<=clock_timestamp() or (e.kind='orders' and (o.status<>'pending' or o.pending_expires_at<=clock_timestamp()))));
  select e.kind into picked_kind from forno_private.push_deliveries d join forno_private.push_events e on e.id=d.event_id where d.device_id=sub.id and d.status='pending' and d.next_attempt_at<=clock_timestamp() order by e.created_at limit 1;
  select array_agg(id) into ids from(select d.id from forno_private.push_deliveries d join forno_private.push_events e on e.id=d.event_id where d.device_id=sub.id and d.status='pending' and d.next_attempt_at<=clock_timestamp() and e.kind=picked_kind order by e.created_at limit 20 for update of d skip locked)x;
  if ids is null then return null; end if;
  token=gen_random_uuid();
  update forno_private.push_deliveries set status='processing',lease=token,lease_until=clock_timestamp()+interval '90 seconds',attempts=attempts+1 where id=any(ids);
  select jsonb_agg(jsonb_build_object('id',d.id,'eventId',e.id,'kind',e.kind,'reference',o.order_number,'pizzas',o.pizza_count,'pickupTime',to_char(ps.pickup_time,'HH24:MI'))) into rows
   from forno_private.push_deliveries d join forno_private.push_events e on e.id=d.event_id left join public.orders o on o.id=e.order_id left join public.pickup_slots ps on ps.id=o.pickup_slot_id where d.id=any(ids);
  return jsonb_build_object('device',jsonb_build_object('id',sub.id,'endpoint',sub.endpoint,'keys',jsonb_build_object('p256dh',sub.p256dh,'auth',sub.auth_key)),'lease',token,'ids',ids,'events',rows);
 elsif p_action='authorize' then
  return to_jsonb(exists(select 1 from forno_private.push_subscriptions s join forno_private.admin_users a on a.user_id=s.owner_id and a.active join forno_private.push_deliveries d on d.device_id=s.id where s.id=(p_data->>'deviceId')::uuid and s.active and d.status='processing' and d.lease=(p_data->>'lease')::uuid and d.lease_until>clock_timestamp()));
 elsif p_action='finish' then
  select * into sub from forno_private.push_subscriptions where id=(p_data->>'deviceId')::uuid for update;
  if not found then return jsonb_build_object('ok',false); end if;
  if not exists(select 1 from forno_private.push_deliveries where device_id=sub.id and lease=(p_data->>'lease')::uuid and status='processing' and lease_until>clock_timestamp()) then return jsonb_build_object('ok',false); end if;
  code=coalesce((p_data->>'status')::integer,0);
  if code in(404,410) then
   update forno_private.push_deliveries set provider_status=code,last_error='SUBSCRIPTION_EXPIRED' where device_id=sub.id and lease=(p_data->>'lease')::uuid and status='processing';
   perform forno_private.push_revoke(sub.id,'provider_expired'); return jsonb_build_object('ok',true); end if;
  if code between 200 and 299 then
   update forno_private.push_deliveries set status='sent',sent_at=clock_timestamp(),provider_status=code,last_error=null,lease=null,lease_until=null where device_id=sub.id and lease=(p_data->>'lease')::uuid and status='processing' and lease_until>clock_timestamp();
   update forno_private.push_subscriptions set last_used_at=clock_timestamp() where id=sub.id and active;
  else
   update forno_private.push_deliveries set status=case when attempts>=6 then 'failed' else 'pending' end,
    next_attempt_at=clock_timestamp()+make_interval(secs=>least(900,30*power(2,attempts-1)::integer)),provider_status=nullif(code,0),last_error=case when code=0 then 'NETWORK' else 'PROVIDER_TEMPORARY' end,lease=null,lease_until=null
    where device_id=sub.id and lease=(p_data->>'lease')::uuid and status='processing';
  end if;
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'PUSH_INVALID';
end $$;
revoke all on function forno_private.push_revoke(uuid,text),forno_private.push_admin_revoked(),forno_private.wake_push_worker(),forno_private.push_order_inserted(),forno_private.require_push_worker(text) from public,anon,authenticated,service_role;
revoke all on function public.forno_push_admin(uuid,uuid,text,jsonb),public.forno_push_worker(text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.forno_push_admin(uuid,uuid,text,jsonb),public.forno_push_worker(text,text,jsonb) to service_role;
$migration_20261030055421$),
('20261030055422','20261030055422_forno_push_dispatch.sql','eb83395284765366d8a15e0606c69e07ec453f3cdd3c974a37cecab174cbe92a', $migration_20261030055422$-- Supabase integration. This does not configure a URL, generate keys or enable dispatch.
create extension if not exists pg_net;
revoke all on net.http_request_queue,net._http_response from public,anon,authenticated,service_role;
revoke all on function net.http_post(text,jsonb,jsonb,jsonb,integer) from public,anon,authenticated,service_role;

create or replace function forno_private.wake_push_worker() returns void language plpgsql security definer set search_path='' as $$
declare cfg forno_private.push_config; secret text; needed boolean;
begin
 select * into cfg from forno_private.push_config where singleton for update;
 if not cfg.enabled or cfg.worker_url is null or cfg.worker_secret_id is null then return; end if;
 if cfg.last_wake_at>clock_timestamp()-interval '3 seconds' then return; end if;
 needed=cfg.vapid_public_key is null or exists(
  select 1 from forno_private.push_events e join forno_private.push_subscriptions s on s.active
   join forno_private.admin_users a on a.user_id=s.owner_id and a.active
   left join forno_private.push_deliveries d on d.event_id=e.id and d.device_id=s.id
   left join public.orders o on o.id=e.order_id
  where e.expires_at>clock_timestamp()
   and ((e.kind='orders' and s.activated_at<=e.created_at and o.status='pending' and o.pending_expires_at>clock_timestamp()) or(e.kind='test' and e.target_device=s.id))
   and (d.id is null or(d.status='pending' and d.next_attempt_at<=clock_timestamp()) or(d.status='processing' and d.lease_until<=clock_timestamp())));
 if not needed then return; end if;
 select decrypted_secret into secret from vault.decrypted_secrets where id=cfg.worker_secret_id;
 if secret is null then return; end if;
 update forno_private.push_config set last_wake_at=clock_timestamp() where singleton;
 perform net.http_post(url:=cfg.worker_url,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),body:='{}'::jsonb,timeout_milliseconds:=30000);
end $$;

create function public.forno_push_worker_config(p_token text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg forno_private.push_config; secret_id uuid; private_key text;
begin
 perform forno_private.require_push_worker(p_token);
 select * into cfg from forno_private.push_config where singleton for update;
 if cfg.vapid_secret_id is null and p_data ? 'publicKey' then
  if coalesce(p_data->>'publicKey','') !~ '^[A-Za-z0-9_-]{87}$' or coalesce(p_data->>'privateKey','') !~ '^[A-Za-z0-9_-]{43}$' then raise exception 'PUSH_INVALID'; end if;
  select vault.create_secret(p_data->>'privateKey','forno_push_vapid_private','Server-only VAPID signing key') into secret_id;
  update forno_private.push_config set vapid_public_key=p_data->>'publicKey',vapid_secret_id=secret_id where singleton and vapid_secret_id is null returning * into cfg;
 end if;
 if cfg.vapid_secret_id is not null then select decrypted_secret into private_key from vault.decrypted_secrets where id=cfg.vapid_secret_id; end if;
 return jsonb_build_object('publicKey',cfg.vapid_public_key,'privateKey',private_key,'subject',cfg.vapid_subject);
end $$;
revoke all on function public.forno_push_worker_config(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.forno_push_worker_config(text,jsonb) to service_role;
-- Only the owner can wake or schedule a worker; no browser role can access its token.
revoke all on function forno_private.wake_push_worker() from public,anon,authenticated,service_role;
do $$ declare job bigint;
begin
 select jobid into job from cron.job where jobname='forno-push-outbox';
 if job is null then select cron.schedule('forno-push-outbox','* * * * *','select forno_private.wake_push_worker()') into job; end if;
 perform cron.alter_job(job,active:=false);
end $$;
$migration_20261030055422$),
('20261030061606','20261030061606_harden_push_platform_integration.sql','272b78c5330a0dc304a59c74d05a6e448027a105af22a0c135a187c4fc235ee6', $migration_20261030061606$-- pg_net is owned by supabase_admin. Its PUBLIC grants cannot be changed by
-- postgres on hosted Supabase. Browser roles are NOLOGIN and net must remain
-- outside the exposed Data API schemas. Never queue a Supabase/VAPID secret.
-- Only the dedicated wake credential is transiently visible to trusted DB operators.
-- See docs/admin-pwa-push.md for the mandatory deployment exposure check.
-- Move the newly installed extension metadata out of public, as Supabase advises.
-- Refuse to discard an unsent request or affect another pg_net consumer.
do $$
begin
 if exists(select 1 from pg_extension e join pg_namespace n on n.oid=e.extnamespace where extname='pg_net' and n.nspname='public') then
  if exists(select 1 from net.http_request_queue) then raise exception 'PUSH_QUEUE_NOT_EMPTY'; end if;
  if exists(select 1 from pg_depend where refobjid=(select oid from pg_extension where extname='pg_net') and deptype='n') then raise exception 'PG_NET_HAS_DEPENDENCIES'; end if;
  drop extension pg_net;
  create extension pg_net with schema extensions;
 end if;
end $$;
$migration_20261030061606$)
 ) x(version,filename,sha256,sql_body) order by version loop
  select sha256 into stored from forno_private.manual_migrations where version=m.version;
  if stored is not null and stored<>m.sha256 then raise exception 'RELEASE_CHECKSUM_MISMATCH: %',m.filename; end if;
  known=stored is not null;
  if not known and to_regclass('supabase_migrations.schema_migrations') is not null then
   execute 'select exists(select 1 from supabase_migrations.schema_migrations where version=$1)' into known using m.version;
  end if;
  if not known then
   if (m.version='20261029091206' and to_regclass('forno_private.admin_users') is not null) or(m.version='20261030055421' and to_regclass('forno_private.push_config') is not null) then raise exception 'UNTRACKED_RELEASE_OBJECTS'; end if;
   execute m.sql_body;
   insert into forno_private.manual_migrations(version,filename,sha256) values(m.version,m.filename,m.sha256);
  end if;
 end loop;
 if exists(select 1 from forno_private.push_config where enabled) then raise exception 'PUSH_MUST_REMAIN_DISABLED'; end if;
 if exists(select 1 from cron.job where jobname='forno-push-outbox' and active) then raise exception 'PUSH_JOB_MUST_REMAIN_PAUSED'; end if;
end $release$;
commit;
-- Records SQL Editor history in manual_migrations. No internal Supabase history rewrite.
