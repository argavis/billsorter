"""Scan-Orchestrator — orchestriert mehrere Provider parallel, klassifiziert + speichert."""

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Literal

import anyio

from core.classifier import is_invoice
from core.imap_client import (
    Attachment,
    days_ago,
    fetch_attachments_since,
)
from core.providers import resolve_imap
from core.storage import save_attachment, target_folder
from lib.log_bus import LogBus

log = logging.getLogger("billsorter.agent")

JobState = Literal["pending", "running", "done", "failed"]


@dataclass
class ProviderConfig:
    id: str
    provider_id: str       # 'gmail-imap', 'outlook-365', ...
    label: str
    email: str
    password: str
    imap_host: str | None  # None → von provider_id ableiten
    imap_port: int | None


@dataclass
class JobStats:
    found: int = 0
    saved: int = 0
    skipped_duplicate: int = 0
    skipped_not_invoice: int = 0
    errors: int = 0


@dataclass
class Job:
    id: str
    state: JobState = "pending"
    started_at: datetime | None = None
    finished_at: datetime | None = None
    stats: JobStats = field(default_factory=JobStats)
    error: str | None = None


class ScanRunner:
    def __init__(self, log_bus: LogBus) -> None:
        self._log_bus = log_bus
        self._jobs: dict[str, Job] = {}
        self._tasks: dict[str, asyncio.Task] = {}

    def get_job(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)

    def list_jobs(self) -> list[Job]:
        return list(self._jobs.values())

    async def start_scan(
        self,
        *,
        providers: list[ProviderConfig],
        backend_url: str,
        device_id: str,
        target_root: Path,
        since: datetime,
        locale: str = "de",
    ) -> Job:
        job = Job(id=str(uuid.uuid4()))
        self._jobs[job.id] = job
        coro = self._run(job, providers, backend_url, device_id, target_root, since, locale)
        task = asyncio.create_task(coro)
        self._tasks[job.id] = task
        return job

    async def cancel(self, job_id: str) -> bool:
        task = self._tasks.get(job_id)
        if not task or task.done():
            return False
        task.cancel()
        return True

    # ───── internals ─────

    async def _run(
        self,
        job: Job,
        providers: list[ProviderConfig],
        backend_url: str,
        device_id: str,
        target_root: Path,
        since: datetime,
        locale: str,
    ) -> None:
        job.state = "running"
        job.started_at = datetime.now()
        self._log_bus.emit(job.id, "info", f"Scan gestartet — {len(providers)} Provider, seit {since:%d.%m.%Y}")

        try:
            target_root.mkdir(parents=True, exist_ok=True)
            async with anyio.create_task_group() as tg:
                for p in providers:
                    tg.start_soon(self._scan_provider, job, p, backend_url, device_id, target_root, since, locale)
            job.state = "done"
            self._log_bus.emit(
                job.id,
                "success",
                f"Fertig — {job.stats.found} Anhänge gefunden, {job.stats.saved} gespeichert, "
                f"{job.stats.skipped_not_invoice} übersprungen, {job.stats.skipped_duplicate} Duplikate, "
                f"{job.stats.errors} Fehler",
            )
        except Exception as exc:  # noqa: BLE001
            job.state = "failed"
            job.error = str(exc)
            self._log_bus.emit(job.id, "error", f"Scan abgebrochen: {exc}")
            log.exception("scan failed for job %s", job.id)
        finally:
            job.finished_at = datetime.now()

    async def _scan_provider(
        self,
        job: Job,
        provider: ProviderConfig,
        backend_url: str,
        device_id: str,
        target_root: Path,
        since: datetime,
        locale: str,
    ) -> None:
        try:
            host, port = resolve_imap(provider.provider_id, provider.imap_host, provider.imap_port)
        except ValueError as exc:
            job.stats.errors += 1
            self._log_bus.emit(job.id, "error", f"{provider.label}: {exc}")
            return

        self._log_bus.emit(job.id, "info", f"📬 {provider.label}: Scan via {host}:{port} ...")

        try:
            # IMAP ist sync → in Thread auslagern damit Event-Loop frei bleibt
            attachments = await anyio.to_thread.run_sync(
                fetch_attachments_since,
                host,
                port,
                provider.email,
                provider.password,
                since,
            )
        except Exception as exc:  # noqa: BLE001
            job.stats.errors += 1
            self._log_bus.emit(job.id, "error", f"{provider.label}: IMAP-Fehler: {exc}")
            return

        self._log_bus.emit(job.id, "info", f"  {provider.label}: {len(attachments)} Anhang/Anhänge gefunden")
        job.stats.found += len(attachments)

        for att in attachments:
            await self._process_attachment(job, att, backend_url, device_id, target_root, locale)

    async def _process_attachment(
        self,
        job: Job,
        att: Attachment,
        backend_url: str,
        device_id: str,
        target_root: Path,
        locale: str,
    ) -> None:
        try:
            result = await is_invoice(
                att.subject, att.sender, att.filename,
                backend_url=backend_url, device_id=device_id,
            )
            if not result.is_invoice:
                job.stats.skipped_not_invoice += 1
                self._log_bus.emit(
                    job.id, "info",
                    f"  ⏭️  Kein Rechnungsanhang: {att.filename}",
                )
                return

            folder = target_folder(target_root, att.date, locale=locale)
            path, was_new = save_attachment(folder, att.filename, att.content)
            if was_new:
                job.stats.saved += 1
                self._log_bus.emit(job.id, "success", f"  ✅ Gespeichert: {path.name}")
            else:
                job.stats.skipped_duplicate += 1
                self._log_bus.emit(job.id, "info", f"  ⏭️  Duplikat: {att.filename}")
        except Exception as exc:  # noqa: BLE001
            job.stats.errors += 1
            self._log_bus.emit(job.id, "error", f"  Fehler bei {att.filename}: {exc}")


def default_since_for_days(days: int) -> datetime:
    return days_ago(days)
