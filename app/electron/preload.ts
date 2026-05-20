import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/types';
import type {
  AppConfig,
  LicenseCheckResult,
  Locale,
  LogLine,
  SidecarStatus,
  TestImapResult,
  Job,
} from '@shared/types';

type SidecarRequest = {
  path: string;
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
};
type SidecarResponse =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; error: string };

const api = {
  config: {
    get: (): Promise<AppConfig> => ipcRenderer.invoke(IPC.configGet),
    set: (patch: Partial<AppConfig>): Promise<AppConfig> => ipcRenderer.invoke(IPC.configSet, patch),
    reset: (): Promise<AppConfig> => ipcRenderer.invoke(IPC.configReset),
  },

  credentials: {
    set: (key: string, value: string) => ipcRenderer.invoke(IPC.credentialsSet, key, value),
    get: (key: string): Promise<string | null> => ipcRenderer.invoke(IPC.credentialsGet, key),
    delete: (key: string): Promise<boolean> => ipcRenderer.invoke(IPC.credentialsDelete, key),
    list: (): Promise<string[]> => ipcRenderer.invoke(IPC.credentialsList),
  },

  sidecar: {
    status: (): Promise<SidecarStatus> => ipcRenderer.invoke(IPC.sidecarStatus),
    start: (): Promise<SidecarStatus> => ipcRenderer.invoke(IPC.sidecarStart),
    stop: (): Promise<void> => ipcRenderer.invoke(IPC.sidecarStop),
    request: (req: SidecarRequest): Promise<SidecarResponse> =>
      ipcRenderer.invoke(IPC.sidecarRequest, req),
    onStatus: (cb: (s: SidecarStatus) => void) => {
      const handler = (_e: unknown, status: SidecarStatus) => cb(status);
      ipcRenderer.on(IPC.eventSidecarStatus, handler);
      return () => ipcRenderer.removeListener(IPC.eventSidecarStatus, handler);
    },
  },

  license: {
    trialStart: (
      req: { appVersion: string; os: 'mac' | 'windows' | 'linux'; locale: Locale },
    ): Promise<LicenseCheckResult> => ipcRenderer.invoke(IPC.licenseTrialStart, req),
    check: (req: { appVersion: string }): Promise<LicenseCheckResult> =>
      ipcRenderer.invoke(IPC.licenseCheck, req),
    checkout: (req: { locale: Locale }): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.licenseCheckout, req),
    portal: (): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.licensePortal, {}),
    getCached: () => ipcRenderer.invoke(IPC.licenseGetCached),
    verifyLocal: (token: string) => ipcRenderer.invoke(IPC.licenseVerifyLocal, token),
    onChanged: (cb: (r: LicenseCheckResult) => void) => {
      const handler = (_e: unknown, result: LicenseCheckResult) => cb(result);
      ipcRenderer.on(IPC.eventLicenseChanged, handler);
      return () => ipcRenderer.removeListener(IPC.eventLicenseChanged, handler);
    },
  },

  filesystem: {
    pickFolder: (
      options?: { defaultPath?: string; title?: string },
    ): Promise<{ canceled: boolean; path: string | null }> =>
      ipcRenderer.invoke(IPC.fsPickFolder, options),
    validateWrite: (
      folderPath: string,
    ): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.fsValidateWrite, folderPath),
  },

  scheduler: {
    install: (
      spec: { hour: number; minute: number },
    ): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.schedulerInstall, spec),
    uninstall: (): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.schedulerUninstall),
    status: (): Promise<{ installed: boolean; nextRun?: string }> =>
      ipcRenderer.invoke(IPC.schedulerStatus),
  },

  system: {
    getDeviceId: (): Promise<string> => ipcRenderer.invoke(IPC.systemGetDeviceId),
    openExternal: (url: string) => ipcRenderer.invoke(IPC.systemOpenExternal, url),
    getLocale: (): Promise<Locale> => ipcRenderer.invoke(IPC.systemLocale),
    getBackendUrl: (): Promise<string> => ipcRenderer.invoke(IPC.systemBackendUrl),
  },

  events: {
    onDeepLink: (cb: (payload: Record<string, unknown>) => void) => {
      const handler = (_e: unknown, payload: Record<string, unknown>) => cb(payload);
      ipcRenderer.on(IPC.eventDeepLink, handler);
      return () => ipcRenderer.removeListener(IPC.eventDeepLink, handler);
    },
  },
};

contextBridge.exposeInMainWorld('api', api);
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  versions: process.versions,
});

export type RendererApi = typeof api;
// Re-export von shared für Renderer-Side-Imports unter window.api Typ.
export type { AppConfig, LicenseCheckResult, SidecarStatus, TestImapResult, Job, LogLine };
