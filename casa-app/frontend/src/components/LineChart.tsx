import { useMemo, useState } from 'react';
import type { Point } from '../api/types';

export interface Series {
  name: string;
  color: string;
  points: Point[];
  unit?: string | null;
}

const W = 800;
const PAD = { l: 44, r: 10, t: 10, b: 24 };

/** SVG line chart with min/max band for aggregated data. */
export function LineChart({ series, height = 240, from, to }: { series: Series[]; height?: number; from: Date; to: Date }) {
  const [hover, setHover] = useState<number | null>(null);
  const t0 = from.getTime();
  const t1 = to.getTime();
  const { lo, hi } = useMemo(() => {
    const vals = series.flatMap((s) => s.points.flatMap((p) => [p[1], p[2], p[3]])).filter((v): v is number => v !== null);
    if (!vals.length) return { lo: 0, hi: 1 };
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
    const pad = (hi - lo) * 0.08;
    return { lo: lo - pad, hi: hi + pad };
  }, [series]);
  const empty = !series.some((s) => s.points.length);
  if (empty) return <div className="empty">Nessun dato nel periodo scelto.</div>;

  const X = (t: number) => PAD.l + ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r);
  const Y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (height - PAD.t - PAD.b);
  const ticks = [0, 1, 2, 3, 4].map((i) => lo + ((hi - lo) * i) / 4);
  const span = t1 - t0;
  const xticks = Array.from({ length: 6 }, (_, i) => t0 + (span * (i + 0.5)) / 6);
  const fmtX = (t: number) =>
    span <= 2 * 86400e3
      ? new Date(t).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
      : new Date(t).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

  const hoverT = hover !== null ? t0 + ((hover - PAD.l) / (W - PAD.l - PAD.r)) * span : null;
  const nearest = (pts: Point[], t: number) => {
    let best: Point | null = null;
    for (const p of pts) {
      if (new Date(p[0]).getTime() <= t) best = p;
      else break;
    }
    return best;
  };

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" style={{ height }}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          setHover(((e.clientX - r.left) / r.width) * W);
        }}
        onMouseLeave={() => setHover(null)}
        role="img" aria-label="Grafico storico">
        {ticks.map((v) => (
          <g key={v}>
            <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={Y(v)} y2={Y(v)} />
            <text className="axis" x={PAD.l - 6} y={Y(v) + 4} textAnchor="end">{v.toLocaleString('it-IT', { maximumFractionDigits: 1 })}</text>
          </g>
        ))}
        {xticks.map((t) => (
          <text key={t} className="axis" x={X(t)} y={height - 6} textAnchor="middle">{fmtX(t)}</text>
        ))}
        {series.map((s) => {
          const pts = s.points.filter((p) => p[1] !== null);
          const band = pts.filter((p) => p[2] !== null && p[3] !== null);
          const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(new Date(p[0]).getTime()).toFixed(1)} ${Y(p[1] as number).toFixed(1)}`).join('');
          const area = band.length
            ? band.map((p, i) => `${i ? 'L' : 'M'}${X(new Date(p[0]).getTime()).toFixed(1)} ${Y(p[3] as number).toFixed(1)}`).join('') +
              [...band].reverse().map((p) => `L${X(new Date(p[0]).getTime()).toFixed(1)} ${Y(p[2] as number).toFixed(1)}`).join('') + 'Z'
            : '';
          return (
            <g key={s.name}>
              {area && <path d={area} fill={s.color} opacity={0.15} />}
              <path d={line} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
            </g>
          );
        })}
        {hover !== null && hover > PAD.l && <line x1={hover} x2={hover} y1={PAD.t} y2={height - PAD.b} className="cursor" />}
      </svg>
      {hoverT !== null && hover! > PAD.l && (
        <div className="tip" style={{ left: `${Math.min(80, (hover! / W) * 100)}%` }}>
          <div className="muted">{new Date(hoverT).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
          {series.map((s) => {
            const p = nearest(s.points, hoverT);
            return p && p[1] !== null ? (
              <div key={s.name}><i style={{ background: s.color }} /> {s.name}: <b>{p[1].toLocaleString('it-IT', { maximumFractionDigits: 1 })}{s.unit ? ` ${s.unit}` : ''}</b></div>
            ) : null;
          })}
        </div>
      )}
      <div className="legend">{series.map((s) => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}</div>
    </div>
  );
}
