// Controller dell'interfaccia: stato, input, ciclo di simulazione e aggiornamento delle viste.

import { defaultConfig, defaultOperation, designPlant, plantPoint, GT_PRESETS, GT_GROUPS, FUEL_PRESETS, LIMITS } from '../engine/plant.js';
import { HRSG_TYPES, LEVEL_NAMES } from '../engine/bottoming.js';
import { PlantSim, formatSimTime } from '../engine/dynamics.js';
import { fmt } from './format.js';
import { sparkline, redrawAll } from './charts.js';
import { buildMimic, updateMimic, mimicSignature } from './mimic.js';
import { renderTQ, renderTS, computeCurves, renderCurves, renderTrend, renderStreams, renderBalance, renderUtilities } from './views.js';
import { initDocs } from './docs-ui.js';

const $ = (id) => document.getElementById(id);
const TICK_MS = 250;
const DAY_START = 8 * 3600; // la simulazione parte alle 08:00

const S = {
  cfg: defaultConfig(),
  des: null,
  op: defaultOperation(),
  mode: 'dyn',
  running: true,
  speed: 10,
  sim: new PlantSim(),
  cache: new Map(),
  view: null,
  lastSS: null,
  mimicRef: null,
  mimicSig: '',
  history: [],
  histAcc: 0,
  curves: null,
  curvesBusy: false,
  activeView: 'v-tq',
  lastAnalysis: 0,
  daily: false,
  TambBase: 15,
};
S.sim.t = DAY_START;

// ----------------------------------------------------------------- calcolo
function redesign() {
  S.des = designPlant(S.cfg);
  S.cache.clear();
  S.curves = null;
  const notes = $('design-notes');
  notes.hidden = !S.des.notes.length;
  notes.textContent = S.des.notes.join(' ');
  if (S.op.nGTon > S.cfg.nGT) S.op.nGTon = S.cfg.nGT;
  S.sim.setSpeedNom((S.cfg.gt.freq ?? 50) * 60);
  fillNGTon();
  updateBrand();
  syncDesignInputs();
  if (S.docs) S.docs.invalidate();
}

function opKey(op, load) {
  return [load.toFixed(3), op.Tamb.toFixed(2), op.pamb.toFixed(4), op.rh.toFixed(2), op.Tcw.toFixed(2), op.ductT, op.nGTon, op.slidingHP].join('|');
}

function steady(load) {
  const op = { ...S.op, load };
  const key = opKey(op, load);
  let r = S.cache.get(key);
  if (!r) {
    r = plantPoint(S.cfg, S.des, op);
    if (S.cache.size > 300) S.cache.delete(S.cache.keys().next().value);
    S.cache.set(key, r);
  }
  return r;
}

function econ(v) {
  const fuel = S.des.fuel;
  if (!(v.net > 0) || !(v.Qfuel > 0)) return null;
  const eta = v.net / v.Qfuel;
  const fuelCost = (S.op.gasPrice * fuel.hhvToLhv) / eta;
  const co2Spec = v.co2 / v.net;
  const co2Cost = co2Spec * S.op.co2Price;
  const marg = fuelCost + co2Cost + S.op.omVar;
  return {
    fuelCost, co2Cost, om: S.op.omVar, marg,
    spread: S.op.powerPrice - marg,
    cleanSpark: S.op.powerPrice - fuelCost - co2Cost,
    marginHour: (S.op.powerPrice - marg) * v.net,
    fuelHour: S.op.gasPrice * fuel.hhvToLhv * v.Qfuel,
  };
}

// Vista composta: grandezze TG di regime + ciclo a vapore con inerzia termica.
function compose(ss, lag, fuelFrac) {
  const snap = S.sim.snapshot();
  const nOn = Math.min(S.op.nGTon, S.cfg.nGT);
  const base = {
    ss, snap, stateLabel: snap.stateLabel, speed: snap.speed, speedNom: S.sim.speedNom, stOnline: snap.stOnline,
    fuelFrac, nOn, condType: S.cfg.steam.condenser.type,
    ref: { hp: S.des.stRef.mLevels[0] * S.cfg.nGT },
  };
  if (ss && ss.online) {
    const Pst = lag.Pst;
    const gross = ss.Pgt + Pst;
    const Ptrafo = S.cfg.aux.trafoFrac * gross;
    const net = gross - ss.Paux - Ptrafo;
    const v = {
      ...base, online: true, Pgt: ss.Pgt, Pst, gross, Paux: ss.Paux, Ptrafo, net,
      Qfuel: ss.Qfuel, mFuel: ss.mFuelTot, co2: ss.co2, Tstack: lag.Tstack, T4: ss.gt.T4,
      eta: net / ss.Qfuel,
    };
    v.econ = econ(v);
    return v;
  }
  const Qfuel = fuelFrac * S.des.gtRef.point.Qfuel * nOn;
  const mFuel = fuelFrac * S.des.gtRef.point.mFuel * nOn;
  const Paux = S.cfg.aux.gtAuxMW * S.cfg.nGT * (snap.speed > 0 ? 2.5 : 0.6);
  const net = lag.Pst - Paux;
  return {
    ...base, online: false, Pgt: 0, Pst: lag.Pst, gross: lag.Pst, Paux, Ptrafo: 0, net,
    Qfuel, mFuel, co2: (mFuel * S.des.fuel.co2PerKg * 3.6), Tstack: lag.Tstack, T4: null, eta: NaN, econ: null,
  };
}

function tick() {
  if (!S.des) return;
  let v;
  if (S.mode === 'ss') {
    const ss = steady(S.op.load);
    S.lastSS = ss;
    const lag = { Pst: ss.online ? ss.Pst : 0, Tstack: ss.online ? ss.bt.Tstack : 25 };
    v = compose(ss, lag, 0);
    v.stateLabel = 'Stazionario';
    v.stOnline = ss.online;
    v.speed = ss.online ? S.sim.speedNom : 0;
  } else {
    if (S.running) {
      const dt = (TICK_MS / 1000) * S.speed;
      if (S.daily) {
        S.op.Tamb = S.TambBase + 8 * Math.sin(2 * Math.PI * (S.sim.t / 86400 - 0.375));
        $('out-tamb').textContent = `${fmt(S.op.Tamb, 1)} °C`;
      }
      const out = S.sim.step(dt, steady);
      if (out.ss) S.lastSS = out.ss;
      v = compose(out.ss, out.lag, out.fuelFrac);
      pushHistory(v, dt);
    } else {
      const out = S.sim.step(0, steady);
      v = compose(out.ss, out.lag, out.fuelFrac);
    }
  }
  S.view = v;
  render(v);
}

function pushHistory(v, dt) {
  S.histAcc += dt;
  if (S.histAcc < 2 && S.history.length) return;
  S.histAcc = 0;
  S.history.push({ t: S.sim.t, net: v.net, gt: v.Pgt, st: v.Pst, T4: v.T4 ?? NaN, Tstack: v.Tstack, Tamb: S.op.Tamb });
  if (S.history.length > 2000) S.history = S.history.filter((_, i) => i % 2 === 0);
}

// ----------------------------------------------------------------- render
function setText(id, s) {
  const e = $(id);
  if (e && e.textContent !== s) e.textContent = s;
}

function render(v) {
  // stato
  const pill = $('state-pill');
  const stKey = S.mode === 'ss' ? 'STAZ' : v.snap.state;
  pill.dataset.state = stKey;
  setText('state-pill', S.mode === 'ss' ? 'Stazionario' : v.snap.stateLabel);
  setText('phase-text', S.mode === 'ss' ? 'Punto di funzionamento a regime' : v.snap.phase || '—');
  setText('sim-clock', S.mode === 'ss' ? '' : formatSimTime(S.sim.t));
  updateButtons(v);

  // KPI
  setText('k-net', fmt(v.net, 1));
  setText('k-eta', v.online && v.net > 0 ? fmt(v.eta * 100, 2) : '—');
  setText('k-hr', v.online && v.net > 0 ? fmt(3600 / v.eta, 0) : '—');
  setText('k-gt', fmt(v.Pgt, 1));
  setText('k-st', fmt(v.Pst, 1));
  setText('k-fuel', fmt(v.Qfuel, 0));
  setText('k-fuel-mass', `${fmt(v.mFuel * 3.6, 1)} t/h gas`);
  setText('k-co2', v.online && v.net > 0 ? fmt((v.co2 / v.net) * 1000, 0) : '—');
  setText('k-co2-h', `${fmt(v.co2, 1)} t/h`);
  if (v.econ) {
    setText('k-cost', fmt(v.econ.marg, 1));
    const m = $('k-margin');
    m.textContent = `margine ${v.econ.spread >= 0 ? '+' : ''}${fmt(v.econ.spread, 1)} €/MWh`;
    m.className = `kpi-foot ${v.econ.spread >= 0 ? 'pos' : 'neg'}`;
  } else {
    setText('k-cost', '—');
    setText('k-margin', '—');
  }
  if (S.mode === 'dyn') sparkline($('k-spark'), S.history.slice(-240).map((h) => h.net));
  else sparkline($('k-spark'), []);

  // sinottico
  const sigSource = v.ss && v.ss.online ? v.ss : S.lastSS || { bt: S.des.point };
  const sig = mimicSignature(S.cfg, sigSource);
  if (sig !== S.mimicSig) {
    S.mimicRef = buildMimic($('mimic'), S.cfg, sigSource);
    S.mimicSig = sig;
  }
  updateMimic(S.mimicRef, v);

  renderAlarms(v);
  renderEvents();
  renderEcon(v);

  const now = performance.now();
  if (now - S.lastAnalysis > 1000) {
    S.lastAnalysis = now;
    renderAnalysis();
  }
}

function renderAlarms(v) {
  const box = $('alarms');
  const items = [];
  if (v.ss && v.ss.online) for (const w of v.ss.warnings) items.push(w);
  if (S.mode === 'dyn' && v.snap.state === 'BLOCCO') items.unshift('Blocco TG attivo: riconoscere a macchina ferma.');
  if (S.mode === 'dyn' && v.online && !v.stOnline) items.push('TV fuori parallelo: vapore in bypass al condensatore.');
  const html = items.length
    ? items.map((w) => `<div class="alarm">${w}</div>`).join('')
    : '<div class="alarm ok">Nessun allarme attivo</div>';
  if (box.innerHTML !== html) box.innerHTML = html;
}

let lastEvCount = -1;
let lastEvT = -1;
function renderEvents() {
  const ev = S.sim.events;
  if (ev.length === lastEvCount && (ev[0]?.t ?? 0) === lastEvT) return;
  lastEvCount = ev.length;
  lastEvT = ev[0]?.t ?? 0;
  $('events').innerHTML = ev.length
    ? ev.slice(0, 60).map((e) => `<li class="${e.level === 'alarm' ? 'alarm-ev' : ''}"><time>${formatSimTime(e.t)}</time><span>${e.msg}</span></li>`).join('')
    : '<li><time>—</time><span class="muted">Registro eventi vuoto. Usa Arresta, Avvia o Blocco TG per generare sequenze.</span></li>';
}

function renderEcon(v) {
  const dl = $('econ');
  if (!v.econ) {
    dl.innerHTML = '<dt>Impianto non in produzione</dt><dd>—</dd>';
    return;
  }
  const e = v.econ;
  const cls = (x) => (x >= 0 ? 'pos' : 'neg');
  dl.innerHTML = `
    <dt>Combustibile</dt><dd>${fmt(e.fuelCost, 1)} €/MWh</dd>
    <dt>CO₂</dt><dd>${fmt(e.co2Cost, 1)} €/MWh</dd>
    <dt>O&amp;M variabile</dt><dd>${fmt(e.om, 1)} €/MWh</dd>
    <dt class="strong">Costo marginale</dt><dd class="strong">${fmt(e.marg, 1)} €/MWh</dd>
    <div class="sep"></div>
    <dt>Clean spark spread</dt><dd class="${cls(e.cleanSpark)}">${fmt(e.cleanSpark, 1)} €/MWh</dd>
    <dt>Margine di contribuzione</dt><dd class="${cls(e.spread)}">${fmt(e.spread, 1)} €/MWh</dd>
    <dt class="strong">Margine orario</dt><dd class="strong ${cls(e.marginHour)}">${fmt(e.marginHour / 1000, 1)} k€/h</dd>
    <dt>Spesa combustibile</dt><dd>${fmt(e.fuelHour / 1000, 1)} k€/h</dd>
    <dt>PCS/PCI del gas</dt><dd>${fmt(S.des.fuel.hhvToLhv, 3)}</dd>`;
}

function renderAnalysis() {
  const ss = S.view && S.view.ss && S.view.ss.online ? S.view.ss : null;
  if (ss) ss.fuelLHV = S.des.fuel.lhv;
  switch (S.activeView) {
    case 'v-tq': renderTQ($('c-tq'), $('tbl-banks'), ss); break;
    case 'v-ts': renderTS($('c-ts'), ss); break;
    case 'v-curves':
      if (!S.curves && !S.curvesBusy) runCurves();
      renderCurves(curveCanvases(), S.curves, ss);
      break;
    case 'v-trend': renderTrend($('c-trend-p'), $('c-trend-t'), S.history); break;
    case 'v-streams': renderStreams($('tbl-streams'), ss, S.cfg); break;
    case 'v-balance': renderBalance($('balance'), ss); break;
    case 'v-util': renderUtilities($('utilities'), ss, S.cfg, S.des); break;
    default: break;
  }
}

const curveCanvases = () => ['c-eta-load', 'c-p-load', 'c-eta-t', 'c-p-t'].map($);

async function runCurves() {
  S.curvesBusy = true;
  const status = $('curves-status');
  const btn = $('btn-curves');
  btn.disabled = true;
  try {
    const op = { ...S.op, nGTon: Math.min(S.op.nGTon, S.cfg.nGT) };
    if (S.daily) op.Tamb = S.TambBase;
    S.curves = await computeCurves(S.cfg, S.des, op, (f) => { status.textContent = `Calcolo… ${Math.round(f * 100)} %`; });
    status.textContent = `Aria ${fmt(op.Tamb, 1)} °C, ${op.nGTon} TG in servizio`;
  } finally {
    S.curvesBusy = false;
    btn.disabled = false;
  }
  if (S.activeView === 'v-curves') renderCurves(curveCanvases(), S.curves, S.view && S.view.ss);
}

function updateButtons(v) {
  const st = S.sim.state;
  const dyn = S.mode === 'dyn';
  $('btn-start').disabled = !(dyn && st === 'FERMO');
  $('btn-stop').disabled = !(dyn && (st === 'IN_SERVIZIO' || st === 'AVVIAMENTO'));
  $('btn-trip').disabled = !(dyn && st !== 'FERMO' && st !== 'BLOCCO');
  $('btn-ack').hidden = !(dyn && st === 'BLOCCO');
  $('btn-ack').disabled = !(v.snap.speed <= 0);
}

function updateBrand() {
  const c = S.cfg;
  const gtShort = c.gtName.replace(/\s*\(.*\)/, '');
  setText('brand-sub', `${gtShort} · ${c.nGT}+1 · GVR ${HRSG_TYPES[c.steam.type]}`);
}

// ----------------------------------------------------------------- input esercizio
function bindRange(id, outId, apply, format) {
  const inp = $(id);
  const handler = () => {
    const val = parseFloat(inp.value);
    apply(val);
    $(outId).textContent = format(val);
  };
  inp.addEventListener('input', handler);
  handler();
}

function fillNGTon() {
  const sel = $('in-ngton');
  sel.innerHTML = '';
  for (let i = 1; i <= S.cfg.nGT; i++) {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = `${i} di ${S.cfg.nGT}`;
    sel.appendChild(o);
  }
  S.op.nGTon = Math.min(S.op.nGTon || S.cfg.nGT, S.cfg.nGT);
  sel.value = S.op.nGTon;
  $('f-ngton').hidden = S.cfg.nGT < 2;
}

function bindOperation() {
  bindRange('in-load', 'out-load', (v) => {
    S.op.load = v / 100;
    S.sim.setpoint = v / 100;
  }, (v) => `${fmt(v, 0)} %`);
  bindRange('in-ramp', 'out-ramp', (v) => { S.sim.rampPerMin = v; }, (v) => `${fmt(v, 0)} %/min`);
  bindRange('in-tamb', 'out-tamb', (v) => { S.TambBase = v; if (!S.daily) S.op.Tamb = v; S.curves = null; }, (v) => `${fmt(v, 1)} °C`);
  bindRange('in-pamb', 'out-pamb', (v) => { S.op.pamb = v / 1000; S.curves = null; }, (v) => `${fmt(v, 0)} mbar`);
  bindRange('in-rh', 'out-rh', (v) => { S.op.rh = v / 100; S.curves = null; }, (v) => `${fmt(v, 0)} %`);
  bindRange('in-tcw', 'out-tcw', (v) => { S.op.Tcw = v; S.curves = null; }, (v) => `${fmt(v, 1)} °C`);
  bindRange('in-dbt', 'out-dbt', (v) => { if ($('in-db').checked) S.op.ductT = v; }, (v) => `${fmt(v, 0)} °C`);
  $('in-db').addEventListener('change', (e) => {
    $('f-dbt').hidden = !e.target.checked;
    S.op.ductT = e.target.checked ? parseFloat($('in-dbt').value) : 0;
  });
  $('in-sliding').addEventListener('change', (e) => { S.op.slidingHP = e.target.checked; S.curves = null; });
  $('in-daily').addEventListener('change', (e) => {
    S.daily = e.target.checked;
    if (!S.daily) { S.op.Tamb = S.TambBase; $('out-tamb').textContent = `${fmt(S.TambBase, 1)} °C`; }
  });
  $('in-ngton').addEventListener('change', (e) => { S.op.nGTon = parseInt(e.target.value, 10); S.curves = null; });

  bindRange('m-gas', 'out-gas', (v) => { S.op.gasPrice = v; }, (v) => `${fmt(v, 0)} €/MWh`);
  bindRange('m-co2', 'out-co2', (v) => { S.op.co2Price = v; }, (v) => `${fmt(v, 0)} €/t`);
  bindRange('m-om', 'out-om', (v) => { S.op.omVar = v; }, (v) => `${fmt(v, 1)} €/MWh`);
  bindRange('m-pun', 'out-pun', (v) => { S.op.powerPrice = v; }, (v) => `${fmt(v, 0)} €/MWh`);
}

// ----------------------------------------------------------------- input progetto
const GT_FIELDS = [
  ['d-mair', 'mAirISO', 1], ['d-pr', 'PR', 1], ['d-tit', 'TIT', 1], ['d-cool', 'coolFrac', 100],
  ['d-etac', 'etaC', 1], ['d-etat', 'etaT', 1], ['d-tet', 'TETiso', 1], ['d-igv', 'igvMin', 100],
];
const ST_FIELDS = [['d-etahp', 'etaHP'], ['d-etaip', 'etaIP'], ['d-etalp', 'etaLP'], ['d-tstack', 'TstackMin'], ['d-trh', 'Trh']];

// Dati di catalogo del modello di TG accanto al punto ISO calcolato (verifica della taratura).
function gtRefText(c) {
  const g = GT_PRESETS[c.gtName];
  const f = g.freq ?? 50;
  const iso = S.des.gtRef;
  const parts = [`${f} Hz · ${f * 60} giri/min`, `ISO calcolato ${fmt(iso.Piso, 0)} MW, η ${fmt(iso.point.eta * 100, 1)} %, scarico ${fmt(iso.T4iso, 0)} °C`];
  if (g.ref) {
    const cc = [g.ref.cc11 ? `1+1 ${g.ref.cc11} MW` : '', g.ref.cc21 ? `2+1 ${g.ref.cc21} MW` : ''].filter(Boolean).join(', ');
    parts.push(`catalogo CC ${g.ref.basis}: ${cc ? cc + ', ' : ''}η ${fmt(g.ref.eta11, 1)} %`);
  }
  if (g.rampMWmin) parts.push(`rampa ${g.rampMWmin} MW/min`);
  return parts.join(' · ');
}

function syncDesignInputs() {
  const c = S.cfg;
  $('d-gt').value = c.gtName;
  setText('d-gt-ref', gtRefText(c));
  $('d-ngt').value = String(c.nGT);
  $('d-backup').value = c.backupFuel;
  $('d-hrsg').value = c.steam.type;
  $('d-fuel').value = c.fuelName;
  for (const [id, key, k] of GT_FIELDS) $(id).value = +(c.gt[key] * k).toFixed(4);
  for (const [id, key] of ST_FIELDS) $(id).value = c.steam[key];
  $('d-pinch').value = c.steam.pinch[0];
  $('f-trh').hidden = c.steam.type !== '3PRH';
  $('d-etaip').closest('.field').hidden = c.steam.type !== '3PRH';
  const cd = c.steam.condenser;
  $('d-cond').value = cd.type;
  $('d-tcwd').value = cd.TcwDesign;
  $('d-dtcw').value = cd.dTcw;
  $('d-ttd').value = cd.TTD;
  $('d-itd').value = cd.ITD;
  for (const e of document.querySelectorAll('.cond-water')) e.hidden = cd.type !== 'water';
  for (const e of document.querySelectorAll('.cond-air')) e.hidden = cd.type !== 'air';
  $('f-tcw').hidden = cd.type !== 'water';
  buildLevelInputs();
}

function buildLevelInputs() {
  const box = $('d-levels');
  const c = S.cfg.steam;
  const names = LEVEL_NAMES[c.type];
  box.innerHTML = '';
  c.levels.forEach((l, k) => {
    const row = document.createElement('div');
    row.className = 'level-row';
    const pLabel = c.type === '3PRH' && k === 1 ? 'p RH freddo' : 'p ammissione';
    row.innerHTML = `
      <span class="lvl" style="color:var(--${names[k].toLowerCase()})">${names[k]}</span>
      <div class="field"><label for="d-lp-${k}">${pLabel} <span class="u">bar</span></label><input type="number" id="d-lp-${k}" step="${k === 0 ? 5 : 0.5}" min="1.5" max="${k === 0 ? LIMITS.pHPmax : 80}" value="${l.p}"></div>
      <div class="field"><label for="d-lt-${k}">T surrisc. <span class="u">°C</span></label><input type="number" id="d-lt-${k}" step="5" max="${LIMITS.TshMax}" value="${l.Tsh}"></div>`;
    box.appendChild(row);
    row.querySelector(`#d-lp-${k}`).addEventListener('change', (e) => { c.levels[k].p = parseFloat(e.target.value); scheduleRedesign(); });
    row.querySelector(`#d-lt-${k}`).addEventListener('change', (e) => { c.levels[k].Tsh = parseFloat(e.target.value); scheduleRedesign(); });
  });
}

let redesignTimer = null;
function scheduleRedesign() {
  clearTimeout(redesignTimer);
  redesignTimer = setTimeout(() => {
    redesign();
    S.mimicSig = '';
    tick();
  }, 150);
}

function newConfig(gtName, type, keep) {
  const c = defaultConfig(gtName, type);
  if (keep) {
    c.nGT = keep.nGT;
    c.fuelName = keep.fuelName;
    c.fuelComp = { ...keep.fuelComp };
    c.steam.condenser = { ...keep.steam.condenser };
    c.backupFuel = keep.backupFuel;
  }
  return c;
}

function bindDesign() {
  const gtSel = $('d-gt');
  for (const [label, names] of GT_GROUPS) {
    const og = document.createElement('optgroup');
    og.label = label;
    for (const name of names) og.appendChild(new Option(name, name));
    gtSel.appendChild(og);
  }
  const fSel = $('d-fuel');
  for (const name of Object.keys(FUEL_PRESETS)) fSel.add(new Option(name, name));

  gtSel.addEventListener('change', () => {
    S.cfg = newConfig(gtSel.value, S.cfg.steam.type, S.cfg);
    // gradiente di carico di catalogo (MW/min) riportato in %/min del carico base
    const g = GT_PRESETS[gtSel.value];
    if (g.rampMWmin) {
      const ramp = $('in-ramp');
      ramp.value = String(Math.round(Math.min(20, Math.max(1, (g.rampMWmin / parseFloat(gtSel.value.match(/\((\d+) MW\)/)[1])) * 100))));
      ramp.dispatchEvent(new Event('input'));
    }
    scheduleRedesign();
  });
  $('d-hrsg').addEventListener('change', (e) => { S.cfg = newConfig(S.cfg.gtName, e.target.value, S.cfg); scheduleRedesign(); });
  $('d-ngt').addEventListener('change', (e) => { S.cfg.nGT = parseInt(e.target.value, 10); S.op.nGTon = S.cfg.nGT; scheduleRedesign(); });
  $('d-backup').addEventListener('change', (e) => { S.cfg.backupFuel = e.target.value; scheduleRedesign(); });
  fSel.addEventListener('change', () => { S.cfg.fuelName = fSel.value; S.cfg.fuelComp = { ...FUEL_PRESETS[fSel.value] }; scheduleRedesign(); });
  for (const [id, key, k] of GT_FIELDS) {
    $(id).addEventListener('change', (e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) { S.cfg.gt[key] = v / k; scheduleRedesign(); } });
  }
  for (const [id, key] of ST_FIELDS) {
    $(id).addEventListener('change', (e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) { S.cfg.steam[key] = v; scheduleRedesign(); } });
  }
  $('d-pinch').addEventListener('change', (e) => {
    const v = Math.max(3, parseFloat(e.target.value));
    S.cfg.steam.pinch = S.cfg.steam.pinch.map(() => v);
    scheduleRedesign();
  });
  $('d-cond').addEventListener('change', (e) => { S.cfg.steam.condenser.type = e.target.value; scheduleRedesign(); });
  for (const [id, key] of [['d-tcwd', 'TcwDesign'], ['d-dtcw', 'dTcw'], ['d-ttd', 'TTD'], ['d-itd', 'ITD']]) {
    $(id).addEventListener('change', (e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) { S.cfg.steam.condenser[key] = v; scheduleRedesign(); } });
  }
  $('btn-reset-design').addEventListener('click', () => {
    S.cfg = newConfig(S.cfg.gtName, S.cfg.steam.type, null);
    scheduleRedesign();
  });
}

// ----------------------------------------------------------------- comandi e schede
function bindControls() {
  const setMode = (m) => {
    S.mode = m;
    $('mode-dyn').classList.toggle('is-on', m === 'dyn');
    $('mode-ss').classList.toggle('is-on', m === 'ss');
    $('mode-dyn').setAttribute('aria-checked', String(m === 'dyn'));
    $('mode-ss').setAttribute('aria-checked', String(m === 'ss'));
    for (const e of document.querySelectorAll('.dyn-only')) e.hidden = m !== 'dyn';
    $('lbl-load').textContent = m === 'dyn' ? 'Set-point carico TG' : 'Carico TG';
    if (m === 'ss' && S.daily) { S.op.Tamb = S.TambBase; }
    tick();
  };
  $('mode-dyn').addEventListener('click', () => setMode('dyn'));
  $('mode-ss').addEventListener('click', () => setMode('ss'));
  $('btn-play').addEventListener('click', () => {
    S.running = !S.running;
    $('play-icon').setAttribute('d', S.running ? 'M4 3h3v10H4zM9 3h3v10H9z' : 'M4 2l10 6-10 6z');
    $('btn-play').setAttribute('aria-label', S.running ? 'Pausa' : 'Riprendi');
  });
  $('sim-speed').addEventListener('change', (e) => { S.speed = parseFloat(e.target.value); });
  $('btn-start').addEventListener('click', () => { S.sim.start(); tick(); });
  $('btn-stop').addEventListener('click', () => { S.sim.stop(); tick(); });
  $('btn-trip').addEventListener('click', () => { S.sim.trip(); tick(); });
  $('btn-ack').addEventListener('click', () => { S.sim.reset(); tick(); });
  $('btn-curves').addEventListener('click', () => { S.curves = null; runCurves(); });

  // schede del pannello
  for (const t of document.querySelectorAll('.panel .tab')) {
    t.addEventListener('click', () => {
      for (const o of document.querySelectorAll('.panel .tab')) {
        const on = o === t;
        o.classList.toggle('is-on', on);
        o.setAttribute('aria-selected', String(on));
        $(o.dataset.tab).hidden = !on;
      }
    });
  }
  // schede di analisi
  for (const t of document.querySelectorAll('.analysis .tab')) {
    t.addEventListener('click', () => {
      for (const o of document.querySelectorAll('.analysis .tab')) {
        const on = o === t;
        o.classList.toggle('is-on', on);
        o.setAttribute('aria-selected', String(on));
        $(o.dataset.view).hidden = !on;
      }
      S.activeView = t.dataset.view;
      S.lastAnalysis = 0;
      renderAnalysis();
    });
  }

  // tema
  const applyTheme = (th) => {
    if (th) document.documentElement.setAttribute('data-theme', th);
    else document.documentElement.removeAttribute('data-theme');
    S.mimicSig = '';
    setTimeout(() => {
      redrawAll([$('c-tq'), $('c-ts'), $('c-trend-p'), $('c-trend-t'), ...curveCanvases()]);
      tick();
    }, 0);
  };
  try {
    const saved = localStorage.getItem('ccgt-theme');
    if (saved) applyTheme(saved);
  } catch (e) { /* archiviazione non disponibile */ }
  $('btn-theme').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = cur ? cur === 'dark' : sysDark;
    const next = isDark ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('ccgt-theme', next); } catch (e) { /* ignora */ }
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(document.documentElement.getAttribute('data-theme')));
}

// ----------------------------------------------------------------- avvio
function init() {
  bindDesign();
  bindOperation();
  bindControls();
  redesign();
  S.docs = initDocs(() => ({ cfg: S.cfg, des: S.des }));
  S.sim.log('Simulatore avviato: unità in servizio a carico base');
  tick();
  setInterval(tick, TICK_MS);
}

init();
