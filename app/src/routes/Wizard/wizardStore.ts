import { create } from 'zustand';
import type { Locale, ProviderType } from '@shared/types';

export type WizardProviderDraft = {
  id: string;
  type: ProviderType;
  label: string;
  email: string;
  password: string;
  imapHost: string | null;
  imapPort: number | null;
};

type State = {
  step: number;
  locale: Locale;
  rechnungsOrdner: string | null;
  selectedProviderTypes: ProviderType[];
  providers: WizardProviderDraft[];
  scheduleHour: number;
  scheduleMinute: number;
  daysBack: number;
  scheduleEnabled: boolean;
  setStep: (step: number) => void;
  next: () => void;
  back: () => void;
  setLocale: (l: Locale) => void;
  setOrdner: (p: string) => void;
  setSelectedProviderTypes: (types: ProviderType[]) => void;
  upsertProvider: (p: WizardProviderDraft) => void;
  removeProvider: (id: string) => void;
  setSchedule: (s: { hour?: number; minute?: number; daysBack?: number; enabled?: boolean }) => void;
};

const MAX_STEP = 7;

export const useWizardStore = create<State>((set) => ({
  step: 0,
  locale: 'de',
  rechnungsOrdner: null,
  selectedProviderTypes: [],
  providers: [],
  scheduleHour: 9,
  scheduleMinute: 0,
  daysBack: 7,
  scheduleEnabled: true,
  setStep: (step) => set({ step }),
  next: () => set((s) => ({ step: Math.min(s.step + 1, MAX_STEP) })),
  back: () => set((s) => ({ step: Math.max(s.step - 1, 0) })),
  setLocale: (locale) => set({ locale }),
  setOrdner: (rechnungsOrdner) => set({ rechnungsOrdner }),
  setSelectedProviderTypes: (selectedProviderTypes) => set({ selectedProviderTypes }),
  upsertProvider: (p) =>
    set((s) => ({
      providers: s.providers.find((x) => x.id === p.id)
        ? s.providers.map((x) => (x.id === p.id ? p : x))
        : [...s.providers, p],
    })),
  removeProvider: (id) => set((s) => ({ providers: s.providers.filter((x) => x.id !== id) })),
  setSchedule: (s) =>
    set((prev) => ({
      scheduleHour: s.hour ?? prev.scheduleHour,
      scheduleMinute: s.minute ?? prev.scheduleMinute,
      daysBack: s.daysBack ?? prev.daysBack,
      scheduleEnabled: s.enabled ?? prev.scheduleEnabled,
    })),
}));
