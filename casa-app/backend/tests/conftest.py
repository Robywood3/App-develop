import asyncio
from pathlib import Path

import pytest

from app.entities import EntityMap
from app.sim.fake_ha import FakeHA

CONFIG = Path(__file__).resolve().parents[2] / "config"


@pytest.fixture
def entity_map() -> EntityMap:
    return EntityMap.load(CONFIG / "entities.yaml")


@pytest.fixture
async def fake_ha(entity_map):
    sim = FakeHA(token="test-token", entities=entity_map)
    await sim.start()
    yield sim
    await sim.stop()


async def wait_for(predicate, timeout: float = 3.0):
    """Poll until predicate() is true or fail the test."""
    loop = asyncio.get_running_loop()
    end = loop.time() + timeout
    while loop.time() < end:
        if predicate():
            return
        await asyncio.sleep(0.02)
    raise AssertionError("condition not met in time")
