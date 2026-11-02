/*
 * Autenticazione: una password per la casa (hash scrypt), sessioni con cookie HttpOnly
 * e token a lunga durata per script/app esterne (header Authorization: Bearer ...).
 */
import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';

const COOKIE = 'cc_session';
const SESSION_DAYS = 90;

const sha = (s) => createHash('sha256').update(s).digest('hex');

export class Auth {
  constructor(store) {
    this.store = store; // JsonStore con { password, sessions, tokens }
    this.failures = new Map();
    if (process.env.CASA_CLIMA_PASSWORD && !this.data.password) {
      this.setPassword(process.env.CASA_CLIMA_PASSWORD);
    }
  }

  get data() {
    return this.store.data;
  }

  get configured() {
    return Boolean(this.data.password);
  }

  setPassword(password) {
    if (!password || String(password).length < 6) throw Object.assign(new Error('La password deve avere almeno 6 caratteri'), { status: 400 });
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(String(password), salt, 64).toString('hex');
    this.data.password = { salt, hash };
    this.data.sessions = {};
    this.store.saveSync();
  }

  checkPassword(password) {
    const p = this.data.password;
    if (!p) return false;
    const hash = scryptSync(String(password || ''), p.salt, 64);
    return timingSafeEqual(hash, Buffer.from(p.hash, 'hex'));
  }

  /** Limita i tentativi: dopo 5 errori, attesa crescente per IP. */
  throttle(ip) {
    const f = this.failures.get(ip);
    if (f && f.count >= 5 && Date.now() < f.until) {
      throw Object.assign(new Error(`Troppi tentativi: riprova tra ${Math.ceil((f.until - Date.now()) / 1000)} secondi`), { status: 429 });
    }
  }

  fail(ip) {
    const f = this.failures.get(ip) || { count: 0, until: 0 };
    f.count++;
    if (f.count >= 5) f.until = Date.now() + Math.min(2 ** (f.count - 5) * 30_000, 15 * 60_000);
    this.failures.set(ip, f);
  }

  login(password, ip, userAgent) {
    this.throttle(ip);
    if (!this.checkPassword(password)) {
      this.fail(ip);
      throw Object.assign(new Error('Password errata'), { status: 401 });
    }
    this.failures.delete(ip);
    return this.createSession(userAgent);
  }

  createSession(userAgent = '') {
    const token = randomBytes(32).toString('base64url');
    this.data.sessions = this.data.sessions || {};
    this.data.sessions[sha(token)] = { created: Date.now(), last: Date.now(), ua: String(userAgent).slice(0, 120) };
    this.prune();
    this.store.saveLater(500);
    return token;
  }

  prune() {
    const cutoff = Date.now() - SESSION_DAYS * 86400_000;
    for (const [k, s] of Object.entries(this.data.sessions || {})) if (s.last < cutoff) delete this.data.sessions[k];
  }

  logout(token) {
    if (token) delete this.data.sessions?.[sha(token)];
    this.store.saveLater(500);
  }

  createApiToken(name) {
    const token = `cc_${randomBytes(30).toString('base64url')}`;
    this.data.tokens = this.data.tokens || {};
    this.data.tokens[sha(token)] = { name: String(name || 'Token').slice(0, 60), created: Date.now() };
    this.store.saveSync();
    return token;
  }

  listApiTokens() {
    return Object.entries(this.data.tokens || {}).map(([id, t]) => ({ id: id.slice(0, 12), name: t.name, created: t.created, last: t.last || null }));
  }

  deleteApiToken(prefix) {
    for (const k of Object.keys(this.data.tokens || {})) if (k.startsWith(prefix)) delete this.data.tokens[k];
    this.store.saveSync();
  }

  static cookieToken(req) {
    const header = req.headers.cookie || '';
    for (const part of header.split(';')) {
      const [k, ...v] = part.trim().split('=');
      if (k === COOKIE) return decodeURIComponent(v.join('='));
    }
    return null;
  }

  /** Ritorna l'identità della richiesta oppure null. */
  verify(req) {
    const bearer = (req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1];
    if (bearer) {
      const t = this.data.tokens?.[sha(bearer)];
      if (t) { t.last = Date.now(); return { kind: 'token', name: t.name }; }
      return null;
    }
    const token = Auth.cookieToken(req);
    if (!token) return null;
    const s = this.data.sessions?.[sha(token)];
    if (!s) return null;
    if (Date.now() - s.last > 3600_000) { s.last = Date.now(); this.store.saveLater(5000); }
    return { kind: 'session', token };
  }

  cookie(token, secure) {
    const parts = [`${COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${token ? SESSION_DAYS * 86400 : 0}`];
    if (secure) parts.push('Secure');
    return parts.join('; ');
  }
}
