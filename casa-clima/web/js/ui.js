// Componenti e utilità condivise dell'interfaccia.
import { icon, entityIcon } from './icons.js';
import { store, api, callService, getState, deviceOf } from './store.js';

// ------------------------------------------------------------------ formattazione

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const isNum = (v) => v !== null && v !== '' && v !== undefined && !Number.isNaN(Number(v)) && typeof v !== 'boolean';

export function fmtNum(v, digits = 1) {
  if (!isNum(v)) return '–';
  return Number(v).toLocaleString('it-IT', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}
export function fmtTemp(v, digits = 1) {
  return isNum(v) ? `${fmtNum(v, digits)}°` : '–';
}
export function fmtPower(w) {
  if (!isNum(w)) return '–';
  const n = Number(w);
  return Math.abs(n) >= 1000 ? `${fmtNum(n / 1000, 2)} kW` : `${Math.round(n)} W`;
}
export function relTime(iso) {
  if (!iso) return 'mai';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 45) return 'adesso';
  if (s < 3600) return `${Math.round(s / 60)} min fa`;
  if (s < 86400) return `${Math.round(s / 3600)} h fa`;
  if (s < 172800) return 'ieri';
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}
export function clock(iso) {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

export const HVAC_LABEL = { off: 'Spento', heat: 'Caldo', cool: 'Freddo', auto: 'Auto', heat_cool: 'Clima', dry: 'Deumidifica', fan_only: 'Ventola' };
export const HVAC_ICON = { off: 'power', heat: 'flame', cool: 'snowflake', auto: 'calendar', heat_cool: 'thermometer', dry: 'droplet', fan_only: 'fan' };
export const ACTION_LABEL = { heating: 'Sta scaldando', cooling: 'Sta raffrescando', drying: 'Deumidifica', fan: 'Ventila', idle: 'In attesa', off: 'Spento' };
export function actionChip(action) {
  if (!action) return '';
  const cls = action === 'heating' ? 'heat' : action === 'cooling' ? 'cool' : action === 'drying' || action === 'fan' ? 'accent' : '';
  const ic = action === 'heating' ? 'flame' : action === 'cooling' ? 'snowflake' : action === 'drying' ? 'droplet' : action === 'fan' ? 'fan' : action === 'off' ? 'power' : 'thermometer';
  return `<span class="chip ${cls}">${icon(ic)}${ACTION_LABEL[action] || esc(action)}</span>`;
}

const DOMAIN_STATE = {
  on: 'Acceso', off: 'Spento', locked: 'Chiuso', unlocked: 'Aperto', open: 'Aperta', closed: 'Chiusa',
  opening: 'In apertura', closing: 'In chiusura', unavailable: 'Non disponibile', unknown: 'Sconosciuto',
  charging: 'In carica', stopped: 'Ferma', complete: 'Completata', disconnected: 'Scollegata', starting: 'Avvio', no_power: 'Senza corrente',
  home: 'In casa', away: 'Fuori casa', schedule: 'Programma', hg: 'Antigelo'
};

export function stateText(st) {
  if (!st) return '–';
  const [domain] = st.entity_id.split('.');
  const a = st.attributes;
  const s = st.state;
  if (s === 'unavailable') return 'Non disponibile';
  if (domain === 'climate') return `${HVAC_LABEL[s] || s}${s !== 'off' && isNum(a.temperature) ? ` · ${fmtTemp(a.temperature)}` : ''}`;
  if (domain === 'binary_sensor') {
    const dc = a.device_class;
    if (dc === 'window' || dc === 'door') return s === 'on' ? 'Aperta' : 'Chiusa';
    if (dc === 'motion') return s === 'on' ? 'Movimento' : 'Nessun movimento';
    if (dc === 'connectivity') return s === 'on' ? 'Connesso' : 'Disconnesso';
    return s === 'on' ? 'Attivo' : 'Inattivo';
  }
  if (domain === 'select') return a.labels?.[s] || s;
  if (domain === 'cover' && isNum(a.current_position)) return `${DOMAIN_STATE[s] || s} · ${a.current_position}%`;
  if (domain === 'light' && s === 'on' && isNum(a.brightness_pct)) return `Accesa · ${a.brightness_pct}%`;
  if (domain === 'light') return s === 'on' ? 'Accesa' : 'Spenta';
  if (domain === 'button' || domain === 'scene') return s ? relTime(s) : 'Mai';
  if (domain === 'weather') return `${a.label || s} · ${fmtTemp(a.temperature)}`;
  if (domain === 'automation') return s === 'on' ? 'Attiva' : 'Disattivata';
  if (isNum(s)) {
    const u = a.unit_of_measurement || '';
    if (u === 'W') return fmtPower(s);
    return `${fmtNum(s, 1)}${u === '°C' ? '°' : u ? ` ${u}` : ''}`;
  }
  if (s === null || s === undefined) return '–';
  return DOMAIN_STATE[s] || String(s);
}

// ------------------------------------------------------------------ toast e modale

export function toast(message, kind = 'info', ms = 3500) {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `${icon(kind === 'err' ? 'alert' : kind === 'ok' ? 'check' : 'info')}<div>${esc(message)}</div>`;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), ms);
}

/** Chiama un servizio mostrando l'eventuale errore. */
export async function svc(domain, service, data, { ok } = {}) {
  try {
    const r = await callService(domain, service, data);
    if (ok) toast(ok, 'ok');
    return r;
  } catch (err) {
    toast(err.message, 'err', 6000);
    throw err;
  }
}

let modalClose = null;
export function openModal(html, { wide = false, onClose } = {}) {
  closeModal();
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-bg"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div></div>`;
  const bg = root.firstElementChild;
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) closeModal(); });
  modalClose = onClose || null;
  document.body.style.overflow = 'hidden';
  return bg.firstElementChild;
}
export function closeModal() {
  const root = document.getElementById('modal-root');
  if (!root.innerHTML) return;
  root.innerHTML = '';
  document.body.style.overflow = '';
  const fn = modalClose;
  modalClose = null;
  fn?.();
}
export function modalOpen() {
  return Boolean(document.getElementById('modal-root').innerHTML);
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

export function confirmBox(message, { ok = 'Conferma', danger = false } = {}) {
  return new Promise((resolve) => {
    const m = openModal(`<div class="modal-head"><h2>${esc(message)}</h2></div>
      <div class="row" style="justify-content:flex-end"><button class="btn" data-no>Annulla</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(ok)}</button></div>`, { onClose: () => resolve(false) });
    m.querySelector('[data-yes]').onclick = () => { modalClose = null; closeModal(); resolve(true); };
    m.querySelector('[data-no]').onclick = () => closeModal();
  });
}

export function copyText(text) {
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => toast('Copiato', 'ok', 1500)).catch(() => fallbackCopy(text));
  else fallbackCopy(text);
}
function fallbackCopy(text) {
  const t = document.createElement('textarea');
  t.value = text;
  document.body.appendChild(t);
  t.select();
  try { document.execCommand('copy'); toast('Copiato', 'ok', 1500); } catch { toast('Copia non riuscita', 'err'); }
  t.remove();
}

// ------------------------------------------------------------------ termostato a quadrante

const R = 84;
const C = 100;
function polar(deg) {
  const r = (deg * Math.PI) / 180;
  return [C + R * Math.cos(r), C + R * Math.sin(r)];
}
function arc(a0, a1) {
  const [x0, y0] = polar(a0);
  const [x1, y1] = polar(a1);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
const valueToAngle = (v, min, max) => 135 + (270 * (Math.min(max, Math.max(min, v)) - min)) / (max - min || 1);

export function climateTarget(st) {
  const p = store.pending.get(st.entity_id);
  if (p && Date.now() < p.until) return p.temperature;
  return st.attributes.temperature;
}

/** HTML del quadrante per un'entità climate. */
export function dialHTML(st, { size = 230 } = {}) {
  const a = st.attributes;
  const min = Number(a.min_temp ?? 7);
  const max = Number(a.max_temp ?? 30);
  const target = climateTarget(st);
  const off = st.state === 'off' || st.state === 'unavailable';
  const hasTarget = isNum(target) && !off && !a.read_only_setpoint;
  const color = st.state === 'cool' ? 'var(--cool)' : st.state === 'heat' || a.hvac_action === 'heating' ? 'var(--heat)' : st.state === 'off' ? 'var(--faint)' : 'var(--accent)';
  const cur = a.current_temperature;
  const ta = hasTarget ? valueToAngle(Number(target), min, max) : null;
  const ca = isNum(cur) ? valueToAngle(Number(cur), min, max) : null;
  let active = '';
  if (hasTarget && ca !== null) {
    const [s, e] = ca < ta ? [ca, ta] : [ta, ca];
    if (e - s > 0.5) active = `<path d="${arc(s, e)}" stroke="${color}" stroke-opacity=".35" stroke-width="14" fill="none" stroke-linecap="round"/>`;
  }
  const [tx, ty] = ta !== null ? polar(ta) : [0, 0];
  const [cx, cy] = ca !== null ? polar(ca) : [0, 0];
  return `<div class="dial" data-dial="${esc(st.entity_id)}" data-min="${min}" data-max="${max}" data-step="${Number(a.target_temp_step) || 0.5}" style="width:${size}px">
    <svg viewBox="0 0 200 200">
      <path d="${arc(135, 405)}" stroke="var(--surface-3)" stroke-width="14" fill="none" stroke-linecap="round"/>
      ${hasTarget ? `<path d="${arc(135, ta)}" stroke="${color}" stroke-width="14" fill="none" stroke-linecap="round" class="track"/>` : ''}
      ${active}
      ${ca !== null ? `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4" fill="var(--text)" opacity=".85"/>` : ''}
      ${hasTarget ? `<circle class="thumb" cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="11" fill="var(--surface)" stroke="${color}" stroke-width="5"/>` : ''}
    </svg>
    <div class="center">
      <div class="t num ${hasTarget || isNum(cur) && !off ? '' : 'word'}" data-dial-value>${hasTarget ? `${fmtNum(target)}<small>°C</small>` : off ? 'Spento' : isNum(cur) ? `${fmtNum(cur)}<small>°C</small>` : '–'}</div>
      <div class="s">${hasTarget ? `Attuale ${fmtTemp(cur)}` : st.state === 'auto' ? 'Segue il programma' : isNum(cur) ? 'Temperatura attuale' : ''}${isNum(a.current_humidity) ? ` · ${a.current_humidity}%` : ''}</div>
      <div class="a">${actionChip(a.hvac_action)}</div>
    </div>
  </div>`;
}

const sendTimers = new Map();
/** Imposta (con ritardo) un nuovo setpoint: aggiorna subito l'interfaccia, invia dopo 700 ms. */
export function setTargetDebounced(entity_id, value, render) {
  store.pending.set(entity_id, { temperature: value, until: Date.now() + 12000 });
  render?.();
  clearTimeout(sendTimers.get(entity_id));
  sendTimers.set(entity_id, setTimeout(() => {
    svc('climate', 'set_temperature', { entity_id, temperature: value }).catch(() => store.pending.delete(entity_id));
  }, 700));
}

export function stepTarget(entity_id, dir) {
  const st = getState(entity_id);
  if (!st) return;
  const a = st.attributes;
  const step = Number(a.target_temp_step) || 0.5;
  const cur = Number(climateTarget(st) ?? a.current_temperature ?? 20);
  const next = Math.min(Number(a.max_temp ?? 30), Math.max(Number(a.min_temp ?? 7), Math.round((cur + dir * step) / step) * step));
  setTargetDebounced(entity_id, Math.round(next * 10) / 10, () => updateDialDOM(entity_id));
}

/** Aggiorna il quadrante sul posto (senza ridisegnare la pagina). */
export function updateDialDOM(entity_id) {
  const st = getState(entity_id);
  if (!st) return;
  for (const el of document.querySelectorAll(`[data-dial="${CSS.escape(entity_id)}"]`)) {
    const tmp = document.createElement('div');
    tmp.innerHTML = dialHTML(st, { size: el.offsetWidth || 230 });
    el.replaceWith(tmp.firstElementChild);
  }
}

// trascinamento del quadrante
let drag = null;
document.addEventListener('pointerdown', (e) => {
  const dial = e.target.closest('[data-dial]');
  if (!dial || !dial.querySelector('.thumb')) return;
  const svg = dial.querySelector('svg');
  drag = { dial, id: dial.dataset.dial, svg, min: +dial.dataset.min, max: +dial.dataset.max, step: +dial.dataset.step };
  dial.classList.add('dragging');
  window.__ccBusy = true;
  dial.setPointerCapture?.(e.pointerId);
  moveDial(e);
  e.preventDefault();
});
document.addEventListener('pointermove', (e) => { if (drag) moveDial(e); });
document.addEventListener('pointerup', () => {
  if (!drag) return;
  const { id, value } = drag;
  drag.dial.classList.remove('dragging');
  drag = null;
  window.__ccBusy = false;
  if (value !== undefined) setTargetDebounced(id, value, () => updateDialDOM(id));
});
function moveDial(e) {
  const r = drag.svg.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * 200;
  const y = ((e.clientY - r.top) / r.height) * 200;
  let deg = (Math.atan2(y - C, x - C) * 180) / Math.PI;
  let rel = (deg - 135 + 720) % 360;
  if (rel > 270) rel = rel > 315 ? 0 : 270;
  const raw = drag.min + (rel / 270) * (drag.max - drag.min);
  const v = Math.round(Math.round(raw / drag.step) * drag.step * 10) / 10;
  if (v === drag.value) return;
  drag.value = v;
  // aggiornamento visivo immediato
  const st = getState(drag.id);
  if (!st) return;
  store.pending.set(drag.id, { temperature: v, until: Date.now() + 12000 });
  const tmp = document.createElement('div');
  tmp.innerHTML = dialHTML(st, { size: drag.dial.offsetWidth });
  const fresh = tmp.firstElementChild;
  drag.dial.querySelector('svg').replaceWith(fresh.querySelector('svg'));
  drag.dial.querySelector('.center').replaceWith(fresh.querySelector('.center'));
  drag.svg = drag.dial.querySelector('svg');
}

/** Scheda completa per un'entità climate: quadrante, +/- e modalità. */
export function thermostatCard(st, { title, compact = false } = {}) {
  const a = st.attributes;
  const modes = a.hvac_modes || [];
  const dev = deviceOf(st.entity_id);
  const unavailable = st.state === 'unavailable';
  return `<div class="card thermo" data-entity="${esc(st.entity_id)}">
    <div class="card-head" style="width:100%">
      <div class="ico-wrap ${st.state === 'cool' ? 'cool' : st.state === 'off' ? '' : 'heat'}">${icon(entityIcon(st))}</div>
      <div style="min-width:0;flex:1">
        <div class="title">${esc(title || a.friendly_name)}</div>
        <div class="tiny muted">${esc(dev?.manufacturer || '')}${dev?.model ? ` · ${esc(dev.model)}` : ''}</div>
      </div>
      <button class="btn icon sm ghost" data-act="more" data-id="${esc(st.entity_id)}" title="Dettagli">${icon('dots')}</button>
    </div>
    ${unavailable ? '<div class="empty small">Dispositivo non raggiungibile</div>' : `
    ${dialHTML(st, { size: compact ? 190 : 220 })}
    <div class="thermo-ctrl">
      <button class="btn icon round" data-act="temp-down" data-id="${esc(st.entity_id)}" aria-label="Diminuisci" ${st.state === 'off' || st.state === 'auto' && !isNum(a.temperature) ? 'disabled' : ''}>${icon('minus')}</button>
      <span class="small muted">${a.overlay ? 'Manuale' : st.state === 'auto' ? 'Programma' : ''}</span>
      <button class="btn icon round" data-act="temp-up" data-id="${esc(st.entity_id)}" aria-label="Aumenta" ${st.state === 'off' || st.state === 'auto' && !isNum(a.temperature) ? 'disabled' : ''}>${icon('plus')}</button>
    </div>
    <div class="modes">${modes.map((m) => `<button class="mode-btn ${st.state === m ? `active ${m === 'heat' ? 'heat' : m === 'cool' ? 'cool' : m === 'off' ? 'off' : ''}` : ''}" data-act="hvac" data-id="${esc(st.entity_id)}" data-mode="${m}">${icon(HVAC_ICON[m] || 'thermometer')}${HVAC_LABEL[m] || m}</button>`).join('')}</div>
    ${a.fan_modes?.length && st.state !== 'off' ? `<div class="row small"><span class="muted">Ventola</span><select class="input" style="width:auto;padding:6px 10px" data-act="fan" data-id="${esc(st.entity_id)}">${a.fan_modes.map((f) => `<option value="${esc(f)}" ${f === a.fan_mode ? 'selected' : ''}>${f === 'auto' ? 'Automatica' : f === 'quiet' ? 'Silenziosa' : `Velocità ${esc(f)}`}</option>`).join('')}</select></div>` : ''}
    `}
  </div>`;
}

// ------------------------------------------------------------------ controlli per riga entità

export function toggleHTML(st, act = 'toggle') {
  const on = st.state === 'on';
  return `<label class="switch" title="${on ? 'Spegni' : 'Accendi'}"><input type="checkbox" data-act="${act}" data-id="${esc(st.entity_id)}" ${on ? 'checked' : ''} ${st.state === 'unavailable' ? 'disabled' : ''}><span></span></label>`;
}

export function controlHTML(st) {
  const [domain] = st.entity_id.split('.');
  const id = esc(st.entity_id);
  const a = st.attributes;
  if (st.state === 'unavailable') return '';
  switch (domain) {
    case 'switch':
    case 'light':
    case 'automation':
      return toggleHTML(st);
    case 'binary_sensor':
      return a.simulated ? toggleHTML(st) : '';
    case 'cover':
      return `<button class="btn icon sm" data-act="cover" data-svc="open_cover" data-id="${id}" title="Apri">${icon('up')}</button>
        <button class="btn icon sm" data-act="cover" data-svc="stop_cover" data-id="${id}" title="Ferma">${icon('stop')}</button>
        <button class="btn icon sm" data-act="cover" data-svc="close_cover" data-id="${id}" title="Chiudi">${icon('down')}</button>`;
    case 'lock':
      return `<button class="btn sm" data-act="lock" data-id="${id}">${icon(st.state === 'locked' ? 'unlock' : 'lock')}${st.state === 'locked' ? 'Apri' : 'Chiudi'}</button>`;
    case 'button':
      return `<button class="btn sm" data-act="press" data-id="${id}">Premi</button>`;
    case 'scene':
      return `<button class="btn sm" data-act="scene" data-id="${id}">${icon('play')}Attiva</button>`;
    case 'select':
      return `<select class="input" style="width:auto;padding:6px 10px" data-act="select" data-id="${id}">${(a.options || []).map((o) => `<option value="${esc(o)}" ${o === st.state ? 'selected' : ''}>${esc(a.labels?.[o] || o)}</option>`).join('')}</select>`;
    case 'climate':
      return `<button class="btn icon sm" data-act="temp-down" data-id="${id}" ${st.state === 'off' ? 'disabled' : ''}>${icon('minus')}</button><button class="btn icon sm" data-act="temp-up" data-id="${id}" ${st.state === 'off' ? 'disabled' : ''}>${icon('plus')}</button>`;
    default:
      return '';
  }
}

export function entityRow(st, { sub } = {}) {
  const [domain] = st.entity_id.split('.');
  const on = ['on', 'heat', 'cool', 'heat_cool', 'auto', 'dry', 'fan_only', 'open', 'unlocked'].includes(st.state);
  const cls = st.state === 'heat' ? 'heat' : st.state === 'cool' ? 'cool' : on ? 'on' : '';
  const showVal = !['switch', 'light', 'automation'].includes(domain);
  return `<div class="ent" data-entity="${esc(st.entity_id)}">
    <div class="ico-wrap ${cls}">${icon(entityIcon(st))}</div>
    <div class="info" data-act="more" data-id="${esc(st.entity_id)}">
      <div class="name">${esc(st.attributes.friendly_name)}</div>
      <div class="sub">${sub !== undefined ? sub : showVal ? '' : stateText(st)}</div>
    </div>
    ${showVal ? `<div class="val num ${st.state === 'unavailable' ? 'faint' : ''}">${esc(stateText(st))}</div>` : ''}
    <div class="ctrl">${controlHTML(st)}</div>
  </div>`;
}

// ------------------------------------------------------------------ grafici (SVG)

const charts = new Map();
let chartSeq = 0;
export const PALETTE = ['#4f9dff', '#ff8a3d', '#3ecf8e', '#c084fc', '#f5b942', '#3db8ff', '#ff5d8f', '#9aa3b2'];

/**
 * series: [{ name, color, points: [[t, v], ...], unit, step, dashed, fill }]
 */
export function lineChart(series, { height = 220, hours = 24, unit = '', yMin, yMax, hidden = new Set() } = {}) {
  const id = `ch${++chartSeq}`;
  const W = 800;
  const H = height;
  const padL = 40, padR = 10, padT = 10, padB = 24;
  const now = Date.now();
  const visible = series.filter((s) => !hidden.has(s.name));
  // se lo storico è più corto del periodo scelto, l'asse parte dal primo dato
  const first = Math.min(...visible.flatMap((s) => s.points.filter((p) => isNum(p[1])).map((p) => p[0])), now);
  const t0 = Math.max(now - hours * 3600_000, Math.min(first, now - 15 * 60_000));
  const vals = visible.flatMap((s) => s.points.filter((p) => p[0] >= t0 - 3600_000).map((p) => p[1])).filter((v) => isNum(v));
  if (!vals.length) {
    charts.set(id, null);
    return `<div class="chart" id="${id}"><div class="empty small">${icon('chart')}<div>Nessun dato ancora: lo storico si riempie col tempo.</div></div></div>`;
  }
  let lo = yMin ?? Math.min(...vals);
  let hi = yMax ?? Math.max(...vals);
  if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
  const pad = (hi - lo) * 0.08;
  lo -= pad; hi += pad;
  const X = (t) => padL + ((t - t0) / (now - t0)) * (W - padL - padR);
  const Y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const ticks = 4;
  let grid = '';
  for (let i = 0; i <= ticks; i++) {
    const v = lo + ((hi - lo) * i) / ticks;
    const y = Y(v);
    grid += `<line class="grid-line" x1="${padL}" x2="${W - padR}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"/><text class="axis" x="${padL - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end">${fmtNum(v, Math.abs(hi - lo) < 10 ? 1 : 0)}</text>`;
  }
  const span = now - t0;
  const xt = span <= 2 * 3600_000 ? 15 * 60_000 : span <= 8 * 3600_000 ? 3600_000 : span <= 30 * 3600_000 ? 4 * 3600_000 : 24 * 3600_000;
  const offset = xt >= 24 * 3600_000 ? new Date().getTimezoneOffset() * 60_000 : 0;
  const firstTick = Math.ceil((t0 - offset) / xt) * xt + offset;
  for (let t = firstTick; t <= now; t += xt) {
    const d = new Date(t);
    const label = xt < 24 * 3600_000 ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' });
    grid += `<text class="axis" x="${X(t).toFixed(1)}" y="${H - 6}" text-anchor="middle">${label}</text>`;
  }
  let paths = '';
  for (const s of visible) {
    const pts = s.points.filter((p) => isNum(p[1]));
    if (!pts.length) continue;
    // estendo l'ultimo valore fino ad adesso
    const ext = [...pts, [now, pts[pts.length - 1][1]]].map(([t, v]) => [Math.max(t, t0), v]);
    let d = '';
    ext.forEach(([t, v], i) => {
      const x = X(t).toFixed(1);
      const y = Y(v).toFixed(1);
      if (i === 0) d += `M${x} ${y}`;
      else if (s.step) d += `H${x}V${y}`;
      else d += `L${x} ${y}`;
    });
    if (s.fill) paths += `<path d="${d}V${Y(lo).toFixed(1)}H${X(ext[0][0]).toFixed(1)}Z" fill="${s.color}" opacity=".12"/>`;
    paths += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" ${s.dashed ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round"/>`;
  }
  charts.set(id, { series: visible, t0, now, X, W, padL, padR, unit });
  return `<div class="chart" id="${id}" data-chart="${id}">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:${H}px">${grid}${paths}<line class="cursor" x1="0" x2="0" y1="${padT}" y2="${H - padB}" stroke="var(--muted)" stroke-dasharray="3 3" opacity="0"/></svg>
  </div>`;
}

export function legendHTML(series, hidden, act = 'legend') {
  return `<div class="legend">${series.map((s) => `<span class="${hidden.has(s.name) ? 'off' : ''}" data-act="${act}" data-name="${esc(s.name)}"><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`;
}

function valueAt(points, t) {
  let v = null;
  for (const p of points) { if (p[0] <= t) v = p[1]; else break; }
  return v;
}
document.addEventListener('pointermove', (e) => {
  const el = e.target.closest?.('[data-chart]');
  document.querySelectorAll('.chart .tip').forEach((t) => { if (!el || !el.contains(t)) t.remove(); });
  if (!el) { document.querySelectorAll('.chart .cursor').forEach((c) => c.setAttribute('opacity', 0)); return; }
  const c = charts.get(el.dataset.chart);
  if (!c) return;
  const r = el.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * c.W;
  if (x < c.padL || x > c.W - c.padR) return;
  const t = c.t0 + ((x - c.padL) / (c.W - c.padL - c.padR)) * (c.now - c.t0);
  const rows = c.series.map((s) => {
    const v = valueAt(s.points, t);
    return v === null ? '' : `<div><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${s.color};margin-right:6px"></i>${esc(s.name)}: <b>${s.unit === 'W' ? fmtPower(v) : `${fmtNum(v)}${s.unit ?? c.unit}`}</b></div>`;
  }).join('');
  let tip = el.querySelector('.tip');
  if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; el.appendChild(tip); }
  const d = new Date(t);
  tip.innerHTML = `<div class="muted">${d.toLocaleString('it-IT', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</div>${rows}`;
  const left = e.clientX - r.left;
  tip.style.left = `${Math.min(left + 12, r.width - tip.offsetWidth - 4)}px`;
  tip.style.top = '6px';
  const cursor = el.querySelector('.cursor');
  cursor.setAttribute('x1', x); cursor.setAttribute('x2', x); cursor.setAttribute('opacity', 0.7);
});

// ------------------------------------------------------------------ finestra "dettagli entità"

export async function moreInfo(entity_id) {
  const render = async () => {
    const st = getState(entity_id);
    if (!st) return closeModal();
    const [domain] = entity_id.split('.');
    const a = st.attributes;
    const dev = deviceOf(entity_id);
    let body = '';
    if (domain === 'climate') body = thermostatCard(st).replace('class="card thermo"', 'class="thermo"');
    else if (domain === 'light') {
      body = `<div class="stack"><div class="row"><span class="spacer">${esc(stateText(st))}</span>${toggleHTML(st)}</div>
        <div class="field"><label>Luminosità ${isNum(a.brightness_pct) ? `${a.brightness_pct}%` : ''}</label><input type="range" min="1" max="100" value="${a.brightness_pct ?? 100}" data-act="brightness" data-id="${esc(entity_id)}"></div></div>`;
    } else if (domain === 'cover') {
      body = `<div class="stack"><div class="row"><b class="spacer">${esc(stateText(st))}</b>${controlHTML(st)}</div>
        ${isNum(a.current_position) ? `<div class="field"><label>Posizione</label><input type="range" min="0" max="100" step="5" value="${a.current_position}" data-act="position" data-id="${esc(entity_id)}"></div>` : ''}</div>`;
    } else if (domain === 'number') {
      body = `<div class="field"><label>Valore: <b>${esc(stateText(st))}</b></label><input type="range" min="${a.min ?? 0}" max="${a.max ?? 100}" step="${a.step ?? 1}" value="${st.state ?? 0}" data-act="number" data-id="${esc(entity_id)}"></div>`;
    } else {
      body = `<div class="row"><div class="big-temp" style="font-size:34px">${esc(stateText(st))}</div><span class="spacer"></span>${controlHTML(st)}</div>`;
    }
    const numeric = isNum(st.state) || domain === 'climate';
    let chart = '';
    if (numeric) {
      try {
        const h = await api('GET', `/api/history?entity_id=${encodeURIComponent(entity_id)}&hours=24`);
        const pts = h[entity_id] || [];
        const series = domain === 'climate'
          ? [{ name: 'Temperatura', color: PALETTE[0], points: pts.map((p) => [p[0], p[1]]), unit: '°' }, { name: 'Impostata', color: PALETTE[1], points: pts.map((p) => [p[0], p[2]]), step: true, dashed: true, unit: '°' }]
          : [{ name: a.friendly_name, color: PALETTE[0], points: pts, unit: a.unit_of_measurement === '°C' ? '°' : a.unit_of_measurement || '', fill: true }];
        chart = `<div class="section-title" style="margin-top:20px">Ultime 24 ore</div>${lineChart(series, { height: 160, hours: 24 })}`;
      } catch { /* niente storico */ }
    }
    const skip = new Set(['friendly_name', 'icon', 'forecast', 'hourly', 'hvac_modes', 'fan_modes', 'swing_modes', 'options', 'labels']);
    const attrs = Object.entries(a).filter(([k, v]) => !skip.has(k) && v !== null && v !== undefined && typeof v !== 'object');
    const areas = await api('GET', '/api/areas').catch(() => []);
    const html = `<div class="modal-head"><div class="ico-wrap on">${icon(entityIcon(st))}</div><h2>${esc(a.friendly_name)}</h2><button class="btn icon ghost" data-close>${icon('x')}</button></div>
      ${body}
      ${chart}
      <details style="margin-top:18px"><summary class="small muted" style="cursor:pointer">Attributi e impostazioni</summary>
        <div class="stack" style="margin-top:12px">
          <dl class="attrs"><dt>ID entità</dt><dd><code>${esc(entity_id)}</code> <a href="#" data-copy="${esc(entity_id)}">copia</a></dd>
          ${dev ? `<dt>Dispositivo</dt><dd>${esc(dev.name)}${dev.model ? ` (${esc(dev.model)})` : ''}</dd>` : ''}
          <dt>Ultimo cambio</dt><dd>${relTime(st.last_changed)}</dd>
          ${attrs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(String(v))}</dd>`).join('')}</dl>
          <div class="field"><label>Nome</label><input class="input" data-f="name" value="${esc(a.friendly_name)}"></div>
          <div class="field"><label>Stanza</label><input class="input" data-f="area" list="areas-list" value="${esc(a.area || '')}" placeholder="Nessuna"><datalist id="areas-list">${areas.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
            <div class="help">Casa-Clima raggruppa nella stessa stanza termostati, climatizzatori, sensori e finestre.</div></div>
          <label class="row small"><input type="checkbox" data-f="hidden"> Nascondi questa entità</label>
          <div class="row"><span class="spacer"></span><button class="btn primary" data-save>Salva</button></div>
        </div>
      </details>`;
    const m = document.querySelector('.modal');
    if (m) {
      const open = m.querySelector('details')?.open;
      m.innerHTML = html;
      if (open) m.querySelector('details').open = true;
      wire(m);
    } else wire(openModal(html, { wide: domain === 'climate' }));
  };
  const wire = (m) => {
    m.querySelector('[data-close]').onclick = () => closeModal();
    m.querySelector('[data-copy]').onclick = (e) => { e.preventDefault(); copyText(entity_id); };
    m.querySelector('[data-save]').onclick = async () => {
      const name = m.querySelector('[data-f="name"]').value.trim();
      const area = m.querySelector('[data-f="area"]').value.trim();
      const hidden = m.querySelector('[data-f="hidden"]').checked;
      try {
        await api('PATCH', `/api/entities/${encodeURIComponent(entity_id)}`, { name: name || null, area: area || null, hidden });
        toast('Salvato', 'ok');
        if (hidden) closeModal();
      } catch (err) { toast(err.message, 'err'); }
    };
  };
  await render();
  return render;
}
