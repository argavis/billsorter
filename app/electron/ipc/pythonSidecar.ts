// Verwaltet den Python-Sidecar-Prozess.
//   - spawnt mit --port-file und --token-file
//   - liest Port + Token aus den Files (Sidecar schreibt sie beim Start)
//   - Health-Check alle 5s
//   - Auto-Restart bei Crash mit Exponential-Backoff
//   - exponiert sidecar:request damit Renderer Calls über Main proxieren kann
//     (Token bleibt im Main, Renderer kennt ihn nie).

import { ipcMain, BrowserWindow } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import { IPC, type SidecarStatus } from '@shared/types';
import { sidecarPortFile, sidecarTokenFile, logsPath } from '../lib/platform';
import { resolveSidecar } from '../lib/sidecarBinary';
import { logger } from '../lib/logger';
import path from 'node:path';

let proc: ChildProcess | null = null;
let status: SidecarStatus = { state: 'stopped' };
let port: number | null = null;
let token: string | null = null;
let restartAttempt = 0;
let restartTimer: NodeJS.Timeout | null = null;
let healthTimer: NodeJS.Timeout | null = null;
let wantRunning = false;

const MAX_RESTART_DELAY_MS = 30_000;

export const startSidecar = async (): Promise<SidecarStatus> => {
  wantRunning = true;
  if (proc && !proc.killed) {
    return status;
  }
  await spawnSidecar();
  return status;
};

export const stopSidecar = async (): Promise<void> => {
  wantRunning = false;
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  if (healthTimer) {
    clearInterval(healthTimer);
    healthTimer = null;
  }
  if (proc && !proc.killed) {
    proc.kill('SIGTERM');
    // Force-kill nach 3s falls SIGTERM ignoriert wird.
    setTimeout(() => {
      if (proc && !proc.killed) proc.kill('SIGKILL');
    }, 3000);
  }
  proc = null;
  port = null;
  token = null;
  setStatus({ state: 'stopped' });
};

export const getStatus = (): SidecarStatus => status;
export const getPort = (): number | null => port;
export const getToken = (): string | null => token;

const setStatus = (next: SidecarStatus): void => {
  status = next;
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC.eventSidecarStatus, next);
  }
};

const spawnSidecar = async (): Promise<void> => {
  setStatus({ state: 'starting' });
  // Stale port/token-files entfernen.
  try { fs.unlinkSync(sidecarPortFile()); } catch { /* noop */ }
  try { fs.unlinkSync(sidecarTokenFile()); } catch { /* noop */ }

  const loc = resolveSidecar(sidecarPortFile(), sidecarTokenFile());
  logger.info('spawning sidecar:', loc.command, loc.args.join(' '));

  try {
    const stdoutLog = path.join(logsPath(), 'sidecar.log');
    fs.mkdirSync(logsPath(), { recursive: true });
    const out = fs.openSync(stdoutLog, 'a');
    const err = fs.openSync(stdoutLog, 'a');

    proc = spawn(loc.command, loc.args, {
      detached: false,
      stdio: ['ignore', out, err],
      env: { ...process.env },
    });
  } catch (e) {
    setStatus({ state: 'failed', error: (e as Error).message });
    scheduleRestart();
    return;
  }

  proc.on('exit', (code, sig) => {
    logger.warn('sidecar exited code=%s sig=%s', code, sig);
    proc = null;
    port = null;
    token = null;
    if (healthTimer) {
      clearInterval(healthTimer);
      healthTimer = null;
    }
    if (wantRunning) {
      setStatus({ state: 'failed', error: `exit code ${code}` });
      scheduleRestart();
    } else {
      setStatus({ state: 'stopped' });
    }
  });

  // Wait für port/token files.
  const started = await waitForPortToken(15_000);
  if (!started) {
    logger.error('sidecar did not write port/token within timeout');
    if (proc) proc.kill();
    setStatus({ state: 'failed', error: 'startup_timeout' });
    scheduleRestart();
    return;
  }

  port = started.port;
  token = started.token;
  restartAttempt = 0;
  setStatus({ state: 'ready', port });
  logger.info('sidecar ready on port', port);
  startHealthCheck();
};

const waitForPortToken = async (
  timeoutMs: number,
): Promise<{ port: number; token: string } | null> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(sidecarPortFile()) && fs.existsSync(sidecarTokenFile())) {
      try {
        const portStr = fs.readFileSync(sidecarPortFile(), 'utf-8').trim();
        const tokenStr = fs.readFileSync(sidecarTokenFile(), 'utf-8').trim();
        const p = Number(portStr);
        if (Number.isFinite(p) && p > 0 && tokenStr.length > 10) {
          return { port: p, token: tokenStr };
        }
      } catch {
        // race condition — sidecar still writing. Retry.
      }
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
};

const scheduleRestart = (): void => {
  if (!wantRunning) return;
  restartAttempt += 1;
  const delay = Math.min(1000 * 2 ** restartAttempt, MAX_RESTART_DELAY_MS);
  logger.info('sidecar restart in', delay, 'ms (attempt', restartAttempt, ')');
  restartTimer = setTimeout(() => {
    restartTimer = null;
    spawnSidecar();
  }, delay);
};

const startHealthCheck = (): void => {
  if (healthTimer) clearInterval(healthTimer);
  healthTimer = setInterval(async () => {
    if (status.state !== 'ready' || !port) return;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (!res.ok) {
        logger.warn('sidecar health-check non-ok:', res.status);
      }
    } catch (e) {
      logger.warn('sidecar health-check failed, will let process-exit trigger restart', e);
    }
  }, 5000);
};

// Renderer → Main → Sidecar Proxy
// Renderer ruft IPC mit { path, method, body }, Main fügt Authorization-Header hinzu.
export type SidecarRequest = {
  path: string;        // z.B. '/v1/test-imap'
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
};

export type SidecarResponse =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; error: string };

export const proxyRequest = async (req: SidecarRequest): Promise<SidecarResponse> => {
  if (status.state !== 'ready' || !port || !token) {
    return { ok: false, status: 0, error: 'sidecar_not_ready' };
  }
  try {
    const res = await fetch(`http://127.0.0.1:${port}${req.path}`, {
      method: req.method ?? 'GET',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: req.body ? JSON.stringify(req.body) : undefined,
    });
    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = text; }
    }
    if (!res.ok) {
      const errMsg =
        typeof data === 'object' && data && 'detail' in data
          ? String((data as { detail?: unknown }).detail)
          : `HTTP ${res.status}`;
      return { ok: false, status: res.status, error: errMsg };
    }
    return { ok: true, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, error: (e as Error).message };
  }
};

export const registerSidecarIpc = (): void => {
  ipcMain.handle(IPC.sidecarStatus, () => getStatus());
  ipcMain.handle(IPC.sidecarStart, () => startSidecar());
  ipcMain.handle(IPC.sidecarStop, () => stopSidecar());
  ipcMain.handle(IPC.sidecarRequest, async (_evt, req: SidecarRequest) => proxyRequest(req));
};
