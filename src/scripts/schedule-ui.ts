import { brandConfig } from "../config/brand.config";
import { getTodayDisplay } from "../utils/truckToday";
import { isPlaceholderValue } from "../utils/placeholders";

function updateText(selector: string, value: string): void {
  document.querySelectorAll<HTMLElement>(selector).forEach((node) => { node.textContent = value; });
}

function render(now: Date): void {
  const today = getTodayDisplay(now);
  updateText("[data-today-nav]", today.navStatus);
  updateText("[data-today-badge]", today.badge);
  updateText("[data-today-meta]", today.meta);
  updateText("[data-today-heading-top]", today.headingTop);
  updateText("[data-today-heading-middle]", today.headingMiddle);
  updateText("[data-today-heading-place]", today.headingPlace);
  updateText("[data-today-location]", today.location);
  updateText("[data-today-hours]", today.hours);
  const canOrder = today.isOpen && !isPlaceholderValue(brandConfig.orderUrl);
  document.querySelectorAll<HTMLAnchorElement>("[data-order-link]").forEach((link) => {
    if (canOrder) {
      link.href = brandConfig.orderUrl;
      link.removeAttribute("aria-disabled");
      link.removeAttribute("tabindex");
    } else {
      link.removeAttribute("href");
      link.setAttribute("aria-disabled", "true");
      link.tabIndex = -1;
    }
  });
}

/** Same-origin Date header provides server time for a static Site. */
async function getServerTime(): Promise<Date> {
  try {
    const response = await fetch(`/robots.txt?time=${Date.now()}`, { method: "HEAD", cache: "no-store" });
    const header = response.headers.get("Date");
    if (response.ok && header) {
      const date = new Date(header);
      if (!Number.isNaN(date.getTime())) return date;
    }
  } catch { /* Local preview may not expose a Date header. */ }
  return new Date();
}

void getServerTime().then(render);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void getServerTime().then(render);
});
