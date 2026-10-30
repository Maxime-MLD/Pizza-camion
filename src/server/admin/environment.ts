import {getSecret} from 'astro:env/server';
import {getOrderEnvironment} from '../environment';
import {matchesDeployment,isolatedPreview} from '../deploymentGuard';
import type {OrderEnvironment} from '../supabase';
export interface AdminEnvironment extends OrderEnvironment {FORNO_ADMIN_ENABLED?:string;}
export const getAdminEnvironment=():AdminEnvironment=>({...getOrderEnvironment(),FORNO_ADMIN_ENABLED:getSecret('FORNO_ADMIN_ENABLED')});
export function adminConfigured(env:AdminEnvironment):boolean {
 return env.FORNO_ADMIN_ENABLED==='true'&&!!env.SUPABASE_SECRET_KEY&&(env.ORDER_RATE_LIMIT_SALT?.length??0)>=32&&matchesDeployment(env);
}
export const mayOpenTest=isolatedPreview;
export const mayOpenService=(env:AdminEnvironment)=>isolatedPreview(env)||(env.VERCEL_ENV==='production'&&adminConfigured(env)&&(env.FORNO_ORDERS_ENABLED==='true'||env.FORNO_VALIDATION_ENABLED==='true'));
