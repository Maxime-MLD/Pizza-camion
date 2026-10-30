import type {OrderEnvironment} from './supabase';
/** Build-bound identity is populated by the server environment module, never request data. */
export function matchesDeployment(env:OrderEnvironment):boolean{
 if(!['production','preview'].includes(env.VERCEL_ENV??'')||env.FORNO_DEPLOYMENT_PROFILE!==env.VERCEL_ENV)return false;
 if(!/^[a-z0-9]{20}$/.test(env.FORNO_EXPECTED_SUPABASE_REF??''))return false;
 if(env.SUPABASE_URL!==`https://${env.FORNO_EXPECTED_SUPABASE_REF}.supabase.co`)return false;
 try{const origin=new URL(env.FORNO_APP_ORIGIN??'');if(origin.protocol!=='https:'||origin.origin!==env.FORNO_APP_ORIGIN)return false;}catch{return false;}
 return env.VERCEL_ENV==='production'||!!env.FORNO_PREVIEW_BRANCH&&env.VERCEL_GIT_COMMIT_REF===env.FORNO_PREVIEW_BRANCH;
}
export const isolatedPreview=(env:OrderEnvironment)=>env.VERCEL_ENV==='preview'&&matchesDeployment(env);
