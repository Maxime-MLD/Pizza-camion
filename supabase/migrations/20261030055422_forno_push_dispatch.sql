-- Supabase integration. This does not configure a URL, generate keys or enable dispatch.
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
