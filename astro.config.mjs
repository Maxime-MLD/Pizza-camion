import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import { siteConfig } from "./src/config/site.config.ts";

export default defineConfig({
  output: "static",
  session: false,
  adapter: cloudflare({ imageService: "compile", prerenderEnvironment: "node" }),
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
