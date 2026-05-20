"""BillSorter Sidecar — Entry Point.

Startet einen lokalen FastAPI-Server, bindet auf 127.0.0.1 mit einem dynamisch
gewählten Port, schreibt Port + Bearer-Token in vom Electron-Main vorgegebene
Dateien, und wartet auf Requests.

CLI:
    billsorter-sidecar --port-file /path/to/sidecar.port \\
                       --token-file /path/to/sidecar.token \\
                       [--port 0] [--host 127.0.0.1]
"""

from __future__ import annotations

import argparse
import logging
import os
import secrets
import socket
import sys
from pathlib import Path

import uvicorn

from api.routes import build_app

log = logging.getLogger("billsorter")


def pick_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def write_file_locked(path: Path, content: str, mode: int = 0o600) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    try:
        os.chmod(path, mode)
    except OSError:
        pass


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="billsorter-sidecar")
    parser.add_argument("--port-file", required=True, type=Path)
    parser.add_argument("--token-file", required=True, type=Path)
    parser.add_argument("--port", type=int, default=0)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--log-level", default="info")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    logging.basicConfig(
        level=args.log_level.upper(),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    port = args.port or pick_free_port()
    token = secrets.token_urlsafe(32)

    write_file_locked(args.port_file, str(port))
    write_file_locked(args.token_file, token)

    log.info("Sidecar starting on %s:%d (token written to %s)", args.host, port, args.token_file)

    app = build_app(auth_token=token)

    try:
        uvicorn.run(
            app,
            host=args.host,
            port=port,
            log_level=args.log_level,
            log_config=None,
            access_log=False,
        )
    except KeyboardInterrupt:
        log.info("Shutdown via SIGINT")
    finally:
        # Port-File aufräumen, Token bleibt für Audit.
        try:
            args.port_file.unlink(missing_ok=True)
        except OSError:
            pass

    return 0


if __name__ == "__main__":
    sys.exit(main())
