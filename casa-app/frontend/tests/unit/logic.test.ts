import { describe, expect, it } from 'vitest';
import type { EntityState } from '../../src/api/types';
import { deviceFor } from '../../src/App';
import { formatValue } from '../../src/lib/format';
import { isConfirmed, isExpired } from '../../src/lib/pending';

const base: EntityState = {
  nome: 'x', etichetta: 'X', unita: '°C', comandabile: true, configurata: true, dominio: 'input_number',
  min: 16, max: 24, passo: 0.5, valore: '20.5', stato: '20.5', attributi: {}, aggiornato: null,
};

describe('layout by width', () => {
  it('chooses tv, tablet, phone', () => {
    expect(deviceFor(1920)).toBe('tv');
    expect(deviceFor(1600)).toBe('tv');
    expect(deviceFor(1280)).toBe('tablet');
    expect(deviceFor(900)).toBe('tablet');
    expect(deviceFor(412)).toBe('telefono');
  });
});

describe('format', () => {
  it('formats units in Italian', () => {
    expect(formatValue(base)).toBe('20,5°');
    expect(formatValue({ ...base, unita: 'W', valore: '1530' })).toBe('1,5 kW');
    expect(formatValue({ ...base, unita: 'W', valore: '230' })).toBe('230 W');
    expect(formatValue({ ...base, valore: 'on', unita: null })).toBe('Acceso');
    expect(formatValue({ ...base, configurata: false })).toBe('da configurare');
    expect(formatValue({ ...base, valore: 'unavailable' })).toBe('non disponibile');
  });
});

describe('pending commands', () => {
  it('confirms numeric and toggle values', () => {
    const p = { target: 'x', requested: 21, previous: '20.5', since: Date.now() };
    expect(isConfirmed(p, { ...base, valore: '20.5' })).toBe(false);
    expect(isConfirmed(p, { ...base, valore: '21.0' })).toBe(true);
    const t = { target: 'x', requested: 'on', previous: 'off', since: Date.now() };
    expect(isConfirmed(t, { ...base, valore: 'off' })).toBe(false);
    expect(isConfirmed(t, { ...base, valore: 'on' })).toBe(true);
  });
  it('expires after 15 s', () => {
    const p = { target: 'x', requested: 21, previous: null, since: 0 };
    expect(isExpired(p, 10_000)).toBe(false);
    expect(isExpired(p, 16_000)).toBe(true);
  });
});
