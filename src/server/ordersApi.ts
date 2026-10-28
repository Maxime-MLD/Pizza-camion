import { orderRequestSchema } from './orderSchema';
import { configured, createRpc, DatabaseError, type OrderEnvironment, type Rpc } from './supabase';
import type { LivePickupAvailability, OrderReceipt } from '../types/checkoutApi';
import { safeOrderEnvironment, validTurnstileResponse } from './orderEnvironmentGuard';
export const json = (body: unknown, status=200): Response => Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'}});
export const failure = (error: string,status: number): Response => json({error},status);
const hex = (bytes: ArrayBuffer): string => Array.from(new Uint8Array(bytes),(v)=>v.toString(16).padStart(2,'0')).join('');
export async function requestDigest(value: unknown): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))));
}
async function abuseKey(salt: string, ip: string, purpose: string): Promise<string> {
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(salt),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${purpose}:${ip}`)));
}
async function verificationKey(orderKey: string, token: string): Promise<string> {
  // A Siteverify retry identifies the same token, not every token of the order.
  // Renewing an expired challenge must not reuse its previous validation key.
  const digest=await requestDigest([orderKey,token]);
  return `${digest.slice(0,8)}-${digest.slice(8,12)}-4${digest.slice(13,16)}-${((parseInt(digest[16]!,16)&3)|8).toString(16)}${digest.slice(17,20)}-${digest.slice(20,32)}`;
}
interface ApiDependencies { rpc?: Rpc; transport?: typeof fetch; }
/** Dependency injection is for tests only. Production receives runtime bindings and trusted edge IP. */
export async function handleOrdersApi(request: Request, env: OrderEnvironment, ip: string, dependencies: ApiDependencies={}): Promise<Response> {
  const url=new URL(request.url);
  const isOrders=url.pathname.replace(/\/$/,'')==='/api/orders';
  const expectedMethod=isOrders?'GET, POST':'GET';
  if(!(isOrders ? ['POST','GET'].includes(request.method) : request.method==='GET')) return new Response(null,{status:405,headers:{Allow:expectedMethod,'Cache-Control':'no-store'}});
  if(request.headers.get('Sec-Fetch-Site')==='cross-site' || (request.method==='POST' && request.headers.get('Origin')!==url.origin)) return failure('FORBIDDEN',403);
  // Deployment must never open ordering merely because credentials are configured.
  if(env.FORNO_ORDERS_ENABLED !== 'true') return failure('ORDERS_DISABLED',503);
  if(!safeOrderEnvironment(env))return failure('NOT_CONFIGURED',503);
  if(!configured(env)) return failure('NOT_CONFIGURED',503);
  const rpc=dependencies.rpc??createRpc(env,dependencies.transport);
  try {
    // Distributed durable throttling, no in-memory per-Worker counter. Raw IP is never stored.
    const allowed=await rpc<boolean>('forno_rate_limit',{p_key:await abuseKey(env.ORDER_RATE_LIMIT_SALT!,ip,isOrders?'attempt':'availability'),p_limit:isOrders?15:60});
    if(!allowed) return new Response(JSON.stringify({error:'RATE_LIMITED'}),{status:429,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Retry-After':'60'}});
    if(isOrders && request.method==='GET') {
      const key=request.headers.get('X-Order-Request-Key')??'';
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))return failure('INVALID_REQUEST',400);
      return json({receipt:await rpc<OrderReceipt|null>('forno_recover_order',{p_key:key})});
    }
    if(!isOrders) {
      const quantity=Number(url.searchParams.get('quantity')??1);
      if(!Number.isInteger(quantity)||quantity<1||quantity>20) return failure('INVALID_QUANTITY',400);
      const data=await rpc<Omit<LivePickupAvailability,'turnstileSiteKey'>>('forno_pickup_slots',{p_quantity:quantity});
      return json({...data,turnstileSiteKey:env.TURNSTILE_SITE_KEY});
    }
    if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return failure('INVALID_REQUEST',415);
    if(Number(request.headers.get('Content-Length'))>16384) return failure('INVALID_REQUEST',413);
    // Bound streaming reads too; Content-Length alone is not authoritative.
    const reader=request.body?.getReader(); if(!reader) return failure('INVALID_REQUEST',400);
    const chunks:Uint8Array[]=[]; let size=0;
    for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>16384){await reader.cancel();return failure('INVALID_REQUEST',413);}chunks.push(chunk.value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    let raw:unknown;try{raw=JSON.parse(new TextDecoder().decode(bytes));}catch{return failure('INVALID_REQUEST',400);}
    const result=orderRequestSchema.safeParse(raw);if(!result.success)return failure('INVALID_REQUEST',400);
    const {turnstileToken,...order}=result.data;
    // Normalize array ordering so retries of the same business request share a fingerprint.
    order.lines.sort((a,b)=>a.pizzaId.localeCompare(b.pizzaId));
    const transport=dependencies.transport??fetch;
    const verification=await transport('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
      method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(10000),
      body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:turnstileToken,idempotency_key:await verificationKey(order.idempotencyKey,turnstileToken)}),
    });
    if(!verification.ok) return failure('VERIFICATION_UNAVAILABLE',503);
    const check:unknown=await verification.json();
    if(!validTurnstileResponse(check,url.hostname,env))return failure('BOT_VERIFICATION_FAILED',400);
    const receipt=await rpc<OrderReceipt|{error:string}>('forno_create_order',{
      p_request:order,p_request_hash:await requestDigest(order),p_abuse_key:await abuseKey(env.ORDER_RATE_LIMIT_SALT!,ip,'order'),
    });
    if('error' in receipt)return failure(receipt.error,429);
    return json({receipt},201);
  } catch(error) {
    if(error instanceof DatabaseError){
      const code=error.code;
      const status=code==='DATABASE_UNAVAILABLE'?503:code.startsWith('INVALID')?400:409;
      return failure(code,status);
    }
    return failure('TEMPORARILY_UNAVAILABLE',503);
  }
}
