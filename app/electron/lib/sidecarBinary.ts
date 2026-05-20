// Resolved den Pfad zum Python-Sidecar.
// In Dev: spawnt `python <repo>/app/python/main.py` aus dem venv.
// In Production: spawnt das PyInstaller-Binary aus resources/sidecar/.

import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { isWin } from './platform';

export type SidecarLocation = {
  command: string;
  args: string[];
};

export const resolveSidecar = (portFile: string, tokenFile: string): SidecarLocation => {
  if (!app.isPackaged) {
    return resolveDev(portFile, tokenFile);
  }
  return resolveProd(portFile, tokenFile);
};

const resolveDev = (portFile: string, tokenFile: string): SidecarLocation => {
  // Suche python im venv des Sidecar-Projekts.
  // out/main/index.js → __dirname=out/main → ../../python = app/python
  const pyDir = path.resolve(__dirname, '..', '..', 'python');
  const venvBin = isWin ? path.join(pyDir, '.venv', 'Scripts') : path.join(pyDir, '.venv', 'bin');
  const pythonExe = path.join(venvBin, isWin ? 'python.exe' : 'python');
  const mainPy = path.join(pyDir, 'main.py');
  const fallbackPy = isWin ? 'python.exe' : 'python3';
  return {
    command: fs.existsSync(pythonExe) ? pythonExe : fallbackPy,
    args: [mainPy, '--port-file', portFile, '--token-file', tokenFile],
  };
};

const resolveProd = (portFile: string, tokenFile: string): SidecarLocation => {
  const binName = isWin ? 'billsorter-sidecar.exe' : 'billsorter-sidecar';
  const binPath = path.join(process.resourcesPath, 'sidecar', binName);
  return {
    command: binPath,
    args: ['--port-file', portFile, '--token-file', tokenFile],
  };
};
