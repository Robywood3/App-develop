#!/usr/bin/env bash
# Nightly backup (section 9): database dump + configuration, copied to a second device.
# HA makes its own backups (Settings > System > Backups, automatic, to the same network share).
#   BACKUP_DIR   local folder            (default /var/backups/casa-app)
#   BACKUP_COPY  rsync destination        (e.g. pi@raspberry:/backup/casa-app) — second device
#   BACKUP_KEEP  days to keep locally     (default 14)
set -euo pipefail
cd "$(dirname "$0")/.."
BACKUP_DIR=${BACKUP_DIR:-/var/backups/casa-app}
KEEP=${BACKUP_KEEP:-14}
STAMP=$(date +%Y-%m-%d_%H%M)
DEST="$BACKUP_DIR/$STAMP"
mkdir -p "$DEST"

# 1. database (custom format, works with pg_restore; TimescaleDB-aware restore in restore.sh)
docker compose exec -T db pg_dump -U casa -d casa -Fc > "$DEST/casa.dump"

# 2. configuration and secrets (the backup folder must be protected: it contains .env files)
tar czf "$DEST/config.tgz" .env backend/.env mosquitto/passwd config frigate/config.yml caddy ha/packages
docker run --rm -v casa-app_caddy-data:/data -v "$DEST:/out" alpine:3.20 tar czf /out/caddy-data.tgz -C /data .
chmod -R go-rwx "$DEST"

# 3. retention and copy to the second device
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP" -exec rm -rf {} +
if [ -n "${BACKUP_COPY:-}" ]; then
  rsync -a --delete "$BACKUP_DIR/" "$BACKUP_COPY/"
fi
echo "Backup completato: $DEST"
