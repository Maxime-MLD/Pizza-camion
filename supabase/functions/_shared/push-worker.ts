export interface PushEvent {id:string;eventId:string;kind:'orders'|'test';reference:string|null;pizzas:number|null;pickupTime:string|null;}
export interface PushBatch {device:{id:string;endpoint:string;keys:{p256dh:string;auth:string}};lease:string;ids:string[];events:PushEvent[];}
export interface VapidConfig {publicKey:string|null;privateKey:string|null;subject:string;}
export interface PushPayload {version:1;kind:'orders'|'test';count:number;reference?:string;pizzas?:number;pickupTime?:string;}
export type WorkerRpc=<T>(name:string,args:Record<string,unknown>)=>Promise<T>;
export type Sender=(batch:PushBatch,payload:PushPayload,config:VapidConfig)=>Promise<number>;
export function notificationPayload(events:PushEvent[]):PushPayload{
 if(!events.length)throw Error('EMPTY_BATCH');
 const first=events[0]!;if(first.kind==='test')return {version:1,kind:'test',count:1};
 const result:PushPayload={version:1,kind:'orders',count:events.length};
 if(events.length===1&&first.reference&&/^F-[0-9]{8,12}$/.test(first.reference)&&Number.isInteger(first.pizzas)&&first.pizzas!>0&&first.pickupTime&&/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(first.pickupTime)){
  result.reference=first.reference;result.pizzas=first.pizzas!;result.pickupTime=first.pickupTime;
 }
 return result;
}
export function allowedPushEndpoint(endpoint:string):boolean{
 try{const u=new URL(endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&u.href.length<=2048&&
  (u.hostname==='fcm.googleapis.com'||/^(?:[a-z0-9-]+\.)*push\.services\.mozilla\.com$/.test(u.hostname)||/^(?:[a-z0-9-]+\.)*push\.apple\.com$/.test(u.hostname)||/^(?:[a-z0-9-]+\.)+notify\.windows\.com$/.test(u.hostname));
 }catch{return false;}
}
/** Provider failures are acknowledged as codes only. Never serialize endpoints or Error objects. */
export async function dispatchPush(rpc:WorkerRpc,token:string,config:VapidConfig,send:Sender,now:()=>number=Date.now):Promise<{sent:number;failed:number;skipped:number}>{
 const stats={sent:0,failed:0,skipped:0};const start=now();
 for(let i=0;i<5&&now()-start<20000;i++){
  const batch=await rpc<PushBatch|null>('forno_push_worker',{p_token:token,p_action:'claim',p_data:{}});if(!batch)break;
  const allowed=await rpc<boolean>('forno_push_worker',{p_token:token,p_action:'authorize',p_data:{deviceId:batch.device.id,lease:batch.lease}});
  if(!allowed){stats.skipped++;continue;}
  let status=0;
  if(!allowedPushEndpoint(batch.device.endpoint))status=410;
  else try{status=await send(batch,notificationPayload(batch.events),config);}catch{/* Network/timeout: retry through outbox, not an in-memory loop. */}
  await rpc('forno_push_worker',{p_token:token,p_action:'finish',p_data:{deviceId:batch.device.id,lease:batch.lease,status}});
  if(status>=200&&status<300)stats.sent++;else stats.failed++;
 }
 return stats;
}
