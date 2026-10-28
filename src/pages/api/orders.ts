import type { APIRoute } from 'astro';
import { getOrderEnvironment } from '../../server/environment';
import { handleOrdersApi } from '../../server/ordersApi';
export const prerender=false;
export const ALL: APIRoute = ({request,clientAddress}) => handleOrdersApi(request,getOrderEnvironment(),clientAddress);
