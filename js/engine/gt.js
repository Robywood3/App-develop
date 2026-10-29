// Modello della turbina a gas (ciclo Brayton) con:
// - compressore e turbina con rendimenti isoentropici;
// - aria di raffreddamento (quota statorica miscelata prima dell'espansione,
//   quota rotorica a metà espansione);
// - comportamento fuori progetto con portata corretta e turbina in blocco sonico
//   (m·√(R·T)/p = cost.);
// - regolazione a carico parziale: chiusura IGV a temperatura di scarico costante,
//   poi riduzione della temperatura di combustione.

import { gasH, gasT, gasR, isentropicT, humidAir, mixStreams, fuelForTemperature } from './gas.js';

const P_ISO = 1.01325;
const T_ISO = 15;

const GT_PRESETS_BASE = {
  'Classe F (~300 MW)': {
    mAirISO: 660, PR: 18.5, TIT: 1480, coolFrac: 0.19, etaC: 0.885, etaT: 0.905,
    dpInlet: 10, dpExhaust: 32, dpComb: 0.04, etaMG: 0.986, TETiso: 640, igvMin: 0.62,
    Tfuel: 185, etaComb: 0.998, PmaxFactor: 1.12, freq: 50,
  },
  'Classe H/J (~450 MW)': {
    mAirISO: 840, PR: 23.5, TIT: 1600, coolFrac: 0.2, etaC: 0.9, etaT: 0.915,
    dpInlet: 10, dpExhaust: 35, dpComb: 0.04, etaMG: 0.988, TETiso: 655, igvMin: 0.6,
    Tfuel: 200, etaComb: 0.999, PmaxFactor: 1.1, freq: 50,
  },
  'Classe E (~170 MW)': {
    mAirISO: 480, PR: 13, TIT: 1260, coolFrac: 0.14, etaC: 0.875, etaT: 0.895,
    dpInlet: 10, dpExhaust: 30, dpComb: 0.035, etaMG: 0.984, TETiso: 590, igvMin: 0.68,
    Tfuel: 25, etaComb: 0.997, PmaxFactor: 1.12, freq: 50,
  },
};
const H_BASE = GT_PRESETS_BASE['Classe H/J (~450 MW)'];

// Modelli commerciali di riferimento (documento "Centrali a ciclo combinato", sez. 5 e 6).
// 50 Hz: potenza, rendimento lordo e temperatura di scarico ISO da scheda OEM; portata d'aria,
// TIT e rendimento di espansione ricavati per taratura (la portata fumi risulta ~4 % sopra il
// dato di catalogo, che non include le perdite termiche verso i refrigeranti dell'aria di raffreddamento).
// SGT5-8000H: rendimento 41 % e scarico 630 °C stimati. 60 Hz: stessa termodinamica della
// "sorella" a 50 Hz con portata ridotta (pale più corte per contenere la forza centrifuga a 3600 giri/min).
// ref: prestazioni dichiarate del ciclo combinato 1+1 / 2+1 (MW, % PCI) e base (lordo/netto).
const GT_MODELS = {
  'Siemens SGT5-9000HL (593 MW)': { ...H_BASE, mAirISO: 1041.2, PR: 24, TIT: 1670.5, etaT: 0.8973, TETiso: 700, freq: 50, rampMWmin: 85, ref: {cc11: 880, eta11: 64.0, basis: 'lordo', cc21: 1750} },
  'Mitsubishi M701JAC (574 MW)': { ...H_BASE, mAirISO: 1035, PR: 23, TIT: 1628.6, etaT: 0.9089, TETiso: 675, freq: 50, rampMWmin: 66, ref: {cc11: 840, eta11: 64.0, basis: 'lordo'} },
  'GE Vernova 9HA.02 (571 MW)': { ...H_BASE, mAirISO: 1015, PR: 23.8, TIT: 1634.4, etaT: 0.9129, TETiso: 670, freq: 50, rampMWmin: 88, ref: {cc11: 838, eta11: 64.1, basis: 'netto', cc21: 1680, eta21: 64.3} },
  'GE Vernova 9HA.01 (448 MW)': { ...H_BASE, mAirISO: 834.3, PR: 21.8, TIT: 1600.3, etaT: 0.9093, TETiso: 670, freq: 50, rampMWmin: 65, ref: {cc11: 680, eta11: 63.7, basis: 'netto', cc21: 1363, eta21: 63.8} },
  'Ansaldo GT36-S5 (563 MW)': { ...H_BASE, mAirISO: 1082, PR: 25, TIT: 1589.7, etaT: 0.8961, TETiso: 650, freq: 50, ref: {cc11: 800, eta11: 62.6, basis: 'netto', cc21: 1600, eta21: 62.8} },
  'Siemens SGT5-8000H (450 MW)': { ...H_BASE, mAirISO: 925.8, PR: 19.2, TIT: 1529.6, etaT: 0.9008, TETiso: 660, freq: 50 },
  'Siemens SGT5-4000F (329 MW)': { ...GT_PRESETS_BASE['Classe F (~300 MW)'], mAirISO: 713.5, freq: 50 },
  'Siemens SGT5-2000E (198 MW)': { ...GT_PRESETS_BASE['Classe E (~170 MW)'], mAirISO: 556.3, freq: 50 },
  'Siemens SGT6-9000HL (440 MW)': { ...H_BASE, mAirISO: 772.6, PR: 24, TIT: 1670.5, etaT: 0.8973, TETiso: 700, freq: 60 },
  'Siemens SGT6-8000H (310 MW)': { ...H_BASE, mAirISO: 637.8, PR: 19.2, TIT: 1529.6, etaT: 0.9008, TETiso: 660, freq: 60 },
  'Siemens SGT6-5000F (260 MW)': { ...GT_PRESETS_BASE['Classe F (~300 MW)'], mAirISO: 563.8, freq: 60 },
  'Siemens SGT6-2000E (119 MW)': { ...GT_PRESETS_BASE['Classe E (~170 MW)'], mAirISO: 334.3, freq: 60 },
  'GE Vernova 7HA.03 (430 MW)': { ...H_BASE, mAirISO: 764.4, PR: 23.8, TIT: 1634.4, etaT: 0.9129, TETiso: 670, freq: 60, ref: {eta11: 63.5, basis: 'netto'} },
  'GE Vernova 7HA.01 (290 MW)': { ...H_BASE, mAirISO: 540, PR: 21.8, TIT: 1600.3, etaT: 0.9093, TETiso: 670, freq: 60, ref: {eta11: 63.0, basis: 'netto'} },
};

export const GT_PRESETS = { ...GT_PRESETS_BASE, ...GT_MODELS };

/** Raggruppamento per il selettore: classi generiche e modelli commerciali per frequenza di rete. */
export const GT_GROUPS = [
  ['Classi generiche', Object.keys(GT_PRESETS_BASE)],
  ['Modelli 50 Hz (3000 giri/min)', Object.keys(GT_MODELS).filter((k) => GT_MODELS[k].freq === 50)],
  ['Modelli 60 Hz (3600 giri/min)', Object.keys(GT_MODELS).filter((k) => GT_MODELS[k].freq === 60)],
];

const NOZZLE_SHARE = 0.6; // quota dell'aria di raffreddamento miscelata prima dello statore

/**
 * Calcola un punto di funzionamento della TG.
 * @param {object} d parametri di progetto della TG (vedi GT_PRESETS) + fuel
 * @param {object} amb {T, p, rh} condizioni ambiente [°C, bar, -]
 * @param {object} op {igv, TIT} posizione IGV (frazione di portata) e temperatura di combustione
 * @param {object|null} ref riferimento di progetto per il funzionamento fuori progetto
 */
export function gtPoint(d, amb, op, ref = null) {
  const air = humidAir(amb.T, amb.p, amb.rh);
  const p1 = amb.p - d.dpInlet / 1000;
  const T1 = amb.T;
  const p4 = amb.p + d.dpExhaust / 1000;
  const igv = op.igv;

  // Portata d'aria: portata corretta m·√T/p costante a IGV fissati, ridotta inoltre
  // dalla diminuzione della velocità corretta N/√T quando l'aria è più calda.
  const thetaR = (T_ISO + 273.15) / (T1 + 273.15);
  const mAir = d.mAirISO * (p1 / (P_ISO - d.dpInlet / 1000)) * Math.sqrt(thetaR) * Math.pow(thetaR, 0.6) * igv;

  // Rendimento del compressore penalizzato dalla chiusura IGV.
  const etaC = d.etaC * (1 - 0.15 * (1 - igv) ** 2);

  let PR = ref ? d.PR * igv : d.PR;
  let res = null;
  for (let it = 0; it < 30; it++) {
    const p2 = p1 * PR;
    const T2s = isentropicT(air, T1, p1, p2);
    const h1 = gasH(air, T1);
    const h2 = h1 + (gasH(air, T2s) - h1) / etaC;
    const T2 = gasT(air, h2, T2s);

    const mCool = d.coolFrac * mAir;
    const mCombAir = mAir - mCool;
    const comb = fuelForTemperature({ m: mCombAir, x: air, T: T2 }, d.fuel, op.TIT, { eta: d.etaComb, Tfuel: d.Tfuel });
    const p3 = p2 * (1 - d.dpComb);

    // Miscelazione dell'aria di raffreddamento statorica -> temperatura ingresso rotore
    const rit = mixStreams({ m: comb.prod.m, x: comb.prod.x, T: op.TIT }, { m: mCool * NOZZLE_SHARE, x: air, T: T2 });

    // Turbina in blocco sonico: aggiorna il rapporto di compressione
    if (ref) {
      const p3new = ref.p3 * (rit.m / ref.mRit) * Math.sqrt(((rit.T + 273.15) * gasR(rit.x)) / ref.TRrit);
      const PRnew = p3new / (1 - d.dpComb) / p1;
      if (Math.abs(PRnew - PR) > 1e-6) {
        PR = PR + 0.8 * (PRnew - PR);
        continue;
      }
    }

    // Espansione in due tratti con miscelazione dell'aria rotorica
    const pm = Math.sqrt(p3 * p4);
    const hA0 = gasH(rit.x, rit.T);
    const TAs = isentropicT(rit.x, rit.T, p3, pm);
    const hA1 = hA0 - d.etaT * (hA0 - gasH(rit.x, TAs));
    const TA1 = gasT(rit.x, hA1, TAs);
    const mid = mixStreams({ m: rit.m, x: rit.x, T: TA1 }, { m: mCool * (1 - NOZZLE_SHARE), x: air, T: T2 });
    const hB0 = gasH(mid.x, mid.T);
    const TBs = isentropicT(mid.x, mid.T, pm, p4);
    const hB1 = hB0 - d.etaT * (hB0 - gasH(mid.x, TBs));
    const T4 = gasT(mid.x, hB1, TBs);

    const Wc = mAir * (h2 - h1) / 1000; // MW
    const Wt = (rit.m * (hA0 - hA1) + mid.m * (hB0 - hB1)) / 1000;
    const Pshaft = Wt - Wc;
    const P = Pshaft * d.etaMG;
    const Qfuel = (comb.mf * d.fuel.lhv) / 1000; // MW (PCI)

    res = {
      igv, TIT: op.TIT, PR, mAir, mFuel: comb.mf, mExh: mid.m, xExh: mid.x,
      T1, p1, T2, p2, p3, Trit: rit.T, T4, p4, Wc, Wt, P, Qfuel,
      eta: P / Qfuel, heatRate: (3600 / (P / Qfuel)),
      air, mRit: rit.m, TRrit: (rit.T + 273.15) * gasR(rit.x),
    };
    break;
  }
  return res;
}

/** Punto di progetto ISO della TG: definisce il riferimento per il fuori progetto. */
export function gtDesign(d) {
  const r = gtPoint(d, { T: T_ISO, p: P_ISO, rh: 0.6 }, { igv: 1, TIT: d.TIT }, null);
  return { p3: r.p3, mRit: r.mRit, TRrit: r.TRrit, Piso: r.P, T4iso: r.T4, point: r };
}

// Ricerca di radice con regula falsi (variante Illinois) su funzione monotona.
function solveMonotone(f, a, b, tol = 1e-4, maxIt = 40) {
  let fa = f(a), fb = f(b);
  if (fa * fb > 0) return Math.abs(fa) < Math.abs(fb) ? a : b;
  let side = 0, c = a;
  for (let i = 0; i < maxIt; i++) {
    c = (a * fb - b * fa) / (fb - fa);
    const fc = f(c);
    if (Math.abs(fc) < tol || Math.abs(b - a) < tol * 1e-3) break;
    if (fc * fb > 0) {
      b = c; fb = fc;
      if (side === -1) fa /= 2;
      side = -1;
    } else {
      a = c; fa = fc;
      if (side === 1) fb /= 2;
      side = 1;
    }
  }
  return c;
}

/**
 * Punto di funzionamento della TG a un dato carico relativo (rispetto al carico
 * base alle condizioni ambiente attuali), secondo la logica di regolazione.
 */
export function gtAtLoad(d, ref, amb, load) {
  const Pmax = ref.Piso * d.PmaxFactor;
  const point = (igv, TIT) => gtPoint(d, amb, { igv, TIT }, ref);

  // TIT che rispetta il limite di temperatura allo scarico per una data apertura IGV
  const titAtIgv = (igv, TETlim) => {
    const hot = point(igv, d.TIT);
    if (hot.T4 <= TETlim) return { TIT: d.TIT, pt: hot };
    const TIT = solveMonotone((t) => point(igv, t).T4 - TETlim, 700, d.TIT, 0.05);
    return { TIT, pt: point(igv, TIT) };
  };

  // Carico base: IGV aperti, TIT di progetto, limiti su scarico e potenza generatore.
  let base = titAtIgv(1, Math.max(d.TETiso, ref.T4iso + 5)).pt;
  if (base.P > Pmax) {
    const TIT = solveMonotone((t) => point(1, t).P - Pmax, 700, base.TIT, 0.01);
    base = point(1, TIT);
  }
  if (load >= 0.9999) return { ...base, load: 1, Pbase: base.P, mode: base.P >= Pmax - 0.1 ? 'Limite generatore' : 'Carico base' };

  const target = Math.max(0.02, load) * base.P;
  const atIgvMin = titAtIgv(d.igvMin, d.TETiso);
  if (target >= atIgvMin.pt.P) {
    // Regolazione IGV a temperatura di scarico (isoterma)
    const igv = solveMonotone((g) => titAtIgv(g, d.TETiso).pt.P - target, d.igvMin, 1, 0.01);
    const r = titAtIgv(igv, d.TETiso).pt;
    return { ...r, load: r.P / base.P, Pbase: base.P, mode: 'Regolazione IGV' };
  }
  // IGV al minimo: riduzione della temperatura di combustione
  const TIT = solveMonotone((t) => point(d.igvMin, t).P - target, 500, atIgvMin.TIT, 0.01);
  const r = point(d.igvMin, TIT);
  return { ...r, load: r.P / base.P, Pbase: base.P, mode: 'Riduzione TIT' };
}
