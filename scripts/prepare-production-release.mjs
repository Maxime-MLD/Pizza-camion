// Generates reviewed SQL locally. Never connects to a cloud service or reads credentials.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const baseline=['202610280001_orders.sql','202610280002_catalogue.sql','202610280003_maintenance.sql','20261028095508_harden_forno_data_api.sql'];
const additions=['20261029091206_forno_private_admin.sql','20261029092544_harden_admin_settings_concurrency.sql','20261030051016_fix_admin_singleton_update.sql','20261030055421_forno_push_outbox.sql','20261030055422_forno_push_dispatch.sql','20261030061606_harden_push_platform_integration.sql'];
const read=async filename=>{const sql=await readFile(`supabase/migrations/${filename}`,'utf8');return {filename,version:filename.split('_')[0],sha256:createHash('sha256').update(sql).digest('hex'),sql};};
const core=await Promise.all(baseline.map(read)),migrations=await Promise.all(additions.map(read));
const quote=value=>`'${value.replaceAll("'","''")}'`;
const rows=list=>list.map(m=>`(${quote(m.version)},${quote(m.filename)},${quote(m.sha256)}${m.sqlBody?', $migration_'+m.version+'$'+m.sql+'$migration_'+m.version+'$':''})`).join(',\n');
const sql=`-- GENERATED; review docs/production-readiness.md and obtain approval before execution.
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
${rows(core)}
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
${rows(migrations.map(m=>({...m,sqlBody:true})))}
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
`;
await mkdir('supabase/production',{recursive:true});await writeFile('supabase/production/01-admin-push.sql',sql);
await writeFile('supabase/production/migrations-manifest.json',JSON.stringify({targetProjectRef:'fqjkkjvrklpzhwmswlsy',baseline:core.map(({sql,...m})=>m),additions:migrations.map(({sql,...m})=>m)},null,2)+'\n');
console.log(`Prepared ${migrations.length} additions and ${core.length} baseline checks. No remote execution.`);
