import {fileURLToPath} from "node:url";
import cloudflare from "@astrojs/cloudflare";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import { siteConfig } from "./src/config/site.config.ts";

// Vercel is the default target. Sites retains an explicit Cloudflare build.
const deploymentTarget = process.env.FORNO_DEPLOY_TARGET ?? "vercel";
if (!["vercel", "sites"].includes(deploymentTarget)) throw new Error("FORNO_DEPLOY_TARGET must be vercel or sites");

const profile=process.env.VERCEL_ENV==='production'?'production':'preview';

export default defineConfig({
  output: "static",
  session: false,
  adapter: deploymentTarget === "sites"
    ? cloudflare({ imageService: "compile", prerenderEnvironment: "node" })
    : vercel({ imageService: false }),
  devToolbar: { enabled: false },
  site: siteConfig.canonicalUrl,
  integrations: [
    sitemap({
      filter: (page) =>
        !new URL(page).pathname.startsWith("/admin") &&
        !page.endsWith("/404/") &&
        !page.endsWith("/merci/") &&
        !page.endsWith("/robots.txt") &&
        !page.endsWith("/manifest.webmanifest"),
      namespaces: {
        news: false,
        video: false,
      },
    }),
  ],
  vite: {
    resolve: {alias: {"@forno/deployment": fileURLToPath(new URL(`./src/config/deployment.${profile}.ts`,import.meta.url))}},
    plugins: [tailwindcss()],
  },
});
