/*
 * Backend della demo online: fa girare nel browser lo stesso motore del server
 * (hub, Casa-Clima, automazioni, scene, recorder, casa simulata) e risponde alle chiamate
 * /api/... e /api/stream al posto del server Node. Usato solo da tools/build-demo.mjs.
 */
import YAML from 'yaml';
import { Hub } from '../../../src/core/hub.js';
import { AutomationEngine } from '../../../src/core/automation.js';
import { SceneManager } from '../../../src/core/scenes.js';
import { CasaClima } from '../../../src/core/casaclima.js';
import { Recorder } from '../../../src/core/recorder.js';
import { DemoIntegration } from '../../../src/integrations/demo.js';
import { INTEGRATIONS } from '../../../src/integrations/index.js';
import { weatherCondition } from '../../../src/integrations/openmeteo.js';
import { toArray } from '../../../src/core/util.js';
import packageText from '../../../config/packages/casa-clima.yaml';

window.__CC_DEMO = true;

const DEMO_ONLY = 'Nella demo online non si possono collegare apparecchi veri. Installa Casa Clima su un computer di casa (vedi README) per usare Tesla, Daikin, Netatmo, tado° e Shelly.';

class ApiErr extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ------------------------------------------------------------------ motore

const hub = new Hub({ overrides: {} });
const notifications = [];
const notify = (d) => {
  const n = { id: Math.random().toString(16).slice(2, 10), title: d.title || 'Casa Clima', message: String(d.message ?? ''), created: new Date().toISOString() };
  notifications.unshift(n);
  hub.emit('notification', n);
  hub.addLog({ name: n.title, message: n.message });
};
hub.registerService('notify', 'notify', notify);
hub.registerService('persistent_notification', 'create', notify);

const recorder = new Recorder(hub, null, { days: 7, store: { data: { series: {} }, save: async () => {}, load() {} } });
const automations = new AutomationEngine(hub, { savedStates: {} });
const scenes = new SceneManager(hub, async (actions) => {
  for (const a of toArray(actions)) {
    const name = a.action || a.service;
    if (!name) continue;
    const [domain, service] = name.split('.');
    await hub.callService(domain, service, { ...(a.data || {}), ...(a.target || {}) });
  }
});
const casaClima = new CasaClima(hub, { state: { profile: 'comfort' } });

// nella demo la pausa per finestra aperta scatta dopo 15 secondi invece di 60
let pkgText = packageText.replace(/delay: 60 /, 'delay: 15 ');
let packageErrors = [];

function loadPackage(text) {
  const doc = YAML.parse(text) || {};
  if (typeof doc !== 'object' || Array.isArray(doc)) throw new ApiErr(400, 'Il pacchetto deve essere un oggetto YAML');
  casaClima.load(doc.casa_clima || {});
  automations.load(toArray(doc.automations ?? doc.automation));
  scenes.load(toArray(doc.scenes ?? doc.scene));
  packageErrors = [];
  const errors = [...automations.errors, ...scenes.errors];
  casaClima.scheduleEmit();
  return { files: ['casa-clima.yaml'], automations: automations.automations.length, scenes: scenes.scenes.length, errors };
}

const entry = { id: 'demo', type: 'demo', title: 'Casa demo', enabled: true, options: { outdoor: 6, poll_interval: 5 }, data: {} };
const demo = new DemoIntegration(hub, entry, { saveEntry: async () => {}, saveLater() {}, settings: {}, publicUrl: () => location.origin });

// meteo simulato coerente con la temperatura esterna della casa demo
const weatherOwner = {};
hub.registerEntity({ entity_id: 'weather.casa', name: 'Meteo casa', owner: weatherOwner, integration: 'openmeteo' });
function forecast() {
  const codes = [2, 3, 61, 1, 0];
  return codes.map((code, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return { datetime: d.toISOString().slice(0, 10), ...weatherCondition(code), temperature: 11 - i % 2 + (i === 3 ? 2 : 0), templow: 3 + (i % 3), precipitation_probability: code >= 61 ? 70 : 10 };
  });
}
hub.on('state_changed', ({ entity_id, new_state }) => {
  if (entity_id !== 'sensor.demo_temperatura_esterna' || !new_state) return;
  const t = Number(new_state.state);
  const day = new Date().getHours() >= 7 && new Date().getHours() < 17;
  hub.setState('weather.casa', day ? 'partlycloudy' : 'clear-night', {
    label: day ? 'Parzialmente nuvoloso' : 'Sereno', temperature: t, apparent_temperature: Math.round((t - 2) * 10) / 10,
    humidity: 71, wind_speed: 9, pressure: 1018, forecast: forecast()
  });
});

/** 24 ore di storico simulato, così i grafici sono pieni fin dall'apertura. */
function seedHistory() {
  const step = 5 * 60_000;
  const now = Date.now();
  const start = now - 24 * 3600_000;
  const s = recorder.series;
  const rooms = [
    { key: 'soggiorno', t: 19.6, hum: 48, gain: 0.16 },
    { key: 'camera', t: 18.4, hum: 53, gain: 0.13 },
    { key: 'studio', t: 19.1, hum: 45, gain: 0.15 },
    { key: 'cucina', t: 20.2, hum: 56, gain: 0.12 }
  ];
  const outdoorAt = (ts) => {
    const h = new Date(ts).getHours() + new Date(ts).getMinutes() / 60;
    return 6 + 4 * Math.sin(((h - 9) / 24) * 2 * Math.PI);
  };
  const targetAt = (ts) => {
    const h = new Date(ts).getHours() + new Date(ts).getMinutes() / 60;
    return h >= 23 || h < 6.5 ? 18 : 21;
  };
  for (const r of rooms) {
    s[`sensor.demo_temperatura_${r.key}`] = [];
    s[`climate.demo_termostato_${r.key}`] = [];
    s[`sensor.demo_umidita_${r.key}`] = [];
  }
  s['sensor.demo_temperatura_esterna'] = [];
  s['sensor.demo_consumo_casa'] = [];
  s['sensor.demo_produzione_fv'] = [];
  s['sensor.demo_tesla_batteria'] = [];
  let soc = 38;
  for (let ts = start; ts <= now - step; ts += step) {
    const out = outdoorAt(ts);
    const target = targetAt(ts);
    let heaters = 0;
    for (const r of rooms) {
      const on = r.t < target - 0.15;
      if (on) heaters++;
      r.t += on ? r.gain : (out - r.t) * 0.012;
      r.t += (Math.random() - 0.5) * 0.04;
      r.hum = Math.min(70, Math.max(38, r.hum + (Math.random() - 0.5) * 0.8));
      const t = Math.round(r.t * 10) / 10;
      s[`sensor.demo_temperatura_${r.key}`].push([ts, t]);
      s[`climate.demo_termostato_${r.key}`].push([ts, t, target, on ? 1 : 0]);
      s[`sensor.demo_umidita_${r.key}`].push([ts, Math.round(r.hum)]);
    }
    const h = new Date(ts).getHours() + new Date(ts).getMinutes() / 60;
    const sun = Math.max(0, Math.sin(((h - 7) / 11) * Math.PI));
    const pv = Math.round(sun * 3900 * (0.75 + Math.random() * 0.25));
    const washer = h >= 10 && h < 11.3 ? 1900 : 0;
    const cooking = (h >= 12.5 && h < 13.3) || (h >= 19.5 && h < 20.3) ? 2100 : 0;
    const charging = h >= 1 && h < 5;
    if (charging) soc = Math.min(80, soc + 1.5);
    s['sensor.demo_temperatura_esterna'].push([ts, Math.round(out * 10) / 10]);
    s['sensor.demo_produzione_fv'].push([ts, pv]);
    s['sensor.demo_consumo_casa'].push([ts, Math.round(320 + heaters * 90 + washer + cooking + (charging ? 7400 : 0) + Math.random() * 120)]);
    s['sensor.demo_tesla_batteria'].push([ts, Math.round(soc)]);
  }
  return { rooms, soc };
}

const ready = (async () => {
  const seed = seedHistory();
  loadPackage(pkgText);
  await demo.setup();
  // allinea la casa simulata alla fine dello storico
  for (const r of seed.rooms) {
    const room = demo.sim.rooms[r.key];
    room.temp = r.t;
    room.hum = r.hum;
    room.thermo.target = 21;
  }
  demo.sim.car.soc = seed.soc;
  demo.sim.outdoor = 6;
  await demo.update();
  recorder.start();
  demo.status = { state: 'ok', message: 'Simulazione attiva', updated: new Date().toISOString() };
  setInterval(async () => {
    try {
      await demo.update();
      demo.status = { state: 'ok', message: 'Simulazione attiva', updated: new Date().toISOString() };
    } catch (err) {
      demo.status = { state: 'error', message: err.message };
    }
  }, 5000);
  hub.addLog({ name: 'Casa Clima', message: 'demo avviata' });
})();

// ------------------------------------------------------------------ API simulate

function integrationsList() {
  return [{
    id: entry.id, type: entry.type, title: entry.title, enabled: true, options: entry.options, logged_in: false,
    status: demo.status, entities: [...hub.entities.values()].filter((m) => m.entry_id === entry.id).length, device_flow: null
  }];
}

function devicesList() {
  const by = new Map();
  for (const m of hub.entities.values()) {
    if (!m.device_id || hub.overrides[m.entity_id]?.hidden) continue;
    if (!by.has(m.device_id)) by.set(m.device_id, []);
    by.get(m.device_id).push(m.entity_id);
  }
  return [...hub.devices.values()].map(({ owner, ...d }) => ({ ...d, entities: by.get(d.id) || [] }));
}

function areas() {
  const set = new Set();
  for (const m of hub.entities.values()) { const a = hub.areaOf(m.entity_id); if (a) set.add(a); }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function types() {
  return Object.values(INTEGRATIONS).map((cls) => {
    const { type, name, description, fields, auth, authWhen, docs, icon, multiple = true, defaultPollInterval } = cls.meta;
    return { type, name, description, fields, auth, authWhen, docs, icon, multiple, defaultPollInterval };
  });
}

const routes = [];
const route = (method, pattern, handler) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler });
};

let loggedIn = true;
route('GET', '/api/auth/status', () => ({ configured: true, authenticated: loggedIn }));
route('POST', '/api/auth/login', () => { loggedIn = true; return { ok: true }; });
route('POST', '/api/auth/setup', () => { loggedIn = true; return { ok: true }; });
route('POST', '/api/auth/logout', () => { loggedIn = false; return { ok: true }; });
route('POST', '/api/auth/password', () => { throw new ApiErr(400, 'Nella demo la password non si può cambiare'); });
route('GET', '/api/auth/tokens', () => []);
route('POST', '/api/auth/tokens', () => { throw new ApiErr(400, 'Nella demo i token API non sono disponibili'); });
route('GET', '/api/info', () => ({ name: 'Casa Clima', version: 'demo', started: hub.startedAt, public_url: location.origin, settings: { history_days: 7, public_url: '' }, demo: true }));
route('PUT', '/api/settings', () => { throw new ApiErr(400, 'Nella demo queste impostazioni non si possono cambiare'); });
route('GET', '/api/states', () => hub.snapshot());
route('GET', '/api/states/:id', (b, p) => hub.getState(p.id) || (() => { throw new ApiErr(404, 'Entità non trovata'); })());
route('PATCH', '/api/entities/:id', (body, p) => {
  if (!hub.entities.has(p.id)) throw new ApiErr(404, 'Entità non trovata');
  const ov = { ...(hub.overrides[p.id] || {}) };
  for (const k of ['name', 'area', 'hidden']) {
    if (body[k] === undefined) continue;
    if (body[k] === null) delete ov[k];
    else ov[k] = k === 'hidden' ? Boolean(body[k]) : String(body[k]).trim();
  }
  hub.overrides[p.id] = ov;
  hub.refreshState(p.id);
  casaClima.scheduleEmit();
  return { entity_id: p.id, ...ov };
});
route('PATCH', '/api/devices/:id', (body, p) => {
  for (const m of hub.entities.values()) {
    if (m.device_id !== p.id) continue;
    hub.overrides[m.entity_id] = { ...(hub.overrides[m.entity_id] || {}), area: body.area ?? '' };
    hub.refreshState(m.entity_id);
  }
  casaClima.scheduleEmit();
  return { ok: true };
});
route('GET', '/api/devices', () => devicesList());
route('GET', '/api/areas', () => areas());
route('POST', '/api/services/:domain/:service', async (body, p) => {
  try {
    const result = await hub.callService(p.domain, p.service, body, { user: true });
    return { ok: true, result: result ?? null };
  } catch (err) {
    throw new ApiErr(err.status || 400, err.message);
  }
});
route('GET', '/api/history', (b, p, url) => {
  const ids = (url.searchParams.get('entity_id') || '').split(',').filter(Boolean);
  return recorder.history(ids, Number(url.searchParams.get('hours')) || 24);
});
route('GET', '/api/logbook', () => hub.logbook.slice(-200).reverse());
route('GET', '/api/notifications', () => notifications);
route('DELETE', '/api/notifications/:id', (b, p) => {
  const i = notifications.findIndex((n) => n.id === p.id);
  if (i >= 0) notifications.splice(i, 1);
  return { ok: true };
});
route('GET', '/api/casa-clima', () => casaClima.summary());
route('GET', '/api/automations', () => ({ automations: automations.list(), errors: [...packageErrors, ...automations.errors] }));
route('GET', '/api/scenes', () => scenes.list());
route('GET', '/api/packages', () => ({ files: ['casa-clima.yaml'], errors: packageErrors }));
route('GET', '/api/packages/:name', (b, p) => {
  if (p.name !== 'casa-clima.yaml') throw new ApiErr(404, 'Pacchetto non trovato');
  return { name: p.name, content: pkgText };
});
route('PUT', '/api/packages/:name', (body, p) => {
  if (p.name !== 'casa-clima.yaml') throw new ApiErr(400, 'Nella demo c\'è un solo pacchetto: casa-clima.yaml');
  try {
    YAML.parse(String(body.content ?? ''));
  } catch (err) {
    throw new ApiErr(400, `casa-clima.yaml: ${err.message.split('\n')[0]}`);
  }
  pkgText = String(body.content ?? '');
  return loadPackage(pkgText);
});
route('DELETE', '/api/packages/:name', () => { throw new ApiErr(400, 'Nella demo il pacchetto non si può eliminare'); });
route('POST', '/api/packages/reload', () => loadPackage(pkgText));
route('GET', '/api/integrations', () => ({ types: types(), entries: integrationsList() }));
route('POST', '/api/integrations', () => { throw new ApiErr(400, DEMO_ONLY); });
route('PUT', '/api/integrations/:id', () => { throw new ApiErr(400, DEMO_ONLY); });
route('DELETE', '/api/integrations/:id', () => { throw new ApiErr(400, 'Nella demo la casa simulata non si può eliminare'); });
route('POST', '/api/integrations/:id/reload', async () => { await demo.update(); return integrationsList()[0]; });
route('POST', '/api/integrations/:id/auth', () => { throw new ApiErr(400, DEMO_ONLY); });
route('GET', '/api/integrations/:id/webhooks', () => []);

async function handle(method, url, bodyText) {
  await ready;
  const r = routes.find((x) => x.method === method && x.re.test(url.pathname));
  if (!r) throw new ApiErr(404, 'Percorso API sconosciuto');
  const m = url.pathname.match(r.re);
  const params = {};
  r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
  let body = {};
  if (bodyText) {
    try { body = JSON.parse(bodyText); } catch { throw new ApiErr(400, 'JSON non valido'); }
  }
  return r.handler(body, params, url);
}

const realFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url, location.href);
  if (!url.pathname.startsWith('/api/')) return realFetch(input, init);
  const method = (init.method || 'GET').toUpperCase();
  try {
    const data = await handle(method, url, init.body);
    return new Response(JSON.stringify(data ?? null), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: err.status || 500, headers: { 'Content-Type': 'application/json' } });
  }
};

// ------------------------------------------------------------------ flusso in tempo reale

class DemoEventSource {
  constructor() {
    this.listeners = {};
    this.onopen = null;
    this.onerror = null;
    this.closed = false;
    this.pending = new Map();
    this.timer = null;
    this.handlers = {
      state_changed: ({ entity_id, new_state }) => {
        this.pending.set(entity_id, new_state);
        if (!this.timer) {
          this.timer = setTimeout(() => {
            this.timer = null;
            const batch = [...this.pending.entries()].map(([id, s]) => (s && !hub.overrides[id]?.hidden ? s : { entity_id: id, removed: true }));
            this.pending = new Map();
            this.send('states', batch);
          }, 200);
        }
      },
      casa_clima: (s) => this.send('casa_clima', s),
      logbook: (l) => this.send('logbook', l),
      notification: (n) => this.send('notification', n)
    };
    ready.then(() => {
      if (this.closed) return;
      for (const [ev, fn] of Object.entries(this.handlers)) hub.on(ev, fn);
      this.integTimer = setInterval(() => this.send('integrations', integrationsList()), 15000);
      this.onopen?.();
      this.send('init', { states: hub.snapshot(), devices: devicesList(), casa_clima: casaClima.summary(), integrations: integrationsList(), notifications });
    });
  }

  send(event, data) {
    if (this.closed) return;
    const e = { data: JSON.stringify(data) };
    for (const fn of this.listeners[event] || []) fn(e);
  }

  addEventListener(event, fn) {
    (this.listeners[event] ||= []).push(fn);
  }

  close() {
    this.closed = true;
    clearInterval(this.integTimer);
    for (const [ev, fn] of Object.entries(this.handlers)) hub.off(ev, fn);
  }
}
window.EventSource = DemoEventSource;
