import type {APIRoute} from 'astro';
import {pushConfig} from '../../config/push.config';
import {siteConfig} from '../../config/site.config';
export const prerender=true;
export const GET:APIRoute=()=>Response.json({id:pushConfig.scope,name:pushConfig.name,short_name:pushConfig.shortName,lang:'fr',start_url:pushConfig.startUrl,scope:pushConfig.scope,display:'standalone',background_color:siteConfig.manifest.backgroundColor,theme_color:siteConfig.themeColor,icons:[{src:pushConfig.icons.small,sizes:'192x192',type:'image/png',purpose:'any'},{src:pushConfig.icons.large,sizes:'512x512',type:'image/png',purpose:'any'},{src:pushConfig.icons.maskable,sizes:'512x512',type:'image/png',purpose:'maskable'}]},{headers:{'Content-Type':'application/manifest+json; charset=utf-8'}});
