import type { CustomerDetails, OrderLine, OrderStatus } from './order';
export interface SubmitOrderRequest {
  idempotencyKey: string;
  serviceId: string;
  slotId: string;
  date: string;
  village: string;
  lines: OrderLine[];
  customer: CustomerDetails;
  turnstileToken: string;
}
export interface OrderReceipt {
  orderNumber: string;
  lines: OrderLine[];
  status: OrderStatus;
  totalCents: number;
  village: string;
  date: string;
  pickupTime: string;
  expiresAt: string;
}
export interface LivePickupAvailability {
  date: string;
  serverNow: string;
  state: 'available' | 'unavailable';
  reason?: 'closed' | 'finished' | 'disabled';
  minimumLeadMinutes?: number;
  service: { id: string; date: string; village: string; address: string | null; openingTime: string; closingTime: string } | null;
  slots: { id: string; label: string; state: 'available' | 'full' | 'unavailable' }[];
  turnstileSiteKey: string;
}
export interface ApiFailure { error: string; }
