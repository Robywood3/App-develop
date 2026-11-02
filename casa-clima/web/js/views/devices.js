// Pagina "Dispositivi": tutte le entità con i loro comandi, per stanza o per dispositivo.
import { icon } from '../icons.js';
import { store } from '../store.js';
import { esc, entityRow } from '../ui.js';
import { scheduleRender } from '../app.js';

const FILTERS = [
  { key: 'all', label: 'Tutti', test: () => true },
  { key: 'climate', label: 'Clima', test: (d) => d === 'climate' },
  { key: 'light', label: 'Luci e prese', test: (d) => d === 'light' || d === 'switch' },
  { key: 'cover', label: 'Tapparelle', test: (d) => d === 'cover' },
  { key: 'sensor', label: 'Sensori', test: (d) => d === 'sensor' || d === 'binary_sensor' || d === 'weather' },
  { key: 'other', label: 'Altro', test: (d) => ['lock', 'button', 'number', 'select', 'scene'].includes(d) }
];

const ui = { filter: 'all', group: 'area', q: '' };
try { Object.assign(ui, JSON.parse(localStorage.getItem('cc.devices') || '{}'), { q: '' }); } catch { /* ignora */ }
const save = () => { try { localStorage.setItem('cc.devices', JSON.stringify({ filter: ui.filter, group: ui.group })); } catch { /* ignora */ } };

export const devicesView = {
  title: 'Dispositivi',
  live: (kind) => kind !== 'logbook',
  actions: {
    filter: (el) => { ui.filter = el.dataset.key; save(); scheduleRender(0); },
    group: (el) => { ui.group = el.dataset.key; save(); scheduleRender(0); }
  },
  mount(root) {
    const input = root.querySelector('#dev-search');
    input.value = ui.q;
    input.oninput = () => {
      ui.q = input.value;
      const q = ui.q.trim().toLowerCase();
      for (const row of root.querySelectorAll('.ent[data-entity]')) {
        const text = `${row.dataset.entity} ${row.textContent}`.toLowerCase();
        row.style.display = !q || text.includes(q) ? '' : 'none';
      }
      for (const card of root.querySelectorAll('[data-group-card]')) {
        card.style.display = [...card.querySelectorAll('.ent')].some((r) => r.style.display !== 'none') ? '' : 'none';
      }
    };
    if (ui.q) input.oninput();
  },
  render() {
    const f = FILTERS.find((x) => x.key === ui.filter) || FILTERS[0];
    const states = [...store.states.values()]
      .filter((s) => !s.entity_id.startsWith('select.casa_clima') && !s.entity_id.startsWith('automation.'))
      .filter((s) => f.test(s.entity_id.split('.')[0]));

    const groups = new Map();
    const devName = new Map();
    for (const d of store.devices) for (const id of d.entities) devName.set(id, d);
    for (const st of states) {
      let key;
      if (ui.group === 'area') key = st.attributes.area || 'Senza stanza';
      else key = devName.get(st.entity_id)?.name || (st.entity_id.startsWith('scene.') ? 'Scene' : 'Altro');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(st);
    }
    const order = [...groups.keys()].sort((a, b) => (a === 'Senza stanza') - (b === 'Senza stanza') || a.localeCompare(b));
    const domainOrder = ['climate', 'light', 'switch', 'cover', 'lock', 'sensor', 'binary_sensor', 'number', 'select', 'button', 'scene', 'weather'];
    const sortEnt = (a, b) => domainOrder.indexOf(a.entity_id.split('.')[0]) - domainOrder.indexOf(b.entity_id.split('.')[0]) || a.attributes.friendly_name.localeCompare(b.attributes.friendly_name);

    return `
      <div class="page-head"><div><h1>Dispositivi</h1><div class="sub">${store.devices.length} dispositivi · ${states.length} entità</div></div></div>
      <div class="toolbar">
        <div class="search">${icon('search')}<input class="input" id="dev-search" placeholder="Cerca per nome o ID…" autocomplete="off"></div>
        <div class="seg compact">${[['area', 'Per stanza'], ['device', 'Per dispositivo']].map(([k, l]) => `<button class="${ui.group === k ? 'active' : ''}" data-act="group" data-key="${k}">${l}</button>`).join('')}</div>
      </div>
      <div class="row wrap" style="margin-bottom:16px">${FILTERS.map((x) => `<button class="chip ${ui.filter === x.key ? 'accent' : ''}" style="cursor:pointer" data-act="filter" data-key="${x.key}">${x.label}</button>`).join('')}</div>
      ${order.length ? `<div class="grid two">${order.map((g) => `<div class="card" data-group-card><div class="card-head"><h3 style="flex:1">${esc(g)}</h3><span class="tiny muted">${groups.get(g).length}</span></div><div class="list">${groups.get(g).sort(sortEnt).map((st) => entityRow(st)).join('')}</div></div>`).join('')}</div>`
        : `<div class="card empty">${icon('grid')}<div>Nessun dispositivo in questa categoria.</div></div>`}
    `;
  }
};
