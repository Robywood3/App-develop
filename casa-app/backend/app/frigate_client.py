"""Frigate and go2rtc gateway (section 7).

- camera list from the Frigate config;
- live video: the backend relays the WebRTC offer/answer to go2rtc (media flows directly);
- events: Frigate publishes on MQTT `frigate/events`; the backend stores them in `eventi_video`;
- clips: streamed from Frigate through the backend, never exposed directly.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from collections.abc import AsyncIterator
from datetime import datetime, timezone

import httpx

from app.repository import Repository

log = logging.getLogger("casa.frigate")

SAFE_ID = re.compile(r"^[A-Za-z0-9_.\-]{1,100}$")
TRACKED = {"person", "car"}


class FrigateError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


def parse_event(payload: dict) -> dict | None:
    """MQTT frigate/events message -> row for eventi_video (None if not relevant)."""
    after = payload.get("after") or {}
    if not after.get("id") or after.get("label") not in TRACKED or after.get("false_positive"):
        return None
    start = after.get("start_time")
    if start is None:
        return None
    end = after.get("end_time")
    return {
        "id_frigate": str(after["id"]),
        "ts": datetime.fromtimestamp(float(start), tz=timezone.utc),
        "fine": datetime.fromtimestamp(float(end), tz=timezone.utc) if end else None,
        "telecamera": after.get("camera", ""),
        "oggetto": after["label"],
        "clip": bool(after.get("has_clip")),
        "punteggio": after.get("top_score") or after.get("score"),
    }


class FrigateClient:
    def __init__(self, frigate_url: str, go2rtc_url: str, repo: Repository, http: httpx.AsyncClient | None = None):
        self.frigate_url = frigate_url
        self.go2rtc_url = go2rtc_url
        self.repo = repo
        self.http = http or httpx.AsyncClient(timeout=15)
        self._cameras: list[str] | None = None

    @property
    def enabled(self) -> bool:
        return bool(self.frigate_url)

    def _require(self) -> None:
        if not self.enabled:
            raise FrigateError(503, "Telecamere non configurate (FRIGATE_URL)")

    def check_name(self, name: str) -> str:
        if not SAFE_ID.match(name):
            raise FrigateError(400, "Nome non valido")
        return name

    async def cameras(self) -> list[str]:
        self._require()
        try:
            r = await self.http.get(f"{self.frigate_url}/api/config")
            r.raise_for_status()
            self._cameras = sorted((r.json().get("cameras") or {}).keys())
        except httpx.HTTPError as err:
            if self._cameras is None:
                raise FrigateError(502, f"Frigate non risponde: {err}") from err
        return self._cameras

    async def _known_camera(self, name: str) -> str:
        self.check_name(name)
        if name not in (self._cameras or await self.cameras()):
            raise FrigateError(404, "Telecamera sconosciuta")
        return name

    async def snapshot(self, name: str, height: int = 360) -> bytes:
        await self._known_camera(name)
        r = await self.http.get(f"{self.frigate_url}/api/{name}/latest.jpg", params={"h": height})
        if r.status_code != 200:
            raise FrigateError(502, "Immagine non disponibile")
        return r.content

    async def webrtc_answer(self, name: str, offer_sdp: str) -> str:
        await self._known_camera(name)
        if not self.go2rtc_url:
            raise FrigateError(503, "go2rtc non configurato (GO2RTC_URL)")
        r = await self.http.post(f"{self.go2rtc_url}/api/webrtc", params={"src": name}, json={"type": "offer", "sdp": offer_sdp})
        if r.status_code >= 400:
            raise FrigateError(502, "Diretta non disponibile")
        return r.json()["sdp"]

    async def events(self, telecamera: str | None, oggetto: str | None, start: datetime, end: datetime) -> list[dict]:
        if telecamera:
            self.check_name(telecamera)
        return await self.repo.list_video_events(telecamera, oggetto, start, end)

    async def clip(self, event_id: str) -> AsyncIterator[bytes]:
        self._require()
        self.check_name(event_id)
        ev = await self.repo.get_video_event(event_id)
        if ev is None or not ev["clip"]:
            raise FrigateError(404, "Clip non trovata")
        req = self.http.build_request("GET", f"{self.frigate_url}/api/events/{event_id}/clip.mp4")
        resp = await self.http.send(req, stream=True)
        if resp.status_code != 200:
            await resp.aclose()
            raise FrigateError(404, "Clip non più disponibile")

        async def body():
            try:
                async for chunk in resp.aiter_bytes(64 * 1024):
                    yield chunk
            finally:
                await resp.aclose()

        return body()

    async def handle_mqtt(self, payload: bytes, publish=None) -> None:
        try:
            ev = parse_event(json.loads(payload))
        except (ValueError, TypeError):
            log.warning("invalid frigate/events message")
            return
        if ev is None:
            return
        await self.repo.upsert_video_event(ev)
        if publish:
            publish({"tipo": "evento_video", "dati": {**ev, "ts": ev["ts"].isoformat(), "fine": ev["fine"].isoformat() if ev["fine"] else None, "id": ev["id_frigate"]}})

    async def mqtt_loop(self, host: str, port: int, user: str, password: str, publish=None) -> None:
        import aiomqtt

        delay = 1
        while True:
            try:
                async with aiomqtt.Client(host, port, username=user or None, password=password or None) as client:
                    await client.subscribe("frigate/events")
                    log.info("MQTT connected, listening to frigate/events")
                    delay = 1
                    async for msg in client.messages:
                        await self.handle_mqtt(msg.payload, publish)
            except asyncio.CancelledError:
                raise
            except Exception as err:  # noqa: BLE001
                log.warning("MQTT error: %s, retry in %d s", err, delay)
                await asyncio.sleep(delay)
                delay = min(delay * 2, 60)
