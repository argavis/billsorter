// Liest/schreibt <userData>/config.json. Validiert via Zod.

import { ipcMain } from 'electron';
import fs from 'node:fs';
import { z } from 'zod';
import { IPC, type AppConfig } from '@shared/types';
import { configFile } from '../lib/platform';
import { logger } from '../lib/logger';

const ProviderSchema = z.object({
  id: z.string(),
  type: z.enum([
    'outlook-365',
    'outlook-imap',
    'gmail-imap',
    'gmx',
    'web-de',
    'icloud',
    'yahoo',
    'ionos',
    'custom-imap',
  ]),
  label: z.string(),
  email: z.string(),
  imapHost: z.string().nullable(),
  imapPort: z.number().int().positive().nullable(),
  enabled: z.boolean(),
});

const AppConfigSchema = z.object({
  schemaVersion: z.literal(1),
  setupCompleted: z.boolean(),
  locale: z.enum(['de', 'en']),
  rechnungsOrdner: z.string().nullable(),
  schedule: z.object({
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
    daysBack: z.number().int().min(1).max(30),
    enabled: z.boolean(),
  }),
  lastRun: z.string().nullable(),
  providers: z.array(ProviderSchema),
  stats: z.object({
    totalFound: z.number().int().min(0),
    totalSaved: z.number().int().min(0),
    totalSkipped: z.number().int().min(0),
  }),
});

const DEFAULT_CONFIG: AppConfig = {
  schemaVersion: 1,
  setupCompleted: false,
  locale: 'de',
  rechnungsOrdner: null,
  schedule: { hour: 9, minute: 0, daysBack: 7, enabled: true },
  lastRun: null,
  providers: [],
  stats: { totalFound: 0, totalSaved: 0, totalSkipped: 0 },
};

let cached: AppConfig | null = null;

export const readConfig = (): AppConfig => {
  if (cached) return cached;
  const file = configFile();
  if (!fs.existsSync(file)) {
    cached = { ...DEFAULT_CONFIG };
    return cached;
  }
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(raw);
    const validated = AppConfigSchema.parse(parsed);
    cached = validated;
    return cached;
  } catch (err) {
    logger.error('config.json corrupt — falling back to default + backing up corrupt file', err);
    try {
      fs.renameSync(file, file + `.corrupt.${Date.now()}`);
    } catch (renameErr) {
      logger.warn('could not back up corrupt config', renameErr);
    }
    cached = { ...DEFAULT_CONFIG };
    return cached;
  }
};

export const writeConfig = (config: AppConfig): AppConfig => {
  const validated = AppConfigSchema.parse(config);
  fs.writeFileSync(configFile(), JSON.stringify(validated, null, 2), { mode: 0o600 });
  cached = validated;
  return cached;
};

const mergeConfig = (patch: Partial<AppConfig>): AppConfig => {
  const current = readConfig();
  const merged: AppConfig = {
    ...current,
    ...patch,
    schedule: { ...current.schedule, ...(patch.schedule ?? {}) },
    stats: { ...current.stats, ...(patch.stats ?? {}) },
    providers: patch.providers ?? current.providers,
  };
  return writeConfig(merged);
};

export const registerConfigIpc = (): void => {
  ipcMain.handle(IPC.configGet, () => readConfig());
  ipcMain.handle(IPC.configSet, (_evt, patch: Partial<AppConfig>) => mergeConfig(patch));
  ipcMain.handle(IPC.configReset, () => {
    cached = { ...DEFAULT_CONFIG };
    return writeConfig(cached);
  });
};
