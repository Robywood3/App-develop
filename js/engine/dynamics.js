// Simulazione dinamica semplificata dell'impianto: sequenze di avviamento e
// arresto, rampe di carico della TG, inerzia termica del GVR e della TV
// (ritardi del primo ordine sulle grandezze del ciclo a vapore), blocco TG.
//
// Le grandezze di regime vengono fornite da una funzione esterna
// steady(load) -> risultato di plantPoint, valutata al carico TG attuale.

export const STATES = {
  FERMO: 'Fermo',
  AVVIAMENTO: 'Avviamento',
  IN_SERVIZIO: 'In servizio',
  ARRESTO: 'Arresto',
  BLOCCO: 'Blocco TG',
};

const SPEED_NOM = 3000; // giri/min
const T_ACCEL = 600; // s: lavaggio, accensione e accelerazione fino al minimo a vuoto
const T_IGNITION = 240; // s: accensione dopo il lavaggio
const LOAD_HOLD = 0.25; // carico di riscaldamento del GVR
const T_HOLD = 1200; // s: mantenimento al carico di riscaldamento prima del rullaggio TV
const T_COAST = 900; // s: decelerazione fino al viraggio
const TAU_HRSG = 240; // s: costante di tempo del ciclo a vapore
const TAU_TRIP = 8; // s: chiusura valvole di arresto TV
const FSNL_FUEL = 0.1; // frazione del combustibile di carico base a vuoto

export class PlantSim {
  constructor() {
    this.t = 0;
    this.state = 'IN_SERVIZIO';
    this.phase = 'Regolazione di carico';
    this.phaseT = 0;
    this.gtLoad = 1;
    this.setpoint = 1;
    this.rampPerMin = 8; // %/min del carico base
    this.speedNom = SPEED_NOM; // 3000 giri/min a 50 Hz, 3600 a 60 Hz
    this.speed = SPEED_NOM;
    this.stOnline = true;
    this.lag = null;
    this.events = [];
  }

  /** Velocità nominale dalla frequenza di rete (2 poli): 3000 giri/min a 50 Hz, 3600 a 60 Hz. */
  setSpeedNom(rpm) {
    if (this.speed === this.speedNom) this.speed = rpm;
    this.speedNom = rpm;
  }

  log(msg, level = 'info') {
    this.events.unshift({ t: this.t, msg, level });
    if (this.events.length > 200) this.events.pop();
  }

  start() {
    if (this.state !== 'FERMO') return;
    this.state = 'AVVIAMENTO';
    this.phase = 'Lavaggio caldaia';
    this.phaseT = 0;
    this.stOnline = false;
    this.log('Comando di avviamento TG');
  }

  stop() {
    if (this.state !== 'IN_SERVIZIO' && this.state !== 'AVVIAMENTO') return;
    if (this.gtLoad <= 0 && this.speed < this.speedNom) {
      // arresto durante l'accelerazione: spegnimento diretto
      this.state = 'ARRESTO';
      this.phase = 'Decelerazione';
      this.phaseT = 0;
      this.log('Avviamento interrotto, spegnimento TG');
      return;
    }
    this.state = 'ARRESTO';
    this.phase = 'Riduzione di carico';
    this.phaseT = 0;
    this.log('Comando di arresto normale');
  }

  trip() {
    if (this.state === 'FERMO' || this.state === 'BLOCCO') return;
    this.state = 'BLOCCO';
    this.phase = 'Decelerazione';
    this.phaseT = 0;
    this.gtLoad = 0;
    this.stOnline = false;
    this.log('BLOCCO TG: chiusura valvole combustibile, apertura interruttore di macchina', 'alarm');
    this.log('Chiusura valvole di arresto TV, bypass vapore al condensatore', 'alarm');
  }

  reset() {
    if (this.state === 'BLOCCO' && this.speed <= 0) {
      this.state = 'FERMO';
      this.phase = '';
      this.log('Blocco riconosciuto, impianto pronto all\'avviamento');
    }
  }

  // Avanza il carico TG verso un obiettivo con la rampa impostata.
  rampTo(target, dt) {
    const step = (this.rampPerMin / 100 / 60) * dt;
    if (Math.abs(target - this.gtLoad) <= step) this.gtLoad = target;
    else this.gtLoad += Math.sign(target - this.gtLoad) * step;
  }

  /**
   * Avanza la simulazione di dt secondi.
   * @param {number} dt passo [s]
   * @param {(load:number)=>object} steady funzione di regime
   */
  step(dt, steady) {
    this.t += dt;
    this.phaseT += dt;
    let gtOn = this.gtLoad > 0;
    let fuelFrac = 0; // combustibile a vuoto (frazione del carico base)

    switch (this.state) {
      case 'FERMO':
        this.gtLoad = 0;
        this.speed = Math.max(0, this.speed - (this.speedNom / T_COAST) * dt);
        break;
      case 'AVVIAMENTO': {
        if (this.speed < this.speedNom) {
          this.speed = Math.min(this.speedNom, (this.phaseT / T_ACCEL) * this.speedNom);
          if (this.phaseT >= T_IGNITION && this.phase === 'Lavaggio caldaia') {
            this.phase = 'Accensione e accelerazione';
            this.log('Accensione TG riuscita');
          }
          if (this.phaseT >= T_IGNITION) fuelFrac = FSNL_FUEL * (0.4 + 0.6 * (this.speed / this.speedNom));
          if (this.speed >= this.speedNom) {
            this.phase = 'Presa di carico';
            this.phaseT = 0;
            this.gtLoad = 0.03;
            this.log('TG in parallelo con la rete');
          }
        } else if (this.phase === 'Presa di carico') {
          this.rampTo(LOAD_HOLD, dt);
          if (this.gtLoad >= LOAD_HOLD) {
            this.phase = 'Riscaldamento GVR e linee vapore';
            this.phaseT = 0;
            this.log('Carico di riscaldamento raggiunto, vapore in bypass');
          }
        } else if (this.phase === 'Riscaldamento GVR e linee vapore') {
          if (this.phaseT >= T_HOLD) {
            this.stOnline = true;
            this.phase = 'Rampa al carico richiesto';
            this.log('TV rullata e in parallelo');
          }
        } else {
          this.rampTo(this.setpoint, dt);
          if (Math.abs(this.gtLoad - this.setpoint) < 1e-6) {
            this.state = 'IN_SERVIZIO';
            this.phase = 'Regolazione di carico';
            this.log('Avviamento completato');
          }
        }
        break;
      }
      case 'IN_SERVIZIO':
        this.rampTo(this.setpoint, dt);
        this.phase = Math.abs(this.gtLoad - this.setpoint) < 1e-6 ? 'Regolazione di carico' : 'Variazione di carico in rampa';
        break;
      case 'ARRESTO':
        if (this.phase === 'Riduzione di carico') {
          this.rampTo(LOAD_HOLD, dt);
          if (this.gtLoad <= LOAD_HOLD + 1e-9) {
            if (this.stOnline) this.log('TV fuori parallelo, vapore in bypass');
            this.stOnline = false;
            this.phase = 'Scarico TG';
          }
        } else if (this.phase === 'Scarico TG') {
          this.rampTo(0, dt);
          if (this.gtLoad <= 0) {
            this.log('TG fuori parallelo, spegnimento fiamma');
            this.phase = 'Decelerazione';
            this.phaseT = 0;
          }
        } else {
          this.gtLoad = 0;
          this.speed = Math.max(0, this.speed - (this.speedNom / T_COAST) * dt);
          if (this.speed <= 0) {
            this.state = 'FERMO';
            this.phase = '';
            this.log('TG ferma, in viraggio');
          }
        }
        break;
      case 'BLOCCO':
        this.gtLoad = 0;
        this.speed = Math.max(0, this.speed - (this.speedNom / T_COAST) * dt);
        if (this.speed <= 0) this.phase = 'In attesa di riconoscimento';
        break;
      default:
        break;
    }

    gtOn = this.gtLoad > 0;
    const ss = gtOn ? steady(this.gtLoad) : null;

    // Valori obiettivo del ciclo a vapore
    const target = ss && ss.online
      ? {
        Pst: this.stOnline ? ss.Pst : 0,
        mSteam: ss.bt.mSteamTot,
        Tstack: ss.bt.Tstack,
        pHP: ss.bt.pAdm[0],
        Qcond: ss.bt.Qcond,
        frac: 1,
      }
      : { Pst: 0, mSteam: 0, Tstack: this.lag ? Math.max(30, this.lag.Tstack * 0.98) : 30, pHP: 0, Qcond: 0, frac: 0 };

    if (!this.lag) this.lag = { ...target };
    // fuori parallelo la potenza TV si annulla rapidamente (valvole di arresto)
    const tauSt = this.stOnline ? TAU_HRSG : TAU_TRIP;
    const a = 1 - Math.exp(-dt / tauSt);
    const b = 1 - Math.exp(-dt / TAU_HRSG);
    this.lag.Pst += (target.Pst - this.lag.Pst) * a;
    for (const k of ['mSteam', 'Tstack', 'pHP', 'Qcond', 'frac']) this.lag[k] += (target[k] - this.lag[k]) * b;

    return { ss, lag: { ...this.lag }, fuelFrac, gtOn };
  }

  snapshot() {
    return {
      t: this.t, state: this.state, stateLabel: STATES[this.state], phase: this.phase,
      gtLoad: this.gtLoad, setpoint: this.setpoint, speed: this.speed, stOnline: this.stOnline,
    };
  }
}

/** Formatta un tempo di simulazione in g hh:mm:ss. */
export function formatSimTime(t) {
  const s = Math.floor(t);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (v) => String(v).padStart(2, '0');
  return `${d > 0 ? `g${d} ` : ''}${pad(h)}:${pad(m)}:${pad(ss)}`;
}
