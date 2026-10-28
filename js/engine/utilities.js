// Bilancio delle utilities e dei sistemi ausiliari per un punto di funzionamento:
// raffreddamento (torre evaporativa o aerocondensatore), acqua di raffreddamento a
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
  gridPressure: 65, // bar(a) pressione gasdotto
  gridT: 12, // °C temperatura gas in arrivo
  jt: 0.45, // K/bar effetto Joule-Thomson
  auxSteamBar: 13,
  auxSteamT: 250,
  ccwDT: 8, // K salto termico circuito chiuso
};

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
  const mSteam = online ? bt.mSteamTot : 0; // kg/s totale vapore prodotto

  // ------------------------------------------------ raffreddamento principale
  const Qcond = online ? bt.Qcond : 0; // MW
  const cooling = { type: water ? 'torre' : 'acc', Qcond };
  if (water) {
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
      // dosaggi tipici riferiti al reintegro
      hypo: (makeup * 3.6 * 2) / 1000, // kg/h NaClO (2 mg/l)
      antiscalant: (makeup * 3.6 * 8) / 1000, // kg/h (8 mg/l)
    });
  } else {
    Object.assign(cooling, { evap: 0, blowdown: 0, makeup: 0, evapM3h: 0, blowdownM3h: 0, makeupM3h: 0, driftM3h: 0, Tair: op.Tamb });
  }

  // ------------------------------------------------ circuito chiuso (CCW)
  const Pgt1 = online ? r.gt.P : 0;
  const ccwUsers = [];
  const addU = (tag, name, kW) => ccwUsers.push({ tag, name, kW: Math.max(0, kW) });
  for (let u = 1; u <= N; u++) {
    const on = u <= nOn && online;
    addU(`${u}MBV10AC001`, `Refrigeranti olio lubrificazione TG${u}`, on ? 250 + 2.6 * Pgt1 : 0);
    addU(`${u}MKA10AC001`, `Refrigeranti generatore TG${u}`, on ? Pgt1 * 1000 * 0.0085 : 0);
    addU(`${u}LAC10AC001`, `Refrigeranti pompe alimento GVR${u}`, on ? 60 + 0.4 * (bt.mLevels[0] || 0) : 0);
  }
  const Pst = online ? r.Pst : 0;
  addU('0MAV10AC001', 'Refrigeranti olio lubrificazione TV', Pst > 0 ? 150 + 1.6 * Pst : 0);
  addU('0MKA10AC001', 'Refrigeranti generatore TV', Pst * 1000 * 0.009);
  addU('0MAJ10AC001', 'Refrigeranti pompe del vuoto', online ? 80 : 0);
  addU('0QUA10AC001', 'Refrigeranti pannello campionamento', online ? 60 : 0);
  addU('0SCA10AC001', 'Refrigeranti compressori aria', 90 + 25 * N);
  const ccwKW = ccwUsers.reduce((a, b) => a + b.kW, 0);
  const ccwFlow = (ccwKW / (4.18 * p.ccwDT)); // kg/s
  const ccw = { users: ccwUsers, kW: ccwKW, flow: ccwFlow, m3h: (ccwFlow * 3600) / RHO_W, dT: p.ccwDT, Tsupply: Math.max(30, op.Tamb + 12), Treturn: Math.max(30, op.Tamb + 12) + p.ccwDT };

  // ------------------------------------------------ reintegro ciclo, demi, acqua grezza
  const hrsgBD = mSteam * p.hrsgBlowdown;
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
  const rawWater = (water ? cooling.makeup : 0) + roFeed + services;
  const demi = {
    cycleMakeup, hrsgBD, losses, sampling, demin, demiM3h, roFeed, roPermeate, roReject, ediReject,
    plantM3h: Math.max(10, Math.ceil(demiM3h * 2.2 / 5) * 5),
    tankM3: Math.max(300, Math.ceil((demiM3h * 72) / 100) * 100),
  };

  // ------------------------------------------------ acque reflue
  const ww = {
    ctBlowdown: water ? cooling.blowdown : 0,
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
  const pOut = online ? Math.max(20, r.gt.p2 * 1.5) : 30;
  const dTjt = p.jt * (p.gridPressure - pOut);
  const Tafter = 5; // °C minimo a valle della riduzione (anti-idrati)
  const preheatT = Tafter + dTjt; // temperatura richiesta a monte della riduzione
  const heaterKW = Math.max(0, mFuel * 2.35 * (preheatT - p.gridT));
  const perfHeaterKW = online ? r.gt.mFuel * nOn * 2.35 * (cfg.gt.Tfuel - Tafter) : 0;
  const gas = {
    mFuel, Sm3h: (mFuel * 3600) / rhoStd, rhoStd, pIn: p.gridPressure, pOut, Tin: p.gridT, dTjt, preheatT, Tout: Tafter,
    heaterKW, perfHeaterKW, lhvMJSm3: (fuel.lhv * rhoStd) / 1000, hhvMJSm3: (fuel.hhv * rhoStd) / 1000,
  };

  // ------------------------------------------------ vapore ausiliario
  const glandSteam = online ? 0.6 + 0.004 * Pst : 0; // kg/s
  const auxSteam = {
    p: p.auxSteamBar, T: p.auxSteamT, gland: glandSteam,
    // in esercizio da RH freddo/vapore LP; all'avviamento da caldaia ausiliaria
    boilerCapacity: Math.max(4, Math.ceil(((des.stRef.mLevels[0] * N * 0.08) * 3.6) / 2) * 2 / 3.6),
    source: online && Pst > 0 ? 'RH freddo / vapore IP' : 'caldaia ausiliaria',
  };

  // ------------------------------------------------ aria compressa e gas tecnici
  const air = {
    instrument: 150 + 110 * N + (water ? 30 : 60), // Nm³/h
    service: 250,
  };
  air.total = air.instrument + air.service;
  air.compressorNm3h = Math.ceil((air.total * 1.25) / 50) * 50;
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
  };

  // ------------------------------------------------ potenza ausiliaria per sistema
  const aux = r.aux || { pumps: 0, cooling: 0, misc: 0 };
  const breakdown = online ? [
    { name: 'Pompe ciclo (alimento e condensato)', MW: aux.pumps },
    { name: water ? 'Raffreddamento (pompe CW e ventilatori torre)' : 'Ventilatori aerocondensatore', MW: aux.cooling },
    { name: 'Ausiliari TG (olio, cabinato, filtri)', MW: cfg.aux.gtAuxMW * nOn },
    { name: 'BoP e servizi (CCW, aria, demi, HVAC, luce)', MW: Math.max(0, aux.misc - cfg.aux.gtAuxMW * nOn) },
    { name: 'Perdite trasformatori', MW: r.Ptrafo || 0 },
  ] : [];

  return { cooling, ccw, demi, rawWater, rawWaterM3h: (rawWater * 3600) / RHO_W, ww, gas, auxSteam, air, gases, chem, breakdown, params: p };
}
