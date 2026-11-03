#!/usr/bin/env bash
# First setup: create .env and backend/.env with random secrets, create the MQTT password file.
set -euo pipefail
cd "$(dirname "$0")/.."

rand() { head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32; }

if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(rand)/" .env
  sed -i "s/^MQTT_PASSWORD=.*/MQTT_PASSWORD=$(rand)/" .env
  chmod 600 .env
  echo "Creato .env: inserisci FRIGATE_RTSP_PASSWORD e controlla CASA_DOMAIN."
fi
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  chmod 600 backend/.env
  echo "Creato backend/.env: inserisci HA_URL e HA_TOKEN (e il primo amministratore)."
fi

set -a; . ./.env; set +a
if [ ! -s mosquitto/passwd ]; then
  touch mosquitto/passwd
  docker run --rm -v "$PWD/mosquitto:/m" eclipse-mosquitto:2.0.20 \
    sh -c "mosquitto_passwd -b -c /m/passwd '$MQTT_USER' '$MQTT_PASSWORD' && chown 1883:1883 /m/passwd && chmod 600 /m/passwd"
  echo "Creato mosquitto/passwd per l'utente $MQTT_USER."
fi
echo "Pronto. Avvia con: docker compose up -d"
