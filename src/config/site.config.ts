import { businessConfig } from "./business.config";

const TODO_CANONICAL_URL = "https://pizza-camion-forno.quirkyhawk35.chatgpt.site";
const TODO_THEME_COLOR = "#F7EEDB";
const TODO_MANIFEST_BACKGROUND_COLOR = "#F7EEDB";
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
  logo: "/icons/forno-mark.svg",
  icons: {
    favicon: "/icons/forno-mark.svg",
  },
  socialImages: {
    openGraph: "/social/forno-og.jpg",
    twitter: "/social/forno-og.jpg",
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
        src: "/icons/forno-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/forno-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  },
} as const satisfies SiteConfig;
