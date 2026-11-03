import { useEffect, useMemo, useState } from 'react';
import { getHistory, ApiError } from '../api/client';
import type { HistoryResponse } from '../api/types';
import { LineChart } from '../components/LineChart';
import { RANGES } from '../lib/format';
import { useApp } from '../store';

const COLORS = ['#4f9dff', '#f08a3c', '#3ecf8e', '#c084fc', '#f5b942', '#ff5d8f'];
const PRESETS = [
  { label: 'Temperature', names: ['zona_giorno.temp', 'pdc.target_pt', 'pdc.target_1p'] },
  { label: 'Potenze', names: ['pdc.potenza', 'hvac.potenza'] },
  { label: 'Mandata e ACS', names: ['pdc.offset', 'acs.temp', 'acs.target'] },
  { label: 'Energia', names: ['energia.fv', 'energia.casa', 'energia.rete'] },
];
const RES_LABEL = { grezzi: 'dati grezzi', '5min': 'medie a 5 minuti', '1h': 'medie orarie', '1g': 'medie giornaliere' };

export function Statistiche() {
  const entities = useApp((s) => s.snapshot?.entita ?? {});
  const [preset, setPreset] = useState(0);
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('24h');
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const names = PRESETS[preset].names.filter((n) => entities[n]?.configurata);
  const key = `${names.join(',')}|${range}`;
  const window = useMemo(() => {
    const to = new Date();
    return { from: new Date(to.getTime() - RANGES.find((r) => r.key === range)!.ms), to };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!names.length) { setData(null); return; }
    let alive = true;
    setError(null);
    getHistory(names, window.from, window.to)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : 'Errore'));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const series = names.map((n, i) => ({ name: entities[n]?.etichetta ?? n, color: COLORS[i % COLORS.length], points: data?.serie[n] ?? [], unit: entities[n]?.unita }));
  const stats = series.map((s) => {
    const vals = s.points.map((p) => p[1]).filter((v): v is number => v !== null);
    return { ...s, min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
  });
  const fmt = (v: number | null, u?: string | null) => (v === null ? '–' : `${v.toLocaleString('it-IT', { maximumFractionDigits: 1 })}${u ? ` ${u}` : ''}`);

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="seg">{PRESETS.map((p, i) => <button key={p.label} className={i === preset ? 'active' : ''} onClick={() => setPreset(i)}>{p.label}</button>)}</div>
        <div className="seg">{RANGES.map((r) => <button key={r.key} className={r.key === range ? 'active' : ''} onClick={() => setRange(r.key)}>{r.label}</button>)}</div>
      </div>
      <section className="card">
        {!names.length ? <div className="empty">Queste entità non sono ancora configurate.</div>
          : error ? <div className="notice err">{error}</div>
          : <LineChart series={series} from={window.from} to={window.to} />}
        {data && <p className="muted small">Fonte: TimescaleDB, {RES_LABEL[data.risoluzione]}.</p>}
      </section>
      {data && (
        <section className="grid">
          {stats.map((s) => (
            <div key={s.name} className="card">
              <div className="label strong"><i className="dot" style={{ background: s.color }} /> {s.name}</div>
              <div className="row-values">
                <div className="value"><span className="label">Media</span><span className="num">{fmt(s.avg, s.unit)}</span></div>
                <div className="value"><span className="label">Min</span><span className="num">{fmt(s.min, s.unit)}</span></div>
                <div className="value"><span className="label">Max</span><span className="num">{fmt(s.max, s.unit)}</span></div>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
