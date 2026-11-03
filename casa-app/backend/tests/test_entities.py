from pathlib import Path

import pytest

from app.entities import EntityMap, load_allowlist

CONFIG = Path(__file__).resolve().parents[2] / "config"


def test_entity_map_loads_and_hides_entity_ids(entity_map):
    e = entity_map.get("pdc.offset")
    assert e.entity_id == "climate.pdc_leaving_water_offset"
    assert e.attribute == "temperature"
    assert "entity_id" not in e.public()
    assert entity_map.for_entity_id("input_number.pdc_target_temp")[0].name == "pdc.target_pt"
    assert entity_map.get("camino.modalita").configured is False


def test_every_entity_id_is_valid_and_unique(entity_map):
    # the same entity may appear more than once only to read different attributes
    keys = [(e.entity_id, e.attribute) for e in entity_map.configured()]
    assert len(keys) == len(set(keys))


def test_commandable_entities_have_allowed_services(entity_map):
    from app.commands import ACTIONS

    allow = load_allowlist(CONFIG / "services_allowlist.yaml")
    for e in entity_map.configured():
        if e.command:
            services = {f"{dom}.{svc}" for (act, dom), (svc, _) in ACTIONS.items() if dom == e.domain}
            assert services & allow, f"{e.name}: no allowed service for domain {e.domain}"


def test_invalid_entity_id_is_rejected(tmp_path):
    p = tmp_path / "entities.yaml"
    p.write_text("entities:\n  x:\n    entity_id: notvalid\n")
    with pytest.raises(ValueError):
        EntityMap.load(p)
