// Pagina "Storico": grafici di temperature, umidità, energia e di qualunque entità numerica.
import { icon } from '../icons.js';
import { store, api } from '../store.js';
import { esc, lineChart, legendHTML, PALETTE, isNum } from '../ui.js';
import { scheduleRender } from '../app.js';

const ui = { hours: 24, extra: [], hidden: new Set() };
try { ui.extra = JSON.parse(localStorage.getItem('cc.history.extra') || '[]'); } catch { /* ignora */ }
let cache = { key: '', data: {}, at: 0 };

function roomSeries(rooms, data) {
  return rooms.map((r, i) => {
    const sid = r.sensors[0] || r.climates[0];
    return { name: r.name, color: PALETTE[i % PALETTE.length], points: (data[sid] || []).map((p) => [p[0], p[1]]), unit: '°' };
  }).filter((s) => s.points.some((p) => isNum(p[1])));
}

export const historyView = {
  title: 'Storico',
  live: (kind) => kind === 'integrations',
  actions: {
    range: (el) => { ui.hours = Number(el.dataset.h); cache.key = ''; scheduleRender(0); },
    legend: (el) => { const n = el.dataset.name; if (ui.hidden.has(n)) ui.hidden.delete(n); else ui.hidden.add(n); scheduleRender(0); },
    'add-series': () => {
      const input = document.getElementById('hist-add');
      const id = input.value.trim();
      if (!id || !store.states.has(id) || ui.extra.includes(id)) return;
      ui.extra.push(id);
      try { localStorage.setItem('cc.history.extra', JSON.stringify(ui.extra)); } catch { /* ignora */ }
      cache.key = '';
      scheduleRender(0);
    },
    'remove-series': (el) => {
      ui.extra = ui.extra.filter((x) => x !== el.dataset.id);
      try { localStorage.setItem('cc.history.extra', JSON.stringify(ui.extra)); } catch { /* ignora */ }
      scheduleRender(0);
    },
    'refresh-history': () => { cache.key = ''; scheduleRender(0); }
  },
  async render() {
    const cc = store.cc;
    const rooms = cc.rooms;
    const outdoorId = store.states.has('sensor.meteo_temperatura') ? 'sensor.meteo_temperatura' : [...store.states.values()].find((s) => s.attributes.device_class === 'temperature' && /estern/i.test(s.attributes.friendly_name))?.entity_id;
    const humIds = rooms.map((r) => r.humidity[0]).filter(Boolean);
    const ids = new Set([...rooms.flatMap((r) => [r.sensors[0], ...r.climates]).filter(Boolean), outdoorId, ...humIds, cc.energy.grid_power, cc.energy.pv_power, ...ui.extra].filter(Boolean));
    const key = `${[...ids].join(',')}|${ui.hours}`;
    if (cache.key !== key || Date.now() - cache.at > 60_000) {
      try {
        cache = { key, data: await api('GET', `/api/history?entity_id=${encodeURIComponent([...ids].join(','))}&hours=${ui.hours}`), at: Date.now() };
      } catch (err) {
        return `<div class="error-box">${esc(err.message)}</div>`;
      }
    }
    const data = cache.data;
    const opts = { hours: ui.hours, hidden: ui.hidden };

    const temps = roomSeries(rooms, data);
    if (outdoorId && data[outdoorId]?.length) temps.push({ name: 'Esterno', color: '#9aa3b2', points: data[outdoorId], unit: '°', dashed: true });

    const hums = rooms.map((r, i) => ({ name: `Umidità ${r.name}`, color: PALETTE[i % PALETTE.length], points: r.humidity[0] ? data[r.humidity[0]] || [] : [], unit: '%' })).filter((s) => s.points.length);

    // attività: percentuale di tempo in cui la stanza scalda/raffresca, dal recorder dei climatizzatori
    const activity = rooms.map((r) => {
      let on = 0;
      let total = 0;
      for (const cid of r.climates) {
        const pts = data[cid] || [];
        const t0 = Date.now() - ui.hours * 3600_000;
        for (let i = 0; i < pts.length; i++) {
          const start = Math.max(pts[i][0], t0);
          const end = i + 1 < pts.length ? pts[i + 1][0] : Date.now();
          if (end <= start) continue;
          total += end - start;
          if (pts[i][3]) on += end - start;
        }
      }
      return { name: r.name, pct: total ? Math.round((on / total) * 100) : null };
    });

    const energy = [];
    if (cc.energy.grid_power && data[cc.energy.grid_power]) energy.push({ name: 'Consumo', color: PALETTE[0], points: data[cc.energy.grid_power], unit: 'W', fill: true });
    if (cc.energy.pv_power && data[cc.energy.pv_power]) energy.push({ name: 'Fotovoltaico', color: PALETTE[4], points: data[cc.energy.pv_power], unit: 'W', fill: true });

    const extra = ui.extra.filter((id) => store.states.has(id)).map((id, i) => {
      const st = store.states.get(id);
      const pts = (data[id] || []).map((p) => [p[0], p[1]]);
      return { id, name: st.attributes.friendly_name, color: PALETTE[(i + 2) % PALETTE.length], points: pts, unit: st.attributes.unit_of_measurement === '°C' ? '°' : st.attributes.unit_of_measurement || '' };
    });
    const numeric = [...store.states.values()].filter((s) => isNum(s.state) || s.entity_id.startsWith('climate.'));

    return `
      <div class="page-head"><div style="flex:1"><h1>Storico</h1><div class="sub">Dati registrati da Casa Clima (al massimo un punto al minuto)</div></div>
        <div class="seg compact">${[[6, '6 ore'], [24, '24 ore'], [72, '3 giorni'], [168, '7 giorni']].map(([h, l]) => `<button class="${ui.hours === h ? 'active' : ''}" data-act="range" data-h="${h}">${l}</button>`).join('')}</div>
        <button class="btn icon" data-act="refresh-history" title="Aggiorna">${icon('refresh')}</button>
      </div>
      <div class="card"><div class="card-head">${icon('thermometer')}<h3>Temperature</h3></div>${lineChart(temps, { ...opts, height: 260 })}${legendHTML(temps, ui.hidden)}</div>
      <div class="grid two" style="margin-top:14px">
        <div class="card"><div class="card-head">${icon('flame')}<h3>Tempo di funzionamento</h3></div>
          ${activity.length ? `<div class="energy-bars">${activity.map((a) => `<div class="ebar"><div class="row small"><span class="muted spacer">${esc(a.name)}</span><b class="num">${a.pct === null ? '–' : `${a.pct}%`}</b></div><div class="track"><div class="fill" style="width:${a.pct || 0}%;background:${cc.season.effective === 'cool' ? 'var(--cool)' : 'var(--heat)'}"></div></div></div>`).join('')}</div>` : '<div class="empty small">Nessuna stanza</div>'}
          <p class="tiny faint" style="margin:12px 0 0">Percentuale del periodo in cui almeno un dispositivo della stanza stava scaldando o raffrescando.</p></div>
        ${hums.length ? `<div class="card"><div class="card-head">${icon('droplet')}<h3>Umidità</h3></div>${lineChart(hums, { ...opts, height: 200 })}${legendHTML(hums, ui.hidden)}</div>` : ''}
      </div>
      ${energy.length ? `<div class="card" style="margin-top:14px"><div class="card-head">${icon('bolt')}<h3>Energia</h3></div>${lineChart(energy, { ...opts, height: 220, yMin: 0 })}${legendHTML(energy, ui.hidden)}</div>` : ''}
      <div class="section-title">${icon('chart')}Grafici personalizzati</div>
      <div class="card">
        <div class="row wrap">
          <input class="input" id="hist-add" list="hist-entities" placeholder="Aggiungi un'entità numerica (es. sensor.…)" style="flex:1;min-width:220px">
          <datalist id="hist-entities">${numeric.map((s) => `<option value="${esc(s.entity_id)}">${esc(s.attributes.friendly_name)}</option>`).join('')}</datalist>
          <button class="btn primary" data-act="add-series">${icon('plus')}Aggiungi</button>
        </div>
        ${extra.map((s) => `<div style="margin-top:16px"><div class="row"><b class="spacer">${esc(s.name)}</b><button class="btn icon sm ghost" data-act="remove-series" data-id="${esc(s.id)}">${icon('x')}</button></div>${lineChart([s], { hours: ui.hours, height: 160 })}</div>`).join('')}
      </div>
    `;
  }
};
