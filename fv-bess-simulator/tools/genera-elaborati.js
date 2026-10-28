// Genera gli elaborati di progetto in Markdown dal simulatore FV + BESS.
//
//   node tools/genera-elaborati.js                                   mostra fasi e configurazioni (scelta obbligatoria)
//   node tools/genera-elaborati.js --fase pfte --config FB --elenco  mostra gli elaborati applicabili, senza generare
//   node tools/genera-elaborati.js --fase pfte --config FB [--procedura pas] [--includi R08,R13] [--escludi G04]
//                                  [--formati docx,dxf,pdf,md] [--caso caso.json] [--out cartella] [--prefisso FVB] [--rev A]
//
// Formati: relazioni in Word (.docx), elaborati grafici in CAD (.dxf), tutto in PDF; .md su richiesta.
// Default: docx,dxf,pdf. I file vanno in sottocartelle Word/, CAD/, PDF/, Markdown/.
//
// --caso: configurazione JSON copiata dal simulatore (pulsante "Copia configurazione"); senza, usa il caso di esempio.
const fs = require('fs'), path = require('path');
const F = require('../js/engine.js'), E = require('../js/elaborati.js');
const a = {}; const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) { const k = argv[i].slice(2); a[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; } }
const cfgMap = { fv: 'FV', fb: 'FB', 'fv+bess': 'FB', b: 'B', bess: 'B' };
if (!a.fase || !a.config) {
  console.log('Scegli prima fase e configurazione:\n');
  console.log('  --fase    ' + Object.keys(E.PHASES).map(k => `${k} (${E.PHASES[k].name})`).join(' | '));
  console.log('  --config  FV (solo FV) | FB (FV + BESS) | B (solo BESS)');
  console.log('  --procedura ' + Object.keys(E.PROCEDURES).join(' | ') + '   (default: pas)');
  console.log('\nEsempio: node tools/genera-elaborati.js --fase pfte --config FB --elenco');
  process.exit(a.fase || a.config ? 1 : 0);
}
const opts = { phase: String(a.fase).toLowerCase(), config: cfgMap[String(a.config).toLowerCase()] || a.config, procedure: a.procedura || 'pas', prefix: a.prefisso || 'FVB', rev: a.rev || 'A' };
let list;
try { list = E.prepare(opts); } catch (e) { console.error(e.message); process.exit(1); }
const split = s => typeof s === 'string' ? s.split(',').map(x => x.trim().toUpperCase()).filter(Boolean) : [];
const inc = split(a.includi), exc = split(a.escludi);
if (a.includi === 'tutti') list.forEach(d => { if (d.status !== 'na') d.selected = true; });
list.forEach(d => { if (inc.includes(d.code) && d.status !== 'na') d.selected = true; if (exc.includes(d.code)) d.selected = false; });
if (a.elenco) {
  const sym = { required: '●', optional: '○', na: '–' };
  console.log(`${E.PHASES[opts.phase].name} · ${E.CONFIGS[opts.config]} · ${E.PROCEDURES[opts.procedure]}\n`);
  for (const d of list) console.log(`  [${d.status === 'na' ? ' ' : d.selected ? 'x' : ' '}] ${sym[d.status]} ${d.code}  ${d.title}`);
  console.log('\n[x] = sarà generato. Usa --includi / --escludi per cambiare la selezione, poi togli --elenco per generare.');
  process.exit(0);
}
const cfg = a.caso ? JSON.parse(fs.readFileSync(a.caso, 'utf8')) : F.defaultConfig();
const res = E.generate(cfg, Object.assign({}, opts, { selected: list.filter(d => d.selected).map(d => d.code) }));
const out = path.resolve(a.out || path.join(__dirname, '..', 'elaborati'), res.folder);
const formats = (typeof a.formati === 'string' ? a.formati : 'docx,dxf,pdf').split(',').map(s => s.trim().toLowerCase()).filter(f => E.FORMATS[f]);
if (!formats.length) { console.error('Formati validi: ' + Object.keys(E.FORMATS).join(', ')); process.exit(1); }
const FOLDER = { docx: 'Word', dxf: 'CAD', pdf: 'PDF', md: 'Markdown' }; let n = 0;
for (const f of res.files) for (const k of formats) { const o = E.exportFile(f, k); if (!o) continue; const dir = path.join(out, FOLDER[k]); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, o.name), o.data); n++; }
res.warnings.forEach(w => console.log('Avviso: ' + w));
console.log(`${res.files.length - 1} elaborati + indice: ${n} file (${formats.join(', ')}) in ${out}`);
