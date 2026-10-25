import type { APIRoute } from "astro";

import { siteConfig } from "../config/site.config";

export const GET: APIRoute = () => {
  const manifestConfig = siteConfig.manifest;
  const manifest = {
    name: manifestConfig.name,
    short_name: manifestConfig.shortName,
    description: manifestConfig.description,
    start_url: manifestConfig.startUrl,
    scope: manifestConfig.scope,
    display: manifestConfig.display,
    background_color: manifestConfig.backgroundColor,
    theme_color: manifestConfig.themeColor,
    icons: manifestConfig.icons,
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
    },
  });
};
