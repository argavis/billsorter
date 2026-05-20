# BillSorter

Desktop-App (Mac + Windows) die E-Mail-Postfächer per KI nach Rechnungsanhängen scannt und in Monatsordner speichert.

**Status:** v1.0 in Entwicklung. Plan + Entscheidungen → [`PLAN.md`](./PLAN.md).

## Repo-Struktur

| Ordner | Zweck | Stack |
|---|---|---|
| `app/` | Electron Desktop-App | Electron + React + TypeScript + Tailwind + shadcn/ui |
| `app/python/` | Python-Sidecar | FastAPI + uvicorn (PyInstaller-gebündelt) |
| `backend/` | Lizenz-API | Hono auf Cloudflare Workers + D1 |
| `website/` | Marketing + Download-Page | Astro + Tailwind (Cloudflare Pages) |

## Build-Reihenfolge

1. **Backend** (`backend/`) — D1 + JWT + Trial-Endpoint live haben **bevor** App-Wizard testbar ist.
2. **App** (`app/`) — Electron-Shell + Python-Sidecar.
3. **Website** (`website/`) — Marketing/Download.

Details in `PLAN.md` §14.

## Entwicklung starten

```bash
# Backend
cd backend && npm install && npm run dev

# App (kommt in Phase 4)
cd app && npm install && npm run dev
```

## Sicherheits-Hinweis

Niemals committen: `.dev.vars`, `*.pem`, `userData/`, `secrets.json`. Siehe `.gitignore`.

---

ARGAVIS, Einzelunternehmen.
