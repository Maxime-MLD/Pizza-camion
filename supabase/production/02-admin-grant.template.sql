-- OWNER APPROVAL REQUIRED. Never copy an identity/session from Test.
-- Create/confirm the owner's NEW Auth account in Production first, keeping its password private.
-- Replace only this UUID locally after verifying the correct Production user; no email is embedded.
begin;
do $$
declare actor uuid;
begin
 if to_regclass('forno_private.test_environment') is not null then raise exception 'TEST_DATABASE_REFUSED'; end if;
 if not exists(select 1 from forno_private.production_environment where project_ref='fqjkkjvrklpzhwmswlsy') then raise exception 'PRODUCTION_MARKER_REQUIRED'; end if;
 if 'TODO_NEW_PRODUCTION_AUTH_USER_UUID' like 'TODO_%' then raise exception 'EXPLICIT_PRODUCTION_IDENTITY_REQUIRED'; end if;
 actor='TODO_NEW_PRODUCTION_AUTH_USER_UUID'::uuid;
 if not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then raise exception 'CONFIRMED_PRODUCTION_AUTH_USER_REQUIRED'; end if;
 if exists(select 1 from forno_private.admin_users where user_id<>actor and active) then raise exception 'REVIEW_EXISTING_ADMINISTRATORS'; end if;
 insert into forno_private.admin_users(user_id) values(actor) on conflict(user_id) do nothing;
 if not exists(select 1 from forno_private.admin_users where user_id=actor and active) then raise exception 'EXISTING_REVOKED_GRANT_REQUIRES_REVIEW'; end if;
 if not exists(select 1 from forno_private.admin_audit where action='admin_grant' and resource_id=actor::text) then
  insert into forno_private.admin_audit(actor_id,action,resource_id,changes) values(null,'admin_grant',actor::text,'{"active":true}');
 end if;
end $$;
commit;
