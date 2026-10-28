import { pickupAvailabilityConfig, type PickupAvailabilityConfig } from "../config/checkout.config";
import { truckSchedule, type TruckStop } from "../data/truckSchedule";
import type { PickupService, PickupSlot } from "../types/order";
import { isConfiguredLinkValue } from "./links";

const parisFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
function partsAt(date: Date): Record<string, string> {
  return Object.fromEntries(parisFormatter.formatToParts(date).map(({ type, value }) => [type, value]));
}
export function parisDateKey(date: Date): string {
  const p = partsAt(date);
  return `${p.year}-${p.month}-${p.day}`;
}
export function addCalendarDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
function wallTimestamp(p: Record<string, string>): number {
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
}
/** Conversion civile Paris -> UTC sans dépendre du fuseau du navigateur.
 * Les heures inexistantes ou ambiguës au changement d'heure sont exclues.
 */
export function parisLocalToInstant(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const nominal = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(nominal)) return null;
  const offsets = new Set<number>();
  for (const hours of [-36, 0, 36]) {
    const epoch = nominal + hours * 3_600_000;
    offsets.add(wallTimestamp(partsAt(new Date(epoch))) - epoch);
  }
  const candidates = [...offsets].map((offset) => new Date(nominal - offset)).filter((candidate) => {
    const p = partsAt(candidate);
    return `${p.year}-${p.month}-${p.day}` === date && `${p.hour}:${p.minute}` === time;
  });
  return candidates.length === 1 ? candidates[0]! : null;
}
const minutes = (time: string): number => { const [h, m] = time.split(":").map(Number); return h! * 60 + m!; };
const clock = (value: number): string => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

function createServiceForDate(
  date: string,
  now: Date,
  rules: PickupAvailabilityConfig,
  schedule: readonly TruckStop[],
): PickupService | null {
  if (rules.exceptionalClosures.includes(date)) return null;
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const stop = schedule.find((item) => item.day === weekday);
  if (!stop || stop.status === "closed" || !stop.village || !stop.opens || !stop.closes) return null;
  const serviceId = `forno-${date}-${weekday}`;
  if (rules.unavailableServiceIds.includes(serviceId)) return null;
  const open = parisLocalToInstant(date, stop.opens);
  const close = parisLocalToInstant(date, stop.closes);
  if (!open || !close || open >= close) return null;
  const lastPickup = minutes(stop.closes) - rules.closingPreparationMinutes;
  const earliest = now.getTime() + rules.minimumLeadMinutes * 60_000;
  const slots: PickupSlot[] = [];
  for (let value = minutes(stop.opens); value <= lastPickup; value += rules.slotIntervalMinutes) {
    const time = clock(value);
    const pickup = parisLocalToInstant(date, time);
    const id = `${serviceId}@${time}`;
    if (!pickup || pickup.getTime() < earliest || rules.unavailableSlotIds.includes(id)) continue;
    slots.push({ id, serviceId, label: time.replace(":", "h"), pickupAt: pickup.toISOString() });
  }
  return {
    id: serviceId, date,
    dateLabel: new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: rules.timeZone }).format(new Date(`${date}T12:00:00Z`)),
    village: stop.village,
    address: stop.address && isConfiguredLinkValue(stop.address) ? stop.address : null,
    opensAt: open.toISOString(), closesAt: close.toISOString(),
    hours: stop.hours ?? `${stop.opens.replace(":", "h")} – ${stop.closes.replace(":", "h")}`,
    slots, availability: "provisional",
  };
}

export interface TodayPickupState {
  date: string;
  dateLabel: string;
  status: "available" | "closed" | "finished" | "unavailable";
  service: PickupService | null;
  /** Information seule : aucun créneau ou identifiant de commande d'un autre jour n'est exposé. */
  nextService: Pick<PickupService, "dateLabel" | "village" | "hours"> | null;
}

function validRules(now: Date, rules: PickupAvailabilityConfig): boolean {
  return rules.timeZone === "Europe/Paris" && Number.isFinite(now.getTime()) &&
    [rules.slotIntervalMinutes, rules.minimumLeadMinutes, rules.closingPreparationMinutes].every(Number.isInteger) &&
    rules.slotIntervalMinutes > 0 && rules.minimumLeadMinutes >= 0 && rules.closingPreparationMinutes >= 0;
}

export function getTodayPickupState(
  now: Date,
  rules: PickupAvailabilityConfig = pickupAvailabilityConfig,
  schedule: readonly TruckStop[] = truckSchedule,
): TodayPickupState {
  if (!validRules(now, rules)) return { date: "", dateLabel: "", status: "unavailable", service: null, nextService: null };
  const date = parisDateKey(now);
  const dateLabel = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: rules.timeZone }).format(now);
  const service = createServiceForDate(date, now, rules, schedule);
  const status = !service ? "closed" : now.getTime() >= Date.parse(service.closesAt) ? "finished" : service.slots.length ? "available" : "unavailable";
  let nextService: TodayPickupState["nextService"] = null;
  if (status !== "available") {
    // Recherche informative uniquement ; elle n'élargit jamais les dates autorisées.
    for (let offset = 1; offset <= 14; offset++) {
      const next = createServiceForDate(addCalendarDays(date, offset), now, rules, schedule);
      if (!next?.slots.length) continue;
      nextService = { dateLabel: next.dateLabel, village: next.village, hours: next.hours };
      break;
    }
  }
  return { date, dateLabel, status, service, nextService };
}

/** Le tunnel ne transfère jamais une préparation déjà ouverte vers une nouvelle journée. */
export function getCheckoutPickupState(now: Date, openedDate: string) {
  const state = getTodayPickupState(now);
  const dateChanged = state.date !== openedDate;
  return { ...state, dateChanged, canChooseSlot: !dateChanged && state.status === "available" };
}

/** API de compatibilité : zéro ou un service, strictement celui d'aujourd'hui. */
export function getPickupServices(
  now: Date,
  rules: PickupAvailabilityConfig = pickupAvailabilityConfig,
  schedule: readonly TruckStop[] = truckSchedule,
): PickupService[] {
  const state = getTodayPickupState(now, rules, schedule);
  return state.status === "available" && state.service ? [state.service] : [];
}
