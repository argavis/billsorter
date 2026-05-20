"""FastAPI App-Builder. Alle Routen unter /v1, plus WebSocket /v1/logs/:job_id."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

import anyio
from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    Request,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from fastapi.middleware.cors import CORSMiddleware

from api.models import (
    JobOut,
    JobStatsOut,
    ProviderPresetOut,
    ProviderTestResult,
    ScanRequest,
    ScanSinceRequest,
    TestBackendRequest,
    TestBackendResponse,
    TestImapRequest,
    TestImapResponse,
)
from core.agent import (
    Job,
    ProviderConfig,
    ScanRunner,
    default_since_for_days,
)
from core.classifier import test_backend_reachable
from core.imap_client import test_connection
from core.providers import PROVIDERS, resolve_imap
from lib.log_bus import LogBus, line_to_dict

log = logging.getLogger("billsorter.api")
VERSION = "0.1.0"


def build_app(*, auth_token: str) -> FastAPI:
    app = FastAPI(title="BillSorter Sidecar", version=VERSION)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Sidecar bindet eh nur an 127.0.0.1, Token-Auth schützt
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["authorization", "content-type"],
    )

    log_bus = LogBus()
    runner = ScanRunner(log_bus)

    def require_token(request: Request) -> None:
        header = request.headers.get("authorization") or ""
        expected = f"Bearer {auth_token}"
        if header != expected:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token")

    # ───── HEALTH + META ─────

    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok", "version": VERSION}

    @app.get("/v1/providers", response_model=list[ProviderPresetOut])
    async def list_providers(_: None = Depends(require_token)) -> list[ProviderPresetOut]:
        return [
            ProviderPresetOut(
                id=p.id,
                label=p.label,
                imap_host=p.imap_host,
                imap_port=p.imap_port,
                help_url=p.help_url,
                requires_app_password=p.requires_app_password,
                notes_de=p.notes_de,
                notes_en=p.notes_en,
            )
            for p in PROVIDERS.values()
        ]

    # ───── SCAN ─────

    @app.post("/v1/scan", response_model=JobOut)
    async def start_scan(body: ScanRequest, _: None = Depends(require_token)) -> JobOut:
        provider_cfgs = _to_provider_configs(body.providers)
        since = default_since_for_days(body.days_back)
        job = await runner.start_scan(
            providers=provider_cfgs,
            backend_url=body.backend_url,
            device_id=body.device_id,
            target_root=Path(body.target_folder).expanduser(),
            since=since,
            locale=body.locale,
        )
        return _job_to_dto(job)

    @app.post("/v1/scan/since", response_model=JobOut)
    async def start_scan_since(body: ScanSinceRequest, _: None = Depends(require_token)) -> JobOut:
        provider_cfgs = _to_provider_configs(body.providers)
        job = await runner.start_scan(
            providers=provider_cfgs,
            backend_url=body.backend_url,
            device_id=body.device_id,
            target_root=Path(body.target_folder).expanduser(),
            since=body.since,
            locale=body.locale,
        )
        return _job_to_dto(job)

    @app.get("/v1/jobs", response_model=list[JobOut])
    async def list_jobs(_: None = Depends(require_token)) -> list[JobOut]:
        return [_job_to_dto(j) for j in runner.list_jobs()]

    @app.get("/v1/jobs/{job_id}", response_model=JobOut)
    async def get_job(job_id: str, _: None = Depends(require_token)) -> JobOut:
        job = runner.get_job(job_id)
        if not job:
            raise HTTPException(404, "job not found")
        return _job_to_dto(job)

    @app.post("/v1/jobs/{job_id}/cancel")
    async def cancel_job(job_id: str, _: None = Depends(require_token)) -> dict:
        cancelled = await runner.cancel(job_id)
        return {"cancelled": cancelled}

    # ───── CONNECTION TESTS ─────

    @app.post("/v1/test-imap", response_model=TestImapResponse)
    async def test_imap(body: TestImapRequest, _: None = Depends(require_token)) -> TestImapResponse:
        results: list[ProviderTestResult] = []
        for p in body.providers:
            try:
                host, port = resolve_imap(p.provider_id, p.imap_host, p.imap_port)
            except ValueError as exc:
                results.append(ProviderTestResult(
                    providerId=p.provider_id, label=p.label, ok=False,
                    error=str(exc), mailboxCount=None,
                ))
                continue
            res = await anyio.to_thread.run_sync(
                test_connection, host, port, p.email, p.password,
            )
            results.append(ProviderTestResult(
                providerId=p.provider_id, label=p.label, ok=res.ok,
                error=res.error, mailboxCount=res.mailbox_count,
            ))
        return TestImapResponse(results=results)

    @app.post("/v1/test-backend", response_model=TestBackendResponse)
    async def test_backend(body: TestBackendRequest, _: None = Depends(require_token)) -> TestBackendResponse:
        ok, err = await test_backend_reachable(body.backend_url)
        return TestBackendResponse(ok=ok, error=err)

    # ───── LIVE LOGS (WebSocket) ─────

    @app.websocket("/v1/logs/{job_id}")
    async def ws_logs(websocket: WebSocket, job_id: str) -> None:
        # Token via Query-Param weil WS-Header in Browsern eingeschränkt sind.
        token_qp = websocket.query_params.get("token")
        if token_qp != auth_token:
            await websocket.close(code=4401)
            return

        await websocket.accept()
        # History first
        for line in log_bus.history(job_id):
            await websocket.send_json(line_to_dict(line))

        queue = await log_bus.subscribe(job_id)
        try:
            while True:
                try:
                    line = await asyncio.wait_for(queue.get(), timeout=30)
                    await websocket.send_json(line_to_dict(line))
                except asyncio.TimeoutError:
                    # Keep-alive Ping
                    await websocket.send_json({"keepalive": True})
        except WebSocketDisconnect:
            pass
        finally:
            await log_bus.unsubscribe(job_id, queue)

    return app


# ───── helpers ─────

def _to_provider_configs(items) -> list[ProviderConfig]:
    out: list[ProviderConfig] = []
    for item in items:
        out.append(
            ProviderConfig(
                id=item.id,
                provider_id=item.provider_id,
                label=item.label,
                email=item.email,
                password=item.password,
                imap_host=item.imap_host,
                imap_port=item.imap_port,
            )
        )
    return out


def _job_to_dto(job: Job) -> JobOut:
    return JobOut(
        id=job.id,
        state=job.state,
        startedAt=job.started_at,
        finishedAt=job.finished_at,
        stats=JobStatsOut(
            found=job.stats.found,
            saved=job.stats.saved,
            skippedDuplicate=job.stats.skipped_duplicate,
            skippedNotInvoice=job.stats.skipped_not_invoice,
            errors=job.stats.errors,
        ),
        error=job.error,
    )
