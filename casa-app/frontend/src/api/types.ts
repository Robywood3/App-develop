export interface EntityState {
  nome: string;
  etichetta: string;
  unita: string | null;
  comandabile: boolean;
  configurata: boolean;
  dominio: string | null;
  min: number | null;
  max: number | null;
  passo: number | null;
  valore: string | number | boolean | null;
  stato: string | null;
  attributi: Record<string, unknown>;
  aggiornato: string | null;
}

export interface Snapshot {
  connesso_ha: boolean;
  aggiornato: string | null;
  entita: Record<string, EntityState>;
}

export interface User {
  id: number;
  nome: string;
  ruolo: 'admin' | 'utente' | 'tv' | 'lettura';
}

export type Action = 'turn_on' | 'turn_off' | 'set' | 'set_hvac_mode' | 'run';

export interface Command {
  azione: Action;
  target: string;
  valore?: unknown;
}

export interface Camera {
  nome: string;
  immagine: string;
  diretta: string;
}

export interface VideoEvent {
  id: string;
  ts: string;
  fine: string | null;
  telecamera: string;
  oggetto: string;
  clip: boolean;
  punteggio: number | null;
}

export type Point = [string, number | null, number | null, number | null];

export interface HistoryResponse {
  risoluzione: 'grezzi' | '5min' | '1h' | '1g';
  da: string;
  a: string;
  serie: Record<string, Point[]>;
}

export type LiveMessage =
  | { tipo: 'snapshot'; dati: Snapshot }
  | { tipo: 'stato'; nome: string; dati: EntityState }
  | { tipo: 'connessione'; connesso_ha: boolean }
  | { tipo: 'evento_video'; dati: VideoEvent }
  | { tipo: 'pong' };
