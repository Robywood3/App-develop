/*
 * Gestione token OAuth2 (refresh automatico + salvataggio dei refresh token "rotanti":
 * tado°, Netatmo e Tesla emettono un nuovo refresh token a ogni rinnovo e invalidano il precedente,
 * quindi va salvato subito su disco).
 */
import { request, HttpError } from './http.js';

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.auth = true;
  }
}

export class TokenManager {
  /**
   * @param {object} o
   * @param {string} o.tokenUrl
   * @param {string} o.clientId
   * @param {string} [o.clientSecret]
   * @param {object} o.data        oggetto persistente (entry.data) con access_token/refresh_token/expires_at
   * @param {Function} o.save      salva entry.data
   * @param {object} [o.extra]     parametri aggiuntivi per le richieste al token endpoint
   */
  constructor({ tokenUrl, clientId, clientSecret, data, save, extra = {} }) {
    Object.assign(this, { tokenUrl, clientId, clientSecret, data, save, extra });
    this._pending = null;
  }

  get hasRefreshToken() {
    return Boolean(this.data.refresh_token);
  }

  async getAccessToken() {
    const now = Date.now() / 1000;
    if (this.data.access_token && (this.data.expires_at || 0) - 60 > now) return this.data.access_token;
    return this.refresh();
  }

  invalidate() {
    this.data.expires_at = 0;
  }

  async refresh() {
    if (this._pending) return this._pending;
    if (!this.data.refresh_token) throw new AuthError('Accesso non configurato: esegui il login dall\'interfaccia');
    this._pending = this._grant({ grant_type: 'refresh_token', refresh_token: this.data.refresh_token })
      .finally(() => { this._pending = null; });
    return this._pending;
  }

  async exchangeCode(code, redirectUri, codeVerifier) {
    return this._grant({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: codeVerifier });
  }

  async _grant(params) {
    let res;
    try {
      res = await request(this.tokenUrl, {
        method: 'POST',
        form: { client_id: this.clientId, client_secret: this.clientSecret || undefined, ...this.extra, ...params }
      });
    } catch (err) {
      if (err instanceof HttpError && err.status >= 400 && err.status < 500) {
        throw new AuthError(`Login scaduto o revocato (${err.message}): ripeti l'accesso`);
      }
      throw err;
    }
    this.storeTokens(res);
    await this.save();
    return this.data.access_token;
  }

  storeTokens(res) {
    if (!res || !res.access_token) throw new AuthError('Risposta token non valida');
    this.data.access_token = res.access_token;
    if (res.refresh_token) this.data.refresh_token = res.refresh_token;
    this.data.expires_at = Math.floor(Date.now() / 1000) + Number(res.expires_in || 3600);
  }
}
