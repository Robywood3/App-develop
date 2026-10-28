// Calcola i casi di studio e scrive docs/allegati/A1_Risultati_casi.md (tabelle usate nei documenti 02 e 04).
//   node tools/report-cases.js
const fs = require('fs'), path = require('path');
const F = require('../js/engine.js');
const n = (v, d = 0) => v === null || v === undefined || !isFinite(v) ? '–' : v.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });
const k = v => n(v / 1000);
const p = (v, d = 1) => v === null || v === undefined ? '–' : n(v * 100, d) + ' %';
const inc = ids => F.defaultConfig().incentives.map(i => Object.assign(i, { enabled: ids.includes(i.id) }));

const CASES = [
  ['A', 'Riferimento: Milano, 3 MWp a terra fisso, BESS 2 MWh / 1 MW, senza incentivi', {}],
  ['A0', 'Come A, solo FV', { bess: { enabled: false } }],
  ['A1', 'Come A + iper-ammortamento (moduli ENEA B/C)', { incentives: inc(['iperamm2026']) }],
  ['A2', 'Come A + iper-ammortamento + Nuova Sabatini', { incentives: inc(['iperamm2026', 'sabatini']) }],
  ['A3', 'Come A + ricavi UVA/MSD 15 €/kW·a + peak shaving', { incentives: inc(['msd']), bess: { strategy: { peakShaving: true, peakLimitKw: 1700 } } }],
  ['B', 'Sud: Bari, 3 MWp a terra, BESS 2 MWh, iper-ammortamento + ZES (24 %)', { project: { site: 'bari' }, incentives: inc(['iperamm2026', 'zes']) }],
  ['B0', 'Come B, solo FV', { project: { site: 'bari' }, incentives: inc(['iperamm2026', 'zes']), bess: { enabled: false } }],
  ['C', 'PMI Centro-Nord: Bologna, 1 MWp su copertura est-ovest, 3 GWh/a a 1 turno, BESS 1 MWh / 0,5 MW, iper + Sabatini',
    { project: { site: 'bologna' }, load: { annualMWh: 3000, profile: 'turno1' }, pv: { kwp: 1000, mount: 'roof_ew', tilt: 10, inverter: 'str110', module: 'topcon440' },
      bess: { kwh: 1000, kw: 500 }, grid: { importLimitKw: 1500, exportLimitKw: 1000 }, opex: { imuEur: 0, securityKwp: 0 },
      capex: { pv: F.defaultConfig().capex.pv.map(x => Object.assign(x, { inv: { value: 40 }, str: { value: 55 }, civ: { value: 20 }, sec: { value: 5 }, dev: { value: 15 }, mnt: { value: 95 }, mv: { value: 60 } }[x.id] || {})) },
      incentives: inc(['iperamm2026', 'sabatini']) }],
  ['C0', 'Come C senza incentivi', null],
  ['D', 'Energivoro a ciclo continuo: Milano, 8 MWp a terra tracker, 40 GWh/a, BESS 8 MWh / 4 MW',
    { load: { annualMWh: 40000, profile: 'continuo', augustShutdownWeeks: 0 }, pv: { kwp: 8000, mount: 'tracker' }, bess: { kwh: 8000, kw: 4000, unit: 'container5' },
      grid: { importLimitKw: 8000, exportLimitKw: 6000, voltageKv: 20 }, capex: { pv: F.defaultConfig().capex.pv.map(x => Object.assign(x, { str: { value: 80 }, civ: { value: 45 }, mnt: { value: 90 }, mv: { value: 40 } }[x.id] || {})) },
      prices: { chargesVar: 40 } }]
];
CASES[8][2] = Object.assign({}, CASES[7][2], { incentives: inc([]) });

const R = {};
for (const [id, , c] of CASES) R[id] = F.simulate(c);
const L = [];
L.push('# Allegato A1 – Risultati dei casi di studio', '', `Generato con \`node tools/report-cases.js\` il ${new Date().toISOString().slice(0, 10)} (simulatore FV+BESS v1.0, default di docs/allegati/A2_Benchmark_costi_2026.md). Valori in euro nominali, orizzonte 25 anni.`, '');
L.push('## 1. Casi', '', '| Caso | Descrizione |', '|---|---|', ...CASES.map(([id, d]) => `| ${id} | ${d} |`), '');
L.push('## 2. Indicatori principali', '', '| Caso | CAPEX k€ | €/kWp FV | €/kWh BESS | Prod. MWh/a | kWh/kWp | Autocons. | Autosuff. | Aiuti k€ | VAN k€ | TIR prog. | TIR equity | Payback anni | LCOE €/MWh |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const [id] of CASES) {
  const r = R[id], f = r.fin;
  L.push(`| ${id} | ${k(r.capex.total)} | ${n(r.capex.pvPerKwp)} | ${r.cfg.bess.enabled ? n(r.capex.bessPerKwh) : '–'} | ${n(r.y1.pv / 1000)} | ${n(r.kpi.specificYield)} | ${p(r.kpi.selfConsumptionRate, 0)} | ${p(r.kpi.selfSufficiency, 0)} | ${k(f.totalAid)} | ${k(f.npvProject)} | ${p(f.irrProject)} | ${p(f.irrEquity)} | ${n(f.paybackProject, 1)} | ${n(f.lcoePv, 1)} |`);
}
L.push('', '## 3. Valore incrementale del BESS', '', '| Confronto | ΔCAPEX k€ | ΔVAN k€ | Scarica BESS MWh/a | Cicli/a | LCOS €/MWh |', '|---|---:|---:|---:|---:|---:|');
for (const [a, b] of [['A', 'A0'], ['B', 'B0']]) L.push(`| ${a} vs ${b} | ${k(R[a].capex.total - R[b].capex.total)} | ${k(R[a].fin.npvProject - R[b].fin.npvProject)} | ${n(R[a].y1.bessOut / 1000)} | ${n(R[a].y1.efc)} | ${n(R[a].fin.lcosBess)} |`);
L.push(`| A3 vs A0 | ${k(R.A3.capex.total - R.A0.capex.total)} | ${k(R.A3.fin.npvProject - R.A0.fin.npvProject)} | ${n(R.A3.y1.bessOut / 1000)} | ${n(R.A3.y1.efc)} | ${n(R.A3.fin.lcosBess)} |`);
L.push('', '### Scansione della taglia del BESS (caso A, rapporto 2 h)', '', '| kWh / kW | CAPEX BESS k€ | VAN k€ | ΔVAN vs solo FV k€ | TIR | Scarica MWh/a | Da rete MWh/a |', '|---|---:|---:|---:|---:|---:|---:|');
for (const kwh of [0, 1000, 2000, 4000, 6000]) {
  const r = F.simulate(kwh ? { bess: { kwh, kw: kwh / 2 } } : { bess: { enabled: false } });
  L.push(`| ${n(kwh)} / ${n(kwh / 2)} | ${k(r.capex.bess)} | ${k(r.fin.npvProject)} | ${k(r.fin.npvProject - R.A0.fin.npvProject)} | ${p(r.fin.irrProject)} | ${n(r.y1.bessOut / 1000)} | ${n(r.y1.gridToBess / 1000)} |`);
}
L.push('', '### Strategie EMS (caso A)', '', '| Strategia | VAN k€ | Scarica MWh/a | Da rete MWh/a | Risparmio quota potenza anno 1 k€ |', '|---|---:|---:|---:|---:|');
for (const [name, st] of [['Solo autoconsumo', { arbitrage: false }], ['Autoconsumo + arbitraggio', {}], ['Autoconsumo + arbitraggio + peak shaving 1,7 MW', { peakShaving: true, peakLimitKw: 1700 }]]) {
  const r = F.simulate({ bess: { strategy: st } });
  L.push(`| ${name} | ${k(r.fin.npvProject)} | ${n(r.y1.bessOut / 1000)} | ${n(r.y1.gridToBess / 1000)} | ${n(r.fin.rows[0].powerSaving / 1000, 1)} |`);
}
L.push('', '## 4. Scenari di prezzo (caso A)', '', '| PUN anno 1 €/MWh | Escalation | VAN k€ | TIR | Payback |', '|---:|---:|---:|---:|---:|');
for (const [pun, esc] of [[100, 0], [100, 2], [130, 0], [130, 2], [170, 2], [170, -2]]) {
  const r = F.simulate({ prices: { pun, escalation: esc } });
  L.push(`| ${pun} | ${esc} %/a | ${k(r.fin.npvProject)} | ${p(r.fin.irrProject)} | ${n(r.fin.paybackProject, 1)} |`);
}
const S = F.sensitivity({});
L.push('', '## 5. Sensitività del VAN (caso A)', '', `VAN base ${k(S.base)} k€.`, '', '| Grandezza | Variazione | VAN sfavorevole k€ | VAN favorevole k€ | TIR sfav. | TIR fav. |', '|---|---|---:|---:|---:|---:|');
for (const i of S.items) L.push(`| ${i.name} | ${i.range} | ${k(i.low)} | ${k(i.high)} | ${p(i.irrLow)} | ${p(i.irrHigh)} |`);
const A = R.A, y = A.y1;
L.push('', '## 6. Caso A – bilancio energetico anno 1', '', '| Voce | MWh |', '|---|---:|',
  ...[['Produzione FV', y.pv], ['Autoconsumo diretto', y.pvDirect], ['FV caricato nel BESS', y.pvToBess], ['Immissione', y.exp], ['Taglio', y.curt], ['Scarica BESS', y.bessOut], ['Carica BESS da rete', y.gridToBess], ['Ausiliari BESS', y.aux], ['Prelievo da rete', y.imp], ['Consumo stabilimento', y.load]].map(([a, b]) => `| ${a} | ${n(b / 1000)} |`));
L.push('', '## 7. Caso A – conto economico e flussi (k€ nominali, primi 12 anni e ultimo)', '', '| Anno | Risparmio energia | Vendita | Quota potenza | OPEX | Straord. | EBITDA | Ammort. | Imposte | FCF progetto | Interessi | FCF equity | DSCR |', '|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
L.push(`| 0 | | | | | | | | | ${k(A.fin.cfProj[0])} | | ${k(A.fin.cfEq[0])} | |`);
for (const r of A.fin.rows.filter(r => r.y <= 12 || r.y === A.fin.rows.length)) L.push(`| ${r.y} | ${k(r.energySaving)} | ${k(r.exportRev)} | ${n(r.powerSaving / 1000, 1)} | ${k(r.opex)} | ${k(r.extraord)} | ${k(r.ebitda)} | ${k(r.depr)} | ${k(r.taxU)} | ${k(r.cfProj)} | ${k(r.interest)} | ${k(r.cfEq)} | ${r.dscr === null ? '–' : n(r.dscr, 2)} |`);
L.push('', '## 8. Caso A – CAPEX per voce', '', '| Gruppo | Voce | Unitario | Unità | Quantità | Totale € | Quota |', '|---|---|---:|---|---:|---:|---:|');
for (const r of A.capex.rows) L.push(`| ${r.group} | ${r.label} | ${n(r.unitValue, r.unit === '%' ? 1 : 0)} | ${r.unit} | ${r.unit === '€' ? '1' : n(r.qty)} | ${n(r.total)} | ${p(r.total / A.capex.total)} |`);
L.push(`| | **Totale** | | | | **${n(A.capex.total)}** | 100 % |`);
L.push('', '## 9. CAPEX per tipologia di installazione (3 MWp, solo FV, default per tipologia)', '', '| Tipologia | CAPEX FV €/kWp | kWh/kWp Milano | LCOE €/MWh | VAN k€ |', '|---|---:|---:|---:|---:|');
const D = require('../js/data.js');
for (const [m, lab, extra] of [['ground_fixed', 'A terra, fisso', {}], ['tracker', 'A terra, tracker', {}], ['roof_tilted', 'Copertura a falda', { tilt: 15, bifacial: false }], ['roof_ew', 'Copertura piana est-ovest', { tilt: 10 }]]) {
  const cp = F.defaultConfig().capex.pv.map(x => (x.id in D.MOUNT_CAPEX[m] ? Object.assign(x, { value: D.MOUNT_CAPEX[m][x.id] }) : x));
  const r = F.simulate({ pv: Object.assign({ mount: m }, extra), capex: { pv: cp }, bess: { enabled: false }, opex: m.startsWith('roof') ? { securityKwp: 0, imuEur: 0 } : {} });
  L.push(`| ${lab} | ${n(r.capex.pvPerKwp)} | ${n(r.kpi.specificYield)} | ${n(r.fin.lcoePv, 1)} | ${k(r.fin.npvProject)} |`);
}
const e = A.eng;
L.push('', '## 10. Caso A – dati di ingegneria', '', '| Grandezza | Valore |', '|---|---|',
  `| Moduli | ${n(e.nMod)} × ${e.module.name} |`, `| Stringhe | ${e.strings} da ${e.Ns} moduli |`, `| Inverter | ${e.nInv} × ${e.inverter.name} (${n(e.kwac)} kWac) |`,
  `| Potenza DC effettiva | ${n(e.kwpReal, 1)} kWp (DC/AC ${n(e.kwpReal / e.kwac, 2)}) |`, `| Voc stringa alla Tmin (${n(e.tMin, 1)} °C) | ${n(e.Ns * e.vocCold)} V |`,
  `| Vmp stringa alla Tcella max (${n(e.tCellMax, 1)} °C) | ${n(e.Ns * e.vmpHot)} V |`, `| Cavo di stringa | ${e.dcCable.S} mm², ΔV ${n(e.dcCable.dv, 2)} % su ${e.dcCable.L} m |`,
  `| Cavo AC inverter | ${e.acCable.par} × ${e.acCable.S} mm² Al, ΔV ${n(e.acCable.dv, 2)} % su ${e.acCable.L} m |`, `| Trasformatori FV | ${e.transformer.n} × ${n(e.transformer.kva)} kVA ${e.transformer.mv}/${n(e.transformer.lv / 1000, 1)} kV |`,
  `| Linea MT | ${e.mvCable.S} mm² Al, I = ${n(e.mvCable.I)} A; sezione minima per ${n(e.mvCable.iccKa, 1)} kA × ${n(e.mvCable.tFault, 2)} s: ${n(e.mvCable.sMinSc)} mm² |`, `| Superficie | ${n(e.landHa, 2)} ha (moduli ${n(e.modArea)} m²) |`,
  `| BESS | ${e.bess.n} × ${e.bess.unit.name}, ${n(e.bess.kwhInst)} kWh, trasformatore ${n(e.bess.trKva)} kVA |`);
const out = path.join(__dirname, '..', 'docs', 'allegati', 'A1_Risultati_casi.md');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, L.join('\n') + '\n');
console.log(out);
