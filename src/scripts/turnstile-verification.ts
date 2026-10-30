import {mountTurnstile} from './turnstile';
import {validationConfig} from '../config/validation.config';
const root=document.querySelector<HTMLElement>('[data-turnstile-verification]');
if(root){
 const button=root.querySelector<HTMLButtonElement>('[data-verification-check]')!,resetButton=root.querySelector<HTMLButtonElement>('[data-verification-reset]')!,result=root.querySelector<HTMLElement>('[data-verification-result]')!;
 const csrf=document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')!.content;
 let token='',reset:(()=>void)|undefined,busy=false;
 void fetch(validationConfig.turnstile,{cache:'no-store'}).then(async response=>{
  if(!response.ok)throw Error('unavailable');const data=await response.json() as {siteKey:string};
  reset=await mountTurnstile(root.querySelector('[data-verification-widget]')!,data.siteKey,value=>{token=value;button.disabled=busy||!value;});
 }).catch(()=>{result.textContent='Le widget est indisponible. Vérifiez la configuration et votre session.';});
 button.addEventListener('click',async()=>{
  if(busy||!token)return;busy=true;button.disabled=true;
  try{const response=await fetch(validationConfig.turnstile,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({token,attemptId:crypto.randomUUID()}),signal:AbortSignal.timeout(12000)});
   const data=await response.json() as {valid?:boolean;error?:string};result.textContent=response.ok&&data.valid?'Jeton réel validé. Un nouvel essai avec ce même jeton doit être refusé.':data.error==='BOT_VERIFICATION_FAILED'?'Jeton refusé par Cloudflare (invalide, expiré ou déjà utilisé).':'Vérification impossible. Aucun enregistrement de commande.';
  }catch{result.textContent='Connexion interrompue. Aucun enregistrement de commande.';}finally{busy=false;button.disabled=!token;}
 });
 resetButton.addEventListener('click',()=>{if(!busy){reset?.();result.textContent='Renouvellement demandé.';}});
}
