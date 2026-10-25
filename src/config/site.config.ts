import { businessConfig } from "./business.config";

const TODO_CANONICAL_URL = "https://todo-domain.example";
const TODO_THEME_COLOR = "#171717";
const TODO_MANIFEST_BACKGROUND_COLOR = "#fafafa";
const TODO_SITE_LANGUAGE = "fr";
const TODO_SITE_LOCALE = "fr_FR";

export interface SiteConfig {
  canonicalUrl: string;
  name: string;
  language: string;
  locale: string;
  themeColor: string;
  author: string;
  logo: string;
  icons: {
    favicon: string;
    faviconPng: string;
    appleTouchIcon: string;
  };
  socialImages: {
    openGraph: string;
    twitter: string;
  };
  manifest: {
    path: string;
    name: string;
    shortName: string;
    description: string;
    startUrl: string;
    scope: string;
    display: "browser" | "standalone" | "minimal-ui" | "fullscreen";
    backgroundColor: string;
    themeColor: string;
    icons: readonly {
      src: string;
      sizes: string;
      type: string;
      purpose?: "any" | "maskable" | "monochrome";
    }[];
  };
}

export const siteConfig = {
  canonicalUrl: TODO_CANONICAL_URL,
  name: businessConfig.tradeName,
  language: TODO_SITE_LANGUAGE,
  locale: TODO_SITE_LOCALE,
  themeColor: TODO_THEME_COLOR,
  author: businessConfig.legalName,
  logo: "TODO_CLIENT_LOGO_URL",
  icons: {
    favicon: "/icons/TODO_REPLACE_CLIENT_FAVICON.svg",
    faviconPng: "/icons/TODO_REPLACE_CLIENT_FAVICON_32.png",
    appleTouchIcon: "/icons/TODO_REPLACE_CLIENT_APPLE_TOUCH_ICON.png",
  },
  socialImages: {
    openGraph: "/social/TODO_REPLACE_CLIENT_OG.png",
    twitter: "/social/TODO_REPLACE_CLIENT_TWITTER.png",
  },
  manifest: {
    path: "/manifest.webmanifest",
    name: businessConfig.tradeName,
    shortName: businessConfig.tradeName,
    description: businessConfig.shortDescription,
    startUrl: "/",
    scope: "/",
    display: "standalone",
    backgroundColor: TODO_MANIFEST_BACKGROUND_COLOR,
    themeColor: TODO_THEME_COLOR,
    icons: [
      {
        src: "/icons/TODO_REPLACE_CLIENT_ICON_192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/TODO_REPLACE_CLIENT_ICON_512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  },
} as const satisfies SiteConfig;
