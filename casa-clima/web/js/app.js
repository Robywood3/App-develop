// Casa Clima — applicazione principale: login, navigazione, azioni globali, aggiornamenti in tempo reale.
import { icon } from './icons.js';
import { store, api, connect, disconnect, subscribe, getState, vehicles } from './store.js';
import { esc, toast, svc, stepTarget, moreInfo, modalOpen, closeModal } from './ui.js';
import { homeView } from './views/home.js';
import { climaView } from './views/clima.js';
import { devicesView } from './views/devices.js';
import { carView } from './views/car.js';
import { historyView } from './views/history.js';
import { automationsView } from './views/automations.js';
import { integrationsView } from './views/integrations.js';
import { settingsView } from './views/settings.js';

const ROUTES = [
  { path: 'casa', label: 'Casa', icon: 'home', view: homeView, tab: true },
  { path: 'clima', label: 'Clima', icon: 'thermometer', view: climaView, tab: true },
  { path: 'dispositivi', label: 'Dispositivi', icon: 'grid', view: devicesView, tab: true },
  { path: 'auto', label: 'Auto', icon: 'car', view: carView, tab: true, show: () => vehicles().length > 0 },
  { path: 'storico', label: 'Storico', icon: 'chart', view: historyView, tab: true },
  { path: 'automazioni', label: 'Automazioni', icon: 'zap', view: automationsView },
  { path: 'integrazioni', label: 'Integrazioni', icon: 'puzzle', view: integrationsView },
  { path: 'impostazioni', label: 'Impostazioni', icon: 'settings', view: settingsView },
  { path: 'altro', label: 'Altro', icon: 'menu', view: null, hiddenNav: true }
];

const app = document.getElementById('app');
let current = null;
let renderTimer = null;
let modalRefresh = null;
let modalEntity = null;
let modalLast = null;

// ------------------------------------------------------------------ azioni (event delegation)

export const actions = {
  more: (el) => openMore(el.dataset.id),
  'temp-up': (el) => stepTarget(el.dataset.id, +1),
  'temp-down': (el) => stepTarget(el.dataset.id, -1),
  hvac: (el) => svc('climate', 'set_hvac_mode', { entity_id: el.dataset.id, hvac_mode: el.dataset.mode }),
  fan: (el) => svc('climate', 'set_fan_mode', { entity_id: el.dataset.id, fan_mode: el.value }),
  toggle: (el) => {
    const id = el.dataset.id;
    const domain = id.split('.')[0];
    return svc(domain, el.checked ? 'turn_on' : 'turn_off', { entity_id: id }).catch(() => { el.checked = !el.checked; });
  },
  cover: (el) => svc('cover', el.dataset.svc, { entity_id: el.dataset.id }),
  position: (el) => svc('cover', 'set_cover_position', { entity_id: el.dataset.id, position: Number(el.value) }),
  brightness: (el) => svc('light', 'turn_on', { entity_id: el.dataset.id, brightness_pct: Number(el.value) }),
  number: (el) => svc('number', 'set_value', { entity_id: el.dataset.id, value: Number(el.value) }),
  lock: (el) => {
    const st = getState(el.dataset.id);
    return svc('lock', st?.state === 'locked' ? 'unlock' : 'lock', { entity_id: el.dataset.id });
  },
  press: (el) => svc('button', 'press', { entity_id: el.dataset.id }, { ok: 'Comando inviato' }),
  scene: (el) => svc('scene', 'turn_on', { entity_id: el.dataset.id }, { ok: 'Scena attivata' }),
  select: (el) => svc('select', 'select_option', { entity_id: el.dataset.id, option: el.value }),
  profile: (el) => svc('casa_clima', 'set_profile', { profile: el.dataset.profile }),
  season: (el) => svc('casa_clima', 'set_season', { season: el.dataset.season }),
  'room-up': (el) => roomStep(el.dataset.room, +1),
  'room-down': (el) => roomStep(el.dataset.room, -1),
  'room-reset': (el) => svc('casa_clima', 'reset_room', { room: el.dataset.room }),
  nav: (el) => { location.hash = `#/${el.dataset.to}`; },
  logout: async () => {
    await api('POST', '/api/auth/logout').catch(() => {});
    disconnect();
    showLogin();
  },
  'dismiss-notification': async (el) => {
    await api('DELETE', `/api/notifications/${el.dataset.id}`).catch(() => {});
    store.notifications = store.notifications.filter((n) => n.id !== el.dataset.id);
    scheduleRender(0);
  }
};

const roomTimers = new Map();
const roomPending = new Map();
export function roomTarget(room) {
  const p = roomPending.get(room.id);
  return p !== undefined ? p : room.target ?? room.desired;
}
function roomStep(roomId, dir) {
  const room = store.cc?.rooms.find((r) => r.id === roomId);
  if (!room) return;
  const base = roomTarget(room) ?? room.temperature ?? 20;
  const next = Math.round((Number(base) + dir * 0.5) * 10) / 10;
  roomPending.set(roomId, next);
  const el = document.querySelector(`[data-room-target="${CSS.escape(roomId)}"]`);
  if (el) el.textContent = `${next.toLocaleString('it-IT')}°`;
  clearTimeout(roomTimers.get(roomId));
  roomTimers.set(roomId, setTimeout(async () => {
    try { await svc('casa_clima', 'set_room_temperature', { room: roomId, temperature: next }); } catch { /* già notificato */ }
    setTimeout(() => { roomPending.delete(roomId); scheduleRender(0); }, 1500);
  }, 800));
}

function dispatch(e, kind) {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const isField = el.matches('input, select, textarea');
  if (kind === 'click' && isField) return; // gestiti su "change"
  if (kind === 'change' && !isField) return;
  const name = el.dataset.act;
  const fn = actions[name] || current?.actions?.[name];
  if (!fn) return;
  if (kind === 'click') e.preventDefault();
  Promise.resolve(fn(el, e)).catch(() => {});
}
document.addEventListener('click', (e) => dispatch(e, 'click'));
document.addEventListener('change', (e) => dispatch(e, 'change'));

async function openMore(id) {
  modalEntity = id;
  modalLast = getState(id);
  modalRefresh = await moreInfo(id);
}

// ------------------------------------------------------------------ layout e navigazione

function routeFromHash() {
  const p = (location.hash.replace(/^#\/?/, '').split('/')[0]) || 'casa';
  return ROUTES.find((r) => r.path === p) || ROUTES[0];
}

function navHTML(active) {
  const errors = store.integrations.filter((i) => i.enabled && ['error', 'auth'].includes(i.status?.state)).length;
  const items = ROUTES.filter((r) => !r.hiddenNav && (!r.show || r.show()));
  const nav = items.map((r) => `<a href="#/${r.path}" class="${r === active ? 'active' : ''}">${icon(r.icon)}<span>${r.label}</span>${r.path === 'integrazioni' && errors ? `<span class="badge">${errors}</span>` : ''}</a>`).join('');
  const tabs = items.filter((r) => r.tab).slice(0, 4);
  const moreActive = !tabs.includes(active);
  return `
    <nav class="nav">
      <div class="brand"><img src="icon.svg" alt="">Casa Clima</div>
      ${nav}
      <div class="nav-foot">
        <div class="conn"><span class="dot ${store.connected ? 'ok' : 'err'}"></span>${store.connected ? 'Connesso' : 'Riconnessione…'}</div>
        <a href="#" data-act="logout">${icon('logout')}<span>Esci</span></a>
      </div>
    </nav>
    <div class="tabbar">
      ${tabs.map((r) => `<a href="#/${r.path}" class="${r === active ? 'active' : ''}">${icon(r.icon)}<span>${r.label}</span></a>`).join('')}
      <a href="#/altro" class="${moreActive ? 'active' : ''}">${icon('menu')}<span>Altro${errors ? ' •' : ''}</span></a>
    </div>`;
}

const moreView = {
  title: 'Altro',
  render() {
    const items = ROUTES.filter((r) => !r.hiddenNav && (!r.show || r.show()));
    return `<div class="page-head"><div><h1>Altro</h1></div></div>
      <div class="card"><div class="list">${items.map((r) => `<a class="ent" href="#/${r.path}" style="color:inherit"><div class="ico-wrap">${icon(r.icon)}</div><div class="info"><div class="name">${r.label}</div></div>${icon('chevronRight')}</a>`).join('')}
      <a class="ent" href="#" data-act="logout" style="color:inherit"><div class="ico-wrap">${icon('logout')}</div><div class="info"><div class="name">Esci</div></div></a></div></div>
      <p class="small faint" style="text-align:center;margin-top:16px"><span class="dot ${store.connected ? 'ok' : 'err'}" style="display:inline-block"></span> ${store.connected ? 'Connesso' : 'Riconnessione…'}</p>`;
  }
};

async function render() {
  if (!store.cc) return;
  const route = routeFromHash();
  const view = route.path === 'altro' ? moreView : route.view;
  if (current !== view) {
    current?.unmount?.();
    current = view;
    window.scrollTo(0, 0);
  }
  if (!app.querySelector('.shell')) {
    app.innerHTML = '<div class="shell"><div id="navwrap"></div><main><div class="page" id="page"></div></main></div>';
  }
  document.getElementById('navwrap').innerHTML = navHTML(route);
  const page = document.getElementById('page');
  const html = await view.render();
  if (current !== view) return; // l'utente ha cambiato pagina nel frattempo
  page.innerHTML = html;
  view.mount?.(page);
  document.title = `${view.title} · Casa Clima`;
}

function busy() {
  if (window.__ccBusy) return true;
  const a = document.activeElement;
  return Boolean(a && a.closest('#page') && a.matches('input:not([type="checkbox"]):not([type="range"]), textarea, select'));
}

export function scheduleRender(delay = 300) {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    if (busy()) return scheduleRender(800);
    render();
  }, delay);
}

subscribe((kind, payload) => {
  if (kind === 'unauthorized') return showLogin();
  if (kind === 'notification') toast(`${payload.title}: ${payload.message}`, 'info', 8000);
  if (!document.getElementById('page')) {
    if (kind === 'init') render();
    return;
  }
  const live = current?.live;
  const wants = typeof live === 'function' ? live(kind) : live !== false;
  if (wants || kind === 'init' || kind === 'connection' || kind === 'integrations') scheduleRender(kind === 'init' ? 0 : 350);
  // finestra dettagli aperta: aggiorna se cambia la sua entità
  if (modalOpen() && modalRefresh && modalEntity && getState(modalEntity) !== modalLast && !window.__ccBusy) {
    const a = document.activeElement;
    if (!a || !a.closest('.modal') || !a.matches('input, select, textarea')) {
      modalLast = getState(modalEntity);
      modalRefresh();
    }
  }
});

window.addEventListener('hashchange', () => { closeModal(); render(); });

// ------------------------------------------------------------------ login

function showLogin(configured = true) {
  disconnect();
  app.innerHTML = `<div class="login"><form class="login-card form" id="login">
      <img src="icon.svg" alt="">
      <div><h1>Casa Clima</h1><p>${configured ? 'Inserisci la password della casa.' : 'Primo avvio: scegli una password per proteggere la dashboard (almeno 6 caratteri).'}</p></div>
      <input class="input" type="password" name="password" autocomplete="${configured ? 'current-password' : 'new-password'}" placeholder="Password" required autofocus>
      ${configured ? '' : '<input class="input" type="password" name="confirm" autocomplete="new-password" placeholder="Ripeti la password" required>'}
      <div class="error-box hidden" id="login-err"></div>
      <button class="btn primary" type="submit">${configured ? 'Entra' : 'Crea password ed entra'}</button>
    </form></div>`;
  const form = document.getElementById('login');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const err = document.getElementById('login-err');
    err.classList.add('hidden');
    const fd = new FormData(form);
    try {
      if (!configured && fd.get('password') !== fd.get('confirm')) throw new Error('Le password non coincidono');
      await api('POST', configured ? '/api/auth/login' : '/api/auth/setup', { password: fd.get('password') });
      startApp();
    } catch (ex) {
      err.textContent = ex.message;
      err.classList.remove('hidden');
    }
  };
}

function startApp() {
  app.innerHTML = '<div class="boot"><div class="spinner"></div></div>';
  current = null;
  connect();
  api('GET', '/api/info').then((i) => { store.info = i; }).catch(() => {});
  api('GET', '/api/logbook').then((l) => { store.logbook = l; }).catch(() => {});
}

async function boot() {
  try {
    const s = await api('GET', '/api/auth/status');
    if (s.authenticated) startApp();
    else showLogin(s.configured);
  } catch {
    app.innerHTML = `<div class="login"><div class="login-card"><h1>Casa Clima</h1><p>Il server non risponde. Riprovo…</p></div></div>`;
    setTimeout(boot, 3000);
  }
}

boot();
export { esc };
