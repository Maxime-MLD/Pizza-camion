import {deploymentConfig} from '@forno/deployment';
import { getSecret } from 'astro:env/server';
import type { OrderEnvironment } from './supabase';

/** Runtime-only secrets supplied by the selected adapter (Vercel or Cloudflare). */
export function getOrderEnvironment(): OrderEnvironment {
  return {
    FORNO_DEPLOYMENT_PROFILE:deploymentConfig.profile,
    FORNO_EXPECTED_SUPABASE_REF:deploymentConfig.supabaseRef,
    FORNO_APP_ORIGIN:deploymentConfig.origin,
    FORNO_PREVIEW_BRANCH:deploymentConfig.previewBranch,
    FORNO_VALIDATION_ENABLED:getSecret('FORNO_VALIDATION_ENABLED'),
    FORNO_ORDERS_ENABLED: getSecret('FORNO_ORDERS_ENABLED'),
    FORNO_TURNSTILE_MODE: getSecret('FORNO_TURNSTILE_MODE'),
    VERCEL_ENV: getSecret('VERCEL_ENV'),
    VERCEL_GIT_COMMIT_REF: getSecret('VERCEL_GIT_COMMIT_REF'),
    SUPABASE_URL: getSecret('SUPABASE_URL'),
    SUPABASE_SECRET_KEY: getSecret('SUPABASE_SECRET_KEY'),
    ORDER_RATE_LIMIT_SALT: getSecret('ORDER_RATE_LIMIT_SALT'),
    TURNSTILE_SECRET_KEY: getSecret('TURNSTILE_SECRET_KEY'),
    TURNSTILE_SITE_KEY: getSecret('TURNSTILE_SITE_KEY'),
  };
}
