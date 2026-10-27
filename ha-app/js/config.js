/*
 * Configurazione di HA Monitor.
 *
 * Puoi lasciare tutto com'è e inserire i dati dalla schermata Impostazioni
 * sulla TV (tasto ROSSO del telecomando), oppure compilare qui i valori
 * prima di creare il pacchetto .ipk, così sulla TV non dovrai digitare nulla.
 *
 * I valori salvati dalla schermata Impostazioni hanno la precedenza su questi.
 */
window.HA_MONITOR_CONFIG = {
  // Indirizzo di Home Assistant nella rete di casa. Meglio l'indirizzo IP:
  // molte TV non risolvono i nomi ".local". Esempio: 'http://192.168.1.10:8123'
  url: '',

  // Dashboard da mostrare, nell'ordine (la prima è quella principale).
  // Si cambia con le frecce ◀ ▶ o con i tasti CH+ / CH−.
  // Esempio: ['/lovelace/0', '/dashboard-tv/camere', '/energy']
  dashboards: ['/lovelace/0'],

  // 'frame'  = Integrata (consigliata): Home Assistant è mostrato dentro l'app,
  //            che gestisce telecomando, riconnessione, rotazione e comandi da
  //            Home Assistant. Richiede "use_x_frame_options: false" (vedi guida).
  // 'direct' = Diretta: l'app apre direttamente la pagina di Home Assistant.
  //            Non serve cambiare la configurazione di HA, ma il telecomando
  //            controlla solo la pagina (per uscire: tasto Home).
  mode: 'frame',

  // Aggiunge "?kiosk" agli indirizzi: con il plugin kiosk-mode (HACS)
  // nasconde la barra in alto e il menu laterale di Home Assistant.
  kiosk: false,

  // Ingrandimento della dashboard per vederla bene dal divano: 1, 1.25 o 1.5
  zoom: 1,

  // Secondi tra un cambio dashboard e l'altro in rotazione automatica (0 = no)
  rotateInterval: 0,

  // Ricarica completamente la pagina ogni N ore (0 = mai). Utile se la TV
  // resta accesa per giorni: evita rallentamenti del browser della TV.
  reloadHours: 6,

  // Oscura lo schermo di notte. 'off' oppure 'INIZIO-FINE' in ore, es. '23-7'
  nightDim: 'off',

  // Sposta la pagina di pochi pixel ogni tanto per ridurre il rischio di
  // stampaggio (burn-in) sulle TV OLED con immagini fisse.
  oledShift: true
};
