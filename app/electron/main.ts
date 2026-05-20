import { app, BrowserWindow, protocol, shell } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { logger } from './lib/logger';

// Privileged-Scheme MUSS vor app.whenReady registriert werden.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      allowServiceWorkers: false,
      stream: true,
    },
  },
]);
import { registerConfigIpc } from './ipc/config';
import { registerCredentialsIpc } from './ipc/credentials';
import { registerSidecarIpc, startSidecar, stopSidecar } from './ipc/pythonSidecar';
import { registerLicenseIpc } from './ipc/license';
import { registerFilesystemIpc } from './ipc/filesystem';
import { registerSchedulerIpc } from './ipc/scheduler';
import { registerSystemIpc } from './ipc/system';
import { setupDeepLinkProtocol, checkPendingDeepLink, flushPendingDeepLink } from './ipc/deepLink';

const isScheduledRun = process.argv.includes('--scheduled-run');

let mainWindow: BrowserWindow | null = null;

const resolveIconPath = (): string => {
  // out/main/index.js → __dirname = out/main → ../../resources/icon.png
  return path.join(__dirname, '..', '..', 'resources', 'icon.png');
};

const createWindow = (): BrowserWindow => {
  const win = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 880,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#FAFAFA',
    title: 'BillSorter',
    icon: resolveIconPath(),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.on('ready-to-show', () => {
    if (!isScheduledRun) win.show();
    if (!app.isPackaged) {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  });

  win.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // Renderer-Fehler loggen damit wir sie auch ohne offene DevTools sehen.
  win.webContents.on('render-process-gone', (_e, details) => {
    logger.error('renderer process gone:', details);
  });
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    logger.error('renderer failed to load:', { code, desc, url });
  });
  // Electron <33 ruft mit (event, level, message, line, sourceId), >=33 mit (event{level,message,...}).
  win.webContents.on('console-message', ((...args: unknown[]) => {
    const e = args[0] as { level?: unknown; message?: string; sourceId?: string; lineNumber?: number } | undefined;
    if (e && typeof e === 'object' && typeof e.message === 'string') {
      logger.info(`[renderer ${e.level ?? 'info'}] ${e.message} (${e.sourceId ?? '?'}:${e.lineNumber ?? '?'})`);
    } else if (typeof args[1] === 'number' || typeof args[1] === 'string') {
      logger.info(`[renderer ${args[1]}] ${args[2]} (${args[4]}:${args[3]})`);
    }
  }) as never);

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadURL('app://renderer/index.html');
  }

  return win;
};

const ensureSingleInstance = (): boolean => {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return false;
  }
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    checkPendingDeepLink(argv);
  });
  return true;
};

const registerAllIpc = (): void => {
  registerConfigIpc();
  registerCredentialsIpc();
  registerSidecarIpc();
  registerLicenseIpc();
  registerFilesystemIpc();
  registerSchedulerIpc();
  registerSystemIpc();
};

const registerAppProtocol = (): void => {
  // out/main/index.js → __dirname = out/main → ../renderer = out/renderer
  const rendererRoot = path.join(__dirname, '..', 'renderer');
  protocol.handle('app', async (request) => {
    try {
      const url = new URL(request.url);
      // app://renderer/index.html → pathname = /index.html
      // app://renderer/assets/foo.js → pathname = /assets/foo.js
      let relPath = decodeURIComponent(url.pathname);
      if (relPath === '/' || relPath === '') relPath = '/index.html';
      // Strip leading slash for join
      relPath = relPath.replace(/^\/+/, '');
      const filePath = path.join(rendererRoot, relPath);
      // Path-traversal-Schutz
      if (!filePath.startsWith(rendererRoot)) {
        return new Response('Forbidden', { status: 403 });
      }
      if (!fs.existsSync(filePath)) {
        logger.warn('app:// 404', filePath);
        return new Response('Not found', { status: 404 });
      }
      const data = await fs.promises.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mime: Record<string, string> = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.mjs': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.map': 'application/json; charset=utf-8',
      };
      const contentType = mime[ext] ?? 'application/octet-stream';
      return new Response(data, { headers: { 'content-type': contentType } });
    } catch (err) {
      logger.error('app:// handler error', err);
      return new Response('Internal error', { status: 500 });
    }
  });
  void pathToFileURL; // import not unused
};

app.whenReady().then(async () => {
  if (!ensureSingleInstance()) return;

  electronApp.setAppUserModelId('de.argavis.billsorter');

  // Mac: Dock-Icon im Dev-Mode setzen. Im Packaged-Build kommt es aus der .icns.
  if (process.platform === 'darwin' && !app.isPackaged) {
    try {
      const { nativeImage } = await import('electron');
      const img = nativeImage.createFromPath(resolveIconPath());
      if (!img.isEmpty()) app.dock?.setIcon(img);
    } catch (e) {
      logger.warn('failed to set dock icon', e);
    }
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  registerAppProtocol();
  setupDeepLinkProtocol();
  registerAllIpc();

  await startSidecar().catch((e) => logger.error('startSidecar threw', e));

  mainWindow = createWindow();
  flushPendingDeepLink();
  checkPendingDeepLink(process.argv);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    void stopSidecar().finally(() => app.quit());
  }
});

app.on('before-quit', async (event) => {
  // Sidecar sauber stoppen.
  event.preventDefault();
  await stopSidecar().catch(() => undefined);
  app.exit(0);
});
