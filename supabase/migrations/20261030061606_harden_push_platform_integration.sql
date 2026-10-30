-- pg_net is owned by supabase_admin. Its PUBLIC grants cannot be changed by
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
