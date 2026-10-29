import {adminConfig as cfg} from '../config/admin.config';
import type {AdminOrder,AdminOrders,AdminService,AdminSettings} from '../types/admin';
const root=document.querySelector<HTMLElement>('[data-admin-view]');
const escape=(value:unknown):string=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const money=(n:number)=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(n/100);
const time=(s:string)=>new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'}).format(new Date(s));
const date=(s:string)=>new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',weekday:'long',day:'numeric',month:'long'}).format(new Date(`${s}T12:00:00Z`));
const card='rounded-2xl border border-border bg-surface p-5 sm:p-6';
const button='min-h-12 rounded-xl bg-text px-4 py-3 text-sm font-bold text-background disabled:cursor-not-allowed disabled:opacity-50';
const field='min-h-12 min-w-0 w-full rounded-lg border border-[var(--color-border-strong)] bg-surface px-3 text-base';
const payload=(data:unknown)=>escape(JSON.stringify(data));
if(root){
 const content=root.querySelector<HTMLElement>('[data-content]')!;
 const connection=root.querySelector<HTMLElement>('[data-connection]')!;
 const message=root.querySelector<HTMLElement>('[data-message]')!;
 const view=root.dataset.adminView!;
 const confirmation=root.querySelector<HTMLDialogElement>('[data-confirm-dialog]')!;
 let pendingConfirmation:Record<string,unknown>|null=null;let confirmationTrigger:HTMLButtonElement|null=null;
 const csrf=document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')!.content;
 let data:Record<string,unknown>|null=null;let busy=false;let reading=false;let online=false;let snapshot='';let timer:ReturnType<typeof setTimeout>|undefined;
 let known:Set<string>|null=null;let audio:AudioContext|undefined;
 const notify=(text:string)=>{message.textContent=text;message.classList.toggle('hidden',!text);};
 const renderOrders=()=>{
  const state=data as unknown as AdminOrders;const service=state.service;
  const counts=['pending','preparing','ready'].map(status=>state.orders.filter(o=>o.status===status).length);
  const history=root.querySelector<HTMLInputElement>('[data-history]')!.checked;
  const orders=state.orders.filter(o=>history||!['completed','rejected','cancelled'].includes(o.status));
  return `<section class="${card}"><p class="text-xs font-semibold uppercase tracking-widest">${escape(date(state.date))}</p><h2 class="mt-2 text-2xl font-bold">${escape(service?.village??'Aucun service aujourd’hui')}</h2>${service?`<p class="mt-2 text-sm text-muted-foreground">${escape(service.openingTime)} – ${escape(service.closingTime)} · ${service.ordersEnabled&&service.status==='open'?'Commandes autorisées pour ce service':'Commandes fermées'}</p>`:''}${!data!.publicOrdersEnabled?'<p class="mt-3 text-sm font-semibold text-primary-dark">Verrou général des commandes fermé.</p>':''}</section>
  <div class="grid grid-cols-3 gap-2 sm:gap-4">${['En attente','En préparation','Prêtes'].map((label,i)=>`<div class="${card} !p-3 sm:!p-5"><p class="text-3xl font-bold tabular-nums">${counts[i]}</p><p class="mt-1 text-xs sm:text-sm">${label}</p></div>`).join('')}</div>
  ${state.orders.length>=500?'<p role="alert">Limite de 500 commandes atteinte. Contactez le responsable technique.</p>':''}
  <div class="grid gap-4 lg:grid-cols-2">${orders.map(orderCard).join('')||`<p class="${card}">Aucune commande ${history?'pour ce service':'à traiter'}.</p>`}</div>`;
 };
 function orderCard(o:AdminOrder):string{
  const actions=cfg.transitions[o.status];const name=[o.firstName,o.lastName].filter(Boolean).join(' ');
  return `<article class="${card} ${o.status==='pending'?'border-l-4 border-l-accent':''}"><div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="text-xl font-extrabold">${escape(o.reference)}</h2><p class="mt-1 text-sm text-muted-foreground">Reçue à ${escape(time(o.receivedAt))}</p></div><div class="text-right"><p class="text-2xl font-bold tabular-nums">${escape(o.pickupTime)}</p><p class="mt-1 text-sm font-semibold">${escape(cfg.statuses[o.status])}</p></div></div>
  ${name?`<p class="mt-4 break-words font-bold">${escape(name)}</p>`:''}${o.phone?`<a class="mt-2 inline-flex min-h-11 items-center font-semibold underline" href="tel:${escape(o.phone)}">${escape(o.phone)}</a>`:''}
  <ul class="mt-4 grid gap-2 border-t border-border pt-4">${o.lines.map(l=>`<li class="flex gap-3"><strong class="tabular-nums">${l.quantity} ×</strong><span>${escape(l.name)}</span></li>`).join('')}</ul>
  ${o.note?`<p class="mt-4 whitespace-pre-wrap break-words rounded-xl bg-muted p-3 text-sm">${escape(o.note)}</p>`:''}
  <div class="mt-5 flex justify-between gap-3 text-sm"><span>Paiement au camion</span><strong>${escape(money(o.totalCents))}</strong></div>
  ${o.status==='pending'?`<p class="mt-2 text-xs text-muted-foreground">À accepter avant ${escape(time(o.expiresAt))}</p>`:''}
  ${actions.length?`<div class="mt-5 grid gap-2 ${actions.length===2?'sm:grid-cols-2':'sm:grid-cols-1'}">${actions.map(a=>`<button data-change="${payload({action:'transition',id:o.id,expected:o.status,status:a.status})}" ${a.status==='rejected'?'data-confirm="Refuser cette demande ? Le créneau sera libéré."':''} class="${button}">${escape(a.label)}</button>`).join('')}</div>`:''}</article>`;
 }
 const renderPlanning=()=>{
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const services=data!.services as AdminService[];
  return `<p class="text-sm text-muted-foreground">Les changements sont vérifiés sur le serveur. Fermer les commandes conserve les commandes déjà reçues. Les horaires sont modifiables uniquement pour les services futurs sans commande.</p>${services.map(s=>`<article class="${card}"><div class="flex flex-wrap justify-between gap-3"><div><p class="text-xs font-semibold uppercase">${escape(date(s.date))}</p><h2 class="mt-2 text-xl font-bold">${escape(s.village)}</h2><p class="mt-2 text-sm">${escape(s.openingTime)} – ${escape(s.closingTime)} · ${s.slots.filter(x=>x.enabled).length} créneaux</p></div><p class="text-sm font-bold">${s.status==='cancelled'?'Service annulé':s.ordersEnabled?'Commandes ouvertes':'Commandes fermées'}</p></div>
  ${s.status!=='cancelled'?`<div class="mt-4 flex flex-wrap gap-2"><button data-change="${payload({action:s.ordersEnabled?'close':'open',id:s.id,expectedUpdatedAt:s.updatedAt})}" ${s.ordersEnabled?'data-confirm="Fermer les nouvelles commandes de ce service ? Les commandes existantes sont conservées."':!data!.canOpen?'disabled':''} class="${button}">${s.ordersEnabled?'Fermer les commandes':'Ouvrir les commandes'}</button><button data-change="${payload({action:'cancel',id:s.id,expectedUpdatedAt:s.updatedAt})}" data-confirm="Annuler ce service ? Cette action sera refusée s’il reste des commandes à traiter." class="min-h-12 rounded-xl border border-primary-dark px-4 text-sm font-bold text-primary-dark">Annuler le service</button></div>`:''}
  ${s.date>today&&s.status!=='cancelled'?`<form data-edit="${payload({action:'hours',id:s.id,expectedUpdatedAt:s.updatedAt})}" class="mt-5 grid gap-3 sm:grid-cols-3"><label class="grid gap-1 text-sm">Ouverture<input name="openingTime" type="time" value="${escape(s.openingTime)}" required class="${field}"/></label><label class="grid gap-1 text-sm">Fermeture<input name="closingTime" type="time" value="${escape(s.closingTime)}" required class="${field}"/></label><button class="${button} self-end">Modifier les horaires</button></form>`:''}
  <details class="mt-5 border-t border-border pt-4"><summary class="min-h-11 cursor-pointer font-semibold">Créneaux et capacités</summary><div class="mt-3 grid gap-3 sm:grid-cols-2">${s.slots.filter(x=>x.enabled).map(slot=>`<form data-edit="${payload({action:'capacity',id:s.id,expectedUpdatedAt:s.updatedAt,slotId:slot.id,expectedCapacity:slot.capacity})}" class="flex min-w-0 items-end gap-2 rounded-xl bg-background p-3"><label class="grid min-w-0 flex-1 gap-1 text-xs">${escape(slot.time)} · ${slot.used} pizza(s) réservée(s)<input type="number" name="capacity" aria-label="Capacité du ${escape(s.date)} à ${escape(slot.time)}" min="${Math.max(1,slot.used)}" max="200" value="${slot.capacity}" required class="${field}"/></label><button class="${button}">OK</button></form>`).join('')}</div></details></article>`).join('')||'<p>Aucun service planifié dans les 90 prochains jours.</p>'}`;
 };
 const renderSettings=()=>{
  const s=data as unknown as AdminSettings;
  return `<section class="${card}"><h2 class="text-xl font-bold">Votre compte</h2><p class="mt-3 break-all">${escape(data!.account)}</p><p class="mt-3 text-sm font-semibold">Commandes publiques : ${data!.publicOrdersEnabled?'verrou global autorisé':'désactivées'}</p><p class="mt-2 text-sm text-muted-foreground">L’ouverture Production reste verrouillée dans cette version.</p></section>
  <form data-edit="${payload({action:'settings',revision:s.revision})}" class="${card} grid gap-5"><h2 class="text-xl font-bold">Paramètres métier</h2>${[
   ['minimumLeadMinutes','Délai minimum de préparation (minutes)',s.minimumLeadMinutes,0,240],['defaultSlotCapacity','Capacité des nouveaux créneaux (pizzas)',s.defaultSlotCapacity,1,200],['slotIntervalMinutes','Intervalle des nouveaux créneaux (minutes)',s.slotIntervalMinutes,5,60]
  ].map(([name,label,value,min,max])=>`<label class="grid gap-2 text-sm font-semibold">${label}<input class="${field}" type="number" name="${name}" value="${value}" min="${min}" max="${max}" required/></label>`).join('')}
  <p class="text-sm text-muted-foreground">Capacité et intervalle servent aux futurs créneaux ; les services existants restent inchangés. Le délai ne peut pas être modifié pendant qu’une commande est en cours ou qu’un service autorise les commandes. Chaque changement est journalisé.</p><button class="${button}">Enregistrer les réglages</button></form>`;
 };
 function render(){if(!data)return;content.innerHTML=view==='orders'?renderOrders():view==='planning'?renderPlanning():renderSettings();content.setAttribute('aria-busy','false');disable(!online||busy);}
 function disable(value:boolean){content.querySelectorAll<HTMLButtonElement>('button').forEach(b=>{b.disabled=value||(!!b.dataset.change&&JSON.parse(b.dataset.change).action==='open'&&!data?.canOpen);});}
 async function read(force=false){
  if(reading||busy||document.hidden)return;reading=true;
  try{
   const response=await fetch(`/api/admin/${view}`,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(12000)});
   if(response.status===401||response.status===403){content.replaceChildren();location.replace('/admin/login/?session=expired');return;}
   if(!response.ok)throw Error('UNAVAILABLE');
   const next=await response.json() as Record<string,unknown>;
   const incoming=view==='orders'?new Set((next.orders as AdminOrder[]).filter(o=>o.status==='pending').map(o=>o.id)):null;
   if(incoming&&known){const added=[...incoming].filter(id=>!known!.has(id)).length;if(added){root!.querySelector('[data-new]')!.textContent=`${added} nouvelle(s) demande(s)`;if(root!.querySelector<HTMLInputElement>('[data-sound]')!.checked&&audio?.state==='running'){const oscillator=audio.createOscillator();const gain=audio.createGain();gain.gain.value=0.08;oscillator.connect(gain).connect(audio.destination);oscillator.frequency.value=660;oscillator.start();oscillator.stop(audio.currentTime+0.15);}}}known=incoming;
   online=true;connection.textContent=`À jour à ${time(new Date().toISOString())} · actualisation automatique`;const serialized=JSON.stringify({...next,serverNow:undefined});
   const editing=content.contains(document.activeElement)&&document.activeElement?.matches('input,select,textarea');
   if((force||serialized!==snapshot)&&!editing){data=next;snapshot=serialized;render();}else disable(false);
  }catch{online=false;connection.textContent=cfg.errors.UNAVAILABLE;disable(true);}
  finally{reading=false;clearTimeout(timer);timer=setTimeout(()=>void read(),cfg.pollMs);}
 }
 async function change(payload:Record<string,unknown>){
  if(busy||!online)return;busy=true;disable(true);notify('');
  try{
   const response=await fetch('/api/admin/change',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
   if(response.status===401||response.status===403){const failure=await response.json() as {error:string};if(failure.error==='UNAUTHORIZED'||failure.error==='ADMIN_FORBIDDEN'){content.replaceChildren();location.replace('/admin/login/?session=expired');return;}throw Error(failure.error);}
   const result=await response.json() as {error?:string};if(!response.ok)throw Error(result.error??'UNAVAILABLE');notify('Modification enregistrée.');
  }catch(error){const code=error instanceof Error?error.message:'UNAVAILABLE';notify(cfg.errors[code as keyof typeof cfg.errors]??cfg.errors.UNAVAILABLE);}
  finally{busy=false;await read(true);}
 }
 root.addEventListener('click',event=>{
  const target=(event.target as Element).closest<HTMLButtonElement>('button[data-change]');if(!target||target.disabled)return;
  const input=JSON.parse(target.dataset.change!) as Record<string,unknown>;
  if(target.dataset.confirm){pendingConfirmation=input;confirmationTrigger=target;confirmation.querySelector('[data-confirm-copy]')!.textContent=target.dataset.confirm;confirmation.returnValue='cancel';confirmation.showModal();return;}
  void change(input);
 });
 confirmation.addEventListener('close',()=>{const input=pendingConfirmation;pendingConfirmation=null;if(confirmationTrigger?.isConnected)confirmationTrigger.focus();else root!.querySelector<HTMLButtonElement>('[data-refresh]')!.focus();confirmationTrigger=null;if(confirmation.returnValue==='confirm'&&input)void change(input);});
 root.addEventListener('submit',event=>{const form=(event.target as Element).closest<HTMLFormElement>('form[data-edit]');if(!form)return;event.preventDefault();const value:Record<string,unknown>=JSON.parse(form.dataset.edit!);for(const [key,entry] of new FormData(form))value[key]=['capacity','minimumLeadMinutes','defaultSlotCapacity','slotIntervalMinutes'].includes(key)?Number(entry):entry;void change(value);});
 root.querySelector('[data-refresh]')!.addEventListener('click',()=>void read(true));
 root.querySelector('[data-history]')?.addEventListener('change',render);
 root.querySelector('[data-sound]')?.addEventListener('change',async(event)=>{if((event.target as HTMLInputElement).checked){audio??=new AudioContext();await audio.resume().catch(()=>notify('Le son n’est pas autorisé par ce navigateur.'));}});
 addEventListener('online',()=>void read(true));addEventListener('offline',()=>{online=false;connection.textContent=cfg.errors.UNAVAILABLE;disable(true);});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void read(true);else clearTimeout(timer);});
 addEventListener('pagehide',()=>{clearTimeout(timer);content.replaceChildren();});addEventListener('pageshow',event=>{if(event.persisted)void read(true);});
 void read();
}
