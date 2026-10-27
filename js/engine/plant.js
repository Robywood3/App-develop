// Integrazione dell'impianto a ciclo combinato: N turbine a gas, ciascuna con il
// proprio GVR, una turbina a vapore comune, ausiliari, emissioni ed economia.

import { fuelProperties, FUEL_PRESETS, fuelForTemperature, gasH, molarMass } from './gas.js';
import { GT_PRESETS, gtDesign, gtAtLoad } from './gt.js';
import { solveBottoming, LEVEL_NAMES } from './bottoming.js';

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

export const LIMITS = { pHPmax: 150, TshMax: 600 };

/** Configurazione predefinita dell'impianto. */
export function defaultConfig(gtName = 'Classe F (~300 MW)', type = '3PRH') {
  const s = JSON.parse(JSON.stringify(STEAM_DEFAULTS[type]));
  const cls = CLASS_STEAM_3PRH[gtName];
  if (type === '3PRH' && cls) {
    s.levels[0] = { p: cls.hp, Tsh: cls.tsh };
    s.levels[1].p = cls.ip;
    s.Trh = cls.trh;
  }
  return {
    gtName,
    gt: { ...GT_PRESETS[gtName] },
    fuelName: 'Gas naturale tipico (rete IT)',
    fuelComp: { ...FUEL_PRESETS['Gas naturale tipico (rete IT)'] },
    nGT: 1,
    steam: {
      type,
      levels: s.levels.map((l) => ({ ...l })),
      pinch: s.pinch.slice(),
      approach: s.approach.slice(),
      Trh: s.Trh,
      dTsh: 25,
      dpSH: 0.06,
      dpRH: 0.08,
      hrsgLoss: 0.005,
      TstackMin: 70,
      TwPreMin: 55,
      etaHP: 0.87,
      etaIP: 0.91,
      etaLP: 0.89,
      etaMG: 0.985,
      etaPump: 0.8,
      pMinFracHP: 0.4,
      condenser: { type: 'water', TcwDesign: 18, dTcw: 10, TTD: 3, ITD: 28 },
    },
    aux: { miscFrac: 0.004, trafoFrac: 0.003, gtAuxMW: 0.8, cwHeadBar: 2.5, fanFrac: 0.012 },
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
 * Il modello IF97 implementato copre p ≤ 165 bar nei corpi cilindrici.
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
  else Pcool = (des.mcw * cfg.aux.cwHeadBar * 100) / 1000 / 0.85 / 1000; // MW, portata acqua costante
  const Pmisc = cfg.aux.miscFrac * gross + cfg.aux.gtAuxMW * nOn;
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
    aux: { pumps: bt.Ppump, cooling: Pcool, misc: Pmisc },
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

export { LEVEL_NAMES, GT_PRESETS, FUEL_PRESETS };
