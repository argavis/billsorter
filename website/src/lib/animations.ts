// Zentrale GSAP-Setups + ScrollTrigger-Registration.
// Wird vom Base-Layout client-side geladen.

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from './prefersReducedMotion';
import { initLenis } from './lenis';

gsap.registerPlugin(ScrollTrigger);

let initialized = false;

export const initAnimations = (): void => {
  if (initialized) return;
  initialized = true;

  // Fade-up läuft jetzt via IntersectionObserver in Base.astro (robust).
  // Hier nur Enhancements: Lenis + ScrollTrigger-Bridge + BG-Morph.

  if (prefersReducedMotion()) return;

  const lenis = initLenis();
  if (lenis) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  setupBgMorph();
};

const setupBgMorph = (): void => {
  // Lese alle [data-bg]-Sections: BG morphs sanft zwischen ihnen.
  const sections = gsap.utils.toArray<HTMLElement>('[data-bg]');
  if (sections.length < 2) return;

  sections.forEach((sec) => {
    const bgColor = sec.dataset.bg!;
    const txtColor = sec.dataset.txt ?? '';
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 50%',
      end: 'bottom 50%',
      onEnter: () => animateBg(bgColor, txtColor),
      onEnterBack: () => animateBg(bgColor, txtColor),
    });
  });
};

const animateBg = (bg: string, txt: string): void => {
  gsap.to(document.body, {
    backgroundColor: bg,
    color: txt || 'inherit',
    duration: 0.6,
    ease: 'power2.out',
    overwrite: true,
  });
};

export const splitWords = (el: HTMLElement): HTMLElement[] => {
  // Eigener Splitter (statt GSAP SplitText) — split nach Wörtern, behält whitespace.
  const text = el.textContent ?? '';
  el.textContent = '';
  const words = text.split(/(\s+)/);
  const spans: HTMLElement[] = [];
  for (const w of words) {
    if (w.trim() === '') {
      el.appendChild(document.createTextNode(w));
    } else {
      const span = document.createElement('span');
      span.style.display = 'inline-block';
      span.textContent = w;
      el.appendChild(span);
      spans.push(span);
    }
  }
  return spans;
};
