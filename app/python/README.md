# BillSorter Python Sidecar

FastAPI-Server der vom Electron-Main-Prozess als Child gespawnt wird.
Macht den eigentlichen Scan-Job: IMAP → Claude-Haiku-Klassifizierung → Monatsordner.

## Architektur

```
Electron Main
    │ spawnt mit --port-file und --token-file
    ▼
billsorter-sidecar (Python binary)
    │ bindet auf 127.0.0.1:RANDOM_PORT
    │ schreibt Port + Token in vorgegebene Files
    ▼
FastAPI auf 127.0.0.1
    ├── GET  /health
    ├── GET  /v1/providers
    ├── POST /v1/scan
    ├── POST /v1/scan/since
    ├── GET  /v1/jobs + /v1/jobs/{id}
    ├── POST /v1/jobs/{id}/cancel
    ├── POST /v1/test-imap
    ├── POST /v1/test-anthropic
    └── WS   /v1/logs/{job_id}?token=…
```

Alle Routes (außer `/health`) erfordern `Authorization: Bearer <token>`.
Der Token wird beim Start neu generiert.

## Lokal entwickeln

```bash
cd app/python
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Sidecar starten
python main.py \
    --port-file /tmp/billsorter.port \
    --token-file /tmp/billsorter.token \
    --port 8788
```

Dann in einer zweiten Konsole:

```bash
TOKEN=$(cat /tmp/billsorter.token)
curl -s http://127.0.0.1:8788/health
# {"status":"ok","version":"0.1.0"}

curl -s http://127.0.0.1:8788/v1/providers -H "authorization: Bearer $TOKEN" | jq
```

## Mit echtem IMAP testen

```bash
TOKEN=$(cat /tmp/billsorter.token)
curl -X POST http://127.0.0.1:8788/v1/test-imap \
  -H "authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d '{
    "providers": [{
      "id":"gmail-test",
      "provider_id":"gmail-imap",
      "label":"Gmail Test",
      "email":"user@gmail.com",
      "password":"app-password"
    }]
  }'
```

## Build (PyInstaller)

```bash
pip install pyinstaller==6.11.1
pyinstaller --clean --noconfirm build/pyinstaller.spec
# → dist/billsorter-sidecar (Mac/Linux) bzw. dist/billsorter-sidecar.exe
```

Das Binary wird in den Electron `app/resources/` Ordner kopiert und beim
electron-builder-Build mit-bundled.

## Hauptmodule

| Datei | Zweck |
|---|---|
| `main.py` | CLI-Entry + Port-/Token-Discovery |
| `core/agent.py` | Scan-Orchestrator, Job-Tracking |
| `core/imap_client.py` | sync IMAP via `imaplib` (Thread-Pool für async) |
| `core/classifier.py` | Claude-Haiku-Call + Keyword-Fallback |
| `core/storage.py` | Monats-Ordner, Duplikat-Erkennung |
| `core/providers.py` | 9 Provider-Presets (Outlook, Gmail, GMX, ...) |
| `api/routes.py` | FastAPI + WebSocket |
| `api/models.py` | Pydantic Request/Response |
| `lib/log_bus.py` | In-Memory Pub/Sub für Live-Logs |
