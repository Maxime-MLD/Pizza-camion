-- OWNER APPROVAL REQUIRED, after schema/permissions verification. Leaves dispatch OFF.
begin;
do $$
declare token text; secret_id uuid;
begin
 if to_regclass('forno_private.test_environment') is not null then raise exception 'TEST_DATABASE_REFUSED'; end if;
 if not exists(select 1 from forno_private.production_environment where project_ref='fqjkkjvrklpzhwmswlsy') then raise exception 'PRODUCTION_MARKER_REQUIRED'; end if;
 if exists(select 1 from forno_private.push_config where enabled) then raise exception 'PUSH_ALREADY_ENABLED_REVIEW_REQUIRED'; end if;
 if exists(select 1 from forno_private.push_config where worker_url is not null and worker_url<>'https://fqjkkjvrklpzhwmswlsy.supabase.co/functions/v1/forno-push-worker') then raise exception 'WRONG_WORKER_PROJECT'; end if;
 if (select worker_secret_id is null from forno_private.push_config where singleton) then
  token=encode(extensions.gen_random_bytes(32),'hex');
  select vault.create_secret(token,'forno_push_worker_token','Production-only worker credential') into secret_id;
  update forno_private.push_config set worker_secret_id=secret_id,worker_hash=sha256(convert_to(token,'UTF8')) where singleton;
 end if;
 update forno_private.push_config set worker_url='https://fqjkkjvrklpzhwmswlsy.supabase.co/functions/v1/forno-push-worker',vapid_subject='https://pizza-two-bay.vercel.app/' where singleton;
end $$;
commit;
-- No secret is returned. A new VAPID pair will be generated IN the Production Edge worker.
-- Enable dispatch only in a later, explicitly approved step after permissions + endpoint checks.
