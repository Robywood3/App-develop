/*
 * Scene in formato Home Assistant:
 *   - id: serata
 *     name: Serata film
 *     entities:
 *       light.luce_studio: { state: on, brightness_pct: 30 }
 *       cover.tapparella_soggiorno: closed
 *       climate.daikin_soggiorno: { state: heat, temperature: 21 }
 * In più accettano "actions:" (lista di azioni come nelle automazioni).
 */
import { slugify, toArray, createLogger } from './util.js';
import { ServiceError } from './hub.js';

const log = createLogger('scene');

/** Converte lo stato desiderato di un'entità nelle chiamate di servizio necessarie. */
export function sceneCalls(entity_id, target) {
  const domain = entity_id.split('.')[0];
  const t = typeof target === 'object' && target !== null ? target : { state: target };
  const state = t.state === true ? 'on' : t.state === false ? 'off' : t.state !== undefined ? String(t.state) : undefined;
  const calls = [];
  const call = (service, data = {}) => calls.push({ domain, service, data: { entity_id, ...data } });
  switch (domain) {
    case 'switch':
    case 'automation':
      if (state) call(state === 'on' ? 'turn_on' : 'turn_off');
      break;
    case 'light':
      if (state === 'off') call('turn_off');
      else if (state === 'on' || t.brightness_pct !== undefined) call('turn_on', t.brightness_pct !== undefined ? { brightness_pct: t.brightness_pct } : {});
      break;
    case 'cover':
      if (t.position !== undefined || t.current_position !== undefined) call('set_cover_position', { position: t.position ?? t.current_position });
      else if (state === 'open') call('open_cover');
      else if (state === 'closed') call('close_cover');
      break;
    case 'lock':
      if (state) call(state === 'locked' ? 'lock' : 'unlock');
      break;
    case 'climate':
      if (state && t.temperature !== undefined && state !== 'off') call('set_temperature', { hvac_mode: state, temperature: t.temperature });
      else if (state) call('set_hvac_mode', { hvac_mode: state });
      else if (t.temperature !== undefined) call('set_temperature', { temperature: t.temperature });
      if (t.fan_mode) call('set_fan_mode', { fan_mode: t.fan_mode });
      break;
    case 'select':
      if (state) call('select_option', { option: state });
      break;
    case 'number':
      if (state !== undefined) call('set_value', { value: Number(state) });
      break;
    default:
      throw new Error(`Le scene non supportano il dominio ${domain}`);
  }
  return calls;
}

export class SceneManager {
  constructor(hub, automationRunner) {
    this.hub = hub;
    this.runner = automationRunner; // per eseguire "actions:"
    this.scenes = [];
    this.errors = [];
    hub.registerService('scene', 'turn_on', (data) => Promise.all(toArray(data.entity_id).map((id) => this.activate(id))));
  }

  load(configs) {
    for (const s of this.scenes) {
      this.hub.entities.delete(s.entity_id);
      this.hub.states.delete(s.entity_id);
    }
    this.scenes = [];
    this.errors = [];
    toArray(configs).forEach((cfg, i) => {
      const id = slugify(cfg.id || cfg.name || `scena_${i + 1}`);
      const scene = { id, entity_id: `scene.${id}`, name: cfg.name || id, icon: cfg.icon || null, entities: cfg.entities || {}, actions: toArray(cfg.actions), last: null };
      try {
        for (const [eid, target] of Object.entries(scene.entities)) sceneCalls(eid, target);
      } catch (err) {
        this.errors.push(`Scena "${scene.name}": ${err.message}`);
        return;
      }
      this.scenes.push(scene);
      this.hub.registerEntity({ entity_id: scene.entity_id, name: scene.name, owner: this, integration: 'scene', icon: scene.icon });
      this.hub.setState(scene.entity_id, null, { icon: scene.icon });
    });
  }

  async activate(entity_id) {
    const scene = this.scenes.find((s) => s.entity_id === entity_id || s.id === entity_id);
    if (!scene) throw new ServiceError(`Scena non trovata: ${entity_id}`, 404);
    const errors = [];
    await Promise.all(Object.entries(scene.entities).map(async ([eid, target]) => {
      for (const c of sceneCalls(eid, target)) {
        try {
          await this.hub.callService(c.domain, c.service, c.data, { scene: scene.id });
        } catch (err) {
          errors.push(`${eid}: ${err.message}`);
        }
      }
    }));
    if (scene.actions.length) await this.runner(scene.actions);
    scene.last = new Date().toISOString();
    this.hub.setState(scene.entity_id, scene.last, { icon: scene.icon });
    this.hub.addLog({ entity_id: scene.entity_id, name: scene.name, message: errors.length ? `attivata con errori: ${errors.join('; ')}` : 'attivata' });
    if (errors.length) log.warn(`${scene.name}: ${errors.join('; ')}`);
    return { errors };
  }

  async handleService(entity_id, service) {
    if (service !== 'turn_on') throw new ServiceError(`Servizio non supportato: ${service}`);
    return this.activate(entity_id);
  }

  list() {
    return this.scenes.map(({ id, entity_id, name, icon, entities, last }) => ({ id, entity_id, name, icon, entities: Object.keys(entities), last }));
  }
}
