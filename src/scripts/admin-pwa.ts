import {pushConfig} from '../config/push.config';
interface InstallEvent extends Event {prompt():Promise<void>;userChoice:Promise<{outcome:string}>;}
let installEvent:InstallEvent|null=null;
let registrationPromise:Promise<ServiceWorkerRegistration>|null=null;
export const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
export const isIos=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
export async function updateAppBadge(count:number):Promise<void>{
 const n=navigator as Navigator&{setAppBadge?:(value:number)=>Promise<void>;clearAppBadge?:()=>Promise<void>};
 try{if(count>0)await n.setAppBadge?.(count);else await n.clearAppBadge?.();}catch{/* Unsupported or not permitted; counters in the dashboard remain authoritative. */}
}
export function adminRegistration():Promise<ServiceWorkerRegistration>{
 if(!('serviceWorker'in navigator)||!isSecureContext)return Promise.reject(Error('UNSUPPORTED'));
 registrationPromise??=navigator.serviceWorker.register(pushConfig.worker,{scope:pushConfig.scope,updateViaCache:'none'}).then(async()=>{
  const ready=await navigator.serviceWorker.ready;if(new URL(ready.scope).pathname!==pushConfig.scope)throw Error('WRONG_SCOPE');return ready;
 });return registrationPromise;
}
export const canInstallAdminApp=()=>installEvent!==null;
export async function installAdminApp():Promise<boolean>{if(!installEvent)return false;await installEvent.prompt();const choice=await installEvent.userChoice;installEvent=null;return choice.outcome==='accepted';}
addEventListener('beforeinstallprompt',event=>{event.preventDefault();installEvent=event as InstallEvent;dispatchEvent(new Event('forno-install-available'));});
if(location.pathname.startsWith(pushConfig.scope)){
 let reloadForUpdate=false;
 const banner=document.querySelector<HTMLElement>('[data-pwa-update]');
 const button=document.querySelector<HTMLButtonElement>('[data-pwa-update-button]');
 void adminRegistration().then(reg=>{
  const check=()=>{if(reg.waiting&&banner)banner.hidden=false;};check();
  reg.addEventListener('updatefound',()=>reg.installing?.addEventListener('statechange',check));
  button?.addEventListener('click',()=>{if(reg.waiting){reloadForUpdate=true;reg.waiting.postMessage({type:'SKIP_WAITING'});}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void reg.update().catch(()=>undefined);});
 }).catch(()=>{const status=document.querySelector<HTMLElement>('[data-pwa-status]');if(status)status.textContent='Installation non disponible dans ce navigateur. Le dashboard en ligne reste accessible.';});
 navigator.serviceWorker?.addEventListener('controllerchange',()=>{if(reloadForUpdate)location.reload();});
 if(document.body.dataset.adminAuthenticated==='false')void updateAppBadge(0);
}
