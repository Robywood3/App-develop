"""Home Assistant WebSocket API client.

The only component that talks to HA. It authenticates with a long-lived token,
subscribes to state_changed, calls services and reads history/statistics.
On connection loss it retries with growing delay (1, 2, 4 ... 60 s) and
re-reads all states after reconnecting.
"""
from __future__ import annotations

import asyncio
import itertools
import json
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from websockets.asyncio.client import connect as ws_connect

log = logging.getLogger("casa.ha")

StateListener = Callable[[str, dict | None], Awaitable[None] | None]
ConnectionListener = Callable[[bool], Awaitable[None] | None]


class HAError(Exception):
    """HA answered with an error."""


class HANotConnected(HAError):
    """No connection to HA right now."""


async def _maybe_await(value):
    if asyncio.iscoroutine(value):
        await value


class HAClient:
    def __init__(self, url: str, token: str, *, max_backoff: float = 60.0, request_timeout: float = 15.0):
        self.url = url
        self.token = token
        self.max_backoff = max_backoff
        self.request_timeout = request_timeout
        self.states: dict[str, dict] = {}
        self.connected = asyncio.Event()
        self._ws = None
        self._ids = itertools.count(1)
        self._pending: dict[int, asyncio.Future] = {}
        self._state_listeners: list[StateListener] = []
        self._conn_listeners: list[ConnectionListener] = []
        self._task: asyncio.Task | None = None
        self._stopping = False
        self.ha_version: str | None = None

    # ------------------------------------------------------------ listeners

    def on_state(self, fn: StateListener) -> None:
        self._state_listeners.append(fn)

    def on_connection(self, fn: ConnectionListener) -> None:
        self._conn_listeners.append(fn)

    async def _emit_state(self, entity_id: str, new_state: dict | None) -> None:
        for fn in self._state_listeners:
            try:
                await _maybe_await(fn(entity_id, new_state))
            except Exception:  # a listener must never break the receive loop
                log.exception("state listener failed")

    async def _emit_connection(self, up: bool) -> None:
        for fn in self._conn_listeners:
            try:
                await _maybe_await(fn(up))
            except Exception:
                log.exception("connection listener failed")

    # ------------------------------------------------------------ lifecycle

    def start(self) -> None:
        self._stopping = False
        self._task = asyncio.create_task(self._run(), name="ha-client")

    async def stop(self) -> None:
        self._stopping = True
        if self._ws is not None:
            await self._ws.close()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass

    async def _run(self) -> None:
        delay = 1.0
        while not self._stopping:
            try:
                await self._session()
                delay = 1.0  # clean disconnect after a working session
            except asyncio.CancelledError:
                raise
            except Exception as err:  # noqa: BLE001 - every failure means "retry"
                log.warning("HA connection failed: %s", err)
            finally:
                was_up = self.connected.is_set()
                self.connected.clear()
                self._ws = None
                for fut in self._pending.values():
                    if not fut.done():
                        fut.set_exception(HANotConnected("Connessione con Home Assistant persa"))
                self._pending.clear()
                if was_up:
                    delay = 1.0  # a working session ended: restart the backoff from 1 s
                    await self._emit_connection(False)
            if self._stopping:
                break
            log.info("HA reconnect in %.0f s", delay)
            await asyncio.sleep(delay)
            delay = min(delay * 2, self.max_backoff)

    async def _session(self) -> None:
        async with ws_connect(self.url, max_size=32 * 1024 * 1024, open_timeout=10) as ws:
            msg = json.loads(await ws.recv())
            if msg.get("type") != "auth_required":
                raise HAError(f"unexpected handshake: {msg}")
            await ws.send(json.dumps({"type": "auth", "access_token": self.token}))
            msg = json.loads(await ws.recv())
            if msg.get("type") != "auth_ok":
                raise HAError("HA rejected the token (auth_invalid)")
            self.ha_version = msg.get("ha_version")
            self._ws = ws
            reader = asyncio.create_task(self._reader(ws))
            try:
                await self._send_raw({"type": "subscribe_events", "event_type": "state_changed"})
                states = await self._send_raw({"type": "get_states"})
                self.states = {s["entity_id"]: s for s in states}
                self.connected.set()
                log.info("connected to HA %s, %d entities", self.ha_version, len(self.states))
                await self._emit_connection(True)
                for entity_id, st in self.states.items():
                    await self._emit_state(entity_id, st)
                await reader
            finally:
                reader.cancel()

    async def _reader(self, ws) -> None:
        async for raw in ws:
            msg = json.loads(raw)
            if msg.get("type") == "event":
                data = msg.get("event", {}).get("data", {})
                entity_id = data.get("entity_id")
                if entity_id:
                    new_state = data.get("new_state")
                    if new_state is None:
                        self.states.pop(entity_id, None)
                    else:
                        self.states[entity_id] = new_state
                    await self._emit_state(entity_id, new_state)
                continue
            fut = self._pending.pop(msg.get("id"), None)
            if fut is None or fut.done():
                continue
            if msg.get("type") == "result" and not msg.get("success", False):
                err = msg.get("error") or {}
                fut.set_exception(HAError(f"{err.get('code', 'error')}: {err.get('message', '')}"))
            else:
                fut.set_result(msg.get("result"))

    async def _send_raw(self, payload: dict) -> Any:
        ws = self._ws
        if ws is None:
            raise HANotConnected("Home Assistant non connesso")
        msg_id = next(self._ids)
        fut = asyncio.get_running_loop().create_future()
        self._pending[msg_id] = fut
        await ws.send(json.dumps({"id": msg_id, **payload}))
        try:
            return await asyncio.wait_for(fut, self.request_timeout)
        finally:
            self._pending.pop(msg_id, None)

    # ------------------------------------------------------------ public API

    async def request(self, payload: dict) -> Any:
        if not self.connected.is_set():
            raise HANotConnected("Home Assistant non connesso")
        return await self._send_raw(payload)

    async def call_service(self, domain: str, service: str, entity_id: str, data: dict | None = None) -> Any:
        return await self.request({
            "type": "call_service",
            "domain": domain,
            "service": service,
            "service_data": data or {},
            "target": {"entity_id": entity_id},
        })

    async def history(self, entity_ids: list[str], start: str, end: str | None = None) -> dict:
        payload = {
            "type": "history/history_during_period",
            "start_time": start,
            "entity_ids": entity_ids,
            "minimal_response": True,
            "no_attributes": True,
        }
        if end:
            payload["end_time"] = end
        return await self.request(payload)

    async def statistics(self, statistic_ids: list[str], start: str, end: str | None = None, period: str = "hour") -> dict:
        payload = {
            "type": "recorder/statistics_during_period",
            "start_time": start,
            "statistic_ids": statistic_ids,
            "period": period,
            "types": ["mean", "min", "max", "state"],
        }
        if end:
            payload["end_time"] = end
        return await self.request(payload)
