# Revisione del documento di architettura

Nov 3, 2026 · revisione fatta applicando `docs/architettura.md` al repository.

Questo documento elenca i problemi trovati, le decisioni prese nel codice e le domande aperte.
Le voci "Da correggere" richiedono una modifica al documento di architettura.

## 1. Da correggere

### 1.1 Docker blocca la rete della VM di HA (sezione 10, passo 3)

Docker imposta la policy `FORWARD` di iptables a `DROP`. Con il ponte `br0` il traffico della VM
passa da iptables: la VM di HA perde la rete appena Docker parte.

- **Correzione:** dopo il passo 3, eseguire `ops/br0-docker.sh` e attivare `ops/systemd/br0-docker.service`.
- **Verifica:** riavviare il mini PC e fare ping verso la VM.

### 1.2 HTTPS in casa: il certificato interno di Caddy non è fidato (sezione 9)

Con `tls internal` Caddy firma il certificato con una sua autorità. TV, tablet e telefoni non la conoscono:

- il browser mostra un avviso;
- senza HTTPS valido la PWA non si installa e il service worker non parte.

Due soluzioni:

1. installare il certificato radice di Caddy su ogni dispositivo (Android lo segnala come "rete monitorata");
2. **consigliata:** usare Tailscale anche in casa. Tutti i dispositivi usano un solo indirizzo `*.ts.net`
   con certificato pubblico, dentro e fuori casa. La TV usa il mini PC stesso.

Il `Caddyfile` supporta entrambe: blocco `CASA_DOMAIN` (interno) e blocco `TS_DOMAIN` (Tailscale).

### 1.3 Modalità camino e PDC non funzionano senza internet (RNF-01)

L'esempio della sezione 3 passa dal cloud Onecta. Senza internet HA non comanda la PDC.
Lo stesso vale per tado, Netatmo e Tesla. RNF-01 elenca solo Shelly, telecamere e storico: è coerente,
ma il documento deve dirlo in chiaro.

- **Proposta:** valutare il controllo locale della PDC (porta Modbus dell'Altherma, oppure ESPAltherma/P1P2 con ESPHome).
  Nuovo punto aperto.

### 1.4 I log calcolati spariscono quando PDC Logger smette di scrivere i CSV (RF-04, sezione 6)

Il backend scrive solo gli eventi `state_changed` delle entità di HA. `log_decadimento`, `log_timeline`
e `log_shadow_ml` sembrano calcoli interni di PDC Logger e Shadow ML, non entità.
Dopo il passo 3 dell'importazione questi dati non arrivano più al database.

- **Correzione:** prima di fermare i CSV, esporre ogni valore calcolato come entità `sensor.*` in HA
  e aggiungerla a `config/entities.yaml` con `log: true`.

### 1.5 La regola "1 valore ogni 10 s" perde i cambi brevi (sezione 6)

Se un interruttore passa da spento ad acceso e torna spento in 5 s, il database registra solo l'ultimo stato.
Per la timeline può non bastare.

- **Proposta:** scrivere sempre i cambi di stato on/off; limitare a 10 s solo i valori numerici.
  Oggi il codice applica la regola del documento a tutto.

### 1.6 La diretta video non passa dal backend (sezioni 3 e 7)

Il backend passa solo la negoziazione WebRTC (offer/answer). Il video va direttamente da go2rtc al browser
sulla porta 8555 (TCP/UDP). È un'eccezione alla regola "ogni livello comunica solo con l'adiacente".

- **Correzione:** scriverla nella sezione 3. Da fuori casa la diretta funziona via Tailscale:
  aggiungere l'IP Tailscale del mini PC ai `candidates` in `frigate/config.yml`.

### 1.7 Il token di HA dà accesso completo (sezione 5)

I token di lunga durata di HA hanno tutti i permessi dell'utente che li crea.

- **Proposta:** creare in HA un utente dedicato `casa-app`, **non amministratore**, e generare il token da lì.
  La protezione principale resta il backend (lista dei servizi e delle entità autorizzate).

## 2. Decisioni prese nel codice

| Tema | Decisione | Dove |
| --- | --- | --- |
| Servizi autorizzati | Doppio controllo: servizio in `services_allowlist.yaml` **e** destinazione con `command: true` in `entities.yaml`, più intervallo `min`/`max` per i valori numerici | `backend/app/commands.py` |
| Comandi | L'app invia nomi logici (`pdc.target_pt`), mai `entity_id`. Il backend registra anche i comandi rifiutati | `/api/command`, tabella `comandi` |
| Acqua calda | `water_heater.pdc` ha tre nomi logici: `acs.stato`, `acs.temp` (attributo `current_temperature`), `acs.target` (attributo `temperature`, comandabile) | `config/entities.yaml` |
| Durata sessioni | Al login l'utente sceglie "dispositivo fisso di casa" (365 giorni) o no (30 giorni). L'account TV ha sempre la sessione lunga | `backend/app/auth.py` |
| Ruoli | `admin`, `utente`, `tv`, `lettura`. Solo `lettura` non può comandare | tabella `utenti` |
| Primo utente | Creato all'avvio da `BOOTSTRAP_ADMIN`/`BOOTSTRAP_PASSWORD` in `backend/.env`, oppure con `scripts/create_user.py` | `backend/app/main.py` |
| Tabella aggiunta | `sessioni` (non prevista dal documento): permette di chiudere una sessione | `migrations/001_init.sql` |
| Griglia telecamere TV | Immagini aggiornate ogni 5 s; diretta WebRTC al clic. Otto dirette insieme pesano su CPU e rete | `frontend/src/views/Telecamere.tsx` |
| Frigate in Compose | Profilo `video`: senza GPU Intel lo stack parte lo stesso (regola 9). Sul mini PC: `COMPOSE_PROFILES=video` | `docker-compose.yml` |
| HA simulato | Profilo `sim`: HA finto con l'API WebSocket, per test e sviluppo | `backend/app/sim/fake_ha.py` |
| Ripristino database | `pg_restore` tra `timescaledb_pre_restore()` e `timescaledb_post_restore()`; versione dell'immagine fissata (2.17.2-pg16) | `ops/restore.sh` |
| Backup di HA | HA fa i suoi backup automatici (Impostazioni → Sistema → Backup) sulla stessa cartella di rete | `ops/backup.sh` |

## 3. Da decidere

- [ ] Account TV: può inviare comandi o solo consultare? Oggi può comandare.
- [ ] Nomi delle entità di modalità camino e scenari (oggi `entity_id: null` in `entities.yaml`).
- [ ] Formato reale dei CSV (`log_granulare`, ...): serve per `scripts/import_mapping.example.yaml`.
- [ ] Controllo locale della PDC (vedi 1.3).
- [ ] Repository dedicato: il documento prevede `casa-app/` come repository a sé. Oggi è una cartella di
      `App-develop`, accanto all'app EZVIZ TV e al prototipo `casa-clima/`. Consiglio di spostarlo:
      `CLAUDE.md` deve stare nella radice.
- [ ] Prototipo `casa-clima/` (Node.js): contiene integrazioni scritte da zero e viola RNF-05.
      Va archiviato o eliminato; non va usato in produzione.

## 4. Materiale mancante

Il documento parte da Casa Clima v15 (`casa-clima.html`), dalla tabella `CFG` e da `casa-3d-live.html`.
Questi file non sono nel repository. Le viste sono state ricostruite dal testo del documento.

- Copiare `casa-3d-live.html` in `frontend/public/3d/`: la vista 3D lo mostra subito in iframe.
- Con `casa-clima.html` e la tabella `CFG` si possono completare `entities.yaml` e le viste Casa e Impianto.

## 5. Stato per fase

| Fase | Nel repository | Richiede il mini PC |
| --- | --- | --- |
| F0 – Base | `ops/br0-docker.sh`, servizi systemd | Installazione di Ubuntu, KVM, ponte, SSD |
| F1 – Migrazione HA | — | Tutta |
| F2 – Telecamere | `frigate/config.yml`, `mosquitto/`, eventi MQTT nel backend | IP, percorsi RTSP, zone, GPU |
| F3 – Backend | Completo. 41 test automatici con HA simulato | Prova con HA reale |
| F4 – Storico | Schema TimescaleDB, scrittura, aggregazioni, script d'importazione. Grafico di 1 anno verificato in < 1 s | Import dei CSV veri |
| F5 – Frontend | Le 7 viste + registro comandi, PWA, layout TV/tablet/telefono, test Playwright su 3 dimensioni | Uso quotidiano per 2 settimane |
| F6 – Accesso remoto | Caddy con blocco Tailscale | Installazione di Tailscale |
| F7 – Backup | `ops/backup.sh`, `ops/restore.sh`, timer notturno | Prova di ripristino su disco vuoto |
