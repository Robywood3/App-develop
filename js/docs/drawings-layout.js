// Elaborati di layout ed elettrici: plot plan, vista isometrica d'insieme,
// isometrico della linea vapore HP, schemi elettrici unifilari.

import { Sheet, ST, frame, notesBox, FRAME, wrap } from './sheet.js';
import { textWidth } from './pdf.js';
import { valve, equipTag, elGen, elMotor, elTrafo, elBreaker, elDisconnector, elEarth, elCT } from './symbols.js';

const W = '#ffffff';
const f = (v, d = 1) => (Number.isFinite(v) ? v.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');

const GROUP = {
  gt: { fill: '#c9d3dc', name: 'Turbogas' },
  hrsg: { fill: '#dcc8b0', name: 'GVR e camino' },
  st: { fill: '#cfdcc4', name: 'Turbina a vapore' },
  el: { fill: '#e6d9a6', name: 'Elettrico' },
  bop: { fill: '#d4d4d4', name: 'Ausiliari' },
  bld: { fill: '#e8e8e8', name: 'Edifici' },
  tank: { fill: '#cfdde8', name: 'Serbatoi' },
  cool: { fill: '#c4dce2', name: 'Raffreddamento' },
  rack: { fill: '#bdbdbd', name: 'Pipe rack' },
};

function shade(hex, k) {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const o = c.map((v) => Math.max(0, Math.min(255, Math.round(k >= 1 ? v + (255 - v) * (k - 1) : v * k))));
  return '#' + o.map((v) => v.toString(16).padStart(2, '0')).join('');
}

// Voci di legenda numerate (una per tag + nome)
function legendItems(layout) {
  const list = [];
  const seen = new Set();
  for (const it of layout.items) {
    if (!it.name) continue;
    const key = `${it.tag}|${it.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({ ...it, no: list.length + 1 });
  }
  return list;
}

// ------------------------------------------------------------------ plot plan
export function plotPlanSheets(M, doc) {
  const L = M.layout;
  const sh = new Sheet();
  const ax0 = FRAME.x0 + 8, ay0 = FRAME.y0 + 16, aw = 290, ah = 200;
  const need = Math.max(L.site.w / aw, L.site.d / ah) * 1000;
  const scaleN = [250, 500, 750, 1000, 1250, 1500, 2000, 2500, 3000, 4000, 5000].find((s) => s >= need) ?? 5000;
  const k = 1000 / scaleN; // mm per m
  frame(sh, M.meta, { ...doc, scale: `1:${scaleN} (A3)`, sheetNo: 1, sheetCount: 1 });
  sh.text(FRAME.x0 + 4, FRAME.y0 + 8, 'PLANIMETRIA GENERALE (PLOT PLAN)', { size: 3.2, bold: true });
  const ox = ax0 + (aw - L.site.w * k) / 2;
  const oy = ay0 + (ah - L.site.d * k) / 2;
  const X = (x) => ox + x * k;
  const Y = (y) => oy + (L.site.d - y) * k;
  // recinzione
  sh.path([[X(0), Y(0)], [X(L.site.w), Y(0)], [X(L.site.w), Y(L.site.d)], [X(0), Y(L.site.d)]], { s: '#000000', w: 0.5, d: [3, 0.8, 0.6, 0.8] }, true);
  sh.text(X(0) + 1, Y(L.site.d) - 1.5, 'Recinzione', { size: 1.6 });
  // strada perimetrale
  const r0 = L.inner, rw = L.road;
  sh.rect(X(r0.x0), Y(r0.y1), (r0.x1 - r0.x0) * k, (r0.y1 - r0.y0) * k, { s: '#777777', w: 0.25, f: '#f4f4f4' });
  sh.rect(X(r0.x0 + rw), Y(r0.y1 - rw), (r0.x1 - r0.x0 - 2 * rw) * k, (r0.y1 - r0.y0 - 2 * rw) * k, { s: '#777777', w: 0.25, f: W });
  sh.text(X(r0.x0) + 1, Y(r0.y0) - 0.8, `strada perimetrale ${rw} m`, { size: 1.4, color: '#555555' });
  // griglia coordinate
  const step = scaleN <= 1000 ? 50 : 100;
  for (let e = 0; e <= L.site.w; e += step) {
    sh.line(X(e), Y(0), X(e), Y(0) + 2, ST.thin);
    sh.text(X(e), Y(0) + 4.4, `E ${e}`, { size: 1.5, anchor: 'middle' });
  }
  for (let nn = 0; nn <= L.site.d; nn += step) {
    sh.line(X(0), Y(nn), X(0) - 2, Y(nn), ST.thin);
    sh.text(X(0) - 2.5, Y(nn) + 0.6, `N ${nn}`, { size: 1.5, anchor: 'end' });
  }
  // oggetti
  const legend = legendItems(L);
  const noOf = (it) => legend.find((l) => l.tag === it.tag && l.name === it.name)?.no;
  for (const it of L.items) {
    const g = GROUP[it.grp] ?? GROUP.bop;
    const st = it.elevated || it.inner ? { s: '#000000', w: 0.3, d: [1.4, 0.8] } : { s: '#000000', w: 0.35, f: g.fill };
    if (it.kind === 'cyl') {
      sh.circle(X(it.x), Y(it.y), it.r * k, st);
    } else {
      sh.rect(X(it.x), Y(it.y + it.d), it.w * k, it.d * k, it.hall ? { s: '#000000', w: 0.5, f: shade(g.fill, 1.4) } : st);
    }
  }
  // numeri di riferimento
  for (const it of L.items) {
    const no = noOf(it);
    if (!no) continue;
    const cx = it.kind === 'cyl' ? X(it.x) : X(it.x + it.w / 2);
    const cy = it.kind === 'cyl' ? Y(it.y) : Y(it.y + it.d / 2);
    const yy = it.hall ? Y(it.y + it.d) + 3 : cy;
    sh.circle(cx, yy, 1.9, { s: '#000000', w: 0.25, f: W });
    sh.textMid(cx, yy, String(no), { size: 1.6, anchor: 'middle', bold: true });
  }
  // quote principali dei treni
  const t1 = L.trains[0];
  const hr = t1.hr;
  dimH(sh, X(hr.x), X(hr.x + hr.w), Y(hr.y) + 5, `${f(hr.w, 1)} m`);
  dimH(sh, X(L.st.x), X(L.st.x + L.st.w), Y(L.st.y) + 5, `${f(L.st.w, 1)} m`);
  dimH(sh, X(0), X(L.site.w), Y(0) + 9, `${f(L.site.w, 0)} m`);
  dimV(sh, X(L.site.w) + 6, Y(L.site.d), Y(0), `${f(L.site.d, 0)} m`);
  // nord e scala
  const nx = FRAME.x0 + 290, ny = FRAME.y0 + 26;
  sh.circle(nx, ny, 6, ST.norm);
  sh.path([[nx, ny - 8], [nx + 2.4, ny + 2], [nx, ny], [nx - 2.4, ny + 2]], { f: '#000000' }, true);
  sh.text(nx, ny - 9.5, 'N', { size: 2.6, anchor: 'middle', bold: true });
  const sbX = ax0, sbY = ay0 + ah + 4;
  const sbm = step * 2;
  for (let i = 0; i < 4; i++) sh.rect(sbX + (i * sbm * k) / 4, sbY, (sbm * k) / 4, 1.6, { s: '#000000', w: 0.2, f: i % 2 ? W : '#000000' });
  for (let i = 0; i <= 4; i++) sh.text(sbX + (i * sbm * k) / 4, sbY + 4.4, String((i * sbm) / 4), { size: 1.4, anchor: 'middle' });
  sh.text(sbX + sbm * k + 3, sbY + 1.6, `m · scala 1:${scaleN}`, { size: 1.6 });
  // legenda
  const lx = FRAME.x1 - 92, ly0 = FRAME.y0 + 16;
  const lstep = Math.min(3.6, 170 / legend.length);
  sh.rect(lx, ly0, 88, Math.min(212, 8 + legend.length * lstep + 30), ST.norm);
  sh.text(lx + 2, ly0 + 4.5, 'LEGENDA', { size: 2.2, bold: true });
  legend.forEach((it, i) => {
    const y = ly0 + 9 + i * lstep;
    sh.circle(lx + 4, y - 0.6, 1.5, { s: '#000000', w: 0.2, f: W });
    sh.textMid(lx + 4, y - 0.6, String(it.no), { size: 1.3, anchor: 'middle', bold: true });
    sh.text(lx + 7, y, it.tag, { size: 1.6, bold: true });
    sh.text(lx + 22, y, it.name, { size: 1.6 });
  });
  const yG = ly0 + 9 + legend.length * lstep + 2;
  Object.values(GROUP).forEach((g, i) => {
    const x = lx + 2 + (i % 2) * 43, y = yG + Math.floor(i / 2) * 4;
    sh.rect(x, y, 4, 2.4, { s: '#000000', w: 0.2, f: g.fill });
    sh.text(x + 5.5, y + 2, g.name, { size: 1.5 });
  });
  const area = (L.site.w * L.site.d) / 10000;
  notesBox(sh, 'NOTE', [
    `Superficie recintata ${f(L.site.w, 0)} × ${f(L.site.d, 0)} m = ${f(area, 2)} ha. Coordinate di impianto in metri (E, N) con origine all'angolo sud-ovest della recinzione.`,
    `Disposizione ${M.N}+1 multialbero: treni TG/GVR paralleli con asse est-ovest, sala macchine TV a sud, pipe rack nord-sud. Linee tratteggiate: apparecchiature in elevazione o interne agli edifici.`,
    `Camini H ${M.meta.stackHeight} m, DI ${f(M.stackD, 1)} m. Dimensioni preliminari ricavate dalle portate di progetto.`,
  ], { w: FRAME.tbX - FRAME.x0 - 10 });
  return [sh];
}

function dimH(sh, x0, x1, y, txt) {
  sh.line(x0, y, x1, y, ST.thin);
  for (const x of [x0, x1]) { sh.line(x, y - 1.2, x, y + 1.2, ST.thin); sh.line(x - 0.7, y + 0.7, x + 0.7, y - 0.7, ST.norm); }
  sh.text((x0 + x1) / 2, y - 0.8, txt, { size: 1.6, anchor: 'middle' });
}
function dimV(sh, x, y0, y1, txt) {
  sh.line(x, y0, x, y1, ST.thin);
  for (const y of [y0, y1]) { sh.line(x - 1.2, y, x + 1.2, y, ST.thin); sh.line(x - 0.7, y + 0.7, x + 0.7, y - 0.7, ST.norm); }
  sh.text(x - 0.8, (y0 + y1) / 2, txt, { size: 1.6, anchor: 'middle', rot: -90 });
}

// ------------------------------------------------------------------ vista isometrica d'insieme
const C30 = Math.cos(Math.PI / 6), S30 = Math.sin(Math.PI / 6);
const isoUV = (x, y, z) => [(x + y) * C30, (x - y) * S30 - z];

function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  up.pop(); lo.pop();
  return lo.concat(up);
}

export function plantIsoSheets(M, doc) {
  const L = M.layout;
  const sh = new Sheet();
  frame(sh, M.meta, { ...doc, scale: 'non in scala', sheetNo: 1, sheetCount: 1 });
  sh.text(FRAME.x0 + 4, FRAME.y0 + 8, 'VISTA ISOMETRICA D\'INSIEME DELL\'IMPIANTO', { size: 3.2, bold: true });
  sh.text(FRAME.x0 + 4, FRAME.y0 + 12, 'Vista da sud-est. Volumi preliminari degli edifici e delle apparecchiature principali.', { size: 2 });
  // estensione proiettata
  const allPts = [];
  const zTop = (it) => (it.z ?? 0) + it.h;
  for (const it of L.items) {
    if (it.kind === 'cyl') { for (const z of [0, zTop(it)]) for (const s of [-1, 1]) for (const t of [-1, 1]) allPts.push(isoUV(it.x + s * it.r, it.y + t * it.r, z)); } else { for (const z of [0, zTop(it)]) for (const [x, y] of [[it.x, it.y], [it.x + it.w, it.y], [it.x, it.y + it.d], [it.x + it.w, it.y + it.d]]) allPts.push(isoUV(x, y, z)); }
  }
  for (const [x, y] of [[0, 0], [L.site.w, 0], [0, L.site.d], [L.site.w, L.site.d]]) allPts.push(isoUV(x, y, 0));
  const umin = Math.min(...allPts.map((p) => p[0])), umax = Math.max(...allPts.map((p) => p[0]));
  const vmin = Math.min(...allPts.map((p) => p[1])), vmax = Math.max(...allPts.map((p) => p[1]));
  const ax0 = FRAME.x0 + 8, ay0 = FRAME.y0 + 22, aw = FRAME.x1 - FRAME.x0 - 16, ah = FRAME.revY - ay0 - 6;
  const sc = Math.min(aw / (umax - umin), ah / (vmax - vmin));
  const ox = ax0 + (aw - (umax - umin) * sc) / 2 - umin * sc;
  const oy = ay0 + (ah - (vmax - vmin) * sc) / 2 - vmin * sc;
  const P = (x, y, z) => { const [u, v] = isoUV(x, y, z); return [ox + u * sc, oy + v * sc]; };
  // terreno e strade
  sh.path([P(0, 0, 0), P(L.site.w, 0, 0), P(L.site.w, L.site.d, 0), P(0, L.site.d, 0)], { s: '#888888', w: 0.25, f: '#f1f3ef', d: [2, 0.8] }, true);
  const r0 = L.inner, rw = L.road;
  sh.path([P(r0.x0, r0.y0, 0), P(r0.x1, r0.y0, 0), P(r0.x1, r0.y1, 0), P(r0.x0, r0.y1, 0)], { s: '#9a9a9a', w: 0.2, f: '#e2e2e2' }, true);
  sh.path([P(r0.x0 + rw, r0.y0 + rw, 0), P(r0.x1 - rw, r0.y0 + rw, 0), P(r0.x1 - rw, r0.y1 - rw, 0), P(r0.x0 + rw, r0.y1 - rw, 0)], { s: '#9a9a9a', w: 0.2, f: '#f1f3ef' }, true);
  // ordinamento per profondità (più lontani prima)
  const depth = (it) => {
    const cx = it.kind === 'cyl' ? it.x : it.x + it.w / 2;
    const cy = it.kind === 'cyl' ? it.y : it.y + it.d / 2;
    return cx - cy;
  };
  const items = L.items.filter((it) => !it.inner).slice().sort((a, b) => {
    const da = depth(a), db = depth(b);
    if (Math.abs(da - db) > 1e-6) return da - db;
    return (a.z ?? 0) - (b.z ?? 0);
  });
  const line = { s: '#333333', w: 0.18 };
  for (const it of items) {
    const g = GROUP[it.grp] ?? GROUP.bop;
    const z0 = it.z ?? 0, z1 = z0 + it.h;
    if (it.kind === 'cyl') {
      const ring = (z) => Array.from({ length: 28 }, (_, i) => { const a = (i / 28) * Math.PI * 2; return P(it.x + it.r * Math.cos(a), it.y + it.r * Math.sin(a), z); });
      const side = hull([...ring(z0), ...ring(z1)]);
      sh.path(side, { ...line, f: shade(g.fill, 0.82) }, true);
      sh.path(ring(z1), { ...line, f: shade(g.fill, 1.25) }, true);
    } else {
      if (it.legs) {
        for (const [x, y] of [[it.x, it.y], [it.x + it.w, it.y], [it.x + it.w, it.y + it.d]]) sh.line(...P(x, y, 0), ...P(x, y, z0), { s: '#555555', w: 0.25 });
      }
      const x0 = it.x, x1 = it.x + it.w, y0 = it.y, y1 = it.y + it.d;
      const fill = it.hall ? shade(g.fill, 1.15) : g.fill;
      sh.path([P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], { ...line, f: shade(fill, 0.9) }, true); // faccia sud
      sh.path([P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], { ...line, f: shade(fill, 0.74) }, true); // faccia est
      sh.path([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], { ...line, f: shade(fill, 1.22) }, true); // copertura
    }
  }
  // etichette con richiamo
  const labelled = [];
  const seen = new Set();
  for (const it of L.items) {
    if (!it.name || it.inner || seen.has(it.name)) continue;
    if (!['gt', 'hrsg', 'st', 'cool', 'el', 'bld', 'tank', 'bop'].includes(it.grp)) continue;
    if (it.grp === 'hrsg' && it.name === 'Diffusore') continue;
    seen.add(it.name);
    const cx = it.kind === 'cyl' ? it.x : it.x + it.w / 2;
    const cy = it.kind === 'cyl' ? it.y : it.y + it.d / 2;
    labelled.push({ it, p: P(cx, cy, (it.z ?? 0) + it.h) });
  }
  labelled.sort((a, b) => a.p[0] - b.p[0]);
  const placed = [];
  for (const lb of labelled) {
    const txt = `${lb.it.tag} ${lb.it.name}`;
    const w = textWidth(txt, 1.7);
    let ty = lb.p[1] - 10;
    for (let tries = 0; tries < 12; tries++) {
      const clash = placed.some((q) => Math.abs(q.y - ty) < 3 && lb.p[0] + w + 2 > q.x0 && lb.p[0] < q.x1 + 2);
      if (!clash) break;
      ty -= 3.4;
    }
    ty = Math.max(ty, FRAME.y0 + 18);
    sh.line(lb.p[0], lb.p[1], lb.p[0], ty + 0.8, { s: '#000000', w: 0.15 });
    sh.circle(lb.p[0], lb.p[1], 0.45, ST.black);
    sh.text(lb.p[0] + 0.8, ty, txt, { size: 1.7 });
    placed.push({ x0: lb.p[0], x1: lb.p[0] + w, y: ty });
  }
  // nord
  const [nx0, ny0] = [FRAME.x0 + 20, FRAME.revY - 20];
  const dn = isoUV(0, 12, 0);
  sh.arrow(nx0, ny0, nx0 + (dn[0] * 1), ny0 + dn[1] * 1, ST.med, 2.4);
  sh.text(nx0 + dn[0] + 1.5, ny0 + dn[1] - 0.5, 'N', { size: 2.6, bold: true });
  return [sh];
}

// ------------------------------------------------------------------ isometrico linea vapore HP
export function pipingIsoSheets(M, doc) {
  const L = M.layout;
  const line = M.lineById['MS-1'];
  const route = L.route;
  const sh = new Sheet();
  frame(sh, M.meta, { ...doc, scale: 'non in scala', sheetNo: 1, sheetCount: 1 });
  sh.text(FRAME.x0 + 4, FRAME.y0 + 8, `ISOMETRICO LINEA ${line.lineNo}`, { size: 3.2, bold: true });
  sh.text(FRAME.x0 + 4, FRAME.y0 + 12, `Vapore HP da ${line.from} a ${M.N > 1 ? 'collettore / ' : ''}0MAA10 valvola di arresto HP`, { size: 2 });
  const ax0 = FRAME.x0 + 14, ay0 = FRAME.y0 + 24, aw = 215, ah = 190;
  const pts = route.map(([x, y, z]) => isoUV(x, y, z));
  const umin = Math.min(...pts.map((p) => p[0])), umax = Math.max(...pts.map((p) => p[0]));
  const vmin = Math.min(...pts.map((p) => p[1])), vmax = Math.max(...pts.map((p) => p[1]));
  const sc = Math.min(aw / Math.max(umax - umin, 1), ah / Math.max(vmax - vmin, 1)) * 0.82;
  const ox = ax0 + (aw - (umax - umin) * sc) / 2 - umin * sc;
  const oy = ay0 + (ah - (vmax - vmin) * sc) / 2 - vmin * sc;
  const P = (q) => { const [u, v] = isoUV(q[0], q[1], q[2]); return [ox + u * sc, oy + v * sc]; };
  const sp = route.map(P);
  sh.path(sp, { s: '#000000', w: 1.1 });
  // gomiti e saldature
  let elbows = 0;
  for (let i = 1; i < sp.length - 1; i++) {
    sh.circle(sp[i][0], sp[i][1], 0.9, { s: '#000000', w: 0.3, f: W });
    elbows++;
  }
  sh.circle(sp[0][0], sp[0][1], 1.1, ST.black);
  // quote dei tratti
  let total = 0;
  const segs = [];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (len < 0.05) continue;
    total += len;
    const dir = Math.abs(b[2] - a[2]) > 0.01 ? 'verticale' : Math.abs(b[0] - a[0]) > 0.01 ? (b[0] > a[0] ? 'est' : 'ovest') : b[1] > a[1] ? 'nord' : 'sud';
    segs.push({ i, len, dir });
    const [p0, p1] = [sp[i - 1], sp[i]];
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    const dl = Math.hypot(dx, dy) || 1;
    let nx = -dy / dl, ny = dx / dl;
    if (ny > 0 || (Math.abs(ny) < 1e-6 && nx < 0)) { nx = -nx; ny = -ny; }
    const off = 6;
    const q0 = [p0[0] + nx * off, p0[1] + ny * off], q1 = [p1[0] + nx * off, p1[1] + ny * off];
    sh.line(p0[0] + nx * 1.5, p0[1] + ny * 1.5, q0[0] + nx, q0[1] + ny, ST.hair);
    sh.line(p1[0] + nx * 1.5, p1[1] + ny * 1.5, q1[0] + nx, q1[1] + ny, ST.hair);
    sh.line(q0[0], q0[1], q1[0], q1[1], ST.thin);
    for (const q of [q0, q1]) sh.line(q[0] - 0.8, q[1] + 0.8, q[0] + 0.8, q[1] - 0.8, ST.norm);
    let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (ang > 90) ang -= 180;
    if (ang < -90) ang += 180;
    const mx = (q0[0] + q1[0]) / 2 + nx * 1.6, my = (q0[1] + q1[1]) / 2 + ny * 1.6;
    sh.text(mx, my, Math.round(len * 1000).toLocaleString('it-IT'), { size: 1.9, anchor: 'middle', rot: ang });
  }
  // valvole e componenti
  const along = (i, t) => [sp[i - 1][0] + (sp[i][0] - sp[i - 1][0]) * t, sp[i - 1][1] + (sp[i][1] - sp[i - 1][1]) * t];
  const isoValve = (i, t, label) => {
    const c = along(i, t);
    const dx = sp[i][0] - sp[i - 1][0], dy = sp[i][1] - sp[i - 1][1];
    const dl = Math.hypot(dx, dy) || 1;
    const ux = dx / dl, uy = dy / dl, vx = -uy, vy = ux;
    const s = 2.6;
    sh.path([[c[0] - ux * s + vx * s * 0.75, c[1] - uy * s + vy * s * 0.75], [c[0] - ux * s - vx * s * 0.75, c[1] - uy * s - vy * s * 0.75], [c[0] + ux * s + vx * s * 0.75, c[1] + uy * s + vy * s * 0.75], [c[0] + ux * s - vx * s * 0.75, c[1] + uy * s - vy * s * 0.75]], { s: '#000000', w: 0.3, f: W }, true);
    const right = c[0] < ax0 + aw * 0.6;
    sh.text(c[0] + (right ? 3.5 : -3.5), c[1] - 3, label, { size: 1.7, bold: true, anchor: right ? 'start' : 'end' });
  };
  isoValve(2, 0.5, '1LBA10AA001 (MOV)');
  const rackSeg = segs.reduce((a, b) => (b.len > a.len ? b : a), segs[0]);
  const fe = along(rackSeg.i, 0.35);
  sh.line(fe[0] - 1.6, fe[1] - 1.6, fe[0] + 1.6, fe[1] + 1.6, ST.med);
  sh.text(fe[0] + 2.5, fe[1] + 3.5, 'FE 1LBA10CF001 (boccaglio)', { size: 1.6 });
  isoValve(route.length - 1, 0.55, '0MAA10AA001 (MSV)');
  // supporti
  let sup = 0;
  for (const sg of segs) {
    const nS = Math.max(1, Math.floor(sg.len / 6));
    for (let j = 1; j <= nS; j++) {
      if (sg.dir === 'verticale' && j > 1) continue;
      const c = along(sg.i, j / (nS + 1));
      sh.path([[c[0] - 1.4, c[1] + 1.8], [c[0], c[1] + 0.4], [c[0] + 1.4, c[1] + 1.8]], ST.norm);
      sup++;
    }
  }
  // freccia di flusso
  const fa = along(1, 0.5);
  sh.text(fa[0] + 2.5, fa[1], 'flusso', { size: 1.5 });
  // estremi
  const fmtc = (q) => `E ${f(q[0], 3)} · N ${f(q[1], 3)} · EL +${f(q[2], 3)}`;
  const sAnchor = sp[0][0] > ax0 + aw * 0.6 ? 'end' : 'start';
  const sdx = sAnchor === 'end' ? -7 : 3;
  sh.text(sp[0][0] + sdx, sp[0][1] + 8, `INIZIO: uscita SH HP ${line.from.split(' ')[0]}`, { size: 1.7, bold: true, anchor: sAnchor });
  sh.text(sp[0][0] + sdx, sp[0][1] + 10.5, fmtc(route[0]), { size: 1.6, anchor: sAnchor });
  const pe = sp[sp.length - 1];
  sh.text(pe[0] - 3, pe[1] + 4, 'FINE: 0MAA10 valvola di arresto HP', { size: 1.7, bold: true, anchor: 'end' });
  sh.text(pe[0] - 3, pe[1] + 6.5, fmtc(route[route.length - 1]), { size: 1.6, anchor: 'end' });
  // nord isometrico
  const nx0 = ax0 + 6, ny0 = ay0 + 10;
  const dn = isoUV(0, 14, 0);
  sh.arrow(nx0, ny0, nx0 + dn[0], ny0 + dn[1], ST.med, 2.4);
  sh.text(nx0 + dn[0] + 1.5, ny0 + dn[1], 'N', { size: 2.6, bold: true });

  // tabelle a destra
  const tx = FRAME.x1 - 150, tw = 146;
  let ty = FRAME.y0 + 18;
  const table = (title, rows, colW) => {
    sh.text(tx, ty, title, { size: 2.2, bold: true });
    ty += 1.6;
    const rh = 3.6;
    sh.rect(tx, ty, tw, rows.length * rh, ST.norm);
    rows.forEach((r, i) => {
      const y = ty + i * rh;
      if (i) sh.line(tx, y, tx + tw, y, ST.hair);
      let x = tx;
      r.forEach((c, j) => {
        sh.text(x + 1, y + 2.6, c, { size: 1.7, bold: i === 0 && rows.isHead });
        x += colW[j];
        if (j < r.length - 1) sh.line(x, y, x, y + rh, ST.hair);
      });
    });
    ty += rows.length * rh + 6;
  };
  table('DATI DI LINEA', [
    ['Numero linea', line.lineNo], ['Servizio', 'Vapore surriscaldato HP'],
    ['Diametro', `DN ${line.DN} · OD ${f(line.OD, 1)} × ${f(line.tnom, 1)} mm (t min ${f(line.tmin, 1)})`],
    ['Materiale', `${line.material} · classe ${line.cls}#`],
    ['Esercizio', `${f(line.p, 1)} bar(a) · ${f(line.T, 0)} °C · ${f(line.m, 1)} kg/s · ${f(line.vel, 1)} m/s`],
    ['Progetto', `${f(line.pDes, 1)} bar(a) · ${f(line.TDes, 0)} °C`],
    ['Prova idraulica', `${f(line.test, 1)} bar(g)`],
    ['Coibentazione', `${line.ins.t} mm lana minerale + lamierino Al`],
    ['Trattamenti', line.mat === 'C' ? 'PWHT su tutte le saldature, durezza ≤ 250 HV' : 'PWHT secondo ASME B31.1'],
    ['Controlli', 'RT/UT 100 % saldature di testa, MT/PT raccordi'],
    ['Codice', 'ASME B31.1 Power Piping'],
  ], [32, 114]);
  const valves = 2;
  const welds = 2 * (elbows + valves + 1) + 2;
  const bom = [
    ['Pos.', 'Descrizione', 'Q.tà'],
    ['1', `Tubo ${line.matShort} OD ${f(line.OD, 1)} × ${f(line.tnom, 1)} mm`, `${f(total * 1.05, 1)} m`],
    ['2', `Curva 90° raggio 3D DN ${line.DN}`, String(elbows)],
    ['3', `Valvola di isolamento motorizzata DN ${line.DN} ${line.cls}# BW`, '1'],
    ['4', 'Boccaglio di misura portata ASME PTC 6', '1'],
    ['5', 'Valvola di arresto TV (fornitura TV)', '1'],
    ['6', 'Supporti/guide (passo ~6 m)', String(sup)],
    ['7', 'Saldature di testa', String(welds)],
    ['8', `Coibentazione ${line.ins.t} mm`, `${f(total, 1)} m`],
  ];
  bom.isHead = true;
  table('DISTINTA MATERIALI', bom, [10, 116, 20]);
  const cr = [['Punto', 'E [m]', 'N [m]', 'EL [m]', 'Tratto']];
  route.forEach((q, i) => cr.push([String(i), f(q[0], 3), f(q[1], 3), f(q[2], 3), i ? (segs.find((s) => s.i === i)?.dir ?? '') : 'inizio']));
  cr.isHead = true;
  table('COORDINATE DEI PUNTI DI INSTRADAMENTO', cr, [14, 30, 30, 30, 42]);
  sh.text(tx, ty - 2, `Sviluppo totale ${f(total, 2)} m · ${elbows} cambi di direzione`, { size: 1.8, bold: true });
  return [sh];
}

// ------------------------------------------------------------------ unifilare AT/MT
export function sld1Sheets(M, doc) {
  const E = M.electrical;
  const sh = new Sheet();
  frame(sh, M.meta, { ...doc, sheetNo: 1, sheetCount: 1 });
  sh.text(FRAME.x0 + 4, FRAME.y0 + 8, `SCHEMA UNIFILARE GENERALE – ALTA TENSIONE ${E.hvKV} kV E GENERAZIONE`, { size: 3.1, bold: true });
  const yB1 = 58, yB2 = 64;
  const x0 = 30, x1 = 400;
  sh.line(x0, yB1, x1, yB1, ST.heavy).line(x0, yB2, x1, yB2, ST.heavy);
  sh.text(x0, yB1 - 2, `SBARRE AT ${E.hvKV} kV – GIS 0AEA10 (doppia sbarra, Icc 50 kA)`, { size: 1.9, bold: true });
  // stalli di linea
  [44, 70].forEach((x, i) => {
    sh.line(x, yB1, x, 32, ST.norm);
    elDisconnector(sh, x, 51, 4);
    elBreaker(sh, x, 43, 3);
    elCT(sh, x, 39);
    sh.arrow(x, 34, x, 27, ST.norm, 2);
    sh.text(x + 2, 30, `Linea ${i + 1} RTN`, { size: 1.6 });
  });
  // parallelo sbarre
  sh.line(92, yB1, 92, yB2 + 8, ST.norm).line(98, yB2, 98, yB2 + 8, ST.norm).line(92, yB2 + 8, 98, yB2 + 8, ST.norm);
  elBreaker(sh, 95 - 1.4, yB2 + 6.6, 2.8);
  sh.text(95, yB2 + 14, 'Parallelo sbarre', { size: 1.4, anchor: 'middle' });
  // stalli di macchina
  const gens = E.gens;
  const n = gens.length;
  const span = (x1 - 120) / n;
  const uatByGen = Object.fromEntries(E.uats.map((u) => [u.from, u]));
  const mvBusX = {};
  gens.forEach((g, i) => {
    const x = 130 + span * i + span / 2 - 20;
    const t = E.gsu[i];
    sh.line(x, yB1, x, yB2 + 2, ST.norm);
    sh.circle(x, yB1, 0.7, ST.black);
    elDisconnector(sh, x, yB2 + 2, 4);
    let y = yB2 + 8;
    sh.line(x, yB2 + 6, x, y, ST.norm);
    y = elBreaker(sh, x, y, 3);
    elCT(sh, x, y + 3);
    sh.line(x, y, x, y + 7, ST.norm);
    const yT = y + 7;
    const yTb = elTrafo(sh, x, yT, 4.6);
    sh.text(x + 7, yT + 4, t.tag, { size: 1.8, bold: true });
    sh.text(x + 7, yT + 6.6, `${t.MVA} MVA · ${t.ratio}`, { size: 1.5 });
    sh.text(x + 7, yT + 9, `YNd11 · ucc ${t.uk} % · ONAF`, { size: 1.5 });
    elEarth(sh, x - 6, yT + 6);
    sh.line(x - 6, yT + 6, x - 3.5, yT + 6, ST.thin);
    // condotto a fasi isolate
    const yG = 182;
    sh.line(x, yTb, x, yG - 7, ST.thick);
    sh.text(x - 2, yTb + 14, `CFI ${String(g.kV).replace('.', ',')} kV`, { size: 1.4, anchor: 'end', rot: -90 });
    const yGCB = yG - 24;
    elBreaker(sh, x, yGCB, 3.4);
    sh.text(x + 3, yGCB + 2.6, g.tag.replace('MKA', 'BAC'), { size: 1.6, bold: true });
    sh.text(x + 3, yGCB + 4.8, 'GCB', { size: 1.4 });
    elGen(sh, x, yG, 7);
    sh.text(x, yG + 11, g.tag, { size: 1.9, bold: true, anchor: 'middle' });
    sh.text(x, yG + 13.6, `${g.name}`, { size: 1.5, anchor: 'middle' });
    sh.text(x, yG + 16, `${g.MVA} MVA · ${String(g.kV).replace('.', ',')} kV · cosφ 0,85`, { size: 1.5, anchor: 'middle' });
    sh.text(x, yG + 18.4, `raffr. ${g.cooling}`, { size: 1.4, anchor: 'middle' });
    // trasformatore di unità
    const u = uatByGen[g.tag];
    const yTap = yGCB - 10;
    if (u) {
      sh.circle(x, yTap, 0.8, ST.black);
      const xu = x + 22;
      sh.line(x, yTap, xu, yTap, ST.norm);
      sh.line(xu, yTap, xu, yTap + 3, ST.norm);
      const yub = elTrafo(sh, xu, yTap + 3, 3.4);
      sh.text(xu + 5, yTap + 6, u.tag, { size: 1.7, bold: true });
      sh.text(xu + 5, yTap + 8.4, `${String(u.MVA).replace('.', ',')} MVA · ${u.ratio}`, { size: 1.4 });
      sh.line(xu, yub, xu, yub + 4, ST.norm);
      elBreaker(sh, xu, yub + 4, 2.6);
      sh.line(xu, yub + 6.6, xu, 214, ST.norm);
      mvBusX[u.bus] = xu;
    }
    // SFC per i TG
    if (g.unit > 0) {
      const xs = x - 22;
      sh.rect(xs - 7, yG - 4, 14, 8, { s: '#000000', w: 0.35, f: W });
      sh.text(xs, yG - 0.6, 'SFC', { size: 1.8, anchor: 'middle', bold: true });
      sh.text(xs, yG + 2.2, `${g.unit}MBJ10`, { size: 1.3, anchor: 'middle' });
      sh.path([[xs + 7, yG], [x - 7, yG]], ST.dash);
      sh.line(xs, yG + 4, xs, 214, ST.dash);
    }
  });
  // sbarre MT
  const yM = 214;
  const xa0 = 110, xa1 = 250, xb0 = 262, xb1 = 400;
  sh.line(xa0, yM, xa1, yM, ST.heavy).line(xb0, yM, xb1, yM, ST.heavy);
  sh.text(xa0, yM + 4, `0BBA – QUADRO MT ${E.mvKV} kV SEMISBARRA A`, { size: 1.8, bold: true });
  sh.text(xb0, yM + 4, `0BBB – QUADRO MT ${E.mvKV} kV SEMISBARRA B`, { size: 1.8, bold: true });
  sh.line(xa1, yM, xa1 + 4, yM, ST.norm).line(xb0 - 4, yM, xb0, yM, ST.norm);
  elBreaker(sh, (xa1 + xb0) / 2 - 1.4, yM - 1.4, 2.8);
  sh.text((xa1 + xb0) / 2, yM - 3, 'congiuntore', { size: 1.3, anchor: 'middle' });
  sh.text(xb1, yM + 8, 'Utenze MT e BT: vedi schema unifilare servizi ausiliari', { size: 1.6, anchor: 'end' });
  notesBox(sh, 'NOTE', [
    `Potenza installata: ${gens.map((g) => `${g.tag} ${g.MVA} MVA`).join(', ')}. Tensione di consegna ${E.hvKV} kV.`,
    'Avviamento TG tramite convertitore statico (SFC) alimentato dalle sbarre MT; servizi di unità derivati tra interruttore di generatore e trasformatore elevatore (alimentazione dalla rete a macchina ferma).',
    'Simbologia IEC 60617. Valori di corto circuito da confermare con lo studio di rete.',
  ], { w: 95 });
  return [sh];
}

// ------------------------------------------------------------------ unifilare MT/BT
export function sld2Sheets(M, doc) {
  const E = M.electrical;
  const loads = M.loads;
  const sh = new Sheet();
  frame(sh, M.meta, { ...doc, sheetNo: 1, sheetCount: 1 });
  sh.text(FRAME.x0 + 4, FRAME.y0 + 8, `SCHEMA UNIFILARE SERVIZI AUSILIARI – MT ${E.mvKV} kV / BT 400 V`, { size: 3.1, bold: true });
  const yM = 40;
  const A = [22, 205], B = [217, 404];
  sh.line(A[0], yM, A[1], yM, ST.heavy).line(B[0], yM, B[1], yM, ST.heavy);
  sh.text(A[0], yM - 9, `0BBA ${E.mvKV} kV`, { size: 2, bold: true });
  sh.text(B[0], yM - 9, `0BBB ${E.mvKV} kV`, { size: 2, bold: true });
  elBreaker(sh, (A[1] + B[0]) / 2 - 1.4, yM - 1.4, 2.8);
  sh.line(A[1], yM, (A[1] + B[0]) / 2 - 1.4, yM, ST.norm).line((A[1] + B[0]) / 2 + 1.4, yM, B[0], yM, ST.norm);
  // arrivi dai trasformatori di unità
  E.uats.forEach((u, i) => {
    const x = i === 0 ? A[0] + 10 : B[0] + 10;
    sh.line(x, 18, x, yM, ST.norm);
    elBreaker(sh, x, yM - 8, 2.8);
    sh.arrow(x, 24, x, 18, ST.norm, 1.6);
    sh.text(x + 2.5, 21, `da ${u.tag} ${String(u.MVA).replace('.', ',')} MVA`, { size: 1.5 });
  });
  // utenze MT distribuite su A/B
  const mv = [];
  for (const l of loads.filter((q) => q.kV >= 1)) {
    const nInst = Math.min(l.qtyInst, 3);
    for (let j = 0; j < (l.qtyInst > 4 ? 1 : nInst); j++) mv.push({ l, side: j % 2, suffix: l.qtyInst > 4 ? ` ×${l.qtyInst}` : String.fromCharCode(65 + j) });
  }
  // trasformatori BT
  const lvT = E.lvTr;
  const feedA = [], feedB = [];
  for (const m of mv) (m.side === 0 ? feedA : feedB).push({ type: 'mv', ...m });
  lvT.forEach((t, i) => (i % 2 === 0 ? feedA : feedB).push({ type: 'tr', t }));
  const drawFeeders = (list, [x0, x1]) => {
    const n = list.length;
    const step = Math.min(16, (x1 - x0 - 24) / Math.max(n, 1));
    list.forEach((fd, i) => {
      const x = x0 + 24 + i * step;
      sh.line(x, yM, x, yM + 3, ST.norm);
      elBreaker(sh, x, yM + 3, 2.6);
      sh.line(x, yM + 5.6, x, yM + 14, ST.norm);
      if (fd.type === 'mv') {
        elMotor(sh, x, yM + 17.2, 3.2);
        const lab = `${fd.l.tag}${fd.l.qtyInst > 1 && !fd.suffix.startsWith(' ') ? fd.suffix : fd.suffix}`;
        sh.text(x + 0.7, yM + 22, lab, { size: 1.45, rot: 90 });
        sh.text(x - 1.6, yM + 22, `${fd.l.rated.toLocaleString('it-IT')} kW`, { size: 1.35, rot: 90 });
      } else {
        const yb = elTrafo(sh, x, yM + 14, 3.2);
        sh.text(x + 4.5, yM + 18, fd.t.tag, { size: 1.5, bold: true });
        sh.text(x + 4.5, yM + 20.4, `${fd.t.kVA} kVA`, { size: 1.35 });
        sh.line(x, yb, x, 118, ST.norm);
        fd.t._x = x;
      }
    });
  };
  drawFeeders(feedA, A);
  drawFeeders(feedB, B);
  // quadri BT (PCC)
  const yL = 122;
  const pccA = [22, 205], pccB = [217, 404];
  sh.line(pccA[0], yL, pccA[1], yL, ST.heavy).line(pccB[0], yL, pccB[1], yL, ST.heavy);
  sh.text(pccA[0], yL - 2, '0BFA PCC 400 V', { size: 1.9, bold: true });
  sh.text(pccB[0], yL - 2, '0BFB PCC 400 V', { size: 1.9, bold: true });
  for (const t of lvT) if (t._x) { elBreaker(sh, t._x, 118 - 2.6, 2.6); sh.line(t._x, 118, t._x, yL, ST.norm); }
  elBreaker(sh, (pccA[1] + pccB[0]) / 2 - 1.4, yL - 1.4, 2.8);
  sh.line(pccA[1], yL, (pccA[1] + pccB[0]) / 2 - 1.4, yL, ST.norm).line((pccA[1] + pccB[0]) / 2 + 1.4, yL, pccB[0], yL, ST.norm);
  const lv = loads.filter((q) => q.kV < 1);
  const half = Math.ceil(lv.length / 2);
  const drawLV = (list, [x0, x1]) => {
    const step = Math.min(9.5, (x1 - x0 - 10) / Math.max(list.length, 1));
    list.forEach((l, i) => {
      const x = x0 + 8 + i * step;
      sh.line(x, yL, x, yL + 3, ST.norm);
      elBreaker(sh, x, yL + 3, 2);
      sh.line(x, yL + 5, x, yL + 11, ST.norm);
      const motor = /Pompa|Ventil|Viratore|Compress|Estrattore|Gru|Centralina/.test(l.desc);
      if (motor) elMotor(sh, x, yL + 13.4, 2.4);
      else sh.arrow(x, yL + 11, x, yL + 15, ST.norm, 1.4);
      sh.text(x + 0.6, yL + 17.5, l.tag, { size: 1.3, rot: 90 });
      sh.text(x - 1.3, yL + 17.5, `${l.rated.toLocaleString('it-IT')} kW`, { size: 1.2, rot: 90 });
    });
  };
  drawLV(lv.slice(0, half), pccA);
  drawLV(lv.slice(half), pccB);
  // emergenza
  const yE = 185;
  sh.line(250, yE, 330, yE, ST.heavy);
  sh.text(250, yE - 2, '0BMA SBARRA DI EMERGENZA 400 V', { size: 1.8, bold: true });
  sh.path([[200, yL], [200, yE - 10], [262, yE - 10], [262, yE]], ST.norm);
  elBreaker(sh, 262, yE - 8, 2.4);
  elGen(sh, 318, yE + 16, 5);
  sh.line(318, yE + 11, 318, yE, ST.norm);
  elBreaker(sh, 318, yE + 4, 2.4);
  sh.text(325, yE + 16, `0XJA10 diesel ${E.edgKVA} kVA`, { size: 1.6, bold: true });
  sh.line(285, yE, 285, yE + 8, ST.norm);
  sh.rect(279, yE + 8, 12, 8, { s: '#000000', w: 0.35, f: W });
  sh.text(285, yE + 13, 'UPS', { size: 1.8, anchor: 'middle', bold: true });
  sh.text(285, yE + 20, '0BRA10 230 V c.a. / 220 V c.c.', { size: 1.4, anchor: 'middle' });
  // riepilogo carichi
  const S = E.summary;
  notesBox(sh, 'BILANCIO DI POTENZA AUSILIARI', [
    `Carico contemporaneo MT ${f(S.mvP / 1000, 2)} MW, BT ${f(S.lvP / 1000, 2)} MW, totale ${f(S.totKW / 1000, 2)} MW / ${f(S.totKVA / 1000, 2)} MVA (vedi load list).`,
    `Stima ausiliari del simulatore al punto di progetto: ${f(S.simAux / 1000, 2)} MW. Trasformatori di unità ${E.uats.length} × ${String(E.uats[0].MVA).replace('.', ',')} MVA, trasformatori MT/BT ${lvT.length} × ${lvT[0].kVA} kVA (2×100 %).`,
  ], { w: 200 });
  return [sh];
}

export { wrap };
