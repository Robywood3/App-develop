#!/usr/bin/env node
/*
 * Casa Clima — avvio.
 *   PORT                 porta HTTP (predefinita 8124)
 *   HOST                 indirizzo di ascolto (predefinito 0.0.0.0, tutta la rete di casa)
 *   CASA_CLIMA_DATA      cartella dati (predefinita ./data)
 *   CASA_CLIMA_PASSWORD  password iniziale (altrimenti la imposti al primo accesso)
 *   PUBLIC_URL           indirizzo con cui raggiungi Casa Clima (per OAuth e webhook)
 */
import path from 'node:path';
import os from 'node:os';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Hub } from './core/hub.js';
import { JsonStore } from './core/store.js';
import { Recorder } from './core/recorder.js';
import { AutomationEngine } from './core/automation.js';
import { SceneManager } from './core/scenes.js';
import { CasaClima } from './core/casaclima.js';
import { PackageLoader } from './core/packages.js';
import { IntegrationManager } from './integrations/manager.js';
import { Auth } from './server/auth.js';
import { createServer } from './server/server.js';
import { createLogger, randomId, toArray } from './core/util.js';

const log = createLogger('casa-clima');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

function lanAddress() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) return i.address;
  }
  return 'localhost';
}

export async function start({
  port = Number(process.env.PORT) || 8124,
  host = process.env.HOST || '0.0.0.0',
  dataDir = path.resolve(process.env.CASA_CLIMA_DATA || path.join(ROOT, 'data')),
  quiet = false
} = {}) {
  const config = new JsonStore(path.join(dataDir, 'config.json'), {
    settings: { history_days: 7, public_url: process.env.PUBLIC_URL || '' },
    integrations: [
      { id: 'demo', type: 'demo', title: 'Casa demo', enabled: true, options: {}, data: {} }
    ],
    overrides: {},
    automation_states: {},
    casa_clima_state: {}
  });
  config.load();
  const authStore = new JsonStore(path.join(dataDir, 'auth.json'), { password: null, sessions: {}, tokens: {} });
  authStore.load();

  const hub = new Hub({ overrides: config.data.overrides });
  const app = { hub, config, version: pkg.version, notifications: [], packageErrors: [] };
  app.publicUrl = () => (config.data.settings.public_url || process.env.PUBLIC_URL || `http://${lanAddress()}:${port}`).replace(/\/$/, '');
  app.auth = new Auth(authStore);

  // notifiche (servizi notify.* e persistent_notification.create, come in HA)
  const notify = (data) => {
    const n = { id: randomId(4), title: data.title || 'Casa Clima', message: String(data.message ?? ''), created: new Date().toISOString() };
    app.notifications.unshift(n);
    app.notifications = app.notifications.slice(0, 50);
    hub.emit('notification', n);
    hub.addLog({ name: n.title, message: n.message });
    return n;
  };
  hub.registerService('notify', 'notify', notify);
  hub.registerService('notify', 'persistent_notification', notify);
  hub.registerService('persistent_notification', 'create', notify);
  hub.registerService('persistent_notification', 'dismiss', (d) => {
    app.notifications = app.notifications.filter((n) => n.id !== d.notification_id);
  });
  // servizi generici "homeassistant.turn_on/off/toggle" su qualunque entità
  for (const svc of ['turn_on', 'turn_off', 'toggle']) {
    hub.registerService('homeassistant', svc, async (data) => {
      for (const id of toArray(data.entity_id)) {
        const domain = id.split('.')[0];
        await hub.callService(domain, domain === 'cover' ? { turn_on: 'open_cover', turn_off: 'close_cover', toggle: 'toggle' }[svc] : svc, { ...data, entity_id: id });
      }
    });
  }

  app.recorder = new Recorder(hub, path.join(dataDir, 'history.json'), { days: Number(config.data.settings.history_days) || 7 });
  app.manager = new IntegrationManager(hub, config, { publicUrl: app.publicUrl });
  app.automations = new AutomationEngine(hub, {
    savedStates: config.data.automation_states,
    onEnabledChange: () => config.saveLater(500)
  });
  app.scenes = new SceneManager(hub, (actions) => runActions(hub, actions));
  app.casaClima = new CasaClima(hub, {
    state: config.data.casa_clima_state,
    saveState: (s) => { config.data.casa_clima_state = s; config.saveLater(1000); }
  });
  app.packages = new PackageLoader(path.join(dataDir, 'packages'), path.join(ROOT, 'config', 'packages'));
  app.packages.ensureDefaults();

  app.reloadPackages = async () => {
    const pk = await app.packages.load();
    app.packageErrors = pk.errors;
    app.casaClima.load(pk.casa_clima);
    app.automations.load(pk.automations);
    app.scenes.load(pk.scenes);
    const errors = [...pk.errors, ...app.automations.errors, ...app.scenes.errors];
    for (const e of errors) log.warn(`Pacchetto: ${e}`);
    hub.emit('integrations_changed');
    app.casaClima.scheduleEmit();
    return { files: pk.files, automations: app.automations.automations.length, scenes: app.scenes.scenes.length, errors };
  };

  app.recorder.start();
  await app.reloadPackages();
  await new Promise((resolve) => setImmediate(resolve));
  app.manager.startAll();

  const server = createServer(app, { webDir: path.join(ROOT, 'web') });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  const actualPort = server.address().port;
  if (!quiet) {
    log.info(`Casa Clima ${pkg.version} avviato: http://${lanAddress()}:${actualPort}  (dati in ${dataDir})`);
    if (!app.auth.configured) log.info('Primo avvio: apri la dashboard per impostare la password.');
  }

  app.stop = async () => {
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
    app.automations.shutdown();
    app.casaClima.shutdown();
    await app.manager.stopAll();
    await app.recorder.stop();
    await config.flush();
    await authStore.flush();
  };
  app.server = server;
  app.port = actualPort;
  return app;
}

/** Esecuzione di azioni fuori da un'automazione (es. scene con "actions:"). */
async function runActions(hub, actions) {
  for (const a of toArray(actions)) {
    const name = a.action || a.service;
    if (!name) continue;
    const [domain, service] = name.split('.');
    await hub.callService(domain, service, { ...(a.data || {}), ...(a.target || {}) });
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  start().then((app) => {
    const shutdown = async (sig) => {
      log.info(`${sig}: arresto…`);
      try { await app.stop(); } catch (err) { log.error(err); }
      process.exit(0);
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }).catch((err) => {
    log.error(err.stack || err.message);
    process.exit(1);
  });
  process.on('unhandledRejection', (err) => log.error('Promise non gestita:', err?.stack || err));
}
