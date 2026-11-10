// Integrazione dell'impianto a ciclo combinato: N turbine a gas, ciascuna con il
// proprio GVR, una turbina a vapore comune, ausiliari, emissioni ed economia.

import { fuelProperties, FUEL_PRESETS, fuelForTemperature, gasH, molarMass } from './gas.js';
import { GT_PRESETS, GT_GROUPS, gtDesign, gtAtLoad } from './gt.js';
import { solveBottoming, LEVEL_NAMES } from './bottoming.js';
import { gasStation } from './utilities.js';
import { psat } from './steam.js';

export const ISO = { Tamb: 15, pamb: 1.01325, rh: 0.6 };

const STEAM_DEFAULTS = {
  '3PRH': {
    levels: [{ p: 125, Tsh: 565 }, { p: 28, Tsh: 310 }, { p: 4.5, Tsh: 290 }],
    pinch: [8, 8, 8], approach: [5, 5, 5], Trh: 565,
  },
  '2P': {
    levels: [{ p: 80, Tsh: 540 }, { p: 6, Tsh: 230 }],
    pinch: [8, 8], approach: [5, 5], Trh: 0,
  },
  '1P': {
    levels: [{ p: 60, Tsh: 500 }],
    pinch: [10], approach: [5], Trh: 0,
  },
};

// Condizioni vapore tipiche del ciclo 3 livelli + RH per classe di TG
const CLASS_STEAM_3PRH = {
  'Classe F (~300 MW)': { hp: 125, ip: 28, tsh: 565, trh: 565 },
  'Classe H/J (~450 MW)': { hp: 150, ip: 36, tsh: 585, trh: 585 },
  'Classe E (~170 MW)': { hp: 95, ip: 24, tsh: 540, trh: 540 },
};

// Modelli commerciali: classi H/J/HA/HL (TIT ≥ 1580 °C) con vapore HP a 170–173 bar, 600 °C e RH 40 bar
// fino a 610 °C (riferimenti: 177 bar/604 °C e RH 42 bar/610 °C da catalogo, 173 bar/600 °C a Ostiglia).
function classSteam(gtName) {
  if (CLASS_STEAM_3PRH[gtName]) return CLASS_STEAM_3PRH[gtName];
  const g = GT_PRESETS[gtName];
  if (!g) return null;
  // turbina a vapore di grande taglia (~300 MW, HP/IP + LP) e GVR con pinch ridotto
  if (g.TIT >= 1580) return { hp: g.TETiso >= 700 ? 173 : 170, ip: 43, tsh: 600, trh: g.TETiso >= 700 ? 610 : 600, st: { etaHP: 0.89, etaIP: 0.925, etaLP: 0.905, pinch: 6, pinchHP: 4, approachHP: 3, hpEvap: 'benson' } };
  if (g.TIT >= 1450) return CLASS_STEAM_3PRH['Classe F (~300 MW)'];
  return CLASS_STEAM_3PRH['Classe E (~170 MW)'];
}

export const LIMITS = { pHPmax: 185, TshMax: 610 };

/** Configurazione predefinita dell'impianto. */
export function defaultConfig(gtName = 'Classe F (~300 MW)', type = '3PRH') {
  const s = JSON.parse(JSON.stringify(STEAM_DEFAULTS[type]));
  const cls = classSteam(gtName);
  if (type === '3PRH' && cls) {
    s.levels[0] = { p: cls.hp, Tsh: cls.tsh };
    s.levels[1].p = cls.ip;
    s.Trh = cls.trh;
  }
  const st = cls?.st;
  return {
    gtName,
    gt: { ...GT_PRESETS[gtName] },
    fuelName: 'Gas naturale tipico (rete IT)',
    fuelComp: { ...FUEL_PRESETS['Gas naturale tipico (rete IT)'] },
    nGT: 1,
    steam: {
      type,
      levels: s.levels.map((l) => ({ ...l })),
      pinch: st ? s.pinch.map((v, k) => (k === 0 ? st.pinchHP : st.pinch)) : s.pinch.slice(),
      approach: st ? s.approach.map((v, k) => (k === 0 ? st.approachHP : v)) : s.approach.slice(),
      // evaporatore HP a corpo cilindrico o a passaggio singolo (Benson, senza spurgo continuo HP)
      hpEvap: type === '3PRH' ? st?.hpEvap ?? 'drum' : 'drum',
      Trh: s.Trh,
      dTsh: 25,
      dpSH: 0.06,
      dpRH: 0.08,
      hrsgLoss: 0.005,
      TstackMin: 70,
      TwPreMin: 55,
      etaHP: st?.etaHP ?? 0.87,
      etaIP: st?.etaIP ?? 0.91,
      etaLP: st?.etaLP ?? 0.89,
      etaMG: 0.985,
      etaPump: 0.8,
      pMinFracHP: 0.4,
      condenser: { type: 'water', cooling: 'tower', TcwDesign: 18, dTcw: 10, TTD: 3, ITD: 28 },
    },
    // ausiliari raffreddamento tarati sulle descrizioni BoP di riferimento: torre con pompe MCW 2×50 % da 20 m,
    // ventilatori ~0,55 % del calore scaricato, pompe ACW 30 m; ciclo aperto con pompe MCW 12 m e ACW 20 m
    aux: { miscFrac: 0.004, trafoFrac: 0.003, gtAuxMW: 0.8, cwHeadBar: 2.0, cwHeadOnceBar: 1.2, fanFrac: 0.012, ctFanFrac: 0.0055, acwHeadBar: 3.0, acwHeadOnceBar: 2.0, ccwFrac: 0.026 },
    backupFuel: 'none',
    gasSupplyBar: 50, // pressione di consegna della rete gas (20-60 bar; sotto la richiesta dei TG serve il compressore)
  };
}

export function defaultOperation() {
  return {
    Tamb: 15, pamb: 1.01325, rh: 0.6,
    load: 1, nGTon: 1, Tcw: 18, ductT: 0, slidingHP: true,
    gasPrice: 35, co2Price: 70, omVar: 3, powerPrice: 110,
  };
}

// Campi fisici ammessi per le condizioni di esercizio. Fuori da questi il modello esce dal suo dominio
// (pressione quasi nulla: NaN e iterazioni lunghissime); i valori non numerici tornano al valore tipico.
export const OPERATION_RANGES = {
  Tamb: [-40, 55], pamb: [0.6, 1.1], rh: [0, 1], load: [0, 1], Tcw: [0, 45], ductT: [0, 900],
  gasPrice: [0, 1000], co2Price: [0, 1000], omVar: [0, 1000], powerPrice: [-500, 5000],
};

/** Copia delle condizioni di esercizio con ogni grandezza riportata nel campo ammesso. */
export function sanitizeOperation(op) {
  const def = defaultOperation();
  const out = { ...op };
  for (const [k, [lo, hi]] of Object.entries(OPERATION_RANGES)) {
    const v = Number(out[k]);
    out[k] = Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def[k];
  }
  return out;
}

// Campi ammessi per i dati di progetto: [minimo, massimo]. Valori fuori campo, nulli o non numerici
// porterebbero il modello fuori dal suo dominio (potenze negative, NaN, iterazioni senza fine).
export const DESIGN_RANGES = {
  gt: {
    mAirISO: [50, 1500, 'Portata aria ISO', 'kg/s'], PR: [8, 35, 'Rapporto di compressione', ''], TIT: [900, 1750, 'Temperatura uscita combustore', '°C'],
    coolFrac: [0, 0.35, 'Aria di raffreddamento', '%', 100], etaC: [0.75, 0.94, 'Rendimento compressore', ''], etaT: [0.8, 0.95, 'Rendimento turbina', ''],
    TETiso: [450, 720, 'Isoterma di scarico', '°C'], igvMin: [0.4, 0.95, 'Portata minima IGV', '%', 100],
  },
  steam: {
    etaHP: [0.6, 0.95, 'Rendimento TV HP', ''], etaIP: [0.6, 0.95, 'Rendimento TV IP', ''], etaLP: [0.6, 0.95, 'Rendimento TV LP', ''],
    TstackMin: [60, 150, 'Temperatura minima al camino', '°C'], Trh: [300, 610, 'Temperatura RH', '°C'],
  },
  condenser: {
    TcwDesign: [0, 35, 'Temperatura acqua di progetto', '°C'], dTcw: [4, 20, 'Salto termico acqua', 'K'], TTD: [1, 15, 'Differenza terminale', 'K'], ITD: [15, 50, 'ITD aerocondensatore', 'K'],
  },
  pinch: [3, 40], Tsh: [200, 610], pLevelMin: 1.5, gasSupplyBar: [20, 60],
  // pressioni di ammissione per livello [bar]: fuori da questi campi il modello a zone del GVR non è significativo
  levels: { '3PRH': [[60, 185], [12, 60], [2, 12]], '2P': [[30, 185], [2, 15]], '1P': [[10, 120]] },
};

/**
 * Corregge i parametri di progetto fuori campo (in loco) e restituisce gli avvisi.
 * Il modello IF97 implementato copre p ≤ 200 bar nei corpi cilindrici (regione 3 inclusa).
 */
export function sanitizeConfig(cfg, ctx = {}) {
  const notes = [];
  const R = DESIGN_RANGES;
  const ref = defaultConfig(GT_PRESETS[cfg.gtName] ? cfg.gtName : undefined, STEAM_DEFAULTS[cfg.steam.type] ? cfg.steam.type : '3PRH');
  const clampAll = (obj, ranges, dflt) => {
    for (const [k, [lo, hi, label, unit, scale = 1]] of Object.entries(ranges)) {
      let v = obj[k];
      const u = unit ? ' ' + unit : '';
      const show = (x) => String(+(x * scale).toFixed(4)).replace('.', ',');
      if (!Number.isFinite(v)) { v = dflt[k]; notes.push(`${label}: valore non valido, ripristinato a ${show(v)}${u}.`); }
      else if (v < lo || v > hi) { const c = Math.min(hi, Math.max(lo, v)); notes.push(`${label}: valore riportato nel campo ammesso ${show(lo)}–${show(hi)}${u}.`); v = c; }
      obj[k] = v;
    }
  };
  clampAll(cfg.gt, R.gt, ref.gt);
  const { Trh: rTrh, ...rSteam } = R.steam;
  clampAll(cfg.steam, cfg.steam.type === '3PRH' ? R.steam : rSteam, ref.steam);
  clampAll(cfg.steam.condenser, R.condenser, ref.steam.condenser);
  if (!['water', 'air'].includes(cfg.steam.condenser.type)) cfg.steam.condenser.type = 'water';
  if (!['tower', 'once'].includes(cfg.steam.condenser.cooling)) cfg.steam.condenser.cooling = 'tower';
  cfg.nGT = Math.min(3, Math.max(1, Math.round(Number.isFinite(cfg.nGT) ? cfg.nGT : 1)));
  cfg.gasSupplyBar = Number.isFinite(cfg.gasSupplyBar) ? Math.min(R.gasSupplyBar[1], Math.max(R.gasSupplyBar[0], cfg.gasSupplyBar)) : 50;
  // l'evaporatore a passaggio singolo è previsto solo sul livello HP del ciclo a 3 livelli con RH
  if (cfg.steam.hpEvap === 'benson' && cfg.steam.type !== '3PRH') {
    cfg.steam.hpEvap = 'drum';
    notes.push('Evaporatore HP Benson disponibile solo con GVR a 3 livelli + RH: impostato a corpo cilindrico.');
  }
  if (cfg.steam.hpEvap !== 'benson') cfg.steam.hpEvap = 'drum';
  cfg.steam.pinch = cfg.steam.pinch.map((v, k) => (Number.isFinite(v) ? Math.min(R.pinch[1], Math.max(R.pinch[0], v)) : ref.steam.pinch[k]));
  const lv = cfg.steam.levels;
  lv.forEach((l, k) => {
    if (!Number.isFinite(l.p) || l.p <= 0) { l.p = ref.steam.levels[k].p; notes.push(`Pressione del livello ${k + 1}: valore non valido, ripristinata a ${l.p} bar.`); }
    if (!Number.isFinite(l.Tsh)) l.Tsh = ref.steam.levels[k].Tsh;
    l.Tsh = Math.min(LIMITS.TshMax, Math.max(R.Tsh[0], l.Tsh));
  });
  // La TG (già nei limiti) fissa la temperatura dei fumi: per evaporare a ogni livello la saturazione HP deve
  // restare sotto la temperatura di scarico, altrimenti la portata di vapore al progetto sarebbe nulla.
  ctx.fuel = fuelProperties(cfg.fuelComp);
  ctx.gtD = { ...cfg.gt, fuel: ctx.fuel };
  ctx.gtRef = gtDesign(ctx.gtD);
  const T4 = ctx.gtRef.T4iso;
  const n = lv.length;
  const pR = R.levels[cfg.steam.type] || lv.map(() => [R.pLevelMin, LIMITS.pHPmax]);
  const floor0 = R.pLevelMin * 2 ** (n - 1);
  const pTop = Math.max(floor0, Math.floor(psat(Math.min(370, Math.max(120, T4 - cfg.steam.pinch[0] - 40))) * 2) / 2);
  const bar = (v) => String(+v.toFixed(1)).replace('.', ',');
  for (let k = 0; k < n; k++) {
    // limite superiore: campo del livello, fumi (solo HP) e metà della pressione del livello superiore
    let hi = pR[k][1];
    if (k === 0) hi = Math.min(hi, pTop);
    else hi = Math.min(hi, lv[k - 1].p / 2);
    const lo = Math.min(pR[k][0], hi);
    if (lv[k].p > hi) {
      if (k === 0 && hi === pTop && pTop < pR[0][1]) notes.push(`Pressione ${n > 1 ? 'HP' : 'del vapore'} ridotta a ${bar(hi)} bar: fumi di scarico TG a ${T4.toFixed(0)} °C, troppo freddi per evaporare a pressione più alta.`);
      else if (k > 0 && hi < pR[k][1]) notes.push(`Pressione del livello ${k + 1} ridotta a ${bar(hi)} bar: deve essere inferiore alla metà di quella del livello superiore.`);
      else notes.push(`Pressione del livello ${k + 1}: valore riportato nel campo ammesso ${bar(lo)}–${bar(hi)} bar.`);
      lv[k].p = hi;
    } else if (lv[k].p < lo) {
      notes.push(`Pressione del livello ${k + 1}: valore riportato nel campo ammesso ${bar(lo)}–${bar(hi)} bar.`);
      lv[k].p = lo;
    }
  }
  void rTrh;
  return notes;
}

const REQUIRED_BANKS = {
  '3PRH': ['SH HP', 'RH', 'EVA HP', 'SH IP', 'ECO HP', 'EVA IP', 'SH LP', 'ECO IP', 'EVA LP', 'PRE (condensato)'],
  '2P': ['SH HP', 'EVA HP', 'SH LP', 'ECO HP', 'EVA LP', 'PRE (condensato)'],
  '1P': ['SH HP', 'EVA HP', 'PRE (condensato)'],
};

/** Anomalie di un punto di progetto: livelli senza produzione di vapore e banchi senza scambio. */
export function designIssues(type, bt) {
  const mTot = bt.mLevels.reduce((a, b) => a + b, 0);
  const idleLevels = bt.names.filter((_, k) => !(bt.mLevels[k] > Math.max(0.05, 0.002 * mTot)));
  const have = new Set(bt.banks.map((b) => b.name));
  const missingBanks = (REQUIRED_BANKS[type] || []).filter((nm) => !have.has(nm));
  return { idleLevels, missingBanks };
}

/** Calcola i riferimenti di progetto (punto ISO a pieno carico). */
export function designPlant(cfg) {
  const ctx = {};
  const notes = sanitizeConfig(cfg, ctx);
  const { fuel, gtD, gtRef } = ctx;
  const op = { ...defaultOperation(), ...ISO, load: 1, nGTon: cfg.nGT, Tcw: cfg.steam.condenser.TcwDesign, ductT: 0 };
  const gtp = gtRef.point;
  const gas = { m: gtp.mExh, x: gtp.xExh, T: gtp.T4 };
  const bt = solveBottoming(cfg.steam, gas, { Tcw: op.Tcw, Tamb: op.Tamb }, { nHRSG: cfg.nGT, ref: null });
  const stRef = {
    pAdm: bt.pAdm,
    pCond: bt.pCond,
    Qcond: bt.Qcond,
    mLevels: bt.mLevels,
    sections: bt.sections.map((s) => ({ m: s.m, Tin: s.Tin })),
    lpArea: bt.lpArea,
  };
  const mcw = (bt.Qcond * 1000) / (4.18 * cfg.steam.condenser.dTcw); // kg/s acqua di raffreddamento
  // livelli o banchi senza scambio al punto di progetto: la simulazione prosegue, ma il progetto del GVR
  // non è significativo (e gli elaborati di ingegneria non sono generabili)
  const issues = designIssues(cfg.steam.type, bt);
  if (issues.idleLevels.length) notes.push(`Al punto di progetto ${issues.idleLevels.length > 1 ? 'i livelli' : 'il livello'} ${issues.idleLevels.join(', ')} non produc${issues.idleLevels.length > 1 ? 'ono' : 'e'} vapore (fumi troppo freddi o vincoli di pinch e temperatura al camino): rivedere pressioni, pinch e temperatura minima al camino.`);
  else if (issues.missingBanks.length) notes.push(`Al punto di progetto ${issues.missingBanks.length > 1 ? 'i banchi' : 'il banco'} ${issues.missingBanks.join(', ')} non scambia${issues.missingBanks.length > 1 ? 'no' : ''} calore: dati di progetto ai limiti del modello (rivedere temperature di surriscaldamento, pressioni e pinch).`);
  return { fuel, gtD, gtRef, stRef, mcw, QcondD: bt.Qcond, notes, point: bt, idleLevels: issues.idleLevels, missingBanks: issues.missingBanks };
}

/** Calcola un punto di funzionamento dell'impianto. */
export function plantPoint(cfg, des, opIn) {
  const op = sanitizeOperation(opIn);
  const amb = { T: op.Tamb, p: op.pamb, rh: op.rh };
  const nOn = Math.max(0, Math.min(op.nGTon ?? cfg.nGT, cfg.nGT));
  const fuel = des.fuel;
  const warnings = [];

  if (nOn === 0 || op.load <= 0) return offlinePoint(cfg, op);

  const gt = gtAtLoad(des.gtD, des.gtRef, amb, op.load);

  // Post-combustione nel condotto (per GVR)
  let gas = { m: gt.mExh, x: gt.xExh, T: gt.T4 };
  let mFuelDB = 0;
  if (op.ductT && op.ductT > gt.T4 + 1) {
    const db = fuelForTemperature({ m: gas.m, x: gas.x, T: gas.T }, fuel, op.ductT, { eta: 0.995, Tfuel: 25 });
    if (db.prod.o2Deficit) warnings.push('Ossigeno insufficiente per la post-combustione richiesta.');
    mFuelDB = db.mf;
    gas = { m: db.prod.m, x: db.prod.x, T: op.ductT };
  }

  const bt = solveBottoming(cfg.steam, gas, { Tcw: op.Tcw, Tamb: op.Tamb }, {
    nHRSG: nOn, ref: des.stRef, slidingHP: op.slidingHP,
  });

  // Ausiliari
  const Pgt = gt.P * nOn;
  const Pst = bt.Pst;
  const gross = Pgt + Pst;
  const cond = cfg.steam.condenser;
  let Pcool;
  if (cond.type === 'air') Pcool = cfg.aux.fanFrac * des.QcondD * Math.min(1.1, Math.max(0.4, bt.Qcond / des.QcondD));
  else {
    const a = cfg.aux;
    const once = cond.cooling === 'once';
    const Pmcw = (des.mcw * (once ? a.cwHeadOnceBar ?? 1.2 : a.cwHeadBar ?? 2.0) * 100) / 1000 / 0.85 / 1000; // MW, portata acqua costante
    const Pfan = once ? 0 : (a.ctFanFrac ?? 0) * des.QcondD; // ventilatori torre a velocità fissa
    const mAcw = ((a.ccwFrac ?? 0) * gross * 1000) / (4.18 * 10); // kg/s acqua ausiliaria agli intercooler
    const Pacw = (mAcw * (once ? a.acwHeadOnceBar ?? 2.0 : a.acwHeadBar ?? 3.0) * 100) / 1000 / 0.8 / 1000;
    Pcool = Pmcw + Pfan + Pacw;
  }
  // compressore gas se la pressione di rete non basta
  // la pressione richiesta ai TG è quella di progetto (pieno carico ISO), non quella del punto corrente
  const gst = gasStation(cfg, des.gtRef.point.p2, (gt.mFuel + mFuelDB) * nOn);
  const PgasComp = gst.compressor ? gst.compressor.kW / 1000 : 0;
  const Pmisc = cfg.aux.miscFrac * gross + cfg.aux.gtAuxMW * nOn + PgasComp;
  const Paux = bt.Ppump + Pcool + Pmisc;
  const Ptrafo = cfg.aux.trafoFrac * gross;
  const net = gross - Paux - Ptrafo;

  const QfuelGT = gt.Qfuel * nOn;
  const QfuelDB = (mFuelDB * fuel.lhv) / 1000 * nOn;
  const Qfuel = QfuelGT + QfuelDB;
  const mFuelTot = (gt.mFuel + mFuelDB) * nOn;
  const eta = net / Qfuel;
  const co2 = mFuelTot * fuel.co2PerKg * 3.6; // t/h

  // Bilancio energetico
  const mStack = gas.m * nOn;
  const stackLoss = (mStack * gasH(gas.x, bt.Tstack) - gt.mAir * nOn * gasH(gt.air, op.Tamb)) / 1000;
  const otherLoss = Qfuel - gross - stackLoss - bt.Qcond;

  // Economia: il prezzo del gas è riferito al PCS (convenzione dei mercati TTF/PSV)
  const fuelCost = (op.gasPrice * fuel.hhvToLhv) / eta; // €/MWh el
  const co2Spec = co2 / net; // t/MWh
  const co2Cost = co2Spec * op.co2Price;
  const margCost = fuelCost + co2Cost + op.omVar;
  const spread = op.powerPrice - margCost; // €/MWh
  const marginHour = spread * net; // €/h

  // Controlli e avvisi
  const lp = bt.sections[bt.sections.length - 1];
  if (lp.xOut < 0.86) warnings.push(`Umidità allo scarico TV elevata (x = ${lp.xOut.toFixed(3)}).`);
  if (bt.Tstack < cfg.steam.TstackMin + 0.5 && bt.TsubLP < bt.Tsat[bt.Tsat.length - 1] - cfg.steam.approach[cfg.steam.approach.length - 1] - 1)
    warnings.push('Temperatura fumi al camino al minimo: preriscaldo del condensato limitato.');
  if (gt.load < 0.4) warnings.push('Carico TG sotto il minimo tecnico ambientale tipico (~40%): emissioni di CO elevate.');
  if (gt.mode === 'Limite generatore') warnings.push('Potenza TG limitata dalla capacità del generatore.');
  if (bt.pCond >= 0.249) warnings.push('Pressione al condensatore oltre il limite di allarme (0,25 bar).');
  // verifica di realizzabilità dello scambio: in ogni banco i fumi devono restare più caldi dell'acqua
  const cross = bt.banks.find((k) => k.TgOut < k.TwIn - 1 || k.TgIn < k.TwOut - 1);
  if (cross) warnings.push(`GVR: scambio non realizzabile nel banco ${cross.name} (fumi più freddi del lato acqua). Dati di progetto o di esercizio incoerenti: risultati non attendibili.`);

  const xO2dry = gas.x.O2 / (1 - gas.x.H2O);

  return {
    online: true,
    op,
    nOn,
    gt,
    gas,
    mFuelDB: mFuelDB * nOn,
    bt,
    Pgt, Pst, gross, Paux, Ptrafo, net,
    aux: { pumps: bt.Ppump, cooling: Pcool, misc: Pmisc, gasComp: PgasComp },
    Qfuel, QfuelGT, QfuelDB, mFuelTot,
    eta, etaGross: gross / Qfuel, heatRate: 3600 / eta,
    co2, co2Spec: co2Spec * 1000, // kg/MWh
    stackO2dry: xO2dry * 100,
    stackLoss, otherLoss,
    econ: { fuelCost, co2Cost, om: op.omVar, margCost, spread, marginHour, cleanSpark: op.powerPrice - fuelCost - co2Cost },
    warnings,
    stackMolarMass: molarMass(gas.x),
  };
}

function offlinePoint(cfg, op) {
  return {
    online: false, op, nOn: 0, Pgt: 0, Pst: 0, gross: 0, Paux: cfg.aux.gtAuxMW * 0.5, Ptrafo: 0,
    net: -cfg.aux.gtAuxMW * 0.5, Qfuel: 0, eta: 0, warnings: [],
  };
}

export { LEVEL_NAMES, GT_PRESETS, GT_GROUPS, FUEL_PRESETS };
