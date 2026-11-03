import { useEntity } from '../store';
import { formatValue, num } from '../lib/format';
import { Value } from '../components/Controls';

/** Hydronic schema with animated flows: heat pump -> floors, domestic hot water. */
export function Impianto() {
  const potenza = num(useEntity('pdc.potenza')?.valore) ?? 0;
  const camino = useEntity('camino.modalita')?.valore === 'on';
  const running = potenza > 50;
  const tpt = useEntity('pdc.target_pt');
  const t1p = useEntity('pdc.target_1p');
  const off = useEntity('pdc.offset');
  const acs = useEntity('acs.temp');
  const flow = running ? 'flow on' : 'flow';
  return (
    <div className="stack">
      <section className="card">
        <svg className="schema" viewBox="0 0 760 360" role="img" aria-label="Schema dell'impianto">
          {/* heat pump */}
          <rect x="30" y="130" width="170" height="110" rx="14" className={`node ${running ? 'active' : ''}`} />
          <text x="115" y="165" className="t-title" textAnchor="middle">Pompa di calore</text>
          <text x="115" y="195" className="t-value" textAnchor="middle">{formatValue(useEntity('pdc.potenza'))}</text>
          <text x="115" y="222" className="t-sub" textAnchor="middle">offset {formatValue(off)}</text>
          {/* supply lines */}
          <path d="M200 160 H330 V80 H470" className={`pipe hot ${flow}`} />
          <path d="M330 160 V250 H470" className={`pipe hot ${flow}`} />
          <path d="M200 215 H300 V320 H470" className={`pipe hot ${flow}`} />
          {/* floors */}
          <rect x="470" y="40" width="240" height="80" rx="12" className="node" />
          <text x="590" y="72" className="t-title" textAnchor="middle">Primo piano (canalizzato)</text>
          <text x="590" y="100" className="t-value" textAnchor="middle">target {formatValue(t1p)}</text>
          <rect x="470" y="210" width="240" height="80" rx="12" className="node" />
          <text x="590" y="242" className="t-title" textAnchor="middle">Piano terra</text>
          <text x="590" y="270" className="t-value" textAnchor="middle">target {formatValue(tpt)}</text>
          {/* hot water tank */}
          <rect x="470" y="300" width="240" height="50" rx="12" className="node" />
          <text x="590" y="331" className="t-title" textAnchor="middle">ACS {formatValue(acs)}</text>
          {camino && (
            <g>
              <rect x="30" y="40" width="170" height="60" rx="12" className="node fire" />
              <text x="115" y="76" className="t-title" textAnchor="middle">Modalità camino attiva</text>
            </g>
          )}
        </svg>
        <p className="muted small">I flussi si animano quando la PDC assorbe più di 50 W. La logica della PDC resta in Home Assistant.</p>
      </section>
      <section className="grid">
        <Value name="zona_giorno.temp" />
        <Value name="pdc.potenza" />
        <Value name="hvac.potenza" />
        <Value name="acs.temp" />
      </section>
    </div>
  );
}
