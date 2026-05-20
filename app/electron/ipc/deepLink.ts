// Handler für billsorter:// Deep-Links.
// Mac: app.on('open-url', ...)
// Win/Linux: second-instance arg vector.
// Format: billsorter://license?token=<JWT>&status=<status>

import { app, BrowserWindow } from 'electron';
import { IPC } from '@shared/types';
import { saveTokenFromDeepLink } from './license';
import { logger } from '../lib/logger';

let pendingUrl: string | null = null;

export const setupDeepLinkProtocol = (): void => {
  if (process.defaultApp) {
    // Dev-Mode: app.setAsDefaultProtocolClient mit --args
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('billsorter', process.execPath, [process.argv[1]]);
    }
  } else {
    app.setAsDefaultProtocolClient('billsorter');
  }

  // Mac
  app.on('open-url', (event, url) => {
    event.preventDefault();
    void handleUrl(url);
  });
};

export const checkPendingDeepLink = (argv: string[]): void => {
  for (const arg of argv) {
    if (arg.startsWith('billsorter://')) {
      void handleUrl(arg);
      return;
    }
  }
};

const handleUrl = async (url: string): Promise<void> => {
  logger.info('handling deep-link', url);
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith('//license') || parsed.host === 'license' || parsed.hostname === 'license') {
      const token = parsed.searchParams.get('token');
      const status = parsed.searchParams.get('status');
      if (token) {
        const result = await saveTokenFromDeepLink(token);
        broadcast({ kind: 'license', token, status, result });
      } else {
        broadcast({ kind: 'license', error: 'missing_token' });
      }
      return;
    }
    broadcast({ kind: 'unknown', url });
  } catch (e) {
    logger.warn('deep-link parse failed', e);
  }
};

const broadcast = (payload: Record<string, unknown>): void => {
  const wins = BrowserWindow.getAllWindows();
  if (wins.length === 0) {
    pendingUrl = JSON.stringify(payload);
    return;
  }
  for (const win of wins) {
    win.webContents.send(IPC.eventDeepLink, payload);
    if (win.isMinimized()) win.restore();
    win.focus();
  }
};

export const flushPendingDeepLink = (): void => {
  if (!pendingUrl) return;
  const payload = pendingUrl;
  pendingUrl = null;
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC.eventDeepLink, JSON.parse(payload));
  }
};
