from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import current_user, services

router = APIRouter()


def _parse(ts: str | None, default: datetime) -> datetime:
    if not ts:
        return default
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(400, f"Data non valida: {ts}") from None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


@router.get("/history")
async def history(
    entita: str = Query(..., description="logical names, comma separated"),
    da: str | None = None,
    a: str | None = None,
    user=Depends(current_user),
    svc=Depends(services),
):
    names = [n for n in entita.split(",") if n]
    if not names or len(names) > 20:
        raise HTTPException(400, "Indica da 1 a 20 entità")
    unknown = [n for n in names if svc.entities.get(n) is None]
    if unknown:
        raise HTTPException(404, f"Entità sconosciute: {', '.join(unknown)}")
    end = _parse(a, datetime.now(timezone.utc))
    start = _parse(da, end - timedelta(hours=24))
    if start >= end:
        raise HTTPException(400, "L'inizio deve precedere la fine")
    resolution, series = await svc.repo.history(names, start, end)
    return {"risoluzione": resolution, "da": start.isoformat(), "a": end.isoformat(), "serie": series}
