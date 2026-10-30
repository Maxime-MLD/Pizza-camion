import {getSecret} from 'astro:env/server';
import {getAdminEnvironment,type AdminEnvironment} from '../admin/environment';
import {matchesDeployment} from '../deploymentGuard';
export interface PushEnvironment extends AdminEnvironment {FORNO_PUSH_ENABLED?:string;}
export const getPushEnvironment=():PushEnvironment=>({...getAdminEnvironment(),FORNO_PUSH_ENABLED:getSecret('FORNO_PUSH_ENABLED')});
export const pushEnabled=(env:PushEnvironment)=>env.FORNO_PUSH_ENABLED==='true'&&matchesDeployment(env);
export const pushOriginAllowed=(env:PushEnvironment,url:URL)=>pushEnabled(env)&&url.origin===env.FORNO_APP_ORIGIN;
