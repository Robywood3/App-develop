// Test della sequenza dinamica: blocco, riconoscimento, avviamento e rampa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlantSim } from '../js/engine/dynamics.js';
import { defaultConfig, defaultOperation, designPlant, plantPoint } from '../js/engine/plant.js';

test('blocco TG, riavviamento e ritorno in servizio', () => {
  const cfg = defaultConfig();
  const des = designPlant(cfg);
  const op = defaultOperation();
  const cache = new Map();
  const steady = (L) => {
    const k = L.toFixed(3);
    if (!cache.has(k)) cache.set(k, plantPoint(cfg, des, { ...op, load: L }));
    return cache.get(k);
  };
  const sim = new PlantSim();
  let out = sim.step(1, steady);
  assert.ok(out.ss.online);

  sim.trip();
  assert.equal(sim.state, 'BLOCCO');
  for (let i = 0; i < 20; i++) out = sim.step(60, steady);
  assert.equal(sim.speed, 0);
  assert.ok(out.lag.Pst < 1, 'la TV deve scaricarsi dopo il blocco');
  sim.reset();
  assert.equal(sim.state, 'FERMO');

  sim.start();
  let synced = false;
  for (let i = 0; i < 200 && sim.state !== 'IN_SERVIZIO'; i++) {
    out = sim.step(30, steady);
    if (sim.gtLoad > 0) synced = true;
    // durante il riscaldamento del GVR la TV non produce
    if (sim.phase === 'Riscaldamento GVR e linee vapore') assert.ok(!sim.stOnline);
  }
  assert.ok(synced);
  assert.equal(sim.state, 'IN_SERVIZIO');
  assert.equal(sim.gtLoad, 1);

  // rampa di discesa all'8 %/min: da 100 % a 60 % servono 5 minuti
  sim.setpoint = 0.6;
  sim.step(150, steady);
  assert.ok(Math.abs(sim.gtLoad - 0.8) < 1e-9);
  sim.step(150, steady);
  assert.ok(Math.abs(sim.gtLoad - 0.6) < 1e-9);
});

test('arresto durante la presa di carico: il carico non risale', () => {
  const sim = new PlantSim();
  const steady = (load) => ({ online: true, Pst: 100 * load, bt: { mSteamTot: 100 * load, Tstack: 90, pAdm: [100], Qcond: 200 * load } });
  sim.trip();
  for (let i = 0; i < 200; i++) sim.step(10, steady);
  sim.reset();
  sim.start();
  let guard = 0;
  while (sim.phase !== 'Presa di carico' && guard++ < 500) sim.step(5, steady);
  for (let i = 0; i < 6; i++) sim.step(5, steady);
  assert.equal(sim.phase, 'Presa di carico');
  const before = sim.gtLoad;
  assert.ok(before > 0 && before < 0.25);
  sim.stop();
  let peak = before;
  for (let i = 0; i < 400 && sim.state !== 'FERMO'; i++) { sim.step(5, steady); peak = Math.max(peak, sim.gtLoad); }
  assert.ok(peak <= before + 1e-12, `carico risalito da ${before} a ${peak}`);
  assert.equal(sim.state, 'FERMO');
});
