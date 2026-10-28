import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { handleOrdersApi } from '../../server/ordersApi';
import type { OrderEnvironment } from '../../server/supabase';
export const prerender=false;
export const ALL: APIRoute = ({request,clientAddress}) => handleOrdersApi(request,env as OrderEnvironment,clientAddress);
