// Test di coerenza fisica del modello d'impianto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gasH, gasCp, humidAir, fuelProperties, FUEL_PRESETS } from '../js/engine/gas.js';
import { GT_PRESETS, gtDesign, gtAtLoad } from '../js/engine/gt.js';
import { defaultConfig, defaultOperation, designPlant, plantPoint } from '../js/engine/plant.js';

const ISO_AMB = { T: 15, p: 1.01325, rh: 0.6 };

test('proprietà dell\'aria', () => {
  const air = humidAir(15, 1.01325, 0.6);
  assert.ok(Math.abs(gasCp(air, 15) - 1.01) < 0.01);
  assert.ok(Math.abs(gasH(air, 25)) < 1e-9);
});

test('gas naturale: PCI e CO2 specifica', () => {
  const f = fuelProperties(FUEL_PRESETS['Metano puro']);
  assert.ok(Math.abs(f.lhv - 50010) < 100);
  assert.ok(Math.abs(f.co2PerKg - 2.743) < 0.01);
});

test('TG: punto ISO e andamento con carico e temperatura', () => {
  const fuel = fuelProperties(FUEL_PRESETS['Gas naturale tipico (rete IT)']);
  const d = { ...GT_PRESETS['Classe F (~300 MW)'], fuel };
  const ref = gtDesign(d);
  assert.ok(ref.point.eta > 0.38 && ref.point.eta < 0.42, `eta ${ref.point.eta}`);
  assert.ok(ref.point.T4 > 580 && ref.point.T4 < 640);
  const p80 = gtAtLoad(d, ref, ISO_AMB, 0.8);
  assert.ok(Math.abs(p80.P / ref.Piso - 0.8) < 0.005);
  assert.equal(p80.mode, 'Regolazione IGV');
  const hot = gtAtLoad(d, ref, { ...ISO_AMB, T: 35 }, 1);
  assert.ok(hot.P < ref.Piso, 'la potenza deve calare con aria calda');
});

for (const type of ['3PRH', '2P', '1P']) {
  test(`impianto ${type}: bilancio energetico e prestazioni plausibili`, () => {
    const cfg = defaultConfig('Classe F (~300 MW)', type);
    const des = designPlant(cfg);
    const op = defaultOperation();
    const r = plantPoint(cfg, des, op);
    // bilancio di primo principio: il residuo (perdite meccaniche, elettriche e
    // di irraggiamento) deve essere positivo e piccolo
    assert.ok(r.otherLoss > 0 && r.otherLoss < 0.03 * r.Qfuel, `altre perdite ${r.otherLoss}`);
    assert.ok(r.eta > 0.52 && r.eta < 0.62, `eta ${r.eta}`);
    assert.ok(r.bt.Tstack >= cfg.steam.TstackMin - 0.01);
    // l'efficienza cala a carico parziale
    const r60 = plantPoint(cfg, des, { ...op, load: 0.6 });
    assert.ok(r60.eta < r.eta);
    assert.ok(r60.net < r.net);
  });
}

test('GVR: nessun incrocio di temperature e pinch rispettati', () => {
  const cfg = defaultConfig('Classe F (~300 MW)', '3PRH');
  const des = designPlant(cfg);
  for (const op of [{}, { load: 0.5 }, { ductT: 750 }, { Tamb: 35, Tcw: 26 }]) {
    const r = plantPoint(cfg, des, { ...defaultOperation(), ...op });
    for (const b of r.bt.banks) {
      assert.ok(b.TgOut >= b.TwIn - 1e-6, `${b.name}: uscita fumi sotto ingresso acqua`);
      assert.ok(b.TgIn >= b.TwOut - 1e-6, `${b.name}: ingresso fumi sotto uscita acqua`);
    }
  }
});

test('configurazione 2+1 con una sola TG in servizio', () => {
  const cfg = defaultConfig('Classe F (~300 MW)', '3PRH');
  cfg.nGT = 2;
  const des = designPlant(cfg);
  const both = plantPoint(cfg, des, { ...defaultOperation(), nGTon: 2 });
  const one = plantPoint(cfg, des, { ...defaultOperation(), nGTon: 1 });
  assert.ok(Math.abs(both.Pgt - 2 * one.Pgt) < 1e-6);
  assert.ok(one.bt.pAdm[0] < both.bt.pAdm[0], 'pressione scorrevole più bassa con una TG');
  assert.ok(one.Pst > 0.4 * both.Pst && one.Pst < 0.55 * both.Pst);
});
