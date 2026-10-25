export interface LegalConfig {
  notice: {
    intellectualProperty: string;
    liability: string;
    externalLinks: string;
    hostingVerification: string;
  };
  privacy: {
    additionalCollectedData: string;
    purposes: string;
    legalBasis: string;
    retention: string;
    recipients: string;
    web3Forms: string;
    hosting: string;
    rightsExercise: string;
    portability: string;
    cookies: string;
    analytics: string;
    thirdPartyServices: string;
    internationalTransfers: string;
    lastUpdated: string;
  };
}

export const legalConfig = {
  notice: {
    intellectualProperty: "TODO_LEGAL_INTELLECTUAL_PROPERTY_NOTICE",
    liability: "TODO_LEGAL_LIABILITY_NOTICE",
    externalLinks: "TODO_LEGAL_EXTERNAL_LINKS_NOTICE",
    hostingVerification:
      "TODO_LEGAL_VERIFY_HOSTING_PROVIDER_INFORMATION_AT_DELIVERY_INCLUDING_VERCEL",
  },
  privacy: {
    additionalCollectedData: "TODO_PRIVACY_ADDITIONAL_DATA_COLLECTED_IF_ANY",
    purposes: "TODO_PRIVACY_PROCESSING_PURPOSES",
    legalBasis: "TODO_LEGAL_REVIEW_AND_DEFINE_PROCESSING_LEGAL_BASIS",
    retention: "TODO_LEGAL_DEFINE_DATA_RETENTION_PERIODS_OR_CRITERIA",
    recipients: "TODO_PRIVACY_DATA_RECIPIENTS_AND_AUTHORIZED_PERSONS",
    web3Forms:
      "TODO_LEGAL_VERIFY_WEB3FORMS_ROLE_TERMS_DPA_HOSTING_AND_RETENTION_AT_DELIVERY",
    hosting: "TODO_LEGAL_VERIFY_HOSTING_DATA_PROCESSING_AT_DELIVERY",
    rightsExercise: "TODO_PRIVACY_RIGHTS_EXERCISE_PROCEDURE_AND_IDENTITY_CHECKS",
    portability: "TODO_LEGAL_CONFIRM_WHEN_DATA_PORTABILITY_APPLIES",
    cookies: "TODO_LEGAL_COOKIE_AND_TRACKER_AUDIT_BEFORE_PRODUCTION",
    analytics: "TODO_LEGAL_ANALYTICS_CONFIGURATION_AND_CONSENT_REQUIREMENTS_IF_ENABLED",
    thirdPartyServices: "TODO_PRIVACY_LIST_ALL_THIRD_PARTY_SERVICES_AND_PURPOSES",
    internationalTransfers:
      "TODO_LEGAL_VERIFY_INTERNATIONAL_TRANSFERS_AND_SAFEGUARDS_FOR_EACH_PROVIDER",
    lastUpdated: "TODO_PRIVACY_POLICY_LAST_UPDATED_DATE",
  },
} as const satisfies LegalConfig;
