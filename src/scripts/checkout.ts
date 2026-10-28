import { checkoutConfig as copy } from "../config/checkout.config";
import { cartStore } from "../stores/cartStore";
import type { LivePickupAvailability, OrderReceipt, SubmitOrderRequest } from "../types/checkoutApi";
import { mountTurnstile } from "./turnstile";
import { readAttempt, saveAttempt, forgetAttempt, type OrderAttempt } from "./orderSession";
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
  let openedDate = "";
  let pickupState: LivePickupAvailability | null = null;
  let availabilityError = "";
  let refreshing: Promise<void> | null = null;
  let sending = false;
  let submissionLocked = false;
  let confirmed = false;
  let botToken = "";
  let botReset: (() => void) | undefined;
  let botMounted = false;
  let attempt: OrderAttempt | null = null;
  try { attempt = readAttempt(sessionStorage); } catch { /* Only memory fallback; submission requires persistence. */ }
  let pendingBody: SubmitOrderRequest | null = null;
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
  const sendButton = query<HTMLButtonElement>("[data-order-send]");
  const dateChanged = (): boolean => !!pickupState && !!openedDate && pickupState.date !== openedDate;
  const canChoose = (): boolean => !confirmed && !availabilityError && !dateChanged() && pickupState?.state === "available";
  const selectedSlot = () => canChoose() ? pickupState?.slots.find(slot => slot.id === slotId && slot.state === "available") : null;
  function apiMessage(code: string): string {
    return copy.apiErrors[code as keyof typeof copy.apiErrors] ?? copy.apiErrors.unknown;
  }
  function renderSend(): void {
    sendButton.disabled = submissionLocked || sending || !customer || (!pendingBody && (!selectedSlot() || !botToken));
    root.querySelectorAll<HTMLButtonElement>("[data-checkout-back]").forEach(button => {button.disabled=!!pendingBody || sending || submissionLocked;});
    sendButton.textContent = sending ? copy.sending : pendingBody ? copy.retry : copy.send;
  }
  function renderSlots(): void {
    const service = canChoose() ? pickupState?.service : null;
    slots.replaceChildren(new Option(service ? copy.pickup.selectSlot : copy.pickup.unavailableSlot, ""));
    slots.disabled = !service;
    if (service) for (const slot of pickupState!.slots) {
      const option = new Option(slot.label.replace(":", "h") + (slot.state === "full" ? ` — ${copy.fullSlot}` : slot.state === "unavailable" ? ` — ${copy.unavailableSlotLabel}` : ""), slot.id);
      option.disabled = slot.state !== "available";
      slots.add(option);
    }
    slots.value = slotId;
    query("[data-pickup-slot-field]").hidden = !service;
    query<HTMLButtonElement>("[data-pickup-next]").disabled = !selectedSlot();
    renderSend();
  }
  function renderAvailability(): void {
    const service = pickupState?.service;
    query("[data-pickup-service-card]").hidden = !pickupState;
    const hasSlots = pickupState?.slots.some(slot => slot.state === "available");
    query("[data-pickup-date]").textContent = pickupState ? new Intl.DateTimeFormat("fr-FR", {weekday:"long",day:"numeric",month:"long",timeZone:"Europe/Paris"}).format(new Date(`${pickupState.date}T12:00:00Z`)) : "";
    query("[data-today-service]").hidden = !service;
    query("[data-pickup-village]").textContent = service?.village ?? "";
    query("[data-pickup-address]").textContent = service?.address ?? copy.pickup.addressPending;
    query("[data-pickup-hours]").textContent = service ? `${service.openingTime.replace(":","h")} – ${service.closingTime.replace(":","h")}` : "";
    query("[data-pickup-closed]").hidden = canChoose() && !!hasSlots;
    query("[data-pickup-closed-message]").textContent = availabilityError || (dateChanged() ? copy.pickup.dateChanged : pickupState?.reason === "finished" ? copy.pickup.finished : !service ? copy.pickup.closed : copy.pickup.noSlots);
    query("[data-pickup-next-service]").hidden = true;
    query("[data-pickup-reload]").hidden = !dateChanged();
    query("[data-checkout-notice]").textContent = availabilityError || copy.provisionalNotice;
    if(pickupState?.minimumLeadMinutes !== undefined)query("[data-pickup-time-help]").textContent=copy.pickup.timeHelp(pickupState.minimumLeadMinutes);
    renderSlots();
  }
  function refreshAvailability(): Promise<void> {
    if (confirmed || sending) return Promise.resolve();
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        const count = getCartCount(cart);
        const response = await fetch(`/api/pickup-slots?quantity=${count || 1}`, {cache:"no-store",signal:AbortSignal.timeout(12000)});
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "TEMPORARILY_UNAVAILABLE");
        pickupState = data as LivePickupAvailability;
        openedDate ||= pickupState.date;
        availabilityError = "";
        serviceId = canChoose() ? pickupState.service?.id ?? "" : "";
        if (slotId && !selectedSlot()) {
          slotId = "";
          if (!pendingBody) { goToStep(1, getCartCount(cart)>0); globalError(dateChanged() ? copy.pickup.dateChanged : copy.errors.expired); }
        }
      } catch (error) {
        const code = error instanceof Error ? error.message : "";
        availabilityError = code === "NOT_CONFIGURED" ? copy.notConfigured : code in copy.apiErrors ? apiMessage(code) : copy.liveUnavailable;
      }
      renderAvailability();
    })().finally(() => { refreshing = null; });
    return refreshing;
  }
  async function validatePickup(): Promise<boolean> {
    await refreshAvailability();
    if (selectedSlot()) return true;
    goToStep(1);
    const message = availabilityError || (dateChanged() ? copy.pickup.dateChanged : copy.errors.pickup);
    globalError(message); pickupError(message);
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
    const service = pickupState?.service;
    const slot = selectedSlot();
    if (!service || !slot || !customer) return;
    const review = {
      date: query("[data-pickup-date]").textContent ?? "", village: service.village,
      address: service.address ?? copy.pickup.addressPending,
      slot: slot.label.replace(":","h"), name: `${customer.firstName} ${customer.lastName}`,
      phone: customer.phone, comment: customer.comment || copy.review.noComment,
    };
    for (const [key, value] of Object.entries(review)) query(`[data-review="${key}"]`).textContent = value;
  }
  function renderCart(): void {
    const count = getCartCount(cart);
    empty.hidden = confirmed || count > 0;
    content.hidden = confirmed || count === 0;
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
    query<HTMLButtonElement>("[data-pickup-next]").disabled = !selectedSlot();
    renderSend();
  });
  query("[data-pickup-reload]").addEventListener("click", () => window.location.reload());
  query("[data-pickup-next]").addEventListener("click", async () => { if (await validatePickup()) goToStep(2); });
  root.querySelectorAll<HTMLElement>("[data-checkout-back]").forEach((button) => {
    button.addEventListener("click", () => { refreshAvailability(); goToStep(Math.max(1, activeStep - 1)); });
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!getCartCount(cart) || !(await validatePickup())) return;
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
    if (!botMounted && pickupState?.turnstileSiteKey) {
      botMounted = true;
      try { botReset = await mountTurnstile(query("[data-turnstile]"), pickupState.turnstileSiteKey, token => {botToken=token;renderSend();}); }
      catch {botMounted=false;globalError(copy.apiErrors.VERIFICATION_UNAVAILABLE);}
    }
    renderSend();
  });

  function showConfirmation(receipt: OrderReceipt): void {
    confirmed = true;
    // Only a successful server receipt permits removal of the submitted quantities.
    // Keep pizzas added meanwhile, including changes received from another tab.
    if (attempt && !attempt.consumed) {
      attempt.consumed = true;
      try { saveAttempt(sessionStorage, attempt); } catch { /* receipt already confirmed */ }
      for (const line of receipt.lines) cartStore.setQuantity(line.pizzaId, Math.max(0,(cartStore.getSnapshot()[line.pizzaId] ?? 0)-line.quantity));
    }
    content.hidden=true; empty.hidden=true;
    query("[data-order-confirmation]").hidden=false;
    query("[data-confirmation-reference]").textContent=receipt.orderNumber;
    query("[data-confirmation-status]").textContent=copy.confirmation.statuses[receipt.status];
    query("[data-confirmation-pending]").hidden=receipt.status!=="pending";
    query("[data-confirmation-expiry]").hidden=receipt.status!=="pending";
    query("[data-confirmation-expiry-note]").hidden=receipt.status!=="pending";
    const values={date:receipt.date,village:receipt.village,slot:receipt.pickupTime.replace(":","h"),total:formatEuros(receipt.totalCents),expires:new Intl.DateTimeFormat("fr-FR",{dateStyle:"short",timeStyle:"short",timeZone:"Europe/Paris"}).format(new Date(receipt.expiresAt))};
    for(const [key,value] of Object.entries(values))query(`[data-confirmation="${key}"]`).textContent=value;
    query("[data-checkout-notice]").hidden=true;
    query("#confirmation-title").focus();
  }
  async function recover(): Promise<boolean> {
    if(!attempt)return false;
    const response=await fetch("/api/orders",{headers:{"X-Order-Request-Key":attempt.key},cache:"no-store",signal:AbortSignal.timeout(12000)});
    if(!response.ok)return false;
    const {receipt}=await response.json() as {receipt:OrderReceipt|null};
    if(!receipt)return false;
    showConfirmation(receipt);return true;
  }
  query("[data-order-confirmation] a").addEventListener("click",()=>{try{forgetAttempt(sessionStorage);}catch{/* no PII stored */}});
  sendButton.addEventListener("click",async()=>{
    if(submissionLocked||sending||confirmed)return;
    submissionLocked=true;renderSend();
    try {
    if(pendingBody){
      try{if(await recover())return;}catch{/* Retry the exact same idempotent request. */}
    } else {
      if(!customer||!(await validatePickup())||!botToken||!pickupState?.service)return;
      const lines=getCartLines(cart).map(({pizzaId,quantity})=>({pizzaId,quantity}));
      attempt ??= {key:crypto.randomUUID(),lines,consumed:false};
      // Persist just the capability UUID and pizza quantities, never contact information.
      try{saveAttempt(sessionStorage,attempt);}catch{globalError(copy.storageUnavailable);return;}
      pendingBody={idempotencyKey:attempt.key,lines,serviceId,slotId,date:pickupState.date,village:pickupState.service.village,customer,turnstileToken:botToken};
    }
    sending=true;renderSend();globalError();
    try {
      // A fresh bot token may replace an expired token; it is excluded from the SQL fingerprint.
      const body={...pendingBody,turnstileToken:botToken || pendingBody!.turnstileToken};
      const response=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
      const result=await response.json() as {receipt?:OrderReceipt;error?:string};
      if(response.ok&&result.receipt){showConfirmation(result.receipt);return;}
      const code=result.error??"unknown";
      if(response.status===409&&code==="IDEMPOTENCY_CONFLICT"){if(await recover())return;}
      // 4xx business errors are definitive non-insertions. Network/5xx retain the key and frozen request.
      if(response.status>=400&&response.status<500&&code!=="IDEMPOTENCY_CONFLICT"&&code!=="BOT_VERIFICATION_FAILED"){
        pendingBody=null;attempt=null;try{forgetAttempt(sessionStorage);}catch{/* memory state remains */}
        await refreshAvailability();goToStep(1);
      }
      globalError(apiMessage(code));
    } catch {globalError(copy.apiErrors.unknown);}
    finally{sending=false;botReset?.();renderSend();}
    } finally { submissionLocked=false;renderSend(); }
  });
  goToStep(1, false);
  // The cart remains the existing shared store, with no contact details.
  cartStore.subscribe((value) => { cart=value;renderCart();if(!confirmed){void refreshAvailability();if(activeStep===3)renderReview();} });
  void (async()=>{
    try{if(await recover())return;}catch{/* Availability still fails closed if the backend is unavailable. */}
    await refreshAvailability();
  })().finally(()=>{query("[data-checkout-loading]").hidden=true;});
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")void refreshAvailability();});
  window.setInterval(()=>{if(document.visibilityState==="visible")void refreshAvailability();},30000);
}

const root = document.querySelector<HTMLElement>("[data-checkout]");
if (root) initializeCheckout(root);
