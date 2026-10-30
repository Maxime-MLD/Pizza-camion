/** Server-only native PostgREST client: no browser SDK, cookies or user session. */
export interface OrderEnvironment {
  FORNO_ORDERS_ENABLED?: string;
  FORNO_DEPLOYMENT_PROFILE?: string;
  FORNO_EXPECTED_SUPABASE_REF?: string;
  FORNO_APP_ORIGIN?: string;
  FORNO_PREVIEW_BRANCH?: string;
  FORNO_VALIDATION_ENABLED?: string;
  FORNO_TURNSTILE_MODE?: string;
  VERCEL_ENV?: string;
  VERCEL_GIT_COMMIT_REF?: string;
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  ORDER_RATE_LIMIT_SALT?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
}
export type Rpc = <T>(name: string, args: Record<string, unknown>) => Promise<T>;
export class DatabaseError extends Error {
  constructor(readonly code: string) { super(code); }
}
export function configured(env: OrderEnvironment): boolean {
  const values = [env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, env.ORDER_RATE_LIMIT_SALT, env.TURNSTILE_SECRET_KEY, env.TURNSTILE_SITE_KEY];
  return values.every(value => !!value && !value.startsWith('TODO_'))
    && !!env.SUPABASE_URL?.startsWith('https://') && (env.ORDER_RATE_LIMIT_SALT?.length ?? 0) >= 32;
}
export function createRpc(env: OrderEnvironment, transport: typeof fetch = fetch): Rpc {
  return async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
    const response = await transport(`${env.SUPABASE_URL!.replace(/\/$/,'')}/rest/v1/rpc/${name}`, {
      method:'POST', headers:{'Content-Type':'application/json',apikey:env.SUPABASE_SECRET_KEY!},
      body:JSON.stringify(args), signal:AbortSignal.timeout(10000),
    });
    const body: unknown = await response.json();
    if (!response.ok) {
      // Never log Supabase payloads: they may contain customer details or SQL diagnostics.
      const message = body && typeof body==='object' && 'message' in body ? String(body.message) : '';
      const known = ['WRONG_SERVICE','SERVICE_CLOSED','SLOT_UNAVAILABLE','SLOT_EXPIRED','SLOT_FULL','PIZZA_UNAVAILABLE','INVALID_QUANTITY','INVALID_REQUEST','IDEMPOTENCY_CONFLICT'];
      throw new DatabaseError(known.includes(message) ? message : 'DATABASE_UNAVAILABLE');
    }
    return body as T;
  };
}
