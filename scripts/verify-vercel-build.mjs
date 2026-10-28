// Verify the actual Vercel artifact and invoke its compiled function locally.
// Ordering is forced off; this script never submits to Supabase or modifies a remote database.
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const output=resolve('.vercel/output');
const config=JSON.parse(await readFile(join(output,'config.json'),'utf8'));
assert.equal(config.version,3);
for(const file of ['index.html','commander/index.html']){
 const html=await readFile(join(output,'static',file),'utf8');
 assert.ok(html.includes('<html')&&html.includes('FORNO.'),`Missing public page: ${file}`);
}
for(const path of ['/api/orders','/api/pickup-slots']){
 const route=config.routes.find(route=>route.src&&new RegExp(route.src).test(path)&&route.dest==='_render');
 assert.ok(route,`Missing server route: ${path}`);
}
const func=join(output,'functions','_render.func');
const settings=JSON.parse(await readFile(join(func,'.vc-config.json'),'utf8'));
assert.match(settings.runtime,/^nodejs(?:22|24)\.x$/);
const originalGate=process.env.FORNO_ORDERS_ENABLED;
process.env.FORNO_ORDERS_ENABLED='false';
try{
 const {default:handler}=await import(pathToFileURL(join(func,settings.handler)).href);
 for(const [method,path] of [['GET','/api/pickup-slots'],['GET','/api/orders'],['POST','/api/orders']]){
  const response=await handler.fetch(new Request(`https://forno.test${path}`,{method,headers:{'x-forwarded-for':'127.0.0.1',Origin:'https://forno.test','Content-Type':'application/json'},...(method==='POST'?{body:'{}'}:{})}));
  assert.equal(response.status,503,`${method} ${path} should fail closed, not 404`);
  assert.equal((await response.json()).error,'ORDERS_DISABLED');
  console.log(`${method} ${path}: 503 ORDERS_DISABLED (compiled Vercel function)`);
 }
 const refused=await handler.fetch(new Request('https://forno.test/api/orders',{method:'POST',headers:{'x-forwarded-for':'127.0.0.1',Origin:'https://other.test'}}));
 assert.equal(refused.status,403);
}finally{
 if(originalGate===undefined)delete process.env.FORNO_ORDERS_ENABLED;else process.env.FORNO_ORDERS_ENABLED=originalGate;
}
// Inspect only known secret values, without displaying them or copying .env files.
const secretNames=['SUPABASE_SECRET_KEY','ORDER_RATE_LIMIT_SALT','TURNSTILE_SECRET_KEY'];
const secrets=secretNames.map(key=>process.env[key]).filter(Boolean);
for(const file of ['.env','.env.local','.env.production']){
 try{
  for(const line of (await readFile(file,'utf8')).split('\n')){
   const match=line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*(.*)$/);
   if(match&&secretNames.includes(match[1]))secrets.push(match[2].trim().replace(/^(["'])(.*)\1$/,'$2'));
  }
 }catch(error){if(error.code!=='ENOENT')throw error;}
}
const actualSecrets=secrets.filter(value=>value.length>=8&&!value.startsWith('TODO_'));
async function checkTree(directory,client=false){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const path=join(directory,entry.name);
  assert.ok(!/^\.env(?:\.|$)|^\.dev\.vars(?:\.|$)/.test(entry.name),'Environment file must not be deployed');
  if(entry.isDirectory())await checkTree(path,client);
  else if(entry.isFile()){
   const data=await readFile(path);
   assert.ok(!actualSecrets.some(value=>data.includes(Buffer.from(value))),'A secret was included in the artifact');
   if(client&&/\.(?:js|html|css)$/.test(entry.name))assert.ok(!/SUPABASE_SECRET_KEY|TURNSTILE_SECRET_KEY|ORDER_RATE_LIMIT_SALT/.test(data.toString()),'Server environment reached the client');
  }
 }
}
await checkTree(output);
await checkTree(join(output,'static'),true);
console.log('Pages / and /commander/: present. Vercel routing, Node runtime and server-only secrets: verified.');
