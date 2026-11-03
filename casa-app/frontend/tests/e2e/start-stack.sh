#!/usr/bin/env bash
# Start simulated HA + backend (in-memory storage) + built frontend for the E2E tests.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT/backend"
python -m app.sim.fake_ha --port 18123 --token sim --drift 0 &
sleep 1
HA_URL=ws://127.0.0.1:18123/api/websocket HA_TOKEN=sim COOKIE_SECURE=false \
  BOOTSTRAP_ADMIN=admin BOOTSTRAP_PASSWORD=e2e-password \
  uvicorn app.main:app --port 8000 --log-level warning &
cd "$ROOT/frontend"
npx vite preview --port 4173 --strictPort &
wait
