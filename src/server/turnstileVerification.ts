import type {OrderEnvironment} from './supabase';
import {validTurnstileResponse} from './orderEnvironmentGuard';
export async function verifyTurnstile(token:string,attemptKey:string,hostname:string,env:OrderEnvironment,transport:typeof fetch=fetch):Promise<'valid'|'invalid'|'unavailable'>{
 try{
  const response=await transport('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
   method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(10000),
   body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:token,idempotency_key:attemptKey}),
  });
  if(!response.ok)return 'unavailable';return validTurnstileResponse(await response.json(),hostname,env)?'valid':'invalid';
 }catch{return 'unavailable';}
}
