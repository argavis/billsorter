# PyInstaller spec — Mac + Win Bundle. Wird via `pyinstaller build/pyinstaller.spec` aufgerufen.
# Outputs:
#   dist/billsorter-sidecar      (Mac/Linux: single-file ELF/Mach-O)
#   dist/billsorter-sidecar.exe  (Windows)
#
# Wichtig: hidden imports und collect_data_files für uvicorn + websockets, die sonst
# bei `--onefile` fehlende Module zur Runtime werfen.

# noqa: F821 (a is provided by PyInstaller at exec time)
import sys
from pathlib import Path

block_cipher = None

HERE = Path(SPECPATH).resolve()  # type: ignore[name-defined]
ROOT = HERE.parent

a = Analysis(
    [str(ROOT / "main.py")],
    pathex=[str(ROOT)],
    binaries=[],
    datas=[],
    hiddenimports=[
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        "websockets.legacy",
        "websockets.legacy.server",
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe_name = "billsorter-sidecar"
console = True  # Sidecar braucht kein Fenster, läuft headless. Console für stderr.

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name=exe_name,
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=console,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
