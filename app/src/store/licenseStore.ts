import { create } from 'zustand';
import type { LicenseCheckResult } from '@shared/types';

type State = {
  license: LicenseCheckResult | null;
  daysRemaining: number | null;
  checking: boolean;
  trialStart: (locale: 'de' | 'en') => Promise<void>;
  check: () => Promise<void>;
  hydrate: () => () => void;
};

const detectOs = (): 'mac' | 'windows' | 'linux' => {
  const p = navigator.platform.toLowerCase();
  if (p.includes('mac')) return 'mac';
  if (p.includes('win')) return 'windows';
  return 'linux';
};

const computeDays = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
};

export const useLicenseStore = create<State>((set, get) => ({
  license: null,
  daysRemaining: null,
  checking: false,
  trialStart: async (locale) => {
    set({ checking: true });
    try {
      const result = await window.api.license.trialStart({
        appVersion: '0.1.0',
        os: detectOs(),
        locale,
      });
      set({
        license: result,
        daysRemaining: computeDays(result.trialEndsAt ?? result.expiresAt),
      });
    } finally {
      set({ checking: false });
    }
  },
  check: async () => {
    set({ checking: true });
    try {
      const result = await window.api.license.check({ appVersion: '0.1.0' });
      set({
        license: result,
        daysRemaining: computeDays(
          result.status === 'trial' ? result.trialEndsAt : result.expiresAt,
        ),
      });
    } finally {
      set({ checking: false });
    }
  },
  hydrate: () => {
    void get().check();
    return window.api.license.onChanged((result) => {
      set({
        license: result,
        daysRemaining: computeDays(
          result.status === 'trial' ? result.trialEndsAt : result.expiresAt,
        ),
      });
    });
  },
}));
