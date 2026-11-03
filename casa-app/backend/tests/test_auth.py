from datetime import datetime, timedelta, timezone

import pytest

from app.auth import AuthError, AuthService, hash_password, token_hash, verify_password
from app.repository import MemoryRepository


def test_password_hash():
    h = hash_password("segreta123")
    assert verify_password("segreta123", h)
    assert not verify_password("altra", h)
    assert not verify_password("x", "garbage")


async def test_login_session_and_expiry():
    repo = MemoryRepository()
    auth = AuthService(repo, days_home=365, days_mobile=30)
    await auth.create_user("roberto", "segreta123", "admin")
    await auth.create_user("tv", "televisore1", "tv")
    token, user, expires = await auth.login("roberto", "segreta123", "mobile", "1.1.1.1")
    assert user["nome"] == "roberto"
    assert 29 <= (expires - datetime.now(timezone.utc)).days <= 30
    assert (await auth.user_for_token(token))["ruolo"] == "admin"
    _, _, exp_tv = await auth.login("tv", "televisore1", "mobile", "1.1.1.1")
    assert (exp_tv - datetime.now(timezone.utc)).days >= 364  # TV is always a home device
    repo.sessions[token_hash(token)]["scade"] = datetime.now(timezone.utc) - timedelta(seconds=1)
    assert await auth.user_for_token(token) is None
    await auth.logout("whatever")


async def test_wrong_password_and_throttle():
    repo = MemoryRepository()
    auth = AuthService(repo)
    await auth.create_user("roberto", "segreta123", "admin")
    for _ in range(5):
        with pytest.raises(AuthError) as err:
            await auth.login("roberto", "no", "mobile", "2.2.2.2")
        assert err.value.status == 401
    with pytest.raises(AuthError) as err:
        await auth.login("roberto", "segreta123", "mobile", "2.2.2.2")
    assert err.value.status == 429


async def test_create_user_validation_and_password_change():
    repo = MemoryRepository()
    auth = AuthService(repo)
    with pytest.raises(ValueError):
        await auth.create_user("x", "corta", "admin")
    with pytest.raises(ValueError):
        await auth.create_user("x", "lunghissima", "capo")
    await auth.create_user("roberto", "segreta123", "admin")
    token, _, _ = await auth.login("roberto", "segreta123", "casa", "3.3.3.3")
    await auth.change_password("roberto", "segreta123", "nuovapass1")
    assert await auth.user_for_token(token) is None  # sessions closed
    with pytest.raises(AuthError):
        await auth.change_password("roberto", "segreta123", "altrapass1")
