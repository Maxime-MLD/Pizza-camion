-- Private push capability; disabled until the isolated environment is configured.
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
