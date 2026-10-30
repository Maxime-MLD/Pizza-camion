import {build} from 'esbuild';
// The MCP upload uses this self-contained entry plus the pinned deno.json/deno.lock.
// Source imports remain TypeScript-checked by Deno before packaging.
const outfile=process.argv[2];if(!outfile)throw Error('Usage: node scripts/bundle-push-worker.mjs OUTPUT_PATH');
await build({entryPoints:['supabase/functions/forno-push-worker/index.ts'],outfile,bundle:true,format:'esm',platform:'neutral',external:['npm:*'],target:'es2022'});
