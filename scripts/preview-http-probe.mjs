// Interactive, scoped test client. Access URL arrives on stdin, never argv or stdout.
// Supports only the reviewed order API; does not read any Supabase credential.
import {createInterface} from 'node:readline';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const base=new URL(process.argv[2]??'');
// The tool's private PTY must not echo the access URL supplied on stdin.
if(process.stdin.isTTY)process.stdin.setRawMode(true);
if(base.protocol!=='https:'||!/^pizza-[a-z0-9]+-maxime-mlds-projects\.vercel\.app$/.test(base.hostname)||base.pathname!=='/')throw Error('Expected verified Preview deployment URL');
let cookie='';let directory='';let verifiedTest=false;
const cleanBody=async(r)=>{const body=await r.json();return {status:r.status,body};};
async function api(path,method='GET',body,headers={}){
 if(!['/api/orders','/api/pickup-slots'].includes(path.split('?')[0]))throw Error('Unsupported API');
 if(method==='POST'&&!verifiedTest)throw Error('Read-only test identity check required');
 return fetch(new URL(path,base),{method,headers:{Cookie:cookie,Origin:base.origin,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(22000)});
}
console.log(JSON.stringify({ready:true,origin:base.origin}));
try{
 for await(const line of createInterface({input:process.stdin,crlfDelay:Infinity})){
  try{
   const message=JSON.parse(line);
   if(message.action==='authenticate'){
    let url=new URL(message.accessUrl);if(url.origin!==base.origin||!url.searchParams.has('_vercel_share'))throw Error('Wrong access URL');
    const cookies=new Map();
    for(let i=0;i<6;i++){
     const r=await fetch(url,{headers:url.origin===base.origin&&cookie?{Cookie:cookie}:{},redirect:'manual',signal:AbortSignal.timeout(10000)});
     if(url.origin===base.origin)for(const c of r.headers.getSetCookie()){const pair=c.split(';')[0];cookies.set(pair.slice(0,pair.indexOf('=')),pair);}
     cookie=[...cookies.values()].join('; ');
     const location=r.headers.get('location');
     if(!location){if(!r.ok)throw Error('Authentication refused');break;}
     url=new URL(location,url);if(url.origin!==base.origin&&url.hostname!=='vercel.com')throw Error('Unexpected authentication host');
    }
    const r=await api('/api/pickup-slots?quantity=1');
    directory=await mkdtemp(join(tmpdir(),'forno-preview-access-'));
    await writeFile(join(directory,'access.json'),JSON.stringify({accessUrl:message.accessUrl,origin:base.origin}),{mode:0o600});
    console.log(JSON.stringify({authenticated:r.headers.get('content-type')?.includes('application/json')??false,status:r.status,accessFile:join(directory,'access.json')}));
   }else if(message.action==='availability'){
    const result=await cleanBody(await api('/api/pickup-slots?quantity=2'));
    const service=result.body.service;
    verifiedTest=result.status===200&&service?.id?.startsWith('forno-test-')&&service?.village==='Village de test';
    console.log(JSON.stringify({...result,verifiedTest}));
   }else if(message.action==='order'){
    console.log(JSON.stringify(await cleanBody(await api('/api/orders','POST',message.body))));
   }else if(message.action==='recover'){
    console.log(JSON.stringify(await cleanBody(await api('/api/orders','GET',undefined,{'X-Order-Request-Key':message.key}))));
   }else if(message.action==='parallel'){
    if(!Array.isArray(message.bodies)||message.bodies.length!==2)throw Error('Exactly two synthetic orders required');
    const started=Date.now();
    const requests=message.bodies.map(async(body,index)=>{
     if(index)await new Promise(resolve=>setTimeout(resolve,400));
     return {index,...await cleanBody(await api('/api/orders','POST',body)),elapsedMs:Date.now()-started};
    });
    console.log(JSON.stringify({parallel:await Promise.all(requests)}));
   }else if(message.action==='close'){break;}
   else throw Error('Unsupported action');
  }catch{console.log(JSON.stringify({error:'PROBE_FAILED',detail:'No credential or request body logged'}));}
 }
}finally{
 if(directory)await rm(directory,{recursive:true,force:true});
 if(process.stdin.isTTY)process.stdin.setRawMode(false);
 process.stdin.pause();
}
