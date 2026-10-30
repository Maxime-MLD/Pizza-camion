import {matchesDeployment,isolatedPreview} from './deploymentGuard';
import type { OrderEnvironment } from './supabase';

// Public dummy credentials documented by Cloudflare, never a customer's secret.
const testSiteKey='1x00000000000000000000AA';
const testSecrets=[
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
];

export const isIsolatedPreview=isolatedPreview;

export function safeOrderEnvironment(env: OrderEnvironment): boolean {
  // Vercel supplies these server-only identities. No request header can select test mode.
  if(env.VERCEL_ENV&&!matchesDeployment(env))return false;
  if(env.FORNO_TURNSTILE_MODE==='official-test'){
    return isIsolatedPreview(env)&&env.TURNSTILE_SITE_KEY===testSiteKey&&testSecrets.includes(env.TURNSTILE_SECRET_KEY??'');
  }
  if(env.FORNO_TURNSTILE_MODE&&env.FORNO_TURNSTILE_MODE!=='real')return false;
  // Fail closed if official dummy keys are accidentally installed in Production.
  return !testSecrets.includes(env.TURNSTILE_SECRET_KEY??'')&&!/^[123]x0+(?:AA|AB|BB|FF)$/.test(env.TURNSTILE_SITE_KEY??'');
}

export function validTurnstileResponse(value: unknown,hostname: string,env: OrderEnvironment): boolean {
  if(!value||typeof value!=='object')return false;
  const check=value as {success?:unknown;hostname?:unknown;action?:unknown;metadata?:{result_with_testing_key?:unknown}};
  if(check.success!==true)return false;
  if(env.FORNO_TURNSTILE_MODE==='official-test'){
    // Still call Siteverify. Accept only its documented dummy response on the isolated Preview.
    // This cannot establish real anti-bot, hostname or token-lifetime guarantees.
    return safeOrderEnvironment(env)&&check.metadata?.result_with_testing_key===true
      &&check.hostname==='example.com'&&(check.action===undefined||check.action==='order');
  }
  return check.metadata?.result_with_testing_key!==true&&check.hostname===hostname&&check.action==='order';
}
