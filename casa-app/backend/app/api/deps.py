from __future__ import annotations

from fastapi import HTTPException, Request, WebSocket

from app.auth import COOKIE


def services(request: Request):
    return request.app.state.services


async def current_user(request: Request) -> dict:
    user = await request.app.state.services.auth.user_for_token(request.cookies.get(COOKIE))
    if not user:
        raise HTTPException(401, "Accesso richiesto")
    return user


async def ws_user(ws: WebSocket) -> dict | None:
    return await ws.app.state.services.auth.user_for_token(ws.cookies.get(COOKIE))


def client_ip(request: Request) -> str:
    # Caddy sets X-Forwarded-For; the backend is reachable only through Caddy
    fwd = request.headers.get("x-forwarded-for")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "?")
