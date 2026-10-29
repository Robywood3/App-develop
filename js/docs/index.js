// Catalogo degli elaborati di ingegneria generati dal modello: numerazione,
// costruzione dei fogli, esportazione PDF/SVG/CSV.

import { engineeringModel } from './engineering.js';
import { tableSheets, sheetToSVG } from './sheet.js';
import { buildPdf } from './pdf.js';
import { pfdSheets } from './drawings-process.js';
import { newRegistry } from './pidkit.js';
import * as PP from './pids-process.js';
import * as PU from './pids-util.js';
import { casesTable, pfdGasSheets, pfdSteamSheets, pfdCoolingSheets, pfdWaterSheets, pfdFuelSheets } from './pfds.js';
import { plotPlanSheets, plantIsoSheets, pipingIsoSheets, sld1Sheets, sld2Sheets } from './drawings-layout.js';

const n = (v, d = 1) => (Number.isFinite(v) ? v.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }) : '');

const FLUIDS = {
  FG: 'Gas naturale', MS: 'Vapore HP', CR: 'Vapore RH freddo', HR: 'Vapore RH caldo', IS: 'Vapore IP', LS: 'Vapore LP',
  FW: 'Acqua alimento', SW: 'Acqua attemperamento', SP: 'Acqua attemperamento', CD: 'Condensato', BP: 'Vapore di bypass', BD: 'Spurghi',
  CW: 'Acqua di circolazione', ED: 'Vapore di scarico TV', NG: 'Gas naturale (stazione)', RW: 'Acqua grezza', WW: 'Acque reflue',
  CH: 'Prodotti chimici', CC: 'Acqua ciclo chiuso', DM: 'Acqua demineralizzata', IA: 'Aria strumenti', SA: 'Aria servizi',
  SV: 'Acqua servizi', FF: 'Acqua antincendio', SM: 'Campioni', OW: 'Acque oleose', NI: 'Azoto', HY: 'Idrogeno', CO: 'Anidride carbonica',
  AS: 'Vapore ausiliario', GS: 'Vapore tenute', DO: 'Gasolio', DR: 'Drenaggi', VE: 'Sfiati / incondensabili', LO: 'Olio di lubrificazione',
};

// ------------------------------------------------------------------ registro P&ID
/** Rende tutti i P&ID del catalogo una sola volta e conserva fogli e registro sul modello. */
export function pidRegistry(M) {
  if (M._pid && M._pid.sig === M.meta.prefix) return M._pid;
  const cat = documentCatalog(M.meta, M);
  const byId = Object.fromEntries(cat.map((c) => [c.id, c.number]));
  const reg = newRegistry((id) => byId[id] || '');
  const sheets = {};
  for (const c of cat) {
    if (!c.pid) continue;
    sheets[c.id] = c.pid(M, reg, { number: c.number, title: c.title, scale: 'non in scala' });
  }
  M._pid = { sig: M.meta.prefix, reg, sheets };
  return M._pid;
}
const typicalIds = (id) => [id, id.replace(/-([2-9])$/, '-1'), id.replace(/^CC-[2-9]/, 'CC-1')];
function pidsOfLine(M, id) {
  const { reg } = pidRegistry(M);
  for (const k of typicalIds(id)) if (reg.lineRefs.has(k)) return [...reg.lineRefs.get(k)].join(', ');
  return '';
}
function pidsOfEq(M, tag) {
  const { reg } = pidRegistry(M);
  if (reg.eqRefs.has(tag)) return [...reg.eqRefs.get(tag)].join(', ');
  const base = tag.replace(/^1\.\.\d/, '1').split(/\/|\.\./)[0];
  const set = new Set();
  for (const [r, docs] of reg.eqRefs) if (r === base || r.startsWith(base) || (base.length > 6 && base.startsWith(r))) docs.forEach((d) => set.add(d));
  return [...set].sort().join(', ');
}
const shortPid = (s) => s.replace(/^[^-]+-[A-Z]{2}-PID-/g, 'PID-').replace(/, [^-,]+-[A-Z]{2}-PID-/g, ', PID-');

// ------------------------------------------------------------------ liste
function lineListTable(M) {
  const columns = [
    { key: 'lineNo', title: 'Numero linea', w: 30 }, { key: 'kks', title: 'KKS', w: 20 }, { key: 'fluid', title: 'Fluido', w: 22 },
    { key: 'from', title: 'Da', w: 36 }, { key: 'to', title: 'A', w: 36 }, { key: 'DN', title: 'DN', w: 9, align: 'right' },
    { key: 'odt', title: 'OD × s [mm]', w: 19, align: 'right' }, { key: 'mat', title: 'Materiale', w: 18 }, { key: 'cls', title: 'Classe', w: 13, align: 'right' },
    { key: 'm', title: 'Portata [kg/s]', w: 13, align: 'right' }, { key: 'p', title: 'p eserc. [bar a]', w: 13, align: 'right' },
    { key: 'T', title: 'T eserc. [°C]', w: 12, align: 'right' }, { key: 'vel', title: 'Vel. [m/s]', w: 11, align: 'right' },
    { key: 'pD', title: 'p prog. [bar a]', w: 13, align: 'right' }, { key: 'TD', title: 'T prog. [°C]', w: 12, align: 'right' },
    { key: 'test', title: 'Prova [bar g]', w: 12, align: 'right' }, { key: 'ins', title: 'Coib. [mm]', w: 11, align: 'right' },
    { key: 'pid', title: 'P&ID', w: 26 },
  ];
  const rows = [];
  let lastUnit = null;
  for (const l of M.lines) {
    if (l.unit !== lastUnit) { rows.push({ group: l.unit === 0 ? 'Linee comuni' : `Treno ${l.unit} (GVR${l.unit})` }); lastUnit = l.unit; }
    rows.push({
      lineNo: l.lineNo, kks: l.kks, fluid: FLUIDS[l.fluid] || l.fluid, from: l.from, to: l.to, DN: l.DN,
      odt: `${n(l.OD, 1)} × ${n(l.tnom, 1)}`, mat: l.matShort, cls: l.clsLabel, m: n(l.m, 2), p: l.p < 1 ? n(l.p, 3) : n(l.p, 1), T: n(l.T, 0),
      vel: n(l.vel, 1), pD: n(l.pDes, 1), TD: n(l.TDes, 0), test: n(l.test, 1), ins: l.ins.t ? `${l.ins.code} ${l.ins.t}` : l.ins.code, pid: shortPid(pidsOfLine(M, l.id)),
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
    { key: 'pid', title: 'P&ID', w: 26 },
  ];
  const rows = M.eq.map((e) => (e.group ? { group: e.group } : { ...e, pid: shortPid(pidsOfEq(M, e.tag)) }));
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

function instrumentTable(M) {
  const { reg } = pidRegistry(M);
  const columns = [
    { key: 'no', title: 'N.', w: 8 }, { key: 'tag', title: 'Tag KKS', w: 26 }, { key: 'fn', title: 'Funz.', w: 11 }, { key: 'desc', title: 'Tipo', w: 52 },
    { key: 'service', title: 'Servizio', w: 92 }, { key: 'line', title: 'Linea', w: 32 }, { key: 'range', title: 'Campo', w: 24, align: 'right' },
    { key: 'unit', title: 'Unità', w: 14 }, { key: 'io', title: 'I/O', w: 16 }, { key: 'signal', title: 'Segnale', w: 22 }, { key: 'pid', title: 'P&ID', w: 26 },
  ];
  const list = [...reg.instruments].sort((a, b) => (a.pid === b.pid ? a.tag.localeCompare(b.tag) : a.pid.localeCompare(b.pid)));
  const rows = [];
  let last = null, i = 0;
  for (const it of list) {
    if (it.pid !== last) { rows.push({ group: `P&ID ${it.pid}` }); last = it.pid; }
    rows.push({ ...it, no: String(++i), pid: shortPid(it.pid) });
  }
  const nSis = list.filter((x) => /SIS/.test(x.io)).length;
  const nAI = list.filter((x) => /^AI/.test(x.io)).length, nDI = list.filter((x) => /^DI/.test(x.io)).length;
  return { columns, rows, totals: [`Totale strumenti: ${list.length} · ingressi analogici ${nAI} · ingressi digitali ${nDI} · funzioni SIS ${nSis}`], notes: [
    'Elenco generato dai P&ID: ogni strumento disegnato è registrato con tag KKS (…C + codice grandezza + numero), funzione ISA, servizio, linea e campo di misura stimato dalle condizioni di progetto della linea.',
    M.N > 1 ? `I P&ID tipici di treno riportano i tag del treno 1; per i treni 2…${M.N} i tag si ottengono sostituendo la prima cifra.` : 'Configurazione a un treno.',
  ] };
}

function valveTable(M) {
  const { reg } = pidRegistry(M);
  const columns = [
    { key: 'no', title: 'N.', w: 8 }, { key: 'tag', title: 'Tag KKS', w: 26 }, { key: 'type', title: 'Tipo', w: 40 }, { key: 'DN', title: 'DN', w: 10, align: 'right' },
    { key: 'cls', title: 'Classe', w: 14, align: 'right' }, { key: 'mat', title: 'Materiale', w: 18 }, { key: 'act', title: 'Attuatore', w: 34 }, { key: 'fail', title: 'Pos. sicurezza', w: 16, align: 'center' },
    { key: 'service', title: 'Servizio', w: 92 }, { key: 'line', title: 'Linea', w: 32 }, { key: 'pD', title: 'p prog. [bar a]', w: 14, align: 'right' },
    { key: 'TD', title: 'T prog. [°C]', w: 13, align: 'right' }, { key: 'pid', title: 'P&ID', w: 26 },
  ];
  const list = [...reg.valves].sort((a, b) => (a.pid === b.pid ? a.tag.localeCompare(b.tag) : a.pid.localeCompare(b.pid)));
  const rows = [];
  let last = null, i = 0;
  for (const v of list) {
    if (v.pid !== last) { rows.push({ group: `P&ID ${v.pid}` }); last = v.pid; }
    rows.push({ ...v, no: String(++i), DN: String(v.DN), pD: n(v.pDes, 1), TD: n(v.TDes, 0), pid: shortPid(v.pid) });
  }
  const cnt = (f) => list.filter(f).length;
  return { columns, rows, totals: [`Totale valvole: ${list.length} · regolazione ${cnt((v) => /Regolazione/.test(v.type))} · motorizzate ${cnt((v) => v.act === 'Motorizzato')} · sicurezza ${cnt((v) => /Sicurezza/.test(v.type))} · manuali ${cnt((v) => v.act === 'Manuale')}`], notes: [
    'Elenco generato dai P&ID. DN, classe di rating, materiale e condizioni di progetto ereditati dalla linea su cui la valvola è installata (valvole di sfiato e drenaggio: DN ridotto). Taratura valvole di sicurezza = pressione di progetto della linea.',
  ] };
}

function utilitiesTable(M) {
  const U = M.U;
  const columns = [{ key: 'item', title: 'Voce', w: 120 }, { key: 'val', title: 'Valore', w: 30, align: 'right' }, { key: 'unit', title: 'Unità', w: 22 }, { key: 'note', title: 'Note', w: 140 }];
  const rows = [];
  const g = (t) => rows.push({ group: t });
  const r = (item, v, unit, note = '', d = 1) => rows.push({ item, val: typeof v === 'string' ? v : n(v, d), unit, note });
  g('Gas naturale');
  r('Portata gas totale', U.gas.Sm3h, 'Sm³/h', `${n(U.gas.mFuel, 2)} kg/s`, 0);
  r('Pressione di consegna / ai TG', `${n(U.gas.pIn, 0)} / ${n(U.gas.pOut, 1)}`, 'bar a');
  r('Potenza riscaldatori stazione', U.gas.heaterKW, 'kW', `preriscaldo a ${n(U.gas.preheatT, 0)} °C`, 0);
  r('Potenza riscaldatori di prestazione', U.gas.perfHeaterKW, 'kW', `gas a ${M.cfg.gt.Tfuel} °C`, 0);
  g(M.water ? 'Raffreddamento principale (torre)' : 'Raffreddamento principale (aerocondensatore)');
  r('Calore scaricato', U.cooling.Qcond, 'MW');
  if (M.water) {
    r('Portata acqua di circolazione', U.cooling.cwM3h, 'm³/h', '', 0);
    r('Evaporazione', U.cooling.evapM3h, 'm³/h', '', 1);
    r('Spurgo', U.cooling.blowdownM3h, 'm³/h', `${U.cooling.coc} cicli di concentrazione`, 1);
    r('Reintegro', U.cooling.makeupM3h, 'm³/h', '', 1);
    r('Ipoclorito di sodio', U.cooling.hypo, 'kg/h', '', 2);
    r('Antincrostante', U.cooling.antiscalant, 'kg/h', '', 2);
  }
  g('Ciclo chiuso');
  r('Carico termico', U.ccw.kW, 'kW', `${U.ccw.users.length} utenze`, 0);
  r('Portata', U.ccw.m3h, 'm³/h', `ΔT ${U.ccw.dT} K`, 0);
  g('Acqua');
  r('Acqua grezza', U.rawWaterM3h, 'm³/h', '', 1);
  r('Acqua demineralizzata (media)', U.demi.demiM3h, 'm³/h', `impianto ${n(U.demi.plantM3h, 0)} m³/h · serbatoio ${n(U.demi.tankM3, 0)} m³`, 1);
  r('Reintegro ciclo acqua-vapore', (U.demi.cycleMakeup * 3600) / 998, 'm³/h', '', 2);
  r('Acque reflue', U.ww.totalM3h, 'm³/h', '', 1);
  g('Aria compressa e gas tecnici');
  r('Aria strumenti', U.air.instrument, 'Nm³/h', '', 0);
  r('Aria servizi', U.air.service, 'Nm³/h', '', 0);
  r('Capacità compressori', U.air.compressorNm3h, 'Nm³/h', '2×100 %', 0);
  r('Azoto in esercizio / per fermata', `${n(U.gases.n2Nm3d, 0)} / ${n(U.gases.n2LayupNm3, 0)}`, 'Nm³', 'giornaliero / fermata');
  r('Idrogeno (reintegro generatori)', U.gases.h2Nm3d, 'Nm³/giorno', '', 0);
  g('Vapore ausiliario e chimici ciclo');
  r('Capacità caldaia ausiliaria', U.auxSteam.boilerCapacity * 3.6, 't/h', `${U.auxSteam.p} bar · ${U.auxSteam.T} °C`, 1);
  r('Vapore tenute TV', U.auxSteam.gland * 3.6, 't/h', '', 1);
  r('Ammoniaca', U.chem.ammonia, 'kg/h', '', 2);
  r('Deossigenante', U.chem.scavenger * 1000, 'g/h', '', 0);
  r('Fosfato trisodico', U.chem.phosphate * 1000, 'g/h', '', 0);
  g('Potenza ausiliaria per sistema');
  for (const b of U.breakdown) r(b.name, b.MW, 'MW', '', 2);
  return { columns, rows, notes: ['Valori al punto di progetto ISO a pieno carico, calcolati con il bilancio utilities del simulatore (vedi anche PFD bilancio idrico e casi di funzionamento).'] };
}

// ------------------------------------------------------------------ catalogo
export function documentCatalog(meta, M = null) {
  const P = meta.prefix || 'CCGT';
  const reheat = M ? M.reheat : true;
  const lpTitle = M && M.n === 1 ? 'P&ID GVR preriscaldatore condensato' : 'P&ID GVR circuito LP e preriscaldatore';
  const list = [
    { id: 'pfd', number: `${P}-PR-PFD-001`, title: 'Schema di processo (PFD) e bilancio di massa ed energia', short: 'PFD generale e H&MB', group: 'Processo – PFD', build: pfdSheets },
    { id: 'pfd2', number: `${P}-PR-PFD-002`, title: 'Casi di funzionamento (carichi parziali e condizioni ambiente)', short: 'Casi di funzionamento', group: 'Processo – PFD', table: casesTable, csv: true },
    { id: 'pfd3', number: `${P}-PR-PFD-003`, title: 'PFD percorso aria e fumi', short: 'Percorso aria e fumi', group: 'Processo – PFD', build: pfdGasSheets },
    { id: 'pfd4', number: `${P}-PR-PFD-004`, title: 'PFD ciclo acqua-vapore', short: 'Ciclo acqua-vapore', group: 'Processo – PFD', build: pfdSteamSheets },
    { id: 'pfd5', number: `${P}-PR-PFD-005`, title: 'PFD sistemi di raffreddamento', short: 'Raffreddamento', group: 'Processo – PFD', build: pfdCoolingSheets },
    { id: 'pfd6', number: `${P}-PR-PFD-006`, title: 'Bilancio idrico di impianto', short: 'Bilancio idrico', group: 'Processo – PFD', build: pfdWaterSheets },
    { id: 'pfd7', number: `${P}-PR-PFD-007`, title: 'PFD gas combustibile e vapore ausiliario', short: 'Gas e vapore ausiliario', group: 'Processo – PFD', build: pfdFuelSheets },
    { id: 'pid101', number: `${P}-PR-PID-101`, title: 'P&ID turbogas: aspirazione aria, lavaggio compressore, scarico', short: 'TG aria e scarico', group: 'P&ID processo', pid: PP.pid101 },
    { id: 'pid102', number: `${P}-PR-PID-102`, title: 'P&ID turbogas: sistema gas combustibile', short: 'TG gas combustibile', group: 'P&ID processo', pid: PP.pid102 },
    { id: 'pid103', number: `${P}-PR-PID-103`, title: 'P&ID turbogas: olio di lubrificazione e sollevamento', short: 'TG olio', group: 'P&ID processo', pid: (m, r, d) => PP.pidLubeOil(m, r, d, { machine: 'TG' }) },
    { id: 'pid104', number: `${P}-PR-PID-104`, title: 'P&ID GVR circuito HP', short: 'GVR HP', group: 'P&ID processo', pid: (m, r, d) => PP.pidHRSG(m, r, d, 'HP') },
    { id: 'pid105', number: `${P}-PR-PID-105`, title: 'P&ID GVR circuito IP e risurriscaldatore', short: 'GVR IP e RH', group: 'P&ID processo', pid: (m, r, d) => PP.pidHRSG(m, r, d, 'IP'), when: reheat },
    { id: 'pid106', number: `${P}-PR-PID-106`, title: lpTitle, short: M && M.n === 1 ? 'GVR preriscaldatore' : 'GVR LP e PRE', group: 'P&ID processo', pid: (m, r, d) => PP.pidHRSG(m, r, d, 'LP') },
    { id: 'pid107', number: `${P}-PR-PID-107`, title: 'P&ID vapore principale, risurriscaldato e bypass', short: 'Vapore e bypass', group: 'P&ID processo', pid: PP.pid107 },
    { id: 'pid108', number: `${P}-PR-PID-108`, title: 'P&ID turbina a vapore, tenute, condensatore e vuoto', short: 'TV e condensatore', group: 'P&ID processo', pid: PP.pid108 },
    { id: 'pid109', number: `${P}-PR-PID-109`, title: 'P&ID condensato principale', short: 'Condensato', group: 'P&ID processo', pid: PP.pid109 },
    { id: 'pid110', number: `${P}-PR-PID-110`, title: 'P&ID acqua alimento', short: 'Acqua alimento', group: 'P&ID processo', pid: PP.pid110 },
    { id: 'pid111', number: `${P}-PR-PID-111`, title: 'P&ID spurghi e drenaggi GVR', short: 'Spurghi e drenaggi', group: 'P&ID processo', pid: PP.pid111 },
    { id: 'pid112', number: `${P}-PR-PID-112`, title: 'P&ID turbina a vapore: olio di lubrificazione e sollevamento', short: 'TV olio', group: 'P&ID processo', pid: (m, r, d) => PP.pidLubeOil(m, r, d, { machine: 'TV' }) },
    { id: 'pid201', number: `${P}-UT-PID-201`, title: 'P&ID stazione gas naturale', short: 'Stazione gas', group: 'P&ID utilities e ausiliari', pid: PU.pid201 },
    { id: 'pid202', number: `${P}-UT-PID-202`, title: M && !M.water ? 'P&ID aerocondensatore e vuoto' : 'P&ID acqua di circolazione e torre', short: M && !M.water ? 'Aerocondensatore' : 'Acqua circolazione e torre', group: 'P&ID utilities e ausiliari', pid: PU.pid202 },
    { id: 'pid203', number: `${P}-UT-PID-203`, title: 'P&ID acqua di raffreddamento a ciclo chiuso', short: 'Ciclo chiuso', group: 'P&ID utilities e ausiliari', pid: PU.pid203 },
    { id: 'pid204', number: `${P}-UT-PID-204`, title: 'P&ID aria compressa', short: 'Aria compressa', group: 'P&ID utilities e ausiliari', pid: PU.pid204 },
    { id: 'pid205', number: `${P}-UT-PID-205`, title: 'P&ID acqua grezza, servizi e antincendio', short: 'Acqua grezza e antincendio', group: 'P&ID utilities e ausiliari', pid: PU.pid205 },
    { id: 'pid206', number: `${P}-UT-PID-206`, title: 'P&ID acqua demineralizzata', short: 'Acqua demi', group: 'P&ID utilities e ausiliari', pid: PU.pid206 },
    { id: 'pid207', number: `${P}-UT-PID-207`, title: 'P&ID dosaggi chimici e campionamento', short: 'Chimici e SWAS', group: 'P&ID utilities e ausiliari', pid: PU.pid207 },
    { id: 'pid208', number: `${P}-UT-PID-208`, title: 'P&ID acque reflue', short: 'Acque reflue', group: 'P&ID utilities e ausiliari', pid: PU.pid208 },
    { id: 'pid209', number: `${P}-UT-PID-209`, title: 'P&ID gas tecnici', short: 'Gas tecnici', group: 'P&ID utilities e ausiliari', pid: PU.pid209 },
    { id: 'pid210', number: `${P}-UT-PID-210`, title: 'P&ID caldaia e vapore ausiliario', short: 'Vapore ausiliario', group: 'P&ID utilities e ausiliari', pid: PU.pid210 },
    { id: 'pid211', number: `${P}-UT-PID-211`, title: 'P&ID scarico, stoccaggio e trasferimento gasolio', short: 'Gasolio di riserva', group: 'P&ID utilities e ausiliari', pid: PU.pid211, when: !!(M && M.U.diesel) },
    { id: 'll', number: `${P}-PI-LST-001`, title: 'Line list', short: 'Line list', group: 'Liste', table: lineListTable, csv: true },
    { id: 'vl', number: `${P}-PI-LST-002`, title: 'Valve list – elenco valvole', short: 'Valve list', group: 'Liste', table: valveTable, csv: true },
    { id: 'il', number: `${P}-IC-LST-001`, title: 'Instrument list – elenco strumenti', short: 'Instrument list', group: 'Liste', table: instrumentTable, csv: true },
    { id: 'el', number: `${P}-ME-LST-001`, title: 'Equipment list', short: 'Equipment list', group: 'Liste', table: equipmentTable, csv: true },
    { id: 'load', number: `${P}-EL-LST-001`, title: 'Load list – elenco utenze elettriche', short: 'Load list', group: 'Liste', table: loadTable, csv: true },
    { id: 'ul', number: `${P}-PR-LST-001`, title: 'Elenco consumi utilities', short: 'Consumi utilities', group: 'Liste', table: utilitiesTable, csv: true },
    { id: 'sld1', number: `${P}-EL-SLD-001`, title: 'Schema unifilare AT e generazione', short: 'Unifilare AT', group: 'Elettrico', build: sld1Sheets },
    { id: 'sld2', number: `${P}-EL-SLD-002`, title: 'Schema unifilare servizi ausiliari MT/BT', short: 'Unifilare MT/BT', group: 'Elettrico', build: sld2Sheets },
    { id: 'pp', number: `${P}-CV-PLT-001`, title: 'Planimetria generale (plot plan)', short: 'Plot plan', group: 'Layout', build: plotPlanSheets },
    { id: 'iso', number: `${P}-GA-ISO-001`, title: 'Vista isometrica d\'insieme', short: 'Vista isometrica', group: 'Layout', build: plantIsoSheets },
    { id: 'piso', number: `${P}-PI-ISO-001`, title: 'Isometrico linea vapore HP', short: 'Isometrico vapore HP', group: 'Layout', build: pipingIsoSheets },
  ];
  return list.filter((c) => c.when !== false);
}

/** Genera i fogli di un documento. */
export function buildDocument(M, entry) {
  const doc = { number: entry.number, title: entry.title, scale: '—' };
  if (entry.pid) return pidRegistry(M).sheets[entry.id];
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
