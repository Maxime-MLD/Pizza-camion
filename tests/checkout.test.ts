import test from "node:test";
import assert from "node:assert/strict";
import { pickupAvailabilityConfig as defaults } from "../src/config/checkout.config";
import { truckSchedule } from "../src/data/truckSchedule";
import { addCalendarDays, findPickup, getPickupServices, parisDateKey, parisLocalToInstant } from "../src/utils/pickupAvailability";
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

test("la fenêtre contient 7 jours calendaires, des IDs datés uniques et aucun dimanche fermé", () => {
  const services = getPickupServices(new Date("2026-10-27T12:00:00Z"));
  assert.equal(services.length, 6);
  assert.equal(services[0]?.village, "Vougy");
  assert.equal(services[0]?.id, "forno-2026-10-27-2");
  assert.equal(services.at(-1)?.date, "2026-11-02");
  assert.ok(!services.some((service) => service.date === "2026-11-01"));
  assert.equal(new Set(services.map((service) => service.id)).size, services.length);
  assert.ok(services.every((service) => service.address === null && service.availability === "provisional"));
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
    const services = getPickupServices(new Date(`${date}T10:00:00Z`), { ...defaults, preorderDays: 1 }, schedule);
    assert.equal(services[0]?.slots[0]?.pickupAt, expected);
  }
});

test("un créneau doit appartenir au service sélectionné ; configuration invalide sans boucle", () => {
  const services = getPickupServices(new Date("2026-10-27T12:00:00Z"));
  assert.ok(findPickup(services, services[0]!.id, services[0]!.slots[0]!.id));
  assert.equal(findPickup(services, services[0]!.id, services[1]!.slots[0]!.id), null);
  assert.deepEqual(getPickupServices(new Date(), { ...defaults, slotIntervalMinutes: 0 }), []);
  assert.deepEqual(getPickupServices(new Date(), { ...defaults, preorderDays: Infinity }), []);
});
