/*
 * Daikin in rete locale, adattatori Wi-Fi BRP069A / BRP069B (e unità con Wi-Fi integrato
 * della stessa famiglia: Emura, Perfera, Stylish con firmware "Daikin Online Controller").
 *
 * Protocollo (testo "chiave=valore" separato da virgole):
 *   GET /common/basic_info          nome, mac, ecc. (il nome è codificato in %XX)
 *   GET /aircon/get_control_info    pow, mode, stemp, shum, f_rate, f_dir, dt1..dt7 (setpoint per modo)
 *   GET /aircon/get_sensor_info     htemp (interna), otemp (esterna), hhum
 *   GET /aircon/set_control_info    pow, mode, stemp, shum, f_rate, f_dir (tutti obbligatori)
 *
 * Gli adattatori più recenti (BRP069C, BRP084) funzionano solo via cloud: usa "Daikin Onecta".
 */
import { Integration, HVAC } from './base.js';
import { request } from '../core/http.js';
import { round } from '../core/util.js';
import { ServiceError } from '../core/hub.js';

const MODE_TO_HVAC = { 0: HVAC.AUTO, 1: HVAC.AUTO, 7: HVAC.AUTO, 2: HVAC.DRY, 3: HVAC.COOL, 4: HVAC.HEAT, 6: HVAC.FAN };
const HVAC_TO_MODE = { [HVAC.AUTO]: '0', [HVAC.DRY]: '2', [HVAC.COOL]: '3', [HVAC.HEAT]: '4', [HVAC.FAN]: '6' };
const FAN_TO_LABEL = { A: 'auto', B: 'quiet', 3: '1', 4: '2', 5: '3', 6: '4', 7: '5' };
const LABEL_TO_FAN = Object.fromEntries(Object.entries(FAN_TO_LABEL).map(([k, v]) => [v, k]));

export function parseDaikin(text) {
  const out = {};
  for (const part of String(text).split(',')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i)] = part.slice(i + 1);
  }
  return out;
}

function decodeName(n) {
  try { return decodeURIComponent(n); } catch { return n; }
}

function num(v) {
  const n = Number(v);
  return v === undefined || v === '-' || v === '--' || Number.isNaN(n) ? null : n;
}

export class DaikinLocalIntegration extends Integration {
  static meta = {
    type: 'daikin',
    name: 'Daikin (rete locale)',
    icon: 'snowflake',
    description: 'Climatizzatori Daikin con adattatore Wi-Fi BRP069A/BRP069B, controllati direttamente in rete locale.',
    docs: 'Se l\'unità usa l\'app Onecta con un adattatore recente (BRP069C/BRP084) usa invece "Daikin Onecta (cloud)".',
    fields: [
      { key: 'hosts', label: 'Indirizzi IP', type: 'textarea', required: true, placeholder: '192.168.1.40 | Soggiorno\n192.168.1.41 | Camera da letto' },
      { key: 'poll_interval', label: 'Aggiornamento (secondi)', type: 'number', default: 30 }
    ],
    defaultPollInterval: 30
  };

  async setup() {
    this.units = String(this.options.hosts || '').split(/[\n,;]+/).map((l) => l.trim()).filter(Boolean).map((line) => {
      const [host, area] = line.split('|').map((s) => s.trim());
      return { host, area: area || null, ids: null, control: null };
    });
    if (!this.units.length) throw new Error('Nessun indirizzo configurato');
    await Promise.all(this.units.map((u) => this.discover(u).catch((err) => { u.error = err.message; })));
    if (!this.units.some((u) => u.ids)) throw new Error(this.units.map((u) => `${u.host}: ${u.error}`).join('; '));
  }

  async call(u, path, query) {
    const text = await request(`http://${u.host}${path}`, { query, timeout: 8000 });
    const data = parseDaikin(text);
    if (data.ret && data.ret !== 'OK') throw new Error(`${u.host}: risposta ${data.ret}`);
    return data;
  }

  async discover(u) {
    const info = await this.call(u, '/common/basic_info');
    u.name = decodeName(info.name || '') || `Daikin ${u.host}`;
    u.mac = (info.mac || u.host).toLowerCase();
    const area = u.area || u.name;
    const dev = this.device(u.mac, { name: u.name, manufacturer: 'Daikin', model: `Adattatore ${info.adp_kind ? 'BRP069' : 'Wi-Fi'} (fw ${info.ver || '?'})`, area, configuration_url: `http://${u.host}` });
    u.ids = {
      climate: this.entity('climate', `${u.mac}`, { name: u.name, slug: `daikin_${u.name}`, device_id: dev, area }),
      inside: this.entity('sensor', `${u.mac}_in`, { name: `${u.name} temperatura`, slug: `daikin_${u.name}_temperatura`, device_id: dev, area, unit: '°C', device_class: 'temperature' }),
      outside: this.entity('sensor', `${u.mac}_out`, { name: `${u.name} temperatura esterna`, slug: `daikin_${u.name}_temperatura_esterna`, device_id: dev, unit: '°C', device_class: 'temperature' })
    };
  }

  async update() {
    let ok = 0;
    await Promise.all(this.units.map(async (u) => {
      try {
        if (!u.ids) await this.discover(u);
        const [c, s] = await Promise.all([this.call(u, '/aircon/get_control_info'), this.call(u, '/aircon/get_sensor_info')]);
        u.control = c;
        this.publish(u, c, s);
        ok++;
      } catch (err) {
        u.error = err.message;
        if (u.ids) for (const id of Object.values(u.ids)) this.patch(id, 'unavailable');
      }
    }));
    this.statusMessage = `${ok}/${this.units.length} unità online`;
    if (!ok) throw new Error(this.units.map((u) => `${u.host}: ${u.error}`).join('; '));
  }

  publish(u, c, s) {
    const on = c.pow === '1';
    const mode = MODE_TO_HVAC[c.mode] || HVAC.AUTO;
    const inside = num(s.htemp);
    const hvac = on ? mode : HVAC.OFF;
    let action = 'off';
    if (on) action = mode === HVAC.HEAT ? 'heating' : mode === HVAC.COOL ? 'cooling' : mode === HVAC.DRY ? 'drying' : mode === HVAC.FAN ? 'fan' : 'idle';
    this.set(u.ids.climate, hvac, {
      hvac_modes: [HVAC.OFF, HVAC.HEAT, HVAC.COOL, HVAC.AUTO, HVAC.DRY, HVAC.FAN],
      hvac_action: action,
      current_temperature: inside,
      current_humidity: num(s.hhum),
      temperature: num(c.stemp),
      min_temp: mode === HVAC.HEAT ? 10 : 18,
      max_temp: mode === HVAC.COOL ? 32 : 30,
      target_temp_step: 0.5,
      fan_mode: FAN_TO_LABEL[c.f_rate] || c.f_rate,
      fan_modes: Object.values(FAN_TO_LABEL),
      swing_mode: { 0: 'off', 1: 'vertical', 2: 'horizontal', 3: 'both' }[c.f_dir] || 'off',
      swing_modes: ['off', 'vertical', 'horizontal', 'both'],
      outdoor_temperature: num(s.otemp)
    });
    this.set(u.ids.inside, inside, {});
    this.set(u.ids.outside, num(s.otemp), {});
  }

  async handleService(entity_id, service, data) {
    const u = this.units.find((x) => x.ids?.climate === entity_id);
    if (!u) throw new ServiceError('Unità Daikin non trovata', 404);
    const c = u.control || (await this.call(u, '/aircon/get_control_info'));
    const next = { pow: c.pow, mode: c.mode, stemp: c.stemp, shum: c.shum, f_rate: c.f_rate, f_dir: c.f_dir };

    const applyMode = (hvac) => {
      if (hvac === HVAC.OFF) { next.pow = '0'; return; }
      const m = HVAC_TO_MODE[hvac === HVAC.HEAT_COOL ? HVAC.AUTO : hvac];
      if (!m) throw new ServiceError(`Modalità non supportata: ${hvac}`);
      next.pow = '1';
      next.mode = m;
      // ogni modalità ricorda il proprio setpoint (dt1..dt7, dh1..dh7)
      next.stemp = c[`dt${m}`] ?? next.stemp;
      next.shum = c[`dh${m}`] ?? next.shum;
    };

    if (service === 'set_hvac_mode') applyMode(data.hvac_mode);
    else if (service === 'turn_off') next.pow = '0';
    else if (service === 'turn_on') next.pow = '1';
    else if (service === 'set_fan_mode') next.f_rate = LABEL_TO_FAN[data.fan_mode] || data.fan_mode;
    else if (service === 'set_swing_mode') next.f_dir = { off: '0', vertical: '1', horizontal: '2', both: '3' }[data.swing_mode] ?? '0';
    else if (service === 'set_temperature') {
      if (data.hvac_mode) applyMode(data.hvac_mode);
      next.stemp = String(round(Number(data.temperature), 1));
    } else throw new ServiceError(`Servizio non supportato: ${service}`);

    // in deumidificazione/ventilazione l'unità non accetta un setpoint numerico
    if (next.mode === '6' || next.mode === '2') { next.stemp = next.stemp && next.stemp !== '--' ? next.stemp : '--'; }
    if (!next.shum || next.shum === '--') next.shum = next.mode === '2' ? 'AUTO' : '0';
    await this.call(u, '/aircon/set_control_info', next);
    setTimeout(() => this.update().catch(() => {}), 1500);
  }
}
