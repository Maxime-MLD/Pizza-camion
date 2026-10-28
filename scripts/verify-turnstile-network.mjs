// Explicit network check using ONLY Cloudflare's public dummy credentials.
// No .env loading, Supabase connection, real challenge token or order insertion.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const directory=await mkdtemp(join(process.cwd(),'node_modules/.forno-turnstile-audit-'));
try {
  const {outputFiles}=await build({entryPoints:['src/server/ordersApi.ts'],bundle:true,format:'esm',platform:'node',packages:'external',write:false});
  const file=join(directory,'api.mjs');await writeFile(file,outputFiles[0].text);
  const {handleOrdersApi}=await import(pathToFileURL(file).href);
  const cases=[
    {name:'official-pass',key:'1x0000000000000000000000000000000AA',success:true},
    {name:'official-fail',key:'2x0000000000000000000000000000000AA',success:false,error:'invalid-input-response'},
    {name:'official-spent',key:'3x0000000000000000000000000000000AA',success:false,error:'timeout-or-duplicate'},
  ];
  for(const scenario of cases){
    let result;let creations=0;let calls=0;
    const transport=async(url,init)=>{
      assert.equal(url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');
      const r=await fetch(url,init);assert.equal(r.status,200);
      result=await r.clone().json();calls++;return r;
    };
    const body={idempotencyKey:crypto.randomUUID(),serviceId:'test-only',slotId:'test-only',date:'2026-10-28',village:'Test',
      lines:[{pizzaId:'capri',quantity:1}],customer:{firstName:'Test',lastName:'Essai',phone:'+33600000000',comment:'',privacyAcknowledged:true},turnstileToken:'XXXX.DUMMY.TOKEN.XXXX'};
    const response=await handleOrdersApi(new Request('https://forno.test/api/orders',{method:'POST',headers:{Origin:'https://forno.test','Content-Type':'application/json'},body:JSON.stringify(body)}),{
      FORNO_ORDERS_ENABLED:'true',SUPABASE_URL:'https://not-contacted.invalid',SUPABASE_SECRET_KEY:'test-only',ORDER_RATE_LIMIT_SALT:'test-only-salt-with-more-than-32-characters',TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:scenario.key,
    },'test-only',{
      transport,
      rpc:async(name)=>{if(name==='forno_rate_limit')return true;creations++;throw Error('No database writes allowed');},
    });
    assert.equal(calls,1);assert.equal(result.success,scenario.success);
    if(scenario.error)assert.ok(result['error-codes'].includes(scenario.error));
    // The dummy passing response uses example.com and lacks action=order.
    // Keep real hostname/action checks intact; dummy success cannot prove an order flow.
    assert.equal(response.status,400);assert.equal((await response.json()).error,'BOT_VERIFICATION_FAILED');
    assert.equal(creations,0);
    console.log(`${scenario.name}: Cloudflare reached; response verified; application refused; zero order RPCs.`);
  }
} finally {await rm(directory,{recursive:true,force:true});}
