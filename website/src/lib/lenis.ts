// Lenis smooth-scroll. Auf Mobile + Reduced-Motion: bypass.

import Lenis from 'lenis';
import { isMobile } from './isMobile';
import { prefersReducedMotion } from './prefersReducedMotion';

let lenis: Lenis | null = null;

export const initLenis = (): Lenis | null => {
  if (prefersReducedMotion() || isMobile()) return null;
  if (lenis) return lenis;

  lenis = new Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 0,
  });

  const raf = (time: number) => {
    lenis?.raf(time);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);

  document.documentElement.classList.add('lenis');

  return lenis;
};

export const getLenis = (): Lenis | null => lenis;
