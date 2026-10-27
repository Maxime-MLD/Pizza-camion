import pizzaVisual from "../assets/forno-pizza-temporary.jpg";

export type ServiceStatus = "planned" | "closed";

export interface TruckStop {
  day: number;
  dayLabel: string;
  village: string | null;
  hours: string | null;
  opens: string | null;
  closes: string | null;
  address: string | null;
  image: typeof pizzaVisual | null;
  status: ServiceStatus;
}

/** Planning fictif pour la maquette. Remplacer horaires et emplacements avant mise en service. */
export const truckSchedule: readonly TruckStop[] = [
  { day: 1, dayLabel: "Lundi", village: "Le Coteau", hours: "18h00 – 21h30", opens: "18:00", closes: "21:30", address: "TODO_ADRESSE_LE_COTEAU", image: pizzaVisual, status: "planned" },
  { day: 2, dayLabel: "Mardi", village: "Vougy", hours: "18h00 – 21h30", opens: "18:00", closes: "21:30", address: "TODO_ADRESSE_VOUGY", image: pizzaVisual, status: "planned" },
  { day: 3, dayLabel: "Mercredi", village: "Mably", hours: "18h00 – 21h30", opens: "18:00", closes: "21:30", address: "TODO_ADRESSE_MABLY", image: pizzaVisual, status: "planned" },
  { day: 4, dayLabel: "Jeudi", village: "Renaison", hours: "18h00 – 21h30", opens: "18:00", closes: "21:30", address: "TODO_ADRESSE_RENAISON", image: pizzaVisual, status: "planned" },
  { day: 5, dayLabel: "Vendredi", village: "Riorges", hours: "18h00 – 22h00", opens: "18:00", closes: "22:00", address: "TODO_ADRESSE_RIORGES", image: pizzaVisual, status: "planned" },
  { day: 6, dayLabel: "Samedi", village: "Charlieu", hours: "18h00 – 22h00", opens: "18:00", closes: "22:00", address: "TODO_ADRESSE_CHARLIEU", image: pizzaVisual, status: "planned" },
  { day: 0, dayLabel: "Dimanche", village: null, hours: null, opens: null, closes: null, address: null, image: null, status: "closed" },
];
