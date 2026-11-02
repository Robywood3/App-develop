# Casa Clima

Il tuo hub domotico personale, costruito sull'architettura di Home Assistant e scritto da zero in
Node.js. Controlla da un'unica dashboard **Tesla, Daikin, Netatmo, tado°, Shelly** e il meteo. Il
pacchetto **Casa-Clima** coordina riscaldamento e raffrescamento di tutta la casa.

- **Dashboard** web in tempo reale, per computer e telefono (installabile come app), tema chiaro/scuro
- **Casa-Clima**: profili (Comfort, Eco, Notte, Fuori casa, Programma, Spento), stagione automatica,
  stanze automatiche, pausa del clima con la finestra aperta, regolazione della singola stanza
- **Termostati a quadrante** da trascinare, modalità, ventola
- **Tesla**: batteria, autonomia, ricarica, limite e corrente, clima dell'abitacolo, portiere, sbrinamento
- **Dispositivi**: luci, prese, tapparelle, sensori, con ricerca e filtri
- **Storico**: temperature per stanza, umidità, tempo di funzionamento, energia e fotovoltaico
- **Automazioni e scene** in YAML compatibile con Home Assistant, modificabili dal browser
- **API REST** + token per script (Comandi rapidi iPhone, Tasker…)
- Una sola dipendenza (`yaml`), nessun database: gira su Raspberry Pi, NAS o mini-PC

Al primo avvio è attiva una **casa demo** simulata, così puoi provare subito tutto senza credenziali.

**Demo senza installare niente:** apri [`demo/index.html`](demo/index.html) nel browser (doppio clic sul file
scaricato). È la stessa dashboard, con il motore Casa-Clima e la casa simulata che girano nel browser.
Per rigenerarla dopo una modifica: `npm run demo`.

> Come è fatto e come corrisponde a Home Assistant: [docs/ARCHITETTURA.md](docs/ARCHITETTURA.md)

---

## 1. Installazione

Casa Clima va lasciato sempre acceso su un computer della rete di casa: un Raspberry Pi, un NAS
(Synology/QNAP con Docker) o un mini-PC. Ti serve **Node.js 20 o più recente**, oppure Docker.

### Con Node.js

```bash
cd casa-clima
npm install
npm start
```

Apri `http://INDIRIZZO-DEL-COMPUTER:8124` dal telefono o dal PC. Al primo accesso scegli una password.

### Con Docker

```bash
cd casa-clima
docker compose up -d
```

I dati restano nella cartella `casa-clima/data`.

### Avvio automatico su Raspberry Pi / Linux (systemd)

```bash
sudo cp casa-clima.service /etc/systemd/system/
sudo nano /etc/systemd/system/casa-clima.service   # controlla User e WorkingDirectory
sudo systemctl enable --now casa-clima
```

### Variabili d'ambiente

| Variabile | Predefinito | |
|---|---|---|
| `PORT` | `8124` | porta HTTP |
| `HOST` | `0.0.0.0` | indirizzo di ascolto |
| `CASA_CLIMA_DATA` | `./data` | cartella dati (configurazione, token, storico, pacchetti) |
| `CASA_CLIMA_PASSWORD` | – | password iniziale, se non vuoi impostarla dal browser |
| `PUBLIC_URL` | `http://IP-LOCALE:8124` | indirizzo usato per il ritorno dei login e per i webhook |

> **Sicurezza.** `data/config.json` e `data/auth.json` contengono token e credenziali: il file viene
> creato leggibile solo dal proprietario. Non esporre la porta su Internet. Per l'accesso da fuori casa
> usa una VPN (WireGuard, Tailscale) oppure un reverse proxy HTTPS.

---

## 2. Collegare i tuoi apparecchi

Apri **Integrazioni → Aggiungi**. Ogni modulo spiega cosa inserire. Dopo aver collegato gli apparecchi
veri, **disattiva "Casa demo"**.

### Tesla
- **Teslemetry** (consigliato): crea un account su [teslemetry.com](https://teslemetry.com), collega
  l'auto, copia il token e incollalo. I comandi funzionano anche sulle auto recenti, che richiedono i
  comandi firmati.
- **Fleet API diretta** (gratis fino al credito mensile Tesla): registra un'app su
  [developer.tesla.com](https://developer.tesla.com) con il Redirect URI mostrato nel modulo, inserisci
  Client ID e secret e premi **Accedi**. Per inviare comandi alle auto recenti avvia il
  [vehicle-command proxy](https://github.com/teslamotors/vehicle-command) e indicane l'indirizzo.
- Per non scaricare la batteria Casa Clima **non sveglia l'auto** per leggere i dati: li legge quando è
  già sveglia (ogni 10 minuti di default) e la sveglia solo quando invii un comando.

### Daikin
- **Rete locale** (adattatori BRP069A/BRP069B, app "Daikin Online Controller"): scrivi gli IP, uno per
  riga, eventualmente con la stanza: `192.168.1.40 | Soggiorno`.
- **Onecta** (app Daikin Onecta, adattatori recenti e pompe di calore Altherma): crea un'app su
  [developer.cloud.daikineurope.com](https://developer.cloud.daikineurope.com) con lo stesso account,
  copia Client ID e Secret e premi **Accedi**. Daikin accetta solo Redirect URI `https`. Se Casa Clima
  non ha un indirizzo https, registra ad esempio `https://localhost/callback`, indicalo nel campo
  *Redirect URI*. Dopo il login il browser mostrerà un errore: copia l'indirizzo dalla barra e incollalo
  nella finestra di Casa Clima. Limite Daikin: 200 richieste al giorno, quindi l'aggiornamento è ogni 10 minuti.

### Netatmo
Crea un'app su [dev.netatmo.com/apps](https://dev.netatmo.com/apps). Hai due strade:
- premi **Accedi**, dopo aver registrato il Redirect URI;
- oppure, dalla pagina dell'app, genera un token con gli scope `read_thermostat write_thermostat read_station`
  e incolla il **refresh token**.

Funziona con termostato e valvole (Energy) e con la stazione meteo.

### tado°
Salva l'integrazione e premi **Accedi**: compare un codice e si apre la pagina tado dove confermarlo.
Senza abbonamento tado consente circa 100 richieste al giorno, quindi l'aggiornamento è ogni 20 minuti.

### Shelly
Scrivi gli IP (Gen1, Plus, Pro, Gen3, Gen4), uno per riga: `192.168.1.20 | Cucina`. Se hai protetto i
dispositivi con password, inserisci utente e password. Conviene assegnare un IP fisso dal router.

Gli **Shelly a batteria** (Door/Window, H&T) dormono e non si possono interrogare. Usa l'integrazione
**Sensori push (webhook)**:
1. aggiungi una riga per sensore, ad esempio `Finestra soggiorno | window | Soggiorno`;
2. premi **Indirizzi** e copia gli URL nelle *Azioni* del dispositivo:
   - Shelly Door/Window, azione *Aperta*: `…/finestra_soggiorno?state=open`;
   - azione *Chiusa*: `…?state=close`;
   - Shelly H&T: `…?temp=${temperatura}&hum=${umidità}` (Gen1 aggiunge da solo `hum`/`temp`).

### Meteo
Aggiungi **Meteo (Open-Meteo)** con latitudine e longitudine di casa. È gratuito e senza registrazione.
Migliora la scelta automatica della stagione e mostra le previsioni.

---

## 3. Il pacchetto Casa-Clima

### Stanze
Le stanze nascono da sole raggruppando i dispositivi con la stessa **stanza**: il termostato tado°
"Soggiorno", il Daikin "Soggiorno", la finestra "Soggiorno". Per correggere le assegnazioni usa
**Impostazioni → Stanze**, oppure apri un dispositivo e cambia la stanza.

### Profili e stagione
Dalla pagina **Casa** scegli il profilo: la temperatura viene applicata a tutte le stanze.
- **Riscaldamento**: lavorano i termostati e le teste termostatiche (tado°, Netatmo). Se in una stanza
  non ce ne sono, lavora la pompa di calore (Daikin). Il climatizzatore della stessa stanza resta spento.
- **Raffrescamento**: lavorano i climatizzatori.
- **Auto**: la stagione si sceglie dalla temperatura media prevista per oggi. Sotto 16 °C è
  riscaldamento, sopra 23 °C è raffrescamento; tra le due soglie la stagione non cambia.
- **Programma**: i termostati tornano al loro programma (tado°/Netatmo).

I comandi partono solo se servono, per non consumare il limite di richieste dei servizi cloud.

### Finestre
Se una finestra della stanza resta aperta per 60 secondi, il clima della stanza va in pausa. Alla
chiusura riparte. Contano i sensori Shelly/webhook e il rilevamento "finestra aperta" di tado°/Netatmo.

### Personalizzare: `data/packages/casa-clima.yaml`
Puoi modificarlo da **Impostazioni → Pacchetti**. Lì cambi:
- le temperature dei profili, le soglie della stagione e i tempi delle finestre;
- le stanze definite a mano, per decidere chi scalda e chi raffresca e per gli offset;
- le **automazioni**. Quelle già pronte:
  - Comfort la mattina, Notte alle 23;
  - avviso di umidità alta;
  - precondizionamento della Tesla, inizialmente disattivato;
  - uso dell'eccedenza del fotovoltaico, inizialmente disattivato;
- le **scene**.

La sintassi è quella di Home Assistant (senza template), quindi puoi riusare le tue automazioni HA
cambiando solo gli `entity_id`. Gli ID li trovi aprendo un dispositivo (*Attributi e impostazioni*).

```yaml
automations:
  - id: precondiziona_tesla
    alias: Tesla calda alle 7:40
    trigger:
      - trigger: time
        at: "07:25"
        weekday: [mon, tue, wed, thu, fri]
    condition:
      - condition: numeric_state
        entity_id: sensor.tesla_model_y_batteria
        above: 25
    action:
      - action: climate.set_temperature
        target: { entity_id: climate.tesla_model_y_clima }
        data: { temperature: 21, hvac_mode: heat_cool }
```

Servizi Casa-Clima: `casa_clima.set_profile` (`profile`), `casa_clima.set_season` (`season`:
auto/heat/cool/off), `casa_clima.set_room_temperature` (`room`, `temperature`), `casa_clima.reset_room`,
`casa_clima.apply`.

---

## 4. API

```bash
# crea un token in Impostazioni → Sicurezza
curl -H "Authorization: Bearer cc_…" http://casa:8124/api/states
curl -H "Authorization: Bearer cc_…" -H "Content-Type: application/json" \
     -d '{"profile":"fuori"}' http://casa:8124/api/services/casa_clima/set_profile
```

| Metodo | Percorso | |
|---|---|---|
| GET | `/api/states`, `/api/states/<entity_id>` | stati |
| POST | `/api/services/<dominio>/<servizio>` | comandi (`{"entity_id": …, …}`) |
| GET | `/api/casa-clima` | stanze, profilo, stagione, avvisi, energia |
| GET | `/api/history?entity_id=a,b&hours=24` | storico |
| GET | `/api/stream` | eventi in tempo reale (Server-Sent Events) |

---

## 5. Sviluppo

```bash
npm run dev     # riavvio automatico alle modifiche
npm test        # test automatici
```

```
src/
  index.js               avvio
  core/hub.js            state machine, event bus, servizi, registri
  core/automation.js     motore delle automazioni (sintassi HA)
  core/casaclima.js      motore Casa-Clima (stanze, profili, stagione, finestre)
  core/scenes.js         scene
  core/recorder.js       storico
  core/packages.js       pacchetti YAML
  core/http.js, oauth.js client HTTP (Digest), token OAuth2
  integrations/          tesla, daikin, daikin_onecta, netatmo, tado, shelly, webhook, openmeteo, demo
  server/                HTTP, SSE, autenticazione
web/                     dashboard (nessuna compilazione)
config/packages/         pacchetto Casa-Clima predefinito
```

**Aggiungere un'integrazione.** Crea `src/integrations/miaintegrazione.js` con una classe che estende
`Integration`:
- `static meta` contiene i campi del modulo;
- `setup()` registra dispositivi ed entità con `this.device()` e `this.entity()`;
- `update()` pubblica gli stati con `this.set()`;
- `handleService()` esegue i comandi.

Poi aggiungila in `src/integrations/index.js`.

Le API dei produttori possono cambiare: Tesla, tado° e Daikin lo hanno fatto spesso. Le integrazioni
cloud sono state scritte sulla documentazione pubblica e non sono state provate su account reali. Se
qualcosa smette di funzionare, il messaggio d'errore compare nella scheda dell'integrazione.
