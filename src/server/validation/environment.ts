import {adminConfigured,type AdminEnvironment} from '../admin/environment';
import {configured} from '../supabase';
import {safeOrderEnvironment} from '../orderEnvironmentGuard';
export function privateValidationEnabled(env:AdminEnvironment,url:URL):boolean{
 return env.FORNO_VALIDATION_ENABLED==='true'&&env.FORNO_ORDERS_ENABLED!=='true'&&adminConfigured(env)&&configured(env)&&safeOrderEnvironment(env)&&env.FORNO_TURNSTILE_MODE!=='official-test'&&url.origin===env.FORNO_APP_ORIGIN;
}
