// Ciclo a vapore sottoposto: generatore di vapore a recupero (GVR) a 1, 2 o 3
// livelli di pressione con risurriscaldamento opzionale, turbina a vapore a più
// sezioni, condensatore ad acqua o aerocondensatore, pompe.
//
// Il GVR è risolto con il metodo dei pinch point: il lato fumi è diviso in zone
// delimitate dalle uscite degli evaporatori (T_sat + pinch); in ogni zona il
// bilancio energetico fornisce la portata di vapore del livello corrispondente.

import { gasH, gasT } from './gas.js';
import { Tsat, psat, satP, hPT, propsPH, propsPS, P_MAX_BAR } from './steam.js';

export const HRSG_TYPES = {
  '3PRH': '3 livelli + risurriscaldamento',
  '2P': '2 livelli',
  '1P': '1 livello',
};

export const LEVEL_NAMES = { '3PRH': ['HP', 'IP', 'LP'], '2P': ['HP', 'LP'], '1P': ['HP'] };

const P_COND_MIN = 0.02; // bar
const P_COND_MAX = 0.25;

function sectionName(type, k, n) {
  if (k === n - 1 && n > 1) return 'LP';
  if (k === 0) return 'HP';
  return 'IP';
}

// Espansione in una sezione di turbina; per l'ultima sezione considera
// la correzione di Baumann per l'umidità e la perdita allo scarico.
function expand(hin, pin, pout, eta, { wet = false, m = 0, area = 0 } = {}) {
  const sIn = propsPH(pin, hin).s;
  const iso = propsPS(pout, sIn);
  const dhs = hin - iso.h;
  let e = eta;
  let out = propsPH(pout, hin - e * dhs);
  if (wet) {
    const yIn = 1 - propsPH(pin, hin).x;
    for (let k = 0; k < 8; k++) {
      const yAvg = (yIn + (1 - out.x)) / 2;
      e = eta * (1 - yAvg);
      out = propsPH(pout, hin - e * dhs);
    }
  }
  let exhLoss = 0, vax = 0;
  if (area > 0) {
    vax = (m * out.v) / area;
    exhLoss = (0.85 * vax * vax) / 2 / 1000; // kJ/kg
  }
  return { out, hOut: out.h, ueep: out.h + exhLoss, eta: e, dhs, exhLoss, vax };
}

function partLoadEta(etaD, ratio) {
  const r = Math.min(Math.max(ratio, 0.05), 1.3);
  return etaD * (1 - 0.3 * (1 - r) ** 2);
}

/**
 * Risolve il ciclo a vapore per una data corrente di fumi.
 * @param {object} c configurazione del ciclo a vapore (vedi plant.js)
 * @param {object} gas {m, x, T} corrente di fumi all'ingresso GVR (per un GVR)
 * @param {object} cond {Tcw, Tamb} condizioni del pozzo freddo
 * @param {object} opt {nHRSG, ref, slidingHP}
 */
export function solveBottoming(c, gas, cond, opt) {
  const { ref = null, nHRSG = 1, slidingHP = true } = opt;
  const n = c.levels.length;
  const reheat = c.type === '3PRH';
  const names = LEVEL_NAMES[c.type];

  // Pressioni di ammissione (bar): progetto o valori iniziali per il fuori progetto
  let pAdm = ref ? ref.pAdm.slice() : c.levels.map((l) => l.p);
  let pCond = ref ? ref.pCond : 0.05;
  let result = null;
  const warm = {};

  for (let outer = 0; outer < 60; outer++) {
    const r = solveAtPressures(c, gas, pAdm, pCond, ref, nHRSG, reheat, names, warm);
    result = r;

    // --- aggiornamento pressioni
    let pCondNew;
    const Q = r.Qcond; // MW (totale)
    if (!ref) {
      const Ts = c.condenser.type === 'air'
        ? cond.Tamb + c.condenser.ITD
        : cond.Tcw + c.condenser.dTcw + c.condenser.TTD;
      pCondNew = psat(Ts);
    } else {
      const q = Q / ref.Qcond;
      const Ts = c.condenser.type === 'air'
        ? cond.Tamb + c.condenser.ITD * q
        : cond.Tcw + (c.condenser.dTcw + c.condenser.TTD) * q;
      pCondNew = psat(Ts);
    }
    pCondNew = Math.min(Math.max(pCondNew, P_COND_MIN), P_COND_MAX);

    let pAdmNew = pAdm.slice();
    if (ref) {
      for (let k = 0; k < n; k++) {
        const sec = r.sections[k];
        const sRef = ref.sections[k];
        let p = ref.pAdm[k] * (sec.m / sRef.m) * Math.sqrt((sec.Tin + 273.15) / (sRef.Tin + 273.15));
        // con RH la pressione di ammissione IP (a valle del RH) è proporzionale a quella
        // del risurriscaldamento freddo, quindi la legge si applica direttamente a pAdm[1]
        if (k === 0 && !slidingHP) p = Math.max(p, ref.pAdm[0]);
        const pMin = k === 0 ? ref.pAdm[0] * c.pMinFracHP : ref.pAdm[k] * 0.15;
        p = Math.min(Math.max(p, pMin), k === 0 ? Math.min(P_MAX_BAR * (1 - c.dpSH), ref.pAdm[0] * 1.25) : ref.pAdm[k] * 1.6);
        if (k === 0 && !slidingHP) p = Math.min(p, ref.pAdm[0]);
        // la pressione di un livello deve restare sopra quella del livello inferiore
        pAdmNew[k] = p;
      }
      for (let k = n - 2; k >= 0; k--) pAdmNew[k] = Math.max(pAdmNew[k], pAdmNew[k + 1] * 1.5);
    }

    let maxErr = Math.abs(pCondNew - pCond) / pCond;
    for (let k = 0; k < n; k++) maxErr = Math.max(maxErr, Math.abs(pAdmNew[k] - pAdm[k]) / pAdm[k]);
    const w = 0.6;
    pCond = pCond + w * (pCondNew - pCond);
    for (let k = 0; k < n; k++) pAdm[k] = pAdm[k] + w * (pAdmNew[k] - pAdm[k]);
    if (maxErr < 1e-5) break;
  }
  return result;
}

function solveAtPressures(c, gas, pAdm, pCond, ref, nHRSG, reheat, names, warm) {
  const n = c.levels.length;
  const mg = gas.m;
  const xg = gas.x;
  const keep = 1 - c.hrsgLoss;
  const hg = (T) => gasH(xg, T);

  // Pressioni nei corpi cilindrici
  const pDrum = pAdm.map((p) => p / (1 - c.dpSH));
  const sat = pDrum.map((p) => satP(p));
  const Ts = sat.map((s) => s.T);
  const pLP = pDrum[n - 1];
  const pRHout = reheat ? pAdm[1] * (1 - c.dpRH) : 0;

  // Pompe
  const condSat = satP(pCond);
  const vCond = condSat.vL;
  const pCondPumpOut = pLP * 1.25 + 1;
  const hCondOut = condSat.hL + (vCond * (pCondPumpOut - pCond) * 100) / c.etaPump;
  const TCondOut = propsPH(pCondPumpOut, hCondOut).T;
  const hFeed = [];
  for (let j = 0; j < n; j++) {
    hFeed[j] = j === n - 1 ? sat[n - 1].hL : sat[n - 1].hL + (sat[n - 1].vL * (pDrum[j] * 1.15 - pLP) * 100) / c.etaPump;
  }

  // Temperature dei surriscaldatori
  const Tg0 = gas.T;
  const Tsh = [];
  const hSh = [];
  const Trh = reheat ? Math.min(c.Trh, Tg0 - c.dTsh) : 0;
  const hRh = reheat ? hPT(pRHout, Math.max(Trh, Tsat(pRHout) + 1)) : 0;

  // Entalpie costanti alle pressioni fissate
  const hInEva = Ts.map((T, k) => hPT(pDrum[k], T - c.approach[k]));
  const hSubMax = hInEva[n - 1];
  // eco[k][j]: tratto di economizzatore del livello j (j < k) nella zona k
  const eco = [];
  for (let k = 1; k < n; k++) {
    eco[k] = [];
    for (let j = 0; j < k; j++) {
      const TwTop = j === k - 1 ? Ts[j] - c.approach[j] : Ts[k - 1];
      const hTop = hPT(pDrum[j], TwTop);
      const hLow = k === n - 1 ? hFeed[j] : hPT(pDrum[j], Ts[k]);
      eco[k][j] = { TwTop, hLow, dh: hTop - hLow, TwLow: propsPH(pDrum[j], hLow).T };
    }
  }
  const setSh = (k, Ttop) => {
    Tsh[k] = Math.max(Math.min(c.levels[k].Tsh, Ttop - c.dTsh), Ts[k] + 0.5);
    hSh[k] = hPT(pAdm[k], Tsh[k]);
  };
  setSh(0, Tg0);
  for (let k = 1; k < n; k++) setSh(k, Ts[k - 1] + c.pinch[k - 1]);
  // gas disponibile sopra la temperatura di pinch di ogni livello
  const hg0 = hg(Tg0);
  const avail = Ts.map((T, k) => mg * keep * (hg0 - hg(Math.min(T + c.pinch[k], Tg0))));

  // Incognite (avvio a caldo dalla soluzione precedente, se disponibile)
  let m = warm.m && warm.m.length === n ? warm.m.slice() : ref ? ref.mLevels.map((v) => v * 0.9) : Array(n).fill(20);
  let hSub = warm.hSub ?? hSubMax;
  let cap = Array(n).fill(Infinity);
  let hCRH = 0;
  let zones = [];
  let Tstack = 0;
  let mPre = 0;
  let m0Exp = -1;

  for (let it = 0; it < 150; it++) {
    const mOld = m.slice();
    zones = [];

    // Espansione HP (serve l'entalpia del risurriscaldamento freddo)
    if (reheat && Math.abs(m[0] - m0Exp) > 1e-4 * Math.max(m[0], 1)) {
      const etaHP = ref ? partLoadEta(c.etaHP, (m[0] * nHRSG) / ref.sections[0].m) : c.etaHP;
      hCRH = expand(hSh[0], pAdm[0], pAdm[1], etaHP).hOut;
      m0Exp = m[0];
    }

    let Ttop = Tg0;
    let absorbed = 0; // calore ceduto dai fumi nelle zone superiori
    const newCap = Array(n).fill(Infinity);
    for (let k = 0; k < n; k++) {
      const lowest = k === n - 1;
      const TbotPinch = Math.min(Ts[k] + c.pinch[k], Ttop);
      const Qg = mg * (hg(Ttop) - hg(TbotPinch)) * keep;
      const items = [];
      if (k > 0) setSh(k, Ttop);

      // Economizzatori dei livelli superiori presenti nella zona
      let Qeco = 0;
      for (let j = 0; j < k; j++) {
        const e = eco[k][j];
        const q = m[j] * e.dh;
        Qeco += q;
        items.push({ level: j, Q: q, TwIn: e.TwLow, TwOut: e.TwTop, m: m[j] });
      }
      // Vincolo di fattibilità: gli economizzatori non possono assorbire più calore
      // di quello disponibile sopra il pinch del livello k -> limita il livello k-1.
      // Nella zona più fredda va compreso anche il riscaldamento fino a saturazione
      // dell'acqua di alimento nel corpo cilindrico LP (degasaggio).
      if (k > 0) {
        let viol = absorbed + Qeco - avail[k];
        const j = k - 1;
        let d = hSh[j] - eco[k][j].hLow;
        if (reheat && j === 0) d += hRh - hCRH;
        if (reheat && j === 1) d += hRh - hSh[1];
        if (lowest) {
          let mUp = 0;
          for (let i = 0; i < k; i++) mUp += m[i];
          viol += mUp * (sat[k].hL - hSub);
          d += sat[k].hL - hSub;
        }
        newCap[j] = Math.max(0, m[j] - viol / d);
      }

      let mk;
      const hV = sat[k].hV;
      if (k === 0) {
        if (reheat) mk = (Qg - m[1] * (hRh - hSh[1])) / (hSh[0] - hInEva[0] + (hRh - hCRH));
        else if (lowest) mk = Qg / (hSh[0] - hSub); // un livello: alimento dal preriscaldatore
        else mk = Qg / (hSh[0] - hInEva[0]);
      } else if (lowest) {
        let mUp = 0;
        for (let j = 0; j < k; j++) mUp += m[j];
        mk = (Qg - Qeco - mUp * (sat[k].hL - hSub)) / (hSh[k] - hSub);
      } else {
        mk = (Qg - Qeco) / (hSh[k] - hInEva[k]);
      }
      if (!(mk > 0)) mk = 0;
      m[k] = Math.min(mk, cap[k]);

      // Duty dei singoli banchi
      const Qsh = m[k] * (hSh[k] - hV);
      let Qeva, Qsub;
      if (lowest) {
        let mTot = 0;
        for (let j = 0; j < n; j++) mTot += m[j];
        Qsub = mTot * (sat[k].hL - hSub);
        Qeva = m[k] * (hV - sat[k].hL) + Qsub;
      } else {
        Qsub = m[k] * (sat[k].hL - hInEva[k]);
        Qeva = m[k] * (hV - hInEva[k]);
      }
      let Qrh = 0;
      if (reheat && k === 0) Qrh = m[0] * (hRh - hCRH) + m[1] * (hRh - hSh[1]);
      const Qzone = Qsh + Qeva + Qeco + Qrh;
      absorbed += Qzone;
      const Tbot = gasT(xg, hg0 - absorbed / (mg * keep), TbotPinch);
      zones.push({ level: k, Ttop, Tbot, Qsh, Qrh, Qeva, Qsub, items, Tsh: Tsh[k] });
      Ttop = Tbot;
    }
    cap = newCap;

    // Preriscaldatore condensato (zona fredda) e vincolo di temperatura al camino
    let mTot = 0;
    for (let j = 0; j < n; j++) mTot += m[j];
    mPre = mTot;
    const TgIn = Ttop;
    const TstackMin = Math.max(c.TstackMin, Math.max(TCondOut, c.TwPreMin) + 5);
    const Qavail = Math.max(0, mg * (hg(TgIn) - hg(Math.min(TstackMin, TgIn))) * keep);
    const Qreq = mTot * (hSubMax - hCondOut);
    const hSubNew = Qreq <= Qavail || mTot < 1e-6 ? hSubMax : hCondOut + Qavail / mTot;
    hSub = 0.3 * hSub + 0.7 * hSubNew;
    const Qpre = mTot * (hSub - hCondOut);
    Tstack = gasT(xg, hg(TgIn) - Qpre / (mg * keep), TgIn - 50);

    let err = Math.abs(hSub - hSubNew) / 100;
    for (let k = 0; k < n; k++) err = Math.max(err, Math.abs(m[k] - mOld[k]));
    if (err < 1e-6 && it > 2) break;
  }
  warm.m = m.slice();
  warm.hSub = hSub;

  // ------------------------------------------------- Turbina a vapore
  const N = nHRSG;
  const sections = [];
  let hIn = hSh[0];
  let pIn = pAdm[0];
  let mSec = m[0] * N;
  let Pst = 0;
  const expPts = []; // per diagramma T-s
  const stPoints = {};
  for (let k = 0; k < n; k++) {
    const last = k === n - 1;
    const pOut = last ? pCond : pAdm[k + 1];
    const name = sectionName(c.type, k, n);
    const etaD = name === 'HP' ? c.etaHP : name === 'IP' ? c.etaIP : c.etaLP;
    const ratio = ref ? mSec / ref.sections[k].m : 1;
    const eta = ref ? partLoadEta(etaD, ratio) : etaD;
    const area = last ? (ref ? ref.lpArea : 0) : 0;
    const e = expand(hIn, pIn, pOut, eta, { wet: last, m: mSec, area });
    let ueep = e.ueep;
    let exhLoss = e.exhLoss;
    let vax = e.vax;
    let lpArea = 0;
    if (last && !ref) {
      // dimensionamento della sezione di scarico per 240 m/s al punto di progetto
      lpArea = (mSec * e.out.v) / 240;
      vax = 240;
      exhLoss = (0.85 * vax * vax) / 2 / 1000;
      ueep = e.hOut + exhLoss;
    }
    const W = (mSec * (hIn - ueep)) / 1000;
    Pst += W;
    const inState = propsPH(pIn, hIn);
    sections.push({
      name, m: mSec, pIn, Tin: inState.T, hIn, sIn: inState.s, pOut, hOut: e.hOut, ueep, eta: e.eta,
      W, exhLoss, vax, xOut: e.out.x, Tout: e.out.T, sOut: e.out.s, lpArea,
    });
    expPts.push({ name, pIn, hIn, pOut, hOut: e.hOut });

    if (!last) {
      // miscelazione con il vapore del livello successivo (ed eventuale RH)
      const mNext = m[k + 1] * N;
      if (reheat && k === 0) {
        stPoints.crh = { p: pAdm[1], h: e.hOut, m: mSec };
        const hMix = mSec + mNext > 0 ? (mSec * e.hOut + mNext * hSh[1]) / (mSec + mNext) : e.hOut;
        stPoints.crhMix = { p: pAdm[1], h: hMix, m: mSec + mNext };
        hIn = hRh;
        pIn = pRHout;
        stPoints.hrh = { p: pRHout, h: hRh, m: mSec + mNext };
      } else {
        hIn = mSec + mNext > 0 ? (mSec * e.hOut + mNext * hSh[k + 1]) / (mSec + mNext) : e.hOut;
        pIn = pOut;
      }
      mSec += mNext;
    }
  }
  const lastSec = sections[n - 1];
  const QcondTot = (lastSec.m * (lastSec.ueep - condSat.hL)) / 1000;
  Pst *= c.etaMG;

  // Potenza pompe (MW, totale)
  let Ppump = (mPre * N * vCond * (pCondPumpOut - pCond) * 100) / c.etaPump / 1000;
  for (let j = 0; j < n - 1; j++) Ppump += (m[j] * N * sat[n - 1].vL * (pDrum[j] * 1.15 - pLP) * 100) / c.etaPump / 1000;

  // Dettaglio banchi GVR in ordine lato fumi (per un GVR)
  const banks = [];
  for (const z of zones) {
    const k = z.level;
    let T = z.Ttop;
    const push = (name, Q, TwIn, TwOut, extra = {}) => {
      if (Q <= 1e-6) return;
      const Tout = gasT(xg, hg(T) - Q / (mg * keep), T - 10);
      banks.push({ name, Q: Q / 1000, TgIn: T, TgOut: Tout, TwIn, TwOut, ...extra });
      T = Tout;
    };
    if (k === 0 && reheat) {
      // SH HP e RH in parallelo sul lato fumi (banchi interlacciati)
      const Qtot = z.Qsh + z.Qrh;
      const Tout = gasT(xg, hg(T) - Qtot / (mg * keep), T - 10);
      const TcrhMix = propsPH(pAdm[1], stPoints.crhMix ? stPoints.crhMix.h : hCRH).T;
      banks.push({ name: `SH ${names[0]}`, Q: z.Qsh / 1000, TgIn: T, TgOut: Tout, TwIn: Ts[0], TwOut: Tsh[0], parallel: true });
      banks.push({ name: 'RH', Q: z.Qrh / 1000, TgIn: T, TgOut: Tout, TwIn: TcrhMix, TwOut: Trh, parallel: true });
      T = Tout;
    } else {
      push(`SH ${names[k]}`, z.Qsh, Ts[k], Tsh[k]);
    }
    // gli economizzatori dei livelli superiori nella stessa zona lavorano in parallelo sul lato fumi
    const ecos = z.items.filter((it) => it.Q > 1e-6);
    if (ecos.length === 1) push(`ECO ${names[ecos[0].level]}`, ecos[0].Q, ecos[0].TwIn, ecos[0].TwOut);
    else if (ecos.length > 1) {
      const Qtot = ecos.reduce((a, it) => a + it.Q, 0);
      const Tout = gasT(xg, hg(T) - Qtot / (mg * keep), T - 10);
      for (const it of ecos) banks.push({ name: `ECO ${names[it.level]}`, Q: it.Q / 1000, TgIn: T, TgOut: Tout, TwIn: it.TwIn, TwOut: it.TwOut, parallel: true });
      T = Tout;
    }
    push(`EVA ${names[k]}`, z.Qeva, k === n - 1 ? propsPH(pLP, hSub).T : Ts[k] - c.approach[k], Ts[k], { subFrac: z.Qeva > 0 ? z.Qsub / z.Qeva : 0 });
  }
  {
    const Qpre = mPre * (hSub - hCondOut);
    let T = zones[zones.length - 1].Tbot;
    const Tout = gasT(xg, hg(T) - Qpre / (mg * keep), T - 10);
    if (Qpre > 1e-6) banks.push({ name: 'PRE (condensato)', Q: Qpre / 1000, TgIn: T, TgOut: Tout, TwIn: Math.max(TCondOut, Math.min(c.TwPreMin, propsPH(pLP, hSub).T - 1)), TwOut: propsPH(pLP, hSub).T });
  }
  const Qhrsg = banks.reduce((a, b) => a + b.Q, 0); // MW per GVR

  return {
    type: c.type,
    names,
    pAdm: pAdm.slice(),
    pDrum,
    Tsat: Ts,
    Tsh: Tsh.slice(),
    Trh,
    pRHout,
    mLevels: m.slice(),
    mLevelsTot: m.map((v) => v * N),
    sections,
    stPoints,
    Pst,
    Ppump,
    pCond,
    Tcond: condSat.T,
    hCondL: condSat.hL,
    Qcond: QcondTot,
    Tstack,
    TCondOut,
    banks,
    Qhrsg,
    hSub,
    TsubLP: propsPH(pLP, hSub).T,
    expPts,
    mSteamTot: (m.reduce((a, b) => a + b, 0)) * N,
    lpArea: sections[n - 1].lpArea,
  };
}
