"""Import the existing CSV logs (log_granulare, log_decadimento, log_timeline, log_shadow_ml)
into the `misure` table (docs/architettura.md, section 6, "Importazione iniziale").

The CSV layouts are described in a mapping file (see import_mapping.example.yaml):
which column holds the time and which columns become which logical names.

    python -m scripts.import_csv mapping.yaml --dry-run
    python -m scripts.import_csv mapping.yaml
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import yaml

from app.history import to_measure
from app.repository import Measure, PostgresRepository, Repository

BATCH = 5000


@dataclass
class FileSpec:
    path: Path
    time_column: str
    time_format: str | None
    tz: ZoneInfo
    columns: dict[str, str]
    delimiter: str = ","
    decimal_comma: bool = False


@dataclass
class Report:
    rows: int = 0
    values: int = 0
    skipped_rows: int = 0
    errors: list[str] = field(default_factory=list)


def load_mapping(path: Path) -> list[FileSpec]:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    specs = []
    for f in raw.get("files", []):
        ts = f["timestamp"]
        specs.append(FileSpec(
            path=(path.parent / f["path"]).resolve(),
            time_column=ts["column"],
            time_format=ts.get("format"),
            tz=ZoneInfo(ts.get("timezone", "Europe/Rome")),
            columns=f["columns"],
            delimiter=f.get("delimiter", ","),
            decimal_comma=bool(f.get("decimal_comma", False)),
        ))
    return specs


def parse_time(value: str, spec: FileSpec) -> datetime:
    value = value.strip()
    if spec.time_format == "epoch":
        return datetime.fromtimestamp(float(value), tz=timezone.utc)
    dt = datetime.strptime(value, spec.time_format) if spec.time_format else datetime.fromisoformat(value)
    return dt if dt.tzinfo else dt.replace(tzinfo=spec.tz)


async def import_file(repo: Repository, spec: FileSpec, dry_run: bool = False) -> Report:
    rep = Report()
    batch: list[Measure] = []
    with spec.path.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh, delimiter=spec.delimiter)
        missing = [c for c in [spec.time_column, *spec.columns] if c not in (reader.fieldnames or [])]
        if missing:
            rep.errors.append(f"{spec.path.name}: colonne mancanti {missing}")
            return rep
        for line, row in enumerate(reader, start=2):
            try:
                ts = parse_time(row[spec.time_column], spec)
            except (ValueError, TypeError) as err:
                rep.skipped_rows += 1
                if len(rep.errors) < 20:
                    rep.errors.append(f"{spec.path.name}:{line}: data non valida ({err})")
                continue
            rep.rows += 1
            for col, name in spec.columns.items():
                v = (row.get(col) or "").strip()
                if v == "" or v.lower() in {"nan", "none", "null", "unavailable", "unknown"}:
                    continue
                if spec.decimal_comma:
                    v = v.replace(".", "").replace(",", ".")  # Italian format: 1.200,5
                batch.append(to_measure(name, v, None, ts))
                rep.values += 1
            if len(batch) >= BATCH:
                if not dry_run:
                    await repo.insert_measures(batch)
                batch = []
    if batch and not dry_run:
        await repo.insert_measures(batch)
    return rep


async def main() -> int:
    p = argparse.ArgumentParser(description="Importa i log CSV in TimescaleDB")
    p.add_argument("mapping", type=Path)
    p.add_argument("--dry-run", action="store_true", help="controlla i file senza scrivere")
    args = p.parse_args()
    specs = load_mapping(args.mapping)
    repo: Repository | None = None
    if not args.dry_run:
        repo = PostgresRepository(os.environ["DATABASE_URL"])
        await repo.start()
    ok = True
    try:
        for spec in specs:
            rep = await import_file(repo, spec, args.dry_run)  # type: ignore[arg-type]
            print(f"{spec.path.name}: {rep.rows} righe, {rep.values} valori, {rep.skipped_rows} righe scartate")
            for e in rep.errors:
                print(f"  ! {e}")
            ok = ok and not rep.errors
        if repo and isinstance(repo, PostgresRepository):
            async with repo.pool.acquire() as c:
                for view in ("misure_5min", "misure_1h", "misure_1g"):
                    await c.execute(f"CALL refresh_continuous_aggregate('{view}', NULL, NULL)")
            print("Aggregazioni aggiornate")
    finally:
        if repo:
            await repo.close()
    return 0 if ok else 2


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
