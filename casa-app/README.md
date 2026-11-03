# Casa App

Interfaccia unica della casa di Casale Litta. Home Assistant è il motore; Casa App mostra lo stato,
invia i comandi, conserva lo storico e mostra le telecamere.

- Architettura: [docs/architettura.md](docs/architettura.md)
- Revisione e punti aperti: [docs/revisione.md](docs/revisione.md)
- Installazione sul mini PC: [docs/installazione.md](docs/installazione.md)
- Regole per Claude Code: [CLAUDE.md](CLAUDE.md)

## Componenti

| Cartella | Contenuto |
| --- | --- |
| `config/` | `entities.yaml` (nomi logici → entità HA), `services_allowlist.yaml` |
| `backend/` | Python 3.12 + FastAPI: client WebSocket di HA, API, comandi autorizzati, storico TimescaleDB, Frigate |
| `frontend/` | TypeScript + React + Vite, PWA: viste Casa, Impianto, Energia, Statistiche, 3D, Telecamere, Auto |
| `frigate/`, `mosquitto/`, `caddy/` | Configurazione dei container |
| `ha/packages/` | Package YAML di HA (logiche degli impianti) |
| `ops/` | Prima installazione, backup, ripristino, chiosco TV, ponte di rete |

## Provare senza Home Assistant

```bash
./ops/setup.sh
```

In `.env` imposta `COMPOSE_PROFILES=sim`. In `backend/.env` imposta:

```
HA_URL=ws://ha-sim:8123/api/websocket
HA_TOKEN=sim
BOOTSTRAP_ADMIN=admin
BOOTSTRAP_PASSWORD=una-password-lunga
```

```bash
docker compose up -d
```

Apri `https://localhost` (certificato interno di Caddy) ed entra con `admin`.

## Sviluppo

```bash
cd backend && pip install -r requirements-dev.txt && pytest     # 41 test, HA simulato
cd frontend && npm ci && npm test && npm run build              # vitest + build PWA
cd frontend && ./tests/e2e/start-stack.sh & npx playwright test # E2E su TV, tablet, telefono
```

Test del database su TimescaleDB vero:

```bash
docker run -d --name tsdb -e POSTGRES_PASSWORD=test -p 55432:5432 timescale/timescaledb:2.17.2-pg16
TEST_DATABASE_URL=postgresql://postgres:test@localhost:55432/postgres pytest tests/test_repository_pg.py
```
