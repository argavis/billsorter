#!/usr/bin/env bash
#
# build-release.sh — Kompletter Release-Build für BillSorter.
#
#   1. Python-Sidecar via PyInstaller (FastAPI + uvicorn, --onefile)
#   2. Electron-App via electron-builder (Mac DMG / Windows NSIS EXE)
#
# Aufruf:
#   npm run build:release            # alles für das aktuelle OS
#   npm run build:release:mac        # nur Mac (DMG)
#   npm run build:release:win        # nur Windows (NSIS EXE)
#   npm run build:sidecar            # nur Python-Sidecar bauen, kein Electron
#
# WICHTIG — PyInstaller kann NICHT cross-compilen:
#   - Mac-Sidecar  -> nur auf macOS baubar
#   - Win-Sidecar  -> nur auf Windows baubar (siehe .github/workflows/release.yml)
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Pfade
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$ROOT_DIR/app"
PY_DIR="$APP_DIR/python"
VENV_DIR="$PY_DIR/.venv"

# ---------------------------------------------------------------------------
# Plattform erkennen
# ---------------------------------------------------------------------------
case "$(uname -s)" in
  Darwin*) HOST_OS="mac" ;;
  Linux*)  HOST_OS="linux" ;;
  MINGW* | MSYS* | CYGWIN*) HOST_OS="win" ;;
  *) HOST_OS="unknown" ;;
esac

# ---------------------------------------------------------------------------
# Argumente
# ---------------------------------------------------------------------------
TARGET="auto"        # auto | mac | win
SIDECAR_ONLY="false"
for arg in "$@"; do
  case "$arg" in
    --mac) TARGET="mac" ;;
    --win) TARGET="win" ;;
    --sidecar-only) SIDECAR_ONLY="true" ;;
    *) echo "Unbekanntes Argument: $arg" >&2; exit 2 ;;
  esac
done
[ "$TARGET" = "auto" ] && TARGET="$HOST_OS"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
log()  { printf '\033[1;34m[build]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[fail]\033[0m %s\n' "$*" >&2; exit 1; }

if [ "$HOST_OS" = "win" ]; then
  PY_BIN="python"
  VENV_PY="$VENV_DIR/Scripts/python.exe"
else
  PY_BIN="python3"
  VENV_PY="$VENV_DIR/bin/python"
fi

# ===========================================================================
# 1) PYTHON-SIDECAR (PyInstaller)
# ===========================================================================
build_sidecar() {
  log "Python-Sidecar bauen (Host: $HOST_OS)"
  command -v "$PY_BIN" >/dev/null 2>&1 || die "$PY_BIN nicht gefunden"

  if [ ! -x "$VENV_PY" ]; then
    log "venv anlegen: $VENV_DIR"
    "$PY_BIN" -m venv "$VENV_DIR"
  fi

  log "pip + Dependencies + PyInstaller installieren"
  "$VENV_PY" -m pip install --upgrade pip >/dev/null
  "$VENV_PY" -m pip install -r "$PY_DIR/requirements.txt"
  "$VENV_PY" -m pip install "pyinstaller==6.11.1"

  log "PyInstaller-Build (build/pyinstaller.spec)"
  ( cd "$PY_DIR" && "$VENV_PY" -m PyInstaller --noconfirm --clean build/pyinstaller.spec )

  # Erwartetes Output-File (vom Spec: name = billsorter-sidecar)
  if [ "$HOST_OS" = "win" ]; then
    OUT="$PY_DIR/dist/billsorter-sidecar.exe"
  else
    OUT="$PY_DIR/dist/billsorter-sidecar"
  fi
  [ -f "$OUT" ] || die "Sidecar-Binary nicht gefunden: $OUT"

  # Smoke-Test: --help darf nicht crashen (nur nativ ausführbar)
  if [ "$HOST_OS" = "$TARGET" ] || [ "$SIDECAR_ONLY" = "true" ]; then
    log "Sidecar Smoke-Test (--help)"
    "$OUT" --help >/dev/null 2>&1 || warn "Sidecar --help lieferte non-zero (ggf. ok, Argparse-abhängig)"
  fi
  log "Sidecar fertig: $OUT"
}

# ===========================================================================
# 2) ELECTRON-APP (electron-builder)
# ===========================================================================
build_electron() {
  local platform_flag="$1"   # --mac | --win
  log "Electron-App bauen ($platform_flag)"
  command -v node >/dev/null 2>&1 || die "node nicht gefunden"

  ( cd "$APP_DIR"
    if [ -f package-lock.json ]; then
      log "npm ci"
      npm ci
    else
      log "npm install"
      npm install
    fi
    log "electron-vite build"
    npm run build
    log "electron-builder $platform_flag"
    npx electron-builder "$platform_flag" --config electron-builder.yml
  )
  log "Electron-Build fertig — Artefakte unter: $APP_DIR/release/"
}

# ===========================================================================
# Ablauf
# ===========================================================================
log "Ziel: $TARGET  |  Host: $HOST_OS  |  sidecar-only: $SIDECAR_ONLY"

# Cross-Compile-Wächter
if [ "$TARGET" != "$HOST_OS" ]; then
  die "Cross-Compile nicht möglich: Ziel '$TARGET' braucht einen '$TARGET'-Host (aktuell '$HOST_OS'). Für Windows: .github/workflows/release.yml (windows-latest) nutzen."
fi

build_sidecar

if [ "$SIDECAR_ONLY" = "true" ]; then
  log "sidecar-only — Electron übersprungen. Fertig."
  exit 0
fi

case "$TARGET" in
  mac) build_electron "--mac" ;;
  win) build_electron "--win" ;;
  *)   die "Kein baubares Electron-Ziel für Host '$HOST_OS' (nur mac/win unterstützt)." ;;
esac

log "✅ Release-Build abgeschlossen."
