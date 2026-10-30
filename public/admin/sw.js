/* Admin scope only. No tokens, no order storage and no API/private-response cache. */
const VERSION='forno-admin-static-v1';
const OFFLINE='/admin/offline/';
const ICONS=['/admin/icons/icon-192.png','/admin/icons/icon-512.png','/admin/icons/maskable-512.png','/admin/icons/apple-touch-icon.png'];
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(VERSION);
 try{
  const response=await fetch(OFFLINE,{credentials:'same-origin',cache:'no-store',redirect:'error'});
  const html=await response.clone().text();
  if(response.ok&&new URL(response.url).origin===self.location.origin&&html.includes('data-forno-offline="v1"')){
   await cache.put(OFFLINE,response);
   const styles=[...html.matchAll(/href="(\/_astro\/[^"?#]+\.css)"/g)].map(m=>m[1]);
   for(const path of [...ICONS,...styles]){const r=await fetch(path,{cache:'no-store',credentials:'same-origin',redirect:'error'});if(r.ok&&(/image\//.test(r.headers.get('Content-Type')||'')||/text\/css/.test(r.headers.get('Content-Type')||'')))await cache.put(path,r);}
  }
 }catch{/* Registration and Push remain usable if the offline guide cannot be fetched. */}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const name of await caches.keys())if(name.startsWith('forno-admin-static-')&&name!==VERSION)await caches.delete(name);
 await self.clients.claim();
})()));
self.addEventListener('message',event=>{
 if(event.data?.type==='SKIP_WAITING'&&event.source?.url&&new URL(event.source.url).origin===self.location.origin&&new URL(event.source.url).pathname.startsWith('/admin/'))self.skipWaiting();
});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin)return;
 // Never intercept/cache authentication, APIs or any customer data.
 if(event.request.mode==='navigate'&&(url.pathname==='/admin'||url.pathname.startsWith('/admin/'))){
  event.respondWith(fetch(event.request,{cache:'no-store'}).catch(async()=>await caches.match(OFFLINE)||new Response('<!doctype html><html lang="fr"><title>Hors connexion</title><h1>Hors connexion</h1><p>Reconnectez-vous pour consulter les commandes.</p><a href="/admin/">Réessayer</a></html>',{headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store'}})));
 }else if(ICONS.includes(url.pathname)||(/^\/_astro\/[^/]+\.css$/.test(url.pathname))){
  event.respondWith(fetch(event.request).catch(async()=>await caches.match(event.request)||Response.error()));
 }
});
self.addEventListener('push',event=>event.waitUntil((async()=>{
 let data;try{data=event.data?.json();}catch{return;}
 if(!data||data.version!==1||!['orders','test'].includes(data.kind))return;
 // Payload has a closed, non-personal schema. Ignore arbitrary titles/URLs from incoming data.
 const count=Number.isSafeInteger(data.count)&&data.count>0&&data.count<=100?data.count:1;
 const reference=typeof data.reference==='string'&&/^F-[0-9]{8,12}$/.test(data.reference)?data.reference:null;
 const pizzas=Number.isSafeInteger(data.pizzas)&&data.pizzas>0&&data.pizzas<=99?data.pizzas:null;
 const time=typeof data.pickupTime==='string'&&/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(data.pickupTime)?data.pickupTime:null;
 const test=data.kind==='test';
 const body=test?'Les notifications sont prêtes sur cet appareil.':count>1?`${count} nouvelles demandes · Consultez le tableau de bord.`:reference&&pizzas&&time?`Commande ${reference} · ${pizzas} pizza(s) · Retrait ${time}`:'Une nouvelle demande vous attend dans le tableau de bord.';
 await self.registration.showNotification(test?'FORNO. — Test de notification':'FORNO. — Nouvelle commande',{body,icon:ICONS[0],badge:ICONS[0],tag:test?'forno-test':'forno-orders',renotify:false,data:{path:'/admin/',kind:data.kind}});
})()));
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const target=new URL('/admin/',self.location.origin).href;
  for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})){
   const url=new URL(client.url);if(url.origin===self.location.origin&&url.pathname.startsWith('/admin/')){await client.navigate(target);return client.focus();}
  }
  return self.clients.openWindow(target);
 })());
});
