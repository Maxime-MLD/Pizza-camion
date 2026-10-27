export const footerConfig = {
  description: "Des pizzas maison, de village en village. Préparées avec passion, à savourer sans modération.",
  navigationTitle: "NAVIGATION",
  navigationLabel: "Navigation de pied de page",
  contactTitle: "CONTACT",
  contactNote: "Retrouvez le camion dans votre village",
  socialLabel: "Réseaux sociaux de FORNO.",
  homeLabel: "FORNO. — retour à l’accueil",
  legalLabel: "Informations légales",
  copyright: "Tous droits réservés.",
  navigation: [
    { label: "Accueil", href: "/#hero" },
    { label: "La carte", href: "/#la-carte" },
    { label: "Où nous trouver", href: "/#village-marquee-title" },
    { label: "À propos", href: "/#a-propos" },
    { label: "Comment ça marche", href: "/#comment-ca-marche" },
  ],
  legalLinks: [
    { label: "Mentions légales", href: "/mentions-legales/" },
    { label: "Politique de confidentialité", href: "/politique-confidentialite/" },
  ],
} as const;
