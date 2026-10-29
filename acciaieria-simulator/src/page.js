/* Simulatore acciaieria integrata – logica della pagina (globale AccPage), versione 1.0.0. Stato D.
   Legge AccData, AccEngine e AccDocs. Nessuna richiesta di rete: i file sono consegnati come download
   (capacità downloads del visualizzatore claude.ai, oppure un link Blob quando la pagina è aperta da file). */
(function () {
  'use strict';
  var D = window.AccData, E = window.AccEngine, Dc = window.AccDocs;
  var VERSION = '1.0.0', STORE = 'acc-sim-case-1';

  // ================================================================ utilità
  function $(id) { return document.getElementById(id); }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  function el(tag, a, kids) {
    var n = document.createElement(tag);
    if (a) Object.keys(a).forEach(function (k) {
      var v = a[k]; if (v === null || v === undefined || v === false) return;
      if (k === 'text') n.textContent = v; else if (k === 'cls') n.className = v; else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c === null || c === undefined) return; n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  var NS = 'http://www.w3.org/2000/svg';
  function sv(tag, a, text) { var n = document.createElementNS(NS, tag); Object.keys(a || {}).forEach(function (k) { if (a[k] !== null && a[k] !== undefined) n.setAttribute(k, a[k]); }); if (text !== undefined) n.textContent = text; return n; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function fx(v, d) { if (!isNum(v)) return '–'; return v.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/^-/, '−'); }
  function sig(v) { if (!isNum(v)) return '–'; var a = Math.abs(v); return fx(v, a >= 1000 ? 0 : a >= 100 ? 1 : a >= 10 ? 1 : a >= 1 ? 2 : a === 0 ? 0 : 3); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function flatten(o, pre, out) { out = out || {}; Object.keys(o || {}).forEach(function (k) { var p = pre ? pre + '.' + k : k; if (o[k] !== null && typeof o[k] === 'object') flatten(o[k], p, out); else out[p] = o[k]; }); return out; }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ('00000000' + (h >>> 0).toString(16)).slice(-8); }
  function activate(n, fn) { n.addEventListener('click', fn); n.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } }); }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function kv(rows) { var dl = el('dl', { cls: 'kv' }); rows.forEach(function (r) { if (!r) return; dl.appendChild(el('dt', { text: r[0] })); dl.appendChild(el('dd', { text: r[1] })); }); return dl; }
  function table(cols, rows, opt) {
    opt = opt || {}; var num = opt.num || [], wrap = opt.wrap || [];
    var t = el('table', { cls: opt.cls || null }), th = el('tr');
    cols.forEach(function (c, i) { th.appendChild(el('th', { text: c, cls: num.indexOf(i) >= 0 ? 'n' : (wrap.indexOf(i) >= 0 ? 'wrap' : null), scope: 'col' })); });
    t.appendChild(el('thead', null, [th]));
    var tb = el('tbody');
    rows.forEach(function (r) {
      var tr = el('tr', { cls: r._cls || null });
      r.forEach(function (v, i) { var td = el('td', { cls: num.indexOf(i) >= 0 ? 'n' : (wrap.indexOf(i) >= 0 ? 'wrap' : null) }); if (v instanceof Node) td.appendChild(v); else td.textContent = v === null || v === undefined ? '' : v; tr.appendChild(td); });
      if (r._on) { tr.addEventListener('click', r._on); }
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    return el('div', { cls: 'tscroll' }, [t]);
  }
  function pill(ok) { return ok === null ? el('span', { cls: 'pill na', text: 'n.a.' }) : el('span', { cls: 'pill ' + (ok ? 'ok' : 'bad'), text: ok ? '● nel campo' : '▲ fuori campo' }); }

  // ================================================================ stato
  var P = {}; D.params.forEach(function (p) { P[p.path] = p; });
  var st = { caseId: 'A1', user: null, calc: null, sel: { type: 'case', id: null }, open: {}, A: null, B: null, log: [], dv: 'EL', dvGen: {}, ledger: 'plant' };
  var fieldReg = {};

  function presetUser(id) { var c = D.cases.cases[id]; return E.completeInputs(clone(c.inputs)); }
  function product() { return st.user.config.product; }
  function route() { return st.user.config.route; }
  function used(blocksList, b) { return blocksList.indexOf(b) >= 0; }

  // ================================================================ calcolo
  function refresh(note) {
    var u = clone(st.user), out;
    try { out = { ok: true, res: E.solve(u) }; } catch (e) { out = { ok: false, error: { name: e.name, message: e.message, path: e.path } }; }
    out.user = u; out.hash = hash(JSON.stringify(u)); out.time = new Date(); out.caseId = st.caseId;
    st.calc = out;
    if (out.ok) {
      var k = out.res.indicators;
      st.log.unshift({ time: out.time, caseId: st.caseId, product: u.config.product, route: u.config.route, LS: u.config.capacity_Mt, kwh: k.elec_kWh_t, co2: k.co2_direct_t_t, hash: out.hash, note: note || '' });
      if (st.log.length > 30) st.log.pop();
      Object.keys(st.dvGen).forEach(function (c) { st.dvGen[c] = gen(c); });
      if (!st.dvGen[st.dv]) st.dvGen[st.dv] = gen(st.dv);
    }
    store(STORE, { schema: 'acc-case/1', caseId: st.caseId, inputs: st.user });
    renderAll();
  }
  function changedPaths() {
    if (!st.calc) return [];
    var a = flatten(st.user), b = flatten(st.calc.user);
    return Object.keys(a).filter(function (k) { return JSON.stringify(a[k]) !== JSON.stringify(b[k]); });
  }
  function res() { return st.calc && st.calc.ok ? st.calc.res : null; }

  // ================================================================ rendering complessivo
  function renderAll() {
    $('tb-case').textContent = st.caseId + (changedPaths().length ? ' (modificato)' : '');
    syncToolbar(); renderStale(); renderProducts(); renderStatus(); drawDiagram(); renderInspector(); renderInputs();
    renderBalances(); renderEmissions(); renderDF(); renderAux(); renderSizes(); renderStreams(); renderCompare(); renderLog(); renderIso(); renderDeliverables(); renderPlot();
  }
  function syncToolbar() {
    $('preset').value = D.cases.cases[st.caseId] ? st.caseId : '';
    $('q-product').value = product(); $('q-route').value = route();
  }
  function renderStale() {
    var s = $('stale'), ch = changedPaths(), c = st.calc; clear(s);
    var fresh = !ch.length;
    s.className = 'stale' + (fresh ? ' fresh' : '');
    $('btn-refresh').classList.toggle('due', !fresh);
    $('products').classList.toggle('old', !fresh);
    $('pfd').classList.toggle('stale', !fresh);
    if (fresh) {
      s.appendChild(el('span', { cls: 'head', text: c && c.ok ? '● Risultati aggiornati' : '▲ Ultimo calcolo rifiutato' }));
      s.appendChild(el('span', { cls: 'meta', text: 'caso ' + st.caseId + ' · input ' + (c ? c.hash : '–') + ' · ' + (c ? c.time.toLocaleTimeString('it-IT') : '') + ' · motore ' + E.VERSION }));
    } else {
      s.appendChild(el('span', { cls: 'head', text: '▲ Risultati non aggiornati' }));
      s.appendChild(el('span', { text: ch.length + (ch.length === 1 ? ' input modificato' : ' input modificati') + ' dopo l\'ultimo calcolo: premi Aggiorna.' }));
      s.appendChild(el('span', { cls: 'meta', text: ch.slice(0, 6).join(', ') + (ch.length > 6 ? ' …' : '') }));
    }
  }
  function renderProducts() {
    var box = clear($('products')), r = res(), k = r ? r.indicators : null, H = r ? r.inputs.config.hours : 1;
    function cell(lbl, val, unit, sub) { box.appendChild(el('div', null, [el('div', { cls: 'lbl', text: lbl }), el('div', { cls: 'val' }, [val, unit ? el('span', { cls: 'unit', text: ' ' + unit }) : null]), sub ? el('div', { cls: 'sub', text: sub }) : null])); }
    cell('Acciaio liquido', k ? fx(k.LS_t / 1e6, 2) : '–', 'Mt/anno', k ? fx(k.LS_t / H, 0) + ' t/h · ' + fx(r.blocks.B4.heats_day, 0) + ' colate/giorno' : null);
    cell('Prodotti finiti', k ? fx(k.product_t / 1e6, 2) : '–', 'Mt/anno', k ? 'resa ' + fx(k.yield_products * 100, 1) + ' % sul liquido' : null);
    cell('Energia elettrica', k ? fx(k.elec_kWh_t, 0) : '–', 'kWh/t', k ? fx(k.elec_MW, 0) + ' MW medi, rete ' + fx(k.grid_MW, 0) + ' MW' : null);
    cell('Gas naturale', k ? fx(k.ng_GJ_t, 2) : '–', 'GJ/t', k ? fx(k.ng_MW, 0) + ' MW PCI' : null);
    cell('CO₂ diretta', k ? fx(k.co2_direct_t_t, 2) : '–', 't/t', k ? 'con la rete ' + fx(k.co2_total_t_t, 2) + ' t/t · ' + fx(k.co2_direct_t / 1e6, 2) + ' Mt/anno' : null);
    cell('Ossigeno', k ? fx(k.o2_Nm3_t, 0) : '–', 'Nm³/t', k ? 'ASU ' + fx(r.blocks.B11.o2_tpd, 0) + ' t/giorno' : null);
    cell('Acqua di reintegro', k ? fx(k.water_m3_t, 2) : '–', 'm³/t', k ? fx(k.makeup_m3h, 0) + ' m³/h' : null);
  }
  function renderStatus() {
    var s = clear($('status')), w = clear($('warnings')), c = st.calc;
    s.hidden = !(c && !c.ok);
    if (c && !c.ok) {
      s.appendChild(el('div', { cls: 'head', text: c.error.name === 'InputError' ? 'Input non valido: nessun risultato' : 'Calcolo non riuscito: nessun risultato' }));
      s.appendChild(el('p', { text: c.error.message }));
      s.appendChild(el('p', { cls: 'note', text: 'Correggi l\'input indicato, poi premi Aggiorna. Nessun valore della pagina è un risultato valido di questi input.' }));
    }
    var W = c && c.ok ? c.res.warnings : [];
    w.hidden = !W.length;
    if (W.length) { w.appendChild(el('div', { cls: 'head', text: W.length + (W.length > 1 ? ' avvisi' : ' avviso') + ' del modello (il calcolo è completo)' })); var ul = el('ul'); W.forEach(function (t) { ul.appendChild(el('li', { text: t })); }); w.appendChild(ul); }
  }

  // ================================================================ schema a blocchi
  var BX = { B1: [220, 100, 150, 150], B2: [450, 120, 150, 110], B3: [680, 120, 150, 110], B4: [910, 120, 150, 110], B5: [1140, 120, 150, 110],
    B6: [1140, 330, 150, 110], B7: [910, 330, 150, 110], B8: [680, 330, 150, 110], B9: [450, 330, 150, 110], B10: [190, 570, 300, 90], B11: [600, 570, 300, 90], B12: [1010, 570, 290, 90] };
  var DIAG = { S01: 'Minerale e pellet', S02: 'Carbone', S03: 'Rottame', S04: 'HBI', S05: 'Fondenti e calce', E3: 'Energia elettrica', S20: 'Ossigeno', S22: 'Scorie, polveri, scaglie', S18: 'Gas di recupero' };
  function blockName(b, I) {
    var A = I.config.product === 'A', R = I.config.route;
    return { B1: 'Parco materie prime', B2: 'Cokeria e agglomerazione', B3: R === 'BF-BOF' ? 'Altoforno' : 'Riduzione diretta', B4: R === 'BF-BOF' ? 'Convertitori BOF' : 'Forno elettrico', B5: 'Metallurgia secondaria', B6: 'Colata continua',
      B7: A ? 'Laminazione a caldo' : 'Tubi senza saldatura', B8: A ? 'Linee a freddo e rivestimenti' : 'Tubi saldati', B9: 'Finitura e spedizione', B10: 'Energia elettrica', B11: 'Gas tecnici, acqua, gas', B12: 'Ambiente e sottoprodotti' }[b];
  }
  function blockSub(b, r, I) {
    if (!r) return '';
    var B = r.blocks;
    switch (b) {
      case 'B1': return I.b1.autonomy_d + ' giorni · ' + fx(B.B1.yard_m2 / 1e4, 1) + ' ha';
      case 'B2': return B.B2.batteries + ' batterie · ' + B.B2.strands + ' nastri';
      case 'B3': return B.B3.unit === 'BF' ? B.B3.n + ' × ' + fx(B.B3.V_m3, 0) + ' m³' : B.B3.n + ' moduli · ' + fx(B.B3.dri / 1e6, 2) + ' Mt';
      case 'B4': return B.B4.n + ' × ' + B.B4.heat + ' t' + (B.B4.MVA ? ' · ' + B.B4.MVA + ' MVA' : '');
      case 'B5': return B.B5.lf + ' LF · ' + B.B5.degas + ' ' + B.B5.degas_type;
      case 'B6': return B.B6.formats.length > 1 ? B.B6.formats.map(function (f) { return (f.kind === 'Tondi' ? 'tondi ' : 'bramme ') + f.strands; }).join(' · ') + ' linee' : B.B6.formats.map(function (f) { return f.strands + ' linee ' + f.kind.toLowerCase(); }).join('');
      case 'B7': return I.config.product === 'A' ? B.B7.hsm + ' HSM' + (B.B7.plateMill ? ' + lamiere' : '') : B.B7.mills + ' laminatoi';
      case 'B8': return I.config.product === 'A' ? B.B8.tcm + ' PL-TCM · ' + B.B8.cgl + ' CGL' : [B.B8.erwLines ? B.B8.erwLines + ' ERW' : '', B.B8.sawlLines ? B.B8.sawlLines + ' UOE' : '', B.B8.sawhLines ? B.B8.sawhLines + ' SAWH' : ''].filter(Boolean).join(' · ');
      case 'B9': return fx(r.indicators.product_t / 1e6, 2) + ' Mt/anno';
      case 'B10': return fx(B.B10.demand_MW, 0) + ' MW medi · ' + B.B10.substation_MVA + ' MVA';
      case 'B11': return B.B11.asu + ' ASU · ' + fx(B.B11.o2_tpd, 0) + ' t/g O₂';
      case 'B12': return fx(B.B12.fume_Nm3h / 1e3, 0) + ' kNm³/h fumi';
    }
    return '';
  }
  function streamVal(s) {
    if (!s) return '–';
    if (isNum(s.t_h)) return fx(s.t_h, s.t_h >= 100 ? 0 : 1) + ' t/h';
    if (isNum(s.MW)) return fx(s.MW, 0) + ' MW';
    if (isNum(s.Nm3h)) return s.Nm3h >= 1e5 ? fx(s.Nm3h / 1e3, 0) + ' kNm³/h' : fx(s.Nm3h, 0) + ' Nm³/h';
    if (isNum(s.m3h)) return fx(s.m3h, 0) + ' m³/h';
    return '–';
  }
  function streamCond(s) { return s && isNum(s.T) ? fx(s.T, 0) + ' °C' : ''; }
  // geometria delle correnti: segmenti, posizione dell'etichetta
  function geometry(I, list) {
    var A = I.config.product === 'A', BF = I.config.route === 'BF-BOF', DRI = I.config.route === 'DRI-EAF', has = function (id) { return list.indexOf(id) >= 0; };
    var G = {}, y0 = 115;
    ['S01', 'S02', 'S03', 'S04', 'S05'].forEach(function (id) { if (has(id)) { G[id] = { segs: [[[12, y0], [220, y0]]], tag: [24, y0], label: { mode: 'left' } }; y0 += 30; } });
    G.S06 = { segs: [[[370, 175], [450, 175]]], tag: [410, 175], label: { mode: 'gap' } };
    G.S07 = BF ? { segs: [[[600, 175], [680, 175]]], tag: [640, 175], label: { mode: 'gap' } } : { segs: [[[370, 175], [680, 175]]], tag: [525, 175], label: { mode: 'gap' } };
    G.S08 = { segs: [[[830, 175], [910, 175]]], tag: [870, 175], label: { mode: 'gap' } };
    G.S09 = BF || DRI ? { segs: [[[330, 100], [330, 72], [985, 72], [985, 120]]], tag: [655, 72], label: { mode: 'above' } } : { segs: [[[370, 175], [910, 175]]], tag: [640, 175], label: { mode: 'gap' } };
    G.S10 = { segs: [[[1060, 175], [1140, 175]]], tag: [1100, 175], label: { mode: 'gap' } };
    G.S11 = { segs: [[[1290, 175], [1345, 175], [1345, 385], [1290, 385]]], tag: [1345, 280], label: { mode: 'right' } };
    G.S12 = { segs: [[[1140, 385], [1060, 385]]], tag: [1100, 385], label: { mode: 'gap' } };
    if (A) {
      G.S13 = { segs: [[[910, 385], [830, 385]]], tag: [870, 385], label: { mode: 'gap' } };
      G.S14 = { segs: [[[960, 440], [960, 478], [630, 478], [630, 420], [600, 420]]], tag: [795, 478], label: { mode: 'below' } };
    } else {
      G.S13 = { segs: [[[1215, 440], [1215, 498], [800, 498], [800, 440]]], tag: [1010, 498], label: { mode: 'below' } };
      G.S14 = has('S15') ? { segs: [[[985, 330], [985, 300], [525, 300], [525, 330]]], tag: [755, 300], label: { mode: 'above' } } : { segs: [[[910, 385], [600, 385]]], tag: [755, 385], label: { mode: 'gap' } };
      G.S17 = { segs: [[[710, 540], [710, 440]]], tag: [710, 510], label: { mode: 'right' }, end: { x: 710, y: 556, a: 'middle', t: 'acquistati' } };
    }
    G.S15 = { segs: [[[680, 385], [600, 385]]], tag: [640, 385], label: { mode: 'gap' } };
    G.S16 = { segs: [[[525, 440], [525, 500]]], tag: [525, 470], label: { mode: 'left2' }, end: { x: 525, y: 516, a: 'middle', t: 'spedizione' } };
    G.S18 = { segs: [[[720, 230], [720, 282], [400, 282], [400, 570]]], tag: [400, 420], label: { mode: 'left2' } };
    G.S26 = { segs: [[[790, 30], [790, 120]]], tag: [790, 100], label: { mode: 'right' }, end: { x: 800, y: 34, a: 'start', t: 'idrogeno' } };
    G.E1 = { segs: [[[30, 615], [190, 615]]], tag: [110, 615], label: { mode: 'gap' }, end: { x: 30, y: 640, a: 'start', t: 'rete AT' } };
    G.E3 = { segs: [[[300, 570], [300, 525]]], tag: [300, 548], label: { mode: 'right' }, end: { x: 300, y: 516, a: 'middle', t: 'alle aree' } };
    G.S19 = { segs: [[[660, 714], [660, 660]]], tag: [660, 690], label: { mode: 'right' } };
    G.S21 = { segs: [[[830, 714], [830, 660]]], tag: [830, 690], label: { mode: 'right' } };
    G.S20 = { segs: [[[750, 570], [750, 525]]], tag: [750, 548], label: { mode: 'right' }, end: { x: 750, y: 516, a: 'middle', t: 'alle aree' } };
    G.S22 = { segs: [[[1150, 520], [1150, 570]]], tag: [1150, 545], label: { mode: 'right' }, end: { x: 1150, y: 512, a: 'middle', t: 'dalle aree' } };
    G.S23 = { segs: [[[1300, 600], [1468, 600]]], tag: [1384, 600], label: { mode: 'above2' }, end: { x: 1468, y: 618, a: 'end', t: 'camino' } };
    G.S24 = { segs: [[[1300, 640], [1468, 640]]], tag: [1384, 640], label: { mode: 'below2' }, end: { x: 1468, y: 682, a: 'end', t: 'recupero e vendita' } };
    return G;
  }
  var diagram = { blocks: {}, streams: {} };
  function pathD(pts) { return pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0] + ' ' + p[1]; }).join(' '); }
  function arrow(pts) {
    var a = pts[pts.length - 2], b = pts[pts.length - 1], ux = Math.sign(b[0] - a[0]), uy = Math.sign(b[1] - a[1]), bk = [b[0] - ux * 10, b[1] - uy * 10];
    return sv('polygon', { 'class': 's-head', points: [b, [bk[0] - uy * 4.5, bk[1] + ux * 4.5], [bk[0] + uy * 4.5, bk[1] - ux * 4.5]].map(function (p) { return p.join(','); }).join(' ') });
  }
  function diamond(g, x, y, id) {
    g.appendChild(sv('rect', { 'class': 's-tag', x: x - 9, y: y - 9, width: 18, height: 18, transform: 'rotate(45 ' + x + ' ' + y + ')' }));
    g.appendChild(sv('text', { 'class': 's-num', x: x, y: y + 3.5 }, id.replace(/^S0?/, '')));
  }
  function drawDiagram() {
    var svg = clear($('pfd')); diagram = { blocks: {}, streams: {} };
    var r = res(), I = r ? r.inputs : st.user, list = r ? Object.keys(r.streams) : [];
    var blocks = E.blocksFor(I);
    $('pfd-sub').textContent = describe(I) + (r ? '' : ' · nessun risultato valido');
    // zone
    [[200, 50, 1260, 215, 'Ferro e acciaio liquido', 0], [430, 285, 1030, 240, I.config.product === 'A' ? 'Colata e linea A – laminati piani' : 'Colata e linea B – tubi', 0], [170, 552, 1150, 128, 'Utilities, energia e ambiente', 1]].forEach(function (z) {
      svg.appendChild(sv('rect', { 'class': 'zone', x: z[0], y: z[1], width: z[2], height: z[3], rx: 4 }));
      svg.appendChild(sv('text', { 'class': 'bl', x: z[5] ? z[0] + z[2] - 8 : z[0] + 8, y: z[5] ? z[1] + z[3] - 6 : z[1] + 14, 'text-anchor': z[5] ? 'end' : 'start' }, z[4].toUpperCase()));
    });
    var G = geometry(I, list);
    list.forEach(function (id) { if (G[id]) drawStream(svg, id, G[id], r.streams[id]); });
    blocks.forEach(function (b) { drawBlock(svg, b, r, I); });
    // correnti elencate sul blocco
    if (r && r.streams.S25) drawChip(svg, 'S25', [350, 236], r.streams.S25, 'B1');
    if (r && r.streams.E2) drawChip(svg, 'E2', [470, 645], r.streams.E2, 'B10');
    svg.setAttribute('aria-label', 'Schema a blocchi: ' + blocks.map(function (b) { return b + ' ' + blockName(b, I); }).join(', '));
    highlight();
  }
  function describe(I) {
    var R = { 'BF-BOF': 'rotta BF-BOF', 'DRI-EAF': 'rotta DRI-EAF', EAF: 'forno elettrico a rottame' }[I.config.route];
    return 'Configurazione ' + I.config.product + (I.config.product === 'A' ? ', laminati piani' : ', tubi') + ', ' + R + ', ' + fx(I.config.capacity_Mt, 2) + ' Mt/anno di acciaio liquido' + (I.config.product === 'A' && I.config.caster === 'thin' ? ', thin slab' : '');
  }
  function drawStream(svg, id, g0, s) {
    var val = streamVal(s), cond = streamCond(s), nm = id === 'S01' && route() === 'DRI-EAF' ? 'Pellet DR' : (DIAG[id] || s.name);
    var g = sv('g', { 'class': 'stream ph-' + s.cls, tabindex: '0', role: 'button', 'data-id': id, 'aria-label': 'Corrente ' + id + ', ' + s.name + ', ' + val + (cond ? ', ' + cond : '') });
    g.appendChild(sv('title', {}, id + ' ' + s.name + ': ' + val + (cond ? ', ' + cond : '')));
    g0.segs.forEach(function (pts) { g.appendChild(sv('path', { 'class': 's-hit', d: pathD(pts) })); g.appendChild(sv('path', { 'class': 's-line', d: pathD(pts) })); g.appendChild(arrow(pts)); });
    var tx = g0.tag[0], ty = g0.tag[1], m = g0.label.mode;
    diamond(g, tx, ty, id);
    if (m === 'left') { g.appendChild(sv('text', { 'class': 's-name', x: 38, y: ty - 6 }, nm)); g.appendChild(sv('text', { 'class': 's-val', x: 214, y: ty - 6, 'text-anchor': 'end' }, val)); }
    else if (m === 'gap') { g.appendChild(sv('text', { 'class': 's-val', x: tx, y: ty - 15, 'text-anchor': 'middle' }, val)); if (cond) g.appendChild(sv('text', { 'class': 's-cond', x: tx, y: ty + 24, 'text-anchor': 'middle' }, cond)); }
    else if (m === 'above') { g.appendChild(sv('text', { 'class': 's-name', x: tx - 16, y: ty - 6, 'text-anchor': 'end' }, nm)); g.appendChild(sv('text', { 'class': 's-val', x: tx + 16, y: ty - 6 }, val)); }
    else if (m === 'below') { g.appendChild(sv('text', { 'class': 's-name', x: tx - 16, y: ty + 18, 'text-anchor': 'end' }, nm)); g.appendChild(sv('text', { 'class': 's-val', x: tx + 16, y: ty + 18 }, val)); }
    else if (m === 'right') { g.appendChild(sv('text', { 'class': 's-name', x: tx + 15, y: ty - 3 }, nm)); g.appendChild(sv('text', { 'class': 's-val', x: tx + 15, y: ty + 12 }, val + (cond ? '  ' + cond : ''))); }
    else if (m === 'left2') { g.appendChild(sv('text', { 'class': 's-name', x: tx - 15, y: ty - 3, 'text-anchor': 'end' }, nm)); g.appendChild(sv('text', { 'class': 's-val', x: tx - 15, y: ty + 12, 'text-anchor': 'end' }, val)); }
    else if (m === 'above2') { g.appendChild(sv('text', { 'class': 's-val', x: tx, y: ty - 15, 'text-anchor': 'middle' }, val)); }
    else if (m === 'below2') { g.appendChild(sv('text', { 'class': 's-val', x: tx, y: ty + 24, 'text-anchor': 'middle' }, val)); }
    if (g0.end) g.appendChild(sv('text', { 'class': 's-end', x: g0.end.x, y: g0.end.y, 'text-anchor': g0.end.a }, g0.end.t));
    activate(g, function () { select('stream', id); });
    svg.appendChild(g); diagram.streams[id] = g;
  }
  function drawChip(svg, id, at, s, b) {
    var g = sv('g', { 'class': 'chip ph-' + s.cls, tabindex: '0', role: 'button', 'data-id': id, 'aria-label': 'Corrente ' + id + ', ' + s.name + ', ' + streamVal(s) + ', dentro il blocco ' + b });
    g.appendChild(sv('title', {}, id + ' ' + s.name + ': ' + streamVal(s)));
    diamond(g, at[0], at[1], id);
    activate(g, function () { select('stream', id); });
    svg.appendChild(g); diagram.streams[id] = g;
  }
  function drawBlock(svg, b, r, I) {
    var p = BX[b], name = blockName(b, I), g = sv('g', { 'class': 'block' + (+b.slice(1) >= 10 ? ' aux' : ''), tabindex: '0', role: 'button', 'data-id': b, 'aria-label': 'Blocco ' + b + ', ' + name });
    g.appendChild(sv('title', {}, b + ' ' + name));
    g.appendChild(sv('rect', { 'class': 'blk-rect', x: p[0], y: p[1], width: p[2], height: p[3], rx: 2 }));
    g.appendChild(sv('text', { 'class': 'blk-tag', x: p[0] + 7, y: p[1] + 15 }, b));
    var cx = p[0] + p[2] / 2, cy = p[1] + p[3] / 2, words = name.split(' '), lines = [name];
    if (name.length > 18 && p[2] < 200) { var h = Math.ceil(words.length / 2); lines = [words.slice(0, h).join(' '), words.slice(h).join(' ')]; }
    var yy = cy - (lines.length - 1) * 9;
    lines.forEach(function (ln, i) { g.appendChild(sv('text', { 'class': 'blk-name', x: cx, y: yy + i * 18 }, ln)); });
    g.appendChild(sv('text', { 'class': 'blk-sub', x: cx, y: yy + lines.length * 18 }, blockSub(b, r, I)));
    if (r && r.blockWarnings[b]) { var w = sv('text', { 'class': 'blk-note', x: p[0] + p[2] - 6, y: p[1] + 15 }, '⚠ ' + r.blockWarnings[b].length); w.appendChild(sv('title', {}, r.blockWarnings[b].join('; '))); g.appendChild(w); }
    activate(g, function () { select('block', b); });
    svg.appendChild(g); diagram.blocks[b] = g;
  }
  function highlight() {
    Object.keys(diagram.blocks).forEach(function (k) { var on = st.sel.type === 'block' && st.sel.id === k; diagram.blocks[k].classList.toggle('sel', on); diagram.blocks[k].setAttribute('aria-pressed', on ? 'true' : 'false'); });
    Object.keys(diagram.streams).forEach(function (k) { var on = st.sel.type === 'stream' && st.sel.id === k; diagram.streams[k].classList.toggle('sel', on); diagram.streams[k].setAttribute('aria-pressed', on ? 'true' : 'false'); });
    document.querySelectorAll('[data-b]').forEach(function (n) { n.classList.toggle('sel', st.sel.type === 'block' && st.sel.id === n.getAttribute('data-b')); });
    document.querySelectorAll('#streamtable tbody tr').forEach(function (tr) { tr.classList.toggle('selrow', st.sel.type === 'stream' && st.sel.id === tr.getAttribute('data-id')); });
  }
  function select(type, id, focus) {
    st.sel = st.sel.type === type && st.sel.id === id ? { type: 'case', id: null } : { type: type, id: id };
    highlight(); renderInspector();
    if (focus) { var h = $('insp-h'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); } }
  }

  // ================================================================ input
  function sectionOf(b) { return D.sections.filter(function (s) { return s.block === b; })[0]; }
  function paramsOf(sid) { return D.params.filter(function (p) { return p.path.split('.')[0] === sid && (!p.only || p.only === product()) && (!p.routes || p.routes.indexOf(route()) >= 0); }); }
  function control(p, scope) {
    var id = 'in-' + scope + '-' + p.path.replace(/\./g, '-'), v = E.getPath(st.user, p.path), ctl;
    if (p.options) {
      ctl = el('select', { id: id });
      p.options.forEach(function (o) { var op = el('option', { value: String(o), text: p.names ? p.names[String(o)] : String(o) }); if (o === v) op.selected = true; ctl.appendChild(op); });
      ctl.addEventListener('change', function () { var raw = ctl.value, o = p.options.filter(function (x) { return String(x) === raw; })[0]; setValue(p, o, ctl); });
    } else {
      ctl = el('input', { id: id, type: 'number', step: 'any', value: String(v), inputmode: 'decimal' });
      if (isNum(p.min)) ctl.setAttribute('min', p.min); if (isNum(p.max)) ctl.setAttribute('max', p.max);
      ctl.addEventListener('change', function () { var x = ctl.value.trim() === '' ? NaN : Number(ctl.value.replace(',', '.')); setValue(p, x, ctl); });
    }
    (fieldReg[p.path] = fieldReg[p.path] || []).push(ctl);
    markField(p, ctl);
    return ctl;
  }
  function markField(p, ctl) {
    var v = E.getPath(st.user, p.path), base = st.calc ? E.getPath(st.calc.user, p.path) : v;
    ctl.classList.toggle('chg', JSON.stringify(v) !== JSON.stringify(base));
    ctl.classList.toggle('bad', !!E.checkValue(p, v));
    ctl.title = E.checkValue(p, v) || '';
  }
  function setValue(p, v, from) {
    if (p.path === 'config.product' || p.path === 'config.route') return setConfig(p.path, v);
    E.setPath(st.user, p.path, v);
    (fieldReg[p.path] || []).forEach(function (c) { if (!c.isConnected) return; if (c !== from) c.value = String(v); markField(p, c); });
    renderStale(); $('tb-case').textContent = st.caseId + (changedPaths().length ? ' (modificato)' : '');
  }
  // cambio di configurazione o rotta: si applicano i valori tipici della nuova scelta, il resto resta
  function setConfig(path, v) {
    E.setPath(st.user, path, v);
    var pp = D.presets[path === 'config.product' ? 'product' : 'route'][v] || {};
    Object.keys(pp).forEach(function (k) { E.setPath(st.user, k, clone(pp[k])); });
    if (path === 'config.product' && v === 'B' && st.user.config.route === 'BF-BOF') { st.user.config.route = 'EAF'; Object.keys(D.presets.route.EAF).forEach(function (k) { E.setPath(st.user, k, clone(D.presets.route.EAF[k])); }); }
    renderAll();
  }
  function sectionForm(sid, scope) {
    var f = el('div', { cls: 'form' });
    paramsOf(sid).forEach(function (p) {
      var ctl = control(p, scope);
      var defNow = E.getPath(E.defaultInputs(product(), route()), p.path);
      var lab = el('label', { 'for': ctl.id }, [p.label, el('span', { cls: 'mk ' + p.marker, text: p.marker, title: p.marker === 'F' ? 'Dalla descrizione funzionale ' + p.source : p.marker === 'R' ? 'Regola pratica di settore' : 'Ipotesi per gli esempi' }),
        el('span', { cls: 'rng', text: p.path + (p.options ? '' : ' · ' + (isNum(p.min) ? fx(p.min, p.min % 1 ? 3 : 0) : '') + '–' + (isNum(p.max) ? fx(p.max, p.max % 1 ? 3 : 0) : '')) + ' · default ' + (p.options ? (p.names ? p.names[String(defNow)] : defNow) : sig(defNow)) + (p.source ? ' · ' + p.source : '') })]);
      if (p.note) lab.title = p.note;
      f.appendChild(lab);
      f.appendChild(el('span', { cls: 'ctl' }, [ctl, p.unit ? el('span', { cls: 'unit', text: p.unit }) : null]));
    });
    return f;
  }
  function renderInputs() {
    Object.keys(fieldReg).forEach(function (k) { fieldReg[k] = fieldReg[k].filter(function (c) { return c.id.indexOf('in-inp-') !== 0 && c.isConnected; }); });
    var box = clear($('inputs')), bl = E.blocksFor(st.user);
    D.sections.forEach(function (s) {
      var ps = paramsOf(s.id); if (!ps.length) return;
      var un = s.block && !used(bl, s.block);
      var d = el('details', { cls: 'grp' + (un ? ' unused' : '') }, [el('summary', null, [(s.block ? s.block + ' ' : '') + s.name + ' ', el('span', { cls: 'muted', text: '(' + ps.length + ' input' + (s.df ? ', ' + s.df : '') + (un ? ', non usato in questa configurazione' : '') + ')' })])]);
      if (st.open['inp|' + s.id]) d.open = true;
      d.addEventListener('toggle', function () { st.open['inp|' + s.id] = d.open; if (d.open && !d.querySelector('.form')) d.appendChild(sectionForm(s.id, 'inp')); });
      if (d.open) d.appendChild(sectionForm(s.id, 'inp'));
      box.appendChild(d);
    });
  }

  // ================================================================ ispettore
  function head(box, title, sub) { box.appendChild(el('div', { cls: 'head' }, [el('h2', { id: 'insp-h', text: title }), sub ? el('span', { cls: 'muted', text: sub }) : null])); }
  function renderInspector() {
    Object.keys(fieldReg).forEach(function (k) { fieldReg[k] = fieldReg[k].filter(function (c) { return c.id.indexOf('in-insp-') !== 0 && c.isConnected; }); });
    var box = clear($('inspector')), r = res();
    if (st.sel.type === 'stream') return inspectStream(box, st.sel.id, r);
    if (st.sel.type === 'block') return inspectBlock(box, st.sel.id, r);
    inspectCase(box, r);
  }
  function inspectCase(box, r) {
    var cs = D.cases.cases[st.caseId];
    head(box, 'Caso ' + st.caseId, 'seleziona un blocco o una corrente nello schema');
    if (cs) box.appendChild(el('p', { cls: 'note', text: cs.title + '. ' + cs.notes }));
    ['config', 'site'].forEach(function (sid, i) {
      var s = D.sections.filter(function (q) { return q.id === sid; })[0], d = el('details', { cls: 'grp' }, [el('summary', { text: s.name })]);
      if (i === 0 || st.open['insp|' + sid]) d.open = true;
      d.addEventListener('toggle', function () { st.open['insp|' + sid] = d.open; });
      d.appendChild(sectionForm(sid, 'insp')); box.appendChild(d);
    });
    if (!r) return;
    var en = r.energy, LS = r.indicators.LS_t;
    box.appendChild(el('p', { cls: 'sect', text: 'Energia primaria in ingresso' }));
    var rows = [['Carbone (PCI 29 GJ/t)', en.coal_GJ], ['Gas naturale', en.ng_GJ], ['Idrogeno', en.h2_GJ], ['Energia elettrica dalla rete', en.grid_GJ], ['Elettrodi e carbone di carica', en.electrodes_GJ]].filter(function (x) { return x[1] > 0; })
      .map(function (x) { return [x[0], fx(x[1] / LS, 2), fx(x[1] / en.total_GJ * 100, 1)]; });
    var t = ['Totale', fx(en.total_GJ / LS, 2), '100,0']; t._cls = 'total'; rows.push(t);
    box.appendChild(table(['Vettore', 'GJ/t acciaio', '% del totale'], rows, { num: [1, 2] }));
    box.appendChild(el('p', { cls: 'note', text: 'Energia elettrica dalla rete contata come energia finale (3,6 GJ/MWh). Il gas di recupero è interno: non è un ingresso.' }));
  }
  function blockResults(r, b) {
    var B = r.blocks, I = r.inputs, H = I.config.hours, k = r.indicators, x = [];
    function add(a, v) { x.push([a, v]); }
    if (b === 'B1') { B.B1.stocks.forEach(function (s) { add('Scorta di ' + s.name.toLowerCase(), fx(s.stock_t / 1e3, 0) + ' kt (' + fx(s.t_y / 1e6, 2) + ' Mt/anno)'); }); add('Superficie del parco', fx(B.B1.yard_m2 / 1e4, 1) + ' ha'); add('Rottame interno di ritorno', fx(B.B1.internalScrap / H, 1) + ' t/h'); add('Rottame acquistato', fx(B.B1.scrapBuy / H, 1) + ' t/h'); }
    if (b === 'B2' && B.B2) { add('Coke prodotto', fx(B.B2.coke_t / 1e6, 2) + ' Mt/anno'); add('Carbone da coke', fx(B.B2.coal_t / 1e6, 2) + ' Mt/anno'); add('Batterie di forni a coke', B.B2.batteries); add('Agglomerato', fx(B.B2.sinter_t / 1e6, 2) + ' Mt/anno'); add('Superficie di griglia', fx(B.B2.strand_m2, 0) + ' m² su ' + B.B2.strands + ' nastri'); add('Gas di cokeria', fx(B.B2.cog_GJ / H / 3.6, 0) + ' MW'); }
    if (b === 'B3' && B.B3.unit === 'BF') { add('Ghisa liquida', fx(B.B3.hm / 1e6, 2) + ' Mt/anno, ' + fx(B.B3.hm_tpd, 0) + ' t/giorno'); add('Altoforni', B.B3.n + ' × ' + fx(B.B3.V_m3, 0) + ' m³'); add('Gas d\'altoforno', fx(B.B10.bfg_GJ / H / 3.6, 0) + ' MW'); add('Coke e PCI', I.b3.coke_rate + ' + ' + I.b3.pci + ' kg/t ghisa'); add('TRT', fx(B.B10.trt_MW, 1) + ' MW'); }
    if (b === 'B3' && B.B3.unit === 'DRI') { add('DRI prodotto', fx(B.B3.dri / 1e6, 2) + ' Mt/anno'); add('Moduli', B.B3.n); add('Gas naturale al DRI', fx(((r.ng.filter(function (g) { return g.block === 'B3'; })[0] || {}).MW || 0), 0) + ' MW'); if (B.B3.h2_t > 0) add('Idrogeno', fx(B.B3.h2_t * 1000 / H, 0) + ' kg/h'); if (B.B3.electrolyser_MW > 0) add('Elettrolizzatori', fx(B.B3.electrolyser_MW, 0) + ' MW'); }
    if (b === 'B4') { var b4 = B.B4; add('Unità', b4.n + ' ' + b4.unit + ' da ' + b4.heat + ' t'); add('Colate al giorno', fx(b4.heats_day, 1)); add('Utilizzo', fx(b4.util * 100, 0) + ' %'); add('Energia elettrica', fx(b4.kWh_t, 0) + ' kWh/t spillata'); if (b4.MVA) { add('Potenza sotto arco', fx(b4.P_on_MW, 0) + ' MW per forno'); add('Trasformatore del forno', b4.MVA + ' MVA'); add('SVC/STATCOM', b4.svc_Mvar + ' Mvar'); }
      add('Carica metallica', fx(k.charge_t_t, 3) + ' t/t acciaio liquido'); if (k.metallic.hm) add('Ghisa liquida', fx(k.metallic.hm / H, 0) + ' t/h'); if (k.metallic.dri) add('DRI', fx(k.metallic.dri / H, 0) + ' t/h'); if (k.metallic.hbi) add('HBI', fx(k.metallic.hbi / H, 0) + ' t/h'); add('Rottame alla carica', fx(k.metallic.scrap / H, 0) + ' t/h'); }
    if (b === 'B5') { add('Forni siviera', B.B5.lf); add('Degasaggio ' + B.B5.degas_type, B.B5.degas); add('Ferroleghe', fx(B.B5.alloys / H, 1) + ' t/h'); }
    if (b === 'B6') B.B6.formats.forEach(function (f) { add(f.kind, f.section + ', ' + fx(f.speed, 1) + ' m/min'); add(f.kind + ': linee e macchine', f.strands + ' linee su ' + f.machines + ' macchine'); add(f.kind + ': portata per linea', fx(f.tph_strand, 0) + ' t/h, utilizzo ' + fx(f.util * 100, 0) + ' %'); });
    if (b === 'B7' && I.config.product === 'A') { add('Bramme al treno nastri', fx(B.B7.toHSM / 1e6, 2) + ' Mt/anno'); add('Bramme al treno lamiere', fx(B.B7.toPlate / 1e6, 2) + ' Mt/anno'); add('Coil a caldo', fx(B.B7.hrc / 1e6, 2) + ' Mt/anno'); add('Lamiere grosse', fx(B.B7.plates / 1e6, 2) + ' Mt/anno'); add('Forni di riscaldo', B.B7.furnaces); add('Scaglia', fx(B.B7.scale / H, 1) + ' t/h'); }
    if (b === 'B7' && I.config.product === 'B') { add('Tondi al laminatoio', fx(B.B7.rounds / 1e6, 2) + ' Mt/anno'); add('Tubi grezzi', fx(B.B7.shells / 1e6, 2) + ' Mt/anno'); add('Laminatoi', B.B7.mills); }
    if (b === 'B8' && I.config.product === 'A') { add('Coil al decapaggio', fx(B.B8.toCold / 1e6, 2) + ' Mt/anno'); add('Nastro a freddo', fx(B.B8.coldOut / 1e6, 2) + ' Mt/anno'); add('Zincati e preverniciati', fx(B.B8.coated / 1e6, 2) + ' Mt/anno'); add('Linee', B.B8.tcm + ' PL-TCM, ' + B.B8.anneal + ' ' + I.b8.anneal + ', ' + B.B8.cgl + ' CGL'); }
    if (b === 'B8' && I.config.product === 'B') { add('Coil interno', fx(B.B8.coilInt / 1e6, 2) + ' Mt/anno'); add('Coil acquistato', fx(B.B8.coilBuy / 1e6, 2) + ' Mt/anno'); add('ERW', fx(B.B8.erw / 1e3, 0) + ' kt/anno su ' + B.B8.erwLines + ' linee'); add('SAW longitudinale', fx(B.B8.sawl / 1e3, 0) + ' kt/anno su ' + B.B8.sawlLines + ' linee'); add('SAW elicoidale', fx(B.B8.sawh / 1e3, 0) + ' kt/anno su ' + B.B8.sawhLines + ' linee'); }
    if (b === 'B9') { r.products.forEach(function (p) { add(p.name, fx(p.t / 1e6, 3) + ' Mt/anno'); }); if (B.B9.qt) add('Q&T', fx(B.B9.qt / 1e3, 0) + ' kt/anno su ' + B.B9.qtLines + ' linee'); }
    if (b === 'B10') { var t = B.B10; add('Domanda media', fx(t.demand_MW, 1) + ' MW'); add('Punta stimata', fx(t.peak_MW, 0) + ' MW'); add('Sottostazione', t.substation_MVA + ' MVA, ' + t.kV); add('Autoproduzione', fx(t.ownGen_MW, 1) + ' MW (centrale ' + fx(t.pp_MW, 1) + ', TRT ' + fx(t.trt_MW, 1) + ', CDQ ' + fx(t.cdq_MW, 1) + ')'); add(t.grid_MW >= 0 ? 'Prelievo dalla rete' : 'Cessione alla rete', fx(Math.abs(t.grid_MW), 1) + ' MW'); if (t.recGJ) add('Gas di recupero alla centrale', fx(t.recGJ / H / 3.6, 0) + ' MW'); }
    if (b === 'B11') { var u = B.B11; add('Ossigeno', fx(u.o2_Nm3h, 0) + ' Nm³/h medi, ' + fx(u.o2_tpd, 0) + ' t/giorno di progetto'); add('ASU', u.asu); add('Azoto, argon', fx(u.n2_Nm3h, 0) + ', ' + fx(u.ar_Nm3h, 0) + ' Nm³/h'); add('Acqua ricircolata', fx(u.circ_m3h, 0) + ' m³/h'); add('Reintegro', fx(u.makeup_m3h, 0) + ' m³/h'); add('Gas naturale', fx(u.ng_Sm3h, 0) + ' Sm³/h (' + fx(u.ng_MW, 0) + ' MW)'); add('Calce', fx(u.lime_tpd, 0) + ' t/giorno, ' + u.kilns + ' forni'); }
    if (b === 'B12') { add('Fumi captati', fx(B.B12.fume_Nm3h / 1e3, 0) + ' kNm³/h'); add('Polveri al camino', fx(B.B12.stack_dust_t_y, 0) + ' t/anno'); r.byproducts.forEach(function (p) { add(p.name, fx(p.kg_t, 0) + ' kg/t, ' + fx(p.t / 1e3, 0) + ' kt/anno'); }); }
    return x;
  }
  function inspectBlock(box, b, r) {
    var s = sectionOf(b), I = r ? r.inputs : st.user;
    head(box, b + ' ' + blockName(b, I), s ? s.df : '');
    if (!used(E.blocksFor(st.user), b)) box.appendChild(el('p', { cls: 'note', text: 'Questo blocco non fa parte della configurazione corrente.' }));
    if (s && paramsOf(s.id).length) { var d = el('details', { cls: 'grp', open: true }, [el('summary', { text: 'Input di ' + b })]); d.appendChild(sectionForm(s.id, 'insp')); box.appendChild(d); }
    if (!r) { box.appendChild(el('p', { cls: 'note', text: 'Nessun risultato valido: l\'ultimo calcolo è stato rifiutato.' })); return; }
    var W = r.blockWarnings[b];
    if (W) { var ul = el('ul'); W.forEach(function (w) { ul.appendChild(el('li', { text: w })); }); box.appendChild(el('div', { cls: 'dv-old' }, [el('strong', { text: 'Avvisi di ' + b }), ul])); }
    var rows = blockResults(r, b);
    if (rows.length) { box.appendChild(el('p', { cls: 'sect', text: 'Risultati di ' + b })); box.appendChild(kv(rows.map(function (x) { return [x[0], String(x[1])]; }))); }
    var L = r.ledgers[b];
    if (L) box.appendChild(el('p', { cls: 'note', text: 'Bilancio di massa di ' + b + ': ingressi ' + fx(L.t_in / I.config.hours, 1) + ' t/h, uscite ' + fx(L.t_out / I.config.hours, 1) + ' t/h' + (L.resLabel ? ', ' + L.resLabel.toLowerCase() + ' ' + fx(L.residual / I.config.hours, 1) + ' t/h' : '') + '. Dettaglio in Bilanci di massa.' }));
    var ids = Object.keys(r.streams).filter(function (id) { var q = r.streams[id]; return q.from === b || q.to === b || (q.from && q.from.indexOf('–') > 0 && b >= 'B6' && b <= 'B9'); }).sort(Dc.sortId);
    if (ids.length) { var lk = el('div', { cls: 'links' }); ids.forEach(function (id) { lk.appendChild(el('button', { type: 'button', text: id, title: r.streams[id].name, 'aria-label': 'Corrente ' + id + ', ' + r.streams[id].name, onclick: function () { select('stream', id, true); } })); }); box.appendChild(el('div', null, [el('p', { cls: 'sect', text: 'Correnti' }), lk])); }
  }
  function inspectStream(box, id, r) {
    var s = r ? r.streams[id] : null;
    head(box, 'Corrente ' + id, s ? s.name : '');
    if (!s) { box.appendChild(el('p', { cls: 'note', text: r ? 'Questa corrente non fa parte dei risultati dell\'ultimo calcolo.' : 'Nessun risultato valido.' })); return; }
    var H = r.inputs.config.hours, rows = [['Descrizione', s.name], ['Da', s.from || 'limite di batteria'], ['A', s.to || 'limite di batteria']];
    if (isNum(s.t_h)) { rows.push(['Portata', fx(s.t_h, 2) + ' t/h']); rows.push(['Su base annua', fx(s.t_h * H / 1e6, 3) + ' Mt/anno']); rows.push(['Per tonnellata di acciaio liquido', fx(s.t_h * H / r.indicators.LS_t, 3) + ' t/t']); }
    if (isNum(s.T)) rows.push(['Temperatura', fx(s.T, 0) + ' °C']);
    if (isNum(s.MW)) rows.push(['Potenza', fx(s.MW, 1) + ' MW']);
    if (isNum(s.Nm3h)) rows.push(['Portata volumetrica', fx(s.Nm3h, 0) + ' Nm³/h']);
    if (isNum(s.Sm3h)) rows.push(['Portata di gas', fx(s.Sm3h, 0) + ' Sm³/h']);
    if (isNum(s.m3h)) rows.push(['Portata d\'acqua', fx(s.m3h, 0) + ' m³/h']);
    if (s.note) rows.push(['Nota', s.note]);
    box.appendChild(kv(rows));
    var lk = el('div', { cls: 'links' });
    [s.from, s.to].filter(function (b) { return b && BX[b]; }).forEach(function (b) { lk.appendChild(el('button', { type: 'button', text: b, 'aria-label': 'Blocco ' + b, onclick: function () { select('block', b, true); } })); });
    if (lk.firstChild) box.appendChild(el('div', null, [el('p', { cls: 'sect', text: 'Blocchi' }), lk]));
  }

  // ================================================================ pannelli dei risultati
  function noRes(box) { box.appendChild(el('p', { cls: 'note', text: st.calc && !st.calc.ok ? 'Nessun risultato valido: l\'ultimo calcolo è stato rifiutato.' : 'Nessun risultato.' })); }
  function renderBalances() {
    var sel = $('bal-sel'), box = clear($('bal-body')), r = res();
    if (!r) { clear(sel); noRes(box); return; }
    var H = r.inputs.config.hours, keys = Object.keys(r.ledgers).filter(function (k) { return k !== 'Fe'; }).sort(function (a, b) { return +a.slice(1) - +b.slice(1); });
    var opts = [['Fe', 'Ferro di stabilimento']].concat(keys.map(function (k) { return [k, k + ' ' + blockName(k, r.inputs)]; }));
    if (!opts.some(function (o) { return o[0] === st.ledger; })) st.ledger = 'Fe';
    clear(sel); opts.forEach(function (o) { sel.appendChild(el('option', { value: o[0], text: o[1] })); }); sel.value = st.ledger;
    var L = r.ledgers[st.ledger], rows = L.items.map(function (it) { return [it.side === 'in' ? 'ingresso' : 'uscita', it.item, fx(it.t / H, 2), fx(it.t / 1e3, 0)]; });
    var t1 = ['', 'Totale ingressi', fx(L.t_in / H, 2), fx(L.t_in / 1e3, 0)], t2 = ['', 'Totale uscite', fx(L.t_out / H, 2), fx(L.t_out / 1e3, 0)];
    var t3 = ['', (st.ledger === 'Fe' ? 'Ferro non attribuito (fumi, ossidazione, perdite)' : (L.resLabel || 'Differenza')), fx(L.residual / H, 2), fx(L.residual / 1e3, 0) + ' (' + fx(L.residual / L.t_in * 100, 2) + ' %)'];
    t1._cls = t2._cls = t3._cls = 'total';
    box.appendChild(table(['Lato', 'Voce', 't/h', 'kt/anno'], rows.concat([t1, t2, t3]), { num: [2, 3], wrap: [1] }));
    box.appendChild(el('p', { cls: 'note', text: st.ledger === 'Fe' ? 'Bilancio del ferro ai limiti di stabilimento con i tenori dei materiali (input B1 e costanti del modello). Il rottame interno circola dentro lo stabilimento e non compare. Una differenza oltre il 5 % o negativa genera un avviso.' : 'Masse dei solidi e del metallo. La differenza raccoglie ciò che il modello non traccia come massa: gas, ossigeno fissato o rimosso, umidità. Non è un errore di chiusura.' }));
  }
  function renderEmissions() {
    var box = clear($('em-body')), r = res(); if (!r) { noRes(box); return; }
    var c = r.co2, k = r.indicators, LS = k.LS_t;
    box.appendChild(kv([['CO₂ diretta (scope 1)', fx(c.direct_t / 1e6, 3) + ' Mt/anno · ' + fx(k.co2_direct_t_t, 3) + ' t/t acciaio liquido'], ['CO₂ indiretta dalla rete (scope 2)', fx(c.indirect_t / 1e6, 3) + ' Mt/anno · ' + fx(c.indirect_t / LS, 3) + ' t/t (' + fx(r.inputs.site.grid_CO2, 2) + ' kg/kWh)'],
      ['Totale', fx(k.co2_total_t_t, 3) + ' t/t acciaio liquido · ' + fx(k.co2_per_product, 3) + ' t/t prodotto'], ['Polveri al camino', fx(r.blocks.B12.stack_dust_t_y, 0) + ' t/anno']]));
    var max = 0; Object.keys(c.byArea).forEach(function (a) { max = Math.max(max, Math.abs(c.byArea[a])); });
    var rows = Object.keys(c.byArea).map(function (a) { var v = c.byArea[a], bar = el('div', { cls: 'bar' + (v < 0 ? ' neg' : '') }, [el('span', { style: 'width:' + (Math.abs(v) / max * 100).toFixed(1) + '%' })]); return [a, fx(v / LS, 3), fx(v / 1e3, 0), bar]; });
    box.appendChild(el('p', { cls: 'sect', text: 'CO₂ diretta per area' }));
    box.appendChild(table(['Area', 't/t', 'kt/anno', ''], rows, { num: [1, 2], wrap: [0] }));
    var d = el('details', { cls: 'grp' }, [el('summary', { text: 'Per sorgente di carbonio (' + c.sources.length + ' voci)' })]);
    d.appendChild(el('div', { cls: 'pad' }, [table(['Sorgente', 't CO₂/t', 'kt/anno'], c.sources.map(function (s) { return [s.name, fx(s.t / LS, 3), fx(s.t / 1e3, 0)]; }), { num: [1, 2], wrap: [0] })]));
    box.appendChild(d);
    box.appendChild(el('p', { cls: 'note', text: 'Bilancio del carbonio ai limiti di stabilimento: carbonio entrante meno carbonio nei prodotti e nei sottoprodotti della cokeria. Il gas di recupero bruciato nella centrale è già nel carbone. Utile per ETS e CBAM in prima stima (DF §10.1).' }));
  }
  function renderDF() {
    var box = clear($('df-body')), r = res(); if (!r) { noRes(box); return; }
    box.appendChild(table(['Indicatore', 'Calcolato', 'DF', 'Unità', 'Esito'], r.checks.map(function (c) { return [c.name, fx(c.value, c.d), c.range ? fx(c.range[0], c.d) + '–' + fx(c.range[1], c.d) : '–', c.unit, pill(c.ok)]; }), { num: [1, 2], wrap: [0] }));
    box.appendChild(el('p', { cls: 'note', text: 'Campi della descrizione funzionale (§1 e §12.1), ordini di grandezza di letteratura. Per le rotte a forno elettrico le emissioni calcolate cadono nel campo della DF solo sommando la CO₂ indiretta della rete: il campo della DF sembra comprendere l\'energia elettrica.' }));
  }
  function renderAux() {
    var box = clear($('aux-body')), r = res(); if (!r) { noRes(box); return; }
    var LS = r.indicators.LS_t, H = r.inputs.config.hours, tot = r.loads.reduce(function (s, l) { return s + l.MWh; }, 0);
    var rows = r.loads.map(function (l) { return [l.block + ' ' + l.item, fx(l.MW, 1), fx(l.kWh_t, 0)]; });
    var t = ['Totale utenze', fx(tot / H, 1), fx(tot * 1000 / LS, 0)]; t._cls = 'total'; rows.push(t);
    box.appendChild(el('p', { cls: 'sect', text: 'Energia elettrica' }));
    box.appendChild(table(['Area', 'MW medi', 'kWh/t'], rows, { num: [1, 2] }));
    var B10 = r.blocks.B10;
    box.appendChild(kv([['Perdite e domanda totale', fx(B10.demand_MW, 1) + ' MW'], ['Autoproduzione', fx(B10.ownGen_MW, 1) + ' MW'], [B10.grid_MW >= 0 ? 'Prelievo dalla rete' : 'Cessione alla rete', fx(Math.abs(B10.grid_MW), 1) + ' MW']]));
    if (r.ng.length) {
      box.appendChild(el('p', { cls: 'sect', text: 'Gas naturale' }));
      var g = r.ng.map(function (x) { return [x.block + ' ' + x.item, fx(x.Sm3h, 0), fx(x.MW, 1), fx(x.GJ_t, 2)]; }), gt = ['Totale', fx(r.blocks.B11.ng_Sm3h, 0), fx(r.indicators.ng_MW, 1), fx(r.indicators.ng_GJ_t, 2)]; gt._cls = 'total'; g.push(gt);
      box.appendChild(table(['Utenza', 'Sm³/h', 'MW PCI', 'GJ/t'], g, { num: [1, 2, 3] }));
    }
    var u = r.blocks.B11;
    box.appendChild(el('p', { cls: 'sect', text: 'Gas tecnici e acqua' }));
    box.appendChild(kv([['Ossigeno', fx(u.o2_Nm3h, 0) + ' Nm³/h (' + fx(r.indicators.o2_Nm3_t, 0) + ' Nm³/t)'], ['Azoto', fx(u.n2_Nm3h, 0) + ' Nm³/h'], ['Argon', fx(u.ar_Nm3h, 0) + ' Nm³/h'], ['Acqua ricircolata', fx(u.circ_m3h, 0) + ' m³/h'], ['Reintegro', fx(u.makeup_m3h, 0) + ' m³/h (' + fx(r.indicators.water_m3_t, 2) + ' m³/t)']]));
  }
  function renderSizes() {
    var box = clear($('sz-body')), r = res(); if (!r) { noRes(box); return; }
    var bl = E.blocksFor(r.inputs);
    bl.forEach(function (b) {
      var rows = blockResults(r, b).slice(0, 7);
      if (!rows.length) return;
      var d = el('details', { cls: 'grp' }, [el('summary', null, [b + ' ' + blockName(b, r.inputs) + ' ', el('span', { cls: 'muted', text: blockSub(b, r, r.inputs) })])]);
      if (st.open['sz|' + b]) d.open = true;
      d.addEventListener('toggle', function () { st.open['sz|' + b] = d.open; });
      d.appendChild(el('div', { cls: 'pad' }, [kv(rows.map(function (x) { return [x[0], String(x[1])]; }))]));
      box.appendChild(d);
    });
  }
  function renderStreams() {
    var box = clear($('streamtable')), r = res(); if (!r) { noRes(box); return; }
    var ids = Object.keys(r.streams).sort(Dc.sortId);
    var t = el('table'), hr = el('tr');
    ['Corrente', 'Descrizione', 'Da', 'A', 't/h', 'Mt/anno', 'Altro'].forEach(function (c, i) { hr.appendChild(el('th', { text: c, cls: i === 4 || i === 5 ? 'n' : null, scope: 'col' })); });
    t.appendChild(el('thead', null, [hr]));
    var tb = el('tbody'), H = r.inputs.config.hours;
    ids.forEach(function (id) {
      var s = r.streams[id], tr = el('tr', { 'data-id': id, tabindex: '0' });
      [id, s.name, s.from || '—', s.to || '—', isNum(s.t_h) ? fx(s.t_h, 1) : '', isNum(s.t_h) ? fx(s.t_h * H / 1e6, 3) : '', Dc.other(s)].forEach(function (v, i) { tr.appendChild(el('td', { text: v, cls: i === 4 || i === 5 ? 'n' : (i === 6 ? 'wrap' : null) })); });
      activate(tr, function () { select('stream', id); });
      tb.appendChild(tr);
    });
    t.appendChild(tb); box.appendChild(t);
  }
  function snapshot() { var r = res(); if (!r) return null; var k = r.indicators; return { caseId: st.caseId, desc: describe(r.inputs), k: k }; }
  var CMP = [['Acciaio liquido', 'LS_t', 1e-6, 2, 'Mt/anno'], ['Prodotti finiti', 'product_t', 1e-6, 2, 'Mt/anno'], ['Resa sui prodotti', 'yield_products', 100, 1, '%'], ['Energia elettrica', 'elec_kWh_t', 1, 0, 'kWh/t'], ['Prelievo dalla rete', 'grid_MW', 1, 0, 'MW'],
    ['Gas naturale', 'ng_GJ_t', 1, 2, 'GJ/t'], ['Energia primaria', 'energy_GJ_t', 1, 2, 'GJ/t'], ['CO₂ diretta', 'co2_direct_t_t', 1, 3, 't/t'], ['CO₂ con la rete', 'co2_total_t_t', 1, 3, 't/t'], ['Ossigeno', 'o2_Nm3_t', 1, 0, 'Nm³/t'], ['Acqua di reintegro', 'water_m3_t', 1, 2, 'm³/t'], ['Sottoprodotti', 'byproducts_kg_t', 1, 0, 'kg/t']];
  function renderCompare() {
    var box = clear($('compare')), cur = snapshot();
    if (!st.A && !st.B) { box.appendChild(el('p', { cls: 'note', text: 'Tieni il caso corrente come A, cambia gli input, premi Aggiorna e tienilo come B: la tabella mostra le differenze. Senza B, il confronto è con il caso corrente.' })); return; }
    var a = st.A || cur, b = st.B || cur;
    if (!a || !b) { noRes(box); return; }
    box.appendChild(el('p', { cls: 'note', text: 'A: ' + a.caseId + ' – ' + a.desc + '. B: ' + (st.B ? b.caseId + ' – ' + b.desc : 'caso corrente') + '.' }));
    box.appendChild(table(['Indicatore', 'A', 'B', 'B − A', 'Unità'], CMP.map(function (c) {
      var va = a.k[c[1]] * c[2], vb = b.k[c[1]] * c[2], d = vb - va, sp = el('span', { cls: Math.abs(d) < 1e-9 ? null : (d > 0 ? 'diff-up' : 'diff-dn'), text: (d > 0 ? '+' : '') + fx(d, c[3]) });
      return [c[0], fx(va, c[3]), fx(vb, c[3]), sp, c[4]];
    }), { num: [1, 2, 3] }));
  }
  function renderLog() {
    var box = clear($('log'));
    if (!st.log.length) { box.appendChild(el('p', { cls: 'note', text: 'Nessun ricalcolo.' })); return; }
    box.appendChild(table(['Ora', 'Caso', 'Config.', 'Rotta', 'Mt/anno', 'kWh/t', 'CO₂ t/t', 'Input'], st.log.map(function (l) { return [l.time.toLocaleTimeString('it-IT'), l.caseId, l.product, l.route, fx(l.LS, 2), fx(l.kwh, 0), fx(l.co2, 2), l.hash]; }), { num: [4, 5, 6] }));
  }

  // ================================================================ vista assonometrica e planimetria
  function renderIso() {
    var box = clear($('iso-body')), r = res(); if (!r) { noRes(box); return; }
    var Lo = Dc.layout(r), c30 = Math.cos(Math.PI / 6), s30 = 0.5, ex = 3;
    var rects = Lo.rects.slice().sort(function (a, b) { return (a.x + a.w / 2 + a.y + a.d / 2) - (b.x + b.w / 2 + b.y + b.d / 2); });
    function P(x, y, z) { return [(x - y) * c30, (x + y) * s30 - z * ex]; }
    var xs = [], ys = [];
    Lo.rects.forEach(function (q) { [[q.x, q.y, 0], [q.x + q.w, q.y, 0], [q.x, q.y + q.d, 0], [q.x + q.w, q.y + q.d, 0], [q.x, q.y, q.h], [q.x + q.w, q.y, q.h]].forEach(function (p) { var s = P(p[0], p[1], p[2]); xs.push(s[0]); ys.push(s[1]); }); });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs), minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys), W = 1400, sc = W / (maxX - minX), Hh = (maxY - minY) * sc + 60;
    var svg = sv('svg', { viewBox: '0 0 ' + (W + 40) + ' ' + Math.ceil(Hh + 30), role: 'img', 'aria-label': 'Vista assonometrica schematica delle aree dello stabilimento' });
    function Q(x, y, z) { var p = P(x, y, z); return ((p[0] - minX) * sc + 20).toFixed(1) + ',' + ((p[1] - minY) * sc + 40).toFixed(1); }
    rects.forEach(function (q) {
      var g = sv('g', { 'data-b': q.b, tabindex: '0', role: 'button', 'aria-label': q.b + ' ' + q.name });
      g.appendChild(sv('title', {}, q.b + ' ' + q.name + ': ' + fx(q.ha, 1) + ' ha, altezza ' + q.h + ' m'));
      var x = q.x, y = q.y, w = q.w, d = q.d, h = q.h;
      g.appendChild(sv('polygon', { points: [Q(x, y + d, 0), Q(x + w, y + d, 0), Q(x + w, y + d, h), Q(x, y + d, h)].join(' '), fill: 'var(--iso-left)', stroke: 'currentColor', 'stroke-width': 0.8 }));
      g.appendChild(sv('polygon', { points: [Q(x + w, y, 0), Q(x + w, y + d, 0), Q(x + w, y + d, h), Q(x + w, y, h)].join(' '), fill: 'var(--iso-right)', stroke: 'currentColor', 'stroke-width': 0.8 }));
      g.appendChild(sv('polygon', { points: [Q(x, y, h), Q(x + w, y, h), Q(x + w, y + d, h), Q(x, y + d, h)].join(' '), fill: 'var(--iso-top)', stroke: 'currentColor', 'stroke-width': 0.8 }));
      var c = Q(x + w / 2, y + d / 2, h).split(',');
      g.appendChild(sv('text', { x: c[0], y: c[1], 'text-anchor': 'middle', 'font-size': 12, 'font-family': 'var(--mono)' }, q.b));
      activate(g, function () { select('block', q.b); });
      svg.appendChild(g);
    });
    svg.appendChild(sv('text', { x: 20, y: 20, 'font-size': 12, fill: 'var(--muted)' }, 'Altezze esagerate 3 volte. Edifici e impianti come volumi pieni: superfici di screening, non ingombri di progetto.'));
    box.appendChild(svg);
    highlight();
  }
  function renderPlot() {
    var box = clear($('plot-body')), tb = clear($('plot-table')), r = res(); if (!r) { noRes(box); return; }
    var Lo = Dc.layout(r), W = 1400, sc = W / (Lo.W + 120), Hh = (Lo.D + 120) * sc;
    var svg = sv('svg', { viewBox: '0 0 ' + (W + 20) + ' ' + Math.ceil(Hh + 50), role: 'img', 'aria-label': 'Planimetria schematica delle aree' });
    var ox = 10 + 60 * sc, oy = 10 + 60 * sc;
    svg.appendChild(sv('rect', { x: 10, y: 10, width: (Lo.W + 120) * sc, height: (Lo.D + 120) * sc, fill: 'none', stroke: 'currentColor', 'stroke-dasharray': '6 4' }));
    var depth1 = Lo.rects.filter(function (q) { return q.y === 0; })[0].d;
    svg.appendChild(sv('rect', { x: ox, y: oy + depth1 * sc, width: Lo.W * sc, height: 30 * sc, fill: 'var(--rule)' }));
    Lo.rects.forEach(function (q) {
      var g = sv('g', { 'data-b': q.b, tabindex: '0', role: 'button', 'aria-label': q.b + ' ' + q.name + ', ' + fx(q.ha, 1) + ' ettari' });
      g.appendChild(sv('title', {}, q.b + ' ' + q.name + ': ' + fx(q.ha, 1) + ' ha'));
      g.appendChild(sv('rect', { x: ox + q.x * sc, y: oy + q.y * sc, width: q.w * sc, height: q.d * sc, fill: 'var(--panel)', stroke: 'currentColor', 'stroke-width': 1.2 }));
      var cx = ox + (q.x + q.w / 2) * sc, cy = oy + (q.y + q.d / 2) * sc, vert = q.w * sc < 70;
      var tf = vert ? 'rotate(-90 ' + cx + ' ' + cy + ')' : null;
      g.appendChild(sv('text', { x: cx, y: cy - 4, 'text-anchor': 'middle', 'font-size': 12, 'font-family': 'var(--mono)', transform: tf }, q.b));
      g.appendChild(sv('text', { x: cx, y: cy + 12, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--muted)', transform: tf }, fx(q.ha, 1) + ' ha'));
      if (!vert && q.w * sc > 110) g.appendChild(sv('text', { x: cx, y: cy - 20, 'text-anchor': 'middle', 'font-size': 12 }, q.name));
      activate(g, function () { select('block', q.b); });
      svg.appendChild(g);
    });
    // scala grafica e nord
    var bar = Math.pow(10, Math.floor(Math.log10(Lo.W / 4))), bx = 20, by = Hh + 30;
    svg.appendChild(sv('rect', { x: bx, y: by, width: bar * sc, height: 6, fill: 'currentColor' }));
    svg.appendChild(sv('text', { x: bx + bar * sc + 8, y: by + 7, 'font-size': 12 }, fx(bar, 0) + ' m'));
    svg.appendChild(sv('path', { d: 'M ' + (W - 20) + ' ' + (by + 8) + ' l 8 -24 l 8 24 z', fill: 'currentColor' }));
    svg.appendChild(sv('text', { x: W - 12, y: by - 20, 'font-size': 12, 'text-anchor': 'middle' }, 'N'));
    box.appendChild(svg);
    var rows = Lo.rects.map(function (q) { return [q.b, q.name, fx(q.ha, 1), fx(q.w, 0) + ' × ' + fx(q.d, 0), q.h + ' m']; });
    var t = ['', 'Superficie delle aree', fx(Lo.built_ha, 1), '', '']; t._cls = 'total'; rows.push(t);
    var t2 = ['', 'Lotto con fasce perimetrali di 60 m', fx(Lo.site_ha, 0), fx(Lo.W + 120, 0) + ' × ' + fx(Lo.D + 120, 0), '']; t2._cls = 'total'; rows.push(t2);
    tb.appendChild(table(['Blocco', 'Area', 'ha', 'm × m', 'Altezza tipica'], rows, { num: [2] }));
    tb.appendChild(el('p', { cls: 'note', text: 'Due fasce: le aree di processo nell\'ordine del flusso, i servizi oltre una strada di 30 m. Superfici da regole di screening per taglia (ettari per unità); da sostituire con il plot plan di progetto.' }));
    highlight();
  }

  // ================================================================ elaborati
  function gen(code) { var r = res(); if (!r) return null; var d = Dc.ALL.filter(function (x) { return x.code === code; })[0]; return { t: d.fn(r), hash: st.calc.hash, caseId: st.caseId, time: st.calc.time }; }
  function meta(g) { return { Documento: 'SIM-ACC-01-' + g.t.code, Revisione: 'A, preliminare', Caso: g.caseId, 'Hash degli input': g.hash, Data: g.time.toLocaleDateString('it-IT'), Stato: 'D – da confermare con i licenziatari e la revisione tecnica' }; }
  function renderDeliverables() {
    var tabs = clear($('dv-tabs')), body = clear($('dv-body')), tools = clear($('dv-tools')), cur = st.calc ? st.calc.hash : null, stale = changedPaths().length > 0;
    Dc.ALL.forEach(function (d) {
      var g = st.dvGen[d.code], dot = g ? (g.hash === cur && !stale ? 'ok' : 'old') : '';
      tabs.appendChild(el('button', { type: 'button', role: 'tab', 'aria-selected': st.dv === d.code ? 'true' : 'false', onclick: function () { st.dv = d.code; if (!st.dvGen[d.code]) st.dvGen[d.code] = gen(d.code); renderDeliverables(); } }, [d.code + ' · ' + d.title, el('span', { cls: 'dot ' + dot, 'aria-hidden': 'true' })]));
    });
    var g = st.dvGen[st.dv];
    if (!g) { noRes(body); return; }
    tools.appendChild(el('button', { type: 'button', text: 'Scarica CSV', onclick: function () { save('SIM-ACC-01-' + g.t.code + '.csv', Dc.toCSV(g.t)); } }));
    tools.appendChild(el('button', { type: 'button', text: 'Scarica Markdown', onclick: function () { save('SIM-ACC-01-' + g.t.code + '.md', Dc.toMD(g.t, meta(g))); } }));
    tools.appendChild(el('button', { type: 'button', text: 'Copia come Markdown', onclick: function () { copy(Dc.toMD(g.t, meta(g)), $('dv-msg')); } }));
    tools.appendChild(el('button', { type: 'button', text: 'Pacchetto completo (.md)', onclick: function () { var r = res(); if (!r) return; save('SIM-ACC-01-pacchetto.md', Dc.ALL.map(function (d) { var gg = gen(d.code); return Dc.toMD(gg.t, meta(gg)); }).join('\n\n')); } }));
    tools.appendChild(el('button', { type: 'button', text: 'Schema a blocchi (SVG)', onclick: function () { save('SIM-ACC-01-BFD.svg', svgFile($('pfd'))); } }));
    var m = meta(g), hd = el('div', { cls: 'dv-head' });
    Object.keys(m).forEach(function (k) { hd.appendChild(el('div', { cls: k === 'Stato' ? 'sd' : null }, [el('span', { cls: 'k', text: k }), m[k]])); });
    body.appendChild(el('h3', { text: g.t.title }));
    body.appendChild(hd);
    if (g.hash !== cur || stale) body.appendChild(el('p', { cls: 'dv-old', text: 'Elaborato superato: gli input sono cambiati dopo la generazione. Premi Aggiorna per rigenerarlo.' }));
    var num = []; g.t.rows.forEach(function (r) { r.forEach(function (v, i) { if (/^[−\-]?[\d.]+(,\d+)?$/.test(String(v)) && num.indexOf(i) < 0) num.push(i); }); });
    var w = el('div', { cls: 'dv-tscroll' }); w.appendChild(table(g.t.cols, g.t.rows.map(function (r) { return r.slice(); }), { num: num, wrap: g.t.wrap || [2, 4, 5], cls: 'dvtable' }).firstChild); body.appendChild(w);
    if (g.t.notes && g.t.notes.length) { var ul = el('ul', { cls: 'dv-notes' }); g.t.notes.forEach(function (n) { ul.appendChild(el('li', { text: n })); }); body.appendChild(ul); }
  }
  function svgFile(node) {
    var c = node.cloneNode(true), cs = getComputedStyle(document.documentElement), css = '';
    ['--bg', '--sheet', '--panel', '--ink', '--muted', '--rule', '--rule-strong', '--accent', '--accent-ink', '--accent-soft', '--solid', '--metal', '--semi', '--gas', '--tech', '--water', '--elec', '--flue', '--by'].forEach(function (k) { css += k + ':' + cs.getPropertyValue(k) + ';'; });
    var rules = []; for (var i = 0; i < document.styleSheets.length; i++) { try { Array.prototype.forEach.call(document.styleSheets[i].cssRules, function (r) { if (/#pfd/.test(r.cssText)) rules.push(r.cssText.replace(/#pfd\s?/g, '')); }); } catch (e) { } }
    c.setAttribute('xmlns', NS); c.removeAttribute('class');
    var style = document.createElementNS(NS, 'style'); style.textContent = 'svg{' + css + 'background:' + cs.getPropertyValue('--sheet') + ';color:' + cs.getPropertyValue('--ink') + ';font-family:sans-serif}text{fill:currentColor}' + rules.join('\n');
    c.insertBefore(style, c.firstChild);
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(c);
  }

  // ================================================================ file
  var downloads = null;
  try { if (window.claude && window.claude.use) window.claude.use('downloads').then(function (d) { downloads = d; }, function () { }); } catch (e) { }
  function save(name, data) {
    var msg = $('dv-msg');
    if (downloads) {
      downloads.save({ filename: name, data: data }).then(function () { msg.textContent = name + ' pronto.'; }, function (e) { msg.textContent = e && e.code === 'declined' ? 'Download annullato.' : 'Download non disponibile in questa vista (' + (e && e.code || 'errore') + ').'; });
      return;
    }
    if (window.claude && window.claude.use) { msg.textContent = 'Download non disponibile in questa vista: usa Copia come Markdown.'; return; }
    try { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data])); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); msg.textContent = name + ' scaricato.'; } catch (e) { msg.textContent = 'Download non riuscito.'; }
  }
  function copy(text, msgEl) {
    function fallback() { var t = $('case-text'); t.value = text; t.select(); msgEl.textContent = 'Testo selezionato nel riquadro del caso: copialo con Ctrl+C.'; }
    try { navigator.clipboard.writeText(text).then(function () { msgEl.textContent = 'Copiato negli appunti.'; }, fallback); } catch (e) { fallback(); }
  }
  function caseJSON() { return JSON.stringify({ schema: 'acc-case/1', version: VERSION, caseId: st.caseId, inputs: st.user }, null, 1); }
  function loadCase(text) {
    var o; try { o = JSON.parse(text); } catch (e) { $('case-msg').textContent = 'Il testo non è un JSON valido.'; return; }
    if (!o || o.schema !== 'acc-case/1' || !o.inputs) { $('case-msg').textContent = 'Non è un caso del simulatore (schema acc-case/1).'; return; }
    try { st.user = E.completeInputs(o.inputs); } catch (e) { $('case-msg').textContent = 'Caso non valido: ' + e.message; return; }
    st.caseId = o.caseId || 'caricato'; st.sel = { type: 'case', id: null }; $('case-msg').textContent = 'Caso caricato.'; refresh('caricato');
  }

  // ================================================================ verifiche e limiti
  var VAL = ['Bilanci di massa per blocco con la voce per differenza esplicita; bilancio del ferro di stabilimento chiuso entro il 5 % nei cinque casi di riferimento (test automatico).', 'Indicatori dei casi di riferimento confrontati con la DF §12.1: carica metallica, energia elettrica all\'acciaieria, CO₂, resa liquido → HRC.', 'Test in Node del motore: monotonia rispetto a capacità, quota di DRI, carica a caldo, idrogeno; rifiuto degli input fuori campo.', 'Dimensioni principali confrontate con taglie industriali note: altoforni da 4.000–5.500 m³, forni elettrici da 150 t con trasformatori da 100–150 MVA, colate di bramme da 250 t/h per linea.'];
  var ACC = ['Consumi specifici: ±10–20 % rispetto ai dati dei licenziatari, perché sono ordini di grandezza di letteratura.', 'CO₂ diretta: ±10 % sul carbonio in ingresso; la ripartizione per area è indicativa.', 'Quantità di apparecchiature: ±1 unità al limite di una taglia; superfici di planimetria ±30 %.'];
  var WEAK = ['Nessun bilancio termico dell\'altoforno, del convertitore o del forno elettrico: consumi da coefficienti specifici, non da modelli di processo.', 'Gas di recupero: quote d\'uso interno fisse; nessuna rete gas con gasometri e torce, nessun bilancio orario.', 'La CO₂ indiretta usa un solo fattore di rete; la produzione esterna di pellet, calce acquistata e idrogeno acquistato è fuori dal perimetro.', 'Il campo di CO₂ della DF per DRI-EAF ed EAF sembra includere l\'energia elettrica: il confronto è mostrato sulla diretta e sulla somma.', 'Tubi saldati SAW longitudinali da coil come approssimazione della lamiera; nessun treno lamiere dedicato nella configurazione B.', 'Punta elettrica semplificata: forni ad arco tutti sotto arco insieme, altri carichi con un rapporto punta/media unico.'];
  var FIELD = ['Configurazione A: 3–5 Mt/anno; B: 0,6–1,5 Mt/anno (DF §1). Fuori campo il calcolo procede con un avviso.', 'Rotte BF-BOF, DRI-EAF a gas naturale o idrogeno, EAF a rottame con HBI facoltativo.', 'Esercizio continuo 5.000–8.760 h/anno; valori medi annui, non transitori di avviamento o di fermata.', 'Studi di fattibilità, WBS, stima delle ore di ingegneria e battery limits in offerta EPC (DF §1).'];

  // ================================================================ avvio
  function init() {
    var ps = $('preset');
    D.cases.order.forEach(function (id) { ps.appendChild(el('option', { value: id, text: D.cases.cases[id].title })); });
    ps.appendChild(el('option', { value: '', text: 'Caso personalizzato' }));
    var pP = P['config.product'], pR = P['config.route'];
    pP.options.forEach(function (o) { $('q-product').appendChild(el('option', { value: o, text: pP.names[o] })); });
    pR.options.forEach(function (o) { $('q-route').appendChild(el('option', { value: o, text: pR.names[o] })); });
    ps.addEventListener('change', function () { if (!ps.value) return; st.caseId = ps.value; st.user = presetUser(ps.value); st.sel = { type: 'case', id: null }; refresh('caso di riferimento'); });
    $('q-product').addEventListener('change', function () { setConfig('config.product', this.value); });
    $('q-route').addEventListener('change', function () { setConfig('config.route', this.value); });
    $('btn-refresh').addEventListener('click', function () { refresh(); });
    $('btn-reset').addEventListener('click', function () { if (!D.cases.cases[st.caseId]) st.caseId = 'A1'; st.user = presetUser(st.caseId); refresh('ripristino'); });
    $('bal-sel').addEventListener('change', function () { st.ledger = this.value; renderBalances(); });
    $('btn-keep-A').addEventListener('click', function () { st.A = snapshot(); renderCompare(); });
    $('btn-keep-B').addEventListener('click', function () { st.B = snapshot(); renderCompare(); });
    $('btn-save').addEventListener('click', function () { save('caso-acciaieria-' + st.caseId + '.json', caseJSON()); $('case-msg').textContent = $('dv-msg').textContent; });
    $('btn-copy-case').addEventListener('click', function () { copy(caseJSON(), $('case-msg')); });
    $('btn-load-case').addEventListener('click', function () { loadCase($('case-text').value); });
    $('file-load').addEventListener('change', function () { var f = this.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { loadCase(String(rd.result)); }; rd.readAsText(f); this.value = ''; });
    var th = store('acc-sim-theme') || 'auto';
    $('theme').value = th; applyTheme(th);
    $('theme').addEventListener('change', function () { applyTheme(this.value); store('acc-sim-theme', this.value); });
    [['val-list', VAL], ['acc-list', ACC], ['weak-list', WEAK], ['field-list', FIELD]].forEach(function (x) { x[1].forEach(function (t) { $(x[0]).appendChild(el('li', { text: t })); }); });
    $('tb-version').textContent = VERSION;
    var saved = store(STORE);
    try { if (saved && saved.schema === 'acc-case/1') { st.user = E.completeInputs(saved.inputs); st.caseId = saved.caseId || 'A1'; } } catch (e) { saved = null; }
    if (!st.user) st.user = presetUser('A1');
    refresh('apertura');
    $('boot').hidden = true;
  }
  function applyTheme(t) { if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); }

  window.AccPage = { init: init, state: st };
  try { init(); } catch (e) { var b = $('boot'); if (b) { b.classList.add('failed'); b.appendChild(el('span', { text: ' Errore: ' + e.message })); } throw e; }
})();
