/*
 * Configurazione di EZVIZ TV.
 *
 * Puoi lasciare tutto vuoto e inserire i dati dalla schermata Impostazioni
 * sulla TV (tasto ROSSO del telecomando), oppure compilare qui i valori
 * prima di creare il pacchetto .ipk, così sulla TV non dovrai digitare nulla.
 *
 * I valori salvati dalla schermata Impostazioni hanno la precedenza su questi.
 */
window.EZVIZ_TV_CONFIG = {
  // 'eu' = EZVIZ internazionale/Europa (open.ezvizlife.com) — account creati in Italia
  // 'cn' = EZVIZ Cina (open.ys7.com)
  region: 'eu',

  // Credenziali dell'applicazione creata su https://open.ezvizlife.com
  // (Developer > My Application). Vedi README.md.
  appKey: '',
  appSecret: '',

  // In alternativa ad appKey/appSecret puoi incollare un accessToken
  // (dura 7 giorni, poi va rigenerato: meglio usare appKey/appSecret).
  accessToken: '',

  // Qualità del flusso live: 1 = HD, 2 = Fluido (meno banda)
  quality: 1,

  // Ogni quanti secondi aggiornare le anteprime nella griglia (0 = mai)
  snapshotInterval: 60,

  // Secondi di permanenza su ogni telecamera in modalità "Sequenza"
  tourInterval: 20,

  // true = la griglia riproduce tutti i video dal vivo contemporaneamente.
  // Molte TV LG decodificano 1-2 video alla volta: lascia false se la
  // griglia resta nera e usa le anteprime + schermo intero.
  liveGrid: false,

  // Codici di verifica per le telecamere con "Crittografia video" attiva.
  // Il codice (6 lettere maiuscole) è sull'etichetta della telecamera.
  // Esempio: { 'BD1234567': 'ABCDEF' }
  verificationCodes: {},

  // Numeri di serie delle telecamere da non mostrare. Esempio: ['BD1234567']
  hiddenCameras: [],

  // Telecamere aggiuntive con un indirizzo HLS (.m3u8) diretto, ad esempio
  // fornito da go2rtc/Frigate sulla rete di casa (vedi README.md).
  // Esempio: { name: 'Garage', url: 'http://192.168.1.10:1984/api/stream.m3u8?src=garage' }
  customCameras: []
};
