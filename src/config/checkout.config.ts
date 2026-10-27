export interface PickupAvailabilityConfig {
  timeZone: string;
  preorderDays: number;
  slotIntervalMinutes: number;
  minimumLeadMinutes: number;
  /** Aucun retrait dans cette marge avant la fermeture (préparation / fin de service). */
  closingPreparationMinutes: number;
  exceptionalClosures: readonly string[];
  unavailableServiceIds: readonly string[];
  unavailableSlotIds: readonly string[];
}

export const pickupAvailabilityConfig: PickupAvailabilityConfig = {
  timeZone: "Europe/Paris",
  preorderDays: 7,
  slotIntervalMinutes: 15,
  minimumLeadMinutes: 30,
  closingPreparationMinutes: 15,
  // TODO_AVAILABILITY : renseigner les fermetures réelles (YYYY-MM-DD) et indisponibilités avant ouverture.
  exceptionalClosures: [],
  unavailableServiceIds: [],
  unavailableSlotIds: [],
};

export const checkoutConfig = {
  pageTitle: "Préparer ma commande",
  title: "PRÉPARER MA COMMANDE.",
  eyebrow: "VOS PIZZAS, À EMPORTER",
  description: "Choisissez votre retrait, renseignez vos coordonnées, puis vérifiez votre demande.",
  provisionalNotice: "Parcours de démonstration : planning et créneaux provisoires, non garantis par un serveur. Aucune demande ne sera transmise.",
  progressLabel: "Étapes de préparation de la commande",
  steps: ["Retrait", "Coordonnées", "Vérification"],
  loading: "Chargement de votre panier…",
  noScript: "Activez JavaScript pour préparer votre panier. Aucune commande ne peut être envoyée depuis cette page.",
  emptyTitle: "VOTRE PANIER EST VIDE.",
  emptyDescription: "Choisissez au moins une pizza dans La Carte pour préparer votre retrait.",
  menuLink: "DÉCOUVRIR LA CARTE",
  editCart: "Modifier mon panier",
  back: "Retour",
  next: "CONTINUER",
  verify: "VÉRIFIER MA DEMANDE",
  send: "ENVOYER MA DEMANDE DE COMMANDE",
  backendNotice: "L’envoi sera activé après l’intégration du backend. Cette page ne transmet et n’enregistre aucune commande.",
  paymentNotice: "Paiement directement au camion lors du retrait.",
  acceptanceNotice: "Votre commande sera confirmée après acceptation par le pizzaiolo.",
  cartTitle: "VOTRE PANIER",
  totalLabel: "Total indicatif",
  pricePending: "Certains tarifs de votre panier restent à confirmer sur la carte originale.",
  storageUnavailable: "La conservation du panier est bloquée par votre navigateur. Il peut être perdu au changement de page.",
  pickup: {
    title: "QUAND PASSER AU CAMION ?",
    description: "Le village dépend de la date choisie : votre lieu de retrait est fixé automatiquement.",
    datesLabel: "Choisissez votre date de retrait",
    slotLabel: "Heure de retrait souhaitée",
    selectSlot: "Sélectionnez une heure",
    selectDateFirst: "Choisissez d’abord une date",
    noServices: "Aucun créneau provisoire n’est disponible dans la fenêtre de précommande. Consultez le planning et revenez plus tard.",
    timeHelp: (minutes: number) => `Horaires en heure de Paris. Un délai minimum de ${minutes} minutes est prévu avant le retrait.`,
    addressPending: "Emplacement exact à confirmer.",
    locationLabel: "Retrait à",
  },
  details: {
    title: "COMMENT VOUS JOINDRE ?",
    description: "Ces coordonnées restent en mémoire dans cette page. Elles ne sont ni envoyées ni conservées dans le stockage du panier.",
    firstName: "Prénom",
    lastName: "Nom",
    phone: "Téléphone",
    phoneHelp: "Numéro français à 10 chiffres ou au format +33.",
    comment: "Commentaire sur la commande (facultatif)",
    commentHelp: "500 caractères maximum. Les modifications de recette ne sont pas proposées à cette étape.",
    privacyBefore: "J’ai pris connaissance de la",
    privacyLink: "politique de confidentialité",
    privacyAfter: ". Aucun consentement marketing n’est demandé.",
    requiredNote: "Prénom, nom, téléphone et prise de connaissance de la politique sont obligatoires.",
  },
  review: {
    title: "TOUT EST BON ?",
    description: "Vérifiez les informations ci-dessous. Aucune commande n’a encore été envoyée.",
    date: "Date de retrait",
    village: "Village",
    address: "Emplacement",
    slot: "Heure souhaitée",
    name: "Vos coordonnées",
    phone: "Téléphone",
    comment: "Commentaire",
    noComment: "Aucun commentaire.",
  },
  errors: {
    pickup: "Choisissez une date et une heure de retrait disponibles dans la liste provisoire.",
    expired: "Ce créneau n’est plus disponible. Choisissez une nouvelle date ou une nouvelle heure de retrait.",
    details: "Vérifiez les champs signalés pour continuer.",
    firstName: "Renseignez un prénom de 1 à 80 caractères.",
    lastName: "Renseignez un nom de 1 à 80 caractères.",
    phone: "Renseignez un numéro français valide à 10 chiffres ou commençant par +33.",
    comment: "Le commentaire doit contenir au maximum 500 caractères.",
    privacyAcknowledged: "Confirmez que vous avez pris connaissance de la politique de confidentialité.",
  },
} as const;
