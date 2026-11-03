import asyncio
from datetime import datetime, timedelta, timezone

from app.history import HistoryWriter, to_measure
from app.repository import Measure, MemoryRepository, choose_resolution

NOW = datetime(2026, 11, 3, 12, tzinfo=timezone.utc)


def test_resolution_by_range():
    assert choose_resolution(NOW - timedelta(days=1), NOW)[0] == "grezzi"
    assert choose_resolution(NOW - timedelta(days=2), NOW)[0] == "grezzi"
    assert choose_resolution(NOW - timedelta(days=7), NOW)[0] == "5min"
    assert choose_resolution(NOW - timedelta(days=365), NOW)[0] == "1h"
    assert choose_resolution(NOW - timedelta(days=800), NOW)[0] == "1g"


def test_to_measure_types():
    assert to_measure("x", "21.5", None, NOW).valore_num == 21.5
    m = to_measure("x", "on", None, NOW)
    assert (m.valore_num, m.valore_testo) == (1.0, "on")
    assert to_measure("x", "heat_pump", None, NOW).valore_num is None
    assert to_measure("x", -2, None, NOW).valore_num == -2.0


class FakeClock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


async def test_writer_throttles_and_keeps_last_value(entity_map):
    repo = MemoryRepository()
    clock = FakeClock()
    w = HistoryWriter(entity_map, repo, min_interval=0.3, clock=clock)
    st = lambda v: {"state": v, "attributes": {}}
    await w.on_state("sensor.zona_giorno_temperatura", st("20.0"))   # written at once
    clock.t += 0.1
    await w.on_state("sensor.zona_giorno_temperatura", st("20.1"))   # held
    await w.on_state("sensor.zona_giorno_temperatura", st("20.2"))   # replaces the held one
    await w.on_state("sensor.zona_giorno_temperatura", st("unavailable"))  # skipped
    await asyncio.sleep(0.4)
    await w.flush()
    values = [m.valore_num for m in repo.measures["zona_giorno.temp"]]
    assert values == [20.0, 20.2]
    # entities without log: true are not written; attribute entities use the attribute
    await w.on_state("climate.pdc_leaving_water_offset", {"state": "heat", "attributes": {"temperature": -3}})
    await w.flush()
    assert repo.measures["pdc.offset"][-1].valore_num == -3.0
    await w.close()


async def test_memory_history_aggregates():
    repo = MemoryRepository()
    rows = [Measure(NOW - timedelta(minutes=10 * i), "t", 20 + i % 3, None) for i in range(6 * 24 * 10)]
    await repo.insert_measures(rows)
    res, raw = await repo.history(["t"], NOW - timedelta(hours=1), NOW)
    assert res == "grezzi" and len(raw["t"]) == 7
    res, agg = await repo.history(["t"], NOW - timedelta(days=9), NOW)
    assert res == "5min"
    t, mean, lo, hi = agg["t"][0]
    assert lo <= mean <= hi
