interface Turnstile {
 render(node:HTMLElement,options:{sitekey:string;action:string;size:string;callback:(token:string)=>void;'expired-callback':()=>void;'error-callback':()=>void}):string;
 reset(id:string):void;
}
declare global { interface Window {turnstile?:Turnstile;} }
let loader:Promise<void>|undefined;
export async function mountTurnstile(node:HTMLElement,sitekey:string,onToken:(token:string)=>void):Promise<()=>void> {
 if(!window.turnstile){
  loader??=new Promise<void>((resolve,reject)=>{
   const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
   script.onload=()=>resolve();script.onerror=()=>{loader=undefined;reject(Error('verification unavailable'));};document.head.append(script);
  });
  await loader;
 }
 if(!window.turnstile)throw Error('verification unavailable');
 const id=window.turnstile.render(node,{sitekey,action:'order',size:'flexible',callback:onToken,'expired-callback':()=>onToken(''),'error-callback':()=>onToken('')});
 return ()=>{onToken('');window.turnstile?.reset(id);};
}
