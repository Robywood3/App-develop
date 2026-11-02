# Come funziona Home Assistant e come è fatto Casa Clima

Casa Clima non contiene codice di Home Assistant. È una riscrittura da zero in Node.js che riprende
la sua **architettura**: Home Assistant è open source (licenza Apache 2.0) e i suoi concetti sono
documentati su <https://developers.home-assistant.io>. Qui sotto trovi l'analisi di come funziona HA
e a quale parte di Casa Clima corrisponde ogni pezzo.

## 1. Il nucleo: tre componenti

Home Assistant (`homeassistant/core.py`) ruota attorno a tre oggetti:

| Home Assistant | Cosa fa | Casa Clima |
|---|---|---|
| **State Machine** (`hass.states`) | Ogni entità ha uno *stato* (stringa) e degli *attributi*. `last_changed` cambia solo quando cambia lo stato, `last_updated` anche con i soli attributi. | `Hub.states` + `Hub.setState()` in [`src/core/hub.js`](../src/core/hub.js) |
| **Event Bus** (`hass.bus`) | Tutto è un evento: `state_changed`, `call_service`, `homeassistant_start`… Automazioni, recorder e interfaccia si iscrivono agli eventi. | `Hub` estende `EventEmitter`: `state_changed`, `service_called`, `logbook`, `casa_clima` |
| **Service Registry** (`hass.services`) | Le azioni sono "servizi" `dominio.servizio` (`climate.set_temperature`) chiamati con `entity_id` e dati. | `Hub.callService()` / `Hub.registerService()` |

Gli **entity_id** hanno la forma `dominio.nome` (`climate.tado_soggiorno`). Il dominio stabilisce
quali servizi e attributi ha l'entità: Casa Clima usa gli stessi domini e gli stessi nomi di HA
(`climate` con `hvac_modes`, `hvac_action`, `current_temperature`, `temperature`, `min_temp`…;
`switch`, `light`, `cover`, `lock`, `sensor`, `binary_sensor`, `select`, `number`, `button`,
`weather`, `scene`, `automation`).

## 2. Registri

| Home Assistant | Casa Clima |
|---|---|
| **Entity registry**: ID stabili tra i riavvii (`unique_id`), nome e area personalizzati | `Hub.entities` + `Integration.entity()` (salva l'associazione `unique_id → entity_id` in `data/config.json`) e `overrides` per nome/stanza/nascosto |
| **Device registry**: raggruppa le entità di un apparecchio (produttore, modello, area) | `Hub.devices` + `Integration.device()` |
| **Area registry** | Il campo "stanza" di dispositivi ed entità; Casa-Clima crea le stanze da lì |

## 3. Integrazioni

In HA ogni integrazione (`homeassistant/components/<nome>/`) ha:

- un `manifest.json`;
- un **config flow** (`config_flow.py`) che guida l'utente dall'interfaccia, inclusi i login OAuth2;
- una **config entry** salvata in `.storage/core.config_entries` con opzioni e token;
- un **DataUpdateCoordinator** che interroga il dispositivo/cloud a intervalli e notifica le entità;
- le **piattaforme** (`climate.py`, `sensor.py`…) che traducono i dati in entità.

In Casa Clima:

| HA | Casa Clima |
|---|---|
| `manifest.json` + `config_flow.py` | `static meta` della classe (campi del modulo, tipo di login) — l'interfaccia genera il modulo da lì |
| config entry | voce in `data/config.json → integrations[]` (`options` = ciò che inserisci, `data` = token) |
| `async_setup_entry` | `setup()` |
| DataUpdateCoordinator | `IntegrationManager` in [`src/integrations/manager.js`](../src/integrations/manager.js): chiama `update()` ogni `pollInterval`, con backoff esponenziale sugli errori e stato "Accesso richiesto" sugli errori di login |
| piattaforme `climate.py`, … | `update()` pubblica le entità; `handleService()` esegue i comandi |
| `application_credentials` + OAuth2 flow | `IntegrationManager.startAuth()` / `finishAuth()` + `TokenManager` ([`src/core/oauth.js`](../src/core/oauth.js)), con PKCE, callback `/api/oauth/callback` o codice incollato a mano, salvataggio immediato dei refresh token "rotanti" |

### Le API usate dalle integrazioni

| Integrazione | Protocollo | Note |
|---|---|---|
| **Tesla** | Fleet API (`/api/1/vehicles`, `vehicle_data`, `command/*`) oppure Teslemetry (stessa API, firma i comandi) | Non sveglia l'auto per leggere i dati; la sveglia solo per i comandi. Le auto recenti richiedono comandi firmati: `tesla-http-proxy` o Teslemetry. |
| **Daikin locale** | HTTP `/aircon/get_control_info`, `/aircon/set_control_info` (testo `chiave=valore`) | Adattatori BRP069A/B. Ogni modo ricorda il proprio setpoint (`dt1..dt7`). |
| **Daikin Onecta** | REST `api.onecta.daikineurope.com/v1/gateway-devices`, `PATCH …/characteristics/…`, OAuth2 | Limite 200 richieste/giorno → polling ogni 10 minuti. |
| **Netatmo** | `homesdata`, `homestatus`, `setroomthermpoint`, `setthermmode`, `getstationsdata` | Refresh token che cambia a ogni rinnovo. |
| **tado°** | `my.tado.com/api/v2` (`zoneStates`, `overlay`), login "device code" su `login.tado.com` | Limite di circa 100 richieste/giorno senza abbonamento → polling ogni 20 minuti. |
| **Shelly** | Gen1 `/status`, `/relay/0?turn=`; Gen2+ RPC `/rpc/Shelly.GetStatus`, `Switch.Set`, `Cover.GoToPosition` | Digest SHA-256 per i Gen2+ protetti da password. |
| **Webhook** | `GET/POST /api/webhook/<segreto>/<sensore>?state=open` | Per i sensori a batteria che dormono (Door/Window, H&T). |
| **Open-Meteo** | `api.open-meteo.com/v1/forecast` | Nessuna chiave. |

## 4. Automazioni

HA valuta *trigger → condizioni → azioni* (`homeassistant/components/automation`,
`helpers/script.py`, `helpers/condition.py`). Casa Clima implementa lo stesso modello e accetta la
stessa sintassi YAML (sia le chiavi vecchie `platform:`/`service:` sia le nuove `trigger:`/`action:`):

- trigger: `state` (con `from`, `to`, `for`, `attribute`), `numeric_state` (scatta all'*ingresso*
  nell'intervallo, come HA), `time` (con `weekday`), `time_pattern` (`/5`), `homeassistant` (avvio);
- condizioni: `state`, `numeric_state`, `time` (anche a cavallo della mezzanotte), `and`, `or`, `not`;
- azioni: servizi, `delay`, `condition`, `choose`, `if/then/else`, `stop`, `continue_on_error`;
- `mode: single | restart | parallel`.

Mancano i template Jinja: per la logica usa `choose`/condizioni.

## 5. Scene, pacchetti, recorder, logbook

| HA | Casa Clima |
|---|---|
| `scene:` con `entities:` (stato desiderato) | [`src/core/scenes.js`](../src/core/scenes.js): traduce lo stato desiderato nei servizi giusti |
| **Packages** (`homeassistant: packages: !include_dir_named`) | `data/packages/*.yaml`, uniti all'avvio e modificabili dall'interfaccia |
| **Recorder** (SQLite) | [`src/core/recorder.js`](../src/core/recorder.js): JSON compatto, al massimo un punto al minuto per entità, conservazione configurabile |
| **Logbook** | `Hub.addLog()`, ultimi 500 eventi |
| `persistent_notification`, `notify` | servizi `notify.notify` e `persistent_notification.create` |

## 6. API e interfaccia

HA espone una REST API e una WebSocket API (`subscribe_events`). Casa Clima espone:

- REST: `GET /api/states`, `GET /api/states/<id>`, `POST /api/services/<dominio>/<servizio>`,
  `GET /api/history`, `GET /api/logbook`, `/api/integrations`, `/api/packages`, `/api/casa-clima`;
- tempo reale: **Server-Sent Events** su `/api/stream` (più semplice di WebSocket, nessuna libreria,
  riconnessione automatica del browser); gli aggiornamenti di stato sono raggruppati ogni 200 ms;
- autenticazione: password con hash scrypt, cookie di sessione `HttpOnly`, token a lunga durata
  per script (`Authorization: Bearer …`, come i "long-lived access token" di HA).

L'interfaccia (cartella `web/`) è JavaScript moderno senza passaggi di compilazione: si ridisegna
quando arrivano eventi, con aggiornamenti "ottimistici" per i comandi (il valore cambia subito e
viene confermato dallo stato reale).

## 7. Cosa aggiunge Casa-Clima rispetto a HA

Il motore [`src/core/casaclima.js`](../src/core/casaclima.js) è la parte nuova: coordina apparecchi di
marche diverse nella stessa stanza.

- **Stanze automatiche** dalla stanza assegnata alle entità.
- **Profili** per tutta la casa, con temperature separate per caldo e freddo.
- **Stagione** automatica dalla temperatura media prevista (con isteresi).
- **Ruoli**: d'inverno scaldano i termostati/teste termostatiche (tado°, Netatmo) se presenti, e il
  climatizzatore della stessa stanza resta spento; d'estate raffrescano i climatizzatori.
- **Finestre**: pausa dopo N secondi di finestra aperta (sensori Shelly, webhook o il rilevamento di
  tado°/Netatmo), ripristino alla chiusura.
- **Comandi idempotenti**: un comando parte solo se lo stato è diverso, per non consumare il
  limite di richieste di tado° e Daikin.
