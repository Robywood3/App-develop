"""Storage layer: PostgreSQL + TimescaleDB in production, in-memory for tests and development."""
from __future__ import annotations

import json
import logging
from bisect import bisect_left
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

log = logging.getLogger("casa.repo")

MIGRATIONS = Path(__file__).resolve().parents[1] / "migrations"

# Table chosen by the requested range (docs/architettura.md, section 6, "Lettura").
RESOLUTIONS = [
    (timedelta(days=2), "grezzi", None),
    (timedelta(days=30), "5min", timedelta(minutes=5)),
    (timedelta(days=366), "1h", timedelta(hours=1)),
    (None, "1g", timedelta(days=1)),
]
TABLES = {"5min": "misure_5min", "1h": "misure_1h", "1g": "misure_1g"}


def choose_resolution(start: datetime, end: datetime) -> tuple[str, timedelta | None]:
    span = end - start
    for limit, name, bucket in RESOLUTIONS:
        if limit is None or span <= limit:
            return name, bucket
    raise AssertionError("unreachable")


@dataclass
class Measure:
    ts: datetime
    entita: str
    valore_num: float | None
    valore_testo: str | None
    attributi: dict | None = None


class Repository:
    """Interface. Methods return plain dicts so the API does not depend on the backend."""

    async def start(self) -> None: ...
    async def close(self) -> None: ...
    async def healthy(self) -> bool: return True
    async def insert_measures(self, rows: list[Measure]) -> None: raise NotImplementedError
    async def history(self, names: list[str], start: datetime, end: datetime) -> tuple[str, dict[str, list[list]]]: raise NotImplementedError
    async def log_command(self, utente: str, servizio: str | None, target: str, valore: Any, esito: str) -> int: raise NotImplementedError
    async def list_commands(self, limit: int = 100) -> list[dict]: raise NotImplementedError
    async def get_user(self, nome: str) -> dict | None: raise NotImplementedError
    async def get_user_by_id(self, user_id: int) -> dict | None: raise NotImplementedError
    async def create_user(self, nome: str, hash_: str, ruolo: str) -> int: raise NotImplementedError
    async def set_password(self, nome: str, hash_: str) -> None: raise NotImplementedError
    async def create_session(self, token_hash: str, utente_id: int, dispositivo: str, scade: datetime) -> None: raise NotImplementedError
    async def get_session(self, token_hash: str) -> dict | None: raise NotImplementedError
    async def delete_session(self, token_hash: str) -> None: raise NotImplementedError
    async def delete_user_sessions(self, utente_id: int) -> None: raise NotImplementedError
    async def upsert_video_event(self, ev: dict) -> None: raise NotImplementedError
    async def list_video_events(self, telecamera: str | None, oggetto: str | None, start: datetime, end: datetime, limit: int = 200) -> list[dict]: raise NotImplementedError
    async def get_video_event(self, id_frigate: str) -> dict | None: raise NotImplementedError


# ---------------------------------------------------------------------------------- memory


class MemoryRepository(Repository):
    """Keeps everything in RAM. For tests and for development without a database."""

    def __init__(self):
        self.measures: dict[str, list[Measure]] = {}
        self.commands: list[dict] = []
        self.users: dict[str, dict] = {}
        self.sessions: dict[str, dict] = {}
        self.video: dict[tuple, dict] = {}

    async def insert_measures(self, rows: list[Measure]) -> None:
        for r in rows:
            series = self.measures.setdefault(r.entita, [])
            i = bisect_left([m.ts for m in series], r.ts)
            series.insert(i, r)

    async def history(self, names, start, end):
        resolution, bucket = choose_resolution(start, end)
        out: dict[str, list[list]] = {}
        for name in names:
            rows = [m for m in self.measures.get(name, []) if start <= m.ts <= end]
            if bucket is None:
                out[name] = [[m.ts.isoformat(), m.valore_num, None, None] for m in rows if m.valore_num is not None]
                continue
            groups: dict[datetime, list[float]] = {}
            epoch = datetime(2000, 1, 1, tzinfo=timezone.utc)
            for m in rows:
                if m.valore_num is None:
                    continue
                key = epoch + ((m.ts - epoch) // bucket) * bucket
                groups.setdefault(key, []).append(m.valore_num)
            out[name] = [[k.isoformat(), sum(v) / len(v), min(v), max(v)] for k, v in sorted(groups.items())]
        return resolution, out

    async def log_command(self, utente, servizio, target, valore, esito):
        cid = len(self.commands) + 1
        self.commands.append({"id": cid, "ts": datetime.now(timezone.utc).isoformat(), "utente": utente, "servizio": servizio, "target": target, "valore": valore, "esito": esito})
        return cid

    async def list_commands(self, limit=100):
        return list(reversed(self.commands))[:limit]

    async def get_user(self, nome):
        u = self.users.get(nome)
        return dict(u) if u else None

    async def get_user_by_id(self, user_id):
        return next((dict(u) for u in self.users.values() if u["id"] == user_id), None)

    async def create_user(self, nome, hash_, ruolo):
        if nome in self.users:
            raise ValueError(f"utente {nome} esiste già")
        uid = len(self.users) + 1
        self.users[nome] = {"id": uid, "nome": nome, "hash": hash_, "ruolo": ruolo}
        return uid

    async def set_password(self, nome, hash_):
        self.users[nome]["hash"] = hash_

    async def create_session(self, token_hash, utente_id, dispositivo, scade):
        self.sessions[token_hash] = {"utente_id": utente_id, "dispositivo": dispositivo, "scade": scade}

    async def get_session(self, token_hash):
        s = self.sessions.get(token_hash)
        return dict(s) if s else None

    async def delete_session(self, token_hash):
        self.sessions.pop(token_hash, None)

    async def delete_user_sessions(self, utente_id):
        for k in [k for k, s in self.sessions.items() if s["utente_id"] == utente_id]:
            del self.sessions[k]

    async def upsert_video_event(self, ev):
        self.video[(ev["id_frigate"], ev["ts"])] = dict(ev)

    async def list_video_events(self, telecamera, oggetto, start, end, limit=200):
        rows = [e for e in self.video.values() if start <= e["ts"] <= end
                and (not telecamera or e["telecamera"] == telecamera) and (not oggetto or e["oggetto"] == oggetto)]
        rows.sort(key=lambda e: e["ts"], reverse=True)
        return [_event_out(e) for e in rows[:limit]]

    async def get_video_event(self, id_frigate):
        return next((_event_out(e) for e in self.video.values() if e["id_frigate"] == id_frigate), None)


def _event_out(e: dict) -> dict:
    return {
        "id": e["id_frigate"],
        "ts": e["ts"].isoformat() if isinstance(e["ts"], datetime) else e["ts"],
        "fine": e["fine"].isoformat() if isinstance(e.get("fine"), datetime) else e.get("fine"),
        "telecamera": e["telecamera"],
        "oggetto": e["oggetto"],
        "clip": e["clip"],
        "punteggio": e.get("punteggio"),
    }


# ---------------------------------------------------------------------------------- postgres


class PostgresRepository(Repository):
    def __init__(self, dsn: str):
        self.dsn = dsn
        self.pool = None

    async def start(self) -> None:
        import asyncpg

        self.pool = await asyncpg.create_pool(self.dsn, min_size=1, max_size=8, init=self._init_conn)
        await self.migrate()

    @staticmethod
    async def _init_conn(conn) -> None:
        await conn.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")

    async def close(self) -> None:
        if self.pool:
            await self.pool.close()

    async def healthy(self) -> bool:
        try:
            async with self.pool.acquire() as c:
                await c.fetchval("SELECT 1")
            return True
        except Exception:
            return False

    async def migrate(self) -> None:
        """Apply migrations/*.sql in order, once each."""
        async with self.pool.acquire() as c:
            await c.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied timestamptz NOT NULL DEFAULT now())")
            done = {r["version"] for r in await c.fetch("SELECT version FROM schema_migrations")}
            for f in sorted(MIGRATIONS.glob("*.sql")):
                if f.stem in done:
                    continue
                log.info("applying migration %s", f.name)
                # continuous aggregates cannot be created inside a transaction: run statement by statement
                for stmt in _split_sql(f.read_text(encoding="utf-8")):
                    await c.execute(stmt)
                await c.execute("INSERT INTO schema_migrations (version) VALUES ($1)", f.stem)

    async def insert_measures(self, rows):
        if not rows:
            return
        async with self.pool.acquire() as c:
            await c.executemany(
                "INSERT INTO misure (ts, entita, valore_num, valore_testo, attributi) VALUES ($1, $2, $3, $4, $5)",
                [(r.ts, r.entita, r.valore_num, r.valore_testo, r.attributi) for r in rows],
            )

    async def history(self, names, start, end):
        resolution, _ = choose_resolution(start, end)
        async with self.pool.acquire() as c:
            if resolution == "grezzi":
                rows = await c.fetch(
                    "SELECT entita, ts, valore_num FROM misure WHERE entita = ANY($1) AND ts BETWEEN $2 AND $3 AND valore_num IS NOT NULL ORDER BY ts",
                    names, start, end)
                out = {n: [] for n in names}
                for r in rows:
                    out[r["entita"]].append([r["ts"].isoformat(), r["valore_num"], None, None])
                return resolution, out
            table = TABLES[resolution]
            rows = await c.fetch(
                f"SELECT entita, bucket, media, minimo, massimo FROM {table} WHERE entita = ANY($1) AND bucket BETWEEN $2 AND $3 ORDER BY bucket",
                names, start, end)
            out = {n: [] for n in names}
            for r in rows:
                out[r["entita"]].append([r["bucket"].isoformat(), r["media"], r["minimo"], r["massimo"]])
            return resolution, out

    async def log_command(self, utente, servizio, target, valore, esito):
        async with self.pool.acquire() as c:
            return await c.fetchval(
                "INSERT INTO comandi (utente, servizio, target, valore, esito) VALUES ($1, $2, $3, $4, $5) RETURNING id",
                utente, servizio, target, valore, esito)

    async def list_commands(self, limit=100):
        async with self.pool.acquire() as c:
            rows = await c.fetch("SELECT id, ts, utente, servizio, target, valore, esito FROM comandi ORDER BY ts DESC LIMIT $1", limit)
        return [{**dict(r), "ts": r["ts"].isoformat()} for r in rows]

    async def get_user(self, nome):
        async with self.pool.acquire() as c:
            r = await c.fetchrow("SELECT id, nome, hash, ruolo FROM utenti WHERE nome = $1", nome)
        return dict(r) if r else None

    async def get_user_by_id(self, user_id):
        async with self.pool.acquire() as c:
            r = await c.fetchrow("SELECT id, nome, hash, ruolo FROM utenti WHERE id = $1", user_id)
        return dict(r) if r else None

    async def create_user(self, nome, hash_, ruolo):
        async with self.pool.acquire() as c:
            return await c.fetchval("INSERT INTO utenti (nome, hash, ruolo) VALUES ($1, $2, $3) RETURNING id", nome, hash_, ruolo)

    async def set_password(self, nome, hash_):
        async with self.pool.acquire() as c:
            await c.execute("UPDATE utenti SET hash = $2 WHERE nome = $1", nome, hash_)

    async def create_session(self, token_hash, utente_id, dispositivo, scade):
        async with self.pool.acquire() as c:
            await c.execute("INSERT INTO sessioni (token_hash, utente_id, dispositivo, scade) VALUES ($1, $2, $3, $4)", token_hash, utente_id, dispositivo, scade)

    async def get_session(self, token_hash):
        async with self.pool.acquire() as c:
            r = await c.fetchrow("UPDATE sessioni SET ultimo_uso = now() WHERE token_hash = $1 RETURNING utente_id, dispositivo, scade", token_hash)
        return dict(r) if r else None

    async def delete_session(self, token_hash):
        async with self.pool.acquire() as c:
            await c.execute("DELETE FROM sessioni WHERE token_hash = $1", token_hash)

    async def delete_user_sessions(self, utente_id):
        async with self.pool.acquire() as c:
            await c.execute("DELETE FROM sessioni WHERE utente_id = $1", utente_id)

    async def upsert_video_event(self, ev):
        async with self.pool.acquire() as c:
            await c.execute(
                """INSERT INTO eventi_video (ts, fine, telecamera, oggetto, id_frigate, clip, punteggio)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)
                   ON CONFLICT (id_frigate, ts) DO UPDATE SET fine = EXCLUDED.fine, clip = EXCLUDED.clip, punteggio = EXCLUDED.punteggio""",
                ev["ts"], ev.get("fine"), ev["telecamera"], ev["oggetto"], ev["id_frigate"], ev["clip"], ev.get("punteggio"))

    async def list_video_events(self, telecamera, oggetto, start, end, limit=200):
        async with self.pool.acquire() as c:
            rows = await c.fetch(
                """SELECT * FROM eventi_video WHERE ts BETWEEN $1 AND $2
                   AND ($3::text IS NULL OR telecamera = $3) AND ($4::text IS NULL OR oggetto = $4)
                   ORDER BY ts DESC LIMIT $5""", start, end, telecamera, oggetto, limit)
        return [_event_out(dict(r)) for r in rows]

    async def get_video_event(self, id_frigate):
        async with self.pool.acquire() as c:
            r = await c.fetchrow("SELECT * FROM eventi_video WHERE id_frigate = $1 ORDER BY ts DESC LIMIT 1", id_frigate)
        return _event_out(dict(r)) if r else None


def _split_sql(text: str) -> list[str]:
    lines = [l for l in text.splitlines() if not l.strip().startswith("--")]
    return [s.strip() for s in "\n".join(lines).split(";") if s.strip()]
