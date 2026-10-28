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
