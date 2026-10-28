import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
// pg_cron is not available in PGlite. This test-only stub records job configuration,
// never runs a job, and does NOT validate Supabase's real extension or scheduler.
const bootstrap=async()=>{
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema cron;
 create table cron.job(jobid bigserial primary key,jobname text unique,schedule text,command text,username text default current_user,active boolean default true);
 create function cron.schedule(text,text,text) returns bigint language plpgsql as $$ declare id bigint;begin
 insert into cron.job(jobname,schedule,command) values($1,$2,$3) on conflict(jobname) do update set schedule=excluded.schedule,command=excluded.command returning jobid into id;return id;end $$;
 create function cron.alter_job(job_id bigint,schedule text default null,command text default null,database text default null,username text default null,active boolean default null) returns void language sql as $$ update cron.job set active=coalesce($6,cron.job.active) where jobid=$1 $$;`);
 return db;
};
const installer=async()=> (await readFile('supabase/setup/02-apply-reviewed.sql','utf8')).replace('create extension if not exists pg_cron with schema pg_catalog;','-- real extension is stubbed in this local test only');
const scalar=async<T>(db:PGlite,query:string)=> (await db.query<{value:T}>(query)).rows[0]!.value;

test('SQL Editor : installation atomique fraîche, 4 migrations, 13 pizzas, aucune commande et cron inactif',async()=>{
 const db=await bootstrap();try{
  await db.exec(await installer());
  assert.equal(await scalar(db,'select count(*)::integer value from forno_private.manual_migrations'),4);
  assert.equal(await scalar(db,'select count(*)::integer value from public.pizzas'),13);
  assert.equal(await scalar(db,'select count(*)::integer value from public.orders'),0);
  assert.equal(await scalar(db,"select active as value from cron.job where jobname='forno-order-maintenance'"),false);
  await db.exec(await readFile('supabase/setup/04-provisional-services.sql','utf8'));
  assert.equal(await scalar(db,'select count(*)::integer value from public.services'),30);
  assert.equal(await scalar(db,'select count(*)::integer value from public.pickup_slots'),440);
  assert.equal(await scalar(db,'select count(*)::integer value from public.services where orders_enabled'),0);
  assert.equal(await scalar(db,'select count(*)::integer value from public.services where address is not null'),0);
  await db.exec(await readFile('supabase/setup/01-preflight-readonly.sql','utf8'));
  await db.exec(await readFile('supabase/setup/03-verify-readonly.sql','utf8'));
 }finally{await db.close();}
});
test('SQL Editor : une seconde exécution ignore toutes les migrations déjà enregistrées',async()=>{
 const db=await bootstrap();try{
  const sql=await installer();await db.exec(sql);
  await db.exec('update forno_private.settings set minimum_lead_minutes=45;update cron.job set active=true');
  await db.exec(sql);
  assert.equal(await scalar(db,'select count(*)::integer value from forno_private.manual_migrations'),4);
  assert.equal(await scalar(db,'select minimum_lead_minutes value from forno_private.settings'),45);
  assert.equal(await scalar(db,'select active as value from cron.job'),true); // hardening was skipped, not rerun
 }finally{await db.close();}
});
test('SQL Editor : schéma existant sans historique refusé, sans toucher à ses données',async()=>{
 const db=await bootstrap();try{
  await db.exec("create table public.pizzas(id text);insert into public.pizzas values('existing-data')");
  await assert.rejects(db.exec(await installer()),/FORNO_BASELINE_UNTRACKED/);await db.exec('rollback');
  assert.equal(await scalar(db,'select id as value from public.pizzas'),'existing-data');
  assert.equal(await scalar(db,"select to_regclass('forno_private.manual_migrations') as value"),null);
 }finally{await db.close();}
});
test('SQL Editor : historique officiel reconnu, seules les migrations manquantes sont exécutées',async()=>{
 const db=await bootstrap();try{
  for(const file of ['202610280001_orders.sql','202610280002_catalogue.sql','202610280003_maintenance.sql']){
   await db.exec((await readFile(`supabase/migrations/${file}`,'utf8')).replace('create extension if not exists pg_cron with schema pg_catalog;','-- stub extension'));
  }
  await db.exec("create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key);insert into supabase_migrations.schema_migrations values('202610280001'),('202610280002'),('202610280003')");
  await db.exec(await installer());
  assert.equal(await scalar(db,'select count(*)::integer value from forno_private.manual_migrations'),1);
  assert.equal(await scalar(db,'select count(*)::integer value from public.pizzas'),13);
  assert.equal(await scalar(db,'select active as value from cron.job'),false);
 }finally{await db.close();}
});
test('SQL Editor : divergence de checksum détectée avant réexécution',async()=>{
 const db=await bootstrap();try{
  const sql=await installer();await db.exec(sql);
  await db.exec("update forno_private.manual_migrations set sha256='changed' where version='202610280002'");
  await assert.rejects(db.exec(sql),/FORNO_MIGRATION_CHECKSUM_MISMATCH/);await db.exec('rollback');
  assert.equal(await scalar(db,'select count(*)::integer value from public.pizzas'),13);
 }finally{await db.close();}
});
