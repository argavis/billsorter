import { app } from 'electron';
import path from 'node:path';

export const isMac = process.platform === 'darwin';
export const isWin = process.platform === 'win32';
export const isLinux = process.platform === 'linux';

export const userDataPath = (): string => app.getPath('userData');

export const logsPath = (): string => {
  const base = isMac
    ? path.join(app.getPath('home'), 'Library', 'Logs', 'BillSorter')
    : path.join(app.getPath('userData'), 'logs');
  return base;
};

export const sidecarPortFile = (): string => path.join(userDataPath(), 'sidecar.port');
export const sidecarTokenFile = (): string => path.join(userDataPath(), 'sidecar.token');
export const configFile = (): string => path.join(userDataPath(), 'config.json');
