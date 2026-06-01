/**
 * Auto-Update via electron-updater (GitHub Releases als Provider).
 *
 * Ablauf:
 *  1. Beim App-Start (nur im gepackten Build) auf neue Release-Version prüfen.
 *  2. Ist eine neuere Version verfügbar → Dialog "Update verfügbar (vX.X.X)".
 *  3. Bei Zustimmung: Download im Hintergrund.
 *  4. Fertig heruntergeladen → wird beim nächsten App-Start automatisch installiert
 *     (autoInstallOnAppQuit = true). Kein erzwungener Neustart.
 *
 * Wichtig: electron-updater ersetzt NUR das App-Bundle. User-Daten bleiben unberührt —
 * Keychain-Credentials (keytar) und config.json liegen im userData-Verzeichnis bzw. im
 * System-Keychain und werden vom Updater NICHT angefasst.
 */

import { app, dialog } from 'electron';
import pkg from 'electron-updater';
import { scoped } from './logger';

// electron-updater ist CJS — Default-Export destrukturieren.
const { autoUpdater } = pkg;

const log = scoped('updater');

let initialized = false;

export function initAutoUpdater(): void {
  // Im Dev-Mode (nicht gepackt) gibt es kein Update-Artefakt → überspringen.
  if (!app.isPackaged) {
    log.info('skip auto-update (not packaged)');
    return;
  }
  if (initialized) return;
  initialized = true;

  autoUpdater.logger = scoped('electron-updater') as unknown as typeof autoUpdater.logger;

  // Nicht automatisch laden — wir fragen den User erst per Dialog.
  autoUpdater.autoDownload = false;
  // Heruntergeladenes Update beim nächsten Quit/Start installieren (Default true, explizit).
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    log.info('update available:', info.version);
    void promptDownload(info.version);
  });

  autoUpdater.on('update-not-available', () => {
    log.info('no update available');
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('update downloaded:', info.version, '— installs on next start');
    void dialog.showMessageBox({
      type: 'info',
      title: 'Update bereit',
      message: `BillSorter ${info.version} wurde heruntergeladen.`,
      detail: 'Das Update wird beim nächsten Start automatisch installiert. Deine Einstellungen und Zugangsdaten bleiben erhalten.',
      buttons: ['OK'],
    });
  });

  autoUpdater.on('error', (err) => {
    log.error('auto-update error:', err);
  });

  // Prüfung anstoßen — Fehler nur loggen, nie den App-Start blockieren.
  autoUpdater.checkForUpdates().catch((err) => {
    log.warn('checkForUpdates failed:', err);
  });
}

async function promptDownload(version: string): Promise<void> {
  const { response } = await dialog.showMessageBox({
    type: 'info',
    title: 'Update verfügbar',
    message: `Update verfügbar (v${version})`,
    detail: 'Eine neue Version von BillSorter ist verfügbar. Jetzt im Hintergrund herunterladen? Die Installation erfolgt beim nächsten Start. Deine Einstellungen und Zugangsdaten bleiben erhalten.',
    buttons: ['Jetzt herunterladen', 'Später'],
    defaultId: 0,
    cancelId: 1,
  });

  if (response === 0) {
    log.info('user accepted update download');
    autoUpdater.downloadUpdate().catch((err) => {
      log.error('downloadUpdate failed:', err);
    });
  } else {
    log.info('user postponed update');
  }
}
