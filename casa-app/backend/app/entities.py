"""Logical entity map loaded from config/entities.yaml and the service allowlist."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


@dataclass(frozen=True)
class Entity:
    name: str
    entity_id: str | None
    label: str
    attribute: str | None = None
    unit: str | None = None
    log: bool = False
    command: bool = False
    min: float | None = None
    max: float | None = None
    step: float | None = None

    @property
    def domain(self) -> str | None:
        return self.entity_id.split(".", 1)[0] if self.entity_id else None

    @property
    def configured(self) -> bool:
        return bool(self.entity_id)

    def public(self) -> dict[str, Any]:
        """Metadata safe for the frontend: no entity_id (the frontend uses logical names only)."""
        return {
            "nome": self.name,
            "etichetta": self.label,
            "unita": self.unit,
            "comandabile": self.command and self.configured,
            "configurata": self.configured,
            "dominio": self.domain,
            "min": self.min,
            "max": self.max,
            "passo": self.step,
        }


class EntityMap:
    def __init__(self, entities: dict[str, Entity]):
        self.by_name = entities
        self.by_entity_id: dict[str, list[Entity]] = {}
        for e in entities.values():
            if e.entity_id:
                self.by_entity_id.setdefault(e.entity_id, []).append(e)

    @classmethod
    def load(cls, path: Path) -> "EntityMap":
        raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        items = raw.get("entities") or {}
        entities: dict[str, Entity] = {}
        for name, cfg in items.items():
            cfg = cfg or {}
            entity_id = cfg.get("entity_id")
            if entity_id is not None and "." not in str(entity_id):
                raise ValueError(f"{path.name}: invalid entity_id for {name}: {entity_id!r}")
            entities[name] = Entity(
                name=name,
                entity_id=entity_id,
                label=cfg.get("label", name),
                attribute=cfg.get("attribute"),
                unit=cfg.get("unit"),
                log=bool(cfg.get("log", False)),
                command=bool(cfg.get("command", False)),
                min=cfg.get("min"),
                max=cfg.get("max"),
                step=cfg.get("step"),
            )
        return cls(entities)

    def get(self, name: str) -> Entity | None:
        return self.by_name.get(name)

    def for_entity_id(self, entity_id: str) -> list[Entity]:
        return self.by_entity_id.get(entity_id, [])

    def configured(self) -> list[Entity]:
        return [e for e in self.by_name.values() if e.configured]


def load_allowlist(path: Path) -> set[str]:
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    services = raw.get("services") or []
    for s in services:
        if not isinstance(s, str) or s.count(".") != 1:
            raise ValueError(f"{path.name}: invalid service {s!r}")
    return set(services)
