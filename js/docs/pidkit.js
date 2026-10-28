// Kit per i P&ID: foglio con cornice, disegno di linee, valvole, strumenti e
// apparecchiature con registrazione automatica in un registro comune. Dal registro
// derivano line list, valve list, instrument list ed equipment list (colonna P&ID).

import { Sheet, ST, frame, notesBox, FRAME } from './sheet.js';
import { textWidth } from './pdf.js';
import { valve as vSym, psv as psvSym, pump as pumpSym, drum, vvessel, coil, hx, strainer, orifice, offPage } from './symbols.js';
export { hx, strainer, orifice, vvessel, drum, coil };

const W = '#ffffff';
const F = (v, d = 1) => (Number.isFinite(v) ? v.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }) : '');
const ceilTo = (v, s) => Math.ceil(v / s - 1e-9) * s;

export function newRegistry(numberOf) {
  return { valves: [], instruments: [], eqRefs: new Map(), lineRefs: new Map(), seq: new Map(), numberOf };
}

const ISA_FIRST = { B: 'fiamma', P: 'pressione', T: 'temperatura', F: 'portata', L: 'livello', A: 'analisi', Z: 'posizione', S: 'velocità', V: 'vibrazione', X: 'on/off', H: 'comando manuale', J: 'potenza', W: 'peso', E: 'tensione', D: 'densità', M: 'umidità', Q: 'quantità' };
const KKS_MEAS = { B: 'R', P: 'P', T: 'T', F: 'F', L: 'L', A: 'Q', Z: 'G', S: 'S', V: 'Y', X: 'X', H: 'H', J: 'E', M: 'M', Q: 'F', E: 'E', D: 'D', W: 'W' };

/** Descrizione estesa di una funzione strumentale ISA (es. 'PDT', 'LIC', 'TSH'). */
export function isaDescription(fn) {
  let first = fn[0];
  let rest = fn.slice(1);
  let mod = '';
  if (rest[0] === 'D' && first === 'P') { mod = ' differenziale'; rest = rest.slice(1); }
  if (rest[0] === 'Q' && first === 'F') { mod = ' totalizzata'; rest = rest.slice(1); }
  const v = ISA_FIRST[first] || first;
  const parts = [];
  if (rest.startsWith('IC')) parts.push('Indicatore regolatore');
  else if (rest.startsWith('IT')) parts.push('Trasmettitore indicatore');
  else if (rest.startsWith('T')) parts.push('Trasmettitore');
  else if (rest.startsWith('C')) parts.push('Regolatore');
  else if (rest.startsWith('I')) parts.push('Indicatore locale');
  else if (rest.startsWith('G')) parts.push('Vetro spia');
  else if (rest.startsWith('E')) parts.push('Elemento primario');
  else if (rest.startsWith('S')) parts.push('Interruttore');
  else if (rest.startsWith('Y')) parts.push('Relè / convertitore');
  else if (rest.startsWith('V')) parts.push('Valvola');
  else parts.push('Strumento');
  let lim = '';
  if (/SHH|AHH/.test(rest)) lim = ' altissimo';
  else if (/SLL|ALL/.test(rest)) lim = ' bassissimo';
  else if (/SH|AH/.test(rest)) lim = ' alto';
  else if (/SL|AL/.test(rest)) lim = ' basso';
  return `${parts[0]} di ${v}${mod}${lim}`;
}

function ioFor(fn) {
  const rest = fn.slice(1).replace(/^D/, '');
  if (/^S/.test(rest) || /^A(H|L)/.test(rest)) return 'DI';
  if (/^(I|G|E)$/.test(rest)) return '—';
  return 'AI';
}

export class Pid {
  /**
   * @param {object} M modello di ingegneria
   * @param {object} reg registro
   * @param {object} doc {id, number, title}
   */
  constructor(M, reg, doc, { title, subtitle = '', typical = false, unit = 1 } = {}) {
    this.M = M;
    this.reg = reg;
    this.doc = doc;
    this.unit = unit;
    this.sh = new Sheet();
    frame(this.sh, M.meta, { ...doc, scale: 'non in scala', sheetNo: 1, sheetCount: 1 });
    const sh = this.sh;
    sh.text(FRAME.x0 + 4, FRAME.y0 + 7, title.toUpperCase(), { size: 3, bold: true });
    let sub = subtitle;
    if (typical && M.N > 1) sub = `${sub ? sub + ' · ' : ''}TIPICO PER TRENI 1…${M.N} (tag riferiti al treno 1)`;
    if (sub) sh.text(FRAME.x0 + 4, FRAME.y0 + 11, sub, { size: 1.9 });
    this.notes = [];
  }

  // ------------------------------------------------ riferimenti
  num(id) { return this.reg.numberOf ? this.reg.numberOf(id) : id; }
  refEq(tag) {
    if (!this.reg.eqRefs.has(tag)) this.reg.eqRefs.set(tag, new Set());
    this.reg.eqRefs.get(tag).add(this.doc.number);
  }
  lineObj(id) {
    const l = this.M.lineById[id];
    if (!l) throw new Error(`Linea non definita: ${id}`);
    if (!this.reg.lineRefs.has(id)) this.reg.lineRefs.set(id, new Set());
    this.reg.lineRefs.get(id).add(this.doc.number);
    return l;
  }
  nextSeq(key) {
    const v = (this.reg.seq.get(key) || 0) + 1;
    this.reg.seq.set(key, v);
    return v;
  }
  kksParts(lineId, sys) {
    if (sys) return { unit: String(sys[0]), base: sys.slice(1) };
    const l = lineId ? this.M.lineById[lineId] : null;
    if (l) return { unit: l.kks[0], base: l.kks.slice(1, 6) };
    return { unit: String(this.unit), base: 'XXX10' };
  }

  // ------------------------------------------------ linee
  /** Linea di processo registrata con numero linea. */
  line(id, pts, { label = true, arrow = true, at = 0.5, seg = null, side = -1, size = 1.4 } = {}) {
    const l = this.lineObj(id);
    const st = l.DN >= 300 ? ST.thick : l.DN >= 80 ? ST.med : ST.norm;
    this.path(pts, { st, arrow, label: label ? l.lineNo : null, at, seg, side, size });
    return l;
  }
  /** Linea non numerata (collegamenti di apparecchiature, tratti brevi). */
  pipe(pts, { arrow = false, st = ST.norm } = {}) { this.path(pts, { st, arrow }); }
  signal(pts) { this.sh.path(pts, ST.signal); }
  path(pts, { st = ST.med, arrow = true, label = null, at = 0.5, seg = null, side = -1, size = 1.4 } = {}) {
    const sh = this.sh;
    sh.path(pts, st);
    let best = seg ?? 0, len = 0;
    if (seg === null) {
      for (let i = 1; i < pts.length; i++) {
        const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        if (d > len) { len = d; best = i - 1; }
      }
    }
    const a = pts[best], b = pts[best + 1];
    const mx = a[0] + (b[0] - a[0]) * at, my = a[1] + (b[1] - a[1]) * at;
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    if (arrow) {
      const s = 1.7, ax = mx + Math.cos(ang) * 1.2, ay = my + Math.sin(ang) * 1.2;
      sh.path([[ax, ay], [ax - s * Math.cos(ang - 0.45), ay - s * Math.sin(ang - 0.45)], [ax - s * Math.cos(ang + 0.45), ay - s * Math.sin(ang + 0.45)]], { f: '#000000' }, true);
    }
    if (label) {
      if (Math.abs(Math.sin(ang)) > 0.7) sh.text(mx + (side < 0 ? -1.2 : 2.6), my + (Math.sin(ang) > 0 ? -12 : 4), label, { size, rot: -90 });
      else sh.text(mx + 3, my + side * 1.1 + (side > 0 ? 1.4 : 0), label, { size });
    }
  }
  dot(x, y) { this.sh.circle(x, y, 0.75, ST.black); }

  // ------------------------------------------------ valvole
  /**
   * Valvola registrata. kind: gate|globe|ball|butterfly|check|plug|needle
   * act: null|'pneu'|'mot'|'sol'|'hyd'; ctl = valvola di regolazione (corpo globo + diaframma)
   */
  valve(x, y, { line = null, kind = 'gate', dir = 'h', act = null, ctl = false, fail = null, service = '', tag = null, sys = null, small = false, s = 2.3, showTag = null, tagSide = 1 } = {}) {
    const sh = this.sh;
    const l = line ? this.lineObj(line) : null;
    const { unit, base } = this.kksParts(line, sys);
    const seq = this.nextSeq(`${unit}${base}AA`);
    const t = tag ?? `${unit}${base}AA${String(seq).padStart(3, '0')}`;
    const bodyKind = ctl ? 'globe' : kind;
    vSym(sh, x, y, { dir, kind: bodyKind === 'needle' ? 'globe' : bodyKind, s });
    if (act || ctl) this.actuator(x, y, dir, ctl ? 'pneu' : act, s, fail);
    const show = showTag ?? true;
    if (show) {
      const txt = act || ctl ? t : t.slice(-5);
      const fs = act || ctl ? 1.4 : 1.15;
      if (dir === 'h') sh.text(x, y + (tagSide > 0 ? s + 2.4 : -s - 1.2 - (act || ctl ? s * 2.6 : 0)), txt, { size: fs, anchor: 'middle' });
      else sh.text(x + (tagSide > 0 ? s + 1 + (act || ctl ? s * 2.4 : 0) : -s - 1), y + 0.5, txt, { size: fs, anchor: tagSide > 0 ? 'start' : 'end' });
    }
    const type = ctl ? 'Regolazione (globo)' : { gate: 'Saracinesca', globe: 'Globo', ball: 'Sfera', butterfly: 'Farfalla', check: 'Ritegno', plug: 'Maschio', needle: 'Spillo' }[kind] || kind;
    const DN = l ? (small ? Math.min(l.DN, l.DN >= 300 ? 50 : 25) : l.DN) : small ? 25 : 50;
    this.reg.valves.push({
      tag: t, type, DN, cls: l ? l.clsLabel : '', mat: l ? l.matShort : '', act: ctl ? 'Pneumatico + posizionatore' : { pneu: 'Pneumatico', mot: 'Motorizzato', sol: 'Elettrovalvola', hyd: 'Oleodinamico' }[act] || 'Manuale',
      fail: fail || (ctl || act === 'pneu' ? 'FC' : act === 'mot' ? 'FL' : ''), service, line: l ? l.lineNo : '', pid: this.doc.number,
      pDes: l ? l.pDes : '', TDes: l ? l.TDes : '',
    });
    return t;
  }
  actuator(x, y, dir, act, s, fail) {
    const sh = this.sh;
    const h = dir === 'h';
    const ex = h ? x : x + s * 2.2, ey = h ? y - s * 2.2 : y;
    sh.line(x, y, ex, ey, ST.norm);
    if (act === 'pneu') {
      if (h) { sh.arc(ex, ey, s * 0.9, 180, 360, { s: '#000000', w: 0.3, f: W }); sh.line(ex - s * 0.9, ey, ex + s * 0.9, ey, ST.norm); } else { sh.arc(ex, ey, s * 0.9, -90, 90, { s: '#000000', w: 0.3, f: W }); sh.line(ex, ey - s * 0.9, ex, ey + s * 0.9, ST.norm); }
    } else {
      const L = { mot: 'M', sol: 'S', hyd: 'H' }[act] || '?';
      const cx = h ? ex : ex + 1.3, cy = h ? ey - 1.3 : ey;
      sh.rect(cx - 1.3, cy - 1.3, 2.6, 2.6, { s: '#000000', w: 0.3, f: W });
      sh.textMid(cx, cy, L, { size: 1.6, anchor: 'middle', bold: true });
    }
    if (fail) sh.text(h ? x + s * 1.1 : x + s * 0.4, h ? y - s * 0.9 : y + s * 1.9, fail, { size: 1.15 });
  }
  /** Valvola di sicurezza (ingresso dal basso). */
  psv(x, y, { line, service = 'protezione da sovrapressione', out = 1, tag = null } = {}) {
    const l = line ? this.lineObj(line) : null;
    const { unit, base } = this.kksParts(line);
    const seq = this.nextSeq(`${unit}${base}AA`);
    const t = tag ?? `${unit}${base}AA${String(seq).padStart(3, '0')}`;
    this.sh.line(x, y + 4, x, y, ST.norm);
    psvSym(this.sh, x, y, { out });
    this.sh.text(x + (out > 0 ? -1.4 : 1.4), y - 5.6, t, { size: 1.25, anchor: out > 0 ? 'end' : 'start' });
    const setBarG = l ? Math.max(1, l.pDes - 1.013) : 3;
    const DN = l ? (l.DN >= 300 ? 150 : l.DN >= 150 ? 100 : l.DN >= 80 ? 50 : 25) : 25;
    this.reg.valves.push({ tag: t, type: `Sicurezza, taratura ${F(setBarG, 1)} bar g`, DN, cls: l ? l.clsLabel : '', mat: l ? l.matShort : '', act: 'Molla', fail: '', service, line: l ? l.lineNo : '', pid: this.doc.number, pDes: l ? l.pDes : '', TDes: l ? l.TDes : '' });
    return t;
  }

  // ------------------------------------------------ strumenti
  /** Strumento in bolla; fn = funzione ISA (PT, TIC, LSH, PDT...). */
  inst(x, y, fn, { line = null, to = null, service = '', dcs = true, sis = false, sys = null, range = null, unit = null, local = false } = {}) {
    const sh = this.sh;
    const l = line ? this.lineObj(line) : null;
    const { unit: u, base } = this.kksParts(line, sys);
    const code = KKS_MEAS[fn[0]] || 'X';
    const seq = this.nextSeq(`${u}${base}C`);
    const tag = `${u}${base}C${code}${String(seq).padStart(3, '0')}`;
    const r = 3.2;
    if (to) {
      const d = Math.hypot(to[0] - x, to[1] - y) || 1;
      sh.line(x + ((to[0] - x) / d) * r, y + ((to[1] - y) / d) * r, to[0], to[1], ST.signal);
    }
    if (sis) sh.path([[x, y - r - 1.3], [x + r + 1.3, y], [x, y + r + 1.3], [x - r - 1.3, y]], { s: '#000000', w: 0.25, f: W }, true);
    sh.circle(x, y, r, { s: '#000000', w: 0.3, f: W });
    if (dcs && !local) sh.line(x - r, y, x + r, y, ST.thin);
    sh.text(x, y - 0.55, fn, { size: fn.length > 3 ? 1.3 : 1.6, anchor: 'middle', bold: true });
    sh.text(x, y + 2.15, String(seq).padStart(3, '0'), { size: 1.3, anchor: 'middle' });
    // campo di misura stimato
    let rng = range, un = unit;
    if (!rng && l) {
      const c = fn[0];
      if (c === 'P' && fn[1] !== 'D') { rng = `0 – ${F(ceilTo((l.pDes - 1) * 1.25, l.pDes > 20 ? 10 : 1), 0)}`; un = 'bar g'; }
      if (c === 'P' && fn[1] === 'D') { rng = '0 – 500'; un = 'mbar'; }
      if (c === 'T') { rng = `0 – ${F(ceilTo(l.TDes + 50, 50), 0)}`; un = '°C'; }
      if (c === 'F') { rng = `0 – ${F(ceilTo(l.m * 3.6 * 1.3, l.m * 3.6 > 100 ? 50 : 5), 0)}`; un = 't/h'; }
    }
    if (!rng) {
      const c = fn[0];
      if (c === 'L') { rng = '±500'; un = 'mm'; }
      if (c === 'Z') { rng = '0 – 100'; un = '%'; }
      if (c === 'S') { rng = '0 – 3600'; un = 'giri/min'; }
      if (c === 'V') { rng = '0 – 250'; un = 'µm'; }
      if (c === 'A') { rng = 'vedi specifica'; un = ''; }
    }
    this.reg.instruments.push({
      tag, fn, loop: String(seq).padStart(3, '0'), desc: isaDescription(fn), service, line: l ? l.lineNo : '', pid: this.doc.number,
      range: rng || '', unit: un || '', io: local ? '—' : sis ? `${ioFor(fn)} (SIS)` : ioFor(fn), signal: local ? 'locale' : /S/.test(fn.slice(1)) && !/T/.test(fn.slice(1)) ? 'contatto' : '4-20 mA HART',
    });
    return tag;
  }

  // ------------------------------------------------ apparecchiature
  eqTag(x, y, tag, desc, { anchor = 'middle', size = 2.0 } = {}) {
    const sh = this.sh;
    this.refEq(tag);
    sh.text(x, y, tag, { size, bold: true, anchor });
    const w = textWidth(tag, size, true);
    const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
    sh.line(x0, y + 0.6, x0 + w, y + 0.6, ST.thin);
    const parts = desc ? (Array.isArray(desc) ? desc : [desc]) : [];
    parts.forEach((d, i) => sh.text(x, y + 3.1 + i * 2.4, d, { size: size * 0.75, anchor }));
  }
  off(x, y, dir, text, targetId, { w = 32, sub = null } = {}) {
    offPage(this.sh, x, y, dir, text, sub ?? (targetId ? this.num(targetId) : ''), { w });
  }

  // ------------------------------------------------ gruppi tipici
  /** Stazione di regolazione orizzontale: intercettazioni, valvola di regolazione, by-pass e drenaggio. */
  ctrlStation(x, y, { line, fn = 'FIC', service = '', fail = 'FC', bypass = true, ctrlY = null, sys = null } = {}) {
    const sh = this.sh;
    sh.line(x - 20, y, x + 20, y, ST.med);
    this.valve(x - 13, y, { line, kind: 'gate', service: `intercettazione ${service}`, showTag: false, sys });
    const cv = this.valve(x, y, { line, ctl: true, fail, service, sys });
    this.valve(x + 13, y, { line, kind: 'gate', service: `intercettazione ${service}`, showTag: false, sys });
    if (bypass) {
      sh.path([[x - 18, y], [x - 18, y + 8], [x + 18, y + 8], [x + 18, y]], ST.norm);
      this.valve(x, y + 8, { line, kind: 'globe', service: `by-pass ${service}`, s: 1.8, showTag: false, sys });
    }
    if (fn) {
      const cy = ctrlY ?? y - 15;
      this.inst(x - 9, cy, fn, { line, to: [x - 1, y - 6.5], service, sys });
    }
    return cv;
  }
  /** Sfiato o drenaggio con valvola (doppia intercettazione se alta pressione). */
  ventDrain(x, y, kind = 'drain', { line = null, double = false, dir = 'v' } = {}) {
    const sh = this.sh;
    const sgn = kind === 'drain' ? 1 : -1;
    const l = line ? this.M.lineById[line] : null;
    const dbl = double || (l && l.pDes > 40);
    const len = dbl ? 11 : 7;
    if (dir === 'v') {
      sh.line(x, y, x, y + sgn * len, ST.norm);
      this.valve(x, y + sgn * 3.6, { line, kind: 'globe', dir: 'v', s: 1.5, small: true, service: kind === 'drain' ? 'drenaggio' : 'sfiato', showTag: false });
      if (dbl) this.valve(x, y + sgn * 7.6, { line, kind: 'globe', dir: 'v', s: 1.5, small: true, service: kind === 'drain' ? 'drenaggio' : 'sfiato', showTag: false });
      const ye = y + sgn * len;
      if (kind === 'drain') sh.path([[x - 1.6, ye], [x + 1.6, ye], [x, ye + 1.8]], ST.thin, true);
      else sh.path([[x - 1.3, ye - 1.6], [x, ye], [x + 1.3, ye - 1.6]], ST.thin);
    } else {
      sh.line(x, y, x + len, y, ST.norm);
      this.valve(x + 3.6, y, { line, kind: 'globe', dir: 'h', s: 1.5, small: true, service: kind === 'drain' ? 'drenaggio' : 'sfiato', showTag: false });
      if (dbl) this.valve(x + 7.6, y, { line, kind: 'globe', dir: 'h', s: 1.5, small: true, service: kind === 'drain' ? 'drenaggio' : 'sfiato', showTag: false });
    }
  }
  /**
   * Gruppo di pompe in parallelo: collettore di aspirazione sotto (yS), pompe a yP,
   * collettore di mandata sopra (yD). Ritorna le coordinate dei collettori.
   */
  pumps(x0, yP, { n = 2, pitch = 26, tag, sucLine, disLine, service = '', strainer: withStr = true, pi = true, labels = null, motor = true } = {}) {
    const sh = this.sh;
    const yS = yP + 13, yD = yP - 26;
    const xs = [];
    for (let i = 0; i < n; i++) {
      const px = x0 + i * pitch;
      xs.push(px);
      const pt = `${tag}${String(i + 1).padStart(3, '0')}`;
      this.refEq(pt);
      // aspirazione
      sh.path([[px - 11, yS], [px - 11, yP], [px - 4, yP]], ST.med);
      this.valve(px - 11, yS - 6, { line: sucLine, kind: 'gate', dir: 'v', s: 1.9, service: `aspirazione ${service}`, showTag: false, tagSide: -1 });
      if (withStr) strainer(sh, px - 7.4, yP, 1.5);
      pumpSym(sh, px, yP, { r: 4 });
      if (motor) { sh.line(px, yP + 4, px, yP + 7.5, ST.thin); sh.circle(px, yP + 9.2, 1.7, { s: '#000000', w: 0.25, f: W }); sh.textMid(px, yP + 9.2, 'M', { size: 1.4, anchor: 'middle', bold: true }); }
      sh.text(px + 5, yP + 7.2, pt.replace(/^(\d)([A-Z]{3}\d\d)/, '$1$2 '), { size: 1.45, bold: true });
      if (labels) sh.text(px + 5, yP + 9.6, labels[i] || '', { size: 1.2 });
      // mandata
      sh.line(px + 4, yP - 4, px + 4, yD, ST.med);
      this.valve(px + 4, yP - 9, { line: disLine, kind: 'check', dir: 'v', s: 1.9, service: `ritegno ${service}`, showTag: false });
      this.valve(px + 4, yP - 17, { line: disLine, kind: 'gate', dir: 'v', s: 1.9, act: n > 1 ? 'mot' : null, service: `mandata ${service}`, showTag: false });
      if (pi) this.inst(px + 13, yP - 13, 'PI', { line: disLine, to: [px + 4, yP - 13], local: true, service: `mandata ${pt}` });
    }
    sh.line(xs[0] - 11, yS, xs[n - 1] - 11, yS, ST.med);
    sh.line(xs[0] + 4, yD, xs[n - 1] + 4, yD, ST.med);
    return { yS, yD, xS0: xs[0] - 11, xS1: xs[n - 1] - 11, xD0: xs[0] + 4, xD1: xs[n - 1] + 4, xs };
  }
  /** Serbatoio verticale con livello. */
  tank(x, y, w, h, { tag, desc, lt = true, roof = 'cone' } = {}) {
    const sh = this.sh;
    sh.rect(x, y, w, h, { s: '#000000', w: 0.45, f: W });
    if (roof === 'cone') sh.path([[x, y], [x + w / 2, y - w * 0.12], [x + w, y]], { s: '#000000', w: 0.45, f: W }, true);
    if (tag) this.eqTag(x + w / 2, y + h + 4, tag, desc);
    if (lt) {
      this.inst(x + w + 7, y + h * 0.35, 'LT', { to: [x + w, y + h * 0.35], service: `livello ${tag}`, sys: tag.slice(0, 6) });
      this.inst(x + w + 7, y + h * 0.35 + 8, 'LSL', { to: [x + w, y + h * 0.35 + 8], service: `livello basso ${tag}`, sys: tag.slice(0, 6) });
    }
  }
  /**
   * Involucro GVR con banchi (ordine lato fumi da sinistra). Ogni banco ha i
   * bocchelli di ingresso (sinistra) e uscita (destra) sul lato superiore.
   * coils: [{name, label, TgIn, TgOut}]; ritorna le posizioni.
   */
  casing(x0, y0, x1, y1, coils, { tag = null, gasInText = '', gasOutText = '' } = {}) {
    const sh = this.sh;
    sh.rect(x0, y0, x1 - x0, y1 - y0, { s: '#000000', w: 0.7, f: W });
    if (tag) this.eqTag(x1 - 2, y1 + 8, tag, null, { anchor: 'end', size: 1.8 });
    const n = coils.length;
    const pitch = (x1 - x0) / n;
    const out = [];
    coils.forEach((c, i) => {
      const cx = x0 + pitch * (i + 0.5);
      const w = Math.min(30, pitch * 0.62);
      coil(sh, cx - w / 2, y0 + 7, w, y1 - y0 - 14, {});
      const lb = c.label.split(' ');
      lb.forEach((t, j) => sh.text(cx, y0 + 3.6 + j * 2.3, t, { size: 1.5, anchor: 'middle', bold: j === 0 }));
      if (c.tag) { this.refEq(c.tag); sh.text(cx, y1 - 1.8, c.tag, { size: 1.25, anchor: 'middle' }); }
      if (Number.isFinite(c.TgIn)) sh.text(x0 + pitch * i + 1, y1 + 3, `${F(c.TgIn, 0)}°`, { size: 1.3 });
      out.push({ ...c, cx, w, inX: cx - w / 2 + 2.5, outX: cx + w / 2 - 2.5, top: y0 + 7, bot: y1 - 7, gapL: x0 + pitch * i, gapR: x0 + pitch * (i + 1), y0, y1 });
    });
    const last = coils[n - 1];
    if (last && Number.isFinite(last.TgOut)) sh.text(x1 - 1, y1 + 3, `${F(last.TgOut, 0)}°`, { size: 1.3, anchor: 'end' });
    // frecce lato fumi
    const ym = (y0 + y1) / 2;
    sh.arrow(x0 - 14, ym, x0 - 1, ym, ST.med, 2.2);
    sh.text(x0 - 15, ym - 2, gasInText, { size: 1.4, anchor: 'start' });
    sh.arrow(x1 + 1, ym, x1 + 14, ym, ST.med, 2.2);
    sh.text(x1 + 2, ym - 2, gasOutText, { size: 1.4 });
    return out;
  }
  /** Corpo cilindrico con strumentazione e accessori standard. */
  drumAssy(x, y, w, h, { tag, lv, steamLine, ventLine = null, bdLine = null, sys, psv = 2, bdDx = w - 6, bdTag = true } = {}) {
    const sh = this.sh;
    drum(sh, x, y, w, h);
    this.refEq(tag);
    sh.textMid(x + w / 2, y + h / 2, lv, { size: 2.4, anchor: 'middle', bold: true });
    sh.text(x + w / 2, y + h + 4, tag, { size: 1.7, anchor: 'middle', bold: true });
    for (let i = 0; i < 3; i++) this.inst(x - 7, y - 3 + i * 7.6, 'LT', { to: [x + 1 + i * 0.3, y + 2 + i * 2.5], service: `livello corpo ${lv} (2oo3)`, sys });
    sh.line(x + w + 1.5, y + 1, x + w + 1.5, y + h - 1, ST.thin);
    sh.rect(x + w + 0.7, y + 1.5, 1.6, h - 3, { s: '#000000', w: 0.25, f: W });
    sh.text(x + w + 3, y + h - 1, 'LG', { size: 1.2 });
    this.inst(x + w + 9, y + 1, 'PT', { line: steamLine, to: [x + w - 2, y + 1.5], service: `pressione corpo ${lv}`, sys });
    this.inst(x + w + 9, y + 9, 'PI', { line: steamLine, to: [x + w + 2.3, y + 7], local: true, service: `pressione corpo ${lv}`, sys });
    for (let i = 0; i < psv; i++) {
      const px = x + 6 + i * 8, py = y - 4 - i * 6;
      if (i) sh.line(px, y, px, py + 4, ST.norm);
      this.psv(px, py, { line: steamLine, service: `sicurezza corpo ${lv}` });
    }
    if (ventLine) {
      sh.line(x + w - 8, y, x + w - 8, y - 4, ST.norm);
      this.ventDrain(x + w - 8, y - 4, 'vent', { line: ventLine, double: true });
    }
    let bd = null;
    if (bdLine) {
      const bx = x + bdDx;
      sh.line(bx, y + h, bx, y + h + 4, ST.norm);
      this.valve(bx, y + h + 6.5, { line: bdLine, kind: 'globe', dir: 'v', s: 1.7, service: `spurgo continuo corpo ${lv}`, showTag: false });
      bd = this.valve(bx, y + h + 12, { line: bdLine, dir: 'v', s: 1.7, act: 'mot', service: `spurgo continuo corpo ${lv}`, showTag: bdTag });
    }
    return { bd };
  }

  /** Note in basso a sinistra (con la legenda standard). */
  finish(extra = []) {
    notesBox(this.sh, 'NOTE', [
      'Simbologia ISA 5.1 / ISO 10628; bolla con linea: funzione in DCS, bolla semplice: strumento locale, rombo: funzione di sicurezza (SIS). Numerazione linee DN-FLUIDO-N.-SPECIFICA-COIBENTAZIONE (vedi line list).',
      'Tag KKS: valvole …AA###, strumenti …C?### (vedi valve list e instrument list). Per le valvole manuali è riportata solo la parte finale del tag.',
      ...extra,
    ], { size: 1.85 });
    return [this.sh];
  }
}

// ------------------------------------------------------------------ simboli aggiuntivi
export const sym = {
  drum, vvessel, coil, hx, orifice, strainer,
  hvessel(sh, x, y, w, h) { drum(sh, x, y, w, h); },
  shellTube(sh, x, y, w, h) {
    sh.rect(x, y, w, h, { s: '#000000', w: 0.4, f: W });
    sh.path([[x + 2, y + h * 0.3], [x + w - 4, y + h * 0.3], [x + w - 2, y + h / 2], [x + w - 4, y + h * 0.7], [x + 2, y + h * 0.7]], ST.norm);
    sh.line(x + 2, y, x + 2, y + h, ST.thin);
  },
  plateHX(sh, x, y, w, h) {
    sh.rect(x, y, w, h, { s: '#000000', w: 0.4, f: W });
    for (let i = 1; i < 6; i++) sh.line(x + (w * i) / 6, y + 1, x + (w * i) / 6, y + h - 1, ST.hair);
    sh.line(x, y, x + w, y + h, ST.thin);
  },
  fanCooler(sh, x, y, w, h, nFans = 3) {
    sh.rect(x, y, w, h, { s: '#000000', w: 0.4, f: W });
    for (let i = 0; i < 4; i++) sh.line(x + 1.5, y + 2 + (i * (h - 4)) / 3, x + w - 1.5, y + 2 + (i * (h - 4)) / 3, ST.thin);
    for (let i = 0; i < nFans; i++) {
      const cx = x + (w * (i + 0.5)) / nFans;
      sh.circle(cx, y - 3.2, 2.6, { s: '#000000', w: 0.3, f: W });
      sh.line(cx - 2.2, y - 3.2, cx + 2.2, y - 3.2, ST.thin).line(cx, y - 5.4, cx, y - 1, ST.thin);
    }
  },
  coolingTower(sh, x, y, w, h, cells = 3) {
    sh.path([[x, y + h], [x + w * 0.08, y], [x + w * 0.92, y], [x + w, y + h]], { s: '#000000', w: 0.45, f: W }, true);
    for (let i = 0; i < cells; i++) {
      const cx = x + w * 0.08 + ((w * 0.84) * (i + 0.5)) / cells;
      sh.circle(cx, y - 2.6, 2.2, { s: '#000000', w: 0.3, f: W });
      sh.line(cx - 1.8, y - 2.6, cx + 1.8, y - 2.6, ST.thin);
    }
    for (let i = 0; i < 6; i++) sh.line(x + w * 0.15 + i * w * 0.13, y + h * 0.35, x + w * 0.15 + i * w * 0.13 + 2, y + h * 0.55, ST.hair);
  },
  compressor(sh, x, y, r = 4.5) {
    sh.circle(x, y, r, { s: '#000000', w: 0.4, f: W });
    sh.path([[x - r * 0.75, y - r * 0.65], [x + r * 0.75, y - r * 0.3], [x + r * 0.75, y + r * 0.3], [x - r * 0.75, y + r * 0.65]], ST.norm, true);
  },
  filter(sh, x, y, w, h) {
    sh.rect(x, y, w, h, { s: '#000000', w: 0.4, f: W });
    sh.path([[x, y], [x + w, y + h]], ST.thin);
    sh.path([[x + w, y], [x, y + h]], ST.dash);
  },
  roUnit(sh, x, y, w, h, n = 3) {
    for (let i = 0; i < n; i++) {
      const yy = y + (i * h) / n;
      drum(sh, x, yy + 0.6, w, h / n - 1.2);
      sh.line(x + 2, yy + h / n - 1.6, x + w - 2, yy + 1.6, ST.hair);
    }
  },
  boiler(sh, x, y, w, h) {
    drum(sh, x, y, w, h);
    sh.circle(x + h / 2 + 1, y + h / 2, h * 0.28, ST.norm);
    sh.path([[x + h / 2 + 1, y + h * 0.72], [x + h / 2 - 1.5, y + h * 0.42], [x + h / 2 + 1, y + h * 0.5], [x + h / 2 + 3, y + h * 0.3]], ST.thin);
  },
  silencer(sh, x, y, w = 4, h = 8) {
    sh.rect(x - w / 2, y - h, w, h, { s: '#000000', w: 0.35, f: W });
    for (let i = 1; i < 4; i++) sh.line(x - w / 2, y - (h * i) / 4, x + w / 2, y - (h * i) / 4, ST.hair);
  },
  funnel(sh, x, y) { sh.path([[x - 2, y], [x + 2, y], [x + 0.6, y + 2], [x + 0.6, y + 3.4], [x - 0.6, y + 3.4], [x - 0.6, y + 2]], ST.thin, true); },
  hydrant(sh, x, y) {
    sh.line(x, y, x, y - 3, ST.norm);
    sh.circle(x, y - 4.5, 1.5, { s: '#000000', w: 0.3, f: '#000000' });
  },
  bottles(sh, x, y, n = 4) {
    for (let i = 0; i < n; i++) {
      sh.rect(x + i * 3.2, y, 2.4, 9, { s: '#000000', w: 0.3, f: W });
      sh.arc(x + i * 3.2 + 1.2, y, 1.2, 180, 360, ST.thin);
    }
  },
  gauge(sh, x, y, h = 10) {
    sh.rect(x - 1, y, 2, h, { s: '#000000', w: 0.3, f: W });
    sh.line(x - 1, y + h / 2, x + 1, y + h / 2, ST.thin);
  },
  mixer(sh, x, y, l = 8) {
    sh.line(x, y, x, y + l, ST.norm);
    sh.path([[x - 2, y + l], [x + 2, y + l - 1.2]], ST.norm);
    sh.path([[x - 2, y + l - 1.2], [x + 2, y + l]], ST.norm);
    sh.circle(x, y - 1.5, 1.5, { s: '#000000', w: 0.3, f: W });
    sh.textMid(x, y - 1.5, 'M', { size: 1.1, anchor: 'middle', bold: true });
  },
  pumpSmall(sh, x, y) { pumpSym(sh, x, y, { r: 2.8 }); },
  meter(sh, x, y) {
    sh.rect(x - 3, y - 2, 6, 4, { s: '#000000', w: 0.35, f: W });
    sh.textMid(x, y, 'FQ', { size: 1.3, anchor: 'middle', bold: true });
  },
};

export { ST, W, F };
