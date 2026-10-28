/*
 * FV+BESS Simulator – elaborati grafici (CAD) generati dai dati del simulatore.
 * Ogni funzione restituisce un disegno per FVB_EXPORT.sheet(): planimetrie in metri reali (unit 'm'),
 * sezioni e particolari in metri a scala fissa, schemi in mm di foglio (unit 'mm').
 * La geometria è di impostazione (pre-progetto): il layout definitivo va sviluppato su rilievo e ortofoto.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./export.js'));
  else root.FVB_TAVOLE = factory(root.FVB_EXPORT);
})(typeof self !== 'undefined' ? self : this, function (X) {
  'use strict';
  const DEG = Math.PI / 180;
  const nf = (v, d = 0) => Number(v).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });

  // ---------- costruttore di entità ----------
  function G() {
    const ents = [];
    const g = {
      ents,
      line: (x1, y1, x2, y2, layer) => (ents.push({ t: 'line', x1, y1, x2, y2, layer }), g),
      poly: (pts, layer, closed) => (ents.push({ t: 'poly', pts, layer, closed: !!closed }), g),
      rect: (x, y, w, h, layer) => g.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], layer, true),
      fill: (pts, layer) => (ents.push({ t: 'fill', pts, layer }), g),
      box: (x, y, w, h, layer) => g.fill([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], layer),
      circle: (x, y, r, layer) => (ents.push({ t: 'circle', x, y, r, layer }), g),
      arc: (x, y, r, a0, a1, layer) => (ents.push({ t: 'arc', x, y, r, a0, a1, layer }), g),
      text: (x, y, s, h, layer, o) => (ents.push(Object.assign({ t: 'text', x, y, s: String(s), h, layer: layer || 'TESTI' }, o || {})), g),
      // quota allineata: punti, distanza della linea di quota, testo, altezza testo
      dim: (x1, y1, x2, y2, off, txt, h) => {
        const L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L, nx = -uy, ny = ux;
        const a = [x1 + nx * off, y1 + ny * off], b = [x2 + nx * off, y2 + ny * off], t = h * 0.6;
        g.line(x1 + nx * off * 0.1, y1 + ny * off * 0.1, a[0] + nx * t, a[1] + ny * t, 'QUOTE').line(x2 + nx * off * 0.1, y2 + ny * off * 0.1, b[0] + nx * t, b[1] + ny * t, 'QUOTE').line(a[0], a[1], b[0], b[1], 'QUOTE');
        [a, b].forEach(p => g.line(p[0] - (ux + nx) * t * 0.7, p[1] - (uy + ny) * t * 0.7, p[0] + (ux + nx) * t * 0.7, p[1] + (uy + ny) * t * 0.7, 'QUOTE'));
        const ang = Math.atan2(uy, ux) / DEG, rot = ang > 90 || ang < -90 ? ang + 180 : ang;
        return g.text((a[0] + b[0]) / 2 + nx * h * 0.5, (a[1] + b[1]) / 2 + ny * h * 0.5, txt || nf(L, 2), h, 'QUOTE', { align: 'center', rot });
      },
      arrow: (x1, y1, x2, y2, layer, s) => { const a = Math.atan2(y2 - y1, x2 - x1), k = s || 2; g.line(x1, y1, x2, y2, layer); return g.fill([[x2, y2], [x2 - k * Math.cos(a - 0.35), y2 - k * Math.sin(a - 0.35)], [x2 - k * Math.cos(a + 0.35), y2 - k * Math.sin(a + 0.35)]], layer); },
      // riquadro con testo su più righe (schemi)
      label: (x, y, w, h, lines, layer, th) => { g.rect(x, y, w, h, layer || 'SCHEMA'); const L = [].concat(lines), t = th || 2.5; L.forEach((s, i) => g.text(x + w / 2, y + h / 2 + (L.length - 1) * t * 0.8 - i * t * 1.6, s, i === 0 ? t : t * 0.85, 'TESTI', { align: 'center', valign: 'middle' })); return g; }
    };
    return g;
  }
  const bboxOf = ents => X.extents(ents);

  // ---------- modello planimetrico dell'impianto (metri, origine all'angolo SW del campo) ----------
  function plant(x) {
    const e = x.e, cfg = x.cfg, mod = e.module, mount = cfg.pv.mount, P = { tables: [], invs: [], stations: [], bessUnits: [] };
    const ground = x.ground, roof = x.hasPv && !ground;
    if (x.hasPv) {
      const perRow = Math.ceil(e.Ns / 2), tl = perRow * mod.width + (perRow - 1) * 0.02;
      const tilt = mount === 'tracker' ? 0 : mount === 'roof_ew' ? 10 : cfg.pv.tilt;
      const td = 2 * mod.length * Math.cos(tilt * DEG) + 0.02;
      const pitch = mount === 'roof_ew' ? td + 0.6 : mount === 'roof_tilted' ? td + 0.3 : 2 * mod.length / cfg.pv.gcr;
      const tracker = mount === 'tracker';
      const cellW = tracker ? pitch : tl + 0.6, cellH = tracker ? tl + 0.6 : pitch, tw = tracker ? td : tl, th = tracker ? tl : td;
      const n = e.strings, ratio = 1.6;
      let cols = Math.max(1, Math.round(Math.sqrt(n * cellH * ratio / cellW))), rows = Math.ceil(n / cols);
      const road = ground && cols >= 4 ? 6 : 0, half = Math.ceil(cols / 2);
      for (let i = 0; i < n; i++) {
        const r = Math.floor(i / cols), c = i % cols, xx = c * cellW + (c >= half ? road : 0), yy = r * cellH;
        P.tables.push({ x: xx, y: yy, w: tw, h: th, i, inv: Math.floor(i / Math.max(1, e.spInv)), r, c });
      }
      P.fieldW = cols * cellW + road - (cellW - tw); P.fieldH = rows * cellH - (cellH - th); P.road = road; P.half = half; P.cellW = cellW; P.cellH = cellH; P.pitch = pitch; P.tl = tl; P.td = td; P.tilt = tilt; P.cols = cols; P.rows = rows; P.tracker = tracker;
      // inverter: uno per gruppo, al bordo del primo tavolo del gruppo verso la viabilità centrale
      for (let k = 0; k < e.nInv; k++) {
        const grp = P.tables.filter(t => t.inv === k); if (!grp.length) continue;
        const t0 = grp[0], right = t0.c < half;
        P.invs.push({ k, x: right ? t0.x + t0.w + 0.15 : t0.x - 1.25, y: t0.y + t0.h / 2 - 0.4, w: 1.1, h: 0.8, grp });
      }
    } else { P.fieldW = 0; P.fieldH = 0; }
    // cabine di trasformazione FV a sud del campo, al centro
    const sy = -10;
    for (let k = 0; k < e.transformer.n; k++) P.stations.push({ x: P.fieldW / 2 - 3 + (k - (e.transformer.n - 1) / 2) * 9, y: sy, w: 6.0, h: 2.5, name: 'CT-' + String(k + 1).padStart(2, '0') });
    // area BESS a est del campo (o isolata nella configurazione solo BESS)
    if (x.b && e.bess) {
      const u = e.bess.unit, big = u.kwh > 1000, uw = big ? 6.06 : 1.3, uh = big ? 2.44 : 1.4, gx = big ? 3.0 : 1.2, gy = big ? 3.0 : 2.0, perRowU = big ? 2 : 4;
      const bx = x.hasPv ? P.fieldW + 18 : 0, by = 0;
      for (let i = 0; i < e.bess.n; i++) { const r = Math.floor(i / perRowU), c = i % perRowU; P.bessUnits.push({ x: bx + c * (uw + gx), y: by + r * (uh + gy), w: uw, h: uh, name: 'BESS-' + String(i + 1).padStart(2, '0') }); }
      const nr = Math.ceil(e.bess.n / perRowU), bw = perRowU * uw + (perRowU - 1) * gx, bh = nr * uh + (nr - 1) * gy;
      P.bessArea = { x: bx - 4, y: by - 4, w: bw + 8, h: bh + 8, uw, uh, gx, gy };
      P.bessTr = { x: bx + bw + 6, y: by, w: 3.0, h: 2.5, name: 'TR-BESS' };
      P.bessArea.w += 9.5;
    }
    // cabina MT d'impianto vicino all'ingresso (SW)
    const all = [].concat(P.tables, P.stations, P.bessUnits, P.bessTr ? [P.bessTr] : []);
    const bb = all.length ? all.reduce((a, t) => ({ x0: Math.min(a.x0, t.x), y0: Math.min(a.y0, t.y), x1: Math.max(a.x1, t.x + t.w), y1: Math.max(a.y1, t.y + t.h) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }) : { x0: 0, y0: 0, x1: 10, y1: 10 };
    P.mvCab = { x: bb.x0, y: sy - 8, w: 6.5, h: 2.5, name: 'Cabina MT impianto' };
    bb.y0 = Math.min(bb.y0, P.mvCab.y);
    const off = roof ? 3 : 7;
    P.fence = roof ? null : { x: bb.x0 - off, y: bb.y0 - off, w: bb.x1 - bb.x0 + 2 * off, h: bb.y1 - bb.y0 + 2 * off };
    P.building = roof ? { x: -4, y: -4, w: P.fieldW + 8, h: P.fieldH + 8 } : null;
    if (roof) { P.stations.forEach(s => { s.y = -16; }); P.mvCab.y = -24; }
    // cavidotto MT verso la cabina utente esistente (lunghezza del simulatore)
    const gate = P.fence ? [P.fence.x + 12, P.fence.y] : [P.mvCab.x - 4, P.mvCab.y];
    const startP = [P.mvCab.x + 1, P.mvCab.y], inside = Math.abs(startP[1] - gate[1]) + Math.abs(startP[0] - gate[0]);
    const rem = Math.max(20, e.mvCable.L - inside), a = rem * 0.35, b2 = rem - a;
    P.mvRoute = [startP, [startP[0], gate[1] + 2], [gate[0], gate[1] + 2], [gate[0], gate[1] - a], [gate[0] - b2, gate[1] - a]];
    P.userCab = { x: gate[0] - b2 - 7, y: gate[1] - a - 1.25, w: 7, h: 2.5, name: 'Cabina utente esistente (DG)' };
    P.factory = { x: P.userCab.x - 70, y: P.userCab.y - 45, w: 80, h: 40 };
    if (roof) P.factory = null;
    P.gate = gate;
    return P;
  }
  // disegno della planimetria con i livelli richiesti
  function planEnts(x, P, opt, h) {
    const g = G(), e = x.e, o = Object.assign({ tables: true, invs: true, cabins: true, bess: true, fence: true, roads: true, mv: true, labels: true }, opt);
    if (P.building) { g.rect(P.building.x, P.building.y, P.building.w, P.building.h, 'ESISTENTE'); g.text(P.building.x + 1, P.building.y + P.building.h + h * 0.8, 'Copertura dello stabilimento esistente', h, 'ESISTENTE'); }
    if (P.factory) { g.rect(P.factory.x, P.factory.y, P.factory.w, P.factory.h, 'ESISTENTE'); g.text(P.factory.x + P.factory.w / 2, P.factory.y + P.factory.h / 2, 'Stabilimento esistente', h * 1.2, 'ESISTENTE', { align: 'center', valign: 'middle' }); }
    if (o.fence && P.fence) {
      const f = P.fence; g.poly([[P.gate[0] - 3, f.y], [f.x, f.y], [f.x, f.y + f.h], [f.x + f.w, f.y + f.h], [f.x + f.w, f.y], [P.gate[0] + 3, f.y]], 'RECINZIONE');
      g.line(P.gate[0] - 3, f.y, P.gate[0] + 1, f.y + 3, 'RECINZIONE'); if (o.labels) g.text(P.gate[0], f.y - h * 1.6, 'Ingresso carrabile', h, 'TESTI', { align: 'center' });
    }
    if (o.roads && P.fence) { // anello perimetrale interno (4 m) e asse centrale
      const f = P.fence, i1 = 1.5, i2 = 5.5;
      g.rect(f.x + i1, f.y + i1, f.w - 2 * i1, f.h - 2 * i1, 'VIABILITA'); g.rect(f.x + i2, f.y + i2, f.w - 2 * i2, f.h - 2 * i2, 'VIABILITA');
      if (P.road) { const xr = P.half * P.cellW - (P.cellW - (P.tracker ? P.td : P.tl)) + 0.0; g.line(xr + 0.6, f.y + i2, xr + 0.6, f.y + f.h - i2, 'VIABILITA').line(xr + P.road - 0.6, f.y + i2, xr + P.road - 0.6, f.y + f.h - i2, 'VIABILITA'); }
    }
    if (o.tables) for (const t of P.tables) { g.rect(t.x, t.y, t.w, t.h, 'MODULI'); if (o.strings) g.text(t.x + t.w / 2, t.y + t.h / 2, (t.inv + 1) + '.' + String(P.tables.filter(z => z.inv === t.inv).indexOf(t) + 1).padStart(2, '0'), Math.min(h * 0.7, t.h * 0.45), 'TESTI', { align: 'center', valign: 'middle' }); }
    if (o.invs) for (const v of P.invs) { g.rect(v.x, v.y, v.w, v.h, 'INVERTER'); if (o.labels) g.text(v.x + v.w / 2, v.y + v.h + h * 0.4, 'INV-' + String(v.k + 1).padStart(2, '0'), h * 0.8, 'INVERTER', { align: 'center' }); if (o.groups) { const b = bboxOf(v.grp.map(t => ({ t: 'poly', pts: [[t.x, t.y], [t.x + t.w, t.y + t.h]] }))); g.rect(b.x0 - 0.4, b.y0 - 0.4, b.w + 0.8, b.h + 0.8, 'INVERTER'); } }
    if (o.cabins) {
      for (const s of P.stations.concat([P.mvCab])) { g.rect(s.x, s.y, s.w, s.h, 'CABINE'); g.line(s.x, s.y, s.x + s.w, s.y + s.h, 'CABINE'); if (o.labels) g.text(s.x + s.w / 2, s.y - h * 1.3, s.name, h, 'CABINE', { align: 'center' }); }
      g.rect(P.userCab.x, P.userCab.y, P.userCab.w, P.userCab.h, 'ESISTENTE'); if (o.labels) g.text(P.userCab.x + P.userCab.w / 2, P.userCab.y - h * 1.3, P.userCab.name, h, 'ESISTENTE', { align: 'center' });
    }
    if (o.bess && P.bessArea) {
      const A = P.bessArea; g.rect(A.x, A.y, A.w, A.h, 'BESS'); if (o.labels) g.text(A.x, A.y + A.h + h * 0.6, 'Area BESS ' + nf(x.cfg.bess.kwh) + ' kWh / ' + nf(x.cfg.bess.kw) + ' kW', h, 'BESS');
      for (const u of P.bessUnits) { g.rect(u.x, u.y, u.w, u.h, 'BESS'); g.line(u.x, u.y, u.x + u.w, u.y + u.h, 'BESS').line(u.x, u.y + u.h, u.x + u.w, u.y, 'BESS'); }
      const t = P.bessTr; g.rect(t.x, t.y, t.w, t.h, 'CABINE'); if (o.labels) g.text(t.x + t.w / 2, t.y - h * 1.3, t.name, h * 0.8, 'CABINE', { align: 'center' });
    }
    if (o.mv) { g.poly(P.mvRoute, 'CAVI_MT'); if (o.labels) { const p = P.mvRoute[3]; g.text(p[0] + h * 0.6, p[1] + h * 0.6, `Cavidotto MT ${e.mvCable.type.split(',')[0]} 3x1x${e.mvCable.S} mm² – L ≈ ${nf(e.mvCable.L)} m`, h * 0.85, 'CAVI_MT'); } }
    return g;
  }

  // ---------- particolari (metri locali, scala propria) ----------
  function trench(kind, sc) {
    const g = G(), h = 2 * sc / 1000, W = kind === 'MT' ? 0.6 : 0.5, D = kind === 'MT' ? 1.2 : 0.8;
    g.line(-0.4, 0, W + 0.4, 0, 'TERRENO').poly([[0, 0], [0, -D], [W, -D], [W, 0]], 'TERRENO');
    g.rect(0.02, -D + 0.02, W - 0.04, 0.3, 'RIEMPIMENTI'); g.text(W + 0.08, -D + 0.12, 'letto e rinfianco in sabbia', h, 'TESTI');
    if (kind === 'MT') { [[0.25, -D + 0.12], [0.35, -D + 0.12], [0.30, -D + 0.205]].forEach(c => g.circle(W / 2 - 0.3 + c[0], c[1], 0.045, 'CAVI_MT')); g.text(W + 0.08, -D + 0.24, 'terna MT a trifoglio', h, 'CAVI_MT'); }
    else { for (let i = 0; i < 3; i++) g.circle(0.12 + i * 0.13, -D + 0.12, 0.05, 'CAVI_BT'); g.text(W + 0.08, -D + 0.24, 'tubi corrugati PE DN 125–160', h, 'CAVI_BT'); }
    g.line(0.05, -0.45, W - 0.05, -0.45, 'PROTEZIONI').text(W + 0.08, -0.47, 'nastro di segnalazione', h, 'TESTI');
    g.line(0.05, -D + 0.42, W - 0.05, -D + 0.42, 'STRUTTURE').text(W + 0.08, -D + 0.40, kind === 'MT' ? 'lastra di protezione' : 'riempimento con materiale di scavo', h, 'TESTI');
    g.dim(0, -D, W, -D, -0.15, nf(W, 2), h).dim(0, -D, 0, 0, 0.2, nf(D, 2), h);
    return g.ents;
  }
  function tableSection(x, sc, withPile) {
    const g = G(), h = 2.2 * sc / 1000, L = x.e.module.length, tilt = (x.cfg.pv.mount === 'tracker' ? 0 : x.cfg.pv.tilt) * DEG, h0 = 0.8;
    const run = 2 * L * Math.cos(tilt), rise = 2 * L * Math.sin(tilt);
    g.line(-0.8, 0, run + 0.8, 0, 'TERRENO');
    g.poly([[0, h0], [run, h0 + rise]], 'MODULI'); g.poly([[0, h0 - 0.05], [run, h0 + rise - 0.05]], 'MODULI');
    g.line(L * Math.cos(tilt), h0 + L * Math.sin(tilt) + 0.03, L * Math.cos(tilt), h0 + L * Math.sin(tilt) - 0.08, 'MODULI');
    const pf = run * 0.15, pr = run * 0.85, hf = h0 + rise * 0.15 - 0.12, hr = h0 + rise * 0.85 - 0.12;
    g.rect(pf - 0.05, 0, 0.1, hf, 'STRUTTURE').rect(pr - 0.05, 0, 0.1, hr, 'STRUTTURE');
    g.line(pf, hf, pr, hr, 'STRUTTURE');
    if (withPile) { g.rect(pf - 0.05, -1.6, 0.1, 1.6, 'SEGNAPOSTO').rect(pr - 0.05, -1.6, 0.1, 1.6, 'SEGNAPOSTO'); g.text(pr + 0.2, -0.9, 'infissione ≈ 1,6 m [da prove di estrazione]', h, 'TESTI'); }
    g.dim(0, 0, 0, h0, 0.35, nf(h0, 2), h).dim(run, 0, run, h0 + rise, -0.35, nf(h0 + rise, 2), h).dim(0, -0.05, run, -0.05, -0.5, nf(run, 2), h);
    g.text(run * 0.3, h0 + rise * 0.3 + 0.35, `2 moduli in verticale (2P), ${x.cfg.pv.mount === 'tracker' ? 'tracker ±55°' : 'tilt ' + x.cfg.pv.tilt + '°'}`, h, 'TESTI');
    g.arc(0, h0, 0.6, 0, tilt / DEG, 'QUOTE'); g.text(0.65, h0 + 0.05, (x.cfg.pv.mount === 'tracker' ? 0 : x.cfg.pv.tilt) + '°', h, 'QUOTE');
    return { ents: g.ents, run, rise, h0, hf, hr, pf, pr };
  }

  // ---------- simboli per gli schemi (mm) ----------
  const sym = {
    breaker: (g, x, y, lab) => { g.rect(x - 2, y - 2, 4, 4, 'SCHEMA').line(x - 2, y - 2, x + 2, y + 2, 'SCHEMA').line(x - 2, y + 2, x + 2, y - 2, 'SCHEMA'); if (lab) g.text(x + 3.5, y - 0.9, lab, 2, 'TESTI'); },
    trafo: (g, x, y, lab) => { g.circle(x, y + 2.6, 3.6, 'SCHEMA').circle(x, y - 2.6, 3.6, 'SCHEMA'); if (lab) [].concat(lab).forEach((s, i) => g.text(x + 5.5, y + 2 - i * 3.2, s, 2, 'TESTI')); },
    inverter: (g, x, y, lab) => { g.rect(x - 5, y - 5, 10, 10, 'SCHEMA').line(x - 5, y - 5, x + 5, y + 5, 'SCHEMA').text(x - 3.6, y + 1.4, '=', 2.4, 'TESTI').text(x + 1.2, y - 3.4, '~', 2.4, 'TESTI'); if (lab) g.text(x, y - 8, lab, 1.9, 'TESTI', { align: 'center' }); },
    pv: (g, x, y, lab) => { g.rect(x - 5, y - 3.5, 10, 7, 'SCHEMA').line(x - 5, y + 3.5, x - 2, y - 3.5, 'SCHEMA'); [-1, 1].forEach(k => g.line(x + 1 + k, y + 5.5, x + 2.5 + k, y + 4, 'SCHEMA')); if (lab) g.text(x, y - 6.5, lab, 1.9, 'TESTI', { align: 'center' }); },
    battery: (g, x, y, lab) => { g.rect(x - 6, y - 5, 12, 10, 'BESS'); g.line(x - 3, y + 2, x + 3, y + 2, 'BESS').line(x - 1.5, y, x + 1.5, y, 'BESS').line(x - 3, y - 2, x + 3, y - 2, 'BESS'); if (lab) g.text(x, y - 8, lab, 1.9, 'TESTI', { align: 'center' }); },
    meter: (g, x, y, lab) => { g.circle(x, y, 3, 'SCHEMA').text(x, y, 'M', 2.2, 'TESTI', { align: 'center', valign: 'middle' }); if (lab) g.text(x + 4.5, y - 0.9, lab, 2, 'TESTI'); }
  };

  // ---------- unifilare ----------
  function unifilare(x, detail) {
    const g = G(), e = x.e, cfg = x.cfg, X0 = 150, yTop = 380;
    g.arrow(X0, yTop + 25, X0, yTop + 6, 'SCHEMA', 3).text(X0 + 4, yTop + 18, `Rete del distributore ${cfg.grid.voltageKv} kV – Icc ${nf(e.mvCable.iccKa, 1)} kA`, 2.6, 'TESTI');
    g.rect(X0 - 40, yTop - 62, 150, 66, 'ESISTENTE').text(X0 - 38, yTop + 0.5, 'CABINA DI CONSEGNA / UTENTE ESISTENTE', 2.2, 'ESISTENTE');
    sym.meter(g, X0, yTop - 6, 'M1 – misura di scambio (distributore)'); g.line(X0, yTop + 6, X0, yTop - 3, 'SCHEMA').line(X0, yTop - 9, X0, yTop - 18, 'SCHEMA');
    sym.breaker(g, X0, yTop - 20, 'DG – SPG 50/51, 51N/67N'); g.line(X0, yTop - 22, X0, yTop - 30, 'SCHEMA');
    g.line(X0 - 30, yTop - 30, X0 + 70, yTop - 30, 'SCHEMA'); g.text(X0 + 72, yTop - 31, `Sbarre MT ${cfg.grid.voltageKv} kV`, 2, 'TESTI');
    g.line(X0 - 25, yTop - 30, X0 - 25, yTop - 45, 'SCHEMA'); sym.breaker(g, X0 - 25, yTop - 47); g.arrow(X0 - 25, yTop - 49, X0 - 25, yTop - 58, 'SCHEMA', 2.5); g.text(X0 - 38, yTop - 61, 'Carichi dello stabilimento', 2, 'TESTI');
    g.line(X0 + 40, yTop - 30, X0 + 40, yTop - 45, 'SCHEMA'); sym.breaker(g, X0 + 40, yTop - 47, 'DDI – SPI 27/59/81/59N (CEI 0-16)');
    g.line(X0 + 40, yTop - 49, X0 + 40, yTop - 95, 'CAVI_MT').text(X0 + 43, yTop - 75, `Linea MT ${e.mvCable.type.split(',')[0]} 3x1x${e.mvCable.S} mm² Al – ${nf(e.mvCable.L)} m`, 2, 'CAVI_MT');
    const yb = yTop - 95, branches = [];
    if (x.hasPv) for (let k = 0; k < e.transformer.n; k++) branches.push({ type: 'pv', k });
    if (x.b && e.bess) for (let k = 0; k < e.bess.nTr; k++) branches.push({ type: 'bess', k });
    const perBr = Math.max(x.hasPv ? Math.min(8, Math.ceil(e.nInv / Math.max(1, e.transformer.n))) : 0, x.b && e.bess ? Math.min(6, Math.ceil(e.bess.n / e.bess.nTr)) : 0, 1);
    const bw = Math.max(110, 26 * perBr + 24);
    const span = branches.length * bw, xs = X0 + 40 - span / 2 + bw / 2;
    g.line(Math.min(xs - 30, X0 + 10), yb, Math.max(xs + span - bw / 2 + 10, X0 + 70), yb, 'SCHEMA'); g.text(Math.max(xs + span - bw / 2 + 12, X0 + 72), yb - 1, "Quadro MT d'impianto", 2, 'TESTI');
    sym.meter(g, X0 + 40 - 18, yb + 10, null); g.text(X0 + 40 - 30, yb + 14.5, 'M2 – misura produzione', 1.8, 'TESTI');
    branches.forEach((br, j) => {
      const bx = xs + j * bw; g.line(bx, yb, bx, yb - 10, 'SCHEMA'); sym.breaker(g, bx, yb - 12, detail ? '50/51, 51N' : null); g.line(bx, yb - 14, bx, yb - 22, 'SCHEMA');
      if (br.type === 'pv') {
        sym.trafo(g, bx, yb - 28, [`TR-FV-${String(br.k + 1).padStart(2, '0')} ${nf(e.transformer.kva)} kVA`, `${cfg.grid.voltageKv}/${nf(e.transformer.lv / 1000, 1)} kV Dyn11`]);
        const yl = yb - 44; g.line(bx, yb - 34.2, bx, yl, 'SCHEMA');
        const invs = Math.ceil(e.nInv / e.transformer.n), show = Math.min(invs, 8), w = (bw - 14) / show;
        g.line(bx - (show - 1) * w / 2 - 4, yl, bx + (show - 1) * w / 2 + 4, yl, 'SCHEMA'); g.text(bx + (show - 1) * w / 2 + 6, yl - 1, `QBT ${e.inverter.vac} V`, 1.9, 'TESTI');
        for (let i = 0; i < show; i++) {
          const ix = bx - (show - 1) * w / 2 + i * w, idx = br.k * invs + (show < invs && i === show - 1 ? invs - 1 : i) + 1;
          g.line(ix, yl, ix, yl - 8, 'SCHEMA'); sym.breaker(g, ix, yl - 10, null); g.line(ix, yl - 12, ix, yl - 18, 'CAVI_BT');
          sym.inverter(g, ix, yl - 23, 'INV-' + String(idx).padStart(2, '0')); g.line(ix, yl - 28, ix, yl - 40, 'CAVI_DC'); sym.pv(g, ix, yl - 44, `${e.spInv} str. × ${e.Ns}`);
          if (show < invs && i === show - 2) g.text(ix + w / 2, yl - 23, '…', 3, 'TESTI', { align: 'center' });
        }
        if (detail) g.text(bx - bw / 2 + 4, yl - 62, `Cavi BT ${e.acCable ? e.acCable.par + 'x' + e.acCable.S + ' mm² Al' : ''}; interruttori ${Math.ceil(e.inverter.pac * 1000 / (Math.sqrt(3) * e.inverter.vac) * 1.25 / 10) * 10} A; stringhe ${e.dcCable.S} mm² Cu`, 1.8, 'TESTI');
      } else {
        sym.trafo(g, bx, yb - 28, [`TR-BESS ${nf(e.bess.trKva)} kVA`, `${cfg.grid.voltageKv}/0,4 kV Dyn11`]);
        const yl = yb - 44; g.line(bx, yb - 34.2, bx, yl, 'SCHEMA');
        const units = Math.ceil(e.bess.n / e.bess.nTr), show = Math.min(units, 6), w = (bw - 14) / show;
        g.line(bx - (show - 1) * w / 2 - 4, yl, bx + (show - 1) * w / 2 + 4, yl, 'SCHEMA'); g.text(bx + (show - 1) * w / 2 + 6, yl - 1, 'QBT 400 V BESS', 1.9, 'TESTI');
        for (let i = 0; i < show; i++) { const ix = bx - (show - 1) * w / 2 + i * w; g.line(ix, yl, ix, yl - 8, 'SCHEMA'); sym.breaker(g, ix, yl - 10, null); g.line(ix, yl - 12, ix, yl - 18, 'CAVI_BT'); sym.inverter(g, ix, yl - 23, 'PCS'); g.line(ix, yl - 28, ix, yl - 33, 'CAVI_DC'); sym.battery(g, ix, yl - 38, 'BESS-' + String(i + 1).padStart(2, '0')); if (show < units && i === show - 2) g.text(ix + w / 2, yl - 23, '…', 3, 'TESTI', { align: 'center' }); }
        g.text(bx - bw / 2 + 4, yl - 54, `${e.bess.n} × ${e.bess.unit.name.split('(')[0].trim()} – ${nf(cfg.bess.kwh)} kWh / ${nf(cfg.bess.kw)} kW`, 1.9, 'BESS');
      }
    });
    // controllore centrale d'impianto
    const cx = X0 + 120, cy = yTop - 20; g.label(cx, cy - 6, 52, 14, ['CCI / EMS / SCADA', 'limitazione immissione, P/Q, logiche BESS'], 'CONTROLLO', 2.3);
    g.line(cx, cy + 1, X0 + 42, yTop - 47, 'CONTROLLO'); g.line(cx + 26, cy - 6, cx + 26, yb - 60, 'CONTROLLO').text(cx + 28, yb - 58, 'segnali a inverter e PCS', 1.8, 'CONTROLLO');
    return g.ents;
  }

  // ---------- definizione delle tavole ----------
  const LEG_PLAN = [['MODULI', 'Tavole di moduli FV'], ['INVERTER', 'Inverter di stringa'], ['CABINE', 'Cabine di trasformazione / MT'], ['BESS', 'Unità BESS e area'], ['RECINZIONE', 'Recinzione'], ['VIABILITA', 'Viabilità interna'], ['CAVI_MT', 'Cavidotto MT'], ['ESISTENTE', 'Edifici e cabine esistenti']];
  function planDrawing(x, d, opt, legend, notes, details) {
    const P = plant(x); let g = planEnts(x, P, opt, 1);
    const base = { code: d.code, title: d.title, unit: 'm', sheet: 'A1', ents: g.ents, legend, details, sideW: details && details.length ? 150 : 0 };
    const scale = X.fitScale(base), h = 2.2 * scale / 1000;
    g = planEnts(x, P, opt, h);
    if (opt.dims !== false && x.hasPv && P.tables.length) { g.dim(0, 0, P.fieldW, 0, -h * 4, nf(P.fieldW, 1) + ' m', h); g.dim(0, 0, 0, P.fieldH, h * 4, nf(P.fieldH, 1) + ' m', h); }
    if (opt.extra) opt.extra(g, P, h);
    return Object.assign(base, { ents: g.ents, scale, north: true, notes });
  }
  const DRAW = {
    T01: (x, d) => {
      const g = G(), boxes = [['COROGRAFIA (IGM / CTR) – scala 1:25.000', 18], ['STRALCIO DELLO STRUMENTO URBANISTICO (PGT / PRG)', 140], ['ESTRATTO DI MAPPA CATASTALE CON PERIMETRO DI INTERVENTO', 262]];
      boxes.forEach(([t, xx]) => { g.rect(xx, 0, 115, 150, 'SEGNAPOSTO').text(xx + 3, 145, t, 2.4, 'TESTI').text(xx + 57.5, 75, '[DA INSERIRE: base cartografica]', 3, 'SEGNAPOSTO', { align: 'center' }); });
      g.text(18, -10, `Sito: ${x.site.name} – coordinate di riferimento ${nf(x.site.lat, 4)}° N, ${nf(x.site.lon, 4)}° E – zona di mercato ${x.site.zone}`, 3, 'TESTI');
      g.text(18, -17, 'Vincoli da riportare: paesaggistico (D.Lgs. 42/2004), idrogeologico, Rete Natura 2000, fasce di rispetto, aree idonee (D.Lgs. 190/2024).', 2.4, 'TESTI');
      return { code: d.code, title: d.title, unit: 'mm', sheet: 'A1', ents: g.ents, scaleLabel: 'varie', notes: ['Inserire le basi cartografiche georeferenziate (IGM, CTR, PGT, catasto) nei riquadri.'] };
    },
    T02: (x, d) => planDrawing(x, d, {}, LEG_PLAN, ['Layout di impostazione generato dal simulatore: posizione e orientamento delle file vanno adattati al rilievo e ai confini catastali.', `Tavole 2P da ${x.e.Ns} moduli; passo tra le file ${nf(2 * x.e.module.length / x.cfg.pv.gcr, 2)} m (GCR ${x.cfg.pv.gcr}).`, 'Distanze dell\'area BESS da verificare con le Linee guida VVF (circolare DCPREV 21021/2024).']),
    T03: (x, d) => {
      if (!x.hasPv) return planDrawing(x, d, { dims: false, extra: (g, P, h) => { const A = P.bessArea; if (A) g.dim(A.x, A.y, A.x + A.w, A.y, -h * 4, nf(A.w, 1) + ' m', h).dim(A.x, A.y, A.x, A.y + A.h, h * 4, nf(A.h, 1) + ' m', h); } }, LEG_PLAN.slice(2), ['Quote planimetriche dell\'area BESS; quote altimetriche da rilievo.'], [{ title: 'Sezione basamento unità BESS', scale: 50, ents: DRAW.D05(Object.assign({}, x, { hasPv: false }), d).ents }]);
      const s = tableSection(x, 50, false), g = G(), pitch = 2 * x.e.module.length / x.cfg.pv.gcr, h = 2.2 * 50 / 1000;
      s.ents.forEach(e => g.ents.push(e));
      const s2 = tableSection(x, 50, false); s2.ents.forEach(e => g.ents.push(shift(e, pitch, 0)));
      g.dim(0, s.h0, pitch, s.h0, -s.h0 - 1.3, 'passo ' + nf(pitch, 2) + ' m', h);
      const ombra = s.rise / Math.tan(Math.max(10, 90 - x.site.lat - 23.45) * DEG);
      g.text(0, s.h0 + s.rise + 1.2, `Sezione tipo tra due file – ombra al solstizio d'inverno a mezzogiorno ≈ ${nf(ombra, 1)} m`, h * 1.1, 'TESTI');
      // prospetto della tavola
      const tl = Math.ceil(x.e.Ns / 2) * x.e.module.width, y0 = -6;
      g.line(-0.5, y0, tl + 0.5, y0, 'TERRENO');
      for (let r = 0; r < 2; r++) for (let c = 0; c < Math.ceil(x.e.Ns / 2); c++) g.rect(c * x.e.module.width, y0 + 0.8 + r * 1.2, x.e.module.width - 0.02, 1.15, 'MODULI');
      const posts = Math.max(3, Math.ceil(tl / 4) + 1); for (let i = 0; i < posts; i++) { const px = i * tl / (posts - 1); g.rect(px - 0.05, y0, 0.1, 0.8, 'STRUTTURE'); }
      g.dim(0, y0, tl, y0, -0.8, nf(tl, 2) + ' m', h).text(0, y0 + 3.4, `Prospetto della tavola: ${x.e.Ns} moduli (2 × ${Math.ceil(x.e.Ns / 2)}), ${posts} pali`, h * 1.1, 'TESTI');
      return { code: d.code, title: d.title, unit: 'm', sheet: 'A1', ents: g.ents, scale: 50, notes: ['Altezza minima dal suolo 0,80 m (da verificare con sfalcio, neve, agrivoltaico).', 'Quote in metri.'] };
    },
    T04: (x, d) => {
      const P = plant(x); if (!P.bessArea) return null;
      const g = G(), A = P.bessArea, h = 2.2 * 100 / 1000, ox = -A.x, oy = -A.y;
      const S = (r) => ({ x: r.x + ox, y: r.y + oy, w: r.w, h: r.h, name: r.name });
      const a = S(A); g.rect(a.x, a.y, a.w, a.h, 'BESS').text(a.x, a.y + a.h + 0.6, 'Isola BESS', h * 1.1, 'BESS');
      P.bessUnits.forEach((u0, i) => { const u = S(u0); g.rect(u.x, u.y, u.w, u.h, 'BESS').line(u.x, u.y, u.x + u.w, u.y + u.h, 'BESS').text(u.x + u.w / 2, u.y + u.h / 2, u.name, h * 0.8, 'TESTI', { align: 'center', valign: 'middle' }); if (i === 0 && P.bessUnits[1]) { const v = S(P.bessUnits[1]); if (v.y === u.y) g.dim(u.x + u.w, u.y + u.h, v.x, v.y + v.h, 0.8, nf(v.x - u.x - u.w, 1) + ' m [VVF]', h); } });
      const t = S(P.bessTr); g.rect(t.x, t.y, t.w, t.h, 'CABINE').text(t.x + t.w / 2, t.y - 1, t.name, h, 'CABINE', { align: 'center' });
      g.rect(a.x - 4, a.y - 4, a.w + 8, a.h + 8, 'VIABILITA').text(a.x - 3.5, a.y - 3.2, 'Viabilità VVF larghezza ≥ 4 m', h, 'VIABILITA');
      g.rect(a.x - 9, a.y - 9, a.w + 18, a.h + 18, 'RECINZIONE');
      g.circle(a.x + a.w + 6.5, a.y + a.h + 6.5, 0.6, 'ANTINCENDIO').text(a.x + a.w + 7.5, a.y + a.h + 6.3, 'Idrante UNI 70 [da progetto VVF]', h, 'ANTINCENDIO');
      g.rect(a.x - 8, a.y - 8, 6, 3, 'DRENAGGI').text(a.x - 8, a.y - 4.4, 'Vasca acque di spegnimento', h * 0.85, 'DRENAGGI');
      g.dim(a.x, a.y, a.x + a.w, a.y, -2.2, nf(a.w, 1) + ' m', h).dim(a.x, a.y, a.x, a.y + a.h, 2.2, nf(a.h, 1) + ' m', h);
      return { code: d.code, title: d.title, unit: 'm', sheet: 'A1', ents: g.ents, north: true, legend: [['BESS', 'Unità BESS / isola'], ['CABINE', 'Trasformatore BESS'], ['VIABILITA', 'Viabilità VVF'], ['RECINZIONE', 'Recinzione'], ['ANTINCENDIO', 'Presidi antincendio'], ['DRENAGGI', 'Raccolta acque di spegnimento']],
        notes: [`Unità base: ${x.e.bess.unit.name}, ingombro ${nf(x.e.bess.unit.footprint, 1)} m² (≤ 32 m² richiesti dalle Linee guida VVF).`, 'Distanze tra unità, tra isole, di protezione ed esterne da definire secondo circolare DCPREV 21021/2024 e nota 9467/2025.'] };
    },
    T05: (x, d) => ({ code: d.code, title: d.title, unit: 'mm', sheet: 'A1', ents: unifilare(x, false), legend: [['SCHEMA', 'Apparecchiature e sbarre'], ['CAVI_MT', 'Linea MT'], ['CAVI_BT', 'Linee BT'], ['CAVI_DC', 'Circuiti DC'], ['CONTROLLO', 'Segnali di controllo'], ['ESISTENTE', 'Esistente']], notes: ['Schema unifilare di principio: tarature e apparecchiature da confermare con il regolamento di esercizio del distributore.'] }),
    T06: (x, d) => {
      const g = G(), h = 2.2 * 50 / 1000; let ox = 0;
      const cab = (name, w, dd, hh, inner) => { g.rect(ox, 0, w, dd, 'CABINE').text(ox, dd + 0.4, name + ' – pianta', h * 1.1, 'TESTI'); (inner || []).forEach(([ix, iw, lab]) => g.rect(ox + ix, 0.25, iw, dd - 0.5, 'SCHEMA').text(ox + ix + iw / 2, dd / 2, lab, h * 0.8, 'TESTI', { align: 'center', valign: 'middle', rot: 90 })); g.dim(ox, 0, ox + w, 0, -0.6, nf(w, 2), h).dim(ox, 0, ox, dd, 0.6, nf(dd, 2), h);
        g.rect(ox, -6, w, hh, 'CABINE').rect(ox + w * 0.15, -6, 1.0, 2.2, 'CABINE').text(ox, -6 + hh + 0.4, name + ' – prospetto', h * 1.1, 'TESTI').line(ox - 0.5, -6, ox + w + 0.5, -6, 'TERRENO').dim(ox + w, -6, ox + w, -6 + hh, -0.6, nf(hh, 2), h); ox += w + 4; };
      if (x.hasPv) cab('Cabina di trasformazione FV', 6.0, 2.5, 2.7, [[0.3, 1.8, 'Quadro MT'], [2.4, 2.0, 'Trasformatore ' + nf(x.e.transformer.kva) + ' kVA'], [4.7, 1.0, 'Quadro BT']]);
      cab("Cabina MT d'impianto", 6.5, 2.5, 2.7, [[0.3, 0.75, 'Arrivo'], [1.15, 0.75, 'DDI'], [2.0, 0.75, 'FV'], [2.85, 0.75, 'BESS'], [3.7, 0.75, 'TR SA'], [4.8, 1.3, 'SCADA']]);
      if (x.b && x.e.bess) { const u = x.e.bess.unit, big = u.kwh > 1000, w = big ? 6.06 : 1.3, dd = big ? 2.44 : 1.4; cab('Unità BESS', w, dd, big ? 2.9 : 2.3, []); }
      if (x.hasPv) { g.rect(ox, -6, 1.1, 0.8, 'INVERTER').rect(ox + 0.5, -6 - 0.8, 0.1, 0.8, 'STRUTTURE').text(ox, -4.9, 'Inverter ' + x.e.inverter.pac + ' kW su supporto', h, 'TESTI'); }
      return { code: d.code, title: d.title, unit: 'm', sheet: 'A1', ents: g.ents, scale: 50, notes: ['Dimensioni tipiche da sostituire con quelle del fornitore.', 'Fondazioni secondo X04 / D05.'] };
    },
    T07: (x, d) => { const s = tableSection(x, 20, true); return { code: d.code, title: d.title, unit: 'm', sheet: 'A1', ents: s.ents, scale: 20, notes: ['Profili, spessori e collegamenti da calcolo strutturale NTC 2018 (X04).', `Peso dei moduli per tavola ≈ ${nf(x.e.Ns * x.e.module.weight)} kg.`] }; },
    T08: (x, d) => planDrawing(x, d, { invs: false, mv: false, extra: (g, P, h) => { if (!P.fence) return; const f = P.fence; g.line(f.x + 0.6, f.y + 0.6, f.x + f.w - 0.6, f.y + 0.6, 'DRENAGGI').line(f.x + 0.6, f.y + f.h - 0.6, f.x + f.w - 0.6, f.y + f.h - 0.6, 'DRENAGGI'); g.text(f.x + 2, f.y + 1.2 + h * 0.3, 'Fosso di guardia / drenaggio', h, 'DRENAGGI'); g.rect(f.x + f.w - 18, f.y + 1.2, 14, 6, 'DRENAGGI').text(f.x + f.w - 18, f.y + 7.8, 'Bacino di laminazione [R06]', h * 0.85, 'DRENAGGI'); } },
      [['RECINZIONE', 'Recinzione h 2,0 m'], ['VIABILITA', 'Viabilità in misto stabilizzato'], ['DRENAGGI', 'Drenaggi e laminazione'], ['MODULI', 'Tavole FV'], ['CABINE', 'Cabine']], ['Recinzione in rete metallica h 2,0 m con passaggi per la piccola fauna.', 'Viabilità in misto granulare stabilizzato, larghezza 4 m.'], [{ title: 'Sezione tipo viabilità', scale: 50, ents: roadSection() }]),
    T09: (x, d) => planDrawing(x, d, { invs: false, tables: true }, [['CAVI_MT', 'Cavidotto MT'], ['CABINE', 'Cabine'], ['ESISTENTE', 'Esistente'], ['RECINZIONE', 'Recinzione']], ['Tracciato di impostazione: interferenze e attraversamenti da rilevare.', 'Posa a 1,0–1,2 m di profondità secondo CEI 11-17.'], [{ title: 'Sezione di scavo MT', scale: 20, ents: trench('MT', 20) }]),
    T10: (x, d) => planDrawing(x, d, { invs: false, mv: false, extra: (g, P, h) => {
      const f = P.fence || { x: -5, y: -30, w: P.fieldW + 10, h: P.fieldH + 40 }; g.rect(f.x + 1, f.y + 1, f.w - 2, f.h - 2, 'TERRA');
      P.stations.concat([P.mvCab], P.bessTr ? [P.bessTr] : []).forEach(s => g.line(s.x + s.w / 2, s.y, s.x + s.w / 2, f.y + 1, 'TERRA'));
      const per = 2 * (f.w + f.h), n = Math.max(4, Math.round(per / 40));
      for (let i = 0; i < n; i++) { let t = i * per / n, px, py; if (t < f.w) { px = f.x + t; py = f.y; } else if ((t -= f.w) < f.h) { px = f.x + f.w; py = f.y + t; } else if ((t -= f.h) < f.w) { px = f.x + f.w - t; py = f.y + f.h; } else { t -= f.w; px = f.x; py = f.y + f.h - t; } g.circle(px, py, h * 0.6, 'TVCC').text(px + h * 0.8, py + h * 0.8, 'TV' + (i + 1), h * 0.8, 'TVCC'); }
    } }, [['TERRA', 'Dispersore ad anello Cu 50 mm²'], ['TVCC', 'Telecamere su palo'], ['RECINZIONE', 'Recinzione'], ['CABINE', 'Cabine']], ['Maglia di terra da dimensionare secondo CEI EN 50522 (X05).', 'Telecamere ogni circa 40 m lungo la recinzione, con barriere a infrarossi.']),
    D01: (x, d) => x.hasPv ? planDrawing(x, d, { strings: true, groups: true, mv: false }, LEG_PLAN.slice(0, 5), [`Numerazione delle stringhe: inverter.stringa; ${x.e.spInv} stringhe per inverter, ${x.e.spMppt} per MPPT.`, `Stringhe da ${x.e.Ns} moduli ${x.e.module.name}.`]) : null,
    D02: (x, d) => Object.assign(DRAW.T05(x, d), { ents: unifilare(x, true), notes: ['Schema unifilare esecutivo: sezioni, tarature e potere di interruzione da X02/X03.'] }),
    D03: (x, d) => {
      const g = G(), B = (cx, cy, l) => g.label(cx, cy, 58, 14, l, 'SCHEMA', 2.3);
      B(0, 120, ['SPI', '27 / 59 / 81 / 59N']); B(90, 120, ['DDI', 'bobina di apertura']); B(180, 120, ['Rincalzo', 'apertura DG se il DDI non apre']); B(270, 120, ['DG', 'dispositivo generale']);
      B(0, 80, ['SPG', '50/51, 51N/67N']); B(0, 40, ['Pulsante di emergenza']); B(90, 40, ['CCI / PPC', 'limitazione immissione, P/Q']); B(180, 40, ['Inverter FV', 'riduzione P, regolazione Q']);
      if (x.b) { B(0, 0, ['Rivelazione gas / fumo BESS']); B(90, 0, ['Arresto PCS']); B(180, 0, ['Arresto HVAC / ventilazione']); B(270, 0, ['Allarme e chiamata VVF']); B(270, 40, ['PCS BESS', 'carica / scarica']); }
      const A = (x1, y1, x2, y2) => g.arrow(x1, y1, x2, y2, 'CONTROLLO', 2.5);
      A(58, 127, 90, 127); A(148, 127, 180, 127); A(238, 127, 270, 127); A(58, 87, 270, 122); A(58, 47, 90, 124); A(148, 47, 180, 47); if (x.b) { A(148, 44, 270, 44); A(58, 7, 90, 7); A(58, 4, 180, 4); A(58, 10, 270, 10); }
      return { code: d.code, title: d.title, unit: 'mm', sheet: 'A1', ents: g.ents, notes: ['Logiche di principio secondo CEI 0-16; tempi di intervento del rincalzo e degli interblocchi da definire.'] };
    },
    D04: (x, d) => planDrawing(x, d, { mv: true, extra: (g, P, h) => { const st = P.stations[0]; if (!st) return; for (const v of P.invs) { const mid = P.road ? P.half * P.cellW - (P.cellW - (P.tracker ? P.td : P.tl)) + P.road / 2 : v.x + v.w / 2; g.poly([[v.x + v.w / 2, v.y], [v.x + v.w / 2, v.y - 0.6], [mid, v.y - 0.6], [mid, st.y + st.h], [st.x + st.w / 2, st.y + st.h]], 'CAVI_BT'); } } },
      [['CAVI_BT', 'Linee BT inverter – cabina'], ['CAVI_MT', 'Cavidotto MT'], ['MODULI', 'Tavole FV'], ['CABINE', 'Cabine']], ['Cavi di stringa lungo le strutture in canala o fissati ai profili.', 'Percorsi BT in cavidotto interrato lungo la viabilità.'], [{ title: 'Sezione di scavo BT/DC', scale: 20, ents: trench('BT', 20) }, { title: 'Sezione di scavo MT', scale: 20, ents: trench('MT', 20) }]),
    D05: (x, d) => {
      const g = G(), h = 2.2 * 20 / 1000;
      if (x.hasPv) tableSection(x, 20, true).ents.forEach(e => g.ents.push(e));
      if (x.b && x.e.bess) { const u = x.e.bess.unit, big = u.kwh > 1000, w = (big ? 6.06 : 1.3) + 0.6, ox = x.hasPv ? 7 : 0; g.rect(ox, -0.5, w, 0.3, 'STRUTTURE').rect(ox, -0.2, w, 0.2, 'STRUTTURE').line(ox - 0.5, 0, ox + w + 0.5, 0, 'TERRENO').rect(ox + 0.3, 0, w - 0.6, big ? 2.9 : 2.3, 'BESS').text(ox, (big ? 2.9 : 2.3) + 0.3, 'Basamento unità BESS – sezione', h * 1.1, 'TESTI').dim(ox, -0.5, ox + w, -0.5, -0.3, nf(w, 2), h).dim(ox + w, -0.5, ox + w, 0, -0.3, '0,50', h); }
      return { code: d.code, title: d.title, unit: 'm', sheet: 'A1', ents: g.ents, scale: 20, notes: ['Armature, classi di calcestruzzo e ancoraggi da calcolo strutturale (X04).'] };
    },
    D06: (x, d) => {
      const g = G(), B = (cx, cy, l, layer) => g.label(cx, cy, 60, 14, l, layer || 'SCHEMA', 2.3);
      B(120, 120, ['Server SCADA / EMS', 'storico, logiche, HMI']); B(120, 80, ['Switch di impianto', 'anello in fibra ottica']); B(240, 120, ['Firewall / VPN', 'IEC 62443']); B(330, 120, ['Telecontrollo O&M', 'distributore (teledistacco)'], 'ESISTENTE');
      const leaves = [x.hasPv ? ['Inverter FV', 'Modbus TCP'] : null, x.b ? ['BMS / PCS BESS', 'Modbus TCP / IEC 61850'] : null, ['CCI / PPC', 'CEI 0-16'], ['Relè SPG / SPI', 'IEC 61850'], ['Contatori M1 / M2'], x.hasPv ? ['Stazione meteo', 'irraggiamento, T moduli'] : null].filter(Boolean);
      leaves.forEach((l, i) => { const lx = i * 70; B(lx, 30, l); g.line(lx + 30, 44, 150, 80, 'CONTROLLO'); });
      g.line(150, 94, 150, 120, 'CONTROLLO').line(180, 127, 240, 127, 'CONTROLLO').line(300, 127, 330, 127, 'CONTROLLO');
      return { code: d.code, title: d.title, unit: 'mm', sheet: 'A1', ents: g.ents, notes: ['Rete di impianto segregata dalla rete IT dello stabilimento.'] };
    },
    D07: (x, d) => {
      const g = G(), h = 2.2 * 50 / 1000, comp = ['Arrivo DSO', 'Misura', 'DG / SPG', 'Partenza stabilimento', 'Partenza impianto DDI / SPI', 'TR servizi ausiliari'], cw = 0.75, W = comp.length * cw + 2.0, Dd = 3.0;
      g.rect(0, 0, W, Dd, 'CABINE').text(0, Dd + 0.4, 'Cabina di consegna / utente – pianta', h * 1.1, 'TESTI');
      comp.forEach((c, i) => g.rect(1.0 + i * cw, 1.6, cw - 0.05, 1.0, 'SCHEMA').text(1.0 + i * cw + cw / 2, 1.0, c, h * 0.75, 'TESTI', { align: 'right', valign: 'middle', rot: 90 }));
      g.rect(0.2, 0, 1.0, 0.15, 'CABINE').text(0.2, -0.5, 'accesso distributore', h * 0.8, 'TESTI').rect(W - 1.4, 0, 1.0, 0.15, 'CABINE').text(W - 1.4, -0.5, 'accesso utente', h * 0.8, 'TESTI');
      g.dim(0, 0, W, 0, -1.1, nf(W, 2), h).dim(0, 0, 0, Dd, 0.6, nf(Dd, 2), h);
      return { code: d.code, title: d.title, unit: 'm', sheet: 'A3', ents: g.ents, scale: 50, notes: ['Locale distributore e locale utente separati secondo CEI 0-16; da verificare sulla cabina esistente.', 'Nuovo scomparto di partenza impianto con DDI e SPI.'] };
    },
    D08: (x, d) => planDrawing(x, d, { mv: false, extra: (g, P, h) => {
      P.stations.concat([P.mvCab], P.bessTr ? [P.bessTr] : []).forEach(s => { g.circle(s.x - 1, s.y + s.h + 1, h * 0.5, 'ILLUMINAZIONE').text(s.x - 1 + h * 0.7, s.y + s.h + 1, 'L', h * 0.8, 'ILLUMINAZIONE'); });
      for (const u of P.bessUnits) g.rect(u.x + u.w * 0.7, u.y + u.h, u.w * 0.25, 0.4, 'ILLUMINAZIONE');
      if (P.fence) { const f = P.fence, n = Math.max(4, Math.round(f.w / 30)); for (let i = 0; i <= n; i++) g.circle(f.x + i * f.w / n, f.y + 3, h * 0.45, 'ILLUMINAZIONE'); }
    } }, [['ILLUMINAZIONE', 'Illuminazione e unità HVAC'], ['CABINE', 'Cabine con quadro servizi ausiliari'], ['BESS', 'Unità BESS'], ['RECINZIONE', 'Recinzione']], ['Servizi ausiliari alimentati dal trasformatore SA in cabina MT; UPS per SCADA e protezioni.', 'Illuminazione a LED con accensione su allarme TVCC.'])
  };
  function shift(e, dx, dy) {
    const c = Object.assign({}, e);
    if (e.t === 'line') { c.x1 += dx; c.x2 += dx; c.y1 += dy; c.y2 += dy; } else if (e.t === 'poly' || e.t === 'fill') c.pts = e.pts.map(p => [p[0] + dx, p[1] + dy]); else { c.x += dx; c.y += dy; }
    return c;
  }
  function roadSection() {
    const g = G(), h = 2 * 50 / 1000;
    g.line(-1, 0, 5, 0, 'TERRENO').poly([[0, 0], [0.3, 0.25], [3.7, 0.25], [4, 0]], 'VIABILITA').line(0.3, 0.1, 3.7, 0.1, 'RIEMPIMENTI');
    g.text(0.4, 0.4, 'misto granulare stabilizzato sp. 25 cm su geotessile', h, 'TESTI').dim(0.3, 0.25, 3.7, 0.25, 0.9, '4,00', h);
    g.poly([[4.3, 0], [4.6, -0.4], [4.9, 0]], 'DRENAGGI').text(4.2, -0.7, 'fosso', h, 'DRENAGGI');
    return g.ents;
  }

  // ---------- API ----------
  const CODES = Object.keys(DRAW);
  function drawing(code, x, d) {
    const fn = DRAW[code]; if (!fn) return null;
    const dw = fn(x, d); if (!dw) return null;
    if (dw.unit === 'mm' && !dw.scale) for (const sh of ['A1', 'A0']) { dw.sheet = sh; if (X.fitScale(dw) <= 1) { dw.scale = 1; break; } } // schemi a scala 1:1, foglio più grande se serve
    dw.info = { client: x.cfg.project.client, project: x.cfg.project.name, docCode: `${x.prefix}-${x.phase === 'pfte' ? 'PFTE' : 'ESE'}-${code}`, phase: x.phase === 'pfte' ? 'PFTE/Def.' : 'Esecutivo', rev: x.rev, date: x.date.split('-').reverse().join('/') };
    return X.sheet(dw);
  }
  return { drawing, CODES, plant };
});
