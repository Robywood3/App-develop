// Test del motore e degli elaborati: node tests/engine.test.js
'use strict';
const assert = require('assert');
const D = require('../src/data.js'), E = require('../src/engine.js'), Dc = require('../src/docs.js');
let n = 0;
function t(name, fn) { fn(); n++; console.log('ok  ' + name); }
const run = (id, extra) => { const u = JSON.parse(JSON.stringify(D.cases.cases[id].inputs)); Object.keys(extra || {}).forEach((k) => E.setPath(u, k, extra[k])); return E.solve(u); };
const chk = (r, name) => r.checks.find((c) => c.name.startsWith(name));

t('i casi di riferimento si risolvono e il bilancio del ferro chiude entro lo 0–5 %', () => {
  D.cases.order.forEach((id) => {
    const r = run(id), L = r.ledgers.Fe, res = L.residual / L.t_in;
    assert.ok(res >= 0 && res <= 0.05, id + ' Fe ' + res);
    Object.keys(r.ledgers).forEach((b) => assert.ok(isFinite(r.ledgers[b].residual), id + ' ' + b));
    assert.ok(r.indicators.product_t > 0.8 * r.indicators.LS_t && r.indicators.product_t < r.indicators.LS_t, id + ' resa');
  });
});
t('A1 BF-BOF: indicatori nel campo della DF §12.1', () => {
  const r = run('A1');
  ['Carica ferrosa', 'Emissioni dirette', 'Resa acciaio liquido', 'Capacità'].forEach((k) => assert.strictEqual(chk(r, k).ok, true, k));
  assert.ok(r.indicators.ownGen_MW > 150, 'autoproduzione dai gas di recupero');
});
t('EAF a rottame (A3, B1): carica, energia elettrica e CO₂ con la rete nel campo', () => {
  ['A3', 'B1'].forEach((id) => {
    const r = run(id);
    ['Carica metallica', 'Energia elettrica all', 'Emissioni di CO₂ dirette e indirette'].forEach((k) => assert.strictEqual(chk(r, k).ok, true, id + ' ' + k));
  });
});
t('A2 DRI-EAF: energia elettrica all\'acciaieria nel campo 550–700 kWh/t', () => assert.strictEqual(chk(run('A2'), 'Energia elettrica all').ok, true));
t('la capacità scala i consumi in modo quasi lineare', () => {
  const a = run('B1'), b = run('B1', { 'config.capacity_Mt': 1.4 });
  const ratio = b.indicators.elec_MWh / a.indicators.elec_MWh;
  assert.ok(ratio > 1.3 && ratio < 1.5, ratio);
});
t('più DRI nel forno elettrico: più energia elettrica; DRI caldo: meno', () => {
  const lo = run('A2', { 'b4.dri_share': 0.4 }), hi = run('A2', { 'b4.dri_share': 0.9 }), cold = run('A2', { 'b4.hot_dri': false });
  assert.ok(hi.blocks.B4.kWh_t > lo.blocks.B4.kWh_t);
  assert.ok(cold.blocks.B4.kWh_t > run('A2').blocks.B4.kWh_t);
});
t('idrogeno nel DRI: meno CO₂ diretta, più energia elettrica con l\'elettrolisi nel sito', () => {
  const base = run('A2'), h2 = run('A2', { 'b3.h2_frac': 1, 'b3.h2_onsite': true });
  assert.ok(h2.indicators.co2_direct_t_t < base.indicators.co2_direct_t_t - 0.4);
  assert.ok(h2.indicators.elec_kWh_t > base.indicators.elec_kWh_t + 2000);
});
t('thin slab: il treno lamiere non è alimentato', () => { const r = run('A3', { 'b7.plate_share': 0.2 }); assert.strictEqual(r.blocks.B7.plates, 0); assert.ok(r.warnings.some((w) => /thin slab/.test(w))); });
t('gli input fuori campo sono rifiutati con InputError', () => {
  assert.throws(() => E.solve({ config: { capacity_Mt: 20 } }), (e) => e.name === 'InputError' && e.path === 'config.capacity_Mt');
  assert.throws(() => E.solve({ config: { product: 'B' }, b8: { erw_share: 0.8, sawl_share: 0.5 } }), (e) => e.name === 'InputError');
});
t('cambio di configurazione: i default della rotta e del prodotto si applicano', () => {
  const r = E.solve({ config: { product: 'B' } });
  assert.strictEqual(r.inputs.config.route, 'EAF'); assert.strictEqual(r.inputs.config.capacity_Mt, 1.0);
});
t('gli elaborati sono completi per tutti i casi', () => {
  D.cases.order.forEach((id) => {
    const r = run(id);
    Dc.ALL.forEach((d) => {
      const tb = d.fn(r);
      assert.ok(tb.rows.length > 0, id + ' ' + d.code);
      tb.rows.forEach((row) => assert.strictEqual(row.length, tb.cols.length, id + ' ' + d.code));
      assert.ok(!/NaN|undefined|Infinity/.test(JSON.stringify(tb)), id + ' ' + d.code);
      assert.ok(Dc.toCSV(tb).length > 10 && Dc.toMD(tb).length > 10);
    });
    const L = Dc.layout(r); assert.ok(L.site_ha > 30 && L.site_ha < 600, id + ' lotto ' + L.site_ha);
  });
});
console.log(n + ' test superati');
