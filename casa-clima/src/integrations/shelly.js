/*
 * Shelly in rete locale (nessun cloud):
 *   - Gen1  (Shelly 1, 1PM, 2.5, Plug S, Dimmer, EM...)  -> API HTTP  /status, /relay/0?turn=on
 *   - Gen2+ (Plus, Pro, Gen3, Gen4, Mini...)             -> API RPC   /rpc/Shelly.GetStatus, /rpc/Switch.Set
 * La generazione viene riconosciuta da /shelly. Supporta password (Basic per Gen1, Digest SHA-256 per Gen2+).
 * I dispositivi a batteria (Door/Window, H&T) dormono: usa l'integrazione "Sensori push (webhook)".
 */
import { Integration } from './base.js';
import { request } from '../core/http.js';
import { round } from '../core/util.js';
import { ServiceError } from '../core/hub.js';

function parseHosts(text) {
  return String(text || '')
    .split(/[\n,;]+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [host, area] = line.split('|').map((s) => s.trim());
      return { host: host.replace(/^https?:\/\//, '').replace(/\/$/, ''), area: area || null };
    });
}

export class ShellyIntegration extends Integration {
  static meta = {
    type: 'shelly',
    name: 'Shelly',
    icon: 'plug',
    description: 'Relè, prese, tapparelle, dimmer e misuratori di energia Shelly (Gen1, Gen2, Gen3, Gen4) in rete locale.',
    docs: 'Assegna un IP fisso ai Shelly dal router. Una riga per dispositivo; dopo "|" puoi indicare la stanza.',
    fields: [
      { key: 'hosts', label: 'Indirizzi IP', type: 'textarea', required: true, placeholder: '192.168.1.20 | Soggiorno\n192.168.1.21 | Cucina\n192.168.1.30' },
      { key: 'username', label: 'Utente (solo se hai impostato una password)', type: 'text', placeholder: 'admin' },
      { key: 'password', label: 'Password', type: 'password', secret: true },
      { key: 'poll_interval', label: 'Aggiornamento (secondi)', type: 'number', default: 10 }
    ],
    defaultPollInterval: 10
  };

  async setup() {
    this.devices = parseHosts(this.options.hosts).map((h) => ({ ...h, gen: null, ok: false, entities: {} }));
    if (!this.devices.length) throw new Error('Nessun indirizzo configurato');
    await Promise.all(this.devices.map((d) => this.discover(d).catch((err) => { d.error = err.message; })));
    if (!this.devices.some((d) => d.gen)) throw new Error(this.devices.map((d) => `${d.host}: ${d.error}`).join('; '));
  }

  get auth() {
    return this.options.password ? { username: this.options.username || 'admin', password: this.options.password } : undefined;
  }

  async get(d, path, query) {
    return request(`http://${d.host}${path}`, { query, auth: d.gen >= 2 && this.auth ? { ...this.auth, digest: true } : this.auth, timeout: 6000 });
  }

  async discover(d) {
    const info = await request(`http://${d.host}/shelly`, { timeout: 6000 });
    d.gen = Number(info.gen) || 1;
    d.model = info.model || info.type || 'Shelly';
    d.mac = (info.mac || d.host).toLowerCase();
    let name = info.name;
    d.names = {};
    if (d.gen >= 2) {
      const cfg = await this.get(d, '/rpc/Shelly.GetConfig');
      name = name || cfg?.sys?.device?.name;
      for (const [k, v] of Object.entries(cfg || {})) if (v && typeof v === 'object' && v.name) d.names[k] = v.name;
    } else {
      const s = await this.get(d, '/settings');
      name = name || s.name;
      d.mode = s.mode;
      (s.relays || []).forEach((r, i) => { if (r.name) d.names[`switch:${i}`] = r.name; });
      (s.lights || []).forEach((r, i) => { if (r.name) d.names[`light:${i}`] = r.name; });
    }
    d.name = name || `${d.model} ${d.host}`;
    d.deviceId = this.device(d.mac, { name: d.name, manufacturer: 'Shelly', model: `${d.model} (Gen${d.gen})`, area: d.area, configuration_url: `http://${d.host}` });
  }

  /** Crea/aggiorna un'entità della mappa d.entities. */
  put(d, domain, key, label, state, attributes = {}, extra = {}) {
    const k = `${domain}:${key}`;
    if (!d.entities[k]) {
      d.entities[k] = this.entity(domain, `${d.mac}_${key}`, {
        name: label, slug: `shelly_${label}`, device_id: d.deviceId, area: d.area, ...extra
      });
    }
    this.set(d.entities[k], state, attributes);
    return d.entities[k];
  }

  label(d, comp, fallback) {
    return d.names[comp] || fallback;
  }

  async update() {
    let online = 0;
    await Promise.all(this.devices.map(async (d) => {
      try {
        if (!d.gen) await this.discover(d);
        if (d.gen >= 2) this.parseGen2(d, await this.get(d, '/rpc/Shelly.GetStatus'));
        else this.parseGen1(d, await this.get(d, '/status'));
        d.ok = true;
        d.error = null;
        online++;
      } catch (err) {
        d.ok = false;
        d.error = err.message;
        for (const id of Object.values(d.entities)) this.patch(id, 'unavailable');
      }
    }));
    this.statusMessage = `${online}/${this.devices.length} dispositivi online`;
    if (!online) throw new Error(this.devices.map((d) => `${d.host}: ${d.error}`).join('; '));
  }

  parseGen2(d, st) {
    const multi = (prefix) => Object.keys(st).filter((k) => k.startsWith(`${prefix}:`)).length > 1;
    for (const [comp, v] of Object.entries(st)) {
      const [type, idx] = comp.split(':');
      if (idx === undefined || !v || typeof v !== 'object') continue;
      const suffix = multi(type) ? ` ${Number(idx) + 1}` : '';
      const base = this.label(d, comp, `${d.name}${suffix}`);
      const key = `${type}${idx}`;
      if (type === 'switch') {
        this.put(d, 'switch', key, base, v.output ? 'on' : 'off', { gen: 2, channel: Number(idx), component: 'Switch' });
        if (v.apower !== undefined) this.put(d, 'sensor', `${key}_power`, `${base} potenza`, round(v.apower, 1), {}, { unit: 'W', device_class: 'power' });
        if (v.aenergy?.total !== undefined) this.put(d, 'sensor', `${key}_energy`, `${base} energia`, round(v.aenergy.total / 1000, 2), { state_class: 'total_increasing' }, { unit: 'kWh', device_class: 'energy' });
      } else if (type === 'light') {
        this.put(d, 'light', key, base, v.output ? 'on' : 'off', { brightness_pct: v.brightness, gen: 2, channel: Number(idx) });
      } else if (type === 'cover') {
        const state = { open: 'open', closed: 'closed', opening: 'opening', closing: 'closing' }[v.state] || (v.current_pos === 0 ? 'closed' : 'open');
        this.put(d, 'cover', key, base, state, { current_position: v.current_pos ?? null, gen: 2, channel: Number(idx) }, { device_class: 'shutter' });
        if (v.apower !== undefined) this.put(d, 'sensor', `${key}_power`, `${base} potenza`, round(v.apower, 1), {}, { unit: 'W', device_class: 'power' });
      } else if (type === 'input' && typeof v.state === 'boolean') {
        this.put(d, 'binary_sensor', key, this.label(d, comp, `${d.name} ingresso${suffix}`), v.state ? 'on' : 'off', {});
      } else if (type === 'em') {
        this.put(d, 'sensor', `${key}_power`, this.label(d, comp, `${d.name} potenza totale`), round(v.total_act_power, 0), {
          phase_a: v.a_act_power, phase_b: v.b_act_power, phase_c: v.c_act_power
        }, { unit: 'W', device_class: 'power' });
      } else if (type === 'em1' || type === 'pm1') {
        this.put(d, 'sensor', `${key}_power`, `${base} potenza`, round(v.act_power ?? v.apower, 0), {}, { unit: 'W', device_class: 'power' });
      } else if (type === 'temperature' && v.tC !== undefined) {
        this.put(d, 'sensor', key, this.label(d, comp, `${d.name} temperatura${suffix}`), round(v.tC, 1), {}, { unit: '°C', device_class: 'temperature' });
      } else if (type === 'humidity' && v.rh !== undefined) {
        this.put(d, 'sensor', key, this.label(d, comp, `${d.name} umidità${suffix}`), round(v.rh, 0), {}, { unit: '%', device_class: 'humidity' });
      } else if (type === 'devicepower' && v.battery?.percent !== undefined) {
        this.put(d, 'sensor', key, `${d.name} batteria`, v.battery.percent, {}, { unit: '%', device_class: 'battery' });
      }
    }
  }

  parseGen1(d, st) {
    const name = (comp, i, n) => this.label(d, comp, n > 1 ? `${d.name} ${i + 1}` : d.name);
    if (d.mode === 'roller') {
      (st.rollers || []).forEach((r, i) => {
        const state = r.state === 'open' ? 'opening' : r.state === 'close' ? 'closing' : r.current_pos === 0 ? 'closed' : 'open';
        this.put(d, 'cover', `roller${i}`, name(`cover:${i}`, i, st.rollers.length), state, { current_position: r.positioning ? r.current_pos : null, gen: 1, channel: i }, { device_class: 'shutter' });
      });
    } else {
      (st.relays || []).forEach((r, i) => {
        this.put(d, 'switch', `relay${i}`, name(`switch:${i}`, i, st.relays.length), r.ison ? 'on' : 'off', { gen: 1, channel: i });
      });
    }
    (st.lights || []).forEach((l, i) => {
      this.put(d, 'light', `light${i}`, name(`light:${i}`, i, st.lights.length), l.ison ? 'on' : 'off', { brightness_pct: l.brightness, gen: 1, channel: i });
    });
    (st.meters || []).forEach((m, i) => {
      this.put(d, 'sensor', `meter${i}_power`, `${name(`switch:${i}`, i, st.meters.length)} potenza`, round(m.power, 1), {}, { unit: 'W', device_class: 'power' });
    });
    (st.emeters || []).forEach((m, i) => {
      this.put(d, 'sensor', `emeter${i}_power`, `${d.name} fase ${i + 1} potenza`, round(m.power, 0), {}, { unit: 'W', device_class: 'power' });
    });
    if (st.emeters?.length > 1) {
      this.put(d, 'sensor', 'emeter_total', `${d.name} potenza totale`, round(st.emeters.reduce((a, m) => a + (m.power || 0), 0), 0), {}, { unit: 'W', device_class: 'power' });
    }
    if (st.tmp?.is_valid !== false && st.tmp?.tC !== undefined && !st.relays) {
      this.put(d, 'sensor', 'tmp', `${d.name} temperatura`, round(st.tmp.tC, 1), {}, { unit: '°C', device_class: 'temperature' });
    }
    if (st.hum?.value !== undefined) {
      this.put(d, 'sensor', 'hum', `${d.name} umidità`, round(st.hum.value, 0), {}, { unit: '%', device_class: 'humidity' });
    }
  }

  async handleService(entity_id, service, data) {
    const state = this.hub.getState(entity_id);
    const d = this.devices.find((x) => Object.values(x.entities).includes(entity_id));
    if (!d || !state) throw new ServiceError('Dispositivo Shelly non trovato', 404);
    const ch = state.attributes.channel ?? 0;
    const domain = entity_id.split('.')[0];
    const gen2 = d.gen >= 2;
    let on;
    if (service === 'toggle') on = state.state !== 'on';
    else if (service === 'turn_on') on = true;
    else if (service === 'turn_off') on = false;

    if (domain === 'switch' && on !== undefined) {
      if (gen2) await this.get(d, '/rpc/Switch.Set', { id: ch, on });
      else await this.get(d, `/relay/${ch}`, { turn: on ? 'on' : 'off' });
      this.patch(entity_id, on ? 'on' : 'off');
    } else if (domain === 'light' && on !== undefined) {
      const bri = data.brightness_pct !== undefined ? Math.round(Number(data.brightness_pct)) : undefined;
      if (gen2) await this.get(d, '/rpc/Light.Set', { id: ch, on, brightness: bri });
      else await this.get(d, `/light/${ch}`, { turn: on ? 'on' : 'off', brightness: bri });
      this.patch(entity_id, on ? 'on' : 'off', bri !== undefined ? { brightness_pct: bri } : {});
    } else if (domain === 'cover') {
      const pos = service === 'set_cover_position' ? Math.round(Number(data.position)) : undefined;
      if (gen2) {
        const m = { open_cover: 'Cover.Open', close_cover: 'Cover.Close', stop_cover: 'Cover.Stop', set_cover_position: 'Cover.GoToPosition' }[service];
        if (!m) throw new ServiceError(`Servizio non supportato: ${service}`);
        await this.get(d, `/rpc/${m}`, { id: ch, pos });
      } else {
        const go = { open_cover: 'open', close_cover: 'close', stop_cover: 'stop', set_cover_position: 'to_pos' }[service];
        if (!go) throw new ServiceError(`Servizio non supportato: ${service}`);
        await this.get(d, `/roller/${ch}`, { go, roller_pos: pos });
      }
    } else {
      throw new ServiceError(`Servizio ${service} non supportato da ${entity_id}`);
    }
    setTimeout(() => this.update().catch(() => {}), 1200);
  }
}
