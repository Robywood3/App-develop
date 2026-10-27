// Simboli grafici per schemi di processo e P&ID (ispirati a ISA 5.1 / ISO 10628)
// e per schemi elettrici unifilari (IEC 60617). Unità mm sul foglio.

import { ST } from './sheet.js';
import { textWidth } from './pdf.js';

const W = '#ffffff';

/** Linea di processo con freccia di flusso opzionale ed etichetta del numero linea. */
export function pline(sh, pts, { st = ST.med, arrow = true, label = null, at = 0.5, side = -1, size = 1.7, seg = null } = {}) {
  sh.path(pts, st);
  // segmento più lungo per freccia ed etichetta
  let best = seg ?? 0, len = 0;
  if (seg === null) {
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (l > len) { len = l; best = i - 1; }
    }
  }
  const [a, b] = [pts[best], pts[best + 1]];
  const mx = a[0] + (b[0] - a[0]) * at, my = a[1] + (b[1] - a[1]) * at;
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  if (arrow) {
    const s = 1.8;
    const ax = mx + Math.cos(ang) * 1.2, ay = my + Math.sin(ang) * 1.2;
    sh.path([[ax, ay], [ax - s * Math.cos(ang - 0.45), ay - s * Math.sin(ang - 0.45)], [ax - s * Math.cos(ang + 0.45), ay - s * Math.sin(ang + 0.45)]], { f: st.s || '#000' }, true);
  }
  if (label) {
    const vertical = Math.abs(Math.sin(ang)) > 0.7;
    if (vertical) sh.text(mx + side * -1.4 + (side < 0 ? 0 : 0), my + 6, label, { size, rot: -90, anchor: 'start' });
    else sh.text(mx + 3, my + side * 1.2, label, { size });
  }
  return [mx, my];
}

/** Valvola: kind gate|globe|ball|check|butterfly|control|motor|nrv|plug */
export function valve(sh, x, y, { dir = 'h', kind = 'gate', s = 2.6, tag = null, tagSide = 1, fail = null } = {}) {
  const h = dir === 'h';
  const p = (u, v) => (h ? [x + u, y + v] : [x + v, y + u]);
  const body = { s: '#000000', w: 0.3, f: W };
  if (kind === 'butterfly') {
    sh.path([p(-s, -s * 0.8), p(-s, s * 0.8)], ST.norm).path([p(s, -s * 0.8), p(s, s * 0.8)], ST.norm);
    sh.circle(x, y, s * 0.55, body);
    sh.path([p(-s * 0.55, s * 0.55), p(s * 0.55, -s * 0.55)], ST.norm);
  } else if (kind === 'check' || kind === 'nrv') {
    sh.path([p(-s, -s * 0.75), p(-s, s * 0.75), p(s, -s * 0.75), p(s, s * 0.75)], body, true);
    sh.path([p(s, -s * 0.75), p(s, s * 0.75)], ST.med);
    sh.path([p(-s, -s * 0.75), p(0, 0), p(-s, s * 0.75)], { f: '#000000' }, true);
  } else {
    sh.path([p(-s, -s * 0.75), p(-s, s * 0.75), p(s, -s * 0.75), p(s, s * 0.75)], body, true);
    if (kind === 'globe' || kind === 'control') sh.circle(x, y, 0.55, { f: '#000000' });
    if (kind === 'ball') sh.circle(x, y, s * 0.42, body);
    if (kind === 'plug') sh.path([p(-s * 0.3, -s * 0.5), p(s * 0.3, -s * 0.5), p(s * 0.3, s * 0.5), p(-s * 0.3, s * 0.5)], { f: '#000000' }, true);
  }
  if (kind === 'control' || kind === 'motor') {
    const stem = h ? [[x, y], [x, y - s * 1.8]] : [[x, y], [x + s * 1.8, y]];
    sh.path(stem, ST.norm);
    if (kind === 'control') {
      if (h) sh.arc(x, y - s * 1.8, s * 0.9, 180, 360, { s: '#000000', w: 0.3, f: W }).line(x - s * 0.9, y - s * 1.8, x + s * 0.9, y - s * 1.8, ST.norm);
      else sh.arc(x + s * 1.8, y, s * 0.9, -90, 90, { s: '#000000', w: 0.3, f: W }).line(x + s * 1.8, y - s * 0.9, x + s * 1.8, y + s * 0.9, ST.norm);
    } else {
      const cx = h ? x : x + s * 2.4, cy = h ? y - s * 2.4 : y;
      sh.rect(cx - 1.3, cy - 1.3, 2.6, 2.6, body);
      sh.textMid(cx, cy, 'M', { size: 1.7, anchor: 'middle', bold: true });
    }
    if (fail) sh.text(h ? x + s * 1.2 : x + s * 2.8, h ? y - s * 1.2 : y + s * 1.6, fail, { size: 1.3 });
  }
  if (tag) {
    if (h) sh.text(x, y + (tagSide > 0 ? s + 2.6 : -s - 1.4 - (kind === 'control' || kind === 'motor' ? s * 2.8 : 0)), tag, { size: 1.6, anchor: 'middle' });
    else sh.text(x + (tagSide > 0 ? s + 1.2 + (kind === 'control' || kind === 'motor' ? s * 2.4 : 0) : -s - 1.2), y + 0.6, tag, { size: 1.6, anchor: tagSide > 0 ? 'start' : 'end' });
  }
}

/** Valvola di sicurezza ad angolo: ingresso dal basso, scarico verso destra. */
export function psv(sh, x, y, { tag = null, s = 2.4, out = 1 } = {}) {
  const body = { s: '#000000', w: 0.3, f: W };
  sh.path([[x, y], [x - s * 0.8, y + s * 1.4], [x + s * 0.8, y + s * 1.4]], body, true); // ingresso (punta verso l'alto)
  sh.path([[x, y], [x + out * s * 1.4, y - s * 0.8], [x + out * s * 1.4, y + s * 0.8]], body, true);
  // molla
  const zz = [[x, y]];
  for (let i = 1; i <= 5; i++) zz.push([x + (i % 2 ? 0.9 : -0.9), y - i * 0.75]);
  zz.push([x, y - 4.6]);
  sh.path(zz, ST.thin);
  sh.line(x - 1.2, y - 4.6, x + 1.2, y - 4.6, ST.norm);
  if (tag) sh.text(x - 1.6, y - 5.4, tag, { size: 1.5, anchor: 'end' });
}

/** Strumento: bolla circolare con lettere funzionali e numero; dcs = linea centrale (sala controllo). */
export function instr(sh, x, y, fn, num, { dcs = true, r = 3.3, to = null, sis = false } = {}) {
  if (to) {
    // linea di segnale dal bordo della bolla al punto di presa
    const d = Math.hypot(to[0] - x, to[1] - y) || 1;
    sh.line(x + ((to[0] - x) / d) * r, y + ((to[1] - y) / d) * r, to[0], to[1], ST.signal);
  }
  if (sis) sh.rect(x - r, y - r, 2 * r, 2 * r, { s: '#000000', w: 0.25, f: W });
  sh.circle(x, y, r, { s: '#000000', w: 0.3, f: W });
  if (dcs) sh.line(x - r, y, x + r, y, ST.thin);
  const fs = fn.length > 3 ? 1.45 : 1.75;
  sh.text(x, y - 0.6, fn, { size: fs, anchor: 'middle', bold: true });
  sh.text(x, y + 2.2, String(num), { size: 1.45, anchor: 'middle' });
}

/** Pompa centrifuga (cerchio con mandata tangente). */
export function pump(sh, x, y, { r = 4, tag = null, label = null, out = 'up' } = {}) {
  sh.circle(x, y, r, { s: '#000000', w: 0.4, f: W });
  if (out === 'up') sh.path([[x, y - r], [x + r, y - r], [x + r, y - r + 1.6]], ST.med);
  else sh.path([[x + r, y], [x + r + 0.01, y]], ST.med);
  sh.path([[x - r * 0.55, y - r * 0.45], [x + r * 0.7, y], [x - r * 0.55, y + r * 0.45]], { s: '#000000', w: 0.3 }, true);
  sh.path([[x - r * 0.6, y + r * 0.8], [x - r, y + r + 1.4], [x + r, y + r + 1.4], [x + r * 0.6, y + r * 0.8]], ST.norm);
  if (tag) sh.text(x, y + r + 4.2, tag, { size: 1.7, anchor: 'middle', bold: true });
  if (label) sh.text(x, y + r + 6.6, label, { size: 1.5, anchor: 'middle' });
}

/** Rinvio ad altro foglio (pentagono). dir: 'right' (uscita) | 'left' (ingresso da sinistra). */
export function offPage(sh, x, y, dir, text, ref = '', { w = 30 } = {}) {
  const h = 5.2;
  let pts;
  if (dir === 'right') pts = [[x, y - h / 2], [x + w - 3, y - h / 2], [x + w, y], [x + w - 3, y + h / 2], [x, y + h / 2]];
  else pts = [[x, y - h / 2], [x - w + 3, y - h / 2], [x - w, y], [x - w + 3, y + h / 2], [x, y + h / 2]];
  sh.path(pts, { s: '#000000', w: 0.35, f: W }, true);
  const cx = dir === 'right' ? x + (w - 3) / 2 : x - (w - 3) / 2;
  sh.text(cx, y - 0.2, text, { size: 1.55, anchor: 'middle', bold: true });
  if (ref) sh.text(cx, y + 2.1, ref, { size: 1.3, anchor: 'middle' });
}

/** Etichetta apparecchiatura: tag sottolineato e descrizione. */
export function equipTag(sh, x, y, tag, desc, { anchor = 'middle', size = 2.1 } = {}) {
  sh.text(x, y, tag, { size, bold: true, anchor });
  const w = textWidth(tag, size, true);
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  sh.line(x0, y + 0.6, x0 + w, y + 0.6, ST.thin);
  if (desc) {
    const parts = Array.isArray(desc) ? desc : [desc];
    parts.forEach((d, i) => sh.text(x, y + 3.2 + i * 2.5, d, { size: size * 0.78, anchor }));
  }
}

/** Corpo cilindrico orizzontale con fondi semisferici. */
export function drum(sh, x, y, w, h, st = { s: '#000000', w: 0.45, f: W }) {
  const r = h / 2;
  const pts = [];
  for (let i = 0; i <= 12; i++) { const a = Math.PI / 2 + (Math.PI * i) / 12; pts.push([x + r + r * Math.cos(a), y + r + r * Math.sin(a)]); }
  for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + (Math.PI * i) / 12; pts.push([x + w - r + r * Math.cos(a), y + r + r * Math.sin(a)]); }
  sh.path(pts, st, true);
}

/** Recipiente verticale (fondi semiellittici). */
export function vvessel(sh, x, y, w, h, st = { s: '#000000', w: 0.45, f: W }) {
  const r = w / 2, e = w * 0.25;
  const pts = [];
  for (let i = 0; i <= 12; i++) { const a = Math.PI + (Math.PI * i) / 12; pts.push([x + r + r * Math.cos(a), y + e + e * Math.sin(a)]); }
  for (let i = 0; i <= 12; i++) { const a = (Math.PI * i) / 12; pts.push([x + r + r * Math.cos(a), y + h - e + e * Math.sin(a)]); }
  sh.path(pts, st, true);
}

/** Banco di scambio termico (serpentino) in un rettangolo. */
export function coil(sh, x, y, w, h, { label = null, st = ST.norm } = {}) {
  sh.rect(x, y, w, h, { s: '#000000', w: 0.3, f: W });
  const nz = Math.max(4, Math.round(h / 4));
  const pts = [];
  for (let i = 0; i <= nz; i++) pts.push([x + (i % 2 ? w - 1 : 1), y + 1 + ((h - 2) * i) / nz]);
  sh.path(pts, st);
  if (label) {
    const lines = label.split(' ');
    lines.forEach((l, i) => sh.text(x + w / 2, y - 1.2 - (lines.length - 1 - i) * 2.2, l, { size: 1.6, anchor: 'middle', bold: true }));
  }
}

/** Scambiatore a fascio tubiero (cerchio con serpentino). */
export function hx(sh, x, y, r = 4) {
  sh.circle(x, y, r, { s: '#000000', w: 0.4, f: W });
  sh.path([[x - r, y], [x - r / 2, y - r / 2], [x, y + r / 2], [x + r / 2, y - r / 2], [x + r, y]], ST.norm);
}

/** Filtro a Y / separatore. */
export function strainer(sh, x, y, s = 2.4) {
  sh.path([[x - s, y - s * 0.7], [x - s, y + s * 0.7], [x + s, y - s * 0.7], [x + s, y + s * 0.7]], { s: '#000000', w: 0.3, f: W }, true);
  sh.line(x, y, x + s * 0.8, y + s * 1.4, ST.norm);
  sh.line(x + s * 0.3, y + s * 1.6, x + s * 1.3, y + s * 1.2, ST.norm);
}

/** Elemento di misura di portata (flangia tarata). */
export function orifice(sh, x, y, dir = 'h') {
  if (dir === 'h') { sh.line(x - 0.8, y - 2, x - 0.8, y + 2, ST.med).line(x + 0.8, y - 2, x + 0.8, y + 2, ST.med); } else { sh.line(x - 2, y - 0.8, x + 2, y - 0.8, ST.med).line(x - 2, y + 0.8, x + 2, y + 0.8, ST.med); }
}

// ------------------------------------------------------------------ simboli elettrici (IEC 60617)
export function elGen(sh, x, y, r = 6, label = 'G') {
  sh.circle(x, y, r, { s: '#000000', w: 0.45, f: W });
  sh.text(x, y + 0.2, label, { size: 3, anchor: 'middle', bold: true });
  sh.path([[x - 2.2, y + 2.4], [x - 1.1, y + 1.6], [x, y + 2.4], [x + 1.1, y + 3.2], [x + 2.2, y + 2.4]], ST.thin);
}
export function elMotor(sh, x, y, r = 3.2) {
  sh.circle(x, y, r, { s: '#000000', w: 0.35, f: W });
  sh.textMid(x, y, 'M', { size: 2.3, anchor: 'middle', bold: true });
}
/** Trasformatore a due avvolgimenti verticale; (x, y) = centro superiore del primo cerchio. */
export function elTrafo(sh, x, y, r = 4.2) {
  sh.circle(x, y + r, r, { s: '#000000', w: 0.4 });
  sh.circle(x, y + r * 2.4, r, { s: '#000000', w: 0.4 });
  return y + r * 3.4;
}
/** Interruttore (quadrato) su linea verticale; restituisce la y inferiore. */
export function elBreaker(sh, x, y, s = 2.8) {
  sh.rect(x - s / 2, y, s, s, { s: '#000000', w: 0.4, f: W });
  return y + s;
}
/** Sezionatore su linea verticale. */
export function elDisconnector(sh, x, y, l = 4) {
  sh.line(x, y + l, x - l * 0.55, y + 0.6, ST.norm);
  sh.line(x - 1, y, x + 1, y, ST.norm);
  return y + l;
}
export function elEarth(sh, x, y) {
  sh.line(x, y, x, y + 1.5, ST.norm).line(x - 2, y + 1.5, x + 2, y + 1.5, ST.norm).line(x - 1.3, y + 2.3, x + 1.3, y + 2.3, ST.norm).line(x - 0.6, y + 3.1, x + 0.6, y + 3.1, ST.norm);
}
/** Trasformatore di corrente (cerchietti sulla linea). */
export function elCT(sh, x, y) {
  sh.circle(x, y, 1.3, ST.thin);
}
