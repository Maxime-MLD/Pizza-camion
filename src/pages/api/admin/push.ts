import type {APIRoute} from 'astro';
import {getPushEnvironment,pushOriginAllowed} from '../../../server/push/environment';
import {adminRpc,AdminError} from '../../../server/admin/client';
import {validCsrf} from '../../../server/admin/session';
import {boundedBody} from '../../../server/admin/requestBody';
import {pushCookie,pushRequestSchema} from '../../../server/push/schema';
export const prerender=false;
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export const ALL:APIRoute=async context=>{
 const {request,cookies,locals}=context;const env=getPushEnvironment();
 try{
  if(!locals.admin)throw new AdminError('UNAUTHORIZED',401);
  if(!pushOriginAllowed(env,new URL(request.url)))return json({enabled:false,ready:false,devices:[],error:'PUSH_DISABLED'},503);
  const actor={p_actor:locals.admin.userId,p_session:locals.admin.sessionId};
  if(request.method==='GET'){
   const result=await adminRpc<{devices:{id:string}[];enabled:boolean;ready:boolean}>(env,'forno_push_admin',{...actor,p_action:'status',p_data:{}});
   const id=cookies.get(pushCookie)?.value;return json({...result,currentDeviceId:result.devices.some(d=>d.id===id)?id:null});
  }
  if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'GET, POST'}});
  if(!validCsrf(request,cookies,request.headers.get('X-CSRF-Token')))throw new AdminError('CSRF',403);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw new AdminError('PUSH_INVALID',415);
  let data:unknown;try{data=JSON.parse(await boundedBody(request));}catch(error){if(error instanceof AdminError)throw error;throw new AdminError('PUSH_INVALID',400);}
  const parsed=pushRequestSchema.safeParse(data);if(!parsed.success)throw new AdminError('PUSH_INVALID',400);
  const {action,...payload}=parsed.data;
  const result=await adminRpc<{deviceId?:string}>(env,'forno_push_admin',{...actor,p_action:action,p_data:payload});
  if(action==='subscribe'&&result.deviceId)cookies.set(pushCookie,result.deviceId,{path:'/',secure:true,httpOnly:true,sameSite:'lax',maxAge:365*24*60*60});
  if(action==='revoke'&&'deviceId'in payload&&cookies.get(pushCookie)?.value===payload.deviceId)cookies.delete(pushCookie,{path:'/',secure:true});
  return json(result,action==='test'?202:200);
 }catch(error){const e=error instanceof AdminError?error:new AdminError('UNAVAILABLE');return json({error:e.code},e.status);}
};
