import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import { siteConfig } from "./src/config/site.config.ts";

export default defineConfig({
  output: "static",
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
