/*
 * FV+BESS Simulator – elenco elaborati e generazione dei documenti in Markdown.
 * Elenco: "Elenco documentazione standard – Impianto FV industriale (con opzione BESS) / solo BESS".
 * Flusso: 1) scelta di fase, configurazione e procedura  2) prepare(): elaborati applicabili  3) generate(): file .md
 * I documenti sono bozze compilate con i dati del simulatore; le parti che richiedono dati di sito sono marcate [DA COMPLETARE].
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'), require('./data.js'));
  else root.FVB_DOCS = factory(root.FVB, root.FVB_DATA);
})(typeof self !== 'undefined' ? self : this, function (F, D) {
  'use strict';

  const PHASES = {
    pfte: { name: 'PFTE / Progetto definitivo', short: 'PFTE', desc: 'Progetto di fattibilità tecnico-economica (opere pubbliche) o progetto definitivo per l\'iter autorizzativo privato' },
    esecutivo: { name: 'Progetto esecutivo', short: 'ESE', desc: 'Calcoli, elaborati di dettaglio e documenti contrattuali per la costruzione' }
  };
  const CONFIGS = { FV: 'Solo FV', FB: 'FV + BESS', B: 'Solo BESS' };
  const PROCEDURES = {
    pubblica: 'Opera pubblica – D.Lgs. 36/2023 (PFTE ed esecutivo)',
    edilizia: 'Edilizia libera / comunicazione (D.Lgs. 190/2024)',
    pas: 'Procedura abilitativa semplificata (PAS)',
    au: 'Autorizzazione Unica regionale',
    paur: 'PAUR / VIA'
  };
  const GROUPS = {
    'pfte.G': '1.A Generali e amministrativi', 'pfte.R': '1.B Relazioni', 'pfte.T': '1.C Elaborati grafici', 'pfte.E': '1.D Economici e programmatici',
    'esecutivo.X': '2.A Relazioni e calcoli', 'esecutivo.D': '2.B Elaborati grafici di dettaglio', 'esecutivo.C': '2.C Contrattuali ed economici'
  };
  // [codice, fase, titolo, FV, FV+BESS, solo BESS]  ● applicabile · ○ se pertinente · – non applicabile
  const LIST = [
    ['G01', 'pfte', 'Elenco elaborati', '●', '●', '●'],
    ['G02', 'pfte', 'Scheda di sintesi del progetto', '●', '●', '●'],
    ['G03', 'pfte', 'Elenco enti coinvolti e autorizzazioni necessarie', '●', '●', '●'],
    ['G04', 'pfte', 'Piano particellare, visure catastali e titoli di disponibilità delle aree', '●', '●', '●'],
    ['G05', 'pfte', 'Preventivo di connessione (STMG/TICA) accettato', '●', '●', '●'],
    ['R01', 'pfte', 'Relazione generale', '●', '●', '●'],
    ['R02', 'pfte', 'Relazione tecnica descrittiva (impianto FV e/o BESS)', '●', '●', '●'],
    ['R03', 'pfte', 'Relazione di producibilità', '●', '●', '–'],
    ['R04', 'pfte', 'Dimensionamento BESS (potenza/energia, use case, profilo di esercizio)', '–', '●', '●'],
    ['R05', 'pfte', 'Relazione geologica e geotecnica', '●', '●', '●'],
    ['R06', 'pfte', 'Relazione idrologica e idraulica', '●', '●', '●'],
    ['R07', 'pfte', 'Relazione di compatibilità urbanistica e vincolistica', '●', '●', '●'],
    ['R08', 'pfte', 'Relazione paesaggistica', '○', '○', '○'],
    ['R09', 'pfte', 'Studio di impatto ambientale / screening VIA', '○', '○', '○'],
    ['R10', 'pfte', 'Studio di impatto acustico', '●', '●', '●'],
    ['R11', 'pfte', 'Relazione sui campi elettromagnetici (CEM)', '●', '●', '●'],
    ['R12', 'pfte', 'Relazione agronomica (agrivoltaico)', '○', '○', '–'],
    ['R13', 'pfte', 'Verifica preventiva dell\'interesse archeologico (VPIA)', '○', '○', '○'],
    ['R14', 'pfte', 'Relazione preliminare di prevenzione incendi BESS (isola BESS, distanze)', '–', '●', '●'],
    ['R15', 'pfte', 'Piano di manutenzione preliminare', '●', '●', '●'],
    ['R16', 'pfte', 'Piano di dismissione e stima dei costi di ripristino', '●', '●', '●'],
    ['T01', 'pfte', 'Inquadramento territoriale, vincolistico e catastale', '●', '●', '●'],
    ['T02', 'pfte', 'Layout generale su ortofoto e CTR', '●', '●', '●'],
    ['T03', 'pfte', 'Planimetria quotata e sezioni tipo', '●', '●', '●'],
    ['T04', 'pfte', 'Layout area BESS (distanze, viabilità VVF, accessi)', '–', '●', '●'],
    ['T05', 'pfte', 'Schema unifilare generale e schema a blocchi', '●', '●', '●'],
    ['T06', 'pfte', 'Tipologici cabine, PCS/inverter, container BESS', '●', '●', '●'],
    ['T07', 'pfte', 'Strutture di sostegno moduli', '●', '●', '–'],
    ['T08', 'pfte', 'Recinzioni, viabilità interna, drenaggi', '●', '●', '●'],
    ['T09', 'pfte', 'Tracciato cavidotto e opere di connessione (utenza e rete)', '●', '●', '●'],
    ['T10', 'pfte', 'Impianto di terra, TVCC e antintrusione (preliminari)', '●', '●', '●'],
    ['E01', 'pfte', 'Computo estimativo', '●', '●', '●'],
    ['E02', 'pfte', 'Quadro economico', '●', '●', '●'],
    ['E03', 'pfte', 'Cronoprogramma', '●', '●', '●'],
    ['E04', 'pfte', 'Prime indicazioni per il PSC', '●', '●', '●'],
    ['E05', 'pfte', 'Capitolato / disciplinare descrittivo e prestazionale', '●', '●', '●'],
    ['E06', 'pfte', 'Piano economico-finanziario', '○', '○', '○'],
    ['X01', 'esecutivo', 'Relazione generale e relazioni specialistiche aggiornate', '●', '●', '●'],
    ['X02', 'esecutivo', 'Calcoli elettrici (cavi, cadute di tensione, cortocircuito)', '●', '●', '●'],
    ['X03', 'esecutivo', 'Selettività e coordinamento delle protezioni', '●', '●', '●'],
    ['X04', 'esecutivo', 'Calcoli strutturali (strutture, pali/fondazioni, basamenti) – NTC 2018', '●', '●', '●'],
    ['X05', 'esecutivo', 'Calcolo rete di terra (CEI EN 50522)', '●', '●', '●'],
    ['X06', 'esecutivo', 'Calcolo CEM e fasce di rispetto', '●', '●', '●'],
    ['X07', 'esecutivo', 'Studio di rete e tarature protezioni (CEI 0-16 / Codice di Rete Terna)', '●', '●', '●'],
    ['X08', 'esecutivo', 'Progetto antincendio BESS (rivelazione, estinzione, gas, deflagration venting, idranti/riserva idrica)', '–', '●', '●'],
    ['X09', 'esecutivo', 'Test report UL 9540A del fornitore', '–', '●', '●'],
    ['X10', 'esecutivo', 'Studio di compatibilità elettromagnetica (EMC)', '●', '●', '●'],
    ['D01', 'esecutivo', 'Layout esecutivo (stringhe, string box, PCS, MV skid)', '●', '●', '○'],
    ['D02', 'esecutivo', 'Schemi unifilari e multifilari BT/MT/AT', '●', '●', '●'],
    ['D03', 'esecutivo', 'Schemi funzionali e schemi di protezione', '●', '●', '●'],
    ['D04', 'esecutivo', 'Percorsi cavi, sezioni di scavo, cavidotti', '●', '●', '●'],
    ['D05', 'esecutivo', 'Carpenterie e particolari costruttivi', '●', '●', '●'],
    ['D06', 'esecutivo', 'Architettura SCADA, EMS/PPC, monitoraggio, TLC', '●', '●', '●'],
    ['D07', 'esecutivo', 'Sottostazione / cabina di consegna (elettromeccanico e civile)', '●', '●', '●'],
    ['D08', 'esecutivo', 'Impianti ausiliari (HVAC container, illuminazione, TVCC)', '●', '●', '●'],
    ['C01', 'esecutivo', 'Computo metrico estimativo', '●', '●', '●'],
    ['C02', 'esecutivo', 'Elenco prezzi unitari e analisi prezzi', '●', '●', '●'],
    ['C03', 'esecutivo', 'Quadro economico e incidenza manodopera', '●', '●', '●'],
    ['C04', 'esecutivo', 'Capitolato speciale d\'appalto', '●', '●', '●'],
    ['C05', 'esecutivo', 'Specifiche tecniche componenti (moduli, inverter, BESS, trasformatori)', '●', '●', '●'],
    ['C06', 'esecutivo', 'Cronoprogramma esecutivo', '●', '●', '●'],
    ['C07', 'esecutivo', 'PSC e fascicolo dell\'opera', '●', '●', '●'],
    ['C08', 'esecutivo', 'Piano di manutenzione dell\'opera', '●', '●', '●'],
    ['C09', 'esecutivo', 'Piano di commissioning e collaudo (FAT, SAT, performance test, prove di capacità BESS)', '●', '●', '●']
  ];
  const CATALOG = LIST.map(([code, phase, title, fv, fb, b]) => ({ code, phase, title, group: GROUPS[phase + '.' + code[0]], app: { FV: fv, FB: fb, B: b } }));

  // elaborati "se pertinente" proposti in base alla procedura (l'utente decide)
  function suggested(code, opts) {
    const p = opts.procedure;
    if (code === 'R09') return p === 'paur';
    if (code === 'R08') return p === 'paur' || p === 'au';
    if (code === 'R13') return p === 'pubblica';
    if (code === 'E06') return true;
    return false;
  }

  // ---------- 1. elaborati applicabili alla scelta ----------
  function prepare(opts) {
    if (!PHASES[opts.phase]) throw new Error('fase non valida: ' + opts.phase + ' (pfte | esecutivo)');
    if (!CONFIGS[opts.config]) throw new Error('configurazione non valida: ' + opts.config + ' (FV | FB | B)');
    return CATALOG.filter(d => d.phase === opts.phase).map(d => {
      const a = d.app[opts.config];
      return Object.assign({}, d, { applicability: a, status: a === '●' ? 'required' : a === '○' ? 'optional' : 'na', selected: a === '●' || (a === '○' && suggested(d.code, opts)) });
    });
  }

  // configurazione del simulatore coerente con la scelta
  function variantConfig(cfg, config) {
    const c = F.normalizeConfig(cfg), warn = [];
    if (config === 'FV') { if (c.bess.enabled) warn.push('Configurazione "Solo FV": il BESS del simulatore è escluso dai documenti.'); c.bess.enabled = false; }
    if (config === 'FB') { if (!c.bess.enabled) warn.push('Configurazione "FV + BESS": il BESS era disattivato nel simulatore ed è stato attivato con ' + c.bess.kwh + ' kWh / ' + c.bess.kw + ' kW.'); c.bess.enabled = true; }
    if (config === 'B') {
      if (c.pv.kwp > 0) warn.push('Configurazione "Solo BESS": il generatore FV del simulatore (' + c.pv.kwp + ' kWp) è escluso dai documenti.');
      c.pv.kwp = 0; c.bess.enabled = true; c.bess.strategy.arbitrage = true;
    }
    return { cfg: c, warnings: warn };
  }

  // ---------- utilità Markdown ----------
  const n = (v, d = 0) => (v === null || v === undefined || !isFinite(v)) ? '–' : Number(v).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });
  const pc = (v, d = 1) => n(v * 100, d) + ' %';
  const tbl = (h, rows, align) => '| ' + h.join(' | ') + ' |\n|' + h.map((_, i) => (align && align[i] === 'r') ? '---:' : '---').join('|') + '|\n' + rows.map(r => '| ' + r.join(' | ') + ' |').join('\n') + '\n';
  const kv = rows => tbl(['Grandezza', 'Valore'], rows);
  const todo = t => `**[DA COMPLETARE: ${t}]**`;
  const ul = a => a.map(x => '- ' + x).join('\n') + '\n';
  const sec = (t, body) => `## ${t}\n\n${body.trim()}\n\n`;
  const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60);

  const N = {
    D36: 'D.Lgs. 36/2023, art. 41 e Allegato I.7 (livelli di progettazione)', D190: 'D.Lgs. 190/2024 (Testo unico FER: regimi amministrativi, aree idonee)',
    CEI016: 'CEI 0-16, edizione vigente (regola tecnica di connessione MT/AT)', TERNA: 'Codice di Rete Terna (connessioni AT)', TICA: 'Delibera ARERA ARG/elt 99/08 (TICA) e s.m.i.',
    NTC: 'NTC 2018 (DM 17/01/2018) e Circolare applicativa n. 7/2019', VVF: 'Circolare VVF DCPREV 21021 del 23/12/2024 (Linee guida BESS) e Nota DCPREV 9467 del 05/06/2025 (chiarimenti)',
    DPR151: 'DPR 151/2011 (attività soggette; assoggettabilità BESS da verificare con il Comando VVF)', IEC_B: 'IEC 62933, IEC 62619, IEC 62477-1, UL 9540 / UL 9540A',
    CEI648: 'CEI 64-8 (impianti BT), IEC 60364-7-712 (sistemi FV)', IEC62548: 'CEI EN IEC 62548-1 (progettazione campi FV)', IEC62446: 'CEI EN IEC 62446-1 (prove e documentazione FV)',
    CEI8225: 'CEI 82-25 (guida FV connessi alla rete)', CEI50522: 'CEI EN 50522 (impianti di terra > 1 kV)', CEI62305: 'CEI EN 62305 (protezione dai fulmini)', CEI11_17: 'CEI 11-17 (linee in cavo)',
    CEM: 'L. 36/2001, DPCM 08/07/2003, DM 29/05/2008 (fasce di rispetto)', ACU: 'L. 447/1995, DPCM 14/11/1997, piano di zonizzazione acustica comunale',
    D81: 'D.Lgs. 81/2008 (Titolo IV cantieri, Allegato XV)', D152: 'D.Lgs. 152/2006 (Parte II VIA, Parte IV rifiuti)', D42: 'D.Lgs. 42/2004 (beni culturali e paesaggio), DPCM 12/12/2005',
    REG1542: 'Reg. (UE) 2023/1542 (batterie)', RAEE: 'D.Lgs. 49/2014 (RAEE)', DPR120: 'DPR 120/2017 (terre e rocce da scavo)', DM37: 'DM 37/2008',
    EMC: 'Direttiva 2014/30/UE, CEI EN 61000-6-2/-6-4', RFG: 'Reg. (UE) 2016/631 (RfG) e CEI 0-16 Allegati di conformità', CYB: 'IEC 62443 (cybersecurity dei sistemi di controllo)',
    TRF: 'Reg. (UE) 548/2014 e 2019/1783 (ecodesign trasformatori)', CAM: 'CAM vigenti (D.Lgs. 36/2023 art. 57) se opera pubblica'
  };

  // ---------- blocchi di dati comuni ----------
  function ctxOf(cfg, R, opts) {
    const e = R.eng, hasPv = e.hasPv, b = R.cfg.bess.enabled;
    const ground = R.cfg.pv.mount === 'ground_fixed' || R.cfg.pv.mount === 'tracker';
    const site = R.site, areaM2 = hasPv ? (ground ? e.landHa * 10000 : e.roofM2) : (e.bess ? e.bess.areaWithSpacing : 0);
    const perim = ground || !hasPv ? 4 * Math.sqrt(Math.max(areaM2, 1)) * 1.1 : 0;
    const tableMods = e.Ns, pitch = hasPv && ground ? 2 * e.module.length / R.cfg.pv.gcr : 0;
    return Object.assign({ cfg: R.cfg, R, e, f: R.fin, c: R.capex, y: R.y1, k: R.kpi, site, hasPv, b, ground, areaM2, perim, tableMods, pitch,
      prefix: opts.prefix || 'FVB', rev: opts.rev || 'A', date: opts.date || new Date().toISOString().slice(0, 10) }, opts);
  }
  const mountName = m => ({ ground_fixed: 'a terra su struttura fissa', tracker: 'a terra su inseguitori monoassiali N-S', roof_tilted: 'su copertura a falda', roof_ew: 'su copertura piana con esposizione est-ovest' }[m] || m);
  const isPrivate = x => x.procedure !== 'pubblica';
  const phaseLabel = x => x.phase === 'pfte' ? (isPrivate(x) ? 'Progetto definitivo (iter autorizzativo privato)' : 'Progetto di fattibilità tecnico-economica (PFTE)') : 'Progetto esecutivo';

  function header(x, d) {
    return `# ${d.code} – ${d.title}\n\n` + tbl(['Progetto', 'Committente', 'Località', 'Elaborato', 'Fase', 'Configurazione', 'Rev.', 'Data'],
      [[x.cfg.project.name, x.cfg.project.client || todo('committente'), x.site.name, `${x.prefix}-${PHASES[x.phase].short}-${d.code}`, phaseLabel(x), CONFIGS[x.config], x.rev, x.date]]) +
      `\n> Bozza generata dal simulatore FV + BESS con i dati del caso corrente. Le parti marcate **[DA COMPLETARE]** richiedono dati di sito, indagini o offerte. ` +
      `Prima dell'emissione il documento va completato, verificato e firmato da un tecnico abilitato.\n\n`;
  }
  function blkImpianto(x) {
    const e = x.e, rows = [];
    if (x.hasPv) rows.push(['Generatore FV', `${n(e.kwpReal, 1)} kWp DC / ${n(e.kwac)} kWac, ${mountName(x.cfg.pv.mount)}`],
      ['Moduli', `${n(e.nMod)} × ${e.module.name}`], ['Stringhe', `${n(e.strings)} da ${e.Ns} moduli`], ['Inverter', `${e.nInv} × ${e.inverter.name}`],
      ['Trasformatori FV', `${e.transformer.n} × ${n(e.transformer.kva)} kVA ${e.transformer.mv}/${n(e.transformer.lv / 1000, 1)} kV`]);
    if (x.b && e.bess) rows.push(['Sistema di accumulo', `${n(x.cfg.bess.kwh)} kWh / ${n(x.cfg.bess.kw)} kW LFP (${n(x.cfg.bess.kwh / x.cfg.bess.kw, 1)} h)`],
      ['Unità BESS', `${e.bess.n} × ${e.bess.unit.name}`], ['Trasformatori BESS', `${e.bess.nTr} × ${n(e.bess.trKva)} kVA`]);
    rows.push(['Connessione', `MT ${x.cfg.grid.voltageKv} kV; prelievo ${n(x.cfg.grid.importLimitKw)} kW, immissione ${x.cfg.grid.zeroExport ? '0 (immissione zero)' : n(x.cfg.grid.exportLimitKw) + ' kW'}`],
      ['Superficie occupata (stima)', x.hasPv && x.ground ? `${n(e.landHa, 2)} ha` : x.hasPv ? `${n(e.roofM2)} m² di copertura` : `${n(x.areaM2)} m²`],
      ['Stabilimento servito', `${n(x.y.load / 1000)} MWh/a`]);
    return kv(rows);
  }
  function blkEnergia(x) {
    const y = x.y, r = [];
    if (x.hasPv) r.push(['Produzione FV anno 1', n(y.pv / 1000) + ' MWh'], ['Producibilità specifica', n(x.k.specificYield) + ' kWh/kWp'], ['Performance ratio', pc(x.k.pr)],
      ['Autoconsumo', pc(x.k.selfConsumptionRate)], ['Immissione in rete', n(y.exp / 1000) + ' MWh']);
    if (x.b) r.push(['Scarica BESS', n(y.bessOut / 1000) + ' MWh/a'], ['Cicli equivalenti', n(y.efc) + '/a']);
    r.push(['Autosufficienza dello stabilimento', pc(x.k.selfSufficiency)], ['CO₂ evitata', n(x.k.co2) + ' t/a']);
    return kv(r);
  }
  function blkEconomia(x) {
    const f = x.f, c = x.c;
    return kv([['CAPEX', `${n(c.total)} €` + (x.hasPv ? ` (FV ${n(c.pvPerKwp)} €/kWp)` : '') + (x.b ? ` (BESS ${n(c.bessPerKwh)} €/kWh)` : '')],
      ['VAN di progetto', `${n(f.npvProject)} € (WACC ${x.cfg.finance.wacc} %)`], ['TIR di progetto', f.irrProject === null ? '–' : pc(f.irrProject)],
      ['Payback semplice', f.paybackProject ? n(f.paybackProject, 1) + ' anni' : 'oltre l\'orizzonte'], ['Aiuti considerati', n(f.totalAid) + ' €']]);
  }
  function blkNorme(keys) { return ul(keys.map(k => N[k] || k)); }
  function unifilare(x) {
    const e = x.e, L = ['```mermaid', 'flowchart TB', `  RETE["Rete del distributore ${x.cfg.grid.voltageKv} kV"] --> CU["Cabina di consegna e utente<br/>DG + SPG"]`,
      '  CU --> CAR["Carichi dello stabilimento"]', `  CU --> DDI["Scomparto impianto<br/>DDI + SPI"]`, `  DDI -->|"${e.mvCable.type.split(',')[0]} ${e.mvCable.S} mm² Al, ${e.mvCable.L} m"| QMT["Quadro MT d'impianto"]`];
    if (x.hasPv) L.push(`  QMT --> TRFV["${e.transformer.n} × TR FV ${n(e.transformer.kva)} kVA<br/>${e.transformer.mv}/${n(e.transformer.lv / 1000, 1)} kV"]`,
      `  TRFV --> QBT["Quadro BT ${e.inverter.vac} V"]`, `  QBT --> INV["${e.nInv} inverter ${e.inverter.pac} kW"]`, `  INV --> CAMPO["${e.strings} stringhe × ${e.Ns} moduli<br/>${n(e.kwpReal, 0)} kWp"]`);
    if (x.b && e.bess) L.push(`  QMT --> TRB["${e.bess.nTr} × TR BESS ${n(e.bess.trKva)} kVA"]`, `  TRB --> BESS["${e.bess.n} × ${e.bess.unit.name.split('(')[0].trim()}<br/>${n(x.cfg.bess.kwh)} kWh / ${n(x.cfg.bess.kw)} kW"]`);
    L.push('  CCI["CCI / EMS / SCADA"] -.-> DDI'); if (x.hasPv) L.push('  CCI -.-> INV'); if (x.b) L.push('  CCI -.-> BESS');
    return L.join('\n') + '\n```\n';
  }
  function durations(x) {
    const auth = { pubblica: 4, edilizia: 1, pas: 2, au: 6, paur: 12 }[x.procedure] || 3;
    const big = (x.cfg.pv.kwp + x.cfg.bess.kwh / 2) > 2000;
    return [['Progettazione e autorizzazione', auth], ['Preventivo e iter di connessione', Math.max(auth, 6)], ['Progetto esecutivo', 2], ['Affidamento EPC / gara', x.procedure === 'pubblica' ? 3 : 2],
      ['Forniture (trasformatori e BESS a lungo approvvigionamento)', 5], ['Costruzione', big ? 5 : 3], ['Messa in servizio e collaudo', 1]];
  }
  function gantt(x, detail) {
    const d0 = new Date(x.date + 'T00:00:00Z'), ds = s => s.toISOString().slice(0, 10), add = (dt, m) => { const z = new Date(dt); z.setUTCMonth(z.getUTCMonth() + m); return z; };
    const du = durations(x); let t = d0; const L = ['```mermaid', 'gantt', `  title Cronoprogramma ${phaseLabel(x)}`, '  dateFormat YYYY-MM-DD', '  axisFormat %m/%y'];
    const st = {}; L.push('  section Sviluppo');
    st.aut = t; L.push(`  ${du[0][0]} :a1, ${ds(t)}, ${du[0][1] * 30}d`);
    L.push(`  ${du[1][0]} :a2, ${ds(t)}, ${du[1][1] * 30}d`);
    t = add(d0, Math.max(du[0][1], 0)); L.push('  section Progettazione e affidamento', `  ${du[2][0]} :b1, ${ds(t)}, ${du[2][1] * 30}d`);
    t = add(t, du[2][1]); L.push(`  ${du[3][0]} :b2, ${ds(t)}, ${du[3][1] * 30}d`);
    t = add(t, du[3][1]); L.push('  section Realizzazione', `  ${du[4][0]} :c1, ${ds(t)}, ${du[4][1] * 30}d`);
    const tc = add(t, 2); L.push(`  ${du[5][0]} :c2, ${ds(tc)}, ${du[5][1] * 30}d`);
    if (detail) L.push(`  Opere civili e recinzione :c3, ${ds(tc)}, 45d`, `  Montaggio strutture e moduli :c4, ${ds(add(tc, 1))}, ${Math.max(30, (du[5][1] - 2) * 30)}d`, `  Cabine, MT e cablaggi :c5, ${ds(add(tc, 2))}, ${Math.max(30, (du[5][1] - 2) * 30)}d`);
    const tm = add(tc, du[5][1]), endConn = add(d0, du[1][1]), tcoll = tm > endConn ? tm : endConn;
    L.push('  section Esercizio', `  ${du[6][0]} :d1, ${ds(tcoll)}, ${du[6][1] * 30}d`, `  Entrata in esercizio :milestone, m1, ${ds(add(tcoll, du[6][1]))}, 0d`);
    return L.join('\n') + '\n```\n';
  }
  function capexRows(x, filter) {
    return x.c.rows.filter(r => r.total > 0 && (!filter || filter(r))).map(r => [r.group, r.label, r.unit === '%' ? n(r.unitValue, 1) + ' %' : n(r.unitValue) + ' ' + r.unit, r.unit === '€' || r.unit === '%' ? '' : n(r.qty), n(r.total)]);
  }
  // quantità del computo metrico (stime parametriche)
  function quantities(x) {
    const e = x.e, Q = [];
    if (x.hasPv) {
      Q.push(['FV.01', 'Moduli fotovoltaici ' + e.module.name, 'cad', e.nMod], ['FV.02', 'Strutture di sostegno (tavole da ' + e.Ns + ' moduli)', 'cad', e.strings],
        ['FV.03', 'Inverter ' + e.inverter.name, 'cad', e.nInv], ['FV.04', 'Cavo solare ' + e.dcCable.type + ' ' + e.dcCable.S + ' mm² (andata e ritorno)', 'm', Math.round(e.strings * 2 * e.dcCable.L * 1.1)],
        ['FV.05', `Cavo BT ${e.acCable ? e.acCable.par + '×' + e.acCable.S + ' mm² Al' : ''} inverter–quadro`, 'm', e.acCable ? Math.round(e.nInv * e.acCable.L * e.acCable.par * 1.05) : 0],
        ['FV.06', `Cabina di trasformazione con trasformatore ${n(e.transformer.kva)} kVA`, 'cad', e.transformer.n]);
      if (x.ground) Q.push(['CV.01', 'Recinzione perimetrale con cancelli', 'm', Math.round(x.perim)], ['CV.02', 'Viabilità interna in misto stabilizzato (larghezza 4 m)', 'm²', Math.round(x.areaM2 * 0.04)],
        ['CV.03', 'Scavo e cavidotti BT/DC (corrugati in PE)', 'm', Math.round(Math.sqrt(x.areaM2) * e.nInv * 0.8)]);
    }
    if (x.b && e.bess) Q.push(['BE.01', e.bess.unit.name, 'cad', e.bess.n], ['BE.02', `Trasformatore BESS ${n(e.bess.trKva)} kVA`, 'cad', e.bess.nTr],
      ['BE.03', 'Basamenti in c.a. per unità BESS', 'm²', Math.round(e.bess.footprint * 1.3)], ['BE.04', 'EMS / SCADA di impianto', 'a corpo', 1]);
    Q.push(['MT.01', `Cavo MT ${e.mvCable.type} 3×1×${e.mvCable.S} mm²`, 'm', Math.round(e.mvCable.L * 1.05)], ['MT.02', 'Scomparto MT di partenza in cabina utente con DDI e SPI', 'cad', 1],
      ['MT.03', 'Rete di terra in corda di rame nudo 50 mm²', 'm', Math.round(x.perim * 1.3 + (x.hasPv ? e.strings * 6 : 40))]);
    return Q;
  }

  // ---------- 2. contenuto dei singoli elaborati ----------
  const DOCS = {
    G01: { p: 'Elencare gli elaborati che compongono il progetto, con codice, titolo, revisione e formato.', r: ['D36', 'D190'],
      b: x => sec('Elaborati del progetto', tbl(['Codice', 'Titolo', 'Rev.', 'Formato', 'Stato'], x.selected.map(d => [`${x.prefix}-${PHASES[x.phase].short}-${d.code}`, d.title, x.rev, d.code[0] === 'T' || d.code[0] === 'D' ? 'Tavola (scheda in .md)' : 'Relazione (.md)', d.status === 'optional' ? 'se pertinente' : 'richiesto'])))
        + sec('Elaborati non applicabili alla configurazione', x.excluded.length ? ul(x.excluded.map(d => `${d.code} – ${d.title} (${d.status === 'na' ? 'non applicabile a ' + CONFIGS[x.config] : 'non selezionato'})`)) : 'Nessuno.') },
    G02: { p: 'Riassumere in una pagina i dati principali del progetto.', r: [],
      b: x => sec('Dati tecnici', blkImpianto(x)) + sec('Prestazioni attese', blkEnergia(x)) + sec('Dati economici', blkEconomia(x)) + sec('Iter', kv([['Procedura autorizzativa', PROCEDURES[x.procedure]], ['Durata stimata fino all\'esercizio', n(durations(x).reduce((a, d, i) => a + (i === 1 ? 0 : d[1]), 0)) + ' mesi circa']])) },
    G03: { p: 'Individuare enti competenti, titoli autorizzativi, pareri e nulla osta.', r: ['D190', 'TICA', 'VVF', 'D42', 'D152'],
      b: x => sec('Enti e atti', tbl(['Ente', 'Atto / parere', 'Necessità', 'Note'], [
        ['Comune', x.procedure === 'pas' ? 'PAS' : x.procedure === 'edilizia' ? 'Comunicazione / CILA' : 'Parere nell\'ambito del procedimento', 'Sì', 'Compatibilità urbanistica (R07)'],
        ['Regione / Provincia delegata', x.procedure === 'au' ? 'Autorizzazione Unica' : x.procedure === 'paur' ? 'PAUR' : 'Eventuale', x.procedure === 'au' || x.procedure === 'paur' ? 'Sì' : 'Da verificare', ''],
        ['Distributore (DSO) / Terna', 'Preventivo di connessione STMG/STMD, regolamento di esercizio', 'Sì', 'G05'],
        ['GSE', 'Qualifica e convenzioni (RID, FER X, iper-ammortamento), GAUDÌ', 'Sì', ''],
        ['Comando provinciale VVF', x.b ? 'Valutazione progetto / SCIA antincendio BESS' : 'Verifica attività soggette (cabine con olio)', x.b ? 'Sì' : 'Da verificare', x.b ? 'R14, X08' : ''],
        ['Agenzia delle Dogane (ADM)', 'Denuncia officina elettrica / licenza, se dovuta', 'Da verificare', 'Regime dell\'energia autoconsumata'],
        ['Soprintendenza ABAP', 'Autorizzazione paesaggistica, VPIA', 'Se vincoli', 'R08, R13'],
        ['ARPA / Ente VIA', 'Screening o VIA', x.procedure === 'paur' ? 'Sì' : 'Se soglie', 'R09'],
        ['Consorzio di bonifica / Autorità idraulica', 'Nulla osta scarichi e invarianza idraulica', 'Se pertinente', 'R06'],
        ['Gestori di sottoservizi e strade', 'Attraversamenti e concessioni per il cavidotto', 'Se pertinente', 'T09']]))
        + sec('Da completare', ul([todo('verificare con il Comune e la Regione l\'elenco definitivo degli atti'), todo('date di presentazione e scadenze')])) },
    G04: { p: 'Identificare le aree interessate e i titoli di disponibilità.', r: ['D190'],
      b: x => sec('Superfici necessarie', kv([['Area di impianto (stima)', n(x.areaM2) + ' m²' + (x.ground ? ` (${n(x.areaM2 / 10000, 2)} ha)` : '')], ['Area BESS con distanze (stima)', x.b && x.e.bess ? n(x.e.bess.areaWithSpacing) + ' m²' : '–'], ['Fascia per il cavidotto MT', n(x.e.mvCable.L) + ' m × 1 m']]))
        + sec('Piano particellare', tbl(['Comune', 'Foglio', 'Particella', 'Superficie catastale m²', 'Superficie occupata m²', 'Proprietà', 'Titolo (proprietà, diritto di superficie, servitù)'], [[todo('comune'), '', '', '', '', '', ''], ['', '', '', '', '', '', '']]))
        + sec('Documenti da allegare', ul(['Visure ed estratti di mappa aggiornati', 'Titoli di disponibilità (atti, contratti preliminari di diritto di superficie, servitù di cavidotto)', 'Certificato di destinazione urbanistica'])) },
    G05: { p: 'Riportare i dati della richiesta di connessione e del preventivo accettato.', r: ['TICA', 'CEI016', 'TERNA'],
      b: x => sec('Dati della richiesta', kv([['Tipo di richiesta', 'Modifica della connessione esistente dello stabilimento (cliente attivo)'], ['Tensione', x.cfg.grid.voltageKv + ' kV'],
        ['Potenza in immissione richiesta', x.cfg.grid.zeroExport ? '0 kW (immissione zero)' : n(x.cfg.grid.exportLimitKw) + ' kW'], ['Potenza disponibile in prelievo', n(x.cfg.grid.importLimitKw) + ' kW'],
        ['Potenza nominale dei generatori', n((x.hasPv ? x.e.kwac : 0) + (x.b ? x.cfg.bess.kw : 0)) + ' kW' + (x.b ? ` (di cui BESS ${n(x.cfg.bess.kw)} kW)` : '')], ['Sistema di accumulo', x.b ? `Sì, lato produzione/consumo da dichiarare (${n(x.cfg.bess.kwh)} kWh)` : 'No']]))
        + sec('Preventivo', kv([['Codice di rintracciabilità', todo('codice pratica')], ['Soluzione tecnica minima (STMG)', todo('descrizione')], ['Corrispettivo', todo('€')], ['Data di accettazione', todo('data')], ['Tempi di realizzazione', todo('giorni lavorativi')]])) },

    R01: { p: 'Descrivere il progetto nel suo insieme: obiettivi, sito, soluzioni adottate, prestazioni, costi e tempi.', r: ['D36', 'D190', 'CEI016', 'NTC', 'VVF'],
      b: x => sec('Premessa e obiettivi', `Il progetto prevede la realizzazione di ${x.hasPv ? `un impianto fotovoltaico da ${n(x.e.kwpReal, 0)} kWp ${mountName(x.cfg.pv.mount)}` : 'un sistema di accumulo elettrochimico'}${x.hasPv && x.b ? ' con sistema di accumulo' : ''} a servizio dello stabilimento ${x.cfg.project.client ? 'di ' + x.cfg.project.client : ''} a ${x.site.name}, in autoconsumo, per ridurre il prelievo dalla rete (${n(x.y.load / 1000)} MWh/a) e le emissioni.`)
        + sec('Inquadramento', kv([['Località', x.site.name], ['Coordinate (riferimento meteo)', `${n(x.site.lat, 2)}° N, ${n(x.site.lon, 2)}° E`], ['Zona di mercato', x.site.zone], ['Aree', todo('foglio e mappali (G04)')], ['Vincoli', todo('esito R07')]]))
        + sec('Descrizione sintetica dell\'impianto', blkImpianto(x)) + sec('Schema a blocchi', unifilare(x)) + sec('Prestazioni', blkEnergia(x)) + sec('Costi e sostenibilità', blkEconomia(x))
        + sec('Quadro normativo e procedurale', kv([['Procedura', PROCEDURES[x.procedure]], ['Livello di progettazione', phaseLabel(x)]]) + '\n' + blkNorme(['D36', 'D190', 'CEI016', 'NTC', 'VVF', 'IEC_B']) + '\n> L\'assoggettabilità dei BESS al DPR 151/2011 resta da verificare caso per caso con il Comando VVF competente.\n')
        + sec('Tempi', gantt(x)) },
    R02: { p: 'Descrivere in modo tecnico l\'impianto, i componenti e i criteri di dimensionamento.', r: ['CEI016', 'CEI648', 'IEC62548', 'CEI8225', 'IEC_B', 'TRF'],
      b: x => {
        const e = x.e; let s = sec('Configurazione', blkImpianto(x) + '\n' + unifilare(x));
        if (x.hasPv) s += sec('Generatore fotovoltaico', kv([['Modulo', e.module.name], ['Potenza / Voc / Vmp / Isc', `${e.module.pmax} W / ${e.module.voc} V / ${e.module.vmp} V / ${e.module.isc} A`], ['Coefficienti βVoc / γP', `${e.module.betaVoc} %/°C / ${e.module.gammaP} %/°C`],
          ['Installazione', mountName(x.cfg.pv.mount) + (x.cfg.pv.mount !== 'tracker' ? `, tilt ${x.cfg.pv.tilt}°, azimut ${x.cfg.pv.azimuth}°` : ', rotazione ±55°')], ['GCR / passo file', x.ground ? `${x.cfg.pv.gcr} / ${n(x.pitch, 1)} m (tavole 2P)` : '–'],
          ['Moduli in serie', `${e.Ns} (Nmax ${e.nMaxV} per Vdc, ${e.nMaxMppt} per MPPT; Nmin ${e.nMinFull} a piena potenza)`], ['Temperature di progetto', `Tmin ${n(e.tMin, 1)} °C, Tcella max ${n(e.tCellMax, 1)} °C`]]))
          + sec('Verifiche di stringa', tbl(['Rif.', 'Verifica', 'Valore', 'Limite', 'Esito'], e.checks.map(c => [c.id, c.what, c.value, c.limit, c.ok ? 'verificato' : '**non verificato**'])))
          + sec('Conversione', kv([['Inverter', `${e.nInv} × ${e.inverter.name}, η max ${n(e.inverter.eff * 100, 1)} %`], ['Rapporto DC/AC', n(e.kwpReal / e.kwac, 2)], ['Stringhe per inverter / per MPPT', `${e.spInv} / ${e.spMppt}`],
            ['Cavi di stringa', `${e.dcCable.type}, ${e.dcCable.S} mm², ΔV ${n(e.dcCable.dv, 2)} %`], ['Cavi AC', e.acCable ? `${e.acCable.par} × ${e.acCable.S} mm² Al, ΔV ${n(e.acCable.dv, 2)} %` : todo('verifica')]]));
        if (x.b && e.bess) s += sec('Sistema di accumulo', kv([['Tecnologia', 'Litio ferro fosfato (LFP), accoppiamento in corrente alternata'], ['Energia / potenza', `${n(x.cfg.bess.kwh)} kWh / ${n(x.cfg.bess.kw)} kW (${n(e.bess.cRate, 2)} C)`],
          ['Unità', `${e.bess.n} × ${e.bess.unit.name} (${n(e.bess.kwhInst)} kWh installati)`], ['RTE / DoD', `${x.cfg.bess.rte} % / ${x.cfg.bess.dod} %`],
          ['Strategia EMS', ['selfConsumption', 'arbitrage', 'peakShaving'].filter(k => x.cfg.bess.strategy[k]).map(k => ({ selfConsumption: x.hasPv ? 'autoconsumo FV' : 'scarica sui carichi dello stabilimento', arbitrage: 'arbitraggio', peakShaving: 'peak shaving' }[k])).join(', ')],
          ['Norme di prodotto', N.IEC_B]]));
        s += sec('Media tensione e protezioni', kv([['Linea MT', `${e.mvCable.type}, 3×1×${e.mvCable.S} mm², ${e.mvCable.L} m, I = ${n(e.mvCable.I)} A`], ['Tenuta al cortocircuito', `Smin ${n(e.mvCable.sMinSc)} mm² per ${n(e.mvCable.iccKa, 1)} kA × ${n(e.mvCable.tFault, 2)} s`],
          ['Contributo al cortocircuito', n(e.iscContribution) + ' A']]) + '\n' + tbl(['Codice', 'Funzione', 'Taratura tipica', 'Tempo'], e.protections.map(p => [p.code, p.fn, p.setting, p.time])));
        return s;
      } },
    R03: { p: 'Stimare la produzione di energia attesa e le perdite del generatore FV.', r: ['IEC62446', 'CEI8225'],
      b: x => {
        const M = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'], L = x.cfg.pv.losses;
        const rows = x.R.monthly.map((m, i) => [M[i], n(x.site.ghi[i] * F.MONTH_DAYS[i], 1), n(x.site.t[i], 1), n(m.pv / 1000, 1), n(m.direct / 1000, 1), n(m.exp / 1000, 1)]);
        rows.push(['**Anno**', n(x.site.ghi.reduce((a, g, i) => a + g * F.MONTH_DAYS[i], 0), 0), '', '**' + n(x.y.pv / 1000) + '**', n(x.y.pvDirect / 1000), n(x.y.exp / 1000)]);
        const deg = [1, 5, 10, 15, 20, 25].filter(a => a <= x.cfg.finance.years).map(a => [a, n(x.R.years[a - 1].pv / 1000), n(x.R.years[a - 1].pvFactor * 100, 1) + ' %']);
        const sig = 0.06; // incertezza complessiva (meteo + modello) assunta
        return sec('Metodo', 'Simulazione oraria (8.760 h) con irraggiamento sintetico da medie mensili (GHI e temperatura), modello di diffusa di Erbs, trasposizione Hay-Davies, temperatura di cella da NOCT, perdite DC/AC e clipping. ' + todo('sostituire con simulazione PVsyst o equivalente su TMY PVGIS-SARAH3 del sito e layout reale (ombreggiamenti)'))
          + sec('Dati meteo e produzione mensile', tbl(['Mese', 'GHI kWh/m²', 'T media °C', 'Produzione MWh', 'Autoconsumo MWh', 'Immissione MWh'], rows, ['', 'r', 'r', 'r', 'r', 'r']))
          + sec('Perdite', tbl(['Perdita', 'Valore'], [['Sporcamento', L.soiling + ' %'], ['Ombreggiamento', L.shading + ' %'], ['Mismatch', L.mismatch + ' %'], ['Cavi DC', L.dcCable + ' %'], ['Cavi AC', L.acCable + ' %'], ['Trasformatore', L.transformer + ' %'], ['Disponibilità', L.availability + ' %'], ['Basso irraggiamento', L.lowIrr + ' %'], ['Degrado primo anno', x.cfg.pv.degrFirst + ' %']]))
          + sec('Risultati', kv([['Irraggiamento sul piano dei moduli', n(x.k.poa) + ' kWh/m²'], ['Producibilità specifica P50', n(x.k.specificYield) + ' kWh/kWp'], ['Performance ratio', pc(x.k.pr)],
            ['P90 (1 anno, σ = ' + n(sig * 100) + ' %)', n(x.y.pv / 1000 * (1 - 1.282 * sig)) + ' MWh'], ['Produzione sulla vita utile', n(x.R.years.reduce((a, y) => a + y.pv, 0) / 1e6, 1) + ' GWh']]))
          + sec('Degrado', tbl(['Anno', 'Produzione MWh', 'Fattore'], deg, ['r', 'r', 'r']));
      } },
    R04: { p: 'Giustificare taglia, durata e modalità di esercizio del sistema di accumulo.', r: ['IEC_B', 'CEI016'],
      b: x => {
        const b = x.cfg.bess, y = x.y, sizes = [0.5, 1, 1.5, 2].map(f => {
          const r = F.simulate(Object.assign({}, x.cfg, { bess: Object.assign({}, b, { kwh: b.kwh * f, kw: b.kw * f }), finance: Object.assign({}, x.cfg.finance) }));
          return [n(b.kwh * f) + ' / ' + n(b.kw * f), n(r.y1.bessOut / 1000), n(r.y1.efc), n(r.capex.bess), n(r.fin.npvProject)];
        });
        const soh = x.R.years.filter((_, i) => i % 3 === 0 || x.R.years[i].augKwh).map(yy => [yy.year, pc(yy.soh), n(yy.efc), n(yy.augKwh)]);
        return sec('Use case', ul([b.strategy.selfConsumption && x.hasPv ? 'Aumento dell\'autoconsumo dell\'energia FV (spostamento del surplus diurno verso le ore serali)' : null,
          b.strategy.arbitrage ? 'Arbitraggio: carica nelle ore a basso prezzo (notte) e scarica nelle ore di picco' : null, b.strategy.peakShaving ? `Peak shaving: prelievo limitato a ${n(b.strategy.peakLimitKw)} kW con riserva di SOC del ${b.strategy.reserveSoc} %` : null,
          x.cfg.grid.zeroExport ? 'Gestione del vincolo di immissione zero' : null].filter(Boolean)))
          + sec('Dimensionamento', kv([['Energia / potenza', `${n(b.kwh)} kWh / ${n(b.kw)} kW`], ['Durata', n(b.kwh / b.kw, 1) + ' h'], ['Energia utile (DoD ' + b.dod + ' %)', n(b.kwh * b.dod / 100) + ' kWh'], ['Rendimento round-trip', b.rte + ' %'], ['Ausiliari', n(b.auxPct, 1) + ' % della capacità al giorno']]))
          + sec('Profilo di esercizio (anno 1)', kv([['Energia caricata da FV', n(y.pvToBess / 1000) + ' MWh'], ['Energia caricata da rete', n(y.gridToBess / 1000) + ' MWh'], ['Energia scaricata', n(y.bessOut / 1000) + ' MWh'], ['Cicli equivalenti', n(y.efc)], ['Riduzione del picco di prelievo', n(Math.max(...y.peakBase) - Math.max(...y.peakProj)) + ' kW']]))
          + sec('Confronto di taglie (stesso rapporto potenza/energia)', tbl(['kWh / kW', 'Scarica MWh/a', 'Cicli/a', 'CAPEX BESS €', 'VAN progetto €'], sizes, ['', 'r', 'r', 'r', 'r']))
          + sec('Degrado e capacità garantita', tbl(['Anno', 'SOH', 'Cicli', 'Augmentation kWh'], soh, ['r', 'r', 'r', 'r']) + `\nStrategia: ${b.augmentation ? `augmentation al raggiungimento del ${b.augmentSoh} % di SOH` : `sostituzione a fine vita (${b.eolSoh} % di SOH)`}. ` + todo('capacità garantita, curva di degrado e LTSA del fornitore'))
          + (x.config === 'B' ? sec('Configurazione solo BESS: punti rafforzati', ul(['Strategia di augmentation e degradazione con capacità garantita a contratto', 'Piano di fine vita delle batterie (Reg. UE 2023/1542)', 'Valore economico dipendente dagli spread di prezzo: verificare ricavi da servizi (UVA/MSD) e vincoli di potenza'])) : '');
      } },
    R05: { p: 'Caratterizzare il sottosuolo e fornire i parametri per le fondazioni.', r: ['NTC'],
      b: x => sec('Opere di fondazione previste', ul([x.hasPv && x.ground ? `Pali infissi o a vite per ${n(x.e.strings)} tavole (${x.e.Ns} moduli ciascuna)` : null, x.hasPv && !x.ground ? 'Nessuna fondazione: verifica statica della copertura esistente' : null,
        x.b && x.e.bess ? `Basamenti in c.a. per ${x.e.bess.n} unità BESS (${n(x.e.bess.unit.weight / 1000, 1)} t ciascuna)` : null, 'Platee per cabine di trasformazione e cabina MT'].filter(Boolean)))
        + sec('Indagini richieste', tbl(['Indagine', 'Quantità indicativa', 'Scopo'], [['Sondaggi a carotaggio continuo', Math.max(1, Math.round(x.areaM2 / 20000)) + '', 'Stratigrafia, falda'], ['Prove penetrometriche (CPT/DPSH)', Math.max(2, Math.round(x.areaM2 / 8000)) + '', 'Parametri geotecnici'],
          ['Prove di estrazione su pali campione', x.hasPv && x.ground ? '3–5' : '–', 'Portata a trazione e a taglio'], ['MASW / HVSR', '1', 'Categoria di sottosuolo (NTC §3.2.2)'], ['Resistività del terreno (Wenner)', '2–4', 'Progetto della rete di terra (X05)']]))
        + sec('Modello geologico e geotecnico', todo('stratigrafia, falda, parametri caratteristici (γ, φ\', c\', cu), categoria di sottosuolo e topografica, pericolosità sismica di base')) },
    R06: { p: 'Valutare il regime idrologico e garantire l\'invarianza idraulica.', r: ['D152'],
      b: x => {
        const imp = (x.hasPv ? x.e.transformer.n * 30 + 25 : 25) + (x.b && x.e.bess ? x.e.bess.footprint * 1.5 : 0), roads = x.ground || !x.hasPv ? x.areaM2 * 0.04 : 0;
        return sec('Superfici', kv([['Area di intervento', n(x.areaM2) + ' m²'], ['Superfici impermeabili (cabine, basamenti)', n(imp) + ' m²'], ['Viabilità semipermeabile', n(roads) + ' m²'],
          ['Superficie sotto i moduli', x.hasPv && x.ground ? 'permeabile (prato), coefficiente di deflusso invariato salvo verifica' : '–']]))
          + sec('Invarianza idraulica', `Volume di laminazione = superficie impermeabilizzata equivalente × volume specifico del regolamento regionale. ${todo('volume specifico (m³/ha imp.) e portata limite allo scarico secondo il regolamento della Regione')}; ${todo('recapito (suolo, reticolo, fognatura) e sistema di laminazione/dispersione')}.`)
          + sec('Pericolosità idraulica', todo('classificazione PAI/PGRA, tiranti attesi, quota minima di cabine e BESS sopra il tirante di riferimento'));
      } },
    R07: { p: 'Verificare la compatibilità con gli strumenti urbanistici, i vincoli e le aree idonee.', r: ['D190', 'D42'],
      b: x => sec('Checklist', tbl(['Verifica', 'Esito'], [['Destinazione urbanistica (PGT/PRG)', todo('zona')], ['Area idonea ai sensi del D.Lgs. 190/2024 (es. aree industriali, coperture, aree interne agli stabilimenti)', todo('sì/no e riferimento')],
        ['Vincolo paesaggistico (D.Lgs. 42/2004)', todo('sì/no')], ['Vincolo idrogeologico', todo('sì/no')], ['Aree naturali protette, Rete Natura 2000', todo('sì/no')], ['Fasce di rispetto (strade, elettrodotti, corsi d\'acqua)', todo('distanze')],
        ['Classificazione acustica', todo('classe')], ['Zone di rischio incidente rilevante (Seveso)', todo('sì/no')]]))
        + sec('Regime amministrativo', `Procedura individuata: **${PROCEDURES[x.procedure]}**. ${todo('riferimento all\'articolo e all\'allegato del D.Lgs. 190/2024 applicabile')}`) },
    R08: { p: 'Valutare la compatibilità paesaggistica dell\'intervento.', r: ['D42'],
      b: x => sec('Contenuti (DPCM 12/12/2005)', ul(['Stato dei luoghi e contesto paesaggistico', 'Elementi di valore e vincoli', 'Simulazioni fotografiche (fotoinserimenti) da punti di vista significativi', 'Misure di mitigazione (siepi, schermature, colori)', 'Valutazione di compatibilità']))
        + sec('Dati dell\'intervento', kv([['Altezza massima strutture', x.hasPv ? (x.cfg.pv.mount === 'tracker' ? '≈ 2,8–3,0 m alla massima rotazione' : '≈ 2,5–3,0 m') : '–'], ['Altezza unità BESS', x.b ? '≈ 2,5–2,9 m' : '–'], ['Superficie', n(x.areaM2) + ' m²']])) + todo('documentazione fotografica e fotoinserimenti') },
    R09: { p: 'Verificare l\'assoggettabilità a VIA e descrivere gli impatti.', r: ['D152', 'D190'],
      b: x => sec('Soglie', `${todo('verificare le soglie dell\'Allegato IV alla Parte II del D.Lgs. 152/2006 e del D.Lgs. 190/2024 per la potenza di ' + n((x.hasPv ? x.e.kwpReal : 0) + (x.b ? x.cfg.bess.kw : 0)) + ' kW')}`)
        + sec('Matrice degli impatti', tbl(['Componente', 'Fase di cantiere', 'Fase di esercizio', 'Mitigazione'], [['Suolo', 'Scavi, movimenti terra', 'Occupazione', 'Ripristino a fine vita (R16)'], ['Acque', 'Dilavamento', 'Invarianza (R06)', 'Laminazione'], ['Rumore', 'Mezzi di cantiere', 'Inverter, trasformatori, HVAC BESS (R10)', 'Distanze, schermi'],
          ['Campi elettromagnetici', '–', 'Cabine e cavi MT (R11)', 'DPA'], ['Paesaggio', '–', 'Visibilità', 'R08'], ['Atmosfera', 'Polveri', 'Emissioni evitate ' + n(x.k.co2) + ' t CO₂/a', '–']])) },
    R10: { p: 'Stimare le emissioni sonore degli impianti e verificare i limiti ai ricettori.', r: ['ACU'],
      b: x => {
        const src = []; // livelli di pressione a 1 m indicativi, da sostituire con dati di targa
        if (x.hasPv) src.push(['Inverter ' + x.e.inverter.pac + ' kW', x.e.nInv, 65], ['Trasformatore ' + n(x.e.transformer.kva) + ' kVA', x.e.transformer.n, 62]);
        if (x.b && x.e.bess) src.push(['Unità BESS (HVAC)', x.e.bess.n, 72], ['Trasformatore BESS ' + n(x.e.bess.trKva) + ' kVA', x.e.bess.nTr, 58]);
        const tot1 = 10 * Math.log10(src.reduce((a, s) => a + s[1] * Math.pow(10, s[2] / 10), 0) || 1);
        const at = r => n(tot1 - 20 * Math.log10(r), 1);
        return sec('Sorgenti', tbl(['Sorgente', 'Numero', 'Lp a 1 m dB(A) (indicativo)'], src.map(s => [s[0], s[1], s[2]]), ['', 'r', 'r']) + `\nLivello complessivo equivalente a 1 m (sorgenti concentrate, somma energetica): ${n(tot1, 1)} dB(A).`)
          + sec('Propagazione (campo libero emisferico, senza schermi)', tbl(['Distanza', '25 m', '50 m', '100 m', '200 m'], [['Lp dB(A)', at(25), at(50), at(100), at(200)]], ['', 'r', 'r', 'r', 'r']) + '\nStima cautelativa: tutte le sorgenti concentrate nello stesso punto; il funzionamento è prevalentemente diurno per il FV, anche notturno per HVAC e BESS (arbitraggio).')
          + sec('Verifica ai ricettori', tbl(['Ricettore', 'Distanza m', 'Classe acustica', 'Limite immissione diurno/notturno', 'Livello stimato', 'Differenziale'], [[todo('ricettore'), '', '', '', '', '']]) + todo('misure di rumore residuo e verifica del criterio differenziale (DPCM 14/11/1997)'))
          + (x.config === 'B' ? sec('Configurazione solo BESS', 'Studio rafforzato: HVAC e PCS funzionano anche di notte; valutare schermi fonoassorbenti e modalità silenziata notturna dell\'HVAC.') : '');
      } },
    R11: { p: 'Valutare i campi elettromagnetici e determinare le distanze di prima approssimazione (DPA).', r: ['CEM'],
      b: x => {
        const rows = []; const dpa = (S, V) => { const I = S * 1000 / (Math.sqrt(3) * V), xm = 0.03; return { I, d: Math.ceil(0.40942 * Math.pow(xm, 0.5241) * Math.sqrt(I) * 2) / 2 }; };
        if (x.hasPv) { const a = dpa(x.e.transformer.kva, x.e.transformer.lv); rows.push(['Cabina di trasformazione FV ' + n(x.e.transformer.kva) + ' kVA', n(a.I) + ' A (BT)', n(a.d, 1) + ' m']); }
        if (x.b && x.e.bess) { const a = dpa(x.e.bess.trKva, 400); rows.push(['Cabina di trasformazione BESS ' + n(x.e.bess.trKva) + ' kVA', n(a.I) + ' A (BT)', n(a.d, 1) + ' m']); }
        rows.push([`Linea MT interrata ${x.e.mvCable.S} mm² a trifoglio`, n(x.e.mvCable.I) + ' A', '< 1 m dall\'asse (da verificare)']);
        return sec('Metodo', 'Obiettivo di qualità 3 µT (DPCM 08/07/2003). DPA delle cabine secondo la formula semplificata del DM 29/05/2008: DPA = 0,40942 · x^0,5241 · √I, con x = diametro dei cavi BT (assunto 0,03 m) e I = corrente nominale lato BT; arrotondamento al mezzo metro superiore.')
          + sec('Distanze di prima approssimazione', tbl(['Sorgente', 'Corrente', 'DPA'], rows))
          + sec('Verifica', 'All\'interno delle DPA non devono esserci luoghi con permanenza di persone superiore a 4 ore al giorno. ' + todo('verifica su planimetria (T02) degli edifici e delle aree di lavoro'));
      } },
    R12: { p: 'Descrivere il sistema agrivoltaico e la continuità dell\'attività agricola.', r: ['D190'],
      b: () => sec('Contenuti', ul(['Caratterizzazione pedologica e agronomica dell\'area', 'Piano colturale e continuità dell\'attività agricola', 'Requisiti delle Linee guida MASE sugli impianti agrivoltaici (superficie agricola, altezza minima, monitoraggio)', 'Producibilità agricola attesa e confronto ante/post'])) + todo('relazione a firma di agronomo') },
    R13: { p: 'Valutare il rischio archeologico dell\'area (art. 41 c. 4 e Allegato I.8 D.Lgs. 36/2023 per le opere pubbliche).', r: ['D36', 'D42'],
      b: x => sec('Contenuti', ul(['Ricerca bibliografica e d\'archivio', 'Lettura geomorfologica e fotointerpretazione', 'Ricognizione di superficie', 'Carta del rischio archeologico relativa alle opere (scavi per cavidotti ' + n(x.e.mvCable.L) + ' m e fondazioni)'])) + todo('relazione a firma di archeologo abilitato') },
    R14: { p: 'Impostare la sicurezza antincendio del BESS secondo le Linee guida VVF: isola BESS, distanze, accessibilità.', r: ['VVF', 'DPR151', 'IEC_B'],
      b: x => {
        const e = x.e, u = e.bess ? e.bess.unit : null;
        return sec('Dati del sistema', kv([['Tecnologia', 'LFP'], ['Unità', u ? `${e.bess.n} × ${u.name}` : '–'], ['Energia complessiva', n(x.cfg.bess.kwh) + ' kWh'], ['Ingombro in pianta per unità', u ? n(u.footprint, 1) + ' m²' : '–'],
          ['Verifica unità base ≤ 32 m² in pianta (Linee guida VVF)', u ? (u.footprint <= 32 ? 'verificato (' + n(u.footprint, 1) + ' m²)' : '**non verificato**') : '–'], ['Certificazioni richieste', 'UL 9540A (prova a livello di cella, modulo, unità), IEC 62619, IEC 62933-5-2']]))
          + sec('Isola BESS e distanze', tbl(['Distanza', 'Valore di progetto', 'Riferimento'], [['Tra unità base all\'interno dell\'isola', todo('m'), 'Linee guida VVF 2024, da verificare'], ['Tra isole BESS', todo('m'), 'idem'], ['Di protezione (recinzione)', todo('m'), 'idem'], ['Esterna (edifici, confini, depositi combustibili)', todo('m'), 'idem'], ['Da cabine e trasformatori in olio', todo('m'), 'idem']]))
          + sec('Misure', ul(['Rivelazione fumo e gas (H₂, CO, VOC) nelle unità, con interblocco su PCS e HVAC', 'Sistema di estinzione o contenimento a bordo unità secondo i test UL 9540A', 'Ventilazione/deflagration venting (NFPA 68/69 come riferimento)', 'Viabilità VVF e accessi, area di manovra', 'Rete idranti o riserva idrica ' + todo('portata e durata richieste'), 'Gestione e contenimento delle acque di spegnimento', 'Piano di emergenza e formazione del personale']))
          + sec('Assoggettabilità', 'L\'assoggettabilità al DPR 151/2011 va verificata caso per caso con il Comando VVF competente (es. per trasformatori in olio, gruppi elettrogeni o depositi). ' + todo('esito della verifica'))
          + (x.config === 'B' ? sec('Configurazione solo BESS: punti rafforzati', ul(['Analisi del rischio incendio ed esplosione estesa all\'intera area', 'Distanze di sicurezza interne, esterne e di protezione', 'Piano di emergenza e accessibilità per i VVF', 'Gestione delle acque di spegnimento'])) : '');
      } },
    R15: { p: 'Programmare la manutenzione preliminare dell\'impianto.', r: ['IEC62446', 'CEI016'],
      b: x => sec('Programma', tbl(['Componente', 'Attività', 'Frequenza'], [].concat(x.hasPv ? [['Moduli', 'Ispezione visiva, termografia', 'Annuale'], ['Moduli', 'Lavaggio', '1–2 volte/anno'], ['Strutture', 'Serraggi, corrosione', 'Annuale'], ['Inverter', 'Filtri, ventole, log di errore', 'Semestrale'], ['Stringhe', 'Curve I-V a campione', 'Biennale'], ['Area', 'Sfalcio vegetazione', '3–4 volte/anno']] : [],
        x.b ? [['BESS', 'Verifica BMS, bilanciamento, SOH', 'Trimestrale'], ['BESS', 'HVAC e filtri', 'Trimestrale'], ['BESS', 'Prova dei sistemi di rivelazione ed estinzione', 'Semestrale'], ['BESS', 'Prova di capacità', 'Annuale']] : [],
        [['Trasformatori', 'Olio/temperature, ispezione', 'Annuale'], ['Quadri MT', 'Manovre, serraggi, termografia', 'Annuale'], ['SPI', 'Verifica periodica del sistema di protezione di interfaccia', 'Secondo CEI 0-16'], ['Impianto di terra', 'Misura della resistenza', 'Biennale (DPR 462/2001)']])))
        + sec('Costi', kv([['O&M FV', n(x.cfg.opex.pvOmKwp * x.cfg.pv.kwp) + ' €/a'], ['O&M BESS', x.b ? n(x.cfg.opex.bessOmKwh * x.cfg.bess.kwh) + ' €/a' : '–']])) },
    R16: { p: 'Descrivere la dismissione a fine vita, il recupero dei materiali e i costi di ripristino.', r: ['RAEE', 'REG1542', 'D152'],
      b: x => {
        const pvC = x.cfg.opex.decommEurKwp * x.cfg.pv.kwp, bC = x.b ? 15 * x.cfg.bess.kwh : 0;
        return sec('Fasi', ul(['Disconnessione e messa in sicurezza', x.hasPv ? `Smontaggio di ${n(x.e.nMod)} moduli e conferimento come RAEE professionali` : null, x.hasPv && x.ground ? `Rimozione di ${n(x.e.strings)} tavole e dei pali, recupero dell\'acciaio` : null,
          x.b ? `Ritiro di ${x.e.bess ? x.e.bess.n : ''} unità BESS da parte del produttore (responsabilità estesa, Reg. UE 2023/1542)` : null, 'Rimozione di cabine, cavi e basamenti', 'Ripristino dello stato dei luoghi'].filter(Boolean)))
          + sec('Stima dei costi', tbl(['Voce', 'Costo €'], [['Dismissione FV (' + x.cfg.opex.decommEurKwp + ' €/kWp)', n(pvC)], ['Dismissione BESS (15 €/kWh, stima)', n(bC)], ['Recupero materiali (acciaio, rame, alluminio)', todo('valore')], ['**Totale netto**', '**' + n(pvC + bC) + '**']], ['', 'r']))
          + sec('Garanzie', todo('eventuale fideiussione per il ripristino richiesta dal Comune o dalla Regione'))
          + (x.config === 'B' ? sec('Piano di fine vita delle batterie', ul(['Passaporto della batteria e dati sullo stato di salute', 'Possibile seconda vita o riciclo; obiettivi di recupero dei materiali', 'Trasporto come merci pericolose (ADR classe 9)'])) : '');
      } }
  };
  // elaborati grafici: scheda dell'elaborato con contenuti e dati da riportare in tavola
  function tav(scale, contents, data) { return { p: 'Scheda dell\'elaborato grafico: contenuti e dati di progetto da riportare in tavola (il disegno va prodotto in CAD/GIS).', r: [], b: x => sec('Formato e scala', scale) + sec('Contenuti', ul(contents(x))) + (data ? sec('Dati di progetto', data(x)) : '') }; }
  Object.assign(DOCS, {
    T01: tav('Formato A1/A0, scale 1:25.000 – 1:10.000 – 1:2.000', () => ['Corografia su IGM/CTR', 'Stralcio dello strumento urbanistico', 'Carta dei vincoli (paesaggistico, idrogeologico, Natura 2000)', 'Estratto di mappa catastale con perimetro di intervento'], x => kv([['Località', x.site.name], ['Area', n(x.areaM2) + ' m²']])),
    T02: tav('Formato A0, scala 1:1.000 – 1:2.000', x => ['Layout su ortofoto e CTR', x.hasPv ? 'File di tavole, cabine, viabilità, recinzione' : 'Area BESS', x.b ? 'Area BESS con distanze' : null, 'Cavidotto MT fino alla cabina utente', 'DPA (R11)'].filter(Boolean),
      x => kv([['Tavole FV', x.hasPv ? `${n(x.e.strings)} da ${x.e.Ns} moduli (2P)` : '–'], ['Passo tra le file', x.pitch ? n(x.pitch, 1) + ' m' : '–'], ['Recinzione', n(x.perim) + ' m (stima)'], ['Lunghezza cavidotto MT', n(x.e.mvCable.L) + ' m']])),
    T03: tav('Scala 1:500 – 1:100', () => ['Planimetria quotata con distanze dai confini', 'Sezioni tipo trasversali e longitudinali delle file', 'Quote del terreno e altezze massime'], x => kv([['Altezza minima/massima moduli', todo('m')], ['Passo', x.pitch ? n(x.pitch, 1) + ' m' : '–']])),
    T04: tav('Scala 1:200', () => ['Isola BESS con unità base, distanze interne ed esterne', 'Viabilità VVF, area di manovra, accessi', 'Idranti / riserva idrica', 'Raccolta delle acque di spegnimento'], x => x.e.bess ? kv([['Unità', x.e.bess.n + ' × ' + x.e.bess.unit.name], ['Ingombro unità', n(x.e.bess.footprint, 1) + ' m²'], ['Area con distanze (stima)', n(x.e.bess.areaWithSpacing) + ' m²']]) : ''),
    T05: { p: 'Schema unifilare generale e schema a blocchi dell\'impianto.', r: ['CEI016'], b: x => sec('Schema a blocchi', unifilare(x)) + sec('Dati per lo schema unifilare', blkImpianto(x) + '\n' + tbl(['Protezione', 'Funzione', 'Taratura tipica'], x.e.protections.map(p => [p.code, p.fn, p.setting]))) },
    T06: tav('Scala 1:50', x => ['Pianta, prospetti e sezioni della cabina di trasformazione', x.hasPv ? 'Tipologico inverter su supporto' : null, x.b ? 'Tipologico unità BESS e PCS' : null, 'Cabina MT d\'impianto'].filter(Boolean),
      x => kv([['Trasformatore FV', x.hasPv ? `${x.e.transformer.n} × ${n(x.e.transformer.kva)} kVA` : '–'], ['Unità BESS', x.e.bess ? `${x.e.bess.unit.name}, ${n(x.e.bess.unit.weight / 1000, 1)} t` : '–']])),
    T07: tav('Scala 1:50 – 1:20', () => ['Vista laterale e frontale della tavola', 'Pali, traversi, arcarecci, morsetti', 'Altezze e inclinazione'], x => kv([['Configurazione', `2P × ${Math.ceil(x.e.Ns / 2)} moduli (${x.e.Ns} per tavola)`], ['Peso moduli per tavola', n(x.e.Ns * x.e.module.weight) + ' kg'], ['Inclinazione', x.cfg.pv.tilt + '°']])),
    T08: tav('Scala 1:1.000 e particolari 1:20', () => ['Tracciato di recinzione e cancelli', 'Viabilità interna e sezioni tipo', 'Rete di drenaggio e laminazione (R06)'], x => kv([['Recinzione', n(x.perim) + ' m'], ['Viabilità', n(x.areaM2 * 0.04) + ' m² (stima)']])),
    T09: tav('Scala 1:2.000 e sezioni 1:20', () => ['Tracciato del cavidotto MT fino alla cabina utente', 'Attraversamenti e interferenze', 'Sezioni di scavo tipo', 'Opere di rete del distributore (se previste)'], x => kv([['Cavo', `${x.e.mvCable.type} 3×1×${x.e.mvCable.S} mm²`], ['Lunghezza', n(x.e.mvCable.L) + ' m']])),
    T10: tav('Scala 1:1.000', () => ['Maglia di terra e collegamenti equipotenziali', 'Pali TVCC, barriere antintrusione, illuminazione', 'Percorsi dei cavi di segnale'], x => kv([['Corda di terra (stima)', n(x.perim * 1.3 + (x.hasPv ? x.e.strings * 6 : 40)) + ' m']])),
    E01: { p: 'Stimare il costo dell\'opera per voci.', r: [], b: x => sec('Computo estimativo', tbl(['Gruppo', 'Voce', 'Prezzo unitario', 'Quantità', 'Importo €'], capexRows(x).concat([['', '**Totale**', '', '', '**' + n(x.c.total) + '**']]), ['', '', 'r', 'r', 'r'])) + '\nValori parametrici di classe AACE 4; dettaglio e fonti nel documento 04_Valutazione_CAPEX.\n' },
    E02: { p: 'Riportare il quadro economico dell\'intervento.', r: ['D36'], b: x => {
      const works = x.c.rows.filter(r => r.total > 0 && !['eng', 'dev', 'engb', 'conn', 'cont', 'own'].includes(r.id)).reduce((a, r) => a + r.total, 0);
      const safety = works * 0.025 / 1.025, tech = x.c.rows.filter(r => ['eng', 'dev', 'engb'].includes(r.id)).reduce((a, r) => a + r.total, 0), conn = (x.c.rows.find(r => r.id === 'conn') || { total: 0 }).total;
      const cont = (x.c.rows.find(r => r.id === 'cont') || { total: 0 }).total, own = (x.c.rows.find(r => r.id === 'own') || { total: 0 }).total;
      return sec('Quadro economico', tbl(['Voce', 'Importo €'], [['**A. Lavori e forniture**', ''], ['A.1 Lavori e forniture soggetti a ribasso', n(works - safety)], ['A.2 Oneri della sicurezza non soggetti a ribasso (2,5 % di A.1, stima)', n(safety)], ['**Totale A**', '**' + n(works) + '**'],
        ['**B. Somme a disposizione**', ''], ['B.1 Allacciamenti e opere di connessione', n(conn)], ['B.2 Spese tecniche, autorizzazioni e collaudi', n(tech)], ['B.3 Imprevisti', n(cont)], ['B.4 Costi del committente', n(own)], ['B.5 IVA', todo('aliquota (10 % o 22 % secondo i casi; detraibile per l\'impresa)')],
        ['**Totale B (IVA esclusa)**', '**' + n(conn + tech + cont + own) + '**'], ['**Totale intervento (A + B, IVA esclusa)**', '**' + n(works + conn + tech + cont + own) + '**']], ['', 'r'])) + 'Il totale coincide con il CAPEX del simulatore (E01).\n';
    } },
    E03: { p: 'Programmare le fasi del progetto fino all\'entrata in esercizio.', r: [], b: x => sec('Cronoprogramma', gantt(x)) + sec('Durate', tbl(['Fase', 'Mesi'], durations(x), ['', 'r'])) },
    E04: { p: 'Prime indicazioni per la stesura del Piano di sicurezza e coordinamento.', r: ['D81'], b: x => sec('Rischi principali', tbl(['Lavorazione', 'Rischi', 'Misure'], [
      ['Movimentazione e posa moduli', 'Movimentazione manuale dei carichi, tagli', 'Mezzi di sollevamento, DPI'], ['Infissione pali', 'Rumore, vibrazioni, sottoservizi', 'Rilievo interferenze, DPI uditivi'], [x.hasPv && !x.ground ? 'Lavori in copertura' : 'Scavi per cavidotti', x.hasPv && !x.ground ? 'Caduta dall\'alto, sfondamento' : 'Seppellimento, interferenze', x.hasPv && !x.ground ? 'Linee vita, parapetti, reti' : 'Armature, segnalazione'],
      ['Lavori elettrici', 'Elettrocuzione (anche lato DC sotto irraggiamento), arco elettrico', 'CEI 11-27, personale PES/PAV'], x.b ? ['Installazione BESS', 'Thermal runaway, sollevamento di carichi pesanti', 'Procedure del fornitore, gru, piano di emergenza'] : null, ['Interferenze con lo stabilimento in esercizio', 'Traffico, accessi', 'Coordinamento con il datore di lavoro (DUVRI)']].filter(Boolean)))
      + sec('Stima degli oneri della sicurezza', n(x.c.total * 0.025) + ' € (2,5 % dell\'importo, da dettagliare nel PSC)') },
    E05: { p: 'Definire requisiti descrittivi e prestazionali per l\'affidamento.', r: ['IEC62446', 'IEC_B', 'CAM'], b: x => sec('Requisiti prestazionali', tbl(['Requisito', 'Valore minimo', 'Verifica'], [].concat(x.hasPv ? [['Potenza installata', n(x.e.kwpReal, 1) + ' kWp ±1 %', 'Flash report dei moduli'], ['Performance ratio garantito (anno 1, corretto per temperatura)', pc(Math.max(0.75, x.k.pr - 0.04)), 'Prova di 7–30 giorni (IEC 61724)'],
      ['Degrado moduli', `≤ ${x.cfg.pv.degrFirst} % primo anno, ≤ ${x.cfg.pv.degrAnnual} %/anno`, 'Garanzia del costruttore'], ['Disponibilità', '≥ ' + x.cfg.pv.losses.availability + ' %', 'Contratto O&M']] : [],
      x.b ? [['Capacità BESS utile', n(x.cfg.bess.kwh * x.cfg.bess.dod / 100) + ' kWh', 'Prova di capacità al collaudo'], ['RTE AC-AC', '≥ ' + x.cfg.bess.rte + ' %', 'Prova di efficienza'], ['SOH garantito', '≥ ' + (x.cfg.bess.augmentSoh || 80) + ' % a 10 anni', 'LTSA']] : [],
      [['Conformità CEI 0-16', 'Dichiarazione e prove', 'Regolamento di esercizio']]))) + sec('Componenti', blkImpianto(x)) },
    E06: { p: 'Valutare la sostenibilità economico-finanziaria dell\'investimento.', r: [], b: x => sec('Indicatori', blkEconomia(x) + '\n' + kv([['TIR equity', x.f.irrEquity === null ? '–' : pc(x.f.irrEquity)], ['DSCR minimo', isFinite(x.f.minDscr) ? n(x.f.minDscr, 2) : '–'], ['LCOE FV', x.hasPv ? n(x.f.lcoePv, 1) + ' €/MWh' : '–'], ['LCOS BESS', x.b ? n(x.f.lcosBess, 0) + ' €/MWh' : '–']]))
      + sec('Flussi di cassa (primi 10 anni, €)', tbl(['Anno', 'Ricavi/risparmi', 'OPEX', 'EBITDA', 'Imposte', 'FCF progetto', 'FCF equity'], [['0', '', '', '', '', n(x.f.cfProj[0]), n(x.f.cfEq[0])]].concat(x.f.rows.slice(0, 10).map(r => [r.y, n(r.revenue), n(r.opex + r.extraord), n(r.ebitda), n(r.taxU), n(r.cfProj), n(r.cfEq)])), ['r', 'r', 'r', 'r', 'r', 'r', 'r']))
      + sec('Incentivi', x.f.incentives.length ? tbl(['Misura', 'Valore €'], x.f.incentives.map(i => [i.name, n(i.amount)]), ['', 'r']) : 'Nessun incentivo considerato.') }
  });
  // progetto esecutivo
  Object.assign(DOCS, {
    X01: { p: 'Aggiornare la relazione generale e riepilogare le relazioni specialistiche dell\'esecutivo.', r: ['D36', 'CEI016', 'NTC'], b: x => DOCS.R01.b(x) + sec('Relazioni specialistiche dell\'esecutivo', ul(x.selected.filter(d => d.code[0] === 'X' && d.code !== 'X01').map(d => d.code + ' – ' + d.title))) },
    X02: { p: 'Dimensionare e verificare cavi, cadute di tensione e correnti di cortocircuito.', r: ['CEI648', 'IEC62548', 'CEI11_17'], b: x => {
      const e = x.e, ucc = 0.06, ikTr = e.transformer.n ? e.transformer.kva * 1000 / (Math.sqrt(3) * e.transformer.lv * ucc) : 0;
      let s = '';
      if (x.hasPv) s += sec('Cavi DC di stringa', `ΔV % = 2 · L · I · ρ / (S · V) · 100, con ρ Cu a 70 °C = 0,0216 Ω·mm²/m.\n\n` + kv([['Cavo', e.dcCable.type], ['L (una via) / I (Imp) / V (Vmp stringa)', `${e.dcCable.L} m / ${e.module.imp} A / ${n(e.Ns * e.module.vmp)} V`], ['Sezione', e.dcCable.S + ' mm²'], ['Caduta di tensione', n(e.dcCable.dv, 2) + ' %']]))
        + sec('Cavi AC BT', `ΔV % = √3 · L · I · ρ / (S · V) · 100 (cos φ = 1), ρ Al a 70 °C = 0,0345 Ω·mm²/m; portata ridotta all'80 % per posa e raggruppamento.\n\n` + kv([['Corrente di uscita inverter', n(e.acCable.I, 1) + ' A'], ['Sezione', `${e.acCable.par} × ${e.acCable.S} mm² Al (Iz ${e.acCable.Iz} A)`], ['Lunghezza', e.acCable.L + ' m'], ['Caduta di tensione', n(e.acCable.dv, 2) + ' %']]))
        + sec('Cortocircuito lato BT del trasformatore', `Ik = Sn / (√3 · U · ucc) = ${n(e.transformer.kva)} kVA / (√3 · ${e.transformer.lv} V · ${ucc * 100} %) ≈ **${n(ikTr / 1000, 1)} kA** (contributo della rete; da integrare con il contributo degli inverter). Potere di interruzione degli interruttori BT ≥ ${n(Math.ceil(ikTr / 1000 / 5) * 5)} kA.`);
      s += sec('Linea MT', kv([['Cavo', `${e.mvCable.type} 3×1×${e.mvCable.S} mm²`], ['Corrente di impiego', n(e.mvCable.I) + ' A (Iz ' + e.mvCable.Iz + ' A)'], ['Tenuta al cortocircuito', `S ≥ Icc · √t / K = ${n(e.mvCable.iccKa * 1000)} · √${n(e.mvCable.tFault, 2)} / 92 = ${n(e.mvCable.sMinSc)} mm²`], ['Contributo dell\'impianto al cortocircuito in MT', n(e.iscContribution) + ' A']]));
      return s + sec('Da completare', ul([todo('elenco cavi completo con percorsi reali'), todo('calcolo con software (es. per CEI 64-8 e IEC 60909) con i dati di rete forniti dal distributore')]));
    } },
    X03: { p: 'Verificare selettività e coordinamento delle protezioni BT e MT.', r: ['CEI016', 'CEI648'], b: x => sec('Livelli di protezione', tbl(['Livello', 'Dispositivo', 'Funzioni', 'Taratura'], [['Consegna (DG)', 'SPG', '50/51, 51N/67N', 'secondo regolamento del distributore'], ['Interfaccia (DDI)', 'SPI', '27, 59, 81, 59N', 'tabella sotto'], x.hasPv ? ['Montante trasformatore FV', 'Interruttore MT + relè', '50/51, 51N', todo('valori')] : null, x.b ? ['Montante trasformatore BESS', 'Interruttore MT + relè', '50/51, 51N', todo('valori')] : null, ['Partenze BT', 'Interruttori magnetotermici', 'L, S, I', todo('curve')], x.hasPv ? ['Stringhe', 'Fusibili gPV', 'sovracorrente inversa', todo('A')] : null].filter(Boolean)))
      + sec('Tarature SPI tipiche', tbl(['Codice', 'Funzione', 'Soglia', 'Tempo'], x.e.protections.filter(p => /^(27|59|81)/.test(p.code)).map(p => [p.code, p.fn, p.setting, p.time]))) + sec('Diagramma di selettività', todo('curve tempo-corrente MT/BT e verifica con la protezione del distributore')) },
    X04: { p: 'Calcolare strutture, fondazioni e basamenti secondo NTC 2018.', r: ['NTC'], b: x => sec('Azioni', tbl(['Azione', 'Dato', 'Riferimento'], [['Peso proprio moduli', x.hasPv ? n(x.e.module.weight / (x.e.module.length * x.e.module.width), 1) + ' kg/m²' : '–', 'Scheda modulo'], ['Neve', todo('qsk, zona e quota del sito'), 'NTC §3.4'], ['Vento', todo('vb, zona, categoria di esposizione'), 'NTC §3.3'], ['Sisma', todo('ag, F0, Tc*, categoria di sottosuolo'), 'NTC §3.2'], x.b && x.e.bess ? ['Peso unità BESS', n(x.e.bess.unit.weight / 1000, 1) + ' t', 'Scheda fornitore'] : null].filter(Boolean)))
      + sec('Verifiche da sviluppare', ul([x.hasPv && x.ground ? 'Pali infissi: portata a trazione (sollevamento del vento), compressione e carico laterale; verifica con prove di estrazione (R05)' : null, x.hasPv ? 'Struttura della tavola: arcarecci, traversi, collegamenti (SLU e SLE)' : null, x.hasPv && !x.ground ? 'Verifica della copertura esistente per i carichi aggiuntivi e la zavorra' : null, 'Basamenti di cabine e unità BESS: capacità portante e cedimenti', 'Ancoraggi antisismici delle apparecchiature'].filter(Boolean))) },
    X05: { p: 'Progettare l\'impianto di terra secondo CEI EN 50522.', r: ['CEI50522', 'CEI648'], b: x => {
      const A = Math.max(x.areaM2, 100), L = x.perim * 1.3 + (x.hasPv ? x.e.strings * 6 : 40), rho = 100, r = Math.sqrt(A / Math.PI), R = rho / (4 * r) + rho / L;
      return sec('Stima preliminare (formula di Laurent)', `R ≈ ρ / (4 · r) + ρ / L, con r = √(A/π) raggio equivalente della maglia e L lunghezza totale dei conduttori interrati.\n\n` + kv([['Resistività del terreno ρ', rho + ' Ω·m (ipotesi: ' + todo('misura Wenner') + ')'], ['Area della maglia A', n(A) + ' m²'], ['Lunghezza conduttori L', n(L) + ' m'], ['Resistenza di terra stimata', n(R, 2) + ' Ω']]))
        + sec('Verifiche', ul(['Tensioni di contatto e di passo con la corrente di guasto a terra e il tempo di eliminazione comunicati dal distributore', 'Collegamento della nuova maglia alla terra dello stabilimento (impianto unico)', 'Equipotenzialità di strutture, recinzione, unità BESS'])) + todo('corrente di guasto a terra e tempo di eliminazione dal distributore');
    } },
    X06: { p: 'Calcolare i campi elettromagnetici e le fasce di rispetto.', r: ['CEM'], b: x => DOCS.R11.b(x) + sec('Approfondimento esecutivo', ul(['Calcolo puntuale dell\'induzione magnetica con la configurazione reale di cavi e cabine', 'Rappresentazione delle fasce su planimetria', 'Verifica degli edifici e delle aree con permanenza prolungata'])) },
    X07: { p: 'Studiare il comportamento in rete e definire le tarature richieste dal gestore.', r: ['CEI016', 'TERNA', 'RFG'], b: x => sec('Requisiti di connessione', ul(['Capability P/Q e regolazione di tensione (curve di potenza reattiva)', 'Insensibilità agli abbassamenti di tensione (LVFRT/OVFRT)', 'Regolazione di potenza attiva in funzione della frequenza', 'Limitazione dell\'immissione a ' + (x.cfg.grid.zeroExport ? '0 kW' : n(x.cfg.grid.exportLimitKw) + ' kW') + ' tramite controllore centrale d\'impianto (CCI)', 'Telelettura e teledistacco secondo il regolamento di esercizio']))
      + sec('Tarature', tbl(['Codice', 'Funzione', 'Soglia', 'Tempo'], x.e.protections.map(p => [p.code, p.fn, p.setting, p.time]))) + sec('Studio di rete', todo('load flow e cortocircuito con i dati di rete del distributore; per connessioni AT, studi richiesti dal Codice di Rete Terna')) },
    X08: { p: 'Progettare i sistemi antincendio dell\'area BESS.', r: ['VVF', 'DPR151', 'IEC_B'], b: x => DOCS.R14.b(x) + sec('Progetto dei sistemi', tbl(['Sistema', 'Prestazione', 'Da definire'], [['Rivelazione fumo e gas', 'Allarme e interblocchi su PCS/HVAC', todo('tipo di sensori e soglie')], ['Estinzione', 'Secondo i test UL 9540A del fornitore', todo('agente e quantità')], ['Deflagration venting / ventilazione', 'Evitare concentrazioni esplosive', todo('superfici di sfogo o portata')], ['Idranti / riserva idrica', 'Raffreddamento e protezione delle unità adiacenti', todo('portata, durata, volume')], ['Contenimento acque di spegnimento', 'Vasca o area cordolata', todo('volume')]])) },
    X09: { p: 'Raccogliere e verificare i test report UL 9540A forniti dal costruttore del BESS.', r: ['IEC_B', 'VVF'], b: x => sec('Documenti richiesti al fornitore', tbl(['Livello', 'Documento', 'Ricevuto'], [['Cella', 'Report UL 9540A cell level (temperatura di venting e di thermal runaway, composizione gas)', '☐'], ['Modulo', 'Report UL 9540A module level', '☐'], ['Unità', 'Report UL 9540A unit level (propagazione, distanze)', '☐'], ['Installazione', 'Report installation level se richiesto', '☐'], ['Prodotto', 'Certificati IEC 62619, IEC 62933-5-2, UL 9540', '☐']]))
      + sec('Verifiche', ul(['Coerenza tra configurazione testata e configurazione installata (' + (x.e.bess ? x.e.bess.unit.name : 'unità') + ')', 'Distanze di installazione compatibili con i risultati della prova a livello di unità', 'Laboratorio accreditato e data del report'])) },
    X10: { p: 'Valutare la compatibilità elettromagnetica dei sistemi.', r: ['EMC'], b: x => sec('Contenuti', ul(['Dichiarazioni di conformità EMC di inverter, PCS, EMS', 'Emissioni condotte e irradiate verso i sistemi di stabilimento e le telecomunicazioni', 'Segregazione dei cavi di potenza e di segnale, schermature, filtri', 'Armoniche immesse in rete (limiti CEI 0-16)', x.b ? 'Interazione PCS BESS – inverter FV – carichi dello stabilimento' : null].filter(Boolean))) },
    D01: tav('Scala 1:500 – 1:1.000', x => [x.hasPv ? 'Disposizione delle tavole con numerazione stringhe e assegnazione agli inverter' : null, 'Posizione inverter/PCS, quadri e MV skid', 'Percorsi principali dei cavi'].filter(Boolean), x => x.hasPv ? kv([['Stringhe per inverter', x.e.spInv], ['Stringhe per MPPT', x.e.spMppt], ['Inverter', x.e.nInv]]) : ''),
    D02: { p: 'Schemi unifilari e multifilari BT/MT/AT.', r: ['CEI016', 'CEI648'], b: x => DOCS.T05.b(x) + sec('Contenuti di dettaglio', ul(['Unifilare MT con scomparti, TA/TV, relè', 'Unifilari BT di quadri inverter e servizi ausiliari', x.b ? 'Unifilare BESS con PCS, trasformatore e servizi ausiliari HVAC' : null, 'Multifilari dei circuiti di misura e protezione'].filter(Boolean))) },
    D03: tav('Formato A3, schemi funzionali', () => ['Schemi di comando e interblocco di DG e DDI', 'Logica di rincalzo del DDI', 'Circuiti di scatto e segnalazione', 'Interblocchi BESS (antincendio → PCS/HVAC)']),
    D04: tav('Scala 1:1.000 e sezioni 1:20', () => ['Percorsi cavi DC, BT, MT e segnale', 'Sezioni di scavo tipo con distanze tra le terne', 'Pozzetti, attraversamenti, nastro di segnalazione'], x => kv(quantities(x).filter(q => q[2] === 'm').map(q => [q[1], n(q[3]) + ' ' + q[2]]))),
    D05: tav('Scala 1:20 – 1:10', () => ['Carpenterie delle tavole e dei basamenti', 'Particolari di ancoraggio e messa a terra', 'Particolari di recinzione e cancelli']),
    D06: { p: 'Architettura di SCADA, EMS/PPC, monitoraggio e telecomunicazioni.', r: ['CYB', 'CEI016'], b: x => sec('Architettura', '```mermaid\nflowchart LR\n  SCADA["SCADA / EMS<br/>server di impianto"] --- SW["Rete di impianto<br/>fibra ottica ad anello"]\n' + (x.hasPv ? '  SW --- INV["Inverter (Modbus TCP)"]\n' : '') + (x.b ? '  SW --- BMS["BMS / PCS (Modbus TCP / IEC 61850)"]\n' : '') + '  SW --- CCI["CCI / PPC"]\n  SW --- MET["Stazione meteo"]\n  SW --- PRO["Relè SPG/SPI (IEC 61850)"]\n  SCADA --- FW["Firewall / VPN"] --- REM["Telecontrollo O&M, distributore"]\n```\n')
      + sec('Requisiti', ul(['Acquisizione dati ogni 1–15 minuti, archivio storico', 'Logiche EMS: ' + (x.b ? ['selfConsumption', 'arbitrage', 'peakShaving'].filter(k => x.cfg.bess.strategy[k]).join(', ') : 'limitazione dell\'immissione'), 'Cybersecurity secondo IEC 62443, segregazione dalla rete dello stabilimento'])) },
    D07: tav('Scala 1:50', () => ['Pianta e sezioni della cabina di consegna/utente', 'Disposizione degli scomparti MT', 'Opere civili, vasca olio, aerazione, accessi'], x => kv([['Tensione', x.cfg.grid.voltageKv + ' kV'], ['Nuovo scomparto', 'Partenza impianto con DDI e SPI']])),
    D08: tav('Formato A1', x => [x.b ? 'HVAC delle unità BESS e alimentazione ausiliari' : null, 'Illuminazione perimetrale e di cabina', 'TVCC e antintrusione', 'Servizi ausiliari in BT e UPS'].filter(Boolean), x => kv([['Ausiliari BESS (energia annua)', x.b ? n(x.y.aux / 1000, 1) + ' MWh/a' : '–']])),
    C01: { p: 'Computare quantità e importi delle lavorazioni e forniture.', r: [], b: x => sec('Quantità principali (stima dal progetto)', tbl(['Codice', 'Descrizione', 'U.m.', 'Quantità'], quantities(x).map(q => [q[0], q[1], q[2], n(q[3])]), ['', '', '', 'r'])) + sec('Importi per voce', tbl(['Gruppo', 'Voce', 'Prezzo unitario', 'Quantità', 'Importo €'], capexRows(x).concat([['', '**Totale**', '', '', '**' + n(x.c.total) + '**']]), ['', '', 'r', 'r', 'r'])) + todo('computo di dettaglio con prezzario regionale o analisi prezzi (C02)') },
    C02: { p: 'Elencare i prezzi unitari e le relative analisi.', r: [], b: x => sec('Elenco prezzi unitari', tbl(['Codice', 'Voce', 'Prezzo', 'Unità', 'Fonte'], x.c.rows.filter(r => r.unit !== '%').map((r, i) => [`EP.${String(i + 1).padStart(2, '0')}`, r.label, n(r.unitValue), r.unit, 'Benchmark 2026 (A2)']), ['', '', 'r', '', '']))
      + sec('Analisi prezzi (schema)', tbl(['Componente', 'Quota tipica'], [['Materiali e forniture', '%'], ['Manodopera', '%'], ['Noli e trasporti', '%'], ['Spese generali (13–17 %)', '%'], ['Utile d\'impresa (10 %)', '%']])) + todo('analisi prezzi per le voci non presenti nel prezzario di riferimento') },
    C03: { p: 'Riportare il quadro economico e l\'incidenza della manodopera.', r: ['D36'], b: x => {
      const lab = { mnt: 0.85, civ: 0.45, sec: 0.35, civb: 0.6, bos: 0.25, mv: 0.15, str: 0.1, mod: 0.02, inv: 0.02, dc: 0.02, pcs: 0.02, mvb: 0.15, ems: 0.3, safe: 0.3 };
      const rows = x.c.rows.filter(r => lab[r.id] !== undefined && r.total > 0), tot = rows.reduce((a, r) => a + r.total, 0), mo = rows.reduce((a, r) => a + r.total * lab[r.id], 0);
      return DOCS.E02.b(x) + sec('Incidenza della manodopera (stima)', tbl(['Voce', 'Importo €', 'Incidenza', 'Manodopera €'], rows.map(r => [r.label, n(r.total), pc(lab[r.id], 0), n(r.total * lab[r.id])]).concat([['**Totale lavori e forniture**', n(tot), pc(mo / tot), '**' + n(mo) + '**']]), ['', 'r', 'r', 'r']));
    } },
    C04: { p: 'Definire le condizioni contrattuali e tecniche dell\'appalto.', r: ['D36', 'D81', 'CAM'], b: x => sec('Indice', ul(['Parte I – Disposizioni amministrative: oggetto, importo, modalità di pagamento (SAL), penali, garanzie, subappalto, collaudo', 'Parte II – Prescrizioni tecniche: qualità dei materiali, modalità di esecuzione, norme di misurazione', 'Garanzie di prestazione: ' + (x.hasPv ? 'PR e potenza installata; ' : '') + (x.b ? 'capacità, RTE, SOH del BESS; ' : '') + 'disponibilità', 'Documentazione as-built e manuali', 'Formazione del personale'])) + todo('testo completo del capitolato') },
    C05: { p: 'Specificare i requisiti tecnici dei componenti principali.', r: ['IEC_B', 'TRF', 'IEC62548'], b: x => {
      const e = x.e; let s = '';
      if (x.hasPv) s += sec('Moduli fotovoltaici', kv([['Tecnologia', e.module.name], ['Potenza nominale', e.module.pmax + ' Wp (tolleranza solo positiva)'], ['Voc / Vmp / Isc / Imp', `${e.module.voc} V / ${e.module.vmp} V / ${e.module.isc} A / ${e.module.imp} A`], ['Coefficienti termici', `βVoc ${e.module.betaVoc} %/°C, γP ${e.module.gammaP} %/°C`], ['Certificazioni', 'IEC 61215, IEC 61730, PID, ammoniaca e nebbia salina se pertinente'], ['Garanzie', 'prodotto ≥ 12 anni; potenza ≥ 87 % a 30 anni (indicativo)']]))
        + sec('Inverter', kv([['Tipo', e.inverter.name], ['Vdc max / MPPT', `${e.inverter.vdcMax} V / ${e.inverter.mpptMin}–${e.inverter.mpptMax} V`], ['Ingressi', `${e.inverter.nMppt} MPPT × ${e.inverter.stringsPerMppt} stringhe`], ['Rendimento max', n(e.inverter.eff * 100, 1) + ' %'], ['Conformità', 'CEI 0-16 Allegato N, IEC 62109-1/-2']]));
      if (x.b && e.bess) s += sec('Sistema di accumulo', kv([['Unità', e.bess.unit.name], ['Energia / potenza', `${n(x.cfg.bess.kwh)} kWh / ${n(x.cfg.bess.kw)} kW`], ['RTE AC-AC', '≥ ' + x.cfg.bess.rte + ' %'], ['Vita utile', '≥ 6.000 cicli all\'80 % di SOH (indicativo)'], ['Sicurezza', 'IEC 62619, IEC 62933-5-2, UL 9540, UL 9540A, rivelazione gas'], ['Regolamento batterie', 'Passaporto e impronta di carbonio secondo Reg. UE 2023/1542']]));
      s += sec('Trasformatori MT/BT', kv([['Potenza', (x.hasPv ? `FV ${e.transformer.n} × ${n(e.transformer.kva)} kVA` : '') + (x.b && e.bess ? ` BESS ${e.bess.nTr} × ${n(e.bess.trKva)} kVA` : '')], ['Tensioni', `${x.cfg.grid.voltageKv} kV / ${x.hasPv ? e.inverter.vac : 400} V, Dyn11`], ['Perdite', 'conformi al Reg. UE 548/2014 (Tier 2)'], ['Isolamento', todo('olio vegetale o resina')]]));
      return s;
    } },
    C06: { p: 'Programmare in dettaglio le lavorazioni.', r: [], b: x => sec('Cronoprogramma esecutivo', gantt(x, true)) },
    C07: { p: 'Piano di sicurezza e coordinamento e fascicolo dell\'opera.', r: ['D81'], b: x => DOCS.E04.b(x) + sec('Contenuti del PSC (Allegato XV D.Lgs. 81/2008)', ul(['Anagrafica e organizzazione del cantiere', 'Analisi dei rischi per fasi e interferenze', 'Misure di coordinamento e uso comune di apprestamenti', 'Costi della sicurezza', 'Gestione delle emergenze'])) + sec('Fascicolo dell\'opera', ul(['Schede degli interventi di manutenzione in sicurezza', 'Misure preventive in esercizio (accessi, linee vita, distanze dalle parti attive)'])) },
    C08: { p: 'Piano di manutenzione dell\'opera: manuale d\'uso, manuale di manutenzione, programma.', r: ['D36'], b: x => sec('Manuale d\'uso', ul(['Descrizione dell\'impianto e dei modi di funzionamento', 'Procedure di avviamento, arresto e messa in sicurezza', x.b ? 'Procedure di emergenza BESS' : null].filter(Boolean))) + DOCS.R15.b(x) },
    C09: { p: 'Pianificare prove in fabbrica, in sito e prestazionali.', r: ['IEC62446', 'CEI016', 'IEC_B'], b: x => sec('Prove', tbl(['Fase', 'Prova', 'Criterio di accettazione'], [].concat(
      [['FAT', 'Quadri MT/BT, trasformatori (prove di routine)', 'Norme di prodotto']], x.b ? [['FAT', 'Unità BESS e PCS: funzionali, BMS, sicurezza', 'Specifica C05']] : [],
      x.hasPv ? [['SAT', 'Stringhe: Voc, Isc, isolamento, polarità (IEC 62446-1)', 'Scostamento ≤ 5 % dal valore atteso'], ['SAT', 'Termografia dei moduli', 'Nessun hot spot critico']] : [],
      [['SAT', 'Verifiche CEI 0-16: SPI, DDI, rincalzo, CCI', 'Regolamento di esercizio'], ['SAT', 'Impianto di terra', 'Resistenza e tensioni di contatto conformi (X05)']],
      x.hasPv ? [['Performance test', 'PR su 7–30 giorni corretto per temperatura', 'PR ≥ ' + pc(Math.max(0.75, x.k.pr - 0.04))]] : [],
      x.b ? [['Prova di capacità BESS', 'Scarica a potenza nominale dal 100 % al minimo SOC', '≥ ' + n(x.cfg.bess.kwh * x.cfg.bess.dod / 100) + ' kWh'], ['Prova di efficienza BESS', 'Ciclo completo carica-scarica', 'RTE ≥ ' + x.cfg.bess.rte + ' %'], ['Prova funzionale EMS', 'Autoconsumo, arbitraggio, peak shaving, limite di immissione', 'Logiche conformi a R04']] : []))) }
  });

  function render(x, d) {
    const spec = DOCS[d.code];
    let md = header(x, d);
    if (!spec) return md + todo('contenuto dell\'elaborato');
    md += sec('Scopo', spec.p);
    if (spec.r && spec.r.length) md += sec('Riferimenti normativi', blkNorme(spec.r));
    md += spec.b(x);
    if (d.status === 'optional') md += '\n> Elaborato "se pertinente": incluso per scelta dell\'utente.\n';
    return md;
  }

  // ---------- 3. generazione ----------
  // opts: { phase, config, procedure, selected: [codici] (default: preselezione), prefix, rev, date }
  function generate(cfgIn, opts) {
    const list = prepare(opts), warnings = [];
    const sel = opts.selected ? list.filter(d => opts.selected.includes(d.code) && d.status !== 'na') : list.filter(d => d.selected);
    const bad = (opts.selected || []).filter(c => { const d = list.find(z => z.code === c); return !d || d.status === 'na'; });
    if (bad.length) warnings.push('Esclusi perché non applicabili alla fase o alla configurazione: ' + bad.join(', '));
    const v = variantConfig(cfgIn, opts.config); warnings.push(...v.warnings);
    const R = F.simulate(v.cfg);
    const x = ctxOf(v.cfg, R, Object.assign({}, opts, { selected: sel, excluded: list.filter(d => !sel.includes(d)) }));
    const files = sel.map(d => ({ code: d.code, title: d.title, name: `${d.code}_${slug(d.title)}.md`, md: render(x, d) }));
    const idx = `# Elenco elaborati – ${x.cfg.project.name}\n\n` + kv([['Fase', phaseLabel(x)], ['Configurazione', CONFIGS[opts.config]], ['Procedura', PROCEDURES[opts.procedure] || '–'], ['Data', x.date], ['Elaborati generati', files.length]]) +
      '\n' + tbl(['Codice', 'Elaborato', 'File'], files.map(f => [`${x.prefix}-${PHASES[opts.phase].short}-${f.code}`, f.title, `[${f.name}](${f.name})`])) +
      (warnings.length ? '\n## Avvisi\n\n' + ul(warnings) : '') + '\n> Bozze generate dal simulatore FV + BESS: da completare nelle parti [DA COMPLETARE] e da verificare da un tecnico abilitato.\n';
    files.unshift({ code: '00', title: 'Indice', name: '00_Indice.md', md: idx });
    return { files, warnings, folder: `Elaborati_${PHASES[opts.phase].short}_${opts.config}_${x.date}` };
  }

  // ---------- ZIP (senza compressione) ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function utf8(s) { return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Uint8Array.from(Buffer.from(s, 'utf8')); }
  function zip(files, folder) {
    const parts = [], central = []; let off = 0;
    const u16 = v => [v & 255, (v >>> 8) & 255], u32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
    for (const f of files) {
      const name = utf8((folder ? folder + '/' : '') + f.name), data = utf8(f.md), crc = crc32(data);
      const head = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      parts.push(Uint8Array.from(head), name, data);
      central.push(Uint8Array.from([].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off))), name);
      off += head.length + name.length + data.length;
    }
    const csize = central.reduce((a, p) => a + p.length, 0);
    const end = Uint8Array.from([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(csize), u32(off), u16(0)));
    const all = parts.concat(central, [end]), out = new Uint8Array(all.reduce((a, p) => a + p.length, 0)); let p = 0;
    for (const a of all) { out.set(a, p); p += a.length; }
    return out;
  }

  return { PHASES, CONFIGS, PROCEDURES, CATALOG, prepare, generate, variantConfig, zip, crc32 };
});
