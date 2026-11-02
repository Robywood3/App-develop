/*
 * Motore delle automazioni, compatibile con un sottoinsieme della sintassi YAML di Home Assistant:
 *
 *   triggers: state, numeric_state, time, time_pattern, homeassistant (start)
 *   conditions: state, numeric_state, time, and, or, not
 *   actions: action/service, delay, condition, choose, if/then/else, stop, wait (delay)
 *   mode: single | restart | parallel
 *
 * Accetta sia le chiavi "vecchie" (trigger/platform/service) sia quelle nuove (triggers/trigger/action).
 * I template Jinja non sono supportati.
 */
import { createLogger, parseDuration, toArray, isNumeric, timeOfDay, WEEKDAYS, slugify } from './util.js';
import { ServiceError } from './hub.js';

const log = createLogger('automation');

class Stopped extends Error {}

function valueFor(hub, entity_id, attribute) {
  const st = hub.getState(entity_id);
  if (!st) return undefined;
  return attribute ? st.attributes[attribute] : st.state;
}

function matches(value, expected) {
  if (expected === undefined) return true;
  return toArray(expected).some((e) => String(e) === String(value));
}

function numericMatch(value, above, below) {
  if (!isNumeric(value)) return false;
  const v = Number(value);
  if (above !== undefined && !(v > Number(above))) return false;
  if (below !== undefined && !(v < Number(below))) return false;
  return true;
}

function secondsOfDay(d = new Date()) {
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

function abortableSleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Stopped('annullata'));
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(t); reject(new Stopped('annullata')); }, { once: true });
  });
}

/** Normalizza un trigger nelle varie forme accettate da HA. */
function normTrigger(t) {
  const platform = t.platform || t.trigger;
  if (!platform) throw new Error(`Trigger senza "trigger:"/"platform:" (${JSON.stringify(t)})`);
  return { ...t, platform, entity_id: toArray(t.entity_id), forSec: parseDuration(t.for) };
}

/** Normalizza un'azione: "service" e "action" sono sinonimi. */
function normAction(a) {
  if (typeof a === 'string') throw new Error(`Azione non valida: ${a}`);
  if (a.service && !a.action) return { ...a, action: a.service };
  return a;
}

export function evaluateCondition(hub, c, now = new Date()) {
  if (typeof c === 'string') throw new Error('I template come condizione non sono supportati');
  const type = c.condition;
  switch (type) {
    case 'and':
      return toArray(c.conditions).every((x) => evaluateCondition(hub, x, now));
    case 'or':
      return toArray(c.conditions).some((x) => evaluateCondition(hub, x, now));
    case 'not':
      return !toArray(c.conditions).some((x) => evaluateCondition(hub, x, now));
    case 'state': {
      const forSec = parseDuration(c.for);
      return toArray(c.entity_id).every((id) => {
        const st = hub.getState(id);
        if (!st) return false;
        const v = c.attribute ? st.attributes[c.attribute] : st.state;
        if (!matches(v, c.state)) return false;
        return !forSec || (now - new Date(st.last_changed)) / 1000 >= forSec;
      });
    }
    case 'numeric_state':
      return toArray(c.entity_id).every((id) => numericMatch(valueFor(hub, id, c.attribute), c.above, c.below));
    case 'time': {
      const s = secondsOfDay(now);
      if (c.weekday && !toArray(c.weekday).includes(WEEKDAYS[now.getDay()])) return false;
      const after = c.after !== undefined ? timeOfDay(c.after) : null;
      const before = c.before !== undefined ? timeOfDay(c.before) : null;
      if (after !== null && before !== null && after > before) return s >= after || s < before; // a cavallo della mezzanotte
      if (after !== null && s < after) return false;
      if (before !== null && s >= before) return false;
      return true;
    }
    default:
      throw new Error(`Condizione non supportata: ${type}`);
  }
}

export class Automation {
  constructor(engine, config, index) {
    this.engine = engine;
    this.hub = engine.hub;
    this.config = config;
    this.id = String(config.id || slugify(config.alias || `automazione_${index + 1}`));
    this.alias = config.alias || this.id;
    this.mode = config.mode || 'single';
    this.triggers = toArray(config.triggers ?? config.trigger).map(normTrigger);
    this.conditions = toArray(config.conditions ?? config.condition);
    this.actions = toArray(config.actions ?? config.action).map(normAction);
    if (!this.triggers.length) throw new Error(`"${this.alias}": nessun trigger`);
    if (!this.actions.length) throw new Error(`"${this.alias}": nessuna azione`);
    for (const t of this.triggers) {
      if (!['state', 'numeric_state', 'time', 'time_pattern', 'homeassistant'].includes(t.platform)) {
        throw new Error(`"${this.alias}": trigger non supportato "${t.platform}"`);
      }
    }
    this.enabled = config.enabled !== false && config.initial_state !== false;
    this.timers = new Map();
    this.numericInside = new Map();
    this.running = new Set();
    this.lastTriggered = null;
  }

  // ------------------------------------------------------------ triggers

  onStateChanged({ entity_id, old_state, new_state }) {
    if (!this.enabled) return;
    this.triggers.forEach((t, i) => {
      if (!t.entity_id.includes(entity_id)) return;
      const key = `${i}:${entity_id}`;
      if (t.platform === 'state') {
        const oldV = old_state ? (t.attribute ? old_state.attributes[t.attribute] : old_state.state) : undefined;
        const newV = new_state ? (t.attribute ? new_state.attributes[t.attribute] : new_state.state) : undefined;
        if (oldV === newV) return;
        if (!new_state) return;
        const toOk = matches(newV, t.to);
        const fromOk = t.from === undefined || (old_state && matches(oldV, t.from));
        if (t.not_to !== undefined && matches(newV, t.not_to)) return this.cancelTimer(key);
        if (!toOk) return this.cancelTimer(key);
        if (!fromOk) return;
        this.fireAfter(key, t.forSec, { platform: 'state', entity_id, from_state: old_state, to_state: new_state });
      } else if (t.platform === 'numeric_state') {
        const v = new_state ? (t.attribute ? new_state.attributes[t.attribute] : new_state.state) : undefined;
        const inside = numericMatch(v, t.above, t.below);
        const was = this.numericInside.get(key) ?? (old_state ? numericMatch(t.attribute ? old_state.attributes[t.attribute] : old_state.state, t.above, t.below) : false);
        this.numericInside.set(key, inside);
        if (!inside) return this.cancelTimer(key);
        if (!was) this.fireAfter(key, t.forSec, { platform: 'numeric_state', entity_id, to_state: new_state });
      }
    });
  }

  onTick(prev, now) {
    if (!this.enabled) return;
    const ps = secondsOfDay(prev);
    const ns = secondsOfDay(now);
    const day = WEEKDAYS[now.getDay()];
    const inWindow = (target) => (ns >= ps ? target > ps && target <= ns : target > ps || target <= ns);
    for (const t of this.triggers) {
      if (t.platform === 'time') {
        if (t.weekday && !toArray(t.weekday).includes(day)) continue;
        for (const at of toArray(t.at)) {
          if (inWindow(timeOfDay(at))) this.trigger({ platform: 'time', at });
        }
      } else if (t.platform === 'time_pattern' && ps !== ns) {
        // controlla ogni secondo passato dall'ultimo tick (di solito uno solo)
        for (let s = ps + 1; ; s++) {
          const sec = ((s % 86400) + 86400) % 86400;
          if (this.patternMatch(t, sec)) { this.trigger({ platform: 'time_pattern' }); break; }
          if (sec === ns) break;
        }
      }
    }
  }

  patternMatch(t, sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    // come in HA: le unità più piccole non indicate valgono 0, quelle più grandi "*"
    const spec = { hours: t.hours, minutes: t.minutes, seconds: t.seconds };
    if (spec.hours !== undefined && spec.minutes === undefined) spec.minutes = 0;
    if ((spec.hours !== undefined || spec.minutes !== undefined) && spec.seconds === undefined) spec.seconds = 0;
    const ok = (pat, v) => {
      if (pat === undefined || pat === '*') return true;
      const p = String(pat);
      if (p.startsWith('/')) return v % Number(p.slice(1)) === 0;
      return Number(p) === v;
    };
    return ok(spec.hours, h) && ok(spec.minutes, m) && ok(spec.seconds, s);
  }

  fireAfter(key, forSec, info) {
    if (!forSec) return this.trigger(info);
    if (this.timers.has(key)) return; // già in attesa
    this.timers.set(key, setTimeout(() => {
      this.timers.delete(key);
      this.trigger({ ...info, for: forSec });
    }, forSec * 1000));
  }

  cancelTimer(key) {
    const t = this.timers.get(key);
    if (t) { clearTimeout(t); this.timers.delete(key); }
  }

  // ------------------------------------------------------------ esecuzione

  async trigger(info = { platform: 'manual' }, { skipConditions = false } = {}) {
    try {
      if (!skipConditions && !this.conditions.every((c) => evaluateCondition(this.hub, c))) return false;
    } catch (err) {
      log.warn(`${this.alias}: ${err.message}`);
      return false;
    }
    if (this.running.size && this.mode === 'single') {
      log.debug(`${this.alias}: già in esecuzione, ignorata`);
      return false;
    }
    if (this.running.size && this.mode === 'restart') for (const r of this.running) r.abort();
    const ctrl = new AbortController();
    this.running.add(ctrl);
    this.lastTriggered = new Date().toISOString();
    this.engine.publish(this);
    this.hub.addLog({ entity_id: `automation.${this.id}`, name: this.alias, message: `attivata (${describeTrigger(info)})` });
    try {
      await this.runSequence(this.actions, ctrl.signal, info);
    } catch (err) {
      if (!(err instanceof Stopped)) {
        log.warn(`${this.alias}: ${err.message}`);
        this.hub.addLog({ entity_id: `automation.${this.id}`, name: this.alias, message: `errore: ${err.message}`, level: 'error' });
      }
    } finally {
      this.running.delete(ctrl);
      this.engine.publish(this);
    }
    return true;
  }

  async runSequence(actions, signal, info) {
    for (const raw of actions) {
      if (signal.aborted) throw new Stopped();
      const a = normAction(raw);
      if (a.enabled === false) continue;
      if (a.delay !== undefined) {
        await abortableSleep(parseDuration(a.delay) * 1000, signal);
      } else if (a.condition !== undefined) {
        if (!evaluateCondition(this.hub, a)) throw new Stopped('condizione falsa');
      } else if (a.choose !== undefined) {
        const branch = toArray(a.choose).find((b) => toArray(b.conditions).every((c) => evaluateCondition(this.hub, c)));
        const seq = branch ? branch.sequence : a.default;
        if (seq) await this.runSequence(toArray(seq), signal, info);
      } else if (a.if !== undefined) {
        const ok = toArray(a.if).every((c) => evaluateCondition(this.hub, c));
        const seq = ok ? a.then : a.else;
        if (seq) await this.runSequence(toArray(seq), signal, info);
      } else if (a.stop !== undefined) {
        throw new Stopped(a.stop);
      } else if (a.action) {
        const [domain, service] = String(a.action).split('.');
        try {
          await this.hub.callService(domain, service, { ...(a.data || {}), ...(a.target || {}), ...(a.entity_id ? { entity_id: a.entity_id } : {}) }, { automation: this.id });
        } catch (err) {
          if (!a.continue_on_error) throw err;
          log.warn(`${this.alias}: ${err.message} (continuo)`);
        }
      } else {
        throw new Error(`Azione non riconosciuta: ${JSON.stringify(a)}`);
      }
    }
  }

  stop() {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    for (const r of this.running) r.abort();
  }
}

function describeTrigger(info) {
  if (info.platform === 'state') return `${info.entity_id} → ${info.to_state?.state}`;
  if (info.platform === 'numeric_state') return `${info.entity_id} = ${info.to_state?.state}`;
  if (info.platform === 'time') return `ore ${info.at}`;
  if (info.platform === 'manual') return 'manualmente';
  return info.platform;
}

export class AutomationEngine {
  constructor(hub, { savedStates = {}, onEnabledChange } = {}) {
    this.hub = hub;
    this.automations = [];
    this.errors = [];
    this.savedStates = savedStates;
    this.onEnabledChange = onEnabledChange;
    this._onState = (e) => {
      for (const a of this.automations) a.onStateChanged(e);
    };
    this._last = new Date();
    hub.on('state_changed', this._onState);
    this._tick = setInterval(() => {
      const now = new Date();
      for (const a of this.automations) a.onTick(this._last, now);
      this._last = now;
    }, 1000);
    this._tick.unref?.();
    hub.registerService('automation', 'reload', () => this.reloadFn?.());
  }

  load(configs) {
    for (const a of this.automations) {
      a.stop();
      this.hub.entities.delete(`automation.${a.id}`);
      this.hub.states.delete(`automation.${a.id}`);
    }
    this.automations = [];
    this.errors = [];
    toArray(configs).forEach((cfg, i) => {
      try {
        const a = new Automation(this, cfg, i);
        if (this.automations.some((x) => x.id === a.id)) throw new Error(`id duplicato "${a.id}"`);
        if (this.savedStates[a.id] !== undefined) a.enabled = this.savedStates[a.id];
        this.automations.push(a);
        this.hub.registerEntity({ entity_id: `automation.${a.id}`, name: a.alias, owner: this, integration: 'automation' });
        this.publish(a);
      } catch (err) {
        this.errors.push(err.message);
        log.warn(`Automazione ignorata: ${err.message}`);
      }
    });
    // trigger "all'avvio"
    setTimeout(() => {
      for (const a of this.automations) {
        if (a.triggers.some((t) => t.platform === 'homeassistant' && (t.event || 'start') === 'start')) a.trigger({ platform: 'homeassistant' });
      }
    }, 5000);
    log.info(`${this.automations.length} automazioni caricate${this.errors.length ? `, ${this.errors.length} con errori` : ''}`);
  }

  publish(a) {
    this.hub.setState(`automation.${a.id}`, a.enabled ? 'on' : 'off', {
      friendly_name: a.alias,
      description: a.config.description || '',
      last_triggered: a.lastTriggered,
      running: a.running.size,
      mode: a.mode
    });
  }

  get(id) {
    return this.automations.find((a) => `automation.${a.id}` === id || a.id === id);
  }

  async handleService(entity_id, service) {
    const a = this.get(entity_id);
    if (!a) throw new ServiceError('Automazione non trovata', 404);
    if (service === 'trigger') {
      await a.trigger({ platform: 'manual' }, { skipConditions: true });
      return;
    }
    if (service === 'turn_on' || service === 'turn_off' || service === 'toggle') {
      a.enabled = service === 'toggle' ? !a.enabled : service === 'turn_on';
      if (!a.enabled) a.stop();
      this.savedStates[a.id] = a.enabled;
      this.onEnabledChange?.(this.savedStates);
      this.publish(a);
      return;
    }
    throw new ServiceError(`Servizio non supportato: ${service}`);
  }

  list() {
    return this.automations.map((a) => ({
      id: a.id,
      entity_id: `automation.${a.id}`,
      alias: a.alias,
      description: a.config.description || '',
      enabled: a.enabled,
      last_triggered: a.lastTriggered,
      running: a.running.size > 0,
      triggers: a.triggers.map(({ forSec, ...t }) => t),
      conditions: a.conditions,
      actions: a.actions
    }));
  }

  shutdown() {
    clearInterval(this._tick);
    this.hub.off('state_changed', this._onState);
    for (const a of this.automations) a.stop();
  }
}
