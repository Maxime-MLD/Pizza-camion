import {defineMiddleware} from 'astro:middleware';
import {getAdminEnvironment,adminConfigured} from './server/admin/environment';
import {getIdentity,clearSession,cookieNames} from './server/admin/session';
import {AdminError} from './server/admin/client';
export const onRequest=defineMiddleware(async(context,next)=>{
 const path=context.url.pathname.replace(/\/$/,'');
 if(!(path==='/admin'||path.startsWith('/admin/')||path.startsWith('/api/admin/')))return next();
 const headers=new Headers();
 // Applies to HTML, API errors and redirects; never cache a refreshed session or PII.
 headers.set('Cache-Control','private, no-store');
 headers.set('X-Robots-Tag','noindex, nofollow');
 headers.set('X-Content-Type-Options','nosniff');
 // Preserve Origin for native form POSTs while suppressing cross-origin referrers.
 headers.set('Referrer-Policy','same-origin');
 headers.set('Content-Security-Policy',"frame-ancestors 'none'; form-action 'self'; base-uri 'self'");
 const env=getAdminEnvironment();
 let response:Response;
 if(!adminConfigured(env))response=new Response('Espace administrateur indisponible.',{status:503});
 else if(path==='/admin/login'||path==='/api/admin/login'||path==='/api/admin/logout')response=await next();
 else try{context.locals.admin=await getIdentity(env,context.cookies);response=await next();}
 catch(error){const status=error instanceof AdminError?error.status:503;
  const hadSession=!!context.cookies.get(cookieNames.refresh)||!!context.cookies.get(cookieNames.access);
  if(status===401||status===403)clearSession(context.cookies);
  response=path.startsWith('/api/')?Response.json({error:status===403?'ADMIN_FORBIDDEN':status===401?'UNAUTHORIZED':'UNAVAILABLE'},{status}):status===401?context.redirect(hadSession?'/admin/login/?session=expired':'/admin/login/',303):new Response(status===403?'Ce compte n’est pas autorisé.':'Connexion au serveur indisponible.',{status});
 }
 // Explicitly attach headers even to short-circuit responses.
 for(const [key,value] of headers)response.headers.set(key,value);
 return response;
});
