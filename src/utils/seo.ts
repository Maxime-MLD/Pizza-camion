import { businessConfig } from "../config/business.config";
import { seoConfig } from "../config/seo.config";
import { siteConfig } from "../config/site.config";
import type {
  BreadcrumbItem,
  JsonLdObject,
  JsonLdValue,
  PageSeoProps,
  ResolvedSeo,
} from "../types/seo";
import { isPlaceholderValue } from "./placeholders";

const weekdaySchemaUrls: Readonly<Record<string, string>> = {
  monday: "https://schema.org/Monday",
  tuesday: "https://schema.org/Tuesday",
  wednesday: "https://schema.org/Wednesday",
  thursday: "https://schema.org/Thursday",
  friday: "https://schema.org/Friday",
  saturday: "https://schema.org/Saturday",
  sunday: "https://schema.org/Sunday",
};

export function isUsableSeoValue(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !isPlaceholderValue(value)
  );
}

export function toAbsoluteUrl(value: string, base = siteConfig.canonicalUrl): string {
  return new URL(value, ensureTrailingSlash(base)).href;
}

function toOptionalAbsoluteUrl(value: string): string | undefined {
  return isUsableSeoValue(value) ? toAbsoluteUrl(value) : undefined;
}

export function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

export function normalizePagePath(pathname: string): string {
  const cleanPath = pathname.split(/[?#]/, 1)[0] ?? "/";
  if (cleanPath === "/") return "/";
  return `/${cleanPath.replace(/^\/+|\/+$/g, "")}/`;
}

export function resolveCanonicalUrl(canonical: string | undefined, pathname: string): string {
  if (canonical?.trim()) {
    const url = new URL(canonical, ensureTrailingSlash(siteConfig.canonicalUrl));
    url.hash = "";
    url.search = "";
    return url.href;
  }

  return new URL(normalizePagePath(pathname), ensureTrailingSlash(siteConfig.canonicalUrl)).href;
}

export function resolveSeoTitle(title?: string): string {
  const pageTitle = title?.trim() || seoConfig.defaultTitle;
  const siteName = siteConfig.name.trim();

  if (
    pageTitle === seoConfig.defaultTitle ||
    pageTitle === siteName ||
    pageTitle.toLowerCase().includes(siteName.toLowerCase())
  ) {
    return pageTitle;
  }

  return seoConfig.titleTemplate.replace("%s", pageTitle);
}

function resolveRobots(noindex = false, nofollow = false): string {
  const index = noindex ? false : seoConfig.robots.index;
  const follow = nofollow ? false : seoConfig.robots.follow;
  return `${index ? "index" : "noindex"}, ${follow ? "follow" : "nofollow"}`;
}

function resolveGoogleBot(noindex = false, nofollow = false): string {
  const config = seoConfig.robots.googleBot;
  const directives = [
    noindex || !config.index ? "noindex" : "index",
    nofollow || !config.follow ? "nofollow" : "follow",
    `max-image-preview:${config.maxImagePreview}`,
    `max-snippet:${config.maxSnippet}`,
    `max-video-preview:${config.maxVideoPreview}`,
  ];

  return directives.join(", ");
}

export function resolveSeo(props: PageSeoProps, pathname: string): ResolvedSeo {
  return {
    title: resolveSeoTitle(props.title),
    description: props.description?.trim() || seoConfig.defaultDescription,
    canonical: resolveCanonicalUrl(props.canonical, pathname),
    image: toAbsoluteUrl(props.image || seoConfig.openGraph.defaultImage),
    twitterImage: toAbsoluteUrl(props.image || seoConfig.twitter.defaultImage),
    type: props.type ?? seoConfig.openGraph.type,
    robots: resolveRobots(props.noindex, props.nofollow),
    googleBot: resolveGoogleBot(props.noindex, props.nofollow),
  };
}

function cleanJsonLdValue(value: JsonLdValue | undefined): JsonLdValue | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    return isUsableSeoValue(value) ? value.trim() : undefined;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    const cleanedItems = value
      .map((item) => cleanJsonLdValue(item))
      .filter((item): item is JsonLdValue => item !== undefined);
    return cleanedItems.length > 0 ? cleanedItems : undefined;
  }

  const cleanedEntries = Object.entries(value)
    .map(([key, item]) => [key, cleanJsonLdValue(item)] as const)
    .filter((entry): entry is readonly [string, JsonLdValue] => entry[1] !== undefined);

  return cleanedEntries.length > 0 ? Object.fromEntries(cleanedEntries) : undefined;
}

export function cleanJsonLd<T extends JsonLdObject>(value: T): JsonLdObject {
  return (cleanJsonLdValue(value) ?? {}) as JsonLdObject;
}

function getSchemaId(fragment: string): string | undefined {
  if (!isUsableSeoValue(siteConfig.canonicalUrl)) return undefined;
  return `${ensureTrailingSlash(siteConfig.canonicalUrl)}#${fragment}`;
}

function getOpeningHoursSchema(): readonly JsonLdObject[] | undefined {
  const periods = businessConfig.openingHours.flatMap((period) => {
    if (period.isClosed || !isUsableSeoValue(period.opens) || !isUsableSeoValue(period.closes)) {
      return [];
    }

    const days: string[] = [];
    for (const day of period.days) {
      if (isUsableSeoValue(day) && day in weekdaySchemaUrls) {
        const schemaDay = weekdaySchemaUrls[day];
        if (schemaDay) days.push(schemaDay);
      }
    }

    if (days.length === 0) return [];

    return [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: days,
        opens: period.opens,
        closes: period.closes,
      } satisfies JsonLdObject,
    ];
  });

  return periods.length > 0 ? periods : undefined;
}

function getAreaServedSchema(): readonly JsonLdObject[] | undefined {
  const areaNames = [
    businessConfig.serviceArea.primaryArea,
    ...businessConfig.serviceArea.servedCities,
  ].filter(isUsableSeoValue);
  const uniqueAreas = [...new Set(areaNames)];

  const areas: JsonLdObject[] = uniqueAreas.map((name) => ({
    "@type": "AdministrativeArea",
    name,
  }));
  const geo = getGeoSchema();
  const radius = businessConfig.serviceArea.radius.value;
  if (geo && typeof radius === "number" && Number.isFinite(radius)) {
    areas.push({
      "@type": "GeoCircle",
      geoMidpoint: geo,
      geoRadius: businessConfig.serviceArea.radius.unit === "km" ? radius * 1000 : radius,
    });
  }

  return areas.length > 0 ? areas : undefined;
}

function getGeoSchema(): JsonLdObject | undefined {
  const { latitude, longitude } = businessConfig.address;
  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude)
  ) {
    return undefined;
  }

  return {
    "@type": "GeoCoordinates",
    latitude,
    longitude,
  };
}

export function buildWebSiteSchema(): JsonLdObject {
  const businessId = getSchemaId("business");
  return cleanJsonLd({
    "@type": "WebSite",
    "@id": getSchemaId("website"),
    url: siteConfig.canonicalUrl,
    name: siteConfig.name,
    description: seoConfig.defaultDescription,
    inLanguage: siteConfig.language,
    publisher: businessId ? { "@id": businessId } : undefined,
  });
}

function getAddressSchema(): JsonLdObject | undefined {
  const address = businessConfig.address;
  const hasAddress = [
    address.street,
    address.postalCode,
    address.city,
    address.region,
    address.countryCode,
  ].some(isUsableSeoValue);

  if (!hasAddress) return undefined;

  return {
    "@type": "PostalAddress",
    streetAddress: address.street,
    postalCode: address.postalCode,
    addressLocality: address.city,
    addressRegion: address.region,
    addressCountry: address.countryCode,
  };
}

export function buildBusinessSchema(): JsonLdObject {
  const schemaType = isUsableSeoValue(seoConfig.schemaOrgType)
    ? seoConfig.schemaOrgType
    : "LocalBusiness";
  const socialUrls = businessConfig.socialLinks
    .map((socialLink) => socialLink.url)
    .filter(isUsableSeoValue);

  return cleanJsonLd({
    "@type": schemaType,
    "@id": getSchemaId("business"),
    name: businessConfig.tradeName,
    legalName: businessConfig.legalName,
    url: siteConfig.canonicalUrl,
    logo: toOptionalAbsoluteUrl(siteConfig.logo),
    image: toOptionalAbsoluteUrl(siteConfig.socialImages.openGraph),
    description: businessConfig.shortDescription,
    telephone: businessConfig.contact.phoneNormalized,
    email: businessConfig.contact.email,
    address: getAddressSchema(),
    geo: getGeoSchema(),
    openingHoursSpecification: getOpeningHoursSchema(),
    areaServed: getAreaServedSchema(),
    sameAs: socialUrls,
    knowsAbout: businessConfig.activity,
  });
}

export function buildWebPageSchema(
  resolvedSeo: ResolvedSeo,
  pathname: string,
): JsonLdObject {
  const canonicalIsUsable = isUsableSeoValue(resolvedSeo.canonical);
  return cleanJsonLd({
    "@type": pathname === "/contact" || pathname === "/contact/" ? "ContactPage" : "WebPage",
    "@id": canonicalIsUsable ? `${resolvedSeo.canonical}#webpage` : undefined,
    url: resolvedSeo.canonical,
    name: resolvedSeo.title,
    description: resolvedSeo.description,
    inLanguage: siteConfig.language,
    isPartOf: getSchemaId("website") ? { "@id": getSchemaId("website") } : undefined,
    about: getSchemaId("business") ? { "@id": getSchemaId("business") } : undefined,
    primaryImageOfPage: isUsableSeoValue(resolvedSeo.image)
      ? {
          "@type": "ImageObject",
          url: resolvedSeo.image,
        }
      : undefined,
  });
}

export function buildBreadcrumbSchema(
  breadcrumbs: readonly BreadcrumbItem[],
): JsonLdObject | undefined {
  const validBreadcrumbs = breadcrumbs.filter(
    (item) => isUsableSeoValue(item.name) && isUsableSeoValue(item.url),
  );
  const items = validBreadcrumbs.map(
    (item, index) =>
      ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: toAbsoluteUrl(item.url),
      }) satisfies JsonLdObject,
  );

  if (items.length < 2) return undefined;

  return cleanJsonLd({
    "@type": "BreadcrumbList",
    itemListElement: items,
  });
}

export function buildSeoGraph(
  resolvedSeo: ResolvedSeo,
  pathname: string,
  breadcrumbs: readonly BreadcrumbItem[] = [],
): JsonLdObject {
  const graph: JsonLdObject[] = [
    buildWebSiteSchema(),
    buildBusinessSchema(),
    buildWebPageSchema(resolvedSeo, pathname),
  ];
  const breadcrumbSchema = buildBreadcrumbSchema(breadcrumbs);
  if (breadcrumbSchema) graph.push(breadcrumbSchema);

  return cleanJsonLd({
    "@context": "https://schema.org",
    "@graph": graph,
  });
}

export function serializeJsonLd(value: JsonLdObject): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
