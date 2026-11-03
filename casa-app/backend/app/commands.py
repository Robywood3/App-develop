"""Commands from the app to HA (RF-02, RF-07, RNF-06).

The app sends {azione, target, valore} with a logical target. The backend:
1. checks the target exists, is configured and has `command: true`;
2. derives the HA service and checks it against the allowlist;
3. checks numeric ranges;
4. calls HA and writes the outcome to the command log (also when rejected).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from app.entities import Entity, EntityMap
from app.ha_client import HAClient, HAError, HANotConnected
from app.repository import Repository

log = logging.getLogger("casa.commands")

# (action, domain) -> (service, data key for the value)
ACTIONS: dict[tuple[str, str], tuple[str, str | None]] = {
    ("turn_on", "input_boolean"): ("turn_on", None),
    ("turn_off", "input_boolean"): ("turn_off", None),
    ("turn_on", "switch"): ("turn_on", None),
    ("turn_off", "switch"): ("turn_off", None),
    ("turn_on", "script"): ("turn_on", None),
    ("run", "script"): ("turn_on", None),
    ("set", "input_number"): ("set_value", "value"),
    ("set", "climate"): ("set_temperature", "temperature"),
    ("set", "water_heater"): ("set_temperature", "temperature"),
    ("set_hvac_mode", "climate"): ("set_hvac_mode", "hvac_mode"),
}


class CommandError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


@dataclass
class CommandResult:
    id: int
    esito: str
    servizio: str


class CommandService:
    def __init__(self, entities: EntityMap, allowlist: set[str], ha: HAClient, repo: Repository):
        self.entities = entities
        self.allowlist = allowlist
        self.ha = ha
        self.repo = repo

    def resolve(self, azione: str, target: str, valore: Any) -> tuple[Entity, str, str, dict]:
        e = self.entities.get(target)
        if e is None:
            raise CommandError(404, f"Destinazione sconosciuta: {target}")
        if not e.configured:
            raise CommandError(409, f"{e.label}: entità non ancora configurata")
        if not e.command:
            raise CommandError(403, f"{e.label} non accetta comandi")
        mapping = ACTIONS.get((azione, e.domain))
        if mapping is None:
            raise CommandError(400, f"Azione {azione!r} non valida per {e.label}")
        service, key = mapping
        full = f"{e.domain}.{service}"
        if full not in self.allowlist:
            raise CommandError(403, f"Servizio {full} non autorizzato")
        data: dict = {}
        if key:
            if valore is None:
                raise CommandError(400, "Valore mancante")
            if key == "hvac_mode":
                if not isinstance(valore, str) or not valore.isidentifier():
                    raise CommandError(400, "Modalità non valida")
                data[key] = valore
            else:
                try:
                    num = float(valore)
                except (TypeError, ValueError):
                    raise CommandError(400, "Il valore deve essere un numero") from None
                if num != num or (e.min is not None and num < e.min) or (e.max is not None and num > e.max):
                    raise CommandError(400, f"Valore fuori intervallo ({e.min}–{e.max})")
                data[key] = num
        return e, e.domain, service, data

    async def execute(self, user: dict, azione: str, target: str, valore: Any = None) -> CommandResult:
        username = user["nome"]
        if user.get("ruolo") == "lettura":
            await self.repo.log_command(username, None, target, valore, "rifiutato: utente di sola lettura")
            raise CommandError(403, "Il tuo account può solo consultare")
        try:
            entity, domain, service, data = self.resolve(azione, target, valore)
        except CommandError as err:
            await self.repo.log_command(username, None, target, valore, f"rifiutato: {err}")
            raise
        full = f"{domain}.{service}"
        try:
            await self.ha.call_service(domain, service, entity.entity_id, data)
        except HANotConnected as err:
            cid = await self.repo.log_command(username, full, target, valore, f"errore: {err}")
            raise CommandError(503, str(err)) from err
        except (HAError, TimeoutError) as err:
            cid = await self.repo.log_command(username, full, target, valore, f"errore: {err}")
            raise CommandError(502, f"Home Assistant ha rifiutato il comando: {err}") from err
        cid = await self.repo.log_command(username, full, target, valore, "ok")
        log.info("%s: %s -> %s %s", username, full, target, data)
        return CommandResult(id=cid, esito="ok", servizio=full)
