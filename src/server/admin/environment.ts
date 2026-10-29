import {getSecret} from 'astro:env/server';
import {getOrderEnvironment} from '../environment';
import {orderEnvironments} from '../../config/order-environments.config';
import type {OrderEnvironment} from '../supabase';
export interface AdminEnvironment extends OrderEnvironment {FORNO_ADMIN_ENABLED?:string;}
export const getAdminEnvironment=():AdminEnvironment=>({...getOrderEnvironment(),FORNO_ADMIN_ENABLED:getSecret('FORNO_ADMIN_ENABLED')});
export function adminConfigured(env:AdminEnvironment):boolean {
 const ref=env.VERCEL_ENV==='preview'?orderEnvironments.testSupabaseRef:orderEnvironments.productionSupabaseRef;
 return env.FORNO_ADMIN_ENABLED==='true' && !!env.SUPABASE_SECRET_KEY && (env.ORDER_RATE_LIMIT_SALT?.length??0)>=32
  && env.SUPABASE_URL===`https://${ref}.supabase.co`
  && (env.VERCEL_ENV==='production'||(env.VERCEL_ENV==='preview'&&env.VERCEL_GIT_COMMIT_REF===orderEnvironments.testBranch));
}
export const mayOpenTest=(env:AdminEnvironment)=>env.VERCEL_ENV==='preview'&&env.SUPABASE_URL===`https://${orderEnvironments.testSupabaseRef}.supabase.co`&&env.VERCEL_GIT_COMMIT_REF===orderEnvironments.testBranch;
