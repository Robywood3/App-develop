from __future__ import annotations

import asyncio
import contextlib

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.api.deps import current_user, services, ws_user

router = APIRouter()


@router.get("/state")
async def state(user=Depends(current_user), svc=Depends(services)):
    return svc.hub.snapshot()


@router.websocket("/live")
async def live(ws: WebSocket):
    user = await ws_user(ws)
    if not user:
        await ws.close(code=4401, reason="Accesso richiesto")
        return
    svc = ws.app.state.services
    await ws.accept()
    queue = svc.hub.subscribe()
    try:
        await ws.send_json({"tipo": "snapshot", "dati": svc.hub.snapshot()})

        async def ping_reader():
            # the client may send {"tipo":"ping"}; any receive error ends the session
            while True:
                msg = await ws.receive_json()
                if msg.get("tipo") == "ping":
                    await ws.send_json({"tipo": "pong"})

        reader = asyncio.create_task(ping_reader())
        try:
            while True:
                getter = asyncio.create_task(queue.get())
                done, _ = await asyncio.wait({getter, reader}, return_when=asyncio.FIRST_COMPLETED)
                if reader in done:
                    getter.cancel()
                    break
                await ws.send_json(getter.result())
        finally:
            reader.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await reader
    except WebSocketDisconnect:
        pass
    finally:
        svc.hub.unsubscribe(queue)
