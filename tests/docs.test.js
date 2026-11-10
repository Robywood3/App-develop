// Test degli elaborati di ingegneria: modello, dimensionamento, PDF e SVG.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig, designPlant } from '../js/engine/plant.js';
import { defaultProjectMeta, sizeLine } from '../js/docs/engineering.js';
import { documentCatalog, buildDocument, registerSheets, engineeringModel, buildPdf, sheetToSVG, csvFor, pidRegistry } from '../js/docs/index.js';
import { textWidth } from '../js/docs/pdf.js';

test('dimensionamento linea: velocità entro il limite e spessore ASME B31.1', () => {
  // vapore HP 80 kg/s a 125 bar, 565 °C, v ≈ 0,0275 m³/kg
  const l = sizeLine({ m: 88, v: 0.0275, velMax: 45, pOp: 125, Top: 565 });
  const vel = (88 * 0.0275) / ((Math.PI / 4) * (l.ID / 1000) ** 2);
  assert.ok(vel <= 45 + 1e-9);
  assert.equal(l.mat, 'C'); // P91 sopra 545 °C
  const P = (l.pDes - 1.013) / 10;
  const tmin = (P * l.OD) / (2 * (l.S + P * 0.7)) + 1.0;
  assert.ok(Math.abs(l.tmin - tmin) < 1e-9);
  assert.ok(l.tnom * 0.875 >= l.tmin - 1e-9);
  assert.ok(l.cls >= 1500);
});

for (const [nGT, type, cond] of [[1, '3PRH', 'water'], [2, '2P', 'air'], [3, '1P', 'water']]) {
  test(`elaborati ${nGT}+1 ${type} ${cond}: generazione completa e PDF valido`, () => {
    const cfg = defaultConfig('Classe F (~300 MW)', type);
    cfg.nGT = nGT;
    cfg.steam.condenser.type = cond;
    const des = designPlant(cfg);
    const meta = defaultProjectMeta();
    const M = engineeringModel(cfg, des, meta);
    // coerenza del modello
    assert.ok(M.lines.every((l) => l.vel > 0 && Number.isFinite(l.tnom)));
    assert.ok(M.eq.filter((e) => !e.group).length > 30);
    assert.equal(M.electrical.gens.length, nGT + 1);
    assert.ok(M.electrical.summary.totKW > 0.5 * M.electrical.summary.simAux);
    const cat = documentCatalog(meta, M);
    assert.ok(cat.filter((c) => c.pid).length >= (type === '3PRH' ? 22 : 21));
    const counts = {};
    const all = [];
    for (const c of cat) {
      const sh = buildDocument(M, c);
      assert.ok(sh.length >= 1, c.id);
      for (const s of sh) {
        const svg = sheetToSVG(s);
        assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
        assert.ok(!/NaN|undefined/.test(svg), `${c.id}: valori non validi nel disegno`);
      }
      counts[c.id] = sh.length;
      all.push(...sh);
      if (c.csv) assert.ok(csvFor(M, c).split('\r\n').length > 3);
    }
    // registro P&ID: tag univoci, linee definite, liste derivate coerenti
    const { reg } = pidRegistry(M);
    const tags = [...reg.valves, ...reg.instruments].map((x) => x.tag);
    assert.equal(new Set(tags).size, tags.length, 'tag duplicati');
    assert.ok(reg.valves.length > 250 && reg.instruments.length > 180);
    const lineNos = new Set(M.lines.map((l) => l.lineNo));
    for (const x of [...reg.valves, ...reg.instruments]) if (x.line) assert.ok(lineNos.has(x.line), x.tag);
    const ll = cat.find((c) => c.id === 'll').table(M);
    const noPid = ll.rows.filter((r) => !r.group && !r.pid).map((r) => r.lineNo);
    assert.ok(noPid.length <= 4, `linee senza P&ID: ${noPid.join(' ')}`);
    const pdf = buildPdf([...registerSheets(M, cat, counts), ...all], { title: 'Test' });
    const txt = Buffer.from(pdf).toString('latin1');
    assert.ok(txt.startsWith('%PDF-1.4'));
    assert.ok(txt.trimEnd().endsWith('%%EOF'));
    // offset della tabella xref coerenti con gli oggetti
    const xrefPos = Number(txt.match(/startxref\n(\d+)/)[1]);
    assert.ok(txt.slice(xrefPos).startsWith('xref'));
    const offs = [...txt.slice(xrefPos).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
    offs.forEach((o, i) => assert.ok(txt.slice(o).startsWith(`${i + 1} 0 obj`), `oggetto ${i + 1}`));
    assert.equal((txt.match(/\/Type \/Page /g) || []).length, all.length + registerSheets(M, cat, counts).length);
  });
}

test('metriche Helvetica per allineamento testo', () => {
  assert.ok(Math.abs(textWidth('0', 1000) - 556) < 1e-9);
  assert.ok(textWidth('°C', 10) > 0);
});

test('gasolio di riserva e modello TG 60 Hz: P&ID 211, linee DO disegnate, 3600 giri/min', () => {
  const cfg = defaultConfig('GE Vernova 7HA.03 (430 MW)', '3PRH');
  cfg.nGT = 2;
  cfg.backupFuel = 'diesel';
  const des = designPlant(cfg);
  const meta = defaultProjectMeta();
  const M = engineeringModel(cfg, des, meta);
  const cat = documentCatalog(meta, M);
  const c211 = cat.find((c) => c.id === 'pid211');
  assert.ok(c211, 'P&ID gasolio mancante');
  for (const s of buildDocument(M, c211)) assert.ok(!/NaN|undefined/.test(sheetToSVG(s)));
  const { reg } = pidRegistry(M);
  for (const id of ['DO-U', 'DO-T', 'DO-A', 'ACWS', 'ACWR', 'NG-DR', 'SV-T']) assert.ok(reg.lineRefs.has(id), `${id} senza P&ID`);
  assert.ok(M.layout.items.some((it) => it.tag === '0EGB10'));
  const gt = M.eq.find((e) => /Turbina a gas/.test(e.desc || ''));
  assert.ok(gt && /3600 giri\/min \(60 Hz\)/.test(Object.values(gt).join(' ')));
  // senza gasolio il P&ID non compare
  const cfg2 = defaultConfig('Classe F (~300 MW)', '3PRH');
  const M2 = engineeringModel(cfg2, designPlant(cfg2), meta);
  assert.ok(!documentCatalog(meta, M2).some((c) => c.id === 'pid211'));
});

test('taratura su Ostiglia (1+1 classe H, Benson): vapore, collettori, pompe e ausiliari', () => {
  const cfg = defaultConfig('Siemens SGT5-9000HL (593 MW)', '3PRH');
  cfg.gasSupplyBar = 41;
  const M = engineeringModel(cfg, designPlant(cfg), defaultProjectMeta());
  const { r, U } = M, bt = r.bt;
  assert.equal(cfg.steam.hpEvap, 'benson');
  assert.ok(Math.abs(r.Pgt + r.Pst - 890) < 20, `lordo ${r.Pgt + r.Pst}`); // Ostiglia ~600 + 290 MW
  assert.ok(Math.abs(bt.pAdm[0] - 173) < 0.5 && Math.abs(bt.Tsh[0] - 600) < 1); // 173 bar / 600 °C
  assert.ok(bt.mLevels[0] > 150 && bt.mLevels[0] < 165, `HP ${bt.mLevels[0]}`); // 162 kg/s
  assert.ok(Math.abs(bt.pRHout - 40) < 1.5 && Math.abs(bt.Trh - 610) < 1); // 40 bar / 610 °C
  assert.ok(bt.Tstack > 70 && bt.Tstack < 85); // 76 °C
  const dn = (id) => M.lineById[id].DN;
  for (const [id, ref] of [['FG-1', 350], ['MS-1', 400], ['CRH-1', 600], ['HRH-1', 650], ['FW-1', 300], ['CCS', 700], ['IA-H', 100], ['SA-H', 80], ['DM-H', 200]]) {
    assert.equal(dn(id), ref, `${id} DN${dn(id)} invece di DN${ref}`);
  }
  assert.ok(Math.abs(M.pumps.fw1.H - 2200) < 150, `BFWP ${M.pumps.fw1.H} m`);
  assert.ok(Math.abs(M.pumps.cd.H - 226) < 25, `CEP ${M.pumps.cd.H} m`);
  assert.equal(U.air.compressorN, 3); assert.equal(U.air.compressorNm3h, 1450); assert.equal(U.air.dryerNm3h, 2250);
  assert.equal(U.demi.plantM3h, 30); assert.equal(U.demi.tankM3, 6000); assert.equal(U.demi.tankN, 2);
  assert.ok(Math.abs(U.auxSteam.boilerCapacity * 3.6 - 20) < 2.1);
  assert.ok(U.ccw.kW > 20000 && U.ccw.kW < 26000 && U.ccw.pumpN === 3, `CCW ${U.ccw.kW}`); // 23,6 MW, 3 pompe
  assert.ok(U.gas.compressor && U.gas.compressor.kW > 1400 && U.gas.compressor.kW < 2200, 'compressore gas ~1800 kW');
  // ciclo aperto separato dalla torre: niente torre, reintegro né spurgo; presa e restituzione documentate
  cfg.steam.condenser.cooling = 'once';
  const M2 = engineeringModel(cfg, designPlant(cfg), defaultProjectMeta());
  assert.equal(M2.U.cooling.type, 'aperto');
  assert.equal(M2.U.cooling.makeup, 0);
  assert.ok(!M2.lineById.CTM && !M2.eq.some((e) => e.tag === '0PAE10'));
  assert.ok(M2.eq.some((e) => e.tag === '0PAB20') && M2.layout.items.some((it) => it.tag === '0PAR10'));
  const cat = documentCatalog(M2.meta, M2);
  for (const c of cat.filter((x) => ['pid104', 'pid201', 'pid202', 'pfd5', 'pfd6', 'pfd7'].includes(x.id))) {
    for (const s of buildDocument(M2, c)) assert.ok(!/NaN|undefined/.test(sheetToSVG(s)), c.id);
  }
});

test('liste coerenti: tag apparecchiature univoci e condotto ACC dimensionato sugli impianti più grandi', () => {
  for (const [g, type, nGT, ct] of [['Classe F (~300 MW)', '3PRH', 1, 'water'], ['Siemens SGT5-9000HL (593 MW)', '3PRH', 3, 'air'], ['Classe E (~170 MW)', '1P', 2, 'air']]) {
    const cfg = defaultConfig(g, type); cfg.nGT = nGT; cfg.steam.condenser.type = ct;
    const M = engineeringModel(cfg, designPlant(cfg), defaultProjectMeta());
    const tags = M.eq.filter((e) => !e.group).map((e) => e.tag);
    assert.deepEqual(tags.filter((t, i) => tags.indexOf(t) !== i), [], `${g}: tag duplicati`);
    for (const l of M.lines) assert.ok(Number.isFinite(l.DN) && l.vel > 0 && !/undefined|NaN/.test(l.lineNo), `${g}: linea ${l.id}`);
    for (const e of M.eq) if (!e.group) for (const v of Object.values(e)) assert.ok(typeof v !== 'string' || !/NaN|undefined/.test(v), `${g}: ${e.tag}`);
    // apparecchiature principali presenti sui P&ID e in lista
    for (const t of ['0MAV10', '0MAV20']) assert.ok(tags.includes(t), `${t} assente`);
  }
});

test('livello senza vapore al progetto: avviso nel progetto ed errore esplicito negli elaborati', () => {
  const cfg = defaultConfig('Classe F (~300 MW)', '3PRH');
  cfg.gt.TIT = 1750; cfg.steam.TstackMin = 150; cfg.steam.levels[1].p = 60;
  const des = designPlant(cfg);
  assert.ok(des.idleLevels.length > 0 && des.notes.some((t) => /non produc/.test(t)));
  assert.throws(() => engineeringModel(cfg, des, defaultProjectMeta()), /non produc(e|ono) vapore al punto di progetto/);
});

test('robustezza: dati non coerenti danno un errore esplicito, non un calcolo senza fine', () => {
  // linea senza portata valida (progetto non ricalcolato): errore, non ricerca illimitata del diametro
  assert.throws(() => sizeLine({ m: NaN, v: 0.03, velMax: 50, pOp: 100, Top: 500 }), /dati non validi/);
  assert.throws(() => sizeLine({ m: 0, v: 0.03, velMax: 50, pOp: 100, Top: 500 }), /dati non validi/);
  // configurazione modificata senza ricalcolo del progetto: il modello degli elaborati termina comunque
  const cfg = defaultConfig();
  const des = designPlant(cfg);
  cfg.gasSupplyBar = 1;
  cfg.steam.levels.forEach((l) => { l.p = 1; l.Tsh = 1; });
  const t0 = Date.now();
  try { engineeringModel(cfg, des, defaultProjectMeta()); } catch (e) { assert.match(e.message, /\S/); }
  assert.ok(Date.now() - t0 < 20000, 'il modello deve terminare');
  // celle CSV che un foglio di calcolo leggerebbe come formula
  const fake = { table: () => ({ columns: [{ key: 'a', title: 'A' }, { key: 'b', title: 'B' }], rows: [{ a: "=cmd|' /C calc'!A0", b: '-12,5' }, { a: '@SUM(1)', b: '+3' }, { a: '-2+3', b: 'testo' }] }) };
  const lines = csvFor({}, fake).split('\r\n');
  assert.equal(lines[1], "'=cmd|' /C calc'!A0;-12,5");
  assert.equal(lines[2], "'@SUM(1);+3");
  assert.equal(lines[3], "'-2+3;testo");
});
