// Pagina "Casa": il cruscotto Casa-Clima.
import { icon, WEATHER_ICON } from '../icons.js';
import { store, getState, vehicles } from '../store.js';
import { esc, fmtTemp, fmtNum, fmtPower, isNum, actionChip, stateText } from '../ui.js';
import { roomTarget } from '../app.js';

const PROFILE_ICON = { sun: 'sun', leaf: 'leaf', moon: 'moon', away: 'away', calendar: 'calendar', power: 'power', home: 'home' };

function greeting() {
  const h = new Date().getHours();
  return h < 6 ? 'Buonanotte' : h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';
}

function profileCard(cc) {
  const season = cc.season.effective;
  const seasons = ['auto', 'heat', 'cool', 'off'];
  const seasonIcon = { auto: 'season', heat: 'flame', cool: 'snowflake', off: 'power' };
  const seasonLabel = { auto: 'Auto', heat: 'Caldo', cool: 'Freddo', off: 'Spenta' };
  return `<div class="card">
    <div class="card-head">
      <div class="ico-wrap ${season === 'heat' ? 'heat' : season === 'cool' ? 'cool' : ''}">${icon(season === 'cool' ? 'snowflake' : season === 'heat' ? 'flame' : 'power')}</div>
      <div style="flex:1;min-width:0"><h3>Profilo della casa</h3>
        <div class="tiny muted">${season === 'heat' ? 'Riscaldamento' : season === 'cool' ? 'Raffrescamento' : 'Clima spento'}${cc.season.mode === 'auto' ? ` · scelto in automatico${isNum(cc.season.seasonal) ? ` (media prevista ${fmtTemp(cc.season.seasonal)})` : ''}` : ' · impostato a mano'}</div></div>
    </div>
    <div class="seg profiles">
      ${cc.profiles.map((p) => {
        const t = p.off ? 'Tutto spento' : p.schedule ? 'Programma termostati' : season === 'cool' ? fmtTemp(p.cool) : season === 'heat' ? fmtTemp(p.heat) : '';
        return `<button class="${cc.profile === p.key ? 'active' : ''}" data-act="profile" data-profile="${esc(p.key)}">${icon(PROFILE_ICON[p.icon] || 'home')}${esc(p.name)}<span class="t">${t}</span></button>`;
      }).join('')}
    </div>
    <div class="row wrap" style="margin-top:14px">
      <span class="small muted">Stagione</span>
      <div class="seg compact" style="flex:1">
        ${seasons.map((s) => `<button class="${cc.season.mode === s ? 'active' : ''}" data-act="season" data-season="${s}">${icon(seasonIcon[s])}${seasonLabel[s]}</button>`).join('')}
      </div>
    </div>
  </div>`;
}

function weatherCard() {
  const w = getState('weather.casa');
  const outdoor = store.cc?.season.outdoor;
  if (!w) {
    return `<div class="card"><div class="card-head"><div class="ico-wrap">${icon('cloud')}</div><h3>Esterno</h3></div>
      <div class="big-temp num">${fmtTemp(outdoor)}</div>
      <p class="small muted" style="margin:10px 0 0">Aggiungi l'integrazione <a href="#/integrazioni">Meteo</a> per previsioni e stagione automatica più precisa.</p></div>`;
  }
  const a = w.attributes;
  const days = (a.forecast || []).slice(0, 5);
  return `<div class="card">
    <div class="weather-now">
      ${icon(WEATHER_ICON[w.state] || 'cloud')}
      <div style="flex:1">
        <div class="big-temp num">${fmtNum(a.temperature)}<small>°C</small></div>
        <div class="muted small">${esc(a.label || '')} · percepita ${fmtTemp(a.apparent_temperature)}</div>
      </div>
      <div class="kv" style="text-align:right"><span class="k">Umidità</span><span class="v num">${fmtNum(a.humidity, 0)}%</span><span class="k">Vento ${fmtNum(a.wind_speed, 0)} km/h</span></div>
    </div>
    <div class="forecast">${days.map((d) => `<div><span class="muted">${new Date(d.datetime).toLocaleDateString('it-IT', { weekday: 'short' })}</span>${icon(WEATHER_ICON[d.condition] || 'cloud')}<b class="num">${fmtNum(d.temperature, 0)}°</b><span class="muted num">${fmtNum(d.templow, 0)}°</span></div>`).join('')}</div>
  </div>`;
}

function energyCard(cc) {
  const e = cc.energy;
  if (!e || (e.grid === null && e.pv === null)) return '';
  const max = Math.max(e.grid || 0, e.pv || 0, 3000);
  const pct = (v) => `${Math.min(100, ((v || 0) / max) * 100).toFixed(1)}%`;
  const surplus = e.pv !== null && e.grid !== null ? e.pv - e.grid : null;
  return `<div class="card">
    <div class="card-head"><div class="ico-wrap warn">${icon('bolt')}</div><h3 style="flex:1">Energia</h3>
      ${surplus !== null ? `<span class="chip ${surplus > 0 ? 'ok' : ''}">${surplus > 0 ? `Eccedenza ${fmtPower(surplus)}` : `Dalla rete ${fmtPower(-surplus)}`}</span>` : ''}</div>
    <div class="energy-bars">
      ${e.grid !== null ? `<div class="ebar"><div class="row small"><span class="muted spacer">Consumo casa</span><b class="num">${fmtPower(e.grid)}</b></div><div class="track"><div class="fill" style="width:${pct(e.grid)};background:var(--accent)"></div></div></div>` : ''}
      ${e.pv !== null ? `<div class="ebar"><div class="row small"><span class="muted spacer">Fotovoltaico</span><b class="num">${fmtPower(e.pv)}</b></div><div class="track"><div class="fill" style="width:${pct(e.pv)};background:var(--warn)"></div></div></div>` : ''}
    </div>
  </div>`;
}

function roomCard(r, cc) {
  const season = cc.season.effective;
  const target = roomTarget(r);
  const canAdjust = r.climates.length > 0 && season !== 'off';
  const devices = r.climates.map((id) => getState(id)).filter(Boolean);
  return `<div class="card room ${r.action}">
    <div class="room-top">
      <div style="flex:1;min-width:0">
        <div class="room-name">${esc(r.name)}</div>
        <div class="room-temp num">${isNum(r.temperature) ? `${fmtNum(r.temperature)}<small>°C</small>` : '–'}</div>
      </div>
      ${r.window_open ? `<span class="chip warn" title="Finestra aperta">${icon('windowOpen')}Aperta</span>` : ''}
    </div>
    <div class="room-meta">
      ${actionChip(r.paused ? null : r.action)}
      ${r.paused ? `<span class="chip warn">${icon('windowOpen')}In pausa</span>` : ''}
      ${isNum(r.humidity) ? `<span class="chip">${icon('droplet')}${r.humidity}%</span>` : ''}
      ${r.override !== null ? `<span class="chip accent" title="Temperatura impostata a mano">${icon('edit')}Manuale</span>` : ''}
    </div>
    ${canAdjust ? `<div class="room-ctrl">
      <button class="btn icon round" data-act="room-down" data-room="${esc(r.id)}" aria-label="Meno caldo">${icon('minus')}</button>
      <div class="target"><b class="num" data-room-target="${esc(r.id)}">${isNum(target) ? `${fmtNum(target)}°` : '–'}</b><span class="l">${season === 'cool' ? 'raffrescamento' : 'riscaldamento'}${isNum(r.desired) && isNum(r.target) && Math.abs(r.desired - r.target) >= 0.1 && r.override === null ? ` · profilo ${fmtNum(r.desired)}°` : ''}</span></div>
      <button class="btn icon round" data-act="room-up" data-room="${esc(r.id)}" aria-label="Più caldo">${icon('plus')}</button>
    </div>` : ''}
    ${devices.length ? `<div class="room-devices">${devices.map((st) => `<div class="mini-dev" data-act="more" data-id="${esc(st.entity_id)}">${icon(st.state === 'cool' ? 'snowflake' : st.state === 'heat' ? 'flame' : st.state === 'off' ? 'power' : 'thermometer')}<span>${esc(st.attributes.friendly_name)}</span><span class="st">${esc(stateText(st))}</span></div>`).join('')}</div>` : ''}
    ${r.override !== null ? `<button class="btn sm ghost" data-act="room-reset" data-room="${esc(r.id)}">${icon('refresh')}Torna al profilo</button>` : ''}
  </div>`;
}

function carMini(dev) {
  const find = (re) => dev.entities.map((id) => getState(id)).find((s) => s && re.test(s.entity_id));
  const soc = find(/batteria|car_soc|_soc/);
  const range = find(/autonomia|range/);
  const ch = find(/stato_ricarica|charging/);
  const clima = dev.entities.map((id) => getState(id)).find((s) => s?.entity_id.startsWith('climate.'));
  const lock = dev.entities.map((id) => getState(id)).find((s) => s?.entity_id.startsWith('lock.'));
  return `<a class="card clickable" href="#/auto" style="color:inherit;display:block">
    <div class="card-head"><div class="ico-wrap">${icon('car')}</div><div style="flex:1;min-width:0"><div class="title">${esc(dev.name)}</div><div class="tiny muted">${esc(ch ? stateText(ch) : '')}</div></div>${icon('chevronRight')}</div>
    <div class="battery" style="height:38px"><div class="lvl ${Number(soc?.state) < 20 ? 'low' : ''}" style="width:${isNum(soc?.state) ? soc.state : 0}%"></div><div class="txt" style="font-size:15px">${isNum(soc?.state) ? `${soc.state}% · ${fmtNum(range?.state, 0)} km` : 'Addormentata'}</div></div>
    <div class="row wrap" style="margin-top:12px">
      ${clima ? `<span class="chip ${clima.state !== 'off' ? 'accent' : ''}">${icon('fan')}${clima.state !== 'off' ? 'Clima acceso' : 'Clima spento'}</span>` : ''}
      ${lock ? `<span class="chip ${lock.state === 'unlocked' ? 'warn' : ''}">${icon(lock.state === 'unlocked' ? 'unlock' : 'lock')}${lock.state === 'unlocked' ? 'Aperta' : 'Chiusa'}</span>` : ''}
    </div>
  </a>`;
}

export const homeView = {
  title: 'Casa',
  render() {
    const cc = store.cc;
    const integErrors = store.integrations.filter((i) => i.enabled && ['error', 'auth'].includes(i.status?.state));
    const scenes = [...store.states.values()].filter((s) => s.entity_id.startsWith('scene.'));
    const cars = vehicles();
    const alerts = [
      ...store.notifications.slice(0, 3).map((n) => `<div class="alert info">${icon('info')}<div style="flex:1"><b>${esc(n.title)}</b> · ${esc(n.message)}</div><button class="btn icon sm ghost" data-act="dismiss-notification" data-id="${esc(n.id)}">${icon('x')}</button></div>`),
      ...cc.alerts.map((a) => `<div class="alert ${a.level}">${icon(a.level === 'warn' ? 'alert' : 'info')}<div>${esc(a.message)}</div></div>`),
      ...integErrors.map((i) => `<a class="alert error" href="#/integrazioni" style="color:inherit">${icon('alert')}<div><b>${esc(i.title)}</b>: ${esc(i.status.message || 'errore')}</div></a>`)
    ];
    const now = new Date();
    return `
      <div class="page-head welcome">
        <div style="flex:1;min-width:0">
          <h1>${greeting()}</h1>
          <div class="sub">${now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
        <div class="summary-row">
          <div class="kv"><span class="k">Media casa</span><span class="v num">${fmtTemp(cc.average_temperature)}</span></div>
          <div class="kv"><span class="k">Esterno</span><span class="v num">${fmtTemp(cc.season.outdoor)}</span></div>
          <div class="kv"><span class="k">Stanze attive</span><span class="v num">${cc.rooms.filter((r) => ['heating', 'cooling', 'drying'].includes(r.action)).length}/${cc.rooms.length}</span></div>
        </div>
      </div>
      ${alerts.length ? `<div class="alerts">${alerts.join('')}</div>` : ''}
      <div class="hero">
        ${profileCard(cc)}
        <div class="stack">${weatherCard()}${energyCard(cc)}</div>
      </div>
      <div class="section-title">${icon('home')}Stanze</div>
      ${cc.rooms.length ? `<div class="grid">${cc.rooms.map((r) => roomCard(r, cc)).join('')}</div>` : `<div class="card empty">${icon('thermometer')}<div>Nessuna stanza ancora. Collega un'integrazione in <a href="#/integrazioni">Integrazioni</a> e assegna una stanza ai dispositivi.</div></div>`}
      ${scenes.length ? `<div class="section-title">${icon('play')}Scene</div><div class="row wrap">${scenes.map((s) => `<button class="btn" data-act="scene" data-id="${esc(s.entity_id)}">${icon(s.attributes.icon === 'movie' ? 'movie' : s.attributes.icon === 'sun' ? 'sun' : 'play')}${esc(s.attributes.friendly_name)}</button>`).join('')}</div>` : ''}
      ${cars.length ? `<div class="section-title">${icon('car')}Auto</div><div class="grid wide">${cars.map(carMini).join('')}</div>` : ''}
    `;
  }
};
