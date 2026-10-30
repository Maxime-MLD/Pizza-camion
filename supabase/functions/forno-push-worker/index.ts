import webpush from 'npm:web-push@3.6.7';
import {dispatchPush,type VapidConfig,type WorkerRpc} from '../_shared/push-worker.ts';
import {pushConfig} from '../../../src/config/push.config.ts';
// Gateway JWT checks are replaced by a dedicated 256-bit worker token plus a service-role-only RPC.
// There is no CORS and no caller-supplied notification content, endpoint, URL or VAPID key.
Deno.serve(async request=>{
 if(request.method!=='POST')return new Response(null,{status:405});
 const token=request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
 if(!token)return new Response(null,{status:401});
 const url=Deno.env.get('SUPABASE_URL');
 if(url!==`https://${pushConfig.testProjectRef}.supabase.co`)return new Response(null,{status:503});
 let key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 try{const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')??'{}') as Record<string,string>;key=Object.values(keys).find(k=>k.startsWith('sb_secret_'))??key;}catch{/* Legacy server key remains a supported fallback. */}
 if(!key)return new Response(null,{status:503});
 const rpc:WorkerRpc=async<T>(name:string,args:Record<string,unknown>):Promise<T>=>{
  const response=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key!,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('WORKER_RPC_REJECTED');return await response.json() as T;
 };
 try{
  let config=await rpc<VapidConfig>('forno_push_worker_config',{p_token:token,p_data:{}});
  if(!config.publicKey||!config.privateKey){
   const suppliedPublic=Deno.env.get('VAPID_PUBLIC_KEY'),suppliedPrivate=Deno.env.get('VAPID_PRIVATE_KEY');
   const pair=suppliedPublic&&suppliedPrivate?{publicKey:suppliedPublic,privateKey:suppliedPrivate}:webpush.generateVAPIDKeys();
   config=await rpc<VapidConfig>('forno_push_worker_config',{p_token:token,p_data:pair});
  }
  if(!config.publicKey||!config.privateKey||!/^https:\/\//.test(config.subject))throw Error('VAPID_NOT_READY');
  const stats=await dispatchPush(rpc,token,config,async(batch,payload,vapid)=>{
   try{
    const response=await webpush.sendNotification({endpoint:batch.device.endpoint,keys:batch.device.keys},JSON.stringify(payload),{vapidDetails:{subject:vapid.subject,publicKey:vapid.publicKey!,privateKey:vapid.privateKey!},TTL:300,urgency:'high',topic:payload.kind==='test'?'forno-test':'forno-orders',timeout:8000});
    return response.statusCode;
   }catch(error){const code=error&&typeof error==='object'&&'statusCode'in error?Number(error.statusCode):0;return Number.isInteger(code)?code:0;}
  });
  return Response.json(stats,{headers:{'Cache-Control':'no-store'}});
 }catch{return new Response(null,{status:403,headers:{'Cache-Control':'no-store'}});}
});
