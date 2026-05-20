import { ipcMain, shell, app } from 'electron';
import { IPC } from '@shared/types';
import { getRawDeviceId } from '../lib/deviceId';
import { apiBaseUrl } from '../lib/api';

export const registerSystemIpc = (): void => {
  ipcMain.handle(IPC.systemGetDeviceId, () => getRawDeviceId());

  ipcMain.handle(IPC.systemOpenExternal, async (_evt, url: string) => {
    if (!/^https?:\/\//.test(url)) return { ok: false, error: 'invalid_protocol' };
    await shell.openExternal(url);
    return { ok: true };
  });

  ipcMain.handle(IPC.systemLocale, () => {
    const sys = app.getLocale().toLowerCase();
    if (sys.startsWith('de')) return 'de';
    return 'en';
  });

  ipcMain.handle(IPC.systemBackendUrl, () => apiBaseUrl());
};
