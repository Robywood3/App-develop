import json
from datetime import datetime, timedelta, timezone

import httpx
import pytest

from app.frigate_client import FrigateClient, FrigateError, parse_event
from app.repository import MemoryRepository

START = datetime(2026, 11, 3, 8, tzinfo=timezone.utc).timestamp()


def mqtt(label="person", **after):
    return {"type": "end", "after": {"id": "1730620800.1-abc", "camera": "ingresso", "label": label, "start_time": START, "end_time": START + 20, "has_clip": True, "top_score": 0.83, **after}}


def test_parse_event_filters_labels():
    ev = parse_event(mqtt())
    assert ev["telecamera"] == "ingresso" and ev["oggetto"] == "person" and ev["clip"]
    assert parse_event(mqtt(label="dog")) is None
    assert parse_event(mqtt(false_positive=True)) is None
    assert parse_event({"type": "new"}) is None


def frigate_transport(request: httpx.Request) -> httpx.Response:
    path = request.url.path
    if path == "/api/config":
        return httpx.Response(200, json={"cameras": {"ingresso": {}, "giardino": {}}})
    if path == "/api/ingresso/latest.jpg":
        return httpx.Response(200, content=b"\xff\xd8jpeg")
    if path == "/api/webrtc":
        assert request.url.params["src"] == "ingresso"
        assert json.loads(request.content)["type"] == "offer"
        return httpx.Response(200, json={"type": "answer", "sdp": "v=0 answer"})
    if path.endswith("/clip.mp4"):
        return httpx.Response(200, content=b"mp4data" * 10)
    return httpx.Response(404)


@pytest.fixture
def client():
    repo = MemoryRepository()
    http = httpx.AsyncClient(transport=httpx.MockTransport(frigate_transport))
    return FrigateClient("http://frigate:5000", "http://frigate:1984", repo, http=http)


async def test_cameras_snapshot_webrtc(client):
    assert await client.cameras() == ["giardino", "ingresso"]
    assert (await client.snapshot("ingresso")).startswith(b"\xff\xd8")
    assert await client.webrtc_answer("ingresso", "v=0 offer") == "v=0 answer"
    with pytest.raises(FrigateError) as err:
        await client.snapshot("cucina")
    assert err.value.status == 404
    with pytest.raises(FrigateError):
        await client.snapshot("../etc")


async def test_mqtt_events_stored_and_clip_streamed(client):
    published = []
    await client.handle_mqtt(json.dumps(mqtt()).encode(), published.append)
    await client.handle_mqtt(b"not json")
    now = datetime.fromtimestamp(START, tz=timezone.utc)
    events = await client.events("ingresso", None, now - timedelta(hours=1), now + timedelta(hours=1))
    assert len(events) == 1 and events[0]["id"] == "1730620800.1-abc"
    assert published[0]["tipo"] == "evento_video"
    body = await client.clip("1730620800.1-abc")
    data = b"".join([c async for c in body])
    assert data.startswith(b"mp4data")
    with pytest.raises(FrigateError):
        await client.clip("sconosciuto")


async def test_disabled_without_url():
    c = FrigateClient("", "", MemoryRepository())
    with pytest.raises(FrigateError) as err:
        await c.cameras()
    assert err.value.status == 503
