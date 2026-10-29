// Schemi di processo complementari al PFD generale: casi di funzionamento,
// percorso aria/fumi, ciclo acqua-vapore, sistemi di raffreddamento, bilancio
// idrico, gas combustibile e vapore ausiliario. Schemi a blocchi con correnti
// numerate e tabelle dei valori ricavati dal modello.

import { Sheet, ST, frame, notesBox, FRAME, tableSheets } from './sheet.js';
import { plantPoint, defaultOperation, ISO } from '../engine/plant.js';
import { utilitiesBalance } from '../engine/utilities.js';

const W = '#ffffff';
const GREY = '#eeeeee';
const f = (v, d = 1) => (Number.isFinite(v) ? v.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
const m3h = (kgs, rho = 998) => (kgs * 3600) / rho;

// ------------------------------------------------------------------ primitive
function newSheet(M, doc, title, sub) {
  const sh = new Sheet();
  frame(sh, M.meta, { ...doc, sheetNo: 1, sheetCount: 1, scale: 'non in scala' });
  sh.text(FRAME.x0 + 4, FRAME.y0 + 8, title.toUpperCase(), { size: 3.2, bold: true });
  if (sub) sh.text(FRAME.x0 + 4, FRAME.y0 + 12, sub, { size: 2 });
  return sh;
}
function block(sh, x, y, w, h, tag, name, lines = [], { fill = W } = {}) {
  sh.rect(x, y, w, h, { s: '#000000', w: 0.45, f: fill });
  let yy = y + 4;
  if (tag) { sh.text(x + w / 2, yy, tag, { size: 1.6, anchor: 'middle', bold: true }); yy += 2.8; }
  for (const t of [].concat(name || [])) { sh.text(x + w / 2, yy, t, { size: 1.5, anchor: 'middle' }); yy += 2.5; }
  for (const t of lines) { sh.text(x + w / 2, yy, t, { size: 1.3, anchor: 'middle' }); yy += 2.2; }
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, r: x + w, b: y + h };
}
function diamond(sh, x, y, num) {
  const r = 2.6;
  sh.path([[x, y - r], [x + r, y], [x, y + r], [x - r, y]], { s: '#000000', w: 0.3, f: W }, true);
  sh.textMid(x, y, String(num), { size: 1.7, anchor: 'middle', bold: true });
}
/** Corrente: polilinea con freccia finale, numero di corrente ed etichetta sul segmento più lungo. */
function flow(sh, pts, { num = null, label = null, st = ST.med, at = 0.5, side = -1 } = {}) {
  sh.path(pts, st);
  const a = pts[pts.length - 2], b = pts[pts.length - 1];
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), s = 2;
  sh.path([[b[0], b[1]], [b[0] - s * Math.cos(ang - 0.4), b[1] - s * Math.sin(ang - 0.4)], [b[0] - s * Math.cos(ang + 0.4), b[1] - s * Math.sin(ang + 0.4)]], { f: '#000000' }, true);
  let best = 0, len = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (d > len) { len = d; best = i - 1; } }
  const p0 = pts[best], p1 = pts[best + 1];
  const mx = p0[0] + (p1[0] - p0[0]) * at, my = p0[1] + (p1[1] - p0[1]) * at;
  const vert = Math.abs(p1[0] - p0[0]) < Math.abs(p1[1] - p0[1]);
  if (num !== null) diamond(sh, mx, my, num);
  if (label) {
    const ls = [].concat(label);
    ls.forEach((t, i) => {
      if (vert) sh.text(mx + (side < 0 ? -3.5 : 3.5), my + 4.5 + i * 2.3, t, { size: 1.3, anchor: side < 0 ? 'end' : 'start' });
      else sh.text(mx + (num !== null ? 4 : 0), my + side * 1.6 - (side < 0 ? (ls.length - 1 - i) * 2.3 : -i * 2.3) + (side > 0 ? 1.2 : 0), t, { size: 1.3, anchor: num !== null ? 'start' : 'middle' });
    });
  }
}
/** Tabella disegnata sul foglio. cols: [[titolo, larghezza, 'r'|'l']]. */
function table(sh, x, y, cols, rows, { rh = 3, size = 1.55, title = null } = {}) {
  if (title) { sh.text(x, y - 1.5, title, { size: 1.8, bold: true }); }
  const xs = [x];
  for (const c of cols) xs.push(xs[xs.length - 1] + c[1]);
  const x1 = xs[xs.length - 1];
  sh.rect(x, y, x1 - x, 4.4, { s: '#000000', w: 0.3, f: GREY });
  cols.forEach((c, i) => sh.text(c[2] === 'r' ? xs[i + 1] - 0.8 : xs[i] + 0.8, y + 3.1, c[0], { size: size, bold: true, anchor: c[2] === 'r' ? 'end' : 'start' }));
  let yy = y + 4.4;
  for (const r of rows) {
    if (r.group) { sh.rect(x, yy, x1 - x, rh, { s: '#000000', w: 0.2, f: '#f6f6f6' }); sh.text(x + 0.8, yy + rh - 0.8, r.group, { size, bold: true }); yy += rh; continue; }
    r.forEach((v, i) => sh.text(cols[i][2] === 'r' ? xs[i + 1] - 0.8 : xs[i] + 0.8, yy + rh - 0.8, String(v ?? ''), { size, anchor: cols[i][2] === 'r' ? 'end' : 'start' }));
    yy += rh;
    sh.line(x, yy, x1, yy, ST.hair);
  }
  for (let i = 1; i < xs.length - 1; i++) sh.line(xs[i], y, xs[i], yy, ST.hair);
  sh.rect(x, y, x1 - x, yy - y, ST.norm);
  return yy;
}
const streamCols = [['N.', 8, 'l'], ['Corrente', 66, 'l'], ['Fluido', 24, 'l'], ['Portata [kg/s]', 18, 'r'], ['[t/h] o [m³/h]', 18, 'r'], ['p [bar a]', 14, 'r'], ['T [°C]', 13, 'r'], ['Note', 40, 'l']];

// ------------------------------------------------------------------ casi di funzionamento
export function operatingCases(M) {
  const { cfg, des } = M;
  const water = M.water;
  const TcwFor = (Tamb) => (water ? Math.max(8, cfg.steam.condenser.TcwDesign + 0.55 * (Tamb - 15)) : cfg.steam.condenser.TcwDesign);
  const defs = [
    ['ISO 100 %', 15, 1], ['ISO 75 %', 15, 0.75], ['ISO 50 %', 15, 0.5], ['35 °C 100 %', 35, 1], ['−5 °C 100 %', -5, 1],
  ];
  return defs.map(([name, Tamb, load]) => {
    const op = { ...defaultOperation(), ...ISO, Tamb, rh: Tamb > 30 ? 0.4 : Tamb < 0 ? 0.8 : 0.6, load, nGTon: M.N, Tcw: TcwFor(Tamb), ductT: 0, slidingHP: true };
    const r = plantPoint(cfg, des, op);
    const U = utilitiesBalance(cfg, des, r);
    return { name, Tamb, load, op, r, U };
  });
}

export function casesTable(M) {
  const cases = operatingCases(M);
  const columns = [{ key: 'p', title: 'Grandezza', w: 92 }, { key: 'u', title: 'Unità', w: 20 }, ...cases.map((c, i) => ({ key: `c${i}`, title: c.name, w: 38, align: 'right' }))];
  const rows = [];
  const add = (p, u, fn, d = 1) => { const row = { p, u }; cases.forEach((c, i) => { let v; try { v = fn(c); } catch { v = NaN; } row[`c${i}`] = typeof v === 'string' ? v : f(v, d); }); rows.push(row); };
  const grp = (g) => rows.push({ group: g });
  grp('Condizioni');
  add('Temperatura ambiente', '°C', (c) => c.Tamb, 0);
  add('Umidità relativa', '%', (c) => c.op.rh * 100, 0);
  add('Carico TG', '%', (c) => c.load * 100, 0);
  add('Temperatura acqua di raffreddamento', '°C', (c) => (M.water ? c.op.Tcw : NaN), 1);
  grp('Prestazioni');
  add(`Potenza TG (totale ${M.N} TG)`, 'MW', (c) => c.r.Pgt, 1);
  add('Potenza TV', 'MW', (c) => c.r.Pst, 1);
  add('Potenza lorda', 'MW', (c) => c.r.gross, 1);
  add('Consumi ausiliari', 'MW', (c) => c.r.Paux, 2);
  add('Potenza netta', 'MW', (c) => c.r.net, 1);
  add('Rendimento netto (PCI)', '%', (c) => c.r.eta * 100, 2);
  add('Consumo specifico netto (PCI)', 'kJ/kWh', (c) => 3600 / c.r.eta, 0);
  add('Potenza termica combustibile (PCI)', 'MW', (c) => c.r.Qfuel, 1);
  grp('Turbogas (per unità)');
  add('Portata aria compressore', 'kg/s', (c) => c.r.gt.mAir, 1);
  add('Portata gas naturale', 'kg/s', (c) => c.r.gt.mFuel, 2);
  add('Rapporto di compressione', '—', (c) => c.r.gt.PR, 2);
  add('Temperatura ingresso turbina (TIT)', '°C', (c) => c.r.gt.TIT, 0);
  add('Portata fumi allo scarico', 'kg/s', (c) => c.r.gt.mExh, 1);
  add('Temperatura fumi allo scarico', '°C', (c) => c.r.gt.T4, 1);
  add('Apertura IGV', '%', (c) => (c.r.gt.igv ?? NaN) * 100, 0);
  grp('GVR e ciclo a vapore (per GVR)');
  M.names.forEach((nm, k) => {
    add(`Vapore ${nm}: portata`, 't/h', (c) => c.r.bt.mLevels[k] * 3.6, 1);
    add(`Vapore ${nm}: pressione ammissione`, 'bar a', (c) => c.r.bt.pAdm[k], 1);
    add(`Vapore ${nm}: temperatura`, '°C', (c) => c.r.bt.Tsh[k], 1);
  });
  if (M.reheat) add('Temperatura RH caldo', '°C', (c) => c.r.bt.Trh, 1);
  add('Temperatura fumi al camino', '°C', (c) => c.r.bt.Tstack, 1);
  add('Pressione al condensatore', 'mbar', (c) => c.r.bt.pCond * 1000, 1);
  add('Calore scaricato al condensatore', 'MW', (c) => c.r.bt.Qcond, 1);
  grp('Emissioni e utilities');
  add('Emissioni di CO₂', 't/h', (c) => c.r.co2, 1);
  add('Emissione specifica di CO₂', 'kg/MWh', (c) => c.r.co2Spec, 0);
  add('Gas naturale', 'Sm³/h', (c) => c.U.gas.Sm3h, 0);
  if (M.tower) add('Reintegro torre', 'm³/h', (c) => c.U.cooling.makeupM3h, 0);
  add('Acqua grezza totale', 'm³/h', (c) => c.U.rawWaterM3h, 0);
  add('Acqua demi (reintegro ciclo)', 'm³/h', (c) => c.U.demi.demiM3h, 1);
  add('Acque reflue', 'm³/h', (c) => c.U.ww.totalM3h, 1);
  return {
    columns, rows,
    notes: [
      'Casi calcolati con il modello del simulatore alla configurazione corrente, tutti i TG in servizio, pressione HP scorrevole, senza post-combustione. Carichi parziali con regolazione IGV a temperatura di scarico costante, poi riduzione della TIT.',
      M.water ? 'Temperatura dell\'acqua di raffreddamento variata con la temperatura ambiente (0,55 K/K attorno al valore di progetto).' : 'Aerocondensatore: ITD proporzionale al carico termico.',
    ],
  };
}

// ------------------------------------------------------------------ percorso aria e fumi
export function pfdGasSheets(M, doc) {
  const r = M.r, gt = r.gt, bt = r.bt;
  const sh = newSheet(M, doc, 'Percorso aria e fumi (per treno)', `Punto ISO carico base · ${M.gtClass} · valori per singolo TG/GVR`);
  const y = 48, h = 26;
  const b1 = block(sh, 24, y, 30, h, '1MBL10', 'Filtri aria', [`Δp ${M.cfg.gt.dpInlet} mbar`]);
  const b2 = block(sh, 66, y, 30, h, '1MBA10', 'Compressore', [`β ${f(gt.PR, 1)}`, `${f(gt.Wc, 1)} MW`]);
  const b3 = block(sh, 108, y, 30, h, '1MBA10', 'Combustori DLN', [`TIT ${f(gt.TIT, 0)} °C`]);
  const b4 = block(sh, 150, y, 30, h, '1MBA10', 'Turbina', [`${f(gt.Wt, 1)} MW`]);
  const b5 = block(sh, 192, y, 30, h, '1MKA10', 'Generatore', [`${f(gt.P, 1)} MW`]);
  let n = 1;
  const S = [];
  const add = (desc, fluid, m, p, T, note = '') => { S.push([n, desc, fluid, f(m, 1), f(m * 3.6, 0), f(p, 3), f(T, 1), note]); return n++; };
  flow(sh, [[12, y + 13], [b1.x, y + 13]], { num: add('Aria ambiente', 'Aria umida', gt.mAir, M.op.pamb, M.op.Tamb, `UR ${Math.round(M.op.rh * 100)} %`), at: 0.4 });
  flow(sh, [[b1.r, y + 13], [b2.x, y + 13]], { num: add('Aria ingresso compressore', 'Aria umida', gt.mAir, gt.p1, gt.T1) });
  flow(sh, [[b2.r, y + 13], [b3.x, y + 13]], { num: add('Aria mandata compressore', 'Aria', gt.mAir, gt.p2, gt.T2) });
  flow(sh, [[b3.cx, 30], [b3.cx, y]], { num: add('Gas naturale', 'Gas naturale', gt.mFuel, M.pFG, M.cfg.gt.Tfuel, `PCI ${f(M.des.fuel.lhv / 1000, 2)} MJ/kg`), side: 1 });
  sh.text(b3.cx + 3, 31, 'gas naturale', { size: 1.3 });
  flow(sh, [[b3.r, y + 13], [b4.x, y + 13]], { num: add('Gas combusti ingresso turbina', 'Fumi', gt.mExh, gt.p3, gt.TIT, 'portata incl. aria di raffreddamento') });
  sh.line(b4.r, y + 13, b5.x, y + 13, ST.heavy);
  // aria di raffreddamento
  flow(sh, [[b2.cx, b2.b], [b2.cx, y + h + 8], [b4.cx, y + h + 8], [b4.cx, b4.b]], { label: 'aria di raffreddamento statori e rotori', st: ST.norm, side: 1 });
  // GVR
  const banks = bt.banks;
  const yb = 104, hb = 30;
  const x0 = 34, x1 = 386;
  const bw = Math.min(30, (x1 - x0) / banks.length - 4);
  const gap = (x1 - x0 - bw * banks.length) / Math.max(1, banks.length);
  flow(sh, [[b4.cx + 6, b4.b], [b4.cx + 6, y + h + 16], [16, y + h + 16], [16, yb + hb / 2], [x0, yb + hb / 2]], { num: add('Scarico TG / ingresso GVR', 'Fumi', gt.mExh, gt.p4, gt.T4), at: 0.35, st: ST.thick });
  let xb = x0;
  banks.forEach((bk, i) => {
    const b = block(sh, xb, yb, bw, hb, null, bk.name.split(' '), [`${f(bk.Q, 1)} MW`, `${f(bk.TwIn, 0)}→${f(bk.TwOut, 0)} °C`], { fill: '#fafafa' });
    const xn = xb + bw + gap;
    if (i < banks.length - 1) {
      const nn = add(`Fumi uscita ${bk.name}`, 'Fumi', r.gas.m, M.op.pamb + 0.01, bk.TgOut);
      flow(sh, [[b.r, b.cy], [xn, b.cy]], { st: ST.thick });
      diamond(sh, b.r + gap / 2, b.cy - 6, nn);
      sh.text(b.r + gap / 2, b.cy + 5, `${f(bk.TgOut, 0)}°`, { size: 1.25, anchor: 'middle' });
    } else {
      flow(sh, [[b.r, b.cy], [b.r + 8, b.cy], [b.r + 8, yb - 6]], { st: ST.thick });
      const nn = add('Fumi al camino', 'Fumi', r.gas.m, M.op.pamb, bt.Tstack, `O₂ secco ${f(r.stackO2dry, 1)} %`);
      diamond(sh, b.r + 8, yb - 12, nn);
      sh.text(b.r + 11, yb - 10, `camino · ${f(bt.Tstack, 0)} °C`, { size: 1.3 });
    }
    xb = xn;
  });
  sh.text(x0, yb - 3, `GVR – banchi in ordine lato fumi (Q = potenza scambiata; temperature lato acqua/vapore). Totale ${f(bt.Qhrsg, 1)} MW.`, { size: 1.45 });
  // composizione fumi
  const x = r.gas.x;
  const tx = 240;
  table(sh, tx, 30, [['Composizione fumi', 34, 'l'], ['% mol umida', 22, 'r'], ['% mol secca', 22, 'r']],
    ['N2', 'O2', 'Ar', 'CO2', 'H2O'].map((k) => [k.replace('2', '₂'), f(x[k] * 100, 2), k === 'H2O' ? '—' : f((x[k] / (1 - x.H2O)) * 100, 2)]), { title: 'FUMI ALLO SCARICO TG' });
  // tabella correnti
  const yEnd = table(sh, FRAME.x0 + 4, 150, streamCols, S, { title: 'TABELLA CORRENTI' });
  notesBox(sh, 'NOTE', [
    `Rendimento TG ${f(gt.eta * 100, 2)} % PCI; perdita al camino ${f(r.stackLoss, 1)} MW per l'intero impianto. Valori riferiti a un treno.`,
  ], { y1: Math.max(yEnd + 30, FRAME.y1 - 4) > FRAME.y1 - 4 ? FRAME.y1 - 4 : FRAME.y1 - 4 });
  return [sh];
}

// ------------------------------------------------------------------ ciclo acqua-vapore
export function pfdSteamSheets(M, doc) {
  const r = M.r, bt = r.bt;
  const sh = newSheet(M, doc, 'Ciclo acqua-vapore', `${M.N}+1 · GVR ${M.type} · portate per GVR salvo diversa indicazione`);
  const n = M.n, names = M.names;
  let k = 1;
  const S = [];
  const add = (desc, fluid, m, p, T, note = '') => { S.push([k, desc, fluid, f(m, 2), f(m * 3.6, 1), p < 1 ? f(p, 3) : f(p, 2), f(T, 1), note]); return k++; };
  // TV
  const yT = 40;
  const secs = bt.sections;
  const tw = 38;
  const tv = secs.map((s, i) => block(sh, 230 + i * (tw + 10), yT, tw, 24, `0MA${'ABC'[i] || 'C'}10`, `TV sezione ${['HP', 'IP', 'LP'][i] ?? i + 1}`, [`${f(s.m, 1)} kg/s`, `${f(s.pIn, 1)} → ${f(s.pOut ?? bt.pCond, 2)} bar`]));
  const gen = block(sh, 230 + secs.length * (tw + 10), yT, 22, 24, '0MKA10', 'Gen.', [`${f(r.Pst, 1)} MW`]);
  tv.forEach((b, i) => { if (i) sh.line(tv[i - 1].r, b.cy, b.x, b.cy, ST.heavy); });
  sh.line(tv[tv.length - 1].r, yT + 12, gen.x, yT + 12, ST.heavy);
  // GVR livelli
  const yL = 96;
  const lw = 52;
  const lv = names.map((nm, i) => block(sh, 30 + i * (lw + 14), yL, lw, 34, `1HAD${(i + 1) * 10}`, `Livello ${nm}`, [
    `corpo ${f(bt.pDrum[i], 1)} bar · Tsat ${f(bt.Tsat[i], 1)} °C`, `vapore ${f(bt.mLevels[i] * 3.6, 1)} t/h`, `SH ${f(bt.Tsh[i], 1)} °C`,
  ], { fill: '#fafafa' }));
  sh.text(30, yL - 4, M.N > 1 ? `GVR1…${M.N} (valori per GVR)` : 'GVR', { size: 1.6, bold: true });
  // vapore HP alla TV
  const sHP = add(`Vapore HP all'ammissione TV`, 'Vapore', secs[0].m, secs[0].pIn, secs[0].Tin, M.N > 1 ? `totale ${M.N} GVR` : '');
  flow(sh, [[lv[0].cx, yL], [lv[0].cx, yT + 12], [tv[0].x, yT + 12]], { num: sHP, at: 0.5 });
  if (M.reheat) {
    const sCR = add('Risurriscaldato freddo (scarico HP)', 'Vapore', secs[0].m, bt.pAdm[1], secs[0].Tout);
    flow(sh, [[tv[0].cx, yT + 24], [tv[0].cx, 78], [lv[1].cx - 8, 78], [lv[1].cx - 8, yL]], { num: sCR, at: 0.4, st: ST.norm });
    const sHR = add('Risurriscaldato caldo all\'ammissione IP', 'Vapore', secs[1].m, bt.pRHout, bt.Trh);
    flow(sh, [[lv[1].cx + 8, yL], [lv[1].cx + 8, 70], [tv[1].cx, 70], [tv[1].cx, yT + 24]], { num: sHR, at: 0.5 });
  }
  if (n > 1) {
    const sLP = add(`Vapore ${names[n - 1]} all'ammissione TV`, 'Vapore', bt.mLevelsTot?.[n - 1] ?? bt.mLevels[n - 1], bt.pAdm[n - 1], bt.Tsh[n - 1], 'totale');
    const tLP = tv[tv.length - 1];
    flow(sh, [[lv[n - 1].cx, yL], [lv[n - 1].cx, 86], [tLP.cx - 8, 86], [tLP.cx - 8, yT + 24]], { num: sLP, at: 0.75, st: ST.norm });
  }
  // condensatore e pompe
  const yC = 162;
  const last = tv[tv.length - 1];
  const cond = block(sh, Math.max(330, last.x), yC, 48, 22, '0MAG10', M.water ? 'Condensatore' : 'Aerocondensatore', [`${f(bt.pCond * 1000, 0)} mbar · ${f(bt.Qcond, 0)} MW`]);
  const sEx = add('Scarico TV al condensatore', 'Vapore umido', secs[secs.length - 1].m, bt.pCond, secs[secs.length - 1].Tout, `titolo ${f(secs[secs.length - 1].xOut, 3)}`);
  flow(sh, [[last.cx + 8, yT + 24], [last.cx + 8, 140], [cond.cx, 140], [cond.cx, yC]], { num: sEx, at: 0.5, side: 1 });
  const cep = block(sh, cond.x - 50, yC, 38, 22, '0LCB10', 'Pompe condensato', [`${f(M.pumps.cd.Q, 0)} m³/h · ${f(M.pumps.cd.H, 0)} m`]);
  flow(sh, [[cond.x, cond.cy], [cep.r, cep.cy]], {});
  const pre = block(sh, cep.x - 62, yL + 42, 44, 22, '1HAC31', 'Preriscaldatore', [`${f(bt.banks.find((b) => b.name.startsWith('PRE'))?.Q ?? NaN, 1)} MW`]);
  const sCd = add('Condensato mandata pompe estrazione', 'Acqua', bt.mSteamTot, bt.pDrum[n - 1] * 1.25 + 1, bt.TCondOut, 'totale');
  flow(sh, [[cep.x, cep.cy], [pre.cx, cep.cy], [pre.cx, pre.b]], { num: sCd, at: 0.5 });
  const sPre = add('Uscita preriscaldatore', 'Acqua', bt.mLevels.reduce((a, b) => a + b, 0), bt.pDrum[n - 1] * 1.2, bt.TsubLP);
  flow(sh, [[pre.x, pre.cy], [lv[n - 1].cx, pre.cy], [lv[n - 1].cx, lv[n - 1].b]], { num: sPre, at: 0.5 });
  // alimento
  if (n > 1) {
    const fw = block(sh, 30, yL + 46, 40, 22, '1LAC10', 'Pompe alimento', [`${f(M.pumps.fw1.Q, 0)} m³/h · ${f(M.pumps.fw1.H, 0)} m`]);
    const sFWS = add(`Aspirazione pompe alimento (corpo ${names[n - 1]})`, 'Acqua', bt.mLevels.slice(0, n - 1).reduce((a, b) => a + b, 0), bt.pDrum[n - 1], bt.Tsat[n - 1]);
    flow(sh, [[lv[n - 1].cx - 10, lv[n - 1].b], [lv[n - 1].cx - 10, fw.cy], [fw.r, fw.cy]], { num: sFWS, at: 0.4 });
    const sFW = add('Acqua alimento HP', 'Acqua', bt.mLevels[0], bt.pDrum[0] * 1.15, bt.TsubLP + 2);
    flow(sh, [[fw.cx - 6, fw.y], [fw.cx - 6, lv[0].b]], { num: sFW, at: 0.5, side: 1 });
    if (M.reheat) {
      const sFI = add('Acqua alimento IP', 'Acqua', bt.mLevels[1], bt.pDrum[1] * 1.15, bt.TsubLP + 1);
      flow(sh, [[fw.cx + 8, fw.y], [fw.cx + 8, yL + 40], [lv[1].cx, yL + 40], [lv[1].cx, lv[1].b]], { num: sFI, at: 0.6 });
    }
  }
  // tabella scambi GVR
  const rows = bt.banks.map((b) => [b.name, f(b.Q, 2), f(b.TgIn, 1), f(b.TgOut, 1), f(b.TwIn, 1), f(b.TwOut, 1), b.parallel ? 'sì' : '']);
  table(sh, 238, 196, [['Banco', 26, 'l'], ['Q [MW]', 14, 'r'], ['Tg in', 12, 'r'], ['Tg out', 12, 'r'], ['Tw in', 12, 'r'], ['Tw out', 12, 'r'], ['par.', 8, 'l']], rows, { title: 'SCAMBI TERMICI GVR (per GVR, °C)', rh: 2.8, size: 1.4 });
  table(sh, FRAME.x0 + 4, 196, streamCols, S, { title: 'TABELLA CORRENTI', rh: 2.8, size: 1.45 });
  notesBox(sh, 'NOTE', [`Potenza TV ${f(r.Pst, 1)} MW, pompe ciclo ${f(bt.Ppump ?? NaN, 2)} MW. Correnti complete del ciclo nel PFD generale.`]);
  return [sh];
}

// ------------------------------------------------------------------ sistemi di raffreddamento
export function pfdCoolingSheets(M, doc) {
  const U = M.U, cw = U.cooling, cc = U.ccw;
  const sh = newSheet(M, doc, 'Sistemi di raffreddamento', `Raffreddamento principale (${M.once ? 'ciclo aperto mare/fiume' : M.water ? 'torre evaporativa' : 'aerocondensatore'}) e ciclo chiuso ausiliari`);
  let k = 1;
  const S = [];
  const add = (desc, fluid, m, p, T, note = '', vol = true) => { S.push([k, desc, fluid, f(m, 1), vol ? f(m3h(m), 0) : f(m * 3.6, 1), f(p, 2), f(T, 1), note]); return k++; };
  let acwBack = null;
  if (M.once) {
    // ciclo aperto: presa a mare/fiume, pompe MCW, condensatore, pozzo di carico e restituzione
    const cond = block(sh, 40, 60, 48, 28, '0MAG10', 'Condensatore', [`${f(cw.Qcond, 1)} MW`, `${f(M.r.bt.pCond * 1000, 0)} mbar`]);
    const intake = block(sh, 170, 40, 60, 32, '0PAA10/0PAB10', 'Opera di presa', ['griglie, sgrigliatori, filtri a nastro', `2 corsie × ${f(cw.intakeM3h, 0)} m³/h`]);
    const pumps = block(sh, 170, 110, 60, 22, '0PAC10', 'Pompe acqua circolazione', ['2×50 %']);
    const outf = block(sh, 40, 22, 48, 22, '0PAR10', 'Pozzo di carico', ['restituzione al corpo idrico']);
    flow(sh, [[280, 52], [intake.r, 52]], { num: add('Acqua da mare/fiume', 'Acqua', cw.cwFlow + cc.acwFlow, 1.0, cw.Tin, 'presa'), st: ST.med });
    flow(sh, [[intake.cx, intake.b], [intake.cx, pumps.y]], { side: 1 });
    flow(sh, [[pumps.x, pumps.cy], [cond.cx, pumps.cy], [cond.cx, cond.b]], { num: add('Acqua fredda al condensatore', 'Acqua', cw.cwFlow, 2.0, cw.Tin), at: 0.5 });
    flow(sh, [[cond.cx, cond.y], [cond.cx, outf.b]], { num: add('Acqua calda alla restituzione', 'Acqua', cw.cwFlow, 1.5, cw.Tout), side: 1 });
    flow(sh, [[outf.r, outf.cy], [130, outf.cy]], { label: `al corpo idrico · ΔT ${f(cw.Tout - cw.Tin, 1)} K`, side: -1 });
    acwBack = { pumps, path: (c) => [[c.cx, c.y], [c.cx, 100], [96, 100], [96, outf.cy + 6], [outf.r, outf.cy + 6]] };
  } else if (M.water) {
    const cond = block(sh, 40, 60, 48, 28, '0MAG10', 'Condensatore', [`${f(cw.Qcond, 1)} MW`, `${f(M.r.bt.pCond * 1000, 0)} mbar`]);
    const tower = block(sh, 170, 40, 60, 32, '0PAE10', 'Torre evaporativa', [`${M.ctCells} celle`, `evaporazione ${f(cw.fEvap * 100, 0)} % del calore`]);
    const pumps = block(sh, 170, 110, 60, 22, '0PAC10', 'Pompe acqua circolazione', ['2×50 %']);
    acwBack = { pumps, path: (c) => [[c.cx, c.y], [c.cx, 100], [tower.cx + 20, 100], [tower.cx + 20, tower.b]] };
    flow(sh, [[cond.r, 66], [tower.x, 66]], { num: add('Acqua calda dal condensatore', 'Acqua', cw.cwFlow, 1.8, cw.Tout), at: 0.4 });
    flow(sh, [[tower.cx, tower.b], [tower.cx, pumps.y]], { side: 1 });
    flow(sh, [[pumps.x, pumps.cy], [cond.cx, pumps.cy], [cond.cx, cond.b]], { num: add('Acqua fredda al condensatore', 'Acqua', cw.cwFlow, 2.5, cw.Tin), at: 0.5 });
    flow(sh, [[tower.cx - 14, tower.y], [tower.cx - 14, 26]], { num: add('Evaporazione', 'Vapore acqueo', cw.evap, 1.013, cw.Tout), side: -1, st: ST.norm });
    flow(sh, [[tower.cx + 14, tower.y], [tower.cx + 14, 26]], { num: add('Trascinamento (drift)', 'Acqua', cw.drift, 1.013, cw.Tin), side: 1, st: ST.norm });
    flow(sh, [[280, 52], [tower.r, 52]], { num: add('Reintegro torre (acqua grezza)', 'Acqua', cw.makeup, 4, 18, `COC ${cw.coc}`), st: ST.norm });
    flow(sh, [[pumps.r, pumps.cy], [258, pumps.cy]], { num: add('Spurgo torre', 'Acqua', cw.blowdown, 2.5, cw.Tin, 'alle acque reflue'), st: ST.norm });
  } else {
    const acc = block(sh, 120, 40, 90, 30, '0MAG10', 'Aerocondensatore', [`${M.accCells} celle · ${f(cw.Qcond, 1)} MW`, `ITD ${M.cfg.steam.condenser.ITD} K`]);
    const st = M.r.bt.sections[M.r.bt.sections.length - 1];
    flow(sh, [[40, 55], [acc.x, 55]], { num: add('Vapore di scarico TV', 'Vapore umido', st.m, M.r.bt.pCond, M.r.bt.Tcond, '', false) });
    flow(sh, [[acc.cx, acc.b], [acc.cx, 110], [40, 110]], { num: add('Condensato ACC', 'Acqua', st.m, M.r.bt.pCond, M.r.bt.Tcond, '', false) });
    sh.text(acc.cx, 30, `aria ambiente ${f(M.op.Tamb, 0)} °C`, { size: 1.4, anchor: 'middle' });
  }
  // ciclo chiuso: intercooler a piastre su acqua ausiliaria (raffreddamento ad acqua) o aerotermi
  const yc = 150;
  const cooler = M.water ? block(sh, 270, yc - 30, 46, 22, '0PGD10', 'Intercooler a piastre', [`2×100 % · ${f(cc.kW / 1000, 2)} MW`])
    : block(sh, 270, yc - 30, 46, 22, '0PGC10', 'Aerotermi', [`${f(cc.kW / 1000, 2)} MW`]);
  const pp = block(sh, 270, yc + 6, 46, 18, '0PGB10', 'Pompe ciclo chiuso', [`${cc.pumpN}×${cc.pumpPct} %`]);
  if (acwBack) {
    // acqua ausiliaria: pompe ACW 2×100 % dalla vasca/presa agli intercooler, ritorno a torre o restituzione
    const { pumps } = acwBack;
    flow(sh, [[pumps.r, pumps.y + 5], [258, pumps.y + 5], [258, cooler.y + 6], [cooler.x, cooler.y + 6]], { num: add('Acqua ausiliaria agli intercooler (pompe ACW 0PAC20)', 'Acqua', cc.acwFlow, 3.5, cw.Tin), at: 0.5, st: ST.norm });
    flow(sh, acwBack.path(cooler), { num: add('Ritorno acqua ausiliaria', 'Acqua', cc.acwFlow, 1.8, cw.Tin + cc.acwDT), at: 0.5, st: ST.norm });
  }
  const users = block(sh, 336, yc - 30, 60, 54, null, 'Utenze ciclo chiuso', cc.users.filter((u) => u.kW > 0).slice(0, 14).map((u) => `${u.tag} ${f(u.kW, 0)} kW`));
  flow(sh, [[pp.r, pp.cy], [users.x, pp.cy]], { num: add('Ciclo chiuso mandata', 'Acqua demi', cc.flow, 6, cc.Tsupply), at: 0.5 });
  flow(sh, [[users.x, cooler.cy], [cooler.r, cooler.cy]], { num: add('Ciclo chiuso ritorno', 'Acqua demi', cc.flow, 4, cc.Treturn), at: 0.5 });
  flow(sh, [[cooler.cx, cooler.b], [cooler.cx, pp.y]], {});
  table(sh, FRAME.x0 + 4, 196, streamCols, S, { title: 'TABELLA CORRENTI (portate volumetriche in m³/h)', rh: 2.8, size: 1.45 });
  notesBox(sh, 'NOTE', [M.once ? `Ciclo aperto: nessun reintegro; portata di presa ${f(cw.intakeM3h, 0)} m³/h per corsia, biocida ${f(cw.hypo, 1)} kg/h in continuo.` : M.water ? `Reintegro torre ${f(cw.makeupM3h, 0)} m³/h = evaporazione + spurgo + trascinamento.` : 'Aerocondensatore: nessun consumo di acqua per il raffreddamento principale.', `Ciclo chiuso: ΔT ${cc.dT} K, temperatura di mandata ${f(cc.Tsupply, 0)} °C.`]);
  return [sh];
}

// ------------------------------------------------------------------ bilancio idrico
export function pfdWaterSheets(M, doc) {
  const U = M.U, d = U.demi, w = U.ww, cw = U.cooling;
  const sh = newSheet(M, doc, 'Bilancio idrico di impianto', 'Portate medie al punto di progetto [m³/h]');
  const v = (kgs) => f(m3h(kgs), 1);
  const raw = block(sh, 24, 90, 40, 24, '0GAA10', 'Acqua grezza', [`${v(U.rawWater)} m³/h`]);
  const tower = M.tower ? block(sh, 120, 34, 50, 24, '0PAE10', 'Torre', [`reintegro ${v(cw.makeup)}`]) : null;
  if (M.once) sh.text(120, 44, `Raffreddamento a ciclo aperto: ${f(cw.cwM3h, 0)} m³/h prelevati e restituiti al corpo idrico (non nel bilancio).`, { size: 1.4 });
  const demi = block(sh, 120, 90, 50, 24, '0GCF', 'Impianto demi', [`RO ${v(d.roFeed)} → EDI ${v(d.roPermeate)}`]);
  const serv = block(sh, 120, 140, 50, 20, '0GHA10', 'Acqua servizi', ['servizi, lavaggi']);
  const cycle = block(sh, 220, 90, 56, 24, null, 'Ciclo acqua-vapore', [`reintegro ${v(d.cycleMakeup)}`]);
  const ww = block(sh, 220, 150, 56, 24, '0GMA10', 'Acque reflue', [`${v(w.total)} m³/h`]);
  const out = block(sh, 330, 150, 50, 24, null, 'Scarico autorizzato', [`${v(w.total + w.sanitary)} m³/h`]);
  const atm = block(sh, 330, 34, 50, 24, null, 'Atmosfera', ['evaporazione e perdite']);
  if (tower) {
    flow(sh, [[raw.cx, raw.y], [raw.cx, tower.cy], [tower.x, tower.cy]], { label: v(cw.makeup), side: -1 });
    flow(sh, [[tower.r, tower.cy - 4], [atm.x, tower.cy - 4]], { label: `evap. ${v(cw.evap)} · drift ${v(cw.drift)}`, side: -1 });
    flow(sh, [[tower.cx + 10, tower.b], [tower.cx + 10, 72], [204, 72], [204, ww.cy - 4], [ww.x, ww.cy - 4]], { label: `spurgo ${v(cw.blowdown)}`, side: 1 });
  }
  flow(sh, [[raw.r, raw.cy], [demi.x, demi.cy]], { label: v(d.roFeed), side: -1 });
  flow(sh, [[raw.cx, raw.b], [raw.cx, serv.cy], [serv.x, serv.cy]], { label: v(1.4), side: 1 });
  flow(sh, [[demi.r, demi.cy], [cycle.x, demi.cy]], { label: `demi ${v(d.demin)}`, side: -1 });
  flow(sh, [[demi.cx, demi.b], [demi.cx, 128], [ww.cx - 6, 128], [ww.cx - 6, ww.y]], { label: `concentrati ${v(d.roReject + d.ediReject)}`, side: -1 });
  flow(sh, [[cycle.cx + 6, cycle.b], [cycle.cx + 6, ww.y]], { label: `spurghi ${v(d.hrsgBD)}`, side: 1 });
  flow(sh, [[cycle.cx, cycle.y], [cycle.cx, 66], [atm.cx, 66], [atm.cx, atm.b]], { label: `perdite ${v(d.losses + d.sampling)}`, side: 1 });
  flow(sh, [[serv.r, serv.cy + 4], [ww.x, serv.cy + 4]], { label: `oleose/servizi ${v(w.oily + w.sanitary)}`, side: 1 });
  flow(sh, [[ww.r, ww.cy], [out.x, ww.cy]], {});
  // bilancio
  const inTot = U.rawWater;
  const outAtm = (M.tower ? cw.evap + cw.drift : 0) + d.losses + d.sampling;
  const outWW = w.total + w.sanitary;
  const rows = [
    { group: 'Ingressi' }, ['Acqua grezza', v(inTot)],
    { group: 'Uscite' }, ['Evaporazione e trascinamento torre', M.tower ? v(cw.evap + cw.drift) : '—'], ['Perdite ciclo e campionamenti', v(d.losses + d.sampling)], ['Scarico acque reflue', v(outWW)],
    ['Usi non restituiti (lavaggi, ciclo chiuso, servizi)', v(Math.max(0, inTot - outAtm - outWW))],
  ];
  table(sh, 290, 82, [['Bilancio', 66, 'l'], ['m³/h', 18, 'r']], rows, { title: 'BILANCIO INGRESSI / USCITE', rh: 3 });
  const tab = [
    ['Reintegro ciclo', v(d.cycleMakeup)], ['  spurgo continuo GVR', v(d.hrsgBD)], ['  perdite (sfiati, tenute)', v(d.losses)], ['  campionamenti', v(d.sampling)],
    ['Acqua demi prodotta (media)', v(d.demin)], ['Capacità impianto demi', f(d.plantM3h, 0)], ['Serbatoio acqua demi [m³]', f(d.tankM3, 0)],
  ];
  table(sh, FRAME.x0 + 4, 196, [['Acqua demineralizzata', 60, 'l'], ['m³/h', 18, 'r']], tab, { title: 'DETTAGLIO ACQUA DEMI' });
  notesBox(sh, 'NOTE', ['Portate medie in esercizio continuo a pieno carico; i lavaggi dei compressori TG e i reintegri del ciclo chiuso sono riportati come media annua equivalente.']);
  return [sh];
}

// ------------------------------------------------------------------ gas combustibile e vapore ausiliario
export function pfdFuelSheets(M, doc) {
  const U = M.U, g = U.gas, s = U.auxSteam;
  const sh = newSheet(M, doc, 'Gas combustibile e vapore ausiliario', `Composizione e potere calorifico da configurazione · PCI ${f(g.lhvMJSm3, 2)} MJ/Sm³ · PCS ${f(g.hhvMJSm3, 2)} MJ/Sm³`);
  let k = 1;
  const S = [];
  const add = (desc, fluid, m, p, T, note = '') => { S.push([k, desc, fluid, f(m, 2), f(m * 3.6, 2), f(p, 2), f(T, 1), note]); return k++; };
  const y = 60;
  const st = block(sh, 70, y - 14, 46, 28, '0EKA10', 'Filtri e misura fiscale', [`${f(g.Sm3h, 0)} Sm³/h`]);
  const ht = block(sh, 140, y - 14, 46, 28, '0EKA20', 'Riscaldatori', [`${f(g.heaterKW, 0)} kW`, `${f(g.Tin, 0)} → ${f(g.preheatT, 0)} °C`]);
  const kc = g.compressor;
  const rd = block(sh, 210, y - 14, 46, 28, '0EKA30', kc ? 'Regolazione' : 'Riduzione', kc ? [`${f(kc.pDis, 0)} → ${f(g.pOut, 1)} bar`] : [`${f(g.pIn, 0)} → ${f(g.pOut, 1)} bar`, `ΔT J-T ${f(g.dTjt, 1)} K`]);
  if (kc) {
    // rete sotto la pressione richiesta: compressori fra misura e regolazione (riscaldatori by-passati in esercizio)
    const cp = block(sh, 140, y + 22, 46, 24, '0EKB10', 'Compressori gas 2×100 %', [`${f(kc.pSuc, 0)} → ${f(kc.pDis, 0)} bar · ${f(kc.kW, 0)} kW`, `refrigerante a 45 °C`]);
    flow(sh, [[st.cx, st.b], [st.cx, cp.cy], [cp.x, cp.cy]], { num: add('Gas all\'aspirazione compressori', 'Gas naturale', g.mFuel, kc.pSuc, g.Tin), side: 1 });
    flow(sh, [[cp.r, cp.cy], [rd.cx, cp.cy], [rd.cx, rd.b]], { num: add('Gas compresso', 'Gas naturale', g.mFuel, kc.pDis, 45), side: 1 });
  }
  const gt = block(sh, 320, y - 14, 60, 28, `1MBP10${M.N > 1 ? '…' : ''}`, `Skid gas TG (${M.N})`, [`riscald. prestazione ${f(g.perfHeaterKW / M.N, 0)} kW/TG`, `${f(M.cfg.gt.Tfuel, 0)} °C ai bruciatori`]);
  flow(sh, [[24, y], [st.x, y]], { num: add('Gas da gasdotto', 'Gas naturale', g.mFuel, g.pIn, g.Tin), at: 0.4 });
  flow(sh, [[st.r, y], [ht.x, y]], {});
  flow(sh, [[ht.r, y], [rd.x, y]], { num: add('Gas a monte della riduzione', 'Gas naturale', g.mFuel, g.pIn - 1.5, g.preheatT) });
  flow(sh, [[rd.r, y], [gt.x, y]], { num: add('Gas ai TG', 'Gas naturale', g.mFuel, g.pOut, g.Tout, `${f(g.mFuel / M.N, 2)} kg/s per TG`), at: 0.4 });
  // vapore ausiliario
  const ya = 130;
  const boiler = block(sh, 70, ya, 50, 28, '0QHA10', 'Caldaia ausiliaria', [`${f(s.boilerCapacity * 3.6, 0)} t/h`, `${s.p} bar · ${s.T} °C`]);
  const hdr = block(sh, 180, ya, 60, 28, '0QHB10', 'Collettore vapore ausiliario', [`in esercizio: ${s.source}`]);
  const gland = block(sh, 300, ya - 16, 70, 18, null, 'Tenute TV', [`${f(s.gland * 3.6, 1)} t/h`]);
  const oth = block(sh, 300, ya + 14, 70, 18, null, M.water ? 'Polmonazione, riscaldamenti' : 'Eiettori ACC, riscaldamenti', []);
  const yb = kc ? 114 : 96;
  flow(sh, [[rd.cx + (kc ? 12 : 0), rd.b], [rd.cx + (kc ? 12 : 0), yb], [95, yb], [95, boiler.y]], { label: 'gas caldaia (avviamento)', side: 1, st: ST.norm });
  flow(sh, [[boiler.r, boiler.cy], [hdr.x, boiler.cy]], { num: add('Vapore caldaia ausiliaria', 'Vapore', s.boilerCapacity, s.p, s.T, 'all\'avviamento') });
  flow(sh, [[210, 100], [210, hdr.y]], { num: add(M.reheat ? 'Vapore da RH freddo' : 'Vapore da linea HP', 'Vapore', s.boilerCapacity, M.reheat ? M.r.bt.pAdm[1] : M.r.bt.pAdm[0], M.reheat ? M.r.bt.sections[0].Tout : M.r.bt.Tsh[0], 'in esercizio, riduzione'), side: 1 });
  flow(sh, [[hdr.r, hdr.y + 8], [270, hdr.y + 8], [270, gland.cy], [gland.x, gland.cy]], { num: add('Vapore tenute TV', 'Vapore', s.gland, 4, 220) });
  flow(sh, [[hdr.r, hdr.y + 20], [270, hdr.y + 20], [270, oth.cy], [oth.x, oth.cy]], {});
  sh.text(212, 99, M.reheat ? 'da RH freddo (riduzione)' : 'da vapore HP (riduzione)', { size: 1.3 });
  const fx = M.des.fuel;
  const comp = Object.entries(M.cfg.fuelComp || {}).filter(([, v]) => v > 0).map(([kk, vv]) => [kk, f(vv * (vv <= 1 ? 100 : 1), 2)]);
  if (comp.length) table(sh, 300, 196, [['Componente', 30, 'l'], ['% mol', 18, 'r']], comp, { title: 'COMPOSIZIONE GAS', rh: 2.8, size: 1.4 });
  table(sh, FRAME.x0 + 4, 196, streamCols, S, { title: 'TABELLA CORRENTI', rh: 2.8, size: 1.45 });
  notesBox(sh, 'NOTE', [`Massa molare gas ${f(fx.M, 2)} kg/kmol, densità standard ${f(g.rhoStd, 3)} kg/Sm³.`]);
  return [sh];
}

export { tableSheets };
