/*
 * tado° (API cloud https://my.tado.com/api/v2).
 * Dal 2025 tado accetta solo il login "device code": premi "Accedi", apri il link e conferma.
 * Attenzione: senza abbonamento Auto-Assist tado limita le richieste (circa 100 al giorno),
 * quindi l'aggiornamento predefinito è ogni 20 minuti.
 */
import { Integration, HVAC } from './base.js';
import { request, HttpError } from '../core/http.js';
import { TokenManager, AuthError } from '../core/oauth.js';
import { round } from '../core/util.js';
import { ServiceError } from '../core/hub.js';

const CLIENT_ID = '1bb50063-6b0c-4d11-bd99-387f4a91cc46';
const AUTH = 'https://login.tado.com/oauth2';
const API = 'https://my.tado.com/api/v2';

const TERMINATION = {
  manual: { typeSkillBasedApp: 'MANUAL' },
  next_block: { typeSkillBasedApp: 'NEXT_TIME_BLOCK' },
  timer: (sec) => ({ typeSkillBasedApp: 'TIMER', durationInSeconds: sec })
};

export class TadoIntegration extends Integration {
  static meta = {
    type: 'tado',
    name: 'tado°',
    icon: 'thermometer',
    description: 'Termostati, teste termostatiche e controllo clima tado° (V3+, X).',
    docs: 'Dopo aver salvato premi "Accedi": si apre la pagina tado dove confermare il codice. Il collegamento poi resta attivo.',
    auth: 'device',
    fields: [
      { key: 'home_id', label: 'ID casa (facoltativo, se hai più case)', type: 'text' },
      { key: 'overlay', label: 'Durata delle modifiche manuali', type: 'select', default: 'next_block', options: [
        { value: 'next_block', label: 'Fino al prossimo cambio di programma' },
        { value: 'manual', label: 'Finché non la annulli' },
        { value: 'timer', label: 'Per un\'ora' }
      ] },
      { key: 'poll_interval', label: 'Aggiornamento (secondi)', type: 'number', default: 1200, help: 'Senza abbonamento tado consente circa 100 richieste al giorno.' }
    ],
    defaultPollInterval: 1200
  };

  static async deviceStart() {
    return request(`${AUTH}/device_authorize`, { method: 'POST', form: { client_id: CLIENT_ID, scope: 'offline_access' } });
  }

  static async devicePoll(flow) {
    try {
      return await request(`${AUTH}/token`, {
        method: 'POST',
        form: { client_id: CLIENT_ID, device_code: flow.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }
      });
    } catch (err) {
      const code = err.body?.error;
      if (code === 'authorization_pending') return null;
      if (code === 'slow_down') return { slow_down: true };
      if (code === 'expired_token') throw new Error('Codice scaduto: premi di nuovo "Accedi"');
      if (code === 'access_denied') throw new Error('Accesso negato su tado');
      throw err;
    }
  }

  async setup() {
    this.tokens = new TokenManager({ tokenUrl: `${AUTH}/token`, clientId: CLIENT_ID, data: this.data, save: () => this.saveData() });
    if (!this.tokens.hasRefreshToken) throw new AuthError('Premi "Accedi" per collegare tado°');
    if (!this.data.home_id || (this.options.home_id && String(this.options.home_id) !== String(this.data.home_id))) {
      const me = await this.api('/me');
      const home = this.options.home_id ? me.homes.find((h) => String(h.id) === String(this.options.home_id)) : me.homes[0];
      if (!home) throw new Error('Nessuna casa trovata nell\'account tado');
      this.data.home_id = home.id;
      this.data.home_name = home.name;
      await this.saveData();
    }
    this.homeId = this.data.home_id;
    this.zones = await this.api(`/homes/${this.homeId}/zones`);
    this.byEntity = new Map();
  }

  async api(path, { method = 'GET', json } = {}) {
    const token = await this.tokens.getAccessToken();
    try {
      return await request(`${API}${path}`, { method, json, headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) this.tokens.invalidate();
      if (err instanceof HttpError && err.status === 429) throw new Error('Limite di richieste tado raggiunto: aumenta l\'intervallo di aggiornamento');
      throw err;
    }
  }

  async update() {
    const [{ zoneStates }, state] = await Promise.all([
      this.api(`/homes/${this.homeId}/zoneStates`),
      this.api(`/homes/${this.homeId}/state`).catch(() => null)
    ]);
    for (const zone of this.zones) {
      const zs = zoneStates[zone.id];
      if (!zs || !['HEATING', 'AIR_CONDITIONING'].includes(zone.type)) continue;
      this.publishZone(zone, zs);
    }
    if (state?.presence) {
      const p = this.entity('select', 'presence', { name: `tado ${this.data.home_name || ''} presenza`, slug: 'tado_presenza' });
      this.byEntity.set(p, { presence: true });
      this.set(p, state.presence === 'HOME' ? 'home' : 'away', { options: ['home', 'away', 'auto'], labels: { home: 'In casa', away: 'Fuori casa', auto: 'Automatica (geolocalizzazione)' }, locked: Boolean(state.presenceLocked) });
    }
    this.statusMessage = `${this.data.home_name || 'Casa'}: ${this.zones.length} zone`;
  }

  publishZone(zone, zs) {
    const devId = this.device(`zone_${zone.id}`, { name: `tado ${zone.name}`, manufacturer: 'tado°', model: zone.type === 'HEATING' ? 'Riscaldamento' : 'Clima', area: zone.name });
    const id = this.entity('climate', `zone_${zone.id}`, { name: `tado ${zone.name}`, slug: `tado_${zone.name}`, device_id: devId, area: zone.name });
    this.byEntity.set(id, { zone });
    const s = zs.setting || {};
    const on = s.power === 'ON';
    const isAc = zone.type === 'AIR_CONDITIONING';
    let hvac;
    if (!on) hvac = zs.overlay ? HVAC.OFF : HVAC.AUTO; // off da programma = "auto"
    else if (!zs.overlay) hvac = HVAC.AUTO;
    else if (isAc) hvac = { COOL: HVAC.COOL, HEAT: HVAC.HEAT, DRY: HVAC.DRY, FAN: HVAC.FAN, AUTO: HVAC.HEAT_COOL }[s.mode] || HVAC.COOL;
    else hvac = HVAC.HEAT;
    const inside = zs.sensorDataPoints?.insideTemperature?.celsius;
    const power = zs.activityDataPoints?.heatingPower?.percentage;
    const acPower = zs.activityDataPoints?.acPower?.value;
    let action = 'idle';
    if (!on) action = 'off';
    else if (power > 0) action = 'heating';
    else if (acPower === 'ON') action = s.mode === 'COOL' ? 'cooling' : s.mode === 'HEAT' ? 'heating' : s.mode === 'DRY' ? 'drying' : 'fan';
    this.set(id, hvac, {
      hvac_modes: isAc ? [HVAC.OFF, HVAC.AUTO, HVAC.COOL, HVAC.HEAT, HVAC.DRY, HVAC.FAN] : [HVAC.OFF, HVAC.HEAT, HVAC.AUTO],
      hvac_action: action,
      current_temperature: inside !== undefined ? round(inside, 1) : null,
      current_humidity: zs.sensorDataPoints?.humidity?.percentage ?? null,
      temperature: s.temperature?.celsius ?? null,
      min_temp: isAc ? 16 : 5, max_temp: isAc ? 30 : 25, target_temp_step: isAc ? 1 : 0.1,
      heating_power: power ?? null,
      overlay: zs.overlay ? zs.overlay.termination?.type || 'MANUAL' : null,
      open_window: Boolean(zs.openWindow || zs.openWindowDetected),
      zone_type: zone.type
    });
    const winId = this.entity('binary_sensor', `zone_${zone.id}_window`, { name: `tado ${zone.name} finestra aperta`, slug: `tado_${zone.name}_finestra`, device_id: devId, area: zone.name, device_class: 'window' });
    this.set(winId, zs.openWindow || zs.openWindowDetected ? 'on' : 'off', { detected_by: 'tado' });
  }

  termination() {
    const t = this.options.overlay || 'next_block';
    return t === 'timer' ? TERMINATION.timer(3600) : TERMINATION[t] || TERMINATION.next_block;
  }

  async setOverlay(zone, setting) {
    await this.api(`/homes/${this.homeId}/zones/${zone.id}/overlay`, { method: 'PUT', json: { setting, termination: this.termination() } });
  }

  async handleService(entity_id, service, data) {
    const ref = this.byEntity.get(entity_id);
    if (!ref) throw new ServiceError('Zona tado non trovata', 404);
    if (ref.presence) {
      if (data.option === 'auto') await this.api(`/homes/${this.homeId}/presenceLock`, { method: 'DELETE' });
      else await this.api(`/homes/${this.homeId}/presenceLock`, { method: 'PUT', json: { homePresence: data.option === 'home' ? 'HOME' : 'AWAY' } });
      this.patch(entity_id, data.option === 'auto' ? this.hub.getState(entity_id)?.state : data.option);
      return;
    }
    const zone = ref.zone;
    const isAc = zone.type === 'AIR_CONDITIONING';
    const cur = this.hub.getState(entity_id);
    const type = zone.type;
    let mode = data.hvac_mode;
    if (service === 'turn_off') mode = HVAC.OFF;
    if (service === 'turn_on') mode = isAc ? HVAC.COOL : HVAC.HEAT;

    if (service === 'set_temperature' && !mode) mode = cur.state === HVAC.OFF || cur.state === HVAC.AUTO ? (isAc ? HVAC.COOL : HVAC.HEAT) : cur.state;
    if (!['set_temperature', 'set_hvac_mode', 'turn_on', 'turn_off'].includes(service)) throw new ServiceError(`Servizio non supportato: ${service}`);

    if (mode === HVAC.AUTO) {
      await this.api(`/homes/${this.homeId}/zones/${zone.id}/overlay`, { method: 'DELETE' }); // torna al programma
      this.patch(entity_id, HVAC.AUTO, { overlay: null });
    } else if (mode === HVAC.OFF) {
      await this.setOverlay(zone, { type, power: 'OFF' });
      this.patch(entity_id, HVAC.OFF, { hvac_action: 'off' });
    } else {
      const celsius = Number(data.temperature ?? cur.attributes.temperature ?? (isAc ? 24 : 20));
      const setting = { type, power: 'ON' };
      if (isAc) {
        setting.mode = { [HVAC.COOL]: 'COOL', [HVAC.HEAT]: 'HEAT', [HVAC.DRY]: 'DRY', [HVAC.FAN]: 'FAN', [HVAC.HEAT_COOL]: 'AUTO' }[mode];
        if (!setting.mode) throw new ServiceError(`Modalità non supportata: ${mode}`);
        if (['COOL', 'HEAT', 'AUTO'].includes(setting.mode)) setting.temperature = { celsius };
      } else {
        setting.temperature = { celsius };
      }
      await this.setOverlay(zone, setting);
      this.patch(entity_id, mode, { temperature: setting.temperature?.celsius ?? null, overlay: 'MANUAL' });
    }
  }
}
