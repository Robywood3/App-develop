// Integrazione dell'impianto a ciclo combinato: N turbine a gas, ciascuna con il
// proprio GVR, una turbina a vapore comune, ausiliari, emissioni ed economia.

import { fuelProperties, FUEL_PRESETS, fuelForTemperature, gasH, molarMass } from './gas.js';
import { GT_PRESETS, GT_GROUPS, gtDesign, gtAtLoad } from './gt.js';
import { solveBottoming, LEVEL_NAMES } from './bottoming.js';
import { gasStation } from './utilities.js';

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
      hpEvap: st?.hpEvap ?? 'drum',
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

/**
 * Corregge i parametri di progetto fuori campo (in loco) e restituisce gli avvisi.
 * Il modello IF97 implementato copre p ≤ 200 bar nei corpi cilindrici (regione 3 inclusa).
 */
export function sanitizeConfig(cfg) {
  const notes = [];
  const lv = cfg.steam.levels;
  if (lv[0].p > LIMITS.pHPmax) {
    notes.push(`Pressione HP limitata a ${LIMITS.pHPmax} bar (campo di validità del modello).`);
    lv[0].p = LIMITS.pHPmax;
  }
  for (let k = 1; k < lv.length; k++) {
    const pMax = lv[k - 1].p / 2;
    if (lv[k].p > pMax) {
      notes.push(`Pressione del livello ${k + 1} ridotta a ${pMax.toFixed(1)} bar: deve essere inferiore alla metà di quella del livello superiore.`);
      lv[k].p = pMax;
    }
  }
  for (const l of lv) {
    l.p = Math.max(l.p, 1.5);
    l.Tsh = Math.min(l.Tsh, LIMITS.TshMax);
  }
  cfg.steam.Trh = Math.min(cfg.steam.Trh, LIMITS.TshMax);
  return notes;
}

/** Calcola i riferimenti di progetto (punto ISO a pieno carico). */
export function designPlant(cfg) {
  const notes = sanitizeConfig(cfg);
  const fuel = fuelProperties(cfg.fuelComp);
  const gtD = { ...cfg.gt, fuel };
  const gtRef = gtDesign(gtD);
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
  return { fuel, gtD, gtRef, stRef, mcw, QcondD: bt.Qcond, notes, point: bt };
}

/** Calcola un punto di funzionamento dell'impianto. */
export function plantPoint(cfg, des, op) {
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
  const gst = gasStation(cfg, gt.p2, (gt.mFuel + mFuelDB) * nOn);
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
