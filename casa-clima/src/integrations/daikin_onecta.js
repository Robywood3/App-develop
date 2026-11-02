/*
 * Daikin Onecta (cloud ufficiale, Europa): climatizzatori con app Onecta e pompe di calore Altherma.
 *   API:   https://api.onecta.daikineurope.com/v1/gateway-devices
 *   OAuth: https://idp.onecta.daikineurope.com/v1/oidc/{authorize,token}
 * Limite Daikin: 200 richieste al giorno per account -> aggiornamento predefinito ogni 10 minuti.
 */
import { Integration, HVAC } from './base.js';
import { request, HttpError } from '../core/http.js';
import { TokenManager, AuthError } from '../core/oauth.js';
import { round } from '../core/util.js';
import { ServiceError } from '../core/hub.js';

const API = 'https://api.onecta.daikineurope.com/v1';
const OP_TO_HVAC = { heating: HVAC.HEAT, cooling: HVAC.COOL, auto: HVAC.AUTO, dry: HVAC.DRY, fanOnly: HVAC.FAN };
const HVAC_TO_OP = Object.fromEntries(Object.entries(OP_TO_HVAC).map(([k, v]) => [v, k]));

const val = (c) => (c && typeof c === 'object' && 'value' in c ? c.value : undefined);

export class DaikinOnectaIntegration extends Integration {
  static meta = {
    type: 'daikin_onecta',
    name: 'Daikin Onecta (cloud)',
    icon: 'snowflake',
    description: 'Climatizzatori e pompe di calore Altherma collegati all\'app Daikin Onecta.',
    docs: 'Crea un\'app gratuita su https://developer.cloud.daikineurope.com (stesso account Onecta), con Redirect URI uguale a quello mostrato qui. Limite Daikin: 200 richieste/giorno.',
    auth: 'oauth',
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', secret: true, required: true },
      { key: 'redirect_uri', label: 'Redirect URI (facoltativo)', type: 'text', help: 'Lascia vuoto per usare l\'indirizzo di Casa Clima. Daikin richiede https: se non lo hai, registra ad es. https://localhost/callback e incolla a mano l\'indirizzo di ritorno.' },
      { key: 'poll_interval', label: 'Aggiornamento (secondi)', type: 'number', default: 600 }
    ],
    defaultPollInterval: 600
  };

  static oauthConfig(o) {
    return {
      authorizeUrl: 'https://idp.onecta.daikineurope.com/v1/oidc/authorize',
      tokenUrl: 'https://idp.onecta.daikineurope.com/v1/oidc/token',
      clientId: o.client_id,
      clientSecret: o.client_secret,
      scope: 'openid onecta:basic.integration'
    };
  }

  async setup() {
    const cfg = DaikinOnectaIntegration.oauthConfig(this.options);
    this.tokens = new TokenManager({ ...cfg, data: this.data, save: () => this.saveData() });
    if (!this.tokens.hasRefreshToken) throw new AuthError('Premi "Accedi" per collegare il tuo account Daikin');
    this.points = new Map(); // entity_id -> { deviceId, embeddedId, mp }
  }

  async api(path, opts = {}) {
    const token = await this.tokens.getAccessToken();
    try {
      return await request(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}` }, timeout: 20000 });
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) { this.tokens.invalidate(); }
      if (err instanceof HttpError && err.status === 429) throw new Error('Limite giornaliero di richieste Daikin raggiunto: riprova più tardi');
      throw err;
    }
  }

  async update() {
    const devices = await this.api('/gateway-devices');
    for (const dev of devices) {
      const mps = dev.managementPoints || [];
      const gw = mps.find((m) => m.managementPointType === 'gateway') || {};
      for (const mp of mps) {
        if (mp.managementPointType === 'climateControl') this.publishClimate(dev, gw, mp);
        else if (mp.managementPointType === 'domesticHotWaterTank') this.publishTank(dev, mp);
      }
    }
    this.statusMessage = `${devices.length} dispositivi`;
  }

  deviceFor(dev, mp, name) {
    return this.device(dev.id, { name, manufacturer: 'Daikin', model: dev.deviceModel || 'Onecta', area: name });
  }

  publishClimate(dev, gw, mp) {
    const name = val(mp.name) || val(gw.name) || dev.deviceModel || 'Daikin';
    const devId = this.deviceFor(dev, mp, name);
    const key = `${dev.id}_${mp.embeddedId}`;
    const climateId = this.entity('climate', key, { name, slug: `daikin_${name}`, device_id: devId, area: name });
    this.points.set(climateId, { deviceId: dev.id, embeddedId: mp.embeddedId, mp });

    const on = val(mp.onOffMode) === 'on';
    const op = val(mp.operationMode);
    const sensors = val(mp.sensoryData) || {};
    const room = val(sensors.roomTemperature);
    const outdoor = val(sensors.outdoorTemperature);
    const sp = val(mp.temperatureControl)?.operationModes?.[op]?.setpoints?.roomTemperature;
    const modes = (mp.operationMode?.values || Object.keys(OP_TO_HVAC)).map((m) => OP_TO_HVAC[m]).filter(Boolean);
    const hvac = on ? OP_TO_HVAC[op] || HVAC.AUTO : HVAC.OFF;
    const fanMode = val(mp.fanControl)?.operationModes?.[op]?.fanSpeed?.currentMode?.value;
    this.set(climateId, hvac, {
      hvac_modes: [HVAC.OFF, ...modes],
      hvac_action: !on ? 'off' : hvac === HVAC.HEAT ? 'heating' : hvac === HVAC.COOL ? 'cooling' : hvac === HVAC.DRY ? 'drying' : hvac === HVAC.FAN ? 'fan' : 'idle',
      current_temperature: room ?? null,
      current_humidity: val(sensors.roomHumidity) ?? null,
      temperature: sp?.value ?? null,
      min_temp: sp?.minValue ?? 16,
      max_temp: sp?.maxValue ?? 30,
      target_temp_step: sp?.stepValue ?? 0.5,
      fan_mode: fanMode,
      outdoor_temperature: outdoor ?? null,
      read_only_setpoint: !sp
    });
    if (room !== undefined) {
      const t = this.entity('sensor', `${key}_room`, { name: `${name} temperatura`, slug: `daikin_${name}_temperatura`, device_id: devId, area: name, unit: '°C', device_class: 'temperature' });
      this.set(t, round(room, 1), {});
    }
    if (outdoor !== undefined) {
      const t = this.entity('sensor', `${key}_outdoor`, { name: `${name} temperatura esterna`, slug: `daikin_${name}_temperatura_esterna`, device_id: devId, unit: '°C', device_class: 'temperature' });
      this.set(t, round(outdoor, 1), {});
    }
    const lwt = val(sensors.leavingWaterTemperature);
    if (lwt !== undefined) {
      const t = this.entity('sensor', `${key}_lwt`, { name: `${name} temperatura mandata`, slug: `daikin_${name}_mandata`, device_id: devId, unit: '°C', device_class: 'temperature' });
      this.set(t, round(lwt, 1), {});
    }
  }

  publishTank(dev, mp) {
    const name = val(mp.name) || 'Acqua calda sanitaria';
    const devId = this.deviceFor(dev, mp, name);
    const key = `${dev.id}_${mp.embeddedId}`;
    const sensors = val(mp.sensoryData) || {};
    const t = this.entity('sensor', `${key}_tank`, { name: `${name} temperatura`, slug: 'daikin_acs_temperatura', device_id: devId, unit: '°C', device_class: 'temperature' });
    this.set(t, round(val(sensors.tankTemperature), 1), {});
    const sw = this.entity('switch', `${key}_power`, { name, slug: 'daikin_acs', device_id: devId, icon: 'water' });
    this.points.set(sw, { deviceId: dev.id, embeddedId: mp.embeddedId, mp });
    this.set(sw, val(mp.onOffMode) === 'on' ? 'on' : 'off', { powerful: val(mp.powerfulMode) === 'on' });
  }

  async patchCharacteristic(p, characteristic, value, path) {
    await this.api(`/gateway-devices/${p.deviceId}/management-points/${p.embeddedId}/characteristics/${characteristic}`, {
      method: 'PATCH',
      json: path ? { value, path } : { value }
    });
  }

  async handleService(entity_id, service, data) {
    const p = this.points.get(entity_id);
    if (!p) throw new ServiceError('Dispositivo Daikin non trovato', 404);
    const cur = this.hub.getState(entity_id);
    if (entity_id.startsWith('switch.')) {
      const on = service === 'toggle' ? cur.state !== 'on' : service === 'turn_on';
      await this.patchCharacteristic(p, 'onOffMode', on ? 'on' : 'off');
      this.patch(entity_id, on ? 'on' : 'off');
      return;
    }
    const setMode = async (hvac) => {
      if (hvac === HVAC.OFF) {
        await this.patchCharacteristic(p, 'onOffMode', 'off');
        this.patch(entity_id, HVAC.OFF, { hvac_action: 'off' });
        return null;
      }
      const op = HVAC_TO_OP[hvac === HVAC.HEAT_COOL ? HVAC.AUTO : hvac];
      if (!op) throw new ServiceError(`Modalità non supportata: ${hvac}`);
      if (val(p.mp.operationMode) !== op) await this.patchCharacteristic(p, 'operationMode', op);
      if (cur.state === HVAC.OFF) await this.patchCharacteristic(p, 'onOffMode', 'on');
      p.mp.operationMode = { ...(p.mp.operationMode || {}), value: op };
      this.patch(entity_id, hvac);
      return op;
    };

    if (service === 'set_hvac_mode') await setMode(data.hvac_mode);
    else if (service === 'turn_off') await setMode(HVAC.OFF);
    else if (service === 'turn_on') {
      await this.patchCharacteristic(p, 'onOffMode', 'on');
      this.patch(entity_id, OP_TO_HVAC[val(p.mp.operationMode)] || HVAC.AUTO);
    } else if (service === 'set_temperature') {
      let op = val(p.mp.operationMode);
      if (data.hvac_mode) op = (await setMode(data.hvac_mode)) || op;
      if (!['heating', 'cooling', 'auto'].includes(op)) throw new ServiceError('In questa modalità non si può impostare la temperatura');
      const t = Number(data.temperature);
      await this.patchCharacteristic(p, 'temperatureControl', t, `/operationModes/${op}/setpoints/roomTemperature`);
      this.patch(entity_id, undefined, { temperature: t });
    } else if (service === 'set_fan_mode') {
      const op = val(p.mp.operationMode);
      await this.patchCharacteristic(p, 'fanControl', data.fan_mode, `/operationModes/${op}/fanSpeed/currentMode`);
      this.patch(entity_id, undefined, { fan_mode: data.fan_mode });
    } else throw new ServiceError(`Servizio non supportato: ${service}`);
  }
}
