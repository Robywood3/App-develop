/*
 * Server HTTP: API REST, flusso in tempo reale (Server-Sent Events) e file della dashboard.
 * Nessuna dipendenza esterna: solo node:http.
 */
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createLogger } from '../core/util.js';
import { Auth } from './auth.js';
import { parseAuthInput } from '../integrations/manager.js';

const log = createLogger('http');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon'
};

class HttpErr extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function send(res, status, body, headers = {}) {
  const isJson = typeof body !== 'string' && !Buffer.isBuffer(body);
  const payload = isJson ? JSON.stringify(body) : body;
  res.writeHead(status, {
    'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(payload);
}

async function readBody(req, limit = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new HttpErr(413, 'Richiesta troppo grande');
    chunks.push(c);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  const type = req.headers['content-type'] || '';
  if (type.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(text));
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpErr(400, 'JSON non valido');
  }
}

function clientIp(req) {
  return req.socket.remoteAddress || 'unknown';
}

export function createServer(app, { webDir }) {
  const { hub, manager, recorder, automations, scenes, casaClima, packages, config } = app;
  const auth = app.auth;
  const clients = new Set();

  // ------------------------------------------------------------ streaming (SSE)

  const broadcast = (event, data) => {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of clients) c.write(msg);
  };
  let pending = new Map();
  let flushTimer = null;
  hub.on('state_changed', ({ entity_id, new_state }) => {
    pending.set(entity_id, new_state);
    if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = null;
        const batch = [...pending.entries()].map(([id, s]) => (s && !hub.overrides[id]?.hidden ? s : { entity_id: id, removed: true }));
        pending = new Map();
        broadcast('states', batch);
      }, 200);
    }
  });
  hub.on('casa_clima', (summary) => broadcast('casa_clima', summary));
  hub.on('logbook', (item) => broadcast('logbook', item));
  hub.on('notification', (n) => broadcast('notification', n));
  let integTimer = null;
  hub.on('integrations_changed', () => {
    clearTimeout(integTimer);
    integTimer = setTimeout(() => broadcast('integrations', manager.list()), 300);
  });
  setInterval(() => { for (const c of clients) c.write(': ping\n\n'); }, 25_000).unref();

  function devicesList() {
    const entitiesByDevice = new Map();
    for (const m of hub.entities.values()) {
      if (!m.device_id || hub.overrides[m.entity_id]?.hidden) continue;
      if (!entitiesByDevice.has(m.device_id)) entitiesByDevice.set(m.device_id, []);
      entitiesByDevice.get(m.device_id).push(m.entity_id);
    }
    return [...hub.devices.values()].map(({ owner, ...d }) => ({ ...d, entities: entitiesByDevice.get(d.id) || [] }));
  }

  function entityList() {
    return [...hub.entities.values()].map((m) => {
      const { owner, ...meta } = m;
      return { ...meta, ...(hub.overrides[m.entity_id] || {}), area: hub.areaOf(m.entity_id) };
    });
  }

  function areas() {
    const set = new Set();
    for (const d of hub.devices.values()) if (d.area) set.add(d.area);
    for (const m of hub.entities.values()) { const a = hub.areaOf(m.entity_id); if (a) set.add(a); }
    for (const r of casaClima.rooms()) set.add(r.name);
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  // ------------------------------------------------------------ rotte

  const routes = [];
  const route = (method, pattern, handler, { open = false } = {}) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ method, re, keys, handler, open });
  };

  // --- autenticazione
  route('GET', '/api/auth/status', (req) => ({ configured: auth.configured, authenticated: Boolean(auth.verify(req)) }), { open: true });
  route('POST', '/api/auth/setup', async (req, res) => {
    if (auth.configured) throw new HttpErr(403, 'Password già impostata');
    const { password } = await readBody(req);
    auth.setPassword(password);
    const token = auth.createSession(req.headers['user-agent']);
    res.setHeader('Set-Cookie', auth.cookie(token, req.headers['x-forwarded-proto'] === 'https'));
    return { ok: true };
  }, { open: true });
  route('POST', '/api/auth/login', async (req, res) => {
    const { password } = await readBody(req);
    const token = auth.login(password, clientIp(req), req.headers['user-agent']);
    res.setHeader('Set-Cookie', auth.cookie(token, req.headers['x-forwarded-proto'] === 'https'));
    return { ok: true };
  }, { open: true });
  route('POST', '/api/auth/logout', (req, res) => {
    auth.logout(Auth.cookieToken(req));
    res.setHeader('Set-Cookie', auth.cookie('', false));
    return { ok: true };
  }, { open: true });
  route('POST', '/api/auth/password', async (req, res) => {
    const { current, password } = await readBody(req);
    if (!auth.checkPassword(current)) throw new HttpErr(401, 'Password attuale errata');
    auth.setPassword(password);
    const token = auth.createSession(req.headers['user-agent']);
    res.setHeader('Set-Cookie', auth.cookie(token, req.headers['x-forwarded-proto'] === 'https'));
    return { ok: true };
  });
  route('GET', '/api/auth/tokens', () => auth.listApiTokens());
  route('POST', '/api/auth/tokens', async (req) => ({ token: auth.createApiToken((await readBody(req)).name) }));
  route('DELETE', '/api/auth/tokens/:id', (req, res, p) => { auth.deleteApiToken(p.id); return { ok: true }; });

  // --- informazioni e stato
  route('GET', '/api/info', () => ({
    name: 'Casa Clima',
    version: app.version,
    started: hub.startedAt,
    public_url: app.publicUrl(),
    settings: { ...config.data.settings, overrides: undefined }
  }));
  route('PUT', '/api/settings', async (req) => {
    const body = await readBody(req);
    const s = config.data.settings;
    if (body.public_url !== undefined) {
      const url = String(body.public_url || '').trim().replace(/\/$/, '');
      if (url && !/^https?:\/\/[^\s]+$/.test(url)) throw new HttpErr(400, 'Indirizzo non valido (deve iniziare con http:// o https://)');
      s.public_url = url;
    }
    if (body.history_days !== undefined) {
      const d = Number(body.history_days);
      if (!(d >= 1 && d <= 90)) throw new HttpErr(400, 'I giorni di storico devono essere tra 1 e 90');
      s.history_days = d;
      recorder.days = d;
    }
    await config.save();
    return { ok: true, settings: { ...s } };
  });
  route('GET', '/api/states', () => hub.snapshot());
  route('GET', '/api/states/:id', (req, res, p) => {
    const s = hub.getState(p.id);
    if (!s) throw new HttpErr(404, 'Entità non trovata');
    return s;
  });
  route('GET', '/api/entities', () => entityList());
  route('PATCH', '/api/entities/:id', async (req, res, p) => {
    if (!hub.entities.has(p.id)) throw new HttpErr(404, 'Entità non trovata');
    const body = await readBody(req);
    const ov = { ...(hub.overrides[p.id] || {}) };
    for (const k of ['name', 'area', 'hidden']) {
      if (body[k] === undefined) continue;
      if (body[k] === null || body[k] === '' && k === 'name') delete ov[k];
      else ov[k] = k === 'hidden' ? Boolean(body[k]) : String(body[k]).trim();
    }
    if (Object.keys(ov).length) hub.overrides[p.id] = ov;
    else delete hub.overrides[p.id];
    config.saveLater(500);
    hub.refreshState(p.id);
    casaClima.scheduleEmit();
    return { entity_id: p.id, ...ov };
  });
  route('PATCH', '/api/devices/:id', async (req, res, p) => {
    const id = decodeURIComponent(p.id);
    const dev = hub.devices.get(id);
    if (!dev) throw new HttpErr(404, 'Dispositivo non trovato');
    const { area } = await readBody(req);
    for (const m of hub.entities.values()) {
      if (m.device_id !== id) continue;
      hub.overrides[m.entity_id] = { ...(hub.overrides[m.entity_id] || {}), area: area ?? '' };
      hub.refreshState(m.entity_id);
    }
    config.saveLater(500);
    casaClima.scheduleEmit();
    return { ok: true };
  });
  route('GET', '/api/devices', () => devicesList());
  route('GET', '/api/areas', () => areas());
  route('POST', '/api/services/:domain/:service', async (req, res, p) => {
    const data = await readBody(req);
    const result = await hub.callService(p.domain, p.service, data, { user: true });
    return { ok: true, result: result ?? null };
  });
  route('GET', '/api/history', (req, res, p, url) => {
    const ids = (url.searchParams.get('entity_id') || '').split(',').filter(Boolean);
    const hours = Math.min(Number(url.searchParams.get('hours')) || 24, 24 * 31);
    return recorder.history(ids, hours);
  });
  route('GET', '/api/logbook', () => hub.logbook.slice(-200).reverse());
  route('GET', '/api/notifications', () => app.notifications);
  route('DELETE', '/api/notifications/:id', (req, res, p) => {
    app.notifications = app.notifications.filter((n) => n.id !== p.id);
    return { ok: true };
  });

  // --- Casa-Clima
  route('GET', '/api/casa-clima', () => casaClima.summary());

  // --- automazioni, scene, pacchetti
  route('GET', '/api/automations', () => ({ automations: automations.list(), errors: [...app.packageErrors, ...automations.errors] }));
  route('GET', '/api/scenes', () => scenes.list());
  route('GET', '/api/packages', async () => ({ files: await packages.files(), errors: app.packageErrors }));
  route('GET', '/api/packages/:name', async (req, res, p) => ({ name: p.name, content: await packages.read(decodeURIComponent(p.name)) }));
  route('PUT', '/api/packages/:name', async (req, res, p) => {
    const { content } = await readBody(req);
    try {
      await packages.write(decodeURIComponent(p.name), String(content ?? ''));
    } catch (err) {
      throw new HttpErr(err.status || 400, err.message);
    }
    return app.reloadPackages();
  });
  route('DELETE', '/api/packages/:name', async (req, res, p) => {
    await packages.remove(decodeURIComponent(p.name));
    return app.reloadPackages();
  });
  route('POST', '/api/packages/reload', () => app.reloadPackages());

  // --- integrazioni
  route('GET', '/api/integrations', () => ({ types: manager.types(), entries: manager.list() }));
  route('POST', '/api/integrations', async (req) => manager.add(await readBody(req)));
  route('PUT', '/api/integrations/:id', async (req, res, p) => manager.update(p.id, await readBody(req)));
  route('DELETE', '/api/integrations/:id', async (req, res, p) => { await manager.remove(p.id); return { ok: true }; });
  route('POST', '/api/integrations/:id/reload', (req, res, p) => manager.reload(p.id));
  route('POST', '/api/integrations/:id/auth', (req, res, p) => manager.startAuth(p.id));
  route('POST', '/api/integrations/:id/auth/code', async (req, res, p) => {
    const { input } = await readBody(req);
    const { code, state } = parseAuthInput(input);
    if (!code) throw new HttpErr(400, 'Codice mancante: incolla l\'indirizzo completo della pagina di ritorno');
    await manager.finishAuth({ code, state, entryId: p.id });
    return { ok: true };
  });
  route('GET', '/api/integrations/:id/webhooks', (req, res, p) => {
    const run = manager.running.get(p.id);
    return run?.instance.endpoints ? run.instance.endpoints() : [];
  });
  route('GET', '/api/oauth/callback', async (req, res, p, url) => {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error_description') || url.searchParams.get('error');
    let msg = 'Accesso completato. Puoi chiudere questa pagina.';
    let ok = true;
    if (error || !code) { ok = false; msg = `Accesso non riuscito: ${error || 'codice mancante'}`; }
    else {
      try { await manager.finishAuth({ code, state }); } catch (err) { ok = false; msg = `Accesso non riuscito: ${err.message}`; }
    }
    const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Casa Clima</title>
<body style="font-family:system-ui;background:#0f1115;color:#e8eaf0;display:grid;place-items:center;height:100vh;margin:0">
<div style="text-align:center;max-width:420px;padding:16px"><h2>${ok ? '✅' : '⚠️'} ${msg.replace(/</g, '&lt;')}</h2>
<p><a style="color:#7cc4ff" href="/#/integrazioni">Torna a Casa Clima</a></p></div><script>try{window.opener&&window.opener.postMessage('casa-clima-auth','*')}catch(e){}</script>`;
    send(res, ok ? 200 : 400, html, { 'Content-Type': 'text/html; charset=utf-8' });
  }, { open: true });

  // --- webhook (senza sessione: protetti dal segreto nell'indirizzo)
  const webhook = async (req, res, p, url) => {
    let params = Object.fromEntries(url.searchParams);
    if (req.method === 'POST') params = { ...params, ...(await readBody(req, 64_000).catch(() => ({}))) };
    for (const run of manager.running.values()) {
      if (run.instance.entry.type === 'webhook' && run.instance.data.secret === p.secret) {
        return run.instance.receive(p.key, params);
      }
    }
    throw new HttpErr(404, 'Webhook sconosciuto');
  };
  route('GET', '/api/webhook/:secret/:key', webhook, { open: true });
  route('POST', '/api/webhook/:secret/:key', webhook, { open: true });

  // --- stream
  route('GET', '/api/stream', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write('retry: 3000\n\n');
    res.write(`event: init\ndata: ${JSON.stringify({
      states: hub.snapshot(),
      devices: devicesList(),
      casa_clima: casaClima.summary(),
      integrations: manager.list(),
      notifications: app.notifications
    })}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return undefined;
  });

  // ------------------------------------------------------------ file statici

  async function serveStatic(req, res, url) {
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/' || !path.extname(rel)) rel = '/index.html';
    const file = path.normalize(path.join(webDir, rel));
    if (!file.startsWith(webDir)) return send(res, 403, 'Vietato');
    try {
      const data = await fs.readFile(file);
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
      });
      res.end(data);
    } catch {
      send(res, 404, 'Non trovato');
    }
  }

  // ------------------------------------------------------------ dispatcher

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (!url.pathname.startsWith('/api/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Metodo non permesso');
        return await serveStatic(req, res, url);
      }
      const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
      if (!r) throw new HttpErr(404, 'Percorso API sconosciuto');
      if (!r.open && !auth.verify(req)) throw new HttpErr(401, auth.configured ? 'Accesso richiesto' : 'Imposta una password');
      // protezione CSRF minima: le richieste che modificano devono essere JSON o arrivare dalla stessa origine
      if (!r.open && req.method !== 'GET') {
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host) throw new HttpErr(403, 'Origine non consentita');
      }
      const params = {};
      const m = url.pathname.match(r.re);
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      const out = await r.handler(req, res, params, url);
      if (!res.headersSent && out !== undefined) send(res, 200, out);
    } catch (err) {
      const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
      if (status >= 500) log.error(`${req.method} ${url.pathname}:`, err.stack || err.message);
      if (!res.headersSent) send(res, status, { error: err.message || 'Errore interno' });
      else res.end();
    }
  });
  server.broadcast = broadcast;
  return server;
}
