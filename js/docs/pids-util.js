// P&ID dei sistemi utilities e ausiliari: stazione gas, acqua di circolazione e
// torre (o aerocondensatore), ciclo chiuso, aria compressa, acqua grezza/servizi/
// antincendio, acqua demineralizzata, dosaggi chimici e campionamento, acque reflue,
// gas tecnici, caldaia e vapore ausiliario. Registrano valvole, strumenti e linee.

import { Pid, sym, ST, W, F, orifice, vvessel, drum } from './pidkit.js';
import { pump as pumpSym } from './symbols.js';

const has = (M, id) => !!M.lineById[id];

/** Filtro/apparecchio in linea doppio (2×100 %) con intercettazioni: ritorna le ascisse di ingresso/uscita. */
function parallelPair(p, x0, x1, y, dy, line, { draw, service, valves = true } = {}) {
  const sh = p.sh;
  sh.path([[x0, y - dy], [x0, y + dy]], ST.med);
  sh.path([[x1, y - dy], [x1, y + dy]], ST.med);
  for (const yy of [y - dy, y + dy]) {
    sh.line(x0, yy, x1, yy, ST.med);
    if (valves) {
      p.valve(x0 + 5, yy, { line, kind: 'ball', service: `intercettazione ${service}`, s: 1.7, showTag: false });
      p.valve(x1 - 5, yy, { line, kind: 'ball', service: `intercettazione ${service}`, s: 1.7, showTag: false });
    }
    draw(yy);
  }
}

// ------------------------------------------------------------------ PID-201 stazione gas
export function pid201(M, reg, doc) {
  const p = new Pid(M, reg, doc, { title: 'Stazione di ricevimento, misura e riduzione gas naturale' });
  const sh = p.sh;
  const g = M.U.gas;
  const y = 104;
  p.off(52, y, 'left', 'GASDOTTO', null, { w: 30, sub: `${F(g.pIn, 0)} bar · ${F(g.Tin, 0)} °C` });
  p.line('NG-IN', [[52, y], [100, y]], { label: false });
  sh.line(58, y - 3, 58, y + 3, ST.med).line(59.5, y - 3, 59.5, y + 3, ST.med);
  sh.text(59, y + 6.5, 'giunto isolante', { size: 1.2, anchor: 'middle' });
  p.valve(65, y, { line: 'NG-IN', kind: 'ball', act: 'pneu', fail: 'FC', service: 'blocco di emergenza ingresso stazione (ESD)' });
  // separatore di liquidi (knock-out drum) a monte dei filtri a cartuccia
  vvessel(sh, 72, y - 9, 10, 18);
  sh.path([[74, y - 1], [80, y + 1]], ST.thin);
  p.refEq('0EKA05BB001');
  sh.text(77, y - 14, '0EKA05BB001', { size: 1.3, anchor: 'middle', bold: true });
  sh.text(77, y - 11.6, 'knock-out drum', { size: 1.1, anchor: 'middle' });
  p.inst(66, y + 20, 'LSH', { to: [72, y + 6], service: 'livello liquidi knock-out drum', sys: '0EKA05' });
  p.inst(88, y - 13, 'PT', { line: 'NG-IN', to: [88, y], service: 'pressione gas in arrivo' });
  p.inst(95, y - 13, 'TT', { line: 'NG-IN', to: [95, y], service: 'temperatura gas in arrivo' });
  sh.text(54, y - 4, M.lineById['NG-IN'].lineNo, { size: 1.25 });
  // filtri separatori
  parallelPair(p, 100, 138, y, 14, 'NG-IN', {
    service: 'filtro separatore',
    draw: (yy) => {
      vvessel(sh, 113, yy - 7, 12, 14);
      sh.line(113, yy - 7, 125, yy + 7, ST.thin);
      sh.line(119, yy + 7, 119, yy + 10, ST.thin);
    },
  });
  p.refEq('0EKA10AT001'); p.refEq('0EKA10AT002');
  sh.text(119, y - 25, '0EKA10AT001/002', { size: 1.4, anchor: 'middle', bold: true });
  sh.text(119, y - 22.6, 'filtri separatori 2×100 %', { size: 1.15, anchor: 'middle' });
  p.inst(130, y + 28, 'PDT', { to: [124, y + 18], service: 'intasamento filtri separatori', sys: '0EKA10', range: '0 – 1000', unit: 'mbar' });
  p.inst(100, y + 30, 'LSH', { to: [113, y + 20], service: 'livello condensati filtri separatori', sys: '0EKA10' });
  // misura fiscale
  sh.line(138, y, 180, y, ST.med);
  sym.meter(sh, 152, y);
  p.refEq('0EKA10CF001');
  p.inst(152, y - 14, 'FQ', { line: 'NG-IN', to: [152, y - 2], service: 'misura fiscale gas (ultrasuoni, 2 linee 2×100 %)', range: `0 – ${F(Math.ceil(g.Sm3h * 1.2 / 1000) * 1000, 0)}`, unit: 'Sm³/h' });
  p.inst(166, y - 14, 'AT', { line: 'NG-IN', to: [166, y], service: 'gascromatografo (PCS, Wobbe, composizione)', range: '35 – 45', unit: 'MJ/Sm³' });
  sh.text(152, y + 7, '0EKA10CF001/002', { size: 1.3, anchor: 'middle', bold: true });
  // riscaldatori a bagno d'acqua
  parallelPair(p, 180, 226, y, 14, 'NG-H', {
    service: 'riscaldatore gas',
    draw: (yy) => {
      sh.rect(190, yy - 6, 26, 12, { s: '#000000', w: 0.4, f: W });
      sh.path([[193, yy], [196, yy - 3], [199, yy + 3], [202, yy - 3], [205, yy + 3], [208, yy - 3], [211, yy]], ST.thin);
      sh.text(203, yy + 4.6, 'bruciatore', { size: 1.05, anchor: 'middle' });
    },
  });
  p.refEq('0EKA20AC001'); p.refEq('0EKA20AC002');
  sh.text(203, y - 25, '0EKA20AC001/002', { size: 1.4, anchor: 'middle', bold: true });
  sh.text(203, y - 22.6, `riscaldatori ${F(g.heaterKW * 1.25, 0)} kW`, { size: 1.15, anchor: 'middle' });
  p.line('NG-H', [[226, y], [240, y]], { label: false });
  p.inst(233, y - 13, 'TIC', { line: 'NG-H', to: [233, y], service: `temperatura gas a monte riduzione (${F(g.preheatT, 0)} °C, anti-idrati)` });
  sh.text(228, y + 4, M.lineById['NG-H'].lineNo, { size: 1.15 });
  // linee di riduzione
  parallelPair(p, 240, 300, y, 14, 'NG-OUT', {
    service: 'linea di riduzione', valves: false,
    draw: (yy) => {
      p.valve(250, yy, { line: 'NG-H', kind: 'ball', act: 'pneu', fail: 'FC', service: 'valvola di blocco per sovrapressione (SSV)', s: 1.9, showTag: false });
      p.valve(266, yy, { line: 'NG-OUT', ctl: true, fail: 'FO', service: 'regolatore monitor', s: 1.9, showTag: false });
      p.valve(282, yy, { line: 'NG-OUT', ctl: true, fail: 'FC', service: 'regolatore attivo', s: 1.9, showTag: false });
    },
  });
  p.refEq('0EKA30');
  sh.text(270, y - 25, '0EKA30 linee di riduzione 2×100 %', { size: 1.4, anchor: 'middle', bold: true });
  sh.text(270, y - 22.6, 'SSV · monitor · regolatore attivo', { size: 1.15, anchor: 'middle' });
  p.inst(292, y + 30, 'PIC', { line: 'NG-OUT', to: [300, y + 14], service: 'regolazione pressione a valle riduzione' });
  // uscita ai TG
  p.line('NG-OUT', [[300, y], [372, y]], { seg: 0, at: 0.55 });
  p.off(372, y, 'right', 'AI TURBOGAS', 'pid102', { w: 30 });
  p.inst(326, y - 13, 'PT', { line: 'NG-OUT', to: [326, y], service: 'pressione collettore gas ai TG' });
  p.inst(335, y - 13, 'TT', { line: 'NG-OUT', to: [335, y], service: 'temperatura collettore gas ai TG' });
  p.psv(310, y - 4, { line: 'NG-OUT', service: 'protezione collettore a valle riduzione', out: -1 });
  sh.path([[307, y - 5.5], [304, y - 5.5], [304, 56]], ST.norm);
  // caldaia ausiliaria
  p.dot(340, y);
  p.line('NG-AB', [[340, y], [340, 150], [372, 150]], { seg: 1, at: 0.4 });
  p.valve(340, 128, { line: 'NG-AB', dir: 'v', act: 'sol', fail: 'FC', service: 'intercettazione gas caldaia ausiliaria', s: 1.8 });
  p.off(372, 150, 'right', 'CALDAIA AUX', 'pid210', { w: 26 });
  // sfiati
  p.line('NG-V', [[304, 56], [360, 56]], { seg: 0, at: 0.2 });
  sh.rect(357, 30, 6, 26, { s: '#000000', w: 0.45, f: W });
  p.eqTag(372, 40, '0EKA90', 'camino di sfiato', { size: 1.6, anchor: 'start' });
  p.off(402, 64, 'left', 'SFIATI TG', 'pid102', { w: 26 });
  sh.path([[376, 64], [366, 64], [366, 56], [363, 56]], ST.norm);
  // azoto di spurgo
  p.off(40, 150, 'right', 'AZOTO', 'pid209', { w: 22 });
  p.line('N2-FG', [[62, 150], [92, 150], [92, y]], { label: false });
  p.valve(74, 150, { line: 'N2-FG', kind: 'ball', service: 'spurgo azoto stazione', s: 1.7 });
  p.valve(84, 150, { line: 'N2-FG', kind: 'check', service: 'non ritorno azoto', s: 1.7 });
  p.dot(92, y);
  // drenaggi di knock-out drum e filtri al serbatoio dedicato
  p.line('NG-DR', [[77, y + 10], [77, 162], [140, 162]], { seg: 1, at: 0.45 });
  p.valve(77, 128, { line: 'NG-DR', act: 'sol', fail: 'FC', dir: 'v', service: 'scarico automatico liquidi knock-out drum (su livello)', s: 1.6 });
  sh.path([[119, y + 24], [119, 162]], ST.norm);
  sh.path([[119, y - 4], [119, y - 2], [110, y - 2], [110, 162]], ST.norm);
  p.dot(119, 162); p.dot(110, 162);
  drum(sh, 140, 157, 26, 10);
  p.refEq('0EKA80BB001');
  p.eqTag(153, 172, '0EKA80BB001', 'serbatoio drenaggi stazione gas', { size: 1.5 });
  sh.path([[160, 157], [160, 150]], ST.norm);
  sh.text(161, 151, 'sfiato in zona sicura', { size: 1.1 });
  return p.finish([
    `Portata gas di progetto ${F(g.Sm3h, 0)} Sm³/h (PCI ${F(g.lhvMJSm3, 2)} MJ/Sm³); riduzione da ${F(g.pIn, 0)} a ${F(g.pOut, 1)} bar con preriscaldo a ${F(g.preheatT, 0)} °C per compensare l'effetto Joule-Thomson (${F(g.dTjt, 1)} K).`,
    'Knock-out drum e filtri a cartuccia 2×100 % (3 µm) a monte della misura fiscale 2×100 % non by-passabile (codice di rete); linee di riduzione con SSV, monitor e regolatore attivo (UNI EN 12186). Gas consegnato ai TG con margine ≥ 20 K sul punto di rugiada.',
  ]);
}

// ------------------------------------------------------------------ PID-202 acqua di circolazione / ACC
export function pid202(M, reg, doc) {
  if (!M.water) return pid202acc(M, reg, doc);
  const p = new Pid(M, reg, doc, { title: 'Acqua di circolazione e torre di raffreddamento' });
  const sh = p.sh;
  const cw = M.U.cooling;
  // torre e vasca
  const tx = 150, ty = 44, tw = 116, th = 36;
  sym.coolingTower(sh, tx, ty, tw, th, Math.min(8, M.ctCells));
  sh.rect(tx - 10, ty + th, tw + 20, 20, { s: '#000000', w: 0.5, f: W });
  sh.path([[tx - 10, ty + th + 6], [tx + tw + 10, ty + th + 6]], ST.dash);
  p.eqTag(tx + tw / 2, ty - 10, '0PAE10', `Torre evaporativa · ${M.ctCells} celle · ${F(cw.Qcond, 0)} MW`, { size: 1.8 });
  p.refEq('0PAE10BB001');
  sh.text(tx + tw / 2, ty + th + 16, '0PAE10BB001 vasca di raccolta', { size: 1.3, anchor: 'middle', bold: true });
  p.inst(tx - 20, ty + th + 4, 'LIC', { to: [tx - 10, ty + th + 6], service: 'livello vasca torre (reintegro)', sys: '0PAE10' });
  p.inst(tx + tw + 20, ty + th + 4, 'AIC', { to: [tx + tw + 10, ty + th + 8], service: 'conducibilità acqua di circolazione (spurgo)', sys: '0PAE10', range: '0 – 5000', unit: 'µS/cm' });
  p.inst(tx + tw + 20, ty + th + 14, 'AT', { to: [tx + tw + 10, ty + th + 12], service: 'pH acqua di circolazione', sys: '0PAE10', range: '0 – 14', unit: 'pH' });
  // ritorno caldo dal condensatore e dagli intercooler del ciclo chiuso
  p.off(402, 58, 'left', 'DAL CONDENSATORE', 'pid108', { w: 34 });
  p.line('CWR', [[368, 58], [tx + tw - 4, 58]], { seg: 0, at: 0.45 });
  p.inst(330, 70, 'TT', { line: 'CWR', to: [330, 58], service: 'temperatura acqua calda in torre' });
  p.off(402, 46, 'left', 'RITORNO ACW', 'pid203', { w: 30 });
  p.line('ACWR', [[372, 46], [258, 46]], { seg: 0, at: 0.35 });
  // by-pass torre (protezione antigelo)
  p.dot(288, 58);
  p.pipe([[288, 58], [288, 90], [tx + tw + 10, 90]], { arrow: true });
  p.valve(288, 74, { line: 'CWR', dir: 'v', act: 'mot', kind: 'butterfly', service: 'by-pass torre (protezione antigelo)', s: 1.8, tagSide: -1 });
  sh.text(291, 86, 'by-pass antigelo', { size: 1.15 });
  // pompe acqua di circolazione MCW 2×50 %
  p.inst(160, 108, 'LIC', { to: [160, ty + th + 20], service: 'livello vasca torre (reintegro)', sys: '0PAE10' });
  const pp = p.pumps(178, 142, { n: 2, pitch: 34, tag: '0PAC10AP', sucLine: 'CWS', disLine: 'CWS', service: 'pompe acqua di circolazione MCW', strainer: false });
  sh.path([[tx, ty + th + 20], [tx, pp.yS], [pp.xS0, pp.yS]], ST.thick);
  sh.text(tx + 2, pp.yS - 2, 'griglie', { size: 1.15 });
  p.refEq('0PAA10AT001');
  p.line('CWS', [[pp.xD1, pp.yD], [372, pp.yD]], { seg: 0, at: 0.62 });
  p.off(372, pp.yD, 'right', 'AL CONDENSATORE', 'pid108', { w: 34 });
  p.inst(310, pp.yD - 12, 'FT', { line: 'CWS', to: [310, pp.yD], service: 'portata acqua di circolazione' });
  p.inst(320, pp.yD - 12, 'PT', { line: 'CWS', to: [320, pp.yD], service: 'pressione mandata pompe MCW' });
  p.inst(330, pp.yD - 12, 'TT', { line: 'CWS', to: [330, pp.yD], service: 'temperatura acqua fredda' });
  sh.text(pp.xs[0] + 6, pp.yD - 3, 'valvole combinate ritegno/regolazione', { size: 1.1 });
  // pompe acqua ausiliaria ACW 2×100 % agli intercooler del ciclo chiuso
  const ap = p.pumps(244, 172, { n: 2, pitch: 28, tag: '0PAC20AP', sucLine: 'ACWS', disLine: 'ACWS', service: 'pompe acqua ausiliaria ACW', strainer: false });
  sh.path([[230, ty + th + 20], [230, ap.yS], [ap.xS0, ap.yS]], ST.med);
  p.line('ACWS', [[ap.xD1, ap.yD], [372, ap.yD]], { seg: 0, at: 0.86 });
  parallelPair(p, 290, 330, ap.yD, 7, 'ACWS', {
    service: 'filtro autopulente ACW',
    draw: (yy) => sym.filter(sh, 305, yy - 3, 10, 6),
  });
  p.refEq('0PAC20AT001'); p.refEq('0PAC20AT002');
  sh.text(310, ap.yD - 12.5, '0PAC20AT001/002 filtri 200–300 µm', { size: 1.2, anchor: 'middle', bold: true });
  p.inst(310, ap.yD + 16, 'PDT', { to: [310, ap.yD + 7], service: 'intasamento filtri ACW', sys: '0PAC20', range: '0 – 500', unit: 'mbar' });
  p.off(372, ap.yD, 'right', 'AGLI INTERCOOLER', 'pid203', { w: 32 });
  // spurgo torre (derivato a valle dei filtri ACW)
  p.dot(345, ap.yD);
  p.line('CTB', [[345, ap.yD], [345, 214], [60, 214]], { seg: 1, at: 0.6 });
  p.valve(240, 214, { line: 'CTB', ctl: true, fail: 'FC', service: 'spurgo torre su conducibilità' });
  p.inst(226, 226, 'FT', { line: 'CTB', to: [226, 214], service: 'portata spurgo torre (comando dosaggio inibitore)' });
  p.off(60, 214, 'left', 'ACQUE REFLUE', 'pid208', { w: 30 });
  // reintegro (derivato a monte del serbatoio acqua grezza)
  p.off(20, 64, 'right', 'ACQUA GREZZA', 'pid205', { w: 26 });
  p.line('CTM', [[46, 64], [126, 64], [126, ty + th + 4], [tx - 10, ty + th + 4]], { seg: 0, at: 0.06 });
  p.valve(84, 64, { line: 'CTM', ctl: true, fail: 'FC', service: 'reintegro torre (livello vasca)' });
  p.inst(112, 52, 'FT', { line: 'CTM', to: [112, 64], service: 'portata reintegro torre' });
  // dosaggi
  const kx = 24, ky = 104;
  sh.rect(kx, ky, 70, 50, ST.dash);
  sh.text(kx + 1.5, ky + 3.5, '0PAX10/20/30 DOSAGGI TORRE', { size: 1.25, bold: true });
  p.refEq('0PAX10'); p.refEq('0PAX20'); p.refEq('0PAX30');
  [['CHA', 'inibitore', ky + 14, [[100, 64]]], ['CHH', 'ipoclorito (shock)', ky + 28, [[106, ty + th + 10], [tx - 10, ty + th + 10]]], ['CHS', 'acido solforico', ky + 42, [[112, ty + th + 14], [tx - 10, ty + th + 14]]]].forEach(([id, nm, yy, tail], i) => {
    vvessel(sh, kx + 4, yy - 8, 9, 12);
    pumpSym(sh, kx + 24, yy, { r: 2.4, out: 'right' });
    sh.line(kx + 13, yy, kx + 21.6, yy, ST.norm);
    sh.text(kx + 32, yy - 3, nm, { size: 1.1 });
    const xv = 100 + i * 6;
    p.line(id, [[kx + 26.4, yy], [xv, yy], ...tail.map(([x, y]) => [i === 0 ? xv : x, y])], { label: false });
    p.valve(kx + 40, yy, { line: id, kind: 'check', s: 1.4, service: `non ritorno dosaggio ${nm}` });
  });
  p.dot(100, 64);
  p.inst(tx + tw + 20, ty + th + 24, 'AIC', { to: [tx + tw + 10, ty + th + 16], service: 'pH acqua di circolazione (dosaggio acido)', sys: '0PAX20', range: '0 – 14', unit: 'pH' });
  return p.finish([
    `Portata acqua di circolazione ${F(cw.cwM3h, 0)} m³/h (pompe MCW 2×50 %), acqua ausiliaria ${F(M.U.ccw.acwM3h, 0)} m³/h (pompe ACW 2×100 %); evaporazione ${F(cw.evapM3h, 0)} m³/h, spurgo ${F(cw.blowdownM3h, 0)} m³/h, reintegro ${F(cw.makeupM3h, 0)} m³/h con ${cw.coc} cicli di concentrazione.`,
    `Dosaggi: ipoclorito a shock ${F(cw.hypo, 1)} kg/h (residuo 0,1–0,2 ppm, 2–3 volte al giorno), acido solforico ${F(cw.acid, 1)} kg/h su pH, inibitore ${F(cw.antiscalant, 1)} kg/h sul reintegro comandato dalla portata di spurgo.`,
  ]);
}

function pid202acc(M, reg, doc) {
  const p = new Pid(M, reg, doc, { title: 'Aerocondensatore, condensato ACC e vuoto' });
  const sh = p.sh;
  const bt = M.r.bt;
  // condotto di scarico e ACC
  p.off(20, 60, 'right', 'SCARICO TV', 'pid108', { w: 26 });
  p.line('ED', [[46, 60], [120, 60]], { label: true, seg: 0, at: 0.2 });
  const ax = 120, ay = 64, aw = 180, ah = 26;
  sh.line(ax, 60, ax + aw, 60, ST.heavy);
  for (let i = 0; i < 6; i++) {
    const x0 = ax + i * 30;
    sh.path([[x0 + 3, 60], [x0 + 15, ay + ah], [x0 + 27, 60]], ST.norm);
    sh.circle(x0 + 15, ay + 6, 3.2, { s: '#000000', w: 0.3, f: W });
    sh.line(x0 + 12, ay + 6, x0 + 18, ay + 6, ST.thin);
  }
  sh.line(ax, ay + ah, ax + aw, ay + ah, ST.med);
  p.eqTag(ax + aw / 2, 50, '0MAG10', `Aerocondensatore · ${M.accCells} celle a A · ${F(bt.Qcond, 0)} MW`, { size: 1.8 });
  for (let i = 0; i < 3; i++) p.inst(ax + aw + 14 + i * 9, 48, 'PT', { to: [ax + aw, 60], service: 'pressione condotto vapore ACC (2oo3)', sys: '0MAG10', sis: i === 0, range: '0 – 400', unit: 'mbar a' });
  p.inst(ax - 14, 74, 'SIC', { to: [ax + 15, ay + 6], service: 'velocità ventilatori ACC (VFD) su pressione allo scarico', sys: '0MAG10', range: '0 – 100', unit: '%' });
  // serbatoio condensato
  const dx = 150, dy = 132;
  p.line('ACD', [[ax + aw / 2, ay + ah], [ax + aw / 2, 116], [dx + 20, 116], [dx + 20, dy]], { seg: 1, at: 0.4 });
  drum(sh, dx, dy, 50, 14);
  p.eqTag(dx + 25, dy + 22, '0MAG20BB001', 'Serbatoio condensato ACC');
  p.inst(dx - 9, dy + 4, 'LT', { to: [dx, dy + 5], service: 'livello serbatoio condensato ACC', sys: '0MAG20' });
  p.inst(dx - 9, dy + 13, 'LSHH', { to: [dx, dy + 10], service: 'livello altissimo serbatoio condensato', sys: '0MAG20', sis: true });
  p.inst(dx + 60, dy - 6, 'TT', { line: 'ACD', to: [dx + 20, dy - 6], service: 'temperatura condensato ACC' });
  p.line('CDS', [[dx + 10, dy + 14], [dx + 10, 200], [60, 200]], { seg: 1, at: 0.5 });
  p.off(60, 200, 'left', 'A POMPE CONDENS.', 'pid109', { w: 32 });
  p.off(402, dy + 7, 'left', 'REINTEGRO DEMI', 'pid206', { w: 30 });
  p.line('MUC', [[372, dy + 7], [dx + 50, dy + 7]], { seg: 0, at: 0.4 });
  p.valve(300, dy + 7, { line: 'MUC', ctl: true, fail: 'FC', service: 'reintegro serbatoio condensato (livello)' });
  p.off(402, 176, 'left', 'MINIMA PORTATA', 'pid109', { w: 30 });
  p.line('CDR', [[372, 176], [dx + 40, 176], [dx + 40, dy + 14]], { seg: 0, at: 0.4 });
  // estrazione incondensabili: eiettori e pompe del vuoto
  p.line('ACV', [[ax + aw, 80], [340, 80]], { seg: 0, at: 0.2 });
  sh.rect(340, 74, 22, 12, { s: '#000000', w: 0.4, f: W });
  p.eqTag(351, 96, '0MAJ20', 'eiettori a vapore', { size: 1.6 });
  p.off(402, 70, 'left', 'VAPORE AUSIL.', 'pid210', { w: 26 });
  sh.path([[376, 70], [351, 70], [351, 74]], ST.norm);
  sh.path([[362, 80], [372, 80], [372, 86]], ST.norm);
  sym.silencer(sh, 372, 94, 4, 8);
  p.dot(320, 80);
  p.line('VAC', [[320, 80], [320, 108], [364, 108]], { label: false });
  p.valve(320, 96, { line: 'VAC', dir: 'v', act: 'mot', service: 'aspirazione pompe del vuoto (avviamento)', s: 1.8, tagSide: -1 });
  for (let i = 0; i < 2; i++) {
    const x = 348 + i * 16;
    sh.line(x, 108, x, 112.8, ST.norm);
    pumpSym(sh, x, 116, { r: 3.2 });
    p.refEq(`0MAJ10AP00${i + 1}`);
  }
  sh.text(344, 126, '0MAJ10AP001/002 pompe del vuoto', { size: 1.25, bold: true });
  return p.finish([
    `Pressione allo scarico TV di progetto ${F(bt.pCond * 1000, 0)} mbar; ventilatori a velocità variabile regolati sulla pressione allo scarico.`,
    'Eiettori di mantenimento con vapore ausiliario; pompe del vuoto per l\'evacuazione all\'avviamento.',
  ]);
}

// ------------------------------------------------------------------ PID-203 ciclo chiuso
export function pid203(M, reg, doc) {
  const p = new Pid(M, reg, doc, { title: 'Acqua di raffreddamento a ciclo chiuso' });
  const sh = p.sh;
  const cc = M.U.ccw;
  const yR = 60, yS = 150;
  // utenze (treno 1 e comuni)
  const users = cc.users.filter((u) => u.tag[0] === '1' || u.tag[0] === '0');
  const x0 = 222, dxU = Math.min(24, (398 - x0) / users.length);
  p.line('CCS', [[205, yS], [x0 + dxU * (users.length - 1) + 4, yS]], { seg: 0, at: 0.02, arrow: false });
  p.line('CCR', [[x0 + dxU * (users.length - 1) + 4, yR], [40, yR], [40, 133], [49, 133]], { seg: 0, at: 0.62 });
  users.forEach((u, i) => {
    const x = x0 + i * dxU;
    const id = `CC-${u.tag}`;
    p.dot(x, yS); p.dot(x, yR);
    p.line(id, [[x, yS], [x, 112]], { label: false });
    sh.circle(x, 108, 4, { s: '#000000', w: 0.35, f: W });
    sh.path([[x - 2.8, 110.8], [x - 1, 106], [x + 1, 110], [x + 2.8, 105.2]], ST.thin);
    sh.line(x, 104, x, yR, ST.norm);
    p.valve(x, 136, { line: id, kind: 'butterfly', dir: 'v', service: `intercettazione ${u.name}`, s: 1.6, showTag: false });
    p.valve(x, 78, { line: id, kind: 'butterfly', dir: 'v', service: `intercettazione ${u.name}`, s: 1.6, showTag: false });
    sh.text(x + 2.4, 100, u.tag, { size: 1.25, rot: -90, bold: true });
    sh.text(x - 1.2, 132, M.lineById[id].lineNo, { size: 1.05, rot: -90 });
    p.refEq(u.tag);
  });
  p.inst(x0 - 8, yR - 12, 'TT', { line: 'CCR', to: [x0 - 8, yR], service: 'temperatura ritorno ciclo chiuso' });
  if (M.N > 1) sh.text(x0, 42, `Utenze dei treni 2…${M.N} uguali al treno 1, derivate dagli stessi collettori.`, { size: 1.3 });
  // vaso di espansione e reintegro
  vvessel(sh, 114, 28, 12, 20);
  p.refEq('0PGB20BB001');
  sh.line(120, 48, 120, yR, ST.norm);
  p.eqTag(130, 32, '0PGB20BB001', 'vaso di espansione (N₂)', { size: 1.5, anchor: 'start' });
  p.inst(104, 40, 'LT', { to: [114, 40], service: 'livello vaso di espansione', sys: '0PGB20' });
  p.off(46, 30, 'right', 'ACQUA DEMI', 'pid206', { w: 26 });
  p.line('CC-MU', [[72, 30], [96, 30], [96, 32], [114, 32]], { label: false });
  p.valve(84, 30, { line: 'CC-MU', act: 'sol', fail: 'FC', service: 'reintegro vaso di espansione', s: 1.7 });
  // pompe
  const pp = p.pumps(60, 120, { n: 2, pitch: 28, tag: '0PGB10AP', sucLine: 'CCR', disLine: 'CCS', service: 'pompe ciclo chiuso' });
  // dosatore a vaso
  vvessel(sh, 98, 104, 8, 12);
  p.refEq('0PGB30');
  sh.text(102, 121, '0PGB30', { size: 1.2, anchor: 'middle', bold: true });
  sh.path([[102, 104], [102, pp.yD]], ST.thin);
  sh.path([[102, 116], [102, 128], [92, 128], [92, pp.yS]], ST.thin);
  p.line('CCS', [[pp.xD1, pp.yD], [124, pp.yD]], { label: false });
  if (M.water) {
    // intercooler a piastre 2×100 % raffreddati dall'acqua ausiliaria ACW (torre o presa)
    parallelPair(p, 124, 190, pp.yD, 10, 'CCS', {
      service: 'intercooler ciclo chiuso',
      draw: (yy) => sym.plateHX(sh, 150, yy - 4, 14, 8),
    });
    p.refEq('0PGD10AC001'); p.refEq('0PGD10AC002');
    p.eqTag(157, pp.yD - 22, '0PGD10AC001/002', `Intercooler a piastre 2×100 % · ${F(cc.kW / 1000, 1)} MW`, { size: 1.5 });
    // acqua ausiliaria: collettore di mandata a destra degli scambiatori, ritorno a sinistra verso la torre
    const yA = pp.yD - 10, yB = pp.yD + 10;
    p.off(147, 150, 'right', 'DA POMPE ACW', 'pid202', { w: 24 });
    p.line('ACWS', [[171, 150], [176, 150], [176, yA + 2], [164, yA + 2]], { seg: 1, at: 0.3 });
    p.dot(176, yB + 2);
    sh.path([[176, yB + 2], [164, yB + 2]], ST.med);
    p.line('ACWR', [[150, yA - 2], [142, yA - 2], [142, 162], [124, 162]], { seg: 1, at: 0.75 });
    p.dot(142, yB - 2);
    sh.path([[150, yB - 2], [142, yB - 2]], ST.med);
    p.off(124, 162, 'left', 'RITORNO ACW TORRE', 'pid202', { w: 34 });
    p.valve(133, 162, { line: 'ACWR', ctl: true, fail: 'FO', service: 'regolazione ACW (temperatura mandata ciclo chiuso)', s: 1.8 });
    p.inst(214, 124, 'TIC', { line: 'CCS', to: [205, 124], service: 'temperatura mandata ciclo chiuso (valvola ACW)' });
  } else {
    sym.fanCooler(sh, 124, pp.yD - 7, 66, 14, 4);
    p.eqTag(157, pp.yD + 12, '0PGC10', `Aerotermi ${F(cc.kW / 1000, 1)} MW`, { size: 1.7 });
    p.inst(214, 124, 'TIC', { line: 'CCS', to: [205, 124], service: 'temperatura mandata ciclo chiuso (ventilatori a velocità variabile)' });
  }
  sh.path([[190, pp.yD], [205, pp.yD], [205, yS]], ST.med);
  p.inst(214, 160, 'PT', { line: 'CCS', to: [214, yS], service: 'pressione mandata ciclo chiuso' });
  p.inst(224, 160, 'FT', { line: 'CCS', to: [224, yS], service: 'portata ciclo chiuso' });
  // legenda utenze
  const lx = 24, ly = 176;
  sh.text(lx, ly, 'UTENZE (TRENO 1 E COMUNI)', { size: 1.5, bold: true });
  users.forEach((u, i) => sh.text(lx + (i % 2) * 104, ly + 4 + Math.floor(i / 2) * 3, `${u.tag}  ${u.name} — ${F(u.kW, 0)} kW`, { size: 1.3 }));
  return p.finish([
    `Carico termico totale ${F(cc.kW, 0)} kW, portata ${F(cc.m3h, 0)} m³/h, mandata ${F(cc.Tsupply, 0)} °C / ritorno ${F(cc.Treturn, 0)} °C. Acqua demineralizzata con inibitore di corrosione.`,
  ]);
}

// ------------------------------------------------------------------ PID-204 aria compressa
export function pid204(M, reg, doc) {
  const p = new Pid(M, reg, doc, { title: 'Aria compressa strumenti e servizi' });
  const sh = p.sh;
  const a = M.U.air;
  // compressori
  [70, 110].forEach((y, i) => {
    sym.compressor(sh, 50, y, 6);
    p.refEq(`0SCA10AN00${i + 1}`);
    sh.text(50, y + 10, `0SCA10AN00${i + 1}`, { size: 1.3, anchor: 'middle', bold: true });
    sh.path([[30, y], [44, y]], ST.norm);
    sym.filter(sh, 24, y - 3, 6, 6);
    sh.line(56, y, 76, y, ST.med);
    p.valve(66, y, { line: 'IA-D', kind: 'check', service: `non ritorno compressore ${i + 1}`, s: 1.8 });
  });
  sh.text(24, 58, 'filtri aspirazione', { size: 1.15 });
  p.off(16, 140, 'right', 'CICLO CHIUSO', 'pid203', { w: 24 });
  p.line('CC-0SCA10AC001', [[40, 140], [50, 140], [50, 120]], { label: false });
  sh.text(42, 145, M.lineById['CC-0SCA10AC001'].lineNo, { size: 1.15 });
  p.line('IA-D', [[76, 70], [76, 110], [76, 90], [100, 90]], { label: false });
  sh.text(78, 86, M.lineById['IA-D'].lineNo, { size: 1.2 });
  // serbatoio aria umida
  vvessel(sh, 100, 66, 14, 44);
  p.eqTag(107, 120, '0SCB10BB001', 'serbatoio aria umida', { size: 1.5 });
  p.psv(107, 62, { line: 'IA-D', service: 'sicurezza serbatoio aria umida' });
  p.inst(124, 100, 'PIC', { line: 'IA-D', to: [114, 100], service: 'pressione serbatoio (carico/scarico compressori)' });
  sh.line(107, 110, 107, 114, ST.thin);
  sh.text(109, 115, 'scarico condensa', { size: 1.1 });
  // aria servizi
  p.line('SA-H', [[114, 104], [140, 104], [140, 190], [372, 190]], { seg: 2, at: 0.5 });
  p.valve(170, 190, { line: 'SA-H', ctl: true, fail: 'FC', service: 'priorità aria strumenti (chiude su bassa pressione)' });
  p.inst(184, 176, 'PIC', { line: 'IA-H', to: [172, 186], service: 'priorità aria strumenti' });
  p.off(372, 190, 'right', 'ARIA SERVIZI', null, { w: 28, sub: 'prese di servizio' });
  // essiccatori
  p.line('IA-D', [[114, 74], [150, 74]], { label: false });
  parallelPair(p, 150, 196, 74, 14, 'IA-H', {
    service: 'essiccatore',
    draw: (yy) => { sh.rect(164, yy - 6, 8, 12, { s: '#000000', w: 0.4, f: W }); sh.rect(174, yy - 6, 8, 12, { s: '#000000', w: 0.4, f: W }); },
  });
  p.refEq('0SCC10AT001'); p.refEq('0SCC10AT002');
  sh.text(173, 52, '0SCC10AT001/002 essiccatori', { size: 1.35, anchor: 'middle', bold: true });
  sh.text(173, 54.6, `ad adsorbimento heatless 2×100 % · ${F(a.dryerNm3h, 0)} Nm³/h · −40 °C`, { size: 1.1, anchor: 'middle' });
  p.inst(208, 60, 'AT', { line: 'IA-H', to: [208, 74], service: 'punto di rugiada aria strumenti (−40 °C)', range: '-80 – 20', unit: '°C td' });
  // serbatoio aria strumenti e collettore
  p.line('IA-H', [[196, 74], [222, 74]], { label: false });
  vvessel(sh, 222, 60, 14, 40);
  p.eqTag(229, 110, '0SCC20BB001', 'serbatoio aria strumenti', { size: 1.5 });
  p.psv(229, 56, { line: 'IA-H', service: 'sicurezza serbatoio aria strumenti' });
  p.line('IA-H', [[236, 90], [260, 90]], { seg: 0, at: 0.1 });
  p.inst(250, 104, 'PT', { line: 'IA-H', to: [250, 90], service: 'pressione collettore aria strumenti' });
  p.inst(260, 104, 'PSL', { line: 'IA-H', to: [258, 92], service: 'bassa pressione aria strumenti (allarme)' });
  sh.line(270, 50, 270, 140, ST.med);
  sh.line(260, 90, 270, 90, ST.med);
  [['IA-GT', 'UTENZE TG', 'pid101'], ['IA-HR', 'UTENZE GVR', 'pid104'], ['IA-ST', 'UTENZE TV E CICLO', 'pid108'], ['IA-BOP', 'UTENZE BoP', null]].forEach(([id, txt, tgt], i) => {
    const y = 50 + i * 30;
    p.line(id, [[270, y], [372, y]], { seg: 0, at: 0.45 });
    p.valve(290, y, { line: id, kind: 'ball', service: `intercettazione ${txt.toLowerCase()}`, s: 1.8 });
    p.off(372, y, 'right', txt, tgt, { w: 30 });
  });
  return p.finish([
    `Consumo aria strumenti ${F(a.instrument, 0)} Nm³/h, aria servizi ${F(a.service, 0)} Nm³/h; compressori 2×100 % da ${F(a.compressorNm3h, 0)} Nm³/h a ${F(a.pressure, 0)} bar a, essiccatori heatless 2×100 % da ${F(a.dryerNm3h, 0)} Nm³/h (rugiada −40 °C).`,
    `Serbatoi da ${F(a.receiverM3, 0)} m³ dimensionati per ${F(a.holdupMin, 0)} minuti di autonomia con compressori fermi; valvola di priorità sull'aria servizi.`,
  ]);
}

// ------------------------------------------------------------------ PID-205 acqua grezza, servizi, antincendio
export function pid205(M, reg, doc) {
  const p = new Pid(M, reg, doc, { title: 'Acqua grezza, pretrattamento, acqua servizi e antincendio' });
  const sh = p.sh;
  const pt = M.U.pret;
  // serbatoio acqua grezza con riserva antincendio sul fondo
  const tx = 40, ty = 50, tw = 56, th = 168;
  sh.rect(tx, ty, tw, th, { s: '#000000', w: 0.5, f: W });
  sh.path([[tx, ty], [tx + tw / 2, ty - 7], [tx + tw, ty]], { s: '#000000', w: 0.5, f: W }, true);
  p.refEq('0GAA10BB001');
  sh.text(tx + tw / 2, ty + 20, '0GAA10BB001', { size: 1.6, anchor: 'middle', bold: true });
  sh.text(tx + tw / 2, ty + 23, `acqua grezza ${F(pt.rawTankM3, 0)} m³`, { size: 1.2, anchor: 'middle' });
  sh.text(tx + tw / 2, ty + 25.4, `riserva antincendio ${F(pt.fireReserveM3, 0)} m³`, { size: 1.2, anchor: 'middle' });
  sh.path([[tx, 150], [tx + tw, 150]], ST.dash);
  sh.text(tx + 2, 148, 'livello riserva antincendio', { size: 1.1 });
  p.inst(tx - 8, 100, 'LT', { to: [tx, 100], service: 'livello serbatoio acqua grezza', sys: '0GAA10' });
  p.inst(tx - 8, 158, 'LSL', { to: [tx, 156], service: 'livello minimo riserva antincendio', sys: '0GAA10' });
  // alimentazione e reintegro torre derivato a monte del serbatoio
  p.off(16, 34, 'right', 'OPERA DI PRESA', null, { w: 28 });
  p.line('RW-IN', [[44, 34], [68, 34], [68, 43]], { label: false });
  p.valve(58, 34, { line: 'RW-IN', ctl: true, fail: 'FC', service: 'alimentazione serbatoio (livello)', s: 1.9 });
  sh.text(70, 32, M.lineById['RW-IN'].lineNo, { size: 1.2 });
  if (has(M, 'CTM')) {
    p.dot(48, 34);
    p.line('CTM', [[48, 34], [48, 26], [372, 26]], { seg: 1, at: 0.5 });
    p.off(372, 26, 'right', 'REINTEGRO TORRE', 'pid202', { w: 30 });
  }
  // clorazione del serbatoio (contro lo sviluppo biologico nella riserva)
  sh.rect(14, 64, 18, 14, ST.dash);
  vvessel(sh, 16, 67, 5, 8);
  pumpSym(sh, 26, 73, { r: 2 });
  p.refEq('0GAA20');
  sh.text(23, 82, '0GAA20 ipoclorito', { size: 1.15, anchor: 'middle', bold: true });
  sh.path([[28, 73], [tx, 73]], ST.norm);
  // pompe alimento pretrattamento
  const rp = p.pumps(124, 80, { n: 2, pitch: 30, tag: '0GAA10AP', sucLine: 'RW-P', disLine: 'RW-P', service: 'pompe alimento pretrattamento' });
  sh.line(tx + tw, rp.yS, rp.xS0, rp.yS, ST.med);
  p.line('RW-P', [[rp.xD1, rp.yD], [190, rp.yD]], { seg: 0, at: 0.4 });
  p.inst(170, rp.yD - 10, 'FT', { line: 'RW-P', to: [170, rp.yD], service: 'portata alimento pretrattamento' });
  // impianto di pretrattamento (package)
  sh.rect(190, rp.yD - 10, 44, 20, { s: '#000000', w: 0.45, f: W });
  sym.filter(sh, 196, rp.yD - 4, 8, 8);
  sym.filter(sh, 208, rp.yD - 4, 8, 8);
  sh.text(212, rp.yD + 14, '0GBA10 pretrattamento', { size: 1.4, anchor: 'middle', bold: true });
  sh.text(224, rp.yD + 1, 'package', { size: 1.1, anchor: 'middle' });
  p.refEq('0GBA10');
  p.line('SV-T', [[234, rp.yD], [248, rp.yD], [248, 40], [282, 40], [282, 49]], { seg: 2, at: 0.4 });
  // serbatoio acqua servizi
  const sx = 262, sy = 52, sw = 40, sth = 134;
  sh.rect(sx, sy, sw, sth, { s: '#000000', w: 0.5, f: W });
  sh.path([[sx, sy], [sx + sw / 2, sy - 5], [sx + sw, sy]], { s: '#000000', w: 0.5, f: W }, true);
  p.refEq('0GHA10BB001');
  sh.text(sx + sw / 2, sy + 16, '0GHA10BB001', { size: 1.5, anchor: 'middle', bold: true });
  sh.text(sx + sw / 2, sy + 19, `acqua servizi ${F(pt.serviceTankM3, 0)} m³`, { size: 1.15, anchor: 'middle' });
  sh.text(sx + sw / 2, sy + 21.4, '4 h servizi + 12 h demi', { size: 1.1, anchor: 'middle' });
  p.inst(sx - 8, sy + 40, 'LT', { to: [sx, sy + 40], service: 'livello serbatoio acqua servizi (avvio pompe pretrattamento)', sys: '0GHA10' });
  // pompe acqua servizi e potabile
  const sp = p.pumps(318, 112, { n: 2, pitch: 30, tag: '0GHA10AP', sucLine: 'SV-H', disLine: 'SV-H', service: 'pompe acqua servizi' });
  sh.line(sx + sw, sp.yS, sp.xS0, sp.yS, ST.med);
  p.line('SV-H', [[sp.xD1, sp.yD], [372, sp.yD]], { seg: 0, at: 0.4 });
  p.off(372, sp.yD, 'right', 'SERVIZI / POTABILE', 'pid111', { w: 30 });
  // pompe alimento impianto demi
  const dp = p.pumps(318, 172, { n: 2, pitch: 30, tag: '0GHB10AP', sucLine: 'RW-RO', disLine: 'RW-RO', service: 'pompe alimento demi' });
  sh.line(sx + sw, dp.yS, dp.xS0, dp.yS, ST.med);
  p.line('RW-RO', [[dp.xD1, dp.yD], [372, dp.yD]], { seg: 0, at: 0.4 });
  p.off(372, dp.yD, 'right', 'IMPIANTO DEMI', 'pid206', { w: 30 });
  // pompe antincendio (prelievo dal fondo, sotto la riserva)
  const fp = p.pumps(128, 212, { n: 3, pitch: 30, tag: '0SGA10AP', sucLine: 'FF-P', disLine: 'FF-P', service: 'pompe antincendio', labels: ['elettrica', 'diesel', 'jockey'] });
  sh.path([[tx + tw / 2, ty + th], [tx + tw / 2, fp.yS], [fp.xS0, fp.yS]], ST.med);
  p.line('FF-P', [[fp.xD1, fp.yD], [206, fp.yD]], { seg: 0, at: 0.4 });
  for (let i = 0; i < 3; i++) p.refEq(`0SGA10AP00${i + 1}`);
  p.inst(199, fp.yD - 10, 'PT', { line: 'FF-P', to: [199, fp.yD], service: 'pressione anello antincendio (avvio pompe in cascata)' });
  // anello antincendio
  const rx0 = 206, rx1 = 252, ry0 = 196, ry1 = 228;
  p.line('FF-H', [[rx0, fp.yD], [rx0, ry0], [rx1, ry0], [rx1, ry1], [rx0, ry1], [rx0, ry0]], { seg: 2, at: 0.5, arrow: false });
  for (let i = 0; i < 2; i++) sym.hydrant(sh, rx0 + 14 + i * 18, ry0);
  sh.text(rx0 + 2, ry0 + 8, 'anello: idranti, diluvi', { size: 1.15 });
  sh.text(rx0 + 2, ry0 + 10.6, 'trasformatori, sprinkler', { size: 1.15 });
  return p.finish([
    `Pompe alimento pretrattamento 2×100 % da ${F(pt.pumpM3h, 0)} m³/h (20 m) dal serbatoio acqua grezza (${F(pt.rawTankM3, 0)} m³ con riserva antincendio sul fondo); reintegro torre derivato a monte del serbatoio.`,
    `Serbatoio acqua servizi ${F(pt.serviceTankM3, 0)} m³: pompe acqua servizi 2×100 % da ${F(pt.serviceM3h, 0)} m³/h (50 m) e pompe alimento demi 2×100 % da ${F(pt.demiFeedM3h, 0)} m³/h (20 m). Pompe antincendio UNI EN 12845 da ${F(pt.firePumpM3h, 0)} m³/h (elettrica, diesel, jockey).`,
  ]);
}

// ------------------------------------------------------------------ PID-206 acqua demineralizzata
export function pid206(M, reg, doc) {
  const p = new Pid(M, reg, doc, { title: 'Impianto di produzione e distribuzione acqua demineralizzata' });
  const sh = p.sh;
  const d = M.U.demi;
  const y = 70;
  p.off(16, y, 'right', 'DA POMPE ALIM. DEMI', 'pid205', { w: 26 });
  p.line('RW-RO', [[42, y], [50, y]], { label: false });
  sh.text(30, y + 6, M.lineById['RW-RO'].lineNo, { size: 1.15, anchor: 'middle' });
  // filtri multistrato
  parallelPair(p, 50, 86, y, 14, 'RW-RO', {
    service: 'filtro multistrato',
    draw: (yy) => { vvessel(sh, 62, yy - 7, 12, 14); sh.path([[62, yy + 1], [74, yy + 1]], ST.dash); },
  });
  p.refEq('0GCF10AT001'); p.refEq('0GCF10AT002');
  sh.text(68, y - 24, '0GCF10AT001/002', { size: 1.35, anchor: 'middle', bold: true });
  sh.text(68, y - 21.6, 'filtri multistrato', { size: 1.15, anchor: 'middle' });
  // filtro a cartucce e antincrostante
  sh.line(86, y, 110, y, ST.med);
  sym.filter(sh, 92, y - 4, 10, 8);
  sh.text(97, y + 8, 'cartucce 5 µm', { size: 1.1, anchor: 'middle' });
  p.inst(97, y - 13, 'PDT', { to: [97, y - 4], service: 'intasamento filtro a cartucce', sys: '0GCF10', range: '0 – 2', unit: 'bar' });
  sh.line(106, y, 106, y - 8, ST.thin); sh.text(107, y - 9, 'antincrostante', { size: 1.1 });
  // pompe AP
  const pp = p.pumps(136, 96, { n: 2, pitch: 30, tag: '0GCF20AP', sucLine: 'RW-RO', disLine: 'DM-RO', service: 'pompe alta pressione RO', strainer: false });
  sh.path([[110, y], [116, y], [116, pp.yS], [pp.xS0, pp.yS]], ST.med);
  // osmosi inversa
  p.line('DM-RO', [[pp.xD1, pp.yD], [184, pp.yD]], { seg: 0, at: 0.3, label: false });
  sym.roUnit(sh, 184, 58, 32, 24, 3);
  p.eqTag(200, 50, '0GCF30', 'osmosi inversa 2×100 %', { size: 1.6 });
  p.inst(176, 58, 'PT', { line: 'DM-RO', to: [180, pp.yD], service: 'pressione alimento RO' });
  // permeato -> EDI
  p.line('DM-P', [[216, 64], [240, 64]], { label: false });
  p.inst(228, 52, 'AT', { line: 'DM-P', to: [228, 64], service: 'conducibilità permeato RO', range: '0 – 50', unit: 'µS/cm' });
  sh.rect(240, 56, 22, 26, { s: '#000000', w: 0.45, f: W });
  for (let i = 1; i < 5; i++) sh.line(240 + i * 4.4, 57, 240 + i * 4.4, 81, ST.hair);
  p.eqTag(251, 50, '0GCF40', 'EDI', { size: 1.6 });
  // concentrati
  p.line('ROR', [[200, 82], [200, 210], [60, 210]], { seg: 1, at: 0.5 });
  sh.path([[251, 82], [251, 96], [200, 96]], ST.norm);
  p.dot(200, 96);
  p.valve(200, 150, { line: 'ROR', dir: 'v', ctl: true, fail: 'FO', service: 'regolazione recupero RO (concentrato)' });
  p.inst(186, 168, 'FT', { line: 'ROR', to: [200, 168], service: 'portata concentrato' });
  p.off(60, 210, 'left', 'ACQUE REFLUE', 'pid208', { w: 30 });
  // prodotto -> serbatoio
  p.line('DM-T', [[262, 70], [294, 70], [294, 52]], { seg: 0, at: 0.1, label: false });
  p.inst(278, 58, 'AT', { line: 'DM-T', to: [278, 70], service: 'conducibilità acqua demi prodotta', range: '0 – 1', unit: 'µS/cm' });
  const tx = 290, ty = 52, tw = 40, th = 54;
  sh.rect(tx, ty, tw, th, { s: '#000000', w: 0.5, f: W });
  sh.path([[tx, ty], [tx + tw / 2, ty - 5], [tx + tw, ty]], { s: '#000000', w: 0.5, f: W }, true);
  p.eqTag(tx + tw / 2, ty + 24, '0GHC10BB001', [`${F(d.tankM3, 0)} m³`, 'polmonato N₂'], { size: 1.5 });
  p.inst(tx + tw + 8, ty + 14, 'LT', { to: [tx + tw, ty + 14], service: 'livello serbatoio acqua demi', sys: '0GHC10' });
  p.inst(tx + tw + 8, ty + 24, 'LSL', { to: [tx + tw, ty + 24], service: 'livello basso serbatoio demi (protezione pompe)', sys: '0GHC10' });
  // pompe trasferimento e distribuzione
  const tp = p.pumps(300, 160, { n: 2, pitch: 28, tag: '0GHC10AP', sucLine: 'DM-H', disLine: 'DM-H', service: 'pompe trasferimento demi' });
  sh.path([[tx + 10, ty + th], [tx + 10, 120], [282, 120], [282, tp.yS], [tp.xS0, tp.yS]], ST.med);
  p.line('DM-H', [[tp.xD1, tp.yD], [356, tp.yD], [356, 192]], { seg: 0, at: 0.3 });
  const outs = [
    [M.water ? 'MUC' : 'MUC', 'REINTEGRO COND.', M.water ? 'pid108' : 'pid202'],
    ['DM-GTW', 'LAVAGGIO TG', 'pid101'],
    ['CC-MU', 'CICLO CHIUSO', 'pid203'],
  ];
  outs.forEach(([id, txt, tgt], i) => {
    const yy = 152 + i * 20;
    p.dot(356, yy);
    p.line(id, [[356, yy], [372, yy]], { label: false });
    p.off(372, yy, 'right', txt, tgt, { w: 30 });
    sh.text(373, yy + 6.5, M.lineById[id].lineNo, { size: 1.1 });
  });
  p.inst(344, tp.yD - 12, 'PT', { line: 'DM-H', to: [344, tp.yD], service: 'pressione collettore acqua demi' });
  return p.finish([
    `Produzione ${F(d.plantM3h, 0)} m³/h (2×100 %) per un consumo medio di ${F(d.demiM3h, 1)} m³/h; recupero RO ${Math.round(M.U.params.roRecovery * 100)} %, EDI ${Math.round(M.U.params.ediRecovery * 100)} %.`,
    'Qualità acqua demi: conducibilità < 0,1 µS/cm, SiO₂ < 10 ppb. Concentrati RO ed EDI alle acque reflue.',
  ]);
}

// ------------------------------------------------------------------ PID-207 dosaggi chimici e campionamento
export function pid207(M, reg, doc) {
  const p = new Pid(M, reg, doc, { title: 'Dosaggi chimici ciclo e campionamento (SWAS)' });
  const sh = p.sh;
  const ch = M.U.chem;
  const pl = ch.pumpsLh;
  const rows = [
    ['0QCA10', 'CH-NH3', 'ammoniaca', `${F(ch.ammonia, 2)} kg/h NH₃ · pompe ${F(pl.ammonia, 1)} l/h`, 'MANDATA POMPE CD', 'pid109'],
    ['0QCB10', 'CH-OS', 'deossigenante', `${F(ch.scavenger * 1000, 0)} g/h · pompe ${F(pl.scavenger, 1)} l/h`, 'MANDATA POMPE CD', 'pid109'],
    ['0QCC10', 'CH-PO4-1', 'fosfati HP', `${F(ch.phosphate * 1000, 0)} g/h Na₃PO₄ · pompe ${F(pl.phosphateHP, 1)} l/h`, 'CORPO HP', 'pid104'],
  ];
  if (has(M, 'CH-PO4IP-1')) rows.push(['0QCC20', 'CH-PO4IP-1', 'fosfati IP', `set dedicato · pompe ${F(pl.phosphateIP, 1)} l/h`, 'CORPO IP', 'pid105']);
  rows.forEach(([tag, id, nm, rate, txt, tgt], r) => {
    const y0 = 30 + r * 33;
    sh.rect(24, y0, 120, 32, ST.dash);
    p.refEq(tag);
    sh.text(25.5, y0 + 3.5, `${tag} DOSAGGIO ${nm.toUpperCase()} · ${rate}`, { size: 1.25, bold: true });
    vvessel(sh, 32, y0 + 6, 12, 22);
    sh.text(38, y0 + 31, 'serbatoio', { size: 1.05, anchor: 'middle' });
    p.inst(54, y0 + 10, 'LT', { to: [44, y0 + 12], service: `livello serbatoio ${nm}`, sys: tag });
    sh.path([[38, y0 + 28], [38, y0 + 30], [64, y0 + 30], [64, y0 + 14]], ST.norm);
    [y0 + 14, y0 + 26].forEach((yy, k) => {
      sh.line(64, yy, 76, yy, ST.norm);
      pumpSym(sh, 79, yy, { r: 2.6, out: 'right' });
      p.refEq(`${tag}AP00${k + 1}`);
      sh.line(81.6, yy, 92, yy, ST.norm);
      p.valve(88, yy, { line: id, kind: 'check', s: 1.4, service: `non ritorno pompa dosatrice ${k + 1} ${nm}`, showTag: false });
    });
    sh.path([[92, y0 + 14], [92, y0 + 26]], ST.norm);
    sh.text(80, y0 + 31, 'pompe dosatrici 2×100 %', { size: 1.05, anchor: 'middle' });
    p.line(id, [[92, y0 + 20], [372, y0 + 20]], { seg: 0, at: 0.6 });
    p.psv(104, y0 + 16, { line: id, service: `sicurezza mandata dosaggio ${nm}` });
    p.inst(118, y0 + 10, 'PI', { line: id, to: [118, y0 + 20], local: true, service: `mandata dosaggio ${nm}` });
    sym.gauge(sh, 132, y0 + 8, 8);
    sh.text(134, y0 + 12, 'colonna di taratura', { size: 1.0 });
    p.off(372, y0 + 20, 'right', txt, tgt, { w: 30 });
  });
  if (M.N > 1) sh.text(150, 163, `Fosfati: un set di pompe dosatrici per GVR (linee CH-PO4-1…${M.N}, CH-PO4IP-1…${M.N}).`, { size: 1.3 });
  // SWAS
  const px0 = 120, px1 = 330, py0 = 166, py1 = 234;
  sh.rect(px0, py0, px1 - px0, py1 - py0, ST.dash);
  p.refEq('0QUA10');
  sh.text(px0 + 2, py0 + 4, '0QUA10 PANNELLO DI CAMPIONAMENTO E ANALISI (SWAS)', { size: 1.4, bold: true });
  const samples = [
    ['SMP-CD', 'CONDENSATO', 'pid109', ['AT|conducibilità cationica', 'AT|ossigeno disciolto', 'AT|sodio']],
    ['SMP-FW', 'ACQUA ALIMENTO', 'pid110', ['AT|pH', 'AT|conducibilità specifica', 'AT|ossigeno disciolto']],
    ['SMP-HPD', 'ACQUA CORPO HP', 'pid104', ['AT|conducibilità specifica', 'AT|pH', 'AT|fosfati']],
    ['SMP-HPS', 'VAPORE HP', 'pid104', ['AT|conducibilità cationica', 'AT|silice', 'AT|sodio']],
  ];
  samples.forEach(([id, txt, tgt, an], i) => {
    const y = py0 + 12 + i * 16;
    p.off(px0 - 40, y, 'right', txt, tgt, { w: 30 });
    p.line(id, [[px0 - 10, y], [px0 + 60, y]], { label: false, arrow: false });
    sh.text(px0 + 1, y - 1.2, M.lineById[id].lineNo, { size: 1.05 });
    hxSmall(sh, px0 + 30, y);
    p.valve(px0 + 44, y, { line: id, kind: 'needle', service: `riduzione pressione campione ${txt.toLowerCase()}`, s: 1.4, showTag: false });
    sh.line(px0 + 60, y, px0 + 60 + (an.length - 1) * 22 + 6, y, ST.thin);
    an.forEach((s, k) => {
      const [fn, srv] = s.split('|');
      p.inst(px0 + 76 + k * 22, y - 6, fn, { line: id, to: [px0 + 66 + k * 22, y], service: `${srv} – ${txt.toLowerCase()}`, sys: '0QUA10' });
    });
  });
  sh.text(px0 + 22, py1 - 2, 'refrigeranti campioni (acqua ciclo chiuso)', { size: 1.1 });
  p.off(px1 + 32, py1 - 8, 'left', 'CICLO CHIUSO', 'pid203', { w: 30 });
  p.line('CC-0QUA10AC001', [[px1 + 2, py1 - 8], [px1 - 8, py1 - 8]], { label: false });
  return p.finish([
    `Trattamento a fosfati: ammoniaca (pH 9–10,5) e deossigenante (O₂ < 5 ppb) sul condensato; fosfato trisodico ai corpi HP e IP con due set di pompe dosatrici; serbatoi da ${F(ch.tankM3, 1)} m³. La scelta del trattamento (fosfati, AVT(R), AVT(O), OT) spetta al fornitore dell'isola di potenza.`,
    'Campioni raffreddati a 25 °C nel pannello SWAS; analizzatori in linea con allarmi in DCS.',
  ]);
}
function hxSmall(sh, x, y) {
  sh.circle(x, y, 3, { s: '#000000', w: 0.3, f: W });
  sh.path([[x - 2, y + 1.6], [x - 0.7, y - 1.6], [x + 0.7, y + 1.6], [x + 2, y - 1.6]], ST.thin);
}

// ------------------------------------------------------------------ PID-208 acque reflue
export function pid208(M, reg, doc) {
  const p = new Pid(M, reg, doc, { title: 'Raccolta e trattamento acque reflue' });
  const sh = p.sh;
  const w = M.U.ww;
  // vasca di neutralizzazione
  const nx = 140, ny = 60, nw = 64, nh = 50;
  sh.path([[nx, ny], [nx, ny + nh], [nx + nw, ny + nh], [nx + nw, ny]], { s: '#000000', w: 0.6 });
  sh.path([[nx, ny + 10], [nx + nw, ny + 10]], ST.dash);
  sym.mixer(sh, nx + nw / 2, ny - 6, 30);
  p.eqTag(nx + nw / 2, ny + nh + 6, '0GMA10BB001', `Vasca di neutralizzazione ${F(Math.ceil(w.totalM3h * 8 / 50) * 50, 0)} m³`, { size: 1.6 });
  p.inst(nx + nw + 9, ny + 18, 'LT', { to: [nx + nw, ny + 18], service: 'livello vasca di neutralizzazione', sys: '0GMA10' });
  p.inst(nx + nw + 9, ny + 28, 'AIC', { to: [nx + nw, ny + 28], service: 'pH vasca di neutralizzazione (dosaggio acido/soda)', sys: '0GMA10', range: '0 – 14', unit: 'pH' });
  sh.text(nx + 2, ny - 3, 'acido / soda', { size: 1.1 });
  sh.path([[nx + 8, ny - 2], [nx + 8, ny + 8]], ST.thin);
  // ingressi
  const ins = [];
  if (has(M, 'CTB')) ins.push(['CTB', 'SPURGO TORRE', 'pid202']);
  ins.push(['ROR', 'CONCENTRATI DEMI', 'pid206'], ['WW-BD', 'SPURGHI GVR', 'pid111']);
  ins.forEach(([id, txt, tgt], i) => {
    const y = ny + 4 + i * 6;
    p.off(16, 40 + i * 14, 'right', txt, tgt, { w: 34 });
    p.line(id, [[50, 40 + i * 14], [nx - 10 + i * 3, 40 + i * 14], [nx - 10 + i * 3, y + 10], [nx, y + 10]], { seg: 0, at: 0.3 });
  });
  // acque oleose
  p.off(16, 172, 'right', 'ACQUE OLEOSE', null, { w: 30, sub: 'bacini trafo, aree macchine' });
  p.line('OW-IN', [[46, 172], [80, 172]], { label: true, seg: 0, at: 0.05 });
  sh.rect(80, 162, 40, 20, { s: '#000000', w: 0.5, f: W });
  sh.path([[90, 162], [90, 176]], ST.norm); sh.path([[110, 168], [110, 182]], ST.norm);
  p.eqTag(100, 188, '0GMB10', 'disoleatore a coalescenza', { size: 1.6 });
  sh.path([[100, 162], [100, 154]], ST.thin); sh.text(101, 153, 'olio separato a fusti', { size: 1.1 });
  sh.path([[120, 172], [130, 172], [130, ny + nh - 6], [nx, ny + nh - 6]], ST.norm);
  // pompe di rilancio
  const pp = p.pumps(240, 128, { n: 2, pitch: 30, tag: '0GMA10AP', sucLine: 'WW-NEU', disLine: 'WW-NEU', service: 'pompe vasca neutralizzazione' });
  sh.path([[nx + nw - 6, ny + nh], [nx + nw - 6, pp.yS], [pp.xS0, pp.yS]], ST.med);
  p.line('WW-NEU', [[pp.xD1, pp.yD], [300, pp.yD], [300, ny + 6]], { seg: 0, at: 0.2 });
  // ricircolo fuori specifica
  p.dot(290, pp.yD);
  sh.path([[290, pp.yD], [290, 56], [nx + nw - 10, 56], [nx + nw - 10, ny + 4]], ST.norm);
  p.valve(290, 80, { line: 'WW-NEU', dir: 'v', act: 'pneu', fail: 'FO', service: 'ricircolo in vasca se fuori specifica', s: 1.8, tagSide: -1 });
  // vasca di controllo finale
  const fx = 296, fy = 60, fw = 50, fh = 50;
  sh.path([[fx, fy], [fx, fy + fh], [fx + fw, fy + fh], [fx + fw, fy]], { s: '#000000', w: 0.6 });
  p.eqTag(fx + fw / 2, fy + fh + 6, '0GMA20BB001', 'Vasca di controllo finale', { size: 1.6 });
  p.line('WW-OUT', [[fx + fw, fy + fh - 8], [372, fy + fh - 8]], { label: false });
  p.off(372, fy + fh - 8, 'right', 'SCARICO', null, { w: 26, sub: 'recettore autorizzato' });
  sh.text(fx + fw + 2, fy + fh - 11, M.lineById['WW-OUT'].lineNo, { size: 1.15 });
  [['AT', 'pH allo scarico', '0 – 14', 'pH'], ['AT', 'conducibilità allo scarico', '0 – 10000', 'µS/cm'], ['TT', 'temperatura allo scarico', '0 – 60', '°C'], ['FT', 'portata allo scarico', '0 – 200', 'm³/h']].forEach(([fn, srv, rg, un], i) => {
    p.inst(356 + i * 11 - 11, fy + fh + 6, fn, { line: 'WW-OUT', to: [356 + i * 11 - 11, fy + fh - 8], service: srv, range: rg, unit: un });
  });
  return p.finish([
    `Portata media alle acque reflue ${F(w.totalM3h, 1)} m³/h (spurgo torre, concentrati demi, spurghi GVR, acque oleose trattate). Scarico conforme al D.Lgs. 152/2006, Tab. 3 All. 5.`,
  ]);
}

// ------------------------------------------------------------------ PID-209 gas tecnici
export function pid209(M, reg, doc) {
  const p = new Pid(M, reg, doc, { title: 'Gas tecnici: azoto, idrogeno, anidride carbonica' });
  const sh = p.sh;
  const gs = M.U.gases;
  const rows = [
    ['0QJA10', 'N2-H', 'AZOTO', 48, `pacchi bombole N₂ · ${F(gs.n2Nm3d, 0)} Nm³/giorno`],
    ['0QJB10', 'H2-G', 'IDROGENO', 128, `rastrelliera H₂ · ${F(gs.h2Nm3d, 0)} Nm³/giorno`],
    ['0QJC10', 'CO2-G', 'CO₂', 188, `rastrelliera CO₂ · ${F(gs.co2PurgeKg, 0)} kg/spurgo`],
  ];
  rows.forEach(([tag, id, nm, y, desc]) => {
    sym.bottles(sh, 28, y - 12, 6);
    sym.bottles(sh, 28, y + 4, 6);
    p.eqTag(38, y - 18, tag, desc, { size: 1.6, anchor: 'start' });
    sh.path([[30, y - 3], [30, y - 1], [46, y - 1]], ST.thin); sh.path([[30, y + 13], [30, y + 15], [46, y + 15]], ST.thin);
    sh.path([[52, y - 1], [56, y - 1], [56, y + 15], [52, y + 15]], ST.norm);
    p.valve(49, y - 1, { line: id, kind: 'ball', service: `intercettazione pacco ${nm.toLowerCase()} A`, s: 1.5, showTag: false });
    p.valve(49, y + 15, { line: id, kind: 'ball', service: `intercettazione pacco ${nm.toLowerCase()} B`, s: 1.5, showTag: false });
    sh.line(56, y + 7, 70, y + 7, ST.norm);
    p.inst(64, y - 6, 'PT', { line: id, to: [64, y + 7], service: `alta pressione bombole ${nm.toLowerCase()}`, range: '0 – 250', unit: 'bar g' });
    p.valve(78, y + 7, { line: id, kind: 'globe', service: `riduttore di pressione ${nm.toLowerCase()} (PCV)` });
    sh.text(78, y + 13, 'PCV', { size: 1.2, anchor: 'middle', bold: true });
    p.line(id, [[70, y + 7], [100, y + 7]], { label: false, arrow: false });
    p.psv(92, y + 3, { line: id, service: `sicurezza a valle riduzione ${nm.toLowerCase()}` });
    p.inst(106, y - 6, 'PT', { line: id, to: [106, y + 7], service: `pressione collettore ${nm.toLowerCase()}` });
  });
  // azoto: collettore e utenze
  const yN = 55;
  p.line('N2-H', [[100, yN], [180, yN]], { seg: 0, at: 0.3 });
  sh.line(180, 40, 180, 104, ST.med);
  const nOuts = [['N2-FG', 'STAZIONE GAS / TG', 'pid201', 40], ['N2-HR', 'POLMONAZIONE GVR', 'pid104', 62], [null, 'SERBATOIO DEMI', 'pid206', 84], [null, 'VASO CICLO CHIUSO', 'pid203', 104]];
  nOuts.forEach(([id, txt, tgt, y]) => {
    if (id) p.line(id, [[180, y], [372, y]], { seg: 0, at: 0.4 }); else p.pipe([[180, y], [372, y]], { arrow: true });
    p.valve(200, y, { line: id || 'N2-H', kind: 'ball', service: `azoto a ${txt.toLowerCase()}`, s: 1.7 });
    p.off(372, y, 'right', txt, tgt, { w: 30 });
  });
  // idrogeno e CO2 ai generatori
  const yH = 135, yC = 195;
  p.line('H2-G', [[100, yH], [300, yH], [300, 160]], { seg: 0, at: 0.3 });
  p.line('CO2-G', [[100, yC], [300, yC], [300, 172]], { seg: 0, at: 0.3 });
  sh.rect(290, 160, 20, 12, { s: '#000000', w: 0.4, f: W });
  sh.text(300, 167.5, '3 vie', { size: 1.2, anchor: 'middle' });
  p.line('H2-G', [[310, 166], [372, 166]], { label: false });
  p.off(372, 166, 'right', 'GENERATORI', 'pid101', { w: 30 });
  sh.text(316, 162, 'H₂ in esercizio / CO₂ per spurgo', { size: 1.15 });
  p.valve(250, yH, { line: 'H2-G', act: 'sol', fail: 'FC', service: 'intercettazione idrogeno ai generatori' });
  p.inst(270, yH - 12, 'FQ', { line: 'H2-G', to: [270, yH], service: 'consumo idrogeno (reintegro)', range: '0 – 50', unit: 'Nm³/giorno' });
  p.valve(250, yC, { line: 'CO2-G', act: 'sol', fail: 'FC', service: 'intercettazione CO₂ ai generatori' });
  return p.finish([
    `Azoto per spurghi delle linee gas, polmonazione dei corpi cilindrici in fermata (${F(gs.n2LayupNm3, 0)} Nm³ per fermata) e dei serbatoi; idrogeno solo per generatori raffreddati a idrogeno.`,
    'Rastrelliere in area dedicata ventilata, con rivelazione gas e zona ATEX.',
  ]);
}

// ------------------------------------------------------------------ PID-210 caldaia e vapore ausiliario
export function pid210(M, reg, doc) {
  const p = new Pid(M, reg, doc, { title: 'Caldaia ausiliaria e collettore vapore ausiliario' });
  const sh = p.sh;
  const s = M.U.auxSteam;
  const bx = 60, by = 120, bw = 76, bh = 30;
  sym.boiler(sh, bx, by, bw, bh);
  p.eqTag(bx + bw / 2, by + bh + 6, '0QHA10', `Caldaia ausiliaria ${F(s.boilerCapacity * 3.6, 0)} t/h · ${s.p} bar · ${s.T} °C`, { size: 1.7 });
  sh.rect(bx + bw - 14, by - 34, 8, 34, { s: '#000000', w: 0.4, f: W });
  sh.text(bx + bw - 4, by - 30, 'camino', { size: 1.15 });
  p.inst(bx + 6, by - 8, 'BE', { to: [bx + 10, by + 6], service: 'rivelazione fiamma bruciatore caldaia', sys: '0QHA10', sis: true });
  p.inst(bx + bw + 9, by + 6, 'LT', { to: [bx + bw - 3, by + 8], service: 'livello caldaia ausiliaria', sys: '0QHA10' });
  p.inst(bx + bw + 9, by + 16, 'LSLL', { to: [bx + bw - 1, by + 18], service: 'livello bassissimo caldaia (blocco)', sys: '0QHA10', sis: true });
  // gas al bruciatore
  p.off(16, by + bh / 2, 'right', 'GAS', 'pid201', { w: 20 });
  p.line('NG-AB', [[36, by + bh / 2], [bx, by + bh / 2]], { label: false });
  p.valve(46, by + bh / 2, { line: 'NG-AB', ctl: true, fail: 'FC', service: 'regolazione gas bruciatore (BMS)', s: 1.8 });
  // vapore
  const yH = 70;
  p.line('AS-B', [[bx + 30, by], [bx + 30, yH], [190, yH]], { seg: 1, at: 0.5 });
  p.psv(bx + 44, by - 4, { line: 'AS-B', service: 'sicurezza caldaia ausiliaria', out: -1 });
  p.valve(bx + 30, 104, { line: 'AS-B', dir: 'v', kind: 'check', service: 'non ritorno vapore caldaia' });
  p.valve(bx + 30, 90, { line: 'AS-B', dir: 'v', act: 'mot', service: 'intercettazione vapore caldaia' });
  p.inst(bx + 16, 98, 'PIC', { line: 'AS-B', to: [bx + 30, 98], service: 'pressione vapore caldaia (carico bruciatore)' });
  // collettore
  sh.line(190, yH, 340, yH, ST.heavy);
  p.refEq('0QHB10');
  sh.text(192, yH - 3, '0QHB10 COLLETTORE VAPORE AUSILIARIO', { size: 1.4, bold: true });
  p.inst(250, yH - 14, 'PT', { line: 'AS-H', to: [250, yH], service: 'pressione collettore vapore ausiliario' });
  p.inst(260, yH - 14, 'TT', { line: 'AS-H', to: [260, yH], service: 'temperatura collettore vapore ausiliario' });
  p.off(402, 46, 'left', M.reheat ? 'DA RH FREDDO' : 'DA VAPORE HP', 'pid107', { w: 30 });
  p.line('AS-CRH', [[372, 46], [320, 46], [320, yH]], { seg: 0, at: 0.3 });
  p.ventDrain(334, yH, 'drain', { line: 'AS-H' });
  // utenze
  const outs = [['GS', 'TENUTE TV', 'pid108', 210], ['AS-H', M.water ? 'POLMONAZIONE CORPI' : 'EIETTORI ACC', M.water ? 'pid104' : 'pid202', 250], ['AS-H', 'RISC. AVVIAMENTO', null, 290]];
  outs.forEach(([id, txt, tgt, x], i) => {
    p.dot(x, yH);
    p.line(id, [[x, yH], [x, 112 + i * 18], [x + 8, 112 + i * 18]], { label: i < 2, seg: 0, at: 0.5 });
    p.valve(x, 92, { line: id, dir: 'v', act: 'mot', service: `vapore ausiliario a ${txt.toLowerCase()}`, s: 1.8 });
    p.off(x + 8, 112 + i * 18, 'right', txt, tgt, { w: 34 });
  });
  // alimento caldaia
  const pp = p.pumps(80, 200, { n: 2, pitch: 30, tag: '0QHA20AP', sucLine: 'ABF', disLine: 'ABF', service: 'pompe alimento caldaia ausiliaria' });
  p.off(30, pp.yS + 10, 'right', 'ACQUA DEMI', 'pid206', { w: 26 });
  sh.path([[56, pp.yS + 10], [62, pp.yS + 10], [62, pp.yS], [pp.xS0, pp.yS]], ST.med);
  p.line('ABF', [[pp.xD1, pp.yD], [130, pp.yD], [130, by + bh]], { seg: 1, at: 0.4 });
  p.valve(130, 164, { line: 'ABF', dir: 'v', ctl: true, fail: 'FO', service: 'regolazione livello caldaia ausiliaria' });
  return p.finish([
    `Caldaia ausiliaria per avviamenti a freddo (vapore tenute, polmonazione, riscaldamenti); in esercizio il collettore è alimentato dal ${M.reheat ? 'risurriscaldato freddo' : 'vapore HP'} tramite stazione di riduzione.`,
    `Consumo vapore tenute ${F(s.gland * 3.6, 1)} t/h; collettore a ${s.p} bar, ${s.T} °C.`,
  ]);
}

// ------------------------------------------------------------------ PID-211 gasolio di riserva
export function pid211(M, reg, doc) {
  const p = new Pid(M, reg, doc, { title: 'Scarico, stoccaggio e trasferimento gasolio' });
  const sh = p.sh;
  const o = M.U.diesel;
  // stazioni di scarico autobotti
  p.off(16, 109, 'right', 'AUTOBOTTI (2 BAIE)', null, { w: 30, sub: 'attacchi rapidi, messa a terra' });
  const up = p.pumps(72, 96, { n: 2, pitch: 30, tag: '0EGA10AP', sucLine: 'DO-U', disLine: 'DO-U', service: 'pompe scarico autobotti' });
  sh.line(46, up.yS, up.xS0, up.yS, ST.med);
  p.line('DO-U', [[up.xD1, up.yD], [136, up.yD], [136, 40], [178, 40], [178, 47]], { seg: 0, at: 0.4 });
  sym.meter(sh, 124, up.yD);
  p.inst(124, up.yD - 13, 'FQ', { line: 'DO-U', to: [124, up.yD - 2], service: 'misura fiscale gasolio scaricato', range: `0 – ${F(o.unloadM3h * 2.5, 0)}`, unit: 'm³/h' });
  // serbatoio di stoccaggio nel bacino di contenimento
  const tx = 150, ty = 52, tw = 56, th = 116;
  sh.rect(tx - 12, ty - 14, tw + 24, th + 22, ST.dash);
  sh.text(tx - 10, ty + th + 5.5, 'bacino di contenimento', { size: 1.1 });
  sh.rect(tx, ty, tw, th, { s: '#000000', w: 0.5, f: W });
  sh.path([[tx, ty], [tx + tw / 2, ty - 6], [tx + tw, ty]], { s: '#000000', w: 0.5, f: W }, true);
  p.refEq('0EGB10BB001');
  sh.text(tx + tw / 2, ty + 18, '0EGB10BB001', { size: 1.6, anchor: 'middle', bold: true });
  sh.text(tx + tw / 2, ty + 21, `serbatoio gasolio ${F(o.tankM3, 0)} m³`, { size: 1.2, anchor: 'middle' });
  sh.text(tx + tw / 2, ty + 23.4, `${o.hours} h a pieno carico`, { size: 1.15, anchor: 'middle' });
  p.inst(tx - 7, ty + 30, 'LT', { to: [tx, ty + 30], service: 'livello serbatoio gasolio', sys: '0EGB10' });
  p.inst(tx - 7, ty + 12, 'LSHH', { to: [tx, ty + 12], service: 'altissimo livello serbatoio gasolio (blocco pompe scarico)', sys: '0EGB10' });
  p.inst(tx - 7, ty + 100, 'LSL', { to: [tx, ty + 100], service: 'basso livello serbatoio gasolio (blocco pompe trasferimento)', sys: '0EGB10' });
  p.inst(tx + tw / 2, ty - 16, 'TT', { to: [tx + tw / 2, ty - 6], service: 'temperatura gasolio nel serbatoio', sys: '0EGB10' });
  // pompe trasferimento ausiliarie (caldaia ausiliaria, serbatoi giornalieri diesel di emergenza e antincendio)
  const ap = p.pumps(272, 112, { n: 2, pitch: 30, tag: '0EGD10AP', sucLine: 'DO-A', disLine: 'DO-A', service: 'pompe trasferimento ausiliarie' });
  sh.line(tx + tw, ap.yS, ap.xS0, ap.yS, ST.med);
  p.line('DO-A', [[ap.xD1, ap.yD], [372, ap.yD]], { seg: 0, at: 0.5 });
  p.off(372, ap.yD, 'right', 'UTENZE AUSILIARIE', 'pid210', { w: 30, sub: 'caldaia aux, diesel emergenza' });
  // filtro duplex e pompe trasferimento al TG
  sh.path([[tx + tw / 2, ty + th], [tx + tw / 2, 186], [226, 186]], ST.med);
  sym.filter(sh, 226, 182, 10, 8);
  sym.filter(sh, 238, 182, 10, 8);
  p.refEq('0EGC10AT001');
  sh.text(237, 196, '0EGC10AT001 filtro duplex 10 µm', { size: 1.25, anchor: 'middle', bold: true });
  p.inst(237, 172, 'PDT', { to: [237, 182], service: 'intasamento filtro duplex gasolio', sys: '0EGC10', range: '0 – 1', unit: 'bar' });
  const tp = p.pumps(272, 173, { n: 2, pitch: 30, tag: '0EGC10AP', sucLine: 'DO-T', disLine: 'DO-T', service: 'pompe trasferimento gasolio al TG' });
  sh.path([[248, 186], [tp.xS0, 186]], ST.med);
  p.line('DO-T', [[tp.xD1, tp.yD], [372, tp.yD]], { seg: 0, at: 0.5 });
  p.off(372, tp.yD, 'right', 'MODULO GASOLIO TG', 'pid102', { w: 30 });
  p.inst(330, tp.yD - 10, 'PIC', { line: 'DO-T', to: [330, tp.yD], service: 'pressione mandata gasolio al TG (ricircolo al serbatoio)' });
  p.dot(345, tp.yD);
  sh.path([[345, tp.yD], [345, tp.yD - 18], [tx + tw + 6, tp.yD - 18], [tx + tw + 6, ty + 14], [tx + tw, ty + 14]], ST.norm);
  sh.text(300, tp.yD - 19.5, 'ricircolo al serbatoio', { size: 1.1 });
  return p.finish([
    `Gasolio di riserva: ${F(o.m3h, 0)} m³/h a pieno carico (PCI ${F(o.lhv, 1)} MJ/kg); serbatoio da ${F(o.tankM3, 0)} m³ per ${o.hours} h di autonomia (24–48 h tipiche per il solo back-up).`,
    `Pompe di scarico autobotti 2 × ${F(o.unloadM3h, 0)} m³/h con misura fiscale; pompe di trasferimento al TG 2×100 % da ${F(o.transferM3h, 0)} m³/h a bassa prevalenza (la spinta finale ai bruciatori è nella fornitura del TG); pompe ausiliarie 2×100 % da ${F(o.auxM3h, 0)} m³/h.`,
  ]);
}
