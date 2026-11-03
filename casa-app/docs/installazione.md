# Installazione sul mini PC

Segui le fasi della sezione 12 di `architettura.md`. Questa guida copre i passi con file del repository.

## 1. Base (F0)

1. Installa Ubuntu Desktop LTS, Docker, Docker Compose, KVM, libvirt, virt-manager.
2. Crea il ponte `br0` e la VM di HA (sezione 10).
3. Consenti il traffico della VM sul ponte. Senza questo passo Docker blocca la VM:

   ```bash
   sudo cp -r . /opt/casa-app
   sudo /opt/casa-app/ops/br0-docker.sh
   sudo cp /opt/casa-app/ops/systemd/br0-docker.service /etc/systemd/system/
   sudo systemctl enable --now br0-docker.service
   ```

4. Monta l'SSD video su `/mnt/video`.

## 2. Configurazione

```bash
cd /opt/casa-app
./ops/setup.sh
```

Lo script crea `.env` e `backend/.env` con password casuali e il file utenti di Mosquitto. Poi compila:

- in `.env`: `FRIGATE_RTSP_PASSWORD`, `CASA_DOMAIN`, `TS_DOMAIN`, `COMPOSE_PROFILES=video`;
- in `backend/.env`: `HA_URL`, `HA_TOKEN` (utente HA dedicato, non amministratore), `BOOTSTRAP_ADMIN`, `BOOTSTRAP_PASSWORD`;
- in `frigate/config.yml`: IP e percorsi RTSP delle telecamere, IP del mini PC in `webrtc.candidates`.

In HA aggiungi l'integrazione MQTT: server = IP del mini PC, porta 1883, utente e password di `.env`.

## 3. Avvio

```bash
docker compose up -d
docker compose ps
```

Crea il secondo utente e l'account TV:

```bash
docker compose exec backend python -m scripts.create_user moglie --ruolo utente
docker compose exec backend python -m scripts.create_user tv --ruolo tv
```

Dopo il primo accesso, cancella `BOOTSTRAP_PASSWORD` da `backend/.env`.

## 4. Storico (F4)

1. Copia i CSV in una cartella del mini PC e scrivi la mappa delle colonne (`backend/scripts/import_mapping.example.yaml`).
2. Controlla senza scrivere:

   ```bash
   docker compose run --rm -v /percorso/csv:/import backend python -m scripts.import_csv /import/mappa.yaml --dry-run
   ```

3. Importa (senza `--dry-run`), poi importa le statistiche di HA del periodo precedente:

   ```bash
   docker compose exec backend python -m scripts.import_ha_statistics --da 2023-01-01
   ```

## 5. TV, accesso remoto e backup

- **TV:** copia `ops/casa-app-kiosk.desktop` in `~/.config/autostart/` dell'utente TV.
- **Tailscale:** installa Tailscale sul mini PC e sui telefoni. In `.env` imposta
  `TS_DOMAIN` (es. `casa-app.tail1234.ts.net`) e `TAILSCALE_SOCKET=/var/run/tailscale/tailscaled.sock`.
  Riavvia Caddy: `docker compose up -d caddy`.
- **Backup:** crea `ops/backup.env` con `BACKUP_COPY=utente@raspberry:/backup/casa-app`, poi:

  ```bash
  sudo cp ops/systemd/casa-backup.* /etc/systemd/system/
  sudo systemctl enable --now casa-backup.timer
  ```

- **Prova di ripristino:** su un disco vuoto, `ops/restore.sh /var/backups/casa-app/<data>`.
