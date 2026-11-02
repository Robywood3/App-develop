/*
 * Sensori "push" via webhook: per i dispositivi a batteria che dormono e non si possono
 * interrogare (Shelly Door/Window, Shelly H&T, sensori BLU tramite gateway, ESPHome, script...).
 * Il dispositivo chiama un indirizzo come:
 *   http://CASA-CLIMA:8123/api/webhook/<segreto>/finestra_soggiorno?state=open
 *   http://CASA-CLIMA:8123/api/webhook/<segreto>/ht_camera?temp=20.5&hum=48
 */
import { Integration } from './base.js';
import { slugify, randomId, round, isNumeric } from '../core/util.js';
import { ServiceError } from '../core/hub.js';

const BINARY = { window: 'window', door: 'door', motion: 'motion', binario: null, binary: null };
const ON = new Set(['on', 'open', 'opened', '1', 'true', 'aperta', 'aperto', 'detected', 'motion']);

export function parseSensors(text) {
  return String(text || '').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((line) => {
    const [name, type = 'window', area] = line.split('|').map((s) => s.trim());
    return { name, key: slugify(name), type: type.toLowerCase(), area: area || null };
  });
}

export class WebhookIntegration extends Integration {
  static meta = {
    type: 'webhook',
    name: 'Sensori push (webhook)',
    icon: 'bolt',
    description: 'Finestre, porte, movimento e temperatura da dispositivi che inviano i dati (Shelly Door/Window, H&T, ESPHome…).',
    docs: 'Una riga per sensore: nome | tipo | stanza. Tipi: window, door, motion, binary, temperature (accetta anche hum=). Dopo il salvataggio vedrai gli indirizzi da inserire nelle "Azioni" del dispositivo.',
    fields: [
      { key: 'sensors', label: 'Sensori', type: 'textarea', required: true, placeholder: 'Finestra soggiorno | window | Soggiorno\nPorta ingresso | door\nH&T camera | temperature | Camera da letto' }
    ],
    defaultPollInterval: 3600
  };

  async setup() {
    if (!this.data.secret) {
      this.data.secret = randomId(12);
      await this.saveData();
    }
    this.sensors = parseSensors(this.options.sensors);
    for (const s of this.sensors) {
      const devId = this.device(s.key, { name: s.name, manufacturer: 'Webhook', area: s.area });
      if (s.type === 'temperature') {
        s.temp = this.entity('sensor', `${s.key}_t`, { name: `${s.name} temperatura`, slug: `${s.name}_temperatura`, device_id: devId, area: s.area, unit: '°C', device_class: 'temperature' });
        s.hum = this.entity('sensor', `${s.key}_h`, { name: `${s.name} umidità`, slug: `${s.name}_umidita`, device_id: devId, area: s.area, unit: '%', device_class: 'humidity' });
        if (!this.hub.getState(s.temp)) { this.set(s.temp, null, {}); this.set(s.hum, null, {}); }
      } else {
        s.id = this.entity('binary_sensor', s.key, { name: s.name, slug: s.name, device_id: devId, area: s.area, device_class: BINARY[s.type] ?? null });
        const saved = this.data.last?.[s.key];
        if (!this.hub.getState(s.id)) this.set(s.id, saved ?? 'off', { webhook: this.urlFor(s) });
      }
    }
  }

  urlFor(s) {
    const base = `${this.ctx.publicUrl()}/api/webhook/${this.data.secret}/${s.key}`;
    return s.type === 'temperature' ? `${base}?temp=21.5&hum=50` : `${base}?state=open`;
  }

  get statusMessage() {
    return `${this.sensors?.length || 0} sensori in ascolto`;
  }

  set statusMessage(_) { /* calcolato */ }

  /** Chiamato dal server HTTP. */
  receive(key, params) {
    const s = this.sensors.find((x) => x.key === key);
    if (!s) throw new ServiceError(`Sensore sconosciuto: ${key}`, 404);
    if (s.type === 'temperature') {
      const t = params.temp ?? params.temperature ?? params.tC;
      const h = params.hum ?? params.humidity ?? params.rh;
      if (isNumeric(t)) this.set(s.temp, round(Number(t), 1), { last_report: new Date().toISOString() });
      if (isNumeric(h)) this.set(s.hum, Math.round(Number(h)), { last_report: new Date().toISOString() });
    } else {
      const raw = String(params.state ?? params.value ?? '').toLowerCase();
      const state = ON.has(raw) ? 'on' : 'off';
      this.set(s.id, state, { webhook: this.urlFor(s), last_report: new Date().toISOString() });
      this.data.last = { ...(this.data.last || {}), [s.key]: state };
      this.ctx.saveLater?.();
    }
    return { ok: true };
  }

  endpoints() {
    return (this.sensors || []).map((s) => ({ name: s.name, type: s.type, url: this.urlFor(s) }));
  }
}
