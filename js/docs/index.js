// Catalogo degli elaborati di ingegneria generati dal modello: numerazione,
// costruzione dei fogli, esportazione PDF/SVG/CSV.

import { engineeringModel } from './engineering.js';
import { tableSheets, sheetToSVG } from './sheet.js';
import { buildPdf } from './pdf.js';
import { pfdSheets, pid1Sheets, pid2Sheets, pid3Sheets } from './drawings-process.js';
import { plotPlanSheets, plantIsoSheets, pipingIsoSheets, sld1Sheets, sld2Sheets } from './drawings-layout.js';

const n = (v, d = 1) => (Number.isFinite(v) ? v.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }) : '');

const FLUIDS = {
  FG: 'Gas naturale', MS: 'Vapore HP', CR: 'Vapore RH freddo', HR: 'Vapore RH caldo', IS: 'Vapore IP', LS: 'Vapore LP',
  FW: 'Acqua alimento', SW: 'Acqua attemperamento', CD: 'Condensato', BP: 'Vapore di bypass', BD: 'Spurghi',
  CW: 'Acqua di circolazione', ED: 'Vapore di scarico TV',
};

// ------------------------------------------------------------------ liste
function lineListTable(M) {
  const columns = [
    { key: 'lineNo', title: 'Numero linea', w: 30 }, { key: 'kks', title: 'KKS', w: 20 }, { key: 'fluid', title: 'Fluido', w: 22 },
    { key: 'from', title: 'Da', w: 36 }, { key: 'to', title: 'A', w: 36 }, { key: 'DN', title: 'DN', w: 9, align: 'right' },
    { key: 'odt', title: 'OD × s [mm]', w: 19, align: 'right' }, { key: 'mat', title: 'Materiale', w: 18 }, { key: 'cls', title: 'Classe', w: 10, align: 'right' },
    { key: 'm', title: 'Portata [kg/s]', w: 13, align: 'right' }, { key: 'p', title: 'p eserc. [bar a]', w: 13, align: 'right' },
    { key: 'T', title: 'T eserc. [°C]', w: 12, align: 'right' }, { key: 'vel', title: 'Vel. [m/s]', w: 11, align: 'right' },
    { key: 'pD', title: 'p prog. [bar a]', w: 13, align: 'right' }, { key: 'TD', title: 'T prog. [°C]', w: 12, align: 'right' },
    { key: 'test', title: 'Prova [bar g]', w: 12, align: 'right' }, { key: 'ins', title: 'Coib. [mm]', w: 11, align: 'right' },
  ];
  const rows = [];
  let lastUnit = null;
  for (const l of M.lines) {
    if (l.unit !== lastUnit) { rows.push({ group: l.unit === 0 ? 'Linee comuni' : `Treno ${l.unit} (GVR${l.unit})` }); lastUnit = l.unit; }
    rows.push({
      lineNo: l.lineNo, kks: l.kks, fluid: FLUIDS[l.fluid] || l.fluid, from: l.from, to: l.to, DN: l.DN,
      odt: `${n(l.OD, 1)} × ${n(l.tnom, 1)}`, mat: l.matShort, cls: `${l.cls}#`, m: n(l.m, 2), p: l.p < 1 ? n(l.p, 3) : n(l.p, 1), T: n(l.T, 0),
      vel: n(l.vel, 1), pD: n(l.pDes, 1), TD: n(l.TDes, 0), test: n(l.test, 1), ins: l.ins.t ? `${l.ins.code} ${l.ins.t}` : l.ins.code,
    });
  }
  return { columns, rows, notes: [
    'Diametri scelti per la velocità massima ammessa (vapore HP 45 m/s, RH caldo 55 m/s, vapore IP/LP e RH freddo 40 m/s, acqua alimento 3 m/s, condensato 2 m/s, aspirazioni 1-1,2 m/s, acqua di circolazione 2,5 m/s, gas 20 m/s) con portata di progetto pari al 110 % della portata al punto ISO.',
    'Spessore minimo secondo ASME B31.1 104.1.2: t = P·D / 2(S·E + P·y) + c, con tolleranza di laminazione 12,5 %. Classe di rating secondo ASME B16.34 (valori preliminari). Pressione di progetto = 1,1 × esercizio, temperatura di progetto = esercizio + 10 °C (vapore).',
  ] };
}

function equipmentTable(M) {
  const columns = [
    { key: 'no', title: 'N.', w: 7 }, { key: 'tag', title: 'Tag KKS', w: 24 }, { key: 'desc', title: 'Descrizione', w: 50 },
    { key: 'qty', title: 'Q.tà', w: 16 }, { key: 'kind', title: 'Tipo / costruzione', w: 50 }, { key: 'data', title: 'Dati principali', w: 110 },
    { key: 'pDes', title: 'P prog. [bar]', w: 13, align: 'right' }, { key: 'TDes', title: 'T prog. [°C]', w: 13, align: 'right' },
    { key: 'mat', title: 'Materiale', w: 30 }, { key: 'kW', title: 'P el. [kW]', w: 13, align: 'right' },
  ];
  const rows = M.eq.map((e) => (e.group ? { group: e.group } : e));
  return { columns, rows, notes: [
    `Codifica KKS semplificata; "1..${M.N}" indica apparecchiature uguali per ciascun treno. Superfici di scambio stimate con coefficienti globali tipici riferiti alla superficie alettata.`,
    'Spessore dei corpi cilindrici secondo ASME VIII Div.1 UG-27 con S = 118 MPa (SA-516 Gr.70) e sovraspessore di corrosione 3 mm.',
  ] };
}

function loadTable(M) {
  const columns = [
    { key: 'no', title: 'N.', w: 7 }, { key: 'tag', title: 'Tag KKS', w: 24 }, { key: 'desc', title: 'Utenza', w: 70 },
    { key: 'q', title: 'Inst./eserc.', w: 14, align: 'center' }, { key: 'kV', title: 'V [kV]', w: 10, align: 'right' },
    { key: 'rated', title: 'Pn [kW]', w: 14, align: 'right' }, { key: 'abs', title: 'Pa albero [kW]', w: 14, align: 'right' },
    { key: 'eff', title: 'η', w: 10, align: 'right' }, { key: 'pf', title: 'cosφ', w: 10, align: 'right' }, { key: 'ku', title: 'Ku', w: 9, align: 'right' },
    { key: 'duty', title: 'Serv.', w: 9, align: 'center' }, { key: 'cont', title: 'P contemp. [kW]', w: 16, align: 'right' },
    { key: 'kvar', title: 'Q contemp. [kvar]', w: 16, align: 'right' }, { key: 'board', title: 'Quadro', w: 28 },
  ];
  const rows = [];
  const groups = [['Media tensione 6 kV', (l) => l.kV >= 1], ['Bassa tensione 400 V', (l) => l.kV < 1]];
  let i = 0;
  for (const [g, flt] of groups) {
    rows.push({ group: g });
    for (const l of M.loads.filter(flt)) {
      rows.push({
        no: String(++i), tag: l.tag, desc: l.desc, q: `${l.qtyInst}/${l.qtyOp}`, kV: n(l.kV, l.kV < 1 ? 1 : 0), rated: n(l.rated, l.rated < 10 ? 1 : 0),
        abs: n(l.abs, 0), eff: n(l.eff, 2), pf: n(l.pf, 2), ku: n(l.ku, 2), duty: l.duty, cont: n(l.cont, 0), kvar: n(l.kvar, 0), board: l.board,
      });
    }
  }
  const S = M.electrical.summary;
  return {
    columns, rows,
    totals: [
      `Totale MT: ${n(S.mvP, 0)} kW · ${n(S.mvQ, 0)} kvar    Totale BT: ${n(S.lvP, 0)} kW · ${n(S.lvQ, 0)} kvar (${n(S.lvKVA, 0)} kVA)`,
      `Carico ausiliario contemporaneo: ${n(S.totKW / 1000, 2)} MW · ${n(S.totKVA / 1000, 2)} MVA — stima del simulatore ${n(S.simAux / 1000, 2)} MW`,
    ],
    notes: [
      'Servizio: C continuo, I intermittente (coefficiente 0,3), S riserva o solo avviamento (non contemporaneo). P contemporanea = n. in esercizio × Pa/η × Ku.',
      'Le utenze ridondate (A/B) sono ripartite sulle due semisbarre. L\'avviatore statico SFC è un carico intermittente di avviamento e determina il dimensionamento dei trasformatori di unità.',
    ],
  };
}

// ------------------------------------------------------------------ catalogo
export function documentCatalog(meta) {
  const P = meta.prefix || 'CCGT';
  return [
    { id: 'pfd', number: `${P}-PR-PFD-001`, title: 'Schema di processo (PFD) e bilancio di massa ed energia', short: 'PFD e bilancio H&MB', group: 'Processo', build: pfdSheets },
    { id: 'pid1', number: `${P}-PR-PID-001`, title: 'P&ID turbogas e gas combustibile', short: 'P&ID turbogas', group: 'Processo', build: pid1Sheets },
    { id: 'pid2', number: `${P}-PR-PID-002`, title: 'P&ID GVR circuito acqua/vapore', short: 'P&ID GVR', group: 'Processo', build: pid2Sheets },
    { id: 'pid3', number: `${P}-PR-PID-003`, title: 'P&ID turbina a vapore, condensato e alimento', short: 'P&ID TV e condensato', group: 'Processo', build: pid3Sheets },
    { id: 'll', number: `${P}-PI-LST-001`, title: 'Line list', short: 'Line list', group: 'Liste', table: lineListTable, csv: true },
    { id: 'el', number: `${P}-ME-LST-001`, title: 'Equipment list', short: 'Equipment list', group: 'Liste', table: equipmentTable, csv: true },
    { id: 'load', number: `${P}-EL-LST-001`, title: 'Load list – elenco utenze elettriche', short: 'Load list', group: 'Liste', table: loadTable, csv: true },
    { id: 'sld1', number: `${P}-EL-SLD-001`, title: 'Schema unifilare AT e generazione', short: 'Unifilare AT', group: 'Elettrico', build: sld1Sheets },
    { id: 'sld2', number: `${P}-EL-SLD-002`, title: 'Schema unifilare servizi ausiliari MT/BT', short: 'Unifilare MT/BT', group: 'Elettrico', build: sld2Sheets },
    { id: 'pp', number: `${P}-CV-PLT-001`, title: 'Planimetria generale (plot plan)', short: 'Plot plan', group: 'Layout', build: plotPlanSheets },
    { id: 'iso', number: `${P}-GA-ISO-001`, title: 'Vista isometrica d\'insieme', short: 'Vista isometrica', group: 'Layout', build: plantIsoSheets },
    { id: 'piso', number: `${P}-PI-ISO-001`, title: 'Isometrico linea vapore HP', short: 'Isometrico vapore HP', group: 'Layout', build: pipingIsoSheets },
  ];
}

/** Genera i fogli di un documento. */
export function buildDocument(M, entry) {
  const doc = { number: entry.number, title: entry.title, scale: '—' };
  if (entry.table) {
    const t = entry.table(M);
    return tableSheets(M.meta, doc, t.columns, t.rows, { notes: t.notes, totals: t.totals });
  }
  return entry.build(M, doc);
}

/** Elenco elaborati (prima pagina del pacchetto). */
export function registerSheets(M, catalog, sheetCounts) {
  const columns = [
    { key: 'no', title: 'N.', w: 8 }, { key: 'number', title: 'Numero documento', w: 40 }, { key: 'title', title: 'Titolo', w: 120 },
    { key: 'group', title: 'Disciplina', w: 24 }, { key: 'sheets', title: 'Fogli', w: 12, align: 'right' }, { key: 'rev', title: 'Rev.', w: 10, align: 'center' },
    { key: 'fmt', title: 'Formato', w: 14, align: 'center' },
  ];
  const rows = catalog.map((c, i) => ({ no: String(i + 1), number: c.number, title: c.title, group: c.group, sheets: String(sheetCounts[c.id] ?? ''), rev: M.meta.rev, fmt: 'A3' }));
  const r = M.r;
  return tableSheets(M.meta, { number: `${M.meta.prefix}-GE-REG-001`, title: 'Elenco elaborati', subtitle: `${M.N}+1 · ${M.gtClass} · ${n(r.net, 1)} MW netti · η ${n(r.eta * 100, 2)} %`, scale: '—' }, columns, rows, {
    notes: [
      'Elaborati generati automaticamente dal punto di progetto del simulatore (ISO 15 °C, 1013 mbar, 60 % UR, carico base). Livello di definizione: ingegneria di base / prefattibilità, da sviluppare con i dati dei fornitori.',
    ],
  });
}

export function csvFor(M, entry) {
  const t = entry.table(M);
  const esc = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [t.columns.map((c) => esc(c.title)).join(';')];
  for (const r of t.rows) {
    if (r.group) { lines.push(esc(r.group)); continue; }
    lines.push(t.columns.map((c) => esc(r[c.key])).join(';'));
  }
  for (const tt of t.totals || []) lines.push(esc(tt));
  return '﻿' + lines.join('\r\n');
}

export { engineeringModel, sheetToSVG, buildPdf };
