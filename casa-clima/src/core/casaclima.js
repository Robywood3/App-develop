/*
 * Motore "Casa-Clima": il pacchetto che coordina tutti i dispositivi di climatizzazione.
 *
 *  - Stanze: raggruppa termostati, climatizzatori, sensori e finestre per stanza
 *    (automaticamente dalla "stanza" delle entità, oppure definite nel pacchetto YAML).
 *  - Profili: Comfort / Eco / Notte / Fuori casa / Programma / Spento, con temperature
 *    diverse per riscaldamento e raffrescamento, applicati a tutta la casa con un tocco.
 *  - Stagione: riscaldamento o raffrescamento, scelta a mano o in automatico dalla temperatura esterna.
 *  - Ruoli: in inverno scaldano i termostati (tado°, Netatmo) se presenti, altrimenti le pompe di calore;
 *    in estate raffrescano i climatizzatori (Daikin...).
 *  - Finestre: se una finestra resta aperta il clima della stanza va in pausa e riparte alla chiusura.
 *  - Comandi "idempotenti": invia un comando solo se lo stato è diverso, per rispettare i limiti
 *    di richieste delle API cloud (tado°, Daikin Onecta).
 */
import { createLogger, slugify, toArray, round, isNumeric, clamp } from './util.js';
import { ServiceError } from './hub.js';

const log = createLogger('casa_clima');

export const DEFAULT_CONFIG = {
  name: 'Casa Clima',
  profiles: {
    comfort: { name: 'Comfort', icon: 'sun', heat: 21, cool: 25 },
    eco: { name: 'Eco', icon: 'leaf', heat: 19, cool: 27 },
    notte: { name: 'Notte', icon: 'moon', heat: 18, cool: 26 },
    fuori: { name: 'Fuori casa', icon: 'away', heat: 16, cool: 29 },
    programma: { name: 'Programma', icon: 'calendar', schedule: true },
    spento: { name: 'Spento', icon: 'power', off: true }
  },
  season: { mode: 'auto', heat_below: 16, cool_above: 23, outdoor_sensor: null },
  window: { enabled: true, delay: 60, restore_delay: 30 },
  humidity: { high: 65, low: 30 },
  rooms: null,
  energy: { grid_power: null, pv_power: null }
};

const SEASONS = { auto: 'Automatica', heat: 'Riscaldamento', cool: 'Raffrescamento', off: 'Spenta' };

function mergeConfig(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) out[k] = { ...base[k], ...v };
    else out[k] = v;
  }
  return out;
}

export class CasaClima {
  constructor(hub, { state = {}, saveState } = {}) {
    this.hub = hub;
    this.config = structuredClone(DEFAULT_CONFIG);
    this.state = { profile: 'comfort', season_mode: null, effective_season: null, room_targets: {}, paused: {}, ...state };
    this.saveState = saveState || (() => {});
    this.windowTimers = new Map();
    this.ids = { profile: 'select.casa_clima_profilo', season: 'select.casa_clima_stagione' };
    this._emitTimer = null;

    hub.registerEntity({ entity_id: this.ids.profile, name: 'Casa Clima profilo', owner: this, integration: 'casa_clima', icon: 'home' });
    hub.registerEntity({ entity_id: this.ids.season, name: 'Casa Clima stagione', owner: this, integration: 'casa_clima', icon: 'season' });
    hub.registerService('casa_clima', 'set_profile', (d) => this.setProfile(d.profile || d.option));
    hub.registerService('casa_clima', 'set_season', (d) => this.setSeason(d.season || d.option));
    hub.registerService('casa_clima', 'set_room_temperature', (d) => this.setRoomTemperature(d.room, d.temperature));
    hub.registerService('casa_clima', 'reset_room', (d) => this.resetRoom(d.room));
    hub.registerService('casa_clima', 'apply', () => this.applyAll('richiesta manuale'));

    this._onState = (e) => this.onStateChanged(e);
    hub.on('state_changed', this._onState);
    this._seasonTimer = setInterval(() => this.evaluateSeason(), 10 * 60_000);
    this._seasonTimer.unref?.();
  }

  load(config) {
    this.config = mergeConfig(DEFAULT_CONFIG, config || {});
    if (config?.profiles) this.config.profiles = { ...config.profiles };
    if (!this.config.profiles[this.state.profile]) this.state.profile = Object.keys(this.config.profiles)[0];
    if (!this.state.season_mode) this.state.season_mode = this.config.season.mode || 'auto';
    this.evaluateSeason(false);
    this.publish();
  }

  shutdown() {
    this.hub.off('state_changed', this._onState);
    clearInterval(this._seasonTimer);
    for (const t of this.windowTimers.values()) clearTimeout(t);
  }

  // ---------------------------------------------------------------- stanze

  climateEntities() {
    return [...this.hub.entities.values()].filter((m) => {
      if (m.domain !== 'climate') return false;
      const dev = m.device_id && this.hub.devices.get(m.device_id);
      return dev?.kind !== 'vehicle';
    });
  }

  rooms() {
    const cfgRooms = this.config.rooms;
    let rooms;
    if (Array.isArray(cfgRooms) && cfgRooms.length) {
      rooms = cfgRooms.map((r) => ({
        id: slugify(r.id || r.name),
        name: r.name || r.id,
        icon: r.icon || null,
        climates: toArray(r.climates ?? r.climate),
        sensors: toArray(r.temperature ?? r.sensors),
        humidity: toArray(r.humidity),
        windows: toArray(r.windows ?? r.window),
        heat: r.heat ? toArray(r.heat) : null,
        cool: r.cool ? toArray(r.cool) : null,
        offset: Number(r.offset || 0)
      }));
    } else {
      const byArea = new Map();
      const get = (area) => {
        const id = slugify(area);
        if (!byArea.has(id)) byArea.set(id, { id, name: area, icon: null, climates: [], sensors: [], humidity: [], windows: [], heat: null, cool: null, offset: 0 });
        return byArea.get(id);
      };
      const climates = new Set(this.climateEntities().map((c) => c.entity_id));
      for (const m of this.hub.entities.values()) {
        const area = this.hub.areaOf(m.entity_id);
        if (!area || this.hub.overrides[m.entity_id]?.hidden) continue;
        const st = this.hub.getState(m.entity_id);
        const dc = st?.attributes.device_class || m.device_class;
        if (m.domain === 'climate' && climates.has(m.entity_id)) get(area).climates.push(m.entity_id);
        else if (m.domain === 'sensor' && dc === 'temperature' && !st?.attributes.outdoor) get(area).sensors.push(m.entity_id);
        else if (m.domain === 'sensor' && dc === 'humidity' && !st?.attributes.outdoor) get(area).humidity.push(m.entity_id);
        else if (m.domain === 'binary_sensor' && (dc === 'window' || dc === 'door' && /finestra|window|balcon|portafinestra/i.test(m.name || ''))) get(area).windows.push(m.entity_id);
      }
      rooms = [...byArea.values()].filter((r) => r.climates.length || r.sensors.length);
      rooms.sort((a, b) => b.climates.length - a.climates.length || a.name.localeCompare(b.name));
    }
    return rooms;
  }

  findRoom(idOrName) {
    const id = slugify(idOrName);
    const room = this.rooms().find((r) => r.id === id);
    if (!room) throw new ServiceError(`Stanza non trovata: ${idOrName}`, 404);
    return room;
  }

  roomStatus(room) {
    const nums = (ids, pick) => ids.map((id) => pick(this.hub.getState(id))).filter((v) => isNumeric(v)).map(Number);
    const avg = (arr) => (arr.length ? round(arr.reduce((a, b) => a + b, 0) / arr.length, 1) : null);
    let temperature = avg(nums(room.sensors, (s) => s?.state));
    if (temperature === null) temperature = avg(nums(room.climates, (s) => s?.attributes.current_temperature));
    let humidity = avg(nums(room.humidity, (s) => s?.state));
    if (humidity === null) humidity = avg(nums(room.climates, (s) => s?.attributes.current_humidity));
    const states = room.climates.map((id) => this.hub.getState(id)).filter(Boolean);
    const actions = states.map((s) => s.attributes.hvac_action);
    const action = actions.includes('heating') ? 'heating' : actions.includes('cooling') ? 'cooling' : actions.includes('drying') ? 'drying' : states.some((s) => s.state !== 'off' && s.state !== 'unavailable') ? 'idle' : 'off';
    const targets = states.filter((s) => s.state !== 'off' && isNumeric(s.attributes.temperature)).map((s) => Number(s.attributes.temperature));
    const windowOpen = room.windows.some((id) => this.hub.getState(id)?.state === 'on');
    const unavailable = room.climates.filter((id) => !this.hub.getState(id) || this.hub.getState(id).state === 'unavailable');
    return {
      ...room,
      temperature,
      humidity: humidity === null ? null : Math.round(humidity),
      target: targets.length ? round(targets.reduce((a, b) => a + b, 0) / targets.length, 1) : null,
      desired: this.desiredTemperature(room),
      action,
      window_open: windowOpen,
      paused: Boolean(this.state.paused[room.id]),
      override: this.state.room_targets[room.id] ?? null,
      unavailable
    };
  }

  // ---------------------------------------------------------------- stagione

  outdoorTemperature() {
    const cfg = this.config.season.outdoor_sensor;
    const candidates = cfg ? [cfg] : ['sensor.meteo_temperatura', 'weather.casa'];
    for (const id of candidates) {
      const st = this.hub.getState(id);
      if (!st) continue;
      const v = id.startsWith('weather.') ? st.attributes.temperature : st.state;
      if (isNumeric(v)) return Number(v);
    }
    // ripiego: qualunque sensore di temperatura marcato come esterno
    for (const st of this.hub.states.values()) {
      if (st.attributes.device_class === 'temperature' && (st.attributes.outdoor || /estern|outdoor/i.test(st.attributes.friendly_name)) && isNumeric(st.state)) return Number(st.state);
    }
    return null;
  }

  /** Temperatura "stagionale": media prevista di oggi se disponibile (più stabile), altrimenti quella attuale. */
  seasonalTemperature() {
    const w = this.hub.getState('weather.casa');
    const today = w?.attributes.forecast?.[0];
    if (today && isNumeric(today.temperature) && isNumeric(today.templow)) return round((today.temperature + today.templow) / 2, 1);
    return this.outdoorTemperature();
  }

  evaluateSeason(apply = true) {
    let pending = null;
    const mode = this.state.season_mode || 'auto';
    let next;
    if (mode !== 'auto') next = mode;
    else {
      const t = this.seasonalTemperature();
      const { heat_below: hb, cool_above: ca } = this.config.season;
      const cur = this.state.effective_season;
      if (t === null) next = cur || (new Date().getMonth() >= 4 && new Date().getMonth() <= 8 ? 'cool' : 'heat');
      else if (t <= hb) next = 'heat';
      else if (t >= ca) next = 'cool';
      else next = cur && cur !== 'off' ? cur : t < (hb + ca) / 2 ? 'heat' : 'cool';
    }
    if (next !== this.state.effective_season) {
      const prev = this.state.effective_season;
      this.state.effective_season = next;
      this.saveState(this.state);
      if (prev) {
        log.info(`Stagione: ${SEASONS[prev]} -> ${SEASONS[next]}`);
        this.hub.addLog({ entity_id: this.ids.season, name: 'Casa Clima', message: `stagione impostata su ${SEASONS[next]}` });
        if (apply) pending = this.applyAll('cambio stagione');
      }
    }
    this.publish();
    return pending;
  }

  // ---------------------------------------------------------------- profili

  get profile() {
    return this.config.profiles[this.state.profile] || {};
  }

  desiredTemperature(room) {
    const p = this.profile;
    const season = this.state.effective_season;
    if (p.off || p.schedule || season === 'off') return null;
    if (this.state.room_targets[room.id] !== undefined) return this.state.room_targets[room.id];
    const roomCfg = p.rooms?.[room.id];
    const base = roomCfg?.[season] ?? p[season];
    return isNumeric(base) ? round(Number(base) + (room.offset || 0), 1) : null;
  }

  /** Divide i dispositivi della stanza tra chi lavora nella stagione corrente e chi deve restare spento. */
  roles(room) {
    const season = this.state.effective_season;
    const modes = (id) => this.hub.getState(id)?.attributes.hvac_modes || [];
    const avail = room.climates.filter((id) => this.hub.getState(id) && this.hub.getState(id).state !== 'unavailable');
    let active;
    if (season === 'heat') {
      if (room.heat) active = room.heat;
      else {
        const heatOnly = avail.filter((id) => modes(id).includes('heat') && !modes(id).includes('cool'));
        active = heatOnly.length ? heatOnly : avail.filter((id) => modes(id).includes('heat'));
      }
    } else if (season === 'cool') {
      active = room.cool || avail.filter((id) => modes(id).includes('cool'));
    } else active = [];
    active = active.filter((id) => avail.includes(id));
    return { active, idle: avail.filter((id) => !active.includes(id)) };
  }

  async ensure(entity_id, hvac_mode, temperature) {
    const st = this.hub.getState(entity_id);
    if (!st) return false;
    const a = st.attributes;
    if (hvac_mode === 'off') {
      if (st.state === 'off') return false;
      await this.hub.callService('climate', 'set_hvac_mode', { entity_id, hvac_mode: 'off' }, { casa_clima: true });
      return true;
    }
    if (temperature === null || temperature === undefined) {
      if (st.state === hvac_mode) return false;
      await this.hub.callService('climate', 'set_hvac_mode', { entity_id, hvac_mode }, { casa_clima: true });
      return true;
    }
    const step = Number(a.target_temp_step) || 0.5;
    const t = clamp(round(Math.round(temperature / step) * step, 1), a.min_temp ?? 5, a.max_temp ?? 35);
    if (st.state === hvac_mode && Math.abs(Number(a.temperature) - t) < 0.05) return false;
    await this.hub.callService('climate', 'set_temperature', { entity_id, hvac_mode, temperature: t }, { casa_clima: true });
    return true;
  }

  async applyRoom(room, reason) {
    const p = this.profile;
    const season = this.state.effective_season;
    const { active, idle } = this.roles(room);
    const errors = [];
    let changed = 0;
    const run = async (fn, id) => {
      try { if (await fn()) changed++; } catch (err) { errors.push(`${id}: ${err.message}`); }
    };
    if (this.state.paused[room.id]) return { changed, errors };
    if (p.off || season === 'off') {
      for (const id of [...active, ...idle]) await run(() => this.ensure(id, 'off'), id);
    } else if (p.schedule) {
      // i termostati con programma proprio (tado°, Netatmo) tornano al loro programma
      for (const id of [...active, ...idle]) {
        const modes = this.hub.getState(id)?.attributes.hvac_modes || [];
        if (modes.includes('auto') && !modes.includes('cool')) await run(() => this.ensure(id, 'auto'), id);
      }
    } else {
      const t = this.desiredTemperature(room);
      for (const id of active) await run(() => this.ensure(id, season, t), id);
      for (const id of idle) await run(() => this.ensure(id, 'off'), id);
    }
    if (changed || errors.length) {
      log.info(`${room.name}: ${changed} dispositivi aggiornati (${reason})${errors.length ? `, errori: ${errors.join('; ')}` : ''}`);
    }
    return { changed, errors };
  }

  async applyAll(reason = 'profilo') {
    const results = await Promise.all(this.rooms().map((r) => this.applyRoom(r, reason)));
    const errors = results.flatMap((r) => r.errors);
    const changed = results.reduce((a, r) => a + r.changed, 0);
    if (errors.length) this.hub.addLog({ entity_id: this.ids.profile, name: 'Casa Clima', message: `errori: ${errors.join('; ')}`, level: 'error' });
    this.scheduleEmit();
    return { changed, errors };
  }

  async setProfile(key) {
    if (!this.config.profiles[key]) throw new ServiceError(`Profilo sconosciuto: ${key}`);
    this.state.profile = key;
    this.state.room_targets = {};
    this.saveState(this.state);
    this.publish();
    this.hub.addLog({ entity_id: this.ids.profile, name: 'Casa Clima', message: `profilo ${this.config.profiles[key].name || key}` });
    return this.applyAll(`profilo ${key}`);
  }

  async setSeason(mode) {
    if (!SEASONS[mode]) throw new ServiceError(`Stagione non valida: ${mode}`);
    this.state.season_mode = mode;
    this.saveState(this.state);
    await this.evaluateSeason(true);
    return { season: this.state.effective_season };
  }

  async setRoomTemperature(roomId, temperature) {
    const room = this.findRoom(roomId);
    if (!isNumeric(temperature)) throw new ServiceError('Temperatura non valida');
    this.state.room_targets[room.id] = round(Number(temperature), 1);
    this.saveState(this.state);
    const p = this.profile;
    if (p.off || p.schedule) {
      // in "Spento"/"Programma" una regolazione manuale accende comunque la stanza
      const season = this.state.effective_season === 'cool' ? 'cool' : 'heat';
      const { active } = this.roles(room);
      for (const id of active) await this.ensure(id, season, this.state.room_targets[room.id]);
      this.scheduleEmit();
      return { room: room.id };
    }
    const res = await this.applyRoom(room, 'regolazione stanza');
    this.scheduleEmit();
    return res;
  }

  async resetRoom(roomId) {
    const room = this.findRoom(roomId);
    delete this.state.room_targets[room.id];
    this.saveState(this.state);
    return this.applyRoom(room, 'ripristino profilo');
  }

  // ---------------------------------------------------------------- finestre

  onStateChanged({ entity_id, old_state, new_state }) {
    const domain = entity_id.split('.')[0];
    if (['climate', 'sensor', 'binary_sensor', 'weather'].includes(domain) && entity_id !== this.ids.profile) this.scheduleEmit();
    if (domain === 'binary_sensor' && this.config.window.enabled !== false && old_state?.state !== new_state?.state) {
      for (const room of this.rooms()) if (room.windows.includes(entity_id)) this.onWindow(room);
    }
    if ((entity_id === 'weather.casa' || entity_id === this.config.season.outdoor_sensor) && this.state.season_mode === 'auto') {
      this.evaluateSeason()?.catch((e) => log.warn(e.message));
    }
  }

  onWindow(room) {
    const open = room.windows.some((id) => this.hub.getState(id)?.state === 'on');
    clearTimeout(this.windowTimers.get(room.id));
    const w = this.config.window;
    if (open && !this.state.paused[room.id]) {
      this.windowTimers.set(room.id, setTimeout(() => this.pauseRoom(room).catch((e) => log.warn(e.message)), Number(w.delay ?? 60) * 1000));
    } else if (!open && this.state.paused[room.id]) {
      this.windowTimers.set(room.id, setTimeout(() => this.resumeRoom(room).catch((e) => log.warn(e.message)), Number(w.restore_delay ?? 30) * 1000));
    }
  }

  async pauseRoom(room) {
    const saved = {};
    for (const id of room.climates) {
      const st = this.hub.getState(id);
      if (st && st.state !== 'off' && st.state !== 'unavailable') {
        saved[id] = { state: st.state, temperature: st.attributes.temperature };
        try { await this.ensure(id, 'off'); } catch (err) { log.warn(`${id}: ${err.message}`); }
      }
    }
    this.state.paused[room.id] = { since: new Date().toISOString(), saved };
    this.saveState(this.state);
    this.hub.addLog({ entity_id: `sensor.casa_clima_${room.id}`, name: room.name, message: 'finestra aperta: clima in pausa' });
    this.scheduleEmit();
  }

  async resumeRoom(room) {
    const paused = this.state.paused[room.id];
    delete this.state.paused[room.id];
    this.saveState(this.state);
    const p = this.profile;
    if (p.schedule || (!p.off && this.desiredTemperature(room) === null)) {
      // senza temperature di profilo ripristina com'era
      for (const [id, s] of Object.entries(paused?.saved || {})) {
        try { await this.ensure(id, s.state, s.state === 'auto' ? null : s.temperature); } catch (err) { log.warn(`${id}: ${err.message}`); }
      }
    } else {
      await this.applyRoom(room, 'finestra chiusa');
    }
    this.hub.addLog({ entity_id: `sensor.casa_clima_${room.id}`, name: room.name, message: 'finestra chiusa: clima ripristinato' });
    this.scheduleEmit();
  }

  // ---------------------------------------------------------------- entità e riepilogo

  async handleService(entity_id, service, data) {
    if (service !== 'select_option') throw new ServiceError(`Servizio non supportato: ${service}`);
    if (entity_id === this.ids.profile) return this.setProfile(data.option);
    if (entity_id === this.ids.season) return this.setSeason(data.option);
    throw new ServiceError('Entità sconosciuta', 404);
  }

  publish() {
    const profiles = this.config.profiles;
    this.hub.setState(this.ids.profile, this.state.profile, {
      options: Object.keys(profiles),
      labels: Object.fromEntries(Object.entries(profiles).map(([k, p]) => [k, p.name || k]))
    });
    this.hub.setState(this.ids.season, this.state.season_mode || 'auto', {
      options: Object.keys(SEASONS),
      labels: SEASONS,
      effective: this.state.effective_season,
      outdoor_temperature: this.outdoorTemperature(),
      seasonal_temperature: this.seasonalTemperature()
    });
  }

  scheduleEmit() {
    if (this._emitTimer) return;
    this._emitTimer = setTimeout(() => {
      this._emitTimer = null;
      this.hub.emit('casa_clima', this.summary());
    }, 700);
  }

  energy() {
    const cfg = this.config.energy || {};
    const find = (re) => [...this.hub.states.values()].find((s) => s.attributes.device_class === 'power' && s.attributes.unit_of_measurement === 'W' && re.test(`${s.entity_id} ${s.attributes.friendly_name}`))?.entity_id;
    const grid = cfg.grid_power || find(/consumo|rete|grid|casa|totale/i);
    const pv = cfg.pv_power || find(/fotovolt|_fv|solar|pv\b|produzione/i);
    const val = (id) => (id && isNumeric(this.hub.getState(id)?.state) ? Number(this.hub.getState(id).state) : null);
    return { grid_power: grid || null, pv_power: pv || null, grid: val(grid), pv: val(pv) };
  }

  summary() {
    const rooms = this.rooms().map((r) => this.roomStatus(r));
    const alerts = [];
    const season = this.state.effective_season;
    for (const r of rooms) {
      if (r.window_open && !r.paused && ['heating', 'cooling'].includes(r.action)) {
        alerts.push({ level: 'warn', room: r.id, message: `${r.name}: finestra aperta con il clima acceso${this.config.window.enabled !== false ? ' (pausa automatica a breve)' : ''}` });
      }
      if (r.paused) alerts.push({ level: 'info', room: r.id, message: `${r.name}: clima in pausa per finestra aperta` });
      if (r.humidity !== null && r.humidity >= (this.config.humidity.high ?? 65)) {
        alerts.push({ level: 'info', room: r.id, message: `${r.name}: umidità alta (${r.humidity}%)${season === 'cool' ? ', prova la deumidificazione' : ', arieggia qualche minuto'}` });
      }
      if (r.unavailable.length) alerts.push({ level: 'warn', room: r.id, message: `${r.name}: ${r.unavailable.length} dispositivi non raggiungibili` });
      if (r.temperature !== null && r.desired !== null && !r.window_open) {
        if (season === 'heat' && r.temperature < r.desired - 2.5) alerts.push({ level: 'info', room: r.id, message: `${r.name}: ${r.temperature}°C, ancora lontana dai ${r.desired}°C richiesti` });
        if (season === 'cool' && r.temperature > r.desired + 3) alerts.push({ level: 'info', room: r.id, message: `${r.name}: ${r.temperature}°C, ancora lontana dai ${r.desired}°C richiesti` });
      }
    }
    const temps = rooms.map((r) => r.temperature).filter((v) => v !== null);
    return {
      name: this.config.name,
      profile: this.state.profile,
      profiles: Object.entries(this.config.profiles).map(([key, p]) => ({ key, name: p.name || key, icon: p.icon || null, heat: p.heat ?? null, cool: p.cool ?? null, schedule: Boolean(p.schedule), off: Boolean(p.off) })),
      season: {
        mode: this.state.season_mode || 'auto',
        effective: season,
        labels: SEASONS,
        outdoor: this.outdoorTemperature(),
        seasonal: this.seasonalTemperature(),
        heat_below: this.config.season.heat_below,
        cool_above: this.config.season.cool_above
      },
      average_temperature: temps.length ? round(temps.reduce((a, b) => a + b, 0) / temps.length, 1) : null,
      rooms,
      alerts,
      energy: this.energy()
    };
  }
}
