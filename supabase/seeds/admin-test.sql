-- Separate from schema migration. Owner-only bootstrap, Test database exclusively.
-- Create/confirm the Auth user in Supabase first. Replace TODO_ADMIN_EMAIL locally.
-- Do not commit real identity details or passwords.
begin;
do $$
declare actor uuid;
begin
 if not exists(select 1 from forno_private.test_environment where project_ref='brzcvncsycdpsrvulqss') then raise exception 'TEST_ONLY'; end if;
 select id into actor from auth.users where lower(email)=lower('TODO_ADMIN_EMAIL') and email_confirmed_at is not null;
 if actor is null then raise exception 'CONFIRMED_AUTH_USER_REQUIRED'; end if;
 insert into forno_private.admin_users(user_id) values(actor) on conflict(user_id) do update set active=true;
end $$;
commit;
