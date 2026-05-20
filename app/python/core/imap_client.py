"""Sync-IMAP-Wrapper (imaplib aus stdlib). Wir wrappen ihn in anyio-Threads für async API.

Kein imaplib2 / aioimaplib weil deren Wheel-Build auf PyInstaller-Bundle-Compatibility-Probleme hat.
imaplib aus stdlib ist tausendfach getestet, robust für ~hunderte Mails pro Run.
"""

from __future__ import annotations

import email
import imaplib
import logging
import ssl
from dataclasses import dataclass
from datetime import datetime, timedelta
from email.header import decode_header
from email.message import Message
from email.utils import parsedate_to_datetime
from pathlib import Path

log = logging.getLogger("billsorter.imap")

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".png", ".jpg", ".jpeg", ".xml"}


@dataclass
class Attachment:
    filename: str
    content: bytes
    sender: str
    subject: str
    date: datetime


@dataclass
class ConnectionResult:
    ok: bool
    error: str | None
    mailbox_count: int | None


def test_connection(host: str, port: int, email_addr: str, password: str) -> ConnectionResult:
    try:
        with _connect(host, port, email_addr, password) as imap:
            typ, data = imap.select("INBOX", readonly=True)
            if typ != "OK":
                return ConnectionResult(False, "INBOX nicht erreichbar", None)
            count_str = data[0].decode("ascii", errors="ignore")
            return ConnectionResult(True, None, int(count_str) if count_str.isdigit() else None)
    except imaplib.IMAP4.error as exc:
        return ConnectionResult(False, f"IMAP-Fehler: {exc}", None)
    except (OSError, ssl.SSLError) as exc:
        return ConnectionResult(False, f"Netzwerk-Fehler: {exc}", None)


def fetch_attachments_since(
    host: str,
    port: int,
    email_addr: str,
    password: str,
    since: datetime,
) -> list[Attachment]:
    out: list[Attachment] = []
    with _connect(host, port, email_addr, password) as imap:
        imap.select("INBOX", readonly=True)
        since_str = since.strftime("%d-%b-%Y")
        _, ids_resp = imap.search(None, f'(SINCE "{since_str}")')
        ids = ids_resp[0].split() if ids_resp else []
        log.info("found %d mail(s) since %s on %s", len(ids), since_str, host)

        for mid in ids:
            _, raw = imap.fetch(mid, "(RFC822)")
            if not raw or not raw[0]:
                continue
            msg = email.message_from_bytes(raw[0][1])
            subject = _decode_str(msg.get("Subject", ""))
            sender = _decode_str(msg.get("From", ""))
            try:
                date = parsedate_to_datetime(msg.get("Date", ""))
            except (TypeError, ValueError):
                date = datetime.now()

            for part in _iter_attachments(msg):
                filename = _decode_str(part.get_filename() or "")
                if not filename:
                    continue
                if Path(filename).suffix.lower() not in ALLOWED_EXTENSIONS:
                    continue
                payload = part.get_payload(decode=True)
                if not payload:
                    continue
                out.append(
                    Attachment(
                        filename=filename,
                        content=payload,
                        sender=sender,
                        subject=subject,
                        date=date,
                    )
                )
    return out


def days_ago(days: int) -> datetime:
    return datetime.now() - timedelta(days=days)


# ───── internals ─────

def _connect(host: str, port: int, email_addr: str, password: str) -> imaplib.IMAP4_SSL:
    context = ssl.create_default_context()
    imap = imaplib.IMAP4_SSL(host, port, ssl_context=context, timeout=30)
    imap.login(email_addr, password)
    return imap


def _iter_attachments(msg: Message):
    for part in msg.walk():
        if part.get_content_disposition() == "attachment":
            yield part


def _decode_str(value: str | None) -> str:
    if value is None:
        return ""
    parts = decode_header(value)
    out = ""
    for chunk, enc in parts:
        if isinstance(chunk, bytes):
            out += chunk.decode(enc or "utf-8", errors="ignore")
        else:
            out += chunk
    return out
