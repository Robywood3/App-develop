// Pagina "Integrazioni": collega Tesla, Daikin, Netatmo, tado°, Shelly, meteo... (come i "config flow" di HA).
import { icon } from '../icons.js';
import { store, api } from '../store.js';
import { esc, toast, openModal, closeModal, confirmBox, copyText, relTime } from '../ui.js';
import { scheduleRender } from '../app.js';

const TYPE_ICON = { car: 'car', snowflake: 'snowflake', thermometer: 'thermometer', plug: 'plug', sun: 'sun', flask: 'flask', bolt: 'bolt' };
let types = null;

async function loadTypes() {
  if (!types) types = (await api('GET', '/api/integrations')).types;
  return types;
}
const typeOf = (t) => types?.find((x) => x.type === t) || { name: t, fields: [] };

function needsAuth(entry) {
  const t = typeOf(entry.type);
  if (!t.auth) return false;
  if (t.authWhen && entry.options[t.authWhen.field] !== t.authWhen.value) {
    // con Tesla+Teslemetry l'accesso è il token
    return false;
  }
  return true;
}

function statusChip(e) {
  const s = e.status?.state;
  if (!e.enabled) return '<span class="chip">Disattivata</span>';
  if (s === 'ok') return `<span class="chip ok">${icon('check')}Connessa</span>`;
  if (s === 'auth') return `<span class="chip warn">${icon('key')}Accesso richiesto</span>`;
  if (s === 'error') return `<span class="chip err">${icon('alert')}Errore</span>`;
  return '<span class="chip">Avvio…</span>';
}

function fieldHTML(f, value) {
  const v = value ?? f.default ?? '';
  const common = `name="${esc(f.key)}" ${f.required ? 'data-required' : ''}`;
  let input;
  if (f.type === 'textarea') input = `<textarea class="input" ${common} rows="4" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
  else if (f.type === 'select') input = `<select class="input" ${common}>${f.options.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(v) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
  else if (f.type === 'checkbox') return `<label class="row"><input type="checkbox" ${common} ${v ? 'checked' : ''}> ${esc(f.label)}</label>`;
  else input = `<input class="input" type="${f.type === 'password' ? 'password' : f.type === 'number' ? 'number' : 'text'}" step="any" ${common} value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" autocomplete="off">`;
  return `<div class="field" data-field="${esc(f.key)}"><label>${esc(f.label)}${f.required ? ' *' : ''}</label>${input}${f.help ? `<div class="help">${esc(f.help)}</div>` : ''}</div>`;
}

function formModal({ type, entry }) {
  const t = typeOf(type);
  const redirect = `${store.info?.public_url || location.origin}/api/oauth/callback`;
  const m = openModal(`<div class="modal-head"><div class="ico-wrap on">${icon(TYPE_ICON[t.icon] || 'puzzle')}</div><h2>${entry ? 'Modifica' : 'Aggiungi'} ${esc(t.name)}</h2><button class="btn icon ghost" data-close>${icon('x')}</button></div>
    <form class="form">
      ${t.description ? `<p class="muted small" style="margin:0">${esc(t.description)}</p>` : ''}
      ${t.docs ? `<div class="info-box">${esc(t.docs)}</div>` : ''}
      ${t.auth === 'oauth' ? `<div class="field"><label>Redirect URI da registrare nell'app dello sviluppatore</label><div class="copy"><input class="input mono" readonly value="${esc(redirect)}"><button type="button" class="btn icon" data-copy="${esc(redirect)}">${icon('copy')}</button></div></div>` : ''}
      <div class="field"><label>Nome</label><input class="input" name="__title" value="${esc(entry?.title || t.name)}"></div>
      ${t.fields.map((f) => fieldHTML(f, entry?.options[f.key])).join('')}
      <div class="error-box hidden" data-err></div>
      <div class="row"><span class="spacer"></span><button type="button" class="btn" data-close>Annulla</button><button class="btn primary" type="submit">${entry ? 'Salva' : 'Aggiungi'}</button></div>
    </form>`, { wide: true });
  m.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => closeModal(); });
  m.querySelector('[data-copy]')?.addEventListener('click', (e) => copyText(e.currentTarget.dataset.copy));
  // con Tesla mostra solo i campi del collegamento scelto
  const providerSel = m.querySelector('[name="provider"]');
  const syncTesla = () => {
    if (!providerSel) return;
    const fleet = providerSel.value === 'fleet';
    for (const k of ['region', 'client_id', 'client_secret', 'refresh_token', 'command_proxy', 'redirect_uri']) m.querySelector(`[data-field="${k}"]`)?.classList.toggle('hidden', !fleet);
    m.querySelector('[data-field="token"]')?.classList.toggle('hidden', fleet);
  };
  providerSel?.addEventListener('change', syncTesla);
  syncTesla();
  m.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const err = m.querySelector('[data-err]');
    err.classList.add('hidden');
    const fd = new FormData(e.target);
    const options = {};
    for (const f of t.fields) {
      if (f.type === 'checkbox') options[f.key] = e.target.querySelector(`[name="${f.key}"]`).checked;
      else options[f.key] = fd.get(f.key);
    }
    try {
      const body = { type, title: fd.get('__title'), options };
      const saved = entry ? await api('PUT', `/api/integrations/${entry.id}`, body) : await api('POST', '/api/integrations', body);
      closeModal();
      toast(entry ? 'Integrazione aggiornata' : 'Integrazione aggiunta', 'ok');
      scheduleRender(0);
      if (!entry && needsAuth(saved) && !saved.logged_in && !(saved.options.refresh_token)) setTimeout(() => startAuth(saved.id), 400);
    } catch (ex) {
      err.textContent = ex.message;
      err.classList.remove('hidden');
    }
  };
}

function typePicker() {
  const m = openModal(`<div class="modal-head"><h2>Aggiungi integrazione</h2><button class="btn icon ghost" data-close>${icon('x')}</button></div>
    <div class="type-grid">${types.map((t) => `<button class="type-card" data-type="${esc(t.type)}"><div class="ico-wrap on">${icon(TYPE_ICON[t.icon] || 'puzzle')}</div><div><b>${esc(t.name)}</b><p>${esc(t.description || '')}</p></div></button>`).join('')}</div>`, { wide: true });
  m.querySelector('[data-close]').onclick = () => closeModal();
  m.querySelectorAll('[data-type]').forEach((b) => { b.onclick = () => formModal({ type: b.dataset.type }); });
}

async function startAuth(id) {
  let res;
  try { res = await api('POST', `/api/integrations/${id}/auth`); } catch (err) { return toast(err.message, 'err', 7000); }
  if (res.kind === 'device') {
    window.open(res.url, '_blank', 'noopener');
    scheduleRender(0);
    return;
  }
  window.open(res.url, '_blank', 'noopener');
  const m = openModal(`<div class="modal-head"><div class="ico-wrap on">${icon('key')}</div><h2>Accedi</h2><button class="btn icon ghost" data-close>${icon('x')}</button></div>
    <div class="form">
      <p class="small" style="margin:0">Si è aperta la pagina di accesso del produttore. Dopo aver confermato verrai riportato a Casa Clima e l'integrazione si collegherà da sola.</p>
      <p class="small muted" style="margin:0">Se la pagina non si è aperta: <a href="${esc(res.url)}" target="_blank" rel="noopener">apri il login ${icon('external')}</a></p>
      <div class="field"><label>Se il ritorno non funziona (pagina non raggiungibile), incolla qui l'indirizzo completo della pagina finale</label>
        <input class="input mono" data-code placeholder="https://…/callback?code=…&state=…"></div>
      <div class="help small">Redirect URI usato: <code>${esc(res.redirect_uri)}</code></div>
      <div class="row"><span class="spacer"></span><button class="btn" data-close>Chiudi</button><button class="btn primary" data-send>Conferma codice</button></div>
    </div>`);
  m.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => closeModal(); });
  m.querySelector('[data-send]').onclick = async () => {
    try {
      await api('POST', `/api/integrations/${id}/auth/code`, { input: m.querySelector('[data-code]').value });
      closeModal();
      toast('Accesso completato', 'ok');
    } catch (err) { toast(err.message, 'err', 7000); }
  };
}

window.addEventListener('message', (e) => {
  if (e.data === 'casa-clima-auth') { closeModal(); toast('Accesso completato', 'ok'); }
});

async function showWebhooks(id) {
  const list = await api('GET', `/api/integrations/${id}/webhooks`);
  const m = openModal(`<div class="modal-head"><h2>Indirizzi dei sensori</h2><button class="btn icon ghost" data-close>${icon('x')}</button></div>
    <p class="small muted">Inseriscili nelle "Azioni" (Shelly: <i>Actions → URL</i>) del dispositivo. Per le finestre usa <code>state=open</code> all'apertura e <code>state=close</code> alla chiusura; per temperatura e umidità <code>temp=</code> e <code>hum=</code>.</p>
    <div class="stack">${list.map((w) => `<div class="field"><label>${esc(w.name)} (${esc(w.type)})</label><div class="copy"><input class="input mono" readonly value="${esc(w.url)}"><button class="btn icon" data-copy="${esc(w.url)}">${icon('copy')}</button></div></div>`).join('') || '<div class="muted">Nessun sensore</div>'}</div>`, { wide: true });
  m.querySelector('[data-close]').onclick = () => closeModal();
  m.querySelectorAll('[data-copy]').forEach((b) => { b.onclick = () => copyText(b.dataset.copy); });
}

export const integrationsView = {
  title: 'Integrazioni',
  live: (kind) => kind === 'integrations',
  actions: {
    'integ-add': () => typePicker(),
    'integ-edit': (el) => formModal({ type: el.dataset.type, entry: store.integrations.find((e) => e.id === el.dataset.id) }),
    'integ-auth': (el) => startAuth(el.dataset.id),
    'integ-reload': async (el) => {
      try { await api('POST', `/api/integrations/${el.dataset.id}/reload`); toast('Ricaricata', 'ok'); } catch (err) { toast(err.message, 'err'); }
    },
    'integ-enable': async (el) => {
      try { await api('PUT', `/api/integrations/${el.dataset.id}`, { enabled: el.dataset.on === '1' }); } catch (err) { toast(err.message, 'err'); }
    },
    'integ-delete': async (el) => {
      const e = store.integrations.find((x) => x.id === el.dataset.id);
      if (!(await confirmBox(`Eliminare "${e?.title}"? Le sue entità spariranno.`, { ok: 'Elimina', danger: true }))) return;
      try { await api('DELETE', `/api/integrations/${el.dataset.id}`); toast('Eliminata', 'ok'); } catch (err) { toast(err.message, 'err'); }
    },
    'integ-webhooks': (el) => showWebhooks(el.dataset.id).catch((err) => toast(err.message, 'err'))
  },
  async render() {
    await loadTypes();
    const entries = store.integrations;
    return `
      <div class="page-head"><div style="flex:1"><h1>Integrazioni</h1><div class="sub">I servizi e gli apparecchi collegati a Casa Clima</div></div>
        <button class="btn primary" data-act="integ-add">${icon('plus')}Aggiungi</button></div>
      ${entries.length ? `<div class="grid wide">${entries.map((e) => {
        const t = typeOf(e.type);
        const df = e.device_flow;
        return `<div class="card">
          <div class="integ-head">
            <div class="ico-wrap ${e.status?.state === 'ok' ? 'on' : ''}">${icon(TYPE_ICON[t.icon] || 'puzzle')}</div>
            <div style="flex:1;min-width:0"><div class="title" style="font-weight:600">${esc(e.title)}</div><div class="tiny muted">${esc(t.name)} · ${e.entities} entità</div></div>
            ${statusChip(e)}
          </div>
          ${e.enabled && e.status?.message ? `<p class="small ${e.status.state === 'error' ? '' : 'muted'}" style="margin:12px 0 0;${e.status.state === 'error' ? 'color:var(--danger)' : ''}">${esc(e.status.message)}${e.status.updated ? ` <span class="faint">· ${relTime(e.status.updated)}</span>` : ''}</p>` : ''}
          ${df && df.status === 'pending' ? `<div class="stack" style="margin-top:12px"><div class="small">Conferma questo codice sulla pagina tado°:</div><div class="code-big">${esc(df.user_code)}</div><a class="btn" href="${esc(df.url)}" target="_blank" rel="noopener">${icon('external')}Apri pagina di conferma</a><div class="tiny muted">In attesa di conferma…</div></div>` : ''}
          ${df && df.status !== 'pending' && df.status !== 'done' ? `<div class="warn-box" style="margin-top:12px">${df.status === 'expired' ? 'Codice scaduto: premi di nuovo Accedi.' : esc(df.message || 'Errore')}</div>` : ''}
          <div class="integ-actions">
            ${needsAuth(e) && e.enabled ? `<button class="btn sm ${e.status?.state === 'auth' ? 'primary' : ''}" data-act="integ-auth" data-id="${esc(e.id)}">${icon('key')}${e.logged_in ? 'Accedi di nuovo' : 'Accedi'}</button>` : ''}
            ${e.type === 'webhook' ? `<button class="btn sm" data-act="integ-webhooks" data-id="${esc(e.id)}">${icon('link')}Indirizzi</button>` : ''}
            <button class="btn sm" data-act="integ-edit" data-id="${esc(e.id)}" data-type="${esc(e.type)}">${icon('edit')}Modifica</button>
            ${e.enabled ? `<button class="btn sm" data-act="integ-reload" data-id="${esc(e.id)}">${icon('refresh')}Ricarica</button>` : ''}
            <button class="btn sm" data-act="integ-enable" data-id="${esc(e.id)}" data-on="${e.enabled ? '0' : '1'}">${icon('power')}${e.enabled ? 'Disattiva' : 'Attiva'}</button>
            <button class="btn sm ghost danger" data-act="integ-delete" data-id="${esc(e.id)}">${icon('trash')}</button>
          </div>
        </div>`;
      }).join('')}</div>` : `<div class="card empty">${icon('puzzle')}<div>Nessuna integrazione. Premi <b>Aggiungi</b> per collegare i tuoi apparecchi.</div></div>`}
      <div class="section-title">${icon('info')}Disponibili</div>
      <div class="type-grid">${types.map((t) => `<button class="type-card" data-act="integ-new" data-type="${esc(t.type)}"><div class="ico-wrap">${icon(TYPE_ICON[t.icon] || 'puzzle')}</div><div><b>${esc(t.name)}</b><p>${esc(t.description || '')}</p></div></button>`).join('')}</div>
    `;
  }
};
integrationsView.actions['integ-new'] = (el) => formModal({ type: el.dataset.type });
