// Proprietà termodinamiche di aria e fumi come miscele di gas ideali
// (N2, O2, Ar, CO2, H2O) con coefficienti di Shomate (NIST Webbook) e
// modello di combustione del gas naturale.
// Unità: T [°C], h [kJ/kg] sensibile riferita a 25 °C, s0 [kJ/(kg·K)].

import { psat } from './steam.js';

const TREF = 298.15;
const R_U = 8.314462618; // J/(mol·K)

export const SPECIES = ['N2', 'O2', 'Ar', 'CO2', 'H2O'];

const MW = { N2: 28.0134, O2: 31.9988, Ar: 39.948, CO2: 44.0095, H2O: 18.01528 };

// Segmenti [Tmax, A, B, C, D, E]; cp [J/(mol·K)] = A + B t + C t² + D t³ + E/t², t = T/1000.
const SHOMATE = {
  N2: [
    [500, 28.98641, 1.853978, -9.647459, 16.63537, 0.000117],
    [2000, 19.50583, 19.88705, -8.598535, 1.369784, 0.527601],
    [6000, 35.51872, 1.128728, -0.196103, 0.014662, -4.55376],
  ],
  O2: [
    [700, 31.32234, -20.23531, 57.86644, -36.50624, -0.007374],
    [2000, 30.03235, 8.772972, -3.988133, 0.788313, -0.741599],
    [6000, 20.91111, 10.72071, -2.020498, 0.146449, 9.245722],
  ],
  Ar: [[6000, 20.786, 0, 0, 0, 0]],
  CO2: [
    [1200, 24.99735, 55.18696, -33.69137, 7.948387, -0.136638],
    [6000, 58.16639, 2.720074, -0.492289, 0.038844, -6.447293],
  ],
  H2O: [
    [1700, 30.092, 6.832514, 6.793435, -2.53448, 0.082139],
    [6000, 41.96426, 8.622053, -1.49978, 0.098119, -11.15764],
  ],
};

const cpSeg = (c, t) => c[1] + c[2] * t + c[3] * t * t + c[4] * t * t * t + c[5] / (t * t);
// ∫cp dT in kJ/mol
const hSeg = (c, t) => c[1] * t + (c[2] * t * t) / 2 + (c[3] * t ** 3) / 3 + (c[4] * t ** 4) / 4 - c[5] / t;
// ∫cp/T dT in J/(mol·K)
const sSeg = (c, t) => c[1] * Math.log(t) + c[2] * t + (c[3] * t * t) / 2 + (c[4] * t ** 3) / 3 - c[5] / (2 * t * t);

// Costanti di continuità per ogni segmento, con zero a TREF.
const OFFSETS = {};
for (const sp of SPECIES) {
  const segs = SHOMATE[sp];
  const off = [];
  let hAcc = 0, sAcc = 0;
  // segmento che contiene TREF
  const k0 = segs.findIndex((s) => TREF <= s[0]);
  off[k0] = { h: -hSeg(segs[k0], TREF / 1000), s: -sSeg(segs[k0], TREF / 1000) };
  for (let k = k0 + 1; k < segs.length; k++) {
    const tb = segs[k - 1][0] / 1000;
    hAcc = hSeg(segs[k - 1], tb) + off[k - 1].h;
    sAcc = sSeg(segs[k - 1], tb) + off[k - 1].s;
    off[k] = { h: hAcc - hSeg(segs[k], tb), s: sAcc - sSeg(segs[k], tb) };
  }
  for (let k = k0 - 1; k >= 0; k--) {
    const tb = segs[k][0] / 1000;
    hAcc = hSeg(segs[k + 1], tb) + off[k + 1].h;
    sAcc = sSeg(segs[k + 1], tb) + off[k + 1].s;
    off[k] = { h: hAcc - hSeg(segs[k], tb), s: sAcc - sSeg(segs[k], tb) };
  }
  OFFSETS[sp] = off;
}

function segIndex(sp, T) {
  const segs = SHOMATE[sp];
  for (let k = 0; k < segs.length; k++) if (T <= segs[k][0]) return k;
  return segs.length - 1;
}

function speciesH(sp, T) {
  const k = segIndex(sp, T);
  return hSeg(SHOMATE[sp][k], T / 1000) + OFFSETS[sp][k].h; // kJ/mol
}
function speciesS(sp, T) {
  const k = segIndex(sp, T);
  return sSeg(SHOMATE[sp][k], T / 1000) + OFFSETS[sp][k].s; // J/(mol·K)
}
function speciesCp(sp, T) {
  return cpSeg(SHOMATE[sp][segIndex(sp, T)], T / 1000); // J/(mol·K)
}

// ------------------------------------------------------------- Miscele
/** Normalizza le frazioni molari di una miscela. */
export function normalize(x) {
  let sum = 0;
  for (const sp of SPECIES) sum += x[sp] || 0;
  const out = {};
  for (const sp of SPECIES) out[sp] = (x[sp] || 0) / sum;
  return out;
}

export function molarMass(x) {
  let m = 0;
  for (const sp of SPECIES) m += x[sp] * MW[sp];
  return m; // g/mol = kg/kmol
}

export function gasR(x) {
  return R_U / molarMass(x); // kJ/(kg·K)
}

export function gasH(x, TC) {
  const T = TC + 273.15;
  let h = 0;
  for (const sp of SPECIES) if (x[sp]) h += x[sp] * speciesH(sp, T);
  return (h * 1000) / molarMass(x);
}

export function gasCp(x, TC) {
  const T = TC + 273.15;
  let c = 0;
  for (const sp of SPECIES) if (x[sp]) c += x[sp] * speciesCp(sp, T);
  return c / molarMass(x);
}

/** Parte dipendente dalla temperatura dell'entropia, φ(T) [kJ/(kg·K)]. */
export function gasPhi(x, TC) {
  const T = TC + 273.15;
  let s = 0;
  for (const sp of SPECIES) if (x[sp]) s += x[sp] * speciesS(sp, T);
  return s / molarMass(x);
}

/** Temperatura [°C] corrispondente all'entalpia h [kJ/kg]. */
export function gasT(x, h, guess = 500) {
  let T = guess;
  for (let k = 0; k < 40; k++) {
    const dT = (h - gasH(x, T)) / gasCp(x, T);
    T += dT;
    if (Math.abs(dT) < 1e-6) break;
  }
  return T;
}

/** Temperatura dopo una trasformazione isoentropica da (T1, p1) a p2. */
export function isentropicT(x, T1, p1, p2) {
  const target = gasPhi(x, T1) + gasR(x) * Math.log(p2 / p1);
  let T = (T1 + 273.15) * Math.pow(p2 / p1, 0.28) - 273.15;
  for (let k = 0; k < 40; k++) {
    const dT = ((target - gasPhi(x, T)) * (T + 273.15)) / gasCp(x, T);
    T += dT;
    if (Math.abs(dT) < 1e-6) break;
  }
  return T;
}

/** Aria umida: frazioni molari dati T [°C], p [bar], umidità relativa [0-1]. */
export function humidAir(TC, pBar, rh) {
  const xw = Math.min(0.2, (rh * psat(TC)) / pBar);
  const dry = { N2: 0.78084, O2: 0.209476, Ar: 0.00934, CO2: 0.000412 };
  const sd = dry.N2 + dry.O2 + dry.Ar + dry.CO2;
  const x = { H2O: xw };
  for (const k of Object.keys(dry)) x[k] = (dry[k] / sd) * (1 - xw);
  return normalize(x);
}

/** Miscelazione adiabatica di due correnti gassose. */
export function mixStreams(a, b) {
  const na = a.m / molarMass(a.x);
  const nb = b.m / molarMass(b.x);
  const x = {};
  for (const sp of SPECIES) x[sp] = (na * a.x[sp] + nb * b.x[sp]) / (na + nb);
  const m = a.m + b.m;
  const h = (a.m * gasH(a.x, a.T) + b.m * gasH(b.x, b.T)) / m;
  return { m, x, T: gasT(x, h, (a.T * a.m + b.T * b.m) / m) };
}

// ------------------------------------------------------------ Combustibile
// massa molare [kg/kmol], PCI e PCS [kJ/mol], atomi di C e H
const FUEL_SPECIES = {
  CH4: { M: 16.043, lhv: 802.3, hhv: 890.6, C: 1, H: 4 },
  C2H6: { M: 30.07, lhv: 1428.6, hhv: 1560.7, C: 2, H: 6 },
  C3H8: { M: 44.097, lhv: 2043.1, hhv: 2219.2, C: 3, H: 8 },
  C4H10: { M: 58.123, lhv: 2657.3, hhv: 2877.5, C: 4, H: 10 },
  CO2: { M: 44.0095, lhv: 0, hhv: 0, C: 1, H: 0, inertCO2: true },
  N2: { M: 28.0134, lhv: 0, hhv: 0, C: 0, H: 0, inertN2: true },
};

export const FUEL_PRESETS = {
  'Gas naturale tipico (rete IT)': { CH4: 0.925, C2H6: 0.04, C3H8: 0.01, C4H10: 0.003, CO2: 0.007, N2: 0.015 },
  'Metano puro': { CH4: 1 },
  'Gas naturale povero (alto N2)': { CH4: 0.84, C2H6: 0.03, C3H8: 0.005, C4H10: 0, CO2: 0.015, N2: 0.11 },
};

/** Caratteristiche derivate di una composizione di combustibile (frazioni molari). */
export function fuelProperties(comp) {
  let sum = 0;
  for (const k of Object.keys(comp)) sum += comp[k];
  let M = 0, lhv = 0, hhv = 0, o2 = 0, co2 = 0, h2o = 0, n2 = 0;
  for (const k of Object.keys(comp)) {
    const y = comp[k] / sum;
    const f = FUEL_SPECIES[k];
    M += y * f.M;
    lhv += y * f.lhv;
    hhv += y * f.hhv;
    if (f.inertCO2) co2 += y;
    else if (f.inertN2) n2 += y;
    else {
      o2 += y * (f.C + f.H / 4);
      co2 += y * f.C;
      h2o += (y * f.H) / 2;
    }
  }
  return {
    M,
    lhvMolar: lhv, // kJ/mol
    lhv: (lhv / M) * 1000, // kJ/kg
    hhv: (hhv / M) * 1000, // kJ/kg
    hhvToLhv: hhv / lhv,
    o2PerMol: o2,
    co2PerMol: co2,
    h2oPerMol: h2o,
    n2PerMol: n2,
    co2PerKg: (co2 * 44.0095) / M, // kg CO2 / kg combustibile
  };
}

/** Prodotti della combustione completa di mf [kg/s] di combustibile in un ossidante. */
export function burn(ox, fuel, mf) {
  const no = ox.m / molarMass(ox.x); // kmol/s
  const nf = mf / fuel.M;
  const moles = {};
  for (const sp of SPECIES) moles[sp] = no * ox.x[sp];
  moles.O2 -= nf * fuel.o2PerMol;
  moles.CO2 += nf * fuel.co2PerMol;
  moles.H2O += nf * fuel.h2oPerMol;
  moles.N2 += nf * fuel.n2PerMol;
  const deficit = moles.O2 < 0;
  if (deficit) moles.O2 = 0;
  return { x: normalize(moles), m: ox.m + mf, o2Deficit: deficit };
}

/**
 * Portata di combustibile necessaria per portare l'ossidante a Tout.
 * Bilancio: m_ox·h_ox(Tin) + m_f·(h_f + η·PCI) = (m_ox+m_f)·h_prod(Tout).
 */
export function fuelForTemperature(ox, fuel, Tout, { eta = 0.998, Tfuel = 25 } = {}) {
  const hox = gasH(ox.x, ox.T);
  const hf = 2.2 * (Tfuel - 25);
  let f = 0.02;
  let prod = burn(ox, fuel, f * ox.m);
  for (let k = 0; k < 8; k++) {
    const hp = gasH(prod.x, Tout);
    f = (hp - hox) / (hf + eta * fuel.lhv - hp);
    if (f < 0) f = 0;
    prod = burn(ox, fuel, f * ox.m);
  }
  return { mf: f * ox.m, prod: { ...prod, T: Tout } };
}
