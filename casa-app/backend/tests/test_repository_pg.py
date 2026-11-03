"""Integration test against a real PostgreSQL + TimescaleDB.

Runs only when TEST_DATABASE_URL is set, e.g.:
  docker run -d --name tsdb -e POSTGRES_PASSWORD=test -p 55432:5432 timescale/timescaledb:2.17.2-pg16
  TEST_DATABASE_URL=postgresql://postgres:test@localhost:55432/postgres pytest tests/test_repository_pg.py
"""
import os
import random
import time
from datetime import datetime, timedelta, timezone

import pytest

from app.repository import Measure, PostgresRepository

DSN = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not DSN, reason="TEST_DATABASE_URL not set")


@pytest.fixture
async def repo():
    import asyncpg

    conn = await asyncpg.connect(DSN)
    await conn.execute("DROP DATABASE IF EXISTS casa_test WITH (FORCE)")
    await conn.execute("CREATE DATABASE casa_test")
    await conn.close()
    r = PostgresRepository(DSN.rsplit("/", 1)[0] + "/casa_test")
    await r.start()
    yield r
    await r.close()


async def test_migrations_users_commands_events(repo):
    await repo.migrate()  # second run is a no-op
    uid = await repo.create_user("roberto", "hash", "admin")
    assert (await repo.get_user("roberto"))["id"] == uid
    exp = datetime.now(timezone.utc) + timedelta(days=30)
    await repo.create_session("th", uid, "mobile", exp)
    assert (await repo.get_session("th"))["utente_id"] == uid
    await repo.log_command("roberto", "switch.turn_on", "vmc.pt", {"x": 1}, "ok")
    assert (await repo.list_commands())[0]["valore"] == {"x": 1}
    ts = datetime.now(timezone.utc).replace(microsecond=0)
    ev = {"id_frigate": "e1", "ts": ts, "fine": None, "telecamera": "ingresso", "oggetto": "person", "clip": False, "punteggio": 0.8}
    await repo.upsert_video_event(ev)
    await repo.upsert_video_event({**ev, "clip": True})
    events = await repo.list_video_events("ingresso", None, ts - timedelta(hours=1), ts + timedelta(hours=1))
    assert len(events) == 1 and events[0]["clip"] is True


async def test_one_year_chart_under_one_second(repo):
    """RF-03: a 1-year chart in < 1 s (10-minute data for one year, read from misure_1h)."""
    now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    rows = [Measure(now - timedelta(minutes=10 * i), "zona_giorno.temp", 20 + random.random(), None) for i in range(6 * 24 * 365)]
    for i in range(0, len(rows), 5000):
        await repo.insert_measures(rows[i:i + 5000])
    async with repo.pool.acquire() as c:
        for view in ("misure_5min", "misure_1h", "misure_1g"):
            await c.execute(f"CALL refresh_continuous_aggregate('{view}', NULL, NULL)")
    t0 = time.perf_counter()
    res, data = await repo.history(["zona_giorno.temp"], now - timedelta(days=365), now)
    elapsed = time.perf_counter() - t0
    assert res == "1h"
    assert 8700 <= len(data["zona_giorno.temp"]) <= 8800
    assert elapsed < 1.0, f"{elapsed:.2f} s"
    res, raw = await repo.history(["zona_giorno.temp"], now - timedelta(hours=2), now)
    assert res == "grezzi" and len(raw["zona_giorno.temp"]) == 13
