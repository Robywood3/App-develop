import type { EntityState } from '../api/types';

const nf1 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });

export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function formatValue(e: EntityState | undefined): string {
  if (!e || !e.configurata) return 'da configurare';
  const v = e.valore;
  if (v === null || v === undefined || v === 'unavailable' || v === 'unknown') return 'non disponibile';
  const n = num(v);
  if (n === null) return ({ on: 'Acceso', off: 'Spento', heat: 'Riscaldamento', heat_pump: 'Pompa di calore' } as Record<string, string>)[String(v)] ?? String(v);
  if (e.unita === 'W') return Math.abs(n) >= 1000 ? `${nf1.format(n / 1000)} kW` : `${nf0.format(n)} W`;
  if (e.unita === '°C') return `${nf1.format(n)}°`;
  return `${nf1.format(n)}${e.unita ? ` ${e.unita}` : ''}`;
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '–';
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function isOn(e: EntityState | undefined): boolean {
  return e?.valore === 'on';
}

export const RANGES = [
  { key: '24h', label: '24 ore', ms: 24 * 3600e3 },
  { key: '7g', label: '7 giorni', ms: 7 * 24 * 3600e3 },
  { key: '30g', label: '30 giorni', ms: 30 * 24 * 3600e3 },
  { key: '1a', label: '1 anno', ms: 365 * 24 * 3600e3 },
] as const;
