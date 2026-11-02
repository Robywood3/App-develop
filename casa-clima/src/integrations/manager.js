/*
 * Gestore delle integrazioni configurate (come homeassistant/config_entries.py):
 * carica le voci salvate, le avvia, pianifica gli aggiornamenti con backoff in caso di errore,
 * e gestisce i flussi di login (OAuth "authorization code" e "device code").
 */
import { createHash, randomBytes } from 'node:crypto';
import { createLogger, randomId, sleep } from '../core/util.js';
import { TokenManager } from '../core/oauth.js';
import { INTEGRATIONS } from './index.js';

const log = createLogger('integrations');

const SECRET_MASK = '••••••••';

export class IntegrationManager {
  constructor(hub, store, { publicUrl }) {
    this.hub = hub;
    this.store = store;
    this.publicUrl = publicUrl;
    /** @type {Map<string, {instance, timer, failures}>} */
    this.running = new Map();
    this.flows = new Map(); // state -> { entryId, verifier, redirectUri, created }
    this.deviceFlows = new Map(); // entryId -> { status, user_code, url, ... }
  }

  get entries() {
    return this.store.data.integrations;
  }

  types() {
    return Object.values(INTEGRATIONS).map((cls) => {
      const { type, name, description, fields, auth, authWhen, docs, icon, multiple = true, defaultPollInterval } = cls.meta;
      return { type, name, description, fields, auth, authWhen, docs, icon, multiple, defaultPollInterval };
    });
  }

  /** Vista per l'interfaccia: i campi segreti vengono mascherati. */
  publicEntry(entry) {
    const cls = INTEGRATIONS[entry.type];
    const options = { ...entry.options };
    for (const f of cls?.meta.fields || []) {
      if (f.secret && options[f.key]) options[f.key] = SECRET_MASK;
    }
    const run = this.running.get(entry.id);
    return {
      id: entry.id,
      type: entry.type,
      title: entry.title,
      enabled: entry.enabled !== false,
      options,
      logged_in: Boolean(entry.data?.refresh_token || entry.data?.access_token),
      status: run?.instance.status || { state: entry.enabled === false ? 'disabled' : 'stopped' },
      entities: [...this.hub.entities.values()].filter((m) => m.entry_id === entry.id).length,
      device_flow: this.deviceFlows.get(entry.id) || null
    };
  }

  list() {
    return this.entries.map((e) => this.publicEntry(e));
  }

  async startAll() {
    for (const entry of this.entries) {
      if (entry.enabled !== false) this.start(entry).catch((err) => log.error(err));
    }
  }

  async stopAll() {
    for (const id of [...this.running.keys()]) await this.stop(id);
  }

  saveEntry = async () => {
    await this.store.save();
  };

  async start(entry) {
    const cls = INTEGRATIONS[entry.type];
    if (!cls) {
      log.warn(`Integrazione sconosciuta: ${entry.type}`);
      return;
    }
    await this.stop(entry.id);
    const instance = new cls(this.hub, entry, {
      saveEntry: this.saveEntry,
      saveLater: () => this.store.saveLater(),
      settings: this.store.data.settings,
      publicUrl: this.publicUrl
    });
    const run = { instance, timer: null, failures: 0, stopped: false };
    this.running.set(entry.id, run);

    const loop = async (first) => {
      if (run.stopped) return;
      try {
        if (first) {
          instance.status = { state: 'setup', message: 'Connessione…' };
          await instance.setup();
        }
        await instance.update();
        run.failures = 0;
        instance.status = { state: 'ok', message: instance.statusMessage || 'Connesso', updated: new Date().toISOString() };
        run.ready = true;
      } catch (err) {
        run.failures++;
        instance.status = {
          state: err.auth ? 'auth' : 'error',
          message: err.message,
          updated: new Date().toISOString()
        };
        log.warn(`${entry.type} (${entry.title}): ${err.message}`);
        if (err.auth) {
          // senza login valido non ha senso riprovare a raffica: aspetta un nuovo accesso
          run.timer = setTimeout(() => loop(!run.ready), 15 * 60 * 1000);
          this.hub.emit('integrations_changed');
          return;
        }
      }
      this.hub.emit('integrations_changed');
      if (run.stopped) return;
      const base = instance.pollInterval * 1000;
      const delay = run.failures ? Math.min(base * 2 ** (run.failures - 1), 30 * 60 * 1000, Math.max(base, 30000) * 8) : base;
      run.timer = setTimeout(() => loop(!run.ready), Math.max(delay, 5000));
    };
    await loop(true);
    return instance;
  }

  /** Forza un aggiornamento immediato (es. dopo un comando). */
  async refresh(entryId, delayMs = 0) {
    const run = this.running.get(entryId);
    if (!run || !run.ready) return;
    if (delayMs) await sleep(delayMs);
    try {
      await run.instance.update();
    } catch (err) {
      log.warn(`refresh ${entryId}: ${err.message}`);
    }
  }

  async stop(id) {
    const run = this.running.get(id);
    if (!run) return;
    run.stopped = true;
    clearTimeout(run.timer);
    this.running.delete(id);
    try {
      await run.instance.unload();
    } catch (err) {
      log.warn(`unload ${id}: ${err.message}`);
    }
  }

  // ------------------------------------------------------------ CRUD

  cleanOptions(type, options, previous = {}) {
    const cls = INTEGRATIONS[type];
    const out = {};
    for (const f of cls.meta.fields) {
      let v = options?.[f.key];
      if (f.secret && v === SECRET_MASK) v = previous[f.key];
      if (v === undefined || v === '') {
        if (f.required && previous[f.key] === undefined && f.default === undefined) {
          throw Object.assign(new Error(`Campo obbligatorio: ${f.label}`), { status: 400 });
        }
        v = v === '' ? undefined : (previous[f.key] ?? f.default);
      }
      if (v === undefined) continue;
      if (f.type === 'number') v = Number(v);
      if (f.type === 'checkbox') v = v === true || v === 'true' || v === 'on';
      out[f.key] = v;
    }
    return out;
  }

  async add({ type, title, options }) {
    const cls = INTEGRATIONS[type];
    if (!cls) throw Object.assign(new Error(`Tipo sconosciuto: ${type}`), { status: 400 });
    if (cls.meta.multiple === false && this.entries.some((e) => e.type === type)) {
      throw Object.assign(new Error(`${cls.meta.name} è già configurato`), { status: 400 });
    }
    const entry = {
      id: `${type}_${randomId(3)}`,
      type,
      title: title || cls.meta.name,
      enabled: true,
      options: this.cleanOptions(type, options),
      data: {}
    };
    this.entries.push(entry);
    await this.store.save();
    this.start(entry).catch((err) => log.error(err));
    return this.publicEntry(entry);
  }

  async update(id, { title, options, enabled }) {
    const entry = this.get(id);
    if (title !== undefined) entry.title = title;
    if (options !== undefined) entry.options = this.cleanOptions(entry.type, options, entry.options);
    if (enabled !== undefined) entry.enabled = Boolean(enabled);
    await this.store.save();
    if (entry.enabled) this.start(entry).catch((err) => log.error(err));
    else await this.stop(id);
    this.hub.emit('integrations_changed');
    return this.publicEntry(entry);
  }

  async remove(id) {
    this.get(id);
    await this.stop(id);
    this.store.data.integrations = this.entries.filter((e) => e.id !== id);
    await this.store.save();
    this.hub.emit('integrations_changed');
  }

  async reload(id) {
    const entry = this.get(id);
    if (entry.enabled !== false) await this.start(entry);
    return this.publicEntry(entry);
  }

  get(id) {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) throw Object.assign(new Error('Integrazione non trovata'), { status: 404 });
    return entry;
  }

  // ------------------------------------------------------------ login flows

  redirectUri(entry) {
    return entry.options.redirect_uri || `${this.publicUrl()}/api/oauth/callback`;
  }

  /** Avvia il login. Ritorna { kind: 'oauth', url } oppure { kind: 'device', user_code, url }. */
  async startAuth(id) {
    const entry = this.get(id);
    const cls = INTEGRATIONS[entry.type];
    if (cls.meta.auth === 'oauth') {
      const cfg = cls.oauthConfig(entry.options);
      const state = randomId(12);
      const verifier = randomBytes(32).toString('base64url');
      const redirectUri = this.redirectUri(entry);
      this.flows.set(state, { entryId: id, verifier, redirectUri, created: Date.now() });
      const url = new URL(cfg.authorizeUrl);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('client_id', cfg.clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('scope', cfg.scope);
      url.searchParams.set('state', state);
      if (cfg.pkce) {
        url.searchParams.set('code_challenge', createHash('sha256').update(verifier).digest('base64url'));
        url.searchParams.set('code_challenge_method', 'S256');
      }
      for (const [k, v] of Object.entries(cfg.authorizeParams || {})) url.searchParams.set(k, v);
      return { kind: 'oauth', url: url.toString(), redirect_uri: redirectUri };
    }
    if (cls.meta.auth === 'device') {
      const flow = await cls.deviceStart(entry.options);
      const state = { status: 'pending', user_code: flow.user_code, url: flow.verification_uri_complete || flow.verification_uri, expires: Date.now() + flow.expires_in * 1000 };
      this.deviceFlows.set(id, state);
      this.pollDeviceFlow(entry, cls, flow, state);
      this.hub.emit('integrations_changed');
      return { kind: 'device', ...state };
    }
    throw Object.assign(new Error('Questa integrazione non richiede login'), { status: 400 });
  }

  async pollDeviceFlow(entry, cls, flow, state) {
    let interval = Math.max(Number(flow.interval) || 5, 3);
    while (Date.now() < state.expires && this.deviceFlows.get(entry.id) === state) {
      await sleep(interval * 1000);
      try {
        const tokens = await cls.devicePoll(flow, entry.options);
        if (!tokens) continue; // ancora in attesa
        if (tokens.slow_down) { interval += 5; continue; }
        new TokenManager({ data: entry.data }).storeTokens(tokens);
        await this.store.save();
        state.status = 'done';
        this.hub.emit('integrations_changed');
        setTimeout(() => this.deviceFlows.delete(entry.id), 60000);
        await this.start(entry);
        return;
      } catch (err) {
        state.status = 'error';
        state.message = err.message;
        this.hub.emit('integrations_changed');
        return;
      }
    }
    if (state.status === 'pending') {
      state.status = 'expired';
      this.hub.emit('integrations_changed');
    }
  }

  /** Callback OAuth: `input` può essere il codice o l'intero URL di ritorno incollato a mano. */
  async finishAuth({ state, code, entryId }) {
    let flow = state && this.flows.get(state);
    if (!flow && entryId) {
      // incollato a mano: usa l'ultimo flusso avviato per questa integrazione
      flow = [...this.flows.values()].reverse().find((f) => f.entryId === entryId);
    }
    if (!flow) throw Object.assign(new Error('Richiesta di login scaduta: riprova'), { status: 400 });
    const entry = this.get(flow.entryId);
    const cls = INTEGRATIONS[entry.type];
    const cfg = cls.oauthConfig(entry.options);
    const tm = new TokenManager({
      tokenUrl: cfg.tokenUrl,
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      data: entry.data,
      save: () => this.store.save(),
      extra: cfg.tokenParams
    });
    await tm.exchangeCode(code, flow.redirectUri, cfg.pkce ? flow.verifier : undefined);
    for (const [k, f] of this.flows) if (f.entryId === flow.entryId) this.flows.delete(k);
    this.start(entry).catch((err) => log.error(err));
    return entry;
  }
}

export function parseAuthInput(input) {
  const s = String(input || '').trim();
  if (/^https?:\/\//.test(s) || s.includes('code=')) {
    const u = new URL(s.startsWith('http') ? s : `http://x/?${s.replace(/^\?/, '')}`);
    return { code: u.searchParams.get('code'), state: u.searchParams.get('state') };
  }
  return { code: s, state: null };
}
