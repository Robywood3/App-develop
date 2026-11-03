"""End-to-end: real HTTP server + WebSocket, simulated HA."""
import asyncio
import json
import socket

import httpx
import pytest
import uvicorn
import websockets
from websockets.asyncio.client import connect as ws_connect

from app.auth import AuthService
from app.main import create_app
from app.repository import MemoryRepository
from app.settings import Settings
from tests.conftest import CONFIG, wait_for


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture
async def server(fake_ha):
    repo = MemoryRepository()
    await AuthService(repo).create_user("roberto", "segreta123", "admin")
    await AuthService(repo).create_user("ospite", "segreta123", "lettura")
    settings = Settings(ha_url=fake_ha.url, ha_token="test-token", config_dir=CONFIG, cookie_secure=False, history_min_interval=0.1)
    app = create_app(settings, repo=repo)
    port = free_port()
    srv = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning", lifespan="on"))
    task = asyncio.create_task(srv.serve())
    await wait_for(lambda: srv.started, 5)
    await asyncio.wait_for(app.state.services.ha.connected.wait(), 3)
    yield f"127.0.0.1:{port}", app, repo
    srv.should_exit = True
    await task


async def login(base, nome="roberto"):
    c = httpx.AsyncClient(base_url=f"http://{base}")
    r = await c.post("/api/login", json={"nome": nome, "password": "segreta123", "dispositivo": "casa"})
    assert r.status_code == 200, r.text
    return c


async def test_bootstrap_admin(fake_ha):
    repo = MemoryRepository()
    settings = Settings(ha_url="", config_dir=CONFIG, bootstrap_user="admin", bootstrap_password="primapass1")
    app = create_app(settings, repo=repo)
    async with app.router.lifespan_context(app):
        assert (await repo.get_user("admin"))["ruolo"] == "admin"
    async with app.router.lifespan_context(app):  # second start: no duplicate, no error
        assert len(repo.users) == 1


async def test_requires_login(server):
    base, _, _ = server
    async with httpx.AsyncClient(base_url=f"http://{base}") as c:
        assert (await c.get("/api/state")).status_code == 401
        assert (await c.post("/api/login", json={"nome": "roberto", "password": "x"})).status_code == 401
        assert (await c.get("/api/health")).json()["ha"] is True


async def test_state_command_live_and_log(server, fake_ha):
    base, app, repo = server
    c = await login(base)
    state = (await c.get("/api/state")).json()
    assert state["connesso_ha"] is True
    item = state["entita"]["pdc.target_pt"]
    assert item["comandabile"] and item["valore"] == "20.5"
    assert "entity_id" not in json.dumps(state)  # the frontend sees only logical names

    cookie = f"casa_session={c.cookies['casa_session']}"
    async with ws_connect(f"ws://{base}/api/live", additional_headers={"Cookie": cookie}) as ws:
        first = json.loads(await ws.recv())
        assert first["tipo"] == "snapshot"
        r = await c.post("/api/command", json={"azione": "set", "target": "pdc.target_pt", "valore": 22})
        assert r.status_code == 200 and r.json()["esito"] == "ok"
        while True:  # RF-01/RF-02: the new state comes back on the live channel
            msg = json.loads(await asyncio.wait_for(ws.recv(), 2))
            if msg["tipo"] == "stato" and msg["nome"] == "pdc.target_pt":
                assert msg["dati"]["valore"] == "22.0"
                break

    r = await c.post("/api/command", json={"azione": "set", "target": "pdc.potenza", "valore": 1})
    assert r.status_code == 403
    log = (await c.get("/api/commands")).json()["comandi"]
    assert log[0]["esito"].startswith("rifiutato") and log[1]["esito"] == "ok" and log[1]["utente"] == "roberto"

    # history written by the live stream
    await fake_ha.set_state("sensor.zona_giorno_temperatura", "21.7")
    await asyncio.sleep(0.8)
    h = (await c.get("/api/history", params={"entita": "zona_giorno.temp"})).json()
    assert h["risoluzione"] == "grezzi"
    assert any(p[1] == 21.7 for p in h["serie"]["zona_giorno.temp"])
    assert (await c.get("/api/history", params={"entita": "boh"})).status_code == 404
    await c.aclose()


async def test_live_rejects_without_session_and_read_only_user(server):
    base, _, _ = server
    with pytest.raises(websockets.exceptions.InvalidStatus):
        async with ws_connect(f"ws://{base}/api/live") as ws:
            await ws.recv()
    c = await login(base, "ospite")
    r = await c.post("/api/command", json={"azione": "turn_on", "target": "vmc.pt"})
    assert r.status_code == 403
    await c.post("/api/logout")
    assert (await c.get("/api/me")).status_code == 401
    await c.aclose()


async def test_ha_disconnect_is_reported(server, fake_ha):
    base, app, _ = server
    c = await login(base)
    await fake_ha.stop()
    await wait_for(lambda: not app.state.services.ha.connected.is_set())
    assert (await c.get("/api/state")).json()["connesso_ha"] is False
    r = await c.post("/api/command", json={"azione": "turn_on", "target": "vmc.pt"})
    assert r.status_code == 503
    await c.aclose()
