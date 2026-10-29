import type {APIRoute} from 'astro';
import {getAdminEnvironment,mayOpenTest} from '../../../server/admin/environment';
import {adminRpc,authFetch,AdminError} from '../../../server/admin/client';
import {adminChangeSchema,loginSchema} from '../../../server/admin/schema';
import {clearSession,cookieNames,validCsrf,validateAccess,writeTokens} from '../../../server/admin/session';
export const prerender=false;
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
async function boundedBody(request:Request):Promise<string>{
 const reader=request.body?.getReader();if(!reader)throw new AdminError('ADMIN_INVALID',400);
 const decoder=new TextDecoder();let text='';let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();throw new AdminError('ADMIN_INVALID',413);}text+=decoder.decode(value,{stream:true});}return text+decoder.decode();
}
export const ALL:APIRoute=async(context)=>{
 const {request,cookies,locals,params}=context;const action=params.action;const env=getAdminEnvironment();let stage='request';
 try{
  if(request.method==='GET'&&['orders','planning','settings'].includes(action??'')){
   if(!locals.admin)throw new AdminError('UNAUTHORIZED',401);
   const data=await adminRpc<Record<string,unknown>>(env,'forno_admin_read',{p_actor:locals.admin.userId,p_session:locals.admin.sessionId,p_view:action});
   return json({...data,account:locals.admin.email,canOpen:mayOpenTest(env),publicOrdersEnabled:env.FORNO_ORDERS_ENABLED==='true'});
  }
  if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST'}});
  const contentType=request.headers.get('Content-Type')??'';const body=await boundedBody(request);
  const form=contentType.startsWith('application/x-www-form-urlencoded')?new URLSearchParams(body):null;
  if(!validCsrf(request,cookies,form?.get('csrf')??request.headers.get('X-CSRF-Token')))throw new AdminError('CSRF',403);
  if(action==='login'){
   stage='schema';
   if(!form)throw new AdminError('ADMIN_INVALID',400);
   const input=loginSchema.safeParse({email:form.get('email')?.trim().toLowerCase(),password:form.get('password')});if(!input.success)throw new AdminError('LOGIN_FAILED',400);
   stage='rate-limit';
   const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.ORDER_RATE_LIMIT_SALT!),{name:'HMAC',hash:'SHA-256'},false,['sign']);
   for(const subject of [context.clientAddress,input.data.email]){
    const digest=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`admin-login:${subject}`));
    const hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
    if(!await adminRpc<boolean>(env,'forno_rate_limit',{p_key:hash,p_limit:10}))throw new AdminError('RATE_LIMITED',429);
   }
   stage='auth';
   const response=await authFetch(env,'token?grant_type=password','POST',input.data);
   if(!response.ok)throw new AdminError(response.status===429?'RATE_LIMITED':'LOGIN_FAILED',response.status===429?429:401);
   const tokens=await response.json() as {access_token:string;refresh_token:string};
   stage='authorization';
   try{await validateAccess(env,tokens.access_token);}catch(error){await authFetch(env,'logout?scope=local','POST',undefined,tokens.access_token).catch(()=>undefined);throw error;}
   writeTokens(cookies,tokens);cookies.delete(cookieNames.csrf,{path:'/',secure:true});return context.redirect('/admin/',303);
  }
  if(action==='logout'){
   let token=cookies.get(cookieNames.access)?.value;
   const refresh=cookies.get(cookieNames.refresh)?.value;
   if(refresh){
    const renewed=await authFetch(env,'token?grant_type=refresh_token','POST',{refresh_token:refresh});
    if(renewed.ok)token=((await renewed.json()) as {access_token:string}).access_token;
    else if(renewed.status>=500)throw new AdminError('UNAVAILABLE');
   }
   if(token){const response=await authFetch(env,'logout?scope=local','POST',undefined,token);if(!response.ok&&response.status!==401)throw new AdminError('UNAVAILABLE');}
   clearSession(cookies);return context.redirect('/admin/login/',303);
  }
  if(action!=='change')throw new AdminError('ADMIN_NOT_FOUND',404);
  if(!locals.admin)throw new AdminError('UNAUTHORIZED',401);
  if(!contentType.startsWith('application/json'))throw new AdminError('ADMIN_INVALID',415);
  let raw:unknown;try{raw=JSON.parse(body);}catch{throw new AdminError('ADMIN_INVALID',400);}
  const parsed=adminChangeSchema.safeParse(raw);if(!parsed.success)throw new AdminError('ADMIN_INVALID',400);
  const {action:change,...data}=parsed.data;
  if(change==='open'&&!mayOpenTest(env))throw new AdminError('ADMIN_OPEN_LOCKED',403);
  return json(await adminRpc(env,'forno_admin_change',{p_actor:locals.admin.userId,p_session:locals.admin.sessionId,p_action:change,p_data:data}));
 }catch(error){
  const e=error instanceof AdminError?error:new AdminError('UNAVAILABLE');
  if(action==='login'){
   // Enumerated code/stage only: never log body, credentials, tokens, email or transport errors.
   console.warn('FORNO_ADMIN_LOGIN_FAILURE',stage,e.code);
   clearSession(cookies);return context.redirect(`/admin/login/?error=${e.code==='RATE_LIMITED'?'RATE_LIMITED':'LOGIN_FAILED'}`,303);}
  return json({error:e.code},e.status);
 }
};
