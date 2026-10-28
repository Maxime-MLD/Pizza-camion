import test from "node:test";
import assert from "node:assert/strict";
import { pickupAvailabilityConfig as defaults } from "../src/config/checkout.config";
import { truckSchedule } from "../src/data/truckSchedule";
import { addCalendarDays, getCheckoutPickupState, getTodayPickupState, getPickupServices, parisDateKey, parisLocalToInstant } from "../src/utils/pickupAvailability";
import { validateTodayPickupRequest } from "../src/utils/validateTodayPickup";
import { getTodayDisplay } from "../src/utils/truckToday";
import { normalizeFrenchPhone, validateCustomer } from "../src/utils/orderValidation";
import { getCartCount, getCartLines, getCartTotalCents, sanitizeCart, setCartQuantity } from "../src/utils/pizzaCart";

test("le panier conservé est filtré et borné ; seuls les prix du catalogue sont utilisés", () => {
  assert.deepEqual(sanitizeCart({ capri: 2, maestro: 1, fake: 3, biquette: -1, mexico: 1.5 }), { capri: 2, maestro: 1 });
  assert.deepEqual(sanitizeCart({ capri: 999 }), { capri: 99 });
  assert.deepEqual(sanitizeCart(null), {});
  assert.deepEqual(sanitizeCart(["capri"]), {});
  assert.equal(getCartTotalCents({ capri: 2, maestro: 1 }), 3100);
  assert.equal(getCartCount({ capri: 2, maestro: 1 }), 3);
  assert.equal(getCartLines({ capri: 2 })[0]?.unitPriceCents, 1000);
  assert.deepEqual(setCartQuantity({ capri: 1 }, "capri", 0), {});
});

test("les formats français usuels sont normalisés et les numéros invalides rejetés", () => {
  for (const phone of ["06 12 34 56 78", "+33 6 12 34 56 78", "0033 6 12 34 56 78", "+33 (0)6 12 34 56 78"]) {
    assert.equal(normalizeFrenchPhone(phone), "+33612345678");
  }
  for (const phone of ["", "0612", "+44 1234567890", "06 ABCD 5678", "0000000000", "+330612345678"]) assert.equal(normalizeFrenchPhone(phone), null);
});

test("coordonnées, longueurs et prise de connaissance sont validées", () => {
  const details = { firstName: " Éloïse ", lastName: "D’Angelo", phone: "0612345678", comment: " Sans découpe. ", privacyAcknowledged: true };
  const valid = validateCustomer(details);
  assert.deepEqual(valid.errors, {});
  assert.equal(valid.value.firstName, "Éloïse");
  assert.equal(valid.value.comment, "Sans découpe.");
  assert.equal(valid.value.phone, "+33612345678");
  const invalid = validateCustomer({ ...details, firstName: "", lastName: "x".repeat(81), comment: "x".repeat(501), privacyAcknowledged: false });
  assert.deepEqual(Object.keys(invalid.errors).sort(), ["comment", "firstName", "lastName", "privacyAcknowledged"]);
});

test("Paris reste indépendant du fuseau de la machine et passe correctement minuit", () => {
  const before = process.env.TZ;
  process.env.TZ = "Pacific/Honolulu";
  try {
    assert.equal(parisDateKey(new Date("2026-10-27T23:30:00Z")), "2026-10-28");
    assert.equal(addCalendarDays("2026-12-31", 1), "2027-01-01");
  } finally { if (before) process.env.TZ = before; else delete process.env.TZ; }
});

test("les changements d'heure utilisent les vrais décalages Paris et excluent les heures ambiguës", () => {
  assert.equal(parisLocalToInstant("2026-03-28", "18:00")?.toISOString(), "2026-03-28T17:00:00.000Z");
  assert.equal(parisLocalToInstant("2026-03-29", "18:00")?.toISOString(), "2026-03-29T16:00:00.000Z");
  assert.equal(parisLocalToInstant("2026-10-24", "18:00")?.toISOString(), "2026-10-24T16:00:00.000Z");
  assert.equal(parisLocalToInstant("2026-10-25", "18:00")?.toISOString(), "2026-10-25T17:00:00.000Z");
  assert.equal(parisLocalToInstant("2026-03-29", "02:30"), null);
  assert.equal(parisLocalToInstant("2026-10-25", "02:30"), null);
  assert.equal(parisLocalToInstant("2026-02-30", "18:00"), null);
});

test("mardi Vougy et mercredi Mably : un seul service du jour, conforme à la source de la Hero", () => {
  for (const [date, village, id] of [["2026-10-27", "Vougy", "forno-2026-10-27-2"], ["2026-10-28", "Mably", "forno-2026-10-28-3"]]) {
    const now = new Date(`${date}T12:00:00Z`);
    const services = getPickupServices(now);
    assert.equal(services.length, 1);
    assert.equal(services[0]?.village, village);
    assert.equal(services[0]?.village, getTodayDisplay(now).stop.village);
    assert.equal(services[0]?.id, id);
    assert.equal(services[0]?.date, parisDateKey(now));
    assert.equal(services[0]?.address, null);
    assert.equal(services[0]?.availability, "provisional");
    assert.ok(services[0]?.slots.every((slot) => slot.serviceId === id));
  }
});

test("dimanche fermé : prochain village informatif, aucun report de commande au lundi", () => {
  const now = new Date("2026-11-01T12:00:00Z");
  const state = getTodayPickupState(now);
  assert.equal(state.status, "closed");
  assert.equal(state.service, null);
  assert.equal(state.nextService?.village, "Le Coteau");
  assert.ok(!("slots" in state.nextService!));
  assert.deepEqual(getPickupServices(now), []);
  assert.equal(getCheckoutPickupState(now, "2026-11-01").canChooseSlot, false);
});

test("service terminé ou sans délai de préparation suffisant : validation bloquée sans service du lendemain", () => {
  const finished = new Date("2026-10-27T21:00:00Z");
  assert.equal(getTodayPickupState(finished).status, "finished");
  assert.equal(getTodayPickupState(finished).nextService?.village, "Mably");
  assert.deepEqual(getPickupServices(finished), []);
  const noTime = new Date("2026-10-27T19:50:00Z"); // 20h50 Paris, aucun retrait possible avant la marge de fermeture.
  assert.equal(getTodayPickupState(noTime).status, "unavailable");
  assert.deepEqual(getPickupServices(noTime), []);
});

test("le délai minimum élimine les créneaux passés ; la fin de service garde sa marge", () => {
  const now = new Date("2026-10-27T17:37:00Z"); // 18h37 Paris, retrait au plus tôt 19h07.
  const today = getPickupServices(now)[0]!;
  assert.equal(today.slots[0]?.label, "19h15");
  assert.equal(today.slots.at(-1)?.label, "21h15");
  assert.ok(today.slots.every((slot) => Date.parse(slot.pickupAt) >= now.getTime() + 30 * 60_000));
  const exact = getPickupServices(new Date("2026-10-27T17:30:00Z"))[0]!;
  assert.equal(exact.slots[0]?.label, "19h00");
  assert.ok(!getPickupServices(new Date("2026-10-27T20:00:00Z")).some((service) => service.date === "2026-10-27"));
});

test("fermetures exceptionnelles, services et créneaux bloqués sont exclus", () => {
  const now = new Date("2026-10-27T12:00:00Z");
  const serviceId = "forno-2026-10-27-2";
  const closed = getPickupServices(now, { ...defaults, exceptionalClosures: ["2026-10-27"] });
  assert.ok(!closed.some((service) => service.id === serviceId));
  const blocked = getPickupServices(now, { ...defaults, unavailableServiceIds: [serviceId] });
  assert.ok(!blocked.some((service) => service.id === serviceId));
  const slotId = `${serviceId}@18:00`;
  const slots = getPickupServices(now, { ...defaults, unavailableSlotIds: [slotId] })[0]!;
  assert.equal(slots.slots[0]?.label, "18h15");
  const prep = getPickupServices(now, { ...defaults, closingPreparationMinutes: 45 })[0]!;
  assert.equal(prep.slots.at(-1)?.label, "20h45");
});

test("la génération traverse les deux changements d'heure même pour un service du dimanche", () => {
  const sunday = { ...truckSchedule[0]!, day: 0, dayLabel: "Dimanche" };
  const schedule = [...truckSchedule.filter((stop) => stop.day !== 0), sunday];
  for (const [date, expected] of [["2026-03-29", "2026-03-29T16:00:00.000Z"], ["2026-10-25", "2026-10-25T17:00:00.000Z"]]) {
    const services = getPickupServices(new Date(`${date}T10:00:00Z`), defaults, schedule);
    assert.equal(services[0]?.slots[0]?.pickupAt, expected);
  }
});

test("la validation destinée au serveur recalcule le jour, le village et le créneau autorisés", () => {
  const now = new Date("2026-10-27T12:00:00Z");
  const service = getPickupServices(now)[0]!;
  const request = { serviceId: service.id, slotId: service.slots[0]!.id, date: service.date, village: service.village };
  assert.equal(validateTodayPickupRequest(request, now).ok, true);
  for (const date of ["2026-10-26", "2026-10-28"]) {
    assert.deepEqual(validateTodayPickupRequest({ ...request, date }, now), { ok: false, reason: "wrong_date" });
  }
  assert.deepEqual(validateTodayPickupRequest({ ...request, village: "Mably" }, now), { ok: false, reason: "wrong_village" });
  assert.deepEqual(validateTodayPickupRequest({ ...request, serviceId: "forno-2026-10-28-3" }, now), { ok: false, reason: "wrong_service" });
  assert.deepEqual(validateTodayPickupRequest({ ...request, slotId: "forno-2026-10-28-3@18:00" }, now), { ok: false, reason: "unavailable_slot" });
  assert.deepEqual(validateTodayPickupRequest({ ...request, slotId: `${service.id}@22:00` }, now), { ok: false, reason: "unavailable_slot" });
  assert.deepEqual(validateTodayPickupRequest(null, now), { ok: false, reason: "invalid_request" });
  assert.equal(validateTodayPickupRequest(request, new Date("2026-10-27T21:00:00Z")).ok, false);
  assert.equal(validateTodayPickupRequest(request, now, { ...defaults, exceptionalClosures: [service.date] }).ok, false);
  assert.equal(validateTodayPickupRequest(request, now, { ...defaults, unavailableSlotIds: [request.slotId] }).ok, false);
});

test("un changement de date pendant le tunnel exige un redémarrage et invalide l'ancien service", () => {
  const openedDate = "2026-10-27";
  const before = getCheckoutPickupState(new Date("2026-10-27T19:00:00Z"), openedDate);
  assert.equal(before.dateChanged, false);
  assert.equal(before.canChooseSlot, true);
  const request = { serviceId: before.service!.id, slotId: before.service!.slots[0]!.id };
  const midnight = new Date("2026-10-27T23:01:00Z"); // Mercredi 00h01 Paris.
  const after = getCheckoutPickupState(midnight, openedDate);
  assert.equal(after.date, "2026-10-28");
  assert.equal(after.dateChanged, true);
  assert.equal(after.canChooseSlot, false);
  assert.equal(validateTodayPickupRequest(request, midnight).ok, false);
  assert.equal(getCheckoutPickupState(midnight, "2026-10-28").canChooseSlot, true);
});

test("configuration invalide : aucun créneau n'est autorisé", () => {
  assert.deepEqual(getPickupServices(new Date(), { ...defaults, slotIntervalMinutes: 0 }), []);
  assert.deepEqual(getPickupServices(new Date(), { ...defaults, minimumLeadMinutes: -1 }), []);
});
