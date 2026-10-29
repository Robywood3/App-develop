// P&ID di processo: turbogas (aria, gas combustibile, olio), GVR per livello di
// pressione, vapore principale e bypass, turbina a vapore, condensato, alimento,
// spurghi e drenaggi. Ogni foglio registra valvole, strumenti e linee nel registro.

import { Pid, sym, ST, W, F, hx, strainer, orifice, vvessel, drum } from './pidkit.js';
import { pump as pumpSym } from './symbols.js';

const banksNamed = (M, name) => M.r.bt.banks.filter((b) => b.name === name);

// ------------------------------------------------------------------ PID-101
export function pid101(M, reg, doc) {
  const p = new Pid(M, reg, doc, { title: 'Turbogas – aspirazione aria, lavaggio compressore e scarico', typical: true });
  const sh = p.sh;
  const gt = M.r.gt;
  const g0 = M.electrical.gens[0];
  // casa filtri
  const fx0 = 30, fy0 = 40, fx1 = 120, fy1 = 82;
  sh.rect(fx0, fy0, fx1 - fx0, fy1 - fy0, { s: '#000000', w: 0.5, f: W });
  for (let i = 0; i < 5; i++) sh.path([[fx0 - 5, fy0 + 3 + i * 8], [fx0, fy0 + 7 + i * 8]], ST.norm);
  sh.text(fx0 - 6, fy1 + 4, 'cappe antipioggia', { size: 1.3 });
  [['G4', 48], ['F9', 70], ['E12', 92]].forEach(([lab, x]) => {
    sh.path([[x, fy0 + 3], [x + 3, fy0 + 9], [x, fy0 + 15], [x + 3, fy0 + 21], [x, fy0 + 27], [x + 3, fy0 + 33], [x, fy0 + 39]], ST.norm);
    sh.text(x + 1.5, fy1 - 1.5, lab, { size: 1.4, anchor: 'middle', bold: true });
    p.inst(x + 1.5, fy0 - 9, 'PDT', { to: [x + 1.5, fy0], service: `perdita di carico stadio ${lab}`, sys: '1MBL10', range: '0 – 10', unit: 'mbar' });
  });
  p.eqTag(fx0, fy1 + 10, '1MBL10', 'Casa filtri aria aspirazione', { anchor: 'start', size: 1.8 });
  // condotto con silenziatore e plenum
  sh.rect(96, fy1, 22, 24, { s: '#000000', w: 0.45, f: W });
  for (let i = 1; i < 6; i++) sh.line(96, fy1 + i * 4, 118, fy1 + i * 4, ST.hair);
  sh.text(95, fy1 + 20, 'silenziatore', { size: 1.3, anchor: 'end' });
  const ya = 132;
  sh.rect(88, 106, 38, 52, { s: '#000000', w: 0.45, f: W });
  sh.text(107, 155, 'plenum', { size: 1.3, anchor: 'middle' });
  // collettore riscaldamento aria aspirata nel condotto
  sh.path([[98, fy1 + 6], [116, fy1 + 6]], ST.dash);
  for (let i = 0; i < 5; i++) sh.circle(100 + i * 4, fy1 + 6, 0.6, ST.black);
  p.inst(80, 118, 'TT', { to: [88, 118], service: 'temperatura aria ingresso compressore', sys: '1MBL20', range: '-30 – 60', unit: '°C' });
  p.inst(80, 128, 'MT', { to: [88, 128], service: 'umidità aria aspirata', sys: '1MBL20', range: '0 – 100', unit: '%' });
  p.inst(80, 138, 'PDT', { to: [88, 138], service: 'perdita di carico totale aspirazione', sys: '1MBL20', range: '0 – 25', unit: 'mbar' });
  // generatore
  sh.circle(54, ya, 11, { s: '#000000', w: 0.5, f: W });
  sh.text(54, ya + 1.4, 'G', { size: 4, anchor: 'middle', bold: true });
  p.eqTag(41, 122, '1MKA10', [`${g0.MVA} MVA · ${String(g0.kV).replace('.', ',')} kV`, `raffr. ${g0.cooling}`], { anchor: 'end', size: 1.8 });
  sh.line(65, ya, 130, ya, ST.heavy);
  // compressore, combustori, turbina
  sh.path([[126, 106], [172, 118], [172, 146], [126, 158]], { s: '#000000', w: 0.5, f: W }, true);
  sh.text(149, ya + 1, 'C', { size: 3.4, anchor: 'middle', bold: true });
  sh.rect(176, 84, 22, 16, { s: '#000000', w: 0.5, f: W });
  sh.text(187, 93, 'COMB.', { size: 1.5, anchor: 'middle', bold: true });
  sh.line(172, 120, 178, 100, ST.med).line(196, 100, 202, 120, ST.med);
  sh.path([[202, 118], [248, 106], [248, 158], [202, 146]], { s: '#000000', w: 0.5, f: W }, true);
  sh.text(225, ya + 1, 'T', { size: 3.4, anchor: 'middle', bold: true });
  sh.line(172, ya, 202, ya, ST.heavy);
  p.eqTag(232, 80, '1MBA10', [`Turbina a gas ${M.gtClass}`, `ISO ${F(M.des.gtRef.Piso, 1)} MW · β ${F(M.cfg.gt.PR, 1)} · TIT ${M.cfg.gt.TIT} °C`], { size: 1.9 });
  // IGV
  p.inst(156, 106, 'ZT', { to: [150, 111], service: 'posizione IGV', sys: '1MBA10', range: '0 – 100', unit: '%' });
  // gas ai combustori
  p.off(176 - 34, 46, 'right', 'GAS COMBUSTIBILE', 'pid102', { w: 34 });
  p.line('FG-1', [[176, 46], [187, 46], [187, 84]], { seg: 1, at: 0.4 });
  p.inst(205, 90, 'BE', { to: [198, 90], service: 'rivelazione fiamma (2oo4)', sys: '1MBA10', sis: true, range: 'on/off', unit: '' });
  // mandata compressore: pressione e temperatura
  p.inst(160, 168, 'PT', { to: [166, 148], service: 'pressione mandata compressore (CDP, 2oo3)', sys: '1MBA10', sis: true, range: `0 – ${F(Math.ceil(gt.p2 * 1.3), 0)}`, unit: 'bar g' });
  p.inst(176, 166, 'TT', { to: [170, 146], service: 'temperatura mandata compressore', sys: '1MBA10', range: '0 – 600', unit: '°C' });
  // riscaldamento aria aspirata (IBH)
  p.line('IBH-1', [[164, 117], [164, 96], [118, 96], [118, fy1 + 6]], { seg: 0, at: 0.3 });
  p.ctrlStation(142, 96, { line: 'IBH-1', fn: '', service: 'riscaldamento aria aspirata', bypass: false });
  p.inst(142, 82, 'TIC', { line: 'IBH-1', to: [142, 90], service: 'regolazione riscaldamento aria (anti-ghiaccio)', sys: '1MBL20', range: '-30 – 60', unit: '°C' });
  // velocità, vibrazioni
  p.inst(78, 152, 'ST', { to: [78, ya], service: 'velocità rotore (2oo3)', sys: '1MBA10', sis: true });
  p.inst(96, 166, 'VT', { to: [96, ya], service: 'vibrazioni cuscinetto lato compressore', sys: '1MBA10' });
  p.inst(236, 168, 'VT', { to: [236, 158], service: 'vibrazioni cuscinetto lato turbina', sys: '1MBA10' });
  // scarico
  sh.path([[248, 106], [282, 98], [282, 166], [248, 158]], { s: '#000000', w: 0.5, f: W }, true);
  sh.text(265, ya + 1, 'diffusore', { size: 1.4, anchor: 'middle' });
  sh.path([[284, 98], [286, 102], [284, 106], [286, 110], [284, 114]], ST.thin);
  sh.text(286, 96, 'giunto', { size: 1.2 });
  p.inst(268, 84, 'TT', { to: [268, 100], service: 'temperatura scarico (27 termocoppie, media e dispersione)', sys: '1MBR10', range: '0 – 800', unit: '°C' });
  sh.text(273, 78, '× 27 TE', { size: 1.3 });
  p.inst(294, 174, 'PT', { to: [281, 164], service: 'contropressione allo scarico', sys: '1MBR10', range: '0 – 80', unit: 'mbar' });
  p.off(288, ya, 'right', 'FUMI AL GVR', 'pid104', { w: 34 });
  sh.text(290, ya + 8, `${F(gt.mExh, 0)} kg/s · ${F(gt.T4, 1)} °C`, { size: 1.4 });
  // cabinato e ventilazione
  sh.rect(122, 72, 132, 104, ST.dash);
  sh.text(124, 70, '1MBM10 CABINATO ACUSTICO', { size: 1.4, bold: true });
  for (let i = 0; i < 2; i++) {
    const x = 226 + i * 12;
    sh.circle(x, 62, 3.6, { s: '#000000', w: 0.35, f: W });
    sh.line(x - 3, 62, x + 3, 62, ST.thin).line(x, 59, x, 65, ST.thin);
    sh.line(x, 65.6, x, 72, ST.norm);
    p.refEq(`1MBM10AN00${i + 1}`);
  }
  sh.text(222, 55.5, '1MBM10AN001/002 ventilatori', { size: 1.3, bold: true });
  p.inst(208, 62, 'TSH', { to: [214, 72], service: 'temperatura cabinato alta', sys: '1MBM10' });
  p.inst(196, 62, 'AT', { to: [200, 72], service: 'rivelazione gas nel cabinato (2oo3)', sys: '1MBM10', sis: true, range: '0 – 100', unit: '% LIE' });
  // lavaggio compressore
  const wx = 30, wy = 190;
  sh.rect(wx, wy, 56, 34, ST.dash);
  sh.text(wx + 1.5, wy + 3.5, '1MBU10 SKID LAVAGGIO COMPRESSORE', { size: 1.35, bold: true });
  vvessel(sh, wx + 6, wy + 8, 12, 22);
  sh.text(wx + 12, wy + 33, 'serbatoio', { size: 1.2, anchor: 'middle' });
  pumpSym(sh, wx + 34, wy + 24, { r: 3.4 });
  sh.line(wx + 18, wy + 24, wx + 30.6, wy + 24, ST.norm);
  p.refEq('1MBU10AP001');
  sh.text(wx + 40, wy + 31, 'AP001', { size: 1.3, bold: true });
  p.off(16, wy - 8, 'right', 'ACQUA DEMI', 'pid206', { w: 22 });
  p.line('CWW-1', [[38, wy - 8], [wx + 12, wy - 8], [wx + 12, wy + 8]], { label: false });
  sh.text(wx + 14, wy - 1, M.lineById['CWW-1'].lineNo, { size: 1.2 });
  sh.path([[wx + 37.4, wy + 20.6], [wx + 37.4, wy + 14], [100, wy + 14]], ST.norm);
  sh.line(100, wy + 14, 100, 158, ST.norm);
  p.valve(100, wy + 6, { dir: 'v', act: 'pneu', kind: 'ball', sys: '1MBU10', service: 'lavaggio in linea', fail: 'FC', s: 1.8 });
  sh.line(100, wy + 14, 140, wy + 14, ST.norm);
  sh.line(140, wy + 14, 140, 154, ST.norm);
  p.valve(140, wy + 6, { dir: 'v', act: 'pneu', kind: 'ball', sys: '1MBU10', service: 'lavaggio a macchina ferma', fail: 'FC', s: 1.8 });
  sh.text(102, wy + 18, 'ugelli in linea', { size: 1.2 });
  sh.text(142, wy + 18, 'ugelli fuori linea', { size: 1.2 });
  // olio di lubrificazione
  p.off(300, 186, 'left', 'OLIO LUBRIF.', 'pid103', { w: 28 });
  p.line('LOS-1', [[272, 186], [60, 186], [60, 143]], { seg: 0, at: 0.3 });
  sh.line(149, 186, 149, 160, ST.norm).line(232, 186, 232, 160, ST.norm);
  p.off(300, 232, 'right', 'RITORNO OLIO', 'pid103', { w: 28 });
  p.line('LOR-1', [[118, 158], [118, 232], [300, 232]], { seg: 1, at: 0.6 });
  // raffreddamento generatore
  if (g0.cooling === 'idrogeno') {
    p.off(18, 140, 'right', 'IDROGENO', 'pid209', { w: 22 });
    p.line('H2-G', [[40, 140], [46.5, 140]], { label: false, arrow: false });
    p.inst(30, 152, 'AT', { to: [42, 141], service: 'purezza idrogeno generatore', sys: '1MKA10', range: '80 – 100', unit: '% H₂' });
  }
  p.off(24, 108, 'right', 'CICLO CHIUSO', 'pid203', { w: 24 });
  p.line('CC-1MKA10AC001', [[48, 108], [54, 108], [54, 121]], { label: false });
  sh.rect(46, 104, 16, 7, { s: '#000000', w: 0.3, f: W });
  sh.text(54, 102.5, 'refrigeranti generatore', { size: 1.2, anchor: 'middle' });
  return p.finish([
    `Portata aria ISO ${F(M.des.gtRef.point.mAir, 0)} kg/s; perdita di carico aspirazione di progetto ${M.cfg.gt.dpInlet} mbar. Il riscaldamento dell'aria aspirata preleva il ${2} % circa dell'aria di mandata compressore.`,
    'Protezioni SIS del TG (velocità, fiamma, pressione mandata, gas nel cabinato) secondo IEC 61511; logiche 2oo3 dove indicato.',
  ]);
}

// ------------------------------------------------------------------ PID-102
export function pid102(M, reg, doc) {
  const p = new Pid(M, reg, doc, { title: 'Turbogas – sistema gas combustibile', typical: true });
  const sh = p.sh;
  const y = 84;
  p.off(52 - 32, y, 'right', 'GAS DA STAZIONE', 'pid201', { w: 32 });
  p.line('FG-1', [[52, y], [110, y]], { label: false });
  p.line('FG-1', [[144, y], [184, y]], { at: 0.45 });
  sh.line(212, y, 228, y, ST.med);
  sh.line(58, y - 3, 58, y + 3, ST.med).line(59.5, y - 3, 59.5, y + 3, ST.med);
  sh.text(59, y + 6.5, 'giunto isolante', { size: 1.2, anchor: 'middle' });
  p.valve(66, y, { line: 'FG-1', kind: 'ball', service: 'intercettazione ingresso TG' });
  const xv = p.valve(78, y, { line: 'FG-1', kind: 'ball', act: 'pneu', fail: 'FC', service: 'blocco gas di emergenza (ESD)' });
  p.inst(74, y - 18, 'ZSO', { to: [78, y - 6], service: `fine corsa aperto ${xv}`, sys: '1EKG10' });
  p.inst(84, y - 18, 'ZSC', { to: [78, y - 6], service: `fine corsa chiuso ${xv}`, sys: '1EKG10' });
  p.inst(94, y - 12, 'PT', { line: 'FG-1', to: [94, y], service: 'pressione gas ingresso TG' });
  p.inst(102, y - 12, 'TT', { line: 'FG-1', to: [102, y], service: 'temperatura gas ingresso TG' });
  // filtri finali in parallelo
  const fxa = 118, fxb = 140;
  sh.path([[110, y], [110, y - 16], [fxa - 4, y - 16]], ST.med).path([[110, y], [110, y + 16], [fxa - 4, y + 16]], ST.med);
  for (const yy of [y - 16, y + 16]) {
    p.valve(114, yy, { line: 'FG-1', kind: 'ball', service: 'intercettazione filtro gas', s: 1.8 });
    sh.rect(fxa, yy - 6, 14, 12, { s: '#000000', w: 0.4, f: W });
    sh.line(fxa, yy - 6, fxa + 14, yy + 6, ST.thin);
    p.valve(fxb - 2, yy, { line: 'FG-1', kind: 'ball', service: 'intercettazione filtro gas', s: 1.8 });
    sh.line(fxa - 4, yy, fxa, yy, ST.med).line(fxa + 14, yy, fxb - 4.3, yy, ST.med);
  }
  sh.path([[fxb + 0.3, y - 16], [fxb + 4, y - 16], [fxb + 4, y + 16], [fxb + 0.3, y + 16]], ST.med);
  p.refEq('1EKG10AT001'); p.refEq('1EKG10AT002');
  sh.text(fxa + 7, y - 24, '1EKG10AT001/002 filtri finali', { size: 1.4, anchor: 'middle', bold: true });
  p.inst(fxa + 7, y + 30, 'PDT', { to: [fxa + 7, y + 22], service: 'intasamento filtri finali gas', sys: '1EKG10', range: '0 – 1000', unit: 'mbar' });
  // misura portata Coriolis e gascromatografo
  sym.meter(sh, 156, y);
  p.inst(156, y - 14, 'FT', { line: 'FG-1', to: [156, y - 2], service: 'portata gas al TG (Coriolis)' });
  p.inst(166, y - 22, 'FQ', { line: 'FG-1', to: [158, y - 16], service: 'portata gas totalizzata al TG' });
  p.inst(170, y + 14, 'AT', { line: 'FG-1', to: [170, y], service: 'indice di Wobbe e PCS (gascromatografo)', range: '45 – 55', unit: 'MJ/Sm³' });
  // riscaldatore di prestazione
  const hx0 = 184, hx1 = 212;
  sym.shellTube(sh, hx0, y - 6, hx1 - hx0, 12);
  p.eqTag((hx0 + hx1) / 2, y - 12, '1EKG10AC001', 'Riscaldatore gas', { size: 1.7 });
  p.off(120, 132, 'right', 'ACQUA ECO IP', M.reheat ? 'pid105' : 'pid104', { w: 26 });
  p.line('FGH-1', [[146, 132], [188, 132], [188, y + 6]], { seg: 0, at: 0.08, label: false });
  p.ctrlStation(166, 132, { line: 'FGH-1', fn: '', service: 'acqua al riscaldatore gas', bypass: false });
  p.inst(220, y - 16, 'TIC', { line: 'FG-1', to: [220, y], service: 'regolazione temperatura gas al TG' });
  p.signal([[216.8, y - 16], [166, y - 16], [166, 125]]);
  sh.path([[208, y + 6], [208, 146], [230, 146]], ST.norm);
  p.off(230, 146, 'right', 'RITORNO', 'pid108', { w: 22, sub: 'al condensatore' });
  sh.text(148, 129, M.lineById['FGH-1'].lineNo, { size: 1.3 });
  p.psv(200, y + 16, { line: 'FGH-1', service: 'protezione rottura tubi riscaldatore', out: 1 });
  sh.line(200, y + 20, 200, y + 6, ST.norm);
  // skid valvole gas
  const sx0 = 228, sx1 = 400;
  sh.rect(sx0, 40, sx1 - sx0, 136, ST.dash);
  sh.text(sx0 + 2, 44, '1MBP10 SKID VALVOLE GAS (fornitura TG)', { size: 1.5, bold: true });
  p.refEq('1MBP10');
  p.valve(240, y, { line: 'FG-1', kind: 'ball', act: 'hyd', fail: 'FC', service: 'valvola di arresto/rapporto (SRV)', tag: '1MBP10AA001' });
  p.inst(250, y + 14, 'PT', { line: 'FG-1', to: [250, y], service: 'pressione interstadio P2 (2oo3)', sis: true });
  sh.line(228, y, 270, y, ST.med);
  // sfiato tra SRV e GCV
  sh.line(258, y, 258, y - 22, ST.norm);
  p.valve(258, y - 12, { line: 'NG-V', kind: 'ball', dir: 'v', act: 'sol', fail: 'FO', service: 'sfiato interstadio', tag: '1MBP10AA002' });
  p.off(250, 30, 'right', 'SFIATO', 'pid201', { w: 20 });
  sh.path([[258, y - 22], [258, 36], [270, 36], [270, 30]], ST.norm);
  // spurgo azoto
  p.off(256 - 20, 168, 'right', 'AZOTO', 'pid209', { w: 20 });
  p.line('N2-FG', [[256, 168], [278, 168], [278, y + 34]], { label: false, seg: 1 });
  p.valve(278, y + 52, { line: 'N2-FG', kind: 'ball', dir: 'v', service: 'spurgo azoto', s: 1.6 });
  p.valve(278, y + 44, { line: 'N2-FG', kind: 'ball', dir: 'v', act: 'sol', fail: 'FC', service: 'spurgo azoto', s: 1.6 });
  sh.text(281, y + 60, M.lineById['N2-FG'].lineNo, { size: 1.2 });
  // stadi DLN
  const stages = [['PM1', y - 26], ['PM2', y - 10], ['PM3', y + 6], ['QUAT', y + 22], ['D5 pilota', y + 34]];
  sh.line(270, stages[0][1], 270, stages[stages.length - 1][1], ST.med);
  sh.line(278, y + 34, 270, y + 34, ST.norm);
  stages.forEach(([nm, yy], i) => {
    sh.line(270, yy, 360, yy, ST.med);
    p.valve(298, yy, { line: 'FG-1', ctl: true, service: `regolazione gas stadio ${nm} (GCV)`, tag: `1MBP10AA${String(10 + i).padStart(3, '0')}`, s: 2.1 });
    p.inst(322, yy - 5.5, 'PT', { line: 'FG-1', to: [322, yy], service: `pressione collettore ${nm}` });
    sh.text(334, yy - 1.2, nm, { size: 1.4, bold: true });
  });
  // combustori
  sh.rect(360, 50, 32, 100, { s: '#000000', w: 0.5, f: W });
  for (let i = 0; i < 6; i++) sh.rect(366, 56 + i * 15, 20, 10, { s: '#000000', w: 0.3, f: W });
  sh.text(376, 155, 'COMBUSTORI DLN', { size: 1.5, anchor: 'middle', bold: true });
  sh.text(376, 158.5, '1MBA10', { size: 1.4, anchor: 'middle' });
  p.refEq('1MBA10');
  p.inst(390, 168, 'BE', { to: [386, 150], service: 'rivelatori di fiamma', sys: '1MBA10', sis: true });
  p.inst(392, 32, 'TT', { to: [376, 50], service: 'temperatura metallo combustori', sys: '1MBA10', range: '0 – 900', unit: '°C' });
  return p.finish([
    `Pressione di alimentazione gas ${F(M.pFG, 1)} bar(a); temperatura dopo riscaldo ${M.cfg.gt.Tfuel} °C regolata con acqua prelevata dall'economizzatore. Portata gas per TG ${F(M.r.gt.mFuel * 3.6, 1)} t/h.`,
    'Valvola di arresto/rapporto (SRV) e valvole di regolazione per stadio (GCV) a comando oleodinamico, fornitura del costruttore TG; doppia intercettazione con sfiato (block and bleed) tra SRV e GCV.',
  ]);
}

// ------------------------------------------------------------------ PID-103 / PID-112
export function pidLubeOil(M, reg, doc, { machine = 'TG', unit = 1 } = {}) {
  const isGT = machine === 'TG';
  const p = new Pid(M, reg, doc, { title: `${isGT ? 'Turbogas' : 'Turbina a vapore'} – olio di lubrificazione e sollevamento`, typical: isGT });
  const sh = p.sh;
  const sfx = isGT ? `${unit}` : 'ST';
  const sys = isGT ? 'MBV' : 'MAV';
  const u = isGT ? unit : 0;
  const LOS = `LOS-${sfx}`, LOR = `LOR-${sfx}`, JO = `JO-${sfx}`;
  const ccLine = `CC-${u}${sys}10AC001`;
  const qOil = (M.lineById[LOS].m * 3.6) / 0.87; // m³/h
  const s10 = `${u}${sys}10`;
  // serbatoio olio
  const tx0 = 40, tx1 = 160, ty0 = 150, ty1 = 200;
  sh.rect(tx0, ty0, tx1 - tx0, ty1 - ty0, { s: '#000000', w: 0.55, f: W });
  p.eqTag(100, ty1 + 6, `${u}${sys}10BB001`, `Serbatoio olio ${F(Math.max(4, (qOil * 8) / 60), 0)} m³ (permanenza 8 min)`);
  sh.path([[tx0 + 6, ty1 - 6], [tx0 + 10, ty1 - 10], [tx0 + 14, ty1 - 6], [tx0 + 18, ty1 - 10], [tx0 + 22, ty1 - 6]], ST.norm);
  sh.text(tx0 + 14, ty1 - 2, 'riscaldatore elettrico', { size: 1.2, anchor: 'middle' });
  p.inst(29, 186, 'TIC', { to: [tx0, 186], service: 'temperatura olio serbatoio / riscaldatore', sys: s10, range: '0 – 100', unit: '°C' });
  sym.gauge(sh, tx0 - 3, ty0 + 4, 12);
  sh.text(tx0 - 5, ty0 + 10, 'LG', { size: 1.2, anchor: 'end' });
  p.inst(tx1 + 9, ty0 + 8, 'LT', { to: [tx1, ty0 + 8], service: 'livello serbatoio olio', sys: s10 });
  p.inst(tx1 + 9, ty0 + 18, 'LSLL', { to: [tx1, ty0 + 18], service: 'livello bassissimo serbatoio olio', sys: s10, sis: true });
  // estrattori vapori
  for (let i = 0; i < 2; i++) {
    const x = 148 + i * 8;
    sh.line(x, ty0, x, ty0 - 9, ST.norm);
    sh.circle(x, ty0 - 12, 3, { s: '#000000', w: 0.3, f: W });
    sh.line(x - 2.4, ty0 - 12, x + 2.4, ty0 - 12, ST.thin);
    p.refEq(`${u}${sys}30AN00${i + 1}`);
  }
  sh.text(162, ty0 - 16, `${u}${sys}30AN001/002 estrattori vapori`, { size: 1.3, bold: true });
  // pompe: DC di emergenza e principali AC 2×100 %
  const yh = 96, yP = 128;
  const pumpsX = [56, 92, 128];
  const labels = ['DC emergenza', 'AC A', 'AC B'];
  pumpsX.forEach((x, i) => {
    const tag = `${u}${sys}10AP00${i + 1}`;
    p.refEq(tag);
    sh.line(x, ty0 + 30, x, yP + 5.4, ST.norm);
    pumpSym(sh, x, yP, { r: 3.6 });
    sh.circle(x, yP - 11, 2, { s: '#000000', w: 0.3, f: W });
    sh.textMid(x, yP - 11, i === 0 ? 'DC' : 'M', { size: 1.2, anchor: 'middle', bold: true });
    sh.line(x, yP - 9, x, yP - 3.6, ST.thin);
    sh.line(x + 3.6, yP - 3.6, x + 3.6, i === 0 ? 40 : yh, ST.med);
    p.valve(x + 3.6, 108, { line: LOS, kind: 'check', dir: 'v', s: 1.7, service: `ritegno pompa ${tag}`, showTag: false });
    sh.text(x - 5, yP + 8, tag.slice(-5), { size: 1.35, bold: true, anchor: 'end' });
    sh.text(x - 5, yP + 10.4, labels[i], { size: 1.15, anchor: 'end' });
    p.inst(x - 12, 116, 'PSL', { to: [x - 2.5, yP - 2.5], service: i === 0 ? 'avviamento pompa DC di emergenza' : `avviamento automatico pompa di riserva (${tag})`, sys: s10 });
  });
  sh.line(pumpsX[1] + 3.6, yh, 180, yh, ST.med);
  // ritorno di sfioro (regolazione pressione)
  sh.line(140, yh, 140, 112, ST.norm);
  p.valve(140, 116, { line: LOS, ctl: true, dir: 'v', fail: 'FO', service: 'regolazione pressione mandata (sfioro al serbatoio)' });
  sh.line(140, 120, 140, ty0, ST.norm);
  // refrigeranti
  const cx = 186;
  sh.path([[180, 76], [180, 116]], ST.med);
  for (const yy of [76, 116]) {
    sh.line(180, yy, cx, yy, ST.med);
    sym.shellTube(sh, cx, yy - 6, 26, 12);
    sh.line(cx + 26, yy, cx + 34, yy, ST.med);
  }
  sh.path([[cx + 34, 76], [cx + 34, 116]], ST.med);
  p.refEq(`${u}${sys}10AC001`); p.refEq(`${u}${sys}10AC002`);
  sh.text(cx + 13, 128, `${u}${sys}10AC001/002`, { size: 1.35, anchor: 'middle', bold: true });
  sh.text(cx + 13, 130.6, 'refrigeranti 2×100 %', { size: 1.2, anchor: 'middle' });
  p.valve(180, 86, { line: LOS, kind: 'plug', dir: 'v', service: 'valvola di scambio refrigeranti', s: 1.8, tagSide: -1 });
  // acqua ciclo chiuso ai refrigeranti
  p.off(160, 52, 'right', 'CICLO CHIUSO', 'pid203', { w: 24 });
  p.line(ccLine, [[184, 52], [192, 52], [192, 70]], { label: false });
  sh.path([[206, 70], [206, 58], [222, 58]], ST.norm);
  p.off(222, 58, 'right', 'RITORNO CC', 'pid203', { w: 22 });
  sh.text(160, 47, M.lineById[ccLine].lineNo, { size: 1.25 });
  sh.text(214, 66, 'lato acqua dei due refrigeranti in parallelo', { size: 1.1 });
  // valvola termostatica e filtri
  const xm = cx + 34;
  sh.line(xm, yh, xm + 16, yh, ST.med);
  p.valve(xm + 8, yh, { line: LOS, ctl: true, service: 'regolazione temperatura olio (3 vie)', fail: 'FL' });
  p.inst(xm + 20, 82, 'TIC', { line: LOS, to: [xm + 20, yh], service: 'temperatura olio ai cuscinetti' });
  const fx = xm + 30;
  sh.line(xm + 16, yh, fx - 4, yh, ST.med);
  sh.path([[fx - 4, yh - 12], [fx - 4, yh + 12]], ST.med);
  for (const yy of [yh - 12, yh + 12]) { sh.line(fx - 4, yy, fx, yy, ST.med); sym.filter(sh, fx, yy - 4, 12, 8); sh.line(fx + 12, yy, fx + 16, yy, ST.med); }
  sh.path([[fx + 16, yh - 12], [fx + 16, yh + 12]], ST.med);
  p.refEq(`${u}${sys}10AT001`); p.refEq(`${u}${sys}10AT002`);
  sh.text(fx + 6, yh - 18, 'filtri 2×100 %', { size: 1.3, anchor: 'middle' });
  p.inst(fx + 6, yh + 24, 'PDT', { to: [fx + 6, yh + 16], service: 'intasamento filtri olio', sys: s10, range: '0 – 2', unit: 'bar' });
  // collettore di mandata ai cuscinetti
  p.line(LOS, [[fx + 16, yh], [362, yh]], { seg: 0, at: 0.5 });
  p.inst(fx + 32, 82, 'PT', { line: LOS, to: [fx + 32, yh], service: 'pressione olio ai cuscinetti' });
  p.inst(fx + 44, 82, 'PSLL', { line: LOS, to: [fx + 44, yh], service: 'pressione olio bassissima (blocco macchina, 2oo3)', sis: true });
  p.inst(fx + 56, 82, 'TT', { line: LOS, to: [fx + 56, yh], service: 'temperatura olio mandata' });
  p.off(362, yh, 'right', 'AI CUSCINETTI', isGT ? 'pid101' : 'pid108', { w: 30 });
  // pompa DC: mandata diretta a valle dei filtri
  sh.path([[pumpsX[0] + 3.6, 40], [fx + 22, 40], [fx + 22, yh]], ST.norm);
  sh.text(64, 38, 'mandata pompa DC di emergenza a valle di refrigeranti e filtri', { size: 1.2 });
  p.valve(fx + 22, 70, { line: LOS, kind: 'check', dir: 'v', s: 1.6, service: 'ritegno mandata pompa DC', showTag: false });
  // ritorno
  p.off(392, 186, 'left', 'DAI CUSCINETTI', isGT ? 'pid101' : 'pid108', { w: 30 });
  p.line(LOR, [[362, 186], [tx1, 186]], { seg: 0, at: 0.25 });
  for (let i = 0; i < 3; i++) sh.circle(210 + i * 40, 186, 1.4, { s: '#000000', w: 0.25, f: W });
  sh.text(212, 191, 'spie di flusso sui ritorni', { size: 1.2 });
  p.inst(300, 174, 'TT', { line: LOR, to: [300, 186], service: 'temperatura olio ritorno cuscinetti' });
  // olio di sollevamento
  const jx = 184, jy = 220;
  pumpSym(sh, jx, jy, { r: 3.4 });
  p.refEq(`${u}${sys}20AP001`);
  sh.text(jx + 6, jy + 8, `${u}${sys}20AP001 pompa olio di sollevamento`, { size: 1.3, bold: true });
  sh.path([[150, ty1], [150, jy], [jx - 3.4, jy]], ST.norm);
  p.line(JO, [[jx + 3.4, jy - 3.4], [jx + 3.4, 206], [362, 206]], { seg: 1, at: 0.55 });
  p.psv(212, 202, { line: JO, service: 'protezione mandata olio sollevamento' });
  p.inst(240, 196, 'PT', { line: JO, to: [240, 206], service: 'pressione olio sollevamento' });
  p.off(362, 206, 'right', 'SOLLEVAMENTO', isGT ? 'pid101' : 'pid108', { w: 30 });
  return p.finish([
    `Portata olio ai cuscinetti ${F(qOil, 0)} m³/h circa; pompe principali AC 2×100 % con avviamento automatico della riserva su bassa pressione, pompa DC di emergenza alimentata da batteria.`,
    'Refrigeranti raffreddati con acqua del ciclo chiuso; valvola termostatica a tre vie per temperatura olio costante ai cuscinetti (45–50 °C).',
  ]);
}

// ------------------------------------------------------------------ GVR: circuiti per livello
function coilList(M, level) {
  const bt = M.r.bt;
  const bk = (nm, i = 0) => banksNamed(M, nm)[i];
  const split = (b, lab1, lab2, tag) => {
    const Tm = (b.TgIn + b.TgOut) / 2;
    return [{ label: lab2, TgIn: b.TgIn, TgOut: Tm, role: 'SH2', tag: `${tag}` }, { label: lab1, TgIn: Tm, TgOut: b.TgOut, role: 'SH1', tag: `${tag.replace(/(\d)$/, (d) => String(Number(d) + 1))}` }];
  };
  const out = [];
  if (level === 'HP') {
    const sh = bk('SH HP');
    out.push(...split(sh, 'SH1 HP', 'SH2 HP', '1HAH10'));
    const ev = bk('EVA HP');
    out.push({ label: 'EVA HP', TgIn: ev.TgIn, TgOut: ev.TgOut, role: 'EVA', tag: '1HAD10' });
    banksNamed(M, 'ECO HP').forEach((b, i, arr) => out.push({ label: arr.length > 1 ? `ECO${arr.length - i} HP` : 'ECO HP', TgIn: b.TgIn, TgOut: b.TgOut, role: 'ECO', tag: `1HAC1${i}` }));
  } else if (level === 'IP') {
    const rh = bk('RH');
    out.push(...split(rh, 'RH1', 'RH2', '1HAJ10'));
    const s = bk('SH IP'), e = bk('EVA IP'), c = bk('ECO IP');
    if (s) out.push({ label: 'SH IP', TgIn: s.TgIn, TgOut: s.TgOut, role: 'SH', tag: '1HAH20' });
    out.push({ label: 'EVA IP', TgIn: e.TgIn, TgOut: e.TgOut, role: 'EVA', tag: '1HAD20' });
    if (c) out.push({ label: 'ECO IP', TgIn: c.TgIn, TgOut: c.TgOut, role: 'ECO', tag: '1HAC20' });
  } else {
    const lv = M.names[M.n - 1];
    if (M.n > 1) {
      const s = bk(`SH ${lv}`), e = bk(`EVA ${lv}`);
      if (s) out.push({ label: `SH ${lv}`, TgIn: s.TgIn, TgOut: s.TgOut, role: 'SH', tag: `1HAH${M.n * 10}` });
      out.push({ label: `EVA ${lv}`, TgIn: e.TgIn, TgOut: e.TgOut, role: 'EVA', tag: `1HAD${M.n * 10}` });
    }
    const pr = bk('PRE (condensato)');
    out.push({ label: 'PRE', TgIn: pr.TgIn, TgOut: pr.TgOut, role: 'PRE', tag: '1HAC31' });
  }
  void bt;
  return out;
}

/** Linea di uscita vapore con accessori lungo la corsia y; ritorna l'ascissa dell'ultimo accessorio. */
function steamTrims(p, x0, x1, y, line, { psv = true, erv = false, suv = null, fe = true, sample = false, toId, toText, start = 48 }) {
  const sh = p.sh;
  p.line(line, [[x0, y], [x1, y]], { seg: 0, at: 0.82 });
  let x = x0 + start;
  if (psv) { p.psv(x, y - 4, { line, service: 'sicurezza uscita surriscaldatore' }); x += 14; }
  if (erv) {
    sh.line(x, y, x, y - 5, ST.norm);
    p.valve(x, y - 8, { line, dir: 'v', kind: 'globe', act: 'sol', fail: 'FC', service: 'valvola di scarico comandata (ERV)', s: 1.8 });
    x += 24;
  }
  if (suv) {
    sh.line(x, y, x, y - 5, ST.norm);
    p.valve(x, y - 8.5, { line: suv, dir: 'v', ctl: true, fail: 'FC', service: 'sfiato di avviamento', s: 1.8 });
    sh.line(x, y - 12, x, y - 14, ST.norm);
    sym.silencer(sh, x, y - 14, 4, 7);
    p.inst(x + 10, y - 21, 'PIC', { line, to: [x + 4, y - 12], service: 'regolazione pressione all\'avviamento (sfiato)' });
    x += 26;
  }
  if (fe) { orifice(sh, x, y); p.inst(x, y - 12, 'FT', { line, to: [x, y - 2], service: 'portata vapore' }); x += 10; }
  p.inst(x, y - 12, 'PT', { line, to: [x, y], service: 'pressione vapore' }); x += 9;
  p.inst(x, y - 12, 'TT', { line, to: [x, y], service: 'temperatura vapore' }); x += 10;
  if (sample) { sh.line(x, y, x, y + 6, ST.thin); sh.text(x + 1, y + 8, 'SWAS', { size: 1.15 }); x += 9; }
  p.valve(x, y, { line, kind: 'check', service: 'non ritorno uscita vapore' }); x += 12;
  p.valve(x, y, { line, act: 'mot', service: 'intercettazione uscita vapore' });
  p.off(x1, y, 'right', toText, toId, { w: 30 });
  return x;
}

export function pidHRSG(M, reg, doc, level) {
  const titles = {
    HP: 'GVR – circuito alta pressione (HP)',
    IP: 'GVR – circuito media pressione (IP) e risurriscaldatore',
    LP: M.n > 1 ? `GVR – circuito ${M.names[M.n - 1] === 'LP' ? 'bassa pressione (LP)' : M.names[M.n - 1]} e preriscaldatore condensato` : 'GVR – preriscaldatore condensato e ricircolo',
  };
  const p = new Pid(M, reg, doc, { title: titles[level], typical: true });
  const sh = p.sh;
  const bt = M.r.bt;
  const cx0 = 40, cx1 = 290, cy0 = 172, cy1 = 214, nozTop = cy0 + 7;
  // ingresso acqua dal bocchello lato fumi freddi (destra), uscita lato fumi caldi: controcorrente
  const pos = p.casing(cx0, cy0, cx1, cy1, coilList(M, level), {
    tag: '1HAA00', gasInText: level === 'HP' ? 'fumi da TG' : 'fumi', gasOutText: level === 'LP' ? 'al camino' : 'fumi',
  }).map((c) => ({ ...c, wi: c.outX, wo: c.inX }));
  if (level === 'LP') p.refEq('1HNE10');
  const by = (role) => pos.filter((c) => c.role === role);
  const lvIdx = level === 'HP' ? 0 : level === 'IP' ? 1 : M.n - 1;
  const lv = M.names[lvIdx];
  const isLP = level === 'LP';
  const eva = by('EVA')[0];
  const XR = 372;
  const offR = (y, text, id) => p.off(XR + 30, y, 'left', text, id, { w: 30 });
  const dw = 54, dh = 14, dy = 96;
  let dx = null;
  // ---- evaporatore HP Benson: separatore verticale di avviamento al posto del corpo cilindrico
  const benson = level === 'HP' && M.benson && eva;
  const sepY = 90, sepH = 34;
  if (benson) {
    dx = eva.cx - dw / 2;
    const sys = '1HAD10';
    const sx = eva.cx - 6, sw = 12;
    vvessel(sh, sx, sepY, sw, sepH);
    p.refEq(`${sys}BB001`);
    sh.text(sx + sw + 3, sepY + 14, `${sys}BB001`, { size: 1.6, bold: true });
    sh.text(sx + sw + 3, sepY + 16.6, 'separatore di avviamento (Benson)', { size: 1.2 });
    p.inst(sx - 8, sepY + 24, 'LT', { to: [sx, sepY + 24], service: 'livello separatore HP (avviamento e basso carico)', sys });
    p.inst(sx + sw + 9, sepY + 4, 'PT', { line: 'MS-1', to: [sx + sw, sepY + 4], service: 'pressione separatore HP', sys });
    p.inst(sx + sw + 18, sepY + 4, 'TT', { line: 'MS-1', to: [sx + sw, sepY + 7], service: 'temperatura uscita evaporatore (surriscaldamento Benson)', sys });
    sh.line(eva.cx - 3, sepY + 1, eva.cx - 3, sepY - 4, ST.norm);
    p.ventDrain(eva.cx - 3, sepY - 4, 'vent', { line: 'VEH-1', double: true });
    // risalita dall'evaporatore a passaggio singolo
    const side = eva.wi < eva.cx ? sx : sx + sw;
    p.pipe([[eva.wi, nozTop], [eva.wi, sepY + 26], [side, sepY + 26]], { st: ST.med, arrow: true });
    // drenaggio del separatore all'avviamento (regolato sul livello) verso serbatoio spurghi / condensatore
    p.line('SEPD-1', [[eva.cx, sepY + sepH], [eva.cx, 128], [eva.cx + 48, 128]], { seg: 1, at: 0.75 });
    p.valve(eva.cx + 16, 128, { line: 'SEPD-1', ctl: true, fail: 'FC', service: 'drenaggio separatore HP su livello (avviamento)', s: 1.8, tagSide: -1 });
    p.off(eva.cx + 48, 128, 'right', 'DRENAGGIO SEPARATORE', 'pid111', { w: 34 });
  }
  // ---- corpo cilindrico, discesa, risalita, spurghi
  if (eva && !benson) {
    dx = eva.cx - dw / 2;
    const sys = `1HAD${(lvIdx + 1) * 10}`;
    const steamLine = level === 'HP' ? 'MS-1' : level === 'IP' ? 'IP-1' : 'LP-1';
    const bdLine = level === 'HP' ? 'BD-1' : `CBD-${lv}-1`;
    const bdDx = 24;
    const { bd } = p.drumAssy(dx, dy, dw, dh, { tag: `${sys}BB001`, lv, steamLine, ventLine: level === 'HP' ? 'VEH-1' : null, bdLine, sys, bdDx, bdTag: false });
    sh.line(dx + bdDx, dy + dh + 13.7, dx + bdDx, 128, ST.norm);
    p.off(dx + bdDx, 128, 'right', 'CBD', 'pid111', { w: 14, sub: '' });
    sh.text(dx + bdDx - 2.5, 122, bd, { size: 1.2, anchor: 'end' });
    const dcX = dx + (isLP && M.n > 1 ? 12 : 6);
    sh.path([[dcX, dy + dh], [dcX, cy0 - 5], [eva.gapL + 1.5, cy0 - 5], [eva.gapL + 1.5, cy1 - 3], [eva.wo, cy1 - 3], [eva.wo, cy1 - 7]], ST.thick);
    sh.text(eva.gapL + 2.5, cy1 - 4.2, 'discesa', { size: 1.2 });
    p.pipe([[eva.wi, nozTop], [eva.wi, dy + dh]], { st: ST.med, arrow: true });
    if (level === 'HP') {
      const xb = eva.cx + 4;
      sh.line(xb, cy1 - 7, xb, 228, ST.norm);
      p.line('IBD-1', [[xb, 228], [xb + 10, 228]], { label: false });
      p.valve(xb, 221, { line: 'IBD-1', dir: 'v', act: 'mot', service: 'spurgo intermittente evaporatore HP', s: 1.8 });
      p.off(xb + 10, 228, 'right', 'SPURGO INTERMITT.', 'pid111', { w: 32 });
    }
  }
  // ---- alimento ed economizzatori
  const ecos = by('ECO'); // da sinistra: dal più caldo al più freddo
  if (!isLP && eva) {
    const cold = ecos[ecos.length - 1];
    const feedLine = level === 'HP' ? 'FW-1' : 'FWIP-1';
    const yF = 150;
    offR(yF, 'ACQUA ALIMENTO', 'pid110');
    const xEnd = cold ? cold.wi : dx + dw - 3;
    p.line(feedLine, [[XR, yF], [xEnd, yF], [xEnd, cold ? nozTop : dy + dh]], { seg: 1, at: 0.5 });
    orifice(sh, 364, yF);
    p.inst(364, yF - 12, 'FT', { line: feedLine, to: [364, yF - 2], service: `portata acqua alimento ${lv}` });
    p.ctrlStation(338, yF, benson ? { line: feedLine, fn: 'FIC', service: 'portata acqua alimento HP (controllo Benson: carico e surriscaldamento uscita evaporatore)', ctrlY: yF - 17 }
      : { line: feedLine, fn: 'LIC', service: `livello corpo ${lv} (3 elementi)`, ctrlY: yF - 17 });
    p.valve(312, yF, { line: feedLine, kind: 'check', service: `non ritorno alimento ${lv}` });
    p.valve(299, yF, { line: feedLine, act: 'mot', service: `intercettazione alimento ${lv}` });
    p.inst(288, yF - 10, 'TT', { line: feedLine, to: [288, yF], service: `temperatura acqua alimento ${lv}` });
    for (let i = ecos.length - 1; i > 0; i--) p.pipe([[ecos[i].wo, nozTop], [ecos[i].wo, 162], [ecos[i - 1].wi, 162], [ecos[i - 1].wi, nozTop]], { arrow: true, st: ST.med });
    if (ecos.length) {
      const hot = ecos[0];
      if (benson) {
        // ECO caldo -> collettore inferiore dell'evaporatore (nessuna discesa da corpo cilindrico)
        const xL = eva.gapL + 1.5;
        p.pipe([[hot.wo, nozTop], [hot.wo, 140], [dx + 4, 140], [dx + 4, cy0 - 5], [xL, cy0 - 5], [xL, cy1 - 3], [eva.wo, cy1 - 3], [eva.wo, cy1 - 7]], { arrow: true, st: ST.med });
      } else p.pipe([[hot.wo, nozTop], [hot.wo, 140], [dx + dw - 3, 140], [dx + dw - 3, dy + dh]], { arrow: true, st: ST.med });
      p.ventDrain(hot.wo, 140, 'vent', { line: feedLine });
      p.ventDrain(cold.wi, 168, 'drain', { line: feedLine, dir: 'h' });
      if (level === 'IP' || (level === 'HP' && !M.reheat)) {
        const xg = hot.wo - 5;
        p.dot(xg, 140);
        p.line('FGH-1', [[xg, 140], [xg, 124], [XR, 124]], { seg: 1, at: 0.6 });
        p.off(XR, 124, 'right', 'AL RISCALD. GAS', 'pid102', { w: 30 });
      }
    }
  }
  // ---- vapore
  if (level === 'HP') {
    const sh2 = by('SH2')[0], sh1 = by('SH1')[0];
    const xs = benson ? eva.cx + 3 : dx + dw / 2 + 6;
    p.pipe([[xs, benson ? sepY : dy], [xs, 78], [sh1.wi, 78], [sh1.wi, nozTop]], { arrow: true, st: ST.med });
    p.pipe([[sh1.wo, nozTop], [sh1.wo, 66], [sh2.wi, 66], [sh2.wi, nozTop]], { arrow: true, st: ST.med });
    const xd = (sh1.wo + sh2.wi) / 2;
    sh.rect(xd - 3.5, 64, 7, 4, { s: '#000000', w: 0.35, f: W });
    sh.text(xd - 4.5, 72, 'DSH', { size: 1.25, anchor: 'end', bold: true });
    p.refEq('1LAE10AT001');
    p.inst(xd + 10, 57, 'TT', { line: 'MS-1', to: [xd + 4, 66], service: 'temperatura a valle desurriscaldatore HP' });
    offR(52, 'SPRAY HP', 'pid110');
    p.line('SPH-1', [[XR, 52], [xd, 52], [xd, 64]], { seg: 0, at: 0.25 });
    p.ctrlStation(250, 52, { line: 'SPH-1', fn: '', service: 'acqua di attemperamento HP', bypass: false });
    p.inst(240, 46, 'TIC', { line: 'MS-1', to: [248, 46], service: 'regolazione temperatura vapore HP' });
    p.pipe([[sh2.wo, nozTop], [sh2.wo, 40]], { st: ST.thick });
    steamTrims(p, sh2.wo, XR, 40, 'MS-1', { psv: true, erv: true, suv: 'SUV-1', fe: true, sample: true, toId: 'pid107', toText: 'VAPORE HP' });
    // drenaggi dei collettori inferiori dei surriscaldatori
    for (const c of [sh2, sh1]) sh.line(c.cx, cy1 - 7, c.cx, 226, ST.norm);
    p.dot(sh2.cx, 226);
    p.line('DRH-1', [[sh1.cx, 226], [48, 226]], { seg: 0, at: 0.3 });
    p.valve(56, 226, { line: 'DRH-1', act: 'mot', service: 'drenaggio surriscaldatori HP' });
    p.off(48, 226, 'left', 'DRENAGGI SH', 'pid111', { w: 30 });
  } else if (level === 'IP') {
    const rh2 = by('SH2')[0], rh1 = by('SH1')[0], shIP = by('SH')[0];
    const xs = dx + dw / 2 + 6;
    const yH = 34, yS = 46, yC = 56;
    p.pipe([[xs, dy], [xs, 78], [shIP.wi, 78], [shIP.wi, nozTop]], { arrow: true, st: ST.med });
    // RH freddo da TV e vapore IP
    offR(yC, 'RH FREDDO', 'pid107');
    p.line('CRH-1', [[XR, yC], [rh1.wi, yC], [rh1.wi, nozTop]], { seg: 0, at: 0.3 });
    p.line('IP-1', [[shIP.wo, nozTop], [shIP.wo, yC]], { label: false, arrow: false });
    p.dot(shIP.wo, yC);
    sh.text(shIP.wo + 1.6, 174, M.lineById['IP-1'].lineNo, { size: 1.3, rot: -90 });
    p.valve(shIP.wo, 120, { line: 'IP-1', kind: 'check', dir: 'v', service: 'non ritorno vapore IP' });
    p.valve(shIP.wo, 106, { line: 'IP-1', dir: 'v', act: 'mot', service: 'intercettazione vapore IP' });
    sh.line(shIP.wo, 134, shIP.wo + 18, 134, ST.norm);
    p.psv(shIP.wo + 18, 130, { line: 'IP-1', service: 'sicurezza uscita SH IP' });
    p.inst(shIP.wo - 12, 92, 'PT', { line: 'IP-1', to: [shIP.wo, 92], service: 'pressione vapore IP' });
    // interstadio RH con desurriscaldatore
    p.pipe([[rh1.wo, nozTop], [rh1.wo, 66], [rh2.wi, 66], [rh2.wi, nozTop]], { arrow: true, st: ST.thick });
    const xd = (rh1.wo + rh2.wi) / 2;
    sh.rect(xd - 3.5, 64, 7, 4, { s: '#000000', w: 0.35, f: W });
    sh.text(xd - 4.5, 72, 'DSH', { size: 1.25, anchor: 'end', bold: true });
    p.refEq('1LAF10AT001');
    p.inst(xd + 10, 57, 'TT', { line: 'HRH-1', to: [xd + 4, 66], service: 'temperatura a valle desurriscaldatore RH' });
    offR(yS, 'SPRAY RH', 'pid110');
    p.line('SPRH-1', [[XR, yS], [xd, yS], [xd, 64]], { seg: 0, at: 0.18 });
    p.ctrlStation(300, yS, { line: 'SPRH-1', fn: '', service: 'acqua di attemperamento RH', bypass: false });
    p.inst(290, 40, 'TIC', { line: 'HRH-1', to: [298, 40], service: 'regolazione temperatura RH caldo' });
    // RH caldo
    p.pipe([[rh2.wo, nozTop], [rh2.wo, yH]], { st: ST.thick });
    p.line('HRH-1', [[rh2.wo, yH], [XR, yH]], { seg: 0, at: 0.75 });
    p.off(XR, yH, 'right', 'RH CALDO', 'pid107', { w: 30 });
    p.psv(140, yH - 4, { line: 'HRH-1', service: 'sicurezza uscita RH' });
    p.inst(160, yH - 12, 'TT', { line: 'HRH-1', to: [160, yH], service: 'temperatura vapore RH caldo' });
    p.inst(170, yH - 12, 'PT', { line: 'HRH-1', to: [170, yH], service: 'pressione RH caldo' });
    p.ventDrain(64, yH, 'drain', { line: 'HRH-1' });
  } else {
    // ---- livello più basso e preriscaldatore
    const pre = by('PRE')[0];
    const yC = 160, yO = M.n > 1 ? 130 : 124, yR = 146, yB = M.n > 1 ? yO : 134;
    offR(yC, 'CONDENSATO', 'pid109');
    p.line('CD-1', [[XR, yC], [pre.wi, yC], [pre.wi, nozTop]], { seg: 0, at: 0.74 });
    p.inst(270, 150, 'TT', { line: 'CD-1', to: [270, yC], service: 'temperatura condensato ingresso PRE' });
    p.inst(300, 169, 'TIC', { line: 'CD-1', to: [300, yC], service: 'temperatura ingresso PRE ≥ 55 °C (ricircolo)' });
    // ricircolo preriscaldatore
    p.dot(pre.wo, yR);
    p.line('PRER-1', [[pre.wo, yR], [290, yR]], { label: false });
    sh.line(290, 140, 290, 152, ST.norm).line(318, 140, 318, 152, ST.norm);
    [140, 152].forEach((yy, i) => {
      sh.line(290, yy, 298.8, yy, ST.norm);
      pumpSym(sh, 302, yy, { r: 3.2, out: 'right' });
      sh.line(305.2, yy, 318, yy, ST.norm);
      p.valve(312, yy, { line: 'PRER-1', kind: 'check', s: 1.5, showTag: false, service: `ritegno pompa ricircolo ${i + 1}` });
      p.refEq(`1HAC30AP00${i + 1}`);
    });
    sh.text(288, 156, '1HAC30AP001/002', { size: 1.3, bold: true, anchor: 'end' });
    sh.path([[318, yR], [340, yR], [340, yC]], ST.norm);
    p.dot(340, yC);
    p.valve(329, yR, { line: 'PRER-1', ctl: true, fail: 'FO', service: 'regolazione ricircolo preriscaldatore' });
    sh.text(pre.wo + 3, yR - 1.2, M.lineById['PRER-1'].lineNo, { size: 1.25 });
    // by-pass del preriscaldatore
    p.dot(356, yC);
    p.dot(pre.wo, yB);
    p.line('CD-1', [[356, yC], [356, yB], [pre.wo, yB]], { label: false });
    p.valve(M.n > 1 ? 300 : 250, yB, { line: 'CD-1', ctl: true, fail: 'FC', service: 'by-pass preriscaldatore (temperatura camino)' });
    if (M.n > 1) {
      // corpo LP con degasatore: alimento dal preriscaldatore con regolazione di livello
      p.line('PREO-1', [[pre.wo, nozTop], [pre.wo, yO], [dx + dw - 3, yO], [dx + dw - 3, dy + dh]], { seg: 1, at: 0.3, label: false });
      sh.text(pre.wo - 2, yO - 1.2, M.lineById['PREO-1'].lineNo, { size: 1.25, anchor: 'end' });
      p.valve(212, yO, { line: 'PREO-1', ctl: true, service: `regolazione livello corpo ${lv}` });
      p.inst(224, 118, 'LIC', { line: 'PREO-1', to: [214, 126], service: `livello corpo ${lv}` });
      sh.line(dx + 24, dy, dx + 24, dy - 3, ST.norm);
      sh.rect(dx + 20, dy - 9, 8, 6, { s: '#000000', w: 0.35, f: W });
      sh.textMid(dx + 24, dy - 6, 'DEG', { size: 1.1, anchor: 'middle', bold: true });
      // aspirazione pompe alimento e ricircolo di minima portata
      p.line('FWS-1', [[dx + 6, dy + dh], [dx + 6, 150], [dx + 2, 150]], { label: false });
      p.off(dx + 2, 150, 'left', 'A POMPE ALIM.', 'pid110', { w: 30 });
      sh.text(dx + 7.5, 142, M.lineById['FWS-1'].lineNo, { size: 1.2, rot: -90 });
      offR(88, 'MINIMA PORTATA', 'pid110');
      p.line('MIN-1', [[XR, 88], [dx + dw - 8, 88], [dx + dw - 8, dy]], { seg: 0, at: 0.5 });
      // vapore LP
      const shL = by('SH')[0];
      const xs = dx + dw / 2 + 6;
      if (shL) {
        p.pipe([[xs, dy], [xs, 78], [shL.wi, 78], [shL.wi, nozTop]], { arrow: true, st: ST.med });
        p.pipe([[shL.wo, nozTop], [shL.wo, 52]], { st: ST.med });
        steamTrims(p, shL.wo, XR, 52, 'LP-1', { psv: true, fe: true, toId: 'pid107', toText: `VAPORE ${lv}` });
      } else {
        p.pipe([[xs, dy], [xs, 52]], { st: ST.med });
        steamTrims(p, xs, XR, 52, 'LP-1', { psv: false, fe: true, toId: 'pid107', toText: `VAPORE ${lv}` });
      }
    } else {
      p.line('PREO-1', [[pre.wo, nozTop], [pre.wo, yO], [XR, yO]], { seg: 1, at: 0.6 });
      p.off(XR, yO, 'right', 'A POMPE ALIM.', 'pid110', { w: 30 });
      p.inst(pre.wo + 12, 112, 'TT', { line: 'PREO-1', to: [pre.wo + 12, yO], service: 'temperatura uscita preriscaldatore' });
    }
  }
  const notes = {
    HP: [`${M.benson ? 'Evaporatore HP a passaggio singolo (Benson), pressione al separatore' : 'Pressione corpo HP'} ${F(bt.pDrum[0], 1)} bar(a), produzione ${F(bt.mLevels[0] * 3.6, 0)} t/h a ${F(bt.Tsh[0], 0)} °C per GVR. Desurriscaldatore interstadio per il controllo della temperatura di uscita; acqua alimento in controcorrente ai fumi.`, 'Sfiato di avviamento con silenziatore per il controllo della pressione durante avviamenti e transitori; drenaggi dei collettori inferiori dei surriscaldatori. Dosaggio fosfati e campionamento acqua di corpo: vedi P&ID chimici e campionamento.'],
    IP: [`Corpo IP ${F(bt.pDrum[1] ?? 0, 1)} bar(a); il vapore IP si unisce al risurriscaldato freddo a monte di RH1. Temperatura RH caldo ${F(bt.Trh, 0)} °C regolata con desurriscaldatore interstadio.`],
    LP: [M.n > 1 ? `Corpo ${lv} con testa degasante integrata a ${F(bt.pDrum[M.n - 1], 1)} bar(a); alimenta le pompe dell'acqua alimento dei livelli superiori.` : 'Il preriscaldatore (con degasaggio nel condensatore) alimenta l\'aspirazione delle pompe acqua alimento HP.', 'Ricircolo del preriscaldatore per mantenere la temperatura di ingresso acqua sopra il punto di rugiada acida dei fumi (≥ 55 °C); by-pass per il controllo della temperatura al camino.'],
  };
  return p.finish(notes[level]);
}

// ------------------------------------------------------------------ PID-107 vapore principale e bypass
export function pid107(M, reg, doc) {
  const p = new Pid(M, reg, doc, { title: 'Vapore principale, risurriscaldato e bypass turbina' });
  const sh = p.sh;
  const N = M.N, hdr = N > 1;
  const reheat = M.reheat, n = M.n;
  const xIn = 52;
  // ---- vapore HP
  const yHP = 46;
  p.off(xIn - 30, yHP, 'right', 'VAPORE HP GVR1', 'pid104', { w: 30 });
  p.line('MS-1', [[xIn, yHP], [hdr ? 150 : 260, yHP]], { seg: 0, at: 0.3 });
  if (hdr) {
    for (let u = 2; u <= N; u++) {
      const y2 = yHP + (u - 1) * 8;
      p.off(xIn - 30, y2, 'right', `VAPORE HP GVR${u}`, 'pid104', { w: 30 });
      sh.path([[xIn, y2], [150, y2], [150, yHP]], ST.thick);
    }
    p.dot(150, yHP);
    p.line('MS-H', [[150, yHP], [260, yHP]], { seg: 0, at: 0.4 });
  }
  const msLine = hdr ? 'MS-H' : 'MS-1';
  sh.line(260, yHP, 300, yHP, ST.thick);
  p.off(300, yHP, 'right', 'ALLA TV (HP)', 'pid108', { w: 30 });
  // drenaggio di bassa
  sh.line(240, yHP, 240, yHP + 5, ST.norm);
  sh.rect(238, yHP + 5, 4, 6, { s: '#000000', w: 0.3, f: W });
  p.valve(240, yHP + 15, { line: 'DRT', dir: 'v', act: 'mot', service: 'drenaggio linea vapore HP', s: 1.8 });
  p.inst(230, yHP + 10, 'LSH', { to: [238, yHP + 8], service: 'pozzetto drenaggio vapore HP', sys: '0LBA10' });
  // bypass HP
  const xb = 200;
  sh.line(xb, yHP, xb, yHP + 10, ST.med);
  p.line('HPB-1', [[xb, yHP + 10], [xb, 104]], { label: false });
  p.valve(xb, yHP + 18, { line: 'HPB-1', dir: 'v', act: 'mot', service: 'intercettazione bypass HP' });
  p.valve(xb, yHP + 30, { line: 'HPB-1', dir: 'v', ctl: true, fail: 'FC', service: 'stazione di bypass HP (riduzione pressione)' });
  p.inst(xb - 16, yHP + 30, 'PIC', { line: msLine, to: [xb - 3, yHP + 30], service: 'regolazione pressione vapore HP (bypass)' });
  sh.rect(xb - 3, yHP + 38, 6, 6, { s: '#000000', w: 0.35, f: W });
  sh.text(xb + 4, yHP + 42, 'DSH', { size: 1.25, bold: true });
  p.refEq('1MAN10');
  sh.text(xb + 4, yHP + 22, '1MAN10', { size: 1.4, bold: true });
  p.off(250, yHP + 41, 'left', 'SPRAY BYPASS', 'pid110', { w: 26 });
  p.line('SPB-1', [[224, yHP + 41], [xb + 3, yHP + 41]], { label: false });
  p.valve(214, yHP + 41, { line: 'SPB-1', ctl: true, fail: 'FC', service: 'acqua di attemperamento bypass HP', s: 1.9 });
  p.inst(xb + 14, yHP + 52, 'TIC', { line: 'SPB-1', to: [xb + 2, yHP + 50], service: 'temperatura a valle bypass HP' });
  sh.text(xb + 2, 102, reheat ? 'al RH freddo' : 'al condensatore', { size: 1.25 });
  // ---- RH freddo e caldo
  let y = 108;
  if (reheat) {
    p.off(392, y, 'left', 'RH FREDDO DA TV', 'pid108', { w: 30 });
    p.line(hdr ? 'CRH-H' : 'CRH-1', [[362, y], [xIn, y]], { seg: 0, at: 0.35 });
    p.valve(330, y, { line: hdr ? 'CRH-H' : 'CRH-1', kind: 'check', service: 'non ritorno scarico HP', s: 2.6 });
    p.valve(318, y, { line: hdr ? 'CRH-H' : 'CRH-1', act: 'pneu', kind: 'butterfly', service: 'valvola di sfiato scarico HP (ventilazione)', fail: 'FO', s: 2.2 });
    p.dot(xb, y);
    p.off(xIn, y, 'right', 'RH FREDDO GVR1', 'pid105', { w: 30 });
    if (hdr) sh.text(xIn + 2, y + 6, `derivazioni ai GVR 2…${N} come GVR1`, { size: 1.25 });
    // vapore ausiliario dal RH freddo
    sh.line(280, y, 280, y - 18, ST.norm);
    p.line('AS-CRH', [[280, y - 18], [280, y - 24], [300, y - 24]], { label: false });
    p.valve(280, y - 8, { line: 'AS-CRH', dir: 'v', ctl: true, fail: 'FC', service: 'riduzione vapore ausiliario da RH freddo', s: 1.9 });
    p.off(300, y - 24, 'right', 'VAPORE AUSILIARIO', 'pid210', { w: 32 });
    // RH caldo
    y = 140;
    p.off(xIn - 30, y, 'right', 'RH CALDO GVR1', 'pid105', { w: 30 });
    p.line('HRH-1', [[xIn, y], [hdr ? 150 : 340, y]], { seg: 0, at: 0.3 });
    if (hdr) { p.dot(150, y); p.line('HRH-H', [[150, y], [340, y]], { seg: 0, at: 0.3 }); }
    p.off(340, y, 'right', 'ALLA TV (IP)', 'pid108', { w: 30 });
    // bypass RH al condensatore
    const xr = 320;
    sh.line(xr, y, xr, y + 8, ST.med);
    p.line('RHBP-1', [[xr, y + 8], [xr, 204], [340, 204]], { seg: 1, at: 0.7, label: false });
    p.valve(xr, y + 16, { line: 'RHBP-1', dir: 'v', act: 'mot', service: 'intercettazione bypass RH' });
    p.valve(xr, y + 30, { line: 'RHBP-1', dir: 'v', ctl: true, fail: 'FC', service: 'stazione di bypass RH al condensatore' });
    p.inst(xr - 15, y + 24, 'PIC', { line: 'HRH-1', to: [xr - 3, y + 30], service: 'regolazione pressione RH caldo (bypass)' });
    sh.rect(xr - 3, y + 40, 6, 6, { s: '#000000', w: 0.35, f: W });
    sh.text(xr + 4, y + 44, 'DSH', { size: 1.25, bold: true });
    p.refEq('1MAN20');
    sh.text(xr + 4, y + 22, '1MAN20', { size: 1.4, bold: true });
    p.off(340, 204, 'right', 'AL CONDENSATORE', 'pid108', { w: 32 });
  }
  // ---- vapore LP
  if (n > 1) {
    const yL = reheat ? 176 : 120;
    p.off(xIn - 30, yL, 'right', 'VAPORE LP GVR1', 'pid106', { w: 30 });
    p.line('LP-1', [[xIn, yL], [hdr ? 110 : 260, yL]], { seg: 0, at: 0.4 });
    if (hdr) { p.dot(110, yL); p.line('LP-H', [[110, yL], [260, yL]], { seg: 0, at: 0.6 }); }
    p.off(260, yL, 'right', 'ALLA TV (LP)', 'pid108', { w: 30 });
    sh.line(130, yL, 130, yL + 10, ST.med);
    p.line('LPBP-1', [[130, yL + 10], [130, 220], [260, 220]], { seg: 1, at: 0.6, label: false });
    p.valve(130, yL + 18, { line: 'LPBP-1', dir: 'v', ctl: true, fail: 'FC', service: 'stazione di bypass LP al condensatore' });
    p.inst(114, yL + 18, 'PIC', { line: 'LP-1', to: [127, yL + 18], service: 'regolazione pressione vapore LP' });
    p.refEq('1MAN30');
    sh.text(134, yL + 26, '1MAN30', { size: 1.4, bold: true });
    p.off(260, 220, 'right', 'AL CONDENSATORE', 'pid108', { w: 32 });
    p.ventDrain(230, yL, 'drain', { line: 'LP-1' });
  }
  if (!reheat) {
    p.off(300, 104, 'right', 'AL CONDENSATORE', 'pid108', { w: 32 });
    sh.line(xb, 104, 300, 104, ST.med);
  }
  return p.finish([
    `Stazioni di bypass dimensionate per il 100 % della produzione di vapore (avviamento, rifiuto di carico, blocco TV). Pressioni di progetto: HP ${F(M.lineById['MS-1'].pDes, 1)} bar(a)${reheat ? `, RH ${F(M.lineById['HRH-1'].pDes, 1)} bar(a)` : ''}.`,
    N > 1 ? `Collettori comuni per ${N} GVR; ogni GVR ha valvole di intercettazione e non ritorno proprie (vedi P&ID GVR).` : 'Configurazione 1+1: linee dirette GVR – TV.',
  ]);
}

// ------------------------------------------------------------------ PID-108 TV, tenute e vuoto
export function pid108(M, reg, doc) {
  const p = new Pid(M, reg, doc, { title: 'Turbina a vapore, vapore tenute, condensatore e vuoto' });
  const sh = p.sh;
  const bt = M.r.bt;
  const air = !M.water;
  const hdr = M.N > 1;
  const n = M.n, reheat = M.reheat;
  const yS = 92;
  const secs = n === 3 ? [['HP', 132, 160], ['IP', 172, 202], ['LP', 220, 280]] : n === 2 ? [['HP', 150, 182], ['LP', 220, 280]] : [['TV', 220, 280]];
  sh.line(secs[0][1] - 8, yS, 312, yS, ST.heavy);
  for (const [k, x0, x1] of secs) {
    if (k === 'LP' || k === 'TV') {
      const xm = (x0 + x1) / 2;
      sh.path([[x0, yS - 14], [xm - 4, yS - 5], [xm + 4, yS - 5], [x1, yS - 14], [x1, yS + 14], [xm + 4, yS + 5], [xm - 4, yS + 5], [x0, yS + 14]], { s: '#000000', w: 0.5, f: W }, true);
    } else sh.path([[x0, yS - 6], [x1, yS - 11], [x1, yS + 11], [x0, yS + 6]], { s: '#000000', w: 0.5, f: W }, true);
    sh.textMid((x0 + x1) / 2, yS, k, { size: 2.4, anchor: 'middle', bold: true });
  }
  p.refEq('0MAA/MAB/MAC10');
  sh.circle(324, yS, 10, { s: '#000000', w: 0.5, f: W });
  sh.text(324, yS + 1.3, 'G', { size: 3.6, anchor: 'middle', bold: true });
  p.eqTag(324, yS + 16, '0MKA10', `${M.electrical.gens[M.N].MVA} MVA`);
  p.eqTag(240, 46, '0MAA/MAB/MAC10', `Turbina a vapore ${F(M.r.Pst, 1)} MW`);
  p.inst(300, 74, 'ST', { to: [300, yS], service: 'velocità TV (2oo3)', sys: '0MAA10', sis: true });
  p.inst(290, 112, 'VT', { to: [282, yS + 4], service: 'vibrazioni cuscinetti TV', sys: '0MAA10' });
  p.inst(120, 112, 'ZT', { to: [128, yS + 3], service: 'spostamento assiale rotore', sys: '0MAA10', sis: true });
  // ammissioni
  const hp = secs[0];
  const yHP = 44, yRH = 32;
  p.off(24, yHP, 'right', 'VAPORE HP', 'pid107', { w: 24 });
  p.line(hdr ? 'MS-H' : 'MS-1', [[48, yHP], [hp[1] + 4, yHP], [hp[1] + 4, yS - 8]], { seg: 0, at: 0.62 });
  p.valve(80, yHP, { line: hdr ? 'MS-H' : 'MS-1', act: 'hyd', kind: 'globe', fail: 'FC', service: 'valvola di arresto HP (MSV)', tag: '0MAA10AA001' });
  p.valve(100, yHP, { line: hdr ? 'MS-H' : 'MS-1', ctl: true, fail: 'FC', service: 'valvola di regolazione HP (CV)', tag: '0MAA10AA002' });
  p.inst(62, yHP + 11, 'PT', { line: hdr ? 'MS-H' : 'MS-1', to: [62, yHP], service: 'pressione ammissione HP' });
  if (reheat) {
    const ip = secs[1];
    p.off(24, yRH, 'right', 'RH CALDO', 'pid107', { w: 24 });
    p.line(hdr ? 'HRH-H' : 'HRH-1', [[48, yRH], [ip[1] + 4, yRH], [ip[1] + 4, yS - 8]], { seg: 0, at: 0.65 });
    p.valve(124, yRH, { line: hdr ? 'HRH-H' : 'HRH-1', act: 'hyd', kind: 'globe', fail: 'FC', service: 'valvola di arresto e intercettazione RH (RSV/IV)', tag: '0MAB10AA001' });
    // scarico HP -> RH freddo
    p.line(hdr ? 'CRH-H' : 'CRH-1', [[hp[2] - 4, yS + 11], [hp[2] - 4, 128], [48, 128]], { seg: 1, at: 0.5 });
    p.off(48, 128, 'left', 'RH FREDDO', 'pid107', { w: 24 });
    p.inst(hp[2] + 6, 120, 'TT', { line: hdr ? 'CRH-H' : 'CRH-1', to: [hp[2] - 4, 120], service: 'temperatura scarico HP' });
    // crossover IP-LP
    p.pipe([[ip[2] - 4, yS - 11], [ip[2] - 4, 62], [250, 62], [250, yS - 5]], { arrow: true, st: ST.thick });
    sh.text(212, 60, 'crossover IP-LP', { size: 1.3 });
  } else if (n === 2) {
    p.pipe([[hp[2] - 4, yS - 11], [hp[2] - 4, 62], [250, 62], [250, yS - 5]], { arrow: true, st: ST.thick });
  }
  if (n > 1) {
    p.off(392, 54, 'left', 'VAPORE LP', 'pid107', { w: 24 });
    p.line(hdr ? 'LP-H' : 'LP-1', [[368, 54], [262, 54], [262, yS - 7.8]], { seg: 0, at: 0.62 });
    p.valve(300, 54, { line: hdr ? 'LP-H' : 'LP-1', ctl: true, fail: 'FC', service: 'valvola di ammissione LP', tag: '0MAC10AA001' });
  }
  // vapore tenute
  const yG = 140;
  p.off(24, yG, 'right', 'VAPORE AUSIL.', 'pid210', { w: 26 });
  p.line('GS', [[50, yG], [240, yG]], { seg: 0, at: 0.2 });
  p.valve(74, yG, { line: 'GS', ctl: true, fail: 'FC', service: 'regolazione pressione vapore tenute' });
  p.inst(90, yG + 11, 'PIC', { line: 'GS', to: [90, yG], service: 'pressione collettore vapore tenute' });
  for (const [, x0, x1] of secs) { sh.line(x0 + 2, yG, x0 + 2, yS + 12, ST.thin); sh.line(x1 - 2, yG, x1 - 2, yS + 12, ST.thin); }
  sh.text(104, yG + 4.5, 'alimentazione tenute', { size: 1.2 });
  // fughe tenute -> condensatore vapore tenute
  const yL = 152;
  p.line('GSL', [[secs[0][1] + 6, yS + 10], [secs[0][1] + 6, yL], [330, yL]], { seg: 1, at: 0.7 });
  for (const [, x0] of secs.slice(1)) sh.line(x0 + 6, yS + 10, x0 + 6, yL, ST.thin);
  sym.shellTube(sh, 330, yL - 6, 26, 12);
  p.eqTag(343, yL + 10, '0MAW10', 'Condensatore vapore tenute');
  for (let i = 0; i < 2; i++) {
    const x = 364 + i * 12;
    sh.line(356, yL - 4, x, yL - 4, ST.norm);
    sh.circle(x, yL - 10, 3, { s: '#000000', w: 0.3, f: W });
    sh.line(x, yL - 7, x, yL - 4, ST.norm);
    p.refEq(`0MAW10AN00${i + 1}`);
  }
  sh.text(360, yL - 16, 'estrattori 2×100 %', { size: 1.2 });
  sh.text(334, yL + 18, 'lato tubi: condensato principale', { size: 1.2 });
  // condensatore o condotto ad ACC
  const cxm = 250;
  if (!air) {
    const c0 = 214, c1 = 286, cy0 = 168, cy1 = 212;
    sh.line(cxm, yS + 14, cxm, cy0, ST.heavy);
    sh.rect(c0, cy0, c1 - c0, cy1 - cy0, { s: '#000000', w: 0.6, f: W });
    for (let i = 0; i < 3; i++) sh.line(c0 + 4, cy0 + 22 + i * 6, c1 - 4, cy0 + 22 + i * 6, ST.thin);
    sh.rect(c0 + 24, cy1, 24, 8, { s: '#000000', w: 0.45, f: W });
    sh.text(c0 + 36, cy1 + 5.5, 'pozzo caldo', { size: 1.2, anchor: 'middle' });
    p.eqTag(cxm + 18, cy0 + 7, '0MAG10', ['Condensatore', `${F(bt.pCond * 1000, 0)} mbar · ${F(bt.Qcond, 0)} MW`], { size: 1.8 });
    for (let i = 0; i < 3; i++) p.inst(c1 + 6 + i * 8, cy0 - 6, 'PT', { to: [c1 - 2, cy0], service: 'pressione condensatore (vuoto, 2oo3)', sys: '0MAG10', sis: i === 0, range: '0 – 300', unit: 'mbar a' });
    p.inst(c0 + 54, cy1 + 10, 'LT', { to: [c0 + 48, cy1 + 4], service: 'livello pozzo caldo', sys: '0MAG10' });
    p.inst(c0 + 64, cy1 + 10, 'LSHH', { to: [c0 + 48, cy1 + 6], service: 'livello altissimo pozzo caldo', sys: '0MAG10', sis: true });
    // acqua di circolazione
    p.off(392, 176, 'left', 'ACQUA CIRC.', 'pid202', { w: 24 });
    p.line('CWS', [[368, 176], [c1, 176]], { label: false });
    p.valve(330, 176, { line: 'CWS', kind: 'butterfly', act: 'mot', service: 'ingresso acqua condensatore' });
    p.line('CWR', [[c1, 200], [368, 200]], { label: false });
    p.valve(330, 200, { line: 'CWR', kind: 'butterfly', act: 'mot', service: 'uscita acqua condensatore' });
    p.off(368, 200, 'right', 'ALLA TORRE', 'pid202', { w: 24 });
    p.inst(352, 186, 'TT', { line: 'CWR', to: [352, 200], service: 'temperatura acqua uscita condensatore' });
    // estrazione condensato
    p.line('CDS', [[c0 + 36, cy1 + 8], [c0 + 36, 226], [150, 226]], { seg: 1, at: 0.5 });
    p.off(150, 226, 'left', 'CONDENSATO', 'pid109', { w: 28 });
    // reintegro
    p.off(150, 176, 'right', 'REINTEGRO DEMI', 'pid206', { w: 30 });
    p.line('MUC', [[180, 176], [c0, 176]], { label: false });
    p.valve(198, 176, { line: 'MUC', ctl: true, fail: 'FC', service: 'reintegro condensatore (livello pozzo caldo)', s: 1.9 });
    // bypass in ingresso
    sh.text(c0 + 2, cy0 - 2, 'ingressi bypass HP/RH/LP con diffusori', { size: 1.2 });
    p.off(160, 160, 'right', 'BYPASS', 'pid107', { w: 20 });
    sh.path([[180, 160], [c0 + 8, 160], [c0 + 8, cy0]], ST.med);
    // vuoto
    p.line('VAC', [[c0, 200], [84, 200]], { seg: 0, at: 0.25 });
    p.valve(204, 200, { line: 'VAC', act: 'mot', service: 'intercettazione aspirazione vuoto', s: 1.8 });
    for (let i = 0; i < 2; i++) {
      const x = 110 - i * 26;
      sh.line(x, 200, x, 209.4, ST.norm);
      pumpSym(sh, x, 213, { r: 3.6 });
      p.refEq(`0MAJ10AP00${i + 1}`);
      sh.text(x + 6, 220, `0MAJ10AP00${i + 1}`, { size: 1.3, bold: true });
    }
    sh.text(60, 196, 'pompe del vuoto ad anello liquido', { size: 1.25 });
    sh.line(170, 200, 170, 190, ST.norm);
    p.valve(170, 186, { line: 'VAC', dir: 'v', act: 'mot', kind: 'butterfly', service: 'rompivuoto condensatore', s: 1.8, tagSide: -1 });
    sh.path([[168.7, 180.4], [170, 182], [171.3, 180.4]], ST.thin);
    // drenaggi TV
    p.line('DRT', [[70, 156], [c0 + 14, 156], [c0 + 14, cy0]], { label: false });
    sh.text(100, 154, 'drenaggi TV e linee vapore → cassa di espansione', { size: 1.2 });
  } else {
    sh.line(cxm, yS + 14, cxm, 180, ST.heavy);
    p.line('ED', [[cxm, 180], [cxm, 196], [368, 196]], { seg: 1, at: 0.4 });
    p.off(368, 196, 'right', 'AEROCONDENSATORE', 'pid202', { w: 34 });
    p.inst(cxm + 14, 186, 'PT', { line: 'ED', to: [cxm, 186], service: 'pressione scarico TV (2oo3)', sis: true, range: '0 – 400', unit: 'mbar a' });
    p.off(170, 226, 'left', 'CONDENSATO', 'pid109', { w: 28 });
    sh.text(172, 222, 'dal serbatoio condensato ACC (PID aerocondensatore)', { size: 1.2 });
    p.off(140, 176, 'right', 'BYPASS', 'pid107', { w: 20 });
    sh.path([[160, 176], [cxm, 176]], ST.med);
  }
  p.off(392, 120, 'left', 'OLIO TV', 'pid112', { w: 20 });
  sh.text(372, 126, 'circuito olio TV', { size: 1.2 });
  return p.finish([
    `Pressione al condensatore di progetto ${F(bt.pCond * 1000, 0)} mbar con acqua ${M.water ? `a ${F(M.cfg.steam.condenser.TcwDesign, 1)} °C` : 'n.a. (aerocondensatore)'}; vapore tenute dal collettore ausiliario a 4 bar circa.`,
    'Valvole di ammissione TV (arresto e regolazione) a comando oleodinamico, fornitura TV; protezioni SIS per velocità, spostamento assiale e vuoto.',
  ]);
}

// ------------------------------------------------------------------ PID-109 condensato
export function pid109(M, reg, doc) {
  const p = new Pid(M, reg, doc, { title: 'Condensato principale' });
  const sh = p.sh;
  const N = M.N;
  p.off(24, 196, 'right', 'DAL POZZO CALDO', M.water ? 'pid108' : 'pid202', { w: 30 });
  p.line('CDS', [[54, 196], [70, 196], [70, 186]], { seg: 0, at: 0.3, label: false });
  sh.text(56, 193, M.lineById['CDS'].lineNo, { size: 1.3 });
  const pp = p.pumps(84, 173, { n: 2, pitch: 30, tag: '0LCB10AP', sucLine: 'CDS', disLine: 'CD-H' in M.lineById ? 'CD-H' : 'CD-1', service: 'pompe condensato' });
  sh.path([[70, 186], [pp.xS0, pp.yS]], ST.med);
  p.inst(62, 208, 'LSL', { to: [62, 196], service: 'protezione pompe (livello pozzo caldo basso)', sys: '0LCB10' });
  const cd = N > 1 ? 'CD-H' : 'CD-1';
  const yH = pp.yD;
  sh.line(pp.xD1, yH, 150, yH, ST.med);
  // iniezioni chimiche e campionamento
  sh.line(158, yH, 158, yH - 12, ST.thin);
  p.off(158, yH - 20, 'right', 'NH₃ / DEOSSIG.', 'pid207', { w: 30 });
  sh.line(158, yH - 12, 158, yH - 20, ST.thin);
  sh.line(170, yH, 170, yH + 10, ST.thin);
  sh.text(171, yH + 12, 'campione SWAS', { size: 1.2 });
  // condensatore vapore tenute
  sym.shellTube(sh, 186, yH - 6, 26, 12);
  p.refEq('0MAW10');
  sh.text(199, yH - 9, '0MAW10', { size: 1.5, anchor: 'middle', bold: true });
  p.line(cd, [[150, yH], [186, yH]], { seg: 0, at: 0.2 });
  sh.path([[180, yH], [180, yH + 12], [218, yH + 12], [218, yH]], ST.norm);
  p.valve(199, yH + 12, { line: cd, kind: 'globe', service: 'by-pass condensatore vapore tenute', s: 1.8, showTag: false });
  // misura portata e ricircolo
  sh.line(212, yH, 236, yH, ST.med);
  orifice(sh, 228, yH);
  p.inst(228, yH - 14, 'FT', { line: cd, to: [228, yH - 2], service: 'portata condensato' });
  sh.line(242, yH, 242, yH + 22, ST.norm);
  p.line('CDR', [[242, yH + 22], [242, 214], [300, 214]], { seg: 1, at: 0.6, label: false });
  p.valve(242, yH + 30, { line: 'CDR', dir: 'v', ctl: true, fail: 'FO', service: 'ricircolo minima portata pompe condensato' });
  p.inst(228, yH + 32, 'FIC', { line: 'CDR', to: [239, yH + 30], service: 'minima portata pompe condensato' });
  p.off(300, 214, 'right', 'AL CONDENSATORE', M.water ? 'pid108' : 'pid202', { w: 32 });
  // regolazione livello pozzo caldo
  p.line(cd, [[236, yH], [310 + (N - 1) * 30, yH]], { seg: 0, at: 0.8, label: false, arrow: false });
  p.ctrlStation(270, yH, { line: cd, fn: 'LIC', service: 'livello pozzo caldo / serbatoio condensato', ctrlY: yH - 16 });
  // distribuzione ai GVR
  const xs = [];
  for (let u = 1; u <= N; u++) xs.push(310 + (u - 1) * 30);
  xs.forEach((x, i) => {
    p.line('CD-1', [[x, yH], [x, 50], [x + 3, 50]], { label: i === 0, seg: 0, side: 1, at: 0.4 });
    p.valve(x, yH - 20, { line: 'CD-1', dir: 'v', act: 'mot', service: `condensato al GVR${i + 1}` });
    p.inst(x + 10, yH - 34, 'FT', { line: 'CD-1', to: [x, yH - 34], service: `portata condensato GVR${i + 1}` });
    p.off(x + 3, 50, 'right', `GVR${i + 1}`, 'pid106', { w: 22 });
  });
  return p.finish([
    `Pompe estrazione condensato 2×100 % (${F(M.pumps.cd.Q, 0)} m³/h, ${F(M.pumps.cd.H, 0)} m). Dosaggio ammoniaca e deossigenante a valle delle pompe.`,
    'Ricircolo di minima portata al condensatore regolato su misura di portata; valvola di regolazione livello con by-pass manuale.',
  ]);
}

// ------------------------------------------------------------------ PID-110 acqua alimento
export function pid110(M, reg, doc) {
  const p = new Pid(M, reg, doc, { title: 'Acqua alimento HP/IP', typical: true });
  const sh = p.sh;
  p.off(24, 196, 'right', M.n > 1 ? 'DAL CORPO LP' : 'DA PRERISCALD.', 'pid106', { w: 28 });
  p.line('FWS-1', [[52, 196], [70, 196]], { label: false });
  sh.text(54, 193, M.lineById['FWS-1'].lineNo, { size: 1.3 });
  const yP = 173;
  const pp = p.pumps(92, yP, { n: 2, pitch: 40, tag: '1LAC10AP', sucLine: 'FWS-1', disLine: 'FW-1', service: 'pompe alimento' });
  sh.path([[70, 196], [70, pp.yS], [pp.xS0, pp.yS]], ST.med);
  p.inst(62, 210, 'PDT', { to: [70, 198], service: 'intasamento filtri aspirazione pompe alimento', sys: '1LAC10', range: '0 – 500', unit: 'mbar' });
  // valvole di ricircolo automatico (ARC) di minima portata
  const yM = 128;
  pp.xs.forEach((x, i) => {
    sh.path([[x + 4, 152], [x + 18, 152], [x + 18, yM]], ST.norm);
    p.valve(x + 13, 152, { line: 'MIN-1', kind: 'globe', act: 'pneu', fail: 'FO', service: `ricircolo automatico minima portata pompa ${i + 1} (ARC)`, s: 1.6, showTag: false });
  });
  sh.text(pp.xs[1] + 20, 140, 'valvole ARC', { size: 1.2 });
  p.line('MIN-1', [[pp.xs[0] + 18, yM], [pp.xs[1] + 18, yM], [200, yM]], { seg: 1, at: 0.25 });
  p.off(200, yM, 'right', M.n > 1 ? 'MINIMA PORTATA' : 'AL CONDENSATORE', M.n > 1 ? 'pid106' : 'pid108', { w: 30 });
  // mandata
  const yD = pp.yD;
  p.line('FW-1', [[pp.xD1, yD], [372, yD]], { seg: 0, at: 0.55 });
  p.off(372, yD, 'right', 'ALIMENTO HP', 'pid104', { w: 28 });
  p.inst(190, yD + 11, 'PT', { line: 'FW-1', to: [190, yD], service: 'pressione mandata pompe alimento' });
  p.inst(200, yD + 11, 'TT', { line: 'FW-1', to: [200, yD], service: 'temperatura acqua alimento' });
  p.inst(210, yD + 11, 'FT', { line: 'FW-1', to: [210, yD], service: 'portata totale acqua alimento' });
  // spillamenti di attemperamento
  const taps = [['SPH-1', 'SPRAY HP', 'pid104'], ['SPB-1', 'SPRAY BYPASS HP', 'pid107']];
  taps.forEach(([id, txt, tgt], i) => {
    const x = 250 + i * 50;
    p.dot(x, yD);
    p.line(id, [[x, yD], [x, 60], [x + 6, 60]], { label: false });
    p.valve(x, yD - 26, { line: id, dir: 'v', act: 'mot', service: `intercettazione ${txt.toLowerCase()}`, s: 1.8 });
    sh.text(x + 2, 72, M.lineById[id].lineNo, { size: 1.2 });
    p.off(x + 6, 60, 'right', txt, tgt, { w: 32 });
  });
  if (M.reheat) {
    // spillamento intermedio IP
    pp.xs.forEach((x) => sh.path([[x - 3, yP - 3], [x - 3, 164]], ST.norm));
    p.line('FWIP-1', [[pp.xs[1] - 3, 164], [52, 164], [52, 76], [150, 76]], { seg: 2, at: 0.3 });
    p.off(150, 76, 'right', 'ALIMENTO IP', 'pid105', { w: 28 });
    p.dot(100, 76);
    p.line('SPRH-1', [[100, 76], [100, 48], [150, 48]], { label: false });
    p.valve(100, 62, { line: 'SPRH-1', dir: 'v', act: 'mot', service: 'intercettazione spray RH', s: 1.8 });
    p.off(150, 48, 'right', 'SPRAY RH', 'pid105', { w: 24 });
    sh.text(102, 44, M.lineById['SPRH-1'].lineNo, { size: 1.2 });
    sh.text(56, 168, 'spillamento intermedio IP', { size: 1.2 });
  }
  // refrigeranti pompe
  p.off(330, 204, 'left', 'CICLO CHIUSO', 'pid203', { w: 24 });
  p.line('CC-1LAC10AC001', [[306, 204], [150, 204], [150, 190]], { seg: 0, at: 0.4 });
  sh.text(152, 200, 'refrigeranti tenute e cuscinetti pompe', { size: 1.2 });
  p.inst(160, 222, 'VT', { to: [pp.xs[1] + 3, yP + 3], service: 'vibrazioni pompe alimento', sys: '1LAC10' });
  return p.finish([
    `Pompe alimento 2×100 % a barile multistadio (${F(M.pumps.fw1.Q, 0)} m³/h, ${F(M.pumps.fw1.H, 0)} m, ${F(M.pumps.fw1.kW, 0)} kW) con valvole di ricircolo automatico di minima portata.`,
    M.reheat ? 'Acqua IP prelevata da uno stadio intermedio delle pompe; spillamenti per desurriscaldatori HP, RH e bypass HP.' : 'Spillamenti per desurriscaldatori HP e bypass HP.',
  ]);
}

// ------------------------------------------------------------------ PID-111 spurghi e drenaggi
export function pid111(M, reg, doc) {
  const p = new Pid(M, reg, doc, { title: 'GVR – spurghi e drenaggi', typical: true });
  const sh = p.sh;
  const tx = 230, ty = 70;
  vvessel(sh, tx, ty, 30, 70);
  p.eqTag(tx + 15, ty + 80, '1HAN10BB001', 'Serbatoio spurghi atmosferico');
  // sfiato vapore flash
  sh.line(tx + 15, ty, tx + 15, ty - 22, ST.med);
  sym.silencer(sh, tx + 15, ty - 22, 6, 10);
  sh.text(tx + 20, ty - 26, 'sfiato vapore flash', { size: 1.25 });
  // ingressi
  // con evaporatore HP Benson: nessuno spurgo HP, drenaggio del separatore all'avviamento
  const ins = M.benson ? [] : [['BD-1', 'SPURGO CONTINUO HP', 'pid104']];
  for (let k = 1; k < M.n; k++) ins.push([`CBD-${M.names[k]}-1`, `SPURGO CONTINUO ${M.names[k]}`, k === M.n - 1 ? 'pid106' : 'pid105']);
  ins.push(M.benson ? ['SEPD-1', 'DRENAGGIO SEPARATORE HP', 'pid104'] : ['IBD-1', 'SPURGO INTERMITT. HP', 'pid104']);
  ins.push(['DRH-1', 'DRENAGGI SH HP', 'pid104']);
  ins.forEach(([id, txt, tgt], i) => {
    const y = 80 + i * 12;
    p.off(24, y, 'right', txt, tgt, { w: 38 });
    p.line(id, [[62, y], [tx, y]], { seg: 0, at: 0.35 });
    if (i < ins.length - 2) {
      p.valve(150, y, { line: id, kind: 'globe', service: `regolazione manuale ${txt.toLowerCase()}` });
      p.valve(170, y, { line: id, act: 'mot', service: `intercettazione ${txt.toLowerCase()}` });
    } else p.valve(170, y, { line: id, kind: 'check', service: `non ritorno ${txt.toLowerCase()}` });
  });
  // acqua di raffreddamento (quench) e scarico
  p.off(392, 100, 'left', 'ACQUA SERVIZI', 'pid205', { w: 26 });
  p.line('SV-H', [[366, 100], [tx + 30, 100]], { label: false });
  p.valve(320, 100, { line: 'SV-H', ctl: true, fail: 'FO', service: 'acqua di raffreddamento scarico spurghi' });
  p.inst(300, 166, 'TIC', { line: 'WW-BD', to: [tx + 15, 176], service: 'temperatura scarico spurghi ≤ 40 °C' });
  p.signal([[300, 162.8], [300, 116], [320, 116], [320, 106]]);
  p.line('WW-BD', [[tx + 15, ty + 70], [tx + 15, 196], [366, 196]], { seg: 1, at: 0.5 });
  p.off(366, 196, 'right', 'ACQUE REFLUE', 'pid208', { w: 28 });
  p.inst(tx + 40, ty + 40, 'LT', { to: [tx + 30, ty + 40], service: 'livello serbatoio spurghi', sys: '1HAN10' });
  p.inst(tx + 40, 188, 'TT', { line: 'WW-BD', to: [tx + 15, 188], service: 'temperatura scarico spurghi' });
  // collettore drenaggi turbina
  sh.text(30, 210, `Drenaggi della TV e delle linee vapore principali: alla cassa di espansione del condensatore (linea ${M.lineById['DRT'].lineNo}, vedi P&ID TV).`, { size: 1.4 });
  return p.finish([
    'Spurgo continuo regolato manualmente in base alla conducibilità dei corpi cilindrici (vedi P&ID chimici e campionamento); spurgo intermittente motorizzato su comando.',
    'Scarico verso le acque reflue raffreddato a ≤ 40 °C con acqua servizi.',
  ]);
}
