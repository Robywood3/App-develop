// Set di icone a tratto (24x24), disegnate per Casa Clima.
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  thermometer: '<path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z"/><path d="M12 9v7"/>',
  snowflake: '<path d="M12 2v20M4.9 6l14.2 12M19.1 6 4.9 18"/><path d="m9 4 3 2 3-2M9 20l3-2 3 2M3.5 9.5 6.8 10l1-3.2M20.5 14.5l-3.3-.5-1 3.2M3.5 14.5l3.3-.5 1 3.2M20.5 9.5l-3.3.5-1-3.2"/>',
  flame: '<path d="M12 22c4 0 7-2.8 7-7 0-3.5-2.2-6-4-8 0 2.5-1.3 4-2.5 4.5C13 8 12 5 9.5 2.5 9.5 6 5 9 5 15c0 4.2 3 7 7 7Z"/><path d="M12 22c-1.7 0-3-1.3-3-3 0-2 1.5-3 3-4.5 1.5 1.5 3 2.5 3 4.5 0 1.7-1.3 3-3 3Z"/>',
  droplet: '<path d="M12 2.7S5 10 5 14.5a7 7 0 0 0 14 0C19 10 12 2.7 12 2.7Z"/>',
  wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>',
  fan: '<path d="M12 12c-1.5-3.5-1-8 2-8.5 2.5-.4 3.5 2 2.3 4.2-.9 1.6-2.6 2.8-4.3 4.3ZM12 12c3.5-1.5 8-1 8.5 2 .4 2.5-2 3.5-4.2 2.3-1.6-.9-2.8-2.6-4.3-4.3ZM12 12c1.5 3.5 1 8-2 8.5-2.5.4-3.5-2-2.3-4.2.9-1.6 2.6-2.8 4.3-4.3ZM12 12c-3.5 1.5-8 1-8.5-2-.4-2.5 2-3.5 4.2-2.3 1.6.9 2.8 2.6 4.3 4.3Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z"/>',
  leaf: '<path d="M5 19c0-9 5-15 15-15 0 10-6 15-15 15Z"/><path d="M5 19 13 11"/>',
  away: '<path d="M14 3h5a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-5"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  power: '<path d="M12 3v9"/><path d="M6.4 6.5a8 8 0 1 0 11.2 0"/>',
  car: '<path d="M5 16V11l2-5h10l2 5v5"/><path d="M3 16h18v2a1 1 0 0 1-1 1h-2v-3M3 16v2a1 1 0 0 0 1 1h2v-3"/><path d="M5 11h14"/><circle cx="7.5" cy="13.5" r=".6"/><circle cx="16.5" cy="13.5" r=".6"/>',
  plug: '<path d="M9 2v5M15 2v5"/><path d="M6 7h12v4a6 6 0 0 1-12 0V7Z"/><path d="M12 17v5"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z"/>',
  blinds: '<path d="M3 3h18M5 3v14M19 3v14"/><path d="M5 7h14M5 11h14M5 15h14"/><path d="M12 17v3"/><circle cx="12" cy="21" r="1"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/>',
  window: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M12 3v18M4 12h16"/>',
  windowOpen: '<path d="M4 3h16v18H4z"/><path d="M4 3l6 3v18l-6-3"/>',
  door: '<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18"/><circle cx="14.5" cy="12" r=".8"/>',
  motion: '<circle cx="13" cy="4" r="2"/><path d="m9 21 2-6 3 3v3M7 11l3-3 4 1 2 3 3 1M10 8l-1 5 3 2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  zap: '<path d="M4 12h4l3-8 4 16 3-8h2"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 15 4-5 4 3 5-7"/>',
  puzzle: '<path d="M10 3h4v2.5a1.5 1.5 0 1 0 3 0V3h4v7h-2.5a1.5 1.5 0 1 0 0 3H21v8h-7v-2.5a1.5 1.5 0 1 0-3 0V21H3v-8h2.5a1.5 1.5 0 1 0 0-3H3V3h7Z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4"/>',
  play: '<path d="M7 4.5v15l12-7.5-12-7.5Z"/>',
  battery: '<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2"/><path d="M5 10v4M8 10v4M11 10v4"/>',
  logout: '<path d="M10 3H5a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h5"/><path d="M15 16l4-4-4-4M19 12H9"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a15.6 15.6 0 0 1-2.7 3.3M6.6 6.6C4.3 8.1 3 12 3 12s4 6 9 6c1.6 0 3-.4 4.3-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  alert: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  cloud: '<path d="M7 18a4.5 4.5 0 1 1 .9-8.9A6 6 0 0 1 19.5 11 3.5 3.5 0 0 1 18 18H7Z"/>',
  partly: '<path d="M12 4V2M5.6 6.6 4.2 5.2M4 13H2M18.4 6.6l1.4-1.4"/><path d="M8 11.5a4 4 0 0 1 7.5-1.9"/><path d="M9 21a3.5 3.5 0 1 1 .7-6.9 5 5 0 0 1 9.7 1.4A2.8 2.8 0 0 1 18.5 21H9Z"/>',
  rain: '<path d="M7 15a4.5 4.5 0 1 1 .9-8.9A6 6 0 0 1 19.5 8 3.5 3.5 0 0 1 18 15H7Z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
  snow: '<path d="M7 15a4.5 4.5 0 1 1 .9-8.9A6 6 0 0 1 19.5 8 3.5 3.5 0 0 1 18 15H7Z"/><path d="M8 19h.01M12 20h.01M16 19h.01M10 22h.01M14 22h.01"/>',
  storm: '<path d="M7 15a4.5 4.5 0 1 1 .9-8.9A6 6 0 0 1 19.5 8 3.5 3.5 0 0 1 18 15h-1"/><path d="m12 13-2 4h4l-2 4"/>',
  fog: '<path d="M7 13a4.5 4.5 0 1 1 .9-8.9A6 6 0 0 1 19.5 6 3.5 3.5 0 0 1 18 13H7Z"/><path d="M4 17h16M6 21h12"/>',
  wifi: '<path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0"/><path d="M12 19h.01"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 9.2-9.2M17 6l3 3M14 9l2 2"/>',
  flask: '<path d="M9 3h6M10 3v6L4.5 19a1.3 1.3 0 0 0 1.2 2h12.6a1.3 1.3 0 0 0 1.2-2L14 9V3"/><path d="M7 15h10"/>',
  movie: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 5l2 4M12 5l2 4M17 5l2 4"/>',
  season: '<path d="M12 3a9 9 0 1 0 0 18Z"/><path d="M12 3a9 9 0 0 1 0 18"/>',
  horn: '<path d="M3 10v4h3l6 4V6L6 10H3Z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>',
  ev: '<path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h14"/><path d="M15 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3"/><path d="m10 7-2 4h3l-2 4"/>',
  gauge: '<path d="M4.5 18a9 9 0 1 1 15 0"/><path d="m12 13 4-4"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  external: '<path d="M14 3h7v7M21 3l-9 9"/><path d="M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>',
  water: '<path d="M12 2.7S5 10 5 14.5a7 7 0 0 0 14 0C19 10 12 2.7 12 2.7Z"/><path d="M9 15a3 3 0 0 0 3 3"/>',
  sensor: '<circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
  co2: '<path d="M7 18a4.5 4.5 0 1 1 .9-8.9A6 6 0 0 1 19.5 11 3.5 3.5 0 0 1 18 18H7Z"/><path d="M10 13.5a1.5 1.5 0 1 0 0 1.5M14 13a1.2 1.2 0 1 1 0 2.5 1.2 1.2 0 0 1 0-2.5Z"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="1.5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>'
};

export function icon(name, cls = '') {
  return `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || P.sensor}</svg>`;
}

export const WEATHER_ICON = {
  sunny: 'sun', 'clear-night': 'moon', partlycloudy: 'partly', cloudy: 'cloud', fog: 'fog',
  rainy: 'rain', pouring: 'rain', 'snowy-rainy': 'snow', snowy: 'snow', 'lightning-rainy': 'storm', hail: 'storm'
};

/** Icona sensata per un'entità, in base a dominio, classe e stato. */
export function entityIcon(st) {
  if (!st) return 'sensor';
  const [domain] = st.entity_id.split('.');
  const a = st.attributes || {};
  const dc = a.device_class;
  const ICONS = { home: 'home', season: 'season', ev: 'ev', water: 'water', movie: 'movie', sun: 'sun', moon: 'moon', leaf: 'leaf' };
  if (a.icon && ICONS[a.icon]) return ICONS[a.icon];
  switch (domain) {
    case 'climate': return st.state === 'cool' ? 'snowflake' : st.state === 'off' ? 'thermometer' : st.state === 'heat' ? 'flame' : 'thermometer';
    case 'light': return 'bulb';
    case 'switch': return /ricaric|charge/i.test(st.entity_id) ? 'ev' : 'plug';
    case 'cover': return 'blinds';
    case 'lock': return st.state === 'unlocked' ? 'unlock' : 'lock';
    case 'button': return /clacson|honk/.test(st.entity_id) ? 'horn' : /sveglia|wake/.test(st.entity_id) ? 'refresh' : 'play';
    case 'number': return 'gauge';
    case 'select': return 'list';
    case 'automation': return 'zap';
    case 'scene': return 'play';
    case 'weather': return WEATHER_ICON[st.state] || 'cloud';
    case 'binary_sensor':
      if (dc === 'window') return st.state === 'on' ? 'windowOpen' : 'window';
      if (dc === 'door') return 'door';
      if (dc === 'motion') return 'motion';
      if (dc === 'connectivity') return 'wifi';
      return 'sensor';
    case 'sensor':
      return { temperature: 'thermometer', humidity: 'droplet', power: 'bolt', energy: 'bolt', battery: 'battery', distance: 'car', carbon_dioxide: 'co2', pressure: 'gauge', wind_speed: 'wind', precipitation: 'rain', irradiance: 'sun' }[dc] || 'sensor';
    default: return 'sensor';
  }
}
