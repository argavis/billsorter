import { ipcMain, dialog, BrowserWindow, app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { IPC } from '@shared/types';

export const registerFilesystemIpc = (): void => {
  ipcMain.handle(IPC.fsPickFolder, async (evt, options?: { defaultPath?: string; title?: string }) => {
    const win = BrowserWindow.fromWebContents(evt.sender);
    const dialogParent = win ?? undefined;
    const result = dialogParent
      ? await dialog.showOpenDialog(dialogParent, {
          properties: ['openDirectory', 'createDirectory'],
          defaultPath: options?.defaultPath ?? path.join(app.getPath('documents'), 'Rechnungen'),
          title: options?.title ?? 'Buchhaltungs-Ordner wählen',
        })
      : await dialog.showOpenDialog({
          properties: ['openDirectory', 'createDirectory'],
          defaultPath: options?.defaultPath ?? path.join(app.getPath('documents'), 'Rechnungen'),
          title: options?.title ?? 'Buchhaltungs-Ordner wählen',
        });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, path: null };
    }
    return { canceled: false, path: result.filePaths[0] };
  });

  ipcMain.handle(IPC.fsValidateWrite, async (_evt, folderPath: string) => {
    try {
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      const probe = path.join(folderPath, `.billsorter-write-test-${Date.now()}`);
      fs.writeFileSync(probe, 'ok');
      fs.unlinkSync(probe);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });
};
