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
  // raffreddamento principale
  if (water) {
    const cw = U.cooling;
    L('CTM', 0, 'RW', 'water', '0GAA10 pompe acqua grezza', '0PAE10 vasca torre (reintegro)', cw.makeup, 4, 18, 2.0, vW, 'PAE', { pDes: 8, TDes: 50 });
    L('CTB', 0, 'WW', 'ww', '0PAC10 mandata pompe CW (spurgo)', '0GMA10 vasca di neutralizzazione', cw.blowdown, 2.5, cw.Tin + 2, 1.8, vW, 'PAE', { pDes: 6, TDes: 50 });
    L('CHH', 0, 'CH', 'chem', '0PAX10 dosaggio ipoclorito', 'Vasca torre / aspirazione pompe CW', 0.01, 4, 20, 1.0, 1 / 1200, 'PAX', { pDes: 10, TDes: 40 });
    L('CHA', 0, 'CH', 'chem', '0PAX20 dosaggio antincrostante', 'Vasca torre', 0.005, 4, 20, 1.0, 1 / 1100, 'PAX', { pDes: 10, TDes: 40 });
  } else {
    const ld = bt.sections[bt.sections.length - 1];
    L('ACD', 0, 'CD', 'water', '0MAG10 collettori condensato ACC', '0MAG20 serbatoio condensato', ld.m, bt.pCond + 0.05, bt.Tcond, 0.8, satP(bt.pCond).vL, 'MAG', { pDes: 3.5, TDes: 120 });
    L('ACV', 0, 'VE', 'cw', '0MAG10 estrazione incondensabili', '0MAJ10 eiettori / pompe del vuoto', 0.4, bt.pCond, bt.Tcond - 3, 60, vGas(20, bt.pCond, bt.Tcond - 3), 'MAJ', { pDes: 3.5, TDes: 120 });
  }
  // ciclo chiuso
  const cc = U.ccw;
  L('CCS', 0, 'CC', 'water', '0PGB10 pompe ciclo chiuso', 'Collettore mandata utenze', cc.flow * 1.1, 6, cc.Tsupply, 2.5, vW, 'PGB', { pDes: 10, TDes: 70 });
  L('CCR', 0, 'CC', 'water', 'Collettore ritorno utenze', '0PGC10 aerotermi', cc.flow * 1.1, 4, cc.Treturn, 2.5, vW, 'PGB', { pDes: 10, TDes: 70 });
  for (const us of cc.users) {
    const unit = Number(us.tag[0]);
    const m = Math.max(1, (us.kW || 100) / (4.18 * cc.dT));
    L(`CC-${us.tag}`, unit, 'CC', 'water', 'Collettore ciclo chiuso', us.name, m, 6, cc.Tsupply, 2.2, vW, us.tag.slice(1, 4), { pDes: 10, TDes: 70 });
  }
  L('CC-MU', 0, 'DM', 'demin', '0GHC10 collettore acqua demi', '0PGB20 vaso di espansione', 0.5, 5, 20, 1.5, vW, 'PGB', { pDes: 10, TDes: 50 });
  // aria compressa
  const a = U.air;
  const mAir = nm3h(a.compressorNm3h, 28.96);
  L('IA-D', 0, 'IA', 'air', '0SCA10 compressori', '0SCB10 serbatoio aria umida', mAir, 9, 40, 15, vGas(28.96, 9, 40), 'SCA', { pDes: 11, TDes: 80 });
  L('IA-H', 0, 'IA', 'air', '0SCC10 essiccatori', 'Collettore aria strumenti', nm3h(a.instrument * 1.3, 28.96), 8, 30, 12, vGas(28.96, 8, 30), 'SCA', { pDes: 11, TDes: 60 });
  L('SA-H', 0, 'SA', 'air', '0SCB10 serbatoio aria umida', 'Collettore aria servizi', nm3h(a.service * 1.3, 28.96), 8, 35, 12, vGas(28.96, 8, 35), 'SCB', { pDes: 11, TDes: 60 });
  for (const [id, to, f] of [['IA-GT', 'Utenze aria strumenti TG', 0.2], ['IA-HR', 'Utenze aria strumenti GVR', 0.3], ['IA-ST', 'Utenze aria strumenti TV e ciclo', 0.25], ['IA-BOP', 'Utenze aria strumenti BoP', 0.25]]) {
    L(id, 0, 'IA', 'air', 'Collettore aria strumenti', to, nm3h(a.instrument * f * 1.3, 28.96), 7.5, 30, 12, vGas(28.96, 7.5, 30), 'SCA', { pDes: 11, TDes: 60 });
  }
  // acqua grezza, servizi e antincendio
  const raw = U.rawWater;
  L('RW-IN', 0, 'RW', 'water', 'Opera di presa / acquedotto', '0GAA10 serbatoio acqua grezza e antincendio', raw * 1.2, 3, 15, 2.0, vW, 'GAA', { pDes: 6, TDes: 50 });
  L('RW-P', 0, 'RW', 'water', '0GAA10 pompe acqua grezza', 'Collettore acqua grezza', raw * 1.15, 6, 15, 2.2, vW, 'GAA', { pDes: 10, TDes: 50 });
  L('RW-RO', 0, 'RW', 'water', 'Collettore acqua grezza', '0GCF10 impianto demi', U.demi.roFeed * 1.2, 5, 15, 1.8, vW, 'GAA', { pDes: 10, TDes: 50 });
  L('SV-H', 0, 'SV', 'water', 'Collettore acqua grezza', 'Rete acqua servizi', kgs(15), 5, 15, 1.8, vW, 'GHA', { pDes: 10, TDes: 50 });
  L('FF-P', 0, 'FF', 'water', '0SGA10 pompe antincendio', 'Anello antincendio', kgs(400 + 100 * N), 10, 15, 3.0, vW, 'SGA', { pDes: 16, TDes: 50 });
  L('FF-H', 0, 'FF', 'water', 'Anello antincendio', 'Idranti, diluvi, sprinkler', kgs(400 + 100 * N), 9, 15, 2.5, vW, 'SGA', { pDes: 16, TDes: 50 });
  // acqua demineralizzata
  const d = U.demi;
  L('DM-RO', 0, 'RW', 'water', '0GCF20 pompe alta pressione RO', '0GCF30 osmosi inversa', d.roFeed, 16, 18, 2.0, vW, 'GCF', { pDes: 25, TDes: 50 });
  L('ROR', 0, 'WW', 'ww', '0GCF30 concentrato RO', '0GMA10 vasca di neutralizzazione', d.roReject + d.ediReject, 3, 18, 1.5, vW, 'GCF', { pDes: 6, TDes: 50 });
  L('DM-P', 0, 'DM', 'demin', '0GCF30 permeato RO', '0GCF40 elettrodeionizzazione', d.roPermeate, 4, 18, 1.5, vW, 'GCF', { pDes: 10, TDes: 50 });
  L('DM-T', 0, 'DM', 'demin', '0GCF40 prodotto EDI', '0GHC10 serbatoio acqua demi', d.demin * 1.5, 3, 18, 1.5, vW, 'GCF', { pDes: 10, TDes: 50 });
  L('DM-H', 0, 'DM', 'demin', '0GHC10 pompe trasferimento', 'Collettore acqua demi', Math.max(d.demin * 4, 6), 6, 20, 1.8, vW, 'GHC', { pDes: 10, TDes: 50 });
  L('DM-GTW', 0, 'DM', 'demin', 'Collettore acqua demi', 'Skid lavaggio compressori TG', 1.5, 5, 20, 1.5, vW, 'GHC', { pDes: 10, TDes: 50 });
  // chimici e campionamento
  L('CH-NH3', 0, 'CH', 'chem', '0QCA10 dosaggio ammoniaca', 'Mandata pompe condensato', 0.002, 12, 20, 1.0, 1 / 950, 'QCA', { pDes: 20, TDes: 50 });
  L('CH-OS', 0, 'CH', 'chem', '0QCB10 dosaggio deossigenante', 'Mandata pompe condensato', 0.002, 12, 20, 1.0, 1 / 1000, 'QCB', { pDes: 20, TDes: 50 });
  for (const u of units) L(`CH-PO4-${u}`, u, 'CH', 'chem', '0QCC10 dosaggio fosfati', `Corpi cilindrici HP/IP GVR${u}`, 0.002, bt.pDrum[0] * 1.25, 30, 1.0, 1 / 1050, 'QCC');
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
  addLoad(kks(0, 'PGB', 10, 'AP', 1), 'Pompa acqua raffreddamento ciclo chiuso (A/B)', 2, 1, kWpump(cc.m3h * 1.1, 40), 'C');
  const nFans = Math.max(4, Math.ceil(cc.kW / 900));
  addLoad(kks(0, 'PGC', 10, 'AN', 1), `Ventilatori aerotermi ciclo chiuso (${nFans} + 1)`, nFans + 1, nFans, (cc.kW * 0.018) / nFans + 5, 'C');
  const air = U.air;
  addLoad(kks(0, 'SCA', 10, 'AN', 1), 'Compressore aria strumenti e servizi (A/B)', 2, 1, air.compressorNm3h * 0.115, 'C');
  addLoad(kks(0, 'SCC', 10, 'AH', 1), 'Essiccatori aria ad adsorbimento (A/B)', 2, 1, 6 + air.instrument * 0.01, 'C', { pf: 0.95 });
  const raw = U.rawWaterM3h;
  addLoad(kks(0, 'GAA', 10, 'AP', 1), 'Pompa acqua grezza (A/B)', 2, 1, kWpump(raw * 1.15, 45), 'C');
  addLoad(kks(0, 'GHA', 10, 'AP', 1), 'Pompa acqua servizi (A/B)', 2, 1, kWpump(15, 50), 'I');
  const d = U.demi;
  addLoad(kks(0, 'GCF', 10, 'AP', 1), 'Pompa alimento filtri multistrato (A/B)', 2, 1, kWpump(d.plantM3h * 1.5, 35), 'C');
  addLoad(kks(0, 'GCF', 20, 'AP', 1), 'Pompa alta pressione osmosi inversa (A/B)', 2, 1, kWpump(d.plantM3h * 1.4, 160, 0.72), 'C');
  addLoad(kks(0, 'GCF', 40, 'GA', 1), 'Moduli EDI (alimentatori)', 2, 1, 4 + d.plantM3h * 0.35, 'C', { pf: 0.95, eff: 0.95 });
  addLoad(kks(0, 'GCF', 50, 'AP', 1), 'Pompa lavaggio CIP', 1, 1, 7.5, 'I');
  addLoad(kks(0, 'GHC', 10, 'AP', 1), 'Pompa trasferimento acqua demi (A/B)', 2, 1, kWpump(Math.max(d.demiM3h * 4, 25), 60), 'C');
  addLoad(kks(0, 'QCA', 10, 'AP', 1), 'Pompe dosaggio ammoniaca (A/B)', 2, 1, 0.75, 'C');
  addLoad(kks(0, 'QCB', 10, 'AP', 1), 'Pompe dosaggio deossigenante (A/B)', 2, 1, 0.75, 'C');
  addLoad(kks(0, 'QCC', 10, 'AP', 1), `Pompe dosaggio fosfati (${N + 1})`, N + 1, N, 1.1, 'C');
  addLoad(kks(0, 'QCD', 10, 'AM', 1), 'Agitatori serbatoi preparazione chimici', 3, 3, 1.5, 'I');
  addLoad(kks(0, 'QUA', 10, 'GA', 1), 'Pannello campionamento e analizzatori', 1, 1, 18, 'C', { pf: 0.9, eff: 0.95 });
  if (water) {
    addLoad(kks(0, 'PAX', 10, 'AP', 1), 'Pompe dosaggio ipoclorito e antincrostante', 4, 2, 1.1, 'C');
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
  void r;
}

// ------------------------------------------------------------------ apparecchiature
export function utilityEquipment(c) {
  const { E, eq, U, N, water, f0, f1, loadKW, kks, des, pFG, ctCells, accCells, bt } = c;
  const g = U.gas;
  eq.push({ group: 'Stazione di ricevimento e riduzione gas' });
  E('0EKA10AT001/002', 'Filtri separatori gas', '2 (2×100 %)', 'Verticali a cartucce coalescenti', `Portata ${f0(g.Sm3h * 1.1)} Sm³/h · grado 3 µm`, '85', '50', 'SA-516 Gr.70');
  E('0EKA10CF001/002', 'Misuratori fiscali a ultrasuoni', '2 (2×100 %)', 'Multipath, con gascromatografo', `Campo ${f0(g.Sm3h * 0.1)}–${f0(g.Sm3h * 1.2)} Sm³/h · PCS ${f1(g.hhvMJSm3)} MJ/Sm³`, '85', '50', 'Acciaio al carbonio');
  E('0EKA20AC001/002', 'Riscaldatori gas a bagno d\'acqua', '2 (2×100 %)', 'Bruciatore a gas, serpentino immerso', `Duty ${f0(g.heaterKW * 1.25)} kW · gas ${f1(g.Tin)} → ${f1(g.preheatT)} °C (ΔT J-T ${f1(g.dTjt)} K)`, '85', '95', 'SA-106 B / acciaio al carbonio');
  E('0EKA30', 'Linee di riduzione pressione', '2 (2×100 %)', 'Valvola di blocco (SSV), monitor e regolatore attivo', `${f1(g.pIn)} → ${f1(g.pOut)} bar · ${f0(g.Sm3h * 1.1)} Sm³/h`, '85', '50', 'API 5L X52');
  E('0EKA90', 'Camino di sfiato stazione gas', '1', 'Verticale con tagliafiamma', 'Scarico valvole di sicurezza e depressurizzazione', '10', '50', 'Acciaio al carbonio');
  eq.push({ group: water ? 'Acqua di circolazione e torre di raffreddamento' : 'Sistema aerocondensatore' });
  if (water) {
    const cw = U.cooling;
    E('0PAE10', 'Torre di raffreddamento evaporativa', '1', `${ctCells} celle a tiraggio indotto, controcorrente`, `Duty ${f0(cw.Qcond)} MW · portata ${f0(cw.cwM3h)} m³/h · ${f1(cw.Tout)} → ${f1(cw.Tin)} °C`, 'Atm.', '50', 'Calcestruzzo / GRP');
    E('0PAE10BB001', 'Vasca di raccolta torre', '1', 'In calcestruzzo, con griglie e paratoie', `Volume ~${f0(roundUp(cw.cwM3h * 0.25, 100))} m³`, 'Atm.', '50', 'Calcestruzzo armato');
    E('0PAD10AT001', 'Filtro in derivazione acqua circolazione', '1', 'Filtro autopulente a sabbia', `${f0(cw.cwM3h * 0.02)} m³/h (2 % della portata)`, '6', '50', 'Acciaio al carbonio', loadKW(kks(0, 'PAD', 10, 'AP', 1)));
    E('0PAX10/20', 'Dosaggio chimico acqua di circolazione', '1', 'Ipoclorito, antincrostante, acido solforico', `Ipoclorito ${f1(cw.hypo)} kg/h · antincrostante ${f1(cw.antiscalant)} kg/h · COC ${cw.coc}`, '10', '40', 'PVDF / PE', loadKW(kks(0, 'PAX', 10, 'AP', 1)));
  } else {
    E('0MAG20BB001', 'Serbatoio condensato ACC', '1', 'Orizzontale, con degasaggio', `Volume ~${f0(roundUp(bt.mSteamTot * 3.6 * 0.15, 5))} m³`, '1,0 / FV', '120', 'SA-516 Gr.70');
    E('0MAJ20', 'Eiettori di avviamento e mantenimento ACC', '1', 'Eiettori a vapore 2×100 % + avviamento', `${accCells} celle servite`, '16', '260', 'Acciaio al carbonio');
  }
  const cc = U.ccw;
  eq.push({ group: 'Acqua di raffreddamento a ciclo chiuso' });
  E('0PGB10AP001/002', 'Pompe acqua ciclo chiuso', '2 (2×100 %)', 'Centrifughe orizzontali', `Q ${f0(cc.m3h * 1.1)} m³/h · H 40 m`, '10', '70', 'Ghisa / inox', loadKW(kks(0, 'PGB', 10, 'AP', 1)));
  E('0PGC10', 'Aerotermi acqua ciclo chiuso', '1', `${Math.max(4, Math.ceil(cc.kW / 900)) + 1} ventilatori (n+1)`, `Duty ${f1(cc.kW / 1000)} MW · ${f1(cc.Treturn)} → ${f1(cc.Tsupply)} °C`, '10', '70', 'Tubi alettati CS / Al', loadKW(kks(0, 'PGC', 10, 'AN', 1)));
  E('0PGB20BB001', 'Vaso di espansione ciclo chiuso', '1', 'Sopraelevato, polmonato ad azoto', `${f0(Math.max(2, cc.m3h * 0.01))} m³`, '3', '70', 'Acciaio al carbonio');
  E('0PGB30', 'Dosatore inibitore di corrosione', '1', 'A vaso (pot feeder)', 'Nitriti/molibdati', '10', '70', 'Acciaio al carbonio');
  const a = U.air;
  eq.push({ group: 'Aria compressa' });
  E('0SCA10AN001/002', 'Compressori aria a vite oil-free', '2 (2×100 %)', 'Raffreddati ad acqua ciclo chiuso', `${f0(a.compressorNm3h)} Nm³/h a 9 bar`, '11', '80', '', loadKW(kks(0, 'SCA', 10, 'AN', 1)));
  E('0SCB10BB001', 'Serbatoio aria umida', '1', 'Verticale', `${f0(Math.max(3, a.compressorNm3h / 150))} m³`, '11', '80', 'SA-516 Gr.70');
  E('0SCC10AT001/002', 'Essiccatori ad adsorbimento', '2 (2×100 %)', 'Rigenerazione a caldo, prefiltri e postfiltri', `${f0(a.instrument * 1.3)} Nm³/h · punto di rugiada −40 °C`, '11', '60', '', loadKW(kks(0, 'SCC', 10, 'AH', 1)));
  E('0SCC20BB001', 'Serbatoio aria strumenti', '1', 'Verticale, autonomia ≥ 10 min', `${f0(Math.max(5, a.instrument / 40))} m³`, '11', '60', 'SA-516 Gr.70');
  const raw = U.rawWaterM3h;
  eq.push({ group: 'Acqua grezza, servizi e antincendio' });
  E('0GAA10BB001', 'Serbatoio acqua grezza e riserva antincendio', '1', 'Cilindrico a tetto fisso, riserva antincendio dedicata', `${f0(roundUp(raw * 24 + 1200 + 400 * N, 500))} m³ (riserva antincendio ${f0(1200 + 400 * N)} m³)`, 'Atm.', '50', 'Acciaio al carbonio verniciato');
  E('0GAA10AP001/002', 'Pompe acqua grezza', '2 (2×100 %)', 'Centrifughe orizzontali', `Q ${f0(raw * 1.15)} m³/h · H 45 m`, '10', '50', 'Ghisa', loadKW(kks(0, 'GAA', 10, 'AP', 1)));
  E('0GHA10AP001/002', 'Pompe acqua servizi', '2 (2×100 %)', 'Centrifughe orizzontali', 'Q 15 m³/h · H 50 m', '10', '50', 'Ghisa', loadKW(kks(0, 'GHA', 10, 'AP', 1)));
  E('0SGA10AP001', 'Pompa antincendio elettrica', '1', 'UNI EN 12845 / NFPA 20', `Q ${f0(400 + 100 * N)} m³/h · H 100 m`, '16', '50', 'Ghisa', loadKW(kks(0, 'SGA', 10, 'AP', 1)));
  E('0SGA10AP002', 'Pompa antincendio diesel', '1', 'Motore diesel con serbatoio gasolio 8 h', `Q ${f0(400 + 100 * N)} m³/h · H 100 m`, '16', '50', 'Ghisa');
  E('0SGA10AP003', 'Pompa di pressurizzazione (jockey)', '1', 'Multistadio verticale', 'Q 10 m³/h · H 105 m', '16', '50', 'Inox', loadKW(kks(0, 'SGA', 10, 'AP', 3)));
  const d = U.demi;
  eq.push({ group: 'Acqua demineralizzata' });
  E('0GCF10AT001/002', 'Filtri multistrato', '2 (2×100 %)', 'Sabbia e antracite, controlavaggio automatico', `${f0(d.plantM3h * 1.5)} m³/h`, '6', '50', 'Acciaio al carbonio rivestito', loadKW(kks(0, 'GCF', 10, 'AP', 1)));
  E('0GCF20AP001/002', 'Pompe alta pressione osmosi inversa', '2 (2×100 %)', 'Multistadio inox', `${f0(d.plantM3h * 1.4)} m³/h · 16 bar`, '25', '50', 'AISI 316L', loadKW(kks(0, 'GCF', 20, 'AP', 1)));
  E('0GCF30', 'Unità osmosi inversa', '2 (2×100 %)', 'Membrane spiralate, recupero 75 %', `Permeato ${f0(d.plantM3h * 1.05)} m³/h`, '25', '50', 'GRP / AISI 316L');
  E('0GCF40', 'Unità elettrodeionizzazione (EDI)', '2 (2×100 %)', 'Conducibilità prodotto < 0,1 µS/cm, SiO₂ < 10 ppb', `${f0(d.plantM3h)} m³/h`, '10', '50', '', loadKW(kks(0, 'GCF', 40, 'GA', 1)));
  E('0GHC10BB001', 'Serbatoio acqua demineralizzata', '1', 'Cilindrico verticale, polmonato ad azoto', `${f0(d.tankM3)} m³ (≥ 72 h di reintegro)`, 'Atm.', '50', 'AISI 304L');
  E('0GHC10AP001/002', 'Pompe trasferimento acqua demi', '2 (2×100 %)', 'Centrifughe inox', `Q ${f0(Math.max(d.demiM3h * 4, 25))} m³/h · H 60 m`, '10', '50', 'AISI 316L', loadKW(kks(0, 'GHC', 10, 'AP', 1)));
  eq.push({ group: 'Dosaggio chimico e campionamento' });
  E('0QCA10', 'Skid dosaggio ammoniaca', '1', 'Serbatoio, pompe dosatrici 2×100 %', `${f1(U.chem.ammonia)} kg/h NH₃ (pH 9,6–9,8)`, '20', '50', 'AISI 316L', loadKW(kks(0, 'QCA', 10, 'AP', 1)));
  E('0QCB10', 'Skid dosaggio deossigenante', '1', 'Serbatoio, pompe dosatrici 2×100 %', `${f1(U.chem.scavenger * 1000)} g/h carboidrazide`, '20', '50', 'AISI 316L', loadKW(kks(0, 'QCB', 10, 'AP', 1)));
  E('0QCC10', 'Skid dosaggio fosfati ai corpi cilindrici', '1', `Pompe dosatrici ${N + 1} (una per GVR + riserva)`, 'Fosfato trisodico 2–5 mg/l nei corpi HP/IP', f0(bt.pDrum[0] * 1.4), '50', 'AISI 316L', loadKW(kks(0, 'QCC', 10, 'AP', 1)));
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
