// keytar-Wrapper. Service-Name "BillSorter".
// Keys: `imap:<email>` für IMAP-Passwörter, `anthropic` für API-Key, `license` für JWT.

import { ipcMain } from 'electron';
import keytar from 'keytar';
import { IPC } from '@shared/types';
import { logger } from '../lib/logger';

const SERVICE = 'BillSorter';

export const setSecret = async (key: string, value: string): Promise<void> => {
  await keytar.setPassword(SERVICE, key, value);
};

export const getSecret = async (key: string): Promise<string | null> => {
  return keytar.getPassword(SERVICE, key);
};

export const deleteSecret = async (key: string): Promise<boolean> => {
  return keytar.deletePassword(SERVICE, key);
};

export const listSecretKeys = async (): Promise<string[]> => {
  try {
    const all = await keytar.findCredentials(SERVICE);
    return all.map((entry) => entry.account);
  } catch (err) {
    logger.warn('keytar.findCredentials failed', err);
    return [];
  }
};

export const registerCredentialsIpc = (): void => {
  ipcMain.handle(IPC.credentialsSet, async (_evt, key: string, value: string) => {
    await setSecret(key, value);
    return { ok: true };
  });
  ipcMain.handle(IPC.credentialsGet, async (_evt, key: string) => {
    return getSecret(key);
  });
  ipcMain.handle(IPC.credentialsDelete, async (_evt, key: string) => {
    return deleteSecret(key);
  });
  ipcMain.handle(IPC.credentialsList, async () => {
    return listSecretKeys();
  });
};
