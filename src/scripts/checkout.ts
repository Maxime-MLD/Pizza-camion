import { checkoutConfig as copy } from "../config/checkout.config";
import { cartStore } from "../stores/cartStore";
import { getCheckoutPickupState, parisDateKey } from "../utils/pickupAvailability";
import { validateTodayPickupRequest } from "../utils/validateTodayPickup";
import { formatEuros, getCartCount, getCartLines, getCartTotalCents } from "../utils/pizzaCart";
import { validateCustomer } from "../utils/orderValidation";
import type { CustomerDetails } from "../types/order";

function initializeCheckout(root: HTMLElement): void {
  const query = <T extends HTMLElement = HTMLElement>(selector: string): T => root.querySelector<T>(selector)!;
  const content = query("[data-checkout-content]");
  const empty = query("[data-checkout-empty]");
  const slots = query<HTMLSelectElement>("[data-pickup-slot]");
  const form = query<HTMLFormElement>("[data-details-form]");
  const panels = Array.from(root.querySelectorAll<HTMLElement>("[data-checkout-step]"));
  let activeStep = 1;
  const openedDate = parisDateKey(new Date());
  let pickupState = getCheckoutPickupState(new Date(), openedDate);
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
    const service = pickupState.canChooseSlot ? pickupState.service : null;
    slots.replaceChildren(new Option(service ? copy.pickup.selectSlot : copy.pickup.unavailableSlot, ""));
    slots.disabled = !service;
    service?.slots.forEach((slot) => slots.add(new Option(slot.label, slot.id)));
    slots.value = slotId;
    query("[data-pickup-slot-field]").hidden = !service;
    query<HTMLButtonElement>("[data-pickup-next]").disabled = !service || !slotId;
  }
  function refreshAvailability(): void {
    const now = new Date();
    pickupState = getCheckoutPickupState(now, openedDate);
    const signature = JSON.stringify(pickupState);
    if (signature === availabilitySignature) return;
    availabilitySignature = signature;
    const wasSelected = !!slotId;
    const valid = pickupState.canChooseSlot && validateTodayPickupRequest({ serviceId, slotId }, now).ok;
    serviceId = pickupState.canChooseSlot ? pickupState.service!.id : "";
    if (!valid) slotId = "";
    query("[data-pickup-date]").textContent = pickupState.dateLabel;
    const service = pickupState.service;
    query("[data-today-service]").hidden = !service;
    query("[data-pickup-village]").textContent = service?.village ?? "";
    query("[data-pickup-address]").textContent = service?.address ?? copy.pickup.addressPending;
    query("[data-pickup-hours]").textContent = service?.hours ?? "";
    query("[data-pickup-closed]").hidden = pickupState.canChooseSlot;
    query("[data-pickup-closed-message]").textContent = pickupState.dateChanged ? copy.pickup.dateChanged : pickupState.status === "closed" ? copy.pickup.closed : pickupState.status === "finished" ? copy.pickup.finished : copy.pickup.noSlots;
    const next = pickupState.nextService;
    query("[data-pickup-next-service]").hidden = !next;
    query("[data-pickup-next-service]").textContent = next ? copy.pickup.nextService(next.village, next.dateLabel, next.hours) : "";
    query("[data-pickup-reload]").hidden = !pickupState.dateChanged;
    renderSlots();
    if ((wasSelected || activeStep > 1) && !valid) {
      goToStep(1, getCartCount(cart) > 0);
      const message = pickupState.dateChanged ? copy.pickup.dateChanged : copy.errors.expired;
      globalError(message);
      pickupError(message);
    }
  }
  function validatePickup(): boolean {
    refreshAvailability();
    if (pickupState.canChooseSlot && validateTodayPickupRequest({ serviceId, slotId }, new Date()).ok) return true;
    if (activeStep !== 1) goToStep(1);
    const message = pickupState.dateChanged ? copy.pickup.dateChanged : copy.errors.pickup;
    globalError(message);
    pickupError(message);
    if (!slots.disabled) slots.focus();
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
    const pickup = validateTodayPickupRequest({ serviceId, slotId }, new Date());
    if (!pickup.ok || !customer) return;
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

  slots.addEventListener("change", () => {
    slotId = slots.value;
    pickupError();
    globalError();
    query<HTMLButtonElement>("[data-pickup-next]").disabled = !pickupState.canChooseSlot || !slotId;
  });
  query("[data-pickup-reload]").addEventListener("click", () => window.location.reload());
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
