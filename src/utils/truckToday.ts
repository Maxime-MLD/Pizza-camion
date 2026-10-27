import { truckSchedule, type TruckStop } from "../data/truckSchedule";

export interface TodayDisplay {
  stop: TruckStop;
  nextStop: TruckStop;
  isOpen: boolean;
  isClosedDay: boolean;
  isPastService: boolean;
  badge: string;
  meta: string;
  headingTop: string;
  headingMiddle: string;
  headingPlace: string;
  navStatus: string;
  location: string;
  hours: string;
}

function timeToMinutes(value: string): number {
  const [hours = 0, minutes = 0] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function getTodayDisplay(now: Date): TodayDisplay {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris", weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const day = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf((values.weekday ?? "").toLowerCase());
  const stop = truckSchedule.find((item) => item.day === day) ?? truckSchedule[0]!;
  const currentMinutes = Number(values.hour ?? 0) * 60 + Number(values.minute ?? 0);
  const isClosedDay = stop.status === "closed";
  const isPastService = !isClosedDay && currentMinutes >= timeToMinutes(stop.closes!);
  const isOpen = !isClosedDay && currentMinutes >= timeToMinutes(stop.opens!) && !isPastService;
  const nextStop = Array.from({ length: 7 }, (_, offset) => truckSchedule.find((item) => item.day === (day + offset + 1) % 7))
    .find((item): item is TruckStop => !!item && item.status === "planned") ?? stop;
  const future = isClosedDay || isPastService;
  return {
    stop,
    nextStop,
    isOpen,
    isClosedDay,
    isPastService,
    badge: future ? "🚚 Aujourd’hui, le camion est fermé" : `🚚 Aujourd’hui je suis à ${stop.village}`,
    meta: future ? `${nextStop.dayLabel} • ${nextStop.hours}` : `${stop.dayLabel} • ${stop.hours}`,
    headingTop: future ? "LE FOUR" : "CE SOIR,",
    headingMiddle: future ? "REPREND À" : "C’EST PIZZA À",
    headingPlace: `${future ? nextStop.village : stop.village}.`.toLocaleUpperCase("fr-FR"),
    navStatus: future ? `Prochain arrêt : ${nextStop.village}` : `Aujourd’hui : ${stop.village}`,
    location: future ? `Prochain arrêt · ${nextStop.village}` : `${stop.village} · emplacement à confirmer`,
    hours: future ? nextStop.hours ?? "" : stop.hours ?? "",
  };
}
