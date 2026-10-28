/* Interfaccia del simulatore: form di input, esecuzione, schede risultati. */
(function () {
  'use strict';
  const F = window.FVB, D = window.FVB_DATA, C = window.FVB_CHARTS, fmt = C.fmt, esc = C.esc;
  const STORE = 'fvb-cfg-v1';
  const MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  const $ = s => document.querySelector(s);
  const get = (o, p) => p.split('.').reduce((a, k) => a == null ? a : a[k], o);
  const set = (o, p, v) => { const ks = p.split('.'); let a = o; ks.slice(0, -1).forEach(k => { a = a[k]; }); a[ks[ks.length - 1]] = v; };
  const kE = v => fmt(v / 1000) + ' k€';
  const pct = (v, d) => v === null || v === undefined ? '–' : fmt(v * 100, d === undefined ? 1 : d) + ' %';
  const opt = obj => Object.keys(obj).map(k => [k, obj[k].name]);

  let cfg = load(), R = null, Rpv = null, SENS = null, tab = 'sintesi', timer = null;
  function load() {
    try { const s = localStorage.getItem(STORE); if (s) return F.normalizeConfig(JSON.parse(s)); } catch (e) { /* archivio non disponibile */ }
    return F.defaultConfig();
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(cfg)); } catch (e) { /* ignora */ } }

  // ---------- schema dei campi ----------
  const MOUNTS = [['ground_fixed', 'A terra, struttura fissa'], ['tracker', 'A terra, tracker monoassiale N-S'], ['roof_tilted', 'Copertura a falda / inclinata'], ['roof_ew', 'Copertura piana est-ovest']];
  const SECTIONS = [
    { id: 'site', title: 'Sito e consumi', open: true, f: [
      ['project.name', 'Nome progetto', 'text'],
      ['project.site', 'Località (meteo e zona di mercato)', 'select', opt(D.SITES)],
      ['load.annualMWh', 'Consumo annuo', 'number', 'MWh/a', 100, 500000, 100],
      ['load.profile', 'Organizzazione dei turni', 'select', opt(D.LOAD_PROFILES)],
      ['load.augustShutdownWeeks', 'Fermata estiva', 'number', 'settimane', 0, 4, 1],
      ['load.christmasShutdown', 'Fermata natalizia', 'check'],
      ['load.seasonal', 'Stagionalità (+ = picco estivo)', 'number', 'frazione', -0.3, 0.3, 0.01],
      ['#loadcsv', 'Curva di carico misurata (CSV)', 'file']
    ] },
    { id: 'pv', title: 'Impianto fotovoltaico', open: true, f: [
      ['pv.kwp', 'Potenza DC', 'number', 'kWp', 10, 50000, 10],
      ['pv.mount', 'Tipologia di installazione', 'select', MOUNTS],
      ['pv.tilt', 'Inclinazione moduli', 'number', '°', 0, 60, 1],
      ['pv.azimuth', 'Azimut (0 = sud, + ovest)', 'number', '°', -90, 90, 1],
      ['pv.gcr', 'Ground coverage ratio', 'number', '–', 0.2, 0.8, 0.01],
      ['pv.dcac', 'Rapporto DC/AC', 'number', '–', 1, 1.5, 0.01],
      ['pv.module', 'Modulo', 'select', opt(D.MODULES)],
      ['pv.inverter', 'Inverter', 'select', opt(D.INVERTERS)],
      ['pv.bifacial', 'Guadagno bifacciale (solo a terra)', 'check'],
      ['pv.albedo', 'Albedo del terreno', 'number', '–', 0.1, 0.8, 0.01],
      ['§', 'Perdite e degrado'],
      ['pv.losses.soiling', 'Sporcamento', 'number', '%', 0, 10, 0.1],
      ['pv.losses.shading', 'Ombreggiamento', 'number', '%', 0, 15, 0.1],
      ['pv.losses.mismatch', 'Mismatch', 'number', '%', 0, 5, 0.1],
      ['pv.losses.dcCable', 'Cavi DC', 'number', '%', 0, 5, 0.1],
      ['pv.losses.acCable', 'Cavi AC', 'number', '%', 0, 5, 0.1],
      ['pv.losses.transformer', 'Trasformatore', 'number', '%', 0, 3, 0.1],
      ['pv.losses.availability', 'Disponibilità', 'number', '%', 90, 100, 0.1],
      ['pv.degrFirst', 'Degrado primo anno (incl. LID)', 'number', '%', 0, 3, 0.1],
      ['pv.degrAnnual', 'Degrado annuo', 'number', '%/a', 0, 1.5, 0.05]
    ] },
    { id: 'bess', title: 'Sistema di accumulo (BESS)', open: true, f: [
      ['bess.enabled', 'BESS presente', 'check'],
      ['bess.kwh', 'Energia nominale', 'number', 'kWh', 0, 200000, 50],
      ['bess.kw', 'Potenza PCS', 'number', 'kW', 0, 100000, 50],
      ['bess.unit', 'Unità di accumulo', 'select', opt(D.BESS_UNITS)],
      ['bess.rte', 'Rendimento round-trip AC', 'number', '%', 70, 98, 0.5],
      ['bess.dod', 'Profondità di scarica utile', 'number', '%', 50, 100, 1],
      ['bess.auxPct', 'Ausiliari (HVAC, BMS)', 'number', '% cap./giorno', 0, 3, 0.1],
      ['bess.calendarDeg', 'Degrado calendario', 'number', '%/a', 0, 4, 0.1],
      ['bess.cycleDegPer1000', 'Degrado per 1000 cicli', 'number', '%', 0, 10, 0.1],
      ['bess.augmentation', 'Augmentation programmata', 'check'],
      ['bess.augmentSoh', 'Soglia SOH per augmentation', 'number', '%', 50, 95, 1],
      ['bess.eolSoh', 'Fine vita (senza augmentation)', 'number', '%', 50, 90, 1],
      ['§', 'Strategia EMS'],
      ['bess.strategy.selfConsumption', 'Autoconsumo FV', 'check'],
      ['bess.strategy.arbitrage', 'Arbitraggio (carica notturna da rete)', 'check'],
      ['bess.strategy.arbitrageMinSpread', 'Spread minimo arbitraggio', 'number', '€/MWh', 0, 200, 5],
      ['bess.strategy.peakShaving', 'Peak shaving', 'check'],
      ['bess.strategy.peakLimitKw', 'Soglia di prelievo', 'number', 'kW', 0, 100000, 50],
      ['bess.strategy.reserveSoc', 'Riserva SOC per peak shaving', 'number', '%', 0, 90, 5],
      ['bess.strategy.maxCyclesDay', 'Cicli massimi al giorno', 'number', 'n', 0.5, 3, 0.1]
    ] },
    { id: 'grid', title: 'Connessione alla rete', f: [
      ['grid.voltageKv', 'Tensione di consegna', 'number', 'kV', 10, 36, 1],
      ['grid.importLimitKw', 'Potenza disponibile in prelievo', 'number', 'kW', 0, 100000, 50],
      ['grid.exportLimitKw', 'Potenza in immissione', 'number', 'kW', 0, 100000, 50],
      ['grid.zeroExport', 'Immissione zero', 'check'],
      ['grid.iccKa', 'Corrente di cortocircuito di rete MT', 'number', 'kA', 1, 25, 0.5],
      ['grid.tFaultS', 'Tempo di eliminazione del guasto', 'number', 's', 0.1, 1, 0.05]
    ] },
    { id: 'prices', title: 'Prezzi dell\'energia', f: [
      ['prices.pun', 'PUN medio anno 1', 'number', '€/MWh', 20, 400, 1],
      ['prices.escalation', 'Variazione annua prezzi', 'number', '%/a', -5, 8, 0.1],
      ['prices.lossFactor', 'Perdite di rete in prelievo', 'number', '%', 0, 15, 0.1],
      ['prices.supplierSpread', 'Spread del fornitore', 'number', '€/MWh', 0, 50, 0.5],
      ['prices.chargesVar', 'Oneri di rete e di sistema variabili', 'number', '€/MWh', 0, 120, 0.5],
      ['prices.excise', 'Accise', 'number', '€/MWh', 0, 25, 0.1],
      ['prices.powerChargeKwYear', 'Quota potenza', 'number', '€/kW·a', 0, 120, 1],
      ['prices.exportFactor', 'Prezzo di cessione / prezzo zonale', 'number', '–', 0.5, 1.2, 0.01],
      ['prices.ridFee', 'Corrispettivi GSE sulla cessione', 'number', '€/MWh', 0, 5, 0.1],
      ['#puncsv', 'PUN orario (CSV)', 'file']
    ] },
    { id: 'opex', title: 'Costi operativi', f: [
      ['opex.pvOmKwp', 'O&M fotovoltaico', 'number', '€/kWp·a', 0, 40, 0.5],
      ['opex.securityKwp', 'Vigilanza (solo a terra)', 'number', '€/kWp·a', 0, 10, 0.5],
      ['opex.bessOmKwh', 'O&M BESS', 'number', '€/kWh·a', 0, 20, 0.5],
      ['opex.insurancePct', 'Assicurazione', 'number', '% CAPEX', 0, 2, 0.05],
      ['opex.imuEur', 'IMU e tributi', 'number', '€/a', 0, 200000, 500],
      ['opex.landLeaseEur', 'Diritto di superficie / affitto', 'number', '€/a', 0, 500000, 500],
      ['opex.monitoringEur', 'Monitoraggio e telecontrollo', 'number', '€/a', 0, 50000, 500],
      ['opex.adminEur', 'Gestione e pratiche', 'number', '€/a', 0, 50000, 500],
      ['opex.inflation', 'Inflazione costi', 'number', '%/a', 0, 6, 0.1],
      ['opex.inverterReplYear', 'Sostituzione inverter all\'anno', 'number', 'anno', 0, 30, 1],
      ['opex.inverterReplKw', 'Costo sostituzione inverter', 'number', '€/kWac', 0, 100, 1],
      ['opex.augmentCostKwh', 'Costo augmentation (oggi)', 'number', '€/kWh', 0, 300, 5],
      ['opex.costDeclineBess', 'Calo reale prezzo batterie', 'number', '%/a', 0, 10, 0.5],
      ['opex.decommEurKwp', 'Dismissione a fine vita', 'number', '€/kWp', 0, 80, 1]
    ] },
    { id: 'fin', title: 'Finanza e fisco', f: [
      ['finance.years', 'Orizzonte di analisi', 'number', 'anni', 10, 35, 1],
      ['finance.wacc', 'WACC nominale', 'number', '%', 2, 15, 0.1],
      ['finance.ke', 'Costo del capitale proprio', 'number', '%', 2, 20, 0.1],
      ['finance.debtPct', 'Quota a debito', 'number', '% CAPEX', 0, 90, 1],
      ['finance.debtRate', 'Tasso del finanziamento', 'number', '%', 0, 12, 0.05],
      ['finance.debtTenor', 'Durata del finanziamento', 'number', 'anni', 1, 20, 1],
      ['finance.ires', 'IRES', 'number', '%', 0, 30, 0.1],
      ['finance.irap', 'IRAP', 'number', '%', 0, 6, 0.01],
      ['finance.deprPv', 'Aliquota ammortamento FV', 'number', '%/a', 1, 30, 0.5],
      ['finance.deprBess', 'Aliquota ammortamento BESS', 'number', '%/a', 1, 30, 0.5],
      ['finance.halfFirstYear', 'Primo anno ad aliquota dimezzata', 'check'],
      ['finance.taxCapacity', 'Capienza fiscale del gruppo', 'check'],
      ['finance.residualPct', 'Valore residuo', 'number', '% CAPEX', 0, 30, 1]
    ] }
  ];

  function buildInputs() {
    const box = $('#inputs'); box.innerHTML = '';
    for (const s of SECTIONS) {
      const d = document.createElement('details'); d.className = 'sec'; d.open = !!s.open;
      let h = `<summary>${esc(s.title)}</summary><div class="fields">`;
      for (const f of s.f) {
        const [path, label, type, unit, min, max, step] = f, id = 'in-' + path.replace(/[.#]/g, '_');
        if (path === '§') { h += `<div class="sub">${esc(label)}</div>`; continue; }
        if (type === 'file') { h += `<label class="full" for="${id}">${esc(label)} <small>8760 valori orari (kW o €/MWh) o 35 040 quartorari; un valore per riga o separati da ;</small></label><input class="full" type="file" id="${id}" accept=".csv,.txt" data-kind="${path}"><div class="full hint" id="${id}-st"></div>`; continue; }
        h += `<label for="${id}">${esc(label)}${unit && type === 'number' ? ` <small>${esc(unit)}</small>` : ''}</label>`;
        if (type === 'select') h += `<select id="${id}" data-path="${path}">${f[3].map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select>`;
        else if (type === 'check') h += `<input type="checkbox" id="${id}" data-path="${path}">`;
        else if (type === 'text') h += `<input type="text" id="${id}" data-path="${path}">`;
        else h += `<input type="number" id="${id}" data-path="${path}" min="${min}" max="${max}" step="${step}">`;
      }
      d.innerHTML = h + '</div>'; box.appendChild(d);
    }
    box.addEventListener('change', onInput); box.addEventListener('input', e => { if (e.target.type === 'number' || e.target.type === 'text') onInput(e); });
    fillInputs();
  }
  function fillInputs() {
    document.querySelectorAll('[data-path]').forEach(el => {
      const v = get(cfg, el.dataset.path);
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
    });
    $('#in-_loadcsv-st').textContent = Array.isArray(cfg.load.custom) ? 'Curva misurata in uso (' + fmt(cfg.load.custom.reduce((a, b) => a + b, 0) / 1000) + ' MWh/a). Il consumo annuo e i turni sono ignorati.' : 'Curva sintetica dai turni.';
    $('#in-_puncsv-st').textContent = Array.isArray(cfg.prices.customPun) ? 'PUN orario caricato (media ' + fmt(cfg.prices.customPun.reduce((a, b) => a + b, 0) / cfg.prices.customPun.length, 1) + ' €/MWh).' : 'Profilo orario sintetico tarato sul PUN medio.';
    syncVisibility();
  }
  function syncVisibility() {
    const roof = cfg.pv.mount.startsWith('roof'), tr = cfg.pv.mount === 'tracker';
    const vis = { 'pv.gcr': !roof, 'pv.bifacial': !roof, 'pv.albedo': !roof, 'pv.azimuth': !tr && cfg.pv.mount !== 'roof_ew', 'pv.tilt': !tr };
    for (const p in vis) { const el = document.querySelector(`[data-path="${p}"]`); if (el) { el.hidden = !vis[p]; el.previousElementSibling.hidden = !vis[p]; } }
  }
  function onInput(e) {
    const el = e.target;
    if (el.dataset.kind) return readCsv(el);
    if (!el.dataset.path) return;
    let v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? parseFloat(el.value) : el.value;
    if (el.type === 'number' && !isFinite(v)) return;
    set(cfg, el.dataset.path, v);
    if (el.dataset.path === 'pv.mount') { const mc = D.MOUNT_CAPEX[v] || {}; cfg.capex.pv.forEach(it => { if (it.id in mc) it.value = mc[it.id]; }); if (v === 'roof_ew') cfg.pv.tilt = 10; else if (v === 'roof_tilted') { cfg.pv.tilt = 15; cfg.pv.bifacial = false; } else if (v === 'ground_fixed' && cfg.pv.tilt < 15) cfg.pv.tilt = 25; fillInputs(); }
    if (el.dataset.path === 'pv.module' || el.dataset.path === 'pv.inverter') fillInputs();
    if (el.dataset.path === 'project.name') $('#projTitle').textContent = v || 'Simulatore FV + BESS industriale';
    syncVisibility(); schedule();
  }
  function readCsv(el) {
    const f = el.files && el.files[0]; if (!f) return;
    const st = $('#' + el.id + '-st'), rd = new FileReader();
    rd.onload = () => {
      const vals = [];
      for (const raw of String(rd.result).split(/\r?\n/)) {
        const line = raw.trim(); if (!line) continue;
        let parts;
        if (/[;\t]/.test(line)) parts = line.split(/[;\t]/).map(x => x.replace(',', '.'));
        else if ((line.match(/,/g) || []).length === 1 && line.indexOf('.') < 0) parts = [line.replace(',', '.')];
        else parts = line.split(',');
        const v = parseFloat(parts[parts.length - 1]); if (isFinite(v)) vals.push(v);
      }
      let arr = null;
      if (vals.length >= 35040) { arr = []; for (let i = 0; i < 8760; i++) arr.push((vals[4 * i] + vals[4 * i + 1] + vals[4 * i + 2] + vals[4 * i + 3]) / 4); }
      else if (vals.length >= 8760) arr = vals.slice(0, 8760);
      if (!arr) { st.textContent = 'Il file contiene ' + vals.length + ' valori numerici: ne servono 8760 (orari) o 35 040 (quartorari).'; return; }
      if (el.dataset.kind === '#loadcsv') cfg.load.custom = arr; else cfg.prices.customPun = arr;
      fillInputs(); schedule();
    };
    rd.readAsText(f);
  }

  // ---------- esecuzione ----------
  function schedule() { clearTimeout(timer); document.querySelector('main').classList.add('busy'); timer = setTimeout(run, 350); }
  function run() {
    try {
      R = F.simulate(cfg);
      Rpv = cfg.bess.enabled ? F.simulate(Object.assign(F.normalizeConfig(cfg), { bess: Object.assign({}, cfg.bess, { enabled: false }) })) : null;
      SENS = null; if (docState.gen) { docState.gen = null; } save(); render(); // i documenti generati non seguono più i dati
    } catch (err) { $('#panels').innerHTML = `<div class="card note">Errore di calcolo: ${esc(err.message)}. Controlla i dati inseriti o ripristina l'esempio.</div>`; console.error(err); }
    document.querySelector('main').classList.remove('busy');
  }

  // ---------- schede ----------
  const TABS = [['sintesi', 'Sintesi'], ['energia', 'Energia'], ['bess', 'Accumulo'], ['economia', 'Economia'], ['capex', 'CAPEX'], ['incentivi', 'Incentivi'], ['sensitivita', 'Sensitività'], ['ingegneria', 'Ingegneria'], ['elaborati', 'Elaborati'], ['relazione', 'Relazione']];
  function buildTabs() {
    $('#tabs').innerHTML = TABS.map(([k, t]) => `<button role="tab" type="button" id="tab-${k}" data-tab="${k}" aria-selected="${k === tab}">${t}</button>`).join('');
    $('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; try { localStorage.setItem(STORE + '-tab', tab); } catch (x) { /* ignora */ } document.querySelectorAll('#tabs button').forEach(x => x.setAttribute('aria-selected', x.dataset.tab === tab)); render(); });
  }
  function render() {
    if (!R) return;
    const P = { sintesi, energia, bess: bessTab, economia, capex: capexTab, incentivi, sensitivita, ingegneria, elaborati, relazione }[tab];
    $('#panels').innerHTML = `<div class="panel">${P()}</div>`;
    bindPanel();
  }
  const kpi = (l, v, s, cls) => `<div class="kpi ${cls || ''}"><div class="l">${esc(l)}</div><div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;
  const legend = items => `<div class="legend">${items.map(([c, t]) => `<span><i style="background:var(${c})"></i>${esc(t)}</span>`).join('')}</div>`;

  function sintesi() {
    const f = R.fin, k = R.kpi, y = R.y1, c = R.capex;
    const dBess = Rpv ? f.npvProject - Rpv.fin.npvProject : null;
    const tiles = [
      kpi('VAN di progetto', kE(f.npvProject), 'al WACC ' + fmt(cfg.finance.wacc, 1) + ' %', f.npvProject >= 0 ? 'good' : 'bad'),
      kpi('TIR di progetto', pct(f.irrProject), 'TIR equity ' + pct(f.irrEquity)),
      kpi('Tempo di ritorno', f.paybackProject ? fmt(f.paybackProject, 1) + ' anni' : 'oltre l\'orizzonte', 'attualizzato ' + (f.paybackDisc ? fmt(f.paybackDisc, 1) + ' anni' : '–')),
      kpi('CAPEX totale', kE(c.total), fmt(c.pvPerKwp) + ' €/kWp FV' + (cfg.bess.enabled ? ' · ' + fmt(c.bessPerKwh) + ' €/kWh BESS' : '')),
      kpi('CAPEX netto aiuti', kE(f.netCapex), 'intensità aiuti ' + pct(f.aidIntensity, 0)),
      kpi('Produzione FV anno 1', fmt(y.pv / 1000) + ' MWh', fmt(k.specificYield) + ' kWh/kWp · PR ' + fmt(k.pr * 100, 1) + ' %'),
      kpi('Autoconsumo', pct(k.selfConsumptionRate), 'quota della produzione FV usata in sito'),
      kpi('Autosufficienza', pct(k.selfSufficiency), 'quota dei consumi coperta da FV + BESS'),
      kpi('LCOE fotovoltaico', fmt(f.lcoePv, 1) + ' €/MWh', cfg.bess.enabled ? 'LCOS BESS ' + fmt(f.lcosBess, 0) + ' €/MWh' : ''),
      kpi('CO₂ evitata', fmt(k.co2) + ' t/a', 'fattore rete ' + D.CO2_GRID + ' t/MWh')
    ];
    if (dBess !== null) tiles.push(kpi('Contributo del BESS al VAN', kE(dBess), 'rispetto al solo FV (VAN ' + kE(Rpv.fin.npvProject) + ')', dBess >= 0 ? 'good' : 'bad'));
    const yr1 = f.rows[0];
    let verdict = `Con i dati inseriti l'impianto da <b>${fmt(cfg.pv.kwp)} kWp</b>${cfg.bess.enabled ? ` con accumulo da <b>${fmt(cfg.bess.kwh)} kWh / ${fmt(cfg.bess.kw)} kW</b>` : ''} a ${esc(R.site.name)} produce ${fmt(y.pv / 1000)} MWh nel primo anno e copre il ${pct(k.selfSufficiency, 0)} dei consumi dello stabilimento. `;
    verdict += `Il risparmio in bolletta del primo anno vale ${kE(yr1.energySaving + yr1.powerSaving)}, la vendita delle eccedenze ${kE(yr1.exportRev)}. `;
    verdict += f.npvProject >= 0 ? `L'investimento crea valore: VAN ${kE(f.npvProject)}, TIR ${pct(f.irrProject)}. ` : `L'investimento non raggiunge il rendimento richiesto: VAN ${kE(f.npvProject)}. `;
    if (dBess !== null) verdict += dBess >= 0 ? `L'accumulo aggiunge ${kE(dBess)} di VAN.` : `L'accumulo, da solo, riduce il VAN di ${kE(-dBess)}: conviene se ci sono incentivi sul BESS, ricavi da servizi di rete, quote potenza elevate o vincoli di immissione.`;
    const warn = f.warnings.concat(R.eng.checks.filter(x => !x.ok).map(x => 'Verifica stringhe ' + x.id + ' non superata: ' + x.what + ' (' + x.value + ', limite ' + x.limit + ').'));
    return `<div class="kpis">${tiles.join('')}</div>
      <div class="card"><h2>In breve</h2><p class="verdict">${verdict}</p>${warn.map(w => `<p class="note">${esc(w)}</p>`).join('')}
      <p class="hint">Stima di pre-fattibilità (classe AACE 4–5). Meteo sintetico da medie mensili, prezzi orari con profilo tipo: per decisioni di investimento usa PVGIS/TMY del sito, la curva di carico misurata e offerte EPC.</p></div>
      <div class="card"><h2>Bilancio energetico mensile, anno 1</h2>${monthlyChart()}</div>`;
  }
  function monthlyChart() {
    const m = R.monthly;
    return C.stackedBars(MONTHS, [
      { name: 'FV autoconsumato', cls: 's-pvd', values: m.map(x => x.direct / 1000) },
      { name: 'FV in batteria', cls: 's-pvb', values: m.map(x => x.pvch / 1000) },
      { name: 'Immissione in rete', cls: 's-exp', values: m.map(x => x.exp / 1000) },
      { name: 'Taglio (curtailment)', cls: 's-curt', values: m.map(x => x.curt / 1000) }
    ], { unit: 'MWh', line: { name: 'Consumo', cls: 'l-load', values: m.map(x => x.load / 1000) } }) +
      legend([['--pv', 'FV autoconsumato'], ['--bess', 'FV caricato in batteria'], ['--exp', 'Immissione in rete'], ['--curt', 'Energia tagliata'], ['--load', 'Consumo dello stabilimento']]);
  }
  function energia() {
    const y = R.y1, MWh = v => fmt(v / 1000) + ' MWh';
    const rows = [['Produzione FV (AC, al punto di consegna)', y.pv], ['· autoconsumata direttamente', y.pvDirect], ['· caricata nel BESS', y.pvToBess], ['· immessa in rete', y.exp], ['· tagliata (limite di immissione)', y.curt],
      ['Scarica BESS verso i carichi', y.bessToLoad], ['Carica BESS da rete (arbitraggio/riserva)', y.gridToBess], ['Ausiliari BESS', y.aux], ['Prelievo da rete', y.imp], ['Consumo dello stabilimento', y.load]];
    const m = sel('mese', 5, MONTHS.map((t, i) => [i, t]));
    return `<div class="card"><h2>Bilancio mensile</h2>${monthlyChart()}</div>
      <div class="card"><h2>Giorno medio del mese</h2><div class="row"><label for="selMonth">Mese</label>${m}</div><div id="dayChart">${dayChart(5)}</div>
        ${legend([['--pv', 'Produzione FV'], ['--load', 'Consumo'], ['--imp', 'Prelievo da rete'], ['--bess', 'Stato di carica (asse destro)']])}</div>
      <div class="card"><h2>Bilancio annuo, anno 1</h2><div class="tbl-wrap"><table><tbody>${rows.map(r => `<tr><td>${esc(r[0])}</td><td class="n">${MWh(r[1])}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint">Picco di prelievo massimo: ${fmt(Math.max(...y.peakBase))} kW senza impianto, ${fmt(Math.max(...y.peakProj))} kW con impianto.</p></div>`;
  }
  function sel(id, v, opts) { return `<select id="sel-${id}" data-sel="${id}">${opts.map(([k, t]) => `<option value="${k}"${+k === +v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`; }
  function dayChart(m) {
    const h = R.y1.hourly, d0 = F.MONTH_START[m], nd = F.MONTH_DAYS[m];
    const avg = arr => Array.from({ length: 24 }, (_, k) => { let s = 0; for (let d = d0; d < d0 + nd; d++) s += arr[d * 24 + k]; return s / nd; });
    const pv = Array.from({ length: 24 }, (_, k) => { let s = 0; for (let d = d0; d < d0 + nd; d++) { const i = d * 24 + k; s += h.pvDirect[i] + h.pvch[i] + h.exp[i] + h.curt[i]; } return s / nd; });
    return C.lines(Array.from({ length: 24 }, (_, k) => k + ''), [
      { name: 'FV', cls: 'l-pv', values: pv, area: true }, { name: 'Consumo', cls: 'l-load', values: avg(R.load) },
      { name: 'Prelievo', cls: 'l-imp', values: avg(h.imp) }, { name: 'SOC', cls: 'l-soc', values: avg(h.soc), right: true }
    ], { unit: 'kW', every: 3, right: cfg.bess.enabled ? 'SOC %' : '', rightMax: 1, rightScale: 100 });
  }
  function weekChart(w) {
    const h = R.y1.hourly, i0 = w * 168, n = 168, idx = Array.from({ length: n }, (_, k) => i0 + k);
    const lab = idx.map((i, k) => k % 24 === 0 ? (Math.floor(i / 24) + 1) + '' : '');
    return C.lines(lab, [
      { name: 'FV', cls: 'l-pv', values: idx.map(i => h.pvDirect[i] + h.pvch[i] + h.exp[i] + h.curt[i]), area: true },
      { name: 'Consumo', cls: 'l-load', values: idx.map(i => R.load[i]) },
      { name: 'Prelievo', cls: 'l-imp', values: idx.map(i => h.imp[i]) },
      { name: 'SOC', cls: 'l-soc', values: idx.map(i => h.soc[i]), right: true, area: true }
    ], { unit: 'kW', every: 24, right: 'SOC %', rightMax: 1, rightScale: 100, height: 300 });
  }
  function bessTab() {
    if (!cfg.bess.enabled) return `<div class="card"><h2>Accumulo non attivo</h2><p>Attiva il BESS nel pannello “Sistema di accumulo” per vedere esercizio, cicli e degrado.</p></div>`;
    const y = R.y1, e = R.eng.bess;
    const tiles = [kpi('Cicli equivalenti anno 1', fmt(y.efc), 'sulla capacità utile'), kpi('Energia scaricata', fmt(y.bessOut / 1000) + ' MWh/a', 'di cui da FV ' + pct(y.pvToBess / Math.max(1, y.pvToBess + y.gridToBess), 0)),
      kpi('Durata a piena potenza', fmt(e.hours, 1) + ' h', 'C-rate ' + fmt(e.cRate, 2)), kpi('Unità', fmt(e.n) + ' × ' + esc(e.unit.name.split('(')[0]), fmt(e.kwhInst) + ' kWh installati'),
      kpi('LCOS', fmt(R.fin.lcosBess, 0) + ' €/MWh', 'esclusa l\'energia di carica')];
    const augY = R.years.filter(x => x.augKwh || x.replKwh).map(x => x.year);
    return `<div class="kpis">${tiles.join('')}</div>
      <div class="card"><h2>Esercizio settimanale</h2><div class="row"><label for="sel-week">Settimana</label>${sel('week', 20, Array.from({ length: 52 }, (_, k) => [k, 'Settimana ' + (k + 1)]))}</div><div id="weekChart">${weekChart(20)}</div>
      ${legend([['--pv', 'Produzione FV'], ['--load', 'Consumo'], ['--imp', 'Prelievo da rete'], ['--bess', 'Stato di carica (asse destro)']])}</div>
      <div class="card"><h2>Stato di salute e cicli per anno</h2>${augY.length ? `<p class="hint">Augmentation o sostituzione negli anni: ${augY.join(', ')}.</p>` : ''}
      <div class="tbl-wrap"><table><thead><tr><th>Anno</th><th class="n">SOH inizio anno</th><th class="n">Cicli equivalenti</th><th class="n">Scarica MWh</th><th class="n">Da rete MWh</th><th class="n">Augmentation kWh</th></tr></thead>
      <tbody>${R.years.map(x => `<tr><td>${x.year}</td><td class="n">${pct(x.soh)}</td><td class="n">${fmt(x.efc)}</td><td class="n">${fmt(x.bessOut / 1000)}</td><td class="n">${fmt(x.gridToBess / 1000)}</td><td class="n">${fmt(x.augKwh + x.replKwh)}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  let cfView = 'proj';
  function economia() {
    const f = R.fin, cf = (cfView === 'proj' ? f.cfProj : f.cfEq).map(v => v / 1000);
    const tiles = [kpi('VAN progetto', kE(f.npvProject), 'WACC ' + fmt(cfg.finance.wacc, 1) + ' %', f.npvProject >= 0 ? 'good' : 'bad'), kpi('TIR progetto', pct(f.irrProject)),
      kpi('VAN equity', kE(f.npvEquity), 'Ke ' + fmt(cfg.finance.ke, 1) + ' %', f.npvEquity >= 0 ? 'good' : 'bad'), kpi('TIR equity', pct(f.irrEquity)),
      kpi('Payback equity', f.paybackEquity ? fmt(f.paybackEquity, 1) + ' anni' : '–'), kpi('DSCR minimo', isFinite(f.minDscr) ? fmt(f.minDscr, 2) : '–', 'debito ' + kE(f.debt))];
    const cols = [['y', 'Anno'], ['pvMWh', 'FV MWh'], ['selfMWh', 'Autocons. MWh'], ['energySaving', 'Risparmio energia'], ['powerSaving', 'Risparmio potenza'], ['exportRev', 'Vendita'], ['tariffs', 'Tariffe/servizi'],
      ['opex', 'OPEX'], ['extraord', 'Straordinari'], ['ebitda', 'EBITDA'], ['depr', 'Ammortamento'], ['superdep', 'Maggiorazione'], ['taxU', 'Imposte (unlev.)'], ['credits', 'Crediti d\'imposta'], ['grants', 'Contributi'], ['cfProj', 'FCF progetto'], ['interest', 'Interessi'], ['cfEq', 'FCF equity'], ['dscr', 'DSCR']];
    const cell = (r, k) => k === 'y' ? r.y : k === 'dscr' ? (r.dscr === null ? '–' : fmt(r.dscr, 2)) : /MWh$/.test(k) ? fmt(r[k]) : fmt(r[k] / 1000, 1);
    return `<div class="kpis">${tiles.join('')}</div>
      <div class="card"><h2>Flussi di cassa</h2><div class="row"><label for="sel-cfv">Vista</label>${sel('cfv', cfView === 'proj' ? 0 : 1, [[0, 'Progetto (unlevered)'], [1, 'Equity (levered)']])}</div>${C.cashflow(cf)}
      ${legend([['--bess', 'Flusso annuo positivo'], ['--bad', 'Flusso annuo negativo'], ['--cum', 'Flusso cumulato']])}</div>
      <div class="card"><h2>Conto economico e flussi per anno <small class="hint">(k€ nominali)</small></h2><div class="tbl-wrap"><table><thead><tr>${cols.map(c => `<th class="n">${esc(c[1])}</th>`).join('')}</tr></thead>
      <tbody><tr><td class="n">0</td>${cols.slice(1).map(c => `<td class="n">${c[0] === 'cfProj' ? fmt(f.cfProj[0] / 1000, 1) : c[0] === 'cfEq' ? fmt(f.cfEq[0] / 1000, 1) : ''}</td>`).join('')}</tr>
      ${f.rows.map(r => `<tr>${cols.map(c => `<td class="n">${cell(r, c[0])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="hint">Risparmio energia = costo del prelievo evitato (PUN × perdite + spread + oneri variabili + accise). Sostituzione inverter e augmentation sono spesati nell'anno. I contributi in conto impianti riducono la base ammortizzabile; i crediti d'imposta non concorrono al reddito.</p></div>`;
  }
  function capexTab() {
    const c = R.capex, rowsFor = (grp, list, key) => list.map((it, i) => {
      const r = c.rows.find(x => x.group === grp && x.id === it.id) || { qty: 0, total: 0 };
      return `<tr><td>${esc(it.label)}</td><td class="n"><input type="number" step="any" data-capex="${key}.${i}" value="${it.value}" aria-label="${esc(it.label)}"></td><td>${esc(it.unit)}</td><td class="n">${it.unit === '€' ? '' : fmt(r.qty)}</td><td class="n">${fmt(r.total)}</td><td class="n">${pct(r.total / c.total)}</td></tr>`;
    }).join('');
    const items = c.rows.filter(r => r.total > 0).sort((a, b) => b.total - a.total).map(r => ({ label: r.group + ' · ' + r.label, value: r.total, cls: r.group === 'FV' ? 'b-pv' : r.group === 'BESS' ? 'b-bess' : 'b-com' }));
    const own = c.rows.find(r => r.id === 'own'), cont = c.rows.find(r => r.id === 'cont');
    return `<div class="kpis">${kpi('CAPEX totale', kE(c.total))}${kpi('FV', fmt(c.pvPerKwp) + ' €/kWp', kE(c.pv))}${cfg.bess.enabled ? kpi('BESS', fmt(c.bessPerKwh) + ' €/kWh', kE(c.bess) + ' · ' + fmt(c.bess / Math.max(cfg.bess.kw, 1)) + ' €/kW') : ''}${kpi('Contingenze + owner', kE(own.total + cont.total))}</div>
      <div class="card"><h2>Computo per voci <small class="hint">(valori modificabili)</small></h2><div class="tbl-wrap"><table><thead><tr><th>Voce</th><th class="n">Costo unitario</th><th>Unità</th><th class="n">Quantità</th><th class="n">Totale €</th><th class="n">Quota</th></tr></thead><tbody>
      <tr><td colspan="6"><b>Fotovoltaico</b></td></tr>${rowsFor('FV', cfg.capex.pv, 'pv')}
      ${cfg.bess.enabled ? `<tr><td colspan="6"><b>Sistema di accumulo</b></td></tr>${rowsFor('BESS', cfg.capex.bess, 'bess')}` : ''}
      <tr><td>Contingenze</td><td class="n"><input type="number" step="0.5" data-capex="contingencyPct" value="${cfg.capex.contingencyPct}" aria-label="Contingenze"></td><td>% diretti</td><td></td><td class="n">${fmt(cont.total)}</td><td class="n">${pct(cont.total / c.total)}</td></tr>
      <tr><td>Costi del committente</td><td class="n"><input type="number" step="0.5" data-capex="ownersCostPct" value="${cfg.capex.ownersCostPct}" aria-label="Costi del committente"></td><td>% diretti</td><td></td><td class="n">${fmt(own.total)}</td><td class="n">${pct(own.total / c.total)}</td></tr>
      <tr class="tot"><td>Totale</td><td></td><td></td><td></td><td class="n">${fmt(c.total)}</td><td class="n">100 %</td></tr></tbody></table></div>
      <p class="hint">Valori 2026 per C&amp;I in Italia, classe di stima AACE 4 (−20/+30 %). Fonti e intervalli in docs/04_Valutazione_CAPEX.md.</p></div>
      <div class="card"><h2>Ripartizione</h2>${C.hbars(items)}</div>`;
  }
  const TYPE_LABEL = { grant: 'Contributo in conto capitale', taxcredit: 'Credito d\'imposta', superdep: 'Maggiorazione dell\'ammortamento', tariff_export: 'Tariffa sull\'energia immessa (CfD)', tariff_energy: 'Tariffa sull\'energia', interest_grant: 'Contributo in conto interessi', capacity: 'Ricavo di capacità/servizi' };
  const PARAMS = { grant: [['pct', '%'], ['cap', 'massimale €'], ['year', 'anno di incasso']], taxcredit: [['pct', '%'], ['cap', 'massimale €'], ['years', 'quote annue'], ['startYear', 'primo anno']],
    superdep: [], interest_grant: [['rate', 'tasso %'], ['loanYears', 'anni'], ['financedPct', '% finanziato'], ['cap', 'massimale €']], tariff_export: [['strike', '€/MWh'], ['years', 'anni']],
    tariff_energy: [['value', '€/MWh'], ['years', 'anni']], capacity: [['value', '€/kW·a'], ['years', 'anni']] };
  function incentivi() {
    const res = R.fin.incentives;
    const rows = cfg.incentives.map((i, k) => {
      const r = res.find(x => x.id === i.id);
      let ps = (PARAMS[i.type] || []).map(([p, u]) => `<label>${esc(u)} <input type="number" step="any" data-inc="${k}.${p}" value="${i[p]}"></label>`).join(' ');
      if (i.type === 'superdep') ps = (i.tiers || []).map((t, j) => `<label>fino a € <input type="number" step="any" data-inc="${k}.tiers.${j}.upTo" value="${t.upTo}"></label> <label>% <input type="number" step="any" data-inc="${k}.tiers.${j}.pct" value="${t.pct}"></label>`).join('<br>')
        + `<br><label>massimale FV €/kWp <input type="number" step="any" data-inc="${k}.capPvKwp" value="${i.capPvKwp || 0}"></label> <label>α BESS/FV <input type="number" step="0.05" data-inc="${k}.bessAlpha" value="${i.bessAlpha || 0}"></label>`
        + (i.requiresEneaBC ? ` <label><input type="checkbox" data-inc="${k}.modulesEneaBC" ${i.modulesEneaBC ? 'checked' : ''}> moduli ENEA cat. B/C</label>` : '');
      if (['grant', 'taxcredit', 'superdep', 'interest_grant'].includes(i.type)) ps += ` <label>su <select data-inc="${k}.base">${[['all', 'FV + BESS'], ['pv', 'solo FV'], ['bess', 'solo BESS']].map(([v, t]) => `<option value="${v}"${(i.base || 'all') === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label>`;
      return `<tr><td><input type="checkbox" data-inc="${k}.enabled" ${i.enabled ? 'checked' : ''} aria-label="Attiva ${esc(i.name)}"></td><td><b>${esc(i.name)}</b><br><span class="hint">${esc(TYPE_LABEL[i.type] || i.type)} · ${esc(i.note || '')}</span><div class="row" style="margin-top:6px">${ps}</div></td><td class="n">${r ? fmt(r.amount) + ' €' : '–'}</td></tr>`;
    }).join('');
    const f = R.fin;
    return `<div class="kpis">${kpi('Aiuti totali', kE(f.totalAid), 'valore nominale, incl. beneficio fiscale')}${kpi('Intensità', pct(f.aidIntensity, 0), 'sul CAPEX')}${kpi('CAPEX netto', kE(f.netCapex), 'dopo contributi e crediti')}${kpi('VAN con incentivi', kE(f.npvProject), '', f.npvProject >= 0 ? 'good' : 'bad')}</div>
      ${f.warnings.map(w => `<p class="note">${esc(w)}</p>`).join('')}
      <div class="card"><h2>Strumenti di incentivo</h2><p class="hint">Attiva le misure per cui l'impresa è ammissibile e aggiorna i parametri all'avviso o decreto in vigore. Stato delle misure a ottobre 2026, cumulabilità e fonti in docs/03_Contributi_Incentivi_UE_IT.md.</p>
      <div class="tbl-wrap"><table><thead><tr><th></th><th>Misura e parametri</th><th class="n">Valore stimato</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }
  function sensitivita() {
    if (!SENS) return `<div class="card"><h2>Analisi di sensitività</h2><p>Ricalcola il VAN di progetto variando una grandezza alla volta (CAPEX, PUN, producibilità, OPEX, WACC, escalation, oneri). Richiede alcuni secondi.</p><button class="primary" id="btnSens" type="button">Calcola sensitività</button></div>`;
    return `<div class="card"><h2>Tornado del VAN di progetto</h2>${C.tornado(SENS.items, SENS.base)}${legend([['--bad', 'Variazione sfavorevole'], ['--good', 'Variazione favorevole']])}</div>
      <div class="card"><h2>Dettaglio</h2><div class="tbl-wrap"><table><thead><tr><th>Grandezza</th><th>Variazione</th><th class="n">VAN sfavorevole</th><th class="n">VAN favorevole</th><th class="n">TIR sfavorevole</th><th class="n">TIR favorevole</th></tr></thead>
      <tbody>${SENS.items.map(i => `<tr><td>${esc(i.name)}</td><td>${esc(i.range)}</td><td class="n">${kE(i.low)}</td><td class="n">${kE(i.high)}</td><td class="n">${pct(i.irrLow)}</td><td class="n">${pct(i.irrHigh)}</td></tr>`).join('')}</tbody></table></div>
      <button id="btnSens" type="button">Ricalcola</button></div>`;
  }
  function ingegneria() {
    const e = R.eng, m = e.module, inv = e.inverter, b = e.bess;
    const ok = x => `<span class="pill ${x ? 'ok' : 'ko'}">${x ? 'verificato' : 'non verificato'}</span>`;
    const t = (rows) => `<div class="tbl-wrap"><table class="kv"><tbody>${rows.map(r => `<tr><td>${esc(r[0])}</td><td class="v">${r[1]}</td></tr>`).join('')}</tbody></table></div>`;
    return `<div class="kpis">${kpi('Moduli', fmt(e.nMod), esc(m.name.split('(')[0]))}${kpi('Stringhe', fmt(e.strings), e.Ns + ' moduli in serie')}${kpi('Inverter', fmt(e.nInv), esc(inv.name))}${kpi('Potenza installata', fmt(e.kwpReal, 1) + ' kWp', fmt(e.kwac) + ' kWac')}
      ${kpi(e.landHa ? 'Superficie terreno' : 'Superficie copertura', e.landHa ? fmt(e.landHa, 2) + ' ha' : fmt(e.roofM2) + ' m²', 'moduli ' + fmt(e.modArea) + ' m²')}${kpi('Trasformatori FV', e.transformer.n + ' × ' + fmt(e.transformer.kva) + ' kVA', fmt(e.transformer.mv) + ' / ' + (e.transformer.lv / 1000).toLocaleString('it-IT') + ' kV')}</div>
      <div class="grid2"><div class="card"><h2>Dimensionamento delle stringhe</h2>${t([
        ['Temperatura minima di progetto', fmt(e.tMin, 1) + ' °C'], ['Temperatura cella massima', fmt(e.tCellMax, 1) + ' °C'], ['Voc alla Tmin', fmt(e.vocCold, 2) + ' V'], ['Vmp alla Tmin / alla Tmax', fmt(e.vmpCold, 2) + ' / ' + fmt(e.vmpHot, 2) + ' V'],
        ['Moduli in serie max (Vdc) / max (MPPT)', e.nMaxV + ' / ' + e.nMaxMppt], ['Moduli in serie min (MPPT) / piena potenza', e.nMin + ' / ' + e.nMinFull], ['Moduli in serie scelti', '<b>' + e.Ns + '</b>'],
        ['Stringhe per inverter / per MPPT', e.spInv + ' / ' + e.spMppt]])}</div>
      <div class="card"><h2>Verifiche elettriche</h2><div class="tbl-wrap"><table><thead><tr><th>Rif.</th><th>Verifica</th><th class="n">Valore</th><th class="n">Limite</th><th>Esito</th></tr></thead><tbody>${e.checks.map(c => `<tr><td>${c.id}</td><td>${esc(c.what)}</td><td class="n">${esc(c.value)}</td><td class="n">${esc(c.limit)}</td><td>${ok(c.ok)}</td></tr>`).join('')}</tbody></table></div></div></div>
      <div class="grid2"><div class="card"><h2>Cavi e trasformazione</h2>${t([
        ['Cavo di stringa ' + e.dcCable.type, e.dcCable.S + ' mm² · ' + e.dcCable.L + ' m · ΔV ' + fmt(e.dcCable.dv, 2) + ' %'],
        ['Cavo AC inverter–quadro ' + (e.acCable ? e.acCable.type : ''), e.acCable ? `${e.acCable.par} × ${e.acCable.S} mm² · I ${fmt(e.acCable.I)} A · ΔV ${fmt(e.acCable.dv, 2)} %` : 'da verificare'],
        ['Linea MT ' + e.mvCable.type, e.mvCable.S + ' mm² · I ' + fmt(e.mvCable.I) + ' A (Iz ' + e.mvCable.Iz + ' A) · ' + e.mvCable.L + ' m · Smin cto ' + fmt(e.mvCable.sMinSc) + ' mm²'],
        ['Trasformatori FV', e.transformer.n + ' × ' + fmt(e.transformer.kva) + ' kVA, Dyn11, ' + e.transformer.mv + '/' + (e.transformer.lv / 1000).toLocaleString('it-IT') + ' kV'],
        ['Contributo alla corrente di cortocircuito in MT', fmt(e.iscContribution) + ' A']])}</div>
      <div class="card"><h2>Sistema di accumulo</h2>${b ? t([['Unità', b.n + ' × ' + esc(b.unit.name)], ['Energia installata', fmt(b.kwhInst) + ' kWh'], ['Durata / C-rate', fmt(b.hours, 1) + ' h / ' + fmt(b.cRate, 2) + ' C'],
        ['Trasformatori BESS', b.nTr + ' × ' + fmt(b.trKva) + ' kVA'], ['Ingombro unità', fmt(b.footprint, 1) + ' m²'], ['Area con distanze e viabilità (stima)', fmt(b.areaWithSpacing) + ' m²']]) : '<p>BESS non attivo.</p>'}</div></div>
      <div class="card"><h2>Protezioni di interfaccia e generale (CEI 0-16)</h2><div class="tbl-wrap"><table><thead><tr><th>Codice</th><th>Funzione</th><th>Taratura tipica</th><th>Tempo</th></tr></thead><tbody>${e.protections.map(p => `<tr><td>${esc(p.code)}</td><td>${esc(p.fn)}</td><td>${esc(p.setting)}</td><td>${esc(p.time)}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint">Tarature da confermare con il regolamento di esercizio del distributore. Dettagli in docs/01_Relazione_Ingegneria_Dettaglio.md.</p></div>
      <div class="card"><h2>Elenco elaborati (MDR)</h2><div class="tbl-wrap"><table><thead><tr><th>Codice</th><th>Disc.</th><th>Titolo</th><th>Rev.</th></tr></thead><tbody>${e.mdr.map(d => `<tr><td class="num">${d.code}</td><td>${d.disc}</td><td>${esc(d.title)}</td><td>${d.rev}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function reportMd() {
    const f = R.fin, k = R.kpi, y = R.y1, c = R.capex, e = R.eng;
    const L = [];
    L.push(`# ${cfg.project.name}`, '', `Sito: ${R.site.name} · data ${new Date().toISOString().slice(0, 10)} · stima di pre-fattibilità (AACE classe 4–5)`, '');
    L.push('## Configurazione', `- FV: ${fmt(e.kwpReal, 1)} kWp DC / ${fmt(e.kwac)} kWac, ${MOUNTS.find(m => m[0] === cfg.pv.mount)[1]}, ${e.nMod} moduli ${e.module.name}, ${e.nInv} inverter ${e.inverter.name}`);
    if (cfg.bess.enabled) L.push(`- BESS: ${fmt(cfg.bess.kwh)} kWh / ${fmt(cfg.bess.kw)} kW (${fmt(cfg.bess.kwh / cfg.bess.kw, 1)} h), RTE ${cfg.bess.rte} %, strategia: ${['selfConsumption', 'arbitrage', 'peakShaving'].filter(s => cfg.bess.strategy[s]).join(', ')}`);
    L.push(`- Consumo stabilimento: ${fmt(y.load / 1000)} MWh/a, profilo ${D.LOAD_PROFILES[cfg.load.profile] ? D.LOAD_PROFILES[cfg.load.profile].name : 'misurato'}`, '');
    L.push('## Energia (anno 1)', `| Grandezza | Valore |`, `|---|---:|`, `| Produzione FV | ${fmt(y.pv / 1000)} MWh |`, `| Producibilità specifica | ${fmt(k.specificYield)} kWh/kWp |`, `| Performance ratio | ${fmt(k.pr * 100, 1)} % |`,
      `| Autoconsumo | ${pct(k.selfConsumptionRate)} |`, `| Autosufficienza | ${pct(k.selfSufficiency)} |`, `| Immissione | ${fmt(y.exp / 1000)} MWh |`, `| Cicli BESS | ${fmt(y.efc)} |`, `| CO₂ evitata | ${fmt(k.co2)} t/a |`, '');
    L.push('## Economia', `| Indicatore | Valore |`, `|---|---:|`, `| CAPEX | ${fmt(c.total)} € (${fmt(c.pvPerKwp)} €/kWp FV${cfg.bess.enabled ? ', ' + fmt(c.bessPerKwh) + ' €/kWh BESS' : ''}) |`,
      `| Aiuti | ${fmt(f.totalAid)} € (${pct(f.aidIntensity, 0)}) |`, `| VAN progetto (WACC ${cfg.finance.wacc} %) | ${fmt(f.npvProject)} € |`, `| TIR progetto | ${pct(f.irrProject)} |`, `| TIR equity | ${pct(f.irrEquity)} |`,
      `| Payback | ${f.paybackProject ? fmt(f.paybackProject, 1) + ' anni' : '–'} |`, `| LCOE FV | ${fmt(f.lcoePv, 1)} €/MWh |`, `| DSCR minimo | ${isFinite(f.minDscr) ? fmt(f.minDscr, 2) : '–'} |`);
    if (Rpv) L.push(`| VAN solo FV (confronto) | ${fmt(Rpv.fin.npvProject)} € |`);
    L.push('', '## Incentivi considerati', ...(f.incentives.length ? f.incentives.map(i => `- ${i.name}: ${fmt(i.amount)} €`) : ['- nessuno']), '');
    if (f.warnings.length) L.push('## Avvertenze', ...f.warnings.map(w => '- ' + w), '');
    L.push('_Risultati del simulatore FV+BESS (meteo sintetico da medie mensili, prezzi con profilo orario tipo). Da verificare con dati di sito, curva di carico misurata e offerte._');
    return L.join('\n');
  }
  // ---------- elaborati di progetto: 1) scelta  2) elenco  3) generazione ed estrazione ----------
  const DOCS = window.FVB_DOCS;
  const docState = { phase: null, config: null, procedure: 'pas', prefix: 'FVB', rev: 'A', list: null, gen: null, current: 1, busy: false, formats: { docx: true, dxf: true, pdf: true, md: false } };
  // download dei file: nel visualizzatore claude.ai tramite la capability "downloads", altrove con un link al blob
  let dlCap = null;
  try { if (window.claude && window.claude.use) window.claude.use('downloads').then(d => { dlCap = d; if (d && tab === 'elaborati' && docState.gen) render(); }, () => {}); } catch (e) { /* non disponibile */ }
  async function offerFile(filename, blob, st) {
    if (dlCap) {
      try { await dlCap.save({ filename, data: blob }); st.textContent = 'File salvato: ' + filename; }
      catch (e) { st.textContent = e && e.code === 'declined' ? 'Download annullato.' : e && e.code === 'rate_limited' ? 'C\'è già una richiesta aperta: riprova tra poco.' : 'Download non disponibile in questa vista: usa Copia.'; }
      return;
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000); st.textContent = 'File creato: ' + filename;
  }
  const defaultDocConfig = () => cfg.bess.enabled ? (cfg.pv.kwp > 0 ? 'FB' : 'B') : 'FV';
  const radios = (name, obj, val) => Object.keys(obj).map(k => `<label class="opt"><input type="radio" name="${name}" value="${k}"${k === val ? ' checked' : ''}> ${esc(typeof obj[k] === 'string' ? obj[k] : obj[k].name)}${obj[k].desc ? `<br><span class="hint">${esc(obj[k].desc)}</span>` : ''}</label>`).join('');
  function elaborati() {
    const st = docState; if (!st.config) st.config = defaultDocConfig();
    const ready = !!st.phase;
    let h = `<div class="card"><h2>1. Scegli fase e configurazione</h2>
      <p class="hint">L'elenco degli elaborati dipende dal livello di progettazione e dalla configurazione. Scegli prima la fase: l'elenco si prepara solo dopo la scelta.</p>
      <div class="grid2"><fieldset class="choice"><legend>Fase di progettazione</legend>${radios('docPhase', DOCS.PHASES, st.phase)}</fieldset>
      <fieldset class="choice"><legend>Configurazione</legend>${radios('docConfig', DOCS.CONFIGS, st.config)}
      <span class="hint">Il simulatore oggi è impostato come “${esc(DOCS.CONFIGS[defaultDocConfig()])}”. Se scegli un'altra configurazione i documenti escludono il FV o il BESS di conseguenza.</span></fieldset></div>
      <div class="row" style="margin-top:12px"><label for="docProc">Procedura autorizzativa</label><select id="docProc">${Object.keys(DOCS.PROCEDURES).map(k => `<option value="${k}"${k === st.procedure ? ' selected' : ''}>${esc(DOCS.PROCEDURES[k])}</option>`).join('')}</select>
      <label for="docPrefix">Prefisso codici</label><input id="docPrefix" type="text" size="6" value="${esc(st.prefix)}"><label for="docRev">Rev.</label><input id="docRev" type="text" size="3" value="${esc(st.rev)}"></div>
      <div class="row" style="margin-top:12px"><button class="primary" id="btnDocPrepare" type="button"${ready ? '' : ' disabled'}>Prepara l'elenco degli elaborati</button>${ready ? '' : '<span class="hint">Seleziona la fase per continuare.</span>'}</div></div>`;
    if (st.list) {
      const groups = [...new Set(st.list.map(d => d.group))], nSel = st.list.filter(d => d.selected && d.status !== 'na').length;
      const mark = { required: '<span class="pill ok">●</span>', optional: '<span class="pill w">○ se pertinente</span>', na: '<span class="pill ko">– non applicabile</span>' };
      h += `<div class="card"><h2>2. Elaborati da preparare <small class="hint">${esc(DOCS.PHASES[st.phase].name)} · ${esc(DOCS.CONFIGS[st.config])}</small></h2>
        <p class="hint">● richiesti per la configurazione (puoi escluderli), ○ da includere se pertinenti al sito o alla procedura; quelli proposti sono già spuntati.</p>
        <div class="tbl-wrap"><table><thead><tr><th></th><th>Codice</th><th>Elaborato</th><th>Applicabilità</th></tr></thead><tbody>${groups.map(g => `<tr><td colspan="4"><b>${esc(g)}</b></td></tr>` + st.list.filter(d => d.group === g).map(d =>
          `<tr><td><input type="checkbox" data-doc="${d.code}" ${d.selected && d.status !== 'na' ? 'checked' : ''} ${d.status === 'na' ? 'disabled' : ''} aria-label="Includi ${d.code}"></td><td class="num">${d.code}</td><td>${esc(d.title)}</td><td>${mark[d.status]}</td></tr>`).join('')).join('')}</tbody></table></div>
        <div class="row" style="margin-top:12px"><button class="primary" id="btnDocGen" type="button"${nSel && !st.busy ? '' : ' disabled'}>${st.busy ? 'Generazione in corso…' : `Genera ${nSel} elaborati`}</button><button type="button" id="btnDocAllOpt">Includi tutti i pertinenti</button></div></div>`;
    }
    if (st.gen) {
      const g = st.gen, f = g.files[st.current] || g.files[0], inFrame = (() => { try { return window.self !== window.top; } catch (e) { return true; } })(), canSave = !inFrame || !!dlCap;
      const nDraw = g.files.filter(z => z.kind === 'drawing').length, ext = { docx: 'Word', dxf: 'CAD', pdf: 'PDF', md: 'Markdown' };
      h += `<div class="card"><h2>3. Estrai i documenti <small class="hint">${g.files.length - 1 - nDraw} relazioni, ${nDraw} tavole + indice</small></h2>
        ${g.warnings.map(w => `<p class="note">${esc(w)}</p>`).join('')}
        <fieldset class="choice"><legend>Formati da estrarre</legend><div class="row">${Object.keys(DOCS.FORMATS).map(k => `<label class="opt"><input type="checkbox" data-fmt="${k}"${st.formats[k] ? ' checked' : ''}> ${esc(DOCS.FORMATS[k])}</label>`).join('')}</div></fieldset>
        <div class="row" style="margin-top:10px">${canSave ? `<button class="primary" type="button" id="btnDocZip">Scarica ZIP (${Object.keys(st.formats).filter(k => st.formats[k]).map(k => ext[k]).join(', ') || 'nessun formato'})</button>` : ''}<span class="hint" id="docCopySt"></span></div>
        <div class="row" style="margin-top:14px"><label for="docPick">Documento</label><select id="docPick">${g.files.map((x, i) => `<option value="${i}"${i === st.current ? ' selected' : ''}>${esc(x.base)} ${x.kind === 'drawing' ? '(tavola)' : ''}</option>`).join('')}</select>
        ${canSave ? DOCS.formatsOf(f).map(k => `<button type="button" data-dl="${k}">Scarica .${k}</button>`).join('') : ''}<button type="button" id="btnDocCopy">Copia testo</button></div>
        ${f.kind === 'drawing' ? `<div class="sheet-prev">${window.FVB_EXPORT.svg(f.drawing)}</div><p class="hint">Anteprima della tavola ${esc(f.drawing.sheet)}, scala ${f.drawing.unit === 'm' ? '1:' + f.drawing.scale : '–'}. Il DXF (R12, layer per categoria) si apre con AutoCAD, BricsCAD, DraftSight, LibreCAD, QCAD; le planimetrie sono in metri reali.</p>` : ''}
        <textarea id="docOut" readonly style="min-height:${f.kind === 'drawing' ? 160 : 420}px">${esc(f.md)}</textarea>
        <p class="hint">${canSave ? '' : 'In questa vista i download non sono disponibili: usa Copia testo, oppure apri standalone/Simulatore_FV_BESS.html. '}Da riga di comando: <code>node tools/genera-elaborati.js --fase ${st.phase} --config ${st.config} --procedura ${st.procedure} --formati ${Object.keys(st.formats).filter(k => st.formats[k]).join(',')}</code>.</p></div>`;
    }
    return h;
  }
  function bindDocs(p) {
    const st = docState, reset = () => { st.list = null; st.gen = null; render(); };
    p.querySelectorAll('input[name=docPhase]').forEach(r => r.addEventListener('change', () => { st.phase = r.value; reset(); }));
    p.querySelectorAll('input[name=docConfig]').forEach(r => r.addEventListener('change', () => { st.config = r.value; reset(); }));
    const pr = $('#docProc'); if (pr) pr.addEventListener('change', () => { st.procedure = pr.value; reset(); });
    const px = $('#docPrefix'); if (px) px.addEventListener('change', () => { st.prefix = px.value.trim() || 'FVB'; st.gen = null; render(); });
    const rv = $('#docRev'); if (rv) rv.addEventListener('change', () => { st.rev = rv.value.trim() || 'A'; st.gen = null; render(); });
    const bp = $('#btnDocPrepare'); if (bp) bp.addEventListener('click', () => { st.list = DOCS.prepare({ phase: st.phase, config: st.config, procedure: st.procedure }); st.gen = null; render(); });
    p.querySelectorAll('[data-doc]').forEach(c => c.addEventListener('change', () => { const d = st.list.find(z => z.code === c.dataset.doc); d.selected = c.checked; st.gen = null; render(); }));
    const ba = $('#btnDocAllOpt'); if (ba) ba.addEventListener('click', () => { st.list.forEach(d => { if (d.status !== 'na') d.selected = true; }); st.gen = null; render(); });
    const bg = $('#btnDocGen'); if (bg) bg.addEventListener('click', () => {
      st.busy = true; render();
      setTimeout(() => {
        try { st.gen = DOCS.generate(cfg, { phase: st.phase, config: st.config, procedure: st.procedure, prefix: st.prefix, rev: st.rev, selected: st.list.filter(d => d.selected).map(d => d.code) }); st.current = Math.min(1, st.gen.files.length - 1); }
        catch (e) { st.gen = { files: [{ name: 'errore.md', md: 'Errore nella generazione: ' + e.message }], warnings: [] }; }
        st.busy = false; render();
      }, 30);
    });
    const dp = $('#docPick'); if (dp) dp.addEventListener('change', () => { st.current = +dp.value; render(); });
    const dc = $('#btnDocCopy'); if (dc) dc.addEventListener('click', () => copy($('#docOut'), $('#docCopySt')));
    p.querySelectorAll('[data-fmt]').forEach(c => c.addEventListener('change', () => { st.formats[c.dataset.fmt] = c.checked; render(); }));
    const dz = $('#btnDocZip'); if (dz) dz.addEventListener('click', () => {
      const fm = Object.keys(st.formats).filter(k => st.formats[k]); if (!fm.length) { $('#docCopySt').textContent = 'Seleziona almeno un formato.'; return; }
      dz.disabled = true; $('#docCopySt').textContent = 'Preparazione dello ZIP…';
      setTimeout(() => { try { offerFile(st.gen.folder + '.zip', new Blob([DOCS.zip(st.gen, fm)], { type: 'application/zip' }), $('#docCopySt')); } catch (e) { $('#docCopySt').textContent = 'Errore: ' + e.message; } dz.disabled = false; }, 30);
    });
    p.querySelectorAll('[data-dl]').forEach(bt => bt.addEventListener('click', () => { const o = DOCS.exportFile(st.gen.files[st.current], bt.dataset.dl); if (o) offerFile(o.name, new Blob([o.data], { type: o.mime }), $('#docCopySt')); }));
  }
  function relazione() {
    return `<div class="card"><h2>Relazione sintetica</h2><p class="hint">Copiala come testo o scaricala in Word o PDF.</p><div class="row"><button class="primary" id="btnCopyMd" type="button">Copia relazione</button><button type="button" data-rep="docx">Scarica Word</button><button type="button" data-rep="pdf">Scarica PDF</button><span id="copyMdSt" class="hint"></span></div><textarea id="mdOut" readonly>${esc(reportMd())}</textarea></div>
      <div class="card"><h2>Documenti di progetto</h2><p>Nella cartella <code>fv-bess-simulator/docs/</code> del repository:</p><ol>
      <li>Relazione di ingegneria di dettaglio (basi di progetto, calcoli, norme, protezioni, sicurezza BESS, MDR)</li><li>Analisi economica del caso di riferimento, scenari e confronto FV / FV + BESS</li>
      <li>Contributi e incentivi italiani ed europei, stato a ottobre 2026, cumulabilità</li><li>Valutazione del CAPEX per voci, benchmark e contingenze</li></ol><p>Le versioni Word e PDF sono in <code>docs/word/</code> e <code>docs/pdf/</code>.</p><p>Gli elaborati di progetto (PFTE/definitivo o esecutivo) si generano nella scheda <b>Elaborati</b>.</p></div>`;
  }

  function bindPanel() {
    const p = $('#panels');
    p.querySelectorAll('[data-sel]').forEach(s => s.addEventListener('change', () => {
      const v = +s.value;
      if (s.dataset.sel === 'mese') $('#dayChart').innerHTML = dayChart(v);
      if (s.dataset.sel === 'week') $('#weekChart').innerHTML = weekChart(v);
      if (s.dataset.sel === 'cfv') { cfView = v ? 'eq' : 'proj'; render(); }
    }));
    p.querySelectorAll('[data-capex]').forEach(el => el.addEventListener('change', () => {
      const v = parseFloat(el.value); if (!isFinite(v)) return;
      const k = el.dataset.capex.split('.');
      if (k.length === 2) cfg.capex[k[0]][+k[1]].value = v; else cfg.capex[k[0]] = v;
      schedule();
    }));
    p.querySelectorAll('[data-inc]').forEach(el => el.addEventListener('change', () => {
      const [i, ...rest] = el.dataset.inc.split('.'); let v = el.type === 'checkbox' ? el.checked : el.tagName === 'SELECT' ? el.value : parseFloat(el.value);
      if (typeof v === 'number' && !isFinite(v)) return;
      if (typeof v === 'number' && v === 0 && /capPvKwp|bessAlpha/.test(el.dataset.inc)) v = null; // 0 = nessun limite
      let o = cfg.incentives[+i]; for (let j = 0; j < rest.length - 1; j++) o = o[rest[j]]; o[rest[rest.length - 1]] = v;
      schedule();
    }));
    const bs = $('#btnSens'); if (bs) bs.addEventListener('click', () => { bs.textContent = 'Calcolo in corso…'; bs.disabled = true; setTimeout(() => { SENS = F.sensitivity(cfg); render(); }, 30); });
    const bc = $('#btnCopyMd'); if (bc) bc.addEventListener('click', () => copy($('#mdOut'), $('#copyMdSt')));
    if (tab === 'elaborati') bindDocs(p);
    p.querySelectorAll('[data-rep]').forEach(bt => bt.addEventListener('click', () => {
      const XP = window.FVB_EXPORT, md = reportMd(), meta = { title: cfg.project.name, left: cfg.project.name + ' · Relazione sintetica', right: new Date().toLocaleDateString('it-IT') };
      const data = bt.dataset.rep === 'docx' ? XP.docx(md, meta) : XP.pdfReport(md, meta);
      offerFile('Relazione_sintetica.' + bt.dataset.rep, new Blob([data], { type: bt.dataset.rep === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf' }), $('#copyMdSt'));
    }));
  }
  function copy(area, st) {
    const txt = area.value;
    const fallback = () => { area.hidden = false; area.focus(); area.select(); if (st) st.textContent = 'Testo selezionato: premi Ctrl+C / Cmd+C.'; };
    try { navigator.clipboard.writeText(txt).then(() => { if (st) st.textContent = 'Copiato negli appunti.'; }, fallback); } catch (e) { fallback(); }
  }

  // ---------- importa / esporta configurazione ----------
  function cfgBox(mode) {
    let box = $('#cfgBox');
    if (!box) { box = document.createElement('div'); box.id = 'cfgBox'; box.className = 'card'; $('main').insertBefore(box, $('#tabs')); }
    box.innerHTML = mode === 'export'
      ? `<h3>Configurazione corrente (JSON)</h3><p class="hint" id="cfgSt"></p><textarea id="cfgTxt" readonly></textarea><div class="row"><button type="button" id="cfgClose">Chiudi</button></div>`
      : `<h3>Importa configurazione</h3><p class="hint">Incolla qui il JSON copiato in precedenza e premi Applica.</p><textarea id="cfgTxt"></textarea><div class="row"><button class="primary" type="button" id="cfgApply">Applica</button><button type="button" id="cfgClose">Chiudi</button><span class="hint" id="cfgSt"></span></div>`;
    const ta = $('#cfgTxt');
    if (mode === 'export') { const c = JSON.parse(JSON.stringify(cfg)); ta.value = JSON.stringify(c, null, 1); copy(ta, $('#cfgSt')); }
    $('#cfgClose').onclick = () => box.remove();
    if ($('#cfgApply')) $('#cfgApply').onclick = () => {
      try { cfg = F.normalizeConfig(JSON.parse(ta.value)); fillInputs(); $('#projTitle').textContent = cfg.project.name; box.remove(); schedule(); }
      catch (e) { $('#cfgSt').textContent = 'JSON non valido: ' + e.message; }
    };
  }

  // ---------- avvio ----------
  function start() {
    try { tab = localStorage.getItem(STORE + '-tab') || tab; } catch (e) { /* ignora */ }
    if (!TABS.find(t => t[0] === tab)) tab = 'sintesi';
    $('#docDate').textContent = new Date().toLocaleDateString('it-IT');
    $('#projTitle').textContent = cfg.project.name;
    buildInputs(); buildTabs();
    $('#btnReset').onclick = () => { cfg = F.defaultConfig(); fillInputs(); $('#projTitle').textContent = cfg.project.name; schedule(); };
    $('#btnCopyCfg').onclick = () => cfgBox('export');
    $('#btnImport').onclick = () => cfgBox('import');
    run();
  }
  start();
})();
