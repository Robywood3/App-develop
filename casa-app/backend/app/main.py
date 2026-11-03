"""Casa App backend: the only gateway between the apps and Home Assistant / Frigate."""
from __future__ import annotations

import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager
from dataclasses import dataclass

from fastapi import FastAPI

from app.api import auth as auth_api
from app.api import cameras as cameras_api
from app.api import command as command_api
from app.api import history as history_api
from app.api import state as state_api
from app.auth import AuthService
from app.commands import CommandService
from app.entities import EntityMap, load_allowlist
from app.frigate_client import FrigateClient
from app.ha_client import HAClient
from app.history import HistoryWriter
from app.repository import MemoryRepository, PostgresRepository, Repository
from app.settings import Settings
from app.state import StateHub

log = logging.getLogger("casa")


@dataclass
class Services:
    settings: Settings
    entities: EntityMap
    allowlist: set[str]
    repo: Repository
    ha: HAClient
    hub: StateHub
    history: HistoryWriter
    commands: CommandService
    auth: AuthService
    frigate: FrigateClient


def build_services(settings: Settings, repo: Repository | None = None) -> Services:
    entities = EntityMap.load(settings.config_dir / "entities.yaml")
    allowlist = load_allowlist(settings.config_dir / "services_allowlist.yaml")
    if repo is None:
        if settings.database_url:
            repo = PostgresRepository(settings.database_url)
        else:
            log.warning("DATABASE_URL not set: history, users and command log are kept in memory only")
            repo = MemoryRepository()
    ha = HAClient(settings.ha_url, settings.ha_token)
    hub = StateHub(entities)
    history = HistoryWriter(entities, repo, settings.history_min_interval)
    ha.on_state(hub.on_state)
    ha.on_state(history.on_state)
    ha.on_connection(hub.on_connection)
    return Services(
        settings=settings, entities=entities, allowlist=allowlist, repo=repo, ha=ha, hub=hub, history=history,
        commands=CommandService(entities, allowlist, ha, repo),
        auth=AuthService(repo, settings.session_days_home, settings.session_days_mobile),
        frigate=FrigateClient(settings.frigate_url, settings.go2rtc_url, repo),
    )


async def bootstrap_admin(svc: Services) -> None:
    """Create the first admin from BOOTSTRAP_ADMIN/BOOTSTRAP_PASSWORD if that user does not exist yet."""
    s = svc.settings
    if s.bootstrap_user and s.bootstrap_password and not await svc.repo.get_user(s.bootstrap_user):
        await svc.auth.create_user(s.bootstrap_user, s.bootstrap_password, "admin")
        log.info("created admin user %s", s.bootstrap_user)


def create_app(settings: Settings | None = None, repo: Repository | None = None) -> FastAPI:
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        svc = build_services(settings, repo)
        app.state.services = svc
        await svc.repo.start()
        await bootstrap_admin(svc)
        if settings.ha_url:
            svc.ha.start()
        else:
            log.error("HA_URL not set: no connection to Home Assistant")
        mqtt_task = None
        if settings.mqtt_host and settings.frigate_url:
            mqtt_task = asyncio.create_task(svc.frigate.mqtt_loop(
                settings.mqtt_host, settings.mqtt_port, settings.mqtt_user, settings.mqtt_password, svc.hub.publish))
        try:
            yield
        finally:
            if mqtt_task:
                mqtt_task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await mqtt_task
            await svc.ha.stop()
            await svc.history.close()
            await svc.frigate.http.aclose()
            await svc.repo.close()

    app = FastAPI(title="Casa App", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    for r in (auth_api.router, state_api.router, command_api.router, history_api.router, cameras_api.router):
        app.include_router(r, prefix="/api")

    @app.get("/api/health")
    async def health():
        svc = app.state.services
        return {"ha": svc.ha.connected.is_set(), "db": await svc.repo.healthy()}

    return app


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
app = create_app()
