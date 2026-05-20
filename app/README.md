# BillSorter App

Electron-Shell + React-Renderer + Python-Sidecar-Manager.

## Voraussetzungen

- Node 20+
- Python 3.9–3.12 mit venv im Schwester-Ordner `../python/.venv`
- Backend lokal lauffähig (`cd ../backend && npm run dev`) **oder** Production-API via `BILLSORTER_API_URL` env

## Dev

```bash
cd app
npm install

# Backend URL für Dev gegen localhost setzen (sonst geht es gegen https://api.billsorter.de):
export BILLSORTER_API_URL=http://localhost:8787

npm run dev
```

Beim Dev-Start passiert:
1. Electron-Vite kompiliert main + preload + renderer.
2. Renderer läuft auf `http://localhost:5174`.
3. Main spawnt automatisch den Python-Sidecar aus `../python/.venv/bin/python ../python/main.py`.

## Builds

```bash
npm run build:mac   # → release/0.1.0/BillSorter-0.1.0.dmg (unsigned)
npm run build:win   # → release/0.1.0/BillSorter-Setup-0.1.0.exe (unsigned)
npm run build:all   # Mac+Win parallel (nur wenn beide Toolchains da sind)
```

Voraussetzung für `build:mac`/`build:win`: Sidecar-Binary muss in `../python/dist/billsorter-sidecar` liegen (siehe `../python/README.md`).

## Architektur

```
electron/
├── main.ts                 App-Lifecycle + Window
├── preload.ts              contextBridge → window.api
├── ipc/
│   ├── config.ts           userData/config.json (Zod-validiert)
│   ├── credentials.ts      keytar
│   ├── pythonSidecar.ts    Sidecar spawn + Port-/Token-Discovery + Health + Restart
│   ├── license.ts          Backend-Calls + Cache + JWT-Verify
│   ├── deepLink.ts         billsorter:// Handler
│   ├── filesystem.ts       Folder-Picker
│   ├── scheduler.ts        launchd + schtasks
│   └── system.ts           Device-ID, openExternal, Locale
└── lib/
    ├── platform.ts
    ├── logger.ts           electron-log → ~/Library/Logs/BillSorter/
    ├── api.ts              fetch-Wrapper für Lizenz-Backend
    ├── deviceId.ts         node-machine-id
    ├── sidecarBinary.ts    Dev-vs-Production-Path-Resolution
    └── jwtVerify.ts        Ed25519 offline-verify via jose

src/
├── index.html              CSP locked-down
├── main.tsx
├── App.tsx                 Phase 3 Stub mit Debug-Buttons
├── styles/globals.css
├── lib/i18n.ts             react-i18next + Detector
└── locales/{de,en}.json

shared/
└── types.ts                IPC-Channels + Daten-Schemata, geteilt main↔renderer
```

## window.api — Renderer API

```ts
window.api.config.get() / .set(patch) / .reset()
window.api.credentials.set/get/delete/list(key, value?)
window.api.sidecar.status() / .start() / .stop() / .request({ path, method, body }) / .onStatus(cb)
window.api.license.trialStart({...}) / .check({...}) / .checkout({locale}) / .portal() / .getCached() / .verifyLocal(token) / .onChanged(cb)
window.api.filesystem.pickFolder(opts) / .validateWrite(path)
window.api.scheduler.install({hour,minute}) / .uninstall() / .status()
window.api.system.getDeviceId() / .openExternal(url) / .getLocale()
window.api.events.onDeepLink(cb)
```

## Sicherheits-Modell

- Renderer hat **kein** Node-Integration und keinen Zugriff auf Filesystem/Network außer durch IPC.
- Sidecar bindet auf `127.0.0.1:RANDOM_PORT`. Token wird beim Spawn neu generiert und in `<userData>/sidecar.token` (mode 0600) abgelegt.
- Renderer sendet **nie direkt** an den Sidecar — alle Requests gehen über `sidecar:request` IPC, das Token bleibt im Main.
- CSP im HTML blockt externes JavaScript komplett, erlaubt nur `connect-src` zu localhost + api.billsorter.de.
- License-JWT wird offline mit eingebettetem Public-Key (`resources/jwt-public-key.pem`) verifiziert.

## Logging

`~/Library/Logs/BillSorter/main.log` und `sidecar.log`. Rotation bei 5 MB.
