# Regole per Claude Code – Casa App

Queste regole vengono da `docs/architettura.md`, sezione 13. Valgono per ogni sessione.

1. Leggi `docs/architettura.md` prima di ogni attività. Leggi anche `docs/revisione.md`.
2. Non scrivere integrazioni dei dispositivi. Usa le entità di HA.
3. Non mettere nel backend logiche che comandano impianti. Scrivile come package YAML in `ha/packages/`.
4. Scrivi ogni `entity_id` solo in `config/entities.yaml`.
5. Aggiungi ogni nuovo servizio HA a `config/services_allowlist.yaml`.
6. Non scrivere token, password o codici nel codice o nel repository. Usa i file `.env`.
7. Scrivi un test per ogni funzione nuova. Usa HA simulato per i test del backend.
8. Fai commit piccoli: una funzione per commit.
9. Verifica che `docker compose up -d` parta senza errori prima di ogni commit.
10. Scrivi il codice e i commenti in inglese, i testi dell'interfaccia in italiano.
11. Scrivi la documentazione con frasi brevi in forma attiva (stile STE).

## Comandi utili

```bash
# backend
cd backend && pip install -r requirements-dev.txt && pytest
# HA simulato + backend in locale (senza HA reale)
cd backend && python -m app.sim.fake_ha --port 8123 &
HA_URL=ws://localhost:8123/api/websocket HA_TOKEN=sim uvicorn app.main:app --reload
# frontend
cd frontend && npm ci && npm run dev    # proxy /api verso localhost:8000
npm test                                 # vitest
# stack completo con HA simulato
COMPOSE_PROFILES=sim docker compose up -d
```

## Dove stanno le cose

- `config/entities.yaml`: nomi logici → `entity_id`. Il codice usa solo i nomi logici.
- `config/services_allowlist.yaml`: servizi HA che il backend può chiamare.
- `backend/app/sim/fake_ha.py`: HA simulato (API WebSocket) per test e sviluppo.
- `ha/packages/`: package YAML di HA (logiche degli impianti).
