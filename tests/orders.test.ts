import {previewBindings} from './deployment-fixture';
import test, {before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {PGlite} from '@electric-sql/pglite';
import {handleOrdersApi,requestDigest} from '../src/server/ordersApi';
import {orderRequestSchema} from '../src/server/orderSchema';
import {createRpc,DatabaseError,type Rpc} from '../src/server/supabase';
import {readAttempt,saveAttempt} from '../src/scripts/orderSession';
import {safeOrderEnvironment,validTurnstileResponse} from '../src/server/orderEnvironmentGuard';
import {orderEnvironments} from '../src/config/order-environments.config';
const db=new PGlite();
const env={FORNO_ORDERS_ENABLED:'true',SUPABASE_URL:'https://test.supabase.co',SUPABASE_SECRET_KEY:'unit-test-only',ORDER_RATE_LIMIT_SALT:'test-salt-with-at-least-thirty-two-characters',TURNSTILE_SITE_KEY:'test-site',TURNSTILE_SECRET_KEY:'test-secret'};
before(async()=>{
 await db.exec("create role anon; create role authenticated; create role service_role; create function public.forno_test_now() returns timestamptz language sql stable as $$ select coalesce(nullif(current_setting('forno.test_now',true),''),'2026-10-27T14:00:00Z')::timestamptz $$;");
 // Test-only clock substitution; production SQL always uses the actual PostgreSQL clock.
 const sql=(await readFile('supabase/migrations/202610280001_orders.sql','utf8')).replace(/\b(?:clock_timestamp|now)\(\)/g,'public.forno_test_now()');
 await db.exec(sql);await db.exec(await readFile('supabase/migrations/202610280002_catalogue.sql','utf8'));
 const hardening=(await readFile('supabase/migrations/20261028095508_harden_forno_data_api.sql','utf8')).replace(/\b(?:clock_timestamp|now)\(\)/g,'public.forno_test_now()');
 await db.exec(hardening);
 await db.exec("insert into public.services(id,service_date,village,opening_time,closing_time,status,orders_enabled) values ('forno-2026-10-27-2','2026-10-27','Vougy','18:00','21:30','open',true); insert into public.pickup_slots values ('forno-2026-10-27-2@18:00','forno-2026-10-27-2','18:00',3,true);");
});
after(()=>db.close());
const base=()=>({idempotencyKey:crypto.randomUUID(),serviceId:'forno-2026-10-27-2',slotId:'forno-2026-10-27-2@18:00',date:'2026-10-27',village:'Vougy',lines:[{pizzaId:'capri',quantity:2}],customer:{firstName:'Camille',lastName:'Essai',phone:'+33612345678',comment:'',privacyAcknowledged:true},turnstileToken:'test-token'});
async function callOrder(value=base(),hash='a'.repeat(64)){
 const result=await db.query<{receipt:Record<string,unknown>}>('select public.forno_create_order($1::jsonb,$2,$3) as receipt',[JSON.stringify(value),hash,'b'.repeat(64)]);return result.rows[0]!.receipt;
}
async function transaction(run:()=>Promise<void>){await db.exec('begin');try{await run();}finally{await db.exec('rollback');}}
const verify:typeof fetch=async()=>Response.json({success:true,hostname:'forno.test',action:'order'});
function request(body:unknown=base()){return new Request('https://forno.test/api/orders',{method:'POST',headers:{Origin:'https://forno.test','Content-Type':'application/json'},body:JSON.stringify(body)});}

test('SQL : mardi Vougy, vrais prix et snapshots, facture pending sans coordonnées dans la réponse',()=>transaction(async()=>{
 const receipt=await callOrder();assert.equal(receipt.status,'pending');assert.equal(receipt.totalCents,2000);assert.equal(receipt.village,'Vougy');assert.deepEqual(receipt.lines,[{pizzaId:'capri',quantity:2}]);assert.ok(!JSON.stringify(receipt).includes('0612345678'));
 const row=(await db.query<{unit_price_cents:number;quantity:number}>('select * from public.order_items')).rows[0]!;assert.equal(row.unit_price_cents,1000);assert.equal(row.quantity,2);
}));
test('SQL : mauvais service, dimanche, date changée, fermeture et annulation exceptionnelle rejetés',async()=>{
 for(const [sql,patch,error] of [
  ['',{serviceId:'forno-2026-10-28-3'},'WRONG_SERVICE'],
  ['',{village:'Mably'},'WRONG_SERVICE'],
  ['',{date:'2026-10-28'},'WRONG_SERVICE'],
  ["select set_config('forno.test_now','2026-11-01T12:00:00Z',true)",{},'WRONG_SERVICE'],
  ["select set_config('forno.test_now','2026-10-27T23:01:00Z',true)",{},'WRONG_SERVICE'],
  ["select set_config('forno.test_now','2026-10-27T21:00:00Z',true)",{},'SERVICE_CLOSED'],
  ["update public.services set status='cancelled'",{},'SERVICE_CLOSED'],
  ["update public.services set orders_enabled=false",{},'SERVICE_CLOSED'],
 ] as const) await transaction(async()=>{if(sql)await db.exec(sql);await assert.rejects(callOrder({...base(),...patch}),new RegExp(error));});
});
test('SQL : créneau passé et préparation minimum rejetés',()=>transaction(async()=>{
 await db.exec("select set_config('forno.test_now','2026-10-27T16:40:00Z',true)");await assert.rejects(callOrder(),/SLOT_EXPIRED/);
}));
test('SQL : capacité en pizzas, créneau full, statuts pending/accepted et libération après expiration',()=>transaction(async()=>{
 await callOrder();const before=(await db.query<{data:{slots:{state:string}[]}}>('select public.forno_pickup_slots(2) data')).rows[0]!.data;assert.equal(before.slots[0]!.state,'full');
 await assert.rejects(callOrder(),/SLOT_FULL/);
 // An error aborts a PostgreSQL transaction: use a savepoint around expected failures below.
}));
test('SQL : pending expiré libère la charge et maintenance annule puis purge les coordonnées',()=>transaction(async()=>{
 await callOrder();await db.exec("select set_config('forno.test_now','2026-10-27T14:16:00Z',true)");
 const slots=(await db.query<{data:{slots:{state:string}[]}}>('select public.forno_pickup_slots(2) data')).rows[0]!.data;assert.equal(slots.slots[0]!.state,'available');
 await db.exec('select public.forno_maintenance()');assert.equal((await db.query<{status:string}>('select status from public.orders')).rows[0]!.status,'cancelled');
 await db.exec("select set_config('forno.test_now','2026-11-28T12:00:00Z',true);select public.forno_maintenance()");
 const row=(await db.query<{customer_phone:null;request_hash:null}>('select customer_phone,request_hash from public.orders')).rows[0]!;assert.equal(row.customer_phone,null);assert.equal(row.request_hash,null);
}));
test('SQL : accepted conserve sa capacité après TTL, rejected libère le créneau',()=>transaction(async()=>{
 await callOrder();await db.exec("update public.orders set status='accepted';select set_config('forno.test_now','2026-10-27T14:16:00Z',true);select public.forno_maintenance()");
 let data=(await db.query<{data:{slots:{state:string}[]}}>('select public.forno_pickup_slots(2) data')).rows[0]!.data;assert.equal(data.slots[0]!.state,'full');
 await db.exec("update public.orders set status='rejected'");data=(await db.query<{data:{slots:{state:string}[]}}>('select public.forno_pickup_slots(2) data')).rows[0]!.data;assert.equal(data.slots[0]!.state,'available');
}));
test('SQL : pizza indisponible et quantité invalide rejetées',async()=>{
 await transaction(async()=>{await db.exec("update public.pizzas set available=false where id='capri'");await assert.rejects(callOrder(),/PIZZA_UNAVAILABLE/);});
 await transaction(async()=>{const value=base();value.lines[0]!.quantity=-2;await assert.rejects(callOrder(value),/INVALID_QUANTITY/);});
});
test('SQL : double clic/rejeu ne crée qu’une commande ; fingerprint différent rejeté',()=>transaction(async()=>{
 const value=base();const first=await callOrder(value);const second=await callOrder(value);assert.equal(first.orderNumber,second.orderNumber);
 assert.equal((await db.query<{count:number}>('select count(*)::integer count from public.orders')).rows[0]!.count,1);
 await assert.rejects(callOrder(value,'c'.repeat(64)),/IDEMPOTENCY_CONFLICT/);
}));
test('SQL : deux envois concurrents mis en file par PGlite n’excèdent pas la capacité',async()=>{
 // PGlite serializes its single connection. Multi-connection lock verification is a separate real-Postgres test.
 const results=await Promise.allSettled([callOrder(),callOrder()]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await db.query<{units:number}>('select sum(pizza_count)::integer units from public.orders')).rows[0]!.units,2);
 await db.exec('delete from public.order_items;delete from public.orders;delete from forno_private.request_limits');
});
test('RLS : anon/authenticated ne peuvent lire/écrire tables et RPC, même une lecture accordée ne révèle rien',async()=>{
 await callOrder();
 for(const role of ['anon','authenticated']){
  for(const sql of ['select * from public.orders','select * from public.order_items',"update public.pizzas set price_cents=1","update public.services set orders_enabled=true",'select public.forno_pickup_slots(1)',"select public.forno_create_order('{}'::jsonb,'x','y')"]){
   await transaction(async()=>{await db.exec(`set local role ${role}`);await assert.rejects(db.exec(sql),/permission denied/);});
  }
  await transaction(async()=>{await db.exec(`grant select on public.orders to ${role}; set local role ${role}`);assert.equal((await db.query('select * from public.orders')).rows.length,0);});
 }
 await db.exec('delete from public.order_items;delete from public.orders;delete from forno_private.request_limits');
});
test('Données : 13 recettes et génération du planning central sans écraser les exceptions datées',async()=>{
 assert.equal((await db.query<{n:number}>('select count(*)::integer n from public.pizzas')).rows[0]!.n,13);
 assert.equal((await db.query<{n:number}>('select count(*)::integer n from public.pizzas where not available')).rows[0]!.n,2);
 const sql=execFileSync(process.execPath,['scripts/prepare-order-data.mjs','services','2026-10-28','2'],{encoding:'utf8'});
 await db.exec(sql);
 const row=(await db.query<{village:string;orders_enabled:boolean}>("select village,orders_enabled from public.services where service_date='2026-10-28'")).rows[0]!;
 assert.equal(row.village,'Mably');assert.equal(row.orders_enabled,false);
 await db.exec("update public.services set status='cancelled' where service_date='2026-10-28'");await db.exec(sql);
 assert.equal((await db.query<{status:string}>("select status from public.services where service_date='2026-10-28'")).rows[0]!.status,'cancelled');
});
test('Schéma : prix falsifié, champs inconnus, coordonnées invalides, doublons et quantités non entières rejetés',()=>{
 const good=base();assert.ok(orderRequestSchema.safeParse(good).success);
 for(const bad of [{...good,totalCents:1},{...good,customer:{...good.customer,phone:'123'}},{...good,lines:[{pizzaId:'capri',quantity:1.5}]},{...good,lines:[...good.lines,...good.lines]},{...good,lines:[{pizzaId:'capri',quantity:99}]},{...good,customer:{...good.customer,privacyAcknowledged:false}}])assert.equal(orderRequestSchema.safeParse(bad).success,false);
});
test('API : vraie transaction derrière RPC injecté et validation anti-bot côté serveur',()=>transaction(async()=>{
 const rpc:Rpc=async<T>(name:string,args:Record<string,unknown>)=>{
  if(name==='forno_rate_limit')return true as T;
  if(name==='forno_create_order')return (await callOrder(args.p_request as ReturnType<typeof base>,args.p_request_hash as string)) as T;
  throw Error('unexpected RPC');
 };
 const response=await handleOrdersApi(request(),env,'127.0.0.1',{rpc,transport:verify});assert.equal(response.status,201);assert.equal((await response.json()).receipt.status,'pending');
}));
test('API : origin, méthode, taille et JSON invalides bloqués',async()=>{
 assert.equal((await handleOrdersApi(request(),{},'ip')).status,503);
 const rpc:Rpc=async<T>()=>true as T;
 const badOrigin=request();badOrigin.headers.set('Origin','https://evil.test');assert.equal((await handleOrdersApi(badOrigin,env,'ip',{rpc})).status,403);
 assert.equal((await handleOrdersApi(new Request('https://forno.test/api/orders',{method:'DELETE'}),env,'ip')).status,405);
 assert.equal((await handleOrdersApi(request({x:'x'.repeat(17000)}),env,'ip',{rpc})).status,413);
 assert.equal((await handleOrdersApi(request({...base(),totalCents:1}),env,'ip',{rpc})).status,400);
});
test('API : débit durable, indisponibilité Supabase et refus Turnstile ne donnent jamais un succès',async()=>{
 assert.equal((await handleOrdersApi(request(),env,'ip',{rpc:async<T>()=>false as T})).status,429);
 assert.equal((await handleOrdersApi(request(),env,'ip',{rpc:async()=>{throw Error('backend down');}})).status,503);
 const rpc:Rpc=async<T>()=>true as T;
 const bad:typeof fetch=async()=>Response.json({success:false});assert.equal((await handleOrdersApi(request(),env,'ip',{rpc,transport:bad})).status,400);
 const fake:typeof fetch=async()=>Response.json({success:true,hostname:'evil.test',action:'order'});assert.equal((await handleOrdersApi(request(),env,'ip',{rpc,transport:fake})).status,400);
});
test('Client Supabase : secret envoyé uniquement en apikey, erreur nettoyée',async()=>{
 let headers:Headers|undefined;
 const transport:typeof fetch=async(_url,init)=>{headers=new Headers(init?.headers);return Response.json({message:'SLOT_FULL'},{status:400});};
 await assert.rejects(createRpc(env,transport)('forno_create_order',{}),error=>error instanceof DatabaseError&&error.code==='SLOT_FULL');
 assert.equal(headers!.get('apikey'),'unit-test-only');assert.equal(headers!.get('Authorization'),null);
});
test('Actualisation : seule la clé de tentative et les quantités sont conservées, puis reçu récupérable',()=>transaction(async()=>{
 const value=base();const memory=new Map<string,string>();const storage={getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,val:string)=>{memory.set(key,val);}};
 saveAttempt(storage,{key:value.idempotencyKey,lines:value.lines,consumed:false});assert.equal(readAttempt(storage)?.key,value.idempotencyKey);assert.ok(![...memory.values()].join('').includes('Camille'));
 await callOrder(value,await requestDigest(value));
 const receipt=(await db.query<{receipt:{orderNumber:string}}>('select public.forno_recover_order($1) receipt',[value.idempotencyKey])).rows[0]!.receipt;assert.match(receipt.orderNumber,/^F-/);
}));

test('Durcissement : service_role utilise uniquement les RPC et ne peut pas lire les tables ou purger',()=>transaction(async()=>{
 await db.exec('set local role service_role');
 const receipt=await callOrder();assert.equal(receipt.village,'Vougy');
 const canRead=(await db.query<{allowed:boolean}>("select has_table_privilege('service_role','public.orders','SELECT') as allowed")).rows[0]!.allowed;
 assert.equal(canRead,false);
 const canPurge=(await db.query<{allowed:boolean}>("select has_function_privilege('service_role','public.forno_maintenance()','EXECUTE') as allowed")).rows[0]!.allowed;
 assert.equal(canPurge,false);
}));
test('Durcissement : les valeurs NULL ne contournent pas les validations SQL',async()=>{
 for(const patch of [{customer:{...base().customer,firstName:null}},{customer:{...base().customer,phone:null}},{customer:{...base().customer,privacyAcknowledged:'true'}},{idempotencyKey:null}]){
  await transaction(async()=>{await assert.rejects(callOrder({...base(),...patch} as unknown as ReturnType<typeof base>),/INVALID_REQUEST/);});
 }
});

test('Déploiement : commandes désactivées par défaut, aucune requête Supabase sans activation explicite',async()=>{
 let calls=0;const rpc:Rpc=async<T>()=>{calls++;return true as T;};
 for(const enabled of [undefined,'false']){
  const disabledEnv={...env,FORNO_ORDERS_ENABLED:enabled};
  for(const req of [request(),new Request('https://forno.test/api/pickup-slots')]){
   const response=await handleOrdersApi(req,disabledEnv,'ip',{rpc});
   assert.equal(response.status,503);assert.equal((await response.json()).error,'ORDERS_DISABLED');
  }
 }
 assert.equal(calls,0);
});

test('Turnstile : jeton absent, invalide, expiré ou réutilisé ne crée aucune commande',async()=>{
 let writes=0;let verifications=0;
 const rpc:Rpc=async<T>(name:string)=>{if(name==='forno_rate_limit')return true as T;writes++;throw Error('unexpected write');};
 const transport:typeof fetch=async()=>{verifications++;return Response.json({success:false,'error-codes':['timeout-or-duplicate']});};
 for(const token of ['',undefined]){
  const response=await handleOrdersApi(request({...base(),turnstileToken:token}),env,'ip',{rpc,transport});
  assert.equal(response.status,400);assert.equal((await response.json()).error,'INVALID_REQUEST');
 }
 assert.equal(verifications,0);
 for(const code of ['invalid-input-response','timeout-or-duplicate']){
  const response=await handleOrdersApi(request(),env,'ip',{rpc,transport:async()=>Response.json({success:false,'error-codes':[code]})});
  assert.equal(response.status,400);assert.equal((await response.json()).error,'BOT_VERIFICATION_FAILED');
 }
 assert.equal(writes,0);
});
test('Turnstile : domaine, action et succès stricts, y compris avec la réponse des clés officielles de test',async()=>{
 let writes=0;
 const rpc:Rpc=async<T>(name:string)=>{if(name==='forno_rate_limit')return true as T;writes++;throw Error('unexpected write');};
 for(const check of [
  {success:true,hostname:'evil.test',action:'order'},
  {success:true,hostname:'forno.test',action:'other'},
  {success:true,hostname:'forno.test'},
  {success:'true',hostname:'forno.test',action:'order'},
  {success:true,hostname:'example.com',metadata:{result_with_testing_key:true}},
 ]){
  const response=await handleOrdersApi(request(),env,'ip',{rpc,transport:async()=>Response.json(check)});
  assert.equal(response.status,400);assert.equal((await response.json()).error,'BOT_VERIFICATION_FAILED');
 }
 assert.equal(writes,0);
});
test('Turnstile : panne réseau ou réponse illisible ferme la commande sans insertion',async()=>{
 let writes=0;
 const rpc:Rpc=async<T>(name:string)=>{if(name==='forno_rate_limit')return true as T;writes++;throw Error('unexpected write');};
 for(const transport of [async()=>{throw new Error('network');},async()=>new Response('bad'),async()=>new Response(null,{status:503})] as typeof fetch[]){
  const response=await handleOrdersApi(request(),env,'ip',{rpc,transport});assert.equal(response.status,503);
 }
 assert.equal(writes,0);
});
test('Turnstile : le renouvellement du jeton change sa clé de vérification sans changer l’idempotence de la commande',async()=>{
 const value=base();const validationKeys:string[]=[];const hashes:string[]=[];
 const rpc:Rpc=async<T>(name:string,args:Record<string,unknown>)=>{
  if(name==='forno_rate_limit')return true as T;
  assert.equal(name,'forno_create_order');
  assert.equal((args.p_request as typeof value).idempotencyKey,value.idempotencyKey);
  hashes.push(args.p_request_hash as string);
  return {orderNumber:'F-TEST',status:'pending'} as T;
 };
 const transport:typeof fetch=async(url,init)=>{
  assert.equal(url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  const body=JSON.parse(String(init?.body));
  assert.equal(body.secret,env.TURNSTILE_SECRET_KEY);
  validationKeys.push(body.idempotency_key);
  assert.match(body.idempotency_key,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  return Response.json({success:true,hostname:'forno.test',action:'order'});
 };
 for(const token of ['old-token','old-token','renewed-token']){
  const response=await handleOrdersApi(request({...value,turnstileToken:token}),env,'ip',{rpc,transport});assert.equal(response.status,201);
 }
 assert.equal(validationKeys[0],validationKeys[1]);assert.notEqual(validationKeys[0],validationKeys[2]);
 assert.equal(new Set(hashes).size,1);
});
test('API : contrat de lecture avec RPC injectée sans report à demain, erreurs SQL métier conservées',async()=>{
 const rpc:Rpc=async<T>(name:string,args:Record<string,unknown>)=>{
  if(name==='forno_rate_limit')return true as T;
  assert.equal(name,'forno_pickup_slots');assert.equal(args.p_quantity,2);
  return {date:'2026-11-01',state:'unavailable',reason:'closed',service:null,slots:[]} as T;
 };
 const response=await handleOrdersApi(new Request('https://forno.test/api/pickup-slots?quantity=2'),env,'ip',{rpc});
 const data=await response.json();assert.equal(data.service,null);assert.deepEqual(data.slots,[]);
 assert.equal(data.date,'2026-11-01');assert.equal(data.turnstileSiteKey,env.TURNSTILE_SITE_KEY);
 for(const code of ['WRONG_SERVICE','SERVICE_CLOSED','SLOT_EXPIRED','SLOT_UNAVAILABLE','SLOT_FULL','IDEMPOTENCY_CONFLICT']){
  const response=await handleOrdersApi(request(),env,'ip',{transport:verify,rpc:async<T>(name:string)=>{
   if(name==='forno_rate_limit')return true as T;throw new DatabaseError(code);
  }});
  assert.equal(response.status,409);assert.equal((await response.json()).error,code);
 }
});

const previewEnv={...env,...previewBindings,VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:orderEnvironments.testBranch,
 SUPABASE_URL:`https://${orderEnvironments.testSupabaseRef}.supabase.co`,FORNO_TURNSTILE_MODE:'official-test',
 TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA'};
test('Isolation : Preview exige la branche et la base de test exactes avant tout appel réseau',async()=>{
 assert.equal(safeOrderEnvironment(previewEnv),true);
 const forbidden=[
  {...previewEnv,VERCEL_ENV:'production'},
  {...previewEnv,VERCEL_ENV:undefined},
  {...previewEnv,VERCEL_GIT_COMMIT_REF:'main'},
  {...previewEnv,SUPABASE_URL:`https://${orderEnvironments.productionSupabaseRef}.supabase.co`},
  {...previewEnv,SUPABASE_URL:`https://${orderEnvironments.testSupabaseRef}.supabase.co.evil.test`},
  {...previewEnv,SUPABASE_URL:`https://evil@${orderEnvironments.testSupabaseRef}.supabase.co`},
  {...previewEnv,SUPABASE_URL:'bad'},
  {...previewEnv,FORNO_TURNSTILE_MODE:'real'},
  {...env,TURNSTILE_SITE_KEY:previewEnv.TURNSTILE_SITE_KEY},
 ];
 for(const bad of forbidden){
  assert.equal(safeOrderEnvironment(bad),false);
  let calls=0;const rpc:Rpc=async<T>()=>{calls++;return true as T;};
  const response=await handleOrdersApi(request(),bad,'ip',{rpc});
  assert.equal(response.status,503);assert.equal(calls,0);
 }
});
test('Isolation : mode officiel valide réellement Siteverify et sa réponse de test, jamais en Production',async()=>{
 const demo={success:true,hostname:'example.com',metadata:{result_with_testing_key:true}};
 assert.equal(validTurnstileResponse(demo,'preview.test',previewEnv),true);
 assert.equal(validTurnstileResponse(demo,'example.com',env),false);
 for(const check of [null,{}, {...demo,success:false},{...demo,metadata:{}},{...demo,hostname:'evil.test'},{...demo,action:'other'}])
  assert.equal(validTurnstileResponse(check,'preview.test',previewEnv),false);
 let verified=false;let inserted=false;
 const rpc:Rpc=async<T>(name:string)=>{if(name==='forno_rate_limit')return true as T;assert.equal(verified,true);inserted=true;return {orderNumber:'F-TEST',status:'pending'} as T;};
 const response=await handleOrdersApi(request(),previewEnv,'ip',{rpc,transport:async()=>{verified=true;return Response.json(demo);}});
 assert.equal(response.status,201);assert.equal(inserted,true);
});
