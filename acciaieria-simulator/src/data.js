/* Simulatore acciaieria integrata – dati del modello (globale AccData). Stato D.
   Parametri con default, campo ammesso e marcatore dell'origine:
   [F] dalla descrizione funzionale "Acciaieria integrata per laminati piani e tubi" (DF, § indicato),
   [R] regola pratica di settore senza fonte di progetto, [A] ipotesi per gli esempi.
   I valori non sono dati di progetto: vanno sostituiti con quelli dei licenziatari e della Basis of Design. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AccData = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // p(path, etichetta, unità, default, min, max, marcatore, fonte, opzioni)
  function p(path, label, unit, def, min, max, marker, source, extra) {
    var o = { path: path, label: label, unit: unit, def: def, min: min, max: max, marker: marker, source: source || '' };
    if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
    return o;
  }

  var PARAMS = [
    // ---------------------------------------------------------------- sito
    p('site.grid_CO2', 'Fattore di emissione della rete elettrica', 'kg CO₂/kWh', 0.30, 0, 1.2, 'A', '', { note: 'Per le emissioni indirette (scope 2) dell\'energia prelevata dalla rete' }),
    p('site.ng_LHV', 'Potere calorifico inferiore del gas naturale', 'MJ/Sm³', 34.5, 30, 40, 'R'),
    p('site.ng_C', 'Carbonio del gas naturale', 'kg C/GJ', 15.3, 13, 17, 'R', '', { note: '15,3 kg C/GJ = 56,1 kg CO₂/GJ PCI' }),

    // ---------------------------------------------------------------- configurazione
    p('config.product', 'Configurazione', '', 'A', null, null, 'F', 'DF §1', { options: ['A', 'B'], names: { A: 'A – Laminati piani', B: 'B – Tubi' } }),
    p('config.route', 'Rotta di processo', '', 'BF-BOF', null, null, 'F', 'DF §1, §4', { options: ['BF-BOF', 'DRI-EAF', 'EAF'], names: { 'BF-BOF': 'Altoforno + convertitore (BF-BOF)', 'DRI-EAF': 'Riduzione diretta + forno elettrico (DRI-EAF)', EAF: 'Forno elettrico a rottame (EAF)' } }),
    p('config.capacity_Mt', 'Capacità di acciaio liquido', 'Mt/anno', 4.0, 0.2, 8, 'F', 'DF §1', { note: 'A: 3–5 Mt/anno; B: 0,6–1,5 Mt/anno' }),
    p('config.hours', 'Ore di esercizio', 'h/anno', 8000, 5000, 8760, 'F', 'DF §1', { note: 'Esercizio continuo 24/7: circa 8.000 h/anno (B 7.500–8.000)' }),
    p('config.caster', 'Macchina di colata per i piani', '', 'slab', null, null, 'F', 'DF §6', { options: ['slab', 'thin'], names: { slab: 'Bramme convenzionali', thin: 'Bramme sottili (thin slab)' }, only: 'A' }),

    // ---------------------------------------------------------------- B1 parco materie prime
    p('b1.autonomy_d', 'Autonomia del parco materie prime', 'giorni', 45, 30, 60, 'F', 'DF §3'),
    p('b1.yard_t_m2', 'Densità di stoccaggio a cumuli (comprese le vie)', 't/m²', 18, 5, 40, 'R'),
    p('b1.fines_Fe', 'Ferro nei fini di minerale', 't/t', 0.62, 0.5, 0.68, 'R'),
    p('b1.pellet_Fe', 'Ferro nel pellet', 't/t', 0.655, 0.6, 0.69, 'R', '', { note: 'Pellet di grado DR: 0,67–0,68' }),
    p('b1.scrap_Fe', 'Ferro nel rottame acquistato', 't/t', 0.96, 0.85, 0.99, 'R'),

    // ---------------------------------------------------------------- B2 cokeria e agglomerazione (BF)
    p('b2.coal_per_coke', 'Carbone da coke per tonnellata di coke', 't/t', 1.30, 1.2, 1.45, 'R'),
    p('b2.coal_C', 'Carbonio nel carbone da coke', 't/t', 0.80, 0.7, 0.9, 'R'),
    p('b2.byprod_C', 'Quota del carbonio del carbone nei sottoprodotti (catrame, benzolo)', '', 0.04, 0, 0.1, 'R', 'DF §4.1'),
    p('b2.cog_Nm3', 'Gas di cokeria prodotto', 'Nm³/t coke', 420, 350, 480, 'R', 'DF §4.1'),
    p('b2.cog_MJ', 'Potere calorifico del gas di cokeria', 'MJ/Nm³', 17.5, 16, 19, 'R'),
    p('b2.cdq', 'Spegnimento del coke a secco (CDQ)', '', true, null, null, 'F', 'DF §4.1', { options: [true, false], names: { 'true': 'Sì, con recupero di energia', 'false': 'No, a umido' } }),
    p('b2.cdq_kWh', 'Energia elettrica recuperata dal CDQ', 'kWh/t coke', 110, 60, 160, 'R'),
    p('b2.battery_Mt', 'Capacità di una batteria di forni a coke', 'Mt coke/anno', 1.0, 0.3, 2.5, 'A'),
    p('b2.sinter_share', 'Quota di agglomerato nella carica ferrosa dell\'altoforno', '', 0.70, 0, 0.9, 'R'),
    p('b2.sinter_Fe', 'Ferro nell\'agglomerato', 't/t', 0.58, 0.5, 0.62, 'R'),
    p('b2.ore_per_sinter', 'Fini di minerale per tonnellata di agglomerato', 't/t', 0.94, 0.8, 1.05, 'R'),
    p('b2.limestone', 'Calcare e dolomite all\'agglomerazione', 'kg/t agglomerato', 150, 50, 250, 'R'),
    p('b2.breeze', 'Polverino di coke all\'agglomerazione', 'kg/t agglomerato', 50, 35, 70, 'R'),
    p('b2.sinter_prod', 'Produttività del nastro di agglomerazione', 't/m²·giorno', 35, 25, 45, 'R'),
    p('b2.coke_kWh', 'Energia elettrica della cokeria', 'kWh/t coke', 35, 15, 60, 'R'),
    p('b2.sinter_kWh', 'Energia elettrica dell\'agglomerazione', 'kWh/t agglomerato', 35, 20, 50, 'R'),

    // ---------------------------------------------------------------- B3 produzione di ferro
    p('b3.coke_rate', 'Consumo di coke dell\'altoforno', 'kg/t ghisa', 340, 270, 450, 'R', 'DF §4.1'),
    p('b3.pci', 'Polverino di carbone iniettato (PCI)', 'kg/t ghisa', 180, 0, 250, 'R', 'DF §4.1'),
    p('b3.pci_C', 'Carbonio nel carbone da iniezione', 't/t', 0.78, 0.7, 0.88, 'R'),
    p('b3.burden', 'Carica ferrosa dell\'altoforno', 't/t ghisa', 1.60, 1.45, 1.7, 'F', 'DF §12.1', { note: '1,5–1,6 t minerale per t ghisa' }),
    p('b3.hm_Fe', 'Ferro nella ghisa', 't/t', 0.945, 0.93, 0.955, 'R', 'DF §4.1', { note: 'C 4–4,5 %' }),
    p('b3.hm_T', 'Temperatura della ghisa al foro di colata', '°C', 1480, 1450, 1500, 'F', 'DF §4.1'),
    p('b3.bf_slag', 'Loppa d\'altoforno', 'kg/t ghisa', 280, 180, 380, 'R', 'DF §4.1'),
    p('b3.bf_dust', 'Polveri e fanghi d\'altoforno', 'kg/t ghisa', 15, 5, 30, 'R'),
    p('b3.bfg_Nm3', 'Gas d\'altoforno prodotto', 'Nm³/t ghisa', 1500, 1200, 1800, 'R', 'DF §4.1'),
    p('b3.bfg_MJ', 'Potere calorifico del gas d\'altoforno', 'MJ/Nm³', 3.2, 2.8, 3.8, 'R'),
    p('b3.bf_O2', 'Ossigeno di arricchimento del vento', 'Nm³/t ghisa', 45, 0, 120, 'R'),
    p('b3.bf_kWh', 'Energia elettrica dell\'altoforno (soffianti escluse se a vapore)', 'kWh/t ghisa', 60, 20, 150, 'R'),
    p('b3.trt_kWh', 'Recupero della turbina di pressione (TRT)', 'kWh/t ghisa', 35, 0, 50, 'R', 'DF §4.1'),
    p('b3.bf_prod', 'Produttività dell\'altoforno', 't ghisa/m³·giorno', 2.4, 1.8, 3.0, 'R'),
    p('b3.bf_max_m3', 'Volume utile massimo di un altoforno', 'm³', 5500, 1000, 6000, 'A'),
    p('b3.pellet_per_dri', 'Pellet per tonnellata di DRI', 't/t DRI', 1.45, 1.35, 1.55, 'F', 'DF §12.1', { note: '1,4–1,5 t pellet per t DRI' }),
    p('b3.dri_Fe', 'Ferro totale nel DRI', 't/t', 0.92, 0.85, 0.95, 'R'),
    p('b3.dri_C', 'Carbonio nel DRI', 't/t', 0.025, 0, 0.045, 'R'),
    p('b3.dri_T', 'Temperatura del DRI caldo', '°C', 600, 400, 700, 'F', 'DF §4.2'),
    p('b3.dri_GJ', 'Gas riducente come gas naturale', 'GJ/t DRI', 10.0, 8.5, 12, 'R', '', { note: 'Riformatura e riscaldo compresi, MIDREX/Energiron ordine di grandezza' }),
    p('b3.h2_frac', 'Quota di idrogeno nel gas riducente (su base energetica)', '', 0, 0, 1, 'A', 'DF §4.2'),
    p('b3.h2_kg', 'Idrogeno per tonnellata di DRI con il 100 % di idrogeno', 'kg/t DRI', 60, 50, 80, 'R'),
    p('b3.h2_onsite', 'Idrogeno da elettrolisi nel sito', '', false, null, null, 'A', '', { options: [false, true], names: { 'false': 'No, acquistato', 'true': 'Sì, elettrolizzatori nel sito' } }),
    p('b3.electrolyser_kWh', 'Consumo specifico dell\'elettrolisi', 'kWh/kg H₂', 52, 45, 60, 'R'),
    p('b3.dri_kWh', 'Energia elettrica dell\'impianto DRI', 'kWh/t DRI', 110, 60, 180, 'R'),
    p('b3.dri_module_Mt', 'Capacità di un modulo DRI', 'Mt DRI/anno', 2.0, 0.5, 2.8, 'A'),

    // ---------------------------------------------------------------- B4 fusione primaria
    p('b4.hm_share', 'Ghisa liquida nella carica del convertitore', '', 0.85, 0.7, 0.95, 'F', 'DF §5.1', { note: '80–90 % ghisa, 10–20 % rottame' }),
    p('b4.bof_yield', 'Resa metallica del convertitore', 't/t carica', 0.90, 0.85, 0.94, 'R'),
    p('b4.bof_O2', 'Ossigeno al convertitore', 'Nm³/t acciaio', 55, 45, 65, 'R'),
    p('b4.ldg_Nm3', 'Gas di convertitore recuperato (LDG)', 'Nm³/t acciaio', 90, 0, 120, 'R', 'DF §5.1'),
    p('b4.ldg_MJ', 'Potere calorifico del gas di convertitore', 'MJ/Nm³', 8.0, 6.5, 9.5, 'R'),
    p('b4.bof_lime', 'Calce al convertitore', 'kg/t acciaio', 45, 30, 70, 'R'),
    p('b4.bof_slag', 'Scoria di convertitore', 'kg/t acciaio', 110, 80, 150, 'R'),
    p('b4.bof_dust', 'Polveri e fanghi del convertitore', 'kg/t acciaio', 18, 8, 30, 'R'),
    p('b4.bof_heat', 'Capacità per colata del convertitore', 't', 300, 150, 350, 'F', 'DF §5.1'),
    p('b4.bof_ttt', 'Tap-to-tap del convertitore', 'min', 40, 35, 45, 'F', 'DF §5.1'),
    p('b4.dri_share', 'DRI o HBI nella carica metallica del forno elettrico', '', 0.0, 0, 1, 'A', 'DF §5.1', { note: 'Rotta DRI-EAF: DRI prodotto nel sito; rotta EAF: HBI acquistato' }),
    p('b4.hot_dri', 'Carica del DRI a caldo', '', true, null, null, 'F', 'DF §4.2', { options: [true, false], names: { 'true': 'Sì, DRI caldo', 'false': 'No, a freddo' } }),
    p('b4.scrap_yield', 'Resa metallica del rottame al forno elettrico', 't/t', 0.91, 0.86, 0.95, 'F', 'DF §12.1', { note: '1,08–1,12 t carica per t acciaio liquido' }),
    p('b4.dri_yield', 'Resa metallica del DRI al forno elettrico', 't/t', 0.87, 0.8, 0.93, 'R'),
    p('b4.eaf_kWh_scrap', 'Energia elettrica del forno con 100 % rottame', 'kWh/t acciaio', 400, 350, 450, 'F', 'DF §12.1'),
    p('b4.eaf_kWh_dri', 'Energia elettrica del forno con 100 % DRI freddo', 'kWh/t acciaio', 680, 550, 750, 'F', 'DF §12.1', { note: 'DRI-EAF: 550–700 kWh/t con DRI caldo o freddo' }),
    p('b4.hot_dri_saving', 'Risparmio con il 100 % di DRI caldo', 'kWh/t acciaio', 120, 60, 200, 'R'),
    p('b4.preheat', 'Preriscaldo del rottame (carica continua tipo Consteel)', '', false, null, null, 'F', 'DF §5.1', { options: [false, true], names: { 'false': 'No', 'true': 'Sì' } }),
    p('b4.preheat_saving', 'Risparmio del preriscaldo, per la quota di rottame', 'kWh/t acciaio', 50, 20, 90, 'R'),
    p('b4.eaf_O2', 'Ossigeno al forno elettrico', 'Nm³/t acciaio', 35, 15, 50, 'R'),
    p('b4.eaf_NG', 'Gas naturale ai bruciatori del forno elettrico', 'GJ/t acciaio', 0.25, 0, 0.6, 'R'),
    p('b4.electrode', 'Consumo di elettrodi in grafite', 'kg/t acciaio', 1.6, 0.8, 3, 'R', 'DF §5.1'),
    p('b4.charge_C', 'Carbone di carica e di schiumatura', 'kg/t acciaio', 12, 0, 30, 'R'),
    p('b4.eaf_lime', 'Calce al forno elettrico', 'kg/t acciaio', 40, 20, 70, 'R'),
    p('b4.eaf_slag', 'Scoria del forno elettrico con 100 % rottame', 'kg/t acciaio', 120, 80, 180, 'R'),
    p('b4.slag_dri', 'Scoria aggiuntiva con 100 % DRI (ganga)', 'kg/t acciaio', 90, 30, 160, 'R'),
    p('b4.eaf_dust', 'Polveri del forno elettrico', 'kg/t acciaio', 16, 8, 25, 'R', 'DF §10.2'),
    p('b4.eaf_heat', 'Capacità per colata del forno elettrico', 't', 150, 100, 300, 'F', 'DF §5.1'),
    p('b4.eaf_ttt', 'Tap-to-tap del forno elettrico', 'min', 50, 40, 60, 'F', 'DF §5.1'),
    p('b4.power_on', 'Tempo sotto arco sul tap-to-tap', '', 0.78, 0.6, 0.9, 'R'),
    p('b4.availability', 'Disponibilità delle unità di fusione', '', 0.88, 0.7, 0.97, 'R'),

    // ---------------------------------------------------------------- B5 metallurgia secondaria
    p('b5.lf_kWh', 'Energia elettrica del forno siviera', 'kWh/t acciaio', 35, 20, 60, 'R', 'DF §5.2'),
    p('b5.degas_share', 'Colate trattate sotto vuoto', '', 0.5, 0, 1, 'A', 'DF §5.2'),
    p('b5.degas_type', 'Tipo di degasaggio', '', 'RH', null, null, 'F', 'DF §5.2', { options: ['RH', 'VD'], names: { RH: 'RH (decarburazione spinta, ULC/IF)', VD: 'VD/VOD' } }),
    p('b5.degas_kWh', 'Energia elettrica del degasaggio (vuoto con pompe meccaniche)', 'kWh/t trattata', 15, 3, 30, 'R'),
    p('b5.alloys', 'Ferroleghe e disossidanti', 'kg/t acciaio', 15, 5, 40, 'R'),
    p('b5.lf_slag', 'Scoria di siviera', 'kg/t acciaio', 15, 5, 30, 'R'),
    p('b5.lf_electrode', 'Elettrodi del forno siviera', 'kg/t acciaio', 0.3, 0.1, 0.6, 'R'),
    p('b5.ladle_GJ', 'Preriscaldo siviere e paniere', 'GJ/t acciaio', 0.08, 0, 0.2, 'R'),
    p('b5.argon', 'Argon di agitazione', 'Nm³/t acciaio', 0.5, 0.1, 1.5, 'R'),

    // ---------------------------------------------------------------- B6 colata continua
    p('b6.yield', 'Resa della colata continua', 't/t', 0.975, 0.95, 0.99, 'R'),
    p('b6.slab_thk', 'Spessore delle bramme', 'mm', 250, 200, 300, 'F', 'DF §6'),
    p('b6.slab_w', 'Larghezza media delle bramme', 'mm', 1600, 900, 2200, 'F', 'DF §6'),
    p('b6.slab_v', 'Velocità di colata delle bramme', 'm/min', 1.4, 1, 2, 'F', 'DF §6'),
    p('b6.thin_thk', 'Spessore delle bramme sottili', 'mm', 80, 50, 110, 'F', 'DF §6'),
    p('b6.thin_w', 'Larghezza media delle bramme sottili', 'mm', 1500, 900, 2000, 'A'),
    p('b6.thin_v', 'Velocità di colata delle bramme sottili', 'm/min', 5, 4, 6, 'F', 'DF §6'),
    p('b6.round_d', 'Diametro dei tondi', 'mm', 300, 150, 400, 'F', 'DF §6'),
    p('b6.round_v', 'Velocità di colata dei tondi', 'm/min', 0.9, 0.5, 2, 'F', 'DF §6'),
    p('b6.util', 'Utilizzo della macchina (tempo di colata sul tempo di esercizio)', '', 0.85, 0.7, 0.95, 'R'),
    p('b6.hot_charge', 'Quota di carica a caldo nei forni di riscaldo', '', 0.4, 0, 0.9, 'A', 'DF §6'),

    // ---------------------------------------------------------------- B7 laminazione a caldo (A) / tubi senza saldatura (B)
    p('b7.plate_share', 'Bramme al treno lamiere', '', 0.15, 0, 0.6, 'A', 'DF §7.1', { only: 'A' }),
    p('b7.hsm_yield', 'Resa del treno nastri a caldo', 't/t', 0.975, 0.95, 0.99, 'R', '', { only: 'A' }),
    p('b7.plate_yield', 'Resa del treno lamiere', 't/t', 0.90, 0.85, 0.95, 'R', '', { only: 'A' }),
    p('b7.reheat_GJ', 'Forni di riscaldo a longheroni, carica fredda', 'GJ/t', 1.25, 0.9, 1.6, 'R', 'DF §7.1'),
    p('b7.tunnel_GJ', 'Forno a tunnel della linea thin slab', 'GJ/t', 0.45, 0.2, 0.8, 'R', '', { only: 'A' }),
    p('b7.hot_saving', 'Risparmio di combustibile con la carica a caldo', '', 0.35, 0.1, 0.6, 'R', 'DF §6'),
    p('b7.hsm_kWh', 'Energia elettrica del treno nastri', 'kWh/t', 110, 80, 150, 'R', '', { only: 'A' }),
    p('b7.plate_kWh', 'Energia elettrica del treno lamiere', 'kWh/t', 140, 100, 200, 'R', '', { only: 'A' }),
    p('b7.furnace_tph', 'Capacità di un forno di riscaldo', 't/h', 300, 100, 450, 'A'),
    p('b7.scale', 'Scaglia di laminazione', 'kg/t laminata', 15, 5, 30, 'R', 'DF §10.2'),
    p('b7.hsm_Mt', 'Capacità di un treno nastri a caldo', 'Mt/anno', 5.0, 1.5, 6.5, 'A', '', { only: 'A' }),
    p('b7.seam_yield', 'Resa del laminatoio tubi senza saldatura (tondo → tubo grezzo)', 't/t', 0.87, 0.8, 0.93, 'R', 'DF §8.1', { only: 'B' }),
    p('b7.rhf_GJ', 'Forno a suola rotante e riscaldo intermedio', 'GJ/t', 1.6, 1.1, 2.2, 'R', 'DF §8.1', { only: 'B' }),
    p('b7.seam_kWh', 'Energia elettrica del laminatoio tubi', 'kWh/t', 190, 120, 260, 'R', '', { only: 'B' }),
    p('b7.seam_Mt', 'Capacità di un laminatoio a mandrino', 'Mt/anno', 0.6, 0.2, 1.2, 'A', '', { only: 'B' }),

    // ---------------------------------------------------------------- B8 linee a freddo (A) / tubi saldati (B)
    p('b8.cold_share', 'Coil a caldo al decapaggio e laminazione a freddo', '', 0.45, 0, 0.9, 'A', 'DF §7.2', { only: 'A' }),
    p('b8.coated_share', 'Nastro a freddo zincato o preverniciato', '', 0.5, 0, 1, 'A', 'DF §7.4', { only: 'A' }),
    p('b8.pickle_yield', 'Resa del decapaggio', 't/t', 0.98, 0.96, 0.995, 'R', '', { only: 'A' }),
    p('b8.cold_yield', 'Resa della laminazione a freddo e della ricottura', 't/t', 0.975, 0.95, 0.99, 'R', '', { only: 'A' }),
    p('b8.anneal', 'Ricottura', '', 'CAL', null, null, 'F', 'DF §7.3', { options: ['CAL', 'BAF'], names: { CAL: 'Continua (CAL)', BAF: 'A campana (batch)' }, only: 'A' }),
    p('b8.anneal_GJ', 'Combustibile della ricottura', 'GJ/t', 0.9, 0.5, 1.5, 'R', '', { only: 'A' }),
    p('b8.cgl_GJ', 'Combustibile della zincatura continua', 'GJ/t', 1.0, 0.6, 1.5, 'R', '', { only: 'A' }),
    p('b8.cold_kWh', 'Energia elettrica di decapaggio e treno tandem', 'kWh/t', 140, 90, 200, 'R', '', { only: 'A' }),
    p('b8.anneal_kWh', 'Energia elettrica di ricottura, skin pass e rivestimento', 'kWh/t', 60, 30, 100, 'R', '', { only: 'A' }),
    p('b8.zinc', 'Zinco e leghe di rivestimento', 'kg/t rivestita', 30, 10, 60, 'R', '', { only: 'A' }),
    p('b8.oxide', 'Ossido di ferro dalla rigenerazione dell\'acido', 'kg/t decapata', 5, 2, 10, 'R', 'DF §7.2', { only: 'A' }),
    p('b8.welded_ls', 'Acciaio liquido colato in bramme per i tubi saldati', '', 0.0, 0, 0.8, 'A', 'DF §8.2', { only: 'B', note: 'Le bramme vanno a un treno coil e lamiere compatto nel sito' }),
    p('b8.purchased_coil_Mt', 'Coil e lamiere acquistati per i tubi saldati', 'Mt/anno', 0.0, 0, 2, 'A', 'DF §2', { only: 'B' }),
    p('b8.strip_yield', 'Resa del treno coil e lamiere per tubi', 't/t', 0.965, 0.93, 0.99, 'R', '', { only: 'B' }),
    p('b8.strip_kWh', 'Energia elettrica del treno coil e lamiere per tubi', 'kWh/t', 120, 80, 180, 'R', '', { only: 'B' }),
    p('b8.erw_share', 'Quota ERW/HFI dei tubi saldati', '', 0.7, 0, 1, 'A', 'DF §8.2', { only: 'B' }),
    p('b8.sawl_share', 'Quota SAW longitudinale (UOE, JCOE)', '', 0.0, 0, 1, 'A', 'DF §8.2', { only: 'B' }),
    p('b8.erw_yield', 'Resa ERW', 't/t', 0.95, 0.9, 0.98, 'R', '', { only: 'B' }),
    p('b8.saw_yield', 'Resa SAW', 't/t', 0.93, 0.88, 0.97, 'R', '', { only: 'B' }),
    p('b8.erw_kWh', 'Energia elettrica ERW (formatura, saldatura HF, normalizzazione)', 'kWh/t', 110, 60, 160, 'R', '', { only: 'B' }),
    p('b8.saw_kWh', 'Energia elettrica SAW (formatura, saldatura, espansione)', 'kWh/t', 160, 100, 240, 'R', '', { only: 'B' }),

    // ---------------------------------------------------------------- B9 finitura e spedizione
    p('b9.yield', 'Resa di finitura (rifilatura, spuntatura, scarti di collaudo)', 't/t', 0.99, 0.95, 1, 'R'),
    p('b9.qt_share', 'Tubi senza saldatura temprati e rinvenuti (Q&T)', '', 0.5, 0, 1, 'A', 'DF §8.3', { only: 'B' }),
    p('b9.qt_GJ', 'Combustibile della tempra e rinvenimento', 'GJ/t', 1.3, 0.8, 1.8, 'R', '', { only: 'B' }),
    p('b9.coat_share', 'Tubi con rivestimento esterno (3LPE, 3LPP, FBE)', '', 0.2, 0, 1, 'A', 'DF §8.3', { only: 'B' }),
    p('b9.coat_GJ', 'Combustibile del rivestimento', 'GJ/t rivestita', 0.3, 0.1, 0.6, 'R', '', { only: 'B' }),
    p('b9.kWh', 'Energia elettrica di finitura, controlli e magazzino', 'kWh/t', 25, 5, 80, 'R'),

    // ---------------------------------------------------------------- B10 energia elettrica e centrale gas di recupero
    p('b10.bfg_internal', 'Gas d\'altoforno usato nei cowper e nella cokeria', '', 0.45, 0.2, 0.7, 'R'),
    p('b10.cog_internal', 'Gas di cokeria usato nella cokeria e nei forni', '', 0.45, 0.2, 0.8, 'R'),
    p('b10.pp_eta', 'Rendimento elettrico della centrale a gas di recupero', '', 0.36, 0.25, 0.45, 'R', 'DF §9'),
    p('b10.services_kWh', 'Servizi generali di stabilimento (aria compressa, illuminazione, edifici)', 'kWh/t acciaio', 30, 10, 60, 'R'),
    p('b10.peak', 'Rapporto tra punta e media dei carichi senza forni ad arco', '', 1.35, 1.1, 2, 'R'),
    p('b10.pf', 'Fattore di potenza dei carichi', '', 0.92, 0.8, 0.98, 'R'),
    p('b10.svc', 'Compensazione SVC/STATCOM per MVA di trasformatore del forno', 'Mvar/MVA', 1.0, 0.5, 1.5, 'R', 'DF §5.1'),
    p('b10.losses', 'Perdite di trasformazione e distribuzione', '', 0.015, 0, 0.04, 'R'),

    // ---------------------------------------------------------------- B11 gas tecnici, acqua, gas naturale, calce
    p('b11.asu_kWh', 'Energia elettrica della separazione aria per ossigeno', 'kWh/Nm³ O₂', 0.55, 0.4, 0.75, 'R', 'DF §9'),
    p('b11.n2', 'Azoto di stabilimento', 'Nm³/t acciaio', 20, 5, 50, 'R'),
    p('b11.o2_peak', 'Rapporto punta/media della domanda di ossigeno', '', 1.3, 1, 1.8, 'R'),
    p('b11.circ_factor', 'Fattore sulle portate di ricircolo tipiche dell\'acqua', '', 1.0, 0.5, 2, 'R'),
    p('b11.makeup', 'Reintegro dei circuiti di raffreddamento', '', 0.02, 0.005, 0.05, 'R', 'DF §9'),
    p('b11.pump_kWh', 'Energia di pompaggio e ventilazione delle torri', 'kWh/m³ ricircolato', 0.25, 0.1, 0.5, 'R'),
    p('b11.lime_kiln', 'Forni a calce nel sito', '', true, null, null, 'F', 'DF §3', { options: [true, false], names: { 'true': 'Sì, calcinazione nel sito', 'false': 'No, calce acquistata' } }),
    p('b11.lime_GJ', 'Combustibile del forno a calce', 'GJ/t calce', 4.2, 3.5, 6, 'R'),

    // ---------------------------------------------------------------- B12 ambiente e sottoprodotti
    p('b12.fume_eaf', 'Fumi captati al forno elettrico (primari e secondari)', 'Nm³/t acciaio', 10000, 5000, 16000, 'R', 'DF §10.1'),
    p('b12.fume_bof', 'Fumi secondari captati al convertitore', 'Nm³/t acciaio', 6000, 2000, 10000, 'R', 'DF §10.1'),
    p('b12.fan_kWh', 'Ventilatori dei filtri', 'kWh/1.000 Nm³', 1.6, 0.8, 2.5, 'R'),
    p('b12.dust_mg', 'Polveri residue al camino dopo i filtri a maniche', 'mg/Nm³', 5, 1, 20, 'R', 'DF §10.1')
  ];

  // Parametri che valgono solo per alcune rotte (nascosti negli input delle altre)
  var ROUTE_ONLY = {
    'BF-BOF': ['b3.coke_rate', 'b3.pci', 'b3.pci_C', 'b3.burden', 'b3.hm_Fe', 'b3.hm_T', 'b3.bf_slag', 'b3.bf_dust', 'b3.bfg_Nm3', 'b3.bfg_MJ', 'b3.bf_O2', 'b3.bf_kWh', 'b3.trt_kWh', 'b3.bf_prod', 'b3.bf_max_m3',
      'b4.hm_share', 'b4.bof_yield', 'b4.bof_O2', 'b4.ldg_Nm3', 'b4.ldg_MJ', 'b4.bof_lime', 'b4.bof_slag', 'b4.bof_dust', 'b4.bof_heat', 'b4.bof_ttt', 'b10.bfg_internal', 'b10.cog_internal', 'b10.pp_eta', 'b12.fume_bof'],
    'DRI-EAF': ['b3.pellet_per_dri', 'b3.dri_Fe', 'b3.dri_T', 'b3.dri_GJ', 'b3.h2_frac', 'b3.h2_kg', 'b3.h2_onsite', 'b3.electrolyser_kWh', 'b3.dri_kWh', 'b3.dri_module_Mt', 'b4.hot_dri', 'b4.hot_dri_saving'],
    'EAF+': ['b3.dri_C', 'b4.dri_share', 'b4.scrap_yield', 'b4.dri_yield', 'b4.eaf_kWh_scrap', 'b4.eaf_kWh_dri', 'b4.preheat', 'b4.preheat_saving', 'b4.eaf_O2', 'b4.eaf_NG', 'b4.electrode', 'b4.charge_C', 'b4.eaf_lime', 'b4.eaf_slag', 'b4.slag_dri', 'b4.eaf_dust', 'b4.eaf_heat', 'b4.eaf_ttt', 'b4.power_on', 'b10.svc', 'b12.fume_eaf']
  };
  PARAMS.forEach(function (q) {
    if (/^b2\./.test(q.path) || ROUTE_ONLY['BF-BOF'].indexOf(q.path) >= 0) q.routes = ['BF-BOF'];
    else if (ROUTE_ONLY['DRI-EAF'].indexOf(q.path) >= 0) q.routes = ['DRI-EAF'];
    else if (ROUTE_ONLY['EAF+'].indexOf(q.path) >= 0) q.routes = ['DRI-EAF', 'EAF'];
  });

  // Parametri che dipendono dalla rotta o dalla configurazione: si applicano prima dei valori del caso
  var PRESETS = {
    route: {
      'BF-BOF': { 'b4.dri_share': 0, 'b5.degas_share': 0.5 },
      'DRI-EAF': { 'b4.dri_share': 0.8, 'b4.hot_dri': true },
      EAF: { 'b4.dri_share': 0, 'b4.hot_dri': false }
    },
    product: {
      A: { 'config.capacity_Mt': 4.0, 'config.hours': 8000, 'b9.yield': 0.99, 'b5.degas_share': 0.5, 'b5.degas_type': 'RH' },
      B: { 'config.capacity_Mt': 1.0, 'config.hours': 7800, 'b9.yield': 0.98, 'b5.degas_share': 0.8, 'b5.degas_type': 'VD' }
    }
  };

  // Casi di riferimento (ipotesi per gli esempi, non progetti)
  var CASES = {
    order: ['A1', 'A2', 'A3', 'B1', 'B2'],
    cases: {
      A1: { title: 'A1 – Laminati piani, BF-BOF, 4 Mt/anno', notes: 'Rotta integrata classica con cokeria, agglomerazione, altoforno e convertitori; HRC, lamiere grosse, CRC e zincati.',
        inputs: { config: { product: 'A', route: 'BF-BOF', capacity_Mt: 4.0, hours: 8000, caster: 'slab' } } },
      A2: { title: 'A2 – Laminati piani, DRI-EAF a gas naturale, 2,5 Mt/anno', notes: 'Riduzione diretta con carica a caldo dell\'80 % di DRI; il caso sta sotto il campo 3–5 Mt/anno della configurazione A.',
        inputs: { config: { product: 'A', route: 'DRI-EAF', capacity_Mt: 2.5, hours: 8000, caster: 'slab' }, b4: { dri_share: 0.8, hot_dri: true, eaf_heat: 200 }, b8: { cold_share: 0.5 } } },
      A3: { title: 'A3 – Laminati piani, EAF a rottame con thin slab, 3 Mt/anno', notes: 'Forno elettrico a rottame con preriscaldo, colata di bramme sottili collegata al treno nastri; niente treno lamiere.',
        inputs: { config: { product: 'A', route: 'EAF', capacity_Mt: 3.0, hours: 8000, caster: 'thin' }, b4: { preheat: true }, b7: { plate_share: 0 }, b8: { cold_share: 0.3 } } },
      B1: { title: 'B1 – Tubi senza saldatura, EAF a rottame, 1 Mt/anno', notes: 'Forno elettrico, colata di tondi Ø 300 mm, laminatoio a mandrino trattenuto, Q&T per OCTG.',
        inputs: { config: { product: 'B', route: 'EAF', capacity_Mt: 1.0, hours: 7800 } } },
      B2: { title: 'B2 – Tubi senza saldatura e saldati, EAF con 20 % HBI, 1,2 Mt/anno', notes: 'Il 35 % dell\'acciaio è colato in bramme per un treno coil compatto che alimenta ERW e SAW elicoidale.',
        inputs: { config: { product: 'B', route: 'EAF', capacity_Mt: 1.2, hours: 7800 }, b4: { dri_share: 0.2, eaf_heat: 180 }, b8: { welded_ls: 0.35, erw_share: 0.7, sawl_share: 0 }, b9: { coat_share: 0.3 } } }
    }
  };

  var SECTIONS = [
    { id: 'site', name: 'Sito' }, { id: 'config', name: 'Configurazione' },
    { id: 'b1', block: 'B1', name: 'Parco materie prime e logistica in ingresso', df: 'DF §3' },
    { id: 'b2', block: 'B2', name: 'Cokeria e agglomerazione', df: 'DF §4.1' },
    { id: 'b3', block: 'B3', name: 'Area primaria – produzione di ferro', df: 'DF §4' },
    { id: 'b4', block: 'B4', name: 'Acciaieria – fusione primaria', df: 'DF §5.1' },
    { id: 'b5', block: 'B5', name: 'Metallurgia secondaria', df: 'DF §5.2' },
    { id: 'b6', block: 'B6', name: 'Colata continua', df: 'DF §6' },
    { id: 'b7', block: 'B7', name: 'Laminazione a caldo / tubi senza saldatura', df: 'DF §7.1, §8.1' },
    { id: 'b8', block: 'B8', name: 'Linee a freddo e rivestimenti / tubi saldati', df: 'DF §7.2–7.4, §8.2' },
    { id: 'b9', block: 'B9', name: 'Finitura, controlli e spedizione', df: 'DF §7.5, §8.3' },
    { id: 'b10', block: 'B10', name: 'Energia elettrica e centrale a gas di recupero', df: 'DF §9' },
    { id: 'b11', block: 'B11', name: 'Gas tecnici, acqua, gas naturale e calce', df: 'DF §9' },
    { id: 'b12', block: 'B12', name: 'Ambiente e sottoprodotti', df: 'DF §10' }
  ];

  // Indicatori tipici della descrizione funzionale (§12.1), per il confronto
  var DF_RANGES = {
    'BF-BOF': { charge: [1.5, 1.6, 't minerale/t ghisa'], elec: null, co2: [1.8, 2.2] },
    'DRI-EAF': { charge: [1.4, 1.5, 't pellet/t DRI'], elec: [550, 700], co2: [1.0, 1.4] },
    EAF: { charge: [1.08, 1.12, 't carica/t acciaio liquido'], elec: [350, 450], co2: [0.3, 0.6] },
    yieldHRC: [0.95, 0.97],
    capacity: { A: [3, 5], B: [0.6, 1.5] }
  };

  return { version: '1.0.0', params: PARAMS, presets: PRESETS, cases: CASES, sections: SECTIONS, dfRanges: DF_RANGES };
});
