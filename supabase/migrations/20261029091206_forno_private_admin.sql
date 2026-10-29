-- No administrator is seeded. Grants are owner-controlled, independent of user metadata.
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
