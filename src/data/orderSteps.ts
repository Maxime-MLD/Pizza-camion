export const orderSteps = [
  {
    id: "commande",
    number: "1.",
    titleLineOne: "JE COMMANDE",
    titleLineTwo: "EN LIGNE.",
    description: "Je choisis mes pizzas, sélectionne mon heure de retrait et envoie ma commande en quelques clics.",
    icon: "basket",
    accent: "saffron",
  },
  {
    id: "retrait",
    number: "2.",
    titleLineOne: "JE RÉCUPÈRE",
    titleLineTwo: "ET JE PAIE.",
    description: "Une fois ma commande confirmée, je passe au camion à l'heure prévue et je règle directement sur place.",
    icon: "truck",
    accent: "tomato",
  },
] as const;
