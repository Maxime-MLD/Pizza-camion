import { getSecret } from 'astro:env/server';
import type { OrderEnvironment } from './supabase';

/** Runtime-only secrets supplied by the selected adapter (Vercel or Cloudflare). */
export function getOrderEnvironment(): OrderEnvironment {
  return {
    FORNO_ORDERS_ENABLED: getSecret('FORNO_ORDERS_ENABLED'),
    SUPABASE_URL: getSecret('SUPABASE_URL'),
    SUPABASE_SECRET_KEY: getSecret('SUPABASE_SECRET_KEY'),
    ORDER_RATE_LIMIT_SALT: getSecret('ORDER_RATE_LIMIT_SALT'),
    TURNSTILE_SECRET_KEY: getSecret('TURNSTILE_SECRET_KEY'),
    TURNSTILE_SITE_KEY: getSecret('TURNSTILE_SITE_KEY'),
  };
}
