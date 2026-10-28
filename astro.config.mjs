import cloudflare from "@astrojs/cloudflare";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import { siteConfig } from "./src/config/site.config.ts";

// Vercel is the default target. Sites retains an explicit Cloudflare build.
const deploymentTarget = process.env.FORNO_DEPLOY_TARGET ?? "vercel";
if (!["vercel", "sites"].includes(deploymentTarget)) throw new Error("FORNO_DEPLOY_TARGET must be vercel or sites");

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
    plugins: [tailwindcss()],
  },
});
