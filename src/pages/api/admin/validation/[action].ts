import type {APIRoute} from 'astro';
import {getAdminEnvironment} from '../../../../server/admin/environment';
import {handlePrivateValidation} from '../../../../server/validation/api';
export const prerender=false;
export const ALL:APIRoute=({request,params,locals,cookies,clientAddress})=>handlePrivateValidation(request,getAdminEnvironment(),params.action,locals.admin,cookies,clientAddress);
