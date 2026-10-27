import { pizzaById } from "../data/pizzas";

export type Cart = Record<string, number>;

export function setCartQuantity(cart: Cart, id: string, quantity: number): Cart {
  if (!pizzaById.has(id)) return cart;
  const next = { ...cart };
  const safeQuantity = Number.isFinite(quantity) ? Math.max(0, Math.min(99, Math.trunc(quantity))) : 0;
  if (safeQuantity === 0) delete next[id];
  else next[id] = safeQuantity;
  return next;
}

export function getCartTotalCents(cart: Cart): number {
  return Object.entries(cart).reduce((total, [id, quantity]) => {
    const pizza = pizzaById.get(id);
    return total + (pizza && Number.isInteger(quantity) && quantity > 0 ? pizza.priceCents * quantity : 0);
  }, 0);
}

export function getCartCount(cart: Cart): number {
  return Object.entries(cart).reduce((total, [id, quantity]) =>
    total + (pizzaById.has(id) && Number.isInteger(quantity) && quantity > 0 ? quantity : 0), 0);
}

export function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}
