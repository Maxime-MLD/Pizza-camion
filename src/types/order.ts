export type OrderStatus = "pending" | "accepted" | "rejected" | "preparing" | "ready" | "completed" | "cancelled";

/** Payload futur : les prix et le village ne proviennent jamais de la demande client. */
export interface OrderLine { pizzaId: string; quantity: number; }
export interface PricedOrderLine extends OrderLine {
  name: string;
  unitPriceCents: number;
  lineTotalCents: number;
  priceConfirmed: boolean;
}
export interface CustomerDetails {
  firstName: string;
  lastName: string;
  phone: string;
  comment: string;
  privacyAcknowledged: boolean;
}
export interface PickupSlot {
  id: string;
  serviceId: string;
  label: string;
  pickupAt: string;
}
export interface PickupService {
  id: string;
  date: string;
  dateLabel: string;
  village: string;
  address: string | null;
  opensAt: string;
  closesAt: string;
  hours: string;
  slots: readonly PickupSlot[];
  availability: "provisional";
}
export interface OrderDraft {
  lines: OrderLine[];
  serviceId: string;
  slotId: string;
  customer: CustomerDetails;
}
/** Contrat préparatoire seulement : aucun envoi ni endpoint n'est implémenté. */
export interface OrderSubmission extends OrderDraft { idempotencyKey: string; }
/** Valeurs canoniques à produire par le futur serveur après validation. */
export interface Order {
  id: string;
  status: OrderStatus;
  createdAt: string;
  lines: PricedOrderLine[];
  totalCents: number;
  service: Omit<PickupService, "slots" | "availability">;
  slot: PickupSlot;
  customer: CustomerDetails;
}
