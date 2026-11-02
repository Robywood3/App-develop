// Stato dell'interfaccia sincronizzato con il server via Server-Sent Events.
export const store = {
  states: new Map(),
  devices: [],
  cc: null,
  integrations: [],
  notifications: [],
  logbook: [],
  connected: false,
  info: null,
  pending: new Map() // entity_id -> { temperature, until } (valori ottimistici durante i comandi)
};

const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(kind, payload) {
  for (const fn of listeners) fn(kind, payload);
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin'
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/api/auth')) emit('unauthorized');
    throw new ApiError(res.status, (data && data.error) || `Errore ${res.status}`);
  }
  return data;
}

export async function callService(domain, service, data = {}) {
  return api('POST', `/api/services/${domain}/${service}`, data);
}

export function getState(id) {
  return store.states.get(id) || null;
}

export function statesOf(domain) {
  return [...store.states.values()].filter((s) => s.entity_id.startsWith(`${domain}.`));
}

export function deviceOf(entity_id) {
  return store.devices.find((d) => d.entities.includes(entity_id)) || null;
}

export function vehicles() {
  return store.devices.filter((d) => d.kind === 'vehicle');
}

let es = null;
let retryTimer = null;

export function connect() {
  if (es) es.close();
  es = new EventSource('/api/stream');
  es.addEventListener('init', (e) => {
    const d = JSON.parse(e.data);
    store.states = new Map(d.states.map((s) => [s.entity_id, s]));
    store.devices = d.devices;
    store.cc = d.casa_clima;
    store.integrations = d.integrations;
    store.notifications = d.notifications || [];
    store.connected = true;
    emit('init');
  });
  es.addEventListener('states', (e) => {
    let devicesChanged = false;
    for (const s of JSON.parse(e.data)) {
      if (s.removed) store.states.delete(s.entity_id);
      else {
        if (!store.states.has(s.entity_id)) devicesChanged = true;
        store.states.set(s.entity_id, s);
        const p = store.pending.get(s.entity_id);
        if (p && (Date.now() > p.until || Math.abs(Number(s.attributes.temperature) - p.temperature) < 0.05)) store.pending.delete(s.entity_id);
      }
    }
    if (devicesChanged) refreshDevices();
    emit('states');
  });
  es.addEventListener('casa_clima', (e) => {
    store.cc = JSON.parse(e.data);
    emit('cc');
  });
  es.addEventListener('integrations', (e) => {
    store.integrations = JSON.parse(e.data);
    refreshDevices();
    emit('integrations');
  });
  es.addEventListener('logbook', (e) => {
    store.logbook.unshift(JSON.parse(e.data));
    store.logbook = store.logbook.slice(0, 200);
    emit('logbook');
  });
  es.addEventListener('notification', (e) => {
    const n = JSON.parse(e.data);
    store.notifications.unshift(n);
    emit('notification', n);
  });
  es.onopen = () => {
    store.connected = true;
    emit('connection');
  };
  es.onerror = async () => {
    store.connected = false;
    emit('connection');
    // se la sessione è scaduta EventSource continua a riprovare: controllo esplicito
    clearTimeout(retryTimer);
    retryTimer = setTimeout(async () => {
      try {
        const s = await api('GET', '/api/auth/status');
        if (!s.authenticated) { es.close(); emit('unauthorized'); }
      } catch { /* server giù: EventSource riproverà */ }
    }, 1500);
  };
}

export function disconnect() {
  if (es) es.close();
  es = null;
}

let devTimer = null;
export function refreshDevices() {
  clearTimeout(devTimer);
  devTimer = setTimeout(async () => {
    try {
      store.devices = await api('GET', '/api/devices');
      emit('devices');
    } catch { /* ignora */ }
  }, 400);
}
