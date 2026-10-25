export interface AnimationConfig {
  duration: {
    fast: number;
    normal: number;
    slow: number;
  };
  ease: string;
  revealOffset: {
    x: number;
    y: number;
  };
  stagger: number;
  scrollTriggerStart: string;
  parallaxAmount: number;
  scrub: number;
  mobileDistanceScale: number;
  mediaQueries: {
    reducedMotion: string;
    motionAllowed: string;
    mobile: string;
    desktop: string;
    finePointer: string;
    heavyMotion: string;
  };
}

export const animationConfig = {
  duration: {
    fast: 0.15,
    normal: 0.3,
    slow: 0.6,
  },
  ease: "power3.out",
  revealOffset: {
    x: 0,
    y: 32,
  },
  stagger: 0.08,
  scrollTriggerStart: "top 85%",
  parallaxAmount: 12,
  scrub: 0.6,
  mobileDistanceScale: 0.65,
  mediaQueries: {
    reducedMotion: "(prefers-reduced-motion: reduce)",
    motionAllowed: "(prefers-reduced-motion: no-preference)",
    mobile: "(max-width: 47.999rem)",
    desktop: "(min-width: 64rem)",
    finePointer: "(pointer: fine)",
    heavyMotion:
      "(min-width: 64rem) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
  },
} as const satisfies AnimationConfig;
