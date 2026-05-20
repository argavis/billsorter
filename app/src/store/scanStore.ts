import { create } from 'zustand';
import type { Job, LogLine } from '@shared/types';
import { useConfigStore } from './configStore';

type ProviderPayload = {
  id: string;
  provider_id: string;
  label: string;
  email: string;
  password: string;
  imap_host?: string | null;
  imap_port?: number | null;
};

type CommonPayload = {
  providers: ProviderPayload[];
  backend_url: string;
  device_id: string;
  target_folder: string;
  locale: 'de' | 'en';
};

type StartByDays = CommonPayload & { mode: 'days'; days_back: number };
type StartSince = CommonPayload & { mode: 'since'; since: string };

type State = {
  jobId: string | null;
  job: Job | null;
  logs: LogLine[];
  isRunning: boolean;
  startScan: (payload: StartByDays | StartSince) => Promise<void>;
  pollJob: () => Promise<void>;
  reset: () => void;
};

export const useScanStore = create<State>((set, get) => ({
  jobId: null,
  job: null,
  logs: [],
  isRunning: false,
  startScan: async (payload) => {
    set({ logs: [], jobId: null, job: null, isRunning: true });

    const path = payload.mode === 'since' ? '/v1/scan/since' : '/v1/scan';
    const { mode: _, ...rest } = payload;
    void _;

    const res = await window.api.sidecar.request({
      method: 'POST',
      path,
      body: rest,
    });
    if (!res.ok) {
      set({ isRunning: false });
      throw new Error(res.error);
    }
    const job = res.data as Job;
    set({ jobId: job.id, job });
    void get().pollJob();
  },
  pollJob: async () => {
    const jobId = get().jobId;
    if (!jobId) return;

    const sidecarStatus = await window.api.sidecar.status();
    if (sidecarStatus.state !== 'ready') return;

    const tick = async (): Promise<void> => {
      const jobRes = await window.api.sidecar.request({ path: `/v1/jobs/${jobId}` });
      if (jobRes.ok) {
        const j = jobRes.data as Job;
        set({ job: j });
        if (j.state === 'done' || j.state === 'failed') {
          set({ isRunning: false });
          if (j.state === 'done') {
            // lastRun + Stats-Akkumulator über configStore patchen,
            // damit React-State sich sofort aktualisiert.
            const cfg = useConfigStore.getState().config;
            void useConfigStore.getState().patch({
              lastRun: new Date().toISOString(),
              stats: {
                totalFound: (cfg?.stats.totalFound ?? 0) + (j.stats.found ?? 0),
                totalSaved: (cfg?.stats.totalSaved ?? 0) + (j.stats.saved ?? 0),
                totalSkipped:
                  (cfg?.stats.totalSkipped ?? 0) +
                  (j.stats.skippedNotInvoice ?? 0) +
                  (j.stats.skippedDuplicate ?? 0),
              },
            });
          }
          return;
        }
      }
      setTimeout(() => { void tick(); }, 1000);
    };
    void tick();
  },
  reset: () => set({ jobId: null, job: null, logs: [], isRunning: false }),
}));
