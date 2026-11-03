"""Writes the long-term history (RF-03, RF-04): at most one value every N seconds per entity.

The first change is written at once. Changes inside the window are held and the last one
is written when the window ends, so the final value is never lost.
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone

from app.entities import EntityMap
from app.repository import Measure, Repository
from app.state import _clean_attributes, value_of

log = logging.getLogger("casa.history")

SKIP_STATES = {"unknown", "unavailable", None, ""}


def to_measure(name: str, value, attrs: dict | None, ts: datetime) -> Measure:
    num = None
    text = None
    if isinstance(value, bool):
        num = 1.0 if value else 0.0
    elif isinstance(value, (int, float)):
        num = float(value)
    elif value is not None:
        s = str(value)
        try:
            num = float(s)
        except ValueError:
            text = s
            if s in {"on", "off"}:
                num = 1.0 if s == "on" else 0.0
    return Measure(ts=ts, entita=name, valore_num=num, valore_testo=text, attributi=attrs or None)


class HistoryWriter:
    def __init__(self, entities: EntityMap, repo: Repository, min_interval: float = 10.0, clock=time.monotonic):
        self.entities = entities
        self.repo = repo
        self.min_interval = min_interval
        self.clock = clock
        self._last_write: dict[str, float] = {}
        self._held: dict[str, Measure] = {}
        self._timers: dict[str, asyncio.TimerHandle] = {}
        self._buffer: list[Measure] = []
        self._flush_task: asyncio.Task | None = None

    async def on_state(self, entity_id: str, ha_state: dict | None) -> None:
        if not ha_state:
            return
        for e in self.entities.for_entity_id(entity_id):
            if not e.log:
                continue
            value = value_of(e, ha_state)
            if value in SKIP_STATES:
                continue
            attrs = None if e.attribute else _clean_attributes(ha_state.get("attributes", {}))
            measure = to_measure(e.name, value, attrs, datetime.now(timezone.utc))
            self._offer(measure)

    def _offer(self, m: Measure) -> None:
        now = self.clock()
        last = self._last_write.get(m.entita)
        if last is None or now - last >= self.min_interval:
            self._write(m, now)
            return
        self._held[m.entita] = m
        if m.entita not in self._timers:
            delay = self.min_interval - (now - last)
            self._timers[m.entita] = asyncio.get_running_loop().call_later(delay, self._release, m.entita)

    def _release(self, name: str) -> None:
        self._timers.pop(name, None)
        m = self._held.pop(name, None)
        if m:
            self._write(m, self.clock())

    def _write(self, m: Measure, now: float) -> None:
        self._last_write[m.entita] = now
        self._buffer.append(m)
        if self._flush_task is None or self._flush_task.done():
            self._flush_task = asyncio.create_task(self._flush_soon())

    async def _flush_soon(self) -> None:
        await asyncio.sleep(0.5)  # group the writes of a burst into one insert
        await self.flush()

    async def flush(self) -> None:
        rows, self._buffer = self._buffer, []
        if not rows:
            return
        try:
            await self.repo.insert_measures(rows)
        except Exception:
            log.exception("history write failed, %d values kept for retry", len(rows))
            self._buffer = rows + self._buffer

    async def close(self) -> None:
        if self._flush_task and not self._flush_task.done():
            self._flush_task.cancel()
        for name in list(self._timers):
            self._timers.pop(name).cancel()
            m = self._held.pop(name, None)
            if m:
                self._buffer.append(m)
        await self.flush()
