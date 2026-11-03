import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { Camera, VideoEvent } from '../api/types';
import { CameraPlayer } from '../components/CameraPlayer';
import { Icon } from '../components/Icon';
import { useApp } from '../store';

function useCameras() {
  const [cams, setCams] = useState<Camera[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ telecamere: Camera[] }>('GET', '/api/cameras')
      .then((r) => setCams(r.telecamere))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Errore'));
  }, []);
  return { cams, error };
}

/** Grid of snapshots refreshed every 5 s; click opens the live stream. */
export function CameraGrid({ columns = 3, max = 8 }: { columns?: number; max?: number }) {
  const { cams, error } = useCameras();
  const [tick, setTick] = useState(0);
  const [live, setLive] = useState<string | null>(null);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 5000);
    return () => clearInterval(t);
  }, []);
  if (error) return <div className="notice">{error}</div>;
  if (!cams) return <div className="empty">Caricamento…</div>;
  return (
    <>
      <div className="cam-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {cams.slice(0, max).map((c) => (
          <button key={c.nome} className="cam" onClick={() => setLive(c.nome)} aria-label={`Diretta ${c.nome}`}>
            <img src={`${c.immagine}?t=${tick}`} alt="" loading="lazy" />
            <span>{c.nome}</span>
          </button>
        ))}
      </div>
      {live && (
        <div className="overlay" onClick={() => setLive(null)}>
          <div className="overlay-body" onClick={(e) => e.stopPropagation()}>
            <div className="overlay-head"><b>{live}</b><button className="round" onClick={() => setLive(null)} aria-label="Chiudi"><Icon name="chiudi" /></button></div>
            <CameraPlayer name={live} />
          </div>
        </div>
      )}
    </>
  );
}

const OBJECTS: Record<string, string> = { person: 'Persona', car: 'Auto' };

function Events() {
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [camera, setCamera] = useState('');
  const [object, setObject] = useState('');
  const [events, setEvents] = useState<VideoEvent[] | null>(null);
  const [clip, setClip] = useState<VideoEvent | null>(null);
  const lastEvent = useApp((s) => s.lastVideoEvent);
  const { cams } = useCameras();
  useEffect(() => {
    const from = new Date(`${day}T00:00:00`);
    const to = new Date(from.getTime() + 86400e3);
    const q = new URLSearchParams({ da: from.toISOString(), a: to.toISOString() });
    if (camera) q.set('telecamera', camera);
    if (object) q.set('oggetto', object);
    api<{ eventi: VideoEvent[] }>('GET', `/api/events?${q}`).then((r) => setEvents(r.eventi)).catch(() => setEvents([]));
  }, [day, camera, object, lastEvent]);
  return (
    <section className="card">
      <div className="toolbar">
        <input type="date" value={day} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDay(e.target.value)} aria-label="Giorno" />
        <select value={camera} onChange={(e) => setCamera(e.target.value)} aria-label="Telecamera">
          <option value="">Tutte le telecamere</option>
          {cams?.map((c) => <option key={c.nome} value={c.nome}>{c.nome}</option>)}
        </select>
        <select value={object} onChange={(e) => setObject(e.target.value)} aria-label="Oggetto">
          <option value="">Persone e auto</option>
          <option value="person">Persone</option>
          <option value="car">Auto</option>
        </select>
      </div>
      {clip && <video className="clip" src={`/api/clips/${encodeURIComponent(clip.id)}`} controls autoPlay />}
      <div className="list">
        {events === null ? <div className="empty">Caricamento…</div> : events.length === 0 ? <div className="empty">Nessun evento in questo giorno.</div> :
          events.map((ev) => (
            <button key={ev.id} className="list-row" disabled={!ev.clip} onClick={() => setClip(ev)}>
              <span className="num">{new Date(ev.ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="grow">{OBJECTS[ev.oggetto] ?? ev.oggetto} · {ev.telecamera}</span>
              <span className="muted">{ev.clip ? 'Guarda la clip' : 'Senza clip'}</span>
            </button>
          ))}
      </div>
      <p className="muted small">Frigate conserva le clip 30 giorni.</p>
    </section>
  );
}

export function Telecamere({ tv }: { tv: boolean }) {
  return (
    <div className="stack">
      <section>
        <h2>Diretta</h2>
        <CameraGrid columns={tv ? 4 : 2} />
      </section>
      <section>
        <h2>Eventi</h2>
        <Events />
      </section>
    </div>
  );
}
