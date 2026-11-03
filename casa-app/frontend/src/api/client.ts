import type { Command, HistoryResponse, Snapshot, User } from './types';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler = () => {};
export function setUnauthorizedHandler(fn: UnauthorizedHandler) {
  onUnauthorized = fn;
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Casa App non raggiungibile');
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/api/login')) onUnauthorized();
    const detail = (data as { detail?: unknown })?.detail;
    throw new ApiError(res.status, typeof detail === 'string' ? detail : `Errore ${res.status}`);
  }
  return data as T;
}

export const login = (nome: string, password: string, dispositivo: 'casa' | 'mobile') =>
  api<{ utente: User }>('POST', '/api/login', { nome, password, dispositivo });
export const logout = () => api('POST', '/api/logout');
export const me = () => api<{ utente: User }>('GET', '/api/me');
export const getState = () => api<Snapshot>('GET', '/api/state');
export const sendCommand = (c: Command) => api<{ id: number; esito: string }>('POST', '/api/command', c);
export const getHistory = (names: string[], from: Date, to: Date) =>
  api<HistoryResponse>(
    'GET',
    `/api/history?entita=${encodeURIComponent(names.join(','))}&da=${from.toISOString()}&a=${to.toISOString()}`,
  );
