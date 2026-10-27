export const orderSteps = [
  {
    id: "commande",
    number: "01",
    titleLineOne: "JE COMMANDE",
    titleLineTwo: "EN LIGNE.",
    description: "Je choisis mes pizzas, mon heure de retrait et j’envoie ma commande en quelques clics.",
    accent: "saffron",
  },
  {
    id: "preparation",
    number: "02",
    titleLineOne: "JE PRÉPARE",
    titleLineTwo: "VOTRE COMMANDE.",
    description: "Je reçois votre demande et je prépare vos pizzas pour qu’elles soient prêtes au bon moment.",
    accent: "tomato",
  },
  {
    id: "retrait",
    number: "03",
    titleLineOne: "JE RÉCUPÈRE",
    titleLineTwo: "ET JE PAIE.",
    description: "Je passe au camion à l’heure prévue, je récupère ma commande et je règle directement sur place.",
    accent: "basil",
  },
] as const;
