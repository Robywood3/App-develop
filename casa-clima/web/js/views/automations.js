// Pagina "Automazioni": automazioni e scene del pacchetto Casa-Clima, più il registro eventi.
import { icon } from '../icons.js';
import { store, api } from '../store.js';
import { esc, relTime, clock, svc, toast } from '../ui.js';
import { scheduleRender } from '../app.js';

const DAYS = { mon: 'lun', tue: 'mar', wed: 'mer', thu: 'gio', fri: 'ven', sat: 'sab', sun: 'dom' };

function describeTrigger(t) {
  const ids = (t.entity_id || []).map((id) => store.states.get(id)?.attributes.friendly_name || id).join(', ');
  const forTxt = t.for ? ` per ${typeof t.for === 'object' ? JSON.stringify(t.for) : t.for}` : '';
  switch (t.platform) {
    case 'time': return `alle ${[].concat(t.at).join(', ')}${t.weekday ? ` (${[].concat(t.weekday).map((d) => DAYS[d] || d).join(', ')})` : ''}`;
    case 'state': return `${ids}${t.to !== undefined ? ` diventa "${[].concat(t.to).join('/')}"` : ' cambia'}${forTxt}`;
    case 'numeric_state': return `${ids}${t.above !== undefined ? ` sopra ${t.above}` : ''}${t.below !== undefined ? ` sotto ${t.below}` : ''}${forTxt}`;
    case 'time_pattern': return `ogni ${t.minutes ? `${t.minutes} min` : t.hours ? `${t.hours} h` : `${t.seconds} s`}`.replace('/', '');
    case 'homeassistant': return 'all\'avvio';
    default: return t.platform;
  }
}

export const automationsView = {
  title: 'Automazioni',
  live: (kind) => kind === 'logbook',
  actions: {
    'auto-toggle': (el) => svc('automation', el.checked ? 'turn_on' : 'turn_off', { entity_id: el.dataset.id }),
    'auto-run': (el) => svc('automation', 'trigger', { entity_id: el.dataset.id }, { ok: 'Automazione eseguita' }),
    'reload-packages': async () => {
      try {
        const r = await api('POST', '/api/packages/reload');
        toast(r.errors.length ? `Ricaricato con ${r.errors.length} errori` : `Ricaricato: ${r.automations} automazioni, ${r.scenes} scene`, r.errors.length ? 'err' : 'ok');
        scheduleRender(0);
      } catch (err) { toast(err.message, 'err'); }
    }
  },
  async render() {
    let data;
    try { data = await api('GET', '/api/automations'); } catch (err) { return `<div class="error-box">${esc(err.message)}</div>`; }
    const scenes = [...store.states.values()].filter((s) => s.entity_id.startsWith('scene.'));
    return `
      <div class="page-head"><div style="flex:1"><h1>Automazioni</h1><div class="sub">Definite nel pacchetto Casa-Clima (sintassi compatibile con Home Assistant)</div></div>
        <button class="btn" data-act="reload-packages">${icon('refresh')}Ricarica</button>
        <a class="btn primary" href="#/impostazioni/pacchetti">${icon('edit')}Modifica pacchetto</a>
      </div>
      ${data.errors.length ? `<div class="error-box" style="margin-bottom:14px">${data.errors.map(esc).join('\n')}</div>` : ''}
      <div class="card"><div class="list">
        ${data.automations.map((a) => {
          const st = store.states.get(a.entity_id);
          const last = st?.attributes.last_triggered || a.last_triggered;
          return `<div class="auto-row">
            <div class="ico-wrap ${a.enabled ? 'on' : ''}">${icon('zap')}</div>
            <div class="info">
              <div class="name" style="font-weight:600">${esc(a.alias)}</div>
              <div class="small muted">Quando ${esc(a.triggers.map(describeTrigger).join(' oppure '))}${a.conditions.length ? ` · ${a.conditions.length} condizioni` : ''}</div>
              <div class="tiny faint">Ultima esecuzione: ${relTime(last)}${st?.attributes.running ? ' · <b>in esecuzione</b>' : ''}</div>
            </div>
            <button class="btn icon sm" data-act="auto-run" data-id="${esc(a.entity_id)}" title="Esegui ora">${icon('play')}</button>
            <label class="switch" title="${a.enabled ? 'Disattiva' : 'Attiva'}"><input type="checkbox" data-act="auto-toggle" data-id="${esc(a.entity_id)}" ${st?.state === 'on' ? 'checked' : ''}><span></span></label>
          </div>`;
        }).join('') || `<div class="empty">${icon('zap')}<div>Nessuna automazione nel pacchetto.</div></div>`}
      </div></div>
      ${scenes.length ? `<div class="section-title">${icon('play')}Scene</div><div class="grid">${scenes.map((s) => `<div class="card"><div class="row"><div class="ico-wrap">${icon('play')}</div><div style="flex:1;min-width:0"><b>${esc(s.attributes.friendly_name)}</b><div class="tiny muted">Ultima: ${relTime(s.state)}</div></div><button class="btn sm primary" data-act="scene" data-id="${esc(s.entity_id)}">Attiva</button></div></div>`).join('')}</div>` : ''}
      <div class="section-title">${icon('list')}Registro</div>
      <div class="card"><div class="logbook">${store.logbook.slice(0, 80).map((l) => `<div><time>${clock(l.when)}</time><span><b>${esc(l.name || l.entity_id || '')}</b> ${esc(l.message)}</span></div>`).join('') || '<div class="muted">Nessun evento.</div>'}</div></div>
    `;
  }
};
