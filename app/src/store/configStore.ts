import { create } from 'zustand';
import type { AppConfig, Locale } from '@shared/types';

type State = {
  config: AppConfig | null;
  loading: boolean;
  load: () => Promise<void>;
  setLocale: (locale: Locale) => Promise<void>;
  patch: (patch: Partial<AppConfig>) => Promise<AppConfig>;
};

export const useConfigStore = create<State>((set) => ({
  config: null,
  loading: true,
  load: async () => {
    const cfg = await window.api.config.get();
    set({ config: cfg, loading: false });
  },
  setLocale: async (locale) => {
    const cfg = await window.api.config.set({ locale });
    set({ config: cfg });
  },
  patch: async (patch) => {
    const cfg = await window.api.config.set(patch);
    set({ config: cfg });
    return cfg;
  },
}));
