/* Grafici SVG minimi, colori dai token CSS (tema chiaro/scuro). */
(function (root) {
  'use strict';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (v, d) => (v === null || v === undefined || !isFinite(v)) ? '–' : v.toLocaleString('it-IT', { maximumFractionDigits: d === undefined ? 0 : d, minimumFractionDigits: d === undefined ? 0 : d });
  function niceStep(span, n) { const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
  function scale(lo, hi, n) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); if (hi - lo < 1e-9) hi = lo + 1; const st = niceStep(hi - lo, n); return { lo: Math.floor(lo / st - 1e-9) * st, hi: Math.ceil(hi / st - 1e-9) * st, step: st }; }
  function frame(W, Hh, inner) { return `<svg viewBox="0 0 ${W} ${Hh}" class="chart" role="img" preserveAspectRatio="xMidYMid meet">${inner}</svg>`; }
  function yAxis(x0, x1, y, lo, hi, step, unit, H0) {
    let s = ''; const ticks = Math.round((hi - lo) / step);
    for (let k = 0; k <= ticks; k++) {
      const v = lo + step * k, yy = y(v);
      s += `<line x1="${x0}" x2="${x1}" y1="${yy}" y2="${yy}" class="grid${Math.abs(v) < 1e-9 ? ' zero' : ''}"/>`;
      s += `<text x="${x0 - 6}" y="${yy + 4}" class="tick" text-anchor="end">${fmt(v, step < 1 ? 1 : 0)}</text>`;
    }
    if (unit) s += `<text x="${x0 - 6}" y="${H0 - 8}" class="unit" text-anchor="end">${esc(unit)}</text>`;
    return s;
  }
  // barre impilate; series: [{name, cls, values}] ; line: {name, cls, values}
  function stackedBars(labels, series, opt) {
    opt = opt || {}; const W = 720, Hh = opt.height || 300, L = 62, R = 16, T = 24, B = 40;
    const n = labels.length, pos = new Array(n).fill(0), neg = new Array(n).fill(0);
    series.forEach(s => s.values.forEach((v, i) => { if (v >= 0) pos[i] += v; else neg[i] += v; }));
    const sc = scale(Math.min(...neg, 0), Math.max(...pos, ...(opt.line ? opt.line.values : [0])), 4), lo = sc.lo, hi = sc.hi;
    const y = v => T + (hi - v) / (hi - lo) * (Hh - T - B), bw = (W - L - R) / n;
    let s = yAxis(L, W - R, y, lo, hi, sc.step, opt.unit, T);
    labels.forEach((lab, i) => {
      let up = 0, dn = 0; const x = L + i * bw + bw * 0.16, w = bw * 0.68;
      series.forEach(se => {
        const v = se.values[i]; if (!v) return;
        const y0 = v >= 0 ? y(up + v) : y(dn);
        s += `<rect x="${x}" y="${y0}" width="${w}" height="${Math.max(0, Math.abs(y(0) - y(v)))}" class="${se.cls}"><title>${esc(lab)} – ${esc(se.name)}: ${fmt(v, opt.dec)} ${esc(opt.unit || '')}</title></rect>`;
        if (v >= 0) up += v; else dn += v;
      });
      if (i % (opt.every || 1) === 0) s += `<text x="${L + i * bw + bw / 2}" y="${Hh - B + 16}" class="tick" text-anchor="middle">${esc(lab)}</text>`;
    });
    if (opt.line) {
      const pts = opt.line.values.map((v, i) => `${L + i * bw + bw / 2},${y(v)}`).join(' ');
      s += `<polyline points="${pts}" class="${opt.line.cls}" fill="none"/>`;
      opt.line.values.forEach((v, i) => { s += `<circle cx="${L + i * bw + bw / 2}" cy="${y(v)}" r="3" class="${opt.line.cls}-dot"><title>${esc(labels[i])} – ${esc(opt.line.name)}: ${fmt(v, opt.dec)}</title></circle>`; });
    }
    return frame(W, Hh, s);
  }
  // linee multiple con asse destro opzionale
  function lines(xLabels, series, opt) {
    opt = opt || {}; const W = 720, Hh = opt.height || 280, L = 62, R = opt.right ? 52 : 16, T = 24, B = 36;
    const left = series.filter(s => !s.right), right = series.filter(s => s.right);
    const sc = scale(Math.min(...left.flatMap(s => s.values)), Math.max(...left.flatMap(s => s.values)), 4), lo = sc.lo, hi = sc.hi;
    const n = xLabels.length, x = i => L + (W - L - R) * (n === 1 ? 0.5 : i / (n - 1)), y = v => T + (hi - v) / (hi - lo) * (Hh - T - B);
    const yr = v => T + (1 - v / (opt.rightMax || 1)) * (Hh - T - B);
    let s = yAxis(L, W - R, y, lo, hi, sc.step, opt.unit, T);
    if (opt.right) for (let k = 0; k <= 4; k++) { const v = (opt.rightMax || 1) * k / 4; s += `<text x="${W - R + 6}" y="${yr(v) + 4}" class="tick">${fmt(v * (opt.rightScale || 1), 0)}</text>`; }
    if (opt.right) s += `<text x="${W - R + 6}" y="${T - 8}" class="unit">${esc(opt.right)}</text>`;
    xLabels.forEach((lab, i) => { if (i % (opt.every || 1) === 0) s += `<text x="${x(i)}" y="${Hh - B + 16}" class="tick" text-anchor="middle">${esc(lab)}</text>`; });
    series.forEach(se => {
      const f = se.right ? yr : y, pts = se.values.map((v, i) => `${x(i).toFixed(1)},${f(v).toFixed(1)}`);
      if (se.area) s += `<polygon points="${x(0)},${f(0)} ${pts.join(' ')} ${x(n - 1)},${f(0)}" class="${se.cls}-area"/>`;
      s += `<polyline points="${pts.join(' ')}" class="${se.cls}" fill="none"/>`;
    });
    return frame(W, Hh, s);
  }
  // flussi di cassa: barre annuali + linea cumulata
  function cashflow(cf, opt) {
    opt = opt || {}; const W = 720, Hh = 300, L = 70, R = 16, T = 24, B = 36;
    const cum = []; cf.reduce((a, v, i) => (cum[i] = a + v, a + v), 0);
    const sc = scale(Math.min(...cf, ...cum), Math.max(...cf, ...cum), 5), lo = sc.lo, hi = sc.hi;
    const n = cf.length, bw = (W - L - R) / n, y = v => T + (hi - v) / (hi - lo) * (Hh - T - B);
    let s = yAxis(L, W - R, y, lo, hi, sc.step, opt.unit || 'k€', T);
    cf.forEach((v, i) => {
      s += `<rect x="${L + i * bw + bw * 0.15}" y="${Math.min(y(0), y(v))}" width="${bw * 0.7}" height="${Math.abs(y(0) - y(v))}" class="${v >= 0 ? 'b-pos' : 'b-neg'}"><title>Anno ${i}: ${fmt(v)} ${opt.unit || 'k€'}</title></rect>`;
      if (i % 5 === 0) s += `<text x="${L + i * bw + bw / 2}" y="${Hh - B + 16}" class="tick" text-anchor="middle">${i}</text>`;
    });
    s += `<polyline points="${cum.map((v, i) => `${L + i * bw + bw / 2},${y(v)}`).join(' ')}" class="l-cum" fill="none"/>`;
    const last = cum.length - 1; s += `<circle cx="${L + last * bw + bw / 2}" cy="${y(cum[last])}" r="4" class="l-cum-dot"/>`;
    return frame(W, Hh, s);
  }
  // tornado: items [{name, range, low, high}] rispetto a base
  function tornado(items, base, opt) {
    opt = opt || {}; const W = 720, row = 34, T = 30, Hh = T + items.length * row + 26, L = 210, R = 24;
    const all = items.flatMap(i => [i.low, i.high]).concat([base]);
    let lo = Math.min(...all), hi = Math.max(...all); const pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
    const x = v => L + (v - lo) / (hi - lo) * (W - L - R);
    let s = `<line x1="${x(base)}" x2="${x(base)}" y1="${T - 10}" y2="${Hh - 20}" class="grid zero"/>`;
    s += `<text x="${x(base)}" y="${T - 14}" class="tick" text-anchor="middle">base ${fmt(base / 1000)} k€</text>`;
    items.forEach((it, k) => {
      const yy = T + k * row;
      s += `<text x="${L - 10}" y="${yy + row / 2 + 2}" class="label" text-anchor="end">${esc(it.name)} <tspan class="tick">${esc(it.range)}</tspan></text>`;
      const a = Math.min(it.low, base), b2 = Math.max(it.low, base), c = Math.min(it.high, base), d = Math.max(it.high, base);
      s += `<rect x="${x(a)}" y="${yy + 6}" width="${x(b2) - x(a)}" height="${row - 12}" class="t-low"><title>scenario sfavorevole: ${fmt(it.low / 1000)} k€</title></rect>`;
      s += `<rect x="${x(c)}" y="${yy + 6}" width="${x(d) - x(c)}" height="${row - 12}" class="t-high"><title>scenario favorevole: ${fmt(it.high / 1000)} k€</title></rect>`;
    });
    return frame(W, Hh, s);
  }
  function hbars(items, opt) {
    opt = opt || {}; const W = 720, row = 26, T = 8, L = 300, R = 90, Hh = T + items.length * row + 8;
    const mx = Math.max(...items.map(i => i.value), 1);
    let s = '';
    items.forEach((it, k) => {
      const yy = T + k * row, w = (W - L - R) * it.value / mx;
      s += `<text x="${L - 8}" y="${yy + row / 2 + 4}" class="label" text-anchor="end">${esc(it.label.length > 46 ? it.label.slice(0, 45) + '…' : it.label)}</text>`;
      s += `<rect x="${L}" y="${yy + 5}" width="${Math.max(1, w)}" height="${row - 10}" class="${it.cls || 'b-pv'}"><title>${esc(it.label)}: ${fmt(it.value)} €</title></rect>`;
      s += `<text x="${L + w + 6}" y="${yy + row / 2 + 4}" class="tick">${fmt(it.value / 1000)} k€</text>`;
    });
    return frame(W, Hh, s);
  }
  root.FVB_CHARTS = { stackedBars, lines, cashflow, tornado, hbars, fmt, esc };
})(typeof self !== 'undefined' ? self : this);
