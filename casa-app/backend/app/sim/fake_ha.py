"""Simulated Home Assistant: implements the subset of the HA WebSocket API that Casa App uses.

Used by the tests and for local development without a real HA:

    python -m app.sim.fake_ha --port 8123 --token sim

It creates a plausible state for every configured entity in config/entities.yaml,
applies service calls (set_value, turn_on, set_temperature ...) and emits state_changed.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

from websockets.asyncio.server import serve

from app.entities import EntityMap

log = logging.getLogger("casa.fake_ha")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def initial_state(entity_id: str, unit: str | None = None) -> dict:
    domain = entity_id.split(".", 1)[0]
    attrs: dict = {"friendly_name": entity_id}
    if domain == "input_number":
        state = "20.5"
        attrs.update(min=10, max=30, step=0.5, unit_of_measurement="°C")
    elif domain == "climate":
        state = "heat"
        attrs.update(temperature=0, hvac_modes=["off", "heat"])
    elif domain == "water_heater":
        state = "heat_pump"
        attrs.update(temperature=48, current_temperature=46.5)
    elif domain in {"switch", "input_boolean", "script"}:
        state = "off"
    elif domain == "sensor":
        if unit == "W":
            state = str(random.randint(300, 1500))
        elif unit == "%":
            state = str(random.randint(40, 90))
        elif unit == "km":
            state = str(random.randint(150, 400))
        else:
            state = f"{random.uniform(19.5, 21.5):.1f}"
        if unit:
            attrs["unit_of_measurement"] = unit
    else:
        state = "unknown"
    ts = _now()
    return {"entity_id": entity_id, "state": state, "attributes": attrs, "last_changed": ts, "last_updated": ts}


class FakeHA:
    def __init__(self, token: str = "sim", entities: EntityMap | None = None, drift: float = 0.0):
        self.token = token
        self.states: dict[str, dict] = {}
        self.subscribers: dict[object, int] = {}  # connection -> subscription id
        self.service_calls: list[dict] = []
        self.drift = drift
        self.server = None
        self.port: int | None = None
        self.fail_services: set[str] = set()
        if entities:
            for e in entities.configured():
                self.states.setdefault(e.entity_id, initial_state(e.entity_id, e.unit))

    # ------------------------------------------------------------ helpers for tests

    async def set_state(self, entity_id: str, state: str, attributes: dict | None = None) -> None:
        old = self.states.get(entity_id)
        attrs = dict(old["attributes"]) if old else {}
        if attributes:
            attrs.update(attributes)
        ts = _now()
        new = {
            "entity_id": entity_id,
            "state": state,
            "attributes": attrs,
            "last_changed": ts if not old or old["state"] != state else old["last_changed"],
            "last_updated": ts,
        }
        self.states[entity_id] = new
        await self._broadcast(entity_id, old, new)

    async def _broadcast(self, entity_id: str, old: dict | None, new: dict | None) -> None:
        for ws, sub_id in list(self.subscribers.items()):
            event = {
                "id": sub_id,
                "type": "event",
                "event": {"event_type": "state_changed", "data": {"entity_id": entity_id, "old_state": old, "new_state": new}},
            }
            try:
                await ws.send(json.dumps(event))
            except Exception:  # client gone
                self.subscribers.pop(ws, None)

    # ------------------------------------------------------------ server

    async def start(self, host: str = "127.0.0.1", port: int = 0) -> int:
        self.server = await serve(self._handler, host, port)
        self.port = self.server.sockets[0].getsockname()[1]
        if self.drift:
            asyncio.create_task(self._drift_loop())
        return self.port

    async def stop(self) -> None:
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            self.server = None
        self.subscribers.clear()

    @property
    def url(self) -> str:
        return f"ws://127.0.0.1:{self.port}/api/websocket"

    async def _handler(self, ws) -> None:
        await ws.send(json.dumps({"type": "auth_required", "ha_version": "2026.11.0-sim"}))
        try:
            msg = json.loads(await ws.recv())
        except Exception:
            return
        if msg.get("type") != "auth" or msg.get("access_token") != self.token:
            await ws.send(json.dumps({"type": "auth_invalid", "message": "Invalid access token"}))
            return
        await ws.send(json.dumps({"type": "auth_ok", "ha_version": "2026.11.0-sim"}))
        try:
            async for raw in ws:
                msg = json.loads(raw)
                await self._dispatch(ws, msg)
        except Exception:
            pass
        finally:
            self.subscribers.pop(ws, None)

    async def _result(self, ws, msg_id, result=None, error: tuple[str, str] | None = None) -> None:
        if error:
            payload = {"id": msg_id, "type": "result", "success": False, "error": {"code": error[0], "message": error[1]}}
        else:
            payload = {"id": msg_id, "type": "result", "success": True, "result": result}
        await ws.send(json.dumps(payload))

    async def _dispatch(self, ws, msg: dict) -> None:
        t = msg.get("type")
        mid = msg.get("id")
        if t == "subscribe_events":
            self.subscribers[ws] = mid
            await self._result(ws, mid)
        elif t == "get_states":
            await self._result(ws, mid, list(self.states.values()))
        elif t == "call_service":
            await self._call_service(ws, msg)
        elif t == "history/history_during_period":
            await self._result(ws, mid, self._history(msg))
        elif t == "recorder/statistics_during_period":
            await self._result(ws, mid, self._statistics(msg))
        elif t == "ping":
            await ws.send(json.dumps({"id": mid, "type": "pong"}))
        else:
            await self._result(ws, mid, error=("unknown_command", f"Unknown command {t}"))

    async def _call_service(self, ws, msg: dict) -> None:
        mid = msg["id"]
        domain, service = msg.get("domain"), msg.get("service")
        data = msg.get("service_data") or {}
        targets = (msg.get("target") or {}).get("entity_id") or data.get("entity_id")
        entity_ids = [targets] if isinstance(targets, str) else list(targets or [])
        self.service_calls.append({"domain": domain, "service": service, "entity_ids": entity_ids, "data": data})
        key = f"{domain}.{service}"
        if key in self.fail_services:
            await self._result(ws, mid, error=("home_assistant_error", f"Simulated failure of {key}"))
            return
        for entity_id in entity_ids:
            st = self.states.get(entity_id)
            if st is None:
                await self._result(ws, mid, error=("not_found", f"Entity {entity_id} not found"))
                return
            attrs = dict(st["attributes"])
            state = st["state"]
            if key in {"switch.turn_on", "input_boolean.turn_on"}:
                state = "on"
            elif key in {"switch.turn_off", "input_boolean.turn_off"}:
                state = "off"
            elif key == "input_number.set_value":
                state = str(float(data["value"]))
            elif key in {"climate.set_temperature", "water_heater.set_temperature"}:
                attrs["temperature"] = data["temperature"]
            elif key == "climate.set_hvac_mode":
                state = data["hvac_mode"]
            elif key == "script.turn_on":
                state = "on"
                asyncio.get_running_loop().call_later(1.0, lambda eid=entity_id: asyncio.ensure_future(self.set_state(eid, "off")))
            else:
                await self._result(ws, mid, error=("service_not_found", f"Service {key} not found"))
                return
            await self.set_state(entity_id, state, attrs)
        await self._result(ws, mid, {"context": {"id": "sim"}})

    def _history(self, msg: dict) -> dict:
        start = datetime.fromisoformat(msg["start_time"])
        end = datetime.fromisoformat(msg["end_time"]) if msg.get("end_time") else datetime.now(timezone.utc)
        out = {}
        for eid in msg.get("entity_ids", []):
            pts = []
            t = start
            base = float(self.states.get(eid, {}).get("state", 20) or 20) if str(self.states.get(eid, {}).get("state", "")).replace(".", "", 1).isdigit() else 20.0
            while t <= end:
                pts.append({"s": f"{base + random.uniform(-0.5, 0.5):.1f}", "lu": t.timestamp()})
                t += timedelta(minutes=30)
            out[eid] = pts
        return out

    def _statistics(self, msg: dict) -> dict:
        start = datetime.fromisoformat(msg["start_time"])
        end = datetime.fromisoformat(msg["end_time"]) if msg.get("end_time") else datetime.now(timezone.utc)
        step = timedelta(hours=1) if msg.get("period", "hour") == "hour" else timedelta(days=1)
        out = {}
        for sid in msg.get("statistic_ids", []):
            rows = []
            t = start
            while t < end:
                mean = 20 + 2 * random.random()
                rows.append({"start": int(t.timestamp() * 1000), "end": int((t + step).timestamp() * 1000), "mean": mean, "min": mean - 1, "max": mean + 1})
                t += step
            out[sid] = rows
        return out

    async def _drift_loop(self) -> None:
        while self.server is not None:
            await asyncio.sleep(self.drift)
            for eid, st in list(self.states.items()):
                if not eid.startswith("sensor."):
                    continue
                try:
                    v = float(st["state"])
                except ValueError:
                    continue
                unit = st["attributes"].get("unit_of_measurement")
                if unit == "W":
                    v = max(0.0, v + random.uniform(-120, 120))
                    new = str(round(v))
                elif unit in {"%", "km"}:
                    continue
                else:
                    new = f"{v + random.uniform(-0.1, 0.1):.1f}"
                await self.set_state(eid, new)


async def _main() -> None:
    parser = argparse.ArgumentParser(description="Simulated Home Assistant for Casa App")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8123)
    parser.add_argument("--token", default="sim")
    parser.add_argument("--entities", default=str(Path(__file__).resolve().parents[3] / "config" / "entities.yaml"))
    parser.add_argument("--drift", type=float, default=5.0, help="seconds between sensor changes (0 = off)")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    sim = FakeHA(token=args.token, entities=EntityMap.load(Path(args.entities)), drift=args.drift)
    port = await sim.start(args.host, args.port)
    log.info("simulated HA on ws://%s:%d/api/websocket (%d entities)", args.host, port, len(sim.states))
    await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(_main())
