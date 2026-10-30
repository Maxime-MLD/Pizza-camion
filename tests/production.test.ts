import test from 'node:test';
import assert from 'node:assert/strict';
import type {AstroCookies} from 'astro';
import {productionBindings,previewBindings} from './deployment-fixture';
import {safeOrderEnvironment} from '../src/server/orderEnvironmentGuard';
import {adminConfigured,mayOpenService,type AdminEnvironment} from '../src/server/admin/environment';
import {pushEnabled,pushOriginAllowed} from '../src/server/push/environment';
import {privateValidationEnabled} from '../src/server/validation/environment';
import {handlePrivateValidation} from '../src/server/validation/api';
import {handleOrdersApi} from '../src/server/ordersApi';
import {checkoutTransport} from '../src/scripts/checkoutTransport';
import {verifyTurnstile} from '../src/server/turnstileVerification';
import type {Rpc} from '../src/server/supabase';
const env:AdminEnvironment={...productionBindings,VERCEL_ENV:'production',SUPABASE_URL:`https://${productionBindings.FORNO_EXPECTED_SUPABASE_REF}.supabase.co`,SUPABASE_SECRET_KEY:'SYNTHETIC_NON_KEY',ORDER_RATE_LIMIT_SALT:'x'.repeat(32),TURNSTILE_SITE_KEY:'0xSYNTHETIC_PUBLIC',TURNSTILE_SECRET_KEY:'SYNTHETIC_SERVER',FORNO_TURNSTILE_MODE:'real',FORNO_ORDERS_ENABLED:'false',FORNO_ADMIN_ENABLED:'true',FORNO_VALIDATION_ENABLED:'true'};
const origin=productionBindings.FORNO_APP_ORIGIN,identity={userId:'a0000000-0000-4000-8000-000000000001',sessionId:'a0000000-0000-4000-8000-000000000002',email:''};
const cookies={get:()=>({value:'nonce'})} as unknown as AstroCookies;
const request=(action:string,body?:unknown,headers:Record<string,string>={})=>new Request(`${origin}/api/admin/validation/${action}`,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json','X-CSRF-Token':'nonce',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
const good={idempotencyKey:crypto.randomUUID(),serviceId:'service',slotId:'slot',date:'2026-10-30',village:'Configured village',lines:[{pizzaId:'capri',quantity:1}],customer:{firstName:'Synthetic',lastName:'Validation',phone:'+33612345678',comment:'',privacyAcknowledged:true},turnstileToken:'SYNTHETIC_TOKEN'};
const valid:typeof fetch=async()=>Response.json({success:true,hostname:new URL(origin).hostname,action:'order'});

test('Production profile rejects Test DB, Preview profile, unsupported targets and official Turnstile keys',()=>{
 assert.ok(safeOrderEnvironment(env));assert.ok(adminConfigured(env));
 for(const patch of [{SUPABASE_URL:`https://${previewBindings.FORNO_EXPECTED_SUPABASE_REF}.supabase.co`},{...previewBindings},{VERCEL_ENV:'development'},{FORNO_TURNSTILE_MODE:'official-test'},{TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA'}])assert.equal(safeOrderEnvironment({...env,...patch}),false);
 assert.equal(adminConfigured({...env,SUPABASE_URL:`https://${previewBindings.FORNO_EXPECTED_SUPABASE_REF}.supabase.co`}),false);
});
test('Production service opening requires explicit public or private validation authorization',()=>{assert.equal(mayOpenService({...env,FORNO_VALIDATION_ENABLED:'false'}),false);assert.equal(mayOpenService(env),true);assert.equal(mayOpenService({...env,FORNO_VALIDATION_ENABLED:'false',FORNO_ORDERS_ENABLED:'true'}),true);});
test('Push is available for its own Production profile only with flag and exact origin',()=>{assert.equal(pushEnabled(env),false);const push={...env,FORNO_PUSH_ENABLED:'true'};assert.ok(pushOriginAllowed(push,new URL(origin)));assert.equal(pushOriginAllowed(push,new URL(previewBindings.FORNO_APP_ORIGIN)),false);assert.equal(pushEnabled({...push,SUPABASE_URL:`https://${previewBindings.FORNO_EXPECTED_SUPABASE_REF}.supabase.co`}),false);});
test('Private validation requires closed public ordering, real keys, correct origin and explicit enablement',()=>{
 assert.ok(privateValidationEnabled(env,new URL(origin)));for(const patch of [{FORNO_VALIDATION_ENABLED:undefined},{FORNO_ADMIN_ENABLED:'false'},{FORNO_ORDERS_ENABLED:'true'},{FORNO_TURNSTILE_MODE:'official-test'},{SUPABASE_SECRET_KEY:undefined}])assert.equal(privateValidationEnabled({...env,...patch},new URL(origin)),false);assert.equal(privateValidationEnabled(env,new URL('https://foreign.test')),false);
});
test('Public APIs remain closed even with private validation enabled and an admin cookie',async()=>{
 for(const path of ['/api/orders','/api/pickup-slots']){let calls=0;const r=await handleOrdersApi(new Request(origin+path,{headers:{Cookie:'__Host-forno-admin-access=synthetic'}}),env,'test',{rpc:async<T>()=>{calls++;return true as T;}});assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'ORDERS_DISABLED'});assert.equal(calls,0);}
});
test('Private routes reject a missing identity, CSRF, cross-site request and disabled flag before network',async()=>{
 const noNetwork={rpc:async()=>{throw Error('RPC_MUST_NOT_RUN');},transport:async()=>{throw Error('FETCH_MUST_NOT_RUN');}};
 assert.equal((await handlePrivateValidation(request('orders',good),env,'orders',undefined,cookies,'ip',noNetwork)).status,401);
 assert.equal((await handlePrivateValidation(request('orders',good,{'X-CSRF-Token':'forged'}),env,'orders',identity,cookies,'ip',noNetwork)).status,403);
 assert.equal((await handlePrivateValidation(request('slots',undefined,{'Sec-Fetch-Site':'cross-site'}),env,'slots',identity,cookies,'ip',noNetwork)).status,403);
 assert.equal((await handlePrivateValidation(request('slots'),{...env,FORNO_VALIDATION_ENABLED:'false'},'slots',identity,cookies,'ip',noNetwork)).status,503);
});
test('Private availability uses existing RPC and never mutates the public gate',async()=>{
 const names:string[]=[];const rpc:Rpc=async<T>(name:string)=>{names.push(name);return(name==='forno_rate_limit'?true:{state:'unavailable',slots:[]}) as T;};
 const r=await handlePrivateValidation(request('slots'),env,'slots',identity,cookies,'ip',{rpc});assert.equal(r.status,200);assert.deepEqual(names,['forno_rate_limit','forno_pickup_slots']);assert.equal(env.FORNO_ORDERS_ENABLED,'false');
});
test('Private order still validates Turnstile and delegates secure creation without extra price fields',async()=>{
 const names:string[]=[];const rpc:Rpc=async<T>(name:string)=>{names.push(name);return(name==='forno_rate_limit'?true:{orderNumber:'F-00000001',status:'pending'}) as T;};let verifies=0;
 const r=await handlePrivateValidation(request('orders',good),env,'orders',identity,cookies,'ip',{rpc,transport:async(...args)=>{verifies++;return valid(...args);}});assert.equal(r.status,201);assert.equal(verifies,1);assert.ok(names.includes('forno_create_order'));
 names.length=0;const invalid=await handlePrivateValidation(request('orders',{...good,totalCents:1}),env,'orders',identity,cookies,'ip',{rpc,transport:valid});assert.equal(invalid.status,400);assert.ok(!names.includes('forno_create_order'));
});
test('Private order rejects invalid Turnstile before any order insertion',async()=>{
 for(const response of [{success:false},{success:true,hostname:'foreign.test',action:'order'},{success:true,hostname:new URL(origin).hostname,action:'wrong'}]){
  const names:string[]=[];const r=await handlePrivateValidation(request('orders',good),env,'orders',identity,cookies,'ip',{rpc:async<T>(name:string)=>{names.push(name);return true as T;},transport:async()=>Response.json(response)});assert.equal(r.status,400);assert.ok(!names.includes('forno_create_order'));
 }
});
test('Turnstile-only diagnostic is throttled, never inserts, and rejects reuse with a new attempt',async()=>{
 const spent=new Set<string>(),names:string[]=[];const rpc:Rpc=async<T>(name:string,args:Record<string,unknown>)=>{names.push(name);assert.match(String(args.p_key),/^[a-f0-9]{64}$/);return true as T;};
 const transport:typeof fetch=async(_url,options)=>{const body=JSON.parse(String(options?.body)) as {response:string};if(spent.has(body.response))return Response.json({success:false,'error-codes':['timeout-or-duplicate']});spent.add(body.response);return valid(_url,options);};
 const call=()=>handlePrivateValidation(request('turnstile',{token:'synthetic-once',attemptId:crypto.randomUUID()}),env,'turnstile',identity,cookies,'ip',{rpc,transport});
 const first=await call();assert.equal(first.status,200);assert.deepEqual(await first.json(),{valid:true});const replay=await call();assert.equal(replay.status,400);assert.deepEqual(await replay.json(),{error:'BOT_VERIFICATION_FAILED'});assert.ok(names.every(n=>n==='forno_rate_limit'));
});
test('Diagnostic rejects absent/oversized token, false CSRF and unknown fields before Siteverify',async()=>{
 for(const body of [{attemptId:crypto.randomUUID()},{token:'x'.repeat(2049),attemptId:crypto.randomUUID()},{token:'x',attemptId:crypto.randomUUID(),price:1}]){
  const r=await handlePrivateValidation(request('turnstile',body),env,'turnstile',identity,cookies,'ip',{transport:async()=>{throw Error('MUST_NOT_CALL');}});assert.equal(r.status,400);
 }
});
test('Turnstile transport failures fail closed without returning token or server key',async()=>{for(const transport of [async()=>{throw Error('NETWORK');},async()=>new Response('bad',{status:200})])assert.equal(await verifyTurnstile('synthetic-token',crypto.randomUUID(),'host',env,transport),'unavailable');});
test('Validation checkout uses protected endpoints and a separate retry storage namespace',()=>{const ordinary=checkoutTransport(false,'nonce'),privateFlow=checkoutTransport(true,'nonce');assert.equal(ordinary.orders,'/api/orders');assert.deepEqual(ordinary.headers,{});assert.equal(privateFlow.orders,'/api/admin/validation/orders');assert.equal(privateFlow.headers['X-CSRF-Token'],'nonce');assert.notEqual(ordinary.storagePrefix,privateFlow.storagePrefix);});


test('Edge worker is bound to its platform project, with no Test reference in its source',async()=>{const {workerProjectMatches}=await import('../supabase/functions/_shared/push-worker');const url=env.SUPABASE_URL!;assert.ok(workerProjectMatches(url,productionBindings.FORNO_EXPECTED_SUPABASE_REF+'_function_1'));assert.equal(workerProjectMatches(url,previewBindings.FORNO_EXPECTED_SUPABASE_REF+'_function_1'),false);assert.equal(workerProjectMatches('https://foreign.test',undefined),false);});
