/* Simulatore acciaieria integrata – elaborati e disposizione (globale AccDocs), versione 1.0.0. Stato D.
   Funzioni pure sui risultati di AccEngine.solve: equipment list, load list, utility summary, bilancio materiali,
   WBS con discipline e interfacce (DF §12.2), battery limits (DF §12.3), sottoprodotti; aree della planimetria
   schematica e altezze della vista assonometrica. Le sigle di area sono le stesse del sinottico (B1…B12). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AccDocs = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var AREA = { B1: '10', B2: '20', B3: '30', B4: '40', B5: '45', B6: '50', B7: '60', B8: '70', B9: '80', B10: '90', B11: '91', B12: '95' };
  function n(v, d) { if (typeof v !== 'number' || !isFinite(v)) return '–'; return v.toLocaleString('it-IT', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }).replace(/^-/, '−'); }
  function tag(b, code, i) { return AREA[b] + '-' + code + '-' + (i < 10 ? '0' : '') + i; }
  function kt(t) { return n(t / 1e3, 0) + ' kt/anno'; }

  // ------------------------------------------------------------------ equipment list
  function equipmentList(r) {
    var I = r.inputs, c = I.config, A = c.product === 'A', B = r.blocks, H = c.hours, rows = [];
    function add(b, code, desc, qty, data, basis) { for (var i = 1; i <= Math.max(1, qty); i++) { if (qty === 0) return; rows.push([tag(b, code, i), b, desc, qty > 1 ? i + ' di ' + qty : '1', data, basis]); } }
    function one(b, code, desc, data, basis) { rows.push([AREA[b] + '-' + code, b, desc, '1 sistema', data, basis]); }
    one('B1', 'YRD', 'Parco materie prime a cumuli e silos', n(B.B1.stock_t / 1e3, 0) + ' kt a scorta, ' + n(B.B1.yard_m2 / 1e4, 1) + ' ha', I.b1.autonomy_d + ' giorni di autonomia (DF §3)');
    one('B1', 'RCV', 'Ricevimento, pesatura, campionamento, portali di radioattività', 'Pese a ponte e ferroviarie', 'DF §3');
    if (B.B2) {
      add('B2', 'COB', 'Batteria di forni a coke con trattamento gas', B.B2.batteries, n(B.B2.coke_t / B.B2.batteries / 1e6, 2) + ' Mt coke/anno ciascuna', 'Capacità ' + n(I.b2.battery_Mt, 1) + ' Mt/anno per batteria');
      if (I.b2.cdq) one('B2', 'CDQ', 'Spegnimento a secco del coke con caldaia di recupero', n(B.B2.coke_t / H, 0) + ' t/h coke', I.b2.cdq_kWh + ' kWh/t coke recuperati');
      add('B2', 'SIN', 'Nastro di agglomerazione con depolverazione', B.B2.strands, n(B.B2.strand_m2 / B.B2.strands, 0) + ' m² di griglia', I.b2.sinter_prod + ' t/m²·giorno');
    }
    if (B.B3.unit === 'BF') {
      add('B3', 'BF', 'Altoforno con cowper, campo di colata e depurazione gas', B.B3.n, n(B.B3.V_m3, 0) + ' m³ volume utile', n(B.B3.hm_tpd / B.B3.n, 0) + ' t ghisa/giorno ciascuno, ' + n(I.b3.bf_prod, 1) + ' t/m³·giorno');
      if (I.b3.trt_kWh > 0) add('B3', 'TRT', 'Turbina di recupero della pressione del gas d\'altoforno', B.B3.n, n(r.blocks.B10.trt_MW / B.B3.n, 1) + ' MW', I.b3.trt_kWh + ' kWh/t ghisa');
      if (I.b3.pci > 0) one('B3', 'PCI', 'Macinazione ed iniezione del carbone', n(I.b3.pci * B.B3.hm / 1000 / H, 0) + ' t/h', I.b3.pci + ' kg/t ghisa');
      one('B3', 'DES', 'Desolforazione della ghisa', n(B.B3.hm / H, 0) + ' t/h ghisa', 'DF §4.1');
    } else if (B.B3.unit === 'DRI') {
      add('B3', 'DRI', 'Modulo di riduzione diretta a tino con riformatore', B.B3.n, n(B.B3.dri / B.B3.n / 1e6, 2) + ' Mt DRI/anno', 'MIDREX o Energiron, ' + I.b3.dri_module_Mt + ' Mt/anno max');
      if (B.B3.electrolyser_MW > 0) one('B3', 'ELY', 'Elettrolizzatori per idrogeno', n(B.B3.electrolyser_MW, 0) + ' MW elettrici', I.b3.electrolyser_kWh + ' kWh/kg H₂');
      if (I.b4.hot_dri) one('B3', 'HDT', 'Trasporto del DRI caldo all\'acciaieria', n(B.B3.dri / H, 0) + ' t/h a ' + I.b3.dri_T + ' °C', 'DF §4.2');
    }
    var b4 = B.B4;
    if (b4.unit === 'BOF') {
      add('B4', 'BOF', 'Convertitore a ossigeno con cappa e recupero LDG', b4.n, b4.heat + ' t/colata, tap-to-tap ' + b4.ttt + ' min', n(b4.heats_day, 1) + ' colate/giorno totali, utilizzo ' + n(b4.util * 100, 0) + ' %');
      one('B4', 'GHO', 'Gasometro del gas di convertitore', n(I.b4.ldg_Nm3 * r.indicators.tap_t / H, 0) + ' Nm³/h medi', 'DF §5.1');
    } else {
      add('B4', 'EAF', 'Forno elettrico ad arco con trasformatore', b4.n, b4.heat + ' t/colata, ' + b4.MVA + ' MVA, tap-to-tap ' + b4.ttt + ' min', n(b4.kWh_t, 0) + ' kWh/t, ' + n(b4.P_on_MW, 0) + ' MW sotto arco, utilizzo ' + n(b4.util * 100, 0) + ' %');
      add('B4', 'SVC', 'Compensatore statico SVC/STATCOM', b4.n, b4.svc_Mvar + ' Mvar', 'Flicker, DF §5.1');
      if (I.b4.preheat) add('B4', 'CST', 'Carica continua e preriscaldo del rottame', b4.n, 'Tipo Consteel', 'DF §5.1');
    }
    add('B4', 'CRN', 'Carroponte di colata', Math.max(2, b4.n), b4.heat * 1.5 > 450 ? 'fino a 450 t' : n(Math.ceil(b4.heat * 1.5 / 10) * 10, 0) + ' t', 'Siviera piena, DF §5.2');
    add('B5', 'LF', 'Forno siviera', B.B5.lf, n(I.b5.lf_kWh, 0) + ' kWh/t', '45 min per colata');
    add('B5', B.B5.degas_type, B.B5.degas_type === 'RH' ? 'Degasaggio sotto vuoto RH' : 'Degasaggio sotto vuoto VD/VOD', B.B5.degas, n(I.b5.degas_share * 100, 0) + ' % delle colate', 'DF §5.2');
    B.B6.formats.forEach(function (f, k) {
      add('B6', f.kind === 'Tondi' ? 'RCC' : (f.kind === 'Bramme' ? 'SCC' : 'TSC'), 'Macchina di colata continua – ' + f.kind.toLowerCase(), f.machines, Math.ceil(f.strands / f.machines) + ' linee, ' + f.section + ', ' + n(f.speed, 1) + ' m/min', n(f.tph_strand, 0) + ' t/h per linea, utilizzo ' + n(f.util * 100, 0) + ' %');
    });
    if (A) {
      add('B7', c.caster === 'thin' ? 'TUN' : 'RHF', c.caster === 'thin' ? 'Forno a tunnel della linea thin slab' : 'Forno di riscaldo a longheroni mobili', B.B7.furnaces, c.caster === 'thin' ? 'Collegato a una linea di colata' : I.b7.furnace_tph + ' t/h', '1.150–1.250 °C, DF §7.1');
      add('B7', 'HSM', 'Treno nastri a caldo: sbozzatore, coil box, finitore a 6–7 gabbie, raffreddamento laminare, aspi', B.B7.hsm, kt(B.B7.toHSM / B.B7.hsm) + ' di bramme', 'DF §7.1');
      add('B7', 'PLM', 'Treno lamiere quarto reversibile con raffreddamento accelerato (TMCP)', B.B7.plateMill, kt(B.B7.toPlate), 'Lamiere 5–150 mm');
      add('B8', 'TCM', 'Decapaggio accoppiato al treno tandem (PL-TCM) con rigenerazione acido', B.B8.tcm, kt(B.B8.toCold / Math.max(1, B.B8.tcm)), 'Riduzione 50–85 %, DF §7.2');
      add('B8', I.b8.anneal, I.b8.anneal === 'CAL' ? 'Linea di ricottura continua con skin pass' : 'Forni di ricottura a campana', B.B8.anneal, kt(B.B8.coldOut / Math.max(1, B.B8.anneal)), 'DF §7.3');
      add('B8', 'CGL', 'Linea di zincatura continua a caldo', B.B8.cgl, kt(B.B8.coated / Math.max(1, B.B8.cgl)), 'DF §7.4');
    } else {
      add('B7', 'RHF', 'Forno a suola rotante', B.B7.mills, n(B.B7.rounds / H / Math.max(1, B.B7.mills), 0) + ' t/h', '1.250–1.300 °C, DF §8.1');
      add('B7', 'SML', 'Laminatoio tubi: perforatore, mandrino trattenuto, riduttore-stiratore', B.B7.mills, kt(B.B7.rounds / Math.max(1, B.B7.mills)) + ' di tondi', 'DE 60–406 mm, DF §8.1');
      add('B8', 'STR', 'Treno compatto coil e lamiere per tubi saldati', B.B8.strip, kt(B.B8.slabs), 'Bramme dalla colata interna');
      add('B8', 'ERW', 'Linea ERW/HFI', B.B8.erwLines, '½"–24"', 'DF §8.2');
      add('B8', 'UOE', 'Linea SAW longitudinale (UOE o JCOE)', B.B8.sawlLines, '16"–60"', 'DF §8.2');
      add('B8', 'SPW', 'Linea SAW elicoidale', B.B8.sawhLines, '20"–100"', 'DF §8.2');
      if (B.B9.qtLines) add('B9', 'QT', 'Linea di tempra e rinvenimento', B.B9.qtLines, kt(B.B9.qt / B.B9.qtLines), 'Gradi OCTG, DF §8.3');
      one('B9', 'NDT', 'Controlli non distruttivi, prova idrostatica, filettatura', 'Tutti i tubi', 'API 5CT / API 5L');
      if (B.B9.coatLines) add('B9', 'CTG', 'Linea di rivestimento esterno 3LPE/3LPP/FBE', B.B9.coatLines, kt(B.B9.coat / B.B9.coatLines), 'DF §8.3');
    }
    one('B9', 'WH', 'Magazzino prodotti e spedizione', kt(r.indicators.product_t), 'Raccordo ferroviario e banchina');
    var b10 = B.B10;
    one('B10', 'SS', 'Sottostazione AT con trasformatori', b10.substation_MVA + ' MVA, ' + b10.kV, 'Punta stimata ' + n(b10.peak_MW, 0) + ' MW');
    if (b10.pp_MW > 0) one('B10', 'PP', 'Centrale a gas di recupero (BFG, COG, LDG)', n(b10.pp_MW, 0) + ' MW elettrici medi', 'Rendimento ' + n(I.b10.pp_eta * 100, 0) + ' %');
    add('B11', 'ASU', 'Impianto di separazione aria (O₂, N₂, Ar)', B.B11.asu, n(B.B11.o2_tpd / B.B11.asu, 0) + ' t/giorno O₂ di progetto', 'Punta ' + I.b11.o2_peak + ' × media');
    one('B11', 'CW', 'Circuiti di raffreddamento e torri', n(B.B11.circ_m3h, 0) + ' m³/h ricircolati', 'Reintegro ' + n(B.B11.makeup_m3h, 0) + ' m³/h');
    one('B11', 'NG', 'Stazione di ricevimento e riduzione del gas naturale', n(B.B11.ng_Sm3h, 0) + ' Sm³/h', n(B.B11.ng_MW, 0) + ' MW PCI');
    add('B11', 'LK', 'Forno a calce', B.B11.kilns, n(B.B11.lime_tpd / Math.max(1, B.B11.kilns), 0) + ' t/giorno calce', 'DF §3');
    one('B12', 'FTP', 'Captazione fumi primari e secondari con filtri a maniche', n(B.B12.fume_Nm3h / 1e3, 0) + ' kNm³/h', 'Polveri ' + I.b12.dust_mg + ' mg/Nm³, DF §10.1');
    one('B12', 'WTP', 'Trattamento acque di processo e di laminazione', 'Fosse scaglie, filtri a sabbia, separazione oli', 'DF §9');
    one('B12', 'BPY', 'Area di trattamento scorie e sottoprodotti', kt(r.byproducts.reduce(function (s, x) { return s + x.t; }, 0)), 'DF §10.2');
    return { code: 'EL', title: 'Equipment list', cols: ['Sigla', 'Area', 'Apparecchiatura', 'Quantità', 'Dato principale', 'Base di dimensionamento'], rows: rows,
      notes: ['Sigla = area-codice-progressivo; area con la numerazione dello schema a blocchi (B1 = 10 … B12 = 95).', 'Quantità e taglie da regole di dimensionamento di screening: da sostituire con le offerte dei licenziatari.'] };
  }

  // ------------------------------------------------------------------ load list
  function loadList(r) {
    var H = r.inputs.config.hours, rows = r.loads.map(function (l) { return [AREA[l.block] + ' ' + l.block, l.item, n(l.MWh / 1e3, 1), n(l.MW, 1), n(l.kWh_t, 0)]; });
    var tot = r.loads.reduce(function (s, l) { return s + l.MWh; }, 0);
    rows.push(['', 'Totale utenze', n(tot / 1e3, 1), n(tot / H, 1), n(tot * 1000 / r.indicators.LS_t, 0)]);
    rows.push(['', 'Perdite di trasformazione e distribuzione', n(tot * r.inputs.b10.losses / 1e3, 1), n(tot * r.inputs.b10.losses / H, 1), '']);
    rows.push(['', 'Domanda totale', n(r.indicators.elec_MWh / 1e3, 1), n(r.indicators.elec_MW, 1), n(r.indicators.elec_kWh_t, 0)]);
    rows.push(['', 'Autoproduzione (centrale, TRT, CDQ)', n(r.indicators.ownGen_MW * H / 1e3, 1), n(r.indicators.ownGen_MW, 1), '']);
    rows.push(['', r.indicators.grid_MW >= 0 ? 'Prelievo dalla rete' : 'Cessione alla rete', n(Math.abs(r.indicators.grid_MW) * H / 1e3, 1), n(Math.abs(r.indicators.grid_MW), 1), '']);
    return { code: 'LL', title: 'Load list elettrica per area', cols: ['Area', 'Utenza', 'GWh/anno', 'MW medi', 'kWh/t acciaio'], rows: rows, totals: 5,
      notes: ['Punta stimata ' + n(r.blocks.B10.peak_MW, 0) + ' MW; sottostazione ' + r.blocks.B10.substation_MVA + ' MVA a ' + r.blocks.B10.kV + ' (DF §9: AT 220–400 kV).', 'Carichi medi sulle ore di esercizio; i forni ad arco sono a punta con il tempo sotto arco.'] };
  }

  // ------------------------------------------------------------------ utility summary
  function utilitySummary(r) {
    var B = r.blocks, k = r.indicators, LS = k.LS_t, H = r.inputs.config.hours, rows = [];
    rows.push(['Energia elettrica', 'Domanda totale', n(k.elec_MW, 1) + ' MW', n(k.elec_kWh_t, 0) + ' kWh/t', 'Rete AT e autoproduzione']);
    r.ng.forEach(function (g) { rows.push(['Gas naturale', g.block + ' ' + g.item, n(g.Sm3h, 0) + ' Sm³/h', n(g.GJ_t, 2) + ' GJ/t', n(g.MW, 1) + ' MW PCI']); });
    rows.push(['Gas naturale', 'Totale', n(B.B11.ng_Sm3h, 0) + ' Sm³/h', n(k.ng_GJ_t, 2) + ' GJ/t', n(k.ng_MW, 0) + ' MW PCI']);
    if (k.h2_t > 0) rows.push(['Idrogeno', 'Gas riducente DRI', n(k.h2_t * 1000 / H, 0) + ' kg/h', n(k.h2_t * 1000 / LS, 1) + ' kg/t', r.inputs.b3.h2_onsite ? 'Elettrolisi nel sito' : 'Acquistato']);
    rows.push(['Ossigeno', 'BOF/EAF, altoforno, ossitaglio', n(B.B11.o2_Nm3h, 0) + ' Nm³/h', n(k.o2_Nm3_t, 0) + ' Nm³/t', n(B.B11.o2_tpd, 0) + ' t/giorno di progetto']);
    rows.push(['Azoto', 'Inertizzazione, tenute, spurghi', n(B.B11.n2_Nm3h, 0) + ' Nm³/h', n(r.inputs.b11.n2, 0) + ' Nm³/t', 'ASU']);
    rows.push(['Argon', 'Agitazione in siviera', n(B.B11.ar_Nm3h, 0) + ' Nm³/h', n(r.inputs.b5.argon, 1) + ' Nm³/t', 'ASU']);
    r.water.forEach(function (w) { rows.push(['Acqua di raffreddamento', w.block + ' ' + w.item, n(w.m3h, 0) + ' m³/h', n(w.m3h * H / LS, 1) + ' m³/t', 'Ricircolo']); });
    rows.push(['Acqua', 'Reintegro totale', n(B.B11.makeup_m3h, 0) + ' m³/h', n(k.water_m3_t, 2) + ' m³/t', 'Evaporazione, spurghi, prove idrostatiche']);
    rows.push(['Calce', 'Convertitore o forno elettrico, siviera', n(B.B11.lime_tpd, 0) + ' t/giorno', '', r.inputs.b11.lime_kiln ? 'Forni a calce nel sito' : 'Acquistata']);
    return { code: 'US', title: 'Utility summary', cols: ['Utility', 'Utenza', 'Portata media', 'Specifico', 'Note'], rows: rows, notes: ['Portate medie; il dimensionamento delle reti usa le punte (ossigeno ' + r.inputs.b11.o2_peak + ' × media).'] };
  }

  // ------------------------------------------------------------------ bilancio materiali
  function materialBalance(r) {
    var H = r.inputs.config.hours, rows = Object.keys(r.streams).sort(sortId).map(function (id) {
      var s = r.streams[id];
      return [id, s.name, s.from || 'limite di batteria', s.to || 'limite di batteria', s.t_h !== null ? n(s.t_h, 1) : '', s.t_h !== null ? n(s.t_h * H / 1e3, 0) : '', other(s)];
    });
    return { code: 'MB', title: 'Bilancio materiali e correnti', cols: ['Corrente', 'Descrizione', 'Da', 'A', 't/h', 'kt/anno', 'Altro'], rows: rows, notes: ['Stesse sigle dello schema a blocchi e della tabella delle correnti.'] };
  }
  function other(s) {
    var o = [];
    if (typeof s.T === 'number') o.push(n(s.T, 0) + ' °C');
    if (typeof s.MW === 'number') o.push(n(s.MW, 1) + ' MW');
    if (typeof s.Nm3h === 'number') o.push(n(s.Nm3h, 0) + ' Nm³/h');
    if (typeof s.Sm3h === 'number') o.push(n(s.Sm3h, 0) + ' Sm³/h');
    if (typeof s.m3h === 'number') o.push(n(s.m3h, 0) + ' m³/h');
    if (s.note) o.push(s.note);
    return o.join(', ');
  }
  function sortId(a, b) { var ka = (a[0] === 'S' ? 0 : 100) + +a.slice(1), kb = (b[0] === 'S' ? 0 : 100) + +b.slice(1); return ka - kb; }

  // ------------------------------------------------------------------ WBS, discipline e interfacce (DF §12.2)
  function wbs(r) {
    var B = r.blocks, A = r.inputs.config.product === 'A', BF = r.inputs.config.route === 'BF-BOF', rows = [];
    function row(b, area, disc, intf, qty) { rows.push([AREA[b], b, area, disc, intf, qty]); }
    row('B1', 'Parco materie prime', 'Civile, strutture, meccanica (nastri, stacker-reclaimer)', 'Porto, ferrovia, impianti a valle', n(B.B1.yard_m2 / 1e4, 1) + ' ha, ' + n(B.B1.stock_t / 1e3, 0) + ' kt a scorta');
    if (B.B2) row('B2', 'Cokeria e agglomerazione', 'Processo, refrattari, meccanica, trattamento gas', 'Gas di cokeria, centrale, acque', B.B2.batteries + ' batterie, ' + B.B2.strands + ' nastri da ' + n(B.B2.strand_m2 / B.B2.strands, 0) + ' m²');
    if (B.B3.unit) row('B3', BF ? 'Area primaria – altoforno' : 'Area primaria – riduzione diretta', 'Processo, meccanica, refrattari, strutture pesanti', 'Gas di processo, ASU, acqua, energia', BF ? B.B3.n + ' altoforno da ' + n(B.B3.V_m3, 0) + ' m³' : B.B3.n + ' moduli DRI');
    row('B4', 'Acciaieria', 'Strutture pesanti (capannoni con carriponti fino a circa 450 t), elettrico AT, captazione fumi', 'Sottostazione, gas tecnici, colata', B.B4.n + ' ' + B.B4.unit + ' da ' + B.B4.heat + ' t');
    row('B5', 'Metallurgia secondaria', 'Meccanica, elettrico, vuoto, automazione', 'Acciaieria, colata, gas tecnici', B.B5.lf + ' LF, ' + B.B5.degas + ' ' + B.B5.degas_type);
    row('B6', 'Colata continua', 'Meccanica, fluidi, automazione', 'Acque di raffreddamento, forni di riscaldo', B.B6.formats.map(function (f) { return f.machines + ' macchine ' + f.kind.toLowerCase() + ' (' + f.strands + ' linee)'; }).join(', '));
    if (A) {
      row('B7', 'Laminazione a caldo', 'Fondazioni pesanti, idraulica, azionamenti, automazione L1–L2', 'Trattamento acque, officina cilindri', B.B7.hsm + ' HSM' + (B.B7.plateMill ? ', 1 treno lamiere' : ''));
      row('B8', 'Linee a freddo e rivestimenti', 'Fondazioni pesanti, idraulica, azionamenti, automazione L1–L2, chimica (ARP)', 'Trattamento acque, rigenerazione acido, gas', B.B8.tcm + ' PL-TCM, ' + B.B8.anneal + ' ' + r.inputs.b8.anneal + ', ' + B.B8.cgl + ' CGL');
    } else {
      if (B.B7.mills) row('B7', 'Tubi senza saldatura', 'Meccanica, automazione, trattamenti termici', 'Magazzini, laboratori', B.B7.mills + ' laminatoi');
      if (B.B8.strip || B.B8.coilBuy) row('B8', 'Tubi saldati', 'Meccanica, saldatura, automazione, NDT', 'Magazzini coil, laboratori', [B.B8.erwLines + ' ERW', B.B8.sawlLines + ' SAWL', B.B8.sawhLines + ' SAWH'].join(', '));
    }
    row('B9', A ? 'Finitura e spedizione' : 'Finitura tubi e spedizione', A ? 'Meccanica, automazione, logistica' : 'Meccanica, automazione, NDT, trattamenti termici', 'Magazzini, spedizioni, laboratori', kt(r.indicators.product_t));
    row('B10', 'Energia elettrica' + (B.B10.pp_MW > 0 ? ' e centrale a gas di recupero' : ''), 'Elettrico AT/MT/BT, meccanica', 'Rete AT, tutte le aree', B.B10.substation_MVA + ' MVA' + (B.B10.pp_MW > 0 ? ', centrale ' + n(B.B10.pp_MW, 0) + ' MW' : ''));
    row('B11', 'Utilities e infrastrutture', 'Elettrico, meccanica, processo, civile', 'Tutte le aree e i battery limits di sito', B.B11.asu + ' ASU, ' + n(B.B11.circ_m3h, 0) + ' m³/h di ricircolo');
    row('B12', 'Ambiente e sottoprodotti', 'Processo, meccanica, civile', 'Acciaieria, laminatoi, autorità', n(B.B12.fume_Nm3h / 1e3, 0) + ' kNm³/h di fumi');
    return { code: 'WBS', title: 'WBS: aree, discipline e interfacce', cols: ['WBS', 'Blocco', 'Area', 'Discipline prevalenti', 'Interfacce critiche', 'Quantità di riferimento'], rows: rows, wrap: [3, 4, 5],
      notes: ['Discipline e interfacce dalla DF §12.2; quantità dal caso corrente, utili per la stima delle ore di ingegneria.'] };
  }

  // ------------------------------------------------------------------ battery limits (DF §12.3)
  function batteryLimits(r) {
    var I = r.inputs, c = I.config, k = r.indicators, B = r.blocks, rows = [];
    var routeName = { 'BF-BOF': 'BF-BOF', 'DRI-EAF': 'DRI-EAF', EAF: 'EAF a rottame' }[c.route];
    rows.push(['Rotta di processo e licenziatari di tecnologia', routeName + '; licenziatari da definire per ogni area', 'Aperto']);
    rows.push(['Mix di prodotto e capacità di progetto per linea', r.products.map(function (p) { return p.name + ' ' + n(p.t / 1e3, 0) + ' kt'; }).join('; '), 'Da confermare']);
    rows.push(['Allaccio alla rete elettrica AT', B.B10.substation_MVA + ' MVA, ' + B.B10.kV + '; prelievo medio ' + n(Math.max(0, k.grid_MW), 0) + ' MW', 'Aperto']);
    rows.push(['Allaccio gas naturale', n(B.B11.ng_Sm3h, 0) + ' Sm³/h medi', 'Aperto']);
    if (k.h2_t > 0 && !I.b3.h2_onsite) rows.push(['Fornitura di idrogeno', n(k.h2_t * 1000 / c.hours, 0) + ' kg/h', 'Aperto']);
    rows.push(['Presa d\'acqua grezza', n(B.B11.makeup_m3h, 0) + ' m³/h di reintegro', 'Aperto']);
    rows.push(['Infrastrutture logistiche', 'Ingresso ' + n(Object.keys(r.streams).filter(function (id) { var s = r.streams[id]; return !s.from && s.t_h; }).reduce(function (s, id) { return s + r.streams[id].t_h; }, 0) * c.hours / 1e6, 2) + ' Mt/anno, uscita prodotti ' + n(k.product_t / 1e6, 2) + ' Mt/anno', 'Aperto']);
    rows.push(['Ripartizione tra pacchetto tecnologico e scope EPC', 'Per area, secondo la WBS', 'Aperto']);
    rows.push(['Permessi ambientali e garanzie di prestazione', 'CO₂ diretta ' + n(k.co2_direct_t / 1e6, 2) + ' Mt/anno (ETS, CBAM); polveri ' + I.b12.dust_mg + ' mg/Nm³', 'Aperto']);
    return { code: 'BL', title: 'Battery limits e punti aperti in offerta', cols: ['Voce (DF §12.3)', 'Valore del caso', 'Stato'], rows: rows, wrap: [1], notes: ['Voci della DF §12.3 riempite con i valori del caso; lo stato resta da gestire in offerta.'] };
  }

  // ------------------------------------------------------------------ sottoprodotti
  function byproducts(r) {
    var rows = r.byproducts.map(function (b) { return [b.name, b.origin, n(b.t / r.inputs.config.hours, 1), n(b.t / 1e3, 0), n(b.kg_t, 0), b.dest]; });
    return { code: 'BP', title: 'Sottoprodotti e destinazioni', cols: ['Sottoprodotto', 'Origine', 't/h', 'kt/anno', 'kg/t acciaio', 'Destinazione tipica (DF §10.2)'], rows: rows, notes: [] };
  }

  var ALL = [{ code: 'EL', title: 'Equipment list', fn: equipmentList }, { code: 'LL', title: 'Load list', fn: loadList }, { code: 'US', title: 'Utility summary', fn: utilitySummary },
    { code: 'MB', title: 'Bilancio materiali', fn: materialBalance }, { code: 'WBS', title: 'WBS e interfacce', fn: wbs }, { code: 'BL', title: 'Battery limits', fn: batteryLimits }, { code: 'BP', title: 'Sottoprodotti', fn: byproducts }];

  function toCSV(t) {
    function q(v) { v = String(v === undefined || v === null ? '' : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    return '﻿' + [t.cols].concat(t.rows).map(function (r) { return r.map(q).join(';'); }).join('\r\n') + '\r\n';
  }
  function toMD(t, meta) {
    var s = '# ' + t.title + '\n\n';
    if (meta) s += Object.keys(meta).map(function (k) { return '- **' + k + '**: ' + meta[k]; }).join('\n') + '\n\n';
    s += '| ' + t.cols.join(' | ') + ' |\n| ' + t.cols.map(function () { return '---'; }).join(' | ') + ' |\n';
    s += t.rows.map(function (r) { return '| ' + r.map(function (v) { return String(v).replace(/\|/g, '\\|'); }).join(' | ') + ' |'; }).join('\n') + '\n';
    if (t.notes && t.notes.length) s += '\n' + t.notes.map(function (x) { return '- ' + x; }).join('\n') + '\n';
    return s;
  }

  // ------------------------------------------------------------------ planimetria schematica
  // superfici tipiche di screening, ha [R]; altezza tipica degli edifici o degli impianti, m [R]
  function areas(r) {
    var B = r.blocks, I = r.inputs, A = I.config.product === 'A', L = [];
    function a(b, name, ha, h) { if (ha > 0) L.push({ b: b, name: name, ha: ha, h: h }); }
    a('B1', 'Parco materie prime', B.B1.yard_m2 / 1e4 * 1.3, 14);
    if (B.B2) { a('B2', 'Cokeria', B.B2.batteries * 12, 30); a('B2', 'Agglomerazione', B.B2.strands * 6, 35); }
    if (B.B3.unit === 'BF') a('B3', 'Altoforno', B.B3.n * 9, 100);
    if (B.B3.unit === 'DRI') a('B3', 'Impianto DRI', B.B3.n * 5 + (B.B3.electrolyser_MW > 0 ? B.B3.electrolyser_MW / 100 * 1.5 : 0), 130);
    a('B4', 'Acciaieria', 2 + B.B4.n * 2.5, 50);
    a('B5', 'Metallurgia secondaria', 0.6 + B.B5.lf * 0.4 + B.B5.degas * 0.5, 40);
    a('B6', 'Colata continua', B.B6.formats.reduce(function (s, f) { return s + f.machines * 1.6; }, 0), 35);
    if (A) {
      a('B7', 'Treno nastri a caldo', B.B7.hsm * 9 + B.B7.furnaces * 0.5, 28);
      a('B7', 'Treno lamiere', B.B7.plateMill * 7, 28);
      a('B8', 'Linee a freddo', B.B8.tcm * 5 + B.B8.anneal * 3 + B.B8.cgl * 3, 32);
    } else {
      a('B7', 'Laminatoio tubi senza saldatura', B.B7.mills * 6, 25);
      a('B8', 'Tubi saldati', B.B8.strip * 6 + B.B8.erwLines * 1.5 + B.B8.sawlLines * 3 + B.B8.sawhLines * 2, 22);
    }
    a('B9', A ? 'Finitura e magazzino coil' : 'Finitura tubi e magazzino', r.indicators.product_t / 1e6 * 3 + (B.B9.qtLines || 0) * 1.5 + (B.B9.coatLines || 0) * 2, 16);
    a('B10', 'Sottostazione' + (B.B10.pp_MW > 0 ? ' e centrale' : ''), 2 + B.B10.pp_MW / 100 * 3, B.B10.pp_MW > 0 ? 45 : 20);
    a('B11', 'ASU, acqua, gas, calce', B.B11.asu * 1 + B.B11.circ_m3h / 1e4 * 0.5 + B.B11.kilns * 0.5 + 1, 45);
    a('B12', 'Fumi, acque, sottoprodotti', B.B4.n * 1.5 + r.indicators.byproducts_kg_t * r.indicators.LS_t / 1e9 * 2 + 1, 25);
    return L;
  }
  // due file parallele: processo (B1…B9) e servizi (B10…B12), separate da una strada di 30 m
  function layout(r) {
    var L = areas(r), proc = L.filter(function (x) { return +x.b.slice(1) <= 9; }), util = L.filter(function (x) { return +x.b.slice(1) >= 10; });
    var procHa = proc.reduce(function (s, p) { return s + p.ha; }, 0);
    var depth1 = Math.max(250, Math.round(Math.sqrt(procHa * 1e4 / 3.2) / 10) * 10), depth2 = Math.round(depth1 / 2), road = 30, gap = 20, x = 0, rects = [];
    proc.forEach(function (p) { var w = p.ha * 1e4 / depth1; rects.push({ b: p.b, name: p.name, ha: p.ha, h: p.h, x: x, y: 0, w: w, d: depth1 }); x += w + gap; });
    var wProc = x - gap, x2 = 0;
    util.forEach(function (p) { var w = p.ha * 1e4 / depth2; rects.push({ b: p.b, name: p.name, ha: p.ha, h: p.h, x: x2, y: depth1 + road, w: w, d: depth2 }); x2 += w + gap; });
    var W = Math.max(wProc, x2 - gap), Dp = depth1 + road + depth2;
    var site = (W + 120) * (Dp + 120) / 1e4;
    return { rects: rects, W: W, D: Dp, site_ha: site, built_ha: L.reduce(function (s, x) { return s + x.ha; }, 0) };
  }

  return { AREA: AREA, ALL: ALL, equipmentList: equipmentList, loadList: loadList, utilitySummary: utilitySummary, materialBalance: materialBalance, wbs: wbs, batteryLimits: batteryLimits, byproducts: byproducts, toCSV: toCSV, toMD: toMD, layout: layout, areas: areas, sortId: sortId, other: other };
});
