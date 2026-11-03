from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.api.deps import client_ip, current_user, services
from app.auth import COOKIE, AuthError

router = APIRouter()


class LoginBody(BaseModel):
    nome: str
    password: str
    dispositivo: str = "mobile"  # "casa" = fixed home device (TV, tablet): long session


class PasswordBody(BaseModel):
    attuale: str
    nuova: str


@router.post("/login")
async def login(body: LoginBody, request: Request, response: Response, svc=Depends(services)):
    try:
        token, user, expires = await svc.auth.login(body.nome, body.password, body.dispositivo, client_ip(request))
    except AuthError as err:
        raise HTTPException(err.status, str(err)) from err
    response.set_cookie(COOKIE, token, expires=expires, httponly=True, secure=svc.settings.cookie_secure, samesite="lax", path="/")
    return {"utente": user}


@router.post("/logout")
async def logout(request: Request, response: Response, svc=Depends(services)):
    await svc.auth.logout(request.cookies.get(COOKIE))
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


@router.get("/me")
async def me(user=Depends(current_user)):
    return {"utente": user}


@router.post("/password")
async def change_password(body: PasswordBody, user=Depends(current_user), svc=Depends(services)):
    try:
        await svc.auth.change_password(user["nome"], body.attuale, body.nuova)
    except AuthError as err:
        raise HTTPException(err.status, str(err)) from err
    return {"ok": True}
