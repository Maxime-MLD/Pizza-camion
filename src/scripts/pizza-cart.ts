import { pizzaMenuConfig } from "../config/pizza-menu.config";
import { pizzaById } from "../data/pizzas";
import { formatEuros, getCartCount, getCartTotalCents, type Cart } from "../utils/pizzaCart";
import { cartStore } from "../stores/cartStore";

const section = document.querySelector<HTMLElement>("#la-carte");

if (section) {
  const items = section.querySelector<HTMLUListElement>("[data-cart-items]");
  const empty = section.querySelector<HTMLElement>("[data-cart-empty]");
  const count = section.querySelector<HTMLElement>("[data-cart-count]");
  const total = section.querySelector<HTMLElement>("[data-cart-total]");
  const status = section.querySelector<HTMLElement>("[data-cart-status]");
  const next = section.querySelector<HTMLElement>("[data-cart-next]");

  if (items && empty && count && total && status) {
    let cart: Cart = cartStore.getSnapshot();

    const render = () => {
      items.replaceChildren();
      for (const [id, quantity] of Object.entries(cart)) {
        const pizza = pizzaById.get(id);
        if (!pizza) continue;

        const row = document.createElement("li");
        row.className = "flex flex-wrap items-center justify-between gap-3 py-4";
        const details = document.createElement("div");
        details.className = "min-w-0";
        const name = document.createElement("p");
        name.className = "font-display text-2xl font-extrabold uppercase leading-none";
        name.textContent = pizza.name;
        const subtotal = document.createElement("p");
        subtotal.className = "mt-1 text-sm text-[var(--color-muted-foreground)]";
        subtotal.textContent = `${formatEuros(pizza.priceCents)} × ${quantity} = ${formatEuros(pizza.priceCents * quantity)}`;
        details.append(name, subtotal);

        const controls = document.createElement("div");
        controls.className = "flex items-center gap-2";
        controls.setAttribute("aria-label", `${pizzaMenuConfig.quantityLabel} : ${pizza.name}`);
        for (const [change, label, symbol] of [[-1, "Retirer une", "−"], [1, "Ajouter une", "+"]] as const) {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.cartId = id;
          button.dataset.cartChange = String(change);
          button.className = "focus-ring flex size-10 items-center justify-center rounded-full border border-[var(--color-text)] bg-[var(--color-surface)] text-xl font-bold hover:bg-[var(--color-surface-2)]";
          button.setAttribute("aria-label", `${label} ${pizza.name}`);
          button.textContent = symbol;
          controls.append(button);
          if (change === -1) {
            const value = document.createElement("span");
            value.className = "min-w-5 text-center font-bold";
            value.textContent = String(quantity);
            controls.append(value);
          }
        }
        row.append(details, controls);
        items.append(row);
      }
      const itemCount = getCartCount(cart);
      empty.hidden = itemCount > 0;
      count.textContent = String(itemCount);
      total.textContent = formatEuros(getCartTotalCents(cart));
      if (next) next.hidden = itemCount === 0;
    };

    section.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      const addButton = event.target.closest<HTMLButtonElement>("[data-add-pizza]");
      const control = event.target.closest<HTMLButtonElement>("[data-cart-id][data-cart-change]");
      const id = addButton?.dataset.addPizza ?? control?.dataset.cartId;
      if (!id || !pizzaById.has(id)) return;
      const change = addButton ? 1 : Number(control?.dataset.cartChange);
      cartStore.setQuantity(id, (cart[id] ?? 0) + change);
      const pizza = pizzaById.get(id);
      status.textContent = `${pizza?.name ?? "Pizza"} : ${cart[id] ?? 0} dans le panier. Total ${formatEuros(getCartTotalCents(cart))}.`;
    });

    cartStore.subscribe((nextCart) => { cart = nextCart; render(); });
  }
}
