/*
 * Integrazione dimostrativa: simula una casa completa (termostati, climatizzatori, finestre,
 * prese Shelly, tapparella, auto Tesla, consumi e fotovoltaico) per provare la dashboard
 * senza credenziali. Disattivala da "Integrazioni" quando colleghi gli apparecchi veri.
 */
import { Integration, HVAC } from './base.js';
import { round, clamp } from '../core/util.js';
import { ServiceError } from '../core/hub.js';

const ROOMS = [
  { key: 'soggiorno', name: 'Soggiorno', temp: 20.4, hum: 48, ac: true },
  { key: 'camera', name: 'Camera da letto', temp: 19.1, hum: 52, ac: true },
  { key: 'studio', name: 'Studio', temp: 19.8, hum: 45, ac: false },
  { key: 'cucina', name: 'Cucina', temp: 21.0, hum: 55, ac: false }
];

export class DemoIntegration extends Integration {
  static meta = {
    type: 'demo',
    name: 'Demo (casa simulata)',
    icon: 'flask',
    description: 'Apparecchi simulati per provare la dashboard senza credenziali.',
    fields: [
      { key: 'outdoor', label: 'Temperatura esterna simulata (°C)', type: 'number', default: 9 },
      { key: 'poll_interval', label: 'Velocità simulazione (secondi)', type: 'number', default: 10 }
    ],
    defaultPollInterval: 10,
    multiple: false
  };

  async setup() {
    const sim = (this.sim = { outdoor: Number(this.options.outdoor ?? 9), rooms: {}, t: 0 });
    for (const r of ROOMS) {
      const dev = this.device(r.key, { name: `Termostato ${r.name}`, manufacturer: 'Demo', model: 'Termostato', area: r.name });
      const room = (sim.rooms[r.key] = {
        ...r,
        window: false,
        thermo: { id: null, mode: HVAC.HEAT, target: 20.5 },
        ac: null
      });
      room.thermo.id = this.entity('climate', `${r.key}_thermo`, { name: `Termostato ${r.name}`, slug: `demo_termostato_${r.key}`, device_id: dev, area: r.name });
      if (r.ac) {
        const acDev = this.device(`${r.key}_ac`, { name: `Climatizzatore ${r.name}`, manufacturer: 'Demo', model: 'Split', area: r.name });
        room.ac = { id: this.entity('climate', `${r.key}_ac`, { name: `Climatizzatore ${r.name}`, slug: `demo_clima_${r.key}`, device_id: acDev, area: r.name }), mode: HVAC.OFF, target: 25, fan: 'auto', isAc: true };
      }
      room.tempId = this.entity('sensor', `${r.key}_temp`, { name: `Temperatura ${r.name}`, slug: `demo_temperatura_${r.key}`, device_id: dev, area: r.name, unit: '°C', device_class: 'temperature' });
      room.humId = this.entity('sensor', `${r.key}_hum`, { name: `Umidità ${r.name}`, slug: `demo_umidita_${r.key}`, device_id: dev, area: r.name, unit: '%', device_class: 'humidity' });
      room.winId = this.entity('binary_sensor', `${r.key}_window`, { name: `Finestra ${r.name}`, slug: `demo_finestra_${r.key}`, device_id: dev, area: r.name, device_class: 'window' });
    }

    const out = this.device('meteo', { name: 'Sensore esterno', manufacturer: 'Demo' });
    this.outdoorId = this.entity('sensor', 'outdoor', { name: 'Temperatura esterna', slug: 'demo_temperatura_esterna', device_id: out, unit: '°C', device_class: 'temperature' });

    // Shelly simulati
    const plug = this.device('plug', { name: 'Presa lavatrice', manufacturer: 'Demo', model: 'Plug S', area: 'Cucina' });
    sim.plug = { on: true, id: this.entity('switch', 'plug', { name: 'Presa lavatrice', slug: 'demo_presa_lavatrice', device_id: plug, area: 'Cucina' }) };
    sim.plugPowerId = this.entity('sensor', 'plug_power', { name: 'Potenza lavatrice', slug: 'demo_potenza_lavatrice', device_id: plug, unit: 'W', device_class: 'power', area: 'Cucina' });
    const light = this.device('light', { name: 'Luce studio', manufacturer: 'Demo', model: 'Dimmer', area: 'Studio' });
    sim.light = { on: false, bri: 70, id: this.entity('light', 'light', { name: 'Luce studio', slug: 'demo_luce_studio', device_id: light, area: 'Studio' }) };
    const cover = this.device('cover', { name: 'Tapparella soggiorno', manufacturer: 'Demo', model: 'Plus 2PM', area: 'Soggiorno' });
    sim.cover = { pos: 100, moving: null, id: this.entity('cover', 'cover', { name: 'Tapparella soggiorno', slug: 'demo_tapparella_soggiorno', device_id: cover, area: 'Soggiorno', device_class: 'shutter' }) };
    const em = this.device('em', { name: 'Contatore energia', manufacturer: 'Demo', model: 'Pro 3EM' });
    sim.gridId = this.entity('sensor', 'grid', { name: 'Consumo casa', slug: 'demo_consumo_casa', device_id: em, unit: 'W', device_class: 'power' });
    sim.pvId = this.entity('sensor', 'pv', { name: 'Produzione fotovoltaico', slug: 'demo_produzione_fv', device_id: em, unit: 'W', device_class: 'power' });

    // Tesla simulata
    const car = this.device('car', { name: 'Model Y', manufacturer: 'Tesla', model: 'Model Y', kind: 'vehicle' });
    sim.car = {
      soc: 64, limit: 80, charging: false, plugged: true, locked: true, climate: false, inside: 12, target: 21, online: true,
      ids: {
        soc: this.entity('sensor', 'car_soc', { name: 'Model Y Batteria', slug: 'demo_tesla_batteria', device_id: car, unit: '%', device_class: 'battery' }),
        range: this.entity('sensor', 'car_range', { name: 'Model Y Autonomia', slug: 'demo_tesla_autonomia', device_id: car, unit: 'km', device_class: 'distance' }),
        charging: this.entity('sensor', 'car_charging', { name: 'Model Y Stato ricarica', slug: 'demo_tesla_stato_ricarica', device_id: car, device_class: 'enum' }),
        power: this.entity('sensor', 'car_power', { name: 'Model Y Potenza ricarica', slug: 'demo_tesla_potenza_ricarica', device_id: car, unit: 'kW', device_class: 'power' }),
        inside: this.entity('sensor', 'car_inside', { name: 'Model Y Temperatura abitacolo', slug: 'demo_tesla_temp_interna', device_id: car, unit: '°C', device_class: 'temperature' }),
        climate: this.entity('climate', 'car_climate', { name: 'Model Y Clima', slug: 'demo_tesla_clima', device_id: car }),
        lock: this.entity('lock', 'car_lock', { name: 'Model Y Portiere', slug: 'demo_tesla_portiere', device_id: car }),
        charge: this.entity('switch', 'car_charge', { name: 'Model Y Ricarica', slug: 'demo_tesla_ricarica', device_id: car, icon: 'ev' }),
        limit: this.entity('number', 'car_limit', { name: 'Model Y Limite ricarica', slug: 'demo_tesla_limite_ricarica', device_id: car, unit: '%' }),
        online: this.entity('binary_sensor', 'car_online', { name: 'Model Y Online', slug: 'demo_tesla_online', device_id: car, device_class: 'connectivity' }),
        flash: this.entity('button', 'car_flash', { name: 'Model Y Lampeggia', slug: 'demo_tesla_lampeggia', device_id: car })
      }
    };
    this.statusMessage = 'Simulazione attiva';
  }

  async update() {
    const sim = this.sim;
    sim.t++;
    const hour = new Date().getHours() + new Date().getMinutes() / 60;
    // temperatura esterna con andamento giornaliero
    const outdoor = sim.outdoor + 4 * Math.sin(((hour - 9) / 24) * 2 * Math.PI);
    this.set(this.outdoorId, round(outdoor, 1), {});

    for (const room of Object.values(sim.rooms)) {
      let delta = (outdoor - room.temp) * 0.004;
      if (room.window) delta += (outdoor - room.temp) * 0.03;
      const heating = room.thermo.mode === HVAC.HEAT && room.temp < room.thermo.target - 0.1;
      if (heating) delta += 0.06;
      let acAction = 'off';
      if (room.ac && room.ac.mode !== HVAC.OFF) {
        const m = room.ac.mode;
        if ((m === HVAC.COOL || m === HVAC.AUTO) && room.temp > room.ac.target + 0.2) { delta -= 0.09; acAction = 'cooling'; }
        else if ((m === HVAC.HEAT || m === HVAC.AUTO) && room.temp < room.ac.target - 0.2) { delta += 0.09; acAction = 'heating'; }
        else if (m === HVAC.DRY) { acAction = 'drying'; room.hum = Math.max(35, room.hum - 0.3); }
        else if (m === HVAC.FAN) acAction = 'fan';
        else acAction = 'idle';
      }
      room.temp = clamp(room.temp + delta + (Math.random() - 0.5) * 0.04, -10, 40);
      room.hum = clamp(room.hum + (Math.random() - 0.5) * 0.4, 30, 75);

      this.set(room.thermo.id, room.thermo.mode, {
        hvac_modes: [HVAC.OFF, HVAC.HEAT, HVAC.AUTO],
        hvac_action: room.thermo.mode === HVAC.OFF ? 'off' : heating ? 'heating' : 'idle',
        current_temperature: round(room.temp, 1),
        current_humidity: Math.round(room.hum),
        temperature: room.thermo.mode === HVAC.OFF ? null : room.thermo.target,
        min_temp: 5, max_temp: 25, target_temp_step: 0.5,
        heating_power: heating ? 65 : 0
      });
      if (room.ac) {
        this.set(room.ac.id, room.ac.mode, {
          hvac_modes: [HVAC.OFF, HVAC.HEAT, HVAC.COOL, HVAC.AUTO, HVAC.DRY, HVAC.FAN],
          hvac_action: acAction,
          current_temperature: round(room.temp, 1),
          temperature: room.ac.mode === HVAC.FAN ? null : room.ac.target,
          min_temp: 16, max_temp: 30, target_temp_step: 0.5,
          fan_mode: room.ac.fan, fan_modes: ['auto', 'quiet', '1', '2', '3', '4', '5']
        });
      }
      this.set(room.tempId, round(room.temp, 1), {});
      this.set(room.humId, Math.round(room.hum), {});
      this.set(room.winId, room.window ? 'on' : 'off', { simulated: true });
    }

    // energia
    const sun = Math.max(0, Math.sin(((hour - 6) / 14) * Math.PI));
    const pv = Math.round(sun * 4200 * (0.85 + Math.random() * 0.15));
    const acLoad = Object.values(sim.rooms).filter((r) => r.ac && r.ac.mode !== HVAC.OFF).length * 650;
    const plugW = sim.plug.on ? Math.round(1800 + Math.random() * 300) : 0;
    const carW = sim.car.charging ? 7400 : 0;
    this.set(sim.plug.id, sim.plug.on ? 'on' : 'off', {});
    this.set(sim.plugPowerId, plugW, {});
    this.set(sim.light.id, sim.light.on ? 'on' : 'off', { brightness_pct: sim.light.bri });
    this.set(sim.gridId, Math.round(350 + acLoad + plugW + carW + Math.random() * 80), {});
    this.set(sim.pvId, pv, {});

    // tapparella
    const c = sim.cover;
    if (c.moving !== null) {
      c.pos = c.pos < c.moving ? Math.min(c.moving, c.pos + 20) : Math.max(c.moving, c.pos - 20);
      if (c.pos === c.moving) c.moving = null;
    }
    this.set(c.id, c.moving !== null ? (c.moving > c.pos ? 'opening' : 'closing') : c.pos === 0 ? 'closed' : 'open', { current_position: c.pos });

    // auto
    const car = sim.car;
    if (car.charging) {
      car.soc = Math.min(car.limit, car.soc + 0.2);
      if (car.soc >= car.limit) car.charging = false;
    }
    car.inside += car.climate ? (car.target - car.inside) * 0.2 : (outdoor - car.inside) * 0.02;
    const ids = car.ids;
    this.set(ids.soc, Math.round(car.soc), {});
    this.set(ids.range, Math.round(car.soc * 4.3), {});
    this.set(ids.charging, car.charging ? 'charging' : car.plugged ? (car.soc >= car.limit ? 'complete' : 'stopped') : 'disconnected', { options: ['charging', 'stopped', 'complete', 'disconnected'] });
    this.set(ids.power, car.charging ? 7.4 : 0, {});
    this.set(ids.inside, round(car.inside, 1), {});
    this.set(ids.climate, car.climate ? HVAC.HEAT_COOL : HVAC.OFF, {
      hvac_modes: [HVAC.OFF, HVAC.HEAT_COOL],
      hvac_action: car.climate ? (car.inside < car.target ? 'heating' : 'cooling') : 'off',
      current_temperature: round(car.inside, 1),
      temperature: car.target, min_temp: 15, max_temp: 28, target_temp_step: 0.5
    });
    this.set(ids.lock, car.locked ? 'locked' : 'unlocked', {});
    this.set(ids.charge, car.charging ? 'on' : 'off', { plugged_in: car.plugged });
    this.set(ids.limit, car.limit, { min: 50, max: 100, step: 5 });
    this.set(ids.online, car.online ? 'on' : 'off', {});
    this.set(ids.flash, null, {});
  }

  findRoomByClimate(entity_id) {
    for (const room of Object.values(this.sim.rooms)) {
      if (room.thermo.id === entity_id) return room.thermo;
      if (room.ac?.id === entity_id) return room.ac;
    }
    return null;
  }

  async handleService(entity_id, service, data) {
    const sim = this.sim;
    const car = sim.car;
    const domain = entity_id.split('.')[0];

    if (domain === 'climate') {
      const target = entity_id === car.ids.climate ? null : this.findRoomByClimate(entity_id);
      if (target) {
        if (service === 'set_temperature') {
          target.target = clamp(Number(data.temperature), 5, 30);
          if (data.hvac_mode) target.mode = data.hvac_mode;
        } else if (service === 'set_hvac_mode') target.mode = data.hvac_mode;
        else if (service === 'turn_off') target.mode = HVAC.OFF;
        else if (service === 'turn_on') target.mode = target.isAc ? HVAC.AUTO : HVAC.HEAT;
        else if (service === 'set_fan_mode') target.fan = data.fan_mode;
        else throw new ServiceError(`Servizio non supportato: ${service}`);
      } else {
        if (service === 'set_temperature') car.target = Number(data.temperature);
        else if (service === 'set_hvac_mode') car.climate = data.hvac_mode !== HVAC.OFF;
        else if (service === 'turn_on') car.climate = true;
        else if (service === 'turn_off') car.climate = false;
      }
    } else if (entity_id === sim.plug.id) {
      sim.plug.on = service === 'toggle' ? !sim.plug.on : service === 'turn_on';
    } else if (entity_id === sim.light.id) {
      sim.light.on = service === 'toggle' ? !sim.light.on : service === 'turn_on';
      if (data.brightness_pct !== undefined) sim.light.bri = clamp(Number(data.brightness_pct), 1, 100);
    } else if (entity_id === sim.cover.id) {
      const map = { open_cover: 100, close_cover: 0, set_cover_position: Number(data.position) };
      if (service === 'stop_cover') sim.cover.moving = null;
      else if (service in map) sim.cover.moving = clamp(map[service], 0, 100);
    } else if (entity_id === car.ids.lock) {
      car.locked = service === 'lock';
    } else if (entity_id === car.ids.charge) {
      car.charging = service === 'toggle' ? !car.charging : service === 'turn_on';
    } else if (entity_id === car.ids.limit) {
      car.limit = clamp(Number(data.value), 50, 100);
    } else if (entity_id === car.ids.flash) {
      this.hub.addLog({ entity_id, message: 'ha lampeggiato i fari' });
    } else if (domain === 'binary_sensor') {
      const room = Object.values(sim.rooms).find((r) => r.winId === entity_id);
      if (!room) throw new ServiceError('Entità non controllabile');
      room.window = service === 'toggle' ? !room.window : service === 'turn_on';
    } else {
      throw new ServiceError(`Servizio non supportato: ${service}`);
    }
    await this.update();
  }
}
