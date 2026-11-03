// Pending commands: a command is "in invio" until HA confirms it with a new state (RF-02).
import type { EntityState } from '../api/types';

export interface Pending {
  target: string;
  requested: unknown;
  previous: EntityState['valore'];
  since: number;
}

export const CONFIRM_TIMEOUT_MS = 15000;

/** True when the new state confirms the command. */
export function isConfirmed(p: Pending, state: EntityState): boolean {
  if (p.requested === undefined || p.requested === null) {
    return state.valore !== p.previous || state.stato !== null;
  }
  const want = p.requested;
  const got = state.valore;
  if (typeof want === 'number') return got !== null && Math.abs(Number(got) - want) < 0.01;
  return String(got) === String(want);
}

export function isExpired(p: Pending, now = Date.now()): boolean {
  return now - p.since > CONFIRM_TIMEOUT_MS;
}

/** Value expected after a toggle command. */
export function expectedForAction(action: string): string | undefined {
  if (action === 'turn_on') return 'on';
  if (action === 'turn_off') return 'off';
  return undefined;
}
