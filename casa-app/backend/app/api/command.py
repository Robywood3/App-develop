from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.api.deps import current_user, services
from app.commands import CommandError

router = APIRouter()


class CommandBody(BaseModel):
    azione: str
    target: str
    valore: Any = None


@router.post("/command")
async def command(body: CommandBody, user=Depends(current_user), svc=Depends(services)):
    try:
        result = await svc.commands.execute(user, body.azione, body.target, body.valore)
    except CommandError as err:
        raise HTTPException(err.status, str(err)) from err
    return {"id": result.id, "esito": result.esito}


@router.get("/commands")
async def command_log(limit: int = Query(100, ge=1, le=1000), user=Depends(current_user), svc=Depends(services)):
    return {"comandi": await svc.repo.list_commands(limit)}
