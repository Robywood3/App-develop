import asyncio

import pytest

from app.commands import CommandError, CommandService
from app.entities import load_allowlist
from app.ha_client import HAClient
from app.repository import MemoryRepository
from tests.conftest import CONFIG, wait_for

USER = {"nome": "roberto", "ruolo": "admin"}


@pytest.fixture
async def service(fake_ha, entity_map):
    ha = HAClient(fake_ha.url, "test-token")
    ha.start()
    await asyncio.wait_for(ha.connected.wait(), 3)
    repo = MemoryRepository()
    yield CommandService(entity_map, load_allowlist(CONFIG / "services_allowlist.yaml"), ha, repo), repo, ha
    await ha.stop()


async def test_set_value_reaches_ha_and_is_logged(service, fake_ha):
    svc, repo, ha = service
    res = await svc.execute(USER, "set", "pdc.target_pt", 21)
    assert res.esito == "ok"
    assert fake_ha.service_calls[-1] == {"domain": "input_number", "service": "set_value", "entity_ids": ["input_number.pdc_target_temp"], "data": {"value": 21.0}}
    await wait_for(lambda: ha.states["input_number.pdc_target_temp"]["state"] == "21.0")
    assert repo.commands[-1]["utente"] == "roberto"
    assert repo.commands[-1]["servizio"] == "input_number.set_value"


async def test_climate_attribute_and_switch(service, fake_ha):
    svc, repo, _ = service
    await svc.execute(USER, "set", "pdc.offset", -2)
    assert fake_ha.states["climate.pdc_leaving_water_offset"]["attributes"]["temperature"] == -2.0
    await svc.execute(USER, "turn_on", "vmc.pt")
    assert fake_ha.states["switch.shellyplus2pm_1c6920480994_switch_0"]["state"] == "on"
    await svc.execute(USER, "set", "acs.target", 52)
    assert fake_ha.states["water_heater.pdc"]["attributes"]["temperature"] == 52.0
    with pytest.raises(CommandError):
        await svc.execute(USER, "set", "acs.stato", 52)  # the state itself is read-only


@pytest.mark.parametrize("azione,target,valore,status", [
    ("set", "pdc.potenza", 1, 403),          # sensor: not commandable
    ("set", "nessuna.entita", 1, 404),
    ("set", "camino.modalita", 1, 409),      # not configured yet
    ("turn_on", "pdc.target_pt", None, 400), # wrong action for input_number
    ("set", "pdc.target_pt", 35, 400),       # out of range
    ("set", "pdc.target_pt", "abc", 400),
    ("set", "pdc.target_pt", None, 400),
])
async def test_rejected_commands_are_logged(service, fake_ha, azione, target, valore, status):
    svc, repo, _ = service
    calls = len(fake_ha.service_calls)
    with pytest.raises(CommandError) as err:
        await svc.execute(USER, azione, target, valore)
    assert err.value.status == status
    assert len(fake_ha.service_calls) == calls  # nothing reached HA
    assert repo.commands[-1]["esito"].startswith("rifiutato")


async def test_service_not_in_allowlist_is_refused(service, entity_map, fake_ha):
    svc, repo, ha = service
    svc.allowlist = svc.allowlist - {"switch.turn_on"}
    with pytest.raises(CommandError) as err:
        await svc.execute(USER, "turn_on", "vmc.pt")
    assert err.value.status == 403


async def test_read_only_user_and_ha_errors(service, fake_ha):
    svc, repo, ha = service
    with pytest.raises(CommandError) as err:
        await svc.execute({"nome": "ospite", "ruolo": "lettura"}, "turn_on", "vmc.pt")
    assert err.value.status == 403
    fake_ha.fail_services.add("switch.turn_on")
    with pytest.raises(CommandError) as err:
        await svc.execute(USER, "turn_on", "vmc.pt")
    assert err.value.status == 502
    assert repo.commands[-1]["esito"].startswith("errore")
    await ha.stop()
    with pytest.raises(CommandError) as err:
        await svc.execute(USER, "turn_on", "vmc.pt")
    assert err.value.status == 503
