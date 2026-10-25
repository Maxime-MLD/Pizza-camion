import type { TodoValue } from "../types/business.config";
import { businessConfig } from "./business.config";
import { siteConfig } from "./site.config";

export type SchemaOrgType =
  | "LocalBusiness"
  | "ProfessionalService"
  | "HomeAndConstructionBusiness"
  | "Electrician"
  | "Plumber"
  | "GeneralContractor"
  | "LegalService"
  | "AccountingService"
  | "Dentist"
  | "MedicalBusiness"
  | "Organization"
  | TodoValue;

export interface SeoConfig {
  defaultTitle: string;
  titleTemplate: string;
  defaultDescription: string;
  keywords: readonly string[];
  primaryActivity: string;
  primaryCity: string;
  geographicArea: string;
  schemaOrgType: SchemaOrgType;
  robots: {
    index: boolean;
    follow: boolean;
    googleBot: {
      index: boolean;
      follow: boolean;
      maxImagePreview: "none" | "standard" | "large";
      maxSnippet: number;
      maxVideoPreview: number;
    };
  };
  openGraph: {
    type: "website";
    locale: string;
    siteName: string;
    defaultImage: string;
  };
  twitter: {
    card: "summary" | "summary_large_image";
    defaultImage: string;
  };
}

export const seoConfig = {
  defaultTitle: siteConfig.name,
  titleTemplate: `%s | ${siteConfig.name}`,
  defaultDescription: businessConfig.shortDescription,
  // TODO_SEO_KEYWORDS: renseigner uniquement si elles apportent une valeur réelle.
  keywords: [],
  primaryActivity: businessConfig.activity,
  primaryCity: businessConfig.address.city,
  geographicArea: businessConfig.serviceArea.primaryArea,
  // TODO_SCHEMA_ORG_TYPE: choisir le sous-type Schema.org le plus précis pour le client.
  schemaOrgType: "LocalBusiness",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      maxImagePreview: "large",
      maxSnippet: -1,
      maxVideoPreview: -1,
    },
  },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    defaultImage: siteConfig.socialImages.openGraph,
  },
  twitter: {
    card: "summary_large_image",
    defaultImage: siteConfig.socialImages.twitter,
  },
} as const satisfies SeoConfig;
