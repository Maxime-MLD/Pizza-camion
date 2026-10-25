import type { APIRoute } from "astro";

import { siteConfig } from "../config/site.config";

function getRobotsTxt(): string {
  const sitemapUrl = new URL("sitemap-index.xml", siteConfig.canonicalUrl);

  return [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${sitemapUrl.href}`,
    "",
  ].join("\n");
}

export const GET: APIRoute = () =>
  new Response(getRobotsTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
