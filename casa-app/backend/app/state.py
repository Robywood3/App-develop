"""Live state of the logical entities and fan-out to the connected apps (WS /api/live)."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from app.entities import Entity, EntityMap

log = logging.getLogger("casa.state")

HIDDEN_ATTRIBUTES = ("token", "picture", "access")


def _clean_attributes(attrs: dict) -> dict:
    return {k: v for k, v in (attrs or {}).items() if not any(h in k for h in HIDDEN_ATTRIBUTES)}


def value_of(entity: Entity, ha_state: dict | None):
    """The value the app shows: the HA state, or the configured attribute."""
    if not ha_state:
        return None
    if entity.attribute:
        return ha_state.get("attributes", {}).get(entity.attribute)
    return ha_state.get("state")


class StateHub:
    def __init__(self, entities: EntityMap):
        self.entities = entities
        self.items: dict[str, dict] = {}
        self.ha_connected = False
        self.last_update: str | None = None
        self._clients: set[asyncio.Queue] = set()

    def item(self, entity: Entity, ha_state: dict | None) -> dict:
        return {
            **entity.public(),
            "valore": value_of(entity, ha_state),
            "stato": ha_state.get("state") if ha_state else None,
            "attributi": _clean_attributes(ha_state.get("attributes", {})) if ha_state else {},
            "aggiornato": ha_state.get("last_updated") if ha_state else None,
        }

    def snapshot(self) -> dict:
        entita = {}
        for name, e in self.entities.by_name.items():
            entita[name] = self.items.get(name) or self.item(e, None)
        return {"connesso_ha": self.ha_connected, "aggiornato": self.last_update, "entita": entita}

    async def on_state(self, entity_id: str, ha_state: dict | None) -> None:
        for e in self.entities.for_entity_id(entity_id):
            item = self.item(e, ha_state)
            self.items[e.name] = item
            self.last_update = datetime.now(timezone.utc).isoformat()
            self.publish({"tipo": "stato", "nome": e.name, "dati": item})

    async def on_connection(self, up: bool) -> None:
        self.ha_connected = up
        self.publish({"tipo": "connessione", "connesso_ha": up})

    # ------------------------------------------------------------ live clients

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=1000)
        self._clients.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._clients.discard(q)

    def publish(self, message: dict) -> None:
        for q in list(self._clients):
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:
                # slow client: drop it, the app reconnects and gets a fresh snapshot
                self._clients.discard(q)
