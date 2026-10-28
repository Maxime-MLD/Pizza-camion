/** Only runtime bindings used by our endpoints; no secrets are compiled into these declarations. */
declare module 'cloudflare:workers' {
  export const env: import('./server/supabase').OrderEnvironment;
}
