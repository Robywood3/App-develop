import { useEffect, useState } from 'react';
import { logout, me, setUnauthorizedHandler } from './api/client';
import { Icon } from './components/Icon';
import { Login } from './components/Login';
import { formatTime } from './lib/format';
import { connectLive, disconnectLive, setUser, useApp } from './store';
import { Auto } from './views/Auto';
import { Casa } from './views/Casa';
import { Energia } from './views/Energia';
import { Impianto } from './views/Impianto';
import { Registro } from './views/Registro';
import { Statistiche } from './views/Statistiche';
import { Telecamere } from './views/Telecamere';
import { Tre3D } from './views/Tre3D';

export const VIEWS = [
  { key: 'casa', label: 'Casa', icon: 'casa' },
  { key: 'impianto', label: 'Impianto', icon: 'impianto' },
  { key: 'energia', label: 'Energia', icon: 'energia' },
  { key: 'statistiche', label: 'Statistiche', icon: 'statistiche' },
  { key: '3d', label: '3D', icon: 'tred' },
  { key: 'telecamere', label: 'Telecamere', icon: 'telecamere' },
  { key: 'auto', label: 'Auto', icon: 'auto' },
] as const;
type ViewKey = (typeof VIEWS)[number]['key'] | 'registro';

/** Layout by width (section 8): TV >= 1600, tablet 900-1600, phone < 900. */
export function deviceFor(width: number): 'tv' | 'tablet' | 'telefono' {
  return width >= 1600 ? 'tv' : width >= 900 ? 'tablet' : 'telefono';
}

function useDevice() {
  const [d, setD] = useState(() => deviceFor(window.innerWidth));
  useEffect(() => {
    const on = () => setD(deviceFor(window.innerWidth));
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return d;
}

function viewFromHash(): ViewKey {
  const k = location.hash.replace(/^#\/?/, '');
  return (VIEWS.some((v) => v.key === k) || k === 'registro' ? k : 'casa') as ViewKey;
}

function StatusBar() {
  const online = useApp((s) => s.online);
  const haUp = useApp((s) => s.snapshot?.connesso_ha ?? false);
  const last = useApp((s) => s.lastData);
  if (online && haUp) return null;
  return (
    <div className="statusbar" role="status">
      <Icon name="allerta" size={16} />
      {!online ? `Offline: dati dell'ultimo aggiornamento (${formatTime(last)})` : 'Home Assistant non raggiungibile: i comandi non sono disponibili'}
    </div>
  );
}

function Toasts() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}
    </div>
  );
}

export function App() {
  const user = useApp((s) => s.user);
  const hasData = useApp((s) => Boolean(s.snapshot));
  const [checked, setChecked] = useState(false);
  const [view, setView] = useState<ViewKey>(viewFromHash);
  const device = useDevice();

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    me().then((r) => setUser(r.utente)).catch(() => setUser(null)).finally(() => setChecked(true));
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!user) return;
    connectLive();
    return () => disconnectLive();
  }, [user]);

  // keyboard shortcuts 1-7 (TV with wireless keyboard)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, select, textarea')) return;
      const i = Number(e.key) - 1;
      if (i >= 0 && i < VIEWS.length) location.hash = `#/${VIEWS[i].key}`;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!checked) return <div className="boot"><div className="spinner" /></div>;
  if (!user) return <Login onLogin={(u) => setUser(u)} />;

  const tv = device === 'tv';
  const title = view === 'registro' ? 'Registro comandi' : VIEWS.find((v) => v.key === view)!.label;
  const body = !hasData ? <div className="boot"><div className="spinner" /></div> : {
    casa: <Casa tv={tv} />, impianto: <Impianto />, energia: <Energia />, statistiche: <Statistiche />,
    '3d': <Tre3D />, telecamere: <Telecamere tv={tv} />, auto: <Auto />, registro: <Registro />,
  }[view];

  return (
    <div className={`shell ${device}`}>
      <nav className="nav" aria-label="Viste">
        <div className="brand"><img src="/icon.svg" alt="" width={28} height={28} /> Casa App</div>
        {VIEWS.map((v, i) => (
          <a key={v.key} href={`#/${v.key}`} className={view === v.key ? 'active' : ''} aria-current={view === v.key ? 'page' : undefined}>
            <Icon name={v.icon} /><span>{v.label}</span>{tv && <kbd>{i + 1}</kbd>}
          </a>
        ))}
        <div className="nav-foot">
          <a href="#/registro" className={view === 'registro' ? 'active' : ''}><Icon name="registro" /><span>Registro comandi</span></a>
          <button className="link" onClick={async () => { await logout().catch(() => {}); disconnectLive(); setUser(null); }}>
            <Icon name="esci" /><span>Esci ({user.nome})</span>
          </button>
        </div>
      </nav>
      <main>
        <header className="page-head"><h1>{title}</h1></header>
        <StatusBar />
        {body}
      </main>
      <Toasts />
    </div>
  );
}
