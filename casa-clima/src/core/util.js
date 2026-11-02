import { randomBytes } from 'node:crypto';

/** "Soggiorno Grande" -> "soggiorno_grande" (senza accenti, solo [a-z0-9_]). */
export function slugify(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'x';
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function randomId(bytes = 8) {
  return randomBytes(bytes).toString('hex');
}

/**
 * Durate in stile Home Assistant -> secondi.
 * Accetta: 90, "90", "00:01:30", "1:30", { hours, minutes, seconds }.
 */
export function parseDuration(value) {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'object') {
    return (Number(value.days) || 0) * 86400 + (Number(value.hours) || 0) * 3600 +
      (Number(value.minutes) || 0) * 60 + (Number(value.seconds) || 0) + (Number(value.milliseconds) || 0) / 1000;
  }
  const s = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const parts = s.split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n))) throw new Error(`Durata non valida: ${value}`);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60;
  throw new Error(`Durata non valida: ${value}`);
}

export function toArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

export function round(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const f = 10 ** digits;
  return Math.round(Number(value) * f) / f;
}

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export function isNumeric(v) {
  return v !== null && v !== '' && v !== undefined && typeof v !== 'boolean' && !Number.isNaN(Number(v));
}

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const currentLevel = LEVELS[process.env.LOG_LEVEL || 'info'] ?? 20;

export function createLogger(name) {
  const out = (level, args) => {
    if (LEVELS[level] < currentLevel) return;
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    fn(`${ts} ${level.toUpperCase().padEnd(5)} [${name}]`, ...args);
  };
  return {
    debug: (...a) => out('debug', a),
    info: (...a) => out('info', a),
    warn: (...a) => out('warn', a),
    error: (...a) => out('error', a),
    child: (sub) => createLogger(`${name}.${sub}`)
  };
}

/** Converte "HH:MM" o "HH:MM:SS" in secondi dalla mezzanotte. */
export function timeOfDay(str) {
  const [h, m = 0, s = 0] = String(str).split(':').map(Number);
  if ([h, m, s].some((n) => Number.isNaN(n))) throw new Error(`Orario non valido: ${str}`);
  return h * 3600 + m * 60 + s;
}

export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
