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

export function getPickupServices(
  now: Date,
  rules: PickupAvailabilityConfig = pickupAvailabilityConfig,
  schedule: readonly TruckStop[] = truckSchedule,
): PickupService[] {
  // Le fuseau du métier reste explicitement Paris ; une configuration incohérente ne produit aucun créneau.
  if (
    rules.timeZone !== "Europe/Paris" || !Number.isFinite(now.getTime()) ||
    ![rules.preorderDays, rules.slotIntervalMinutes, rules.minimumLeadMinutes, rules.closingPreparationMinutes].every(Number.isInteger) ||
    rules.preorderDays < 1 || rules.preorderDays > 60 || rules.slotIntervalMinutes < 1 ||
    rules.minimumLeadMinutes < 0 || rules.closingPreparationMinutes < 0
  ) return [];
  const services: PickupService[] = [];
  const today = parisDateKey(now);
  for (let dayOffset = 0; dayOffset < rules.preorderDays; dayOffset++) {
    const date = addCalendarDays(today, dayOffset);
    if (rules.exceptionalClosures.includes(date)) continue;
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const stop = schedule.find((item) => item.day === weekday);
    if (!stop || stop.status === "closed" || !stop.village || !stop.opens || !stop.closes) continue;
    const serviceId = `forno-${date}-${weekday}`;
    if (rules.unavailableServiceIds.includes(serviceId)) continue;
    const open = parisLocalToInstant(date, stop.opens);
    const close = parisLocalToInstant(date, stop.closes);
    if (!open || !close || open >= close) continue;
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
    if (!slots.length) continue;
    services.push({
      id: serviceId, date,
      dateLabel: new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: rules.timeZone }).format(new Date(`${date}T12:00:00Z`)),
      village: stop.village,
      address: stop.address && isConfiguredLinkValue(stop.address) ? stop.address : null,
      opensAt: open.toISOString(), closesAt: close.toISOString(),
      hours: stop.hours ?? `${stop.opens.replace(":", "h")} – ${stop.closes.replace(":", "h")}`,
      slots, availability: "provisional",
    });
  }
  return services;
}

export function findPickup(services: readonly PickupService[], serviceId: string, slotId: string): { service: PickupService; slot: PickupSlot } | null {
  const service = services.find((item) => item.id === serviceId);
  const slot = service?.slots.find((item) => item.id === slotId);
  return service && slot ? { service, slot } : null;
}
