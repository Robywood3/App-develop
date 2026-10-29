// Bilancio delle utilities e dei sistemi ausiliari per un punto di funzionamento:
// raffreddamento (torre evaporativa, ciclo aperto mare/fiume o aerocondensatore), acqua di raffreddamento a
// ciclo chiuso, reintegro ciclo e acqua demineralizzata, acqua grezza, acque reflue,
// stazione gas, vapore ausiliario, aria compressa, gas tecnici, chimici e ripartizione
// della potenza ausiliaria. Usato dal simulatore e dalla documentazione di ingegneria.

const RHO_W = 998; // kg/m³
const R_U = 8.314462618;

export const UTIL_DEFAULTS = {
  coc: 5, // cicli di concentrazione della torre
  driftFrac: 0.00001, // trascinamento (frazione della portata in circolazione)
  hrsgBlowdown: 0.01, // spurgo continuo GVR (frazione della produzione di vapore)
  cycleLosses: 0.005, // perdite del ciclo (sfiati, campionamenti, tenute)
  roRecovery: 0.75,
  ediRecovery: 0.92,
  gridPressure: 50, // bar(a) pressione gasdotto di default (campo tipico 20-60 bar)
  stationDp: 3, // bar perdite stazione (knock-out drum, filtri, misura, riscaldatori)
  gridT: 12, // °C temperatura gas in arrivo
  jt: 0.45, // K/bar effetto Joule-Thomson
  auxSteamBar: 13,
  auxSteamT: 250,
  ccwDT: 7, // K salto termico circuito chiuso (descrizioni di riferimento BoP)
  acwDT: 10, // K salto termico acqua ausiliaria sugli intercooler CCW
  gasDewPoint: 0, // °C punto di rugiada idrocarburi del gas in arrivo
  gasSuperheat: 20, // K margine sopra la rugiada a valle della riduzione
  cycleMakeupDesign: 0.02, // reintegro ciclo di progetto (frazione del vapore) per dimensionare demi
  demiHoldup: 48, // h di autonomia del serbatoio demi
  backupHours: 24, // h di funzionamento a pieno carico a gasolio (riserva)
};

/**
 * Pressioni della stazione gas e compressore (se la rete non basta). La pressione richiesta ai TG
 * cresce con il rapporto di compressione: ~38-42 bar per la classe F, ~48-50 bar per le classi H/J.
 * Con rete sotto pressione richiesta + perdite + margine si installa un compressore 2×100 %
 * (riferimento Ostiglia: 33 kg/s, 1800 kW).
 */
export function gasStation(cfg, p2, mFuel, o = {}) {
  const p = { ...UTIL_DEFAULTS, ...o };
  const pIn = cfg.gasSupplyBar ?? p.gridPressure;
  const pOut = Math.min(55, Math.max(38, p2 * 1.6 + 10));
  const comp = pIn - p.stationDp < pOut + 2;
  if (!comp) return { pIn, pOut, compressor: null };
  const pSuc = pIn - 2, pDis = pOut + 3, k = 1.3, cp = 2.3, etaIs = 0.78, etaDrive = 0.95;
  const T1 = p.gridT + 273.15;
  const dhS = cp * T1 * (Math.pow(pDis / pSuc, (k - 1) / k) - 1);
  const kW = (mFuel * dhS) / etaIs / etaDrive;
  const Tdis = p.gridT + dhS / etaIs / cp;
  return {
    pIn, pOut,
    compressor: {
      m: mFuel, pSuc, pDis, ratio: pDis / pSuc, kW, Tdis,
      // refrigerante finale (gas a 45 °C) e olio di lubrificazione su ciclo chiuso
      coolerKW: Math.max(0, mFuel * cp * (Tdis - 45)) + 0.04 * kW,
      ratedKW: Math.ceil((kW * 1.15) / 50) * 50,
    },
  };
}

/** Densità del gas combustibile in condizioni standard (15 °C, 1,01325 bar) [kg/Sm³]. */
export function gasStdDensity(fuel) {
  return (101325 * fuel.M) / (R_U * 1000 * 288.15);
}

/**
 * @param {object} cfg configurazione impianto
 * @param {object} des riferimento di progetto (designPlant)
 * @param {object} r punto di funzionamento (plantPoint)
 * @param {object} [o] parametri (UTIL_DEFAULTS)
 */
export function utilitiesBalance(cfg, des, r, o = {}) {
  const p = { ...UTIL_DEFAULTS, ...o };
  const op = r.op;
  const N = cfg.nGT;
  const nOn = r.nOn ?? N;
  const online = !!r.online;
  const bt = online ? r.bt : null;
  const fuel = des.fuel;
  const water = cfg.steam.condenser.type === 'water';
  const once = water && cfg.steam.condenser.cooling === 'once'; // ciclo aperto (mare/fiume)
  const tower = water && !once;
  const benson = cfg.steam.hpEvap === 'benson';
  const mSteam = online ? bt.mSteamTot : 0; // kg/s totale vapore prodotto
  const mHP = online ? bt.mLevels[0] * nOn : 0;

  // ------------------------------------------------ raffreddamento principale
  const Qcond = online ? bt.Qcond : 0; // MW
  const cooling = { type: once ? 'aperto' : water ? 'torre' : 'acc', Qcond };
  if (once) {
    // ciclo aperto: presa a mare/fiume con griglie e filtri a nastro, restituzione con pozzo di carico.
    // Biocida in continuo (0,5 mg/l, elettroclorazione con acqua di mare) e a shock se consentito.
    const cwFlow = des.mcw;
    Object.assign(cooling, {
      cwFlow, cwM3h: (cwFlow * 3600) / RHO_W, evap: 0, drift: 0, blowdown: 0, makeup: 0,
      evapM3h: 0, blowdownM3h: 0, makeupM3h: 0, driftM3h: 0, coc: 1,
      Tin: op.Tcw, Tout: op.Tcw + cfg.steam.condenser.dTcw * (Qcond / des.QcondD),
      hypo: (cwFlow * 3.6 * 0.5) / 1000, hypoDaily: (cwFlow * 3.6 * 0.5 * 24) / 1000, acid: 0, antiscalant: 0,
      intakeM3h: ((cwFlow * 3600) / RHO_W) * 1.1, // portata di presa con margine 10 % (griglie e filtri a nastro)
    });
  } else if (water) {
    // quota evaporativa del calore scambiato in torre (cresce con la temperatura dell'aria)
    const fEvap = Math.min(0.95, Math.max(0.6, 0.78 + 0.008 * (op.Tamb - 15)));
    const evap = (fEvap * Qcond * 1000) / 2430; // kg/s
    const cwFlow = des.mcw; // kg/s
    const drift = cwFlow * p.driftFrac;
    const blowdown = Math.max(0, evap / (p.coc - 1) - drift);
    const makeup = evap + blowdown + drift;
    Object.assign(cooling, {
      fEvap, cwFlow, cwM3h: (cwFlow * 3600) / RHO_W, evap, drift, blowdown, makeup,
      evapM3h: (evap * 3600) / RHO_W, blowdownM3h: (blowdown * 3600) / RHO_W, makeupM3h: (makeup * 3600) / RHO_W,
      driftM3h: (drift * 3600) / RHO_W, coc: p.coc,
      Tin: op.Tcw, Tout: op.Tcw + cfg.steam.condenser.dTcw * (Qcond / des.QcondD),
      // dosaggi: ipoclorito a shock (residuo 0,1-0,2 ppm, 2-3 volte al giorno), acido solforico per il pH,
      // inibitore sul reintegro proporzionale allo spurgo (concentrazione mantenuta nell'acqua in circolo)
      hypo: (cwFlow * 3.6 * 1.0) / 1000, // kg/h NaClO (1 mg/l durante lo shock, ~1 h/giorno)
      hypoDaily: (cwFlow * 3.6 * 1.0) / 1000 * 2.5, // kg/giorno
      acid: (makeup * 3.6 * 50) / 1000, // kg/h H2SO4 (50 mg/l sul reintegro)
      antiscalant: ((blowdown + drift) * 3.6 * 15) / 1000, // kg/h inibitore (15 mg/l nel circolo)
    });
  } else {
    Object.assign(cooling, { evap: 0, blowdown: 0, makeup: 0, evapM3h: 0, blowdownM3h: 0, makeupM3h: 0, driftM3h: 0, Tair: op.Tamb });
  }

  // ------------------------------------------------ circuito chiuso (CCW)
  const Pgt1 = online ? r.gt.P : 0;
  const ccwUsers = [];
  const addU = (tag, name, kW) => ccwUsers.push({ tag, name, kW: Math.max(0, kW) });
  // perdite tarate sulle descrizioni di riferimento (800-850 MW: ~22 MW) e su Ostiglia (1+1 classe H: 23,6 MW)
  for (let u = 1; u <= N; u++) {
    const on = u <= nOn && online;
    addU(`${u}MBV10AC001`, `Refrigeranti olio lubrificazione TG${u}`, on ? 100 + 6 * Pgt1 : 0);
    addU(`${u}MKA10AC001`, `Refrigeranti generatore TG${u} (aria/idrogeno e olio tenuta)`, on ? Pgt1 * 1000 * 0.016 : 0);
    addU(`${u}MBX10AC001`, `Refrigeranti ausiliari TG${u} (cabinato, skid, ventilazione)`, on ? Pgt1 * 1000 * 0.004 : 0);
    addU(`${u}LAC10AC001`, `Refrigeranti pompe alimento GVR${u}`, on ? 60 + 0.4 * (bt.mLevels[0] || 0) : 0);
  }
  const gst = gasStation(cfg, online ? r.gt.p2 : des.gtRef.point.p2, online ? r.mFuelTot : des.gtRef.point.mFuel * N, o);
  if (gst.compressor) addU('0EKB10AC001', 'Refrigeranti compressori gas (gas e olio)', online ? gst.compressor.coolerKW : 0);
  const Pst = online ? r.Pst : 0;
  addU('0MAV10AC001', 'Refrigeranti olio lubrificazione TV', Pst > 0 ? 100 + 5 * Pst : 0);
  addU('0MKA10AC001', 'Refrigeranti generatore TV (aria/idrogeno e olio tenuta)', Pst * 1000 * 0.016);
  addU('0MAJ10AC001', 'Refrigeranti pompe del vuoto', online ? 80 : 0);
  addU('0QUA10AC001', 'Refrigeranti pannello campionamento', online ? 60 : 0);
  addU('0SCA10AC001', 'Refrigeranti compressori aria', 40 + 30 * N);
  const ccwKW = ccwUsers.reduce((a, b) => a + b.kW, 0);
  const ccwFlow = (ccwKW / (4.18 * p.ccwDT)); // kg/s
  // acqua: intercooler a piastre raffreddati dall'acqua ausiliaria (ACW) presa dalla vasca torre;
  // aerocondensatore: scambiatore aria/acqua con avvicinamento minimo di 6 K
  const Tsup = water ? Math.max(20, op.Tcw + 6) : Math.max(20, op.Tamb + 6); // ΔT minimo 6 °C sul refrigerante (descrizione CCW)
  const acwFlow = water ? (ccwKW / (4.18 * p.acwDT)) : 0;
  const ccwM3h = (ccwFlow * 3600) / RHO_W;
  const ccw = {
    users: ccwUsers, kW: ccwKW, flow: ccwFlow, m3h: ccwM3h, dT: p.ccwDT, Tsupply: Tsup, Treturn: Tsup + p.ccwDT,
    cooler: water ? 'intercooler' : 'aria', acwFlow, acwM3h: (acwFlow * 3600) / RHO_W, acwDT: p.acwDT,
    // pompe 2×100 % (riferimento BoP); oltre ~2000 m³/h 3×50 % come a Ostiglia (3 × 1640 m³/h, 32 m)
    pumpN: ccwM3h > 2000 ? 3 : 2, pumpPct: ccwM3h > 2000 ? 50 : 100, pumpHead: ccwM3h > 2000 ? 32 : 30,
    headTankM3: Math.max(2, Math.ceil(ccwM3h / 900)), dosingTankM3: 0.4,
  };
  ccw.pumpM3h = Math.ceil(((ccwM3h * 1.1) / (ccw.pumpN - 1)) / 10) * 10;

  // ------------------------------------------------ reintegro ciclo, demi, acqua grezza
  // spurgo continuo dai corpi cilindrici (con evaporatore HP Benson solo IP e LP)
  const hrsgBD = (benson ? mSteam - mHP : mSteam) * p.hrsgBlowdown;
  const losses = mSteam * p.cycleLosses;
  const sampling = online ? 0.25 : 0; // kg/s (~0,9 m³/h)
  const cycleMakeup = hrsgBD + losses + sampling; // kg/s
  const ccwMakeup = 0.02; // kg/s medio
  const gtWash = 0.01 * N; // media annua equivalente
  const demin = cycleMakeup + ccwMakeup + gtWash;
  const demiM3h = (demin * 3600) / RHO_W;
  const roPermeate = demin / p.ediRecovery;
  const roFeed = roPermeate / p.roRecovery;
  const roReject = roFeed - roPermeate;
  const ediReject = roPermeate - demin;
  const services = 1.4; // kg/s servizi, lavaggi, potabile
  const rawWater = (tower ? cooling.makeup : 0) + roFeed + services;
  const demi = {
    cycleMakeup, hrsgBD, losses, sampling, demin, demiM3h, roFeed, roPermeate, roReject, ediReject,
    // reintegro di progetto pari al 2 % della produzione di vapore: dimensiona impianto e serbatoio (48 h)
    designMakeupM3h: (((des.stRef.mLevels || []).reduce((a, b) => a + b, 0) * N * p.cycleMakeupDesign) * 3600) / RHO_W,
    plantM3h: 0,
    tankM3: 0,
  };
  demi.plantM3h = Math.max(10, Math.ceil(Math.max(demiM3h * 1.3, demi.designMakeupM3h) / 5) * 5);
  demi.tankM3 = Math.max(300, Math.ceil((demi.designMakeupM3h * p.demiHoldup) / 100) * 100);
  demi.tankN = 1;
  demi.distM3h = Math.max(25, Math.ceil((demiM3h * 2) / 5) * 5);
  if (benson) {
    // caldaia Benson: lavaggi e avviamenti a ciclo aperto richiedono grandi volumi (Ostiglia: 30 m³/h, 2 × 3000 m³)
    const hpM3h = ((des.stRef.mLevels[0] * N) * 3600) / RHO_W;
    demi.plantM3h = Math.max(demi.plantM3h, Math.ceil((hpM3h * 0.05) / 5) * 5);
    demi.tankN = 2;
    demi.tankM3 = 2 * Math.ceil((hpM3h * 10.3) / 2 / 500) * 500;
    demi.distM3h = Math.max(demi.distM3h, Math.ceil((hpM3h * 0.35) / 10) * 10);
  }

  // ------------------------------------------------ acque reflue
  const ww = {
    ctBlowdown: tower ? cooling.blowdown : 0,
    roReject, ediReject,
    hrsgBD,
    oily: 0.3,
    sanitary: 0.1,
  };
  ww.total = ww.ctBlowdown + ww.roReject + ww.ediReject + ww.hrsgBD + ww.oily;
  ww.totalM3h = (ww.total * 3600) / RHO_W;

  // ------------------------------------------------ stazione gas
  const mFuel = online ? r.mFuelTot : 0;
  const rhoStd = gasStdDensity(fuel);
  // pressione all'uscita della stazione: tipicamente 38-42 bar, fino a 50-55 bar per i TG con β elevato
  const { pIn, pOut, compressor } = gst;
  // con il compressore la riduzione lavora con piccolo salto e il gas arriva caldo dal refrigerante finale
  const dTjt = p.jt * Math.max(0, (compressor ? compressor.pDis : pIn) - pOut);
  const Tafter = p.gasDewPoint + p.gasSuperheat; // °C a valle della riduzione (margine sulla rugiada)
  const preheatT = Math.max(compressor ? 45 : p.gridT, Tafter + dTjt); // temperatura richiesta a monte della riduzione
  const heaterKW = Math.max(0, mFuel * 2.35 * (preheatT - (compressor ? 45 : p.gridT)));
  const perfHeaterKW = online ? r.gt.mFuel * nOn * 2.35 * (cfg.gt.Tfuel - Tafter) : 0;
  const gas = {
    mFuel, Sm3h: (mFuel * 3600) / rhoStd, rhoStd, pIn, pOut, Tin: p.gridT, dTjt, preheatT, Tout: Tafter,
    heaterKW, perfHeaterKW, lhvMJSm3: (fuel.lhv * rhoStd) / 1000, hhvMJSm3: (fuel.hhv * rhoStd) / 1000,
    compressors: !!compressor, compressor: compressor && { ...compressor, m: mFuel, kW: online ? compressor.kW : 0 }, dewPoint: p.gasDewPoint,
  };

  // ------------------------------------------------ vapore ausiliario
  const glandSteam = online ? 0.6 + 0.004 * Pst : 0; // kg/s
  const auxSteam = {
    p: p.auxSteamBar, T: p.auxSteamT, gland: glandSteam,
    // in esercizio da RH freddo/vapore LP; all'avviamento da caldaia ausiliaria
    // ~3,5 % della produzione HP (Ostiglia 1+1 classe H: 20 t/h)
    boilerCapacity: Math.max(4, Math.ceil(((des.stRef.mLevels[0] * N * 0.035) * 3.6) / 2) * 2 / 3.6),
    source: online && Pst > 0 ? 'RH freddo / vapore IP' : 'caldaia ausiliaria',
  };

  // ------------------------------------------------ aria compressa e gas tecnici
  // tarato sull'impianto reale di Ostiglia (1+1 classe H, ~890 MW lordi: compressori 3 × 1450 Nm³/h,
  // essiccatori 2 × 2250 Nm³/h); le descrizioni BoP generiche indicano valori molto più bassi (2 × 400 Nm³/h)
  const grossD = (des.gtRef.Piso * N) * 1.5;
  const air = {
    instrument: Math.round(2.3 * grossD + (water ? 0 : 30)), // Nm³/h
    service: Math.round(0.66 * grossD),
    pressure: 11, // bar a mandata compressori
    holdupMin: 5,
  };
  air.total = air.instrument + air.service;
  air.compressorN = 3; // 3×50 %
  air.compressorNm3h = Math.ceil((air.total * 1.1) / 2 / 50) * 50;
  air.dryerNm3h = Math.round((air.instrument * 1.1) / 50) * 50;
  // volume di accumulo: 5 minuti di consumo aria strumenti da 11 a 6 bar a
  air.receiverM3 = Math.max(2, Math.ceil(((air.instrument / 60) * air.holdupMin) / (11 - 6) * 1.01325 * 2) / 2);
  const genH2 = (r.Pgt > 0 ? N : 0);
  const gases = {
    n2Nm3d: 20 + 10 * N, // spurghi e polmonazioni in esercizio
    n2LayupNm3: 400 * N + 300,
    h2Nm3d: 12 * N, // reintegro generatori raffreddati a idrogeno
    co2PurgeKg: 900 * N,
    h2Gens: genH2,
  };

  // ------------------------------------------------ prodotti chimici ciclo
  const chem = {
    ammonia: (mSteam * 3.6 * 0.5) / 1000, // kg/h NH3 (0,5 mg/kg sul condensato, solo reintegro)
    scavenger: (cycleMakeup * 3.6 * 20) / 1000, // kg/h carboidrazide
    phosphate: online ? 0.02 * nOn : 0, // kg/h Na3PO4
    // pompe dosatrici di riferimento (l/h): fosfati HP 8, IP 4, deossigenante 3, ammoniaca 3,5
    pumpsLh: { phosphateHP: 8, phosphateIP: 4, scavenger: 3, ammonia: 3.5 }, tankM3: 1.5,
  };

  // ------------------------------------------------ gasolio di riserva (opzionale)
  const QgtMax = des.gtRef.point.Qfuel * N; // MW termici TG a pieno carico ISO
  const dOil = cfg.backupFuel === 'diesel' ? (() => {
    const lhv = 42.8, rho = 0.845; // MJ/kg, t/m³
    const kgs = QgtMax / lhv;
    const m3h = (kgs * 3.6) / rho;
    return {
      kgs, m3h, lhv, rho, hours: p.backupHours,
      tankM3: Math.ceil((m3h * p.backupHours * 1.0) / 100) * 100,
      transferM3h: Math.ceil(m3h * 1.1 / 5) * 5, unloadM3h: 20, auxM3h: 5,
    };
  })() : null;

  // ------------------------------------------------ potenza ausiliaria per sistema
  const aux = r.aux || { pumps: 0, cooling: 0, misc: 0 };
  const breakdown = online ? [
    { name: 'Pompe ciclo (alimento e condensato)', MW: aux.pumps },
    { name: once ? 'Raffreddamento (pompe acqua di circolazione e ausiliaria)' : water ? 'Raffreddamento (pompe CW e ventilatori torre)' : 'Ventilatori aerocondensatore', MW: aux.cooling },
    ...(aux.gasComp ? [{ name: 'Compressore gas combustibile', MW: aux.gasComp }] : []),
    { name: 'Ausiliari TG (olio, cabinato, filtri)', MW: cfg.aux.gtAuxMW * nOn },
    { name: 'BoP e servizi (CCW, aria, demi, HVAC, luce)', MW: Math.max(0, aux.misc - cfg.aux.gtAuxMW * nOn - (aux.gasComp || 0)) },
    { name: 'Perdite trasformatori', MW: r.Ptrafo || 0 },
  ] : [];

  // ------------------------------------------------ pretrattamento e acqua servizi
  // catena di riferimento: serbatoio acqua grezza (con riserva antincendio) -> pompe alimento pretrattamento ->
  // pretrattamento -> serbatoio acqua servizi -> pompe acqua servizi e pompe alimento demi.
  // Il reintegro della torre è derivato a monte del serbatoio acqua grezza.
  const pret = {
    feed: roFeed + services, // kg/s medi
    serviceM3h: 30, // pompe acqua servizi 2×100 %
    demiFeedM3h: Math.max(15, Math.ceil(demi.plantM3h / p.ediRecovery / p.roRecovery / 5) * 5), // pompe alimento demi 2×100 %
    firePumpM3h: 400 + 100 * N,
  };
  pret.feedM3h = (pret.feed * 3600) / RHO_W;
  pret.pumpM3h = Math.max(20, Math.ceil(((services * 3600) / RHO_W + pret.demiFeedM3h) * 1.1 / 5) * 5);
  pret.serviceTankM3 = Math.ceil((pret.serviceM3h * 4 + pret.demiFeedM3h * 12) / 50) * 50; // 4 h servizi + 12 h demi
  pret.fireReserveM3 = pret.firePumpM3h * 2; // 2 h della pompa antincendio (da confermare con la prevenzione incendi)
  pret.rawTankM3 = Math.ceil((pret.fireReserveM3 + pret.pumpM3h * 4) / 100) * 100; // + 4 h di pretrattamento

  return { cooling, ccw, demi, rawWater, rawWaterM3h: (rawWater * 3600) / RHO_W, ww, gas, auxSteam, air, gases, chem, diesel: dOil, pret, breakdown, params: p };
}
