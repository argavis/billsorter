"""Pydantic Request/Response Models — schmale public API."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ProviderInput(BaseModel):
    id: str
    provider_id: str = Field(..., description="Slug aus core.providers.PROVIDERS")
    label: str
    email: str
    password: str
    imap_host: str | None = None
    imap_port: int | None = None


class ScanRequest(BaseModel):
    providers: list[ProviderInput]
    backend_url: str
    device_id: str
    target_folder: str
    locale: Literal["de", "en"] = "de"
    days_back: int = Field(default=7, ge=1, le=365)


class ScanSinceRequest(BaseModel):
    providers: list[ProviderInput]
    backend_url: str
    device_id: str
    target_folder: str
    locale: Literal["de", "en"] = "de"
    since: datetime


class TestImapRequest(BaseModel):
    providers: list[ProviderInput]


class TestBackendRequest(BaseModel):
    backend_url: str


# Output-Modelle nutzen camelCase weil der Renderer (TypeScript) sie direkt liest.
# Eingabe-Modelle (ScanRequest etc.) bleiben snake_case — beide Seiten haben den gleichen Vertrag.

class JobStatsOut(BaseModel):
    found: int
    saved: int
    skippedDuplicate: int  # noqa: N815
    skippedNotInvoice: int  # noqa: N815
    errors: int


class JobOut(BaseModel):
    id: str
    state: Literal["pending", "running", "done", "failed"]
    startedAt: datetime | None  # noqa: N815
    finishedAt: datetime | None  # noqa: N815
    stats: JobStatsOut
    error: str | None


class ProviderTestResult(BaseModel):
    providerId: str  # noqa: N815
    label: str
    ok: bool
    error: str | None
    mailboxCount: int | None  # noqa: N815


class TestImapResponse(BaseModel):
    results: list[ProviderTestResult]


class TestBackendResponse(BaseModel):
    ok: bool
    error: str | None


class ProviderPresetOut(BaseModel):
    id: str
    label: str
    imap_host: str | None
    imap_port: int
    help_url: str
    requires_app_password: bool
    notes_de: str
    notes_en: str
