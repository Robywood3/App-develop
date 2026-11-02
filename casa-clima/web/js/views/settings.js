// Pagina "Impostazioni": generale, stanze, pacchetti YAML, sicurezza.
import { icon } from '../icons.js';
import { store, api } from '../store.js';
import { esc, toast, copyText, confirmBox, relTime } from '../ui.js';
import { scheduleRender } from '../app.js';

const TABS = [
  { key: 'generale', label: 'Generale' },
  { key: 'stanze', label: 'Stanze' },
  { key: 'pacchetti', label: 'Pacchetti' },
  { key: 'sicurezza', label: 'Sicurezza' }
];
let editor = { file: null, content: null, dirty: false };

function tab() {
  const sub = location.hash.split('/')[2];
  return TABS.find((t) => t.key === sub) ? sub : 'generale';
}

function theme() {
  try { return localStorage.getItem('cc.theme') || 'auto'; } catch { return 'auto'; }
}

async function general() {
  const info = await api('GET', '/api/info');
  store.info = info;
  return `<div class="grid two">
    <div class="card form">
      <h3>Aspetto</h3>
      <div class="seg compact">${[['auto', 'Automatico'], ['dark', 'Scuro'], ['light', 'Chiaro']].map(([k, l]) => `<button class="${theme() === k ? 'active' : ''}" data-act="theme" data-theme="${k}">${l}</button>`).join('')}</div>
      <p class="small muted" style="margin:0">Suggerimento: dal telefono usa "Aggiungi a schermata Home" per usare Casa Clima come un'app.</p>
    </div>
    <form class="card form" data-form="settings">
      <h3>Rete e storico</h3>
      <div class="field"><label>Indirizzo pubblico di Casa Clima</label><input class="input" name="public_url" value="${esc(info.settings.public_url || '')}" placeholder="${esc(info.public_url)}">
        <div class="help">Usato per il ritorno del login (OAuth) e per gli indirizzi dei webhook. Lascia vuoto per l'indirizzo locale: ${esc(info.public_url)}</div></div>
      <div class="field"><label>Giorni di storico</label><input class="input" type="number" min="1" max="90" name="history_days" value="${esc(info.settings.history_days || 7)}"></div>
      <div class="row"><span class="spacer"></span><button class="btn primary">Salva</button></div>
    </form>
    <div class="card">
      <h3>Informazioni</h3>
      <dl class="attrs" style="margin-top:12px">
        <dt>Versione</dt><dd>${esc(info.version)}</dd>
        <dt>Avviato</dt><dd>${relTime(info.started)}</dd>
        <dt>Entità</dt><dd>${store.states.size}</dd>
        <dt>Dispositivi</dt><dd>${store.devices.length}</dd>
        <dt>API</dt><dd><code>GET /api/states</code>, <code>POST /api/services/&lt;dominio&gt;/&lt;servizio&gt;</code></dd>
      </dl>
    </div>
  </div>`;
}

async function rooms() {
  const areas = await api('GET', '/api/areas');
  const devices = [...store.devices].sort((a, b) => (a.area || 'zzz').localeCompare(b.area || 'zzz') || a.name.localeCompare(b.name));
  const effective = (d) => {
    const st = d.entities.map((id) => store.states.get(id)).find(Boolean);
    return st?.attributes.area ?? d.area ?? '';
  };
  return `<div class="info-box" style="margin-bottom:14px">Casa-Clima crea le stanze in automatico raggruppando i dispositivi con la stessa stanza: ad esempio il termostato tado° "Soggiorno", il Daikin "Soggiorno" e la finestra Shelly "Soggiorno". Qui puoi correggere le assegnazioni. Per regole avanzate (chi scalda, chi raffresca, offset) usa la sezione <code>rooms:</code> del pacchetto.</div>
    <datalist id="area-options">${areas.map((a) => `<option value="${esc(a)}">`).join('')}</datalist>
    <div class="card"><div class="list">${devices.map((d) => `<div class="ent">
      <div class="ico-wrap">${icon(d.kind === 'vehicle' ? 'car' : 'grid')}</div>
      <div class="info"><div class="name">${esc(d.name)}</div><div class="sub">${esc(d.manufacturer || '')}${d.model ? ` · ${esc(d.model)}` : ''} · ${d.entities.length} entità</div></div>
      <input class="input" style="max-width:220px" list="area-options" value="${esc(effective(d))}" placeholder="Nessuna stanza" data-device-area="${esc(d.id)}">
    </div>`).join('') || '<div class="empty">Nessun dispositivo</div>'}</div></div>`;
}

async function packages() {
  const { files, errors } = await api('GET', '/api/packages');
  if (!editor.file || !files.includes(editor.file)) {
    editor.file = files.includes('casa-clima.yaml') ? 'casa-clima.yaml' : files[0] || 'casa-clima.yaml';
    editor.content = null;
  }
  if (editor.content === null && files.includes(editor.file)) {
    editor.content = (await api('GET', `/api/packages/${encodeURIComponent(editor.file)}`)).content;
    editor.dirty = false;
  }
  return `<div class="toolbar">
      <select class="input" style="width:auto" data-act="pkg-open">${files.map((f) => `<option ${f === editor.file ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select>
      <button class="btn" data-act="pkg-new">${icon('plus')}Nuovo</button>
      <span class="spacer"></span>
      ${files.length > 1 ? `<button class="btn ghost danger" data-act="pkg-delete">${icon('trash')}</button>` : ''}
      <button class="btn primary" data-act="pkg-save">${icon('check')}Salva e ricarica</button>
    </div>
    ${errors.length ? `<div class="error-box" style="margin-bottom:12px">${errors.map(esc).join('\n')}</div>` : ''}
    <div class="error-box hidden" id="pkg-err" style="margin-bottom:12px"></div>
    <textarea class="input code" id="pkg-text" spellcheck="false">${esc(editor.content ?? '')}</textarea>
    <p class="small muted">I pacchetti sono in <code>data/packages/</code>. Sintassi delle automazioni compatibile con Home Assistant: <code>trigger</code> (state, numeric_state, time, time_pattern), <code>condition</code> (state, numeric_state, time, and/or/not), <code>action</code> (servizi, delay, choose, if/then). Gli ID delle entità li trovi aprendo un dispositivo.</p>`;
}

async function security() {
  const tokens = await api('GET', '/api/auth/tokens');
  return `<div class="grid two">
    <form class="card form" data-form="password">
      <h3>Cambia password</h3>
      <input class="input" type="password" name="current" placeholder="Password attuale" autocomplete="current-password" required>
      <input class="input" type="password" name="password" placeholder="Nuova password (min. 6 caratteri)" autocomplete="new-password" required>
      <div class="row"><span class="spacer"></span><button class="btn primary">Cambia</button></div>
      <p class="tiny muted" style="margin:0">Cambiando password vengono chiuse le sessioni sugli altri dispositivi.</p>
    </form>
    <div class="card form">
      <h3>Token API</h3>
      <p class="small muted" style="margin:0">Per script, Comandi rapidi iOS, Tasker…: <code>Authorization: Bearer &lt;token&gt;</code></p>
      <div class="row"><input class="input" id="token-name" placeholder="Nome (es. Comandi iPhone)"><button class="btn" data-act="token-new">${icon('plus')}Crea</button></div>
      <div class="list">${tokens.map((t) => `<div class="ent"><div class="info"><div class="name">${esc(t.name)}</div><div class="sub">creato ${relTime(new Date(t.created).toISOString())}${t.last ? ` · usato ${relTime(new Date(t.last).toISOString())}` : ''}</div></div><button class="btn icon sm ghost danger" data-act="token-del" data-id="${esc(t.id)}">${icon('trash')}</button></div>`).join('') || '<div class="small faint">Nessun token</div>'}</div>
    </div>
  </div>`;
}

export const settingsView = {
  title: 'Impostazioni',
  live: false,
  actions: {
    theme: (el) => {
      const t = el.dataset.theme;
      try { if (t === 'auto') localStorage.removeItem('cc.theme'); else localStorage.setItem('cc.theme', t); } catch { /* ignora */ }
      if (t === 'auto') delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = t;
      scheduleRender(0);
    },
    'pkg-open': async (el) => {
      if (editor.dirty && !(await confirmBox('Ci sono modifiche non salvate. Continuare?'))) { el.value = editor.file; return; }
      editor = { file: el.value, content: null, dirty: false };
      scheduleRender(0);
    },
    'pkg-new': async () => {
      const name = prompt('Nome del nuovo pacchetto (es. estate.yaml)');
      if (!name) return;
      const file = /\.(ya?ml|json)$/i.test(name) ? name : `${name}.yaml`;
      try {
        await api('PUT', `/api/packages/${encodeURIComponent(file)}`, { content: '# Nuovo pacchetto\nautomations: []\n' });
        editor = { file, content: null, dirty: false };
        scheduleRender(0);
      } catch (err) { toast(err.message, 'err'); }
    },
    'pkg-delete': async () => {
      if (!(await confirmBox(`Eliminare ${editor.file}?`, { ok: 'Elimina', danger: true }))) return;
      try { await api('DELETE', `/api/packages/${encodeURIComponent(editor.file)}`); editor = { file: null, content: null, dirty: false }; scheduleRender(0); } catch (err) { toast(err.message, 'err'); }
    },
    'pkg-save': async () => {
      const text = document.getElementById('pkg-text').value;
      const err = document.getElementById('pkg-err');
      err.classList.add('hidden');
      try {
        const r = await api('PUT', `/api/packages/${encodeURIComponent(editor.file)}`, { content: text });
        editor.content = text;
        editor.dirty = false;
        if (r.errors.length) { err.textContent = r.errors.join('\n'); err.classList.remove('hidden'); toast('Salvato, ma con errori', 'err'); }
        else toast(`Salvato: ${r.automations} automazioni, ${r.scenes} scene`, 'ok');
      } catch (ex) {
        err.textContent = ex.message;
        err.classList.remove('hidden');
      }
    },
    'token-new': async () => {
      const name = document.getElementById('token-name').value || 'Token';
      try {
        const { token } = await api('POST', '/api/auth/tokens', { name });
        copyText(token);
        alert(`Token creato e copiato negli appunti (non verrà più mostrato):\n\n${token}`);
        scheduleRender(0);
      } catch (err) { toast(err.message, 'err'); }
    },
    'token-del': async (el) => {
      if (!(await confirmBox('Revocare questo token?', { ok: 'Revoca', danger: true }))) return;
      await api('DELETE', `/api/auth/tokens/${el.dataset.id}`).catch((err) => toast(err.message, 'err'));
      scheduleRender(0);
    }
  },
  mount(root) {
    const text = root.querySelector('#pkg-text');
    if (text) {
      text.oninput = () => { editor.dirty = true; editor.content = text.value; };
      text.onkeydown = (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const s = text.selectionStart;
          text.setRangeText('  ', s, text.selectionEnd, 'end');
          text.oninput();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); settingsView.actions['pkg-save'](); }
      };
    }
    for (const input of root.querySelectorAll('[data-device-area]')) {
      input.onchange = async () => {
        try {
          await api('PATCH', `/api/devices/${encodeURIComponent(input.dataset.deviceArea)}`, { area: input.value.trim() });
          toast('Stanza aggiornata', 'ok', 1500);
        } catch (err) { toast(err.message, 'err'); }
      };
    }
    root.querySelector('[data-form="settings"]')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api('PUT', '/api/settings', { public_url: fd.get('public_url'), history_days: Number(fd.get('history_days')) });
        toast('Impostazioni salvate', 'ok');
      } catch (err) { toast(err.message, 'err'); }
    });
    root.querySelector('[data-form="password"]')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api('POST', '/api/auth/password', { current: fd.get('current'), password: fd.get('password') });
        toast('Password cambiata', 'ok');
        e.target.reset();
      } catch (err) { toast(err.message, 'err'); }
    });
  },
  async render() {
    const t = tab();
    let body;
    try {
      body = t === 'stanze' ? await rooms() : t === 'pacchetti' ? await packages() : t === 'sicurezza' ? await security() : await general();
    } catch (err) {
      body = `<div class="error-box">${esc(err.message)}</div>`;
    }
    return `<div class="page-head"><div style="flex:1"><h1>Impostazioni</h1></div></div>
      <div class="seg compact" style="margin-bottom:16px;max-width:560px">${TABS.map((x) => `<button class="${t === x.key ? 'active' : ''}" data-act="nav" data-to="impostazioni/${x.key}">${x.label}</button>`).join('')}</div>
      ${body}`;
  }
};
