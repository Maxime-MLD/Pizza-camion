import { getFinalCtaState } from "../utils/finalCtaState";

const section = document.querySelector<HTMLElement>("#commander");

function render(now: Date): void {
  if (!section) return;
  const state = getFinalCtaState(now);
  const description = section.querySelector<HTMLElement>("[data-final-cta-description]");
  const service = section.querySelector<HTMLElement>("[data-final-cta-service]");
  const action = section.querySelector<HTMLAnchorElement>("[data-final-cta-action]");
  const actionLabel = section.querySelector<HTMLElement>("[data-final-cta-action-label]");
  if (description) description.textContent = state.description;
  if (service) service.textContent = state.serviceLine;
  if (action) action.href = state.actionHref;
  if (actionLabel) actionLabel.textContent = state.actionLabel;
}

/** Même source d'heure serveur que la Hero pour corriger une horloge locale décalée. */
async function getServerTime(): Promise<Date> {
  try {
    const response = await fetch(`/robots.txt?time=${Date.now()}`, { method: "HEAD", cache: "no-store" });
    const header = response.headers.get("Date");
    if (response.ok && header) {
      const date = new Date(header);
      if (!Number.isNaN(date.getTime())) return date;
    }
  } catch { /* L'aperçu local peut ne pas exposer l'en-tête Date. */ }
  return new Date();
}

if (section) {
  void getServerTime().then(render);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void getServerTime().then(render);
  });
  window.setInterval(() => render(new Date()), 60_000);

  if (
    "IntersectionObserver" in window &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    const targets = Array.from(section.querySelectorAll<HTMLElement>("[data-final-cta-reveal]"));
    targets.forEach((target) => target.classList.add("opacity-0", "translate-y-4"));

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const target = entry.target as HTMLElement;
        target.classList.remove("opacity-0", "translate-y-4");
        observer.unobserve(target);
      }
    }, { threshold: 0.12 });

    targets.forEach((target) => observer.observe(target));
  }
}
