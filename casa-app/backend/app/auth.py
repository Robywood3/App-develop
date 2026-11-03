"""Users and sessions (section 9): scrypt password hashes, server-side sessions in an HttpOnly cookie.

Session length: long on fixed home devices (TV, tablet), 30 days on phones.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import time
from datetime import datetime, timedelta, timezone

from app.repository import Repository

COOKIE = "casa_session"
ROLES = {"admin", "utente", "tv", "lettura"}
DEVICES = {"casa", "mobile"}
_N, _R, _P = 2 ** 14, 8, 1


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=_N, r=_R, p=_P, dklen=32)
    return f"scrypt${_N}${_R}${_P}${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, n, r, p, salt, digest = stored.split("$")
        if algo != "scrypt":
            return False
        calc = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt), n=int(n), r=int(r), p=int(p), dklen=32)
        return hmac.compare_digest(calc, base64.b64decode(digest))
    except (ValueError, TypeError):
        return False


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class AuthError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


class AuthService:
    def __init__(self, repo: Repository, days_home: int = 365, days_mobile: int = 30):
        self.repo = repo
        self.days = {"casa": days_home, "mobile": days_mobile}
        self._failures: dict[str, tuple[int, float]] = {}
        # constant-time-ish answer when the user does not exist
        self._dummy_hash = hash_password(secrets.token_hex(8))

    def _check_throttle(self, ip: str) -> None:
        count, until = self._failures.get(ip, (0, 0.0))
        if count >= 5 and time.monotonic() < until:
            raise AuthError(429, f"Troppi tentativi: riprova tra {int(until - time.monotonic()) + 1} secondi")

    def _fail(self, ip: str) -> None:
        count, _ = self._failures.get(ip, (0, 0.0))
        count += 1
        delay = min(30 * 2 ** max(0, count - 5), 900) if count >= 5 else 0
        self._failures[ip] = (count, time.monotonic() + delay)

    async def login(self, nome: str, password: str, dispositivo: str, ip: str) -> tuple[str, dict, datetime]:
        self._check_throttle(ip)
        user = await self.repo.get_user(nome.strip())
        ok = verify_password(password, user["hash"] if user else self._dummy_hash)
        if not user or not ok:
            self._fail(ip)
            raise AuthError(401, "Nome o password errati")
        self._failures.pop(ip, None)
        if user["ruolo"] == "tv":
            dispositivo = "casa"
        if dispositivo not in DEVICES:
            dispositivo = "mobile"
        token = secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc) + timedelta(days=self.days[dispositivo])
        await self.repo.create_session(token_hash(token), user["id"], dispositivo, expires)
        return token, _public_user(user), expires

    async def user_for_token(self, token: str | None) -> dict | None:
        if not token:
            return None
        th = token_hash(token)
        s = await self.repo.get_session(th)
        if not s:
            return None
        if s["scade"] < datetime.now(timezone.utc):
            await self.repo.delete_session(th)
            return None
        user = await self.repo.get_user_by_id(s["utente_id"])
        return _public_user(user) if user else None

    async def logout(self, token: str | None) -> None:
        if token:
            await self.repo.delete_session(token_hash(token))

    async def create_user(self, nome: str, password: str, ruolo: str) -> int:
        if ruolo not in ROLES:
            raise ValueError(f"ruolo non valido: {ruolo} (valori: {', '.join(sorted(ROLES))})")
        if len(password) < 8:
            raise ValueError("la password deve avere almeno 8 caratteri")
        return await self.repo.create_user(nome, hash_password(password), ruolo)

    async def change_password(self, nome: str, current: str, new: str) -> None:
        user = await self.repo.get_user(nome)
        if not user or not verify_password(current, user["hash"]):
            raise AuthError(401, "Password attuale errata")
        if len(new) < 8:
            raise AuthError(400, "La nuova password deve avere almeno 8 caratteri")
        await self.repo.set_password(nome, hash_password(new))
        await self.repo.delete_user_sessions(user["id"])


def _public_user(u: dict) -> dict:
    return {"id": u["id"], "nome": u["nome"], "ruolo": u["ruolo"]}
