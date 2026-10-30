// Local verification of the exact production-profile Vercel artifact; no real network.
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const output=resolve('.vercel/output');
const forbidden=['brzcvncsycdpsrvulqss','pizza-git-codex-test-commandes','codex/test-commandes','ffmax42@hotmail.fr','FORNO_PUSH_PHYSICAL_TEST','FORNO_TEST_ONLY','+33600000000','pizza-camion-forno.quirkyhawk35.chatgpt.site'];
async function scan(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await scan(path);else if(entry.isFile()){
 const text=(await readFile(path)).toString().toLowerCase();for(const value of forbidden)assert.ok(!text.includes(value.toLowerCase()),`Forbidden Test/old-host reference in ${path.replace(output,'')}`);
 assert.ok(!/^\.env(?:\.|$)|^\.dev\.vars/.test(entry.name),'Environment file in artifact');
}}}
await scan(output);
const config=JSON.parse(await readFile(join(output,'config.json'),'utf8'));
for(const path of ['/api/orders','/api/pickup-slots','/admin/verification/','/api/admin/validation/orders','/api/admin/validation/turnstile'])assert.ok(config.routes.some(r=>r.src&&new RegExp(r.src).test(path)&&r.dest==='_render'),`Missing route ${path}`);
const directory=join(output,'functions','_render.func'),settings=JSON.parse(await readFile(join(directory,'.vc-config.json'),'utf8'));
Object.assign(process.env,{VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:'main',FORNO_ORDERS_ENABLED:'false',FORNO_ADMIN_ENABLED:'true',FORNO_PUSH_ENABLED:'false',FORNO_VALIDATION_ENABLED:'false',SUPABASE_URL:'https://fqjkkjvrklpzhwmswlsy.supabase.co',SUPABASE_SECRET_KEY:'SYNTHETIC_NON_KEY',ORDER_RATE_LIMIT_SALT:'x'.repeat(32),TURNSTILE_SITE_KEY:'0xSYNTHETIC_PUBLIC',TURNSTILE_SECRET_KEY:'SYNTHETIC_SERVER',FORNO_TURNSTILE_MODE:'real'});
const {default:handler}=await import(pathToFileURL(join(directory,settings.handler)).href);
const origin='https://pizza-two-bay.vercel.app',actor='a0000000-0000-4000-8000-000000000001',session='a0000000-0000-4000-8000-000000000002';
const jwt=`header.${Buffer.from(JSON.stringify({sub:actor,session_id:session})).toString('base64url')}.synthetic`;
const cookie=`__Host-forno-admin-access=${jwt}; __Host-forno-admin-csrf=nonce`;
const original=globalThis.fetch;let creates=0,verifies=0;
globalThis.fetch=async(input)=>{
 const url=String(input);if(url.endsWith('/auth/v1/user'))return Response.json({id:actor});
 if(url.endsWith('/rest/v1/rpc/forno_admin_session')||url.endsWith('/rest/v1/rpc/forno_rate_limit'))return Response.json(true);
 if(url.endsWith('/rest/v1/rpc/forno_pickup_slots'))return Response.json({state:'unavailable',slots:[]});
 if(url.includes('/forno_create_order'))creates++;if(url.includes('siteverify'))verifies++;
 throw Error('UNEXPECTED_NETWORK_IN_COMPILED_TEST');
};
const call=(path,method='GET',auth=false,headers={})=>handler.fetch(new Request(origin+path,{method,headers:{'x-forwarded-for':'127.0.0.1',Origin:origin,...(auth?{Cookie:cookie}:{}),...headers},...(method==='POST'?{body:'{}'}:{})}));
try{
 const anon=await call('/api/admin/validation/orders');assert.equal(anon.status,401);
 const page=await call('/admin/verification/');assert.equal(page.status,303);
 let r=await call('/api/admin/validation/orders','POST',true,{'Content-Type':'application/json','X-CSRF-Token':'nonce'});assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'VALIDATION_DISABLED'});
 process.env.FORNO_VALIDATION_ENABLED='true';
 r=await call('/api/admin/validation/turnstile','POST',true,{'Content-Type':'application/json'});assert.equal(r.status,403);assert.deepEqual(await r.json(),{error:'CSRF'});
 r=await call('/api/admin/validation/turnstile','GET',true);assert.equal(r.status,200);assert.equal((await r.json()).siteKey,'0xSYNTHETIC_PUBLIC');assert.match(r.headers.get('cache-control'),/no-store/);
 r=await call('/api/admin/validation/slots','GET',true);assert.equal(r.status,200);
 for(const [method,path] of [['GET','/api/pickup-slots'],['GET','/api/orders'],['POST','/api/orders']]){r=await call(path,method,true,{'Content-Type':'application/json','X-CSRF-Token':'nonce'});assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'ORDERS_DISABLED'});}
 assert.equal(creates,0);assert.equal(verifies,0);
}finally{globalThis.fetch=original;}
console.log('Production artifact: no Test identity/resource/old canonical; protected validation routes; public gate closed even for an authenticated validator; zero real network.');
