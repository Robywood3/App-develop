// Pagina "Clima": tutti i termostati e climatizzatori, raggruppati per stanza.
import { icon } from '../icons.js';
import { store, deviceOf } from '../store.js';
import { esc, thermostatCard, fmtTemp } from '../ui.js';

export const climaView = {
  title: 'Clima',
  render() {
    const climates = [...store.states.values()].filter((s) => s.entity_id.startsWith('climate.') && deviceOf(s.entity_id)?.kind !== 'vehicle');
    const groups = new Map();
    for (const st of climates) {
      const area = st.attributes.area || 'Senza stanza';
      if (!groups.has(area)) groups.set(area, []);
      groups.get(area).push(st);
    }
    const rooms = new Map((store.cc?.rooms || []).map((r) => [r.name, r]));
    const ordered = [...groups.entries()].sort((a, b) => (a[0] === 'Senza stanza') - (b[0] === 'Senza stanza') || a[0].localeCompare(b[0]));
    const cc = store.cc;
    return `
      <div class="page-head"><div style="flex:1"><h1>Clima</h1>
        <div class="sub">${climates.length} dispositivi · profilo <b>${esc(cc.profiles.find((p) => p.key === cc.profile)?.name || cc.profile)}</b> · ${cc.season.effective === 'cool' ? 'raffrescamento' : cc.season.effective === 'heat' ? 'riscaldamento' : 'spento'}</div></div>
        <div class="seg compact">${cc.profiles.map((p) => `<button class="${cc.profile === p.key ? 'active' : ''}" data-act="profile" data-profile="${esc(p.key)}">${esc(p.name)}</button>`).join('')}</div>
      </div>
      ${ordered.length ? ordered.map(([area, list]) => {
        const r = rooms.get(area);
        return `<div class="section-title">${icon('home')}${esc(area)}${r ? `<span class="chip">${fmtTemp(r.temperature)}${r.humidity !== null ? ` · ${r.humidity}%` : ''}</span>${r.window_open ? `<span class="chip warn">${icon('windowOpen')}Finestra aperta</span>` : ''}` : ''}</div>
          <div class="grid wide">${list.map((st) => thermostatCard(st)).join('')}</div>`;
      }).join('') : `<div class="card empty">${icon('thermometer')}<div>Nessun termostato o climatizzatore. Aggiungi tado°, Netatmo o Daikin da <a href="#/integrazioni">Integrazioni</a>.</div></div>`}
    `;
  }
};
