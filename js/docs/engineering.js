// Modello di ingegneria di base/dettaglio derivato dal punto di progetto del simulatore:
// correnti del bilancio di massa ed energia, linee (dimensionamento e specifiche),
// apparecchiature, utenze elettriche, sistema elettrico, disposizione planimetrica e
// instradamento della linea vapore HP. Valori preliminari, coerenti con il modello termico.
// Codifica impianto: KKS semplificata (unità 1..3 = treni TG/GVR, 0 = comune).

import { plantPoint, defaultOperation, ISO, GT_PRESETS } from '../engine/plant.js';
import { propsPT, propsPH, satP, Tsat } from '../engine/steam.js';

const G = 9.81;

// ------------------------------------------------------------------ tubazioni
// [DN, diametro esterno mm] (ASME B36.10M)
const PIPES = [
  [15, 21.3], [20, 26.7], [25, 33.4], [32, 42.2], [40, 48.3], [50, 60.3], [65, 73.0], [80, 88.9],
  [100, 114.3], [125, 141.3], [150, 168.3], [200, 219.1], [250, 273.0], [300, 323.8], [350, 355.6],
  [400, 406.4], [450, 457.0], [500, 508.0], [550, 559.0], [600, 610.0], [650, 660.0], [700, 711.0],
  [750, 762.0], [800, 813.0], [900, 914.0], [1000, 1016.0], [1100, 1118.0], [1200, 1219.0], [1400, 1422.0],
  [1600, 1626.0], [1800, 1829.0], [2000, 2032.0], [2200, 2235.0], [2400, 2438.0],
];

// Tensioni ammissibili [MPa] in funzione della temperatura (valori indicativi ASME B31.1)
export const MATERIALS = {
  A: { name: 'ASTM A106 Gr.B', short: 'A106 B', S: [[0, 118], [340, 117], [370, 103], [400, 89], [425, 74]], c: 1.5, group: 'CS' },
  B: { name: 'ASTM A335 P22', short: 'A335 P22', S: [[0, 129], [400, 120], [450, 113], [480, 98], [510, 72], [540, 50], [565, 37]], c: 1.0, group: 'P22' },
  C: { name: 'ASTM A335 P91', short: 'A335 P91', S: [[0, 163], [400, 149], [450, 141], [500, 126], [540, 103], [565, 83], [595, 63], [610, 55]], c: 1.0, group: 'P91' },
  G: { name: 'API 5L X52 PSL2', short: 'API 5L X52', S: [[0, 172], [120, 172]], c: 1.5, group: 'CS' },
  W: { name: 'ASTM A672 / acciaio al carbonio elicoidale', short: 'A672 CS', S: [[0, 120], [60, 120]], c: 3.0, group: 'CS' },
};

// Pressione ammissibile [bar] della classe 300 (ASME B16.34) per gruppo di materiale
const RATING300 = {
  CS: [[38, 51.1], [100, 46.6], [200, 43.8], [300, 39.8], [350, 37.6], [400, 34.7], [425, 28.8]],
  P22: [[38, 51.7], [200, 49.6], [300, 46.3], [400, 40.3], [450, 33.7], [500, 26.0], [538, 17.9], [565, 12.4]],
  P91: [[38, 51.7], [200, 47.8], [300, 44.6], [400, 40.6], [450, 37.4], [500, 34.5], [538, 30.7], [565, 26.9], [593, 20.3], [610, 16.2]],
};
const CLASSES = [[150, 'A'], [300, 'B'], [600, 'C'], [900, 'D'], [1500, 'E'], [2500, 'F']];

function interp(tbl, x) {
  if (x <= tbl[0][0]) return tbl[0][1];
  for (let i = 1; i < tbl.length; i++) {
    if (x <= tbl[i][0]) {
      const [x0, y0] = tbl[i - 1], [x1, y1] = tbl[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return tbl[tbl.length - 1][1];
}

function ratingClass(group, pBarG, T) {
  const r300 = interp(RATING300[group], T);
  for (const [cls, code] of CLASSES) {
    const r = cls === 150 ? r300 / 2.6 : (r300 * cls) / 300;
    if (r >= pBarG) return { cls, code };
  }
  return { cls: 4500, code: 'G' };
}

function materialFor(service, T) {
  if (service === 'gas') return 'G';
  if (service === 'cw') return 'W';
  if (T > 545) return 'C';
  if (T > 425) return 'B';
  return 'A';
}

function insulationFor(Top) {
  if (Top >= 500) return { code: 'H', t: 250 };
  if (Top >= 400) return { code: 'H', t: 200 };
  if (Top >= 300) return { code: 'H', t: 150 };
  if (Top >= 180) return { code: 'H', t: 100 };
  if (Top >= 60) return { code: 'P', t: 50 };
  return { code: 'N', t: 0 };
}

const roundUp = (v, step) => Math.ceil(v / step - 1e-9) * step;

/**
 * Dimensiona una linea: diametro per la velocità obiettivo, spessore minimo secondo
 * ASME B31.1 (t = P·D / 2(SE + Py) + c), classe di rating, coibentazione.
 */
export function sizeLine({ m, v, velMax, pOp, Top, service = 'steam', pDes = null, TDes = null }) {
  const pD = pDes ?? roundUp(Math.max(pOp * 1.1, pOp + 1), 0.5); // bar a
  const TD = TDes ?? roundUp(Top + (service === 'steam' ? 10 : 5), 5);
  const mat = materialFor(service, TD);
  const M = MATERIALS[mat];
  const S = interp(M.S, TD);
  const P = Math.max(0.1, (pD - 1.013) / 10); // MPa g
  const y = mat === 'C' && TD >= 566 ? 0.7 : 0.4;
  const Q = m * v; // m3/s
  const pick = (DN, OD) => {
    const tmin = (P * OD) / (2 * (S + P * y)) + M.c;
    const tnom = Math.round(Math.max(roundUp(tmin / 0.875, 0.1), service === 'cw' ? 10 : DN >= 600 ? 9.5 : 3) * 10) / 10;
    const ID = OD - 2 * tnom;
    const vel = Q / ((Math.PI / 4) * (ID / 1000) ** 2);
    return { DN, OD, tmin, tnom, ID, vel };
  };
  let sel = null;
  for (const [DN, OD] of PIPES) {
    const c = pick(DN, OD);
    if (c.vel <= velMax && c.ID > 0) { sel = c; break; }
  }
  if (!sel) {
    // condotto fabbricato oltre DN 2400: passo di 100 mm
    for (let DN = 2500; DN <= 12000; DN += 100) {
      const c = pick(DN, DN + 16);
      if (c.vel <= velMax) { sel = c; break; }
    }
  }
  const rc = ratingClass(M.group, pD - 1.013, TD);
  const ins = insulationFor(Top);
  return {
    ...sel, pDes: pD, TDes: TD, mat, material: M.name, matShort: M.short, S, cls: rc.cls,
    spec: `${mat}${rc.code}`, ins, test: roundUp((pD - 1.013) * 1.5, 0.5),
  };
}

export function kks(unit, sys, no, eq = '', eqNo = null) {
  return `${unit}${sys}${String(no).padStart(2, '0')}${eq}${eqNo !== null ? String(eqNo).padStart(3, '0') : ''}`;
}

// ------------------------------------------------------------------ utilità elettriche
const MOTORS = [0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75, 90, 110, 132, 160, 200, 250, 315, 355, 400, 450, 500, 560, 630, 710, 800, 900, 1000, 1120, 1250, 1400, 1600, 1800, 2000, 2240, 2500, 2800, 3150, 3550, 4000, 4500, 5000, 5600, 6300, 7100, 8000, 9000, 10000, 11200, 12500];
const motorRating = (kW) => MOTORS.find((r) => r >= kW) ?? roundUp(kW, 500);
const LV_TR = [630, 800, 1000, 1250, 1600, 2000, 2500, 3150];
const MV_TR = [6.3, 8, 10, 12.5, 16, 20, 25, 31.5, 40, 50, 63];

function genVoltage(MVA) {
  if (MVA < 100) return 11;
  if (MVA < 250) return 15.75;
  if (MVA < 420) return 19;
  return 21;
}

// ------------------------------------------------------------------ modello
export function defaultProjectMeta() {
  const d = new Date();
  const pad = (v) => String(v).padStart(2, '0');
  return {
    project: 'Centrale a ciclo combinato',
    client: 'Committente',
    site: 'Sito di progetto',
    prefix: 'CCGT',
    rev: 'A',
    revDesc: 'Emissione preliminare per commenti',
    date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    author: 'Ing.',
    checked: '',
    approved: '',
    stackHeight: 60,
  };
}

/** Costruisce il modello di ingegneria dalla configurazione e dal progetto. */
export function engineeringModel(cfg, des, meta) {
  const N = cfg.nGT;
  const op = { ...defaultOperation(), ...ISO, load: 1, nGTon: N, Tcw: cfg.steam.condenser.TcwDesign, ductT: 0, slidingHP: true };
  const r = plantPoint(cfg, des, op);
  const gt = r.gt;
  const bt = r.bt;
  const type = cfg.steam.type;
  const names = bt.names;
  const n = names.length;
  const reheat = type === '3PRH';
  const fuel = des.fuel;
  const cond = cfg.steam.condenser;
  const gtClass = cfg.gtName.replace(/\s*\(.*\)/, '');
  const units = Array.from({ length: N }, (_, i) => i + 1);

  // ---------------------------------------------------------------- correnti (PFD / H&MB)
  const streams = [];
  const S = (desc, fluid, m, p, T, h, extra = '') => {
    streams.push({ no: streams.length + 1, desc, fluid, m, p, T, h, extra });
    return streams.length;
  };
  const hw = (p, T) => propsPT(p, T).h;
  const sec0 = bt.sections[0];
  const lastSec = bt.sections[n - 1];
  const lowest = n - 1;
  const pFG = Math.max(20, gt.p2 * 1.5);
  const st = {};
  st.air = S('Aria ingresso compressore', 'Aria umida', gt.mAir, gt.p1, gt.T1, null, `per TG, UR ${Math.round(op.rh * 100)} %`);
  st.cd2 = S('Mandata compressore', 'Aria', gt.mAir, gt.p2, gt.T2, null, 'per TG');
  st.fg = S('Gas naturale ai bruciatori', 'Gas naturale', gt.mFuel, pFG, cfg.gt.Tfuel, null, `PCI ${(fuel.lhv / 1000).toFixed(2)} MJ/kg`);
  st.exh = S('Scarico TG / ingresso GVR', 'Fumi', gt.mExh, gt.p4, gt.T4, null, 'per TG');
  st.stack = S('Fumi al camino', 'Fumi', r.gas.m, op.pamb, bt.Tstack, null, 'per GVR');
  st.hpGen = S(`Vapore HP uscita SH (per GVR)`, 'Vapore', bt.mLevels[0], bt.pAdm[0], bt.Tsh[0], hw(bt.pAdm[0], bt.Tsh[0]));
  st.hpST = S('Vapore HP ammissione TV', 'Vapore', sec0.m, sec0.pIn, sec0.Tin, sec0.hIn, N > 1 ? `totale ${N} GVR` : '');
  if (reheat) {
    st.crh = S('Risurriscaldato freddo (scarico HP)', 'Vapore', sec0.m, bt.pAdm[1], sec0.Tout, sec0.hOut);
    st.ip = S('Vapore IP uscita SH (per GVR)', 'Vapore', bt.mLevels[1], bt.pAdm[1], bt.Tsh[1], hw(bt.pAdm[1], bt.Tsh[1]));
    st.hrh = S('Risurriscaldato caldo ammissione IP', 'Vapore', bt.sections[1].m, bt.pRHout, bt.Trh, bt.sections[1].hIn);
  }
  if (n > 1) st.lp = S('Vapore LP uscita SH (per GVR)', 'Vapore', bt.mLevels[lowest], bt.pAdm[lowest], bt.Tsh[lowest], hw(bt.pAdm[lowest], bt.Tsh[lowest]));
  st.exST = S('Scarico TV al condensatore', 'Vapore umido', lastSec.m, bt.pCond, lastSec.Tout, lastSec.ueep, `titolo ${lastSec.xOut.toFixed(3)}`);
  st.cdp = S('Condensato mandata pompe estrazione', 'Acqua', bt.mSteamTot, bt.pDrum[lowest] * 1.25 + 1, bt.TCondOut, null);
  const pFWhp = bt.pDrum[0] * 1.15;
  st.fwHP = S('Acqua alimento HP (per GVR)', 'Acqua', bt.mLevels[0], pFWhp, bt.TsubLP + 2, null);
  if (reheat) st.fwIP = S('Acqua alimento IP (per GVR)', 'Acqua', bt.mLevels[1], bt.pDrum[1] * 1.15, bt.TsubLP + 1, null);
  const dTcwOp = cond.dTcw * (r.bt.Qcond / des.QcondD);
  if (cond.type === 'water') {
    st.cwIn = S('Acqua di circolazione ingresso condensatore', 'Acqua', des.mcw, 2.5, op.Tcw, null);
    st.cwOut = S('Acqua di circolazione uscita condensatore', 'Acqua', des.mcw, 1.8, op.Tcw + dTcwOp, null);
  }
  for (const s of streams) {
    if (s.h === null && s.fluid === 'Acqua') s.h = propsPT(s.p, s.T).h;
  }

  // ---------------------------------------------------------------- linee
  const lines = [];
  const seq = {};
  const L = (id, unit, fluid, service, from, to, m, p, T, velMax, vSpec, kksSys, extra = {}) => {
    const v = vSpec ?? propsPT(p, T).v;
    const sz = sizeLine({ m: m * 1.1, v, velMax, pOp: p, Top: T, service, ...extra });
    seq[`${unit}${fluid}`] = (seq[`${unit}${fluid}`] || 0) + 1;
    const no = `${unit}${String(seq[`${unit}${fluid}`]).padStart(2, '0')}`;
    const lineNo = `${sz.DN}-${fluid}-${no}-${sz.spec}-${sz.ins.code}`;
    const vel = (m * v) / ((Math.PI / 4) * (sz.ID / 1000) ** 2);
    lines.push({ id, unit, lineNo, kks: kks(unit, kksSys, 10, 'BR', lines.length + 1), fluid, from, to, m, p, T, v, vel, ...sz, phase: service });
    return lineNo;
  };
  const hdr = N > 1;
  const vFG = ((8.314 / fuel.M) * (cfg.gt.Tfuel + 273.15)) / (pFG * 100); // m³/kg, gas ideale
  const hpTag = (u) => kks(u, 'HAH', 10);
  for (const u of units) {
    L(`FG-${u}`, u, 'FG', 'gas', '0EKA10 stazione gas', `${kks(u, 'MBP', 10)} skid gas TG${u}`, gt.mFuel, pFG, cfg.gt.Tfuel,
      20, vFG, 'EKG');
    L(`MS-${u}`, u, 'MS', 'steam', `${hpTag(u)} uscita SH HP`, hdr ? 'Collettore vapore HP' : '0MAA10 valvola arresto HP', bt.mLevels[0], bt.pAdm[0], bt.Tsh[0], 45, null, 'LBA');
    if (reheat) {
      L(`CRH-${u}`, u, 'CR', 'steam', hdr ? 'Collettore RH freddo' : '0MAA10 scarico HP', `${kks(u, 'HAJ', 10)} ingresso RH`, sec0.m / N, bt.pAdm[1], sec0.Tout, 40, null, 'LBC');
      L(`HRH-${u}`, u, 'HR', 'steam', `${kks(u, 'HAJ', 10)} uscita RH`, hdr ? 'Collettore RH caldo' : '0MAB10 valvola arresto IP', bt.sections[1].m / N, bt.pRHout, bt.Trh, 55, null, 'LBB');
      L(`IP-${u}`, u, 'IS', 'steam', `${kks(u, 'HAH', 20)} uscita SH IP`, `Linea RH freddo GVR${u}`, bt.mLevels[1], bt.pAdm[1], bt.Tsh[1], 40, null, 'LBC');
    }
    if (n > 1) L(`LP-${u}`, u, 'LS', 'steam', `${kks(u, 'HAH', n === 3 ? 30 : 20)} uscita SH LP`, hdr ? 'Collettore vapore LP' : `0MAC10 ammissione LP`, bt.mLevels[lowest], bt.pAdm[lowest], bt.Tsh[lowest], 40, null, 'LBD');
    L(`FW-${u}`, u, 'FW', 'water', `${kks(u, 'LAC', 10)} pompe alimento`, `${kks(u, 'HAC', 10)} ingresso ECO HP`, bt.mLevels[0], pFWhp, bt.TsubLP + 2, 3.0, null, 'LAB');
    L(`FWS-${u}`, u, 'FW', 'water', `${kks(u, 'HAD', 10 * n)} corpo LP`, `${kks(u, 'LAC', 10)} aspirazione pompe`, bt.mLevels.slice(0, lowest).reduce((a, b) => a + b, 0) || bt.mLevels[0], bt.pDrum[lowest] + 0.5, bt.Tsat[lowest], 1.2, null, 'LAB');
    if (reheat) L(`FWIP-${u}`, u, 'FW', 'water', `${kks(u, 'LAC', 10)} spillamento IP`, `${kks(u, 'HAC', 20)} ingresso ECO IP`, bt.mLevels[1], bt.pDrum[1] * 1.15, bt.TsubLP + 1, 3.0, null, 'LAB');
    L(`SPR-${u}`, u, 'SW', 'water', `${kks(u, 'LAC', 10)} spillamento`, 'Desurriscaldatori HP/RH', bt.mLevels[0] * 0.05, pFWhp, bt.TsubLP + 2, 3.0, null, 'LAE');
    L(`CD-${u}`, u, 'CD', 'water', hdr ? 'Collettore condensato' : '0LCB10 pompe condensato', `${kks(u, 'HAC', 30)} preriscaldatore`, bt.mLevels.reduce((a, b) => a + b, 0), bt.pDrum[lowest] * 1.25 + 1, bt.TCondOut, 2.0, null, 'LCA');
    L(`HPB-${u}`, u, 'BP', 'steam', 'Linea vapore HP', reheat ? `Linea RH freddo (bypass HP ${kks(u, 'MAN', 10)})` : `Condensatore (bypass ${kks(u, 'MAN', 10)})`, bt.mLevels[0], bt.pAdm[0], bt.Tsh[0], 50, null, 'MAN');
    L(`BD-${u}`, u, 'BD', 'water', `${kks(u, 'HAD', 10)} corpo HP`, `${kks(u, 'HAN', 10)} serbatoio spurghi`, bt.mLevels[0] * 0.01, bt.pDrum[0], bt.Tsat[0], 2.0, null, 'HAN');
  }
  if (hdr) {
    L('MS-H', 0, 'MS', 'steam', 'Collettore vapore HP', '0MAA10 valvola arresto HP', sec0.m, sec0.pIn, sec0.Tin, 45, null, 'LBA');
    if (reheat) {
      L('CRH-H', 0, 'CR', 'steam', '0MAA10 scarico HP', 'Collettore RH freddo', sec0.m, bt.pAdm[1], sec0.Tout, 40, null, 'LBC');
      L('HRH-H', 0, 'HR', 'steam', 'Collettore RH caldo', '0MAB10 valvola arresto IP', bt.sections[1].m, bt.pRHout, bt.Trh, 55, null, 'LBB');
    }
    if (n > 1) L('LP-H', 0, 'LS', 'steam', 'Collettore vapore LP', '0MAC10 ammissione LP', bt.mLevelsTot[lowest], bt.pAdm[lowest], bt.Tsh[lowest], 40, null, 'LBD');
    L('CD-H', 0, 'CD', 'water', '0LCB10 pompe condensato', 'Collettore condensato', bt.mSteamTot, bt.pDrum[lowest] * 1.25 + 1, bt.TCondOut, 2.0, null, 'LCA');
  }
  L('CDS', 0, 'CD', 'water', '0MAG10 pozzo caldo', '0LCB10 aspirazione pompe', bt.mSteamTot, bt.pCond + 0.3, bt.Tcond - 0.5, 1.0, null, 'LCA', { pDes: 4, TDes: 80 });
  const exhV = propsPH(bt.pCond, lastSec.ueep).v;
  if (cond.type === 'air') {
    L('ED', 0, 'ED', 'cw', '0MAC10 scarico LP', '0MAG10 aerocondensatore', lastSec.m, bt.pCond, bt.Tcond, 75, exhV, 'MAG', { pDes: 3.5, TDes: 120 });
  } else {
    L('CWS', 0, 'CW', 'cw', '0PAC10 pompe circolazione', '0MAG10 ingresso condensatore', des.mcw, 2.5, op.Tcw, 2.5, 0.001, 'PAB', { pDes: 4.5, TDes: 50 });
    L('CWR', 0, 'CW', 'cw', '0MAG10 uscita condensatore', '0PAE10 torre di raffreddamento', des.mcw, 1.8, op.Tcw + dTcwOp, 2.5, 0.001, 'PAB', { pDes: 4.5, TDes: 50 });
  }
  const lineById = Object.fromEntries(lines.map((l) => [l.id, l]));

  // ---------------------------------------------------------------- elettrico: generatori
  const PgtMax = des.gtRef.Piso * cfg.gt.PmaxFactor;
  const MVAgt = roundUp(PgtMax / 0.85, 5);
  const kVgt = genVoltage(MVAgt);
  const PstMax = r.Pst * 1.12;
  const MVAst = roundUp(PstMax / 0.85, 5);
  const kVst = genVoltage(MVAst);
  const totalMW = des.gtRef.Piso * N + r.Pst;
  const hvKV = totalMW > 400 ? 380 : totalMW > 180 ? 220 : 150;
  const gens = [];
  for (const u of units) gens.push({ tag: kks(u, 'MKA', 10), name: `Generatore TG${u}`, MVA: MVAgt, kV: kVgt, P: PgtMax, cooling: MVAgt > 330 ? 'idrogeno' : 'aria (TEWAC)', unit: u });
  gens.push({ tag: kks(0, 'MKA', 10), name: 'Generatore TV', MVA: MVAst, kV: kVst, P: PstMax, cooling: MVAst > 330 ? 'idrogeno' : 'aria (TEWAC)', unit: 0 });

  // ---------------------------------------------------------------- utenze elettriche
  const loads = [];
  const MV = 6;
  const addLoad = (tag, desc, qtyInst, qtyOp, absKW, duty = 'C', { eff = null, pf = null, ku = 0.9, kV = null, bus = null, equip = null, rated = null } = {}) => {
    const ratedKW = rated ?? motorRating(absKW * 1.1);
    const voltage = kV ?? (ratedKW >= 250 ? MV : 0.4);
    const e = eff ?? (ratedKW > 500 ? 0.965 : ratedKW > 50 ? 0.95 : 0.9);
    const p = pf ?? (ratedKW > 500 ? 0.88 : ratedKW > 50 ? 0.86 : 0.82);
    const elec = absKW / e;
    const cont = duty === 'C' ? qtyOp * elec * ku : duty === 'I' ? qtyOp * elec * 0.3 * ku : 0;
    loads.push({
      tag, desc, qtyInst, qtyOp, kV: voltage, rated: ratedKW, abs: absKW, eff: e, pf: p, ku, duty,
      elec, cont, kvar: cont * Math.tan(Math.acos(p)), bus: bus ?? (voltage >= 1 ? 'MT' : 'BT'), equip,
    });
  };
  // pompe alimento (per treno): portata HP + IP + spray, prevalenza fino al corpo HP
  const rhoFW = 1 / propsPT(pFWhp, bt.TsubLP).v;
  const pumps = {};
  for (const u of units) {
    const mFW = bt.mLevels.slice(0, lowest).reduce((a, b) => a + b, 0) * 1.05 || bt.mLevels[0];
    const dp = (pFWhp + 8 - bt.pDrum[lowest]) * 1e5;
    const Hm = dp / (rhoFW * G);
    const kWabs = (mFW * 1.1 * dp) / rhoFW / 0.8 / 1000;
    pumps[`fw${u}`] = { Q: (mFW * 1.1 * 3600) / rhoFW, H: Hm, kW: kWabs };
    addLoad(kks(u, 'LAC', 10, 'AP', 1), `Pompa alimento HP/IP GVR${u} (A/B)`, 2, 1, kWabs, 'C', { equip: kks(u, 'LAC', 10) });
  }
  // pompe estrazione condensato
  const rhoC = 1 / satP(bt.pCond).vL;
  const dpC = (bt.pDrum[lowest] * 1.25 + 4 - bt.pCond) * 1e5;
  const kWcd = (bt.mSteamTot * 1.1 * dpC) / rhoC / 0.78 / 1000;
  pumps.cd = { Q: (bt.mSteamTot * 1.1 * 3600) / rhoC, H: dpC / (rhoC * G), kW: kWcd };
  addLoad(kks(0, 'LCB', 10, 'AP', 1), 'Pompa estrazione condensato (A/B)', 2, 1, kWcd, 'C', { equip: kks(0, 'LCB', 10) });
  // raffreddamento principale
  let ctCells = 0, accCells = 0;
  if (cond.type === 'water') {
    const Hcw = 25;
    const kWcw = (des.mcw * 1.05 * G * Hcw) / 0.86 / 1000 / 2;
    pumps.cw = { Q: (des.mcw * 3600) / 998 / 2, H: Hcw, kW: kWcw };
    addLoad(kks(0, 'PAC', 10, 'AP', 1), 'Pompa acqua di circolazione 50 % (A/B/C)', 3, 2, kWcw, 'C', { equip: kks(0, 'PAC', 10) });
    ctCells = Math.max(2, Math.ceil(des.QcondD / 26));
    const kWfan = Math.max(55, (des.QcondD * 1000 * 0.0075) / ctCells);
    addLoad(kks(0, 'PAE', 10, 'AN', 1), `Ventilatore torre di raffreddamento (${ctCells} celle)`, ctCells, ctCells, kWfan, 'C', { equip: kks(0, 'PAE', 10) });
  } else {
    accCells = Math.max(4, Math.ceil(des.QcondD / 10));
    const kWfan = (cfg.aux.fanFrac * des.QcondD * 1000) / accCells;
    addLoad(kks(0, 'MAG', 10, 'AN', 1), `Ventilatore aerocondensatore (${accCells} celle)`, accCells, accCells, kWfan, 'C', { equip: kks(0, 'MAG', 10) });
  }
  // TG
  for (const u of units) {
    const s = des.gtRef.Piso;
    addLoad(kks(u, 'MBJ', 10, 'GH', 1), `Avviatore statico (SFC) TG${u} – solo in avviamento`, 1, 1, s * 1000 * 0.03, 'S', { kV: MV, rated: roundUp(s * 1000 * 0.03 / 0.95, 500), ku: 1 });
    addLoad(kks(u, 'MBV', 10, 'AP', 1), `Pompa olio lubrificazione TG${u} (A/B)`, 2, 1, 45 + s * 0.12, 'C');
    addLoad(kks(u, 'MBV', 20, 'AP', 1), `Pompa olio sollevamento rotore TG${u}`, 1, 1, 30, 'I');
    addLoad(kks(u, 'MBK', 10, 'AE', 1), `Viratore TG${u}`, 1, 1, 22, 'I');
    addLoad(kks(u, 'MBM', 10, 'AN', 1), `Ventilazione cabinato TG${u} (A/B)`, 2, 1, 30 + s * 0.08, 'C');
    addLoad(kks(u, 'MBL', 10, 'AN', 1), `Sistema pulizia filtri aria TG${u}`, 1, 1, 11, 'I');
    addLoad(kks(u, 'HAC', 30, 'AP', 1), `Pompa ricircolo preriscaldatore GVR${u} (A/B)`, 2, 1, 15 + bt.mSteamTot * 0.12 / N, 'C');
    addLoad(kks(u, 'HNE', 10, 'AA', 1), `Serranda camino e strumenti GVR${u}`, 1, 1, 7.5, 'I');
  }
  // TV e ciclo
  addLoad(kks(0, 'MAV', 10, 'AP', 1), 'Pompa olio lubrificazione TV (A/B)', 2, 1, 40 + r.Pst * 0.1, 'C');
  addLoad(kks(0, 'MAV', 20, 'AP', 1), 'Pompa olio sollevamento rotore TV', 1, 1, 37, 'I');
  addLoad(kks(0, 'MAK', 10, 'AE', 1), 'Viratore TV', 1, 1, 30, 'I');
  addLoad(kks(0, 'MAJ', 10, 'AP', 1), 'Pompa del vuoto condensatore (A/B)', 2, 1, 55 + des.QcondD * 0.12, 'C');
  addLoad(kks(0, 'MAW', 10, 'AN', 1), 'Estrattore vapore tenute (A/B)', 2, 1, 11, 'C');
  addLoad(kks(0, 'MAX', 10, 'AP', 1), 'Centralina olio regolazione TV (A/B)', 2, 1, 22, 'C');
  // BoP
  const qCCW = r.gross * 1000 * 0.006; // kW termici ausiliari
  addLoad(kks(0, 'PGB', 10, 'AP', 1), 'Pompa acqua raffreddamento ciclo chiuso (A/B)', 2, 1, (qCCW / (4.18 * 8)) * 9.81 * 40 / 0.78 / 1000 * 1.2 + 20, 'C');
  addLoad(kks(0, 'PGC', 10, 'AN', 1), 'Ventilatori aerotermi ciclo chiuso', 6, 5, (qCCW * 0.02) / 5 + 7, 'C');
  addLoad(kks(0, 'SCA', 10, 'AN', 1), 'Compressore aria strumenti e servizi (A/B)', 2, 1, 110 + N * 30, 'C');
  addLoad(kks(0, 'GCF', 10, 'AP', 1), 'Impianto produzione acqua demineralizzata', 1, 1, 90 + N * 20, 'C');
  addLoad(kks(0, 'GHC', 10, 'AP', 1), 'Pompa trasferimento acqua demi (A/B)', 2, 1, 22, 'I');
  addLoad(kks(0, 'QCA', 10, 'AP', 1), 'Dosaggio chimico ciclo (fosfati, ammine, O2)', 6, 3, 2.2, 'C');
  addLoad(kks(0, 'SGA', 10, 'AP', 1), 'Pompa antincendio elettrica', 1, 1, 160 + N * 40, 'S', { kV: MV });
  addLoad(kks(0, 'SGA', 10, 'AP', 3), 'Pompa antincendio di pressurizzazione (jockey)', 1, 1, 11, 'I');
  addLoad(kks(0, 'EKA', 10, 'AH', 1), 'Riscaldatore elettrico gas (avviamento)', 1, 1, 200 + N * 60, 'I', { pf: 1, eff: 0.99, kV: 0.4 });
  addLoad(kks(0, 'SAA', 10, 'AN', 1), 'HVAC sala controllo ed edifici', 1, 1, 180 + N * 60, 'C', { kV: 0.4 });
  addLoad(kks(0, 'SAC', 10, 'AN', 1), 'Ventilazione sala macchine TV', 8, 6, 22, 'C');
  addLoad(kks(0, 'BRA', 10, 'GA', 1), 'Raddrizzatori e UPS (A/B)', 2, 2, 60 + N * 20, 'C', { pf: 0.9, eff: 0.93 });
  addLoad(kks(0, 'XLA', 10, 'GA', 1), 'Illuminazione normale ed esterna', 1, 1, 120 + N * 40, 'C', { pf: 0.95, eff: 1, ku: 0.8, kV: 0.4, rated: 120 + N * 40 });
  addLoad(kks(0, 'SMA', 10, 'GA', 1), 'Officina, magazzino e prese di servizio', 1, 1, 80, 'I', { pf: 0.85, eff: 1 });
  addLoad(kks(0, 'XKA', 10, 'GA', 1), 'Gru di sala macchine TV', 1, 1, 90, 'I');

  // assegnazione ai quadri: A/B alternati per utenze ridondate
  let ia = 0;
  for (const ld of loads) {
    const side = ld.qtyInst >= 2 ? 'A/B' : (ia++ % 2 === 0 ? 'A' : 'B');
    ld.board = ld.kV >= 1 ? `0BBA/0BBB (${side})` : `0BFA/0BFB (${side})`;
  }
  const sum = (arr, k) => arr.reduce((a, b) => a + b[k], 0);
  const mvLoads = loads.filter((l) => l.kV >= 1);
  const lvLoads = loads.filter((l) => l.kV < 1);
  const lvP = sum(lvLoads, 'cont'), lvQ = sum(lvLoads, 'kvar');
  const lvKVA = Math.hypot(lvP, lvQ);
  const mvP = sum(mvLoads, 'cont'), mvQ = sum(mvLoads, 'kvar');
  const totKW = mvP + lvP * 1.012;
  const totKVA = Math.hypot(totKW, mvQ + lvQ);
  // trasformatori BT a coppie 2×100 %
  const pairs = Math.max(1, Math.ceil((lvKVA * 1.2) / 2500));
  const lvTrKVA = LV_TR.find((s) => s >= (lvKVA * 1.2) / pairs) ?? 3150;
  const sfcKW = des.gtRef.Piso * 1000 * 0.03;
  const uatMVA = MV_TR.find((s) => s * 1000 >= Math.max(totKVA * 1.25, sfcKW / 0.95 + totKVA * 0.5)) ?? 63;
  const lvTr = [];
  for (let i = 0; i < pairs * 2; i++) lvTr.push({ tag: kks(0, 'BFT', 10 + i * 10), kVA: lvTrKVA, bus: `0BF${String.fromCharCode(65 + i)}` });
  const uats = [];
  const uatSources = N > 1 ? [gens[0], gens[1]] : [gens[0], gens[N]];
  uatSources.forEach((g, i) => uats.push({ tag: kks(g.unit, 'BBT', 10 + i), MVA: uatMVA, ratio: `${String(g.kV).replace('.', ',')}/6,3 kV`, from: g.tag, bus: i === 0 ? '0BBA' : '0BBB' }));
  const gsu = gens.map((g) => ({ tag: kks(g.unit, 'BAT', g.unit === 0 ? 20 : 10), MVA: roundUp(g.MVA * 1.0, 5), ratio: `${hvKV}/${String(g.kV).replace('.', ',')} kV`, gen: g.tag, uk: 14 }));
  const edgKVA = roundUp(Math.max(500, (lvP * 0.25) / 0.8), 100);
  const electrical = {
    gens, gsu, uats, lvTr, hvKV, edgKVA, mvKV: MV,
    summary: { mvP, mvQ, lvP, lvQ, lvKVA, totKW, totKVA, sfcKW, simAux: r.Paux * 1000 },
  };

  // ---------------------------------------------------------------- apparecchiature
  const eq = [];
  const E = (tag, desc, qty, kind, data, pDes = '', TDes = '', mat = '', kW = '') => eq.push({ tag, desc, qty, kind, data, pDes, TDes, mat, kW });
  const f1 = (v) => (Math.round(v * 10) / 10).toLocaleString('it-IT');
  const f0 = (v) => Math.round(v).toLocaleString('it-IT');
  const loadKW = (tag) => { const l = loads.find((x) => x.tag === tag); return l ? f0(l.rated) : ''; };
  const banks = bt.banks;
  const bankArea = (b, U) => {
    const d1 = b.TgIn - b.TwOut, d2 = b.TgOut - b.TwIn;
    const lmtd = Math.abs(d1 - d2) < 1e-3 ? d1 : (d1 - d2) / Math.log(d1 / d2);
    return (b.Q * 1e6) / (U * Math.max(lmtd, 2));
  };
  const coilInfo = {
    SH: { sys: 'HAH', U: 48, mat: (T) => (T > 545 ? 'SA-213 T91' : T > 450 ? 'SA-213 T22' : 'SA-210 C') },
    RH: { sys: 'HAJ', U: 42, mat: (T) => (T > 545 ? 'SA-213 T91' : 'SA-213 T22') },
    EVA: { sys: 'HAD', U: 40, mat: () => 'SA-210 C' },
    ECO: { sys: 'HAC', U: 36, mat: () => 'SA-210 C' },
    PRE: { sys: 'HAC', U: 32, mat: () => 'SA-210 C (alette in acciaio)' },
  };
  const lvlIdx = (name) => { const m = name.match(/\b(HP|IP|LP)\b/); return m ? names.indexOf(m[1]) : n - 1; };
  const designP = (k) => roundUp(bt.pDrum[k] * 1.1, 1);

  const tp = (sys) => (N > 1 ? `1..${N}${sys}` : `1${sys}`);
  eq.push({ group: 'Turbogas' });
  E(tp('MBA10'), `Turbina a gas heavy duty ${gtClass}`, N > 1 ? `${N}` : '1', 'Monoalbero, 3000 giri/min, combustori DLN',
    `P ISO ${f1(des.gtRef.Piso)} MW · η ${f1(des.gtRef.point.eta * 100)} % · β ${f1(cfg.gt.PR)} · aria ${f0(des.gtRef.point.mAir)} kg/s · scarico ${f1(des.gtRef.point.T4)} °C`, '', '', '', '');
  E(tp('MKA10'), 'Generatore sincrono TG', `${N}`, `Raffreddamento ad ${gens[0].cooling}`, `${f0(MVAgt)} MVA · ${String(kVgt).replace('.', ',')} kV · cosφ 0,85 · 50 Hz`);
  E(tp('MBL10'), 'Casa filtri aria aspirazione', `${N}`, 'Filtrazione a 3 stadi (G4/F9/E12), silenziatore', `Portata ${f0((gt.mAir * 3600) / 1.2)} m³/h · ΔP pulito ≤ ${cfg.gt.dpInlet} mbar`);
  E(tp('MBP10'), 'Skid valvole gas combustibile', `${N}`, 'Valvole di arresto/rapporto, regolazione, sfiato', `Portata ${f1(gt.mFuel * 3.6)} t/h · p alimentazione ${f1(pFG)} bar`, f1(pFG * 1.15), '60', 'AISI 316L');
  E(tp('EKG10'), 'Riscaldatore gas combustibile', `${N}`, 'Scambiatore a fascio tubiero, lato tubi acqua IP', `Duty ${f1((gt.mFuel * 2.3 * (cfg.gt.Tfuel - 15)) / 1000)} MW · gas 15 → ${cfg.gt.Tfuel} °C`, f1(pFG * 1.15), String(cfg.gt.Tfuel + 30), 'SA-516 70 / SA-213 TP316');
  E(tp('MBV10'), 'Centralina olio lubrificazione TG', `${N}`, 'Serbatoio, pompe AC 2×100 % + DC emergenza, refrigeranti', `Pompe ${loadKW(kks(1, 'MBV', 10, 'AP', 1))} kW`, '', '', '', loadKW(kks(1, 'MBV', 10, 'AP', 1)));
  E(tp('MBJ10'), 'Avviatore statico a frequenza variabile (SFC)', `${N}`, 'Convertitore a tiristori', `${f0(sfcKW)} kW in avviamento`, '', '', '', loadKW(kks(1, 'MBJ', 10, 'GH', 1)));

  eq.push({ group: 'Generatore di vapore a recupero (per ciascun GVR)' });
  E(tp('HAA00'), `GVR orizzontale a circolazione naturale, ${type === '3PRH' ? '3 livelli + RH' : type === '2P' ? '2 livelli' : '1 livello'}`, `${N}`, 'Tubi alettati, moduli prefabbricati',
    `Fumi ${f0(r.gas.m)} kg/s · ${f1(gt.T4)} → ${f1(bt.Tstack)} °C · duty ${f1(bt.Qhrsg)} MW`, '', '', '');
  const seen = {};
  for (const b of banks) {
    const kind = b.name.split(' ')[0].replace('(condensato)', '').trim();
    const ci = coilInfo[kind] ?? coilInfo.ECO;
    const k = lvlIdx(b.name);
    const sysNo = kind === 'PRE' ? 31 : kind === 'RH' ? 10 : (k + 1) * 10 + (seen[b.name] || 0);
    seen[b.name] = (seen[b.name] || 0) + 1;
    const A = bankArea(b, ci.U);
    const pd = kind === 'RH' ? roundUp(bt.pAdm[1] * 1.1, 1) : kind === 'PRE' ? roundUp(bt.pDrum[n - 1] * 1.6, 1) : designP(k);
    E(tp(`${ci.sys}${sysNo}`), `Banco ${b.name}`, `${N}`, 'Tubi alettati a spirale, collettori',
      `Duty ${f1(b.Q)} MW · fumi ${f0(b.TgIn)}→${f0(b.TgOut)} °C · H2O ${f0(b.TwIn)}→${f0(b.TwOut)} °C · superficie ~${f0(A)} m²`, f0(pd), f0(roundUp(b.TwOut + 25, 5)), ci.mat(b.TwOut));
  }
  names.forEach((lv, k) => {
    const sat = satP(bt.pDrum[k]);
    const holdS = k === n - 1 ? 600 : k === 0 ? 180 : 240;
    const mFeed = k === n - 1 ? bt.mLevels.reduce((a, b) => a + b, 0) : bt.mLevels[k];
    const V = Math.max(6, ((mFeed * holdS) / (1 / sat.vL)) * 2);
    const D = Math.cbrt((4 * V) / (Math.PI * 6));
    const Ld = 6 * D;
    const pd = designP(k);
    const Smpa = 118;
    const t = ((pd - 1) / 10 * (D * 1000 / 2)) / (Smpa - 0.6 * (pd - 1) / 10) + 3;
    E(tp(`HAD${(k + 1) * 10}BB001`), `Corpo cilindrico ${lv}${k === n - 1 && n > 1 ? ' con degasatore integrato' : ''}`, `${N}`, 'Orizzontale, separatori a ciclone',
      `DI ${f1(D)} m × L ${f1(Ld)} m · V ${f0(V)} m³ · spessore ~${f0(roundUp(t, 2))} mm · Tsat ${f1(sat.T)} °C`, f0(pd), f0(roundUp(Tsat(pd) + 10, 5)), 'SA-516 Gr.70');
  });
  const stackD = roundUp(Math.sqrt((4 * r.gas.m / ((op.pamb * 1e5) / (288 * (bt.Tstack + 273.15)))) / (Math.PI * 20)), 0.1);
  E(tp('HNE10'), 'Camino con silenziatore e serranda', `${N}`, 'Autoportante in acciaio, CEMS', `DI ${f1(stackD)} m · H ${meta.stackHeight} m · velocità fumi ~20 m/s`, '', '150', 'Acciaio al carbonio / Corten');
  E(tp('LAC10AP001/002'), 'Pompe alimento HP/IP', `${2 * N} (2×100 % per GVR)`, 'Centrifughe multistadio a barile, spillamento IP',
    `Q ${f0(pumps.fw1.Q)} m³/h · H ${f0(pumps.fw1.H)} m · ${f0(pumps.fw1.kW)} kW assorbiti`, f0(pFWhp * 1.25), f0(roundUp(bt.TsubLP + 20, 5)), 'Acciaio al 13 % Cr', loadKW(kks(1, 'LAC', 10, 'AP', 1)));
  E(tp('HAN10BB001'), 'Serbatoio flash spurghi', `${N}`, 'Verticale atmosferico', `Spurgo continuo ~1 % della produzione HP`, '6', '200', 'SA-516 Gr.70');
  E(tp('MAN10/20/30'), 'Stazioni di bypass TV con desurriscaldamento', `${N}`, 'Valvole di bypass HP, RH, LP al 100 %', `HP ${f0(bt.mLevels[0] * 3.6)} t/h${reheat ? ` · RH ${f0((bt.sections[1].m / N) * 3.6)} t/h` : ''}`, f0(designP(0)), f0(roundUp(bt.Tsh[0] + 10, 5)), 'F91 / F22');

  eq.push({ group: 'Turbina a vapore e ciclo termico' });
  const stDesc = n === 3 ? 'HP + IP/LP, risurriscaldata' : n === 2 ? 'HP + LP a due pressioni' : 'monocorpo';
  E('0MAA/MAB/MAC10', `Turbina a vapore a condensazione ${stDesc}`, '1', `Scarico ${cond.type === 'air' ? 'assiale verso ACC' : 'verso il basso'}, 3000 giri/min`,
    `P ${f1(r.Pst)} MW · HP ${f1(sec0.pIn)} bar/${f0(sec0.Tin)} °C · ${f1(sec0.m)} kg/s${reheat ? ` · RH ${f1(bt.pRHout)} bar/${f0(bt.Trh)} °C` : ''} · scarico ${f1(bt.pCond * 1000)} mbar · area scarico ${f1(des.stRef.lpArea)} m²`);
  E('0MKA10', 'Generatore sincrono TV', '1', `Raffreddamento ad ${gens[N].cooling}`, `${f0(MVAst)} MVA · ${String(kVst).replace('.', ',')} kV · cosφ 0,85`);
  if (cond.type === 'water') {
    const Tin = op.Tcw, Tout = op.Tcw + dTcwOp;
    const lmtd = (Tout - Tin) / Math.log((bt.Tcond - Tin) / (bt.Tcond - Tout));
    const A = (bt.Qcond * 1e6) / (3000 * lmtd);
    E('0MAG10', 'Condensatore a superficie', '1', 'Due passaggi, tubi in titanio, pozzo caldo', `Duty ${f0(bt.Qcond)} MW · ${f1(bt.pCond * 1000)} mbar · superficie ~${f0(A)} m² · acqua ${f0(des.mcw * 3.6 / 1.0)} t/h`, '1,0 / FV', '80', 'Mantello CS, tubi Ti Gr.2');
    E('0PAC10AP001..003', 'Pompe acqua di circolazione', '3 (3×50 %)', 'Verticali a pozzo umido', `Q ${f0(pumps.cw.Q)} m³/h · H ${pumps.cw.H} m · ${f0(pumps.cw.kW)} kW assorbiti`, '4,5', '50', 'Ghisa sferoidale / inox', loadKW(kks(0, 'PAC', 10, 'AP', 1)));
    E('0PAE10', 'Torre di raffreddamento evaporativa a tiraggio indotto', '1', `${ctCells} celle in linea, ventilatori assiali`, `Duty ${f0(des.QcondD)} MW · ΔT ${f1(cond.dTcw)} K · avvicinamento ~6 K`, '', '', 'Calcestruzzo / GRP');
  } else {
    E('0MAG10', 'Aerocondensatore (ACC)', '1', `${accCells} celle a A, ventilatori assiali`, `Duty ${f0(bt.Qcond)} MW · ITD ${cond.ITD} K · ${f1(bt.pCond * 1000)} mbar`, '1,0 / FV', '120', 'Tubi alettati in acciaio alluminato', loadKW(kks(0, 'MAG', 10, 'AN', 1)));
  }
  E('0LCB10AP001/002', 'Pompe estrazione condensato', '2 (2×100 %)', 'Verticali a barile, multistadio', `Q ${f0(pumps.cd.Q)} m³/h · H ${f0(pumps.cd.H)} m · ${f0(pumps.cd.kW)} kW assorbiti`, f1(bt.pDrum[lowest] * 1.8 + 4), '80', 'Ghisa / inox', loadKW(kks(0, 'LCB', 10, 'AP', 1)));
  E('0MAJ10AP001/002', 'Pompe del vuoto ad anello liquido', '2 (2×100 %)', 'Con separatore e refrigerante', 'Mantenimento vuoto ed evacuazione all\'avviamento', '', '', '', loadKW(kks(0, 'MAJ', 10, 'AP', 1)));
  E('0MAW10', 'Condensatore vapore tenute', '1', 'Fascio tubiero, estrattori 2×100 %', 'Lato acqua: condensato principale', '', '', 'CS / inox');

  eq.push({ group: 'Sistemi ausiliari (BoP)' });
  E('0EKA10', 'Stazione di ricevimento e riduzione gas', '1', 'Filtrazione, misura fiscale, riduzione 2×100 %, preriscaldo', `Portata ${f0((gt.mFuel * N * 3600) / 0.74)} Sm³/h · uscita ${f1(pFG)} bar`, '75', '60', 'API 5L X52');
  E('0PGB10', 'Circuito acqua di raffreddamento chiuso', '1', 'Pompe 2×100 %, aerotermi, vaso di espansione', `Calore ausiliari ~${f1(qCCW / 1000)} MW`, '10', '60', 'CS');
  E('0SCA10AN001/002', 'Compressori aria strumenti e servizi', '2 (2×100 %)', 'A vite oil-free, essiccatori', '~1200 Nm³/h a 8 bar', '10', '60', '', loadKW(kks(0, 'SCA', 10, 'AN', 1)));
  E('0GCF10', 'Impianto acqua demineralizzata', '1', 'Osmosi inversa + EDI', `~${f0(bt.mSteamTot * 0.02 * 3.6 + 10)} m³/h`, '', '', '', loadKW(kks(0, 'GCF', 10, 'AP', 1)));
  E('0GHC10BB001', 'Serbatoio acqua demineralizzata', '1', 'Cilindrico verticale a tetto fisso', `${f0(roundUp(bt.mSteamTot * 3.6 * 4, 100))} m³`, 'Atm.', '50', 'Inox AISI 304L');
  E('0SGA10', 'Stazione pompe antincendio', '1', 'Elettrica + diesel + jockey (UNI EN 12845 / NFPA 20)', 'Serbatoio riserva idrica dedicato', '', '', '', loadKW(kks(0, 'SGA', 10, 'AP', 1)));
  E('0XJA10', 'Generatore diesel di emergenza', '1', 'Avviamento automatico, 400 V', `${f0(electrical.edgKVA)} kVA`);

  eq.push({ group: 'Sistema elettrico' });
  for (const t of gsu) E(t.tag, `Trasformatore elevatore ${t.gen.startsWith('0') ? 'TV' : 'TG' + t.gen[0]}`, '1', 'ONAN/ONAF, YNd11', `${f0(t.MVA)} MVA · ${t.ratio} · ucc ${t.uk} %`, '', '', 'Olio minerale');
  for (const g of gens) E(g.tag.replace('MKA', 'BAC'), `Interruttore di generatore ${g.name.replace('Generatore ', '')}`, '1', 'SF6 / vuoto in condotto a fasi isolate', `${String(g.kV).replace('.', ',')} kV · In ≥ ${f0((g.MVA * 1000) / (Math.sqrt(3) * g.kV) * 1.1)} A`);
  for (const u of uats) E(u.tag, 'Trasformatore servizi di unità', '1', 'ONAN, Dyn1', `${String(u.MVA).replace('.', ',')} MVA · ${u.ratio}`, '', '', 'Olio minerale');
  for (const t of lvTr) E(t.tag, 'Trasformatore MT/BT', '1', 'Resina, Dyn11', `${t.kVA} kVA · 6/0,42 kV`, '', '', 'Resina epossidica');
  E('0AEA10', `Sottostazione AT ${hvKV} kV isolata in gas (GIS)`, '1', 'Doppia sbarra, stalli di linea e di macchina', `${gens.length} stalli macchina + 2 stalli linea + parallelo sbarre`);

  eq.forEach((e, i) => { if (!e.group) e.no = String(eq.slice(0, i + 1).filter((x) => !x.group).length); });

  // ---------------------------------------------------------------- disposizione planimetrica (m)
  const layout = buildLayout(cfg, des, r, meta, { ctCells, accCells, stackD, MVAgt, N, n });

  return {
    meta, cfg, des, r, op, N, n, names, type, reheat, gtClass,
    streams, st, lines, lineById, eq, loads, electrical, pumps, layout,
    pFG, ctCells, accCells, stackD,
  };
}

function buildLayout(cfg, des, r, meta, { ctCells, accCells, stackD, MVAgt, N, n }) {
  const items = [];
  const gt = r.gt;
  const mAir = cfg.gt.mAirISO;
  const add = (o) => { items.push(o); return o; };
  // dimensioni principali
  const Lgen = 10 + MVAgt * 0.012, Wgen = 6;
  const Lgt = 16 + mAir * 0.022, Wgt = 8 + mAir * 0.006;
  const rhoIn = (gt.p4 * 1e5) / (288 * (gt.T4 + 273.15));
  const Aface = gt.mExh / rhoIn / 6.5;
  const Hh = Math.min(32, Math.max(18, Math.sqrt(Aface * 1.9)));
  const Wh = Math.max(8, Aface / Hh);
  const Lh = 10 + r.bt.banks.length * 2.8;
  const Ldiff = 8;
  const pitch = Math.max(Wh, Wgt + 6) + 22;
  const X0 = 70; // a ovest restano GIS e trasformatori
  const Y0 = 120; // a sud restano sala macchine e raffreddamento
  const trains = [];
  for (let i = 0; i < N; i++) {
    const yc = Y0 + i * pitch + pitch / 2;
    const u = i + 1;
    const xg = X0;
    const gen = add({ tag: `${u}MKA10`, name: `Generatore TG${u}`, kind: 'box', x: xg, y: yc - Wgen / 2, w: Lgen, d: Wgen, h: 6, grp: 'el' });
    const gtb = add({ tag: `${u}MBA10`, name: `TG${u}`, kind: 'box', x: xg + Lgen + 2, y: yc - Wgt / 2, w: Lgt, d: Wgt, h: 11, grp: 'gt' });
    add({ tag: `${u}MBL10`, name: 'Filtri aria', kind: 'box', x: xg + Lgen - 4, y: yc - Wgt * 0.9, w: 14, d: Wgt * 1.8, h: 10, z: 13, grp: 'gt', elevated: true });
    const xd = gtb.x + Lgt;
    add({ tag: `${u}MBR10`, name: 'Diffusore', kind: 'box', x: xd, y: yc - Wh / 2.6, w: Ldiff, d: Wh / 1.3, h: Hh * 0.6, grp: 'hrsg' });
    const hr = add({ tag: `${u}HAA00`, name: `GVR${u}`, kind: 'box', x: xd + Ldiff, y: yc - Wh / 2, w: Lh, d: Wh, h: Hh, grp: 'hrsg' });
    const stk = add({ tag: `${u}HNE10`, name: `Camino ${u}`, kind: 'cyl', x: hr.x + Lh + stackD / 2 + 1.5, y: yc, r: stackD / 2, h: meta.stackHeight, grp: 'hrsg' });
    add({ tag: `${u}BAT10`, name: `TR elevatore TG${u}`, kind: 'box', x: xg - 22, y: yc - 5, w: 12, d: 8, h: 7, grp: 'el' });
    add({ tag: `${u}BBT10`, name: 'TR servizi', kind: 'box', x: xg - 22, y: yc + 5.5, w: 6, d: 5, h: 4.5, grp: 'el' });
    add({ tag: `${u}LAC10`, name: 'Pompe alimento', kind: 'box', x: hr.x + 2, y: yc + Wh / 2 + 3, w: 10, d: 6, h: 4, grp: 'bop' });
    trains.push({ u, yc, gen, gt: gtb, hr, stk, xHot: hr.x });
  }
  const yTop = Y0 + N * pitch;
  // sala macchine TV
  const Pst = r.Pst;
  const Lst = 40 + Pst * 0.09, Wst = 32;
  const st = add({ tag: '0UMA', name: 'Sala macchine TV', kind: 'box', x: X0, y: Y0 - Wst - 14, w: Lst, d: Wst, h: 28, grp: 'st', hall: true });
  add({ tag: '0MAA10', name: 'TV', kind: 'box', x: st.x + 8, y: st.y + Wst / 2 - 4, w: Lst * 0.55, d: 8, h: 6, z: 12, grp: 'st', inner: true });
  add({ tag: '0MKA10', name: 'Gen. TV', kind: 'box', x: st.x + 10 + Lst * 0.55, y: st.y + Wst / 2 - 3, w: Lst * 0.25, d: 6, h: 6, z: 12, grp: 'el', inner: true });
  add({ tag: '0BAT20', name: 'TR elevatore TV', kind: 'box', x: X0 - 22, y: st.y + Wst / 2 - 4, w: 12, d: 8, h: 7, grp: 'el' });
  add({ tag: '0UBA', name: 'Edificio elettrico e sala controllo', kind: 'box', x: X0 - 52, y: st.y, w: 26, d: Wst, h: 16, grp: 'bld' });
  // pipe rack nord-sud tra TV e GVR
  const xr = trains[0].xHot - 4;
  const rack = add({ tag: '0UQA', name: 'Pipe rack', kind: 'box', x: xr, y: st.y + Wst, w: 6, d: yTop - (st.y + Wst) - pitch / 2 + 6, h: 2, z: 10, grp: 'rack' });
  add({ tag: '0UQA', name: 'Pipe rack', kind: 'box', x: st.x + Lst - 2, y: st.y + Wst - 8, w: xr - (st.x + Lst) + 8, d: 6, h: 2, z: 10, grp: 'rack' });
  // raffreddamento
  if (cfg.steam.condenser.type === 'water') {
    const perRow = Math.min(ctCells, 8);
    const rows = Math.ceil(ctCells / perRow);
    const cs = 16;
    const x0 = st.x + Lst + 30;
    const y0 = st.y - rows * cs - 20 + Wst;
    for (let i = 0; i < ctCells; i++) {
      add({ tag: '0PAE10', name: i === 0 ? 'Torre di raffreddamento' : '', kind: 'box', x: x0 + (i % perRow) * cs, y: y0 + Math.floor(i / perRow) * cs, w: cs, d: cs, h: 15, grp: 'cool', cell: true });
    }
    add({ tag: '0PAC10', name: 'Pompe circolazione', kind: 'box', x: x0 - 22, y: y0 + 2, w: 16, d: 10, h: 5, grp: 'bop' });
  } else {
    const perRow = Math.ceil(Math.sqrt(accCells * 1.6));
    const rows = Math.ceil(accCells / perRow);
    const cs = 12;
    const x0 = st.x + Lst + 12;
    for (let i = 0; i < accCells; i++) {
      add({ tag: '0MAG10', name: i === 0 ? 'Aerocondensatore' : '', kind: 'box', x: x0 + (i % perRow) * cs, y: st.y - 6 + Math.floor(i / perRow) * cs - rows * cs / 2 + Wst / 2, w: cs, d: cs, h: 10, z: 24, grp: 'cool', cell: true, legs: true });
    }
  }
  // BoP e edifici
  const xE = Math.max(...trains.map((t) => t.stk.x)) + 30;
  add({ tag: '0EKA10', name: 'Stazione gas', kind: 'box', x: xE, y: yTop - 30, w: 30, d: 16, h: 4, grp: 'bop' });
  add({ tag: '0GHC10', name: 'Serbatoio demi', kind: 'cyl', x: xE + 10, y: Y0 + 12, r: 7, h: 12, grp: 'tank' });
  add({ tag: '0GCF10', name: 'Impianto demi', kind: 'box', x: xE + 22, y: Y0 + 4, w: 22, d: 14, h: 8, grp: 'bld' });
  add({ tag: '0SGA10', name: 'Serbatoio antincendio', kind: 'cyl', x: xE + 10, y: Y0 + 38, r: 9, h: 14, grp: 'tank' });
  add({ tag: '0SGA20', name: 'Pompe antincendio', kind: 'box', x: xE + 22, y: Y0 + 32, w: 14, d: 10, h: 6, grp: 'bld' });
  add({ tag: '0PGB10', name: 'Aerotermi ciclo chiuso', kind: 'box', x: st.x + Lst - 30, y: st.y - 18, w: 26, d: 10, h: 6, grp: 'bop' });
  add({ tag: '0XJA10', name: 'Diesel emergenza', kind: 'box', x: X0 - 52, y: st.y - 16, w: 12, d: 8, h: 5, grp: 'el' });
  add({ tag: '0AEA10', name: `GIS ${''}AT`, kind: 'box', x: X0 - 62, y: Y0 + 10, w: 30, d: Math.max(30, N * pitch - 20), h: 14, grp: 'el' });
  add({ tag: '0UYA', name: 'Uffici e magazzino', kind: 'box', x: X0 - 62, y: yTop + 6, w: 40, d: 20, h: 9, grp: 'bld' });
  add({ tag: '0SCA10', name: 'Compressori aria', kind: 'box', x: st.x + 4, y: st.y - 18, w: 14, d: 10, h: 5, grp: 'bop' });

  // confini
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const it of items) {
    const x0 = it.kind === 'cyl' ? it.x - it.r : it.x, x1 = it.kind === 'cyl' ? it.x + it.r : it.x + it.w;
    const y0 = it.kind === 'cyl' ? it.y - it.r : it.y, y1 = it.kind === 'cyl' ? it.y + it.r : it.y + it.d;
    minX = Math.min(minX, x0); maxX = Math.max(maxX, x1); minY = Math.min(minY, y0); maxY = Math.max(maxY, y1);
  }
  const road = 7, margin = 12;
  const site = { x0: minX - road - margin, y0: minY - road - margin, x1: maxX + road + margin, y1: maxY + road + margin };
  // shift so that site starts at (0, 0)
  const dx = -site.x0, dy = -site.y0;
  for (const it of items) { it.x += dx; it.y += dy; }
  for (const t of trains) { t.yc += dy; }
  const siteW = site.x1 - site.x0, siteD = site.y1 - site.y0;
  const inner = { x0: margin, y0: margin, x1: siteW - margin, y1: siteD - margin };

  // instradamento della linea vapore HP dal GVR 1 alla TV (coordinate m, z = quota)
  const t1 = trains[0];
  const hr1 = t1.hr;
  const stHall = st;
  const turb = items.find((i) => i.tag === '0MAA10');
  const p0 = [hr1.x + 3, hr1.y, hr1.h + 1.5];
  const route = [
    p0,
    [p0[0], p0[1], p0[2] + 2.5],
    [p0[0], hr1.y - 3, p0[2] + 2.5],
    [rack.x + 3, hr1.y - 3, p0[2] + 2.5],
    [rack.x + 3, hr1.y - 3, 12],
    [rack.x + 3, stHall.y + stHall.d - 5, 12],
    [turb.x + 4, stHall.y + stHall.d - 5, 12],
    [turb.x + 4, turb.y + turb.d / 2, 12],
    [turb.x + 4, turb.y + turb.d / 2, 9.5],
  ];

  return { items, site: { w: siteW, d: siteD }, inner, road, trains, pitch, st, route, dims: { Lgen, Lgt, Wgt, Lh, Wh, Hh, Lst, Wst } };
}

export { GT_PRESETS };
