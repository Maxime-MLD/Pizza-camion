import type {AdminEnvironment} from './environment';
export class AdminError extends Error {constructor(readonly code:string,readonly status=503){super(code);}}
const codes=['ADMIN_FORBIDDEN','ADMIN_CONFLICT','ADMIN_EXPIRED','ADMIN_TRANSITION','ADMIN_CAPACITY','ADMIN_ACTIVE_ORDERS','ADMIN_HAS_ORDERS','ADMIN_PAST','ADMIN_OPEN_LOCKED','ADMIN_INVALID','ADMIN_NOT_FOUND'];
export async function adminRpc<T>(env:AdminEnvironment,name:string,args:Record<string,unknown>,transport:typeof fetch=fetch):Promise<T>{
 if(!['forno_admin_session','forno_admin_read','forno_admin_change','forno_rate_limit'].includes(name))throw new AdminError('ADMIN_INVALID',400);
 const response=await transport(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:env.SUPABASE_SECRET_KEY!,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(10000)});
 const data:unknown=await response.json();
 if(!response.ok){const message=data&&typeof data==='object'&&'message'in data?String(data.message):'';throw new AdminError(codes.includes(message)?message:'UNAVAILABLE',message==='ADMIN_FORBIDDEN'?403:codes.includes(message)?409:503);}
 return data as T;
}
export async function authFetch(env:AdminEnvironment,path:string,method='GET',body?:unknown,token?:string,transport:typeof fetch=fetch):Promise<Response>{
 return transport(`${env.SUPABASE_URL}/auth/v1/${path}`,{method,headers:{apikey:env.SUPABASE_SECRET_KEY!,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
}
