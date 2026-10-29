// Test del bilancio utilities e ausiliari.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig, designPlant, plantPoint, defaultOperation, ISO } from '../js/engine/plant.js';
import { utilitiesBalance } from '../js/engine/utilities.js';

const point = (cond, Tamb = 15) => {
  const cfg = defaultConfig('Classe F (~300 MW)', '3PRH');
  cfg.steam.condenser.type = cond;
  const des = designPlant(cfg);
  const op = { ...defaultOperation(), ...ISO, Tamb, load: 1, nGTon: cfg.nGT, Tcw: cfg.steam.condenser.TcwDesign, ductT: 0, slidingHP: true };
  const r = plantPoint(cfg, des, op);
  return { cfg, des, r, op, U: utilitiesBalance(cfg, des, r) };
};

test('torre evaporativa: reintegro = evaporazione + spurgo + trascinamento', () => {
  const { U } = point('water');
  const c = U.cooling;
  assert.ok(Math.abs(c.makeup - (c.evap + c.blowdown + c.drift)) < 1e-9);
  // cicli di concentrazione rispettati
  assert.ok(Math.abs((c.evap + c.blowdown + c.drift) / (c.blowdown + c.drift) - c.coc) < 1e-6);
  // evaporazione dell'ordine di 1,5-2 m³/h per MW scaricato
  const spec = c.evapM3h / c.Qcond;
  assert.ok(spec > 0.9 && spec < 1.4, String(spec));
});

test('acqua demi: bilancio RO/EDI e reflui', () => {
  const { U } = point('water');
  const d = U.demi;
  assert.ok(Math.abs(d.roFeed - d.roPermeate - d.roReject) < 1e-12);
  assert.ok(Math.abs(d.roPermeate - d.demin - d.ediReject) < 1e-12);
  assert.ok(d.cycleMakeup > 0 && d.plantM3h >= d.demiM3h);
  assert.ok(Math.abs(U.ww.total - (U.ww.ctBlowdown + d.roReject + d.ediReject + U.ww.hrsgBD + U.ww.oily)) < 1e-12);
});

test('aerocondensatore: nessun reintegro di raffreddamento, acqua grezza ridotta', () => {
  const w = point('water').U, a = point('air').U;
  assert.equal(a.cooling.makeup, 0);
  assert.ok(a.rawWater < w.rawWater / 5);
});

test('stazione gas: preriscaldo per compensare Joule-Thomson e portata coerente', () => {
  const { U, r } = point('water');
  assert.ok(U.gas.preheatT > U.gas.Tout);
  assert.ok(Math.abs(U.gas.dTjt - 0.45 * (U.gas.pIn - U.gas.pOut)) < 1e-9);
  assert.ok(Math.abs(U.gas.mFuel - r.mFuelTot) < 1e-12);
  assert.ok(U.gas.Sm3h > 30000);
});

test('ciclo chiuso: portata coerente con il carico termico', () => {
  const { U, op } = point('water', 30);
  assert.ok(Math.abs(U.ccw.flow * 4.18 * U.ccw.dT - U.ccw.kW) < 1e-6);
  // ΔT minimo 6 °C tra mandata ciclo chiuso e acqua ausiliaria, salto termico 7 °C
  assert.ok(U.ccw.Tsupply >= op.Tcw + 6 - 1e-9);
  assert.equal(U.ccw.dT, 7);
});
