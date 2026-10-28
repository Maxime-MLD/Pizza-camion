import { build } from 'esbuild';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after } from 'node:test';
// Output inside repo for external test-only PGlite resolution. Removed after the test run.
const directory=await mkdtemp(join(process.cwd(),'node_modules/.forno-orders-test-'));
after(()=>rm(directory,{recursive:true,force:true}));
const {outputFiles}=await build({stdin:{contents:'import \"./tests/orders.test.ts\"; import \"./tests/supabaseSetup.test.ts\";',resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',packages:'external',write:false});
const file=join(directory,'test.mjs');await writeFile(file,outputFiles[0].text);await import(pathToFileURL(file).href);
