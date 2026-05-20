# BillSorter — Architektur-Plan v1

**Stand:** 2026-05-15
**Status:** ENTWURF — wartet auf User-OK vor Build
**Existierendes Asset:** `~/rechnung_agent/rechnung_agent.py` (IMAP + Claude-Haiku Erkennung, läuft)

---

## 0. Security-Vorab

`rechnung_agent.py` enthält Klartext-Credentials.
**Pflicht vor Projekt-Start:**
1. Anthropic API-Key rotieren (alter Key ist geleakt in Chat-Log).
2. Outlook/Netcup-Passwort + Gmail-App-Passwort ändern.
3. Keine `.env`-Datei committen, `.gitignore` muss `userData/`, `*.log`, `secrets.json` blockieren.

---

## 0.5 Final-Entscheidungen (User-bestätigt 2026-05-15)

| Punkt | Entscheidung |
|---|---|
| App-Name | **BillSorter** |
| Distribution | **Direct-Download** (`.dmg` Mac, `.exe` Win) von `billsorter.de` — kein App Store |
| Code-Signing | **MVP: keins.** Mac via Gatekeeper-Override (Rechtsklick → Öffnen), Win mit SmartScreen-Warnung. Signing kommt in v1.1 |
| Mail-Auth v1 | nur **App-Passwort**. OAuth (Gmail/MS-Graph) → v1.1 |
| Auto-Update | **v1.1** (electron-updater + Update-Channel) |
| Sprachen | **DE default + EN umschaltbar**, non-DE-OS → EN-Fallback |
| Payment | **nur Stripe**. PayPal → v1.1 |
| Trial-E-Mail | **keine** — nur Device-ID. E-Mail erst beim Checkout |
| Backend | **Cloudflare Workers + D1** (Account vorhanden aus SALIO) |
| Domain | `billsorter.de` — **wird noch registriert**, Setup-Guide siehe §15 |
| Rechtsform | **Einzelunternehmen ARGAVIS** — Impressum + AGB entsprechend |
| Secrets-Rotation | User macht es nach Build |
| Multi-User-Profile | später (nicht v1) |
| Telemetry | nicht v1 |

---

## 1. Stack-Entscheidung — Electron vs. Alternativen

| Kriterium | Electron + React + TS | Tauri + Svelte/React | PyQt6 | .NET MAUI |
|---|---|---|---|---|
| Binary-Größe | 80–150 MB | 5–15 MB | 40–80 MB | 60–120 MB |
| Python-Sidecar | trivial (`child_process.spawn`) | mittel (Tauri Command + Rust-Wrapper) | nativ (gleicher Prozess) | mittel (P/Invoke) |
| Mac+Win Build-Pipeline | sehr ausgereift | gut (etwas jünger) | manuell, fummelig | gut auf Win, mau auf Mac |
| Fintech-UI (Inter, #6C2BD9, clean) | top (React + Tailwind + Framer Motion) | top | unterdurchschnittlich | mittel |
| Signing / Notarization | sehr gut dokumentiert (electron-builder) | gut | manuell | gut |
| Risiko Lernkurve | niedrig | mittel (Rust) | niedrig | niedrig |

**Empfehlung: Electron.**
Begründung: Python-Script läuft bereits, Sidecar-Pattern ist trivial via `child_process.spawn`. Tauri spart 100 MB Binary aber kostet 3–5 Tage Rust-Integration. Für Fintech-Desktop-App ist Binary-Size sekundär. UI-Stack (React + Tailwind + shadcn/ui) liefert das gewünschte Design-Niveau ohne Custom-CSS-Schmerz.

**Fallback-Trigger:** Falls Notarization-Aufwand explodiert oder Auto-Update unzuverlässig → später Tauri-Rewrite möglich, weil Python-Sidecar isoliert bleibt.

### Konkreter Stack

| Layer | Tech |
|---|---|
| Shell | Electron 30 + electron-builder |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui + Framer Motion |
| State | Zustand (lightweight, kein Redux-Overkill) |
| Backend (Sidecar) | Python 3.11 + FastAPI + uvicorn — gebündelt via PyInstaller `--onefile` |
| IPC | Local HTTP (REST) + WebSocket für Live-Logs, gebunden an `127.0.0.1:<random-port>` |
| Credentials | `keytar` (macOS Keychain + Win Credential Manager) |
| Config (non-secret) | JSON in Electron `app.getPath('userData')` |
| Scheduler | OS-nativ (launchd/Task Scheduler) PLUS in-App-Reminder bei Sleep-Miss |
| Logging | Python → rotating file + WebSocket Push → Renderer |
| Build | electron-builder (macOS DMG + Win NSIS) |
| Backend (Lizenz-API) | **Hono** auf **Cloudflare Workers** + **D1** (SQLite) + Stripe + PayPal Webhooks |
| Lizenz-Token | **Ed25519-signed JWT** (offline validierbar via embedded Public-Key) |
| Zahlungs-Provider | Stripe Checkout (Karte/SEPA) + PayPal Subscriptions |
| i18n | **react-i18next**, Locales DE + EN (DE default, EN umschaltbar) |

---

## 2. Projektstruktur

```
~/BillSorter/
├── PLAN.md                          (dieses Dokument)
├── README.md
├── package.json
├── electron-builder.yml
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── .gitignore                       (blockt: userData/, *.log, dist/, secrets.json)
├── .env.example                     (Template, kein echter Key)
│
├── electron/                        (Main-Process)
│   ├── main.ts                      (App-Lifecycle, Window-Mgmt)
│   ├── preload.ts                   (contextBridge — Renderer↔Main)
│   ├── ipc/
│   │   ├── credentials.ts           (keytar Read/Write)
│   │   ├── config.ts                (JSON userData Read/Write)
│   │   ├── scheduler.ts             (launchd/schtasks Wrapper)
│   │   ├── pythonSidecar.ts         (spawn, port-discovery, health-check)
│   │   └── filesystem.ts            (Ordner-Picker, Path-Validation)
│   └── lib/
│       ├── platform.ts              (Mac vs Win Branch)
│       └── logger.ts
│
├── src/                             (Renderer — React)
│   ├── main.tsx
│   ├── App.tsx
│   ├── router.tsx
│   ├── routes/
│   │   ├── Wizard/                  (Erststart-Flow)
│   │   │   ├── index.tsx
│   │   │   ├── Step1Welcome.tsx
│   │   │   ├── Step2Folder.tsx
│   │   │   ├── Step3ApiKey.tsx
│   │   │   ├── Step4Providers.tsx
│   │   │   ├── Step5Credentials.tsx
│   │   │   ├── Step6Schedule.tsx
│   │   │   ├── Step7TestRun.tsx
│   │   │   └── Step8Done.tsx
│   │   ├── Dashboard/               (Hauptansicht)
│   │   │   ├── index.tsx
│   │   │   ├── AgentControl.tsx     (Start/Stop)
│   │   │   ├── LiveLog.tsx          (WebSocket Stream)
│   │   │   ├── StatsCards.tsx       (Gefunden/Gespeichert/Übersprungen)
│   │   │   └── NextRunBadge.tsx
│   │   ├── Settings/
│   │   │   ├── index.tsx
│   │   │   ├── ProvidersTab.tsx
│   │   │   ├── ScheduleTab.tsx
│   │   │   ├── PathTab.tsx
│   │   │   └── ApiKeyTab.tsx
│   │   ├── CatchUpModal.tsx         (Popup "Letzter Scan war am …")
│   │   ├── Paywall/
│   │   │   ├── index.tsx            (Plan-Auswahl + Stripe/PayPal-Buttons)
│   │   │   ├── TrialBanner.tsx      (X Tage verbleibend, dismissable)
│   │   │   └── ExpiredOverlay.tsx   (Vollbild-Sperre nach Trial-Ablauf)
│   │   └── LicenseSuccess.tsx       (Deep-Link-Callback billsorter://license?token=…)
│   ├── components/
│   │   ├── ui/                      (shadcn/ui generiert)
│   │   ├── ProviderCard.tsx
│   │   ├── LogStream.tsx
│   │   └── ProgressDots.tsx
│   ├── hooks/
│   │   ├── useAgentStatus.ts
│   │   ├── useLogStream.ts
│   │   ├── useConfig.ts
│   │   └── useCredentials.ts
│   ├── lib/
│   │   ├── api.ts                   (REST-Client zum Python-Sidecar)
│   │   ├── licenseClient.ts         (Backend-Calls: check/activate/portal)
│   │   ├── deviceId.ts              (stabile, gehashte Geräte-ID)
│   │   ├── providers.ts             (IMAP-Server-Presets)
│   │   ├── i18n.ts                  (react-i18next Setup, OS-Locale-Detect)
│   │   └── theme.ts                 (Tokens: #6C2BD9, Inter)
│   ├── locales/
│   │   ├── de.json                  (Default)
│   │   └── en.json
│   └── styles/
│       └── globals.css
│
├── python/                          (Sidecar-Backend)
│   ├── pyproject.toml
│   ├── requirements.txt
│   ├── main.py                      (FastAPI App-Entry)
│   ├── core/
│   │   ├── agent.py                 (Migration von rechnung_agent.py)
│   │   ├── imap_client.py
│   │   ├── classifier.py            (Claude-Haiku-Aufruf)
│   │   ├── storage.py               (Monatsordner-Logik)
│   │   └── providers.py             (Provider-Definitionen)
│   ├── api/
│   │   ├── routes.py                (POST /scan, GET /status, WS /logs)
│   │   └── models.py                (Pydantic)
│   └── build/
│       └── pyinstaller.spec
│
├── resources/                       (Icons, signed certs verweise)
│   ├── icon.icns                    (Mac)
│   ├── icon.ico                     (Win)
│   ├── icon.png
│   └── tray.png
│
├── scripts/                         (Build-Helfer)
│   ├── build-python.sh              (PyInstaller-Wrapper)
│   ├── build-electron.sh
│   ├── notarize-mac.js              (Apple Notarytool)
│   └── sign-win.ps1
│
├── dist/                            (Build-Output, gitignored)
│
└── backend/                         (Lizenz-API — eigenes Deploy-Target)
    ├── wrangler.toml                (Cloudflare Workers + D1 Bindings)
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   ├── index.ts                 (Hono-App, Routes-Mount)
    │   ├── routes/
    │   │   ├── trial.ts             (POST /v1/trial/start)
    │   │   ├── license.ts           (POST /v1/license/check + /activate)
    │   │   ├── checkout.ts          (POST /v1/checkout/stripe + /paypal)
    │   │   ├── portal.ts            (GET  /v1/portal — Stripe Customer Portal)
    │   │   ├── webhooks.ts          (POST /webhooks/stripe + /paypal)
    │   │   └── admin.ts             (Bearer-protected, License-Revoke etc.)
    │   ├── db/
    │   │   ├── schema.sql           (users, licenses, devices, events, revocations)
    │   │   └── migrations/
    │   ├── lib/
    │   │   ├── jwt.ts               (Ed25519 sign/verify via WebCrypto)
    │   │   ├── stripe.ts            (Checkout-Session + Webhook-Verify)
    │   │   ├── paypal.ts            (Subscriptions + IPN-Verify)
    │   │   └── deviceHash.ts        (HMAC für Device-Binding)
    │   └── types.ts
    └── README.md
```

---

## 3. Frontend ↔ Python Kommunikation

**Entscheidung: Local HTTP + WebSocket. Python als Sidecar-Prozess.**

### Warum nicht `child_process` mit stdin/stdout?
- Live-Log-Streaming braucht persistente Verbindung → WebSocket gewinnt.
- Stats-Polling per REST ist sauber.
- WebSocket erlaubt Reconnect ohne Sidecar-Restart.
- FastAPI ist 80 Zeilen, kostet praktisch nichts.

### Flow

```
[Renderer] ──HTTP──▶ [Main-Process] ──spawn──▶ [Python Sidecar @ 127.0.0.1:RANDOM_PORT]
                                                       │
                                                       ├── GET  /health
                                                       ├── POST /scan       (manueller Run)
                                                       ├── POST /scan/since (Catch-Up)
                                                       ├── GET  /status     (Stats: gefunden/gespeichert/übersprungen)
                                                       ├── POST /test-imap  (Connection-Test im Wizard)
                                                       └── WS   /logs       (Live-Stream)
```

### Port-Discovery

1. Main spawnt Python ohne festen Port.
2. Python wählt freien Port via `socket`, schreibt `<userData>/sidecar.port`.
3. Main liest Datei, gibt Port via `contextBridge` an Renderer.
4. Bei Crash: Main restartet Sidecar, exposed `agent:port-changed`-Event.

### Auth zwischen Renderer und Sidecar

Token (32-byte random) wird beim Sidecar-Start generiert, an `<userData>/sidecar.token` geschrieben (mode 0600), in jedem Request als `Authorization: Bearer …` mitgegeben. Schutz gegen andere lokale Prozesse die `127.0.0.1:PORT` scannen.

---

## 4. Cross-Platform Scheduler (kein Terminal)

### macOS — launchd

Datei: `~/Library/LaunchAgents/de.argavis.billsorter.plist`
Erstellt programmatisch von Electron Main beim Speichern der Schedule-Settings.

```xml
<plist version="1.0">
<dict>
  <key>Label</key><string>de.argavis.billsorter</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Applications/BillSorter.app/Contents/MacOS/billsorter-cli</string>
    <string>--scheduled-run</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>9</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
  <key>StandardErrorPath</key><string>~/Library/Logs/BillSorter/scheduler.log</string>
</dict>
</plist>
```

Aktivierung: `launchctl bootstrap gui/$(id -u) <plist>` — programmatisch via Node `child_process.execFile`.

### Windows — Task Scheduler

Via `schtasks.exe`:
```
schtasks /Create /SC DAILY /TN "BillSorter" /TR "C:\Program Files\BillSorter\billsorter-cli.exe --scheduled-run" /ST 09:00 /F
```
Wrapper: `electron/ipc/scheduler.ts` brancht auf `process.platform`.

### CLI-Entry-Point

`billsorter-cli` (Mini-Binary, electron-builder kann das via `extraResources` mit ausliefern) startet den Python-Sidecar im Headless-Mode für einen single Scan, ohne UI zu öffnen. Schreibt `lastRun` in Config.

### App-Open Catch-Up

Beim Renderer-Mount:
```ts
const { lastRun, scheduleHour } = await window.api.getConfig();
const expected = computeExpectedLastRun(scheduleHour);
if (lastRun < expected.minus({ hours: 25 })) {
  showCatchUpModal({
    since: lastRun,
    suggestedDays: daysBetween(lastRun, now)
  });
}
```

---

## 5. Credential-Storage

| Datentyp | Storage | Mechanismus |
|---|---|---|
| IMAP-Passwörter (pro Provider) | OS-Keychain | `keytar.setPassword('BillSorter', `imap:${email}`, pw)` |
| Anthropic API Key | OS-Keychain | `keytar.setPassword('BillSorter', 'anthropic-api-key', key)` |
| Provider-Konfig (Server, Port, Username, Schedule, Ordnerpfad) | JSON | `<userData>/config.json` |
| Last-Run-Timestamp | JSON | gleiche Datei |
| Setup-completed-Flag | JSON | gleiche Datei |

**Keine** Klartext-Secrets in `config.json`. Sidecar fordert Secrets bei jedem Start frisch vom Main-Prozess via authentifiziertem Endpoint an, hält sie nur in RAM.

### config.json (Schema)

```json
{
  "schemaVersion": 1,
  "setupCompleted": true,
  "rechnungsOrdner": "/Users/<user>/Documents/Rechnungen/2026",
  "schedule": { "hour": 9, "minute": 0, "daysBack": 7 },
  "lastRun": "2026-05-14T09:00:12Z",
  "providers": [
    {
      "id": "outlook-1",
      "type": "outlook-imap",
      "label": "Geschäfts-Outlook",
      "email": "redacted@example.com",
      "imapServer": "mail.example.com",
      "imapPort": 993,
      "enabled": true
    }
  ],
  "stats": { "totalFound": 0, "totalSaved": 0, "totalSkipped": 0 }
}
```

---

## 6. Setup-Wizard Flow

8 Screens, lineare Progression mit Back-Button + Persist-on-Step.

| Step | Screen | Inhalt | Validation |
|---|---|---|---|
| 0 | Sprach-Auswahl | DE / EN Toggle (OS-Locale vorausgewählt). Schreibt `locale` in config | — |
| 1 | Welcome | Logo, 2-Satz-Pitch, **"7 Tage kostenlos testen"**-Button. Hintergrund: `POST /v1/trial/start` mit Device-ID → Server liefert `trialEndsAt` zurück, lokal gespeichert | Online-Check, Offline-Fallback: lokaler Trial-Start mit späterem Sync |
| 2 | Ordner wählen | Native Folder-Picker. Standard: `~/Documents/Rechnungen/{Jahr}` | Schreibrechte testen |
| 3 | API-Key | Eingabe Anthropic Key. Link zur Console. Test-Button. | Live-Call an Anthropic `/v1/models` |
| 4 | Provider-Auswahl | Multi-Select-Karten: Outlook, Gmail, GMX, Web.de, iCloud, Yahoo, IONOS, Custom IMAP | mindestens 1 |
| 5 | Credentials | Pro gewähltem Provider: Email + App-Passwort. Inline-Hilfe-Link "App-Passwort erstellen". Für Custom: Server + Port. | Format-Check |
| 6 | Automatisierung | Uhrzeit-Picker, Tage-Rückwirkend-Slider (1–30, Default 7), Toggle "Auto-Run aktivieren" | — |
| 7 | Test-Run | Live-Connection-Test pro Provider + 1-Mail-Dry-Run. Zeigt: ✅ Outlook OK, ✅ Gmail OK | mind. 1 Provider grün, sonst Step 5 highlighten |
| 8 | Fertig | "Erster Scan startet jetzt" + "Zum Dashboard" | Schreibt `setupCompleted: true`, plant Scheduler |

### Provider-Presets (für Step 5)

| Provider | IMAP-Host | Port | App-Passwort-Doku |
|---|---|---|---|
| Outlook (Microsoft 365) | `outlook.office365.com` | 993 | Microsoft 2FA + App-PW |
| Outlook (eigener Mailserver, z.B. Netcup) | user-defined | 993 | normales PW |
| Gmail | `imap.gmail.com` | 993 | Google 2FA + App-PW erforderlich |
| GMX | `imap.gmx.net` | 993 | externes Programm aktivieren |
| Web.de | `imap.web.de` | 993 | POP3/IMAP-Zugriff aktivieren |
| iCloud | `imap.mail.me.com` | 993 | App-spezifisches Passwort |
| Yahoo | `imap.mail.yahoo.com` | 993 | App-Passwort |
| IONOS | `imap.ionos.de` | 993 | normales PW |
| Custom | user-defined | user-defined | — |

---

## 7. Dashboard / Hauptansicht (nach Wizard)

```
┌──────────────────────────────────────────────────────────┐
│  BillSorter                                  [⚙ Settings] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   Agent-Status:  ● aktiv     [ ⏸ Stop ]                  │
│   Nächster Run:  Heute 09:00                             │
│   Letzter Run:   14.05.2026, 09:00 — 3 Rechnungen        │
│                                                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                  │
│  │ 247     │  │ 189     │  │ 58      │                  │
│  │ Gefunden│  │Gespeich.│  │Übersprn.│                  │
│  └─────────┘  └─────────┘  └─────────┘                  │
│                                                          │
│  Live-Log                                [ ▶ Run jetzt ]│
│  ┌────────────────────────────────────────────────────┐  │
│  │ 09:00:01  Outlook: Scan via IMAP gestartet         │  │
│  │ 09:00:03    12 Mail(s) gefunden                    │  │
│  │ 09:00:04    Rechnung_2026-05.pdf gespeichert       │  │
│  │ 09:00:05    Kein Rechnungsanhang: newsletter       │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## 8. Risiken & Mitigation

| Risiko | Impact | Mitigation |
|---|---|---|
| **Gmail/Outlook lehnen IMAP App-Passwort ab** (Microsoft Consumer hat Basic-Auth-IMAP fast deprecated) | hoch | v1: nur App-Passwort + Doku-Link. v2: OAuth2-Flow für Gmail + MS-Graph für Outlook |
| **Mac Gatekeeper blockt unsigned .dmg** | akzeptiert für MVP | Download-Seite zeigt Anleitung: Rechtsklick → Öffnen → "Trotzdem öffnen". One-time pro Mac. Signing in v1.1 |
| **Windows SmartScreen-Warnung "Unbekannter Herausgeber"** | akzeptiert für MVP | Download-Seite mit Screenshot: "Weitere Informationen → Trotzdem ausführen". v1.1: Code-Signing-Cert (~80€/Jahr) reduziert Warnung, EV-Cert (~300€) eliminiert sie |
| **PyInstaller blast radius** — Anhängen-Parsing-Bug → Sidecar-Crash → Renderer denkt App tot | mittel | Health-Check alle 5s + Auto-Restart in `pythonSidecar.ts` mit Exponential Backoff |
| **PC im Sleep → Scheduler verpasst** | mittel | OS-Scheduler ist Best-Effort + Catch-Up-Modal beim App-Open. macOS `RunAtLoad` falls Schedule verpasst |
| **Renderer-Sidecar-Token leak** via local-malware-process | niedrig | Token-Datei mode 0600 + Bind auf 127.0.0.1, nicht 0.0.0.0 |
| **Sidecar startet nicht** (Python-Binary-Path falsch, Antivirus blockt) | mittel | Im Wizard Step 7 ist erster Sidecar-Connect der echte Test. Klare Error-UI mit "Diagnose öffnen"-Button |
| **Doppel-Speichern bei zwei Geräten mit gleicher Mailbox** | niedrig | Bestehende `if ziel.exists()`-Logik im Python bleibt |
| **API-Key-Kosten explodieren** | niedrig | Haiku ist günstig. Pro Mail max 100 Tokens. Optional: Cap auf X Mails/Tag in Settings |
| **Auto-Update-Channel** | mittel | electron-updater + S3/Github-Release als Update-Server. Optional in v1.1 |
| **Zeitzonen-Bug** im Scheduler | niedrig | launchd/schtasks operieren in lokaler TZ — passt für Single-User-App. Tests auf TZ-Wechsel (Sommerzeit) |
| **Existierender Klartext-Secret-Leak in Python-Script** | hoch (bereits passiert) | Vor Projekt-Start: Keys rotieren. Script nur als Referenz lesen, nicht 1:1 ins Repo kopieren |

---

## 9. Lizenzierung & Payment

### 9.1 Plan + Preise

| Plan | Preis | Abrechnung | Trial |
|---|---|---|---|
| Monthly | **4,99 € / Monat** | Stripe Subscription oder PayPal Subscription | **7 Tage kostenlos**, kein Payment für Trial-Start |

### 9.2 License-States (Client-Sicht)

```
unverified  → app frisch installiert, noch nie online geprüft
trial       → Trial aktiv, trialEndsAt in Zukunft
active      → bezahlt, expiresAt in Zukunft
grace       → expiresAt < now, aber < 7 Tage her (Renewal-Retry-Phase)
expired     → > 7 Tage abgelaufen → Vollbild-Paywall, Scan blockiert
revoked     → Backend hat Lizenz invalidiert (Chargeback/Fraud)
```

### 9.3 Lifecycle-Flow

```
Install
  └── App-Start
        └── Device-ID generieren (HMAC aus machine-uuid + app-salt)
        └── POST /v1/trial/start  → { trialEndsAt, status: "trial" }
        └── Lokal speichern → Wizard → Dashboard
              └── Trial-Banner: "Trial läuft noch X Tage"
              └── Tag 7+ → ExpiredOverlay → Paywall

Paywall
  ├── [Stripe] → POST /v1/checkout/stripe { deviceId, locale }
  │              → Backend erzeugt Checkout-Session
  │              → shell.openExternal(session.url)
  │              → Stripe success_url = api.billsorter.de/checkout/done?sid=…
  │              → Backend-Page redirected zu: billsorter://license?token=<JWT>
  │              → Electron protocol-handler fängt Deep-Link, schreibt Token in Keychain
  │
  └── [PayPal] → POST /v1/checkout/paypal { deviceId, locale }
                 → analoger Flow mit PayPal Subscription-Approve-URL

App-Launch (jedes Mal)
  └── Hat lokal license_token?
        ├── ja → JWT lokal verifizieren (Ed25519 Public-Key)
        │        ├── valid & expiresAt > now  → status=active, weiterstarten
        │        ├── expiresAt < now & < 7d   → status=grace, async refresh
        │        └── expiresAt < now & > 7d   → /v1/license/check zwingend
        │
        └── nein → /v1/license/check mit deviceId

Renewal
  └── Stripe Webhook: invoice.payment_succeeded
        → Backend updated expiresAt, erzeugt neuen JWT
        → Client pollt täglich /v1/license/check, holt neuen Token
```

### 9.4 License-Token (JWT) Schema

```json
{
  "iss": "billsorter.de",
  "sub": "<deviceIdHash>",
  "licenseId": "<uuid-v4>",
  "plan": "monthly",
  "status": "active",
  "issuedTo": "<userIdHash>",
  "iat": 1747300000,
  "expiresAt": "2026-06-15T00:00:00Z",
  "graceDays": 7
}
```
- Signatur: **Ed25519** (kleiner als RSA, schneller als ECDSA, WebCrypto-Support)
- Public-Key embedded in App-Binary → komplett offline validierbar
- Private-Key: nur in Cloudflare Workers Secret Store

### 9.5 Device-Binding (gegen triviales Token-Teilen)

```
deviceId = HMAC-SHA256(
  key   = APP_DEVICE_SALT (embedded),
  value = machine_uuid()    // node-machine-id
)
```
Token enthält `sub: deviceIdHash`. Beim Validate prüft Client lokal: `token.sub === HMAC(machine_uuid)`. Token von Gerät A funktioniert nicht auf Gerät B.
Limitierung: technisch versierter User kann Token + spoofed machine-uuid kopieren — akzeptiert für 4,99-Bracket; bei höherem Preis OAuth+Account-Modell.

### 9.6 Offline-Verhalten

| Szenario | Verhalten |
|---|---|
| Online + valid | scan läuft |
| Offline, Token cached, expiresAt + 7d Grace > now | scan läuft |
| Offline, Token cached, > 7d Grace abgelaufen | Paywall + Hinweis "Online-Verbindung erforderlich" |
| Online, /check antwortet `revoked` | Sofort Paywall + "Bitte Support kontaktieren" |
| Network-Error im /check | Letztes Result-Cache verwenden, retry mit Backoff |

### 9.7 EU-Compliance

- **EU-VAT (Mehrwertsteuer)**: Stripe Tax aktivieren → automatische DE/AT/EU-Steuer-Erhebung + Rechnungen. Pflicht für B2C-Subscriptions in EU.
- **DSGVO**: minimale PII (E-Mail aus Stripe + deviceIdHash). AVV mit Cloudflare + Stripe + PayPal vorhanden (Standard).
- **Impressum + AGB + Datenschutz**: Pflichtseiten unter `billsorter.de` bevor Stripe-Live-Mode aktiviert werden kann.
- **Widerrufsrecht**: Pflichthinweis im Checkout; Stripe Customer Portal für Self-Service-Cancel.

---

## 10. Backend-Architektur (Lizenz-API)

### 10.1 Tech-Stack-Entscheidung

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Cloudflare Workers + D1 + Hono** | $0 bis ~10k req/Tag, globale Edge, Cold-Start <5ms, TypeScript, Stripe/PayPal SDKs laufen | D1 max 10 GB, kein Long-Running-Job (Cron via Triggers OK) | **EMPFEHLUNG** |
| Supabase (Postgres + Edge Functions) | Built-in Admin-UI, Auth, Postgres | Höhere Cold-Starts, $25/Monat ab Production-Tier, Vendor-Lock | Alternative falls Admin-Panel wichtig |
| Hetzner VPS + Node + Postgres | Volle Kontrolle, kein Vendor-Lock | Ops-Aufwand, Patching, Backups, Monitoring | Overkill für eine Lizenz-API |
| AWS Lambda + RDS | reife Tools | komplexes Setup, Cold-Start, Kosten ab Tag 1 | nein |

**Empfehlung: Hono auf Cloudflare Workers + D1.** Für eine Lizenz-API ist Edge-SQLite ideal: <10 Endpoints, low-throughput, gute Latenz weltweit, kostet im ersten Jahr ~0 €.

### 10.2 Datenmodell (D1 / SQLite)

```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY,         -- uuid
  email         TEXT UNIQUE NOT NULL,
  email_hash    TEXT NOT NULL,            -- für anonymisierte Lookups
  created_at    TEXT NOT NULL,
  locale        TEXT DEFAULT 'de'
);

CREATE TABLE licenses (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  plan          TEXT NOT NULL,            -- 'monthly'
  status        TEXT NOT NULL,            -- 'trial'|'active'|'grace'|'expired'|'revoked'
  provider      TEXT NOT NULL,            -- 'stripe'|'paypal'
  provider_sub_id TEXT,                   -- stripe_sub_xxx / paypal_sub_xxx
  trial_ends_at TEXT,
  expires_at    TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE devices (
  device_id_hash TEXT PRIMARY KEY,
  license_id     TEXT REFERENCES licenses(id),
  first_seen_at  TEXT NOT NULL,
  last_check_at  TEXT NOT NULL,
  app_version    TEXT,
  os             TEXT
);

CREATE TABLE events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  type          TEXT NOT NULL,            -- 'trial_started'|'checkout_completed'|'renewal_failed'|...
  license_id    TEXT,
  device_id     TEXT,
  payload       TEXT,                     -- JSON
  created_at    TEXT NOT NULL
);

CREATE TABLE revocations (
  license_id    TEXT PRIMARY KEY,
  reason        TEXT NOT NULL,
  revoked_at    TEXT NOT NULL
);

CREATE INDEX idx_licenses_user ON licenses(user_id);
CREATE INDEX idx_devices_license ON devices(license_id);
CREATE INDEX idx_events_created ON events(created_at);
```

### 10.3 API-Endpoints

| Method | Path | Auth | Zweck |
|---|---|---|---|
| POST | `/v1/trial/start` | none + Rate-Limit per IP | Device-ID anlegen, Trial-License erzeugen, JWT zurückgeben |
| POST | `/v1/license/check` | none + DeviceID + optional Bearer JWT | Aktuellen Status liefern, neuen Token bei Renewal |
| POST | `/v1/license/activate` | Stripe/PayPal-Session-ID | Nach Payment: Token erzeugen und an Client liefern |
| POST | `/v1/checkout/stripe` | DeviceID + Email | Stripe Checkout Session erzeugen |
| POST | `/v1/checkout/paypal` | DeviceID + Email | PayPal Subscription erzeugen |
| GET | `/v1/portal` | DeviceID | Stripe Customer Portal Link für Self-Service-Cancel/Update |
| POST | `/webhooks/stripe` | Stripe-Signature-Header | Subscription-Lifecycle Events |
| POST | `/webhooks/paypal` | PayPal-IPN-Signature | analog |
| POST | `/v1/admin/revoke` | Admin-Bearer | Lizenz revoken |
| GET | `/v1/admin/stats` | Admin-Bearer | Counts: trials, actives, churn |

### 10.4 Webhook-Events (Stripe → Backend → Lizenz-DB)

| Event | Aktion |
|---|---|
| `checkout.session.completed` | License `trial` → `active`, `expires_at = now + 30d`, Event loggen |
| `invoice.payment_succeeded` | `expires_at += 30d`, neuen JWT vorbereiten |
| `invoice.payment_failed` | `status = grace`, retry läuft Stripe-seitig |
| `customer.subscription.deleted` | `status = expired` zum nächsten Cycle |
| `charge.refunded` | `status = revoked`, Event loggen |

### 10.5 Sicherheit

- **Webhook-Signatures**: Stripe + PayPal Signaturen pflichtprüfen vor DB-Write.
- **Rate-Limiting**: Cloudflare Rate-Limit Rules auf `/v1/trial/start` (5 / IP / Stunde).
- **Secrets**: Stripe Secret-Key, PayPal Secret, Ed25519 Private-Key, App-Salt → Cloudflare Workers Secrets, nie in Code.
- **JWT-Validation am Client**: Public-Key embedded, Token-Tampering nicht möglich ohne Server-Key.
- **Device-Binding**: siehe 9.5.
- **HTTPS only**: durch Cloudflare automatisch.
- **CORS**: API only allow-list `app://` + `billsorter://` Scheme + dev-localhost.

### 10.6 Deployment + Cost

- `wrangler deploy` → 1 Befehl, < 30 sec.
- Custom-Domain `api.billsorter.de` via Cloudflare DNS.
- **Kostenschätzung** (Cloudflare Free Tier):
  - Workers: 100k req/Tag inklusive → ausreichend für hunderte aktive User
  - D1: 5 GB Storage + 5 Mio Reads/Tag im Free Tier
  - Bezahlt-Tier ab $5/Monat falls Wachstum → praktisch irrelevant für lange Zeit

### 10.7 Admin-Workflow

Kein Custom-Admin-Panel in v1. Stattdessen:
- Stripe Dashboard für Customer/Subscription-Management
- D1 via `wrangler d1 execute --command "SELECT …"` für Ad-hoc
- v1.1: Mini-Admin-Page (Next.js, statisch auf Cloudflare Pages) mit Basic-Auth

---

## 11. Internationalisierung (DE / EN)

### 11.1 Tooling

- `react-i18next` + `i18next-browser-languagedetector` (für initial OS-Locale-Erkennung)
- Locales: `src/locales/de.json`, `src/locales/en.json`
- Namespace-Splitting: `common`, `wizard`, `dashboard`, `settings`, `paywall`, `errors`
- TypeScript: strict-typed Keys via `i18next.d.ts`

### 11.2 Sprache umschalten

- Wizard Step 0: initiale Auswahl (DE default falls OS=de-*, sonst EN)
- Settings → "Allgemein"-Tab → Sprache-Dropdown
- Speicherung in `config.json` als `locale: "de" | "en"`
- Live-Switch ohne App-Neustart

### 11.3 Backend-Locale

- `Accept-Language`-Header an alle Backend-Calls
- Stripe Checkout Session `locale: 'de' | 'en'`
- E-Mail-Templates pro Sprache (in v1 nur Transaktions-Mails via Stripe direkt)

### 11.4 Python-Sidecar

- Sidecar liefert nur strukturierte Codes/Keys, keine User-strings. Beispiel:
  ```json
  { "code": "imap.auth_failed", "provider": "gmail" }
  ```
- Frontend übersetzt über i18next-Keys: `t('errors.imap.auth_failed', { provider })`

### 11.5 Coverage

| Bereich | übersetzt? |
|---|---|
| Wizard (alle Screens) | ja |
| Dashboard + Live-Log-UI-Texte | ja (Log-Entries selbst bleiben in Mail-Sprache, was OK ist) |
| Settings | ja |
| Paywall + Trial-Banner | ja |
| Error-Modals + Toasts | ja |
| Monatsnamen für Ordner | **bleiben deutsch** (User-Request explizit: "Januar 2026") — konfigurierbar in v1.1 |
| System-Notifications | ja |

---

## 12. Build-Aufwand-Schätzung

Annahme: 1 erfahrener Entwickler, fokussiert.

| Phase | Tage | Inhalt |
|---|---|---|
| **Setup & Scaffold** | 0.5 | Electron + Vite + Tailwind + shadcn/ui + ESLint + Prettier |
| **Python-Sidecar Refactor** | 1.0 | rechnung_agent.py → FastAPI-Routes, Secrets aus Env, REST + WS |
| **PyInstaller-Build-Pipeline** | 0.5 | Mac + Win Builds, in electron-builder eingebunden |
| **Main-Process IPC** | 1.0 | keytar, config-store, sidecar-spawn, port-discovery, health-check |
| **Setup-Wizard (9 Screens inkl. Sprach-Auswahl)** | 1.5 | inkl. Test-Connection-Logik + Provider-Presets |
| **Backend (Cloudflare Workers + D1 + Hono)** | 1.5 | Schema, Endpoints, JWT, Stripe-Webhooks, Tests (PayPal → v1.1) |
| **Payment-Integration im Client (Stripe only)** | 1.0 | Paywall-UI, Stripe Checkout, Deep-Link-Handler, Token-Storage |
| **Lizenz-Check-Logic im Main** | 0.5 | Startup-Check, Grace-Period, Revocation-Handling |
| **i18n (DE + EN, Wizard/Dashboard/Settings/Paywall)** | 1.0 | react-i18next Setup, Locales, Live-Switch, OS-Detect |
| **Marketing-/Download-Page + Impressum/AGB/Datenschutz** | 1.0 | Cloudflare Pages, Hero + 3 Sections + Gatekeeper-Anleitung, Pflicht-Pages für Stripe |
| **Dashboard + Live-Log + Stats** | 1.0 | WebSocket-Stream-Anzeige, Run-Button, Status-Polling |
| **Settings-UI** | 0.5 | 4 Tabs: Providers, Schedule, Path, API-Key |
| **Cross-Platform Scheduler** | 1.0 | launchd-Plist-Writer + schtasks-Wrapper + Catch-Up-Modal |
| **Theming + Polish** | 0.5 | Inter laden, #6C2BD9 Tokens, Animations, Empty-States, Error-States |
| ~~Signing + Notarization~~ | **0 (v1.1)** | DMG + EXE unsigned, Gatekeeper-/SmartScreen-Hinweis auf Download-Seite |
| **QA Cross-Platform** | 1.0 | Mac + Win Smoke + Wizard + Schedule + Sleep-Recovery |
| **Doku (README + In-App-Hilfe)** | 0.5 | App-PW-Anleitungen pro Provider |
| **Puffer** | 1.5 | unbekannte Unbekannte |
| **Total v1.0** | **14 Tage** | shippable: App + Backend + Stripe + i18n + Marketing-Page (ohne Signing/PayPal/OAuth/Auto-Update) |

**Schnelle Iteration möglich:** Funktional-MVP (Wizard läuft, Trial+Stripe live, Scanner arbeitet, kein Polish): **~9 Tage**.

v1.1-Backlog: Mac+Win Code-Signing, electron-updater Auto-Update, OAuth (Gmail/MS-Graph), PayPal-Subscriptions, Mini-Admin-Panel.

---

## 13. Offene Entscheidungen — RESOLVED

Alle Entscheidungen aus §0.5 final. Verbleibend:

1. **Stripe Tax aktivieren?** — empfohlen ja, wegen EU-MOSS-Pflicht bei B2C-Subscriptions. Konfiguration im Stripe-Dashboard, kein Code-Impact.
2. **Stripe-Produkt-Setup** — Brauche von dir: erstellte Stripe-Product-ID + Price-ID (4,99€/Monat, recurring) bevor ich Backend-Endpoints final code. Schritt-für-Schritt in §15.4.
3. **Impressum/AGB-Texte** — Standard-Templates erzeuge ich, du musst persönliche Daten (Anschrift, USt-ID falls vorhanden, Telefon) einsetzen.

---

## 14. Empfohlene Reihenfolge nach OK

**Parallel laufende User-Actions** (Tag 0):
- Domain `billsorter.de` registrieren (siehe §15)
- Stripe-Produkt+Price anlegen (siehe §15.4)
- Cloudflare-Workers-Project benennen

**Build-Reihenfolge:**
1. Mono-Repo Scaffold (`app/` + `backend/` + `website/`) + CI
2. **Backend zuerst**: D1-Schema, JWT-Keys, `/trial/start` + `/license/check` lauffähig auf Cloudflare. Ohne Backend kein Trial → kein Wizard testbar.
3. Python-Sidecar Refactor zu FastAPI, lokal lauffähig
4. Electron Main-Process: IPC + Keychain (`keytar`) + Config + i18n-Setup + Sidecar-Spawn
5. Lizenz-Check-Layer (Startup-Guard, Trial-Banner, Grace-Logic)
6. Setup-Wizard (Sprach-Auswahl → Ordner → API-Key → Provider → Credentials → Schedule → Test → Done)
7. Dashboard (Stats + Live-Log via WebSocket + Start/Stop)
8. Scheduler (launchd Mac + schtasks Win)
9. Settings (4 Tabs + Sprache-Umschalter + Stripe-Portal-Link)
10. Paywall + Stripe-Checkout-Flow + Deep-Link-Handler `billsorter://license`
11. Backend Stripe-Webhooks + Lifecycle-Tests (test + live mode)
12. Marketing-/Download-Page + Impressum + AGB + Datenschutz (Cloudflare Pages)
13. Build-Pipeline `.dmg` (unsigned) + `.exe` (unsigned NSIS) via electron-builder
14. Theming + Polish (#6C2BD9, Inter, Framer Motion)
15. QA Mac + Win: Wizard → Trial → Stripe-Checkout (Test-Mode) → Scan → Schedule
16. Stripe Live-Mode aktivieren + Smoke-Test mit echtem 4,99€-Cent-Charge → refund
17. Release v1.0: Build hochladen → Download-Seite live schalten

---

## 15. Domain + Distribution-Setup (User-Anleitung)

### 15.1 Domain `billsorter.de` registrieren

**Empfehlung: Cloudflare Registrar** (Voraussetzung: aktiver Cloudflare-Account — du hast bereits einen für SALIO).

| Variante | Pro | Contra | Preis |
|---|---|---|---|
| **Cloudflare Registrar** | Wholesale-Preis, DNS schon dort, kein Margin-Aufschlag | nicht alle TLDs, .de seit 2023 möglich | ~10 €/Jahr |
| INWX | DE-Registrar, gute API | DNS-Transfer zu CF nötig | ~10 €/Jahr |
| Netcup | du nutzt sie schon (Outlook-IMAP) | Web-Console klobig | ~5 €/Jahr |

**Schritt für Schritt (Cloudflare Registrar):**
1. Login `dash.cloudflare.com` → Account → **Domain Registration → Register Domain**.
2. Suche `billsorter.de` → wenn frei: **Register** (Zahlung via hinterlegter Karte).
3. Falls .de bei CF nicht direkt geht: registriere bei **Netcup** für ~5 €/Jahr, dann in CF unter **Websites → Add a site → billsorter.de**, **Free Plan** wählen, NS-Records von Netcup zu CF (`xxx.ns.cloudflare.com`) ändern.
4. Warten 1–24h für DNS-Propagation.

### 15.2 Subdomain-Plan (DNS-Records)

| Subdomain | Zweck | Ziel |
|---|---|---|
| `billsorter.de` | Marketing + Download-Page | Cloudflare Pages (CNAME flattening, Proxied) |
| `www.billsorter.de` | Redirect 301 → apex | Cloudflare Pages |
| `api.billsorter.de` | Lizenz-API (Worker) | Cloudflare Worker Route |
| `downloads.billsorter.de` | Optional: separater Download-Host für .dmg/.exe | Cloudflare R2 + Custom Domain ODER direkt von Pages serven |

### 15.3 Distribution-Hosting der Binaries

**Empfehlung: GitHub Releases** für v1, weil:
- Kostenlos, unlimitiert
- Versioning out-of-the-box
- Auto-Update-tauglich in v1.1 (electron-updater liest direkt aus Releases)
- Stabile Download-URLs

**Setup:**
1. Privates GitHub-Repo `argavis/billsorter-releases` erstellen (nur Tags + Binaries, kein Code).
2. Release-Workflow in GitHub Actions: nach `git tag v1.0.0` auf dem App-Repo werden `.dmg` + `.exe` builds als Release-Assets hochgeladen.
3. Marketing-Page linkt direkt zu `https://github.com/argavis/billsorter-releases/releases/latest/download/BillSorter-1.0.0.dmg` und `.exe`.
4. Alternative für maximale Diskretion: Cloudflare R2-Bucket `billsorter-binaries`, Custom Domain `downloads.billsorter.de`, signed URLs falls Trial-gated Download gewünscht. Erst v1.1.

### 15.4 Stripe-Setup (du machst diese Schritte)

1. **Login** `dashboard.stripe.com` (existierender SALIO-Account okay, oder neuen Account für ARGAVIS — empfohlen wegen sauberer Trennung der EU-Steuer-Reports).
2. **Mode wechseln auf "Test mode"** (oben rechts Toggle).
3. **Products → Add Product**:
   - Name: `BillSorter Monthly`
   - Description: `Automatische Rechnungs-Erkennung in E-Mails`
   - Pricing model: Standard pricing
   - Price: `4,99 EUR`
   - Recurring: ja, monthly
   - → Speichern → **Price-ID kopieren** (`price_xxx`) — diese gebe ich später ins Backend
4. **Tax → enable Stripe Tax** (Pflicht für EU-VAT). Tax origin = Deutschland, ARGAVIS-Adresse.
5. **Settings → Customer Portal → enable** (für Self-Service-Cancel).
6. **Developers → API Keys**: Test Publishable + Test Secret kopieren. Live-Keys erst aktivieren wenn Impressum/AGB live sind und du einen 1-Cent-Smoke-Test gefahren hast.
7. **Webhooks → Add endpoint** kommt später beim Backend-Deploy: URL `https://api.billsorter.de/webhooks/stripe`, Events: `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`, `charge.refunded`. Signing-Secret in CF-Worker-Secrets.

### 15.5 Marketing-/Download-Page Struktur (Cloudflare Pages)

```
website/
├── public/
│   ├── billsorter-1.0.0.dmg     (oder Link zu GitHub Releases)
│   └── billsorter-1.0.0.exe
├── src/
│   ├── pages/
│   │   ├── index.astro          (Hero + Features + Download + FAQ)
│   │   ├── install-mac.astro    (Gatekeeper-Anleitung Schritt-für-Schritt)
│   │   ├── install-windows.astro(SmartScreen-Anleitung)
│   │   ├── impressum.astro      (ARGAVIS Einzelunternehmen)
│   │   ├── agb.astro
│   │   ├── datenschutz.astro
│   │   └── widerruf.astro
│   ├── components/
│   │   ├── DownloadButton.astro (Platform-Detection)
│   │   └── Hero.astro
│   └── styles/
└── astro.config.mjs             (Astro für statische Speed)
```

**Stack:** Astro 4 + Tailwind (gleiche Tokens wie App: #6C2BD9, Inter). Statisch gebaut, deploy via `wrangler pages deploy` oder Auto-Deploy bei Git-Push.

### 15.6 Gatekeeper-/SmartScreen-Anleitungen (für `/install-mac` und `/install-windows`)

**Mac:**
> 1. Lade `BillSorter-1.0.0.dmg` herunter.
> 2. Öffne die DMG und ziehe BillSorter in den Programme-Ordner.
> 3. Starte die App per **Rechtsklick → Öffnen** (nicht Doppelklick).
> 4. Bestätige den Dialog mit **"Trotzdem öffnen"** — nur einmalig nötig.
> 5. App startet, Setup-Wizard begrüßt dich.
>
> *Warum diese Schritte? Apple verlangt für Drittanbieter-Apps eine kostenpflichtige Entwicklerlizenz. Wir reichen die in einem späteren Update nach — bis dahin dieser kleine Umweg.*

**Windows:**
> 1. Lade `BillSorter-Setup-1.0.0.exe` herunter.
> 2. Doppelklick. Falls Windows warnt: **"Weitere Informationen" → "Trotzdem ausführen"**.
> 3. Installer führt dich durch — fertig in 30 Sekunden.

### 15.7 Cloudflare-Workers-Account / Project-Namen (für mich, beim Build)

Bitte vor Phase 2 vergeben:
- Worker-Name: Vorschlag `billsorter-api`
- D1-Datenbank-Name: Vorschlag `billsorter-prod` + `billsorter-dev`
- KV-Namespace (falls nötig für Rate-Limiting): `billsorter-rl`

---

**ENDE PLAN — warte auf OK / Änderungswünsche.**
