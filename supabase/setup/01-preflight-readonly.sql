-- Open the SQL Editor of the project NAMED forno-pizza and verify its real dashboard URL first.
-- A PostgreSQL database name (usually postgres) cannot identify a Supabase project by itself.
-- This file performs no persistent writes, calls no order RPC, and reads no customer details.
begin transaction read only;
select current_database() as database_name, current_user as sql_role,
  current_setting('server_version') as postgres_version,
  clock_timestamp() at time zone 'Europe/Paris' as paris_now;

select n.nspname as schema_name,c.relname as table_name,
  pg_get_userbyid(c.relowner) as owner,c.relrowsecurity as rls,c.relforcerowsecurity as force_rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind in ('r','p') and ((n.nspname='public' and c.relname in ('pizzas','services','pickup_slots','orders','order_items')) or n.nspname='forno_private')
order by 1,2;
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies
where (schemaname='public' and tablename in ('pizzas','services','pickup_slots','orders','order_items')) or schemaname='forno_private';

select n.nspname as schema_name,c.relname as table_name,r.role,
  has_schema_privilege(r.role,n.oid,'USAGE') as schema_usage,
  has_table_privilege(r.role,c.oid,'SELECT') as can_select,
  has_table_privilege(r.role,c.oid,'INSERT') as can_insert,
  has_table_privilege(r.role,c.oid,'UPDATE') as can_update,
  has_table_privilege(r.role,c.oid,'DELETE') as can_delete,
  has_table_privilege(r.role,c.oid,'TRUNCATE') as can_truncate
from pg_class c join pg_namespace n on n.oid=c.relnamespace
cross join (values('anon'),('authenticated'),('service_role')) r(role)
where c.relkind in ('r','p') and ((n.nspname='public' and c.relname in ('pizzas','services','pickup_slots','orders','order_items')) or n.nspname='forno_private') order by 1,2,3;

select n.nspname as schema_name,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_userbyid(p.proowner) as owner,p.prosecdef as security_definer,p.proconfig,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') as service_role_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='public' and p.proname like 'forno\_%' escape '\') or n.nspname='forno_private'
order by 1,2;

select conrelid::regclass as table_name,conname,pg_get_constraintdef(oid) as definition
from pg_constraint where connamespace in(select oid from pg_namespace where nspname in ('public','forno_private'))
 and conrelid in(select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname='public' and c.relname in ('pizzas','services','pickup_slots','orders','order_items')) or n.nspname='forno_private')
order by 1,2;
select schemaname,tablename,indexname,indexdef from pg_indexes
where (schemaname='public' and tablename in ('pizzas','services','pickup_slots','orders','order_items')) or schemaname='forno_private';
select extname,extversion from pg_extension where extname in ('pg_cron','pgcrypto');
select evtname,evtevent,evtenabled,evttags from pg_event_trigger;
select pg_get_userbyid(defaclrole) as owner,defaclnamespace::regnamespace as schema_name,defaclobjtype,defaclacl from pg_default_acl;
-- Show only Data API schema settings, never JWT/secret settings.
select s.setting from pg_db_role_setting cross join lateral unnest(setconfig) s(setting)
where s.setting like 'pgrst.db_schemas=%';

-- History schemas are optional on projects configured entirely in SQL Editor.
do $history$
declare result jsonb;
begin
 if to_regclass('supabase_migrations.schema_migrations') is not null then
  execute 'select coalesce(jsonb_agg(jsonb_build_object(''version'',version) order by version),''[]''::jsonb) from supabase_migrations.schema_migrations' into result;
  raise notice 'SUPABASE_MIGRATIONS: %',result;
 else raise notice 'SUPABASE_MIGRATIONS: no CLI history table'; end if;
 if to_regclass('forno_private.manual_migrations') is not null then
  execute 'select jsonb_agg(jsonb_build_object(''version'',version,''sha256'',sha256) order by version) from forno_private.manual_migrations' into result;
  raise notice 'FORNO_MANUAL_MIGRATIONS: %',result;
 end if;
 if to_regclass('cron.job') is not null then
  execute 'select jsonb_agg(jsonb_build_object(''jobid'',jobid,''jobname'',jobname,''active'',active,''username'',username)) from cron.job where jobname=''forno-order-maintenance''' into result;
  raise notice 'FORNO_CRON: %',result;
 end if;
end $history$;
commit;
