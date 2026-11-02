/*
 * Il "cuore" del sistema, modellato sui tre pilastri di Home Assistant (homeassistant/core.py):
 *
 *   - State machine   -> hub.states: ogni entità ha uno stato + attributi
 *   - Event bus       -> hub.on('state_changed' | 'service_called' | 'logbook' ...)
 *   - Service registry-> hub.callService(dominio, servizio, dati)
 *
 * Più due registri, come in HA:
 *   - entity registry -> metadati delle entità (nome, stanza, integrazione proprietaria)
 *   - device registry -> raggruppa le entità in apparecchi fisici (es. "Tesla Model Y")
 */
import { EventEmitter } from 'node:events';
import { createLogger, toArray } from './util.js';

const log = createLogger('hub');

export class ServiceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export class Hub extends EventEmitter {
  constructor({ overrides = {} } = {}) {
    super();
    this.setMaxListeners(100);
    /** @type {Map<string, {entity_id:string,state:any,attributes:object,last_changed:string,last_updated:string}>} */
    this.states = new Map();
    /** @type {Map<string, object>} metadati: owner, device_id, name, icon, area ... */
    this.entities = new Map();
    /** @type {Map<string, object>} */
    this.devices = new Map();
    /** @type {Map<string, Function>} servizi globali "dominio.servizio" */
    this.services = new Map();
    /** override dell'utente (nome, stanza, nascosto) per entity_id */
    this.overrides = overrides;
    this.logbook = [];
    this.startedAt = new Date().toISOString();
  }

  // ---------------------------------------------------------------- registry

  registerDevice(device) {
    const prev = this.devices.get(device.id) || {};
    this.devices.set(device.id, { ...prev, ...device });
    return device.id;
  }

  /**
   * Registra un'entità. `owner` è l'istanza di integrazione che risponde ai servizi
   * (metodo owner.handleService(entity_id, service, data)).
   */
  registerEntity(def) {
    if (!/^[a-z_]+\.[a-z0-9_]+$/.test(def.entity_id)) throw new Error(`entity_id non valido: ${def.entity_id}`);
    const prev = this.entities.get(def.entity_id);
    const meta = { ...prev, ...def, domain: def.entity_id.split('.')[0] };
    this.entities.set(def.entity_id, meta);
    return def.entity_id;
  }

  /** Genera un entity_id libero a partire da dominio + slug. */
  uniqueEntityId(domain, slug, uniqueKey) {
    // se esiste già un'entità con la stessa chiave univoca, riusa l'id (stabilità tra i riavvii)
    for (const [id, meta] of this.entities) {
      if (uniqueKey && meta.unique_id === uniqueKey) return id;
    }
    let id = `${domain}.${slug}`;
    let n = 2;
    while (this.entities.has(id)) id = `${domain}.${slug}_${n++}`;
    return id;
  }

  removeEntitiesOf(owner) {
    for (const [id, meta] of [...this.entities]) {
      if (meta.owner === owner) {
        this.entities.delete(id);
        const old = this.states.get(id);
        this.states.delete(id);
        if (old) this.emit('state_changed', { entity_id: id, old_state: old, new_state: null });
      }
    }
    for (const [id, dev] of [...this.devices]) {
      if (dev.owner === owner) this.devices.delete(id);
    }
  }

  entityMeta(entity_id) {
    const meta = this.entities.get(entity_id);
    if (!meta) return null;
    const ov = this.overrides[entity_id] || {};
    return { ...meta, ...ov, owner: undefined };
  }

  /** Stanza effettiva: override dell'utente > stanza indicata dall'integrazione. */
  areaOf(entity_id) {
    const ov = this.overrides[entity_id];
    if (ov && ov.area !== undefined) return ov.area || null;
    const meta = this.entities.get(entity_id);
    if (!meta) return null;
    if (meta.area) return meta.area;
    const dev = meta.device_id && this.devices.get(meta.device_id);
    return dev?.area || null;
  }

  // ---------------------------------------------------------------- state machine

  getState(entity_id) {
    return this.states.get(entity_id) || null;
  }

  /**
   * Aggiorna lo stato di un'entità. Emette 'state_changed' solo se cambia qualcosa.
   * Come in HA: last_changed cambia solo quando cambia lo stato, last_updated anche con i soli attributi.
   */
  setState(entity_id, state, attributes = {}, { force = false } = {}) {
    const old = this.states.get(entity_id) || null;
    const meta = this.entities.get(entity_id) || {};
    const ov = this.overrides[entity_id] || {};
    const attrs = { ...attributes };
    attrs.friendly_name = ov.name || meta.name || attributes.friendly_name || entity_id;
    if (meta.icon && !attrs.icon) attrs.icon = meta.icon;
    if (meta.unit && !attrs.unit_of_measurement) attrs.unit_of_measurement = meta.unit;
    if (meta.device_class && !attrs.device_class) attrs.device_class = meta.device_class;
    const area = this.areaOf(entity_id);
    if (area) attrs.area = area;
    else delete attrs.area;

    const value = state === undefined ? null : state;
    const stateChanged = !old || old.state !== value;
    const attrsChanged = !old || JSON.stringify(old.attributes) !== JSON.stringify(attrs);
    if (!stateChanged && !attrsChanged && !force) return old;

    const now = new Date().toISOString();
    const next = {
      entity_id,
      state: value,
      attributes: attrs,
      last_changed: stateChanged ? now : old.last_changed,
      last_updated: now
    };
    this.states.set(entity_id, next);
    this.emit('state_changed', { entity_id, old_state: old, new_state: next });
    return next;
  }

  /** Rielabora lo stato (es. dopo un cambio di nome/stanza dall'interfaccia). */
  refreshState(entity_id) {
    const s = this.states.get(entity_id);
    if (s) this.setState(entity_id, s.state, s.attributes, { force: true });
  }

  // ---------------------------------------------------------------- services

  registerService(domain, service, handler, { description } = {}) {
    this.services.set(`${domain}.${service}`, Object.assign(handler, { description }));
  }

  /**
   * Chiama un servizio. Se esiste un servizio globale (es. casa_clima.set_profile) lo usa,
   * altrimenti inoltra all'integrazione proprietaria di ciascuna entità indicata.
   * `data.entity_id` (o `target.entity_id`) può essere una stringa o un array.
   */
  async callService(domain, service, data = {}, context = {}) {
    const key = `${domain}.${service}`;
    const payload = { ...data };
    if (payload.target) {
      Object.assign(payload, payload.target);
      delete payload.target;
    }
    this.emit('service_called', { domain, service, data: payload, context });

    const global = this.services.get(key);
    if (global) return global(payload, context);

    const ids = toArray(payload.entity_id);
    if (!ids.length) throw new ServiceError(`Servizio sconosciuto o senza entity_id: ${key}`);
    const { entity_id, ...rest } = payload;
    const results = [];
    for (const id of ids) {
      const meta = this.entities.get(id);
      if (!meta) throw new ServiceError(`Entità sconosciuta: ${id}`, 404);
      const callDomain = domain === 'homeassistant' ? meta.domain : domain;
      if (callDomain !== meta.domain) {
        throw new ServiceError(`Il servizio ${key} non si applica a ${id}`);
      }
      if (!meta.owner || typeof meta.owner.handleService !== 'function') {
        throw new ServiceError(`L'entità ${id} è di sola lettura`);
      }
      log.info(`${key} -> ${id}`, Object.keys(rest).length ? JSON.stringify(rest) : '');
      results.push(await meta.owner.handleService(id, service, rest, context));
    }
    return results;
  }

  // ---------------------------------------------------------------- logbook

  addLog(entry) {
    const item = { when: new Date().toISOString(), ...entry };
    this.logbook.push(item);
    if (this.logbook.length > 500) this.logbook.splice(0, this.logbook.length - 500);
    this.emit('logbook', item);
    return item;
  }

  snapshot() {
    return [...this.states.values()].filter((s) => !this.overrides[s.entity_id]?.hidden);
  }
}
