#!/usr/bin/env bash
# Restore on an empty disk (RNF-04). Usage: ops/restore.sh /var/backups/casa-app/2026-11-03_0300
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=${1:?indica la cartella del backup}

tar xzf "$SRC/config.tgz"
docker compose up -d db
until docker compose exec -T db pg_isready -U casa -d casa >/dev/null 2>&1; do sleep 2; done

# TimescaleDB restore: pre/post hooks around pg_restore
docker compose exec -T db psql -U casa -d casa -c "SELECT timescaledb_pre_restore();"
docker compose exec -T db pg_restore -U casa -d casa --no-owner < "$SRC/casa.dump" || true
docker compose exec -T db psql -U casa -d casa -c "SELECT timescaledb_post_restore();"

docker volume create casa-app_caddy-data >/dev/null
docker run --rm -v casa-app_caddy-data:/data -v "$SRC:/in:ro" alpine:3.20 tar xzf /in/caddy-data.tgz -C /data
docker compose up -d
echo "Ripristino completato. Controlla: docker compose ps"
