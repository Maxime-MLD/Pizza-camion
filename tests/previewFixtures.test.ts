import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('Fixtures Preview : nouveau jour sans modifier les commandes historiques, refus des doublons',async()=>{
 const db=new PGlite();
 const withClock=(sql:string)=>sql.replace(/\b(?:clock_timestamp|now)\(\)/g,'public.forno_fixture_now()');
 try{
  await db.exec("create role anon;create role authenticated;create role service_role;create function public.forno_fixture_now() returns timestamptz language sql stable as $$select '2026-10-29T08:00:00Z'::timestamptz$$;");
  for(const file of ['202610280001_orders.sql','202610280002_catalogue.sql','20261028095508_harden_forno_data_api.sql'])
   await db.exec(withClock(await readFile(`supabase/migrations/${file}`,'utf8')));
  await db.exec(await readFile('supabase/tests/preview-marker.sql','utf8'));
  await db.exec(`insert into public.services(id,service_date,village,opening_time,closing_time,status,orders_enabled) values
   ('forno-test-2026-10-28','2026-10-28','Village de test','00:00','23:59','open',false),
   ('forno-test-2026-10-29','2026-10-29','Village de test demain','18:00','21:30','scheduled',false);
   insert into public.pickup_slots values('historical-slot','forno-test-2026-10-28','20:00',2,true);
   insert into public.orders(service_id,pickup_slot_id,total_cents,pizza_count,idempotency_key,pending_expires_at,status)
    values('forno-test-2026-10-28','historical-slot',1000,1,gen_random_uuid(),'2026-10-28T19:00:00Z','accepted');
   update forno_private.test_environment set fixtures=jsonb_build_object('_previousEvidence',true);`);
  const before=(await db.query('select to_jsonb(o) snapshot from public.orders o')).rows;
  const fixture=withClock(await readFile('supabase/tests/preview-fixtures.sql','utf8')).replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,'');
  await db.exec(fixture);
  assert.deepEqual((await db.query('select to_jsonb(o) snapshot from public.orders o')).rows,before);
  const today=(await db.query<{village:string;orders_enabled:boolean;status:string}>("select village,status,orders_enabled from public.services where service_date='2026-10-29'")).rows[0]!;
  assert.equal(today.village,'Village de test');assert.equal(today.orders_enabled,true);assert.equal(today.status,'open');
  const data=(await db.query<{data:{date:string;service:{date:string};slots:{label:string;state:string}[]}}>('select public.forno_pickup_slots(2) data')).rows[0]!.data;
  assert.equal(data.date,'2026-10-29');assert.equal(data.service.date,'2026-10-29');
  assert.ok(data.slots.some(s=>s.label==='10:30'&&s.state==='available'));
  assert.ok((await db.query<{kept:boolean}>("select (fixtures->>'_previousEvidence')::boolean kept from forno_private.test_environment")).rows[0]!.kept);
  await db.exec('begin');await assert.rejects(db.exec(fixture),/FIXTURES_ALREADY_PREPARED/);await db.exec('rollback');
  assert.deepEqual((await db.query('select to_jsonb(o) snapshot from public.orders o')).rows,before);
 }finally{await db.close();}
});
