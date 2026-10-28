/*
 * FV+BESS Simulator – dati di base e valori di default.
 * Tutti i valori sono ipotesi di pre-fattibilità (classe AACE 4-5): vanno sostituiti
 * con dati di progetto (PVGIS/misure, curve di carico reali, offerte EPC) prima di decidere.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FVB_DATA = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Irraggiamento globale orizzontale medio mensile (kWh/m2/giorno) e temperatura media (°C).
  // Ordine di grandezza da atlante ENEA / UNI 10349 / PVGIS-SARAH; per il progetto usare PVGIS TMY del sito.
  const SITES = {
    milano:   { name: 'Milano (Lombardia)',   lat: 45.46, lon: 9.19,  zone: 'NORD',
      ghi: [1.35, 2.25, 3.55, 4.65, 5.65, 6.25, 6.45, 5.35, 3.95, 2.50, 1.45, 1.10],
      t:   [2.5, 4.5, 9.0, 13.0, 17.5, 21.5, 24.0, 23.5, 19.0, 13.5, 7.5, 3.0] },
    torino:   { name: 'Torino (Piemonte)',    lat: 45.07, lon: 7.69,  zone: 'NORD',
      ghi: [1.60, 2.45, 3.70, 4.60, 5.50, 6.10, 6.40, 5.30, 4.00, 2.60, 1.60, 1.30],
      t:   [2.0, 4.0, 8.5, 12.0, 16.5, 20.5, 23.0, 22.5, 18.5, 12.5, 7.0, 2.5] },
    venezia:  { name: 'Venezia (Veneto)',     lat: 45.44, lon: 12.32, zone: 'NORD',
      ghi: [1.50, 2.35, 3.65, 4.85, 5.95, 6.45, 6.65, 5.65, 4.20, 2.70, 1.60, 1.20],
      t:   [3.5, 5.0, 9.0, 13.0, 17.5, 21.5, 24.0, 23.5, 19.5, 14.5, 9.0, 4.5] },
    bologna:  { name: 'Bologna (Emilia-Romagna)', lat: 44.49, lon: 11.34, zone: 'NORD',
      ghi: [1.55, 2.45, 3.85, 4.95, 6.05, 6.65, 6.85, 5.85, 4.35, 2.80, 1.65, 1.25],
      t:   [3.0, 5.0, 9.5, 13.5, 18.0, 22.5, 25.0, 24.5, 20.0, 14.5, 8.5, 3.5] },
    firenze:  { name: 'Firenze (Toscana)',    lat: 43.77, lon: 11.25, zone: 'CNOR',
      ghi: [1.80, 2.65, 3.95, 5.05, 6.15, 6.75, 6.95, 6.05, 4.55, 3.00, 1.90, 1.50],
      t:   [6.0, 7.5, 10.5, 13.5, 18.0, 22.0, 25.0, 25.0, 21.0, 16.0, 10.5, 6.5] },
    ancona:   { name: 'Ancona (Marche)',      lat: 43.62, lon: 13.52, zone: 'CSUD',
      ghi: [1.75, 2.60, 3.90, 5.05, 6.15, 6.80, 7.00, 6.10, 4.55, 3.05, 1.90, 1.50],
      t:   [6.0, 7.0, 10.0, 13.5, 18.0, 22.0, 25.0, 25.0, 21.0, 16.5, 11.0, 7.0] },
    roma:     { name: 'Roma (Lazio)',         lat: 41.90, lon: 12.50, zone: 'CSUD',
      ghi: [2.10, 2.90, 4.20, 5.35, 6.40, 7.05, 7.25, 6.35, 4.85, 3.40, 2.20, 1.80],
      t:   [8.0, 9.0, 11.5, 14.5, 18.5, 22.5, 25.5, 25.5, 22.0, 17.5, 12.5, 9.0] },
    napoli:   { name: 'Napoli (Campania)',    lat: 40.85, lon: 14.27, zone: 'CSUD',
      ghi: [2.20, 3.00, 4.25, 5.40, 6.45, 7.05, 7.25, 6.35, 4.95, 3.50, 2.30, 1.90],
      t:   [9.0, 9.5, 12.0, 15.0, 19.0, 23.0, 26.0, 26.0, 23.0, 18.5, 14.0, 10.5] },
    bari:     { name: 'Bari (Puglia)',        lat: 41.12, lon: 16.87, zone: 'SUD',
      ghi: [2.20, 3.05, 4.35, 5.60, 6.65, 7.30, 7.45, 6.60, 5.00, 3.50, 2.30, 1.90],
      t:   [8.5, 9.0, 11.5, 14.5, 19.0, 23.5, 26.0, 26.0, 22.5, 18.0, 13.5, 10.0] },
    catania:  { name: 'Catania (Sicilia)',    lat: 37.50, lon: 15.09, zone: 'SICI',
      ghi: [2.70, 3.50, 4.80, 6.00, 7.00, 7.60, 7.70, 6.90, 5.40, 4.00, 2.90, 2.40],
      t:   [11.0, 11.5, 13.5, 16.0, 20.0, 24.5, 27.5, 28.0, 24.5, 20.5, 16.0, 12.5] },
    palermo:  { name: 'Palermo (Sicilia)',    lat: 38.12, lon: 13.36, zone: 'SICI',
      ghi: [2.60, 3.40, 4.60, 5.80, 6.80, 7.40, 7.50, 6.70, 5.20, 3.90, 2.80, 2.30],
      t:   [12.0, 12.0, 14.0, 16.0, 19.5, 23.5, 26.5, 27.0, 24.5, 20.5, 16.5, 13.5] },
    cagliari: { name: 'Cagliari (Sardegna)',  lat: 39.22, lon: 9.12,  zone: 'SARD',
      ghi: [2.50, 3.30, 4.60, 5.80, 6.80, 7.40, 7.60, 6.80, 5.20, 3.80, 2.70, 2.20],
      t:   [10.5, 11.0, 13.0, 15.0, 19.0, 23.0, 26.0, 26.5, 23.5, 19.5, 15.0, 11.5] }
  };

  // Fattore indicativo prezzo zonale / PUN (media annua) per stimare il ricavo del Ritiro Dedicato.
  const ZONE_FACTOR = { NORD: 1.00, CNOR: 0.99, CSUD: 0.98, SUD: 0.96, CALA: 0.97, SICI: 1.02, SARD: 0.98 };

  const MODULES = {
    topcon620: { name: 'TOPCon bifacciale 620 Wp (2382×1134 mm)', pmax: 620, voc: 48.9, vmp: 41.0, isc: 16.0, imp: 15.12,
      betaVoc: -0.25, betaVmp: -0.29, gammaP: -0.29, alphaIsc: 0.045, noct: 43, length: 2.382, width: 1.134, weight: 33.0, bifaciality: 0.80 },
    topcon440: { name: 'TOPCon 440 Wp (1722×1134 mm, coperture)', pmax: 440, voc: 39.3, vmp: 32.7, isc: 14.1, imp: 13.46,
      betaVoc: -0.25, betaVmp: -0.29, gammaP: -0.29, alphaIsc: 0.045, noct: 43, length: 1.722, width: 1.134, weight: 21.5, bifaciality: 0.0 },
    hjt720: { name: 'HJT bifacciale 720 Wp (2384×1303 mm)', pmax: 720, voc: 50.6, vmp: 42.4, isc: 17.9, imp: 16.98,
      betaVoc: -0.24, betaVmp: -0.26, gammaP: -0.24, alphaIsc: 0.04, noct: 42, length: 2.384, width: 1.303, weight: 38.5, bifaciality: 0.85 }
  };

  const INVERTERS = {
    str110: { name: 'Inverter di stringa 110 kW / 1100 V', pac: 110, vdcMax: 1100, mpptMin: 200, mpptMax: 1000, mpptFullMin: 550, mpptFullMax: 850,
      nMppt: 10, iMpptMax: 40, iscMpptMax: 60, stringsPerMppt: 2, vac: 400, eff: 0.984 },
    str350: { name: 'Inverter di stringa 350 kW / 1500 V', pac: 350, vdcMax: 1500, mpptMin: 500, mpptMax: 1500, mpptFullMin: 880, mpptFullMax: 1300,
      nMppt: 12, iMpptMax: 65, iscMpptMax: 115, stringsPerMppt: 3, vac: 800, eff: 0.988 },
    str50: { name: 'Inverter di stringa 50 kW / 1100 V', pac: 50, vdcMax: 1100, mpptMin: 180, mpptMax: 1000, mpptFullMin: 520, mpptFullMax: 850,
      nMppt: 4, iMpptMax: 40, iscMpptMax: 60, stringsPerMppt: 3, vac: 400, eff: 0.982 }
  };

  const BESS_UNITS = {
    container5: { name: 'Container 20 ft LFP ~5 MWh (DC block)', kwh: 5016, kw: 2508, footprint: 15.0, weight: 42000 },
    cabinet261: { name: 'Cabinet C&I LFP 261 kWh / 125 kW (AC block)', kwh: 261, kw: 125, footprint: 1.8, weight: 2900 }
  };

  // Profili orari del carico industriale (fattore relativo, 24 valori; feriale / sabato / domenica-festivi)
  const LOAD_PROFILES = {
    turno1: { name: '1 turno (8–17, lun–ven)', wd: [.18,.18,.18,.18,.18,.2,.3,.75,1,1,1,1,.8,1,1,1,.95,.5,.25,.2,.2,.18,.18,.18], sat: .25, sun: .18 },
    turno2: { name: '2 turni (6–22, lun–ven)', wd: [.22,.22,.22,.22,.22,.45,.95,1,1,1,1,1,.9,1,1,1,1,1,1,1,.95,.85,.4,.22], sat: .35, sun: .2 },
    turno3: { name: '3 turni (24/5, weekend ridotto)', wd: [.85,.85,.85,.85,.85,.9,.95,1,1,1,1,1,.95,1,1,1,1,1,.95,.95,.9,.9,.88,.86], sat: .6, sun: .3 },
    continuo: { name: 'Ciclo continuo (24/7)', wd: [.92,.9,.9,.9,.9,.92,.95,1,1,1,1,1,.98,1,1,1,1,1,.98,.97,.96,.95,.94,.93], sat: .95, sun: .92 }
  };

  // Festività nazionali (giorno dell'anno, anno non bisestile) – Pasquetta indicativa
  const HOLIDAYS = [1, 6, 110, 115, 121, 153, 227, 305, 342, 359, 360];

  const CO2_GRID = 0.250; // tCO2/MWh – fattore indicativo mix elettrico nazionale consumi (ISPRA), da aggiornare

  // Default di progetto (caso di riferimento: manifattura al Nord, 2 turni). Fonti: docs/allegati/A2_Benchmark_costi_2026.md
  const DEFAULTS = {
    project: { name: 'Impianto FV + BESS – stabilimento industriale', client: 'Cliente', site: 'milano', year: 2027, seed: 7 },
    load: { annualMWh: 9000, profile: 'turno2', augustShutdownWeeks: 2, christmasShutdown: true, seasonal: 0.08, custom: null },
    pv: { kwp: 3000, mount: 'ground_fixed', tilt: 25, azimuth: 0, gcr: 0.42, dcac: 1.20, module: 'topcon620', inverter: 'str350',
      albedo: 0.20, bifacial: true,
      losses: { soiling: 2.0, shading: 1.5, mismatch: 1.0, dcCable: 1.2, acCable: 0.8, transformer: 1.0, availability: 99.0, lowIrr: 1.0 },
      degrFirst: 1.0, degrAnnual: 0.40 },
    bess: { enabled: true, kwh: 2000, kw: 1000, rte: 86.0, dod: 90.0, auxPct: 0.4, calendarDeg: 1.0, cycleDegPer1000: 2.5,
      eolSoh: 70, augmentation: true, augmentSoh: 80, unit: 'cabinet261',
      strategy: { selfConsumption: true, arbitrage: true, arbitrageMinSpread: 30, peakShaving: false, peakLimitKw: 2500, reserveSoc: 30, maxCyclesDay: 1.5 } },
    grid: { importLimitKw: 4000, exportLimitKw: 3000, zeroExport: false, voltageKv: 15, iccKa: 12.5, tFaultS: 0.5 },
    // costo del prelievo evitato in MT ≈ PUN × (1 + perdite) + spread + oneri variabili (dispacciamento, capacità, trasporto, ASOS/ARIM) + accise
    prices: { pun: 130, shape: 'duck2025', escalation: 2.0, lossFactor: 3.8, supplierSpread: 8, chargesVar: 64, excise: 12.5,
      powerChargeKwYear: 28, exportFactor: 1.0, ridFee: 0.5, customPun: null },
    capex: {
      pv: [
        { id: 'mod', label: 'Moduli fotovoltaici (franco cantiere)', unit: '€/kWp', value: 130 },
        { id: 'inv', label: 'Inverter', unit: '€/kWp', value: 35 },
        { id: 'str', label: 'Strutture di sostegno', unit: '€/kWp', value: 50 },
        { id: 'bos', label: 'BOS elettrico DC/AC (cavi, quadri, cavidotti, terra, SPD)', unit: '€/kWp', value: 60 },
        { id: 'mv', label: 'Cabine MT, trasformatori, protezioni', unit: '€/kWp', value: 50 },
        { id: 'conn', label: 'Connessione (TICA) e adeguamento cabina utente', unit: '€/kWp', value: 30 },
        { id: 'civ', label: 'Opere civili, viabilità, drenaggi', unit: '€/kWp', value: 35 },
        { id: 'sec', label: 'Recinzione, videosorveglianza, antintrusione', unit: '€/kWp', value: 20 },
        { id: 'mnt', label: 'Montaggi meccanici ed elettrici', unit: '€/kWp', value: 80 },
        { id: 'eng', label: 'Ingegneria, DL, CSE, collaudi', unit: '€/kWp', value: 30 },
        { id: 'dev', label: 'Sviluppo, autorizzazioni, pratiche GSE/DSO', unit: '€/kWp', value: 40 }
      ],
      bess: [
        { id: 'dc', label: 'DC block (celle LFP, rack, BMS, container, HVAC, antincendio)', unit: '€/kWh', value: 110 },
        { id: 'pcs', label: 'PCS (convertitori bidirezionali)', unit: '€/kW', value: 60 },
        { id: 'mvb', label: 'BoP elettrico (trasformatori MT, quadri, cavi, protezioni)', unit: '€/kW', value: 70 },
        { id: 'ems', label: 'EMS / SCADA / integrazione', unit: '€', value: 40000 },
        { id: 'civb', label: 'Installazione, opere civili, trasporti, messa in servizio', unit: '€/kWh', value: 40 },
        { id: 'safe', label: 'Prevenzione incendi e distanze di sicurezza', unit: '€/kWh', value: 5 },
        { id: 'engb', label: 'Ingegneria, permessi, aggiornamento connessione', unit: '€/kWh', value: 15 }
      ],
      contingencyPct: 8, ownersCostPct: 2
    },
    opex: { pvOmKwp: 11, bessOmKwh: 4.0, insurancePct: 0.30, imuEur: 4500, landLeaseEur: 0, monitoringEur: 3000, securityKwp: 2.0,
      adminEur: 5000, inflation: 2.2, inverterReplYear: 13, inverterReplKw: 45, augmentCostKwh: 120, costDeclineBess: 3.0, decommEurKwp: 25 },
    finance: { years: 25, wacc: 7.0, ke: 9.0, debtPct: 60, debtRate: 5.0, debtTenor: 12, ires: 24.0, irap: 3.9, deprPv: 9.0, deprBess: 9.0,
      halfFirstYear: true, taxCapacity: true, residualPct: 0 },
    incentives: [] // vedi INCENTIVE_CATALOG
  };

  // Voci di CAPEX che dipendono dal tipo di installazione (€/kWp), applicate quando si cambia tipologia nell'interfaccia
  const MOUNT_CAPEX = {
    ground_fixed: { str: 50, civ: 35, sec: 20, dev: 40, mnt: 80 },
    tracker:      { str: 80, civ: 45, sec: 20, dev: 40, mnt: 90 },
    roof_tilted:  { str: 30, civ: 15, sec: 5, dev: 15, mnt: 85 },  // civ: linee vita, ripristini, accessi in quota
    roof_ew:      { str: 55, civ: 20, sec: 5, dev: 15, mnt: 95 }
  };

  /*
   * Catalogo strumenti di incentivo (parametri modificabili nell'interfaccia).
   * type: grant | taxcredit | superdep | tariff_export | tariff_energy | interest_grant | capacity
   * base: pv | bess | all  (spesa ammissibile)
   * Stato a ottobre 2026 e fonti: docs/03_Contributi_Incentivi_UE_IT.md (verificare sempre bandi e decreti vigenti).
   */
  const INCENTIVE_CATALOG = [
    { id: 'iperamm2026', name: 'Iper-ammortamento 2026–2028 (L. 199/2025, DM 7/5/2026)', type: 'superdep', base: 'all', enabled: false,
      tiers: [{ upTo: 2500000, pct: 180 }, { upTo: 10000000, pct: 100 }, { upTo: 20000000, pct: 50 }],
      requiresEneaBC: true, modulesEneaBC: true, capPvKwp: 840, bessAlpha: 0.5,
      note: 'Aperta fino al 30/9/2028. Solo IRES. FV solo con moduli ENEA cat. B/C e produzione ≤ 105% dei consumi; massimale FV €/kWp (840 oltre 1 MW, cat. B); BESS ≤ α × FV (α da verificare). Base al netto degli altri aiuti.' },
    { id: 'tr50', name: 'Credito d\'imposta Transizione 5.0 (DL 19/2024)', type: 'taxcredit', base: 'all', enabled: false,
      pct: 35, cap: 50000000, years: 1, startYear: 1, note: 'Chiusa (risorse esaurite nel 2025; DL 38/2026 esclude le FER dalla lista d\'attesa). Solo per confronto storico.' },
    { id: 'zes', name: 'Credito d\'imposta ZES Unica Mezzogiorno', type: 'taxcredit', base: 'all', enabled: false,
      pct: 24, cap: 100000000, years: 1, startYear: 1, note: 'Aperta 2026–2028, prossima finestra 31/3–30/5/2027. Default 24% = 40% (grande impresa) × riparto ipotetico 60%.' },
    { id: 'pmiFer', name: 'Bando MIMIT autoproduzione FER nelle PMI', type: 'grant', base: 'all', enabled: false,
      pct: 30, cap: 1000000, year: 1, note: 'Chiusa (2° sportello chiuso il 10/11/2025). Storico: 30% medie, 40% micro e piccole.' },
    { id: 'fesr', name: 'Contributo regionale PR FESR 2021-27 (energia nelle imprese)', type: 'grant', base: 'all', enabled: false,
      pct: 30, cap: 1500000, year: 1, note: 'Bandi regionali a finestra: verificare apertura, intensità e cumulo.' },
    { id: 'sabatini', name: 'Nuova Sabatini (contributo in conto interessi)', type: 'interest_grant', base: 'all', enabled: false,
      rate: 3.575, loanYears: 5, financedPct: 100, cap: 4000000, note: 'Aperta a sportello. Tasso convenzionale 3,575% su 5 anni (≈ 10% del finanziato), max 4 M€.' },
    { id: 'ferx', name: 'FER X – CfD sull\'energia immessa (DM 18/6/2026)', type: 'tariff_export', enabled: false, strike: 70, years: 20,
      note: 'Aperta (accesso diretto ≤ 1 MW, aste oltre). Paga solo l\'energia immessa. Strike prudenziale; asta NZIA FV media 66,4 €/MWh.' },
    { id: 'tee', name: 'Altro incentivo €/MWh sull\'energia autoconsumata (generico)', type: 'tariff_energy', on: 'selfcons', enabled: false, value: 0, years: 10,
      note: 'Per modellare premi o tariffe non elencati (es. tariffa premio CACER sull\'energia condivisa).' },
    { id: 'msd', name: 'Servizi di flessibilità BESS (UVA/MSD tramite aggregatore)', type: 'capacity', base: 'bess', enabled: false, value: 15, years: 10,
      note: 'Ipotesi di ricavo netto €/kW·anno da verificare con l\'aggregatore. MACSE non accessibile al BESS dietro il contatore.' }
  ];

  return { SITES, ZONE_FACTOR, MODULES, INVERTERS, BESS_UNITS, LOAD_PROFILES, HOLIDAYS, CO2_GRID, DEFAULTS, MOUNT_CAPEX, INCENTIVE_CATALOG };
});
