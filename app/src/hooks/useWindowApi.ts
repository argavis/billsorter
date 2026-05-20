// Convenience-Hook: gibt window.api typsicher zurück.
// Falls Preload nicht geladen ist (z.B. im Vite-Dev mit forgotten Bridge), schmeißen wir früh.

import type { RendererApi } from '../../electron/preload';

export const useWindowApi = (): RendererApi => {
  if (typeof window === 'undefined' || !window.api) {
    throw new Error('window.api not available — Electron preload missing');
  }
  return window.api;
};
