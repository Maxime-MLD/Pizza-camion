export interface FormFieldConfig {
  enabled: boolean;
  required: boolean;
}

export interface ContactFormConfig {
  fields: {
    firstName: FormFieldConfig;
    lastName: FormFieldConfig;
    phone: FormFieldConfig;
    email: FormFieldConfig;
    service: FormFieldConfig;
    message: FormFieldConfig;
    consent: FormFieldConfig;
  };
  subject: string;
  successPath: string;
  labels: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    service: string;
    servicePlaceholder: string;
    otherService: string;
    message: string;
    consentText: string;
    privacyPolicy: string;
    submit: string;
    loading: string;
    requiredHint: string;
  };
  messages: {
    validation: string;
    captcha: string;
    loading: string;
    success: string;
    error: string;
    configuration: string;
  };
}

export const contactFormConfig = {
  fields: {
    firstName: { enabled: true, required: true },
    lastName: { enabled: true, required: true },
    phone: { enabled: true, required: false },
    email: { enabled: true, required: true },
    service: { enabled: true, required: true },
    message: { enabled: true, required: true },
    consent: { enabled: true, required: true },
  },
  subject: "TODO_CONTACT_FORM_EMAIL_SUBJECT",
  successPath: "/merci/",
  labels: {
    firstName: "Prénom",
    lastName: "Nom",
    phone: "Téléphone",
    email: "E-mail",
    service: "Service ou type de demande",
    servicePlaceholder: "Sélectionnez une option",
    otherService: "TODO_FORM_OTHER_REQUEST_LABEL",
    message: "Message",
    consentText: "TODO_FORM_PRIVACY_CONSENT_TEXT",
    privacyPolicy: "politique de confidentialité",
    submit: "Envoyer la demande",
    loading: "Envoi en cours…",
    requiredHint: "Les champs marqués d’un astérisque sont obligatoires.",
  },
  messages: {
    validation: "Vérifiez les champs signalés avant de continuer.",
    captcha: "Veuillez confirmer que vous n’êtes pas un robot.",
    loading: "Votre demande est en cours d’envoi.",
    success: "Votre demande a bien été envoyée. Redirection en cours…",
    error: "L’envoi a échoué. Réessayez dans quelques instants ou utilisez les coordonnées de contact.",
    configuration:
      "Configuration développeur incomplète : ajoutez PUBLIC_WEB3FORMS_ACCESS_KEY dans le fichier .env puis relancez le serveur.",
  },
} as const satisfies ContactFormConfig;
