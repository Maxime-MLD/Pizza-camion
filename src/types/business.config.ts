type PlaceholderWord = "TODO";

export type TodoValue = `${PlaceholderWord}_${string}`;
export type ValueOrTodo<T> = T | TodoValue;

export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type SocialPlatform =
  | "facebook"
  | "instagram"
  | "linkedin"
  | "youtube"
  | "x"
  | "pinterest"
  | "tiktok"
  | "other";

export interface BusinessAddress {
  formatted: string;
  street: string;
  postalCode: string;
  city: string;
  region: string;
  country: string;
  countryCode: string;
  latitude: ValueOrTodo<number>;
  longitude: ValueOrTodo<number>;
}

export interface OpeningPeriod {
  days: readonly (Weekday | TodoValue)[];
  opens: string;
  closes: string;
  isClosed: boolean;
  note?: string;
}

export interface SocialLink {
  platform: SocialPlatform | TodoValue;
  label: string;
  url: string;
}

export interface InsuranceInformation {
  enabled: boolean;
  provider: string;
  policyNumber: string;
  professionalCoverage: string;
  geographicCoverage: string;
}

export interface HostingProvider {
  name: string;
  address: string;
  phone: string;
  website: string;
}

export interface BusinessConfig {
  tradeName: string;
  legalName: string;
  owner: {
    firstName: string;
    lastName: string;
  };
  activity: string;
  shortDescription: string;
  contact: {
    phoneDisplay: string;
    phoneNormalized: string;
    email: string;
  };
  address: BusinessAddress;
  serviceArea: {
    primaryArea: string;
    radius: {
      value: ValueOrTodo<number>;
      unit: "km";
    };
    servedCities: readonly string[];
  };
  openingHours: readonly OpeningPeriod[];
  socialLinks: readonly SocialLink[];
  legalIdentifiers: {
    legalForm: string;
    soleTrader: {
      enabled: boolean;
      legalNotice: string;
    };
    siren: string;
    siret: string;
    vatNumber: string;
  };
  publicationDirector: string;
  insurance: InsuranceInformation;
  hostingProvider: HostingProvider;
  googleMapsUrl: string;
}
