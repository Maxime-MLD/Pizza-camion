import {getSecret} from 'astro:env/server';
import {getAdminEnvironment,mayOpenTest,type AdminEnvironment} from '../admin/environment';
import {pushConfig} from '../../config/push.config';
export interface PushEnvironment extends AdminEnvironment {FORNO_PUSH_ENABLED?:string;}
export const getPushEnvironment=():PushEnvironment=>({...getAdminEnvironment(),FORNO_PUSH_ENABLED:getSecret('FORNO_PUSH_ENABLED')});
export const pushEnabled=(env:PushEnvironment)=>env.FORNO_PUSH_ENABLED==='true'&&mayOpenTest(env);
export const pushOriginAllowed=(env:PushEnvironment,url:URL)=>pushEnabled(env)&&url.origin===pushConfig.testOrigin;
