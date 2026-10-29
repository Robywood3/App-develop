// Elaborati di processo: PFD con bilancio di massa ed energia e P&ID.

import { Sheet, ST, frame, notesBox, FRAME } from './sheet.js';
import { pline, valve, psv, instr, pump, offPage, equipTag, drum, coil, hx, strainer, orifice, vvessel } from './symbols.js';

const W = '#ffffff';
const f = (v, d = 1) => (Number.isFinite(v) ? v.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');

function diamond(sh, x, y, num) {
  const r = 2.7;
  sh.path([[x, y - r], [x + r, y], [x, y + r], [x - r, y]], { s: '#000000', w: 0.3, f: W }, true);
  sh.textMid(x, y, String(num), { size: 1.8, anchor: 'middle', bold: true });
}

function gtSymbol(sh, x, y, { h = 30, scale = 1 } = {}) {
  // compressore (x..x+20), combustore sopra, turbina (x+24..x+44); asse a y
  const s = scale;
  const c0 = x, c1 = x + 20 * s, t0 = x + 24 * s, t1 = x + 44 * s;
  sh.path([[c0, y - h / 2], [c1, y - h / 4], [c1, y + h / 4], [c0, y + h / 2]], { s: '#000000', w: 0.45, f: W }, true);
  sh.path([[t0, y - h / 4], [t1, y - h / 2], [t1, y + h / 2], [t0, y + h / 4]], { s: '#000000', w: 0.45, f: W }, true);
  sh.line(c1, y, t0, y, ST.thick);
  const cbX = (c1 + t0) / 2;
  sh.rect(cbX - 5 * s, y - h / 2 - 12 * s, 10 * s, 9 * s, { s: '#000000', w: 0.45, f: W });
  sh.line(c1 - 1, y - h / 4 + 0.5, cbX - 3 * s, y - h / 2 - 3 * s, ST.med);
  sh.line(cbX + 3 * s, y - h / 2 - 3 * s, t0 + 1, y - h / 4 + 0.5, ST.med);
  sh.text((c0 + c1) / 2, y + 1, 'C', { size: 3, anchor: 'middle', bold: true });
  sh.text((t0 + t1) / 2, y + 1, 'T', { size: 3, anchor: 'middle', bold: true });
  return { c0, c1, t0, t1, cbX, cbY: y - h / 2 - 12 * s, cbBot: y - h / 2 - 3 * s };
}

function genSym(sh, x, y, r = 6) {
  sh.circle(x, y, r, { s: '#000000', w: 0.45, f: W });
  sh.text(x, y + 1.1, 'G', { size: 3, anchor: 'middle', bold: true });
}

function stSection(sh, x0, x1, yc, kind, label) {
  if (kind === 'LP') {
    const xm = (x0 + x1) / 2;
    sh.path([[x0, yc - 11], [xm - 3, yc - 4], [xm + 3, yc - 4], [x1, yc - 11], [x1, yc + 11], [xm + 3, yc + 4], [xm - 3, yc + 4], [x0, yc + 11]], { s: '#000000', w: 0.45, f: W }, true);
  } else {
    sh.path([[x0, yc - 5], [x1, yc - 9], [x1, yc + 9], [x0, yc + 5]], { s: '#000000', w: 0.45, f: W }, true);
  }
  sh.textMid((x0 + x1) / 2, yc, label, { size: 2.2, anchor: 'middle', bold: true });
}

// ------------------------------------------------------------------ PFD
export function pfdSheets(M, doc) {
  const sh = new Sheet();
  frame(sh, M.meta, { ...doc, sheetNo: 1, sheetCount: 1 });
  const s = M.st;
  const N = M.N;
  sh.text(FRAME.x0 + 4, FRAME.y0 + 8, 'SCHEMA DI PROCESSO E BILANCIO DI MASSA ED ENERGIA', { size: 3.2, bold: true });
  sh.text(FRAME.x0 + 4, FRAME.y0 + 12, `Punto di progetto ISO 15 °C, 1013 mbar, UR 60 %, carico base · ${N}+1 · ${M.gtClass}${N > 1 ? ` · valori "per TG/GVR" riferiti a una unità` : ''}`, { size: 2 });

  // turbogas
  const yA = 78;
  genSym(sh, 32, yA, 6.5);
  sh.line(38.5, yA, 52, yA, ST.thick);
  const g = gtSymbol(sh, 52, yA, { h: 30 });
  equipTag(sh, 74, yA + 22, `${N > 1 ? 'TG1..' + N : 'TG'}`, M.gtClass);
  // filtro aria
  sh.rect(48, 28, 18, 10, { s: '#000000', w: 0.4, f: W });
  for (let i = 0; i < 5; i++) sh.line(50 + i * 3.5, 29, 50 + i * 3.5, 37, ST.thin);
  pline(sh, [[57, 38], [57, yA - 15.5]], { arrow: true });
  diamond(sh, 53, 47, s.air);
  diamond(sh, 75, 56, s.cd2);
  // combustibile
  pline(sh, [[g.cbX - 14, g.cbY - 4], [g.cbX, g.cbY - 4], [g.cbX, g.cbY]], {});
  sh.text(g.cbX - 14, g.cbY - 6, 'Gas naturale', { size: 1.7 });
  diamond(sh, g.cbX - 9, g.cbY - 4, s.fg);
  // scarico -> GVR
  const hx0 = 112, hx1 = 232, hy0 = 50, hy1 = 104;
  sh.path([[g.t1, yA - 15], [hx0, hy0 + 4], [hx0, hy1 - 4], [g.t1, yA + 15]], { s: '#000000', w: 0.4, f: W }, true);
  diamond(sh, 104, yA, s.exh);
  sh.rect(hx0, hy0, hx1 - hx0, hy1 - hy0, { s: '#000000', w: 0.6, f: W });
  equipTag(sh, hx0, hy0 - 4, N > 1 ? `GVR1..${N}` : 'GVR', null, { anchor: 'start' });
  const cols = groupCols(M.r.bt.banks);
  const cw = (hx1 - hx0 - 6) / cols.length;
  const colPos = {};
  cols.forEach((c, i) => {
    const x = hx0 + 3 + i * cw;
    c.banks.forEach((b, j) => {
      const bw = (cw - 2) / c.banks.length;
      const bx = x + 1 + j * bw;
      coil(sh, bx + 0.4, hy0 + 14, bw - 0.8, hy1 - hy0 - 22, {});
      const lb = b.name.replace(' (condensato)', '').split(' ');
      lb.forEach((l, k) => sh.text(bx + bw / 2, hy0 + 6 + k * 2.6, l, { size: 1.5, anchor: 'middle', bold: k === 0 }));
      if (!colPos[b.name]) colPos[b.name] = bx + bw / 2;
    });
  });
  // corpi cilindrici
  M.names.forEach((lv) => {
    const x = colPos[`EVA ${lv}`];
    if (x === undefined) return;
    drum(sh, x - 8, 30, 16, 6);
    sh.textMid(x, 33, lv, { size: 1.8, anchor: 'middle', bold: true });
    sh.line(x - 4, 36, x - 4, hy0, ST.norm).line(x + 4, 36, x + 4, hy0, ST.norm);
  });
  // camino
  sh.rect(hx1 + 2, 18, 10, hy1 - 18, { s: '#000000', w: 0.5, f: W });
  pline(sh, [[hx1 + 7, 30], [hx1 + 7, 20]], {});
  diamond(sh, hx1 + 7, 40, s.stack);
  sh.text(hx1 + 14, 26, 'Camino', { size: 1.8 });

  // turbina a vapore
  const yS = 136;
  const secs = M.n === 3 ? [['HP', 252, 266], ['IP', 270, 286], ['LP', 292, 326]] : M.n === 2 ? [['HP', 262, 278], ['LP', 292, 326]] : [['LP', 292, 326]];
  sh.line(secs[0][1] - 4, yS, 350, yS, ST.thick);
  for (const [k, x0, x1] of secs) stSection(sh, x0, x1, yS, k, k === 'LP' && M.n === 1 ? 'TV' : k);
  genSym(sh, 356, yS, 6.5);
  equipTag(sh, 300, yS - 16, 'TV', 'Turbina a vapore');
  const xHPin = secs[0][1] + 2;
  // vapore HP
  const xSH = colPos['SH HP'];
  pline(sh, [[xSH, hy1], [xSH, 110], [xHPin, 110], [xHPin, yS - 6]], {});
  diamond(sh, xSH + 20, 110, s.hpGen);
  diamond(sh, xHPin, 122, s.hpST);
  if (M.reheat) {
    const xRH = colPos.RH;
    const hpOut = secs[0][2] - 2;
    pline(sh, [[hpOut, yS - 8], [hpOut, 115], [xRH - 1.5, 115], [xRH - 1.5, hy1]], { seg: 1, at: 0.7 });
    diamond(sh, hpOut, 121, s.crh);
    const ipIn = secs[1][1] + 2;
    pline(sh, [[xRH + 1.5, hy1], [xRH + 1.5, 120], [ipIn + 3, 120], [ipIn + 3, yS - 6]], { seg: 1, at: 0.8 });
    diamond(sh, ipIn + 3, 126, s.hrh);
    const xSHip = colPos['SH IP'];
    pline(sh, [[xSHip, hy1], [xSHip, 115]], { arrow: true });
    sh.circle(xSHip, 115, 0.8, ST.black);
    diamond(sh, xSHip + 4, 108, s.ip);
  }
  if (M.n > 1) {
    const xSHlp = colPos['SH LP'];
    const lpIn = (secs[secs.length - 1][1] + secs[secs.length - 1][2]) / 2;
    pline(sh, [[xSHlp, hy1], [xSHlp, 125], [lpIn, 125], [lpIn, yS - 4]], { seg: 1, at: 0.85 });
    diamond(sh, xSHlp + 5, 125, s.lp);
  }
  // condensatore e pompe
  const lpx0 = 292, lpx1 = 326;
  sh.rect(lpx0, 150, lpx1 - lpx0, 9, { s: '#000000', w: 0.45, f: W });
  sh.line((lpx0 + lpx1) / 2, yS + 11, (lpx0 + lpx1) / 2, 150, ST.med);
  diamond(sh, (lpx0 + lpx1) / 2 + 4, 149, s.exST);
  sh.text(lpx0 - 2, 156, M.cfg.steam.condenser.type === 'air' ? 'Aerocondensatore' : 'Condensatore', { size: 1.8, anchor: 'end' });
  pump(sh, 280, 166, { r: 3.4 });
  pline(sh, [[lpx0 + 4, 159], [lpx0 + 4, 166], [283.4, 166]], { arrow: false });
  const xPRE = colPos['PRE (condensato)'] ?? hx1 - 6;
  pline(sh, [[283.4, 162.6], [283.4, 174], [xPRE, 174], [xPRE, hy1]], { seg: 1, at: 0.4 });
  diamond(sh, 262, 174, s.cdp);
  // alimento
  const xLPd = colPos[`EVA ${M.names[M.n - 1]}`];
  if (M.n > 1) {
    pump(sh, 200, 166, { r: 3.4 });
    pline(sh, [[xLPd + 7, hy1], [xLPd + 7, 170], [196.6, 170], [196.6, 166]], { arrow: false, seg: 1 });
    const xECO = colPos['ECO HP'];
    pline(sh, [[203.4, 162.6], [203.4, 160], [xECO, 160], [xECO, hy1]], { seg: 1, at: 0.5 });
    diamond(sh, 190, 160, s.fwHP);
    if (M.reheat && s.fwIP) {
      const xEIP = colPos['ECO IP'];
      pline(sh, [[203.4, 160], [203.4, 154], [xEIP + 2, 154], [xEIP + 2, hy1]], { seg: 1, at: 0.6, arrow: true });
      diamond(sh, (203.4 + xEIP) / 2, 154, s.fwIP);
    }
    sh.text(195, 172, 'Pompe alimento', { size: 1.6, anchor: 'end' });
  }
  sh.text(286, 170, 'Pompe condensato', { size: 1.6 });
  if (s.cwIn) {
    pline(sh, [[366, 152], [lpx1, 152]], {});
    pline(sh, [[lpx1, 157], [366, 157]], {});
    diamond(sh, 354, 152, s.cwIn);
    diamond(sh, 342, 157, s.cwOut);
    if (M.once) {
      // ciclo aperto: presa e restituzione al corpo idrico
      for (let i = 0; i < 3; i++) sh.path(Array.from({ length: 9 }, (_, j) => [368 + j * 2.6, 152 + i * 4 + (j % 2 ? -1 : 1)]), ST.norm);
      sh.text(378, 170, 'Mare / fiume (ciclo aperto)', { size: 1.6, anchor: 'middle' });
    } else {
      sh.path([[366, 166], [370, 148], [386, 148], [390, 166]], { s: '#000000', w: 0.45, f: W }, true);
      sh.text(378, 170, 'Torre di raffreddamento', { size: 1.6, anchor: 'middle' });
    }
  }
  // riepilogo prestazioni
  const r = M.r;
  const kx = 330, ky = 30;
  sh.rect(kx, ky - 5, 72, 46, ST.norm);
  sh.text(kx + 2, ky, 'PRESTAZIONI NETTE DI PROGETTO', { size: 2, bold: true });
  const rows = [
    ['Potenza TG', `${f(r.Pgt)} MW`], ['Potenza TV', `${f(r.Pst)} MW`], ['Potenza lorda', `${f(r.gross)} MW`],
    ['Ausiliari + trasf.', `${f(r.Paux + r.Ptrafo)} MW`], ['Potenza netta', `${f(r.net)} MW`],
    ['Rendimento netto PCI', `${f(r.eta * 100, 2)} %`], ['Heat rate netto', `${f(3600 / r.eta, 0)} kJ/kWh`],
    ['Combustibile', `${f(r.Qfuel)} MWt`], ['CO₂ specifica', `${f(r.co2Spec, 0)} kg/MWh`],
  ];
  rows.forEach(([a, b], i) => { sh.text(kx + 2, ky + 4.6 + i * 4.3, a, { size: 1.9 }); sh.text(kx + 70, ky + 4.6 + i * 4.3, b, { size: 1.9, anchor: 'end', bold: i === 4 || i === 5 }); });

  // tabella H&MB
  const tx0 = FRAME.x0 + 4, tx1 = FRAME.x1 - 4;
  let ty = 184;
  const colsT = [['N.', 8], ['Corrente', 86], ['Fluido', 26], ['Portata kg/s', 22], ['Portata t/h', 22], ['Pressione bar(a)', 24], ['Temperatura °C', 24], ['Entalpia kJ/kg', 22], ['Note', 60]];
  const scale = (tx1 - tx0) / colsT.reduce((a, c) => a + c[1], 0);
  const xs = [tx0];
  for (const c of colsT) xs.push(xs[xs.length - 1] + c[1] * scale);
  const rh = 2.7;
  const half = Math.ceil(M.streams.length / 1);
  sh.rect(tx0, ty, tx1 - tx0, 4.6, { s: '#000000', w: 0.35, f: '#e6e6e6' });
  colsT.forEach((c, i) => sh.text(xs[i] + 0.8, ty + 3.2, c[0], { size: 1.75, bold: true }));
  ty += 4.6;
  M.streams.slice(0, half).forEach((st, i) => {
    const y = ty + i * rh;
    const vals = [String(st.no), st.desc, st.fluid, f(st.m, 1), f(st.m * 3.6, 1), st.p < 1 ? f(st.p, 3) : f(st.p, 2), f(st.T, 1), st.h === null ? '—' : f(st.h, 1), st.extra || ''];
    vals.forEach((v, j) => {
      const right = j >= 3 && j <= 7;
      sh.text(right ? xs[j + 1] - 0.8 : xs[j] + 0.8, y + 2.15, v, { size: 1.7, anchor: right ? 'end' : 'start' });
    });
    sh.line(tx0, y + rh, tx1, y + rh, ST.hair);
  });
  const yEnd = ty + half * rh;
  for (let i = 1; i < colsT.length; i++) sh.line(xs[i], 184, xs[i], yEnd, ST.hair);
  sh.rect(tx0, 184, tx1 - tx0, yEnd - 184, ST.norm);
  return [sh];
}

function groupCols(banks) {
  const cols = [];
  for (const b of banks) {
    const last = cols[cols.length - 1];
    if (b.parallel && last && last.parallel && Math.abs(last.TgIn - b.TgIn) < 1e-6) last.banks.push(b);
    else cols.push({ parallel: !!b.parallel, TgIn: b.TgIn, banks: [b] });
  }
  return cols;
}

const LEGEND = [
  'Simbologia ISA 5.1 / ISO 10628. Strumenti con linea centrale: funzioni disponibili in DCS (sala controllo).',
  'Numerazione linee: DN-FLUIDO-NUMERO-SPECIFICA-COIBENTAZIONE (vedi line list). Specifica: materiale (A A106B, B P22, C P91, G API 5L, W A672) + classe (A 150#, B 300#, C 600#, D 900#, E 1500#, F 2500#). Coibentazione: H calore, P protezione personale, N nessuna.',
  'Codifica apparecchiature KKS semplificata: prima cifra = unità (1..3 treni TG/GVR, 0 comune).',
];

