/* Simulatore acciaieria integrata – motore di calcolo (globale AccEngine), versione 1.0.0. Stato D.
   Bilancio di massa e di energia di screening su base annua, area per area, con i metodi e gli
   ordini di grandezza della descrizione funzionale (DF). Il calcolo procede a ritroso dall'acciaio
   liquido: prima le linee a valle (rese, rottame interno), poi la fusione, poi l'area primaria.
   Unità interne: t/anno, GJ/anno, MWh/anno, Nm³/anno; le correnti sono riportate in t/h sulle ore di esercizio.
   Nessuna richiesta di rete: funzione pura degli input. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./data.js'));
  else root.AccEngine = factory(root.AccData);
})(typeof self !== 'undefined' ? self : this, function (D) {
  'use strict';
  var VERSION = '1.0.0';

  // Costanti del modello [R]: ordini di grandezza di letteratura, documentati in "Punti deboli noti"
  var K = {
    rho_steel: 7.8,       // t/m³, acciaio solido a caldo per la portata di colata
    skull: 0.005,         // perdite di siviera e paniera, frazione dell'acciaio liquido
    lf_lime: 8,           // kg/t, calce al forno siviera
    steel_C: 0.0015,      // carbonio medio nei prodotti
    scrap_C: 0.002,
    hm_C: 0.045,
    caco3_C: 0.12, caco3_per_cao: 1.785, cao_co2: 0.785,
    lime_kWh: 30,         // kWh/t calce
    caster_O2: 1.0,       // Nm³/t, ossitaglio
    arc_pf: 0.82,         // fattore di potenza dell'arco per il dimensionamento del trasformatore
    lf_time: 45, degas_time: 35, // min per colata
    cap: { tcm: 2.0, cal: 0.8, baf: 0.4, cgl: 0.5, erw: 0.3, sawl: 0.5, sawh: 0.25, qt: 0.25, coat: 0.3, strip: 1.5, asu: 3500, kiln: 600, strand_m2: 600 },
    fe: { slag_bf: 0.005, slag_bof: 0.18, slag_eaf: 0.22, slag_lf: 0.02, dust: 0.25, bof_dust: 0.55, bf_dust: 0.35, scale: 0.72, oxide: 0.70, steel: 0.985, hbi: 0.90, coil: 0.985 },
    circ: { coke: 3, sinter: 1, bf: 25, dri: 6, bof: 15, eaf: 35, lf: 10, cc: 25, hsm: 35, plate: 40, cold: 20, coat: 10, seam: 30, strip: 30, weld: 15, finish: 5, asu: 0.1, pp: 150 },
    quench_m3: 0.4,       // m³/t coke, spegnimento a umido
    hydro_m3: 0.05        // m³/t tubi, prova idrostatica
  };

  function InputError(msg, path) { var e = new Error(msg); e.name = 'InputError'; e.path = path; return e; }
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function getPath(o, p) { var ks = p.split('.'); for (var i = 0; i < ks.length; i++) { if (!isObj(o) || !(ks[i] in o)) return undefined; o = o[ks[i]]; } return o; }
  function setPath(o, p, v) { var ks = p.split('.'), last = ks.pop(); ks.forEach(function (k) { if (!isObj(o[k])) o[k] = {}; o = o[k]; }); o[last] = v; }
  function param(path) { for (var i = 0; i < D.params.length; i++) if (D.params[i].path === path) return D.params[i]; return null; }

  // ------------------------------------------------------------------ input
  function defaultInputs(product, route) {
    var o = {};
    D.params.forEach(function (p) { setPath(o, p.path, clone(p.def)); });
    product = product || 'A'; route = route || (product === 'B' ? 'EAF' : 'BF-BOF');
    o.config.product = product; o.config.route = route;
    var pp = D.presets.product[product] || {}, pr = D.presets.route[route] || {};
    Object.keys(pp).forEach(function (k) { setPath(o, k, clone(pp[k])); });
    Object.keys(pr).forEach(function (k) { setPath(o, k, clone(pr[k])); });
    return o;
  }
  // input completi: default della configurazione e della rotta scelte, poi i valori dell'utente
  function completeInputs(user) {
    user = user || {};
    var product = getPath(user, 'config.product'), route = getPath(user, 'config.route');
    if (product !== undefined && ['A', 'B'].indexOf(product) < 0) throw InputError('config.product: configurazione sconosciuta "' + product + '"', 'config.product');
    if (route !== undefined && ['BF-BOF', 'DRI-EAF', 'EAF'].indexOf(route) < 0) throw InputError('config.route: rotta sconosciuta "' + route + '"', 'config.route');
    var o = defaultInputs(product || 'A', route || (product === 'B' ? 'EAF' : 'BF-BOF'));
    D.params.forEach(function (p) { var v = getPath(user, p.path); if (v !== undefined && v !== null && v !== '') setPath(o, p.path, clone(v)); });
    validate(o);
    return o;
  }
  function checkValue(p, v) {
    if (p.options) return p.options.some(function (x) { return x === v; }) ? '' : 'valore non ammesso';
    if (typeof v !== 'number' || !isFinite(v)) return 'serve un numero';
    if (p.min !== null && v < p.min) return 'sotto il minimo ' + p.min;
    if (p.max !== null && v > p.max) return 'sopra il massimo ' + p.max;
    return '';
  }
  function validate(o) {
    D.params.forEach(function (p) {
      var why = checkValue(p, getPath(o, p.path));
      if (why) throw InputError(p.path + ' (' + p.label + '): ' + why, p.path);
    });
    if (o.b8.erw_share + o.b8.sawl_share > 1 + 1e-9) throw InputError('b8.erw_share + b8.sawl_share: la somma delle quote ERW e SAW longitudinale supera 1', 'b8.erw_share');
    return o;
  }

  // ------------------------------------------------------------------ calcolo
  function solve(user) {
    var I = completeInputs(user);
    var c = I.config, A = c.product === 'A', route = c.route, BF = route === 'BF-BOF', DRI = route === 'DRI-EAF', H = c.hours;
    var W = [], blockWarn = {};
    function warn(b, t) { W.push(b + ': ' + t); (blockWarn[b] = blockWarn[b] || []).push(t); }
    var LS = c.capacity_Mt * 1e6;
    var blocks = {}, ledgers = {}, elec = {}, ng = {}, circ = {};
    function addE(b, mwh) { elec[b] = (elec[b] || 0) + mwh; }
    function addNG(b, gj) { ng[b] = (ng[b] || 0) + gj; }
    function addW(b, m3) { circ[b] = (circ[b] || 0) + m3 * I.b11.circ_factor; }
    function ledger(b, ins, outs) {
      var mi = 0, mo = 0, resLabel = null;
      outs = outs.filter(function (x) { if (/per differenza/.test(x[0])) { resLabel = x[0].replace(/ \(per differenza\)/, ''); return false; } return true; });
      ins.forEach(function (x) { mi += x[1]; }); outs.forEach(function (x) { mo += x[1]; });
      ledgers[b] = { items: ins.filter(function (x) { return x[1] > 0; }).map(function (x) { return { side: 'in', item: x[0], t: x[1] }; })
        .concat(outs.filter(function (x) { return x[1] > 0; }).map(function (x) { return { side: 'out', item: x[0], t: x[1] }; })), t_in: mi, t_out: mo, residual: mi - mo, resLabel: resLabel };
    }

    var DR = D.dfRanges.capacity[c.product];
    if (c.capacity_Mt < DR[0] || c.capacity_Mt > DR[1]) warn('Configurazione', 'capacità ' + c.capacity_Mt + ' Mt/anno fuori dal campo tipico della configurazione ' + c.product + ' (' + DR[0] + '–' + DR[1] + ' Mt/anno, DF §1)');
    if (!A && BF) warn('Configurazione', 'la configurazione B (tubi) è descritta con rotta a forno elettrico (DF §1); la rotta BF-BOF è calcolata ma è fuori dalla descrizione');

    // ---------------- B5 metallurgia secondaria: dall'acciaio liquido trattato all'acciaio spillato
    var alloys = LS * I.b5.alloys / 1000, lfLime = LS * K.lf_lime / 1000, lfSlag = LS * I.b5.lf_slag / 1000;
    var tap = LS * (1 + K.skull) - alloys;
    addE('B5', (LS * I.b5.lf_kWh + LS * I.b5.degas_share * I.b5.degas_kWh) / 1000);
    addNG('B5', LS * I.b5.ladle_GJ); addW('B5', LS * K.circ.lf);
    ledger('B5', [['Acciaio spillato', tap], ['Ferroleghe e disossidanti', alloys], ['Calce di siviera', lfLime]],
      [['Acciaio liquido trattato', LS], ['Scoria di siviera', lfSlag], ['Perdite di siviera e paniera (per differenza)', 0]]);

    // ---------------- B6 colata continua
    var y6 = I.b6.yield, cast = LS * y6, ccLoss = LS - cast;
    var lsSlab = A ? LS : LS * I.b8.welded_ls, lsRound = A ? 0 : LS - lsSlab;
    var thin = A && c.caster === 'thin';
    function strandTph(areaM2, v) { return K.rho_steel * areaM2 * v * 60; }
    var cc = { formats: [] };
    if (lsSlab > 0) {
      var thk = (thin ? I.b6.thin_thk : I.b6.slab_thk) / 1000, wid = (thin ? I.b6.thin_w : I.b6.slab_w) / 1000, vv = thin ? I.b6.thin_v : I.b6.slab_v;
      var tphS = strandTph(thk * wid, vv), needS = lsSlab / H, nS = Math.max(1, Math.ceil(needS / (tphS * I.b6.util)));
      cc.formats.push({ kind: thin ? 'Bramme sottili' : 'Bramme', section: (thk * 1000).toFixed(0) + ' × ' + (wid * 1000).toFixed(0) + ' mm', speed: vv, tph_strand: tphS, strands: nS, machines: thin ? nS : Math.ceil(nS / 2), util: needS / (nS * tphS), t: lsSlab * y6 });
    }
    if (lsRound > 0) {
      var dR = I.b6.round_d / 1000, tphR = strandTph(Math.PI * dR * dR / 4, I.b6.round_v), needR = lsRound / H, nR = Math.max(1, Math.ceil(needR / (tphR * I.b6.util)));
      cc.formats.push({ kind: 'Tondi', section: 'Ø ' + I.b6.round_d + ' mm', speed: I.b6.round_v, tph_strand: tphR, strands: nR, machines: Math.ceil(nR / 6), util: needR / (nR * tphR), t: lsRound * y6 });
    }
    cc.formats.forEach(function (f) { if (f.kind === 'Tondi' && f.strands > 6 * f.machines) warn('B6', 'tondi: servono ' + f.strands + ' linee'); });
    addE('B6', LS * 15 / 1000); addW('B6', LS * K.circ.cc);
    var slabs = lsSlab * y6, rounds = lsRound * y6;
    ledger('B6', [['Acciaio liquido trattato', LS]], [[A ? (thin ? 'Bramme sottili' : 'Bramme') : 'Bramme per tubi saldati', slabs], ['Tondi', rounds], ['Spuntature, teste e code (rottame interno)', ccLoss]]);

    // ---------------- B7, B8, B9 linee a valle
    var hc = I.b6.hot_charge * I.b7.hot_saving, scaleT = 0, internalScrap = ccLoss, products = [], oxide = 0, zinc = 0;
    var r7 = {}, r8 = {}, r9 = {}, flow = {};
    function scaleOf(t) { return t * I.b7.scale / 1000; }
    if (A) {
      var plateShare = thin ? 0 : I.b7.plate_share;
      if (thin && I.b7.plate_share > 0) warn('B7', 'con la colata thin slab il treno lamiere non è alimentato: quota al treno lamiere posta a 0');
      var toPlate = slabs * plateShare, toHSM = slabs - toPlate;
      var hrc = toHSM * I.b7.hsm_yield, plates = toPlate * I.b7.plate_yield;
      var sH = scaleOf(toHSM), sP = scaleOf(toPlate), cropH = Math.max(0, toHSM - hrc - sH), cropP = Math.max(0, toPlate - plates - sP);
      if (toHSM - hrc - sH < 0) warn('B7', 'la scaglia supera le perdite di resa del treno nastri: resa o scaglia da rivedere');
      scaleT += sH + sP; internalScrap += cropH + cropP;
      addNG('B7', (thin ? I.b7.tunnel_GJ * toHSM : I.b7.reheat_GJ * (1 - hc) * toHSM) + I.b7.reheat_GJ * (1 - hc) * toPlate);
      addE('B7', (I.b7.hsm_kWh * toHSM + I.b7.plate_kWh * toPlate) / 1000);
      addW('B7', toHSM * K.circ.hsm + toPlate * K.circ.plate);
      var nFur = thin ? cc.formats[0].strands : Math.max(1, Math.ceil(slabs / H / (I.b7.furnace_tph * 0.9)));
      r7 = { toHSM: toHSM, toPlate: toPlate, hrc: hrc, plates: plates, furnaces: nFur, hsm: Math.max(1, Math.ceil(toHSM / 1e6 / I.b7.hsm_Mt)), plateMill: toPlate > 0 ? 1 : 0, scale: sH + sP };
      ledger('B7', [[thin ? 'Bramme sottili' : 'Bramme', slabs]], [['Coil a caldo (HRC)', hrc], ['Lamiere grosse', plates], ['Scaglia di laminazione', sH + sP], ['Spuntature e rifili (rottame interno)', cropH + cropP]]);
      // B8 linee a freddo
      var toCold = hrc * I.b8.cold_share, hrcSold = hrc - toCold;
      var pickled = toCold * I.b8.pickle_yield, ox = toCold * I.b8.oxide / 1000, cropPk = Math.max(0, toCold - pickled - ox * K.fe.oxide);
      var coldOut = pickled * I.b8.cold_yield, cropC = pickled - coldOut, coated = coldOut * I.b8.coated_share, crc = coldOut - coated;
      zinc = coated * I.b8.zinc / 1000; oxide = ox; internalScrap += cropPk + cropC;
      addNG('B8', I.b8.anneal_GJ * coldOut + I.b8.cgl_GJ * coated);
      addE('B8', (I.b8.cold_kWh * toCold + I.b8.anneal_kWh * coldOut) / 1000);
      addW('B8', toCold * K.circ.cold + coldOut * K.circ.coat);
      r8 = { toCold: toCold, coldOut: coldOut, coated: coated + zinc, crc: crc, tcm: toCold > 0 ? Math.ceil(toCold / 1e6 / K.cap.tcm) : 0,
        anneal: coldOut > 0 ? Math.ceil(coldOut / 1e6 / (I.b8.anneal === 'CAL' ? K.cap.cal : K.cap.baf)) : 0, cgl: coated > 0 ? Math.ceil(coated / 1e6 / K.cap.cgl) : 0 };
      ledger('B8', [['Coil a caldo da decapare', toCold], ['Zinco e leghe di rivestimento', zinc]], [['Nastro a freddo (CRC)', crc], ['Zincati e preverniciati', coated + zinc], ['Ossido di ferro (rigenerazione acido)', ox], ['Spuntature e rifili (rottame interno)', cropPk + cropC], ['Ferro disciolto e ossigeno dell\'ossido (per differenza)', 0]]);
      flow = { s13: toCold, s14: hrcSold + plates, s15: crc + coated + zinc };
      products = [['HRC', 'Coil a caldo (HRC)', hrcSold], ['PL', 'Lamiere grosse', plates], ['CRC', 'Coil a freddo (CRC)', crc], ['ZN', 'Zincati e preverniciati', coated + zinc]];
    } else {
      // B7 tubi senza saldatura
      var shells = rounds * I.b7.seam_yield, sS = scaleOf(rounds), cropS = Math.max(0, rounds - shells - sS);
      scaleT += sS; internalScrap += cropS;
      addNG('B7', I.b7.rhf_GJ * (1 - hc) * rounds); addE('B7', I.b7.seam_kWh * rounds / 1000); addW('B7', rounds * K.circ.seam);
      r7 = { rounds: rounds, shells: shells, mills: rounds > 0 ? Math.ceil(rounds / 1e6 / I.b7.seam_Mt) : 0, scale: sS };
      ledger('B7', [['Tondi', rounds]], [['Tubi senza saldatura grezzi', shells], ['Scaglia', sS], ['Spuntature (rottame interno)', cropS]]);
      // B8 tubi saldati
      var coilInt = slabs * I.b8.strip_yield, sSt = scaleOf(slabs), cropSt = Math.max(0, slabs - coilInt - sSt), coilBuy = I.b8.purchased_coil_Mt * 1e6, coil = coilInt + coilBuy;
      var erwIn = coil * I.b8.erw_share, sawlIn = coil * I.b8.sawl_share, sawhIn = coil - erwIn - sawlIn;
      var erw = erwIn * I.b8.erw_yield, sawl = sawlIn * I.b8.saw_yield, sawh = sawhIn * I.b8.saw_yield, cropW = coil - erw - sawl - sawh;
      scaleT += sSt; internalScrap += cropSt + cropW;
      addNG('B8', I.b7.reheat_GJ * (1 - hc) * slabs);
      addE('B8', (I.b8.strip_kWh * slabs + I.b8.erw_kWh * erwIn + I.b8.saw_kWh * (sawlIn + sawhIn)) / 1000);
      addW('B8', slabs * K.circ.strip + coil * K.circ.weld);
      r8 = { slabs: slabs, coilInt: coilInt, coilBuy: coilBuy, erw: erw, sawl: sawl, sawh: sawh, strip: slabs > 0 ? 1 : 0,
        erwLines: erwIn > 0 ? Math.ceil(erwIn / 1e6 / K.cap.erw) : 0, sawlLines: sawlIn > 0 ? Math.ceil(sawlIn / 1e6 / K.cap.sawl) : 0, sawhLines: sawhIn > 0 ? Math.ceil(sawhIn / 1e6 / K.cap.sawh) : 0 };
      if (slabs + coilBuy > 0) ledger('B8', [['Bramme per tubi saldati', slabs], ['Coil e lamiere acquistati', coilBuy]], [['Tubi ERW/HFI', erw], ['Tubi SAW longitudinali', sawl], ['Tubi SAW elicoidali', sawh], ['Scaglia', sSt], ['Spuntature e rifili (rottame interno)', cropSt + cropW]]);
      flow = { s13: slabs, s14: shells, s15: erw + sawl + sawh, s17: coilBuy };
      products = [['SMLS', 'Tubi senza saldatura (OCTG, line pipe)', shells], ['ERW', 'Tubi saldati ERW/HFI', erw], ['SAWL', 'Tubi SAW longitudinali', sawl], ['SAWH', 'Tubi SAW elicoidali', sawh]];
    }
    // B9 finitura
    var finIn = 0, finOut = 0;
    products = products.filter(function (p) { return p[2] > 0; }).map(function (p) { var o = p[2] * I.b9.yield; finIn += p[2]; finOut += o; return { key: p[0], name: p[1], t_in: p[2], t: o }; });
    var cropF = finIn - finOut; internalScrap += cropF;
    var qt = 0, coatT = 0;
    if (!A) {
      qt = (flow.s14 || 0) * I.b9.qt_share; coatT = finIn * I.b9.coat_share;
      addNG('B9', qt * I.b9.qt_GJ + coatT * I.b9.coat_GJ);
      r9 = { qt: qt, coat: coatT, qtLines: qt > 0 ? Math.ceil(qt / 1e6 / K.cap.qt) : 0, coatLines: coatT > 0 ? Math.ceil(coatT / 1e6 / K.cap.coat) : 0 };
    }
    addE('B9', I.b9.kWh * finIn / 1000); addW('B9', finIn * K.circ.finish);
    ledger('B9', products.map(function (p) { return [p.name + ' (da finire)', p.t_in]; }), products.map(function (p) { return [p.name, p.t]; }).concat([['Scarti di finitura (rottame interno)', cropF]]));
    var productTotal = finOut;

    // ---------------- B4 fusione primaria
    var r4 = {}, scrapNeed, hm = 0, driNeed = 0, hbi = 0, slag4, dust = 0, lime4, o2_4, electrode = 0, chargeC = 0, ldgGJ = 0, charge;
    var s_d = BF ? 0 : I.b4.dri_share;
    if (BF) {
      charge = tap / I.b4.bof_yield; hm = charge * I.b4.hm_share; scrapNeed = charge - hm;
      slag4 = tap * I.b4.bof_slag / 1000; lime4 = tap * I.b4.bof_lime / 1000; o2_4 = tap * I.b4.bof_O2;
      ldgGJ = tap * I.b4.ldg_Nm3 * I.b4.ldg_MJ / 1000; dust = tap * I.b4.bof_dust / 1000;
      addE('B4', tap * 25 / 1000); addW('B4', tap * K.circ.bof);
      var capB = I.b4.bof_heat * (H * 60 / I.b4.bof_ttt) * I.b4.availability, nB = Math.max(1, Math.ceil(tap / capB));
      r4 = { unit: 'BOF', n: nB, heat: I.b4.bof_heat, ttt: I.b4.bof_ttt, heats_day: tap / I.b4.bof_heat / (H / 24), util: tap / (nB * capB), kWh_t: 25 };
    } else {
      var mixY = (1 - s_d) * I.b4.scrap_yield + s_d * I.b4.dri_yield;
      charge = tap / mixY; scrapNeed = charge * (1 - s_d); driNeed = charge * s_d;
      if (!DRI) hbi = driNeed;
      var spec = (1 - s_d) * I.b4.eaf_kWh_scrap + s_d * I.b4.eaf_kWh_dri - (DRI && I.b4.hot_dri ? s_d * I.b4.hot_dri_saving : 0) - (I.b4.preheat ? (1 - s_d) * I.b4.preheat_saving : 0);
      if (!DRI && I.b4.hot_dri && s_d > 0) warn('B4', 'l\'HBI acquistato è caricato a freddo: la carica a caldo vale solo per il DRI prodotto nel sito (rotta DRI-EAF)');
      slag4 = tap * (I.b4.eaf_slag + s_d * I.b4.slag_dri) / 1000; lime4 = tap * I.b4.eaf_lime / 1000; o2_4 = tap * I.b4.eaf_O2;
      dust = tap * I.b4.eaf_dust / 1000; electrode = tap * I.b4.electrode / 1000; chargeC = tap * I.b4.charge_C / 1000;
      addE('B4', spec * tap / 1000); addNG('B4', tap * I.b4.eaf_NG); addW('B4', tap * K.circ.eaf);
      var capE = I.b4.eaf_heat * (H * 60 / I.b4.eaf_ttt) * I.b4.availability, nE = Math.max(1, Math.ceil(tap / capE));
      var pOn = spec * I.b4.eaf_heat / (I.b4.eaf_ttt * I.b4.power_on / 60) / 1000; // MW sotto arco
      var mva = Math.ceil(pOn / K.arc_pf / 5) * 5;
      r4 = { unit: 'EAF', n: nE, heat: I.b4.eaf_heat, ttt: I.b4.eaf_ttt, heats_day: tap / I.b4.eaf_heat / (H / 24), util: tap / (nE * capE), kWh_t: spec, P_on_MW: pOn, MVA: mva, svc_Mvar: Math.ceil(mva * I.b10.svc / 5) * 5 };
      if (spec * I.b4.eaf_heat / 1000 > 0 && mva > 320) warn('B4', 'trasformatore del forno di ' + mva + ' MVA: oltre la taglia usuale, valutare più forni o colate più piccole');
    }
    if (r4.util > 0.97) warn('B4', 'utilizzo delle unità di fusione oltre il 97 %');
    var ldBF = BF ? 'Ghisa liquida' : (DRI ? (I.b4.hot_dri ? 'DRI caldo' : 'DRI freddo') : 'HBI acquistato');
    var lime_total = lime4 + lfLime;
    ledger('B4', [[ldBF, hm + driNeed], ['Rottame', scrapNeed], ['Calce', lime4], ['Carbone di carica ed elettrodi', chargeC + electrode]],
      [['Acciaio spillato', tap], ['Scoria di acciaieria', slag4], ['Polveri di abbattimento', dust], ['Ossidazione e gas (per differenza)', 0]]);

    // rottame: interno di ritorno e acquistato
    var scrapBuy = scrapNeed - internalScrap, scrapSold = 0;
    if (scrapBuy < 0) { scrapSold = -scrapBuy; scrapBuy = 0; warn('B1', 'il rottame interno (' + fmt(internalScrap / H, 1) + ' t/h) supera il fabbisogno della carica: ' + fmt(scrapSold / 1e3, 0) + ' kt/anno di rottame venduto'); }

    // ---------------- B3 area primaria
    var r3 = {}, bfDust = 0, bfgGJ = 0, cogGJ = 0, coke = 0, pci = 0, burden = 0, sinter = 0, pelletBF = 0, pelletDR = 0, bfSlag = 0, o2_3 = 0, h2 = 0, trtMWh = 0, cdqMWh = 0, fines = 0, limestoneS = 0, coal = 0, cokeTot = 0;
    var driNG = 0;
    if (BF) {
      coke = hm * I.b3.coke_rate / 1000; pci = hm * I.b3.pci / 1000; burden = hm * I.b3.burden;
      sinter = burden * I.b2.sinter_share; pelletBF = burden - sinter;
      bfSlag = hm * I.b3.bf_slag / 1000; o2_3 = hm * I.b3.bf_O2;
      bfgGJ = hm * I.b3.bfg_Nm3 * I.b3.bfg_MJ / 1000; trtMWh = hm * I.b3.trt_kWh / 1000;
      addE('B3', hm * I.b3.bf_kWh / 1000); addW('B3', hm * K.circ.bf);
      var vTot = hm / (H / 24) / I.b3.bf_prod, nBF = Math.max(1, Math.ceil(vTot / I.b3.bf_max_m3));
      r3 = { unit: 'BF', n: nBF, V_m3: vTot / nBF, hm: hm, hm_tpd: hm / (H / 24) };
      ledger('B3', [['Coke', coke], ['Agglomerato', sinter], ['Pellet e minerale in pezzatura', pelletBF], ['Polverino di carbone (PCI)', pci]],
        [['Ghisa liquida', hm], ['Loppa', bfSlag], ['Polveri e fanghi', bfDust], ['Carbonio e ossigeno al gas d\'altoforno (per differenza)', 0]]);
      // B2 cokeria e agglomerazione
      cokeTot = coke + sinter * I.b2.breeze / 1000; coal = cokeTot * I.b2.coal_per_coke;
      fines = sinter * I.b2.ore_per_sinter; limestoneS = sinter * I.b2.limestone / 1000;
      cogGJ = cokeTot * I.b2.cog_Nm3 * I.b2.cog_MJ / 1000; cdqMWh = I.b2.cdq ? cokeTot * I.b2.cdq_kWh / 1000 : 0;
      addE('B2', (cokeTot * I.b2.coke_kWh + sinter * I.b2.sinter_kWh) / 1000); addW('B2', cokeTot * K.circ.coke + sinter * K.circ.sinter);
      var strandM2 = sinter / (H / 24) / I.b2.sinter_prod;
      blocks.B2 = { coke_t: cokeTot, coal_t: coal, sinter_t: sinter, batteries: Math.max(1, Math.ceil(cokeTot / 1e6 / I.b2.battery_Mt)), strand_m2: strandM2, strands: Math.max(1, Math.ceil(strandM2 / K.cap.strand_m2)), cog_GJ: cogGJ };
      var ledB2a = [['Carbone da coke', coal], ['Fini di minerale', fines], ['Calcare e dolomite', limestoneS]];
      var ledB2b = [['Coke all\'altoforno', coke], ['Agglomerato', sinter], ['Gas di cokeria, sottoprodotti e CO₂ di calcinazione (per differenza)', 0]];
      ledger('B2', ledB2a, ledB2b);
    } else if (DRI) {
      pelletDR = driNeed * I.b3.pellet_per_dri;
      driNG = driNeed * I.b3.dri_GJ * (1 - I.b3.h2_frac); h2 = driNeed * I.b3.h2_kg * I.b3.h2_frac / 1000; // t H₂
      addNG('B3', driNG); addE('B3', driNeed * I.b3.dri_kWh / 1000 + (I.b3.h2_onsite ? h2 * 1000 * I.b3.electrolyser_kWh / 1000 : 0)); addW('B3', driNeed * K.circ.dri);
      r3 = { unit: 'DRI', n: Math.max(1, Math.ceil(driNeed / 1e6 / I.b3.dri_module_Mt)), dri: driNeed, electrolyser_MW: I.b3.h2_onsite ? h2 * 1000 * I.b3.electrolyser_kWh / 1000 / H : 0, h2_t: h2 };
      ledger('B3', [['Pellet di grado DR', pelletDR]], [[I.b4.hot_dri ? 'DRI caldo' : 'DRI freddo', driNeed], ['Ossigeno rimosso, fini e polveri (per differenza)', 0]]);
      if (I.b3.h2_frac > 0 && !I.b3.h2_onsite) warn('B3', fmt(h2 * 1000 / H, 0) + ' kg/h di idrogeno acquistato: emissioni e costi della produzione dell\'idrogeno fuori dal perimetro');
    }

    // ---------------- B11 calce, gas tecnici, acqua
    var kilnLimestone = I.b11.lime_kiln ? lime_total * K.caco3_per_cao : 0;
    if (I.b11.lime_kiln) { addNG('B11', lime_total * I.b11.lime_GJ); addE('B11', lime_total * K.lime_kWh / 1000); }
    var o2 = o2_3 + o2_4 + LS * K.caster_O2, n2 = LS * I.b11.n2, ar = LS * I.b5.argon;
    addE('B11', o2 * I.b11.asu_kWh / 1000);
    addW('B11', o2 * K.circ.asu);
    var o2tpd = o2 / H * 1.429 * 24 / 1000 * I.b11.o2_peak;

    // ---------------- B12 fumi
    var fume = BF ? tap * I.b12.fume_bof : tap * I.b12.fume_eaf;
    addE('B12', fume / 1000 * I.b12.fan_kWh / 1000);
    var stackDust = fume * I.b12.dust_mg / 1e9;

    // ---------------- B10 gas di recupero e centrale
    var bfgPP = bfgGJ * (1 - I.b10.bfg_internal), cogPP = cogGJ * (1 - I.b10.cog_internal), recGJ = bfgPP + cogPP + ldgGJ;
    var ppMWh = recGJ * I.b10.pp_eta / 3.6;
    addW('B10', ppMWh * K.circ.pp);
    addE('B10', LS * I.b10.services_kWh / 1000);

    // acqua: pompaggio come carico di B11
    var circTot = 0; Object.keys(circ).forEach(function (k) { circTot += circ[k]; });
    var tubesT = A ? 0 : finIn;
    var makeup = circTot * I.b11.makeup + (BF && !I.b2.cdq ? cokeTot * K.quench_m3 : 0) + tubesT * K.hydro_m3;
    addE('B11', circTot * I.b11.pump_kWh / 1000);

    // nastri, stacker-reclaimer e carriponti del parco
    addE('B1', (fines + pelletBF + pelletDR + coal + pci + scrapBuy + hbi) * 3 / 1000);

    // ---------------- energia elettrica
    var eTot = 0; Object.keys(elec).forEach(function (k) { eTot += elec[k]; });
    var eLoss = eTot * I.b10.losses, eDemand = eTot + eLoss, ownGen = ppMWh + trtMWh + cdqMWh, gridImport = eDemand - ownGen;
    var arcAvg = BF ? 0 : (elec.B4 || 0) / H;
    var otherAvg = (eDemand / H) - arcAvg;
    var peakMW = otherAvg * I.b10.peak + (BF ? 0 : r4.n * r4.P_on_MW);
    var subMVA = Math.ceil(peakMW / I.b10.pf / 50) * 50;
    var r10 = { pp_MW: ppMWh / H, trt_MW: trtMWh / H, cdq_MW: cdqMWh / H, ownGen_MW: ownGen / H, demand_MW: eDemand / H, grid_MW: gridImport / H, peak_MW: peakMW, substation_MVA: subMVA,
      kV: subMVA > 400 || (!BF && r4.MVA > 150) ? '380–400 kV' : '220 kV', recGJ: recGJ, bfg_GJ: bfgGJ, cog_GJ: cogGJ, ldg_GJ: ldgGJ };
    if (gridImport < 0) warn('B10', 'autoproduzione superiore alla domanda: ' + fmt(-gridImport / H, 1) + ' MW medi esportati in rete');

    // ---------------- gas naturale
    var ngTot = 0; Object.keys(ng).forEach(function (k) { ngTot += ng[k]; });
    var ngSm3h = ngTot * 1000 / I.site.ng_LHV / H;

    // ---------------- bilancio del carbonio e CO₂ diretta
    var C = [], f = 44 / 12;
    function cIn(name, area, tC) { if (tC > 0) C.push({ name: name, area: area, tC: tC }); }
    cIn('Carbone da coke', 'Cokeria, altoforno e centrale a gas di recupero', coal * I.b2.coal_C * (1 - I.b2.byprod_C));
    cIn('Carbone da iniezione (PCI)', 'Cokeria, altoforno e centrale a gas di recupero', pci * I.b3.pci_C);
    cIn('Gas naturale al DRI', 'Riduzione diretta', driNG * I.site.ng_C / 1000);
    cIn('Elettrodi e carbone di carica', 'Acciaieria', (electrode + LS * I.b5.lf_electrode / 1000) * 0.99 + chargeC * 0.85);
    cIn('Carbonio dell\'HBI acquistato', 'Acciaieria', hbi * I.b3.dri_C);
    cIn('Carbonio del rottame acquistato', 'Acciaieria', scrapBuy * K.scrap_C);
    cIn('Gas naturale in acciaieria (bruciatori, siviere)', 'Acciaieria', ((ng.B4 || 0) + (ng.B5 || 0)) * I.site.ng_C / 1000);
    cIn('Gas naturale ai forni di riscaldo e trattamento', 'Laminazione, tubi e finitura', ((ng.B7 || 0) + (ng.B8 || 0) + (ng.B9 || 0)) * I.site.ng_C / 1000);
    cIn('Calcinazione di calcare e dolomite', 'Agglomerazione e forni a calce', (limestoneS + kilnLimestone) * K.caco3_C);
    cIn('Gas naturale ai forni a calce', 'Agglomerazione e forni a calce', (ng.B11 || 0) * I.site.ng_C / 1000);
    var cOut = (productTotal + scrapSold) * K.steel_C;
    var cInTot = C.reduce(function (s, x) { return s + x.tC; }, 0);
    var co2Direct = (cInTot - cOut) * f;
    var co2Indirect = Math.max(0, gridImport) * I.site.grid_CO2; // MWh × kg/kWh = t
    var byArea = {};
    C.forEach(function (x) { byArea[x.area] = (byArea[x.area] || 0) + x.tC * f; });
    byArea['Carbonio nei prodotti (sottratto)'] = -cOut * f;

    // ---------------- B1 parco e logistica
    var day = H / 24;
    var stocks = [['Fini di minerale', fines], ['Pellet', pelletBF + pelletDR], ['Carbone da coke e da iniezione', coal + pci], ['Rottame acquistato', scrapBuy], ['HBI acquistato', hbi], ['Calcare, dolomite, calce', limestoneS + kilnLimestone + (I.b11.lime_kiln ? 0 : lime_total)], ['Ferroleghe e additivi', alloys]]
      .filter(function (x) { return x[1] > 0; }).map(function (x) { return { name: x[0], t_y: x[1], stock_t: x[1] / day * I.b1.autonomy_d }; });
    var stockTot = stocks.reduce(function (s, x) { return s + x.stock_t; }, 0);
    blocks.B1 = { stocks: stocks, stock_t: stockTot, yard_m2: stockTot / I.b1.yard_t_m2, internalScrap: internalScrap, scrapBuy: scrapBuy, scrapSold: scrapSold };
    var inB1 = [['Fini di minerale', fines], ['Pellet', pelletBF + pelletDR], ['Carbone', coal + pci], ['Rottame acquistato', scrapBuy], ['Rottame interno di ritorno', Math.min(internalScrap, scrapNeed)], ['HBI acquistato', hbi], ['Calcare e dolomite', limestoneS + kilnLimestone]];
    var outB1 = BF ? [['Fini, carbone e calcare a cokeria e agglomerazione', fines + coal + limestoneS], ['Pellet e PCI all\'altoforno', pelletBF + pci], ['Rottame e HBI all\'acciaieria', scrapNeed + hbi], ['Calcare ai forni a calce', kilnLimestone]]
      : [['Pellet al reattore DRI', pelletDR], ['Rottame e HBI all\'acciaieria', scrapNeed + hbi], ['Calcare ai forni a calce', kilnLimestone]];
    ledger('B1', inB1, outB1);

    // ---------------- sottoprodotti
    var byp = [['Loppa granulata', 'Altoforno', bfSlag, 'Cementifici'], ['Scoria di acciaieria', BF ? 'BOF, LF' : 'EAF, LF', slag4 + lfSlag, 'Inerti stradali, riciclo interno'],
      ['Polveri e fanghi d\'altoforno', 'Altoforno', bfDust, 'Riciclo in agglomerazione'],
      ['Polveri di abbattimento', BF ? 'BOF' : 'EAF', dust, BF ? 'Riciclo in agglomerazione o recupero' : 'Recupero zinco (processo Waelz)'], ['Scaglia di laminazione', 'Laminatoi, colata', scaleT, 'Riciclo in agglomerazione o vendita'],
      ['Ossido di ferro', 'Rigenerazione acido', oxide, 'Vendita (ferriti, pigmenti)'], ['Rottame interno eccedente', 'Linee a valle', scrapSold, 'Vendita']]
      .filter(function (x) { return x[2] > 0; }).map(function (x) { return { name: x[0], origin: x[1], t: x[2], dest: x[3], kg_t: x[2] / LS * 1000 }; });
    var bypTot = byp.reduce(function (s, x) { return s + x.t; }, 0);
    ledger('B12', byp.map(function (x) { return [x.name + ' (' + x.origin + ')', x.t]; }), byp.map(function (x) { return [x.name + ' – ' + x.dest, x.t]; }));

    // ---------------- bilancio del ferro di stabilimento
    var feIn = [['Fini di minerale', fines * I.b1.fines_Fe], ['Pellet', (pelletBF + pelletDR) * I.b1.pellet_Fe], ['Rottame acquistato', scrapBuy * I.b1.scrap_Fe], ['HBI acquistato', hbi * K.fe.hbi], ['Coil e lamiere acquistati', (flow.s17 || 0) * K.fe.coil]];
    var feOut = [['Prodotti finiti', productTotal * K.fe.steel], ['Loppa', bfSlag * K.fe.slag_bf], ['Scoria di acciaieria', slag4 * (BF ? K.fe.slag_bof : K.fe.slag_eaf) + lfSlag * K.fe.slag_lf], ['Polveri e fanghi', dust * (BF ? K.fe.bof_dust : K.fe.dust) + bfDust * K.fe.bf_dust], ['Scaglia', scaleT * K.fe.scale], ['Ossido di ferro', oxide * K.fe.oxide], ['Rottame venduto', scrapSold * K.fe.steel]];
    var feI = feIn.reduce(function (s, x) { return s + x[1]; }, 0), feO = feOut.reduce(function (s, x) { return s + x[1]; }, 0);
    // il pellet del BF entra come pellet; l'agglomerato come fini: il ferro dell'agglomerato è nei fini
    var feRes = (feI - feO) / feI;
    if (feRes < -0.005) warn('Bilancio del ferro', 'esce più ferro di quanto ne entri (' + fmt(feRes * 100, 1) + ' % del ferro in ingresso): carica ferrosa, tenori o rese incoerenti');
    else if (feRes > 0.05) warn('Bilancio del ferro', 'perdite di ferro non ripartite pari al ' + fmt(feRes * 100, 1) + ' % del ferro in ingresso: oltre il 5 %, tenori o rese da rivedere');
    ledgers.Fe = { items: feIn.filter(function (x) { return x[1] > 0; }).map(function (x) { return { side: 'in', item: 'Fe – ' + x[0], t: x[1] }; }).concat(feOut.filter(function (x) { return x[1] > 0; }).map(function (x) { return { side: 'out', item: 'Fe – ' + x[0], t: x[1] }; })), t_in: feI, t_out: feO, residual: feI - feO };

    // ---------------- utilities e carichi
    var BN = { B1: 'Parco materie prime', B2: 'Cokeria e agglomerazione', B3: BF ? 'Altoforno' : (DRI ? 'Impianto DRI' : 'Area primaria'), B4: BF ? 'Convertitori (BOF)' : 'Forno elettrico (EAF)', B5: 'Metallurgia secondaria', B6: 'Colata continua', B7: A ? 'Laminazione a caldo' : 'Tubi senza saldatura', B8: A ? 'Linee a freddo e rivestimenti' : 'Tubi saldati', B9: 'Finitura e spedizione', B10: 'Servizi generali', B11: 'ASU, pompaggi, forni a calce', B12: 'Captazione fumi' };
    var loads = Object.keys(elec).filter(function (k) { return elec[k] > 0; }).sort(function (a, b) { return +a.slice(1) - +b.slice(1); }).map(function (k) { return { block: k, item: BN[k], MWh: elec[k], MW: elec[k] / H, kWh_t: elec[k] * 1000 / LS }; });
    var ngList = Object.keys(ng).filter(function (k) { return ng[k] > 0; }).sort(function (a, b) { return +a.slice(1) - +b.slice(1); }).map(function (k) { return { block: k, item: BN[k], GJ: ng[k], MW: ng[k] / H / 3.6, Sm3h: ng[k] * 1000 / I.site.ng_LHV / H, GJ_t: ng[k] / LS }; });
    var waterList = Object.keys(circ).filter(function (k) { return circ[k] > 0; }).sort(function (a, b) { return +a.slice(1) - +b.slice(1); }).map(function (k) { return { block: k, item: BN[k], m3h: circ[k] / H }; });

    // ---------------- energia primaria
    var energy = { coal_GJ: (coal + pci) * 29, ng_GJ: ngTot, h2_GJ: h2 * 120, grid_GJ: Math.max(0, gridImport) * 3.6, electrodes_GJ: (electrode + chargeC) * 32 };
    energy.total_GJ = energy.coal_GJ + energy.ng_GJ + energy.h2_GJ + energy.grid_GJ + energy.electrodes_GJ;

    // ---------------- correnti
    var S = {};
    function st(id, name, cls, from, to, t_y, extra) { var o = { id: id, name: name, cls: cls, from: from, to: to, t_h: t_y === null ? null : t_y / H }; if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; }); S[id] = o; }
    if (BF) st('S01', 'Fini di minerale e pellet', 'solid', null, 'B1', fines + pelletBF, { note: 'nave o treno' });
    else if (DRI) st('S01', 'Pellet di grado DR', 'solid', null, 'B1', pelletDR, { note: 'nave o treno' });
    if (BF) st('S02', 'Carbone da coke e da iniezione', 'solid', null, 'B1', coal + pci);
    if (scrapBuy > 0) st('S03', 'Rottame acquistato', 'solid', null, 'B1', scrapBuy, { note: 'camion o treno, controllo radioattività' });
    if (hbi > 0) st('S04', 'HBI acquistato', 'solid', null, 'B1', hbi);
    st('S05', I.b11.lime_kiln ? 'Calcare e dolomite' : 'Calcare e calce acquistata', 'solid', null, 'B1', limestoneS + kilnLimestone + (I.b11.lime_kiln ? 0 : lime_total));
    if (BF) {
      st('S06', 'Fini, carbone e fondenti', 'solid', 'B1', 'B2', fines + coal + limestoneS);
      st('S07', 'Coke, agglomerato, pellet e PCI', 'solid', 'B2', 'B3', coke + sinter + pelletBF + pci);
      st('S08', 'Ghisa liquida', 'metal', 'B3', 'B4', hm, { T: I.b3.hm_T });
    } else if (DRI) {
      st('S07', 'Pellet al reattore', 'solid', 'B1', 'B3', pelletDR);
      st('S08', I.b4.hot_dri ? 'DRI caldo' : 'DRI freddo', I.b4.hot_dri ? 'metal' : 'solid', 'B3', 'B4', driNeed, { T: I.b4.hot_dri ? I.b3.dri_T : 25 });
    }
    st('S09', BF || DRI ? 'Rottame alla carica' : 'Rottame e HBI alla carica', 'solid', 'B1', 'B4', scrapNeed + hbi, { note: 'compreso il rottame interno' });
    st('S10', 'Acciaio spillato', 'metal', 'B4', 'B5', tap, { T: 1640 });
    st('S11', 'Acciaio liquido trattato', 'metal', 'B5', 'B6', LS, { T: 1580 });
    if (A) {
      st('S12', thin ? 'Bramme sottili' : 'Bramme', 'semi', 'B6', 'B7', slabs, { T: thin ? 1050 : null });
      if (flow.s13 > 0) st('S13', 'Coil a caldo al decapaggio', 'semi', 'B7', 'B8', flow.s13);
      st('S14', 'HRC e lamiere grosse', 'semi', 'B7', 'B9', flow.s14);
      if (flow.s15 > 0) st('S15', 'CRC, zincati e preverniciati', 'semi', 'B8', 'B9', flow.s15);
    } else {
      if (rounds > 0) st('S12', 'Tondi', 'semi', 'B6', 'B7', rounds);
      if (flow.s13 > 0) st('S13', 'Bramme per tubi saldati', 'semi', 'B6', 'B8', flow.s13);
      if (flow.s14 > 0) st('S14', 'Tubi senza saldatura grezzi', 'semi', 'B7', 'B9', flow.s14);
      if (flow.s15 > 0) st('S15', 'Tubi saldati', 'semi', 'B8', 'B9', flow.s15);
      if (flow.s17 > 0) st('S17', 'Coil e lamiere acquistati', 'semi', null, 'B8', flow.s17);
    }
    st('S16', 'Prodotti spediti', 'semi', 'B9', null, productTotal, { note: 'ferrovia, camion, banchina' });
    if (BF) st('S18', 'Gas di recupero alla centrale', 'gas', 'B3', 'B10', null, { MW: recGJ / H / 3.6, note: 'BFG ' + fmt(bfgPP / H / 3.6, 0) + ' MW, COG ' + fmt(cogPP / H / 3.6, 0) + ' MW, LDG ' + fmt(ldgGJ / H / 3.6, 0) + ' MW' });
    if (h2 > 0 && !I.b3.h2_onsite) st('S26', 'Idrogeno acquistato', 'gas', null, 'B3', h2, { note: 'per il reattore DRI' });
    st('S19', 'Gas naturale', 'gas', null, 'B11', null, { MW: ngTot / H / 3.6, Sm3h: ngSm3h });
    st('S20', 'Ossigeno alle aree', 'tech', 'B11', null, null, { Nm3h: o2 / H, note: 'azoto ' + fmt(n2 / H, 0) + ' Nm³/h, argon ' + fmt(ar / H, 0) + ' Nm³/h' });
    st('S21', 'Acqua di reintegro', 'water', null, 'B11', null, { m3h: makeup / H });
    st('S22', 'Scorie, polveri e scaglie', 'by', null, 'B12', bypTot - scrapSold);
    st('S23', 'Fumi depurati al camino', 'flue', 'B12', null, null, { Nm3h: fume / H, note: 'CO₂ diretta di stabilimento ' + fmt(co2Direct / H, 0) + ' t/h' });
    st('S24', 'Sottoprodotti a recupero e vendita', 'by', 'B12', null, bypTot);
    st('S25', 'Rottame interno di ritorno', 'solid', 'B6–B9', 'B1', internalScrap);
    st('E1', gridImport >= 0 ? 'Energia elettrica dalla rete' : 'Energia elettrica in rete (esportata)', 'elec', null, 'B10', null, { MW: gridImport / H });
    if (ownGen > 0) st('E2', 'Autoproduzione (centrale, TRT, CDQ)', 'elec', 'B10', 'B10', null, { MW: ownGen / H });
    st('E3', 'Energia elettrica alle aree', 'elec', 'B10', null, null, { MW: eDemand / H });

    // ---------------- dimensioni principali e risultati per blocco
    var cast_util = cc.formats.map(function (q) { return q.util; });
    blocks.B3 = r3; blocks.B4 = r4; blocks.B6 = cc; blocks.B7 = r7; blocks.B8 = r8; blocks.B9 = r9; blocks.B10 = r10;
    blocks.B5 = { lf: Math.max(1, Math.ceil(r4.heats_day * K.lf_time / (1440 * 0.85))), degas: I.b5.degas_share > 0 ? Math.max(1, Math.ceil(r4.heats_day * I.b5.degas_share * K.degas_time / (1440 * 0.85))) : 0, degas_type: I.b5.degas_type, alloys: alloys };
    blocks.B11 = { o2_Nm3h: o2 / H, o2_tpd: o2tpd, asu: Math.max(1, Math.ceil(o2tpd / K.cap.asu)), n2_Nm3h: n2 / H, ar_Nm3h: ar / H, circ_m3h: circTot / H, makeup_m3h: makeup / H, ng_Sm3h: ngSm3h, ng_MW: ngTot / H / 3.6, lime_tpd: lime_total / day, kilns: I.b11.lime_kiln ? Math.max(1, Math.ceil(lime_total / day / K.cap.kiln)) : 0 };
    blocks.B12 = { fume_Nm3h: fume / H, stack_dust_t_y: stackDust, byproducts: byp };

    var indicators = {
      LS_t: LS, tap_t: tap, product_t: productTotal, yield_products: productTotal / LS, yield_LS_HRC: A ? y6 * I.b7.hsm_yield : null,
      charge_t_t: charge / LS, metallic: { hm: hm, dri: DRI ? driNeed : 0, hbi: hbi, scrap: scrapNeed, scrapBuy: scrapBuy, internalScrap: internalScrap },
      elec_MWh: eDemand, elec_kWh_t: eDemand * 1000 / LS, elec_MW: eDemand / H, grid_MW: gridImport / H, ownGen_MW: ownGen / H,
      meltshop_kWh_t: ((elec.B4 || 0) + LS * I.b5.lf_kWh / 1000) * 1000 / LS,
      ng_GJ: ngTot, ng_GJ_t: ngTot / LS, ng_MW: ngTot / H / 3.6, h2_t: h2,
      o2_Nm3_t: o2 / LS, water_m3_t: makeup / LS, makeup_m3h: makeup / H,
      co2_direct_t: co2Direct, co2_direct_t_t: co2Direct / LS, co2_indirect_t: co2Indirect, co2_total_t_t: (co2Direct + co2Indirect) / LS, co2_per_product: (co2Direct + co2Indirect) / productTotal,
      energy_GJ_t: energy.total_GJ / LS, byproducts_kg_t: bypTot / LS * 1000, cast_util: cast_util
    };

    // confronto con la DF §12.1
    var R = D.dfRanges[route], checks = [];
    function chk(name, val, rng, unit, d) { checks.push({ name: name, value: val, range: rng, unit: unit, d: d, ok: rng ? val >= rng[0] - 1e-9 && val <= rng[1] + 1e-9 : null }); }
    if (BF) chk('Carica ferrosa dell\'altoforno', I.b3.burden, R.charge.slice(0, 2), 't minerale/t ghisa', 2);
    else if (DRI) chk('Pellet per DRI', I.b3.pellet_per_dri, R.charge.slice(0, 2), 't pellet/t DRI', 2);
    if (!BF) chk('Carica metallica del forno elettrico', charge / LS, route === 'EAF' && s_d === 0 ? R.charge.slice(0, 2) : null, 't/t acciaio liquido', 3);
    chk('Energia elettrica all\'acciaieria (fusione e siviera)', indicators.meltshop_kWh_t, route === 'EAF' && s_d > 0 ? null : R.elec, 'kWh/t', 0);
    chk('Emissioni dirette di CO₂', indicators.co2_direct_t_t, R.co2, 't/t acciaio liquido', 2);
    chk('Emissioni di CO₂ dirette e indirette (rete)', indicators.co2_total_t_t, R.co2, 't/t acciaio liquido', 2);
    if (A) chk('Resa acciaio liquido → HRC', indicators.yield_LS_HRC, D.dfRanges.yieldHRC, '', 3);
    chk('Capacità di acciaio liquido', c.capacity_Mt, D.dfRanges.capacity[c.product], 'Mt/anno', 2);
    chk('Autonomia del parco materie prime', I.b1.autonomy_d, [30, 60], 'giorni', 0);

    var res = { version: VERSION, inputs: I, blocks: blocks, streams: S, ledgers: ledgers, loads: loads, ng: ngList, water: waterList, products: products, byproducts: byp,
      co2: { sources: C.map(function (x) { return { name: x.name, area: x.area, t: x.tC * f }; }), C_out_t: cOut * f, direct_t: co2Direct, indirect_t: co2Indirect, byArea: byArea },
      energy: energy, indicators: indicators, checks: checks, warnings: W, blockWarnings: blockWarn, names: BN };
    return res;
  }

  function fmt(v, d) { return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }); }

  // blocchi della configurazione
  function blocksFor(I) {
    var b = ['B1'];
    if (I.config.route === 'BF-BOF') b.push('B2', 'B3');
    else if (I.config.route === 'DRI-EAF') b.push('B3');
    b.push('B4', 'B5', 'B6');
    if (I.config.product === 'A') b.push('B7', 'B8');
    else { if (I.b8.welded_ls < 1) b.push('B7'); if (I.b8.welded_ls > 0 || I.b8.purchased_coil_Mt > 0) b.push('B8'); }
    b.push('B9', 'B10', 'B11', 'B12');
    return b;
  }

  return { VERSION: VERSION, K: K, solve: solve, completeInputs: completeInputs, defaultInputs: defaultInputs, validate: validate, checkValue: checkValue, param: param, blocksFor: blocksFor, getPath: getPath, setPath: setPath, clone: clone };
});
