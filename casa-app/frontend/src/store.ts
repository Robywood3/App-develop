// App state: entities from /api/state + live updates from WS /api/live, offline cache, pending commands.
import { useSyncExternalStore } from 'react';
import { sendCommand, getState, ApiError } from './api/client';
import type { Command, EntityState, LiveMessage, Snapshot, User, VideoEvent } from './api/types';
import { expectedForAction, isConfirmed, isExpired, type Pending } from './lib/pending';

const CACHE_KEY = 'casa.snapshot';

export interface AppState {
  user: User | null;
  snapshot: Snapshot | null;
  online: boolean; // live channel to the backend open
  lastData: string | null; // time of the last data received
  pending: Record<string, Pending>;
  unconfirmed: Record<string, string>; // target -> message
  toasts: { id: number; text: string; kind: 'err' | 'ok' }[];
  lastVideoEvent: VideoEvent | null;
}

let state: AppState = {
  user: null,
  snapshot: loadCache(),
  online: false,
  lastData: null,
  pending: {},
  unconfirmed: {},
  toasts: [],
  lastVideoEvent: null,
};
state.lastData = state.snapshot?.aggiornato ?? null;

const listeners = new Set<() => void>();
function set(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
export function getAppState() {
  return state;
}
export function useApp<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => selector(state),
  );
}

function loadCache(): Snapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    return null;
  }
}
let cacheTimer: ReturnType<typeof setTimeout> | undefined;
function saveCache() {
  clearTimeout(cacheTimer);
  cacheTimer = setTimeout(() => {
    try {
      if (state.snapshot) localStorage.setItem(CACHE_KEY, JSON.stringify(state.snapshot));
    } catch {
      /* storage full or blocked: the app still works */
    }
  }, 1000);
}

export function setUser(user: User | null) {
  set({ user });
}

export function toast(text: string, kind: 'err' | 'ok' = 'err') {
  const id = Date.now() + Math.random();
  set({ toasts: [...state.toasts, { id, text, kind }] });
  setTimeout(() => set({ toasts: state.toasts.filter((t) => t.id !== id) }), 5000);
}

// ------------------------------------------------------------ live channel

function applyEntity(nome: string, e: EntityState) {
  if (!state.snapshot) return;
  const entita = { ...state.snapshot.entita, [nome]: e };
  const pending = { ...state.pending };
  const unconfirmed = { ...state.unconfirmed };
  const p = pending[nome];
  if (p && isConfirmed(p, e)) {
    delete pending[nome];
    delete unconfirmed[nome];
  }
  set({ snapshot: { ...state.snapshot, entita, aggiornato: e.aggiornato ?? state.snapshot.aggiornato }, pending, unconfirmed, lastData: new Date().toISOString() });
  saveCache();
}

export function handleLive(msg: LiveMessage) {
  switch (msg.tipo) {
    case 'snapshot':
      set({ snapshot: msg.dati, lastData: new Date().toISOString() });
      saveCache();
      break;
    case 'stato':
      applyEntity(msg.nome, msg.dati);
      break;
    case 'connessione':
      if (state.snapshot) set({ snapshot: { ...state.snapshot, connesso_ha: msg.connesso_ha } });
      break;
    case 'evento_video':
      set({ lastVideoEvent: msg.dati });
      break;
  }
}

let ws: WebSocket | null = null;
let retry = 1000;
let stopped = true;
let pingTimer: ReturnType<typeof setInterval> | undefined;

export function connectLive() {
  stopped = false;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/api/live`);
  ws.onopen = () => {
    retry = 1000;
    set({ online: true });
    pingTimer = setInterval(() => ws?.readyState === 1 && ws.send(JSON.stringify({ tipo: 'ping' })), 25000);
  };
  ws.onmessage = (ev) => handleLive(JSON.parse(ev.data) as LiveMessage);
  ws.onclose = (ev) => {
    clearInterval(pingTimer);
    set({ online: false });
    ws = null;
    if (stopped) return;
    if (ev.code === 4401) {
      setUser(null);
      return;
    }
    setTimeout(() => !stopped && connectLive(), retry);
    retry = Math.min(retry * 2, 30000);
  };
}

export function disconnectLive() {
  stopped = true;
  ws?.close();
}

export async function refreshState() {
  const snapshot = await getState();
  set({ snapshot, lastData: new Date().toISOString() });
  saveCache();
}

// ------------------------------------------------------------ commands

export async function command(c: Command) {
  const current = state.snapshot?.entita[c.target];
  const requested = c.valore !== undefined ? c.valore : expectedForAction(c.azione);
  const p: Pending = { target: c.target, requested, previous: current?.valore ?? null, since: Date.now() };
  const unconfirmed = { ...state.unconfirmed };
  delete unconfirmed[c.target];
  set({ pending: { ...state.pending, [c.target]: p }, unconfirmed });
  try {
    await sendCommand(c);
  } catch (err) {
    const pending = { ...state.pending };
    delete pending[c.target];
    set({ pending });
    toast(err instanceof ApiError ? err.message : 'Comando non inviato');
    return;
  }
  setTimeout(() => {
    const still = state.pending[c.target];
    if (still === p && isExpired(still)) {
      const pending = { ...state.pending };
      delete pending[c.target];
      set({ pending, unconfirmed: { ...state.unconfirmed, [c.target]: 'Nessuna conferma da Home Assistant' } });
    }
  }, 15100);
}

export function useEntity(name: string): EntityState | undefined {
  return useApp((s) => s.snapshot?.entita[name]);
}
export function usePending(name: string): boolean {
  return useApp((s) => Boolean(s.pending[name]));
}
