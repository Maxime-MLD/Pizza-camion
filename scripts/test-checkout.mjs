// Utilise le bundler déjà fourni par Astro/Vite, sans dépendance de test supplémentaire.
import { build } from "esbuild";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { after } from "node:test";

const directory = await mkdtemp(join(tmpdir(), "forno-checkout-test-"));
after(() => rm(directory, { recursive: true, force: true }));
const { outputFiles } = await build({
  entryPoints: ["tests/checkout.test.ts"], bundle: true, platform: "node", format: "esm", write: false,
  plugins: [{ name: "asset-stub", setup(builder) {
    builder.onLoad({ filter: /\.(jpg|webp)$/ }, () => ({ contents: "export default {};", loader: "js" }));
  } }],
});
const file = join(directory, "checkout.test.mjs");
await writeFile(file, outputFiles[0].text);
await import(pathToFileURL(file).href);
