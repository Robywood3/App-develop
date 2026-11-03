import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Snapshot } from '../../src/api/types';
import { command, getAppState, handleLive } from '../../src/store';

const snapshot: Snapshot = {
  connesso_ha: true,
  aggiornato: null,
  entita: {
    'vmc.pt': { nome: 'vmc.pt', etichetta: 'VMC', unita: null, comandabile: true, configurata: true, dominio: 'switch', min: null, max: null, passo: null, valore: 'off', stato: 'off', attributi: {}, aggiornato: null },
  },
};

describe('store', () => {
  beforeEach(() => handleLive({ tipo: 'snapshot', dati: structuredClone(snapshot) }));

  it('keeps a command "in invio" until the live state confirms it', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 1, esito: 'ok' }), { status: 200 }));
    await command({ azione: 'turn_on', target: 'vmc.pt' });
    expect(getAppState().pending['vmc.pt']).toBeDefined();
    handleLive({ tipo: 'stato', nome: 'vmc.pt', dati: { ...snapshot.entita['vmc.pt'], valore: 'on', stato: 'on' } });
    expect(getAppState().pending['vmc.pt']).toBeUndefined();
    expect(getAppState().snapshot?.entita['vmc.pt'].valore).toBe('on');
  });

  it('clears the pending state and shows an error when the backend refuses', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'Servizio non autorizzato' }), { status: 403 }));
    await command({ azione: 'turn_on', target: 'vmc.pt' });
    expect(getAppState().pending['vmc.pt']).toBeUndefined();
    expect(getAppState().toasts.at(-1)?.text).toBe('Servizio non autorizzato');
  });

  it('tracks the HA connection', () => {
    handleLive({ tipo: 'connessione', connesso_ha: false });
    expect(getAppState().snapshot?.connesso_ha).toBe(false);
  });
});
