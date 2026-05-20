import { create } from 'zustand';
import type { SidecarStatus } from '@shared/types';

type State = {
  status: SidecarStatus;
  hydrate: () => () => void;
};

export const useSidecarStore = create<State>((set) => ({
  status: { state: 'stopped' },
  hydrate: () => {
    void window.api.sidecar.status().then((s) => set({ status: s }));
    return window.api.sidecar.onStatus((s) => set({ status: s }));
  },
}));
