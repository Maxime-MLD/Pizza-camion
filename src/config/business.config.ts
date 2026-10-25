import type { BusinessConfig } from "../types/business.config";

export const businessConfig = {
  tradeName: "TODO_BUSINESS_NAME",
  legalName: "TODO_LEGAL_NAME",
  owner: {
    firstName: "TODO_OWNER_FIRST_NAME",
    lastName: "TODO_OWNER_LAST_NAME",
  },
  activity: "TODO_BUSINESS_ACTIVITY",
  shortDescription: "TODO_BUSINESS_SHORT_DESCRIPTION",
  contact: {
    phoneDisplay: "TODO_PHONE_DISPLAY",
    phoneNormalized: "TODO_PHONE_NORMALIZED",
    email: "TODO_EMAIL",
  },
  address: {
    formatted: "TODO_FULL_ADDRESS",
    street: "TODO_STREET",
    postalCode: "TODO_POSTAL_CODE",
    city: "TODO_CITY",
    region: "TODO_REGION",
    country: "TODO_COUNTRY",
    countryCode: "TODO_COUNTRY_CODE",
    latitude: "TODO_LATITUDE",
    longitude: "TODO_LONGITUDE",
  },
  serviceArea: {
    primaryArea: "TODO_PRIMARY_SERVICE_AREA",
    radius: {
      value: "TODO_SERVICE_RADIUS",
      unit: "km",
    },
    servedCities: ["TODO_SERVED_CITY_1", "TODO_SERVED_CITY_2"],
  },
  openingHours: [
    {
      days: ["TODO_OPENING_DAYS"],
      opens: "TODO_OPENING_TIME",
      closes: "TODO_CLOSING_TIME",
      isClosed: false,
      note: "TODO_OPENING_HOURS_NOTE",
    },
  ],
  socialLinks: [
    {
      platform: "TODO_SOCIAL_PLATFORM",
      label: "TODO_SOCIAL_LABEL",
      url: "TODO_SOCIAL_URL",
    },
  ],
  legalIdentifiers: {
    legalForm: "TODO_LEGAL_FORM",
    soleTrader: {
      enabled: false,
      legalNotice: "TODO_SOLE_TRADER_LEGAL_NOTICE_IF_APPLICABLE",
    },
    siren: "TODO_SIREN",
    siret: "TODO_SIRET",
    vatNumber: "TODO_VAT_NUMBER",
  },
  publicationDirector: "TODO_PUBLICATION_DIRECTOR",
  insurance: {
    enabled: false,
    provider: "TODO_INSURANCE_PROVIDER",
    policyNumber: "TODO_INSURANCE_POLICY_NUMBER",
    professionalCoverage: "TODO_INSURANCE_PROFESSIONAL_COVERAGE",
    geographicCoverage: "TODO_INSURANCE_GEOGRAPHIC_COVERAGE",
  },
  hostingProvider: {
    name: "TODO_HOSTING_PROVIDER_NAME",
    address: "TODO_HOSTING_PROVIDER_ADDRESS",
    phone: "TODO_HOSTING_PROVIDER_PHONE",
    website: "TODO_HOSTING_PROVIDER_URL",
  },
  googleMapsUrl: "TODO_GOOGLE_MAPS_URL",
} as const satisfies BusinessConfig;
