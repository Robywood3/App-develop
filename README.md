# EZVIZ TV — le tue telecamere EZVIZ sulla TV LG

App per **TV LG webOS** che mostra le telecamere del tuo account EZVIZ, comandata dal telecomando.

- Griglia con l'anteprima di tutte le telecamere, aggiornata in automatico
- Video dal vivo a schermo intero (HD o Fluido), con cambio telecamera tramite frecce o tasti CH
- **Sequenza**: scorre da sola le telecamere a schermo intero (ad esempio ogni 20 secondi)
- **Brandeggio (PTZ)** per le telecamere motorizzate (C6N, C8C, H6…)
- Supporto alle telecamere con crittografia video (tramite codice di verifica)
- Telecamere extra con un indirizzo HLS locale (go2rtc/Frigate), opzionale
- Funziona anche con il puntatore del Magic Remote

L'app usa le API ufficiali di **EZVIZ Open Platform**: il video arriva dal cloud EZVIZ come HLS, lo stesso
percorso dell'app EZVIZ sul telefono. Non serve un server in casa.

---

## 1. Ottieni AppKey e AppSecret da EZVIZ (5 minuti, gratis)

1. Vai su **https://open.ezvizlife.com** e accedi con **lo stesso account** che usi nell'app EZVIZ.
2. Accetta i termini da sviluppatore, poi apri **Developer → My Application** (o "Application Management")
   e crea un'applicazione con un nome qualsiasi.
3. Copia **AppKey** e **AppSecret**.

> Se hai la **crittografia video** attiva (predefinita su molte telecamere), hai due possibilità:
> - disattivala nell'app EZVIZ: telecamera → ⚙️ Impostazioni → *Crittografia video/immagine*; oppure
> - inserisci nelle impostazioni dell'app il **codice di verifica** (6 lettere maiuscole sull'etichetta
>   della telecamera) nel formato `SERIALE:CODICE`, ad esempio `BD1234567:ABCDEF`.

## 2. Installa l'app sulla TV

Le app non pubblicate sul LG Content Store si installano con la **Modalità sviluppatore** (gratuita).

### 2a. Prepara la TV (una volta)

1. Crea un account su **https://webostv.developer.lge.com** (Accedi → Crea account).
2. Sulla TV apri il **LG Content Store**, cerca e installa l'app **Developer Mode**.
3. Apri *Developer Mode*, accedi con l'account appena creato e attiva **Dev Mode Status**. La TV si riavvia.
4. Riapri *Developer Mode*, attiva **Key Server** e annota **l'indirizzo IP** e la **Passphrase** mostrati.

### 2b. Crea e installa il pacchetto (dal PC, nella stessa rete della TV)

Serve [Node.js](https://nodejs.org) 18 o più recente.

```bash
git clone <questo repository> ezviz-tv && cd ezviz-tv
npm install

# Registra la TV (una volta): nome "tv", IP della TV, porta 9922, utente "prisoner"
npx ares-setup-device -a tv -i "host=192.168.1.50" -i "port=9922" -i "username=prisoner"
# Scarica la chiave dalla TV: quando richiesta, inserisci la Passphrase mostrata da Developer Mode
npx ares-novacom --device tv --getkey

# Crea il pacchetto, installalo e avvialo
npm run deploy
```

L'app **EZVIZ TV** comparirà tra le app della TV.

> **Senza installare nulla per creare il pacchetto:** a ogni push GitHub Actions crea il file `.ipk`
> (scheda *Actions* → ultima esecuzione → *Artifacts* → `ezviz-tv-ipk`). Per installarlo servono comunque
> i comandi `ares-setup-device`/`ares-novacom` qui sopra, poi:
> `npx ares-install -d tv com.robywood.ezviztv_1.0.0_all.ipk`.

> **Attenzione:** la sessione della Modalità sviluppatore dura **50 ore**. Apri ogni tanto l'app
> *Developer Mode* sulla TV e premi **Extend** (proroga). Se scade, le app installate in modalità
> sviluppatore vengono rimosse e dovrai ripetere `npm run deploy`.

### 2c. Inserisci le credenziali

Al primo avvio si apre la schermata **Impostazioni**: scegli la regione (*Europa / Internazionale* per gli
account italiani), inserisci AppKey e AppSecret e premi **Salva e connetti**.

Per non digitarle con il telecomando, puoi scriverle prima di creare il pacchetto in
[`app/js/config.js`](app/js/config.js) (`appKey`, `appSecret`, `verificationCodes`, …), poi `npm run deploy`.
Non pubblicare il file con le credenziali in un repository pubblico.

## 3. Uso con il telecomando

| Schermata      | Tasto                    | Azione                                       |
|----------------|--------------------------|----------------------------------------------|
| Griglia        | Frecce                   | Seleziona telecamera                         |
|                | OK                       | Apri a schermo intero                        |
|                | 1–9                      | Apri direttamente la telecamera numero N     |
|                | 🔴 Rosso                 | Impostazioni                                 |
|                | 🟢 Verde                 | Avvia la Sequenza                            |
|                | 🔵 Blu                   | Ricarica telecamere e anteprime              |
|                | Indietro (2 volte)       | Esci dall'app                                |
| Schermo intero | ◀ ▶ oppure CH+ / CH−     | Telecamera precedente / successiva           |
|                | OK                       | Mostra/nasconde le informazioni (o riprova)  |
|                | 🟡 Giallo                | Brandeggio: tieni premute le frecce per muovere la telecamera |
|                | 🔵 Blu                   | Alterna qualità HD / Fluido                  |
|                | 🟢 Verde                 | Avvia / ferma la Sequenza                    |
|                | Indietro                 | Torna alla griglia                           |

## 4. Telecamere in rete locale (opzionale, avanzato)

Il flusso dal cloud EZVIZ ha qualche secondo di ritardo. Se hai un mini‑PC, un NAS o un Raspberry sempre
acceso, puoi convertire il flusso **RTSP** locale delle telecamere in HLS con
[go2rtc](https://github.com/AlexxIT/go2rtc) e aggiungerlo all'app.

1. Nell'app EZVIZ abilita, se presente, l'accesso RTSP/LAN della telecamera.
2. Configura go2rtc (`go2rtc.yaml`):
   ```yaml
   streams:
     garage: rtsp://admin:CODICE_VERIFICA@192.168.1.60:554/H.264
   ```
3. In `app/js/config.js`:
   ```js
   customCameras: [
     { name: 'Garage (locale)', url: 'http://192.168.1.10:1984/api/stream.m3u8?src=garage' }
   ]
   ```

## 5. Problemi comuni

| Messaggio / sintomo | Soluzione |
|---|---|
| *AppKey e AppSecret non corrispondono* / *AppKey non trovata* | Ricontrolla i valori e la **regione** nelle Impostazioni. |
| *Nessuna telecamera trovata* | L'applicazione Open Platform deve essere creata con lo **stesso account** dell'app EZVIZ. Le telecamere *condivise* da un altro account potrebbero non comparire. |
| *Video crittografato* | Disattiva la crittografia o inserisci `SERIALE:CODICE` nelle Impostazioni. |
| Video nero o *La telecamera non invia video* | Prova la qualità **Fluido** (tasto blu). Le telecamere a batteria possono impiegare qualche secondo a svegliarsi. Su TV più vecchie i flussi H.265 potrebbero non essere supportati: se la telecamera lo permette, imposta la codifica H.264 nell'app EZVIZ. |
| La griglia con video dal vivo resta nera | Molte TV decodificano solo 1–2 video insieme: imposta *Griglia con video dal vivo = No*. |

Il piano gratuito di EZVIZ Open Platform ha dei limiti giornalieri di richieste: per questo le anteprime
si aggiornano ogni minuto (modificabile) e non vengono aggiornate mentre guardi una telecamera.

## Sviluppo

```
app/
  appinfo.json     manifest webOS
  index.html
  css/style.css
  js/config.js     configurazione predefinita (modificabile)
  js/ezviz.js      client API EZVIZ Open Platform
  js/player.js     lettore HLS (nativo della TV, oppure hls.js)
  js/app.js        interfaccia e gestione del telecomando
  lib/hls.min.js   hls.js 1.6.15 (licenza Apache 2.0, vedi lib/hls.LICENSE)
tools/make-icons.py  rigenera icon.png e largeIcon.png
```

- Il codice è in ES5 senza dipendenze di build, per funzionare anche su webOS 3.x (TV dal 2016).
- Per provarlo su PC apri `app/index.html` in Chrome: tasti **R G Y B** = tasti colorati, **Esc** = Indietro.
  Il browser potrebbe bloccare le chiamate alle API EZVIZ per CORS (sulla TV non succede): in quel caso
  avvia un Chrome di prova con `--disable-web-security --user-data-dir=/tmp/chrome-test`.
- Debug sulla TV: `npm run inspect` apre i DevTools remoti.
