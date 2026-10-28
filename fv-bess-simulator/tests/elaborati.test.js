// Test della generazione degli elaborati: node --test tests/
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
const F = require('../js/engine.js'), E = require('../js/elaborati.js');

test('l\'elenco segue la matrice di applicabilità dell\'elenco standard', () => {
  const st = (phase, config, code) => E.prepare({ phase, config, procedure: 'pas' }).find(d => d.code === code).status;
  assert.equal(E.CATALOG.length, 64);
  assert.equal(st('pfte', 'B', 'R03'), 'na');        // producibilità esclusa per solo BESS
  assert.equal(st('pfte', 'FV', 'R04'), 'na');       // dimensionamento BESS escluso per solo FV
  assert.equal(st('pfte', 'B', 'T07'), 'na');        // strutture moduli escluse per solo BESS
  assert.equal(st('pfte', 'FB', 'R14'), 'required');
  assert.equal(st('pfte', 'FV', 'R08'), 'optional');
  assert.equal(st('esecutivo', 'FV', 'X08'), 'na');
  assert.equal(st('esecutivo', 'B', 'D01'), 'optional');
  assert.ok(E.prepare({ phase: 'esecutivo', config: 'FB', procedure: 'pas' }).every(d => /^[XDC]/.test(d.code)));
  assert.throws(() => E.prepare({ phase: 'preliminare', config: 'FB' }));
});

test('tutte le combinazioni generano documenti senza valori mancanti', () => {
  for (const phase of ['pfte', 'esecutivo']) for (const config of ['FV', 'FB', 'B']) {
    const all = E.prepare({ phase, config, procedure: 'au' }).filter(d => d.status !== 'na').map(d => d.code);
    const r = E.generate(F.defaultConfig(), { phase, config, procedure: 'au', selected: all, date: '2026-10-28' });
    assert.equal(r.files.length, all.length + 1, phase + ' ' + config);
    for (const f of r.files) assert.ok(!/undefined|NaN|\[object Object\]/.test(f.md), `${phase} ${config} ${f.code}`);
  }
});

test('i codici non applicabili richiesti vengono esclusi con un avviso', () => {
  const r = E.generate(F.defaultConfig(), { phase: 'pfte', config: 'B', procedure: 'pas', selected: ['R01', 'R03'] });
  assert.deepEqual(r.files.map(f => f.code), ['00', 'R01']);
  assert.ok(r.warnings.some(w => /R03/.test(w)));
});

test('il quadro economico chiude sul CAPEX del simulatore', () => {
  const r = E.generate(F.defaultConfig(), { phase: 'pfte', config: 'FB', procedure: 'pas', selected: ['E02'] });
  const tot = F.simulate(F.defaultConfig()).capex.total.toLocaleString('it-IT', { maximumFractionDigits: 0 });
  assert.ok(r.files[1].md.includes('**' + tot + '**'));
});

test('lo ZIP generato è leggibile', () => {
  const r = E.generate(F.defaultConfig(), { phase: 'esecutivo', config: 'FV', procedure: 'pas' });
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fvb-')), 'e.zip');
  fs.writeFileSync(p, E.zip(r.files, r.folder));
  const out = execFileSync('python3', ['-c', 'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print(len(z.namelist())); print(z.read(z.namelist()[0]).decode()[:20])', p]).toString();
  assert.equal(out.split('\n')[0], String(r.files.length));
  assert.ok(out.includes('# Elenco elaborati'));
});
