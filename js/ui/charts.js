// Grafici su canvas senza dipendenze: assi con tacche "rotonde", griglia,
// serie multiple, marcatori, legenda e lettura dei valori al passaggio del mouse.
// I colori sono token CSS (es. '--hp'), risolti a ogni disegno per seguire il tema.

import { fmt } from './format.js';

const specs = new WeakMap();
const hovers = new WeakMap();
let observer = null;

export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

function color(c) {
  return c && c.startsWith('--') ? cssVar(c) : c;
}

function niceStep(range, count) {
  const raw = range / Math.max(count, 1);
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  const n = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
  return n * p;
}

export function niceRange(min, max, count = 5) {
  if (!(max > min)) { max = min + 1; min -= 1; }
  const step = niceStep(max - min, count);
  return { min: Math.floor(min / step + 1e-9) * step, max: Math.ceil(max / step - 1e-9) * step, step };
}

function decimalsFor(step) {
  return Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
}

/** Registra e disegna un grafico; viene ridisegnato a ogni ridimensionamento. */
export function drawChart(canvas, spec) {
  specs.set(canvas, spec);
  if (!observer && 'ResizeObserver' in window) {
    observer = new ResizeObserver((entries) => {
      for (const e of entries) {
        const s = specs.get(e.target);
        if (s) render(e.target, s);
      }
    });
  }
  if (observer && !canvas._observed) {
    observer.observe(canvas);
    canvas._observed = true;
    canvas.addEventListener('pointermove', (ev) => {
      const r = canvas.getBoundingClientRect();
      hovers.set(canvas, { x: ev.clientX - r.left, y: ev.clientY - r.top });
      render(canvas, specs.get(canvas));
    });
    canvas.addEventListener('pointerleave', () => {
      hovers.delete(canvas);
      render(canvas, specs.get(canvas));
    });
  }
  render(canvas, spec);
}

/** Ridisegna tutti i grafici registrati (es. al cambio di tema). */
export function redrawAll(canvases) {
  for (const c of canvases) {
    const s = specs.get(c);
    if (s) render(c, s);
  }
}

function render(canvas, spec) {
  if (!spec) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w === 0 || h === 0) return;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const fg = cssVar('--fg');
  const muted = cssVar('--muted');
  const grid = cssVar('--line-soft');
  const axis = cssVar('--line');
  const fontData = cssVar('--font-data');
  const fontDisp = cssVar('--font-display');

  const series = spec.series.filter((s) => s.points && s.points.length);
  let xs = [], ys = [];
  for (const s of series) for (const [x, y] of s.points) { if (Number.isFinite(x) && Number.isFinite(y)) { xs.push(x); ys.push(y); } }
  for (const m of spec.marks || []) { xs.push(m.x); ys.push(m.y); }
  if (!xs.length) { xs = [0, 1]; ys = [0, 1]; }
  const xr = niceRange(spec.xMin ?? Math.min(...xs), spec.xMax ?? Math.max(...xs), spec.xTicks || 6);
  const yr = niceRange(spec.yMin ?? Math.min(...ys), spec.yMax ?? Math.max(...ys), spec.yTicks || 5);
  if (spec.xMin !== undefined) xr.min = spec.xMin;
  if (spec.xMax !== undefined) xr.max = spec.xMax;

  const compact = w < 420;
  const m = { l: compact ? 44 : 54, r: 14, t: 30, b: 38 };
  const pw = w - m.l - m.r;
  const ph = h - m.t - m.b;
  const X = (x) => m.l + ((x - xr.min) / (xr.max - xr.min)) * pw;
  const Y = (y) => m.t + ph - ((y - yr.min) / (yr.max - yr.min)) * ph;

  // titolo
  ctx.fillStyle = fg;
  ctx.font = `600 13px ${fontDisp}`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  if (spec.title) ctx.fillText(spec.title.toUpperCase(), m.l, 16);

  // griglia e tacche
  ctx.font = `10.5px ${fontData}`;
  ctx.lineWidth = 1;
  const yd = decimalsFor(yr.step);
  for (let v = yr.min; v <= yr.max + yr.step * 1e-6; v += yr.step) {
    const py = Math.round(Y(v)) + 0.5;
    ctx.strokeStyle = grid;
    ctx.beginPath(); ctx.moveTo(m.l, py); ctx.lineTo(m.l + pw, py); ctx.stroke();
    ctx.fillStyle = muted;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(fmt(v, yd), m.l - 6, py);
  }
  const xStep = niceStep(xr.max - xr.min, compact ? 4 : spec.xTicks || 6);
  const xd = decimalsFor(xStep);
  for (let v = Math.ceil(xr.min / xStep - 1e-9) * xStep; v <= xr.max + xStep * 1e-6; v += xStep) {
    const px = Math.round(X(v)) + 0.5;
    ctx.strokeStyle = grid;
    ctx.beginPath(); ctx.moveTo(px, m.t); ctx.lineTo(px, m.t + ph); ctx.stroke();
    ctx.fillStyle = muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(fmt(v, xd), px, m.t + ph + 5);
  }
  ctx.strokeStyle = axis;
  ctx.beginPath(); ctx.moveTo(m.l + 0.5, m.t); ctx.lineTo(m.l + 0.5, m.t + ph); ctx.lineTo(m.l + pw, m.t + ph + 0.5); ctx.stroke();

  // etichette assi
  ctx.fillStyle = muted;
  ctx.font = `500 11px ${cssVar('--font-body')}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  if (spec.xLabel) ctx.fillText(spec.xLabel, m.l + pw, h - 4);
  if (spec.yLabel) {
    ctx.save();
    ctx.translate(11, m.t + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(spec.yLabel, 0, 0);
    ctx.restore();
  }

  // serie
  ctx.save();
  ctx.beginPath();
  ctx.rect(m.l, m.t - 2, pw + 2, ph + 4);
  ctx.clip();
  for (const s of series) {
    const c = color(s.color);
    if (s.fill) {
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = c;
      ctx.beginPath();
      const base = Y(Math.min(Math.max(0, yr.min), yr.max));
      ctx.moveTo(X(s.points[0][0]), base);
      for (const [x, y] of s.points) ctx.lineTo(X(x), Y(y));
      ctx.lineTo(X(s.points[s.points.length - 1][0]), base);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = c;
    ctx.lineWidth = s.width || 2;
    ctx.setLineDash(s.dash || []);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let pen = false;
    for (const [x, y] of s.points) {
      if (!Number.isFinite(y)) { pen = false; continue; }
      if (!pen) { ctx.moveTo(X(x), Y(y)); pen = true; } else ctx.lineTo(X(x), Y(y));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (s.markers) {
      ctx.fillStyle = c;
      for (const [x, y] of s.points) { ctx.beginPath(); ctx.arc(X(x), Y(y), 2.6, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  // etichette in linea
  ctx.font = `600 10.5px ${fontDisp}`;
  for (const lb of spec.labels || []) {
    ctx.fillStyle = color(lb.color || '--muted');
    ctx.textAlign = lb.align || 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(lb.text, X(lb.x), Y(lb.y) - 4);
  }
  ctx.restore();

  // marcatori evidenziati
  for (const mk of spec.marks || []) {
    const c = color(mk.color || '--accent');
    ctx.fillStyle = cssVar('--surface');
    ctx.strokeStyle = c;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(X(mk.x), Y(mk.y), 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (mk.label) {
      ctx.fillStyle = fg;
      ctx.font = `500 11px ${fontData}`;
      ctx.textAlign = X(mk.x) > m.l + pw * 0.75 ? 'right' : 'left';
      // sotto il punto se vicino al bordo superiore (dove sta la legenda)
      const below = Y(mk.y) < m.t + 28;
      ctx.textBaseline = below ? 'top' : 'bottom';
      ctx.fillText(mk.label, X(mk.x) + (ctx.textAlign === 'right' ? -8 : 8), Y(mk.y) + (below ? 8 : -6));
    }
  }

  // legenda
  const leg = series.filter((s) => s.label);
  if (leg.length && spec.legend !== false) {
    ctx.font = `500 11px ${cssVar('--font-body')}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    let lx = m.l + pw;
    const ly = 15;
    for (let i = leg.length - 1; i >= 0; i--) {
      const s = leg[i];
      const tw = ctx.measureText(s.label).width;
      lx -= tw + 22;
      if (lx < m.l + (spec.title ? ctx.measureText(spec.title).width + 60 : 0) && compact) break;
      ctx.strokeStyle = color(s.color);
      ctx.lineWidth = 2.5;
      ctx.setLineDash(s.dash || []);
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 14, ly); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = muted;
      ctx.fillText(s.label, lx + 18, ly);
      lx -= 8;
    }
  }

  // lettura al passaggio del mouse
  const hv = hovers.get(canvas);
  if (hv && hv.x >= m.l && hv.x <= m.l + pw && hv.y >= m.t && hv.y <= m.t + ph) {
    const xv = xr.min + ((hv.x - m.l) / pw) * (xr.max - xr.min);
    ctx.strokeStyle = muted;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(Math.round(hv.x) + 0.5, m.t); ctx.lineTo(Math.round(hv.x) + 0.5, m.t + ph); ctx.stroke();
    ctx.setLineDash([]);
    const rows = [];
    for (const s of series) {
      if (s.noHover) continue;
      const yv = interpAt(s.points, xv);
      if (yv === null) continue;
      rows.push({ c: color(s.color), t: `${s.label || ''} ${fmt(yv, spec.hoverDecimals ?? 1)}` });
      ctx.fillStyle = color(s.color);
      ctx.beginPath(); ctx.arc(X(xv), Y(yv), 3, 0, Math.PI * 2); ctx.fill();
    }
    if (rows.length) {
      ctx.font = `11px ${fontData}`;
      const head = `${spec.xHover || ''}${fmt(xv, spec.xHoverDecimals ?? xd)}${spec.xUnit ? ' ' + spec.xUnit : ''}`;
      const bw = Math.max(ctx.measureText(head).width, ...rows.map((r) => ctx.measureText(r.t).width)) + 26;
      const bh = 18 + rows.length * 15;
      let bx = hv.x + 12;
      if (bx + bw > w - 4) bx = hv.x - 12 - bw;
      const by = Math.max(m.t, Math.min(hv.y - bh / 2, m.t + ph - bh));
      ctx.fillStyle = cssVar('--surface-2');
      ctx.strokeStyle = axis;
      ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.fill(); ctx.stroke();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = muted;
      ctx.fillText(head, bx + 8, by + 10);
      rows.forEach((r, i) => {
        ctx.fillStyle = r.c;
        ctx.fillRect(bx + 8, by + 21 + i * 15, 8, 8);
        ctx.fillStyle = fg;
        ctx.fillText(r.t, bx + 20, by + 25 + i * 15);
      });
    }
  }
}

// Interpolazione lineare su una serie ordinata o meno in x (prende il primo tratto che contiene x).
function interpAt(pts, x) {
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if ((x >= x0 && x <= x1) || (x >= x1 && x <= x0)) {
      if (x1 === x0) return y1;
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return null;
}

/** Piccolo grafico di tendenza per le tessere KPI. */
export function sparkline(canvas, values, colorVar = '--accent') {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (values.length < 2) return;
  let min = Math.min(...values), max = Math.max(...values);
  if (max - min < 1) { max += 0.5; min -= 0.5; }
  const X = (i) => (i / (values.length - 1)) * (w - 4) + 1;
  const Y = (v) => h - 3 - ((v - min) / (max - min)) * (h - 6);
  const c = cssVar(colorVar);
  ctx.beginPath();
  values.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
  ctx.strokeStyle = c;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.lineTo(X(values.length - 1), h);
  ctx.lineTo(X(0), h);
  ctx.closePath();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = c;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(X(values.length - 1), Y(values[values.length - 1]), 2.5, 0, Math.PI * 2);
  ctx.fillStyle = c;
  ctx.fill();
}
