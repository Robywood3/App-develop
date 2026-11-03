import { ScenarioButton, Stepper, Toggle, Value } from '../components/Controls';
import { CameraGrid } from './Telecamere';

/** Synoptic view: comfort, heat pump, AC, ventilation, commands, fireplace mode. */
export function Casa({ tv }: { tv: boolean }) {
  const panel = (
    <div className="stack">
      <section className="card hero-card">
        <Value name="zona_giorno.temp" big />
        <div className="row-values">
          <Value name="pdc.potenza" />
          <Value name="hvac.potenza" />
          <Value name="acs.temp" />
        </div>
      </section>
      <section>
        <h2>Pompa di calore</h2>
        <div className="grid">
          <Stepper name="pdc.target_pt" />
          <Stepper name="pdc.target_1p" />
          <Stepper name="pdc.offset" />
          <Stepper name="acs.target" />
        </div>
      </section>
      <section>
        <h2>Comandi</h2>
        <div className="grid">
          <Toggle name="camino.modalita" icon="fuoco" />
          <Toggle name="vmc.pt" icon="ventola" />
          <Toggle name="vmc.1p" icon="ventola" />
        </div>
        <div className="buttons">
          <ScenarioButton name="scenario.notte" />
          <ScenarioButton name="scenario.fuori_casa" />
        </div>
      </section>
    </div>
  );
  if (!tv) return panel;
  // TV: supervision panel + camera grid 2x4
  return (
    <div className="tv-split">
      {panel}
      <section>
        <h2>Telecamere</h2>
        <CameraGrid columns={2} max={8} />
      </section>
    </div>
  );
}
