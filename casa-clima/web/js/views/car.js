// Pagina "Auto": Tesla (e qualunque dispositivo di tipo veicolo).
import { icon } from '../icons.js';
import { getState, vehicles } from '../store.js';
import { esc, fmtNum, fmtTemp, isNum, stateText, relTime, svc, climateTarget, setTargetDebounced } from '../ui.js';
import { scheduleRender } from '../app.js';

const busy = new Set();

function pick(dev, domain, re) {
  return dev.entities.map((id) => getState(id)).find((s) => s && s.entity_id.startsWith(`${domain}.`) && (!re || re.test(s.entity_id))) || null;
}

async function run(key, fn) {
  if (busy.has(key)) return;
  busy.add(key);
  scheduleRender(0);
  try { await fn(); } catch { /* errore già mostrato */ }
  busy.delete(key);
  scheduleRender(0);
}

function carCard(dev) {
  const soc = pick(dev, 'sensor', /batteria|_soc/);
  const range = pick(dev, 'sensor', /autonomia|range/);
  const charging = pick(dev, 'sensor', /stato_ricarica|charging/);
  const power = pick(dev, 'sensor', /potenza_ricarica|power/);
  const inside = pick(dev, 'sensor', /abitacolo|temp_interna|inside/);
  const outside = pick(dev, 'sensor', /esterna|outside/);
  const odo = pick(dev, 'sensor', /contachilometri|odometer/);
  const clima = pick(dev, 'climate');
  const lock = pick(dev, 'lock');
  const chargeSw = pick(dev, 'switch', /ricarica|charge/);
  const defrost = pick(dev, 'switch', /sbrinamento|defrost/);
  const limit = pick(dev, 'number', /limite|limit/);
  const amps = pick(dev, 'number', /corrente|amps/);
  const online = pick(dev, 'binary_sensor', /online/);
  const buttons = dev.entities.map((id) => getState(id)).filter((s) => s?.entity_id.startsWith('button.'));
  const level = isNum(soc?.state) ? Number(soc.state) : null;
  const asleep = soc?.attributes.asleep || online?.state === 'off';
  const climaOn = clima && clima.state !== 'off' && clima.state !== 'unavailable';
  const target = clima ? climateTarget(clima) : null;
  const lat = online?.attributes.latitude;
  const lon = online?.attributes.longitude;

  return `<div class="card">
    <div class="card-head">
      <div class="ico-wrap ${online?.state === 'on' ? 'ok' : ''}">${icon('car')}</div>
      <div style="flex:1;min-width:0"><div class="title" style="font-size:18px">${esc(dev.name)}</div>
        <div class="tiny muted">${esc(dev.model || '')}${soc?.attributes.data_age ? ` · dati di ${relTime(soc.attributes.data_age)}` : ''}</div></div>
      <span class="chip ${online?.state === 'on' ? 'ok' : ''}">${icon('wifi')}${online?.state === 'on' ? 'Sveglia' : 'Addormentata'}</span>
    </div>
    <div class="car">
      <div class="stack">
        <div class="battery">
          <div class="lvl ${level !== null && level < 20 ? 'low' : ''}" style="width:${level ?? 0}%"></div>
          ${isNum(limit?.state) ? `<div class="limit" style="left:calc(${limit.state}% - 1px)" title="Limite ${limit.state}%"></div>` : ''}
          <div class="txt num">${level !== null ? `${level}%` : 'n/d'}</div>
        </div>
        <div class="row wrap">
          <div class="kv"><span class="k">Autonomia</span><span class="v num">${isNum(range?.state) ? `${fmtNum(range.state, 0)} km` : '–'}</span></div>
          <div class="kv"><span class="k">Ricarica</span><span class="v">${esc(charging ? stateText(charging) : '–')}</span></div>
          ${isNum(power?.state) && Number(power.state) > 0 ? `<div class="kv"><span class="k">Potenza</span><span class="v num">${fmtNum(power.state)} kW</span></div>` : ''}
          ${charging?.attributes.minutes_to_full ? `<div class="kv"><span class="k">Piena tra</span><span class="v num">${Math.floor(charging.attributes.minutes_to_full / 60)} h ${charging.attributes.minutes_to_full % 60} min</span></div>` : ''}
        </div>
        ${limit ? `<div class="field"><label>Limite di ricarica: <b data-limit-label="${esc(limit.entity_id)}">${esc(limit.state ?? '–')}%</b></label>
          <input type="range" min="${limit.attributes.min ?? 50}" max="${limit.attributes.max ?? 100}" step="${limit.attributes.step ?? 1}" value="${limit.state ?? 80}" data-act="car-limit" data-id="${esc(limit.entity_id)}" ${asleep && limit.state === 'unavailable' ? 'disabled' : ''}></div>` : ''}
        ${amps && isNum(amps.state) ? `<div class="field"><label>Corrente di ricarica: <b>${esc(amps.state)} A</b></label>
          <input type="range" min="${amps.attributes.min ?? 5}" max="${amps.attributes.max ?? 32}" step="1" value="${amps.state}" data-act="number" data-id="${esc(amps.entity_id)}"></div>` : ''}
        <div class="row wrap small muted">
          ${inside ? `<span>${icon('thermometer')} Abitacolo ${fmtTemp(inside.state)}</span>` : ''}
          ${outside ? `<span>Esterno ${fmtTemp(outside.state)}</span>` : ''}
          ${odo && isNum(odo.state) ? `<span>${fmtNum(odo.state, 0)} km</span>` : ''}
          ${isNum(lat) ? `<a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}" target="_blank" rel="noopener">${icon('external')} Posizione</a>` : ''}
        </div>
      </div>
      <div class="stack">
        ${clima ? `<div class="card flat" style="background:var(--surface-2);border:0">
          <div class="row"><div class="ico-wrap ${climaOn ? 'on' : ''}">${icon('fan')}</div><div style="flex:1"><b>Clima abitacolo</b><div class="tiny muted">${climaOn ? (clima.attributes.preconditioning ? 'Precondizionamento' : 'Acceso') : 'Spento'}</div></div>
            <label class="switch"><input type="checkbox" data-act="car-climate" data-id="${esc(clima.entity_id)}" ${climaOn ? 'checked' : ''} ${busy.has(clima.entity_id) ? 'disabled' : ''}><span></span></label></div>
          <div class="room-ctrl" style="margin-top:12px;background:var(--surface)">
            <button class="btn icon round" data-act="car-temp" data-dir="-1" data-id="${esc(clima.entity_id)}">${icon('minus')}</button>
            <div class="target"><b class="num">${isNum(target) ? `${fmtNum(target)}°` : '–'}</b><span class="l">temperatura</span></div>
            <button class="btn icon round" data-act="car-temp" data-dir="1" data-id="${esc(clima.entity_id)}">${icon('plus')}</button>
          </div></div>` : ''}
        <div class="tiles">
          ${lock ? `<button class="tile ${lock.state === 'unlocked' ? 'on' : ''}" data-act="car-lock" data-id="${esc(lock.entity_id)}" ${busy.has(lock.entity_id) ? 'disabled' : ''}>${icon(lock.state === 'unlocked' ? 'unlock' : 'lock')}<span class="l">Portiere</span><b>${lock.state === 'locked' ? 'Chiuse' : lock.state === 'unlocked' ? 'Aperte' : '–'}</b></button>` : ''}
          ${chargeSw ? `<button class="tile ${chargeSw.state === 'on' ? 'on' : ''}" data-act="car-switch" data-id="${esc(chargeSw.entity_id)}" ${busy.has(chargeSw.entity_id) ? 'disabled' : ''}>${icon('ev')}<span class="l">Ricarica</span><b>${chargeSw.state === 'on' ? 'Ferma' : 'Avvia'}</b></button>` : ''}
          ${defrost ? `<button class="tile ${defrost.state === 'on' ? 'on' : ''}" data-act="car-switch" data-id="${esc(defrost.entity_id)}" ${busy.has(defrost.entity_id) ? 'disabled' : ''}>${icon('snowflake')}<span class="l">Sbrinamento</span><b>${defrost.state === 'on' ? 'Attivo' : 'Spento'}</b></button>` : ''}
          ${buttons.map((b) => `<button class="tile" data-act="car-press" data-id="${esc(b.entity_id)}" ${busy.has(b.entity_id) ? 'disabled' : ''}>${icon(/clacson|honk/.test(b.entity_id) ? 'horn' : /sveglia|wake/.test(b.entity_id) ? 'refresh' : 'sun')}<span class="l">${esc(b.attributes.friendly_name.replace(dev.name, '').trim())}</span><b>${busy.has(b.entity_id) ? 'Invio…' : 'Premi'}</b></button>`).join('')}
        </div>
        ${asleep ? `<p class="tiny muted" style="margin:0">L'auto dorme: i comandi la svegliano automaticamente (può servire mezzo minuto). I dati vengono letti solo da sveglia per non consumare batteria.</p>` : ''}
      </div>
    </div>
  </div>`;
}

export const carView = {
  title: 'Auto',
  actions: {
    'car-climate': (el) => run(el.dataset.id, () => svc('climate', el.checked ? 'turn_on' : 'turn_off', { entity_id: el.dataset.id })),
    'car-lock': (el) => {
      const st = getState(el.dataset.id);
      return run(el.dataset.id, () => svc('lock', st?.state === 'locked' ? 'unlock' : 'lock', { entity_id: el.dataset.id }));
    },
    'car-switch': (el) => {
      const st = getState(el.dataset.id);
      return run(el.dataset.id, () => svc('switch', st?.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: el.dataset.id }));
    },
    'car-press': (el) => run(el.dataset.id, () => svc('button', 'press', { entity_id: el.dataset.id }, { ok: 'Comando inviato' })),
    'car-limit': (el) => run(el.dataset.id, () => svc('number', 'set_value', { entity_id: el.dataset.id, value: Number(el.value) })),
    'car-temp': (el) => {
      const st = getState(el.dataset.id);
      if (!st) return;
      const cur = Number(climateTarget(st) ?? 21);
      const next = Math.min(Number(st.attributes.max_temp ?? 28), Math.max(Number(st.attributes.min_temp ?? 15), cur + Number(el.dataset.dir) * 0.5));
      setTargetDebounced(el.dataset.id, next, () => scheduleRender(0));
    }
  },
  render() {
    const cars = vehicles();
    return `<div class="page-head"><div><h1>Auto</h1><div class="sub">${cars.length === 1 ? '1 auto collegata' : `${cars.length} auto collegate`}</div></div></div>
      ${cars.length ? `<div class="stack">${cars.map(carCard).join('')}</div>` : `<div class="card empty">${icon('car')}<div>Collega la tua Tesla da <a href="#/integrazioni">Integrazioni</a>.</div></div>`}`;
  }
};
