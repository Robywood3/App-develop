/*
 * Recorder: storico compatto dei valori numerici (come il componente "recorder" di HA,
 * ma su file JSON invece che SQLite). Per i climatizzatori registra temperatura attuale,
 * setpoint e se sta scaldando/raffrescando.
 */
import { JsonStore } from './store.js';
import { isNumeric } from './util.js';

const MIN_GAP = 60_000; // al massimo un punto al minuto per entità

export class Recorder {
  constructor(hub, file, { days = 7, store } = {}) {
    this.hub = hub;
    this.days = days;
    this.store = store || new JsonStore(file, { series: {} });
    if (!store) this.store.load();
    this.series = this.store.data.series;
    this._onChange = (e) => this.record(e);
  }

  start() {
    this.hub.on('state_changed', this._onChange);
    this._saveTimer = setInterval(() => this.store.save().catch(() => {}), 5 * 60_000);
    this._pruneTimer = setInterval(() => this.prune(), 3600_000);
    this.prune();
  }

  async stop() {
    this.hub.off('state_changed', this._onChange);
    clearInterval(this._saveTimer);
    clearInterval(this._pruneTimer);
    await this.store.save();
  }

  static valueOf(st) {
    if (!st) return null;
    const domain = st.entity_id.split('.')[0];
    if (domain === 'climate') {
      const a = st.attributes;
      if (!isNumeric(a.current_temperature) && !isNumeric(a.temperature)) return null;
      const active = ['heating', 'cooling', 'drying'].includes(a.hvac_action) ? 1 : 0;
      return [isNumeric(a.current_temperature) ? Number(a.current_temperature) : null, st.state === 'off' ? null : (isNumeric(a.temperature) ? Number(a.temperature) : null), active];
    }
    if (['switch', 'light', 'binary_sensor', 'lock', 'automation'].includes(domain)) {
      if (st.state === 'on' || st.state === 'locked') return 1;
      if (st.state === 'off' || st.state === 'unlocked') return 0;
      return null;
    }
    if (isNumeric(st.state)) return Number(st.state);
    return null;
  }

  record({ entity_id, new_state }) {
    if (!new_state) return;
    const v = Recorder.valueOf(new_state);
    if (v === null) return;
    const now = Date.now();
    const arr = this.series[entity_id] || (this.series[entity_id] = []);
    const last = arr[arr.length - 1];
    const same = last && JSON.stringify(last.slice(1)) === JSON.stringify(Array.isArray(v) ? v : [v]);
    if (same) return;
    const point = Array.isArray(v) ? [now, ...v] : [now, v];
    // binari: ogni cambio conta; numerici: al massimo uno al minuto (sovrascrivo l'ultimo)
    const binary = !Array.isArray(v) && ['switch', 'light', 'binary_sensor', 'lock', 'automation'].includes(entity_id.split('.')[0]);
    if (!binary && last && now - last[0] < MIN_GAP && arr.length > 1 && now - arr[arr.length - 2][0] < MIN_GAP * 2) {
      arr[arr.length - 1] = point;
    } else {
      arr.push(point);
    }
  }

  prune() {
    const cutoff = Date.now() - this.days * 86400_000;
    for (const [id, arr] of Object.entries(this.series)) {
      const i = arr.findIndex((p) => p[0] >= cutoff);
      if (i === -1) delete this.series[id];
      else if (i > 0) arr.splice(0, i - 1); // tengo un punto prima dell'inizio per disegnare la linea
    }
  }

  history(ids, hours = 24) {
    const from = Date.now() - hours * 3600_000;
    const out = {};
    for (const id of ids) {
      const arr = this.series[id] || [];
      let i = arr.findIndex((p) => p[0] >= from);
      if (i === -1) i = arr.length;
      out[id] = arr.slice(Math.max(0, i - 1));
    }
    return out;
  }
}
