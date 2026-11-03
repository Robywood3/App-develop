import asyncio

import pytest

from app.ha_client import HAClient, HAError, HANotConnected
from tests.conftest import wait_for


async def test_connects_reads_states_and_receives_events(fake_ha):
    client = HAClient(fake_ha.url, "test-token")
    seen = []
    client.on_state(lambda eid, st: seen.append((eid, st and st["state"])))
    client.start()
    await asyncio.wait_for(client.connected.wait(), 3)
    assert "input_number.pdc_target_temp" in client.states
    await fake_ha.set_state("sensor.zona_giorno_temperatura", "21.3")
    await wait_for(lambda: ("sensor.zona_giorno_temperatura", "21.3") in seen)
    await client.stop()


async def test_call_service_changes_state(fake_ha):
    client = HAClient(fake_ha.url, "test-token")
    client.start()
    await asyncio.wait_for(client.connected.wait(), 3)
    await client.call_service("input_number", "set_value", "input_number.pdc_target_temp", {"value": 21.5})
    await wait_for(lambda: client.states["input_number.pdc_target_temp"]["state"] == "21.5")
    assert fake_ha.service_calls[-1]["entity_ids"] == ["input_number.pdc_target_temp"]
    fake_ha.fail_services.add("switch.turn_on")
    with pytest.raises(HAError):
        await client.call_service("switch", "turn_on", "switch.shellyplus2pm_1c6920480994_switch_0")
    await client.stop()


async def test_wrong_token_never_connects(fake_ha):
    client = HAClient(fake_ha.url, "wrong", max_backoff=0.1)
    client.start()
    await asyncio.sleep(0.5)
    assert not client.connected.is_set()
    with pytest.raises(HANotConnected):
        await client.call_service("switch", "turn_on", "switch.x")
    await client.stop()


async def test_reconnects_and_rereads_states(fake_ha):
    client = HAClient(fake_ha.url, "test-token", max_backoff=0.2)
    events = []
    client.on_connection(lambda up: events.append(up))
    client.start()
    await asyncio.wait_for(client.connected.wait(), 3)
    port = fake_ha.port
    await fake_ha.stop()
    await wait_for(lambda: events == [True, False])
    fake_ha.states["sensor.zona_giorno_temperatura"]["state"] = "19.0"  # changed while offline
    await fake_ha.start(port=port)
    await wait_for(lambda: events == [True, False, True], timeout=5)
    assert client.states["sensor.zona_giorno_temperatura"]["state"] == "19.0"
    await client.stop()
