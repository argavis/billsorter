// Geteilte Typen zwischen Main + Preload + Renderer.
// Nur Daten-Strukturen — keine Logik, keine Node-/Electron-Imports.

export type Locale = 'de' | 'en';

export type ProviderType =
  | 'outlook-365'
  | 'outlook-imap'
  | 'gmail-imap'
  | 'gmx'
  | 'web-de'
  | 'icloud'
  | 'yahoo'
  | 'ionos'
  | 'custom-imap';

export type ProviderConfigPublic = {
  id: string;
  type: ProviderType;
  label: string;
  email: string;
  imapHost: string | null; // null = aus Preset ableiten
  imapPort: number | null;
  enabled: boolean;
};

// Vollständige Provider-Konfig inkl. Passwort — kommt nur transient aus dem
// Main-Process (nachdem keytar gelesen hat), wird nie im Renderer persistiert.
export type ProviderConfigWithPassword = ProviderConfigPublic & {
  password: string;
};

export type AppConfig = {
  schemaVersion: 1;
  setupCompleted: boolean;
  locale: Locale;
  rechnungsOrdner: string | null;
  schedule: {
    hour: number;   // 0–23
    minute: number; // 0–59
    daysBack: number; // 1–30
    enabled: boolean;
  };
  lastRun: string | null; // ISO-8601
  providers: ProviderConfigPublic[];
  stats: {
    totalFound: number;
    totalSaved: number;
    totalSkipped: number;
  };
};

export type LicenseStatus = 'trial' | 'active' | 'grace' | 'expired' | 'revoked' | 'unverified';

export type LicenseCheckResult = {
  status: LicenseStatus;
  expiresAt: string;
  trialEndsAt: string | null;
  graceDays: number;
  token: string | null;
};

export type SidecarStatus =
  | { state: 'stopped' }
  | { state: 'starting' }
  | { state: 'ready'; port: number }
  | { state: 'failed'; error: string };

export type JobStats = {
  found: number;
  saved: number;
  skippedDuplicate: number;
  skippedNotInvoice: number;
  errors: number;
};

export type Job = {
  id: string;
  state: 'pending' | 'running' | 'done' | 'failed';
  startedAt: string | null;
  finishedAt: string | null;
  stats: JobStats;
  error: string | null;
};

export type LogLine = {
  jobId: string;
  ts: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
};

export type TestImapResult = {
  providerId: string;
  label: string;
  ok: boolean;
  error: string | null;
  mailboxCount: number | null;
};

// IPC Channel names — Zentrale Quelle für Main + Preload + Renderer.
export const IPC = {
  // config
  configGet: 'config:get',
  configSet: 'config:set',
  configReset: 'config:reset',
  // credentials
  credentialsSet: 'credentials:set',
  credentialsGet: 'credentials:get',
  credentialsDelete: 'credentials:delete',
  credentialsList: 'credentials:list',
  // sidecar
  sidecarStatus: 'sidecar:status',
  sidecarStart: 'sidecar:start',
  sidecarStop: 'sidecar:stop',
  sidecarRequest: 'sidecar:request',
  // license
  licenseTrialStart: 'license:trialStart',
  licenseCheck: 'license:check',
  licenseCheckout: 'license:checkout',
  licensePortal: 'license:portal',
  licenseGetCached: 'license:getCached',
  licenseVerifyLocal: 'license:verifyLocal',
  // filesystem
  fsPickFolder: 'fs:pickFolder',
  fsValidateWrite: 'fs:validateWrite',
  // scheduler
  schedulerInstall: 'scheduler:install',
  schedulerUninstall: 'scheduler:uninstall',
  schedulerStatus: 'scheduler:status',
  // system
  systemGetDeviceId: 'system:getDeviceId',
  systemOpenExternal: 'system:openExternal',
  systemLocale: 'system:locale',
  systemBackendUrl: 'system:backendUrl',
  // events (main → renderer)
  eventDeepLink: 'event:deepLink',
  eventSidecarStatus: 'event:sidecarStatus',
  eventLicenseChanged: 'event:licenseChanged',
} as const;
