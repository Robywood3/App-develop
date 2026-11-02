/*
 * Client HTTP comune a tutte le integrazioni (fetch nativo di Node >= 18):
 * timeout, JSON/form, Basic e Digest auth (Shelly Gen2+ usa Digest SHA-256).
 */
import { createHash, randomBytes } from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message, body) {
    super(message || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

function buildUrl(url, query) {
  if (!query) return url;
  const u = new URL(url);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  }
  return u.toString();
}

function parseDigestChallenge(header) {
  const out = {};
  const re = /(\w+)=(?:"([^"]*)"|([^,\s]*))/g;
  let m;
  while ((m = re.exec(header))) out[m[1].toLowerCase()] = m[2] ?? m[3];
  return out;
}

export function digestAuthorization({ method, url, username, password, challenge, nc = 1 }) {
  const c = parseDigestChallenge(challenge);
  const algo = (c.algorithm || 'MD5').toUpperCase().startsWith('SHA-256') ? 'sha256' : 'md5';
  const H = (s) => createHash(algo).update(s).digest('hex');
  const u = new URL(url);
  const uri = u.pathname + u.search;
  const cnonce = randomBytes(8).toString('hex');
  const ncHex = nc.toString(16).padStart(8, '0');
  const ha1 = H(`${username}:${c.realm}:${password}`);
  const ha2 = H(`${method}:${uri}`);
  const qop = c.qop ? c.qop.split(',')[0].trim() : null;
  const response = qop ? H(`${ha1}:${c.nonce}:${ncHex}:${cnonce}:${qop}:${ha2}`) : H(`${ha1}:${c.nonce}:${ha2}`);
  let h = `Digest username="${username}", realm="${c.realm}", nonce="${c.nonce}", uri="${uri}", response="${response}"`;
  if (c.algorithm) h += `, algorithm=${c.algorithm}`;
  if (qop) h += `, qop=${qop}, nc=${ncHex}, cnonce="${cnonce}"`;
  if (c.opaque) h += `, opaque="${c.opaque}"`;
  return h;
}

/**
 * request(url, { method, query, json, form, headers, timeout, auth: {username, password}, raw })
 * Ritorna il corpo già decodificato (JSON se possibile, altrimenti testo).
 */
export async function request(url, opts = {}) {
  const { method = 'GET', query, json, form, timeout = 15000, auth, raw = false } = opts;
  const headers = { Accept: 'application/json, text/plain, */*', ...(opts.headers || {}) };
  let body = opts.body;
  if (json !== undefined) {
    body = JSON.stringify(json);
    headers['Content-Type'] = 'application/json';
  } else if (form !== undefined) {
    body = new URLSearchParams(Object.entries(form).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)])).toString();
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }
  const fullUrl = buildUrl(url, query);
  if (auth && auth.username && !auth.digest) {
    headers.Authorization = 'Basic ' + Buffer.from(`${auth.username}:${auth.password || ''}`).toString('base64');
  }

  const doFetch = (h) => fetch(fullUrl, { method, headers: h, body, signal: AbortSignal.timeout(timeout) });

  let res;
  try {
    res = await doFetch(headers);
    if (res.status === 401 && auth && auth.password) {
      const challenge = res.headers.get('www-authenticate') || '';
      if (/^digest/i.test(challenge)) {
        await res.arrayBuffer().catch(() => {});
        res = await doFetch({
          ...headers,
          Authorization: digestAuthorization({ method, url: fullUrl, username: auth.username || 'admin', password: auth.password, challenge })
        });
      }
    }
  } catch (err) {
    const reason = err.name === 'TimeoutError' ? 'timeout' : (err.cause?.code || err.message);
    throw new HttpError(0, `Connessione fallita a ${new URL(fullUrl).host}: ${reason}`);
  }

  if (raw) return res;
  const text = await res.text();
  let data = text;
  if (text && /json/i.test(res.headers.get('content-type') || '') || /^\s*[[{]/.test(text)) {
    try { data = JSON.parse(text); } catch { /* resta testo */ }
  }
  if (!res.ok) {
    const detail = typeof data === 'object' && data
      ? (data.error_description || data.error?.message || data.message || (typeof data.error === 'string' ? data.error : '') || '')
      : String(text).slice(0, 200);
    throw new HttpError(res.status, `HTTP ${res.status}${detail ? `: ${detail}` : ''}`, data);
  }
  return data;
}
