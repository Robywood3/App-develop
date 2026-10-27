# HA Monitor — la TV LG come monitor di Home Assistant

**HA Monitor** è una seconda app per **TV LG webOS**, in questo stesso repository (cartella [`ha-app/`](ha-app)).
Mostra a tutto schermo le dashboard di Home Assistant e trasforma la TV in un pannello di controllo
sempre pronto:

- Dashboard a tutto schermo, una o più, da cambiare con le frecce ◀ ▶ o con CH+ / CH−
- **Rotazione automatica** tra le dashboard (ad esempio ogni minuto)
- **Riconnessione automatica**: se Home Assistant si riavvia o la TV si accende prima del server,
  l'app aspetta e ricarica la dashboard da sola
- **Comandata da Home Assistant**: un'automazione può accendere la TV e aprire una dashboard precisa,
  ad esempio le telecamere quando suona il campanello, e tornare a quella principale dopo un minuto
- Blocca il **salvaschermo** della TV mentre è aperta
- **Ingrandimento** (125%, 150%) per leggere bene dal divano
- **Oscuramento notturno** e **protezione OLED** (sposta l'immagine di pochi pixel ogni 3 minuti)
- Funziona con il telecomando normale e con il puntatore del Magic Remote

Per installarla serve la stessa **Modalità sviluppatore** dell'app EZVIZ TV: vedi il
[README](README.md#2-installa-lapp-sulla-tv), punto 2a.

---

## 1. Prepara Home Assistant

### 1a. Permetti di mostrare Home Assistant dentro l'app (modalità Integrata)

Home Assistant per sicurezza non si lascia mostrare dentro altre pagine. Per la modalità **Integrata**
(consigliata) aggiungi in `configuration.yaml`:

```yaml
http:
  use_x_frame_options: false
```

e riavvia Home Assistant. Se la TV mostra una pagina di errore ("rifiuta la connessione") al posto
della dashboard, manca questa riga.

> Questa opzione protegge da siti malevoli che inseriscono la tua pagina di Home Assistant dentro la loro
> per farti cliccare qualcosa. In una rete di casa il rischio è minimo; se Home Assistant è raggiungibile
> da Internet valuta tu. In alternativa usa la modalità **Diretta** (vedi sotto), che non richiede la modifica.

### 1b. Accesso automatico senza password (consigliato)

Digitare utente e password con il telecomando è scomodo e, se il login scade, la TV resta sulla
pagina di accesso. Meglio creare un utente dedicato alla TV e farla entrare in automatico:

1. **Impostazioni → Persone → Utenti → Aggiungi utente**: ad esempio `TV salotto`, **senza** diritti di
   amministratore. Apri l'utente appena creato e copia il suo **ID** (in modalità avanzata).
2. Assegna alla TV un **indirizzo IP fisso** dal router (es. `192.168.1.50`).
3. In `configuration.yaml`:

```yaml
homeassistant:
  auth_providers:
    - type: trusted_networks
      trusted_networks:
        - 192.168.1.50/32        # IP della TV
      trusted_users:
        192.168.1.50/32: 0123456789abcdef0123456789abcdef   # ID dell'utente "TV salotto"
      allow_bypass_login: true
    - type: homeassistant      # lascia il login normale per tutti gli altri
```

Riavvia Home Assistant. Dalla TV si entrerà direttamente come "TV salotto".

### 1c. Una dashboard pensata per la TV (facoltativo)

- Crea una dashboard apposta (**Impostazioni → Dashboard → Aggiungi**), ad esempio con indirizzo
  `dashboard-tv`, con viste ampie: la TV mostra 1920×1080 punti.
- Per nascondere barra in alto e menu laterale installa da HACS il plugin
  [kiosk-mode](https://github.com/NemesisRE/kiosk-mode) e attiva nelle impostazioni dell'app
  *Nascondi barra e menu = Sì*: l'app aggiunge `?kiosk` agli indirizzi.
- Le schede delle telecamere (anche EZVIZ tramite l'integrazione di Home Assistant) funzionano dentro la
  dashboard. Molte TV decodificano solo 1–2 video insieme: meglio poche telecamere dal vivo per vista.

## 2. Installa l'app sulla TV

Con la TV già registrata come `tv` (README, punto 2b):

```bash
npm install
npm run deploy:ha
```

Senza installare nulla per creare il pacchetto: a ogni push GitHub Actions crea anche
`ha-monitor-ipk` (scheda *Actions* → ultima esecuzione → *Artifacts*), da installare con
`npx ares-install -d tv com.robywood.hamonitor_1.0.0_all.ipk`.

Al primo avvio si apre la schermata **Impostazioni**:

| Impostazione | Cosa inserire |
|---|---|
| Indirizzo di Home Assistant | es. `http://192.168.1.10:8123` — usa l'**IP**, i nomi `.local` spesso non funzionano sulla TV. Se scrivi solo `192.168.1.10` l'app aggiunge `http://` e `:8123`. |
| Dashboard da mostrare | percorsi separati da virgola, es. `/lovelace/0, /dashboard-tv/camere, /energy`. Il percorso è quello che vedi nella barra del browser dopo `:8123`. |
| Modalità | **Integrata** (consigliata, richiede il punto 1a) oppure **Diretta** |
| Nascondi barra e menu | Sì solo se hai installato kiosk-mode |
| Ingrandimento, rotazione, ricarica, notte, protezione OLED | a piacere |

Per non digitare con il telecomando puoi scrivere tutto prima in [`ha-app/js/config.js`](ha-app/js/config.js)
e poi `npm run deploy:ha`.

**Integrata o Diretta?**

| | Integrata | Diretta |
|---|---|---|
| Serve `use_x_frame_options: false` | sì | no |
| Cambio dashboard, rotazione, tasti colorati | sì | no (si usa solo la pagina di HA) |
| Riconnessione automatica | sì | solo all'avvio |
| Comandi da Home Assistant mentre l'app è aperta | sì | no |
| Uscire dall'app | INDIETRO due volte | tasto **Home** |

## 3. Uso con il telecomando (modalità Integrata)

| Tasto | Azione |
|---|---|
| ◀ ▶ oppure CH− / CH+ | Dashboard precedente / successiva |
| 1–9 | Vai alla dashboard numero N |
| OK, ▲ ▼ | Mostra/nasconde la barra informativa |
| 🟢 Verde | Avvia / ferma la rotazione automatica |
| 🟡 Giallo | Passa il telecomando alla pagina di Home Assistant (frecce per scorrere). Dopo 45 secondi il controllo torna all'app |
| 🔵 Blu | Ricarica la dashboard |
| 🔴 Rosso | Impostazioni |
| Indietro | Torna alla prima dashboard; dalla prima, due volte per uscire |

Con il **Magic Remote** punta e clicca direttamente su interruttori e schede della dashboard; la rotellina
scorre la pagina. Dopo un clic sulla dashboard i tasti del telecomando vanno alla pagina per 45 secondi,
poi tornano all'app.

Di notte (se l'oscuramento è attivo) il primo tasto premuto riaccende lo schermo per un minuto.

## 4. Automazioni: Home Assistant comanda la TV

Installa l'integrazione **LG webOS TV** (Impostazioni → Dispositivi e servizi → Aggiungi → *LG webOS TV*)
e accetta la richiesta che compare sulla TV. Negli esempi l'entità si chiama `media_player.tv_salotto`.

### 4a. Accendere la TV da Home Assistant

La TV non si accende da sola via rete: Home Assistant invia un pacchetto *Wake-on-LAN*.

1. Sulla TV: **Impostazioni → Generali → Dispositivi → TV / Connessione** e attiva
   **Accendi tramite Wi‑Fi** (o *LG Connect Apps* / *Accensione via rete mobile*, a seconda del modello).
   Meglio collegare la TV via cavo.
2. In `configuration.yaml` aggiungi `wake_on_lan:` e riavvia.
3. Automazione (sostituisci il MAC con quello della TV, in *Impostazioni → Generali → Informazioni TV*):

```yaml
automation:
  - alias: "TV salotto: accendi via rete"
    triggers:
      - trigger: webostv.turn_on
        entity_id: media_player.tv_salotto
    actions:
      - action: wake_on_lan.send_magic_packet
        data:
          mac: "aa:bb:cc:dd:ee:ff"
```

Da ora `media_player.turn_on` accende la TV.

### 4b. Aprire HA Monitor

Il modo più semplice: HA Monitor compare tra le sorgenti della TV.

```yaml
action: media_player.select_source
target:
  entity_id: media_player.tv_salotto
data:
  source: HA Monitor
```

Per aprire una dashboard precisa, eventualmente per un tempo limitato, usa `webostv.command` con dei
parametri (funziona anche se l'app è già aperta):

```yaml
action: webostv.command
target:
  entity_id: media_player.tv_salotto
data:
  command: system.launcher/launch
  payload:
    id: com.robywood.hamonitor
    params:
      path: /dashboard-tv/camere   # qualsiasi pagina di Home Assistant
      duration: 60                 # facoltativo: dopo 60 s torna alla dashboard principale
```

Parametri accettati in `params`:

| Parametro | Esempio | Effetto |
|---|---|---|
| `path` | `/dashboard-tv/camere` | mostra quella pagina |
| `dashboard` | `2` | mostra la seconda dashboard della lista |
| `duration` | `60` | dopo N secondi torna alla dashboard che era aperta |

### 4c. Esempio completo: suona il campanello → telecamere sulla TV

```yaml
automation:
  - alias: "Campanello: mostra le telecamere sulla TV"
    triggers:
      - trigger: state
        entity_id: binary_sensor.campanello
        to: "on"
    actions:
      - action: media_player.turn_on
        target:
          entity_id: media_player.tv_salotto
      - wait_template: "{{ not is_state('media_player.tv_salotto', 'off') }}"
        timeout: "00:00:30"
        continue_on_timeout: false
      - delay: "00:00:05"   # la TV appena accesa ha bisogno di qualche secondo
      - action: webostv.command
        target:
          entity_id: media_player.tv_salotto
        data:
          command: system.launcher/launch
          payload:
            id: com.robywood.hamonitor
            params:
              path: /dashboard-tv/camere
              duration: 90
```

### 4d. Aprire HA Monitor ogni volta che la TV si accende

Le TV LG non avviano da sole un'app all'accensione, ma Home Assistant può farlo:

```yaml
automation:
  - alias: "TV salotto: all'accensione apri HA Monitor"
    triggers:
      - trigger: state
        entity_id: media_player.tv_salotto
        from: "off"
    actions:
      - delay: "00:00:05"
      - action: media_player.select_source
        target:
          entity_id: media_player.tv_salotto
        data:
          source: HA Monitor
```

Lo stesso vale per l'app delle telecamere: `source: EZVIZ TV`.

### 4e. Risparmiare energia

Un monitor sempre acceso consuma (e sulle OLED si usura). Spegni la TV quando non serve, ad esempio
quando non c'è nessuno in casa o di notte, e riaccendila con 4c/4d:

```yaml
automation:
  - alias: "TV salotto: spegni quando la casa è vuota"
    triggers:
      - trigger: state
        entity_id: zone.home
        to: "0"
    actions:
      - action: media_player.turn_off
        target:
          entity_id: media_player.tv_salotto
```

### 4f. Tenere attiva la Modalità sviluppatore (da provare)

Le app installate in Modalità sviluppatore vengono rimosse quando la sessione scade (vedi README).
Il rinnovo che fa l'app *Developer Mode* (equivalente a `ares-launch com.palmdts.devmode -p extend=true`)
si può chiedere anche da Home Assistant, ad esempio ogni giorno:

```yaml
automation:
  - alias: "TV salotto: proroga Developer Mode"
    triggers:
      - trigger: time
        at: "04:00:00"
    conditions:
      - condition: not
        conditions:
          - condition: state
            entity_id: media_player.tv_salotto
            state: "off"
    actions:
      - action: webostv.command
        target:
          entity_id: media_player.tv_salotto
        data:
          command: system.launcher/launch
          payload:
            id: com.palmdts.devmode
            params:
              extend: true
```

Funziona solo se la TV è accesa a quell'ora. Controlla dopo qualche giorno nell'app *Developer Mode*
che il tempo rimasto si sia davvero ricaricato.

## 5. Impostazioni della TV consigliate

- **Spegnimento automatico**: molte TV LG si spengono dopo **4 ore senza usare il telecomando**.
  Disattivalo in *Impostazioni → Generali → Sistema → Timer / Risparmio energetico* (il nome cambia
  con il modello), oppure gestisci accensione e spegnimento con le automazioni del punto 4.
- **Salvaschermo**: l'app chiede alla TV di non attivarlo. Se compare comunque, su molti modelli si
  disattiva in *Impostazioni → Generali → OLED Care / Cura del dispositivo*.
- **TV OLED**: un'immagine fissa per molte ore può lasciare un segno. Tieni attiva la *Protezione OLED*,
  usa uno sfondo scuro, la rotazione tra dashboard e lo spegnimento quando non serve.

## 6. Problemi comuni

| Sintomo | Soluzione |
|---|---|
| *Home Assistant non raggiungibile* | Controlla l'indirizzo (con `http://` e la porta `:8123`) aprendolo dal browser del telefono. Usa l'IP invece di `homeassistant.local`. |
| Pagina di errore / "rifiuta la connessione" al posto della dashboard | Manca `use_x_frame_options: false` (punto 1a), oppure usa la modalità Diretta. |
| Ogni volta chiede utente e password | Configura l'accesso automatico (punto 1b) e verifica che l'IP della TV non cambi. |
| Indirizzo `https://` con certificato non valido | Usa l'indirizzo locale `http://IP:8123`. |
| I tasti non cambiano dashboard | Dopo un clic sulla pagina il telecomando la comanda per 45 secondi, poi torna all'app. |
| `select_source` non trova *HA Monitor* | Ricarica l'integrazione LG webOS TV dopo aver installato l'app. |
| La TV si spegne da sola dopo qualche ora | Vedi *Spegnimento automatico* al punto 5. |

## Sviluppo

```
ha-app/
  appinfo.json   manifest webOS (id com.robywood.hamonitor)
  index.html
  css/style.css
  js/config.js   configurazione predefinita (modificabile)
  js/tv.js       servizi webOS: parametri di avvio, salvaschermo, uscita
  js/app.js      interfaccia, dashboard, riconnessione, telecomando
```

- ES5 senza dipendenze, come l'app EZVIZ TV.
- Per provarla su PC apri `ha-app/index.html` in Chrome: **R G Y B** = tasti colorati, **Esc** = Indietro.
  I parametri di avvio si simulano nell'indirizzo: `index.html?path=/lovelace/0&duration=30`.
- Debug sulla TV: `npm run inspect:ha`.
