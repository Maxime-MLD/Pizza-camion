// Keep Astro's static pages in dist/client and bundle only the Cloudflare server entry for Sites.
import { build } from 'esbuild';
import { mkdir,copyFile,readFile } from 'node:fs/promises';
await build({entryPoints:['dist/server/entry.mjs'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'neutral',target:'es2022',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],minify:true});
await mkdir('dist/.openai',{recursive:true});
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
// No local .env / .dev.vars files are copied to the artifact.
const hosting=JSON.parse(await readFile('dist/.openai/hosting.json','utf8'));
if(hosting.static)throw Error('Sites must deploy the dynamic Worker, not a static-only artifact');
