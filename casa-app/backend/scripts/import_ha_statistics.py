"""Import HA long-term statistics (hourly means) for every `log: true` entity into `misure`.

    python -m scripts.import_ha_statistics --da 2023-01-01 --a 2026-11-01

HA keeps statistics only for sensors with a state_class. The hourly mean is stored as one
value per hour: the 1h and 1d aggregates are exact, min/max inside the hour are not.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

from app.entities import EntityMap
from app.ha_client import HAClient
from app.repository import Measure, PostgresRepository, Repository
from app.settings import Settings

CHUNK = timedelta(days=30)


async def import_statistics(ha: HAClient, repo: Repository, entities: EntityMap, start: datetime, end: datetime) -> dict[str, int]:
    logged = [e for e in entities.configured() if e.log]
    counts = {e.name: 0 for e in logged}
    t = start
    while t < end:
        t2 = min(t + CHUNK, end)
        result = await ha.statistics([e.entity_id for e in logged], t.isoformat(), t2.isoformat(), period="hour")
        rows: list[Measure] = []
        for e in logged:
            for s in result.get(e.entity_id, []):
                value = s.get("mean", s.get("state"))
                if value is None:
                    continue
                start_ms = s["start"]
                ts = datetime.fromtimestamp(start_ms / 1000 if isinstance(start_ms, (int, float)) else datetime.fromisoformat(start_ms).timestamp(), tz=timezone.utc)
                rows.append(Measure(ts=ts, entita=e.name, valore_num=float(value), valore_testo=None, attributi={"origine": "ha_statistics"}))
                counts[e.name] += 1
        await repo.insert_measures(rows)
        t = t2
    return counts


async def main() -> int:
    p = argparse.ArgumentParser(description="Importa le statistiche a lungo termine di HA")
    p.add_argument("--da", required=True, help="data di inizio, es. 2023-01-01")
    p.add_argument("--a", default=None, help="data di fine (predefinito: inizio dei dati di Casa App)")
    args = p.parse_args()
    settings = Settings.from_env()
    start = datetime.fromisoformat(args.da).replace(tzinfo=timezone.utc)
    end = datetime.fromisoformat(args.a).replace(tzinfo=timezone.utc) if args.a else datetime.now(timezone.utc)
    repo = PostgresRepository(os.environ["DATABASE_URL"])
    await repo.start()
    ha = HAClient(settings.ha_url, settings.ha_token)
    ha.start()
    try:
        await asyncio.wait_for(ha.connected.wait(), 30)
        counts = await import_statistics(ha, repo, EntityMap.load(settings.config_dir / "entities.yaml"), start, end)
        for name, n in counts.items():
            print(f"{name}: {n} valori orari")
        async with repo.pool.acquire() as c:
            for view in ("misure_5min", "misure_1h", "misure_1g"):
                await c.execute(f"CALL refresh_continuous_aggregate('{view}', NULL, NULL)")
    finally:
        await ha.stop()
        await repo.close()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
