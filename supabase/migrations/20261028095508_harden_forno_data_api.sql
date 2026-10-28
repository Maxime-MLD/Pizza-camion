-- Opt-in Data API compatibility; never grant table access to browser or backend roles.
-- Definer RPCs are the narrow application API. Their trusted owner retains table access.
-- Applying this file does not enable orders or run maintenance.
grant usage on schema public to service_role;
revoke all on public.pizzas,public.services,public.pickup_slots,public.orders,public.order_items from public,anon,authenticated,service_role;
revoke all on schema forno_private from public,anon,authenticated,service_role;
revoke all on forno_private.settings,forno_private.request_limits from public,anon,authenticated,service_role;
revoke all on sequence forno_private.order_number_seq from public,anon,authenticated,service_role;
revoke all on function forno_private.touch_updated_at(),forno_private.order_receipt(public.orders) from public,anon,authenticated,service_role;

-- FK checks and future admin lookups should not scan the full order history.
create index if not exists orders_service_id_idx on public.orders(service_id);
create index if not exists order_items_pizza_id_idx on public.order_items(pizza_id);

create or replace function public.forno_rate_limit(p_key text, p_limit integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  if p_key is null or p_limit is null or p_key !~ '^[a-f0-9]{64}$' or p_limit not between 1 and 120 then return false; end if;
  insert into forno_private.request_limits values(p_key,date_trunc('minute',now()),1)
    on conflict(key_hash,bucket) do update set count=forno_private.request_limits.count+1 returning count into n;
  return n<=p_limit;
end $$;

create or replace function public.forno_pickup_slots(p_quantity integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.services; cfg forno_private.settings; result jsonb; t timestamptz:=clock_timestamp(); d date;
begin
  select * into cfg from forno_private.settings;
  if p_quantity is null or p_quantity not between 1 and cfg.max_pizzas_per_order then raise exception 'INVALID_REQUEST'; end if;
  d=(t at time zone 'Europe/Paris')::date;
  select * into s from public.services where service_date=d;
  if not found then return jsonb_build_object('date',d,'serverNow',t,'state','unavailable','reason','closed','service',null,'slots','[]'::jsonb); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',ps.id,'label',to_char(ps.pickup_time,'HH24:MI'),
    'state',case when s.status<>'open' or not s.orders_enabled or not ps.enabled
      or (s.service_date+ps.pickup_time) at time zone 'Europe/Paris' < t+make_interval(mins=>cfg.minimum_lead_minutes)
      or ps.pickup_time<s.opening_time or ps.pickup_time>s.closing_time-make_interval(mins=>cfg.closing_margin_minutes)
      then 'unavailable' when ps.capacity-coalesce(load.units,0)<p_quantity then 'full' else 'available' end
    ) order by ps.pickup_time),'[]'::jsonb) into result
  from public.pickup_slots ps left join lateral (
    select sum(o.pizza_count) units from public.orders o where o.pickup_slot_id=ps.id and
      (o.status in ('accepted','preparing','ready','completed') or (o.status='pending' and o.pending_expires_at>t))
  ) load on true where ps.service_id=s.id;
  return jsonb_build_object('date',d,'serverNow',t,'minimumLeadMinutes',cfg.minimum_lead_minutes,
    'state',case when s.status='open' and s.orders_enabled and t < (s.service_date+s.closing_time) at time zone 'Europe/Paris' then 'available' else 'unavailable' end,
    'reason',case when t >= (s.service_date+s.closing_time) at time zone 'Europe/Paris' then 'finished' when s.status in ('closed','cancelled') then 'closed' else 'disabled' end,
    'service',jsonb_build_object('id',s.id,'date',s.service_date,'village',s.village,'address',s.address,
      'openingTime',to_char(s.opening_time,'HH24:MI'),'closingTime',to_char(s.closing_time,'HH24:MI')),'slots',result);
end $$;

create or replace function public.forno_create_order(p_request jsonb, p_request_hash text, p_abuse_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg forno_private.settings; s public.services; slot public.pickup_slots; existing public.orders;
  created public.orders; line jsonb; pizza public.pizzas; total integer:=0; units integer:=0; used integer;
  t timestamptz; pickup timestamptz; key uuid; n integer;
begin
  -- Validate required data independently of Zod. SQL NULL must never bypass checks.
  if jsonb_typeof(p_request) is distinct from 'object'
    or coalesce(p_request->>'idempotencyKey','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
    or jsonb_typeof(p_request->'serviceId') is distinct from 'string' or length(p_request->>'serviceId') not between 1 and 100
    or jsonb_typeof(p_request->'slotId') is distinct from 'string' or length(p_request->>'slotId') not between 1 and 120
    or jsonb_typeof(p_request->'date') is distinct from 'string'
    or jsonb_typeof(p_request->'village') is distinct from 'string' or length(p_request->>'village') not between 1 and 120
    or jsonb_typeof(p_request->'lines') is distinct from 'array'
    or jsonb_typeof(p_request->'customer') is distinct from 'object'
    or p_request#>'{customer,privacyAcknowledged}' is distinct from 'true'::jsonb
    or jsonb_typeof(p_request#>'{customer,firstName}') is distinct from 'string'
    or length(btrim(coalesce(p_request#>>'{customer,firstName}',''))) not between 1 and 80
    or jsonb_typeof(p_request#>'{customer,lastName}') is distinct from 'string'
    or length(btrim(coalesce(p_request#>>'{customer,lastName}',''))) not between 1 and 80
    or coalesce(p_request#>>'{customer,phone}','') !~ '^\+33[1-9][0-9]{8}$'
    or jsonb_typeof(p_request#>'{customer,comment}') is distinct from 'string'
    or length(p_request#>>'{customer,comment}')>500
    or p_request_hash is null or p_request_hash !~ '^[a-f0-9]{64}$'
    or p_abuse_key is null or p_abuse_key !~ '^[a-f0-9]{64}$'
  then raise exception 'INVALID_REQUEST'; end if;
  select * into cfg from forno_private.settings;
  key=(p_request->>'idempotencyKey')::uuid;
  if p_request_hash !~ '^[a-f0-9]{64}$' or p_abuse_key !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_REQUEST'; end if;
  -- Same key serialized even when requests target different slots.
  perform pg_advisory_xact_lock(hashtextextended(key::text,0));
  select * into existing from public.orders where idempotency_key=key for update;
  if found then
    if existing.request_hash is distinct from p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    if existing.status='pending' and existing.pending_expires_at<=clock_timestamp() then
      update public.orders set status='cancelled' where id=existing.id returning * into existing;
    end if;
    return forno_private.order_receipt(existing);
  end if;
  -- A limited request is returned rather than raised, so the rate counter commits.
  if not public.forno_rate_limit(p_abuse_key,cfg.orders_per_minute) then return jsonb_build_object('error','RATE_LIMITED'); end if;
  -- All orders for a service acquire this lock before checking live state and capacity.
  select * into s from public.services where id=p_request->>'serviceId' for update;
  t=clock_timestamp();
  if not found or s.service_date<>(t at time zone 'Europe/Paris')::date
    or s.service_date::text<>p_request->>'date' or s.village<>p_request->>'village' then raise exception 'WRONG_SERVICE'; end if;
  if s.status<>'open' or not s.orders_enabled or t >= (s.service_date+s.closing_time) at time zone 'Europe/Paris' then raise exception 'SERVICE_CLOSED'; end if;
  select * into slot from public.pickup_slots where id=p_request->>'slotId' and service_id=s.id for update;
  if not found or not slot.enabled or slot.pickup_time<s.opening_time or slot.pickup_time>s.closing_time-make_interval(mins=>cfg.closing_margin_minutes) then raise exception 'SLOT_UNAVAILABLE'; end if;
  pickup=(s.service_date+slot.pickup_time) at time zone 'Europe/Paris';
  if pickup<t+make_interval(mins=>cfg.minimum_lead_minutes) then raise exception 'SLOT_EXPIRED'; end if;
  if jsonb_typeof(p_request->'lines')<>'array' or jsonb_array_length(p_request->'lines') not between 1 and 13 then raise exception 'INVALID_REQUEST'; end if;
  if (p_request#>>'{customer,privacyAcknowledged}') is distinct from 'true'
    or length(p_request#>>'{customer,firstName}') not between 1 and 80
    or length(p_request#>>'{customer,lastName}') not between 1 and 80
    or (p_request#>>'{customer,phone}') !~ '^\+33[1-9][0-9]{8}$'
    or length(p_request#>>'{customer,comment}')>500 then raise exception 'INVALID_REQUEST'; end if;
  for line in select value from jsonb_array_elements(p_request->'lines') order by value->>'pizzaId' loop
    if jsonb_typeof(line->'quantity')<>'number' or (line->>'quantity') !~ '^[1-9][0-9]?$' then raise exception 'INVALID_QUANTITY'; end if;
    n=(line->>'quantity')::integer;
    select * into pizza from public.pizzas where id=line->>'pizzaId' for share;
    if not found or not pizza.available then raise exception 'PIZZA_UNAVAILABLE'; end if;
    total=total+pizza.price_cents*n; units=units+n;
  end loop;
  if units>cfg.max_pizzas_per_order then raise exception 'INVALID_QUANTITY'; end if;
  if (select count(distinct value->>'pizzaId') from jsonb_array_elements(p_request->'lines'))<>jsonb_array_length(p_request->'lines') then raise exception 'INVALID_REQUEST'; end if;
  t=clock_timestamp();
  if s.service_date<>(t at time zone 'Europe/Paris')::date or pickup<t+make_interval(mins=>cfg.minimum_lead_minutes) then raise exception 'SLOT_EXPIRED'; end if;
  update public.orders set status='cancelled' where pickup_slot_id=slot.id and status='pending' and pending_expires_at<=t;
  select coalesce(sum(pizza_count),0) into used from public.orders where pickup_slot_id=slot.id and status in ('pending','accepted','preparing','ready','completed');
  if used+units>slot.capacity then raise exception 'SLOT_FULL'; end if;
  insert into public.orders(service_id,pickup_slot_id,customer_first_name,customer_last_name,customer_phone,customer_note,
    total_cents,pizza_count,idempotency_key,request_hash,pending_expires_at)
  values(s.id,slot.id,p_request#>>'{customer,firstName}',p_request#>>'{customer,lastName}',p_request#>>'{customer,phone}',p_request#>>'{customer,comment}',
    total,units,key,p_request_hash,least(pickup,t+make_interval(mins=>cfg.pending_ttl_minutes))) returning * into created;
  insert into public.order_items(order_id,pizza_id,pizza_name_snapshot,unit_price_cents,quantity,line_total_cents)
    select created.id,p.id,p.name,p.price_cents,(l->>'quantity')::integer,p.price_cents*(l->>'quantity')::integer
    from jsonb_array_elements(p_request->'lines') l join public.pizzas p on p.id=l->>'pizzaId';
  return forno_private.order_receipt(created);
end $$;

create or replace function public.forno_recover_order(p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
 select * into o from public.orders where idempotency_key=p_key for update;
 if not found then return null; end if;
 if o.status='pending' and o.pending_expires_at<=clock_timestamp() then
   update public.orders set status='cancelled' where id=o.id returning * into o;
 end if;
 return forno_private.order_receipt(o);
end $$;

-- CREATE OR REPLACE preserves existing ACLs, but declare the complete expected RPC ACL explicitly.
revoke all on function public.forno_rate_limit(text,integer),public.forno_pickup_slots(integer),public.forno_create_order(jsonb,text,text),public.forno_recover_order(uuid),public.forno_maintenance() from public,anon,authenticated,service_role;
grant execute on function public.forno_rate_limit(text,integer),public.forno_pickup_slots(integer),public.forno_create_order(jsonb,text,text),public.forno_recover_order(uuid) to service_role;
-- Maintenance is a postgres-owned cron/SQL Editor task, not an application-key capability.

-- Keep the existing maintenance job, its history and all rows; pause it until retention is approved.
do $pause_forno_cron$
declare job record;
begin
  if to_regclass('cron.job') is not null then
    for job in execute 'select jobid,username from cron.job where jobname=''forno-order-maintenance''' loop
      if job.username<>current_user then raise exception 'FORNO_CRON_OWNER_MISMATCH: inspect the existing owner before changing this job'; end if;
      perform cron.alter_job(job_id := job.jobid, active := false);
    end loop;
  end if;
end $pause_forno_cron$;
