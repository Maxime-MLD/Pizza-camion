export interface FeaturesConfig {
  projects: boolean;
  testimonials: boolean;
  faq: boolean;
  localArea: boolean;
  practicalInfo: boolean;
  /** Active les animations GSAP choisies explicitement dans les pages. */
  animations: boolean;
  /** Autorise parallax, pin et défilement horizontal sur les appareils compatibles. */
  heavyAnimations: boolean;
  /** Défilement CSS natif, déjà neutralisé par prefers-reduced-motion. */
  smoothScroll: boolean;
  /** Point d'extension futur : aucune bibliothèque externe n'est installée. */
  externalSmoothScroll: boolean;
  analytics: boolean;
  cookieBanner: boolean;
  captcha: boolean;
}

export const featuresConfig = {
  projects: false,
  testimonials: false,
  faq: false,
  localArea: false,
  practicalInfo: false,
  animations: false,
  heavyAnimations: false,
  smoothScroll: true,
  externalSmoothScroll: false,
  analytics: false,
  cookieBanner: false,
  captcha: false,
} as const satisfies FeaturesConfig;
