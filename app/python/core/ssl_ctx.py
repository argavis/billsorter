"""Zentrale SSL/TLS-Wurzelzertifikat-Auflösung für den PyInstaller-Sidecar.

Problem: Im PyInstaller-Bundle (--onefile) hat `ssl.create_default_context()` keinen
verlässlichen Zugriff auf die System-CA-Zertifikate. Auf frisch installierten Macs / ohne
OpenSSL-System-Zerts schlägt jede TLS-Verbindung mit CERTIFICATE_VERIFY_FAILED fehl —
IMAP (Gmail, Custom IMAP, …) UND HTTPS (Backend/Anthropic via httpx).

Lösung: Wir bündeln das `certifi`-CA-Bundle (cacert.pem) ins Bundle (siehe pyinstaller.spec,
`datas`) und zeigen JEDE Netzwerk-Bibliothek darauf:
  - via Env-Vars (SSL_CERT_FILE / REQUESTS_CA_BUNDLE) → greift global für OpenSSL/ssl/httpx
  - via expliziter ssl_context()/ca_bundle() für IMAP und httpx

`install_ca_bundle()` MUSS so früh wie möglich laufen (vor dem ersten Netzwerk-Aufruf),
idealerweise als Erstes in main.py.
"""

from __future__ import annotations

import os
import ssl
import sys
from functools import lru_cache

import certifi


@lru_cache(maxsize=1)
def ca_bundle() -> str:
    """Absoluter Pfad zum CA-Bundle (cacert.pem).

    Im PyInstaller-Bundle liegt das via `datas=[(certifi.where(), 'certifi')]` mitgepackte
    cacert.pem unter `<_MEIPASS>/certifi/cacert.pem`. Fällt darauf zurück, sonst auf
    `certifi.where()` (Dev-Modus / wenn der Bundle-Pfad fehlt).
    """
    if getattr(sys, "frozen", False):
        meipass = getattr(sys, "_MEIPASS", None)
        if meipass:
            bundled = os.path.join(meipass, "certifi", "cacert.pem")
            if os.path.exists(bundled):
                return bundled
    return certifi.where()


@lru_cache(maxsize=1)
def ssl_context() -> ssl.SSLContext:
    """Ein wiederverwendbarer SSLContext, der explizit das gebündelte CA-Bundle nutzt."""
    return ssl.create_default_context(cafile=ca_bundle())


def install_ca_bundle() -> None:
    """Setzt die Standard-CA-Env-Vars auf das gebündelte cacert.pem.

    Greift global für OpenSSL (ssl.create_default_context ohne cafile), httpx, requests,
    aiohttp etc. Wir überschreiben bewusst (nicht setdefault), damit ein leerer/falscher
    System-Wert das Bundle nicht aushebelt.
    """
    path = ca_bundle()
    if os.path.exists(path):
        os.environ["SSL_CERT_FILE"] = path
        os.environ["REQUESTS_CA_BUNDLE"] = path
        # SSL_CERT_DIR leeren, damit OpenSSL nicht auf ein leeres/fehlendes System-Verzeichnis
        # ausweicht und dadurch die Datei ignoriert.
        os.environ.pop("SSL_CERT_DIR", None)
