import type {AstroCookies} from 'astro';
import type {AdminEnvironment} from './environment';
import type {AdminIdentity} from '../../types/admin';
import {adminRpc,authFetch,AdminError} from './client';
export const cookieNames={access:'__Host-forno-admin-access',refresh:'__Host-forno-admin-refresh',csrf:'__Host-forno-admin-csrf'} as const;
const cookieOptions={path:'/',httpOnly:true,secure:true,sameSite:'lax' as const,maxAge:60*60*24*7};
export function clearSession(cookies:AstroCookies):void{for(const key of Object.values(cookieNames))cookies.delete(key,{path:'/',secure:true,httpOnly:true,sameSite:'lax'});}
export function csrfToken(cookies:AstroCookies):string{let token=cookies.get(cookieNames.csrf)?.value;if(!token||!/^[-a-z0-9]{36}$/.test(token)){token=crypto.randomUUID();cookies.set(cookieNames.csrf,token,cookieOptions);}return token;}
export function validCsrf(request:Request,cookies:AstroCookies,token:string|null):boolean{
 const expected=cookies.get(cookieNames.csrf)?.value;
 return request.headers.get('Origin')===new URL(request.url).origin&&request.headers.get('Sec-Fetch-Site')!=='cross-site'&&!!expected&&token===expected;
}
interface Tokens {access_token:string;refresh_token:string;}
export function writeTokens(cookies:AstroCookies,data:Tokens):void{
 if(typeof data.access_token!=='string'||typeof data.refresh_token!=='string'||data.access_token.length>3800||data.refresh_token.length>3800)throw new AdminError('UNAVAILABLE');
 cookies.set(cookieNames.access,data.access_token,cookieOptions);cookies.set(cookieNames.refresh,data.refresh_token,cookieOptions);
}
/** Decode only after the Auth server has verified this exact access token. Never authorizes by metadata. */
export function verifiedSessionId(token:string,userId:string):string{
 try{const c=JSON.parse(atob(token.split('.')[1]!.replace(/-/g,'+').replace(/_/g,'/'))) as {sub?:string;session_id?:string};
  if(c.sub===userId&&c.session_id&&/^[a-f0-9-]{36}$/i.test(c.session_id))return c.session_id;
 }catch{/* Invalid verified-token shape fails closed. */}throw new AdminError('UNAUTHORIZED',401);
}
export async function validateAccess(env:AdminEnvironment,token:string,transport:typeof fetch=fetch):Promise<AdminIdentity>{
 const response=await authFetch(env,'user','GET',undefined,token,transport);
 if(!response.ok)throw new AdminError(response.status>=500?'UNAVAILABLE':'UNAUTHORIZED',response.status>=500?503:401);
 const user=await response.json() as {id:string;email?:string};
 const identity={userId:user.id,email:user.email??'',sessionId:verifiedSessionId(token,user.id)};
 await adminRpc(env,'forno_admin_session',{p_actor:identity.userId,p_session:identity.sessionId},transport);
 return identity;
}
export async function getIdentity(env:AdminEnvironment,cookies:AstroCookies,transport:typeof fetch=fetch):Promise<AdminIdentity>{
 let access=cookies.get(cookieNames.access)?.value;
 if(access){try{return await validateAccess(env,access,transport);}catch(error){if(!(error instanceof AdminError)||error.status!==401)throw error;}}
 const refresh=cookies.get(cookieNames.refresh)?.value;if(!refresh)throw new AdminError('UNAUTHORIZED',401);
 const response=await authFetch(env,'token?grant_type=refresh_token','POST',{refresh_token:refresh},undefined,transport);
 if(!response.ok)throw new AdminError(response.status>=500?'UNAVAILABLE':'UNAUTHORIZED',response.status>=500?503:401);
 const data=await response.json() as Tokens;access=data.access_token;
 const identity=await validateAccess(env,access,transport);writeTokens(cookies,data);return identity;
}
