import { useEntity } from '../store';
import { formatValue, num } from '../lib/format';

const NODES = [
  { name: 'energia.fv', label: 'Fotovoltaico', x: 380, y: 50 },
  { name: 'energia.accumulo_potenza', label: 'Accumulo', x: 110, y: 200, soc: 'energia.accumulo_soc' },
  { name: 'energia.rete', label: 'Rete', x: 650, y: 200 },
  { name: 'energia.casa', label: 'Casa', x: 380, y: 330 },
  { name: 'energia.auto_potenza', label: 'Auto', x: 650, y: 330 },
] as const;

/** Energy flows: PV, storage, grid, house, car. */
export function Energia() {
  const states = Object.fromEntries(NODES.map((n) => [n.name, useEntity(n.name)]));
  const soc = useEntity('energia.accumulo_soc');
  const configured = NODES.filter((n) => states[n.name]?.configurata).length;
  return (
    <div className="stack">
      {configured === 0 && (
        <div className="notice">Le entità di energia non sono ancora configurate in <code>config/entities.yaml</code> (punto aperto: inverter, accumulo, colonnina).</div>
      )}
      <section className="card">
        <svg className="schema" viewBox="0 0 760 400" role="img" aria-label="Flussi di energia">
          {NODES.filter((n) => n.name !== 'energia.casa').map((n) => {
            const v = num(states[n.name]?.valore) ?? 0;
            return <line key={n.name} x1={n.x} y1={n.y} x2={380} y2={200} className={`pipe ${Math.abs(v) > 20 ? 'flow on' : 'flow'} ${v < 0 ? 'reverse' : ''}`} />;
          })}
          <line x1={380} y1={200} x2={380} y2={330} className="pipe flow on" />
          <circle cx={380} cy={200} r={10} className="hub" />
          {NODES.map((n) => (
            <g key={n.name}>
              <rect x={n.x - 85} y={n.y - 34} width={170} height={68} rx={14} className={`node ${states[n.name]?.configurata ? '' : 'todo'}`} />
              <text x={n.x} y={n.y - 6} className="t-title" textAnchor="middle">{n.label}</text>
              <text x={n.x} y={n.y + 20} className="t-value" textAnchor="middle">
                {formatValue(states[n.name])}{'soc' in n && soc?.configurata ? ` · ${formatValue(soc)}` : ''}
              </text>
            </g>
          ))}
        </svg>
        <p className="muted small">Convenzione: valori positivi verso la casa (rete in prelievo, accumulo in scarica).</p>
      </section>
    </div>
  );
}
