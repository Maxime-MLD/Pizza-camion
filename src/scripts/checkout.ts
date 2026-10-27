import { checkoutConfig as copy } from "../config/checkout.config";
import { cartStore } from "../stores/cartStore";
import { findPickup, getPickupServices } from "../utils/pickupAvailability";
import { formatEuros, getCartCount, getCartLines, getCartTotalCents } from "../utils/pizzaCart";
import { validateCustomer } from "../utils/orderValidation";
import type { CustomerDetails, PickupService } from "../types/order";

function initializeCheckout(root: HTMLElement): void {
  const query = <T extends HTMLElement = HTMLElement>(selector: string): T => root.querySelector<T>(selector)!;
  const content = query("[data-checkout-content]");
  const empty = query("[data-checkout-empty]");
  const dates = query("[data-pickup-dates]");
  const slots = query<HTMLSelectElement>("[data-pickup-slot]");
  const form = query<HTMLFormElement>("[data-details-form]");
  const panels = Array.from(root.querySelectorAll<HTMLElement>("[data-checkout-step]"));
  let activeStep = 1;
  let services: PickupService[] = [];
  let availabilitySignature = "";
  let serviceId = "";
  let slotId = "";
  let customer: CustomerDetails | null = null;
  let cart = cartStore.getSnapshot();

  function globalError(message = ""): void {
    const node = query("[data-checkout-error]");
    node.textContent = message;
    node.hidden = !message;
  }
  function pickupError(message = ""): void {
    const node = query("[data-pickup-error]");
    node.textContent = message;
    node.hidden = !message;
    if (message) slots.setAttribute("aria-invalid", "true");
    else slots.removeAttribute("aria-invalid");
  }
  function goToStep(step: number, focus = true): void {
    activeStep = step;
    panels.forEach((panel) => { panel.hidden = Number(panel.dataset.checkoutStep) !== step; });
    root.querySelectorAll<HTMLElement>("[data-checkout-progress]").forEach((item) => {
      if (Number(item.dataset.checkoutProgress) === step) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });
    query("[data-final-actions]").hidden = step !== 3;
    globalError();
    if (focus) panels.find((panel) => !panel.hidden)?.querySelector<HTMLElement>("h2")?.focus();
  }
  function renderSlots(): void {
    const service = services.find((item) => item.id === serviceId);
    slots.replaceChildren(new Option(service ? copy.pickup.selectSlot : copy.pickup.selectDateFirst, ""));
    slots.disabled = !service;
    service?.slots.forEach((slot) => slots.add(new Option(slot.label, slot.id)));
    slots.value = slotId;
    const location = query("[data-pickup-location]");
    location.hidden = !service;
    location.textContent = service ? `${copy.pickup.locationLabel} ${service.village} · ${service.address ?? copy.pickup.addressPending}` : "";
  }
  function refreshAvailability(): void {
    services = getPickupServices(new Date());
    const signature = JSON.stringify(services.map((service) => [service.id, service.slots.map((slot) => slot.id)]));
    if (signature === availabilitySignature) return;
    availabilitySignature = signature;
    const wasSelected = !!slotId;
    const valid = findPickup(services, serviceId, slotId);
    if (!services.some((service) => service.id === serviceId)) serviceId = "";
    if (!valid) slotId = "";
    dates.replaceChildren();
    for (const service of services) {
      const label = document.createElement("label");
      label.className = "flex min-h-24 cursor-pointer items-start gap-3 rounded-lg border border-[var(--color-border-strong)] p-4 has-[:checked]:border-[var(--color-primary-dark)] has-[:checked]:bg-[var(--color-primary-light)]";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "pickupService";
      radio.value = service.id;
      radio.checked = service.id === serviceId;
      radio.className = "focus-ring mt-1 size-5 shrink-0 accent-[var(--color-primary-dark)]";
      radio.setAttribute("aria-describedby", "pickup-error");
      const details = document.createElement("span");
      const date = document.createElement("span");
      date.className = "block text-sm font-semibold capitalize";
      date.textContent = service.dateLabel;
      const village = document.createElement("span");
      village.className = "mt-1 block font-display text-2xl leading-none font-extrabold uppercase";
      village.textContent = service.village;
      const hours = document.createElement("span");
      hours.className = "mt-2 block text-xs text-[var(--color-muted-foreground)]";
      hours.textContent = service.hours;
      details.append(date, village, hours);
      label.append(radio, details);
      dates.append(label);
    }
    query("[data-no-services]").hidden = services.length > 0;
    query<HTMLButtonElement>("[data-pickup-next]").disabled = services.length === 0;
    renderSlots();
    if (wasSelected && !valid) {
      goToStep(1, getCartCount(cart) > 0);
      globalError(copy.errors.expired);
      pickupError(copy.errors.expired);
    }
  }
  function validatePickup(): boolean {
    refreshAvailability();
    if (findPickup(services, serviceId, slotId)) return true;
    if (activeStep !== 1) goToStep(1);
    globalError(copy.errors.pickup);
    pickupError(copy.errors.pickup);
    (serviceId ? slots : dates.querySelector<HTMLInputElement>("input"))?.focus();
    return false;
  }
  function readCustomer(): CustomerDetails {
    const value = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement).value;
    return {
      firstName: value("firstName"), lastName: value("lastName"), phone: value("phone"), comment: value("comment"),
      privacyAcknowledged: (form.elements.namedItem("privacyAcknowledged") as HTMLInputElement).checked,
    };
  }
  function renderReview(): void {
    const pickup = findPickup(services, serviceId, slotId);
    if (!pickup || !customer) return;
    const review = {
      date: pickup.service.dateLabel, village: pickup.service.village,
      address: pickup.service.address ?? copy.pickup.addressPending,
      slot: pickup.slot.label, name: `${customer.firstName} ${customer.lastName}`,
      phone: customer.phone, comment: customer.comment || copy.review.noComment,
    };
    for (const [key, value] of Object.entries(review)) query(`[data-review="${key}"]`).textContent = value;
  }
  function renderCart(): void {
    const count = getCartCount(cart);
    empty.hidden = count > 0;
    content.hidden = count === 0;
    if (!count) goToStep(1, false);
    query("[data-checkout-count]").textContent = `(${count})`;
    query("[data-checkout-total]").textContent = formatEuros(getCartTotalCents(cart));
    const list = query<HTMLUListElement>("[data-checkout-lines]");
    list.replaceChildren();
    const lines = getCartLines(cart);
    for (const line of lines) {
      const row = document.createElement("li");
      row.className = "py-4";
      const name = document.createElement("p");
      name.className = "font-display text-2xl leading-none font-extrabold uppercase";
      name.textContent = `${line.quantity} × ${line.name}`;
      const price = document.createElement("p");
      price.className = "mt-2 text-sm text-[var(--color-muted-foreground)]";
      price.textContent = `${formatEuros(line.unitPriceCents)} × ${line.quantity} = ${formatEuros(line.lineTotalCents)}`;
      row.append(name, price);
      list.append(row);
    }
    query("[data-price-pending]").hidden = !lines.some((line) => !line.priceConfirmed);
    query("[data-checkout-storage]").hidden = cartStore.isPersistent();
  }

  dates.addEventListener("change", (event) => {
    if (!(event.target instanceof HTMLInputElement) || event.target.name !== "pickupService") return;
    serviceId = event.target.value;
    slotId = "";
    pickupError();
    globalError();
    renderSlots();
  });
  slots.addEventListener("change", () => { slotId = slots.value; pickupError(); globalError(); });
  query("[data-pickup-next]").addEventListener("click", () => { if (validatePickup()) goToStep(2); });
  root.querySelectorAll<HTMLElement>("[data-checkout-back]").forEach((button) => {
    button.addEventListener("click", () => { refreshAvailability(); goToStep(Math.max(1, activeStep - 1)); });
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!getCartCount(cart) || !validatePickup()) return;
    const result = validateCustomer(readCustomer());
    root.querySelectorAll<HTMLElement>("[data-error-for]").forEach((node) => {
      const key = node.dataset.errorFor as keyof CustomerDetails;
      const message = result.errors[key] ?? "";
      node.textContent = message;
      node.hidden = !message;
      const field = form.elements.namedItem(key) as HTMLElement;
      if (message) field.setAttribute("aria-invalid", "true");
      else field.removeAttribute("aria-invalid");
    });
    const firstInvalid = form.querySelector<HTMLElement>("[aria-invalid=true]");
    if (firstInvalid) { globalError(copy.errors.details); firstInvalid.focus(); return; }
    customer = result.value;
    renderReview();
    goToStep(3);
  });

  refreshAvailability();
  goToStep(1, false);
  // Les coordonnées ne rejoignent jamais ce store ; seul le panier est persisté.
  cartStore.subscribe((value) => { cart = value; renderCart(); if (activeStep === 3) { refreshAvailability(); renderReview(); } });
  query("[data-checkout-loading]").hidden = true;
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refreshAvailability(); });
  window.setInterval(() => { if (document.visibilityState === "visible") refreshAvailability(); }, 30_000);
}

const root = document.querySelector<HTMLElement>("[data-checkout]");
if (root) initializeCheckout(root);
