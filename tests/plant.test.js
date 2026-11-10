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

test('modelli TG di riferimento: prestazioni ISO da scheda OEM e taglie 60 Hz', () => {
  const fuel = fuelProperties(FUEL_PRESETS['Gas naturale tipico (rete IT)']);
  const cases = [
    ['Siemens SGT5-9000HL (593 MW)', 593, 0.43, 670],
    ['Mitsubishi M701JAC (574 MW)', 574, 0.434, 646],
    ['GE Vernova 9HA.02 (571 MW)', 571, 0.44, 640],
    ['Ansaldo GT36-S5 (563 MW)', 563, 0.43, 621],
  ];
  for (const [name, P, eta, T4] of cases) {
    const ref = gtDesign({ ...GT_PRESETS[name], fuel });
    assert.ok(Math.abs(ref.Piso - P) < 0.01 * P, `${name} P ${ref.Piso}`);
    assert.ok(Math.abs(ref.point.eta - eta) < 0.003, `${name} eta ${ref.point.eta}`);
    assert.ok(Math.abs(ref.T4iso - T4) < 3, `${name} T4 ${ref.T4iso}`);
  }
  // a 60 Hz la stessa famiglia ha taglia ridotta
  const p60 = gtDesign({ ...GT_PRESETS['Siemens SGT6-9000HL (440 MW)'], fuel }).Piso;
  assert.ok(Math.abs(p60 - 440) < 5 && GT_PRESETS['Siemens SGT6-9000HL (440 MW)'].freq === 60);
  // ciclo combinato 1+1 SGT5-9000HL: ~880 MW lordi (scheda OEM)
  const cfg = defaultConfig('Siemens SGT5-9000HL (593 MW)', '3PRH');
  const r = plantPoint(cfg, designPlant(cfg), defaultOperation());
  assert.ok(Math.abs(r.gross - 880) < 15, `lordo ${r.gross}`);
  assert.ok(r.etaGross > 0.625, `eta lordo ${r.etaGross}`);
});

test('dati di progetto fuori campo: riportati nei limiti con avviso, senza NaN', () => {
  const cfg = defaultConfig('Classe F (~300 MW)', '3PRH');
  Object.assign(cfg.gt, { mAirISO: 0, PR: -5, TIT: 1e9, etaC: NaN, coolFrac: 5 });
  cfg.steam.etaHP = NaN; cfg.steam.levels[0].p = 0.2; cfg.steam.levels[1].p = 500; cfg.steam.levels[2].p = -3;
  cfg.steam.pinch = [0, NaN, 99]; cfg.steam.condenser.dTcw = 0; cfg.nGT = 7; cfg.gasSupplyBar = 500;
  const des = designPlant(cfg);
  assert.ok(des.notes.length >= 6, 'attesi avvisi per i valori corretti');
  assert.ok(cfg.gt.mAirISO >= 50 && cfg.gt.PR >= 8 && cfg.gt.TIT <= 1750 && Number.isFinite(cfg.gt.etaC));
  assert.equal(cfg.nGT, 3); assert.equal(cfg.gasSupplyBar, 60);
  assert.ok(cfg.steam.levels[0].p >= 2 * cfg.steam.levels[1].p && cfg.steam.levels[1].p >= 2 * cfg.steam.levels[2].p && cfg.steam.levels[2].p >= 1.5);
  const r = plantPoint(cfg, des, { ...defaultOperation(), nGTon: 3 });
  for (const v of [r.net, r.eta, r.Pst, r.bt.Tstack, r.bt.pCond]) assert.ok(Number.isFinite(v));
  assert.ok(r.net > 0 && r.eta > 0.2 && r.eta < 0.66);
  // evaporatore Benson solo con 3 livelli + RH; le classi H a 1-2 livelli restano a corpo cilindrico
  const c2 = defaultConfig('Siemens SGT5-9000HL (593 MW)', '2P');
  assert.equal(c2.steam.hpEvap, 'drum');
  c2.steam.hpEvap = 'benson';
  designPlant(c2);
  assert.equal(c2.steam.hpEvap, 'drum');
});

test('compressore gas: pressione richiesta di progetto, potenza proporzionale alla portata', () => {
  const cfg = defaultConfig('Siemens SGT5-9000HL (593 MW)', '3PRH');
  cfg.gasSupplyBar = 45;
  const des = designPlant(cfg);
  const p = [1, 0.7, 0.4].map((load) => plantPoint(cfg, des, { ...defaultOperation(), load }));
  assert.ok(p.every((r) => r.aux.gasComp > 0), 'il compressore resta in servizio a carico parziale');
  for (const r of p) assert.ok(Math.abs(r.aux.gasComp / r.mFuelTot - p[0].aux.gasComp / p[0].mFuelTot) < 1e-9);
});

test('casi limite del ciclo a vapore: fumi freddi, post-combustione spinta, RH sotto il vapore in ingresso', () => {
  const finite = (r) => [r.net, r.eta, r.Pst, r.bt.Tstack, r.bt.pCond, ...r.bt.mLevels, ...r.bt.pAdm].every(Number.isFinite);
  // TIT molto bassa: fumi a ~300 °C, la pressione HP si adatta e tutti i livelli producono vapore
  const c1 = defaultConfig('Classe F (~300 MW)', '3PRH');
  c1.gt.TIT = 900;
  const d1 = designPlant(c1);
  assert.ok(d1.notes.some((t) => /fumi di scarico/.test(t)));
  assert.ok(c1.steam.levels[0].p < 60 && d1.point.mLevels.every((m) => m > 1));
  assert.equal(designPlant(c1).notes.length, 0, 'il secondo ricalcolo non deve riproporre correzioni');
  for (const load of [1, 0.5, 0.2]) assert.ok(finite(plantPoint(c1, d1, { ...defaultOperation(), load })));
  // post-combustione molto oltre il progetto: condensatore al limite, nessun NaN, scambio realizzabile
  const r2 = plantPoint(c1, d1, { ...defaultOperation(), ductT: 800 });
  assert.ok(finite(r2) && r2.bt.pCond <= 0.2501);
  for (const b of r2.bt.banks) assert.ok(b.TgOut >= b.TwIn - 1 && b.TgIn >= b.TwOut - 1, `incrocio ${b.name}`);
  assert.ok(r2.bt.Tstack > 55);
  // pressione HP entro il campo delle proprietà anche con livelli ravvicinati e post-combustione
  const c3 = defaultConfig('Siemens SGT5-8000H (450 MW)', '3PRH');
  Object.assign(c3.steam.levels[0], { p: 185 }); c3.steam.levels[1].p = 60; c3.steam.levels[2].p = 12;
  const d3 = designPlant(c3);
  const r3 = plantPoint(c3, d3, { ...defaultOperation(), ductT: 800 });
  assert.ok(finite(r3) && r3.bt.pDrum[0] <= 200 + 1e-9);
  // RH richiesto sotto la temperatura del risurriscaldato freddo: il banco cede comunque calore al vapore
  const c4 = defaultConfig('Classe F (~300 MW)', '3PRH');
  c4.steam.Trh = 300;
  const r4 = plantPoint(c4, designPlant(c4), defaultOperation());
  const rh = r4.bt.banks.find((b) => b.name === 'RH');
  assert.ok(rh && rh.Q > 0 && rh.TwOut > rh.TwIn);
  // carico bassissimo su classe H: surriscaldatore IP ed economizzatore HP interlacciati, nessun incrocio
  const c5 = defaultConfig('Siemens SGT5-9000HL (593 MW)', '3PRH');
  const r5 = plantPoint(c5, designPlant(c5), { ...defaultOperation(), load: 0.2, Tamb: -10 });
  for (const b of r5.bt.banks) assert.ok(b.TgOut >= b.TwIn - 0.5 && b.TgIn >= b.TwOut - 0.5, `incrocio ${b.name}`);
  assert.equal(r5.warnings.filter((w) => /non realizzabile/.test(w)).length, 0);
});

test('condizioni di esercizio fuori campo o non numeriche: risultato finito', () => {
  const cfg = defaultConfig();
  const des = designPlant(cfg);
  for (const op of [{ pamb: 0.001 }, { pamb: NaN }, { Tamb: 1e308 }, { Tamb: -1e308 }, { rh: 50 }, { Tcw: 'x' }, { ductT: 1e9 }, { load: 7 }]) {
    const r = plantPoint(cfg, des, { ...defaultOperation(), nGTon: cfg.nGT, ...op });
    assert.ok(Number.isFinite(r.net) && Number.isFinite(r.eta), `non finito con ${JSON.stringify(op)}`);
    assert.ok(r.eta < 0.68, `rendimento non plausibile con ${JSON.stringify(op)}`);
  }
});
