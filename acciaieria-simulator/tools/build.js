// Crea il simulatore a file singolo (CSS e JavaScript in linea).
//   standalone/simulatore-acciaieria.html  documento completo, apribile da file locale
//   <out>/artifact.html (con --artifact <dir>) frammento senza <html>/<head>/<body> per la pubblicazione
'use strict';
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const src = (f) => fs.readFileSync(path.join(root, 'src', f), 'utf8');
const scripts = [['src-data', 'data.js'], ['src-engine', 'engine.js'], ['src-docs', 'docs.js'], ['src-page', 'page.js']];
const body = src('page.html') + '\n' + scripts.map(([id, f]) => '<script id="' + id + '">\n' + src(f).replace(/<\/script/gi, '<\\/script') + '\n</script>').join('\n') + '\n';
const full = '<!doctype html>\n<html lang="it">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body>\n' + body + '</body>\n</html>\n';
fs.mkdirSync(path.join(root, 'standalone'), { recursive: true });
fs.writeFileSync(path.join(root, 'standalone', 'simulatore-acciaieria.html'), full);
const i = process.argv.indexOf('--artifact');
if (i > 0) { const out = process.argv[i + 1]; fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'artifact.html'), body); }
console.log('standalone/simulatore-acciaieria.html', (full.length / 1024).toFixed(0) + ' kB');
