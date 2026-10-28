// Test del motore: node --test tests/
const test = require('node:test'), assert = require('node:assert/strict');
const F = require('../js/engine.js'), D = require('../js/data.js');
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);

const base = F.simulate({});

test('il meteo sintetico conserva l\'irraggiamento medio mensile', () => {
  for (const key of ['milano', 'roma', 'palermo']) {
    const site = D.SITES[key], w = F.buildWeather(site, 3);
    for (let m = 0; m < 12; m++) {
      let s = 0; for (let d = F.MONTH_START[m]; d < F.MONTH_START[m] + F.MONTH_DAYS[m]; d++) for (let h = 0; h < 24; h++) s += w.ghi[d * 24 + h];
      near(s / F.MONTH_DAYS[m], site.ghi[m], site.ghi[m] * 0.02, key + ' mese ' + (m + 1));
    }
  }
});

test('producibilità specifica entro intervalli realistici (kWh/kWp)', () => {
  const y = (site, mount) => F.simulate({ project: { site }, pv: { mount, tilt: mount === 'roof_ew' ? 10 : 30, bifacial: false }, bess: { enabled: false }, finance: { years: 1 } }).kpi.specificYield;
  const mi = y('milano', 'ground_fixed'), pa = y('palermo', 'ground_fixed'), tr = y('milano', 'tracker'), ew = y('milano', 'roof_ew');
  assert.ok(mi > 1150 && mi < 1400, 'Milano fisso ' + mi);
  assert.ok(pa > 1550 && pa < 1850, 'Palermo fisso ' + pa);
  assert.ok(tr / mi > 1.12 && tr / mi < 1.30, 'guadagno tracker ' + tr / mi);
  assert.ok(ew < mi, 'est-ovest sotto il fisso a sud');
});

test('bilanci di energia chiusi ora per ora sull\'anno', () => {
  const y = base.y1;
  near(y.pv, y.pvDirect + y.pvToBess + y.exp + y.curt, 1, 'ripartizione della produzione FV');
  near(y.load + y.aux, y.pvDirect + y.bessToLoad + (y.imp - y.gridToBess), 1, 'copertura dei consumi');
  const rte = base.cfg.bess.rte / 100, cap = base.cfg.bess.kwh * base.cfg.bess.dod / 100;
  assert.ok(y.bessOut <= (y.pvToBess + y.gridToBess) * rte + cap * 0.5 + 1, 'il BESS non crea energia');
  const soc = y.hourly.soc; for (let i = 0; i < soc.length; i++) assert.ok(soc[i] >= -1e-9 && soc[i] <= 1 + 1e-9, 'SOC fuori limiti all\'ora ' + i);
});

test('immissione zero e limite di immissione rispettati', () => {
  const z = F.simulate({ grid: { zeroExport: true }, finance: { years: 1 } });
  assert.equal(z.y1.exp, 0);
  const l = F.simulate({ grid: { exportLimitKw: 500 }, bess: { enabled: false }, finance: { years: 1 } });
  assert.ok(Math.max(...l.y1.hourly.exp) <= 500 + 1e-6);
  assert.ok(l.y1.curt > 0, 'con 500 kW di limite c\'è energia tagliata');
});

test('VAN e TIR coerenti, maggiorazione a scaglioni', () => {
  const f = base.fin;
  near(F.npv(f.irrProject, f.cfProj), 0, 1, 'VAN al TIR');
  assert.equal(F.tierAmount(3e6, [{ upTo: 2.5e6, pct: 180 }, { upTo: 10e6, pct: 100 }]), 2.5e6 * 1.8 + 0.5e6);
  assert.ok(f.npvProject > 0 && f.irrProject > 0 && f.paybackProject > 0);
});

test('gli incentivi aumentano il VAN e il cumulo oltre il 100% genera un avviso', () => {
  const inc = F.defaultConfig().incentives.map(i => Object.assign(i, { enabled: i.id === 'iperamm2026' }));
  const r = F.simulate({ incentives: inc });
  assert.ok(r.fin.npvProject > base.fin.npvProject);
  const big = F.defaultConfig().incentives.map(i => Object.assign(i, { enabled: i.id === 'fesr' || i.id === 'zes', pct: 80, cap: 1e9 }));
  assert.ok(F.simulate({ incentives: big }).fin.warnings.some(w => /100%/.test(w)));
});

test('la configurazione del chiamante non viene modificata', () => {
  const c = F.defaultConfig(), before = JSON.stringify(c);
  F.sensitivity(c);
  assert.equal(JSON.stringify(c), before);
});

test('le verifiche di stringa del caso base sono soddisfatte', () => {
  for (const ch of base.eng.checks) assert.ok(ch.ok, ch.id + ' ' + ch.what);
  assert.ok(Math.abs(base.eng.kwpReal - base.cfg.pv.kwp) / base.cfg.pv.kwp < 0.02);
});

test('il degrado del BESS attiva l\'augmentation entro la vita utile', () => {
  const r = F.simulate({ bess: { calendarDeg: 2.5 } });
  assert.ok(r.years.some(y => y.augKwh > 0));
  assert.ok(r.years.every(y => y.soh >= 0.79 || y.augKwh > 0 || y.year === 1));
});

test('iper-ammortamento: senza moduli ENEA B/C nessun beneficio, massimale €/kWp applicato', () => {
  const mk = o => F.defaultConfig().incentives.map(i => Object.assign(i, { enabled: i.id === 'iperamm2026' }, i.id === 'iperamm2026' ? o : {}));
  const no = F.simulate({ incentives: mk({ modulesEneaBC: false }), finance: { years: 12 } });
  assert.equal(no.fin.incentives.find(i => i.id === 'iperamm2026').amount, 0);
  const capped = F.simulate({ incentives: mk({ capPvKwp: 300, bessAlpha: 0 }), bess: { enabled: false }, finance: { years: 12 } });
  near(capped.fin.incentives[0].amount, 300 * 3000 * 1.8 * 0.24, 1, 'beneficio IRES sul massimale');
});
