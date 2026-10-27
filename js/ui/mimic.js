// Sinottico SVG dell'impianto: turbina a gas, GVR con banchi e corpi cilindrici,
// turbina a vapore, condensatore e tubazioni principali con flusso animato.
// Lo schema si ricostruisce quando cambia la struttura (tipo di GVR, banchi);
// i valori si aggiornano a ogni passo.

import { fmt } from './format.js';

const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, parent = null, text = null) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
  if (text !== null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

const LEVEL_CLASS = { HP: 'hp', IP: 'ip', LP: 'lp' };

// Colonne del GVR dal lato fumi: banchi in parallelo con la stessa sezione fumi sono raggruppati.
export function bankColumns(banks) {
  const cols = [];
  for (const b of banks) {
    const last = cols[cols.length - 1];
    if (b.parallel && last && last.parallel && Math.abs(last.TgIn - b.TgIn) < 1e-6) last.banks.push(b);
    else cols.push({ parallel: !!b.parallel, TgIn: b.TgIn, TgOut: b.TgOut, banks: [b] });
  }
  return cols;
}

function bankKind(name) {
  if (name.startsWith('SH')) return 'sh';
  if (name.startsWith('RH')) return 'rh';
  if (name.startsWith('EVA')) return 'eva';
  if (name.startsWith('ECO')) return 'eco';
  return 'pre';
}
function bankLevel(name) {
  const m = name.match(/\b(HP|IP|LP)\b/);
  return m ? m[1] : null;
}

export function mimicSignature(cfg, r) {
  const cols = r && r.bt ? bankColumns(r.bt.banks).map((c) => c.banks.map((b) => b.name).join('+')).join('|') : 'none';
  return `${cfg.steam.type}/${cfg.nGT}/${cfg.steam.condenser.type}/${cols}`;
}

/**
 * Costruisce lo schema. `r` è un risultato di regime usato per la struttura dei banchi.
 * Restituisce i riferimenti agli elementi da aggiornare.
 */
export function buildMimic(svg, cfg, r) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const ref = { flows: [], text: {}, cols: [], tempLabels: [] };
  const g = el('g', {}, svg);
  const type = cfg.steam.type;
  const names = { '3PRH': ['HP', 'IP', 'LP'], '2P': ['HP', 'LP'], '1P': ['HP'] }[type];

  const T = (key, x, y, cls = 'val', anchor = 'start', initial = '—') => {
    const t = el('text', { x, y, class: cls, 'text-anchor': anchor }, g, initial);
    ref.text[key] = t;
    return t;
  };
  const pipe = (d, cls, key) => {
    el('path', { d, class: 'pipe-bg' }, g);
    el('path', { d, class: `pipe ${cls}` }, g);
    const f = el('path', { d, class: 'flow' }, g);
    ref.flows.push({ key, el: f });
  };

  // ------------------------------------------------------------ Turbina a gas
  el('text', { x: 30, y: 24, class: 'lbl' }, g, cfg.nGT > 1 ? `Turbogas ×${cfg.nGT}` : 'Turbogas');
  el('rect', { x: 112, y: 34, width: 76, height: 34, rx: 3, class: 'casing' }, g);
  for (let i = 0; i < 6; i++) el('line', { x1: 120 + i * 12, y1: 40, x2: 120 + i * 12, y2: 62, class: 'tube s-air' }, g);
  el('text', { x: 106, y: 55, class: 'lbl-sm', 'text-anchor': 'end' }, g, 'FILTRI ARIA');
  pipe('M150 68 V100', 's-air', 'air');
  el('rect', { x: 128, y: 100, width: 42, height: 100, rx: 3, class: 'casing' }, g);
  el('line', { x1: 92, y1: 150, x2: 452, y2: 150, class: 'shaft' }, g);
  ref.g1 = el('circle', { cx: 62, cy: 150, r: 30, class: 'gen' }, g);
  el('text', { x: 62, y: 155, class: 'lbl', 'text-anchor': 'middle' }, g, 'G');
  el('polygon', { points: '170,100 280,125 280,175 170,200', class: 'equip' }, g);
  el('text', { x: 222, y: 155, class: 'lbl', 'text-anchor': 'middle' }, g, 'C');
  el('rect', { x: 288, y: 64, width: 44, height: 46, rx: 4, class: 'equip-hot' }, g);
  ref.flame = el('path', { d: 'M310 104 C298 94 304 84 306 76 C309 84 314 82 313 72 C322 84 324 96 310 104 Z', class: 'flame' }, g);
  pipe('M280 128 L296 110', 's-air', 'air');
  pipe('M324 110 L340 128', 's-gas', 'gas');
  pipe('M310 20 V64', 's-fuel', 'fuel');
  el('text', { x: 318, y: 26, class: 'lbl-sm' }, g, 'GAS NATURALE');
  T('fuel', 318, 40);
  el('polygon', { points: '340,125 450,100 450,200 340,175', class: 'equip-hot' }, g);
  el('text', { x: 398, y: 155, class: 'lbl', 'text-anchor': 'middle' }, g, 'T');
  el('polygon', { points: '450,100 505,84 540,84 540,216 505,216 450,200', class: 'duct' }, g);
  ref.dbFlame = el('path', { d: 'M522 170 C512 160 516 150 518 142 C521 150 526 148 525 138 C534 150 536 162 522 170 Z', class: 'flame off' }, g);
  ref.dbText = T('db', 500, 244, 'val-muted', 'middle', '');

  T('air', 30, 258, 'val');
  T('comp', 225, 222, 'val', 'middle');
  T('comp2', 225, 236, 'val-muted', 'middle');
  T('turb', 395, 222, 'val', 'middle');
  T('turb2', 395, 236, 'val-muted', 'middle');
  T('gtP', 62, 204, 'val-lg', 'middle');
  T('gtRpm', 62, 219, 'val-muted', 'middle');
  T('gtMode', 30, 273, 'val-muted');

  // ------------------------------------------------------------- GVR
  const hx0 = 540, hx1 = 1000, hy0 = 84, hy1 = 216;
  el('rect', { x: hx0, y: hy0, width: hx1 - hx0, height: hy1 - hy0, class: 'duct' }, g);
  el('text', { x: hx0, y: 24, class: 'lbl' }, g, cfg.nGT > 1 ? `GVR ×${cfg.nGT}` : 'GVR');
  const cols = r && r.bt ? bankColumns(r.bt.banks) : [];
  const nCols = Math.max(cols.length, 1);
  const cx0 = hx0 + 14, cx1 = hx1 - 8;
  const cw = (cx1 - cx0) / nCols;
  const colX = [];
  cols.forEach((col, i) => {
    const x = cx0 + i * cw + 3;
    const w = cw - 6;
    colX.push(x + w / 2);
    const nb = col.banks.length;
    col.banks.forEach((b, j) => {
      const bx = x + (j * w) / nb;
      const bw = w / nb;
      const kind = bankKind(b.name);
      const lvl = bankLevel(b.name);
      const sc = kind === 'eco' || kind === 'pre' ? 'water' : kind === 'rh' ? 'ip' : LEVEL_CLASS[lvl] || 'water';
      el('rect', { x: bx + 1, y: hy0 + 8, width: bw - 2, height: hy1 - hy0 - 24, class: 'bank' }, g);
      const nt = Math.max(2, Math.floor((bw - 4) / 5));
      for (let k = 0; k < nt; k++) {
        const tx = bx + 3 + ((bw - 6) * (k + 0.5)) / nt;
        el('line', { x1: tx, y1: hy0 + 12, x2: tx, y2: hy1 - 20, class: `tube s-${sc}` }, g);
      }
      const [k1, k2] = b.name.replace(' (condensato)', '').split(' ');
      const lx = bx + bw / 2;
      const fs = nb > 1 || cw < 46 ? 9.5 : 10.5;
      el('text', { x: lx, y: hy0 - 2 - (k2 ? 10 : 0), class: 'lbl-sm', 'text-anchor': 'middle', 'font-size': fs }, g, k1);
      if (k2) el('text', { x: lx, y: hy0 - 2, class: 'lbl-sm', 'text-anchor': 'middle', 'font-size': fs }, g, k2);
      // per i banchi in parallelo si mostra la potenza complessiva della colonna
      if (j === 0) ref.cols.push({ name: b.name, idx: i, t: el('text', { x: x + w / 2, y: hy1 - 4, class: 'val-muted', 'text-anchor': 'middle', 'font-size': 9.5 }, g, '') });
      b._cx = lx;
    });
  });
  // temperature fumi ai confini tra colonne
  for (let i = 0; i <= cols.length; i++) {
    const x = i === 0 ? hx0 + 8 : i === cols.length ? hx1 - 2 : cx0 + i * cw;
    ref.tempLabels.push(el('text', { x, y: hy1 + 14, class: 'val-muted', 'text-anchor': 'middle', 'font-size': 10 }, g, ''));
  }
  el('text', { x: hx1 + 52, y: hy1 + 14, class: 'lbl-sm' }, g, '← FUMI [°C]');
  el('text', { x: hx1 + 52, y: hy1 - 4, class: 'lbl-sm' }, g, '← BANCHI [MW]');

  // posizione dei banchi per nome (prima occorrenza)
  const posOf = (name) => {
    for (const col of cols) for (const b of col.banks) if (b.name === name) return b._cx;
    return null;
  };

  // corpi cilindrici sopra gli evaporatori
  ref.drums = [];
  names.forEach((lv) => {
    const x = posOf(`EVA ${lv}`);
    if (x === null) return;
    el('line', { x1: x - 30, y1: 46, x2: x - 30, y2: hy0 - 22, class: `tube s-${LEVEL_CLASS[lv]}` }, g);
    el('line', { x1: x + 30, y1: 46, x2: x + 30, y2: hy0 - 22, class: `tube s-${LEVEL_CLASS[lv]}` }, g);
    el('rect', { x: x - 26, y: 36, width: 52, height: 18, rx: 9, class: 'casing' }, g);
    el('rect', { x: x - 22, y: 46, width: 44, height: 5, rx: 2.5, class: `f-${LEVEL_CLASS[lv]}`, opacity: 0.55 }, g);
    el('text', { x, y: 49, class: 'lbl-sm', 'text-anchor': 'middle', 'font-size': 10 }, g, lv);
    ref.drums.push({ lv, t: el('text', { x, y: 29, class: 'val', 'text-anchor': 'middle' }, g, '—') });
  });

  // camino
  el('rect', { x: hx1, y: 14, width: 42, height: hy1 - 14, class: 'casing' }, g);
  ref.smoke = [0, 1, 2].map((i) => el('circle', { cx: hx1 + 21 + (i - 1) * 6, cy: 6 - i * 3, r: 5 + i * 2, class: 'smoke' }, g));
  el('text', { x: hx1 + 52, y: 34, class: 'lbl-sm' }, g, 'CAMINO');
  T('stackT', hx1 + 52, 50, 'val-lg');
  T('stackO2', hx1 + 52, 65, 'val-muted');
  T('stackCO2', hx1 + 52, 79, 'val-muted');

  // ------------------------------------------------------------- Turbina a vapore
  const n = names.length;
  const secs = [];
  if (n === 3) secs.push({ kind: 'HP', x0: 560, x1: 632 }, { kind: 'IP', x0: 650, x1: 722 }, { kind: 'LP', x0: 742, x1: 862 });
  if (n === 2) secs.push({ kind: 'HP', x0: 600, x1: 684 }, { kind: 'LP', x0: 742, x1: 862 });
  if (n === 1) secs.push({ kind: 'LP', x0: 742, x1: 862, label: 'TV' });
  const shY = 440;
  el('line', { x1: secs[0].x0 - 12, y1: shY, x2: 877, y2: shY, class: 'shaft' }, g);
  ref.g2 = el('circle', { cx: 905, cy: shY, r: 28, class: 'gen' }, g);
  el('text', { x: 905, y: shY + 5, class: 'lbl', 'text-anchor': 'middle' }, g, 'G');
  T('stP', 905, shY - 40, 'val-lg', 'middle');
  T('stState', 905, shY - 54, 'val-muted', 'middle');
  el('text', { x: 548, y: 530, class: 'lbl' }, g, 'Turbina a vapore');
  ref.secText = [];
  secs.forEach((s, i) => {
    let pts;
    if (s.kind === 'LP') {
      const xm = (s.x0 + s.x1) / 2;
      pts = `${s.x0},386 ${xm - 12},420 ${xm + 12},420 ${s.x1},386 ${s.x1},494 ${xm + 12},460 ${xm - 12},460 ${s.x0},494`;
      s.inX = xm;
      s.inY = 420;
    } else {
      pts = `${s.x0},420 ${s.x1},404 ${s.x1},476 ${s.x0},460`;
      s.inX = s.x0 + 10;
      s.inY = 418;
      s.outX = s.x1 - 10;
      s.outY = 406;
    }
    el('polygon', { points: pts, class: 'equip' }, g);
    el('text', { x: (s.x0 + s.x1) / 2, y: shY + 4, class: 'lbl-sm', 'text-anchor': 'middle', fill: 'var(--fg)' }, g, s.label || s.kind);
    const ty = s.kind === 'LP' ? 508 : 494;
    const tx = s.kind === 'LP' ? (s.x0 + s.x1) / 2 + 18 : (s.x0 + s.x1) / 2;
    ref.secText.push(el('text', { x: tx, y: ty, class: 'val', 'text-anchor': s.kind === 'LP' ? 'start' : 'middle' }, g, '—'));
  });

  // condensatore
  const lp = secs[secs.length - 1];
  const lpm = (lp.x0 + lp.x1) / 2;
  el('rect', { x: lpm - 14, y: 494, width: 28, height: 26, class: 'casing' }, g);
  el('rect', { x: lp.x0, y: 520, width: lp.x1 - lp.x0, height: 52, rx: 4, class: 'casing' }, g);
  for (let i = 0; i < 5; i++) el('line', { x1: lp.x0 + 10, y1: 530 + i * 8, x2: lp.x1 - 10, y2: 530 + i * 8, class: 'tube s-water', opacity: 0.6 }, g);
  el('text', { x: lpm, y: 589, class: 'lbl-sm', 'text-anchor': 'middle' }, g, cfg.steam.condenser.type === 'air' ? 'AEROCONDENSATORE' : 'CONDENSATORE');
  T('cond', lp.x0 - 6, 548, 'val', 'end');
  T('cond2', lp.x0 - 6, 562, 'val-muted', 'end');
  if (cfg.steam.condenser.type === 'water') {
    pipe(`M${lp.x1} 532 H${lp.x1 + 40}`, 's-water', 'cw');
    pipe(`M${lp.x1 + 40} 560 H${lp.x1}`, 's-water', 'cw');
    T('cw', lp.x1 + 44, 550, 'val-muted', 'start', '');
  } else {
    el('polygon', { points: `${lp.x1 + 20},572 ${lp.x1 + 45},528 ${lp.x1 + 70},572`, class: 'casing' }, g);
    el('circle', { cx: lp.x1 + 45, cy: 522, r: 7, class: 'casing' }, g);
    T('cw', lp.x1 + 45, 508, 'val-muted', 'middle', '');
  }

  // ------------------------------------------------------------- Tubazioni vapore
  const yHP = 262, yHRH = 282, yCRH = 302, yLP = 330, yX = 364;
  const by = hy1;
  const shHP = posOf('SH HP') ?? posOf('EVA HP');
  const hpSec = secs[0];
  if (n === 1) {
    pipe(`M${shHP} ${by} V${yHP} H${lp.inX} V${lp.inY}`, 's-hp', 'hp');
  } else {
    pipe(`M${shHP} ${by} V${yHP} H${hpSec.inX} V${hpSec.inY}`, 's-hp', 'hp');
  }
  if (type === '3PRH') {
    const rh = posOf('RH');
    const shIP = posOf('SH IP');
    const ipSec = secs[1];
    pipe(`M${hpSec.outX} ${hpSec.outY} V${yCRH} H${rh} V${by}`, 's-ip', 'crh');
    pipe(`M${rh + 6} ${by} V${yHRH} H${ipSec.inX} V${ipSec.inY}`, 's-hp', 'hrh');
    if (shIP !== null) {
      pipe(`M${shIP} ${by} V${yCRH}`, 's-ip', 'ip');
      el('circle', { cx: shIP, cy: yCRH, r: 3.5, class: 'f-ip' }, g);
    }
    pipe(`M${ipSec.outX} ${ipSec.outY} V${yX} H${lp.inX} V${lp.inY}`, 's-ip', 'xo');
  } else if (n === 2) {
    pipe(`M${hpSec.outX} ${hpSec.outY} V${yX} H${lp.inX} V${lp.inY}`, 's-ip', 'xo');
  }
  if (n >= 2) {
    const shLP = posOf('SH LP') ?? posOf('EVA LP');
    pipe(`M${shLP} ${by} V${yLP} H${lp.inX + 14} V${yX}`, 's-lp', 'lp');
    el('circle', { cx: lp.inX + 14, cy: yX, r: 3.5, class: 'f-lp' }, g);
  }
  // condensato: pompa e ritorno al preriscaldatore
  const pre = posOf('PRE (condensato)') ?? (hx1 - 20);
  const pumpX = Math.max(pre, 975);
  pipe(`M${lp.x1 - 20} 572 V580 H${pumpX} V${by}`, 's-water', 'cond');
  el('circle', { cx: pumpX, cy: 470, r: 9, class: 'casing' }, g);
  el('path', { d: `M${pumpX - 4} 474 L${pumpX} 465 L${pumpX + 4} 474 Z`, class: 'f-water' }, g);
  if (pumpX !== pre) el('path', { d: `M${pumpX} ${by + 0.5} H${pre}`, class: 'pipe s-water' }, g);

  // ------------------------------------------------------------- tabella correnti nel sinottico
  const tx = 30, ty = 318;
  el('text', { x: tx, y: ty - 12, class: 'lbl' }, g, 'Correnti vapore');
  const heads = [['p bar', 300], ['T °C', 370], ['m kg/s', 450]];
  for (const [h, x] of heads) el('text', { x, y: ty - 12, class: 'lbl-sm', 'text-anchor': 'end' }, g, h);
  ref.rows = [];
  const rowsDef = streamRowsDef(type);
  rowsDef.forEach((rw, i) => {
    const y = ty + 8 + i * 19;
    el('line', { x1: tx, y1: y - 4, x2: tx + 16, y2: y - 4, class: `pipe s-${rw.cls}`, 'stroke-width': 3 }, g);
    el('text', { x: tx + 24, y, class: 'val', 'font-family': 'var(--font-body)', 'font-size': 12 }, g, rw.label);
    ref.rows.push({
      key: rw.key,
      p: el('text', { x: 300, y, class: 'val', 'text-anchor': 'end' }, g, '—'),
      T: el('text', { x: 370, y, class: 'val', 'text-anchor': 'end' }, g, '—'),
      m: el('text', { x: 450, y, class: 'val', 'text-anchor': 'end' }, g, '—'),
    });
  });

  ref.type = type;
  return ref;
}

function streamRowsDef(type) {
  const rows = [{ key: 'hp', label: 'Vapore HP', cls: 'hp' }];
  if (type === '3PRH') {
    rows.push({ key: 'crh', label: 'Risurriscaldato freddo', cls: 'ip' });
    rows.push({ key: 'ip', label: 'Vapore IP', cls: 'ip' });
    rows.push({ key: 'hrh', label: 'Risurriscaldato caldo', cls: 'hp' });
  }
  if (type !== '1P') rows.push({ key: 'lp', label: 'Vapore LP', cls: 'lp' });
  rows.push({ key: 'exh', label: 'Scarico TV', cls: 'lp' });
  rows.push({ key: 'cond', label: 'Condensato', cls: 'water' });
  return rows;
}

/** Valori delle correnti vapore principali (totali d'impianto). */
export function steamStreams(r) {
  const b = r.bt;
  const out = {};
  const s0 = b.sections[0];
  out.hp = { p: s0.pIn, T: s0.Tin, m: s0.m };
  if (b.type === '3PRH') {
    out.crh = { p: b.pAdm[1], T: s0.Tout, m: s0.m };
    out.ip = { p: b.pAdm[1], T: b.Tsh[1], m: b.mLevelsTot[1] };
    out.hrh = { p: b.pRHout, T: b.Trh, m: b.sections[1].m };
  }
  if (b.type !== '1P') {
    const k = b.Tsh.length - 1;
    out.lp = { p: b.pAdm[k], T: b.Tsh[k], m: b.mLevelsTot[k] };
  }
  const last = b.sections[b.sections.length - 1];
  out.exh = { p: b.pCond, T: last.Tout, m: last.m, x: last.xOut };
  out.cond = { p: b.pCond, T: b.Tcond, m: last.m };
  return out;
}

/** Aggiorna i valori dello schema. `v` è la vista composta dall'app. */
export function updateMimic(ref, v) {
  const t = ref.text;
  const set = (k, s) => { if (t[k] && t[k].textContent !== s) t[k].textContent = s; };
  const r = v.ss;
  const on = !!(r && r.online);
  const gt = on ? r.gt : null;

  set('gtP', `${fmt(v.Pgt, 1)} MW`);
  set('gtRpm', `${fmt(v.speed, 0)} giri/min`);
  set('gtMode', on ? `Regolazione TG: ${gt.mode} · IGV ${fmt(gt.igv * 100, 0)} %` : v.stateLabel);
  ref.g1.classList.toggle('gen-on', v.Pgt > 0.1);
  ref.flame.classList.toggle('off', !(on || v.fuelFrac > 0));
  if (on) {
    set('air', `${fmt(gt.mAir * v.nOn, 0)} kg/s · ${fmt(gt.T1, 1)} °C`);
    set('fuel', `${fmt(gt.mFuel * v.nOn, 2)} kg/s`);
    set('comp', `β ${fmt(gt.PR, 1)} · ${fmt(gt.T2, 0)} °C`);
    set('comp2', `${fmt(gt.Wc, 0)} MW assorbiti`);
    set('turb', `${fmt(gt.TIT, 0)} → ${fmt(gt.T4, 1)} °C`);
    set('turb2', `${fmt(gt.mExh * v.nOn, 0)} kg/s fumi`);
  } else {
    for (const k of ['air', 'fuel', 'comp', 'comp2', 'turb', 'turb2']) set(k, '—');
  }
  const db = on && r.mFuelDB > 0;
  ref.dbFlame.classList.toggle('off', !db);
  set('db', db ? `post-comb. ${fmt(r.gas.T, 0)} °C` : '');

  // GVR
  if (on) {
    const cols = bankColumns(r.bt.banks);
    for (const c of ref.cols) {
      const col = cols[c.idx];
      c.t.textContent = col ? fmt(col.banks.reduce((a, b) => a + b.Q, 0), 1) : '';
    }
    ref.tempLabels.forEach((lab, i) => {
      const T = i < cols.length ? cols[i].TgIn : cols.length ? cols[cols.length - 1].TgOut : null;
      lab.textContent = T !== null && i <= cols.length ? fmt(T, 0) : '';
    });
    for (const d of ref.drums) {
      const k = r.bt.names.indexOf(d.lv);
      d.t.textContent = `${fmt(r.bt.pDrum[k], 1)} bar`;
    }
  } else {
    for (const c of ref.cols) c.t.textContent = '';
    for (const lab of ref.tempLabels) lab.textContent = '';
    for (const d of ref.drums) d.t.textContent = '—';
  }
  set('stackT', on || v.Tstack > 35 ? `${fmt(v.Tstack, 1)} °C` : '—');
  set('stackO2', on ? `O₂ ${fmt(r.stackO2dry, 1)} % secco` : '');
  set('stackCO2', on ? `CO₂ ${fmt(r.co2, 1)} t/h` : '');
  ref.smoke.forEach((s) => s.setAttribute('opacity', on ? '1' : '0'));

  // TV
  set('stP', `${fmt(v.Pst, 1)} MW`);
  set('stState', v.stOnline ? 'TV in parallelo' : on ? 'Vapore in bypass' : 'TV ferma');
  ref.g2.classList.toggle('gen-on', v.Pst > 0.1);
  if (on) {
    // potenza elettrica per sezione, ripartita sulla potenza TV attuale
    const sumW = r.bt.sections.reduce((a, q) => a + q.W, 0);
    r.bt.sections.forEach((s, i) => {
      if (ref.secText[i]) ref.secText[i].textContent = `${fmt(sumW > 0 ? (s.W / sumW) * v.Pst : 0, 1)} MW`;
    });
    set('cond', `${fmt(r.bt.pCond * 1000, 0)} mbar · ${fmt(r.bt.Tcond, 1)} °C`);
    set('cond2', `${fmt(r.bt.Qcond, 0)} MW scaricati`);
    const c = r.op;
    set('cw', v.condType === 'air' ? `aria ${fmt(c.Tamb, 1)} °C` : `${fmt(c.Tcw, 1)} °C`);
    const st = steamStreams(r);
    for (const row of ref.rows) {
      const s = st[row.key];
      if (!s) continue;
      row.p.textContent = s.p < 1 ? fmt(s.p, 3) : fmt(s.p, 1);
      row.T.textContent = fmt(s.T, 1);
      row.m.textContent = fmt(s.m, 1);
    }
  } else {
    for (const s of ref.secText) s.textContent = '—';
    set('cond', '—');
    set('cond2', '');
    set('cw', '');
    for (const row of ref.rows) { row.p.textContent = '—'; row.T.textContent = '—'; row.m.textContent = '—'; }
  }

  // flussi animati: velocità proporzionale alla portata
  const flowOf = {
    air: on ? 1 : v.speed / 3000 * 0.3,
    gas: on ? 1 : v.fuelFrac > 0 ? 0.3 : 0,
    fuel: on || v.fuelFrac > 0 ? 1 : 0,
    hp: on ? r.bt.mLevelsTot[0] / Math.max(v.ref.hp, 1) : 0,
    crh: on && v.stOnline ? 1 : 0,
    hrh: on && v.stOnline ? 1 : 0,
    ip: on && r.bt.mLevelsTot[1] > 0.5 ? 0.8 : 0,
    lp: on && r.bt.mLevelsTot[r.bt.mLevelsTot.length - 1] > 0.5 ? 0.8 : 0,
    xo: on && v.stOnline ? 1 : 0,
    cond: on ? 0.8 : 0,
    cw: 1,
  };
  for (const f of ref.flows) {
    const q = flowOf[f.key] ?? 0;
    const off = !(q > 0.02);
    f.el.classList.toggle('off', off);
    if (!off) {
      const dur = Math.max(0.35, Math.min(4, 1 / q)).toFixed(2) + 's';
      if (f.el.style.animationDuration !== dur) f.el.style.animationDuration = dur;
    }
  }
}
