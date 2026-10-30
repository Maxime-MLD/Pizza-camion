import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {after} from 'node:test';
const dir=await mkdtemp(join(process.cwd(),'node_modules/.forno-push-test-'));
after(()=>rm(dir,{recursive:true,force:true}));
const result=await build({stdin:{contents:'import "./tests/push.test.ts"; import "./tests/serviceWorker.test.ts";',resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',packages:'external',write:false,plugins:[{name:'runtime-only',setup(b){b.onResolve({filter:/^astro:env\/server$/},()=>({path:'env',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const getSecret=(key)=>process.env[key];'}));}}]});
const file=join(dir,'test.mjs');await writeFile(file,result.outputFiles[0].text);await import(pathToFileURL(file).href);
