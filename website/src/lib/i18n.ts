// i18n-Client-Layer. Renderer schreibt `data-i18n-key="hero.headline_a"` ins HTML.
// JS hydratet beim Mount und re-rendert beim Sprach-Toggle.
//
// SSR setzt initial DE oder EN (Browser-Header `Accept-Language` lesen via Astro
// `Astro.preferredLocale` o.ä.). Im Body schreibt JS dann eine evtl. abweichende
// gespeicherte Wahl aus localStorage rein.

import de from '@content/de.json';
import en from '@content/en.json';

export type Locale = 'de' | 'en';
export type Strings = typeof de;

const dictionaries: Record<Locale, Strings> = { de, en };

const KEY = 'billsorter.lang';

export const getStoredLang = (): Locale | null => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'de' || v === 'en') return v;
  } catch {
    /* SSR / no storage */
  }
  return null;
};

export const detectBrowserLang = (): Locale => {
  if (typeof navigator === 'undefined') return 'de';
  const langs = (navigator.languages ?? [navigator.language]).map((l) => l.toLowerCase());
  for (const l of langs) {
    if (l.startsWith('de')) return 'de';
    if (l.startsWith('en')) return 'en';
  }
  return 'en';
};

export const initialLang = (): Locale =>
  getStoredLang() ?? detectBrowserLang();

export const setLang = (lang: Locale): void => {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = lang;
  applyTranslations(lang);
  // Event for components that need to re-render manually (e.g. SVG text)
  window.dispatchEvent(new CustomEvent('lang:change', { detail: { lang } }));
};

export const t = (key: string, lang: Locale = 'de'): string => {
  const dict = dictionaries[lang];
  const parts = key.split('.');
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return key;
    }
  }
  return typeof cur === 'string' ? cur : key;
};

export const applyTranslations = (lang: Locale): void => {
  document.querySelectorAll<HTMLElement>('[data-i18n-key]').forEach((el) => {
    const key = el.dataset.i18nKey!;
    el.textContent = t(key, lang);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-attr]').forEach((el) => {
    // Form: data-i18n-attr="alt:hero.scroll,title:nav.lang_label"
    const spec = el.dataset.i18nAttr!;
    spec.split(',').forEach((pair) => {
      const [attr, key] = pair.split(':');
      if (attr && key) el.setAttribute(attr.trim(), t(key.trim(), lang));
    });
  });
  // Update <html lang>
  document.documentElement.lang = lang;
  // Toggle visual state on lang buttons
  document.querySelectorAll<HTMLButtonElement>('[data-lang-btn]').forEach((btn) => {
    const isActive = btn.dataset.langBtn === lang;
    btn.dataset.active = String(isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });
  // Title-tag mit übersetztem Wert versorgen
  const titleEl = document.querySelector<HTMLTitleElement>('title');
  if (titleEl) titleEl.textContent = t('meta.title', lang);
};

export const hydrate = (): void => {
  const lang = initialLang();
  applyTranslations(lang);
};

export const dictionariesExport = dictionaries;
