"""Create a Casa App user.

    docker compose exec backend python -m scripts.create_user roberto --ruolo admin
"""
from __future__ import annotations

import argparse
import asyncio
import getpass
import os
import sys

from app.auth import ROLES, AuthService
from app.repository import PostgresRepository


async def main() -> int:
    p = argparse.ArgumentParser(description="Crea un utente di Casa App")
    p.add_argument("nome")
    p.add_argument("--ruolo", default="utente", choices=sorted(ROLES))
    args = p.parse_args()
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("DATABASE_URL non impostato", file=sys.stderr)
        return 1
    password = os.environ.get("NEW_USER_PASSWORD") or getpass.getpass("Password (min. 8 caratteri): ")
    repo = PostgresRepository(dsn)
    await repo.start()
    try:
        await AuthService(repo).create_user(args.nome, password, args.ruolo)
    except ValueError as err:
        print(f"Errore: {err}", file=sys.stderr)
        return 1
    finally:
        await repo.close()
    print(f"Utente {args.nome} creato con ruolo {args.ruolo}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
