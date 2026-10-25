import { animationConfig } from "../config/animation.config";
import { featuresConfig } from "../config/features.config";
import { getGsap } from "./gsap";

type GsapApi = ReturnType<typeof getGsap>["gsap"];
type ScrollTriggerApi = ReturnType<typeof getGsap>["ScrollTrigger"];

export type MotionCleanup = () => void;
export type MotionScope = Element | string;

export interface MotionMediaConditions {
  reduceMotion: boolean;
  allowMotion: boolean;
  mobile: boolean;
  desktop: boolean;
  finePointer: boolean;
  heavyMotion: boolean;
}

export interface MotionSetupContext {
  gsap: GsapApi;
  ScrollTrigger: ScrollTriggerApi;
  scope: Element;
  conditions: MotionMediaConditions;
  select: <T extends Element = HTMLElement>(selector: string) => T[];
}

export type MotionSetup = (
  context: MotionSetupContext,
) => MotionCleanup | void;

export interface MotionOptions {
  scope?: MotionScope;
  enabled?: boolean;
  disableOnMobile?: boolean;
}

export interface MotionController {
  readonly id: string;
  readonly active: boolean;
  destroy: () => void;
  refresh: () => void;
}

const controllers = new Map<string, MotionController>();

function createInactiveController(id: string): MotionController {
  return {
    id,
    active: false,
    destroy: () => undefined,
    refresh: () => undefined,
  };
}

function resolveScope(scope?: MotionScope): Element | null {
  if (typeof document === "undefined") {
    return null;
  }

  if (!scope) {
    return document.documentElement;
  }

  return typeof scope === "string" ? document.querySelector(scope) : scope;
}

function clearMotionStyles(scope: Element, gsap: GsapApi): void {
  const descendants = Array.from(scope.querySelectorAll<HTMLElement>("[data-motion]"));
  const targets = scope.matches("[data-motion]")
    ? [scope as HTMLElement, ...descendants]
    : descendants;

  if (targets.length > 0) {
    gsap.set(targets, {
      clearProps: "opacity,visibility,transform,clipPath",
    });
  }
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(animationConfig.mediaQueries.reducedMotion).matches
  );
}

export function isMotionAllowed(heavy = false): boolean {
  if (
    typeof window === "undefined" ||
    !featuresConfig.animations ||
    prefersReducedMotion()
  ) {
    return false;
  }

  if (!heavy) {
    return true;
  }

  return (
    featuresConfig.heavyAnimations &&
    window.matchMedia(animationConfig.mediaQueries.heavyMotion).matches
  );
}

/**
 * Initialise un groupe d'animations isolé. Un identifiant réutilisé détruit
 * d'abord l'ancienne instance afin d'éviter les doubles initialisations.
 */
export function initMotion(
  id: string,
  setup: MotionSetup,
  options: MotionOptions = {},
): MotionController {
  destroyMotion(id);

  const scope = resolveScope(options.scope);
  if (!scope || typeof window === "undefined") {
    return createInactiveController(id);
  }

  const { gsap, ScrollTrigger } = getGsap();
  const enabled = featuresConfig.animations && (options.enabled ?? true);

  if (!enabled) {
    clearMotionStyles(scope, gsap);
    return createInactiveController(id);
  }

  const media = gsap.matchMedia(scope);
  let destroyed = false;

  media.add(
    {
      reduceMotion: animationConfig.mediaQueries.reducedMotion,
      allowMotion: animationConfig.mediaQueries.motionAllowed,
      mobile: animationConfig.mediaQueries.mobile,
      desktop: animationConfig.mediaQueries.desktop,
      finePointer: animationConfig.mediaQueries.finePointer,
      heavyMotion: animationConfig.mediaQueries.heavyMotion,
    },
    (mediaContext) => {
      const rawConditions = mediaContext.conditions;
      const conditions: MotionMediaConditions = {
        reduceMotion: Boolean(rawConditions?.reduceMotion),
        allowMotion: Boolean(rawConditions?.allowMotion),
        mobile: Boolean(rawConditions?.mobile),
        desktop: Boolean(rawConditions?.desktop),
        finePointer: Boolean(rawConditions?.finePointer),
        heavyMotion: Boolean(rawConditions?.heavyMotion),
      };

      if (
        conditions.reduceMotion ||
        !conditions.allowMotion ||
        (options.disableOnMobile && conditions.mobile)
      ) {
        clearMotionStyles(scope, gsap);
        return undefined;
      }

      let customCleanup: MotionCleanup | void;
      const gsapContext = gsap.context(() => {
        customCleanup = setup({
          gsap,
          ScrollTrigger,
          scope,
          conditions,
          select: <T extends Element = HTMLElement>(selector: string) =>
            Array.from(scope.querySelectorAll<T>(selector)),
        });
      }, scope);

      return () => {
        try {
          customCleanup?.();
        } finally {
          gsapContext.revert();
        }
      };
    },
  );

  const controller: MotionController = {
    id,
    get active() {
      return !destroyed;
    },
    destroy() {
      if (destroyed) {
        return;
      }

      destroyed = true;
      media.revert();

      if (controllers.get(id) === controller) {
        controllers.delete(id);
      }
    },
    refresh() {
      if (!destroyed) {
        ScrollTrigger.refresh();
      }
    },
  };

  controllers.set(id, controller);
  return controller;
}

export function destroyMotion(id: string): void {
  controllers.get(id)?.destroy();
}

export function destroyAllMotion(): void {
  Array.from(controllers.values()).forEach((controller) => controller.destroy());
}
