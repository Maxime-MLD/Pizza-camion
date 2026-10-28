export interface PickupAvailabilityConfig {
  timeZone: string;
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
  description: "Choisissez votre heure de retrait au camion aujourd’hui, renseignez vos coordonnées, puis vérifiez votre demande.",
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
    description: "Le retrait se fait uniquement dans le village du jour. La date et le lieu sont fixés automatiquement ; seule l’heure est à choisir.",
    todayLabel: "SERVICE DU JOUR · LIEU DE RETRAIT FIXÉ",
    addressLabel: "Emplacement",
    hoursLabel: "Horaires du service",
    slotLabel: "Heure de retrait souhaitée",
    selectSlot: "Sélectionnez une heure",
    unavailableSlot: "Aucun créneau disponible aujourd’hui",
    closed: "Le camion ne propose pas de service aujourd’hui. Aucune commande ne peut être préparée pour un autre jour depuis ce tunnel.",
    finished: "Le service du jour est terminé. Il n’est plus possible de préparer une commande pour aujourd’hui.",
    noSlots: "Aucun créneau de retrait n’est encore disponible aujourd’hui, compte tenu du délai de préparation et des indisponibilités.",
    dateChanged: "La journée a changé en heure de Paris. Votre ancien créneau a été retiré. Actualisez le service du jour pour recommencer ; votre panier est conservé.",
    nextService: (village: string, date: string, hours: string) => `Prochain passage prévu : ${village}, ${date} · ${hours}. À titre informatif uniquement.`,
    planningLabel: "VOIR LE PLANNING",
    planningHref: "/#village-marquee-title",
    reloadLabel: "ACTUALISER LE SERVICE DU JOUR",
    timeHelp: (minutes: number) => `Horaires en heure de Paris. Un délai minimum de ${minutes} minutes est prévu avant le retrait.`,
    addressPending: "Emplacement exact à confirmer.",
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
    pickup: "Choisissez une heure de retrait disponible pour le service d’aujourd’hui.",
    expired: "Ce créneau n’est plus disponible. Vérifiez le service du jour et choisissez une autre heure si elle est proposée.",
    details: "Vérifiez les champs signalés pour continuer.",
    firstName: "Renseignez un prénom de 1 à 80 caractères.",
    lastName: "Renseignez un nom de 1 à 80 caractères.",
    phone: "Renseignez un numéro français valide à 10 chiffres ou commençant par +33.",
    comment: "Le commentaire doit contenir au maximum 500 caractères.",
    privacyAcknowledged: "Confirmez que vous avez pris connaissance de la politique de confidentialité.",
  },
} as const;
