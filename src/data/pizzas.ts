export interface Pizza {
  id: string;
  name: string;
  ingredients: string;
  priceCents: number;
  priceConfirmed: boolean;
  imageFile: string;
}

// Les identifiants restent stables pour les lignes du panier, même si le nom affiché évolue.
export const pizzas: readonly Pizza[] = [
  { id: "capri", name: "Capri", ingredients: "Tomate, épaule, mozzarella", priceCents: 1000, priceConfirmed: true, imageFile: "capri.webp" },
  { id: "maestro", name: "Maestro", ingredients: "Tomate, épaule, champignons, mozzarella", priceCents: 1100, priceConfirmed: true, imageFile: "maestro.webp" },
  { id: "biquette", name: "Biquette", ingredients: "Crème, chèvre, mozzarella, miel", priceCents: 1100, priceConfirmed: true, imageFile: "biquette.webp" },
  { id: "pecheur", name: "Pêcheur", ingredients: "Tomate, thon, crème, mozzarella", priceCents: 1100, priceConfirmed: true, imageFile: "pecheur.webp" },
  { id: "fromagio", name: "Fromagio", ingredients: "Tomate, chèvre, bleu, mozzarella", priceCents: 1200, priceConfirmed: true, imageFile: "fromagio.webp" },
  { id: "mexico", name: "Mexico", ingredients: "Tomate, bœuf haché, poivrons, mozzarella", priceCents: 1200, priceConfirmed: true, imageFile: "mexico.webp" },
  { id: "bolognaise", name: "Bolognaise", ingredients: "Tomate, bœuf haché, chorizo, merguez, oignons, mozzarella", priceCents: 1200, priceConfirmed: true, imageFile: "bolognaise.webp" },
  { id: "savoyarde", name: "Savoyarde", ingredients: "Crème, pommes de terre, lardons, reblochon, mozzarella", priceCents: 1200, priceConfirmed: true, imageFile: "savoyarde.webp" },
  { id: "campagnarde", name: "Campagnarde", ingredients: "Crème, andouillette, oignons, lardons, mozzarella", priceCents: 1200, priceConfirmed: true, imageFile: "campagnarde.webp" },
  { id: "montagnarde", name: "Montagnarde", ingredients: "Crème, pommes de terre, lardons, raclette, mozzarella", priceCents: 1200, priceConfirmed: false, imageFile: "montagnarde.webp" },
  { id: "norvegienne", name: "Norvégienne", ingredients: "Crème, saumon, aneth, mozzarella", priceCents: 1300, priceConfirmed: false, imageFile: "norvegienne.webp" },
  { id: "vegetarienne", name: "Végétarienne", ingredients: "Tomate, poivrons, oignons, champignons, mozzarella", priceCents: 1200, priceConfirmed: true, imageFile: "vegetarienne.webp" },
  { id: "royale", name: "Royale", ingredients: "Tomate, chèvre, jambon cru, mozzarella", priceCents: 1200, priceConfirmed: true, imageFile: "royale.webp" },
];

export const pizzaById = new Map(pizzas.map((pizza) => [pizza.id, pizza]));

// Préparation des futurs changements : aucune option n'est proposée avant validation de la carte.
export const pizzaCustomization = {
  supplementPriceCents: 100,
  enabled: false,
  availableOptions: [] as readonly string[],
} as const;
