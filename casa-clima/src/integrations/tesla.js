/*
 * Tesla (API ufficiale Fleet API, oppure Teslemetry che espone la stessa API e firma i comandi per te).
 *
 *   GET  /api/1/vehicles                               elenco e stato (online/asleep) — non sveglia l'auto
 *   GET  /api/1/vehicles/{vin}/vehicle_data?endpoints=  batteria, clima, portiere, posizione
 *   POST /api/1/vehicles/{vin}/wake_up
 *   POST /api/1/vehicles/{vin}/command/{comando}       auto_conditioning_start, set_temps, door_lock, ...
 *
 * Per non scaricare la batteria i dati completi si leggono solo quando l'auto è già sveglia.
 * Con Fleet API diretta le auto recenti richiedono comandi firmati: indica l'indirizzo del
 * "vehicle-command proxy" di Tesla oppure usa Teslemetry.
 */
import { Integration, HVAC } from './base.js';
import { request, HttpError } from '../core/http.js';
import { TokenManager, AuthError } from '../core/oauth.js';
import { round, sleep, clamp } from '../core/util.js';
import { ServiceError } from '../core/hub.js';

const REGIONS = {
  eu: 'https://fleet-api.prd.eu.vn.cloud.tesla.com',
  na: 'https://fleet-api.prd.na.vn.cloud.tesla.com'
};
const TESLEMETRY = 'https://api.teslemetry.com';
const MI_TO_KM = 1.609344;
const ENDPOINTS = 'charge_state;climate_state;vehicle_state;drive_state;location_data';

export class TeslaIntegration extends Integration {
  static meta = {
    type: 'tesla',
    name: 'Tesla',
    icon: 'car',
    description: 'Batteria, autonomia, ricarica, clima (precondizionamento), serrature della tua Tesla.',
    docs: 'Teslemetry (teslemetry.com): incolla il token e basta. Fleet API diretta: crea un\'app su developer.tesla.com, poi "Accedi" (o incolla il refresh token); per i comandi sulle auto recenti serve il tesla-http-proxy.',
    auth: 'oauth',
    authWhen: { field: 'provider', value: 'fleet' },
    fields: [
      { key: 'provider', label: 'Collegamento', type: 'select', default: 'teslemetry', options: [
        { value: 'teslemetry', label: 'Teslemetry (consigliato, più semplice)' },
        { value: 'fleet', label: 'Tesla Fleet API (diretta)' }
      ] },
      { key: 'token', label: 'Token Teslemetry', type: 'password', secret: true, help: 'Solo per Teslemetry' },
      { key: 'region', label: 'Regione (Fleet API)', type: 'select', default: 'eu', options: [{ value: 'eu', label: 'Europa' }, { value: 'na', label: 'Nord America / Asia-Pacifico' }] },
      { key: 'client_id', label: 'Client ID (Fleet API)', type: 'text' },
      { key: 'client_secret', label: 'Client secret (Fleet API)', type: 'password', secret: true },
      { key: 'refresh_token', label: 'Refresh token (Fleet API, facoltativo)', type: 'password', secret: true },
      { key: 'command_proxy', label: 'Indirizzo tesla-http-proxy (Fleet API)', type: 'text', placeholder: 'https://192.168.1.10:4443', help: 'Necessario per inviare comandi firmati alle auto recenti' },
      { key: 'redirect_uri', label: 'Redirect URI (facoltativo)', type: 'text' },
      { key: 'data_interval', label: 'Lettura dati completi quando l\'auto è sveglia (secondi)', type: 'number', default: 600 },
      { key: 'poll_interval', label: 'Controllo stato (secondi)', type: 'number', default: 300 }
    ],
    defaultPollInterval: 300
  };

  static oauthConfig(o) {
    return {
      authorizeUrl: 'https://auth.tesla.com/oauth2/v3/authorize',
      tokenUrl: 'https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token',
      clientId: o.client_id,
      clientSecret: o.client_secret,
      scope: 'openid offline_access vehicle_device_data vehicle_location vehicle_cmds vehicle_charging_cmds',
      tokenParams: { audience: REGIONS[o.region || 'eu'] },
      authorizeParams: { prompt_missing_scopes: 'true' }
    };
  }

  async setup() {
    this.teslemetry = (this.options.provider || 'teslemetry') === 'teslemetry';
    if (this.teslemetry) {
      if (!this.options.token) throw new AuthError('Inserisci il token Teslemetry');
      this.base = TESLEMETRY;
    } else {
      if (!this.options.client_id) throw new Error('Inserisci il Client ID dell\'app Tesla');
      this.base = REGIONS[this.options.region || 'eu'];
      if (this.options.refresh_token && this.data.seed_token !== this.options.refresh_token) {
        Object.assign(this.data, { refresh_token: this.options.refresh_token, seed_token: this.options.refresh_token, expires_at: 0 });
        await this.saveData();
      }
      this.tokens = new TokenManager({ ...TeslaIntegration.oauthConfig(this.options), data: this.data, save: () => this.saveData() });
      if (!this.tokens.hasRefreshToken) throw new AuthError('Premi "Accedi" con il tuo account Tesla');
    }
    this.cars = new Map(); // vin -> { ids, last, lastData, state }
  }

  async token() {
    return this.teslemetry ? this.options.token : this.tokens.getAccessToken();
  }

  async api(path, { method = 'GET', json, query, base } = {}) {
    const token = await this.token();
    try {
      const res = await request(`${base || this.base}${path}`, { method, json, query, headers: { Authorization: `Bearer ${token}` }, timeout: 30000 });
      return res.response ?? res;
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.status === 401) {
          if (this.tokens) this.tokens.invalidate();
          else throw new AuthError('Token Teslemetry non valido');
        }
        if (err.status === 408) throw Object.assign(new Error('Auto addormentata o non raggiungibile'), { asleep: true });
        if (err.status === 429) throw new Error('Troppe richieste a Tesla: riprova tra qualche minuto');
      }
      throw err;
    }
  }

  async update() {
    const vehicles = await this.api('/api/1/vehicles');
    const interval = Number(this.options.data_interval || 600) * 1000;
    for (const v of vehicles) {
      const vin = v.vin;
      let car = this.cars.get(vin);
      if (!car) car = this.register(v);
      car.state = v.state;
      const fresh = Date.now() - (car.lastDataAt || 0) < interval && !car.forceRefresh;
      if (v.state === 'online' && !fresh) {
        try {
          car.last = await this.api(`/api/1/vehicles/${vin}/vehicle_data`, { query: { endpoints: ENDPOINTS } });
          car.lastDataAt = Date.now();
          car.forceRefresh = false;
        } catch (err) {
          if (!err.asleep) throw err;
          car.state = 'asleep';
        }
      }
      this.publish(car, v);
    }
    this.statusMessage = vehicles.map((v) => `${v.display_name || v.vin}: ${v.state === 'online' ? 'sveglia' : v.state === 'asleep' ? 'addormentata' : v.state}`).join(', ') || 'Nessuna auto';
  }

  register(v) {
    const name = v.display_name || 'Tesla';
    const dev = this.device(v.vin, { name, manufacturer: 'Tesla', model: v.vehicle_config?.car_type || 'Tesla', kind: 'vehicle', vin: v.vin });
    const e = (domain, key, label, extra = {}) => this.entity(domain, `${v.vin}_${key}`, { name: `${name} ${label}`, slug: `tesla_${name}_${label}`, device_id: dev, ...extra });
    const car = {
      vin: v.vin,
      name,
      ids: {
        soc: e('sensor', 'soc', 'batteria', { unit: '%', device_class: 'battery' }),
        range: e('sensor', 'range', 'autonomia', { unit: 'km', device_class: 'distance' }),
        charging: e('sensor', 'charging', 'stato ricarica', { device_class: 'enum' }),
        power: e('sensor', 'power', 'potenza ricarica', { unit: 'kW', device_class: 'power' }),
        inside: e('sensor', 'inside', 'temperatura abitacolo', { unit: '°C', device_class: 'temperature' }),
        outside: e('sensor', 'outside', 'temperatura esterna', { unit: '°C', device_class: 'temperature' }),
        odometer: e('sensor', 'odometer', 'contachilometri', { unit: 'km', device_class: 'distance' }),
        climate: e('climate', 'climate', 'clima'),
        lock: e('lock', 'lock', 'portiere'),
        charge: e('switch', 'charge', 'ricarica', { icon: 'ev' }),
        defrost: e('switch', 'defrost', 'sbrinamento'),
        limit: e('number', 'limit', 'limite ricarica', { unit: '%' }),
        amps: e('number', 'amps', 'corrente ricarica', { unit: 'A' }),
        online: e('binary_sensor', 'online', 'online', { device_class: 'connectivity' }),
        wake: e('button', 'wake', 'sveglia'),
        flash: e('button', 'flash', 'lampeggia'),
        honk: e('button', 'honk', 'clacson')
      }
    };
    this.cars.set(v.vin, car);
    return car;
  }

  publish(car, v) {
    const ids = car.ids;
    const awake = car.state === 'online';
    this.set(ids.online, awake ? 'on' : 'off', { vehicle_state: car.state });
    for (const b of [ids.wake, ids.flash, ids.honk]) this.set(b, null, {});
    const d = car.last;
    if (!d) {
      // mai letto: mostra solo lo stato di connessione
      for (const [k, id] of Object.entries(ids)) if (!['online', 'wake', 'flash', 'honk'].includes(k)) this.set(id, 'unavailable', { asleep: true });
      return;
    }
    const cs = d.charge_state || {};
    const cl = d.climate_state || {};
    const vs = d.vehicle_state || {};
    const ds = d.drive_state || {};
    const meta = { asleep: !awake, data_age: car.lastDataAt ? new Date(car.lastDataAt).toISOString() : null };
    this.set(ids.soc, cs.battery_level ?? null, { ...meta, usable: cs.usable_battery_level });
    this.set(ids.range, cs.battery_range !== undefined ? Math.round(cs.battery_range * MI_TO_KM) : null, { ...meta, estimated: cs.est_battery_range ? Math.round(cs.est_battery_range * MI_TO_KM) : null });
    const chState = { Charging: 'charging', Stopped: 'stopped', Complete: 'complete', Disconnected: 'disconnected', Starting: 'starting', NoPower: 'no_power' }[cs.charging_state] || (cs.charging_state || 'unknown').toLowerCase();
    this.set(ids.charging, chState, {
      ...meta,
      options: ['charging', 'starting', 'stopped', 'complete', 'disconnected', 'no_power'],
      minutes_to_full: cs.minutes_to_full_charge ?? null,
      charge_rate_kmh: cs.charge_rate ? Math.round(cs.charge_rate * MI_TO_KM) : null,
      energy_added: cs.charge_energy_added ?? null
    });
    this.set(ids.power, cs.charger_power ?? 0, meta);
    this.set(ids.inside, round(cl.inside_temp, 1), meta);
    this.set(ids.outside, round(cl.outside_temp, 1), meta);
    this.set(ids.odometer, vs.odometer !== undefined ? Math.round(vs.odometer * MI_TO_KM) : null, meta);
    this.set(ids.climate, cl.is_climate_on ? HVAC.HEAT_COOL : HVAC.OFF, {
      ...meta,
      hvac_modes: [HVAC.OFF, HVAC.HEAT_COOL],
      hvac_action: !cl.is_climate_on ? 'off' : (cl.inside_temp ?? 0) < (cl.driver_temp_setting ?? 21) ? 'heating' : 'cooling',
      current_temperature: round(cl.inside_temp, 1),
      temperature: cl.driver_temp_setting ?? null,
      min_temp: cl.min_avail_temp ?? 15,
      max_temp: cl.max_avail_temp ?? 28,
      target_temp_step: 0.5,
      preconditioning: Boolean(cl.is_preconditioning)
    });
    this.set(ids.lock, vs.locked === undefined ? null : vs.locked ? 'locked' : 'unlocked', { ...meta, sentry_mode: vs.sentry_mode, doors_open: Boolean(vs.df || vs.dr || vs.pf || vs.pr), trunk_open: Boolean(vs.rt || vs.ft) });
    this.set(ids.charge, cs.charging_state === 'Charging' || cs.charging_state === 'Starting' ? 'on' : 'off', { ...meta, plugged_in: cs.charging_state !== 'Disconnected' });
    this.set(ids.defrost, cl.defrost_mode > 0 || cl.is_front_defroster_on ? 'on' : 'off', meta);
    this.set(ids.limit, cs.charge_limit_soc ?? null, { ...meta, min: cs.charge_limit_soc_min ?? 50, max: cs.charge_limit_soc_max ?? 100, step: 1 });
    this.set(ids.amps, cs.charge_current_request ?? null, { ...meta, min: 5, max: cs.charge_current_request_max ?? 32, step: 1 });
    const lat = ds.latitude ?? d.location_data?.latitude;
    const lon = ds.longitude ?? d.location_data?.longitude;
    if (lat !== undefined) this.patch(ids.online, undefined, { latitude: lat, longitude: lon, shift_state: ds.shift_state || 'P', speed_kmh: ds.speed ? Math.round(ds.speed * MI_TO_KM) : 0 });
  }

  async wake(car) {
    if (car.state === 'online') return;
    await this.api(`/api/1/vehicles/${car.vin}/wake_up`, { method: 'POST' });
    for (let i = 0; i < 15; i++) {
      await sleep(3000);
      const v = await this.api(`/api/1/vehicles/${car.vin}`);
      if (v.state === 'online') { car.state = 'online'; return; }
    }
    throw new ServiceError('L\'auto non si è svegliata: riprova', 504);
  }

  async command(car, cmd, body) {
    await this.wake(car);
    const base = !this.teslemetry && this.options.command_proxy ? this.options.command_proxy.replace(/\/$/, '') : undefined;
    const res = await this.api(`/api/1/vehicles/${car.vin}/command/${cmd}`, { method: 'POST', json: body || {}, base });
    if (res && res.result === false) {
      const reason = res.reason || 'rifiutato';
      if (/vehicle command protocol/i.test(reason)) throw new ServiceError('Quest\'auto richiede comandi firmati: configura il tesla-http-proxy o usa Teslemetry');
      throw new ServiceError(`Tesla: ${reason}`);
    }
    car.forceRefresh = true;
    setTimeout(() => this.update().catch(() => {}), 4000);
    return res;
  }

  async handleService(entity_id, service, data) {
    const car = [...this.cars.values()].find((c) => Object.values(c.ids).includes(entity_id));
    if (!car) throw new ServiceError('Auto non trovata', 404);
    const ids = car.ids;
    const cur = this.hub.getState(entity_id);
    const onOff = service === 'toggle' ? cur?.state !== 'on' : service === 'turn_on';

    switch (entity_id) {
      case ids.climate:
        if (service === 'set_temperature') {
          const t = clamp(Number(data.temperature), 15, 28);
          await this.command(car, 'set_temps', { driver_temp: t, passenger_temp: t });
          this.patch(entity_id, undefined, { temperature: t });
          if (data.hvac_mode && data.hvac_mode !== HVAC.OFF && cur.state === HVAC.OFF) await this.command(car, 'auto_conditioning_start');
        } else {
          const on = service === 'turn_on' || (service === 'set_hvac_mode' && data.hvac_mode !== HVAC.OFF);
          await this.command(car, on ? 'auto_conditioning_start' : 'auto_conditioning_stop');
          this.patch(entity_id, on ? HVAC.HEAT_COOL : HVAC.OFF);
        }
        return;
      case ids.lock:
        await this.command(car, service === 'unlock' ? 'door_unlock' : 'door_lock');
        this.patch(entity_id, service === 'unlock' ? 'unlocked' : 'locked');
        return;
      case ids.charge:
        await this.command(car, onOff ? 'charge_start' : 'charge_stop');
        this.patch(entity_id, onOff ? 'on' : 'off');
        return;
      case ids.defrost:
        await this.command(car, 'set_preconditioning_max', { on: onOff });
        this.patch(entity_id, onOff ? 'on' : 'off');
        return;
      case ids.limit:
        await this.command(car, 'set_charge_limit', { percent: Math.round(clamp(Number(data.value), 50, 100)) });
        this.patch(entity_id, Math.round(Number(data.value)));
        return;
      case ids.amps:
        await this.command(car, 'set_charging_amps', { charging_amps: Math.round(Number(data.value)) });
        this.patch(entity_id, Math.round(Number(data.value)));
        return;
      case ids.wake:
        await this.wake(car);
        car.forceRefresh = true;
        await this.update();
        return;
      case ids.flash:
        await this.command(car, 'flash_lights');
        return;
      case ids.honk:
        await this.command(car, 'honk_horn');
        return;
      default:
        throw new ServiceError(`Servizio ${service} non supportato da ${entity_id}`);
    }
  }
}
