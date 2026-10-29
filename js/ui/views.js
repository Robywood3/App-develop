// Viste di analisi: diagramma T-Q del GVR, diagramma T-s del ciclo a vapore,
// curve di prestazione, trend, tabelle delle correnti e bilancio energetico.

import { drawChart } from './charts.js';
import { utilitiesBalance } from '../engine/utilities.js';
import { fmt } from './format.js';
import { bankColumns, steamStreams } from './mimic.js';
import { satP, psat, propsPT, propsPH, hPS, P_MAX_BAR } from '../engine/steam.js';
import { plantPoint } from '../engine/plant.js';

const LEVEL_COLOR = { HP: '--hp', IP: '--ip', LP: '--lp' };
const LEGEND_NAME = { '--hp': 'HP', '--ip': 'IP / RH', '--lp': 'LP', '--water': 'Condensato' };

function bankColor(name) {
  if (name.startsWith('RH')) return '--ip';
  if (name.startsWith('PRE')) return '--water';
  const m = name.match(/\b(HP|IP|LP)\b/);
  return m ? LEVEL_COLOR[m[1]] : '--water';
}

// ------------------------------------------------------------------ T-Q
export function renderTQ(canvas, table, r) {
  if (!r || !r.online) {
    drawChart(canvas, { title: 'GVR fuori servizio', series: [], xLabel: 'Calore scambiato [MW]', yLabel: 'Temperatura [°C]' });
    table.innerHTML = '';
    return;
  }
  const cols = bankColumns(r.bt.banks);
  const Qtot = cols.reduce((a, c) => a + c.banks.reduce((s, b) => s + b.Q, 0), 0);
  let x = Qtot;
  const gas = [[x, cols[0].TgIn]];
  const series = [];
  const labels = [];
  const pinchMarks = [];
  const legendSeen = new Set();
  for (const c of cols) {
    const q = c.banks.reduce((s, b) => s + b.Q, 0);
    const xHot = x;
    const xCold = x - q;
    gas.push([xCold, c.TgOut]);
    c.banks.forEach((b, j) => {
      const col = bankColor(b.name);
      let pts;
      if (b.name.startsWith('EVA') && b.subFrac > 0.002) {
        const xs = xCold + (xHot - xCold) * b.subFrac;
        pts = [[xCold, b.TwIn], [xs, b.TwOut], [xHot, b.TwOut]];
      } else pts = [[xCold, b.TwIn], [xHot, b.TwOut]];
      const legendLabel = !legendSeen.has(col) ? LEGEND_NAME[col] : undefined;
      legendSeen.add(col);
      series.push({ points: pts, color: col, width: 2.4, dash: b.name.startsWith('ECO') || b.name.startsWith('PRE') ? [6, 3] : [], noHover: true, label: legendLabel });
      // le etichette dei banchi in parallelo vengono sfalsate sotto la curva
      if (q > Qtot * 0.025) labels.push({ x: (xCold + xHot) / 2, y: Math.min(b.TwOut, b.TwIn) - 22 - j * 14, text: b.name.replace(' (condensato)', ''), color: col });
      if (b.name.startsWith('EVA')) pinchMarks.push({ x: xCold, y: c.TgOut, dt: c.TgOut - b.TwOut });
    });
    x = xCold;
  }
  gas.reverse();
  series.unshift({ points: gas, color: '--gas', width: 3, label: 'Fumi', fill: false });
  for (const p of pinchMarks) labels.push({ x: p.x, y: p.y + 10, text: `pinch ${fmt(p.dt, 1)} K`, color: '--muted' });
  drawChart(canvas, {
    title: 'Profilo di temperatura nel GVR',
    xLabel: 'Calore scambiato dal camino [MW]',
    yLabel: 'Temperatura [°C]',
    xMin: 0, yMin: 0,
    series,
    labels,
    xUnit: 'MW',
    xHover: 'Q ',
    hoverDecimals: 1,
  });

  // tabella dei banchi
  let html = '<thead><tr><th>Banco</th><th>Potenza [MW]</th><th>Fumi ingresso [°C]</th><th>Fumi uscita [°C]</th><th>Acqua/vapore ingresso [°C]</th><th>Acqua/vapore uscita [°C]</th></tr></thead><tbody>';
  for (const b of r.bt.banks) {
    html += `<tr><td><span class="swatch" style="background:var(${bankColor(b.name)})"></span>${b.name}${b.parallel ? ' <span class="muted">(parallelo)</span>' : ''}</td><td>${fmt(b.Q, 2)}</td><td>${fmt(b.TgIn, 1)}</td><td>${fmt(b.TgOut, 1)}</td><td>${fmt(b.TwIn, 1)}</td><td>${fmt(b.TwOut, 1)}</td></tr>`;
  }
  html += `<tr class="grp"><td>Totale per GVR</td><td>${fmt(Qtot, 1)}</td><td>${fmt(cols[0].TgIn, 1)}</td><td>${fmt(r.bt.Tstack, 1)}</td><td></td><td></td></tr></tbody>`;
  table.innerHTML = html;
}

// ------------------------------------------------------------------ T-s
let domeCache = null;
function dome() {
  if (domeCache) return domeCache;
  const liq = [], vap = [];
  const pMaxT = satP(P_MAX_BAR).T;
  for (let T = 5; T <= pMaxT; T += 5) {
    const s = satP(psat(T));
    liq.push([s.sL, T]);
    vap.push([s.sV, T]);
  }
  domeCache = [...liq, ...vap.reverse()];
  return domeCache;
}

function isobar(p, T0, T1, steps = 16) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const T = T0 + ((T1 - T0) * i) / steps;
    const st = propsPT(p, T);
    pts.push([st.s, T]);
  }
  return pts;
}

function heatingLine(p, Tin, Tsh) {
  const s = satP(p);
  const pts = Tin < s.T - 0.5 ? isobar(p, Tin, s.T - 0.01, 10) : [];
  pts.push([s.sL, s.T], [s.sV, s.T]);
  if (Tsh > s.T + 0.5) pts.push(...isobar(p, s.T + 0.01, Tsh, 12).slice(1));
  return pts;
}

function expansionLine(sec, steps = 14) {
  const pts = [];
  const sIn = sec.sIn;
  for (let i = 0; i <= steps; i++) {
    const p = sec.pIn * Math.pow(sec.pOut / sec.pIn, i / steps);
    const h = sec.hIn - sec.eta * (sec.hIn - hPS(p, sIn));
    const st = propsPH(p, h);
    pts.push([st.s, st.T]);
  }
  return pts;
}

export function renderTS(canvas, r) {
  if (!r || !r.online) {
    drawChart(canvas, { title: 'Ciclo a vapore fermo', series: [{ points: dome(), color: '--muted', width: 1.5, label: 'Saturazione' }], xLabel: 'Entropia [kJ/(kg·K)]', yLabel: 'Temperatura [°C]' });
    return;
  }
  const b = r.bt;
  const series = [{ points: dome(), color: '--muted', width: 1.5, label: 'Saturazione', noHover: true }];
  const labels = [];
  const n = b.names.length;
  const Tfeed = b.TsubLP;
  for (let k = 0; k < n; k++) {
    const lv = b.names[k];
    const Tin = k === n - 1 ? b.TCondOut : Tfeed;
    const pts = heatingLine(b.pDrum[k], Math.min(Tin, satP(b.pDrum[k]).T - 1), b.Tsh[k]);
    series.push({ points: pts, color: LEVEL_COLOR[lv], width: 2.4, label: lv, noHover: true });
    labels.push({ x: pts[pts.length - 1][0], y: b.Tsh[k], text: `${lv} ${fmt(b.pAdm[k], 1)} bar`, color: LEVEL_COLOR[lv], align: 'left' });
  }
  if (b.type === '3PRH') {
    const s0 = b.sections[0];
    series.push({ points: isobar(b.pAdm[1], s0.Tout, b.Trh, 14), color: '--ip', width: 2.4, dash: [5, 3], label: 'RH', noHover: true });
  }
  for (const sec of b.sections) {
    series.push({ points: expansionLine(sec), color: '--fg', width: 2, noHover: true });
  }
  const last = b.sections[b.sections.length - 1];
  const cs = satP(b.pCond);
  series.push({ points: [[last.sOut, b.Tcond], [cs.sL, b.Tcond]], color: '--water', width: 2.4, label: 'Condensazione', noHover: true });
  labels.push({ x: last.sOut, y: b.Tcond + 8, text: `x = ${fmt(last.xOut, 3)}`, color: '--fg', align: 'right' });
  series.push({ points: [], color: '--fg', label: 'Espansione TV' });
  drawChart(canvas, {
    title: 'Diagramma T-s',
    xLabel: 'Entropia [kJ/(kg·K)]',
    yLabel: 'Temperatura [°C]',
    xMin: 0, xMax: 9, yMin: 0,
    series,
    labels,
    legend: true,
  });
}

// ------------------------------------------------------------------ curve
export async function computeCurves(cfg, des, op, onProgress) {
  const loads = [];
  for (let L = 0.3; L <= 1.0001; L += 0.05) loads.push(L);
  const temps = [];
  for (let T = -10; T <= 45.0001; T += 5) temps.push(T);
  const total = loads.length + temps.length;
  const out = { load: [], temp: [] };
  let done = 0;
  const tick = () => new Promise((res) => setTimeout(res, 0));
  for (const L of loads) {
    const r = plantPoint(cfg, des, { ...op, load: L, ductT: 0 });
    out.load.push({ x: L * 100, eta: r.eta * 100, net: r.net });
    onProgress(++done / total);
    await tick();
  }
  for (const T of temps) {
    const r = plantPoint(cfg, des, { ...op, Tamb: T, load: 1, ductT: 0 });
    out.temp.push({ x: T, eta: r.eta * 100, net: r.net });
    onProgress(++done / total);
    await tick();
  }
  return out;
}

export function renderCurves(canvases, data, cur) {
  const [cEL, cPL, cET, cPT] = canvases;
  const pick = (arr, k) => arr.map((d) => [d.x, d[k]]);
  const markLoad = cur && cur.online ? cur : null;
  drawChart(cEL, {
    title: 'Rendimento netto vs carico TG', xLabel: 'Carico TG [%]', yLabel: 'Rendimento [%]', xMin: 30, xMax: 100,
    series: data ? [{ points: pick(data.load, 'eta'), color: '--accent', width: 2.4, markers: true, fill: true, label: 'η netto' }] : [],
    marks: markLoad ? [{ x: markLoad.gt.load * 100, y: markLoad.eta * 100, label: `${fmt(markLoad.eta * 100, 2)} %` }] : [],
    xUnit: '%', hoverDecimals: 2,
  });
  drawChart(cPL, {
    title: 'Potenza netta vs carico TG', xLabel: 'Carico TG [%]', yLabel: 'Potenza [MW]', xMin: 30, xMax: 100,
    series: data ? [{ points: pick(data.load, 'net'), color: '--accent', width: 2.4, markers: true, fill: true, label: 'Netta' }] : [],
    marks: markLoad ? [{ x: markLoad.gt.load * 100, y: markLoad.net, label: `${fmt(markLoad.net, 1)} MW` }] : [],
    xUnit: '%', hoverDecimals: 1,
  });
  drawChart(cET, {
    title: 'Rendimento netto vs temperatura aria', xLabel: 'Temperatura aria [°C]', yLabel: 'Rendimento [%]',
    series: data ? [{ points: pick(data.temp, 'eta'), color: '--gas', width: 2.4, markers: true, fill: true, label: 'η netto (carico base)' }] : [],
    xUnit: '°C', hoverDecimals: 2,
  });
  drawChart(cPT, {
    title: 'Potenza netta vs temperatura aria', xLabel: 'Temperatura aria [°C]', yLabel: 'Potenza [MW]',
    series: data ? [{ points: pick(data.temp, 'net'), color: '--gas', width: 2.4, markers: true, fill: true, label: 'Netta (carico base)' }] : [],
    xUnit: '°C', hoverDecimals: 1,
  });
}

// ------------------------------------------------------------------ trend
export function renderTrend(cP, cT, hist) {
  const span = hist.length ? hist[hist.length - 1].t - hist[0].t : 0;
  const hours = span > 3 * 3600;
  const k = hours ? 3600 : 60;
  const unit = hours ? 'h' : 'min';
  const t0 = hist.length ? hist[0].t : 0;
  const pts = (key) => hist.map((h) => [(h.t - t0) / k, h[key]]);
  drawChart(cP, {
    title: 'Potenze', xLabel: `Tempo [${unit}]`, yLabel: 'Potenza [MW]', yMin: Math.min(0, ...hist.map((h) => h.net)),
    series: [
      { points: pts('net'), color: '--accent', width: 2.4, label: 'Netta', fill: true },
      { points: pts('gt'), color: '--gas', width: 1.8, label: 'TG' },
      { points: pts('st'), color: '--hp', width: 1.8, label: 'TV' },
    ],
    xUnit: unit, xHoverDecimals: 1,
  });
  drawChart(cT, {
    title: 'Temperature', xLabel: `Tempo [${unit}]`, yLabel: 'Temperatura [°C]',
    series: [
      { points: pts('T4'), color: '--gas', width: 2, label: 'Scarico TG' },
      { points: pts('Tstack'), color: '--muted', width: 2, label: 'Camino' },
      { points: pts('Tamb'), color: '--water', width: 2, label: 'Aria' },
    ],
    xUnit: unit, xHoverDecimals: 1,
  });
}

// ------------------------------------------------------------------ correnti
export function renderStreams(table, r, cfg) {
  if (!r || !r.online) {
    table.innerHTML = '<tbody><tr><td>Impianto fermo: nessuna corrente in regime.</td></tr></tbody>';
    return;
  }
  const n = r.nOn;
  const gt = r.gt;
  const row = (name, m, p, T, extra = '') => `<tr><td>${name}</td><td>${fmt(m, 2)}</td><td>${p === null ? '—' : p < 1 ? fmt(p, 4) : fmt(p, 2)}</td><td>${fmt(T, 1)}</td><td>${extra}</td></tr>`;
  let html = '<thead><tr><th>Corrente</th><th>Portata [kg/s]</th><th>Pressione [bar]</th><th>Temperatura [°C]</th><th>Note</th></tr></thead><tbody>';
  html += `<tr class="grp"><td colspan="5">Turbogas${n > 1 ? ` (${n} unità in servizio, portate totali)` : ''}</td></tr>`;
  html += row('Aria aspirata', gt.mAir * n, gt.p1, gt.T1, `UR ${fmt(r.op.rh * 100, 0)} %`);
  html += row('Mandata compressore', gt.mAir * n, gt.p2, gt.T2, `β = ${fmt(gt.PR, 2)}`);
  html += row('Combustibile', gt.mFuel * n, null, cfg.gt.Tfuel, `PCI ${fmt(r.fuelLHV / 1000, 2)} MJ/kg`);
  html += row('Uscita combustore', (gt.mExh - gt.mAir * cfg.gt.coolFrac) * n, gt.p3, gt.TIT, 'temperatura di fiamma media');
  html += row('Ingresso rotore', gt.mRit * n, gt.p3, gt.Trit, 'dopo raffreddamento statorico');
  html += row('Scarico turbina', gt.mExh * n, gt.p4, gt.T4, `O₂ ${fmt((gt.xExh.O2 / (1 - gt.xExh.H2O)) * 100, 1)} % secco`);
  if (r.mFuelDB > 0) html += row('Uscita post-combustione', r.gas.m * n, gt.p4, r.gas.T, `combustibile ${fmt(r.mFuelDB, 2)} kg/s`);
  html += row('Camino', r.gas.m * n, r.op.pamb, r.bt.Tstack, `CO₂ ${fmt(r.co2, 1)} t/h`);
  html += '<tr class="grp"><td colspan="5">Ciclo a vapore</td></tr>';
  const st = steamStreams(r);
  const nm = { hp: 'Vapore HP (ammissione TV)', crh: 'Risurriscaldato freddo', ip: 'Vapore IP (surriscaldato)', hrh: 'Risurriscaldato caldo', lp: 'Vapore LP (surriscaldato)', exh: 'Scarico TV', cond: 'Condensato' };
  for (const [k, s] of Object.entries(st)) html += row(nm[k], s.m, s.p, s.T, k === 'exh' ? `titolo x = ${fmt(s.x, 3)}` : '');
  html += row('Ingresso preriscaldatore', r.bt.mSteamTot, null, r.bt.TCondOut, `ricircolo a ≥ ${fmt(cfg.steam.TwPreMin, 0)} °C`);
  r.bt.names.forEach((lv, k) => {
    html += row(`Corpo cilindrico ${lv}`, r.bt.mLevelsTot[k], r.bt.pDrum[k], r.bt.Tsat[k], 'saturazione');
  });
  html += '</tbody>';
  table.innerHTML = html;
}

// ------------------------------------------------------------------ bilancio
export function renderBalance(box, r) {
  if (!r || !r.online) {
    box.innerHTML = '<p class="muted">Impianto fermo.</p>';
    return;
  }
  const Q = r.Qfuel;
  const rows = [
    ['Potenza elettrica TG', r.Pgt, '--gas'],
    ['Potenza elettrica TV', r.Pst, '--hp'],
    ['Perdita al camino', r.stackLoss, '--muted'],
    ['Calore al condensatore', r.bt.Qcond, '--water'],
    ['Altre perdite (meccaniche, elettriche, irraggiamento)', r.otherLoss, '--ip'],
  ];
  let html = '';
  for (const [name, v, c] of rows) {
    const pct = (v / Q) * 100;
    html += `<div class="bal-row"><span>${name}</span><div class="bal-bar"><span style="width:${Math.max(0, pct).toFixed(2)}%;background:var(${c})"></span></div><span class="bal-val">${fmt(v, 1)} MW · ${fmt(pct, 1)} %</span></div>`;
  }
  html += `<div class="bal-row total"><span>Combustibile (PCI)</span><span></span><span class="bal-val">${fmt(Q, 1)} MW · 100 %</span></div>`;
  html += `<div class="bal-row"><span>Ausiliari e trasformatore</span><div class="bal-bar"><span style="width:${((r.Paux + r.Ptrafo) / Q * 100).toFixed(2)}%;background:var(--warn)"></span></div><span class="bal-val">− ${fmt(r.Paux + r.Ptrafo, 1)} MW</span></div>`;
  html += `<div class="bal-row total"><span>Potenza netta</span><div class="bal-bar"><span style="width:${(r.eta * 100).toFixed(2)}%;background:var(--accent)"></span></div><span class="bal-val">${fmt(r.net, 1)} MW · ${fmt(r.eta * 100, 2)} %</span></div>`;
  box.innerHTML = html;
}

// ------------------------------------------------------------------ utilities e ausiliari
export function renderUtilities(box, r, cfg, des) {
  if (!r || !r.online) {
    box.innerHTML = '<p class="muted">Impianto fermo: consumi di utilities non calcolati.</p>';
    return;
  }
  const U = utilitiesBalance(cfg, des, r);
  const card = (title, rows) => `<div class="ut-card"><h3>${title}</h3><dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div>`;
  const c = U.cooling;
  const cards = [];
  if (c.type === 'aperto') cards.push(card('Acqua di circolazione a ciclo aperto', [
    ['Calore scaricato', `${fmt(c.Qcond, 1)} MW`], ['Acqua di circolazione', `${fmt(c.cwM3h, 0)} m³/h`], ['Temperature', `${fmt(c.Tin, 1)} → ${fmt(c.Tout, 1)} °C`],
    ['Opera di presa', `2 corsie × ${fmt(c.intakeM3h, 0)} m³/h`], ['Pompe MCW / ACW', `2×50 % / 2×100 % (${fmt(U.ccw.acwM3h, 0)} m³/h)`],
    ['Biocida in continuo', `${fmt(c.hypo, 1)} kg/h`], ['Consumo di acqua', 'nessuno (restituita al corpo idrico)'],
  ]));
  else cards.push(card(c.type === 'torre' ? 'Torre di raffreddamento' : 'Aerocondensatore', c.type === 'torre' ? [
    ['Calore scaricato', `${fmt(c.Qcond, 1)} MW`], ['Acqua di circolazione', `${fmt(c.cwM3h, 0)} m³/h`], ['Temperature', `${fmt(c.Tin, 1)} → ${fmt(c.Tout, 1)} °C`],
    ['Evaporazione', `${fmt(c.evapM3h, 0)} m³/h`], ['Spurgo', `${fmt(c.blowdownM3h, 0)} m³/h (COC ${c.coc})`], ['Reintegro', `${fmt(c.makeupM3h, 0)} m³/h`],
    ['Pompe MCW / ACW', `2×50 % / 2×100 % (${fmt(U.ccw.acwM3h, 0)} m³/h)`],
    ['Ipoclorito / acido / inibitore', `${fmt(c.hypo, 1)} / ${fmt(c.acid, 1)} / ${fmt(c.antiscalant, 1)} kg/h`],
  ] : [['Calore scaricato', `${fmt(c.Qcond, 1)} MW`], ['Aria ambiente', `${fmt(c.Tair, 1)} °C`], ['Consumo di acqua', 'nessuno']]));
  cards.push(card('Ciclo chiuso', [
    ['Carico termico', `${fmt(U.ccw.kW, 0)} kW`], ['Portata', `${fmt(U.ccw.m3h, 0)} m³/h (pompe ${U.ccw.pumpN}×${U.ccw.pumpPct} %)`], ['Mandata / ritorno', `${fmt(U.ccw.Tsupply, 0)} / ${fmt(U.ccw.Treturn, 0)} °C`],
    ...U.ccw.users.filter((u) => u.kW > 0).sort((a, b) => b.kW - a.kW).slice(0, 4).map((u) => [u.name, `${fmt(u.kW, 0)} kW`]),
  ]));
  const d = U.demi;
  cards.push(card('Acqua', [
    ['Acqua grezza', `${fmt(U.rawWaterM3h, 0)} m³/h`], ['Acqua demi (media)', `${fmt(d.demiM3h, 1)} m³/h`], ['Reintegro ciclo', `${fmt((d.cycleMakeup * 3600) / 998, 2)} m³/h`],
    ['Spurgo continuo GVR', `${fmt((d.hrsgBD * 3600) / 998, 2)} m³/h`], ['Concentrati RO/EDI', `${fmt(((d.roReject + d.ediReject) * 3600) / 998, 2)} m³/h`], ['Acque reflue', `${fmt(U.ww.totalM3h, 1)} m³/h`],
    ['Serbatoi grezza / servizi / demi', `${fmt(U.pret.rawTankM3, 0)} / ${fmt(U.pret.serviceTankM3, 0)} / ${d.tankN > 1 ? `${d.tankN}×${fmt(d.tankM3 / d.tankN, 0)}` : fmt(d.tankM3, 0)} m³`],
    ['Impianto demi', `${fmt(d.plantM3h, 0)} m³/h`],
  ]));
  cards.push(card('Gas naturale', [
    ['Portata', `${fmt(U.gas.Sm3h, 0)} Sm³/h`], ['PCI / PCS', `${fmt(U.gas.lhvMJSm3, 2)} / ${fmt(U.gas.hhvMJSm3, 2)} MJ/Sm³`], ['Riduzione', `${fmt(U.gas.pIn, 0)} → ${fmt(U.gas.pOut, 1)} bar`],
    ['Preriscaldo stazione', `${fmt(U.gas.heaterKW, 0)} kW (a ${fmt(U.gas.preheatT, 0)} °C)`], ['Riscaldatori di prestazione', `${fmt(U.gas.perfHeaterKW, 0)} kW`],
    ...(U.gas.compressor ? [['Compressore gas', `${fmt(U.gas.compressor.pSuc, 0)} → ${fmt(U.gas.compressor.pDis, 0)} bar · ${fmt(U.gas.compressor.kW, 0)} kW`]] : []),
  ]));
  cards.push(card('Aria compressa e gas tecnici', [
    ['Aria strumenti / servizi', `${fmt(U.air.instrument, 0)} / ${fmt(U.air.service, 0)} Nm³/h`], ['Compressori', `${U.air.compressorN} × ${fmt(U.air.compressorNm3h, 0)} Nm³/h a ${fmt(U.air.pressure, 0)} bar a`],
    ['Essiccatori heatless', `2 × ${fmt(U.air.dryerNm3h, 0)} Nm³/h (−40 °C)`],
    ['Azoto in esercizio', `${fmt(U.gases.n2Nm3d, 0)} Nm³/giorno`], ['Idrogeno generatori', `${fmt(U.gases.h2Nm3d, 0)} Nm³/giorno`],
  ]));
  cards.push(card('Vapore ausiliario e chimici', [
    ['Alimentazione collettore', U.auxSteam.source], ['Vapore tenute TV', `${fmt(U.auxSteam.gland * 3.6, 1)} t/h`], ['Caldaia ausiliaria', `${fmt(U.auxSteam.boilerCapacity * 3.6, 0)} t/h`],
    ['Ammoniaca', `${fmt(U.chem.ammonia, 2)} kg/h`], ['Deossigenante', `${fmt(U.chem.scavenger * 1000, 0)} g/h`],
  ]));
  if (U.diesel) {
    cards.push(card('Gasolio di riserva', [
      ['Consumo a pieno carico', `${fmt(U.diesel.m3h, 0)} m³/h`], ['Serbatoio', `${fmt(U.diesel.tankM3, 0)} m³ (${U.diesel.hours} h)`],
      ['Pompe trasferimento', `2 × ${fmt(U.diesel.transferM3h, 0)} m³/h`], ['Scarico autobotti', `2 × ${fmt(U.diesel.unloadM3h, 0)} m³/h`],
    ]));
  }
  const tot = U.breakdown.reduce((a, b) => a + b.MW, 0) || 1;
  const cols = ['--hp', '--water', '--gas', '--ip', '--muted'];
  const bars = U.breakdown.map((b, i) => `<div class="bal-row"><span>${b.name}</span><div class="bal-bar"><span style="width:${((b.MW / tot) * 100).toFixed(2)}%;background:var(${cols[i % cols.length]})"></span></div><span class="bal-val">${fmt(b.MW, 2)} MW · ${fmt((b.MW / tot) * 100, 1)} %</span></div>`).join('');
  box.innerHTML = `<div class="ut-grid">${cards.join('')}</div><h3 class="ut-h">Potenza ausiliaria per sistema · totale ${fmt(tot, 2)} MW</h3><div class="balance">${bars}</div>`;
}

