import type {AstroCookies} from 'astro';
import type {AdminIdentity} from '../../types/admin';
import type {AdminEnvironment} from '../admin/environment';
import {validCsrf} from '../admin/session';
import {boundedBody} from '../admin/requestBody';
import {handleOrdersApi,failure,json,requestDigest} from '../ordersApi';
import type {Rpc} from '../supabase';
import {verifyTurnstile} from '../turnstileVerification';
import {privateValidationEnabled} from './environment';
import {z} from 'astro/zod';
const verificationSchema=z.object({token:z.string().min(1).max(2048),attemptId:z.uuid({version:'v4'})}).strict();
/** Middleware verifies Auth + live DB admin/session. This route never opens the public API. */
export async function handlePrivateValidation(request:Request,env:AdminEnvironment,action:string|undefined,identity:AdminIdentity|undefined,cookies:AstroCookies,ip:string,dependencies:{rpc?:Rpc;transport?:typeof fetch}={}):Promise<Response>{
 if(!identity)return failure('UNAUTHORIZED',401);
 const url=new URL(request.url);
 if(!privateValidationEnabled(env,url))return failure('VALIDATION_DISABLED',503);
 if(!['orders','slots','turnstile'].includes(action??''))return failure('NOT_FOUND',404);
 if(request.headers.get('Sec-Fetch-Site')==='cross-site')return failure('FORBIDDEN',403);
 if(request.method==='POST'&&!validCsrf(request,cookies,request.headers.get('X-CSRF-Token')))return failure('CSRF',403);
 if(action==='turnstile'){
  if(request.method==='GET')return json({siteKey:env.TURNSTILE_SITE_KEY,hostname:url.hostname,action:'order'});
  if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'GET, POST'}});
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return failure('INVALID_REQUEST',415);
  let input:unknown;try{input=JSON.parse(await boundedBody(request));}catch{return failure('INVALID_REQUEST',400);}
  const parsed=verificationSchema.safeParse(input);if(!parsed.success)return failure('INVALID_REQUEST',400);
  // Authorized admin requests still use distributed throttling, without storing raw IP or tokens.
  const {createRpc}=await import('../supabase');
  const rpc=dependencies.rpc??createRpc(env,dependencies.transport);
  try{if(!await rpc<boolean>('forno_rate_limit',{p_key:await requestDigest(['forno-private-turnstile',identity.userId]),p_limit:10}))return failure('RATE_LIMITED',429);}catch{return failure('TEMPORARILY_UNAVAILABLE',503);}
  const result=await verifyTurnstile(parsed.data.token,parsed.data.attemptId,url.hostname,env,dependencies.transport);
  return result==='valid'?json({valid:true}):failure(result==='invalid'?'BOT_VERIFICATION_FAILED':'VERIFICATION_UNAVAILABLE',result==='invalid'?400:503);
 }
 const target=new URL(action==='orders'?'/api/orders':'/api/pickup-slots',url);target.search=url.search;
 // Explicitly scoped to this already-authorized route; public handlers retain the false gate.
 return handleOrdersApi(new Request(target,request),{...env,FORNO_ORDERS_ENABLED:'true'},ip,dependencies);
}
