import {adminRegistration,canInstallAdminApp,installAdminApp,isIos,isStandalone,updateAppBadge} from './admin-pwa';
import {pushConfig} from '../config/push.config';
interface Device {id:string;label:string;active:boolean;createdAt:string;lastUsedAt:string|null;reason:string|null;}
interface State {enabled:boolean;ready:boolean;publicKey:string|null;currentDeviceId:string|null;devices:Device[];}
const section=document.querySelector<HTMLElement>('[data-push-settings]');
if(section){
 const status=section.querySelector<HTMLElement>('[data-push-state]')!,feedback=section.querySelector<HTMLElement>('[data-push-feedback]')!;
 const enable=section.querySelector<HTMLButtonElement>('[data-push-enable]')!,test=section.querySelector<HTMLButtonElement>('[data-push-test]')!,disable=section.querySelector<HTMLButtonElement>('[data-push-disable]')!,install=section.querySelector<HTMLButtonElement>('[data-pwa-install]')!;
 const label=section.querySelector<HTMLInputElement>('[data-push-label]')!,devices=section.querySelector<HTMLUListElement>('[data-push-devices]')!,dialog=section.querySelector<HTMLDialogElement>('[data-push-confirm]')!;
 const csrf=document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')!.content;
 let current:State|null=null,busy=false,removeId:string|null=null;
 const compatible='Notification'in window&&'PushManager'in window&&'serviceWorker'in navigator;
 const permission=()=>compatible?Notification.permission:'unsupported';
 const message=(code:string)=>{feedback.textContent=pushConfig.errors[code as keyof typeof pushConfig.errors]??(code==='denied'?'Autorisation refusée. Modifiez les réglages de notifications de l’application ou du navigateur.':code==='UNAUTHORIZED'?'Votre session a expiré. Reconnectez-vous.':'Impossible de modifier les notifications. Vérifiez votre connexion.');};
 function refreshButtons(){const active=!!current?.devices.some(d=>d.id===current?.currentDeviceId&&d.active);
  enable.disabled=busy||!compatible||!current?.ready||permission()==='denied'||(isIos()&&!isStandalone());test.disabled=busy||!active;disable.disabled=busy||!active;
 }
 async function request(data:unknown){const r=await fetch('/api/admin/push',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(data),signal:AbortSignal.timeout(12000)});const b=await r.json() as {error?:string};if(!r.ok)throw Error(b.error??'UNAVAILABLE');return b;}
 async function read(){try{
  const r=await fetch('/api/admin/push',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(12000)});const data=await r.json() as State&{error?:string};if(!r.ok)throw Error(data.error??'UNAVAILABLE');current=data;
  const p=permission();status.textContent=`Autorisation : ${p==='granted'?'accordée':p==='denied'?'refusée':p==='unsupported'?'non prise en charge':'non demandée'}. ${data.ready?'Serveur prêt.':'Serveur en préparation.'}`;
  if(!compatible)status.textContent='Web Push n’est pas disponible dans ce navigateur. Ouvrez l’application dans Safari sur iPhone ou Chrome sur Android.';
  if(isIos()&&!isStandalone())status.textContent+=' Sur iPhone, installez d’abord l’application sur l’écran d’accueil.';
  devices.replaceChildren();for(const d of data.devices){const li=document.createElement('li');li.className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3';const text=document.createElement('span');text.textContent=`${d.label}${d.id===data.currentDeviceId?' · cet appareil':''} · ${d.active?'actif':'désactivé'}`;li.append(text);if(d.active){const b=document.createElement('button');b.className='min-h-11 rounded-lg border border-border px-3 font-semibold';b.textContent='Retirer';b.addEventListener('click',()=>{removeId=d.id;dialog.returnValue='cancel';dialog.showModal();});li.append(b);}devices.append(li);}
  if(!data.devices.length){const li=document.createElement('li');li.textContent='Aucun appareil enregistré.';devices.append(li);}
 }catch(error){message(error instanceof Error?error.message:'UNAVAILABLE');current=null;}refreshButtons();}
 async function operation(fn:()=>Promise<void>){if(busy)return;busy=true;refreshButtons();feedback.textContent='';try{await fn();}catch(error){message(error instanceof Error?error.message:'UNAVAILABLE');}finally{busy=false;await read();}}
 enable.addEventListener('click',()=>{
  // Permission is requested synchronously within the explicit gesture, before any other await.
  if(!compatible||!current?.publicKey||(isIos()&&!isStandalone()))return;
  const grant=Notification.permission==='default'?Notification.requestPermission():Promise.resolve(Notification.permission);
  void operation(async()=>{if(await grant!=='granted')throw Error('denied');const reg=await adminRegistration();
   const key=current!.publicKey!;const raw=atob(key.replace(/-/g,'+').replace(/_/g,'/'));const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
   const subscription=await reg.pushManager.getSubscription()??await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});const json=subscription.toJSON();
   await request({action:'subscribe',endpoint:json.endpoint,p256dh:json.keys?.p256dh,auth:json.keys?.auth,label:label.value.trim()||'Cet appareil'});feedback.textContent='Cet appareil est abonné. Envoyez un test pour vérifier sa réception.';
  });
 });
 test.addEventListener('click',()=>void operation(async()=>{await request({action:'test',deviceId:current!.currentDeviceId});feedback.textContent='Notification de test mise en file. Vérifiez sa réception sur cet appareil ; cet écran ne confirme pas la réception.';}));
 async function revoke(id:string){await request({action:'revoke',deviceId:id});if(id===current?.currentDeviceId){const reg=await adminRegistration();await(await reg.pushManager.getSubscription())?.unsubscribe();await updateAppBadge(0);}feedback.textContent='Appareil désactivé côté serveur.';}
 disable.addEventListener('click',()=>void operation(async()=>revoke(current!.currentDeviceId!)));
 dialog.addEventListener('close',()=>{const id=removeId;removeId=null;if(dialog.returnValue==='confirm'&&id)void operation(()=>revoke(id));});
 install.hidden=!canInstallAdminApp()||isStandalone();
 addEventListener('forno-install-available',()=>{install.hidden=isStandalone();});install.addEventListener('click',()=>void installAdminApp().then(ok=>{feedback.textContent=ok?'Application installée.':'Utilisez le menu du navigateur pour ajouter cette application à l’écran d’accueil.';}));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void read();});addEventListener('online',()=>void read());
 void adminRegistration().catch(()=>undefined);void read();
}
