/*
 * Classe base delle integrazioni (equivalente di una "config entry" + "DataUpdateCoordinator"
 * di Home Assistant): ogni istanza configurata dall'utente crea dispositivi ed entità,
 * le aggiorna a intervalli regolari (polling) e risponde ai servizi.
 */
import { slugify, createLogger } from '../core/util.js';
import { ServiceError } from '../core/hub.js';

export class Integration {
  /** Descrizione mostrata nell'interfaccia (sovrascritta da ogni integrazione). */
  static meta = {
    type: 'base',
    name: 'Base',
    description: '',
    fields: [],
    auth: null, // 'oauth' | 'device' | null
    defaultPollInterval: 60
  };

  /**
   * @param {import('../core/hub.js').Hub} hub
   * @param {object} entry  { id, type, title, options, data, enabled }
   * @param {object} ctx    { saveEntry(), settings, publicUrl }
   */
  constructor(hub, entry, ctx) {
    this.hub = hub;
    this.entry = entry;
    this.ctx = ctx;
    this.options = entry.options || {};
    this.data = entry.data || (entry.data = {});
    this.log = createLogger(`${entry.type}:${entry.title || entry.id}`);
    this.status = { state: 'setup', message: 'Avvio…', updated: null };
  }

  get pollInterval() {
    const v = Number(this.options.poll_interval);
    return v > 0 ? v : this.constructor.meta.defaultPollInterval;
  }

  /** Prima connessione: crea dispositivi ed entità. */
  async setup() {}

  /** Aggiornamento periodico. */
  async update() {}

  async unload() {
    this.hub.removeEntitiesOf(this);
  }

  async handleService(entity_id, service) {
    throw new ServiceError(`${service} non supportato da ${entity_id}`);
  }

  saveData() {
    return this.ctx.saveEntry(this.entry);
  }

  // --------------------------------------------------------- helper per entità

  device(key, info) {
    const id = `${this.entry.id}:${key}`;
    this.hub.registerDevice({ id, owner: this, integration: this.entry.type, entry_id: this.entry.id, ...info });
    return id;
  }

  /**
   * Registra (o ritrova) un'entità e ne restituisce l'entity_id.
   * key: chiave univoca all'interno dell'integrazione (es. "zone_3_climate").
   */
  entity(domain, key, def) {
    const unique_id = `${this.entry.id}:${domain}:${key}`;
    const existing = [...this.hub.entities.entries()].find(([, m]) => m.unique_id === unique_id);
    const savedIds = this.data._entity_ids || (this.data._entity_ids = {});
    let entity_id = existing?.[0] || savedIds[unique_id];
    if (!entity_id || (this.hub.entities.has(entity_id) && this.hub.entities.get(entity_id).unique_id !== unique_id)) {
      entity_id = this.hub.uniqueEntityId(domain, slugify(def.slug || def.name), unique_id);
    }
    if (savedIds[unique_id] !== entity_id) {
      savedIds[unique_id] = entity_id;
      this.ctx.saveLater?.();
    }
    this.hub.registerEntity({
      ...def,
      entity_id,
      unique_id,
      owner: this,
      integration: this.entry.type,
      entry_id: this.entry.id
    });
    return entity_id;
  }

  set(entity_id, state, attributes) {
    return this.hub.setState(entity_id, state, attributes);
  }

  /** Imposta temporaneamente lo stato (aggiornamento "ottimistico" dopo un comando). */
  patch(entity_id, state, attributes = {}) {
    const cur = this.hub.getState(entity_id);
    return this.hub.setState(entity_id, state === undefined ? cur?.state : state, { ...(cur?.attributes || {}), ...attributes });
  }
}

/** Mappature HVAC condivise. */
export const HVAC = {
  OFF: 'off',
  HEAT: 'heat',
  COOL: 'cool',
  AUTO: 'auto',
  HEAT_COOL: 'heat_cool',
  DRY: 'dry',
  FAN: 'fan_only'
};
