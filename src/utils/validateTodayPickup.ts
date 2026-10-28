import { pickupAvailabilityConfig, type PickupAvailabilityConfig } from "../config/checkout.config";
import { truckSchedule, type TruckStop } from "../data/truckSchedule";
import { getTodayPickupState } from "./pickupAvailability";
import type { PickupService, PickupSlot } from "../types/order";

export type TodayPickupValidation =
  | { ok: true; service: PickupService; slot: PickupSlot }
  | { ok: false; reason: "invalid_request" | "closed" | "wrong_date" | "wrong_service" | "wrong_village" | "unavailable_slot" };

/** Préparé pour un futur appel serveur avec son horloge et son planning canoniques.
 * L'appel navigateur reste provisoire et ne remplace pas cette validation serveur.
 * La date et le village éventuellement reçus sont seulement comparés, jamais utilisés comme source.
 */
export function validateTodayPickupRequest(
  input: unknown,
  now: Date,
  rules: PickupAvailabilityConfig = pickupAvailabilityConfig,
  schedule: readonly TruckStop[] = truckSchedule,
): TodayPickupValidation {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, reason: "invalid_request" };
  const request = input as Record<string, unknown>;
  if (typeof request.serviceId !== "string" || typeof request.slotId !== "string") return { ok: false, reason: "invalid_request" };
  const state = getTodayPickupState(now, rules, schedule);
  if (request.date !== undefined && request.date !== state.date) return { ok: false, reason: "wrong_date" };
  if (state.status !== "available" || !state.service) return { ok: false, reason: "closed" };
  if (request.serviceId !== state.service.id) return { ok: false, reason: "wrong_service" };
  if (request.village !== undefined && request.village !== state.service.village) return { ok: false, reason: "wrong_village" };
  const slot = state.service.slots.find((item) => item.id === request.slotId);
  if (!slot) return { ok: false, reason: "unavailable_slot" };
  return { ok: true, service: state.service, slot };
}
