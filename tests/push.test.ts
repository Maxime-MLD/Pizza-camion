import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {dispatchPush,notificationPayload,allowedPushEndpoint,type PushBatch,type WorkerRpc} from '../supabase/functions/_shared/push-worker';
import {pushRequestSchema} from '../src/server/push/schema';
import {pushEnabled,pushOriginAllowed} from '../src/server/push/environment';
import {boundedBody} from '../src/server/admin/requestBody';
const actor='a0000000-0000-4000-8000-000000000001',session='a0000000-0000-4000-8000-000000000002';
const other='a0000000-0000-4000-8000-000000000003',otherSession='a0000000-0000-4000-8000-000000000004';
const token='a'.repeat(64), db=new PGlite();
const files=['202610280001_orders.sql','202610280002_catalogue.sql','20261028095508_harden_forno_data_api.sql','20261029091206_forno_private_admin.sql','20261029092544_harden_admin_settings_concurrency.sql','20261030051016_fix_admin_singleton_update.sql','20261030055421_forno_push_outbox.sql'];
before(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);
 insert into auth.users values('${actor}'),('${other}');insert into auth.sessions values('${session}','${actor}',null),('${otherSession}','${other}',null);
 create function public.forno_test_now() returns timestamptz language sql stable as $$select coalesce(nullif(current_setting('forno.test_now',true),''),'2026-10-30T10:00:00Z')::timestamptz$$;`);
 for(const file of files)await db.exec((await readFile(`supabase/migrations/${file}`,'utf8')).replace(/\b(clock_timestamp|now)\(\)/g,'public.forno_test_now()'));
 await db.exec(`insert into forno_private.admin_users(user_id) values('${actor}'),('${other}');
 update forno_private.push_config set enabled=true,worker_hash=sha256(convert_to('${token}','UTF8')),vapid_public_key=repeat('A',87) where singleton;
 insert into public.services(id,service_date,village,opening_time,closing_time,status,orders_enabled) values('s','2026-10-30','Test','00:00','23:59','open',false);
 insert into public.pickup_slots values('slot','s','20:00',10,true);`);
});
after(()=>db.close());
async function tx(run:()=>Promise<void>){await db.exec('begin');try{await run();}finally{await db.exec('rollback');}}
async function admin<T=Record<string,unknown>>(action:string,data:unknown={},who=actor,sid=session){return (await db.query<{v:T}>('select public.forno_push_admin($1::uuid,$2::uuid,$3,$4::jsonb) v',[who,sid,action,JSON.stringify(data)])).rows[0]!.v;}
async function worker<T=PushBatch|null>(action:string,data:unknown={},secret=token){return (await db.query<{v:T}>('select public.forno_push_worker($1,$2,$3::jsonb) v',[secret,action,JSON.stringify(data)])).rows[0]!.v;}
async function subscribe(suffix='1',who=actor,sid=session){return (await admin<{deviceId:string}>('subscribe',{endpoint:`https://fcm.googleapis.com/fcm/send/TEST_ONLY_${suffix}`,p256dh:'A'.repeat(87),auth:'A'.repeat(22),label:'Test device'},who,sid)).deviceId;}
async function order(){return (await db.query<{id:string}>(`insert into public.orders(service_id,pickup_slot_id,customer_first_name,customer_last_name,customer_phone,customer_note,total_cents,pizza_count,idempotency_key,pending_expires_at,status) values('s','slot','Private','Customer','+33600000000','NEVER_PUSH_THIS',2000,2,gen_random_uuid(),'2026-10-30T10:15Z','pending') returning id`)).rows[0]!.id;}
const count=async(table:string)=>(await db.query<{n:number}>(`select count(*)::int n from forno_private.${table}`)).rows[0]!.n;
const finish=(b:PushBatch,status:number)=>worker('finish',{deviceId:b.device.id,lease:b.lease,status});

test('Push environment requires the isolated branch, database, Preview and stable origin',()=>{
 const env={FORNO_ADMIN_ENABLED:'true',FORNO_PUSH_ENABLED:'true',VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'codex/test-commandes',SUPABASE_URL:'https://brzcvncsycdpsrvulqss.supabase.co'};
 assert.ok(pushEnabled(env));assert.ok(pushOriginAllowed(env,new URL('https://pizza-git-codex-test-commandes-maxime-mlds-projects.vercel.app/api/admin/push')));
 assert.equal(pushEnabled({...env,VERCEL_ENV:'production'}),false);assert.equal(pushEnabled({...env,SUPABASE_URL:'https://fqjkkjvrklpzhwmswlsy.supabase.co'}),false);assert.equal(pushOriginAllowed(env,new URL('https://unrelated.vercel.app')),false);
});
test('Closed push schema rejects forged owner, URL, label and unknown fields',()=>{
 const valid={action:'subscribe',endpoint:'https://fcm.googleapis.com/send/test',p256dh:'A'.repeat(87),auth:'A'.repeat(22),label:'Téléphone'};
 assert.ok(pushRequestSchema.safeParse(valid).success);for(const bad of [{...valid,owner:other},{...valid,endpoint:'http://evil.test/x'},{...valid,label:'a'.repeat(81)},{action:'test',deviceId:actor,body:'Fake'}])assert.equal(pushRequestSchema.safeParse(bad).success,false);
});
test('Bounded body rejects an oversized streaming request',async()=>{await assert.rejects(boundedBody(new Request('https://test.invalid',{method:'POST',body:'x'.repeat(8200)})),/ADMIN_INVALID/);});
test('Sensitive push tables and functions deny browser roles',()=>tx(async()=>{
 for(const role of ['anon','authenticated']){
  assert.equal((await db.query<{v:boolean}>(`select has_table_privilege('${role}','forno_private.push_subscriptions','select') or has_function_privilege('${role}','public.forno_push_worker(text,text,jsonb)','execute') or has_function_privilege('${role}','public.forno_push_admin(uuid,uuid,text,jsonb)','execute') v`)).rows[0]!.v,false);
 }
 assert.equal((await db.query<{n:number}>("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='forno_private' and c.relname like 'push_%' and c.relkind='r' and c.relrowsecurity")).rows[0]!.n,4);
}));
test('DB checks real membership and live session before push administration',()=>tx(async()=>{await db.exec(`update forno_private.admin_users set active=false where user_id='${other}'`);await assert.rejects(admin('status',{},other,otherSession),/ADMIN_FORBIDDEN/);}));
test('Device ownership cannot be transferred or inspected by another admin',()=>tx(async()=>{
 const id=await subscribe();const status=await admin<{devices:unknown[]}>('status',{},other,otherSession);assert.deepEqual(status.devices,[]);
 await assert.rejects(admin('revoke',{deviceId:id},other,otherSession),/PUSH_FORBIDDEN/);
}));
test('Existing endpoint cannot be claimed by another authorized admin',()=>tx(async()=>{await subscribe();await assert.rejects(subscribe('1',other,otherSession),/PUSH_CONFLICT/);}));
test('Subscription is idempotent; status returns metadata and no endpoint or keys',()=>tx(async()=>{
 assert.equal(await subscribe(),await subscribe());assert.equal(await count('push_subscriptions'),1);const status=JSON.stringify(await admin('status'));assert.ok(!status.includes('fcm.googleapis'));assert.ok(!status.includes('p256dh'));assert.ok(!status.includes('auth_key'));
}));
test('Outbox insert is transactional and creates no event after rollback',async()=>{
 await db.exec('begin');await order();assert.equal(await count('push_events'),1);await db.exec('rollback');assert.equal(await count('push_events'),0);
});
test('One event per persisted pending order, fanout and repeated claim have no duplicate delivery',()=>tx(async()=>{
 await subscribe();await order();const b=(await worker('claim'))!;assert.equal(b.events.length,1);assert.equal(await worker('claim'),null);assert.equal(await count('push_events'),1);assert.equal(await count('push_deliveries'),1);
 assert.equal(await worker('authorize',{deviceId:b.device.id,lease:b.lease}),true);await finish(b,201);assert.equal(await worker('claim'),null);
 const payload=JSON.stringify(notificationPayload(b.events));for(const privateValue of ['Private','Customer','+336','NEVER_PUSH_THIS','endpoint','auth'])assert.ok(!payload.includes(privateValue));assert.equal(JSON.parse(payload).pizzas,2);
}));
test('Devices subscribed after an event receive no historical notifications',()=>tx(async()=>{await order();await db.exec("select set_config('forno.test_now','2026-10-30T10:00:01Z',true)");await subscribe();assert.equal(await worker('claim'),null);}));
test('Accepted and expired requests are never claimed',()=>tx(async()=>{
 await subscribe();const id=await order();await db.query("update public.orders set status='accepted' where id=$1",[id]);assert.equal(await worker('claim'),null);await order();await db.exec("select set_config('forno.test_now','2026-10-30T10:16Z',true)");assert.equal(await worker('claim'),null);
}));
test('Temporary failure backs off, then can be delivered and acknowledged',()=>tx(async()=>{
 await subscribe();await order();const b=(await worker('claim'))!;await finish(b,503);assert.equal(await worker('claim'),null);await db.exec("select set_config('forno.test_now','2026-10-30T10:00:31Z',true)");const retry=(await worker('claim'))!;assert.notEqual(retry.lease,b.lease);await finish(retry,201);assert.equal((await db.query<{status:string}>('select status from forno_private.push_deliveries')).rows[0]!.status,'sent');
}));
test('Expired worker lease is reclaimed; stale success or 410 cannot revoke or acknowledge it',()=>tx(async()=>{
 await subscribe();await order();const old=(await worker('claim'))!;await db.exec("select set_config('forno.test_now','2026-10-30T10:01:31Z',true)");const next=(await worker('claim'))!;await finish(old,410);assert.equal((await db.query<{active:boolean}>('select active from forno_private.push_subscriptions')).rows[0]!.active,true);await finish(old,201);assert.equal((await db.query<{status:string}>('select status from forno_private.push_deliveries')).rows[0]!.status,'processing');await finish(next,201);
}));
test('Final in-flight attempt remains valid until its lease expires',()=>tx(async()=>{await subscribe();await order();const b=(await worker('claim'))!;await db.exec('update forno_private.push_deliveries set attempts=6 where true');assert.equal(await worker('claim'),null);assert.equal(await worker('authorize',{deviceId:b.device.id,lease:b.lease}),true);await finish(b,201);}));
test('Six exhausted attempts stop retries',()=>tx(async()=>{await subscribe();await order();await worker('claim');await db.exec("update forno_private.push_deliveries set attempts=6,lease_until=public.forno_test_now()-interval '1 second' where true");assert.equal(await worker('claim'),null);assert.equal((await db.query<{status:string}>('select status from forno_private.push_deliveries')).rows[0]!.status,'failed');}));
test('Provider 410 erases endpoint and subscription keys and cancels deliveries',()=>tx(async()=>{
 await subscribe();await order();await finish((await worker('claim'))!,410);const s=(await db.query<{active:boolean;endpoint:null;p256dh:null;auth_key:null}>('select * from forno_private.push_subscriptions')).rows[0]!;assert.equal(s.active,false);assert.equal(s.endpoint,null);assert.equal(s.p256dh,null);assert.equal(s.auth_key,null);assert.equal(await worker('claim'),null);
}));
test('Device withdrawal invalidates a lease immediately and clears keys',()=>tx(async()=>{const id=await subscribe();await order();const b=(await worker('claim'))!;await admin('revoke',{deviceId:id});assert.equal(await worker('authorize',{deviceId:id,lease:b.lease}),false);assert.equal((await db.query<{endpoint:null}>('select endpoint from forno_private.push_subscriptions')).rows[0]!.endpoint,null);}));
test('Revoked admin loses all device subscriptions immediately',()=>tx(async()=>{await subscribe();await subscribe('2');await db.exec(`update forno_private.admin_users set active=false where user_id='${actor}'`);assert.equal((await db.query<{n:number}>('select count(*)::int n from forno_private.push_subscriptions where active or endpoint is not null')).rows[0]!.n,0);}));
test('Test notification is targeted and limited to one per minute per device',()=>tx(async()=>{const id=await subscribe();await subscribe('2');await admin('test',{deviceId:id});assert.equal((await worker('claim'))!.device.id,id);await assert.rejects(admin('test',{deviceId:id}),/PUSH_RATE_LIMITED/);}));
test('Wrong worker token fails even for a service-role RPC',()=>tx(async()=>{await assert.rejects(worker('claim',{},'b'.repeat(64)),/PUSH_WORKER_FORBIDDEN/);}));
test('Push payload is a whitelist; provider URLs reject SSRF and credentials',()=>{
 const event={id:'id',eventId:'event',kind:'orders' as const,reference:'F-00000018',pizzas:3,pickupTime:'19:30',customer:'SECRET'};
 assert.deepEqual(notificationPayload([event]),{version:1,kind:'orders',count:1,reference:'F-00000018',pizzas:3,pickupTime:'19:30'});assert.deepEqual(notificationPayload([event,event]),{version:1,kind:'orders',count:2});
 for(const url of ['http://fcm.googleapis.com/a','https://fcm.googleapis.com.evil.test/a','https://127.0.0.1/a','https://user:password@fcm.googleapis.com/a','https://fcm.googleapis.com:8443/a'])assert.equal(allowedPushEndpoint(url),false);
 assert.ok(allowedPushEndpoint('https://web.push.apple.com/TEST'));assert.ok(allowedPushEndpoint('https://updates.push.services.mozilla.com/TEST'));
});
test('Portable worker sends once, checks authorization, acknowledges only sanitized provider status',async()=>{
 const batch={device:{id:actor,endpoint:'https://fcm.googleapis.com/send/test',keys:{p256dh:'a',auth:'b'}},lease:session,ids:['id'],events:[{id:'id',eventId:'event',kind:'test',reference:null,pizzas:null,pickupTime:null}]} satisfies PushBatch;
 let claimed=false,sends=0;const calls:Record<string,unknown>[]=[];const rpc:WorkerRpc=async<T>(_name:string,args:Record<string,unknown>)=>{calls.push(args);if(args.p_action==='claim'){if(claimed)return null as T;claimed=true;return batch as T;}if(args.p_action==='authorize')return true as T;return {ok:true} as T;};
 const stats=await dispatchPush(rpc,token,{publicKey:'test',privateKey:'test',subject:'https://test.invalid'},async()=>{sends++;return 201;});assert.equal(sends,1);assert.equal(stats.sent,1);assert.equal((calls.find(c=>c.p_action==='finish')!.p_data as {status:number}).status,201);
});

test('Push BFF denies missing session and forged CSRF before any privileged RPC',async()=>{
 const {ALL}=await import('../src/pages/api/admin/push');
 const values={FORNO_PUSH_ENABLED:'true',FORNO_ADMIN_ENABLED:'true',VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'codex/test-commandes',SUPABASE_URL:'https://brzcvncsycdpsrvulqss.supabase.co'};
 const previous=Object.fromEntries(Object.keys(values).map(k=>[k,process.env[k]]));Object.assign(process.env,values);
 try{
  const url='https://pizza-git-codex-test-commandes-maxime-mlds-projects.vercel.app/api/admin/push';
  const context={request:new Request(url,{method:'POST',headers:{Origin:'https://evil.test','Content-Type':'application/json'},body:'{}'}),cookies:{get:()=>({value:'server-nonce'})},locals:{}};
  let response=await ALL(context as never);assert.equal(response.status,401);
  (context.locals as Record<string,unknown>).admin={userId:actor,sessionId:session};response=await ALL(context as never);assert.equal(response.status,403);assert.deepEqual(await response.json(),{error:'CSRF'});
 }finally{for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
