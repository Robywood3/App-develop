// Analisi Monte Carlo del CAPEX del caso di riferimento (distribuzioni triangolari min / tipico / max per voce).
//   node tools/capex-montecarlo.js [iterazioni]
// Intervalli da docs/allegati/A2_Benchmark_costi_2026.md (§1.1 e §2.2, BESS 2 h). Voci considerate indipendenti,
// tranne moduli, DC block e PCS che seguono un fattore comune di mercato (correlazione dei prezzi delle materie prime).
const F = require('../js/engine.js');
const N = +process.argv[2] || 20000;
const PV = { mod: [120, 130, 160], inv: [24, 35, 50], str: [40, 50, 70], bos: [40, 60, 90], mv: [40, 50, 70], conn: [10, 30, 80],
  civ: [20, 35, 60], sec: [10, 20, 35], mnt: [50, 80, 120], eng: [20, 30, 50], dev: [20, 40, 100] };
const BESS = { dc: [75, 110, 150], pcs: [40, 60, 90], mvb: [40, 70, 120], ems: [20000, 40000, 80000], civb: [25, 40, 70], safe: [3, 5, 10], engb: [10, 15, 30] };
const MARKET = ['mod', 'dc', 'pcs'];
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r = rng(42);
const tri = ([a, c, b], u) => { const f = (c - a) / (b - a); return u < f ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c)); };
const base = F.defaultConfig(), tot = [], pvs = [], bss = [];
for (let k = 0; k < N; k++) {
  const um = r(), c = JSON.parse(JSON.stringify(base));
  const draw = id => MARKET.includes(id) ? 0.7 * um + 0.3 * r() : r();
  c.capex.pv.forEach(x => { if (PV[x.id]) x.value = tri(PV[x.id], draw(x.id)); });
  c.capex.bess.forEach(x => { if (BESS[x.id]) x.value = tri(BESS[x.id], draw(x.id)); });
  c.capex.contingencyPct = 0; // l'incertezza è già nelle distribuzioni
  const cx = F.capexModel(c);
  tot.push(cx.total); pvs.push(cx.pvPerKwp); bss.push(cx.bessPerKwh);
}
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
const det = F.capexModel(base), detNoCont = F.capexModel(Object.assign(JSON.parse(JSON.stringify(base)), { capex: Object.assign({}, base.capex, { contingencyPct: 0 }) }));
const out = {
  iterazioni: N,
  deterministico: { totale: Math.round(det.total), senzaContingenze: Math.round(detNoCont.total), pvPerKwp: Math.round(det.pvPerKwp), bessPerKwh: Math.round(det.bessPerKwh) },
  totale: { P10: Math.round(q(tot, 0.1)), P50: Math.round(q(tot, 0.5)), P80: Math.round(q(tot, 0.8)), P90: Math.round(q(tot, 0.9)) },
  pvPerKwp: { P10: Math.round(q(pvs, 0.1)), P50: Math.round(q(pvs, 0.5)), P90: Math.round(q(pvs, 0.9)) },
  bessPerKwh: { P10: Math.round(q(bss, 0.1)), P50: Math.round(q(bss, 0.5)), P90: Math.round(q(bss, 0.9)) },
  contingenzaP80: ((q(tot, 0.8) / detNoCont.total - 1) * 100).toFixed(1) + ' % sul deterministico senza contingenze'
};
console.log(JSON.stringify(out, null, 1));
