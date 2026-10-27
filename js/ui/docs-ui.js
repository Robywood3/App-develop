// Sezione "Documentazione di ingegneria": elenco elaborati, anteprima dei fogli,
// esportazione PDF / SVG / CSV e pacchetto completo.

import { defaultProjectMeta } from '../docs/engineering.js';
import { documentCatalog, buildDocument, registerSheets, engineeringModel, buildPdf, sheetToSVG, csvFor } from '../docs/index.js';

const $ = (id) => document.getElementById(id);
const META_KEYS = ['project', 'client', 'site', 'prefix', 'rev', 'revDesc', 'date', 'author', 'checked', 'approved', 'stackHeight'];

// Salvataggio file: capability "downloads" della pagina pubblicata, altrimenti download del browser.
let dlPromise = null;
function downloadsCap() {
  if (!dlPromise) {
    dlPromise = window.claude && typeof window.claude.use === 'function'
      ? window.claude.use('downloads').catch(() => null)
      : Promise.resolve(null);
  }
  return dlPromise;
}

async function saveFile(filename, data, mime) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const dl = await downloadsCap();
  if (dl) {
    try {
      await dl.save({ filename, data: blob });
      return { ok: true, msg: `${filename} salvato` };
    } catch (e) {
      if (e && e.code === 'declined') return { ok: false, msg: 'Salvataggio annullato' };
      if (e && e.code === 'rate_limited') return { ok: false, msg: 'Un salvataggio è già in corso: riprova tra poco' };
      if (e && !['unavailable', 'not_granted', 'capability_disabled', 'capability_removed'].includes(e.code)) return { ok: false, msg: `Salvataggio non riuscito (${e.code || 'errore'})` };
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { ok: true, msg: `${filename} scaricato` };
}

/**
 * @param {() => {cfg: object, des: object}} getDesign restituisce configurazione e progetto correnti
 */
export function initDocs(getDesign) {
  const meta = defaultProjectMeta();
  const D = { meta, model: null, sig: '', current: 'pfd', sheetIdx: 0, zoom: 1, sheets: null, sheetsFor: '' };

  const status = (s) => { $('docs-status').textContent = s; };

  // campi del cartiglio
  for (const k of META_KEYS) {
    const el = $(`dm-${k}`);
    el.value = meta[k];
    el.addEventListener('change', () => {
      meta[k] = k === 'stackHeight' ? Math.min(120, Math.max(30, parseFloat(el.value) || 60)) : el.value.trim();
      if (k === 'stackHeight') el.value = meta[k];
      D.sig = '';
      renderList();
      renderCurrent();
    });
  }

  const catalog = () => documentCatalog(meta);

  function model() {
    const { cfg, des } = getDesign();
    const sig = JSON.stringify([cfg, meta]);
    if (sig !== D.sig || !D.model) {
      D.model = engineeringModel(cfg, des, { ...meta });
      D.sig = sig;
      D.sheets = null;
    }
    return D.model;
  }

  function sheetsOf(entry) {
    const M = model();
    const key = `${D.sig}|${entry.id}`;
    if (D.sheetsFor !== key || !D.sheets) {
      D.sheets = buildDocument(M, entry);
      D.sheetsFor = key;
    }
    return D.sheets;
  }

  function renderList() {
    const nav = $('docs-list');
    let html = '';
    let grp = '';
    for (const c of catalog()) {
      if (c.group !== grp) { grp = c.group; html += `<div class="grp">${grp}</div>`; }
      html += `<button type="button" class="doc-item${c.id === D.current ? ' is-on' : ''}" data-doc="${c.id}"><span class="dn">${c.number}</span><span class="dt">${c.short}</span></button>`;
    }
    nav.innerHTML = html;
  }

  function renderCurrent() {
    const entry = catalog().find((c) => c.id === D.current);
    let sheets;
    try {
      sheets = sheetsOf(entry);
    } catch (e) {
      $('docs-paper').innerHTML = `<p class="muted">Impossibile generare l'elaborato: ${e.message}</p>`;
      return;
    }
    D.sheetIdx = Math.min(D.sheetIdx, sheets.length - 1);
    $('doc-number').textContent = entry.number;
    $('doc-title').textContent = entry.title;
    $('doc-sheet').textContent = `${D.sheetIdx + 1} / ${sheets.length}`;
    $('doc-prev').disabled = D.sheetIdx === 0;
    $('doc-next').disabled = D.sheetIdx >= sheets.length - 1;
    $('btn-doc-csv').hidden = !entry.csv;
    const svg = sheetToSVG(sheets[D.sheetIdx]).replace(/width="420mm" height="297mm"/, `style="width:${D.zoom * 100}%;min-width:${D.zoom > 1 ? 0 : 640}px"`);
    $('docs-paper').innerHTML = svg;
  }

  const fileBase = (entry) => `${entry.number}_rev${meta.rev || 'A'}`;

  $('docs-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-doc]');
    if (!b) return;
    D.current = b.dataset.doc;
    D.sheetIdx = 0;
    renderList();
    renderCurrent();
  });
  $('doc-prev').addEventListener('click', () => { D.sheetIdx = Math.max(0, D.sheetIdx - 1); renderCurrent(); });
  $('doc-next').addEventListener('click', () => { D.sheetIdx += 1; renderCurrent(); });
  for (const b of document.querySelectorAll('.docs-toolbar [data-zoom]')) {
    b.addEventListener('click', () => {
      D.zoom = parseFloat(b.dataset.zoom);
      for (const o of document.querySelectorAll('.docs-toolbar [data-zoom]')) {
        o.classList.toggle('is-on', o === b);
        o.setAttribute('aria-checked', String(o === b));
      }
      renderCurrent();
    });
  }
  $('btn-doc-pdf').addEventListener('click', async () => {
    const entry = catalog().find((c) => c.id === D.current);
    const pdf = buildPdf(sheetsOf(entry), { title: `${entry.number} ${entry.title}`, author: meta.author, subject: meta.project });
    status((await saveFile(`${fileBase(entry)}.pdf`, pdf, 'application/pdf')).msg);
  });
  $('btn-doc-svg').addEventListener('click', async () => {
    const entry = catalog().find((c) => c.id === D.current);
    const svg = sheetToSVG(sheetsOf(entry)[D.sheetIdx]);
    const suffix = sheetsOf(entry).length > 1 ? `_f${D.sheetIdx + 1}` : '';
    status((await saveFile(`${fileBase(entry)}${suffix}.svg`, svg, 'image/svg+xml')).msg);
  });
  $('btn-doc-csv').addEventListener('click', async () => {
    const entry = catalog().find((c) => c.id === D.current);
    status((await saveFile(`${fileBase(entry)}.csv`, csvFor(model(), entry), 'text/csv')).msg);
  });
  $('btn-pkg').addEventListener('click', async () => {
    const btn = $('btn-pkg');
    btn.disabled = true;
    status('Generazione del pacchetto…');
    await new Promise((r) => setTimeout(r, 20));
    try {
      const M = model();
      const cat = catalog();
      const all = [];
      const counts = {};
      for (const c of cat) {
        const sh = buildDocument(M, c);
        counts[c.id] = sh.length;
        all.push(...sh);
      }
      const reg = registerSheets(M, cat, counts);
      const pdf = buildPdf([...reg, ...all], { title: `${meta.project} – elaborati di ingegneria rev. ${meta.rev}`, author: meta.author, subject: meta.project });
      const res = await saveFile(`${meta.prefix || 'CCGT'}_pacchetto_elaborati_rev${meta.rev || 'A'}.pdf`, pdf, 'application/pdf');
      status(res.ok ? `${res.msg} (${reg.length + all.length} fogli A3)` : res.msg);
    } catch (e) {
      status(`Errore nella generazione: ${e.message}`);
    } finally {
      btn.disabled = false;
    }
  });

  renderList();
  // generazione differita per non rallentare il primo disegno della pagina
  setTimeout(renderCurrent, 50);

  return {
    /** Da chiamare quando cambia il progetto. */
    invalidate() {
      D.sig = '';
      D.model = null;
      renderCurrent();
    },
  };
}
