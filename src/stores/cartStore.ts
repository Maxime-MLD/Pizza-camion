import { sanitizeCart, setCartQuantity, type Cart } from "../utils/pizzaCart";

const STORAGE_KEY = "forno-pizza-cart-v1";
let cart: Cart = {};
let persistent = true;
const listeners = new Set<(value: Cart) => void>();
function read(): Cart {
  try { return sanitizeCart(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")); }
  catch { return {}; }
}
if (typeof window !== "undefined") {
  cart = read();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch { persistent = false; }
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    cart = read();
    listeners.forEach((listener) => listener({ ...cart }));
  });
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted || !persistent) return;
    cart = read();
    listeners.forEach((listener) => listener({ ...cart }));
  });
}

export const cartStore = {
  getSnapshot: (): Cart => ({ ...cart }),
  isPersistent: (): boolean => persistent,
  subscribe(listener: (value: Cart) => void): () => void {
    listeners.add(listener);
    listener({ ...cart });
    return () => { listeners.delete(listener); };
  },
  setQuantity(id: string, quantity: number): void {
    cart = setCartQuantity(cart, id, quantity);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch { persistent = false; }
    listeners.forEach((listener) => listener({ ...cart }));
  },
};
