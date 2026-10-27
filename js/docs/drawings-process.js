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
    sh.path([[366, 166], [370, 148], [386, 148], [390, 166]], { s: '#000000', w: 0.45, f: W }, true);
    sh.text(378, 170, 'Torre di raffreddamento', { size: 1.6, anchor: 'middle' });
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

// ------------------------------------------------------------------ P&ID 1: turbogas e gas combustibile
export function pid1Sheets(M, doc) {
  const sh = new Sheet();
  frame(sh, M.meta, { ...doc, sheetNo: 1, sheetCount: 1 });
  const ln = (id) => M.lineById[id]?.lineNo ?? '';
  const N = M.N;
  sh.text(FRAME.x0 + 4, FRAME.y0 + 8, `TURBOGAS, ASPIRAZIONE ARIA, GAS COMBUSTIBILE E SCARICO${N > 1 ? ` – TIPICO TG1…TG${N}` : ''}`, { size: 3, bold: true });
  const yG = 92; // linea gas
  // ingresso da cabina
  offPage(sh, 50, yG, 'left', 'GAS NATURALE', 'da 0EKA10 stazione gas', { w: 30 });
  pline(sh, [[50, yG], [64, yG]], { arrow: false });
  valve(sh, 64 + 2.6, yG, { kind: 'motor', tag: '1EKG10AA001', fail: 'FC' });
  instr(sh, 67, yG - 18, 'XV', '001', { to: [67, yG - 9] });
  pline(sh, [[69.2, yG], [86, yG]], { arrow: true, label: ln('FG-1'), size: 1.5 });
  // filtro separatore
  vvessel(sh, 86, yG - 12, 9, 22);
  equipTag(sh, 90.5, yG + 22, '1EKG10AT001', 'Filtro separatore');
  instr(sh, 90.5, yG - 22, 'PDT', '002', { to: [90.5, yG - 12] });
  sh.line(90.5, yG + 10, 90.5, yG + 13, ST.norm);
  valve(sh, 90.5, yG + 14.5, { dir: 'v', kind: 'ball', s: 1.6 });
  pline(sh, [[95, yG], [112, yG]], { arrow: false });
  // misura portata
  orifice(sh, 104, yG);
  instr(sh, 104, yG - 14, 'FT', '003', { to: [104, yG - 2] });
  instr(sh, 113, yG - 22, 'AT', '004', { to: [113, yG] });
  sh.text(117, yG - 24, 'gascromatografo PCS/Wobbe', { size: 1.4 });
  // riscaldatore gas
  pline(sh, [[112, yG], [124, yG]], { arrow: false });
  hx(sh, 128, yG, 4.5);
  equipTag(sh, 124, yG + 10, '1EKG10AC001', 'Riscaldatore gas', { anchor: 'end' });
  pline(sh, [[128, yG + 19], [128, yG + 4.5]], { arrow: true });
  offPage(sh, 128, yG + 30, 'left', 'ACQUA IP', 'da ECO IP (P&ID GVR)', { w: 26 });
  sh.line(128, yG + 30, 128, yG + 19, ST.med);
  pline(sh, [[132.5, yG + 2], [140, yG + 2], [140, yG + 30], [146, yG + 30]], { arrow: true });
  offPage(sh, 146, yG + 30, 'right', 'RITORNO', 'a condensatore', { w: 22 });
  instr(sh, 142, yG - 14, 'TT', '005', { to: [142, yG] });
  pline(sh, [[132.5, yG], [156, yG]], { arrow: false });
  // regolazione pressione
  valve(sh, 158.6, yG, { kind: 'control', tag: '1EKG10AA002' });
  instr(sh, 158.6, yG - 20, 'PIC', '006', { to: [158.6, yG - 9] });
  instr(sh, 172, yG - 14, 'PT', '007', { to: [172, yG] });
  pline(sh, [[161.2, yG], [184, yG]], { arrow: true });
  // skid gas TG
  sh.rect(184, yG - 34, 76, 52, ST.dash);
  sh.text(186, yG - 30, '1MBP10 SKID VALVOLE GAS (fornitura TG)', { size: 1.6, bold: true });
  valve(sh, 194, yG, { kind: 'control', tag: 'SRV', fail: 'FC' });
  instr(sh, 194, yG - 20, 'PIC', '010', { to: [194, yG - 9] });
  pline(sh, [[196.6, yG], [220, yG]], { arrow: false });
  sh.line(207, yG, 207, yG - 10, ST.norm);
  valve(sh, 207, yG - 12.6, { dir: 'v', kind: 'motor', tag: 'VENT', s: 2 });
  sh.line(207, yG - 15, 207, yG - 22, ST.norm);
  sh.text(209, yG - 22, 'sfiato in atmosfera', { size: 1.3 });
  // valvole di regolazione per stadi DLN
  const stages = ['PM1', 'PM2', 'PM3'];
  stages.forEach((sg, i) => {
    const y = yG - 8 + i * 8;
    pline(sh, [[220, yG], [224, yG], [224, y], [232, y]], { arrow: false });
    valve(sh, 234.6, y, { kind: 'control', tag: i === 1 ? '' : '', s: 2.1 });
    sh.text(240, y - 1.2, sg, { size: 1.4 });
    pline(sh, [[236.7, y], [262, y], [262, 66 - i * 1.2]], { arrow: false });
  });
  sh.text(236, yG + 17, 'valvole di regolazione gas per stadio', { size: 1.4 });

  // turbogas
  const x0 = 250, yc = 120;
  // generatore a sinistra
  const gx = 300;
  const g = gtSymbol(sh, gx, 52 + 70, { h: 34 });
  void x0; void yc;
  const ya = 122;
  sh.circle(gx - 22, ya, 8, { s: '#000000', w: 0.45, f: W });
  sh.text(gx - 22, ya + 1.2, 'G', { size: 3.4, anchor: 'middle', bold: true });
  sh.line(gx - 14, ya, gx, ya, ST.thick);
  equipTag(sh, gx - 22, ya + 14, '1MKA10', `${M.electrical.gens[0].MVA} MVA ${String(M.electrical.gens[0].kV).replace('.', ',')} kV`);
  equipTag(sh, gx - 18, ya - 30, '1MBA10', [`Turbina a gas ${M.gtClass}`, `P ISO ${f(M.des.gtRef.Piso)} MW`]);
  // gas ai combustori
  pline(sh, [[262, 63.6], [g.cbX, 63.6], [g.cbX, g.cbY]], { arrow: true });
  // aria: casa filtri
  const fx = gx - 2, fy = 36;
  sh.rect(fx - 4, fy - 14, 26, 14, { s: '#000000', w: 0.45, f: W });
  for (let i = 0; i < 7; i++) sh.line(fx - 2 + i * 3.4, fy - 12, fx - 2 + i * 3.4, fy - 2, ST.thin);
  equipTag(sh, fx + 9, fy - 17, '1MBL10', null);
  instr(sh, fx + 30, fy - 8, 'PDT', '020', { to: [fx + 22, fy - 8] });
  pline(sh, [[fx + 6, fy], [fx + 6, ya - 17]], { arrow: true });
  instr(sh, fx - 12, fy + 14, 'TT', '021', { to: [fx + 6, fy + 14] });
  instr(sh, fx - 12, fy + 26, 'ZT', '022', { to: [gx + 2, ya - 12] });
  sh.text(fx - 20, fy + 33, 'posizione IGV', { size: 1.3 });
  instr(sh, g.c1 - 4, ya + 30, 'PT', '023', { to: [g.c1 - 2, ya + 8] });
  instr(sh, g.t1 + 6, ya - 34, 'ST', '024', { to: [g.t1 - 6, ya] });
  instr(sh, g.t0 + 14, ya + 30, 'VT', '025', { to: [g.t0 + 4, ya + 4] });
  // scarico
  const ex0 = g.t1;
  sh.path([[ex0, ya - 17], [ex0 + 22, ya - 24], [ex0 + 22, ya + 24], [ex0, ya + 17]], { s: '#000000', w: 0.45, f: W }, true);
  sh.text(ex0 + 11, ya + 1, 'Diffusore', { size: 1.5, anchor: 'middle' });
  instr(sh, ex0 + 30, ya - 30, 'TT', '030', { to: [ex0 + 14, ya - 18] });
  sh.text(ex0 + 34, ya - 30, '× 24 termocoppie', { size: 1.3 });
  instr(sh, ex0 + 30, ya + 32, 'PT', '031', { to: [ex0 + 14, ya + 18] });
  offPage(sh, ex0 + 22, ya, 'right', 'FUMI AL GVR', `${f(M.r.gt.mExh, 0)} kg/s ${f(M.r.gt.T4, 0)} °C`, { w: 34 });

  // centralina olio
  sh.rect(240, 168, 50, 24, { s: '#000000', w: 0.4, f: W });
  sh.text(265, 172.5, '1MBV10 CENTRALINA OLIO', { size: 1.6, anchor: 'middle', bold: true });
  pump(sh, 254, 182, { r: 3, tag: 'AP001' });
  pump(sh, 270, 182, { r: 3, tag: 'AP002' });
  sh.text(282, 186, 'DC', { size: 1.5 });
  pline(sh, [[265, 168], [265, 156], [gx + 10, 156], [gx + 10, ya + 12]], { arrow: true, st: ST.norm });
  instr(sh, 300, 168, 'PT', '040', { to: [292, 168] });
  instr(sh, 310, 176, 'TT', '041', { to: [290, 176] });

  // SFC
  sh.rect(196, 160, 30, 12, { s: '#000000', w: 0.4, f: W });
  sh.text(211, 165, '1MBJ10', { size: 1.7, anchor: 'middle', bold: true });
  sh.text(211, 169, 'Avviatore statico', { size: 1.4, anchor: 'middle' });
  sh.path([[211, 160], [211, ya], [gx - 30, ya]], ST.dash);

  notesBox(sh, 'NOTE E LEGENDA', [
    ...LEGEND,
    `Pressione di alimentazione gas al TG ${f(M.pFG, 1)} bar(a), temperatura dopo riscaldo ${M.cfg.gt.Tfuel} °C. Portata gas ${f(M.r.gt.mFuel * 3.6, 1)} t/h per TG.`,
    'Valvola di blocco 1EKG10AA001 con chiusura per mancanza aria (FC), comandata dal sistema di protezione TG.',
  ]);
  return [sh];
}

// ------------------------------------------------------------------ P&ID 2: GVR acqua-vapore
export function pid2Sheets(M, doc) {
  const sh = new Sheet();
  frame(sh, M.meta, { ...doc, sheetNo: 1, sheetCount: 1 });
  const ln = (id) => M.lineById[id]?.lineNo ?? '';
  const N = M.N;
  const bt = M.r.bt;
  const names = M.names;
  const n = M.n;
  sh.text(FRAME.x0 + 4, FRAME.y0 + 8, `GENERATORE DI VAPORE A RECUPERO – CIRCUITO ACQUA/VAPORE${N > 1 ? ` – TIPICO GVR1…GVR${N}` : ''}`, { size: 3, bold: true });
  const cx0 = 66, cx1 = 330, cy0 = 112, cy1 = 172;
  sh.rect(cx0, cy0, cx1 - cx0, cy1 - cy0, { s: '#000000', w: 0.7, f: W });
  equipTag(sh, cx0 + 14, cy0 - 3, '1HAA00', null, { anchor: 'start' });
  offPage(sh, cx0, (cy0 + cy1) / 2, 'left', 'FUMI DA TG', `${f(bt.banks[0].TgIn, 0)} °C`, { w: 26 });
  instr(sh, cx0 + 8, cy0 - 8, 'TT', '101', { to: [cx0 + 8, cy0 + 2] });
  // camino
  sh.rect(cx1, 40, 14, cy1 - 40, { s: '#000000', w: 0.6, f: W });
  equipTag(sh, cx1 + 7, 36, '1HNE10', null);
  valve(sh, cx1 + 7, 70, { dir: 'v', kind: 'butterfly', s: 3 });
  sh.text(cx1 + 16, 71, 'serranda', { size: 1.4 });
  instr(sh, cx1 + 26, 86, 'AT', '190', { to: [cx1 + 14, 86] });
  sh.text(cx1 + 30, 86, 'CEMS NOx/CO/O₂', { size: 1.3 });
  instr(sh, cx1 + 26, 100, 'TT', '191', { to: [cx1 + 14, 100] });

  const cols = groupCols(bt.banks);
  const cw = (cx1 - cx0 - 8) / cols.length;
  const pos = []; // {name, x, w, idx}
  cols.forEach((c, i) => {
    const x = cx0 + 4 + i * cw;
    c.banks.forEach((b, j) => {
      const bw = (cw - 3) / c.banks.length;
      const bx = x + 1.5 + j * bw;
      coil(sh, bx + 0.5, cy0 + 12, bw - 1, cy1 - cy0 - 20, {});
      const lb = b.name.replace(' (condensato)', '').split(' ');
      lb.forEach((l, k) => sh.text(bx + bw / 2, cy0 + 4.6 + k * 2.6, l, { size: 1.6, anchor: 'middle', bold: k === 0 }));
      pos.push({ name: b.name, x: bx + bw / 2, w: bw, col: i, top: cy0 + 12, bot: cy1 - 8, gapL: x, gapR: x + cw });
    });
    if (i > 0) sh.text(x, cy1 - 2, f(c.TgIn, 0), { size: 1.4, anchor: 'middle' });
  });
  sh.text(cx1 - 2, cy1 - 2, `${f(bt.Tstack, 0)} °C`, { size: 1.4, anchor: 'end' });
  const byName = (nm) => pos.filter((p) => p.name === nm);

  // corsie
  const laneTop = (k) => cy0 - 8 - k * 7; // sopra l'involucro
  const laneBot = (k) => cy1 + 6 + k * 7;
  const drumY = 44;
  const drums = {};
  names.forEach((lv, k) => {
    const ev = byName(`EVA ${lv}`)[0];
    if (!ev) return;
    const dw = 26, dh = 9;
    const dx = ev.x - dw / 2;
    const dy = drumY + (k % 2) * 4;
    drum(sh, dx, dy, dw, dh);
    sh.textMid(ev.x, dy + dh / 2, `${lv}`, { size: 2.2, anchor: 'middle', bold: true });
    sh.text(ev.x, dy - 9, `${k === 0 ? '1' : '1'}HAD${(k + 1) * 10}BB001`, { size: 1.6, anchor: 'middle', bold: true });
    sh.text(ev.x, dy - 6.6, `${f(bt.pDrum[k], 1)} bar · ${f(bt.Tsat[k], 0)} °C`, { size: 1.4, anchor: 'middle' });
    // tubi di discesa e risalita
    pline(sh, [[ev.x - 5, dy + dh], [ev.x - 5, cy0 + 6], [ev.gapL, cy0 + 6], [ev.gapL, ev.bot + 3], [ev.x - 1.5, ev.bot + 3], [ev.x - 1.5, ev.bot]], { arrow: false, st: ST.norm });
    pline(sh, [[ev.x + 2, ev.top], [ev.x + 2, dy + dh]], { arrow: true, st: ST.norm });
    // strumentazione corpo
    instr(sh, dx - 5, dy + 2, 'LT', `${k + 1}11`, { to: [dx, dy + 4] });
    instr(sh, dx - 5, dy + 10, 'LT', `${k + 1}12`, { to: [dx + 1, dy + 6] });
    instr(sh, dx + dw + 5, dy + 6, 'PT', `${k + 1}13`, { to: [dx + dw, dy + 4.5] });
    psv(sh, dx + 6, dy - 1, { tag: `PSV ${k + 1}14` });
    // spurgo continuo
    sh.line(dx + dw - 4, dy + dh, dx + dw - 4, dy + dh + 4, ST.norm);
    valve(sh, dx + dw - 4, dy + dh + 6.2, { dir: 'v', kind: 'globe', s: 1.6 });
    sh.text(dx + dw - 2, dy + dh + 7.2, 'spurgo', { size: 1.2 });
    drums[lv] = { x: ev.x, dx, dw, dy, dh };
  });

  const ecoSeq = (lv) => {
    // banchi ECO del livello dal più freddo al più caldo (ordine inverso lato fumi)
    const list = pos.filter((p) => p.name === `ECO ${lv}`).sort((a, b) => b.col - a.col);
    return list;
  };
  const offL = cx0 - 34;
  // ---- livelli HP / IP: alimento -> ECO -> corpo
  for (let k = 0; k < n - 1; k++) {
    const lv = names[k];
    const ecos = ecoSeq(lv);
    const dr = drums[lv];
    if (!dr || !ecos.length) continue;
    const yb = laneBot(k);
    const yIn = laneBot(k);
    const fwId = k === 0 ? 'FW-1' : 'FWIP-1';
    offPage(sh, offL + 26, yIn, 'left', `ALIMENTO ${lv}`, 'da pompe alimento', { w: 26 });
    const vx = offL + 36 + k * 24;
    valve(sh, vx, yIn, { kind: 'control', tag: '', s: 2.2 });
    instr(sh, vx, yIn + 30 - k * 7, 'LIC', `${k + 1}10`, { to: [vx, yIn + 3] });
    instr(sh, vx + 10, yIn + 30 - k * 7, 'FT', `${k + 1}15`, { to: [vx + 10, yIn] });
    let cur = [vx + 2.2, yIn];
    let enterBottom = true;
    ecos.forEach((e, i) => {
      if (enterBottom) {
        pline(sh, [cur, [e.x, yb], [e.x, e.bot]], { arrow: i === 0, label: i === 0 ? ln(fwId) : null, seg: 0, size: 1.4 });
        cur = [e.x, e.top];
      } else {
        const yt = laneTop(k) + 3;
        pline(sh, [cur, [cur[0], yt], [e.x, yt], [e.x, e.top]], { arrow: true, seg: 1 });
        cur = [e.x, e.bot];
        cur.gapR = e.gapR;
      }
      enterBottom = !enterBottom;
    });
    // ultimo ECO -> corpo
    const yt = laneTop(k);
    if (!enterBottom) pline(sh, [cur, [cur[0], yt], [dr.dx + 3, yt], [dr.dx + 3, dr.dy + dr.dh]], { seg: 1, at: 0.6 });
    else pline(sh, [cur, [cur[0], cy1 - 4], [cur.gapR, cy1 - 4], [cur.gapR, yt], [dr.dx + 3, yt], [dr.dx + 3, dr.dy + dr.dh]], { seg: 4 });
  }
  // ---- livello più basso: condensato -> PRE -> corpo LP
  {
    const k = n - 1;
    const lv = names[k];
    const pre = byName('PRE (condensato)')[0];
    const dr = drums[lv];
    const yb = laneBot(n - 1);
    if (pre && dr) {
      offPage(sh, offL + 26, yb, 'left', 'CONDENSATO', 'da pompe estrazione', { w: 26 });
      instr(sh, offL + 36 + (n - 1) * 24, yb + 30 - (n - 1) * 7, 'FT', '301', { to: [offL + 36 + (n - 1) * 24, yb] });
      pline(sh, [[offL + 26, yb], [pre.x, yb], [pre.x, pre.bot]], { label: ln('CD-1'), seg: 0, at: 0.3, size: 1.4 });
      instr(sh, pre.x - 10, yb - 8, 'TIC', '302', { to: [pre.x, yb - 2] });
      sh.text(pre.x - 15, yb - 12, 'ricircolo ≥ 55 °C', { size: 1.2, anchor: 'end' });
      const yt = laneTop(k);
      pline(sh, [[pre.x, pre.top], [pre.x, yt], [dr.dx + 3, yt], [dr.dx + 3, dr.dy + dr.dh]], { seg: 1, at: 0.5 });
      // aspirazione pompe alimento
      if (n > 1) {
        pline(sh, [[dr.dx + dr.dw - 9, dr.dy + dr.dh], [dr.dx + dr.dw - 9, dr.dy + dr.dh + 6], [cx1 + 24, dr.dy + dr.dh + 6]], { arrow: true });
        offPage(sh, cx1 + 24, dr.dy + dr.dh + 6, 'right', 'A POMPE ALIMENTO', ln('FWS-1'), { w: 34 });
      }
    }
  }
  // ---- vapore: corpo -> SH -> uscita
  const outX = FRAME.x1 - 44;
  names.forEach((lv, k) => {
    const dr = drums[lv];
    const sh0 = byName(`SH ${lv}`)[0];
    if (!dr || !sh0) return;
    const yt = drumY - 12 - k * 4;
    pline(sh, [[dr.x + 6, dr.dy], [dr.x + 6, yt], [sh0.x, yt], [sh0.x, sh0.top]], { seg: 1, at: 0.5 });
    // uscita SH dal basso verso il bordo destro
    const yo = laneBot(n + 1) + 4 + k * 7;
    const pts = [[sh0.x, sh0.bot], [sh0.x, yo], [outX, yo]];
    const id = k === 0 ? 'MS-1' : M.reheat && k === 1 ? 'IP-1' : 'LP-1';
    pline(sh, pts, { label: ln(id), seg: 1, at: 0.82, size: 1.4 });
    offPage(sh, outX, yo, 'right', k === 0 ? 'VAPORE HP A TV' : M.reheat && k === 1 ? 'VAPORE IP A RH FREDDO' : 'VAPORE LP A TV', '', { w: 36 });
    // valvole e strumenti sulla linea di uscita
    const vx = outX - 8;
    valve(sh, vx, yo, { kind: 'motor', s: 2.1 });
    const ix = outX - 30 - k * 30;
    instr(sh, ix, yo - 9, 'PT', `${k + 1}20`, { to: [ix, yo] });
    instr(sh, ix - 8, yo - 9, 'TT', `${k + 1}21`, { to: [ix - 8, yo] });
    if (k === 0) {
      const px = outX - 132;
      sh.line(px, yo, px, yo - 6, ST.norm);
      psv(sh, px, yo - 6, { tag: 'PSV 122' });
      sh.line(px + 10, yo, px + 10, yo + 3, ST.norm);
      valve(sh, px + 10, yo + 5.4, { dir: 'v', kind: 'control', s: 1.8 });
      sh.text(px + 13, yo + 6, 'sfiato avviamento', { size: 1.2 });
      // desurriscaldatore con acqua di attemperamento
      const xa = outX - 150;
      sh.rect(xa - 3, yo - 1.8, 6, 3.6, { s: '#000000', w: 0.35, f: W });
      sh.text(xa, yo - 3, 'DSH', { size: 1.3, anchor: 'middle' });
      sh.line(xa, yo + 1.8, xa, yo + 6, ST.norm);
      sh.text(xa + 1.5, yo + 6.5, `spray ${ln('SPR-1')}`, { size: 1.2 });
    }
  });
  // ---- risurriscaldatore
  if (M.reheat) {
    const rh = byName('RH')[0];
    const yIn = 23;
    offPage(sh, outX + 36, yIn, 'left', 'RH FREDDO DA TV', ln('CRH-1'), { w: 36 });
    pline(sh, [[outX, yIn], [rh.x, yIn], [rh.x, rh.top]], { seg: 0, at: 0.3 });
    const yo = laneBot(n + 1) + 4 + 3 * 7;
    pline(sh, [[rh.x, rh.bot], [rh.x, yo], [outX, yo]], { label: ln('HRH-1'), seg: 1, at: 0.82, size: 1.4 });
    offPage(sh, outX, yo, 'right', 'RH CALDO A TV', '', { w: 36 });
    instr(sh, outX - 120, yo - 9, 'TT', '140', { to: [outX - 120, yo] });
    psv(sh, outX - 104, yo - 6, { tag: 'PSV 141' });
    sh.line(outX - 104, yo, outX - 104, yo - 6, ST.norm);
  }
  // spurghi
  equipTag(sh, FRAME.x1 - 22, 110, '1HAN10BB001', 'Serbatoio spurghi', { anchor: 'middle' });
  vvessel(sh, FRAME.x1 - 27, 115, 10, 16);
  pline(sh, [[FRAME.x1 - 56, 125], [FRAME.x1 - 27, 125]], { label: ln('BD-1'), size: 1.3 });
  sh.text(FRAME.x1 - 56, 122, 'dagli spurghi continui', { size: 1.2 });

  notesBox(sh, 'NOTE E LEGENDA', [
    ...LEGEND,
    'Banchi rappresentati nell\'ordine lato fumi (da sinistra ingresso fumi a destra camino); i banchi affiancati lavorano in parallelo sulla stessa sezione fumi.',
    'Regolazione livello corpi cilindrici a tre elementi (livello, portata vapore, portata alimento) con 3 trasmettitori di livello in logica 2oo3.',
  ]);
  return [sh];
}

// ------------------------------------------------------------------ P&ID 3: TV, condensato, alimento
export function pid3Sheets(M, doc) {
  const sh = new Sheet();
  frame(sh, M.meta, { ...doc, sheetNo: 1, sheetCount: 1 });
  const ln = (id) => M.lineById[id]?.lineNo ?? '';
  const N = M.N;
  const bt = M.r.bt;
  const hdr = N > 1;
  sh.text(FRAME.x0 + 4, FRAME.y0 + 8, 'TURBINA A VAPORE, BYPASS, CONDENSAZIONE, CONDENSATO E ACQUA ALIMENTO', { size: 3, bold: true });
  const yS = 82;
  const secs = M.n === 3 ? [['HP', 150, 172], ['IP', 182, 206], ['LP', 222, 272]] : M.n === 2 ? [['HP', 165, 190], ['LP', 222, 272]] : [['TV', 222, 272]];
  sh.line(secs[0][1] - 6, yS, 300, yS, ST.thick);
  for (const [k, x0, x1] of secs) stSection(sh, x0, x1, yS, k === 'TV' ? 'LP' : k, k);
  genSym(sh, 308, yS, 8);
  equipTag(sh, 308, yS + 15, '0MKA10', `${M.electrical.gens[N].MVA} MVA`);
  equipTag(sh, 247, yS - 24, '0MAA/MAB/MAC10', `Turbina a vapore ${f(M.r.Pst)} MW`);
  instr(sh, 290, yS - 18, 'ST', '501', { to: [290, yS] });
  instr(sh, 280, yS + 20, 'VT', '502', { to: [262, yS + 6] });

  // vapore HP
  const yHP = 40;
  const hp = secs[0];
  offPage(sh, 50, yHP, 'left', 'VAPORE HP', hdr ? `da GVR1..${N}` : 'da GVR', { w: 30 });
  const hpLn = hdr ? ln('MS-H') : ln('MS-1');
  pline(sh, [[50, yHP], [hp[1] + 4, yHP], [hp[1] + 4, yS - 6]], { label: hpLn, seg: 0, at: 0.25, size: 1.5 });
  valve(sh, hp[1] - 16, yHP, { kind: 'control', tag: 'MSV', fail: 'FC', s: 2.4 });
  valve(sh, hp[1] - 4, yHP, { kind: 'control', tag: 'CV', s: 2.4 });
  instr(sh, 76, yHP - 14, 'PT', '510', { to: [76, yHP] });
  instr(sh, 86, yHP - 14, 'TT', '511', { to: [86, yHP] });
  // bypass HP
  const xb = 100;
  sh.line(xb, yHP, xb, yHP + 12, ST.med);
  valve(sh, xb, yHP + 15, { dir: 'v', kind: 'control', tag: 'HPBP', s: 2.4 });
  instr(sh, xb - 14, yHP + 15, 'PIC', '512', { to: [xb - 3, yHP + 15] });
  sh.rect(xb - 1.6, yHP + 19, 3.2, 5, { s: '#000000', w: 0.3, f: W });
  sh.text(xb + 3, yHP + 23, 'DSH', { size: 1.3 });
  if (M.reheat) {
    // RH freddo
    const yC = 120;
    const hpOut = hp[2] - 4;
    pline(sh, [[hpOut, yS + 7], [hpOut, yC], [50, yC]], { label: hdr ? ln('CRH-H') : ln('CRH-1'), seg: 1, at: 0.5, size: 1.5 });
    valve(sh, hpOut - 10, yC, { kind: 'check', tag: 'NRV' });
    offPage(sh, 50, yC, 'right', 'RH FREDDO', hdr ? `a GVR1..${N}` : 'a GVR', { w: 30 });
    pline(sh, [[xb, yHP + 24], [xb, yC]], { arrow: true });
    offPage(sh, 126, yC + 14, 'left', 'VAPORE IP', 'da SH IP GVR', { w: 26 });
    pline(sh, [[126, yC + 14], [132, yC + 14], [132, yC]], { arrow: true });
    // RH caldo
    const ip = secs[1];
    const yH = 28;
    offPage(sh, 50, yH, 'left', 'RH CALDO', hdr ? `da GVR1..${N}` : 'da GVR', { w: 30 });
    pline(sh, [[50, yH], [ip[1] + 4, yH], [ip[1] + 4, yS - 6]], { label: hdr ? ln('HRH-H') : ln('HRH-1'), seg: 0, at: 0.45, size: 1.5 });
    valve(sh, ip[1] - 4, yH, { kind: 'control', tag: 'RSV/IV', fail: 'FC', s: 2.4 });
    // bypass RH al condensatore
    const xr = ip[1] + 14;
    sh.line(xr, yH, xr, yH - 6, ST.med);
    sh.line(xr, yH - 6, 340, yH - 6, ST.med);
    valve(sh, 330, yH - 6, { kind: 'control', tag: 'RHBP', s: 2.4 });
    pline(sh, [[340, yH - 6], [348, yH - 6], [348, 132], [266, 132], [266, 140]], { arrow: true, seg: 2 });
    sh.text(350, 100, 'bypass RH al condensatore', { size: 1.3, rot: -90 });
    // crossover IP-LP
    pline(sh, [[ip[2] - 4, yS - 8], [ip[2] - 4, 58], [247, 58], [247, yS - 4]], { arrow: true, seg: 1 });
  } else if (M.n === 2) {
    pline(sh, [[hp[2] - 4, yS - 8], [hp[2] - 4, 58], [247, 58], [247, yS - 4]], { arrow: true, seg: 1 });
    pline(sh, [[xb, yHP + 24], [xb, 132], [228, 132], [228, 140]], { arrow: true, seg: 1 });
  } else {
    pline(sh, [[xb, yHP + 24], [xb, 132], [228, 132], [228, 140]], { arrow: true, seg: 1 });
  }
  if (M.n > 1) {
    offPage(sh, 360, 50, 'left', 'VAPORE LP', hdr ? `da GVR1..${N}` : 'da GVR', { w: 28 });
    pline(sh, [[332, 50], [257, 50], [257, 58]], { label: hdr ? ln('LP-H') : ln('LP-1'), seg: 0, at: 0.4, size: 1.5 });
    valve(sh, 280, 50, { kind: 'control', tag: 'LPCV', s: 2.2 });
    // bypass LP
    sh.line(320, 50, 320, 132, ST.med);
    valve(sh, 320, 110, { dir: 'v', kind: 'control', tag: 'LPBP', s: 2.2 });
    if (!M.reheat) sh.line(320, 132, 266, 132, ST.med).line(266, 132, 266, 140, ST.med);
  }

  // condensatore
  const cx0 = 222, cx1 = 272, cy0 = 140, cy1 = 166;
  sh.line(247, yS + 11, 247, cy0, ST.thick);
  const air = M.cfg.steam.condenser.type === 'air';
  sh.rect(cx0, cy0, cx1 - cx0, cy1 - cy0, { s: '#000000', w: 0.6, f: W });
  for (let i = 0; i < 4; i++) sh.line(cx0 + 4, cy0 + 4 + i * 4.5, cx1 - 4, cy0 + 4 + i * 4.5, ST.thin);
  equipTag(sh, cx0 - 2, cy0 + 4, '0MAG10', [air ? 'Aerocondensatore' : 'Condensatore', `${f(bt.pCond * 1000, 0)} mbar`], { anchor: 'end' });
  instr(sh, cx1 + 10, cy0 + 4, 'PT', '520', { to: [cx1, cy0 + 4] });
  instr(sh, cx1 + 10, cy1 + 2, 'LT', '521', { to: [cx1, cy1 - 2] });
  pline(sh, [[cx1 + 34, cy0 + 2], [cx1, cy0 + 2]], { arrow: false });
  if (!air) {
    offPage(sh, cx1 + 60, cy0 + 9, 'left', 'ACQUA CIRC.', 'da pompe 0PAC10', { w: 26 });
    pline(sh, [[cx1 + 34, cy0 + 9], [cx1, cy0 + 9]], { label: ln('CWS'), size: 1.3 });
    valve(sh, cx1 + 26, cy0 + 9, { kind: 'butterfly', s: 2 });
    pline(sh, [[cx1, cy0 + 16], [cx1 + 34, cy0 + 16]], { label: ln('CWR'), size: 1.3 });
    valve(sh, cx1 + 26, cy0 + 16, { kind: 'butterfly', s: 2 });
    offPage(sh, cx1 + 34, cy0 + 16, 'right', 'ALLA TORRE', '0PAE10', { w: 26 });
  }
  pump(sh, cx1 + 40, cy0 - 2, { r: 2.6 });
  sh.text(cx1 + 45, cy0 - 5, '0MAJ10 pompe vuoto', { size: 1.3 });

  // pompe condensato 2×100 %
  const yP = 196;
  const pxs = [150, 175];
  sh.line(232, cy1, 232, 182, ST.med);
  pline(sh, [[232, 182], [pxs[0], 182]], { label: ln('CDS'), size: 1.3, seg: 0 });
  pxs.forEach((px, i) => {
    sh.line(px, 182, px, yP - 10, ST.med);
    strainer(sh, px, yP - 12);
    sh.line(px, yP - 9, px, yP - 4, ST.med);
    pump(sh, px, yP, { r: 4, tag: `0LCB10AP00${i + 1}` });
    sh.line(px + 4, yP - 4, px + 4, yP - 14, ST.med);
    valve(sh, px + 4, yP - 16.5, { dir: 'v', kind: 'check', s: 1.8 });
    sh.line(px + 4, yP - 19, px + 4, yP - 26, ST.med);
    sh.line(px + 4, yP - 26, 200, yP - 26, ST.med);
  });
  pline(sh, [[200, yP - 26], [110, yP - 26]], { label: hdr ? ln('CD-H') : ln('CD-1'), seg: 0, at: 0.5, size: 1.4 });
  // condensatore vapore tenute + ricircolo
  hx(sh, 120, yP - 26, 3.5);
  sh.text(120, yP - 31, '0MAW10', { size: 1.4, anchor: 'middle', bold: true });
  valve(sh, 104, yP - 26, { kind: 'control', tag: 'LCV', s: 2 });
  instr(sh, 104, yP - 42, 'LIC', '521', { to: [104, yP - 31] });
  offPage(sh, 90, yP - 26, 'left', 'CONDENSATO', 'a PRE GVR', { w: 26 });
  pline(sh, [[200, yP - 26], [208, yP - 26], [208, cy1 - 4], [cx0, cy1 - 4]], { arrow: true, seg: 2 });
  valve(sh, 208, yP - 34, { dir: 'v', kind: 'control', s: 1.8 });
  sh.text(211, yP - 36, 'ricircolo minimo', { size: 1.2 });
  instr(sh, 194, yP - 12, 'FT', '530', { to: [194, yP - 26] });

  // pompe alimento
  if (M.n > 1) {
    const ax = 300, ay = 196;
    offPage(sh, 338, ay - 32, 'left', 'DA CORPO LP', 'aspirazione', { w: 26 });
    sh.line(312, ay - 32, 290, ay - 32, ST.med);
    [290, 318].forEach((px, i) => {
      sh.line(i === 0 ? px : 290, ay - 32, i === 0 ? px : 318, ay - 32, ST.med);
      sh.line(px, ay - 32, px, ay - 12, ST.med);
      strainer(sh, px, ay - 14);
      pump(sh, px, ay, { r: 4, tag: `1LAC10AP00${i + 1}` });
      sh.line(px + 4, ay - 4, px + 4, ay - 8, ST.med);
      sh.line(px + 4, ay - 8, px + 12, ay - 8, ST.med);
      valve(sh, px + 8, ay - 8, { kind: 'check', s: 1.6 });
    });
    void ax;
    sh.line(302, ay - 8, 330, ay - 8, ST.med);
    pline(sh, [[330, ay - 8], [372, ay - 8]], { label: ln('FW-1'), size: 1.3 });
    offPage(sh, 372, ay - 8, 'right', 'ALIMENTO HP', 'a ECO HP GVR', { w: 28 });
    if (M.reheat) {
      pline(sh, [[326, ay], [372, ay]], { label: ln('FWIP-1'), size: 1.3 });
      offPage(sh, 372, ay, 'right', 'ALIMENTO IP', 'spillamento', { w: 28 });
    }
    instr(sh, 344, ay - 22, 'FT', '540', { to: [344, ay - 8] });
    instr(sh, 356, ay - 22, 'PT', '541', { to: [356, ay - 8] });
    sh.text(300, ay + 12, `Q ${f(M.pumps.fw1.Q, 0)} m³/h · H ${f(M.pumps.fw1.H, 0)} m`, { size: 1.4, anchor: 'middle' });
  }
  notesBox(sh, 'NOTE E LEGENDA', [
    ...LEGEND,
    'Pompe di estrazione condensato 2×100 % e pompe alimento 2×100 % per GVR con ricircolo di minima portata.',
    'Stazioni di bypass dimensionate per il 100 % della produzione di vapore (avviamento e blocco TV).',
  ]);
  return [sh];
}
