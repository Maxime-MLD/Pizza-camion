import { animationConfig } from "../config/animation.config";
import { getGsap } from "./gsap";
import { isMotionAllowed } from "./motion";

export type MotionTarget = gsap.DOMTarget;

export interface BaseMotionOptions {
  duration?: number;
  delay?: number;
  ease?: string;
}

export interface ScrollMotionOptions extends BaseMotionOptions {
  trigger?: gsap.DOMTarget;
  start?: string;
  end?: string;
  once?: boolean;
  scrollTrigger?: boolean;
}

export interface RevealMotionOptions extends ScrollMotionOptions {
  distance?: number;
}

export interface StaggerMotionOptions extends RevealMotionOptions {
  stagger?: number;
}

export interface ParallaxOptions {
  trigger?: gsap.DOMTarget;
  amount?: number;
  start?: string;
  end?: string;
  scrub?: number | boolean;
}

export interface HorizontalScrollOptions {
  trigger?: Element | string;
  start?: string;
  scrub?: number | boolean;
  pin?: boolean;
}

export interface PinSectionOptions {
  start?: string;
  end?: string | (() => string | number);
  pinSpacing?: boolean;
  scrub?: number | boolean;
}

function targetExists(target: MotionTarget): boolean {
  if (typeof window === "undefined" || target === null) {
    return false;
  }

  if (typeof target === "string") {
    try {
      return document.querySelector(target) !== null;
    } catch {
      return false;
    }
  }

  if (target === window || target instanceof Element) {
    return true;
  }

  return "length" in target && target.length > 0;
}

function canAnimate(target: MotionTarget, heavy = false): boolean {
  return targetExists(target) && isMotionAllowed(heavy);
}

function restoreVisibleState(target: MotionTarget): null {
  if (targetExists(target)) {
    const { gsap } = getGsap();
    gsap.set(target, {
      clearProps: "opacity,visibility,transform,clipPath",
    });
  }

  return null;
}

function motionDistance(distance: number): number {
  if (
    typeof window !== "undefined" &&
    window.matchMedia(animationConfig.mediaQueries.mobile).matches
  ) {
    return distance * animationConfig.mobileDistanceScale;
  }

  return distance;
}

function createScrollTrigger(
  target: MotionTarget,
  options: ScrollMotionOptions,
): ScrollTrigger.Vars | undefined {
  if (options.scrollTrigger === false) {
    return undefined;
  }

  return {
    trigger: options.trigger ?? target,
    start: options.start ?? animationConfig.scrollTriggerStart,
    end: options.end,
    once: options.once ?? true,
    invalidateOnRefresh: true,
  };
}

export function fadeReveal(
  target: MotionTarget,
  options: ScrollMotionOptions = {},
): gsap.core.Tween | null {
  if (!canAnimate(target)) {
    return restoreVisibleState(target);
  }

  const { gsap } = getGsap();
  return gsap.fromTo(
    target,
    { autoAlpha: 0 },
    {
      autoAlpha: 1,
      duration: options.duration ?? animationConfig.duration.normal,
      delay: options.delay ?? 0,
      ease: options.ease ?? animationConfig.ease,
      overwrite: "auto",
      scrollTrigger: createScrollTrigger(target, options),
      clearProps: "opacity,visibility",
    },
  );
}

export function revealVertical(
  target: MotionTarget,
  options: RevealMotionOptions = {},
): gsap.core.Tween | null {
  if (!canAnimate(target)) {
    return restoreVisibleState(target);
  }

  const { gsap } = getGsap();
  const distance = motionDistance(options.distance ?? animationConfig.revealOffset.y);

  return gsap.fromTo(
    target,
    { autoAlpha: 0, y: distance },
    {
      autoAlpha: 1,
      y: 0,
      duration: options.duration ?? animationConfig.duration.slow,
      delay: options.delay ?? 0,
      ease: options.ease ?? animationConfig.ease,
      overwrite: "auto",
      scrollTrigger: createScrollTrigger(target, options),
      clearProps: "opacity,visibility,transform",
    },
  );
}

export function staggerReveal(
  targets: MotionTarget,
  options: StaggerMotionOptions = {},
): gsap.core.Tween | null {
  if (!canAnimate(targets)) {
    return restoreVisibleState(targets);
  }

  const { gsap } = getGsap();
  const distance = motionDistance(options.distance ?? animationConfig.revealOffset.y);

  return gsap.fromTo(
    targets,
    { autoAlpha: 0, y: distance },
    {
      autoAlpha: 1,
      y: 0,
      duration: options.duration ?? animationConfig.duration.slow,
      delay: options.delay ?? 0,
      ease: options.ease ?? animationConfig.ease,
      stagger: options.stagger ?? animationConfig.stagger,
      overwrite: "auto",
      scrollTrigger: createScrollTrigger(targets, options),
      clearProps: "opacity,visibility,transform",
    },
  );
}

export function imageReveal(
  target: MotionTarget,
  options: ScrollMotionOptions = {},
): gsap.core.Tween | null {
  if (!canAnimate(target)) {
    return restoreVisibleState(target);
  }

  const { gsap } = getGsap();
  return gsap.fromTo(
    target,
    { clipPath: "inset(0 0 100% 0)" },
    {
      clipPath: "inset(0 0 0% 0)",
      duration: options.duration ?? animationConfig.duration.slow,
      delay: options.delay ?? 0,
      ease: options.ease ?? animationConfig.ease,
      overwrite: "auto",
      scrollTrigger: createScrollTrigger(target, options),
      clearProps: "clipPath",
    },
  );
}

/** Anime des fragments déjà balisés ; cette primitive ne découpe jamais le texte. */
export function textReveal(
  targets: MotionTarget,
  options: StaggerMotionOptions = {},
): gsap.core.Tween | null {
  if (!canAnimate(targets)) {
    return restoreVisibleState(targets);
  }

  const { gsap } = getGsap();
  return gsap.fromTo(
    targets,
    { autoAlpha: 0, yPercent: 110 },
    {
      autoAlpha: 1,
      yPercent: 0,
      duration: options.duration ?? animationConfig.duration.slow,
      delay: options.delay ?? 0,
      ease: options.ease ?? animationConfig.ease,
      stagger: options.stagger ?? animationConfig.stagger,
      overwrite: "auto",
      scrollTrigger: createScrollTrigger(targets, options),
      clearProps: "opacity,visibility,transform",
    },
  );
}

export function parallax(
  target: MotionTarget,
  options: ParallaxOptions = {},
): gsap.core.Tween | null {
  if (!canAnimate(target, true)) {
    return restoreVisibleState(target);
  }

  const { gsap } = getGsap();
  return gsap.to(target, {
    yPercent: options.amount ?? animationConfig.parallaxAmount,
    ease: "none",
    overwrite: "auto",
    scrollTrigger: {
      trigger: options.trigger ?? target,
      start: options.start ?? "top bottom",
      end: options.end ?? "bottom top",
      scrub: options.scrub ?? animationConfig.scrub,
      invalidateOnRefresh: true,
    },
  });
}

export function horizontalScroll(
  track: HTMLElement | string,
  options: HorizontalScrollOptions = {},
): gsap.core.Tween | null {
  if (typeof document === "undefined") {
    return null;
  }

  const element =
    typeof track === "string" ? document.querySelector<HTMLElement>(track) : track;

  if (!element) {
    return null;
  }

  if (!canAnimate(element, true)) {
    return restoreVisibleState(element);
  }

  const { gsap } = getGsap();
  const distance = () => {
    const viewportWidth = element.parentElement?.clientWidth ?? window.innerWidth;
    return Math.max(0, element.scrollWidth - viewportWidth);
  };

  return gsap.to(element, {
    x: () => -distance(),
    ease: "none",
    overwrite: "auto",
    scrollTrigger: {
      trigger: options.trigger ?? element.parentElement ?? element,
      start: options.start ?? "top top",
      end: () => `+=${Math.max(1, distance())}`,
      scrub: options.scrub ?? animationConfig.scrub,
      pin: options.pin ?? true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });
}

export function pinSection(
  target: Element | string,
  options: PinSectionOptions = {},
): ScrollTrigger | null {
  if (!canAnimate(target, true)) {
    restoreVisibleState(target);
    return null;
  }

  const { ScrollTrigger } = getGsap();
  return ScrollTrigger.create({
    trigger: target,
    pin: true,
    pinSpacing: options.pinSpacing ?? true,
    start: options.start ?? "top top",
    end: options.end ?? "+=100%",
    scrub: options.scrub,
    invalidateOnRefresh: true,
  });
}
