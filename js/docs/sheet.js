// Foglio di disegno vettoriale (unità mm, origine in alto a sinistra, y verso il basso),
// esportabile in SVG (anteprima) e PDF; cornice con cartiglio e tabelle impaginate.

import { textWidth } from './pdf.js';

export const A3 = { w: 420, h: 297 };

export const ST = {
  hair: { s: '#000000', w: 0.13 },
  thin: { s: '#000000', w: 0.18 },
  norm: { s: '#000000', w: 0.35 },
  med: { s: '#000000', w: 0.5 },
  thick: { s: '#000000', w: 0.7 },
  heavy: { s: '#000000', w: 1.0 },
  dash: { s: '#000000', w: 0.25, d: [1.6, 1.0] },
  signal: { s: '#000000', w: 0.18, d: [1.2, 0.8] },
  white: { s: '#000000', w: 0.35, f: '#ffffff' },
  black: { f: '#000000' },
};

export const withFill = (st, f) => ({ ...st, f });
export const withColor = (st, s) => ({ ...st, s });

export class Sheet {
  constructor(w = A3.w, h = A3.h) {
    this.w = w;
    this.h = h;
    this.items = [];
  }
  path(pts, st = ST.norm, closed = false) {
    if (pts.length >= 2) this.items.push({ t: 'path', pts, st, closed });
    return this;
  }
  line(x1, y1, x2, y2, st = ST.norm) { return this.path([[x1, y1], [x2, y2]], st); }
  rect(x, y, w, h, st = ST.norm) { return this.path([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], st, true); }
  circle(cx, cy, r, st = ST.norm) { this.items.push({ t: 'circle', cx, cy, r, st }); return this; }
  text(x, y, s, o = {}) {
    if (s === null || s === undefined || s === '') return this;
    this.items.push({ t: 'text', x, y, s: String(s), size: o.size ?? 2.5, anchor: o.anchor ?? 'start', bold: !!o.bold, rot: o.rot ?? 0, color: o.color });
    return this;
  }
  /** Testo centrato verticalmente sulla coordinata y. */
  textMid(x, y, s, o = {}) { return this.text(x, y + (o.size ?? 2.5) * 0.36, s, o); }
  /** Arco come polilinea (angoli in gradi, senso orario sullo schermo). */
  arc(cx, cy, r, a0, a1, st = ST.norm, steps = 16) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return this.path(pts, st);
  }
  /** Freccia piena all'estremità (x2, y2). */
  arrow(x1, y1, x2, y2, st = ST.norm, size = 2) {
    this.line(x1, y1, x2, y2, st);
    const a = Math.atan2(y2 - y1, x2 - x1);
    const p1 = [x2 - size * Math.cos(a - 0.4), y2 - size * Math.sin(a - 0.4)];
    const p2 = [x2 - size * Math.cos(a + 0.4), y2 - size * Math.sin(a + 0.4)];
    return this.path([[x2, y2], p1, p2], { f: st.s || '#000' }, true);
  }
}

// ------------------------------------------------------------------ SVG
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r3 = (v) => Math.round(v * 1000) / 1000;

export function sheetToSVG(sheet, { id = '' } = {}) {
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" ${id ? `id="${id}" ` : ''}viewBox="0 0 ${sheet.w} ${sheet.h}" width="${sheet.w}mm" height="${sheet.h}mm" font-family="Helvetica, Arial, sans-serif">`,
    `<rect x="0" y="0" width="${sheet.w}" height="${sheet.h}" fill="#ffffff"/>`];
  const stAttr = (st) => {
    const a = [`fill="${st.f || 'none'}"`];
    if (st.s) {
      a.push(`stroke="${st.s}" stroke-width="${st.w ?? 0.25}" stroke-linecap="round" stroke-linejoin="round"`);
      if (st.d) a.push(`stroke-dasharray="${st.d.join(' ')}"`);
    }
    return a.join(' ');
  };
  for (const p of sheet.items) {
    if (p.t === 'path') {
      const d = p.pts.map((q, i) => `${i ? 'L' : 'M'}${r3(q[0])} ${r3(q[1])}`).join('') + (p.closed ? 'Z' : '');
      out.push(`<path d="${d}" ${stAttr(p.st)}/>`);
    } else if (p.t === 'circle') {
      out.push(`<circle cx="${r3(p.cx)}" cy="${r3(p.cy)}" r="${r3(p.r)}" ${stAttr(p.st)}/>`);
    } else if (p.t === 'text') {
      const rot = p.rot ? ` transform="rotate(${p.rot} ${r3(p.x)} ${r3(p.y)})"` : '';
      out.push(`<text x="${r3(p.x)}" y="${r3(p.y)}" font-size="${p.size}" text-anchor="${p.anchor}"${p.bold ? ' font-weight="700"' : ''} fill="${p.color || '#000'}"${rot}>${esc(p.s)}</text>`);
    }
  }
  out.push('</svg>');
  return out.join('');
}

// ------------------------------------------------------------------ cornice e cartiglio
export const FRAME = { x0: 15, y0: 10, x1: 410, y1: 287, tbX: 230, tbY: 247, revY: 237 };

/**
 * Disegna cornice, riferimenti di zona, blocco revisioni e cartiglio.
 * meta: dati di progetto; doc: {number, title, subtitle, scale, sheetNo, sheetCount}
 */
export function frame(sh, meta, doc) {
  const F = FRAME;
  sh.rect(5, 5, sh.w - 10, sh.h - 10, ST.thin);
  sh.rect(F.x0, F.y0, F.x1 - F.x0, F.y1 - F.y0, ST.thick);
  // riferimenti di zona
  const cols = 8, rows = 6;
  for (let i = 0; i <= cols; i++) {
    const x = F.x0 + ((F.x1 - F.x0) * i) / cols;
    sh.line(x, 5, x, F.y0, ST.thin).line(x, F.y1, x, sh.h - 5, ST.thin);
    if (i < cols) {
      const xm = x + (F.x1 - F.x0) / cols / 2;
      sh.textMid(xm, 7.5, String(i + 1), { size: 2.2, anchor: 'middle' });
      sh.textMid(xm, sh.h - 7.5, String(i + 1), { size: 2.2, anchor: 'middle' });
    }
  }
  for (let j = 0; j <= rows; j++) {
    const y = F.y0 + ((F.y1 - F.y0) * j) / rows;
    sh.line(5, y, F.x0, y, ST.thin).line(F.x1, y, sh.w - 5, y, ST.thin);
    if (j < rows) {
      const ym = y + (F.y1 - F.y0) / rows / 2;
      const L = String.fromCharCode(65 + j);
      sh.textMid(10, ym, L, { size: 2.2, anchor: 'middle' });
      sh.textMid(sh.w - 7.5, ym, L, { size: 2.2, anchor: 'middle' });
    }
  }

  // blocco revisioni
  const x0 = F.tbX, x1 = F.x1;
  sh.rect(x0, F.revY, x1 - x0, F.tbY - F.revY, ST.white);
  const rc = [x0, x0 + 10, x0 + 28, x0 + 120, x0 + 140, x0 + 160, x1];
  const rh = ['Rev.', 'Data', 'Descrizione', 'Red.', 'Contr.', 'Appr.'];
  const rv = [meta.rev, meta.date, meta.revDesc || 'Emissione preliminare', meta.author, meta.checked, meta.approved];
  const ym = F.revY + 5;
  sh.line(x0, ym, x1, ym, ST.hair);
  for (let i = 0; i < rh.length; i++) {
    if (i) sh.line(rc[i], F.revY, rc[i], F.tbY, ST.hair);
    sh.text(rc[i] + 1, F.revY + 3.6, rh[i], { size: 1.8, color: '#444444' });
    sh.text(rc[i] + 1, F.tbY - 1.4, rv[i] || '', { size: 2.1 });
  }

  // cartiglio
  const y0 = F.tbY, y1 = F.y1;
  sh.rect(x0, y0, x1 - x0, y1 - y0, ST.med);
  const yA = y0 + 9, yB = y0 + 23, yC = y0 + 32;
  sh.line(x0, yA, x1, yA, ST.thin).line(x0, yB, x1, yB, ST.thin).line(x0, yC, x1, yC, ST.thin);
  sh.line(x0 + 60, y0, x0 + 60, yA, ST.thin);
  sh.text(x0 + 2, y0 + 3.6, 'COMMITTENTE', { size: 1.7, color: '#444444' });
  sh.text(x0 + 2, y0 + 7.4, meta.client || '—', { size: 2.4, bold: true });
  sh.text(x0 + 62, y0 + 3.6, 'PROGETTO', { size: 1.7, color: '#444444' });
  sh.text(x0 + 62, y0 + 7.4, `${meta.project}${meta.site ? ' – ' + meta.site : ''}`, { size: 2.4, bold: true });
  sh.text(x0 + 2, yA + 3.6, 'TITOLO', { size: 1.7, color: '#444444' });
  sh.text(x0 + 2, yA + 8.4, doc.title, { size: 3.4, bold: true });
  if (doc.subtitle) sh.text(x0 + 2, yA + 12.4, doc.subtitle, { size: 2.3 });
  const cc = [x0, x0 + 78, x0 + 98, x0 + 128, x1];
  const ch = ['N. DOCUMENTO', 'REV.', 'SCALA', 'FOGLIO'];
  const cv = [doc.number, meta.rev, doc.scale || '—', `${doc.sheetNo} di ${doc.sheetCount}`];
  for (let i = 0; i < ch.length; i++) {
    if (i) sh.line(cc[i], yB, cc[i], yC, ST.thin);
    sh.text(cc[i] + 1.5, yB + 3.2, ch[i], { size: 1.7, color: '#444444' });
    sh.text(cc[i] + 1.5, yC - 1.6, cv[i], { size: i === 0 ? 2.8 : 2.6, bold: i === 0 });
  }
  const dc = [x0, x0 + 45, x0 + 90, x0 + 135, x1];
  const dh = ['REDATTO', 'CONTROLLATO', 'APPROVATO', 'DATA'];
  const dv = [meta.author, meta.checked, meta.approved, meta.date];
  for (let i = 0; i < dh.length; i++) {
    if (i) sh.line(dc[i], yC, dc[i], y1, ST.thin);
    sh.text(dc[i] + 1.5, yC + 3, dh[i], { size: 1.6, color: '#444444' });
    sh.text(dc[i] + 1.5, y1 - 1.5, dv[i] || '', { size: 2.2 });
  }
  return { x0: F.x0 + 4, y0: F.y0 + 4, x1: F.x1 - 4, y1: F.revY - 3 };
}

/** Riquadro di note in basso a sinistra (accanto al cartiglio). */
export function notesBox(sh, title, lines, { x = FRAME.x0 + 4, w = FRAME.tbX - FRAME.x0 - 10, y1 = FRAME.y1 - 4, size = 2.0 } = {}) {
  const lh = size * 1.45;
  const wrapped = [];
  for (const l of lines) for (const w2 of wrap(l, w - 4, size)) wrapped.push(w2);
  const h = 6 + wrapped.length * lh + 2;
  const y0 = y1 - h;
  sh.rect(x, y0, w, h, ST.thin);
  sh.text(x + 2, y0 + 4, title, { size: 2.2, bold: true });
  wrapped.forEach((l, i) => sh.text(x + 2, y0 + 7.6 + i * lh, l, { size }));
  return y0;
}

/** Spezza un testo in righe che stanno nella larghezza data. */
export function wrap(s, width, size, bold = false) {
  const words = String(s ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (textWidth(t, size, bold) <= width || !cur) cur = t;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

// ------------------------------------------------------------------ tabelle impaginate
/**
 * Impagina una tabella su più fogli A3 con cornice e cartiglio.
 * columns: [{key, title, w, align}], rows: oggetti (o {group: 'titolo'} per le righe di gruppo).
 */
export function tableSheets(meta, doc, columns, rows, { size = 2.05, notes = null, totals = null } = {}) {
  const F = FRAME;
  const left = F.x0 + 4, right = F.x1 - 4;
  const totalW = columns.reduce((a, c) => a + c.w, 0);
  const scale = (right - left) / totalW;
  const xs = [];
  let acc = left;
  for (const c of columns) { xs.push(acc); acc += c.w * scale; }
  xs.push(right);
  const top = F.y0 + 16;
  const bottom = F.revY - 4;
  const lh = size * 1.32;
  const headLines = columns.map((c, i) => wrap(c.title, xs[i + 1] - xs[i] - 2, size * 0.95, true));
  const headH = Math.max(...headLines.map((l) => l.length)) * lh + 3;

  const prepared = rows.map((r) => {
    if (r.group) return { group: r.group, h: lh + 2.4 };
    const cells = columns.map((c, i) => wrap(fmtCell(r[c.key]), xs[i + 1] - xs[i] - 2, size));
    return { cells, h: Math.max(...cells.map((l) => l.length)) * lh + 1.6 };
  });
  const pages = [];
  let cur = [];
  let y = top + headH;
  for (const r of prepared) {
    if (y + r.h > bottom - (notes ? 0 : 0) && cur.length) { pages.push(cur); cur = []; y = top + headH; }
    cur.push(r);
    y += r.h;
  }
  if (cur.length || !pages.length) pages.push(cur);

  const sheets = pages.map((pageRows, pi) => {
    const sh = new Sheet();
    frame(sh, meta, { ...doc, sheetNo: pi + 1, sheetCount: pages.length });
    sh.text(left, F.y0 + 10, doc.title.toUpperCase(), { size: 3.6, bold: true });
    if (doc.subtitle) sh.text(right, F.y0 + 10, doc.subtitle, { size: 2.3, anchor: 'end' });
    // intestazione
    sh.rect(left, top, right - left, headH, { s: '#000000', w: 0.35, f: '#e6e6e6' });
    columns.forEach((c, i) => {
      if (i) sh.line(xs[i], top, xs[i], top + headH, ST.thin);
      headLines[i].forEach((l, j) => sh.text(xs[i] + 1, top + 2.9 + j * lh, l, { size: size * 0.95, bold: true }));
    });
    let yy = top + headH;
    for (const r of pageRows) {
      if (r.group) {
        sh.rect(left, yy, right - left, r.h, { s: '#000000', w: 0.18, f: '#f2f2f2' });
        sh.text(left + 1.5, yy + r.h - 1.5, r.group.toUpperCase(), { size, bold: true });
      } else {
        r.cells.forEach((lines, i) => {
          const c = columns[i];
          lines.forEach((l, j) => {
            const ty = yy + 2.6 + j * lh;
            if (c.align === 'right') sh.text(xs[i + 1] - 1, ty, l, { size, anchor: 'end' });
            else if (c.align === 'center') sh.text((xs[i] + xs[i + 1]) / 2, ty, l, { size, anchor: 'middle' });
            else sh.text(xs[i] + 1, ty, l, { size });
          });
        });
        sh.line(left, yy + r.h, right, yy + r.h, ST.hair);
      }
      yy += r.h;
    }
    for (let i = 1; i < columns.length; i++) sh.line(xs[i], top + headH, xs[i], yy, ST.hair);
    sh.rect(left, top, right - left, yy - top, ST.norm);
    if (pi === pages.length - 1) {
      let ny = yy + 4;
      if (totals) {
        for (const t of totals) { sh.text(left, ny + 3, t, { size: 2.3, bold: true }); ny += 4.2; }
      }
      if (notes) {
        const lines = notes.flatMap((nl) => wrap(nl, F.tbX - left - 8, 1.95));
        if (ny + lines.length * 2.9 + 6 < F.y1 - 2) {
          sh.text(left, ny + 4, 'NOTE', { size: 2.2, bold: true });
          lines.forEach((l, i) => sh.text(left, ny + 7.6 + i * 2.85, l, { size: 1.95 }));
        }
      }
    }
    return sh;
  });
  return sheets;
}

function fmtCell(v) {
  if (v === null || v === undefined) return '';
  return String(v);
}
