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

test('lo ZIP con i formati scelti è leggibile e organizzato per cartelle', () => {
  const r = E.generate(F.defaultConfig(), { phase: 'esecutivo', config: 'FV', procedure: 'pas', selected: ['X02', 'D01', 'D02'] });
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fvb-')), 'e.zip');
  fs.writeFileSync(p, E.zip(r, ['docx', 'dxf', 'pdf', 'md']));
  const out = execFileSync('python3', ['-c', 'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print("\\n".join(sorted(z.namelist())))', p]).toString();
  for (const k of ['Word/X02_', 'CAD/D01_', 'CAD/D02_', 'PDF/D01_', 'PDF/X02_', 'Markdown/00_Indice.md', 'Word/00_Indice.docx']) assert.ok(out.includes(k), k);
  assert.ok(!/CAD\/X02|Word\/D01/.test(out), 'formati non pertinenti esclusi');
});

// validatori esterni, se installati: python-docx, ezdxf, pdfinfo
const has = cmd => { try { execFileSync('python3', ['-c', cmd], { stdio: 'ignore' }); return true; } catch (e) { return false; } };
test('i file Word, DXF e PDF superano i validatori', { skip: !has('import docx, ezdxf') && 'python-docx o ezdxf non installati' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fvb-')), r = E.generate(F.defaultConfig(), { phase: 'pfte', config: 'FB', procedure: 'pas', selected: ['R02', 'R04', 'E02', 'T02', 'T04', 'T05', 'T07'] });
  for (const f of r.files) for (const k of E.formatsOf(f)) { const o = E.exportFile(f, k); fs.writeFileSync(path.join(dir, o.name), o.data); }
  const py = `import glob, docx, sys
from ezdxf import recover
d = sys.argv[1]
for f in glob.glob(d + '/*.docx'): assert len(docx.Document(f).paragraphs) > 3, f
for f in glob.glob(d + '/*.dxf'):
    doc, aud = recover.readfile(f); assert not aud.has_errors and len(doc.modelspace()) > 20, f
print(len(glob.glob(d + '/*.docx')), len(glob.glob(d + '/*.dxf')))`;
  assert.equal(execFileSync('python3', ['-c', py, dir]).toString().trim(), '4 4');
  for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.pdf'))) { const b = fs.readFileSync(path.join(dir, f)); assert.ok(b.slice(0, 5).toString() === '%PDF-' && b.slice(-6).toString().includes('%%EOF'), f); }
  try { execFileSync('pdfinfo', [path.join(dir, fs.readdirSync(dir).find(n => n.startsWith('T02') && n.endsWith('.pdf')))]); } catch (e) { if (e.code !== 'ENOENT') throw e; }
});

test('il Markdown si converte in blocchi e il testo in WinAnsi', () => {
  const X = require('../js/export.js');
  const B = X.parseMd('# Titolo\n\n| a | b |\n|---|---:|\n| 1 | 2 |\n\n- uno\n- due\n\n```mermaid\nflowchart TB\n  A["Rete"] --> B["Cabina"]\n```\n');
  assert.deepEqual(B.map(b => b.t), ['h', 'table', 'list', 'p', 'list']);
  assert.equal(X.win('ΔV ≤ 3 % – 12 €'), 'Delta V <= 3 % \u0096 12 \u0080');
});
