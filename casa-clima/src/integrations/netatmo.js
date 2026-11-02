/*
 * Netatmo (API ufficiale https://api.netatmo.com):
 *   - Energy: Termostato/Valvole intelligenti -> homesdata + homestatus, setroomthermpoint, setthermmode
 *   - Weather: Stazione meteo -> getstationsdata
 * Il refresh token Netatmo cambia a ogni rinnovo: viene salvato automaticamente.
 */
import { Integration, HVAC } from './base.js';
import { request, HttpError } from '../core/http.js';
import { TokenManager, AuthError } from '../core/oauth.js';
import { round } from '../core/util.js';
import { ServiceError } from '../core/hub.js';

const API = 'https://api.netatmo.com';
const HOME_MODES = { schedule: 'Programma', away: 'Assenza', hg: 'Antigelo' };

export class NetatmoIntegration extends Integration {
  static meta = {
    type: 'netatmo',
    name: 'Netatmo',
    icon: 'thermometer',
    description: 'Termostato e valvole Netatmo (Energy) e stazione meteo Netatmo (Weather).',
    docs: 'Crea un\'app su https://dev.netatmo.com/apps. Puoi usare "Accedi" (Redirect URI = quello mostrato) oppure generare un token dalla pagina dell\'app con gli scope read_thermostat write_thermostat read_station e incollare qui il refresh token.',
    auth: 'oauth',
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client secret', type: 'password', secret: true, required: true },
      { key: 'refresh_token', label: 'Refresh token (facoltativo, al posto di "Accedi")', type: 'password', secret: true },
      { key: 'redirect_uri', label: 'Redirect URI (facoltativo)', type: 'text' },
      { key: 'manual_hours', label: 'Durata delle temperature manuali (ore)', type: 'number', default: 12, help: 'Dopo questo tempo la stanza torna al programma Netatmo' },
      { key: 'poll_interval', label: 'Aggiornamento (secondi)', type: 'number', default: 120 }
    ],
    defaultPollInterval: 120
  };

  static oauthConfig(o) {
    return {
      authorizeUrl: `${API}/oauth2/authorize`,
      tokenUrl: `${API}/oauth2/token`,
      clientId: o.client_id,
      clientSecret: o.client_secret,
      scope: 'read_thermostat write_thermostat read_station'
    };
  }

  async setup() {
    // un refresh token incollato a mano ha la precedenza (solo la prima volta)
    if (this.options.refresh_token && this.data.seed_token !== this.options.refresh_token) {
      this.data.refresh_token = this.options.refresh_token;
      this.data.seed_token = this.options.refresh_token;
      this.data.expires_at = 0;
      await this.saveData();
    }
    this.tokens = new TokenManager({ ...NetatmoIntegration.oauthConfig(this.options), data: this.data, save: () => this.saveData() });
    if (!this.tokens.hasRefreshToken) throw new AuthError('Premi "Accedi" o incolla un refresh token');
    this.rooms = new Map(); // entity_id -> { homeId, roomId }
    this.homes = new Map(); // select entity_id -> homeId
    this.homesData = null;
    this.homesDataAt = 0;
  }

  async api(path, { method = 'GET', query, form } = {}) {
    const token = await this.tokens.getAccessToken();
    try {
      const res = await request(`${API}${path}`, { method, query, form, headers: { Authorization: `Bearer ${token}` } });
      return res.body ?? res;
    } catch (err) {
      if (err instanceof HttpError && (err.status === 401 || err.body?.error?.code === 3 || err.body?.error?.code === 2)) {
        this.tokens.invalidate();
      }
      throw err;
    }
  }

  async update() {
    // la struttura della casa cambia raramente: la rileggo ogni ora
    if (!this.homesData || Date.now() - this.homesDataAt > 3600_000) {
      this.homesData = await this.api('/api/homesdata');
      this.homesDataAt = Date.now();
    }
    let rooms = 0;
    for (const home of this.homesData.homes || []) {
      const hasTherm = (home.modules || []).some((m) => ['NATherm1', 'NRV', 'NAPlug', 'OTH', 'OTM', 'BNS'].includes(m.type));
      if (!hasTherm) continue;
      const status = await this.api('/api/homestatus', { query: { home_id: home.id } });
      rooms += this.publishHome(home, status.home || {});
    }
    const stations = await this.api('/api/getstationsdata').catch((err) => {
      if (err instanceof HttpError && err.status === 403) return null; // scope read_station non concesso
      throw err;
    });
    let modules = 0;
    for (const st of stations?.devices || []) modules += this.publishStation(st);
    this.statusMessage = `${rooms} stanze, ${modules} moduli meteo`;
  }

  publishHome(home, status) {
    const modeEntity = this.entity('select', `${home.id}_mode`, { name: `${home.name} modalità riscaldamento`, slug: `netatmo_${home.name}_modalita` });
    this.homes.set(modeEntity, home.id);
    this.set(modeEntity, home.therm_mode || status.therm_mode || 'schedule', { options: Object.keys(HOME_MODES), labels: HOME_MODES });

    const modulesById = new Map((status.modules || []).map((m) => [m.id, m]));
    let n = 0;
    for (const room of home.rooms || []) {
      const rs = (status.rooms || []).find((r) => r.id === room.id);
      if (!rs || rs.therm_measured_temperature === undefined) continue;
      n++;
      const devId = this.device(`${home.id}_${room.id}`, { name: `Netatmo ${room.name}`, manufacturer: 'Netatmo', model: 'Energy', area: room.name });
      const id = this.entity('climate', `${home.id}_${room.id}`, { name: `Netatmo ${room.name}`, slug: `netatmo_${room.name}`, device_id: devId, area: room.name });
      this.rooms.set(id, { homeId: home.id, roomId: room.id });
      const mode = rs.therm_setpoint_mode; // schedule | manual | away | hg | off | max
      const hvac = mode === 'off' ? HVAC.OFF : mode === 'manual' || mode === 'max' ? HVAC.HEAT : HVAC.AUTO;
      const valve = Math.max(0, ...(room.module_ids || []).map((mid) => Number(modulesById.get(mid)?.heating_power_request ?? 0)), Number(rs.heating_power_request ?? 0));
      const heating = rs.heating_power_request > 0 || valve > 0 || modulesById.get((room.module_ids || [])[0])?.boiler_status === true;
      this.set(id, hvac, {
        hvac_modes: [HVAC.OFF, HVAC.HEAT, HVAC.AUTO],
        hvac_action: hvac === HVAC.OFF ? 'off' : heating ? 'heating' : 'idle',
        current_temperature: rs.therm_measured_temperature,
        temperature: rs.therm_setpoint_temperature,
        min_temp: 7, max_temp: 30, target_temp_step: 0.5,
        preset_mode: mode,
        open_window: Boolean(rs.open_window),
        heating_power: valve,
        setpoint_end: rs.therm_setpoint_end_time ? new Date(rs.therm_setpoint_end_time * 1000).toISOString() : null
      });
      const winId = this.entity('binary_sensor', `${home.id}_${room.id}_window`, { name: `Netatmo ${room.name} finestra aperta`, slug: `netatmo_${room.name}_finestra`, device_id: devId, area: room.name, device_class: 'window' });
      this.set(winId, rs.open_window ? 'on' : 'off', { detected_by: 'netatmo' });
    }
    return n;
  }

  publishStation(st) {
    let n = 0;
    const mods = [{ ...st, module_name: st.module_name || st.station_name, _id: st._id }, ...(st.modules || [])];
    for (const m of mods) {
      const d = m.dashboard_data;
      if (!d) continue;
      n++;
      const name = m.module_name || m.type;
      const outdoor = m.type === 'NAModule1';
      const area = outdoor ? null : name;
      const devId = this.device(`station_${m._id}`, { name: `Meteo ${name}`, manufacturer: 'Netatmo', model: m.type, area });
      const add = (key, label, value, unit, device_class) => {
        if (value === undefined || value === null) return;
        const id = this.entity('sensor', `${m._id}_${key}`, { name: `${name} ${label}`, slug: `netatmo_${name}_${label}`, device_id: devId, area, unit, device_class });
        this.set(id, typeof value === 'number' ? round(value, 1) : value, { outdoor });
      };
      add('t', 'temperatura', d.Temperature, '°C', 'temperature');
      add('h', 'umidità', d.Humidity, '%', 'humidity');
      add('co2', 'CO2', d.CO2, 'ppm', 'carbon_dioxide');
      add('noise', 'rumore', d.Noise, 'dB', 'sound_pressure');
      add('p', 'pressione', d.Pressure, 'hPa', 'pressure');
      add('rain', 'pioggia 1h', d.sum_rain_1, 'mm', 'precipitation');
      add('wind', 'vento', d.WindStrength, 'km/h', 'wind_speed');
    }
    return n;
  }

  async handleService(entity_id, service, data) {
    if (this.homes.has(entity_id)) {
      if (service !== 'select_option') throw new ServiceError(`Servizio non supportato: ${service}`);
      if (!HOME_MODES[data.option]) throw new ServiceError(`Modalità non valida: ${data.option}`);
      await this.api('/api/setthermmode', { method: 'POST', form: { home_id: this.homes.get(entity_id), mode: data.option } });
      this.patch(entity_id, data.option);
      return;
    }
    const r = this.rooms.get(entity_id);
    if (!r) throw new ServiceError('Stanza Netatmo non trovata', 404);
    const set = (form) => this.api('/api/setroomthermpoint', { method: 'POST', form: { home_id: r.homeId, room_id: r.roomId, ...form } });
    const hours = Number(data.duration_hours || this.options.manual_hours || 0);
    const endtime = hours > 0 ? Math.floor(Date.now() / 1000 + hours * 3600) : undefined;

    let mode = data.hvac_mode;
    if (service === 'turn_off') mode = HVAC.OFF;
    if (service === 'turn_on') mode = HVAC.AUTO;
    if (service === 'set_temperature') {
      if (mode === HVAC.OFF) { await set({ mode: 'off' }); }
      else { await set({ mode: 'manual', temp: Number(data.temperature), endtime }); mode = HVAC.HEAT; }
      this.patch(entity_id, mode, { temperature: Number(data.temperature) });
    } else if (['set_hvac_mode', 'turn_off', 'turn_on'].includes(service)) {
      if (mode === HVAC.OFF) await set({ mode: 'off' });
      else if (mode === HVAC.AUTO) await set({ mode: 'home' });
      else if (mode === HVAC.HEAT) {
        const temp = this.hub.getState(entity_id)?.attributes.temperature || 20;
        await set({ mode: 'manual', temp, endtime });
      } else throw new ServiceError(`Modalità non supportata: ${mode}`);
      this.patch(entity_id, mode);
    } else throw new ServiceError(`Servizio non supportato: ${service}`);
    setTimeout(() => this.update().catch(() => {}), 4000);
  }
}
