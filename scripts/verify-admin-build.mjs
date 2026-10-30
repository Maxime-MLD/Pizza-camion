// Invoke the compiled Vercel handler. Synthetic config only; no network or database.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const directory=resolve('.vercel/output/functions/_render.func');
const settings=JSON.parse(await readFile(join(directory,'.vc-config.json'),'utf8'));
const production=process.argv.includes('--production');
Object.assign(process.env,{FORNO_ADMIN_ENABLED:'true',FORNO_ORDERS_ENABLED:'false',VERCEL_ENV:production?'production':'preview',VERCEL_GIT_COMMIT_REF:'codex/test-commandes',SUPABASE_URL:production?'https://fqjkkjvrklpzhwmswlsy.supabase.co':'https://brzcvncsycdpsrvulqss.supabase.co',SUPABASE_SECRET_KEY:'TEST_ONLY_NOT_A_KEY',ORDER_RATE_LIMIT_SALT:'x'.repeat(32)});
const {default:handler}=await import(pathToFileURL(join(directory,settings.handler)).href);
const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{throw Error('NETWORK_FORBIDDEN_IN_COMPILED_TEST');};
try{
 for(const path of ['/admin','/admin/','/admin/planning/','/admin/reglages/']){
  const response=await handler.fetch(new Request(`https://admin.test${path}`,{headers:{'x-forwarded-for':'127.0.0.1'}}));
  assert.equal(response.status,303,path);assert.match(response.headers.get('location'),/^\/admin\/login\//);assert.match(response.headers.get('cache-control'),/no-store/);
 }
 for(const path of ['/api/admin/orders','/api/admin/planning','/api/admin/settings','/api/admin/change','/api/admin/push']){
  const response=await handler.fetch(new Request(`https://admin.test${path}`,{headers:{'x-forwarded-for':'127.0.0.1'}}));assert.equal(response.status,401,path);assert.deepEqual(await response.json(),{error:'UNAUTHORIZED'});
 }
 const login=await handler.fetch(new Request('https://admin.test/admin/login/',{headers:{'x-forwarded-for':'127.0.0.1'}}));
 assert.equal(login.status,200);assert.equal(login.headers.get('referrer-policy'),'same-origin');assert.match(login.headers.get('set-cookie'),/HttpOnly/);assert.match(login.headers.get('set-cookie'),/Secure/);assert.match(login.headers.get('set-cookie'),/SameSite=Lax/i);
 const html=await login.text();assert.ok(html.includes('name="csrf"'));
 const csrf=html.match(/name="csrf"[^>]*value="([^"]+)"/)?.[1];assert.ok(csrf,'Missing rendered CSRF nonce');
 const csrfCookie=login.headers.get('set-cookie').split(';')[0];
 const called=[];globalThis.fetch=async(input)=>{called.push(String(input).split('/').pop());return String(input).includes('/rest/v1/rpc/')?Response.json(true):Response.json({error:'invalid credentials'},{status:401});};
 const invalid=await handler.fetch(new Request('https://admin.test/api/admin/login',{method:'POST',headers:{'x-forwarded-for':'127.0.0.1','Content-Type':'application/x-www-form-urlencoded',Cookie:csrfCookie,Origin:'https://admin.test'},body:new URLSearchParams({csrf,email:'test@example.invalid',password:'IncorrectSyntheticOnly!'}).toString()}));
 assert.equal(invalid.status,303);assert.ok(called.includes('token?grant_type=password'),JSON.stringify(called));
 globalThis.fetch=async()=>{throw Error('NETWORK_FORBIDDEN_IN_COMPILED_TEST');};assert.ok(!html.includes('TEST_ONLY_NOT_A_KEY'));assert.ok(html.includes('/admin/manifest.webmanifest'));assert.ok(html.includes('viewport-fit=cover'));
 assert.equal(login.headers.get('x-robots-tag'),'noindex, nofollow');assert.match(login.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 const logout=await handler.fetch(new Request('https://admin.test/api/admin/logout',{method:'POST',headers:{'x-forwarded-for':'127.0.0.1','Content-Type':'application/x-www-form-urlencoded',Origin:'https://evil.test'},body:'csrf=forged'}));assert.equal(logout.status,403);
 console.log('Compiled admin: protected HTML/API, CSRF, HttpOnly/Secure/Lax cookie and private cache verified, with all network forbidden.');
}finally{globalThis.fetch=originalFetch;}
