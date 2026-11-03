import asyncio
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.ha_client import HAClient
from app.repository import MemoryRepository
from scripts.import_csv import FileSpec, import_file, load_mapping
from scripts.import_ha_statistics import import_statistics


async def test_import_csv_with_errors(tmp_path):
    csv_file = tmp_path / "log_granulare.csv"
    csv_file.write_text(
        "timestamp;t_zona;potenza\n"
        "2026-01-10 08:00:00;20,5;1.200\n"
        "data sbagliata;21;100\n"
        "2026-01-10 08:00:10;;nan\n"
        "2026-01-10 08:00:20;21,0;900\n", encoding="utf-8")
    spec = FileSpec(path=csv_file, time_column="timestamp", time_format="%Y-%m-%d %H:%M:%S", tz=ZoneInfo("Europe/Rome"),
                    columns={"t_zona": "zona_giorno.temp", "potenza": "pdc.potenza"}, delimiter=";", decimal_comma=True)
    repo = MemoryRepository()
    rep = await import_file(repo, spec)
    assert (rep.rows, rep.values, rep.skipped_rows) == (3, 4, 1)
    temps = repo.measures["zona_giorno.temp"]
    assert [m.valore_num for m in temps] == [20.5, 21.0]
    assert temps[0].ts == datetime(2026, 1, 10, 7, 0, tzinfo=timezone.utc)  # Europe/Rome -> UTC
    assert repo.measures["pdc.potenza"][0].valore_num == 1200.0


async def test_import_csv_missing_columns_and_mapping(tmp_path):
    (tmp_path / "a.csv").write_text("ts,x\n1,2\n")
    (tmp_path / "map.yaml").write_text("files:\n  - path: a.csv\n    timestamp: {column: ts, format: epoch}\n    columns: {y: foo}\n")
    specs = load_mapping(tmp_path / "map.yaml")
    rep = await import_file(MemoryRepository(), specs[0], dry_run=True)
    assert rep.errors and "mancanti" in rep.errors[0]


async def test_import_ha_statistics(fake_ha, entity_map):
    ha = HAClient(fake_ha.url, "test-token")
    ha.start()
    await asyncio.wait_for(ha.connected.wait(), 3)
    repo = MemoryRepository()
    end = datetime(2026, 1, 3, tzinfo=timezone.utc)
    counts = await import_statistics(ha, repo, entity_map, end - timedelta(days=2), end)
    assert counts["zona_giorno.temp"] == 48
    assert repo.measures["zona_giorno.temp"][0].attributi == {"origine": "ha_statistics"}
    await ha.stop()
