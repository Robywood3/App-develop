import { useEntity } from '../store';
import { formatValue, num } from '../lib/format';

function Car({ prefix, name }: { prefix: string; name: string }) {
  const soc = useEntity(`${prefix}.batteria`);
  const range = useEntity(`${prefix}.autonomia`);
  const charge = useEntity(`${prefix}.ricarica`);
  const level = num(soc?.valore);
  const configured = soc?.configurata || range?.configurata;
  return (
    <section className="card">
      <h2 className="card-title">{name}</h2>
      {!configured ? (
        <div className="notice">Entità di {name} da configurare in <code>config/entities.yaml</code>.</div>
      ) : (
        <>
          <div className="battery" role="meter" aria-valuenow={level ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label={`Batteria ${name}`}>
            <div className={`lvl ${level !== null && level < 20 ? 'low' : ''}`} style={{ width: `${level ?? 0}%` }} />
            <span>{formatValue(soc)}</span>
          </div>
          <div className="row-values">
            <div className="value"><span className="label">Autonomia</span><span className="num">{formatValue(range)}</span></div>
            <div className="value"><span className="label">Ricarica</span><span className="num">{formatValue(charge)}</span></div>
          </div>
        </>
      )}
    </section>
  );
}

/** Tesla (HA integration) and CUPRA (separate module, exposed as HA entities). */
export function Auto() {
  return (
    <div className="grid wide">
      <Car prefix="auto.tesla" name="Tesla" />
      <Car prefix="auto.cupra" name="CUPRA" />
    </div>
  );
}
