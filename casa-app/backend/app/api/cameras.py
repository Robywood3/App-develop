from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from app.api.deps import current_user, services
from app.api.history import _parse
from app.frigate_client import FrigateError

router = APIRouter()


class Offer(BaseModel):
    sdp: str


def _http(err: FrigateError) -> HTTPException:
    return HTTPException(err.status, str(err))


@router.get("/cameras")
async def cameras(user=Depends(current_user), svc=Depends(services)):
    try:
        names = await svc.frigate.cameras()
    except FrigateError as err:
        raise _http(err) from err
    return {"telecamere": [{"nome": n, "immagine": f"/api/cameras/{n}/snapshot", "diretta": f"/api/cameras/{n}/webrtc"} for n in names]}


@router.get("/cameras/{name}/snapshot")
async def snapshot(name: str, user=Depends(current_user), svc=Depends(services)):
    try:
        data = await svc.frigate.snapshot(name)
    except FrigateError as err:
        raise _http(err) from err
    return Response(data, media_type="image/jpeg", headers={"Cache-Control": "no-store"})


@router.post("/cameras/{name}/webrtc")
async def webrtc(name: str, offer: Offer, user=Depends(current_user), svc=Depends(services)):
    try:
        return {"type": "answer", "sdp": await svc.frigate.webrtc_answer(name, offer.sdp)}
    except FrigateError as err:
        raise _http(err) from err


@router.get("/events")
async def events(telecamera: str | None = None, oggetto: str | None = None, da: str | None = None, a: str | None = None,
                 user=Depends(current_user), svc=Depends(services)):
    end = _parse(a, datetime.now(timezone.utc))
    start = _parse(da, end - timedelta(days=1))
    try:
        return {"eventi": await svc.frigate.events(telecamera, oggetto, start, end)}
    except FrigateError as err:
        raise _http(err) from err


@router.get("/clips/{event_id}")
async def clip(event_id: str, request: Request, user=Depends(current_user), svc=Depends(services)):
    try:
        body = await svc.frigate.clip(event_id)
    except FrigateError as err:
        raise _http(err) from err
    return StreamingResponse(body, media_type="video/mp4")
