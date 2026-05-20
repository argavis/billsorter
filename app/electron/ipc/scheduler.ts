// Cross-Platform Scheduler.
// Mac: ~/Library/LaunchAgents/de.argavis.billsorter.plist + `launchctl bootstrap`.
// Windows: schtasks /Create /SC DAILY ...
//
// Trigger der App via `--scheduled-run` argv. Electron-Main erkennt das Flag
// und feuert direkt einen Scan an, ohne UI zu öffnen.

import { ipcMain, app } from 'electron';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { IPC } from '@shared/types';
import { isMac, isWin } from '../lib/platform';
import { logger } from '../lib/logger';

const execFileP = promisify(execFile);

const LABEL = 'de.argavis.billsorter';
const TASK_NAME = 'BillSorter';

export type ScheduleSpec = { hour: number; minute: number };

export const registerSchedulerIpc = (): void => {
  ipcMain.handle(IPC.schedulerInstall, async (_evt, spec: ScheduleSpec) => {
    return installSchedule(spec);
  });
  ipcMain.handle(IPC.schedulerUninstall, async () => {
    return uninstallSchedule();
  });
  ipcMain.handle(IPC.schedulerStatus, async () => {
    return scheduleStatus();
  });
};

const installSchedule = async (spec: ScheduleSpec): Promise<{ ok: boolean; error?: string }> => {
  try {
    if (isMac) await installMac(spec);
    else if (isWin) await installWin(spec);
    else return { ok: false, error: 'unsupported_platform' };
    return { ok: true };
  } catch (e) {
    logger.error('schedule install failed', e);
    return { ok: false, error: (e as Error).message };
  }
};

const uninstallSchedule = async (): Promise<{ ok: boolean; error?: string }> => {
  try {
    if (isMac) await uninstallMac();
    else if (isWin) await uninstallWin();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
};

const scheduleStatus = async (): Promise<{ installed: boolean; nextRun?: string }> => {
  if (isMac) {
    const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
    return { installed: fs.existsSync(plistPath) };
  }
  if (isWin) {
    try {
      const { stdout } = await execFileP('schtasks', ['/Query', '/TN', TASK_NAME]);
      return { installed: stdout.includes(TASK_NAME) };
    } catch {
      return { installed: false };
    }
  }
  return { installed: false };
};

// ───── macOS ─────

const installMac = async (spec: ScheduleSpec): Promise<void> => {
  const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
  fs.mkdirSync(path.dirname(plistPath), { recursive: true });

  const appBinary = process.execPath;
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escapeXml(appBinary)}</string>
    <string>--scheduled-run</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>${spec.hour}</integer>
    <key>Minute</key><integer>${spec.minute}</integer>
  </dict>
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>${escapeXml(path.join(os.homedir(), 'Library', 'Logs', 'BillSorter', 'scheduler.log'))}</string>
  <key>StandardErrorPath</key><string>${escapeXml(path.join(os.homedir(), 'Library', 'Logs', 'BillSorter', 'scheduler.log'))}</string>
</dict>
</plist>
`;
  fs.writeFileSync(plistPath, plist, 'utf-8');

  // Reload via launchctl. Wir ignorieren bootout-Fehler falls vorher nicht geladen.
  const uid = process.getuid?.() ?? 501;
  try {
    await execFileP('launchctl', ['bootout', `gui/${uid}/${LABEL}`]);
  } catch {
    // not loaded — fine
  }
  await execFileP('launchctl', ['bootstrap', `gui/${uid}`, plistPath]);
};

const uninstallMac = async (): Promise<void> => {
  const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
  const uid = process.getuid?.() ?? 501;
  try {
    await execFileP('launchctl', ['bootout', `gui/${uid}/${LABEL}`]);
  } catch {
    // ignore
  }
  if (fs.existsSync(plistPath)) {
    fs.unlinkSync(plistPath);
  }
};

// ───── Windows ─────

const installWin = async (spec: ScheduleSpec): Promise<void> => {
  const appBinary = process.execPath;
  const time = `${pad(spec.hour)}:${pad(spec.minute)}`;
  // /F = force overwrite. /SC DAILY läuft täglich um Time.
  await execFileP('schtasks', [
    '/Create',
    '/F',
    '/SC', 'DAILY',
    '/TN', TASK_NAME,
    '/TR', `"${appBinary}" --scheduled-run`,
    '/ST', time,
  ]);
};

const uninstallWin = async (): Promise<void> => {
  try {
    await execFileP('schtasks', ['/Delete', '/F', '/TN', TASK_NAME]);
  } catch {
    // ignore — not present
  }
};

const pad = (n: number): string => String(n).padStart(2, '0');

const escapeXml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

// Avoid unused import in non-Mac/Win builds.
void app;
