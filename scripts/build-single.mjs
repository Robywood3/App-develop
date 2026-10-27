// Crea una versione a file singolo del simulatore (CSS e JavaScript in linea):
//   dist/simulatore-ccgt.html  documento completo, apribile anche da file locale
//   dist/artifact.html         frammento senza <html>/<head>/<body> per la pubblicazione
// I moduli ES vengono racchiusi in funzioni e collegati tramite un registro interno.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entry = join(root, 'js/ui/app.js');

const IMPORT_RE = /import\s*\{([\s\S]*?)\}\s*from\s*['"](.+?)['"];?/g;

const order = [];
const seen = new Set();
function visit(file) {
  if (seen.has(file)) return;
  seen.add(file);
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(IMPORT_RE)) visit(resolve(dirname(file), m[2]));
  order.push(file);
}
visit(entry);

function transform(file) {
  let src = readFileSync(file, 'utf8');
  const exported = [];
  src = src.replace(IMPORT_RE, (_, names, spec) => {
    const dep = relative(root, resolve(dirname(file), spec));
    const binds = names.split(',').map((n) => n.trim()).filter(Boolean).map((n) => n.replace(/\s+as\s+/, ': ')).join(', ');
    return `const { ${binds} } = __m['${dep}'];`;
  });
  src = src.replace(/^export\s*\{([^}]*)\};?\s*$/gm, (_, names) => {
    for (const n of names.split(',').map((x) => x.trim()).filter(Boolean)) exported.push(n);
    return '';
  });
  src = src.replace(/^export\s+(async\s+function|function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm, (_, kw, name) => {
    exported.push(name);
    return `${kw} ${name}`;
  });
  if (/^\s*export\s/m.test(src)) throw new Error(`Export non gestito in ${file}`);
  const id = relative(root, file);
  return `__m['${id}'] = (() => {\n${src}\nreturn { ${exported.join(', ')} };\n})();\n`;
}

const bundle = `(() => {\n'use strict';\nconst __m = {};\n${order.map(transform).join('\n')}\n})();`;

const html = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');
const pick = (re) => (html.match(re) || [''])[0];
const title = pick(/<title>[\s\S]*?<\/title>/);
const metaSides = pick(/<meta name="claude:viewport-fit-sides"[^>]*>/);
const fonts = [...html.matchAll(/<link rel="(?:preconnect|stylesheet)" href="https:\/\/fonts[^>]*>/g)].map((m) => m[0]).join('\n');
const body = html.slice(html.indexOf('<!--APP-START-->') + 16, html.indexOf('<!--APP-END-->'));
const safeBundle = bundle.replace(/<\/script/gi, '<\\/script');

const fragment = `${title}\n${metaSides}\n${fonts}\n<style>\n${css}\n</style>\n${body}\n<script>\n${safeBundle}\n</script>\n`;
const full = `<!doctype html>\n<html lang="it">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${fragment.replace(body, '').replace(`<script>\n${safeBundle}\n</script>\n`, '')}</head>\n<body>\n${body}\n<script>\n${safeBundle}\n</script>\n</body>\n</html>\n`;

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/artifact.html'), fragment);
writeFileSync(join(root, 'dist/simulatore-ccgt.html'), full);
console.log(`Moduli: ${order.length}. Scritti dist/simulatore-ccgt.html (${(full.length / 1024).toFixed(0)} kB) e dist/artifact.html.`);
