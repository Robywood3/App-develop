import { command, useEntity, usePending, useApp } from '../store';
import { formatValue, isOn, num } from '../lib/format';
import { Icon } from './Icon';

function Status({ name }: { name: string }) {
  const pending = usePending(name);
  const unconfirmed = useApp((s) => s.unconfirmed[name]);
  if (pending) return <span className="chip sending" role="status">In invio…</span>;
  if (unconfirmed) return <span className="chip warn" role="status">{unconfirmed}</span>;
  return null;
}

/** Read-only value with label. */
export function Value({ name, big = false }: { name: string; big?: boolean }) {
  const e = useEntity(name);
  return (
    <div className={`value ${e?.configurata === false ? 'todo' : ''}`}>
      <span className="label">{e?.etichetta ?? name}</span>
      <span className={big ? 'num big' : 'num'}>{formatValue(e)}</span>
    </div>
  );
}

/** Numeric setpoint with − / + and confirmation state. */
export function Stepper({ name }: { name: string }) {
  const e = useEntity(name);
  const pending = usePending(name);
  const readOnly = useApp((s) => s.user?.ruolo === 'lettura');
  const value = num(e?.valore);
  const step = e?.passo ?? 0.5;
  const disabled = !e?.comandabile || pending || value === null || readOnly;
  const set = (dir: number) => {
    if (value === null || !e) return;
    let next = Math.round((value + dir * step) * 100) / 100;
    if (e.min !== null) next = Math.max(e.min, next);
    if (e.max !== null) next = Math.min(e.max, next);
    if (next !== value) command({ azione: 'set', target: name, valore: next });
  };
  return (
    <div className={`control ${e?.configurata === false ? 'todo' : ''}`}>
      <div className="control-head">
        <span className="label">{e?.etichetta ?? name}</span>
        <Status name={name} />
      </div>
      <div className="stepper">
        <button className="round" aria-label={`Diminuisci ${e?.etichetta}`} disabled={disabled} onClick={() => set(-1)}>
          <Icon name="minus" />
        </button>
        <span className="num big">{formatValue(e)}</span>
        <button className="round" aria-label={`Aumenta ${e?.etichetta}`} disabled={disabled} onClick={() => set(1)}>
          <Icon name="plus" />
        </button>
      </div>
    </div>
  );
}

/** On/off control (switch, input_boolean). */
export function Toggle({ name, icon }: { name: string; icon?: string }) {
  const e = useEntity(name);
  const pending = usePending(name);
  const readOnly = useApp((s) => s.user?.ruolo === 'lettura');
  const on = isOn(e);
  return (
    <div className={`control row ${e?.configurata === false ? 'todo' : ''}`}>
      {icon && <span className={`ico ${on ? 'on' : ''}`}><Icon name={icon} /></span>}
      <div className="grow">
        <span className="label strong">{e?.etichetta ?? name}</span>
        <div className="sub">
          {e?.configurata === false ? 'da configurare' : on ? 'Acceso' : 'Spento'} <Status name={name} />
        </div>
      </div>
      <button
        role="switch"
        aria-checked={on}
        aria-label={e?.etichetta}
        className={`switch ${on ? 'on' : ''}`}
        disabled={!e?.comandabile || pending || readOnly}
        onClick={() => command({ azione: on ? 'turn_off' : 'turn_on', target: name })}
      >
        <span />
      </button>
    </div>
  );
}

/** Scenario (script) button. */
export function ScenarioButton({ name }: { name: string }) {
  const e = useEntity(name);
  const pending = usePending(name);
  const readOnly = useApp((s) => s.user?.ruolo === 'lettura');
  return (
    <button className="btn" disabled={!e?.comandabile || pending || readOnly} onClick={() => command({ azione: 'run', target: name })}
      title={e?.configurata === false ? 'Scenario da configurare' : undefined}>
      <Icon name="play" size={16} />
      {e?.etichetta ?? name}
      {pending && <span className="chip sending">In invio…</span>}
    </button>
  );
}
