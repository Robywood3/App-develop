// Crea la versione a file singolo del simulatore (CSS e JS incorporati).
//   node tools/build-single.js                 -> standalone/Simulatore_FV_BESS.html (documento completo, apribile offline)
//   node tools/build-single.js --artifact out  -> solo il contenuto tra i marcatori ARTIFACT-START/END (pagina per claude.ai)
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2), artifact = args[0] === '--artifact';
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, f) => `<style>\n${fs.readFileSync(path.join(ROOT, f), 'utf8')}</style>`);
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, f) => `<script>\n${fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/<\/script/gi, '<\\/script')}</script>`);
if (artifact) {
  const a = html.indexOf('<!--ARTIFACT-START-->'), b = html.indexOf('<!--ARTIFACT-END-->');
  html = html.slice(a + 21, b).replace('<!--HEAD-END-->\n</head>\n<body>\n', '');
}
const out = artifact ? (args[1] || path.join(ROOT, 'standalone', 'artifact.html')) : path.join(ROOT, 'standalone', 'Simulatore_FV_BESS.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(out, Math.round(html.length / 1024) + ' kB');
