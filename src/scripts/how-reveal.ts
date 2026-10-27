const section = document.querySelector<HTMLElement>("#comment-ca-marche");

if (
  section &&
  "IntersectionObserver" in window &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches
) {
  const targets = Array.from(section.querySelectorAll<HTMLElement>("[data-how-reveal]"));
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

export {};
