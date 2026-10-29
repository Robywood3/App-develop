// Ingegneria dei sistemi utilities e ausiliari: linee, utenze elettriche e
// apparecchiature ricavate dal bilancio utilities al punto di progetto.

import { propsPT, satP } from '../engine/steam.js';

const G = 9.81;
const RHO = 998;
const vW = 1 / RHO;
const R_U = 8.314462618;
/** Volume specifico di un gas ideale [m³/kg]; M [kg/kmol], p [bar a], T [°C]. */
export const vGas = (M, p, T) => ((R_U / M) * (T + 273.15)) / (p * 100);
/** Nm³/h -> kg/s. */
const nm3h = (q, M) => (q * ((101325 * M) / (R_U * 1000 * 273.15))) / 3600;
const roundUp = (v, s) => Math.ceil(v / s - 1e-9) * s;

// ------------------------------------------------------------------ linee
export function utilityLines(c) {
  const { L, U, cfg, des, N, units, pFG, fuel, bt, water } = c;
  const kgs = (m3h) => (m3h * RHO) / 3600;
  // stazione gas
  const g = U.gas;
  const mG = g.mFuel || 1;
  L('NG-IN', 0, 'NG', 'gas', 'Gasdotto (punto di consegna)', '0EKA10 filtri separatori', mG, g.pIn, g.Tin, 20, vGas(fuel.M, g.pIn, g.Tin), 'EKA', { pDes: 85, TDes: 50 });
  L('NG-H', 0, 'NG', 'gas', '0EKA20 riscaldatori gas', '0EKA30 linee di riduzione', mG, g.pIn - 1.5, g.preheatT, 20, vGas(fuel.M, g.pIn - 1.5, g.preheatT), 'EKA', { pDes: 85, TDes: 80 });
  L('NG-OUT', 0, 'NG', 'gas', '0EKA30 linee di riduzione', 'Collettore gas ai TG', mG, pFG + 1, g.Tout, 20, vGas(fuel.M, pFG + 1, g.Tout), 'EKA');
  L('NG-AB', 0, 'NG', 'gas', 'Collettore gas', '0QHA10 caldaia ausiliaria', mG * 0.04, 6, 10, 20, vGas(fuel.M, 6, 10), 'EKA', { pDes: 10, TDes: 50 });
  L('NG-V', 0, 'NG', 'gas', 'Sfiati stazione gas', 'Camino di sfiato 0EKA90', mG * 0.2, 2, 10, 60, vGas(fuel.M, 2, 10), 'EKA', { pDes: 10, TDes: 50 });
  L('NG-DR', 0, 'DR', 'ww', '0EKA05 knock-out drum e filtri separatori', '0EKA80 serbatoio drenaggi', 0.05, 2, 10, 1.0, 1 / 700, 'EKA', { pDes: 10, TDes: 50 });
  // raffreddamento principale
  if (water) {
    const cw = U.cooling;
    L('CTM', 0, 'RW', 'water', 'Alimentazione acqua grezza (a monte del serbatoio)', '0PAE10 vasca torre (reintegro)', cw.makeup, 4, 18, 2.5, vW, 'PAE', { pDes: 8, TDes: 50 });
    L('CTB', 0, 'WW', 'ww', '0PAC10 mandata pompe CW (spurgo)', '0GMA10 vasca di neutralizzazione', cw.blowdown, 2.5, cw.Tin + 2, 1.8, vW, 'PAE', { pDes: 6, TDes: 50 });
    L('CHH', 0, 'CH', 'chem', '0PAX10 dosaggio ipoclorito', 'Vasca torre / aspirazione pompe CW', 0.01, 4, 20, 1.0, 1 / 1200, 'PAX', { pDes: 10, TDes: 40 });
    L('CHA', 0, 'CH', 'chem', '0PAX30 dosaggio inibitore', 'Linea di reintegro torre', 0.005, 4, 20, 1.0, 1 / 1100, 'PAX', { pDes: 10, TDes: 40 });
    L('CHS', 0, 'CH', 'chem', '0PAX20 dosaggio acido solforico', 'Vasca torre', 0.005, 4, 20, 1.0, 1 / 1830, 'PAX', { pDes: 10, TDes: 40 });
    const acw = U.ccw.acwFlow;
    L('ACWS', 0, 'CW', 'cw', '0PAC20 pompe acqua ausiliaria', '0PGD10 intercooler ciclo chiuso', acw * 1.1, 3.5, cw.Tin, 3.0, vW, 'PAC', { pDes: 6, TDes: 50 });
    L('ACWR', 0, 'CW', 'cw', '0PGD10 intercooler ciclo chiuso', '0PAE10 torre (ritorno)', acw * 1.1, 1.8, cw.Tin + U.ccw.acwDT, 3.0, vW, 'PAC', { pDes: 6, TDes: 60 });
  } else {
    const ld = bt.sections[bt.sections.length - 1];
    L('ACD', 0, 'CD', 'water', '0MAG10 collettori condensato ACC', '0MAG20 serbatoio condensato', ld.m, bt.pCond + 0.05, bt.Tcond, 0.8, satP(bt.pCond).vL, 'MAG', { pDes: 3.5, TDes: 120 });
    L('ACV', 0, 'VE', 'cw', '0MAG10 estrazione incondensabili', '0MAJ10 eiettori / pompe del vuoto', 0.4, bt.pCond, bt.Tcond - 3, 60, vGas(20, bt.pCond, bt.Tcond - 3), 'MAJ', { pDes: 3.5, TDes: 120 });
  }
  // ciclo chiuso
  const cc = U.ccw;
  L('CCS', 0, 'CC', 'water', '0PGB10 pompe ciclo chiuso', 'Collettore mandata utenze', cc.flow * 1.1, 6, cc.Tsupply, 3.0, vW, 'PGB', { pDes: 10, TDes: 70 });
  L('CCR', 0, 'CC', 'water', 'Collettore ritorno utenze', water ? '0PGD10 intercooler ciclo chiuso' : '0PGC10 scambiatore aria/acqua', cc.flow * 1.1, 4, cc.Treturn, 3.0, vW, 'PGB', { pDes: 10, TDes: 70 });
  for (const us of cc.users) {
    const unit = Number(us.tag[0]);
    const m = Math.max(1, (us.kW || 100) / (4.18 * cc.dT));
    L(`CC-${us.tag}`, unit, 'CC', 'water', 'Collettore ciclo chiuso', us.name, m, 6, cc.Tsupply, 2.2, vW, us.tag.slice(1, 4), { pDes: 10, TDes: 70 });
  }
  L('CC-MU', 0, 'DM', 'demin', '0GHC10 collettore acqua demi', '0PGB20 vaso di espansione', 0.5, 5, 20, 1.5, vW, 'PGB', { pDes: 10, TDes: 50 });
  // aria compressa
  const a = U.air;
  const mAir = nm3h(a.compressorNm3h, 28.96);
  L('IA-D', 0, 'IA', 'air', '0SCA10 compressori', '0SCB10 serbatoio aria umida', mAir, a.pressure, 40, 15, vGas(28.96, a.pressure, 40), 'SCA', { pDes: 13, TDes: 80 });
  L('IA-H', 0, 'IA', 'air', '0SCC10 essiccatori', 'Collettore aria strumenti', nm3h(a.instrument * 1.3, 28.96), 8, 30, 12, vGas(28.96, 8, 30), 'SCA', { pDes: 11, TDes: 60 });
  L('SA-H', 0, 'SA', 'air', '0SCB10 serbatoio aria umida', 'Collettore aria servizi', nm3h(a.service * 1.3, 28.96), 8, 35, 12, vGas(28.96, 8, 35), 'SCB', { pDes: 11, TDes: 60 });
  for (const [id, to, f] of [['IA-GT', 'Utenze aria strumenti TG', 0.2], ['IA-HR', 'Utenze aria strumenti GVR', 0.3], ['IA-ST', 'Utenze aria strumenti TV e ciclo', 0.25], ['IA-BOP', 'Utenze aria strumenti BoP', 0.25]]) {
    L(id, 0, 'IA', 'air', 'Collettore aria strumenti', to, nm3h(a.instrument * f * 1.3, 28.96), 7.5, 30, 12, vGas(28.96, 7.5, 30), 'SCA', { pDes: 11, TDes: 60 });
  }
  // acqua grezza, servizi e antincendio
  const raw = U.rawWater;
  const pt = U.pret;
  L('RW-IN', 0, 'RW', 'water', 'Opera di presa / acquedotto', '0GAA10 serbatoio acqua grezza e antincendio', kgs(pt.pumpM3h) * 1.2, 3, 15, 2.5, vW, 'GAA', { pDes: 6, TDes: 50 });
  L('RW-P', 0, 'RW', 'water', '0GAA10 pompe alimento pretrattamento', '0GBA10 impianto di pretrattamento', kgs(pt.pumpM3h), 3, 15, 2.5, vW, 'GAA', { pDes: 6, TDes: 50 });
  L('SV-T', 0, 'SV', 'water', '0GBA10 impianto di pretrattamento', '0GHA10 serbatoio acqua servizi', kgs(pt.pumpM3h), 2, 15, 2.5, vW, 'GHA', { pDes: 6, TDes: 50 });
  L('RW-RO', 0, 'SV', 'water', '0GHB10 pompe alimento demi', '0GCF10 impianto demi', kgs(pt.demiFeedM3h), 3, 15, 2.5, vW, 'GHB', { pDes: 6, TDes: 50 });
  L('SV-H', 0, 'SV', 'water', '0GHA10 pompe acqua servizi', 'Rete acqua servizi e potabile', kgs(pt.serviceM3h), 6, 15, 2.5, vW, 'GHA', { pDes: 10, TDes: 50 });
  L('FF-P', 0, 'FF', 'water', '0SGA10 pompe antincendio', 'Anello antincendio', kgs(pt.firePumpM3h), 10, 15, 3.0, vW, 'SGA', { pDes: 16, TDes: 50 });
  L('FF-H', 0, 'FF', 'water', 'Anello antincendio', 'Idranti, diluvi, sprinkler', kgs(pt.firePumpM3h), 9, 15, 2.5, vW, 'SGA', { pDes: 16, TDes: 50 });
  // acqua demineralizzata
  const d = U.demi;
  L('DM-RO', 0, 'RW', 'water', '0GCF20 pompe alta pressione RO', '0GCF30 osmosi inversa', d.roFeed, 16, 18, 2.0, vW, 'GCF', { pDes: 25, TDes: 50 });
  L('ROR', 0, 'WW', 'ww', '0GCF30 concentrato RO', '0GMA10 vasca di neutralizzazione', d.roReject + d.ediReject, 3, 18, 1.5, vW, 'GCF', { pDes: 6, TDes: 50 });
  L('DM-P', 0, 'DM', 'demin', '0GCF30 permeato RO', '0GCF40 elettrodeionizzazione', d.roPermeate, 4, 18, 1.5, vW, 'GCF', { pDes: 10, TDes: 50 });
  L('DM-T', 0, 'DM', 'demin', '0GCF40 prodotto EDI', '0GHC10 serbatoio acqua demi', d.demin * 1.5, 3, 18, 1.5, vW, 'GCF', { pDes: 10, TDes: 50 });
  L('DM-H', 0, 'DM', 'demin', '0GHC10 pompe distribuzione', 'Collettore acqua demi', kgs(Math.max(25, d.demiM3h * 2)), 6, 20, 2.5, vW, 'GHC', { pDes: 10, TDes: 50 });
  L('DM-GTW', 0, 'DM', 'demin', 'Collettore acqua demi', 'Skid lavaggio compressori TG', 1.5, 5, 20, 1.5, vW, 'GHC', { pDes: 10, TDes: 50 });
  // chimici e campionamento
  L('CH-NH3', 0, 'CH', 'chem', '0QCA10 dosaggio ammoniaca', 'Mandata pompe condensato', 0.002, 12, 20, 1.0, 1 / 950, 'QCA', { pDes: 20, TDes: 50 });
  L('CH-OS', 0, 'CH', 'chem', '0QCB10 dosaggio deossigenante', 'Mandata pompe condensato', 0.002, 12, 20, 1.0, 1 / 1000, 'QCB', { pDes: 20, TDes: 50 });
  for (const u of units) {
    L(`CH-PO4-${u}`, u, 'CH', 'chem', '0QCC10 pompe fosfati HP', `Corpo cilindrico HP GVR${u}`, 0.0025, bt.pDrum[0] * 1.25, 30, 1.0, 1 / 1050, 'QCC');
    if (bt.pDrum.length > 2) L(`CH-PO4IP-${u}`, u, 'CH', 'chem', '0QCC20 pompe fosfati IP', `Corpo cilindrico IP GVR${u}`, 0.0012, bt.pDrum[1] * 1.25, 30, 1.0, 1 / 1050, 'QCC');
  }
  for (const [id, from, p, T] of [['SMP-CD', 'Mandata pompe condensato', bt.pDrum[bt.pDrum.length - 1] * 1.25, bt.TCondOut], ['SMP-FW', 'Mandata pompe alimento', bt.pDrum[0] * 1.15, bt.TsubLP], ['SMP-HPD', 'Corpo cilindrico HP', bt.pDrum[0], bt.Tsat[0]], ['SMP-HPS', 'Vapore HP', bt.pAdm[0], bt.Tsh[0]]]) {
    L(id, 0, 'SM', 'sample', from, '0QUA10 pannello campionamento', 0.05, p, T, 2.5, T > 0 ? propsPT(p, Math.min(T, 590)).v : vW, 'QUA');
  }
  // acque reflue
  const w = U.ww;
  L('WW-BD', 0, 'WW', 'ww', 'Serbatoi spurghi GVR', '0GMA10 vasca di neutralizzazione', w.hrsgBD + 0.5, 2, 40, 1.5, vW, 'GMA', { pDes: 6, TDes: 60 });
  L('WW-NEU', 0, 'WW', 'ww', '0GMA10 pompe vasca neutralizzazione', '0GMA20 vasca di controllo finale', w.total * 1.3, 4, 30, 1.8, vW, 'GMA', { pDes: 8, TDes: 60 });
  L('WW-OUT', 0, 'WW', 'ww', '0GMA20 vasca di controllo', 'Scarico autorizzato', w.total * 1.3, 2, 30, 1.5, vW, 'GMA', { pDes: 6, TDes: 60 });
  L('OW-IN', 0, 'OW', 'ww', 'Bacini trasformatori, area TG/TV', '0GMB10 disoleatore', 5, 1.5, 25, 1.2, vW, 'GMB', { pDes: 6, TDes: 50 });
  // gas tecnici
  L('N2-H', 0, 'NI', 'tgas', '0QJA10 pacchi bombole azoto', 'Collettore azoto', nm3h(200, 28), 10, 20, 15, vGas(28, 10, 20), 'QJA', { pDes: 16, TDes: 50 });
  L('N2-FG', 0, 'NI', 'tgas', 'Collettore azoto', 'Spurgo linee gas TG / stazione', nm3h(120, 28), 8, 20, 15, vGas(28, 8, 20), 'QJA', { pDes: 16, TDes: 50 });
  L('N2-HR', 0, 'NI', 'tgas', 'Collettore azoto', 'Polmonazione GVR e corpi cilindrici', nm3h(80, 28), 3, 20, 15, vGas(28, 3, 20), 'QJA', { pDes: 16, TDes: 50 });
  L('H2-G', 0, 'HY', 'tgas', '0QJB10 rastrelliera idrogeno', 'Generatori raffreddati a idrogeno', nm3h(15, 2.016), 8, 20, 10, vGas(2.016, 8, 20), 'QJB', { pDes: 16, TDes: 50 });
  L('CO2-G', 0, 'CO', 'tgas', '0QJC10 rastrelliera CO₂', 'Spurgo generatori', nm3h(40, 44), 8, 20, 10, vGas(44, 8, 20), 'QJC', { pDes: 16, TDes: 50 });
  // gasolio di riserva
  if (U.diesel) {
    const o = U.diesel, vO = 1 / 845;
    L('DO-U', 0, 'DO', 'oil', 'Baie di scarico autobotti', '0EGB10 serbatoio gasolio', (o.unloadM3h * 845) / 3600, 3, 20, 2.0, vO, 'EGA', { pDes: 10, TDes: 50 });
    L('DO-T', 0, 'DO', 'oil', '0EGC10 pompe trasferimento gasolio', 'Modulo combustibile liquido TG', (o.transferM3h * 845) / 3600, 6, 20, 2.5, vO, 'EGC', { pDes: 16, TDes: 50 });
    L('DO-A', 0, 'DO', 'oil', '0EGD10 pompe trasferimento ausiliarie', 'Caldaia ausiliaria, serbatoi giornalieri diesel', (o.auxM3h * 845) / 3600, 6, 20, 2.0, vO, 'EGD', { pDes: 16, TDes: 50 });
  }
  // vapore ausiliario
  const s = U.auxSteam;
  const vAS = propsPT(s.p, s.T).v;
  L('AS-B', 0, 'AS', 'steam', '0QHA10 caldaia ausiliaria', 'Collettore vapore ausiliario', s.boilerCapacity, s.p, s.T, 35, vAS, 'QHA');
  L('AS-H', 0, 'AS', 'steam', 'Collettore vapore ausiliario', 'Utenze vapore ausiliario', s.boilerCapacity, s.p - 0.5, s.T - 5, 35, propsPT(s.p - 0.5, s.T - 5).v, 'QHB');
  L('ABF', 0, 'FW', 'water', '0QHA20 pompe alimento caldaia aux', '0QHA10 caldaia ausiliaria', s.boilerCapacity, s.p * 1.3, 105, 2.0, vW, 'QHA', { pDes: s.p * 1.6, TDes: 140 });
  void cfg; void des;
}

// ------------------------------------------------------------------ utenze elettriche
export function utilityLoads(c) {
  const { addLoad, kks, U, N, water, r } = c;
  const kWpump = (m3h, Hm, eta = 0.75) => ((m3h / 3600) * RHO * G * Hm) / eta / 1000;
  const cc = U.ccw;
  addLoad(kks(0, 'PGB', 10, 'AP', 1), 'Pompa acqua raffreddamento ciclo chiuso (A/B)', 2, 1, kWpump(cc.m3h * 1.1, 30), 'C');
  if (water) {
    addLoad(kks(0, 'PAC', 20, 'AP', 1), 'Pompa acqua ausiliaria ACW agli intercooler (A/B)', 2, 1, kWpump(cc.acwM3h * 1.1, 30), 'C', { equip: kks(0, 'PAC', 20) });
    addLoad(kks(0, 'MAG', 15, 'AP', 1), 'Pompa ricircolo pulizia tubi condensatore (A/B)', 2, 1, 15, 'C');
    addLoad(kks(0, 'PAA', 10, 'AM', 1), 'Sgrigliatori griglie presa acqua torre (A/B)', 2, 2, 5.5, 'I');
  } else {
    const nFans = Math.max(4, Math.ceil(cc.kW / 900));
    addLoad(kks(0, 'PGC', 10, 'AN', 1), `Ventilatori scambiatore aria/acqua ciclo chiuso (${nFans} + 1)`, nFans + 1, nFans, (cc.kW * 0.018) / nFans + 5, 'C');
  }
  const air = U.air;
  addLoad(kks(0, 'SCA', 10, 'AN', 1), 'Compressore aria a vite oil-free 11 bar (A/B)', 2, 1, air.compressorNm3h * 0.125, 'C');
  addLoad(kks(0, 'SCC', 10, 'AH', 1), 'Essiccatori aria heatless (A/B, quadro e valvole)', 2, 1, 1.5, 'C', { pf: 0.95 });
  const pt = U.pret;
  addLoad(kks(0, 'GAA', 10, 'AP', 1), 'Pompa alimento pretrattamento (A/B)', 2, 1, kWpump(pt.pumpM3h, 20), 'C');
  addLoad(kks(0, 'GBA', 10, 'GA', 1), 'Impianto di pretrattamento acqua (filtri, dosaggi)', 1, 1, 8 + pt.pumpM3h * 0.3, 'C', { pf: 0.85 });
  addLoad(kks(0, 'GAA', 20, 'AP', 1), 'Pompa dosaggio ipoclorito serbatoio acqua grezza', 1, 1, 0.37, 'I');
  addLoad(kks(0, 'GHA', 10, 'AP', 1), 'Pompa acqua servizi (A/B)', 2, 1, kWpump(pt.serviceM3h, 50), 'I');
  addLoad(kks(0, 'GHB', 10, 'AP', 1), 'Pompa alimento impianto demi (A/B)', 2, 1, kWpump(pt.demiFeedM3h, 20), 'C');
  const d = U.demi;
  addLoad(kks(0, 'GCF', 20, 'AP', 1), 'Pompa alta pressione osmosi inversa (A/B)', 2, 1, kWpump(d.plantM3h * 1.4, 160, 0.72), 'C');
  addLoad(kks(0, 'GCF', 40, 'GA', 1), 'Moduli EDI (alimentatori)', 2, 1, 4 + d.plantM3h * 0.35, 'C', { pf: 0.95, eff: 0.95 });
  addLoad(kks(0, 'GCF', 50, 'AP', 1), 'Pompa lavaggio CIP', 1, 1, 7.5, 'I');
  addLoad(kks(0, 'GHC', 10, 'AP', 1), 'Pompa distribuzione acqua demi (A/B)', 2, 1, kWpump(Math.max(25, d.demiM3h * 2), 60), 'C');
  addLoad(kks(0, 'QCA', 10, 'AP', 1), 'Pompe dosaggio ammoniaca (A/B)', 2, 1, 0.75, 'C');
  addLoad(kks(0, 'QCB', 10, 'AP', 1), 'Pompe dosaggio deossigenante (A/B)', 2, 1, 0.75, 'C');
  addLoad(kks(0, 'QCC', 10, 'AP', 1), 'Pompe dosaggio fosfati HP e IP (2 set 2×100 %)', 4, 2, 0.55, 'C');
  addLoad(kks(0, 'QCD', 20, 'AP', 1), 'Pompe di riempimento serbatoi chimici ciclo', 3, 3, 0.75, 'I');
  addLoad(kks(0, 'QCD', 10, 'AM', 1), 'Agitatori serbatoi preparazione chimici', 3, 3, 1.5, 'I');
  addLoad(kks(0, 'QUA', 10, 'GA', 1), 'Pannello campionamento e analizzatori', 1, 1, 18, 'C', { pf: 0.9, eff: 0.95 });
  if (water) {
    addLoad(kks(0, 'PAX', 10, 'AP', 1), 'Pompe dosaggio ipoclorito (shock, A/B)', 2, 1, 1.1, 'I');
    addLoad(kks(0, 'PAX', 20, 'AP', 1), 'Pompe dosaggio acido solforico (A/B)', 2, 1, 0.37, 'C');
    addLoad(kks(0, 'PAX', 30, 'AP', 1), 'Pompe dosaggio inibitore (A/B)', 2, 1, 0.37, 'C');
    addLoad(kks(0, 'PAD', 10, 'AP', 1), 'Pompa filtrazione in derivazione torre (A/B)', 2, 1, kWpump(U.cooling.cwM3h * 0.02, 30), 'C');
  } else {
    addLoad(kks(0, 'MAG', 20, 'AP', 1), 'Pompa drenaggio serbatoio condensato ACC (A/B)', 2, 1, kWpump(150, 25), 'I');
  }
  addLoad(kks(0, 'GMA', 10, 'AP', 1), 'Pompa vasca di neutralizzazione (A/B)', 2, 1, kWpump(U.ww.totalM3h * 1.3, 25), 'C');
  addLoad(kks(0, 'GMA', 10, 'AM', 1), 'Agitatore vasca di neutralizzazione', 1, 1, 7.5, 'C');
  addLoad(kks(0, 'GMA', 30, 'AP', 1), 'Pompe dosaggio acido/soda neutralizzazione', 2, 1, 0.75, 'I');
  addLoad(kks(0, 'GMB', 10, 'AP', 1), 'Pompa disoleatore e pozzetti', 3, 2, 4, 'I');
  addLoad(kks(0, 'QHA', 10, 'AN', 1), 'Ventilatore aria comburente caldaia ausiliaria', 1, 1, 15 + U.auxSteam.boilerCapacity * 8, 'S');
  addLoad(kks(0, 'QHA', 20, 'AP', 1), 'Pompa alimento caldaia ausiliaria (A/B)', 2, 1, kWpump(U.auxSteam.boilerCapacity * 3.6 * 1.2, U.auxSteam.p * 13), 'S');
  addLoad(kks(0, 'GKA', 10, 'GA', 1), 'Impianto acqua potabile e sanitari', 1, 1, 7.5, 'I');
  if (U.diesel) {
    const o = U.diesel;
    addLoad(kks(0, 'EGA', 10, 'AP', 1), 'Pompa scarico autobotti gasolio (A/B)', 2, 2, kWpump(o.unloadM3h, 15, 0.6), 'I');
    addLoad(kks(0, 'EGC', 10, 'AP', 1), 'Pompa trasferimento gasolio al TG (A/B)', 2, 1, kWpump(o.transferM3h, 50, 0.72), 'S');
    addLoad(kks(0, 'EGD', 10, 'AP', 1), 'Pompa trasferimento gasolio ausiliaria (A/B)', 2, 1, kWpump(o.auxM3h, 50, 0.5), 'I');
  }
  void r;
}

// ------------------------------------------------------------------ apparecchiature
export function utilityEquipment(c) {
  const { E, eq, U, N, water, f0, f1, loadKW, kks, des, pFG, ctCells, accCells, bt } = c;
  const g = U.gas;
  eq.push({ group: 'Stazione di ricevimento e riduzione gas' });
  E('0EKA05BB001', 'Separatore di liquidi (knock-out drum)', '1 (1×100 %)', 'A ciclone con materassino separatore', `Portata ${f0(g.Sm3h * 1.1)} Sm³/h`, '85', '80', 'SA-516 Gr.70');
  E('0EKA10AT001/002', 'Filtri separatori gas', '2 (2×100 %)', 'A cartucce, efficienza 99,5 % su particelle > 3 µm', `Portata ${f0(g.Sm3h * 1.1)} Sm³/h`, '85', '80', 'SA-516 Gr.70');
  E('0EKA10CF001/002', 'Linee di misura fiscale a ultrasuoni', '2 (2×100 %)', 'Multipath, non by-passabili (regole SNAM); gascromatografo', `Campo ${f0(g.Sm3h * 0.1)}–${f0(g.Sm3h * 1.2)} Sm³/h · PCS ${f1(g.hhvMJSm3)} MJ/Sm³`, '85', '80', 'Acciaio al carbonio');
  E('0EKA20AC001/002', 'Riscaldatori gas a bagno d\'acqua', '2 (2×100 %)', 'Circolazione naturale, bagno a 70–80 °C', `Duty ${f0(g.heaterKW * 1.25)} kW · gas ${f1(g.Tin)} → ${f1(g.preheatT)} °C · a valle riduzione ${f1(g.Tout)} °C (${f0(g.Tout - g.dewPoint)} K sopra rugiada)`, '85', '95', 'SA-106 B / acciaio al carbonio');
  E('0EKA30', 'Linee di riduzione pressione', '2 (2×100 %)', 'Valvola di blocco (SSV), monitor e regolatore attivo', `${f1(g.pIn)} → ${f1(g.pOut)} bar a · ${f0(g.Sm3h * 1.1)} Sm³/h`, '85', '80', 'API 5L X52');
  if (g.compressors) E('0EKB10AN001/002', 'Compressori gas combustibile', '2 (2×100 %)', 'Centrifughi, refrigerante olio/aria con una baia di riserva', `Fino a ${f1(g.pOut)} bar a`, '', '', '');
  E('0EKA80BB001', 'Serbatoio drenaggi stazione gas', '1', 'Atmosferico, raccolta condensati da knock-out drum e filtri', '5 m³', 'Atm.', '50', 'Acciaio al carbonio');
  E('0EKA90', 'Camino di sfiato stazione gas', '1', 'Verticale con tagliafiamma, in zona sicura', 'Scarico valvole di sicurezza e depressurizzazione', '10', '50', 'Acciaio al carbonio');
  if (U.diesel) {
    const o = U.diesel;
    eq.push({ group: 'Gasolio di riserva: scarico, stoccaggio e trasferimento' });
    E('0EGA10AP001/002', 'Stazioni di scarico autobotti', '2', 'Messa a terra, attacchi rapidi, filtro di aspirazione 25 µm', `${f0(o.unloadM3h)} m³/h · H 15 m ciascuna`, '10', '50', 'Acciaio al carbonio', loadKW(kks(0, 'EGA', 10, 'AP', 1)));
    E('0EGB10BB001', 'Serbatoio gasolio', '1', 'Verticale atmosferico a tetto fisso, aspirazione galleggiante', `${f0(o.tankM3)} m³ (${o.hours} h a pieno carico, ${f0(o.m3h)} m³/h)`, 'Atm.', '50', 'Acciaio al carbonio');
    E('0EGC10AT001', 'Filtro duplex aspirazione pompe trasferimento', '1', 'Duplex a cartucce, 99,5 % su particelle > 10 µm', `${f0(o.transferM3h * 1.1)} m³/h`, '16', '50', 'Acciaio al carbonio');
    E('0EGC10AP001/002', 'Pompe trasferimento gasolio al TG', '2 (2×100 %)', 'Centrifughe orizzontali', `Q ${f0(o.transferM3h)} m³/h · H 50 m`, '16', '50', 'Acciaio al carbonio', loadKW(kks(0, 'EGC', 10, 'AP', 1)));
    E('0EGD10AP001/002', 'Pompe trasferimento ausiliarie', '2 (2×100 %)', 'A caldaia ausiliaria, serbatoi giornalieri diesel emergenza e pompa antincendio', `Q ${f0(o.auxM3h)} m³/h · H 50 m`, '16', '50', 'Acciaio al carbonio', loadKW(kks(0, 'EGD', 10, 'AP', 1)));
  }
  eq.push({ group: water ? 'Acqua di circolazione, acqua ausiliaria e torre di raffreddamento' : 'Sistema aerocondensatore' });
  if (water) {
    const cw = U.cooling;
    E('0PAE10', 'Torre di raffreddamento evaporativa', '1', `${ctCells} celle a tiraggio indotto, controcorrente, con by-pass antigelo`, `Duty ${f0(cw.Qcond + U.ccw.kW / 1000)} MW (condensatore + ciclo chiuso) · ${f0(cw.cwM3h + U.ccw.acwM3h)} m³/h · ${f1(cw.Tout)} → ${f1(cw.Tin)} °C · COC ${cw.coc}`, 'Atm.', '50', 'Calcestruzzo / GRP');
    E('0PAE10BB001', 'Vasca di raccolta torre', '1', 'In calcestruzzo, con paratoie (stop log)', `Volume ~${f0(roundUp(cw.cwM3h * 0.25, 100))} m³`, 'Atm.', '50', 'Calcestruzzo armato');
    E('0PAA10AT001/002', 'Griglie con sgrigliatore all\'aspirazione pompe', '2 (2×100 %)', 'Spaziatura barre 25–40 mm', `${f0(cw.cwM3h * 1.1 / 2 * 2)} m³/h per corsia`, 'Atm.', '50', 'Acciaio inox', loadKW(kks(0, 'PAA', 10, 'AM', 1)));
    E('0PAC20AP001/002', 'Pompe acqua ausiliaria (ACW)', '2 (2×100 %)', 'Verticali centrifughe', `Q ${f0(U.ccw.acwM3h * 1.1)} m³/h · H 30 m`, '6', '50', 'Girante e albero inox, corpo CS', loadKW(kks(0, 'PAC', 20, 'AP', 1)));
    E('0PAC20AT001/002', 'Filtri autopulenti acqua ausiliaria', '2 (2×100 %)', 'Maglia 200–300 µm', `${f0(U.ccw.acwM3h * 1.1)} m³/h`, '6', '50', 'Acciaio al carbonio rivestito');
    E('0MAG15', 'Sistema di pulizia tubi condensatore a palline spugnose', '1', '2×50 % filtri raccogli-palline, unità di ricircolo 1×100 % con pompe 2×100 %', 'Mantenimento del coefficiente di scambio del condensatore', '6', '50', 'Acciaio inox / gomma', loadKW(kks(0, 'MAG', 15, 'AP', 1)));
    E('0PAD10AT001', 'Filtro in derivazione acqua circolazione', '1', 'Filtro autopulente a sabbia', `${f0(cw.cwM3h * 0.02)} m³/h (2 % della portata)`, '6', '50', 'Acciaio al carbonio', loadKW(kks(0, 'PAD', 10, 'AP', 1)));
    E('0PAX10', 'Dosaggio ipoclorito di sodio (shock)', '1', 'Serbatoio 20 m³, pompe 2×100 % a membrana, 200 l/h, residuo 0,1–0,2 ppm', `${f1(cw.hypo)} kg/h durante lo shock (2–3 volte al giorno) · ${f0(cw.hypoDaily)} kg/giorno`, '5', '40', 'PE / PVDF', loadKW(kks(0, 'PAX', 10, 'AP', 1)));
    E('0PAX20', 'Dosaggio acido solforico (controllo pH)', '1', 'Serbatoio 6 m³, pompe 2×100 % 20 l/h con posizionatore automatico su pH', `${f1(cw.acid)} kg/h`, '5', '40', 'PE / acciaio al carbonio', loadKW(kks(0, 'PAX', 20, 'AP', 1)));
    E('0PAX30', 'Dosaggio inibitore sul reintegro', '1', 'Serbatoio 6 m³, pompe 2×100 % 20 l/h comandate dalla portata di spurgo', `${f1(cw.antiscalant)} kg/h`, '5', '40', 'PE', loadKW(kks(0, 'PAX', 30, 'AP', 1)));
  } else {
    E('0MAG20BB001', 'Serbatoio condensato ACC', '1', 'Orizzontale, con degasaggio', `Volume ~${f0(roundUp(bt.mSteamTot * 3.6 * 0.15, 5))} m³`, '1,0 / FV', '120', 'SA-516 Gr.70');
    E('0MAJ20', 'Eiettori di avviamento e mantenimento ACC', '1', 'Eiettori a vapore 2×100 % + avviamento', `${accCells} celle servite`, '16', '260', 'Acciaio al carbonio');
  }
  const cc = U.ccw;
  eq.push({ group: 'Acqua di raffreddamento a ciclo chiuso' });
  E('0PGB10AT001/002', 'Filtri aspirazione pompe ciclo chiuso', '2 (2×100 %)', 'A cartuccia, maglia 200 µm', `${f0(cc.m3h * 1.1)} m³/h`, '10', '70', 'Acciaio al carbonio');
  E('0PGB10AP001/002', 'Pompe acqua ciclo chiuso', '2 (2×100 %)', 'Centrifughe orizzontali', `Q ${f0(cc.m3h * 1.1)} m³/h · H 30 m`, '10', '70', 'Girante e albero inox, corpo CS', loadKW(kks(0, 'PGB', 10, 'AP', 1)));
  if (water) E('0PGD10AC001/002', 'Intercooler acqua ciclo chiuso', '2 (2×100 %)', 'A piastre (fascio tubiero con acqua di fiume ad alto contenuto di solidi)', `Duty ${f1(cc.kW / 1000)} MW · ${f1(cc.Treturn)} → ${f1(cc.Tsupply)} °C · ACW ${f0(cc.acwM3h)} m³/h`, '10', '70', 'Inox / duplex (titanio con acqua di mare)');
  else E('0PGC10', 'Scambiatore aria/acqua ciclo chiuso', '1', `${Math.max(4, Math.ceil(cc.kW / 900)) + 1} ventilatori; pieno carico con un fascio o un ventilatore fuori servizio`, `Duty ${f1(cc.kW / 1000)} MW · ${f1(cc.Treturn)} → ${f1(cc.Tsupply)} °C (≥ 6 K sopra l'aria)`, '10', '70', 'Tubi alettati CS / Al', loadKW(kks(0, 'PGC', 10, 'AN', 1)));
  E('0PGB20BB001', 'Serbatoio di testa (espansione) ciclo chiuso', '1', 'Cilindrico orizzontale, collegato vicino all\'aspirazione pompe, reintegro demi su livello', `${f0(cc.headTankM3)} m³`, '3', '70', 'Acciaio al carbonio');
  E('0PGB30BB001', 'Serbatoio dosaggio inibitore e antigelo', '1', 'Cilindrico verticale', `${f1(cc.dosingTankM3)} m³`, '10', '70', 'Acciaio inox');
  const a = U.air;
  eq.push({ group: 'Aria compressa' });
  E('0SCA10AN001/002', 'Compressori aria a vite oil-free', '2 (2×100 %)', 'Raffreddati ad acqua ciclo chiuso', `${f0(a.compressorNm3h)} Nm³/h a ${a.pressure} bar a`, '13', '80', '', loadKW(kks(0, 'SCA', 10, 'AN', 1)));
  E('0SCB10BB001', 'Serbatoio aria umida', '1', 'Verticale', `${f1(a.receiverM3)} m³`, '13', '80', 'SA-516 Gr.70');
  E('0SCC10AT001/002', 'Essiccatori ad adsorbimento heatless', '2 (2×100 %)', 'Due colonne ciascuno (esercizio/rigenerazione), prefiltro e postfiltro', `${f0(a.dryerNm3h)} Nm³/h netti · punto di rugiada −40 °C`, '13', '60', '', loadKW(kks(0, 'SCC', 10, 'AH', 1)));
  E('0SCC20BB001', 'Serbatoio aria strumenti', '1', `Verticale, autonomia ≥ ${a.holdupMin} min con compressori fermi (11 → 6 bar a)`, `${f1(a.receiverM3)} m³`, '13', '60', 'AISI 304');
  const pt = U.pret;
  eq.push({ group: 'Acqua grezza, pretrattamento, servizi e antincendio' });
  E('0GAA10BB001', 'Serbatoio acqua grezza e riserva antincendio', '1', 'Verticale atmosferico a tetto conico, rivestimento epossidico; aspirazioni utenze sopra la riserva', `${f0(pt.rawTankM3)} m³ (riserva antincendio ${f0(pt.fireReserveM3)} m³ + 4 h di pretrattamento)`, 'Atm.', '50', 'Acciaio al carbonio');
  E('0GAA20', 'Dosaggio ipoclorito serbatoio acqua grezza', '1', 'Skid con serbatoio e pompa dosatrice (clorazione manuale)', 'Contro lo sviluppo biologico nella riserva antincendio', '6', '40', 'PE', loadKW(kks(0, 'GAA', 20, 'AP', 1)));
  E('0GAA10AP001/002', 'Pompe alimento pretrattamento', '2 (2×100 %)', 'Centrifughe orizzontali', `Q ${f0(pt.pumpM3h)} m³/h · H 20 m`, '6', '50', 'Girante e albero inox, corpo CS', loadKW(kks(0, 'GAA', 10, 'AP', 1)));
  E('0GBA10', 'Impianto di pretrattamento acqua', '1', 'Chiariflocculazione e filtrazione (configurazione da definire sulla qualità dell\'acqua)', `${f0(pt.pumpM3h)} m³/h`, 'Atm.', '50', '', loadKW(kks(0, 'GBA', 10, 'GA', 1)));
  E('0GHA10BB001', 'Serbatoio acqua servizi', '1', 'Verticale atmosferico a tetto conico, rivestimento epossidico', `${f0(pt.serviceTankM3)} m³ (4 h servizi + 12 h impianto demi)`, 'Atm.', '50', 'Acciaio al carbonio');
  E('0GHA10AP001/002', 'Pompe acqua servizi', '2 (2×100 %)', 'Centrifughe orizzontali', `Q ${f0(pt.serviceM3h)} m³/h · H 50 m`, '10', '50', 'Girante e albero inox, corpo CS', loadKW(kks(0, 'GHA', 10, 'AP', 1)));
  E('0GHB10AP001/002', 'Pompe alimento impianto demi', '2 (2×100 %)', 'Centrifughe orizzontali', `Q ${f0(pt.demiFeedM3h)} m³/h · H 20 m`, '6', '50', 'Girante e albero inox, corpo CS', loadKW(kks(0, 'GHB', 10, 'AP', 1)));
  E('0SGA10AP001', 'Pompa antincendio elettrica', '1', 'UNI EN 12845 / NFPA 20', `Q ${f0(pt.firePumpM3h)} m³/h · H 100 m`, '16', '50', 'Ghisa', loadKW(kks(0, 'SGA', 10, 'AP', 1)));
  E('0SGA10AP002', 'Pompa antincendio diesel', '1', 'Motore diesel con serbatoio giornaliero', `Q ${f0(pt.firePumpM3h)} m³/h · H 100 m`, '16', '50', 'Ghisa');
  E('0SGA10AP003', 'Pompa di pressurizzazione (jockey)', '1', 'Multistadio verticale', 'Q 10 m³/h · H 105 m', '16', '50', 'Inox', loadKW(kks(0, 'SGA', 10, 'AP', 3)));
  const d = U.demi;
  eq.push({ group: 'Acqua demineralizzata' });
  E('0GCF10AT001/002', 'Filtri multistrato', '2 (2×100 %)', 'Sabbia e antracite, controlavaggio automatico', `${f0(pt.demiFeedM3h)} m³/h`, '6', '50', 'Acciaio al carbonio rivestito');
  E('0GCF20AP001/002', 'Pompe alta pressione osmosi inversa', '2 (2×100 %)', 'Multistadio inox', `${f0(pt.demiFeedM3h)} m³/h · 16 bar`, '25', '50', 'AISI 316L', loadKW(kks(0, 'GCF', 20, 'AP', 1)));
  E('0GCF30', 'Unità osmosi inversa', '2 (2×100 %)', 'Membrane spiralate, recupero 75 %', `Permeato ${f0(d.plantM3h * 1.05)} m³/h`, '25', '50', 'GRP / AISI 316L');
  E('0GCF40', 'Unità elettrodeionizzazione (EDI)', '2 (2×100 %)', 'Conducibilità prodotto < 0,1 µS/cm, SiO₂ < 10 ppb', `${f0(d.plantM3h)} m³/h`, '10', '50', '', loadKW(kks(0, 'GCF', 40, 'GA', 1)));
  E('0GHC10BB001', 'Serbatoio acqua demineralizzata', '1', 'Verticale atmosferico a tetto conico, polmonato ad azoto', `${f0(d.tankM3)} m³ (48 h con reintegro pari al 2 % del vapore, ${f1(d.designMakeupM3h)} m³/h)`, 'Atm.', '50', 'AISI 304L');
  E('0GHC10AP001/002', 'Pompe distribuzione acqua demi', '2 (2×100 %)', 'Centrifughe inox', `Q ${f0(Math.max(25, d.demiM3h * 2))} m³/h · H 60 m`, '10', '50', 'AISI 316L', loadKW(kks(0, 'GHC', 10, 'AP', 1)));
  eq.push({ group: 'Dosaggio chimico e campionamento' });
  const pl = U.chem.pumpsLh;
  E('0QCA10', 'Skid dosaggio ammoniaca (pH)', '1', `Serbatoio ${f1(U.chem.tankM3)} m³ in plastica, pompa di riempimento, pompe a membrana 2×100 % con posizionatore automatico`, `${f1(pl.ammonia)} l/h · 6–8 bar · proporzionale alla portata condensato con correzione sul pH`, '10', '50', 'PE / AISI 316', loadKW(kks(0, 'QCA', 10, 'AP', 1)));
  E('0QCB10', 'Skid dosaggio deossigenante (carboidrazide)', '1', `Serbatoio ${f1(U.chem.tankM3)} m³ in plastica, pompa di riempimento, pompe a membrana 2×100 % con posizionatore automatico`, `${f1(pl.scavenger)} l/h · 6–8 bar · proporzionale alla portata condensato con correzione sull'O₂ nel corpo LP`, '10', '50', 'PE / AISI 316', loadKW(kks(0, 'QCB', 10, 'AP', 1)));
  E('0QCC10', 'Skid dosaggio fosfati ai corpi HP e IP', '1', `Serbatoio ${f1(U.chem.tankM3)} m³ con agitatore; due set di pompe a membrana 2×100 % a regolazione manuale (HP e IP)`, `HP ${pl.phosphateHP} l/h a ${f0(bt.pDrum[0] * 1.3)} bar · IP ${pl.phosphateIP} l/h · fosfato trisodico`, f0(bt.pDrum[0] * 1.4), '50', 'PE / AISI 316', loadKW(kks(0, 'QCC', 10, 'AP', 1)));
  E('0QCD10', 'Docce di emergenza e lavaocchi', '1', 'Area dosaggi chimici ciclo e torre', '', '', '', '');
  E('0QUA10', 'Pannello di campionamento (SWAS)', '1', 'Refrigeranti campioni, riduttori, analizzatori in linea', 'Conducibilità cationica e specifica, pH, O₂, SiO₂, Na', '', '', 'AISI 316L', loadKW(kks(0, 'QUA', 10, 'GA', 1)));
  eq.push({ group: 'Acque reflue e drenaggi' });
  const w = U.ww;
  E('0GMA10BB001', 'Vasca di neutralizzazione', '1', 'In calcestruzzo rivestito, agitatore', `Ingresso ${f0(w.totalM3h)} m³/h · volume ${f0(roundUp(w.totalM3h * 8, 50))} m³`, 'Atm.', '60', 'Calcestruzzo / vinilestere', loadKW(kks(0, 'GMA', 10, 'AP', 1)));
  E('0GMA20BB001', 'Vasca di controllo finale', '1', 'Con strumentazione di monitoraggio allo scarico', 'pH, temperatura, conducibilità, portata', 'Atm.', '60', 'Calcestruzzo');
  E('0GMB10', 'Disoleatore acque oleose', '1', 'A coalescenza, classe I (≤ 5 mg/l idrocarburi)', '5 m³/h', 'Atm.', '50', 'Acciaio al carbonio / CLS', loadKW(kks(0, 'GMB', 10, 'AP', 1)));
  eq.push({ group: 'Gas tecnici' });
  E('0QJA10', 'Pacchi bombole azoto con riduzione', '1', '2 pacchi in scambio automatico', `Consumo ${f0(U.gases.n2Nm3d)} Nm³/giorno · fermata ${f0(U.gases.n2LayupNm3)} Nm³`, '230 / 16', '50', 'AISI 316L');
  E('0QJB10', 'Rastrelliera idrogeno generatori', '1', 'Bombole con riduzione e allarme', `Reintegro ${f0(U.gases.h2Nm3d)} Nm³/giorno`, '200 / 16', '50', 'AISI 316L');
  E('0QJC10', 'Rastrelliera CO₂ spurgo generatori', '1', 'Bombole con riscaldatore', `${f0(U.gases.co2PurgeKg)} kg per spurgo`, '60 / 16', '50', 'AISI 316L');
  eq.push({ group: 'Vapore ausiliario' });
  const s = U.auxSteam;
  E('0QHA10', 'Caldaia ausiliaria a tubi di fumo', '1', 'Bruciatore a gas a basso NOx', `${f0(s.boilerCapacity * 3.6)} t/h · ${s.p} bar · ${s.T} °C`, f0(s.p * 1.25), f0(s.T + 20), 'SA-516 Gr.70', loadKW(kks(0, 'QHA', 10, 'AN', 1)));
  E('0QHA20AP001/002', 'Pompe alimento caldaia ausiliaria', '2 (2×100 %)', 'Multistadio', `Q ${f0(s.boilerCapacity * 3.6 * 1.2)} m³/h`, f0(s.p * 1.6), '140', 'Inox', loadKW(kks(0, 'QHA', 20, 'AP', 1)));
  E('0QHB10', 'Collettore vapore ausiliario', '1', 'Con stazione di riduzione da RH freddo', `Utenze: tenute TV ${f1(s.gland * 3.6)} t/h, polmonazione corpi, eiettori, riscaldamento gas`, f0(s.p * 1.25), f0(s.T + 20), 'A106 B');
  void des; void pFG;
}
