"""In-memory pub/sub für Live-Logs.

Pro Job-ID hält der Bus eine asyncio.Queue + den bisherigen Verlauf (ringpuffer).
WebSocket-Clients subscriben, bekommen erst History dann Live-Lines.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from dataclasses import asdict, dataclass
from typing import Literal

log = logging.getLogger("billsorter.logbus")

LogLevel = Literal["info", "warn", "error", "success"]


@dataclass
class LogLine:
    job_id: str
    ts: float
    level: LogLevel
    message: str


class LogBus:
    def __init__(self, history_size: int = 500) -> None:
        self._history: dict[str, deque[LogLine]] = {}
        self._subscribers: dict[str, set[asyncio.Queue[LogLine]]] = {}
        self._history_size = history_size
        self._lock = asyncio.Lock()

    def history(self, job_id: str) -> list[LogLine]:
        return list(self._history.get(job_id, ()))

    def emit(self, job_id: str, level: LogLevel, message: str) -> None:
        line = LogLine(job_id=job_id, ts=time.time(), level=level, message=message)
        if job_id not in self._history:
            self._history[job_id] = deque(maxlen=self._history_size)
        self._history[job_id].append(line)
        # Fan-out non-blocking. Slow subscriber → wir droppen für sie.
        subs = self._subscribers.get(job_id, set())
        for q in list(subs):
            try:
                q.put_nowait(line)
            except asyncio.QueueFull:
                log.warning("log subscriber slow, dropping line for job %s", job_id)

    async def subscribe(self, job_id: str) -> asyncio.Queue[LogLine]:
        queue: asyncio.Queue[LogLine] = asyncio.Queue(maxsize=1024)
        async with self._lock:
            self._subscribers.setdefault(job_id, set()).add(queue)
        return queue

    async def unsubscribe(self, job_id: str, queue: asyncio.Queue[LogLine]) -> None:
        async with self._lock:
            self._subscribers.get(job_id, set()).discard(queue)

    def drop_job(self, job_id: str) -> None:
        self._history.pop(job_id, None)
        self._subscribers.pop(job_id, None)


def line_to_dict(line: LogLine) -> dict:
    d = asdict(line)
    return d
