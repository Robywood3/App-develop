#!/usr/bin/env node
/*
 * Crea la demo online di Casa Clima: un unico file HTML che contiene la dashboard e il motore
 * (hub, Casa-Clima, automazioni, casa simulata) che girano nel browser, senza server.
 *
 *   npm run demo                      -> demo/index.html  (si apre con un doppio clic o su GitHub Pages)
 *   node tools/build-demo.mjs --fragment out.html   (variante senza <html>/<head>, per pagine ospitate)
 */
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const fragmentOut = args.includes('--fragment') ? args[args.indexOf('--fragment') + 1] : null;

// Sostituti minimi dei moduli di Node usati dal motore: nel browser non servono file né hash.
const SHIMS = {
  'node:events': `export { EventEmitter } from ${JSON.stringify(require.resolve('events/'))};`,
  'node:crypto': `
    const hex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');
    export function randomBytes(n) { const h = hex(n); return { toString: () => h }; }
    export function createHash() { throw new Error('Non disponibile nella demo'); }
    export function scryptSync() { throw new Error('Non disponibile nella demo'); }
    export function timingSafeEqual() { return false; }`,
  'node:fs': `
    const no = () => { throw new Error('Non disponibile nella demo'); };
    export const promises = { readFile: no, writeFile: no, rename: no, readdir: async () => [], unlink: no };
    export const readFileSync = no, writeFileSync = no, renameSync = no, copyFileSync = no;
    export const existsSync = () => false, mkdirSync = () => {}, readdirSync = () => [];`,
  'node:path': `
    export const basename = (p) => String(p).split('/').pop();
    export const dirname = (p) => String(p).split('/').slice(0, -1).join('/');
    export const join = (...a) => a.join('/');
    export default { basename, dirname, join };`
};

const nodeShims = {
  name: 'node-shims',
  setup(b) {
    b.onResolve({ filter: /^node:/ }, (a) => ({ path: a.path, namespace: 'shim' }));
    b.onLoad({ filter: /.*/, namespace: 'shim' }, (a) => {
      if (!SHIMS[a.path]) throw new Error(`Modulo di Node non previsto nella demo: ${a.path}`);
      return { contents: SHIMS[a.path], loader: 'js', resolveDir: ROOT };
    });
  }
};

const result = await build({
  entryPoints: [path.join(ROOT, 'web/js/demo/entry.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: 'es2020',
  plugins: [nodeShims],
  loader: { '.yaml': 'text' },
  define: { 'process.env.LOG_LEVEL': '"warn"', 'process.env.NODE_ENV': '"production"', 'process.env.CASA_CLIMA_PASSWORD': 'undefined' },
  logLevel: 'warning'
});

const icon = `data:image/svg+xml;base64,${Buffer.from(await readFile(path.join(ROOT, 'web/icon.svg'))).toString('base64')}`;
const js = result.outputFiles[0].text.replaceAll('src="icon.svg"', `src="${icon}"`).replace(/<\/script/gi, '<\\/script');
const css = await readFile(path.join(ROOT, 'web/css/app.css'), 'utf8');
const themeInit = "try{var t=localStorage.getItem('cc.theme');if(t)document.documentElement.dataset.theme=t}catch(e){}";

const body = `<div id="app"><div class="boot"><div class="spinner"></div></div></div>
<div id="modal-root"></div>
<div id="toasts" aria-live="polite"></div>
<script>${js}</script>`;

const full = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0f1115">
<title>Casa Clima Demo</title>
<link rel="icon" href="${icon}">
<script>${themeInit}</script>
<style>${css}</style>
</head>
<body>
${body}
</body>
</html>
`;

await mkdir(path.join(ROOT, 'demo'), { recursive: true });
await writeFile(path.join(ROOT, 'demo/index.html'), full);
console.log(`demo/index.html  ${(full.length / 1024).toFixed(0)} KB`);

if (fragmentOut) {
  const fragment = `<title>Casa Clima Demo</title>
<script>${themeInit}</script>
<style>${css}</style>
${body}
`;
  await writeFile(fragmentOut, fragment);
  console.log(`${fragmentOut}  ${(fragment.length / 1024).toFixed(0)} KB`);
}
