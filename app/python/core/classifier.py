"""Klassifizierung Rechnung/Quittung via Backend-Proxy. Keyword-Fallback bei Netz-Fehler.

Wichtig: Wir rufen NICHT direkt Anthropic. Stattdessen ruft der Sidecar das BillSorter-Backend
(api.billsorter.de bzw. http://localhost:8787 in Dev). Das Backend hat den Anthropic-Key zentral
und prüft die Lizenz pro Request. So braucht kein User einen eigenen API-Key.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

log = logging.getLogger("billsorter.classifier")

INVOICE_KEYWORDS = (
    "rechnung", "invoice", "quittung", "receipt", "faktura",
    "zahlung", "payment", "bill", "gutschrift", "lieferschein",
    "kostenaufstellung", "abrechnung",
)


@dataclass
class ClassificationResult:
    is_invoice: bool
    method: str  # 'ai' | 'fallback'
    reason: str | None = None


async def is_invoice(
    subject: str,
    sender: str,
    filename: str,
    *,
    backend_url: str,
    device_id: str,
    timeout_seconds: float = 12.0,
) -> ClassificationResult:
    """Klassifiziere einen Anhang über das Backend.

    backend_url: Basis-URL des BillSorter-Backends, z.B. 'http://localhost:8787' oder
                 'https://api.billsorter.de'. Wird vom Electron-Main übergeben.
    device_id:   raw machine-uuid. Backend hasht es selbst.
    """
    if not backend_url or not device_id:
        return _keyword_only(subject, filename, "missing_backend_or_device")

    url = backend_url.rstrip("/") + "/v1/llm/classify"
    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            res = await client.post(
                url,
                headers={"content-type": "application/json"},
                json={
                    "deviceId": device_id,
                    "subject": subject,
                    "sender": sender,
                    "filename": filename,
                },
            )
            if res.status_code == 402:
                # License expired / no device. Fallback auf Keywords.
                log.warning("backend rejects classify (402): falling back to keywords")
                return _keyword_only(subject, filename, "license_inactive")
            res.raise_for_status()
            data = res.json()
            return ClassificationResult(
                is_invoice=bool(data.get("is_invoice")),
                method=str(data.get("method", "ai")),
                reason=data.get("reason"),
            )
    except (httpx.HTTPError, httpx.TimeoutException, KeyError, ValueError) as exc:
        log.warning("backend classify failed: %s", exc)
        return _keyword_only(subject, filename, f"backend_error: {exc.__class__.__name__}")


def _keyword_only(subject: str, filename: str, reason: str) -> ClassificationResult:
    text = f"{subject} {filename}".lower()
    matched = any(kw in text for kw in INVOICE_KEYWORDS)
    return ClassificationResult(is_invoice=matched, method="fallback", reason=reason)


async def test_backend_reachable(
    backend_url: str,
    *,
    timeout_seconds: float = 5.0,
) -> tuple[bool, str | None]:
    """Schneller Smoke gegen Backend-Health."""
    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            res = await client.get(backend_url.rstrip("/") + "/health")
            if res.status_code == 200:
                return True, None
            return False, f"http {res.status_code}"
    except Exception as exc:  # noqa: BLE001
        return False, str(exc)
