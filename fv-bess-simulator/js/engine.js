/*
 * FV+BESS Simulator – motore di calcolo (browser e Node).
 *  1. meteo orario sintetico da medie mensili (Erbs + Hay-Davies)
 *  2. produzione FV oraria (fisso, tracker monoassiale, falda, est-ovest; bifacciale)
 *  3. carico industriale orario e prezzi orari (forma "duck curve")
 *  4. dispacciamento BESS (autoconsumo, arbitraggio con scelta giornaliera, peak shaving)
 *  5. simulazione pluriennale con degrado FV/BESS e augmentation
 *  6. CAPEX, OPEX, incentivi, fiscalità, debito, NPV/IRR/LCOE/LCOS, sensitività
 *  7. calcoli di ingegneria (stringhe, cavi, trasformatori, BESS, protezioni, MDR)
 * Convenzioni: ora solare CET senza ora legale, anno non bisestile (8760 h), potenze in kW, energie in kWh.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./data.js'));
  else root.FVB = factory(root.FVB_DATA);
})(typeof self !== 'undefined' ? self : this, function (D) {
  'use strict';

  const H = 8760, DEG = Math.PI / 180;
  const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const MONTH_START = MONTH_DAYS.reduce((a, d, i) => (a.push(i ? a[i - 1] + MONTH_DAYS[i - 1] : 0), a), []);
  const monthOfDay = d => { let m = 0; while (m < 11 && d >= MONTH_START[m + 1]) m++; return m; };

  // ---------- utilità ----------
  function rng(seed) { // mulberry32
    let a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const clone = o => JSON.parse(JSON.stringify(o));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sum = a => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };
  function mergeDeep(base, over) {
    if (over === undefined || over === null) return base;
    if (Array.isArray(base) || typeof base !== 'object' || base === null) return over;
    const out = Object.assign({}, base);
    for (const k of Object.keys(over)) out[k] = (k in base) ? mergeDeep(base[k], over[k]) : over[k];
    return out;
  }
  function defaultConfig() {
    const c = clone(D.DEFAULTS);
    c.incentives = clone(D.INCENTIVE_CATALOG);
    return c;
  }
  function normalizeConfig(cfg) {
    cfg = cfg ? clone(cfg) : {}; // mai condividere array/oggetti con la configurazione del chiamante
    const c = mergeDeep(defaultConfig(), cfg);
    if (cfg && Array.isArray(cfg.incentives)) { // unisce per id con il catalogo
      const cat = clone(D.INCENTIVE_CATALOG);
      c.incentives = cat.map(i => Object.assign(i, cfg.incentives.find(x => x.id === i.id) || {}))
        .concat(cfg.incentives.filter(x => !cat.find(i => i.id === x.id)));
    }
    return c;
  }
  function dayOfWeek(year, doy) { return new Date(Date.UTC(year, 0, 1 + doy)).getUTCDay(); } // 0 = domenica

  // ---------- 1. meteo ----------
  function sunVector(lat, decl, omega) {
    const sz = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(omega);
    const sx = -Math.cos(decl) * Math.sin(omega);                                             // est +
    const sy = Math.cos(lat) * Math.sin(decl) - Math.sin(lat) * Math.cos(decl) * Math.cos(omega); // nord +
    return [sx, sy, sz];
  }
  function buildWeather(site, seed) {
    const lat = site.lat * DEG, r = rng(seed || 1);
    const G0h = new Float64Array(H), sun = new Float64Array(H * 3), ghi = new Float64Array(H), ta = new Float64Array(H);
    const H0d = new Float64Array(365);
    for (let d = 0; d < 365; d++) {
      const n = d + 1, decl = 23.45 * DEG * Math.sin(2 * Math.PI * (284 + n) / 365);
      const B = 2 * Math.PI * (n - 81) / 364, eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
      const E0 = 1 + 0.033 * Math.cos(2 * Math.PI * n / 365);
      for (let h = 0; h < 24; h++) {
        let g = 0, vx = 0, vy = 0, vz = 0;
        for (let k = 0; k < 6; k++) { // sotto-campionamento 10 min
          const t = h + (k + 0.5) / 6 + (4 * (site.lon - 15) + eot) / 60;
          const s = sunVector(lat, decl, 15 * DEG * (t - 12));
          if (s[2] > 0) { g += s[2]; vx += s[0] * s[2]; vy += s[1] * s[2]; vz += s[2] * s[2]; }
        }
        const i = d * 24 + h;
        G0h[i] = 1.367 * E0 * g / 6; // kWh/m2 nell'ora
        if (g > 0) { const nrm = Math.hypot(vx, vy, vz); sun[3 * i] = vx / nrm; sun[3 * i + 1] = vy / nrm; sun[3 * i + 2] = vz / nrm; }
        H0d[d] += G0h[i];
      }
    }
    // indice di serenità giornaliero: AR(1) attorno al valore mensile, poi riscalato per conservare la media mensile
    const kd = new Float64Array(365); let z = 0;
    for (let m = 0; m < 12; m++) {
      let H0m = 0; for (let d = MONTH_START[m]; d < MONTH_START[m] + MONTH_DAYS[m]; d++) H0m += H0d[d];
      const Ktm = site.ghi[m] * MONTH_DAYS[m] / H0m, sd = 0.10 + 0.25 * (0.75 - Ktm);
      for (let d = MONTH_START[m]; d < MONTH_START[m] + MONTH_DAYS[m]; d++) { z = 0.55 * z + Math.sqrt(1 - 0.55 * 0.55) * gauss(r); kd[d] = clamp(Ktm * (1 + sd * z), 0.04, 0.78); }
      for (let it = 0; it < 6; it++) {
        let Hm = 0; for (let d = MONTH_START[m]; d < MONTH_START[m] + MONTH_DAYS[m]; d++) Hm += kd[d] * H0d[d];
        const f = site.ghi[m] * MONTH_DAYS[m] / Hm;
        for (let d = MONTH_START[m]; d < MONTH_START[m] + MONTH_DAYS[m]; d++) kd[d] = clamp(kd[d] * f, 0.04, 0.80);
      }
    }
    for (let d = 0; d < 365; d++) {
      const m = monthOfDay(d), tm = site.t[m], amp = 4 + 2.5 * kd[d];
      for (let h = 0; h < 24; h++) {
        const i = d * 24 + h, noise = kd[d] < 0.45 ? clamp(1 + 0.25 * gauss(r), 0.4, 1.6) : 1;
        ghi[i] = Math.min(G0h[i] * kd[d] * noise, G0h[i] * 0.82);
        ta[i] = tm + amp * Math.cos(2 * Math.PI * (h - 14.5) / 24);
      }
    }
    return { G0h, sun, ghi, ta, site };
  }
  function erbsDiffuse(kt) {
    if (kt <= 0.22) return 1 - 0.09 * kt;
    if (kt <= 0.80) return 0.9511 - 0.1604 * kt + 4.388 * kt * kt - 16.638 * kt ** 3 + 12.336 * kt ** 4;
    return 0.165;
  }
  // irraggiamento sul piano (kWh/m2 nell'ora) con normale n e inclinazione beta
  function poa(i, w, n, beta, albedo) {
    const G = w.ghi[i]; if (G <= 0) return 0;
    const sx = w.sun[3 * i], sy = w.sun[3 * i + 1], sz = w.sun[3 * i + 2];
    const kt = clamp(G / w.G0h[i], 0, 1), Dh = G * erbsDiffuse(kt), Bh = G - Dh;
    const cosT = n[0] * sx + n[1] * sy + n[2] * sz, Rb = cosT > 0 ? cosT / Math.max(sz, 0.065) : 0;
    const Ai = clamp(Bh / w.G0h[i], 0, 1), cb = Math.cos(beta);
    return Math.max(0, Bh * Rb + Dh * (Ai * Rb + (1 - Ai) * (1 + cb) / 2) + G * albedo * (1 - cb) / 2);
  }
  const normal = (beta, gamma) => [-Math.sin(beta) * Math.sin(gamma), -Math.sin(beta) * Math.cos(gamma), Math.cos(beta)];

  // ---------- 2. FV ----------
  // restituisce potenza AC (kW per kWp DC) e irraggiamento sul piano dei moduli
  function pvModel(pv, w) {
    const mod = D.MODULES[pv.module] || D.MODULES.topcon620, inv = D.INVERTERS[pv.inverter] || D.INVERTERS.str350;
    const L = pv.losses, ac = new Float64Array(H), poaArr = new Float64Array(H), dcArr = new Float64Array(H);
    const dcLoss = (1 - L.soiling / 100) * (1 - L.shading / 100) * (1 - L.mismatch / 100) * (1 - L.dcCable / 100);
    const acLoss = (1 - L.acCable / 100) * (1 - L.transformer / 100) * (L.availability / 100);
    const yieldFactor = pv.yieldFactor || 1;
    const ground = pv.mount === 'ground_fixed' || pv.mount === 'tracker';
    const bif = ground && pv.bifacial ? (mod.bifaciality || 0) : 0;
    const kTemp = pv.mount === 'tracker' ? 0.95 : ground ? 1.0 : pv.mount === 'roof_ew' ? 1.2 : 1.12;
    const acLim = 1 / pv.dcac, invEff = inv.eff;
    const trackerLoss = pv.mount === 'tracker' ? 0.96 : 1; // backtracking e ombreggiamento reciproco tra file
    const planes = [];
    if (pv.mount === 'roof_ew') { const b = (pv.tilt || 10) * DEG; planes.push([normal(b, -90 * DEG), b, 0.5], [normal(b, 90 * DEG), b, 0.5]); }
    else if (pv.mount !== 'tracker') { const b = pv.tilt * DEG; planes.push([normal(b, pv.azimuth * DEG), b, 1]); }
    for (let i = 0; i < H; i++) {
      let g = 0;
      if (pv.mount === 'tracker') {
        if (w.ghi[i] > 0) {
          const R = clamp(Math.atan2(w.sun[3 * i], w.sun[3 * i + 2]), -55 * DEG, 55 * DEG);
          g = poa(i, w, [Math.sin(R), 0, Math.cos(R)], Math.abs(R), pv.albedo);
        }
      } else for (const p of planes) g += p[2] * poa(i, w, p[0], p[1], pv.albedo);
      if (bif > 0) g += bif * pv.albedo * w.ghi[i] * 0.25;
      poaArr[i] = g;
      if (g <= 0) continue;
      const Wm2 = g * 1000, tc = w.ta[i] + Wm2 * (mod.noct - 20) / 800 * kTemp;
      const lowIrr = 1 - (L.lowIrr / 100) * clamp(2 * (500 - Wm2) / 500, 0, 2);
      const dc = g * (1 + mod.gammaP / 100 * (tc - 25)) * lowIrr * dcLoss * trackerLoss * yieldFactor; // kW per kWp
      const frac = dc / acLim, eff = clamp(invEff - 0.004 / Math.max(frac, 0.01), 0.80, invEff);
      dcArr[i] = dc;
      ac[i] = Math.min(dc * eff, acLim) * acLoss;
    }
    return { ac, poa: poaArr, dc: dcArr };
  }

  // ---------- 3. carico e prezzi ----------
  function loadModel(load, year, seed) {
    if (Array.isArray(load.custom) && load.custom.length >= H) return Float64Array.from(load.custom.slice(0, H));
    const p = D.LOAD_PROFILES[load.profile] || D.LOAD_PROFILES.turno2, r = rng((seed || 1) + 101);
    const out = new Float64Array(H), hol = new Set(D.HOLIDAYS);
    const aug0 = 226 - Math.round(load.augustShutdownWeeks * 3.5), aug1 = aug0 + load.augustShutdownWeeks * 7;
    for (let d = 0; d < 365; d++) {
      const dow = dayOfWeek(year, d);
      const shut = hol.has(d + 1) || dow === 0 || (d >= aug0 && d < aug1) || (load.christmasShutdown && (d >= 357 || d < 5));
      const seas = 1 + load.seasonal * Math.cos(2 * Math.PI * (d - 196) / 365);
      for (let h = 0; h < 24; h++) {
        const f = shut ? p.sun : dow === 6 ? Math.max(p.sat * p.wd[h], p.sun) : p.wd[h];
        out[d * 24 + h] = f * seas * (1 + 0.04 * gauss(r));
      }
    }
    const k = load.annualMWh * 1000 / sum(out);
    for (let i = 0; i < H; i++) out[i] *= k;
    return out;
  }
  const BASE_SHAPE = [0.92, 0.88, 0.86, 0.85, 0.86, 0.92, 1.02, 1.12, 1.12, 1.05, 1.00, 0.97, 0.95, 0.95, 0.98, 1.02, 1.08, 1.18, 1.22, 1.20, 1.12, 1.04, 0.98, 0.94];
  const SOLAR_DIP = [0.06, 0.09, 0.16, 0.24, 0.27, 0.24, 0.19, 0.19, 0.16, 0.11, 0.06, 0.04];
  const MONTH_LEVEL = [1.08, 1.05, 0.98, 0.92, 0.90, 0.98, 1.05, 1.00, 1.00, 1.00, 1.02, 1.05];
  function punModel(pr, year) {
    if (Array.isArray(pr.customPun) && pr.customPun.length >= H) return Float64Array.from(pr.customPun.slice(0, H));
    const out = new Float64Array(H);
    for (let d = 0; d < 365; d++) {
      const m = monthOfDay(d), dow = dayOfWeek(year, d), we = dow === 0 || dow === 6 ? 0.90 : 1;
      for (let h = 0; h < 24; h++) {
        const dip = h >= 8 && h <= 17 ? Math.sin(Math.PI * (h - 7.5) / 10.5) : 0;
        const eve = h >= 18 && h <= 21 ? 0.5 : 0;
        out[d * 24 + h] = MONTH_LEVEL[m] * we * (BASE_SHAPE[h] - SOLAR_DIP[m] * (dip * 1.45 - eve * 1.3));
      }
    }
    const k = pr.pun / (sum(out) / H);
    for (let i = 0; i < H; i++) out[i] = Math.max(0, out[i] * k);
    return out;
  }
  function priceModel(cfg) {
    const pr = cfg.prices, site = D.SITES[cfg.project.site] || D.SITES.milano;
    const pun = punModel(pr, cfg.project.year), buy = new Float64Array(H), sell = new Float64Array(H);
    const zf = (D.ZONE_FACTOR[site.zone] || 1) * pr.exportFactor;
    for (let i = 0; i < H; i++) {
      buy[i] = pun[i] * (1 + pr.lossFactor / 100) + pr.supplierSpread + pr.chargesVar + pr.excise; // €/MWh evitati
      sell[i] = Math.max(0, pun[i] * zf - pr.ridFee);
    }
    return { pun, buy, sell };
  }

  // ---------- 4. dispacciamento ----------
  // simula un anno; bess = {cap (kWh utili), pw (kW), etaC, etaD, aux (kW)} oppure null
  function dispatchYear(pvAc, load, prices, bess, cfg, keepHourly) {
    const g = cfg.grid, st = cfg.bess.strategy;
    const expLim = g.zeroExport ? 0 : g.exportLimitKw, impLim = g.importLimitKw;
    const T = { pv: 0, pvDirect: 0, pvToBess: 0, gridToBess: 0, bessOut: 0, bessToLoad: 0, imp: 0, exp: 0, curt: 0, load: 0, aux: 0,
      costImp: 0, revExp: 0, costBase: 0, impOverLimit: 0, efc: 0 };
    const peakBase = new Float64Array(12), peakProj = new Float64Array(12);
    const hr = keepHourly ? { imp: new Float64Array(H), exp: new Float64Array(H), soc: new Float64Array(H), ch: new Float64Array(H), pvch: new Float64Array(H), dis: new Float64Array(H), pvDirect: new Float64Array(H), curt: new Float64Array(H) } : null;
    let soc = bess ? bess.cap * 0.5 : 0;
    const reserve = bess && st.peakShaving ? bess.cap * st.reserveSoc / 100 : 0;
    // simula un giorno con un'energia di carica da rete pianificata (Egc); se commit registra i risultati
    function day(d, Egc, commit) {
      let s = soc, cost = 0, disDay = 0;
      const i0 = d * 24, maxDis = bess ? st.maxCyclesDay * bess.cap : 0;
      let dayMinBuy = Infinity; for (let h = 0; h < 24; h++) dayMinBuy = Math.min(dayMinBuy, prices.buy[i0 + h]);
      const thr = bess && st.arbitrage ? dayMinBuy / (bess.etaC * bess.etaD) + st.arbitrageMinSpread * 0.5 : -Infinity;
      // ore di carica da rete: le più economiche tra 0 e 6
      let gcHours = null;
      if (Egc > 0) { gcHours = [0, 1, 2, 3, 4, 5, 6].sort((a, b) => prices.buy[i0 + a] - prices.buy[i0 + b]).slice(0, 4); }
      for (let h = 0; h < 24; h++) {
        const i = i0 + h, aux = bess ? bess.aux : 0, L = load[i] + aux, P = pvAc[i];
        const direct = Math.min(P, L);
        let surplus = P - direct, deficit = L - direct, ch = 0, chG = 0, dis = 0;
        if (bess) {
          // carica da FV
          ch = Math.min(surplus, bess.pw, (bess.cap - s) / bess.etaC); if (ch < 0) ch = 0;
          s += ch * bess.etaC; surplus -= ch;
          // scarica: peak shaving prioritario, poi autoconsumo/arbitraggio sopra la riserva
          if (deficit > 0) {
            let need = 0;
            if (st.peakShaving && deficit > st.peakLimitKw) need = deficit - st.peakLimitKw;
            let avail = Math.min(bess.pw, s * bess.etaD, maxDis - disDay);
            let dps = Math.min(need, avail); if (dps < 0) dps = 0;
            dis = dps;
            if (st.selfConsumption && prices.buy[i] >= thr) {
              const above = Math.max(0, (s - reserve) * bess.etaD - dis);
              dis += Math.max(0, Math.min(deficit - dis, bess.pw - dis, above, maxDis - disDay - dis));
            }
            s -= dis / bess.etaD; deficit -= dis; disDay += dis;
          }
          // carica da rete (arbitraggio pianificato o ripristino della riserva per il peak shaving)
          let want = 0;
          if (gcHours && gcHours.indexOf(h) >= 0) want = Egc / gcHours.length;
          if (st.peakShaving && s < reserve && deficit < st.peakLimitKw && h < 7) want = Math.max(want, (reserve - s) / bess.etaC);
          if (want > 0 && ch < bess.pw) {
            chG = Math.min(want, bess.pw - ch, (bess.cap - s) / bess.etaC, Math.max(0, impLim - deficit));
            if (chG < 0) chG = 0;
            s += chG * bess.etaC;
          }
        }
        const imp = deficit + chG, exp = Math.min(surplus, expLim), curt = surplus - exp;
        cost += imp * prices.buy[i] / 1000 - exp * prices.sell[i] / 1000;
        if (commit) {
          const m = monthOfDay(d);
          T.pv += P; T.pvDirect += direct; T.pvToBess += ch; T.gridToBess += chG; T.bessOut += dis; T.bessToLoad += dis;
          T.imp += imp; T.exp += exp; T.curt += curt; T.load += load[i]; T.aux += aux;
          T.costImp += imp * prices.buy[i] / 1000; T.revExp += exp * prices.sell[i] / 1000; T.costBase += load[i] * prices.buy[i] / 1000;
          if (imp > impLim + 1e-6) T.impOverLimit += imp - impLim;
          if (load[i] > peakBase[m]) peakBase[m] = load[i];
          if (imp > peakProj[m]) peakProj[m] = imp;
          if (hr) { hr.imp[i] = imp; hr.exp[i] = exp; hr.soc[i] = bess ? s / bess.cap : 0; hr.ch[i] = ch + chG; hr.pvch[i] = ch; hr.dis[i] = dis; hr.pvDirect[i] = direct; hr.curt[i] = curt; }
        }
      }
      return { cost, s };
    }
    for (let d = 0; d < 365; d++) {
      let best = 0;
      if (bess && st.arbitrage) {
        const vEnd = Math.min(...Array.from({ length: 24 }, (_, h) => prices.buy[d * 24 + h])) / 1000; // valore €/kWh dell'energia residua
        const maxE = Math.min(bess.cap - soc, bess.pw * 4 * bess.etaC) / bess.etaC;
        let bestCost = Infinity;
        for (const f of [0, 0.25, 0.5, 0.75, 1]) {
          const r = day(d, f * maxE, false), c = r.cost - (r.s - soc) * vEnd / bess.etaC;
          if (c < bestCost - 1e-9) { bestCost = c; best = f * maxE; }
        }
      }
      const r = day(d, best, true); soc = r.s;
    }
    T.peakBase = Array.from(peakBase); T.peakProj = Array.from(peakProj);
    T.efc = bess ? T.bessOut / bess.cap : 0;
    if (hr) T.hourly = hr;
    return T;
  }

  // ---------- 5. CAPEX / OPEX ----------
  function capexModel(cfg) {
    const kwp = cfg.pv.kwp, b = cfg.bess, kwh = b.enabled ? b.kwh : 0, kw = b.enabled ? b.kw : 0;
    const qty = { '€/kWp': kwp, '€/kWh': kwh, '€/kW': kw, '€': 1 };
    const rows = [];
    let pv = 0, bs = 0;
    for (const it of cfg.capex.pv) { const v = it.value * qty[it.unit]; pv += v; rows.push({ group: 'FV', id: it.id, label: it.label, unit: it.unit, unitValue: it.value, qty: qty[it.unit], total: v }); }
    if (b.enabled) for (const it of cfg.capex.bess) { const v = it.value * (it.unit === '€' ? 1 : qty[it.unit]); bs += v; rows.push({ group: 'BESS', id: it.id, label: it.label, unit: it.unit, unitValue: it.value, qty: qty[it.unit], total: v }); }
    const cont = cfg.capex.contingencyPct / 100, own = cfg.capex.ownersCostPct / 100;
    const pvTot = pv * (1 + cont + own), bsTot = bs * (1 + cont + own);
    rows.push({ group: 'Comune', id: 'cont', label: 'Contingenze', unit: '%', unitValue: cfg.capex.contingencyPct, qty: pv + bs, total: (pv + bs) * cont });
    rows.push({ group: 'Comune', id: 'own', label: 'Costi del committente (owner\'s cost)', unit: '%', unitValue: cfg.capex.ownersCostPct, qty: pv + bs, total: (pv + bs) * own });
    return { rows, pv: pvTot, bess: bsTot, total: pvTot + bsTot, pvPerKwp: kwp ? pvTot / kwp : 0, bessPerKwh: kwh ? bsTot / kwh : 0, directPv: pv, directBess: bs };
  }

  // ---------- 6. simulazione completa ----------
  function simulate(cfgIn, opts) {
    opts = opts || {};
    const cfg = normalizeConfig(cfgIn), N = cfg.finance.years;
    const site = D.SITES[cfg.project.site] || D.SITES.milano;
    const w = opts.cache && opts.cache.w && opts.cache.siteKey === cfg.project.site + cfg.project.seed ? opts.cache.w : buildWeather(site, cfg.project.seed);
    const pvm = pvModel(cfg.pv, w);
    const load = loadModel(cfg.load, cfg.project.year, cfg.project.seed);
    const prices = priceModel(cfg);
    const kwp = cfg.pv.kwp, b = cfg.bess;
    const pvBase = new Float64Array(H); for (let i = 0; i < H; i++) pvBase[i] = pvm.ac[i] * kwp;
    const usable0 = b.enabled ? b.kwh * b.dod / 100 : 0;
    const etaC = Math.sqrt(b.rte / 100), etaD = etaC;
    const years = []; let soh = 1, cumEfcSinceAug = 0, y1 = null;
    const capex = capexModel(cfg);
    for (let y = 1; y <= N; y++) {
      const pvF = (1 - cfg.pv.degrFirst / 100) * Math.pow(1 - cfg.pv.degrAnnual / 100, y - 1);
      const pvY = new Float64Array(H); for (let i = 0; i < H; i++) pvY[i] = pvBase[i] * pvF;
      let aug = 0, repl = 0;
      if (b.enabled && y > 1) {
        if (b.augmentation && soh < b.augmentSoh / 100) { aug = (1 - soh) * b.kwh; soh = 1; cumEfcSinceAug = 0; }
        else if (!b.augmentation && soh < b.eolSoh / 100) { repl = b.kwh; soh = 1; cumEfcSinceAug = 0; }
      }
      const bess = b.enabled ? { cap: usable0 * soh, pw: b.kw, etaC, etaD, aux: b.auxPct / 100 * b.kwh / 24 } : null;
      const T = dispatchYear(pvY, load, prices, bess, cfg, y === 1 || opts.keepAllHourly);
      T.year = y; T.soh = soh; T.augKwh = aug; T.replKwh = repl; T.pvFactor = pvF;
      if (b.enabled) { // degrado per l'anno successivo
        const efcNom = T.bessOut / Math.max(usable0, 1);
        cumEfcSinceAug += efcNom;
        soh = Math.max(0.3, soh - cfg.bess.calendarDeg / 100 - cfg.bess.cycleDegPer1000 / 100 * efcNom / 1000);
      }
      if (y === 1) y1 = T;
      years.push(T);
    }
    const fin = finance(cfg, years, capex);
    const eng = engineering(cfg, w, pvm, capex);
    const poaYear = sum(pvm.poa);
    const k = {
      specificYield: kwp > 0 ? y1.pv / kwp : 0, poa: poaYear, pr: kwp > 0 ? y1.pv / kwp / Math.max(poaYear, 1) : 0,
      selfConsumptionRate: (y1.pvDirect + y1.pvToBess) / Math.max(y1.pv, 1),
      selfSufficiency: (y1.pvDirect + y1.bessToLoad) / Math.max(y1.load, 1),
      co2: (y1.load - y1.imp) / 1000 * D.CO2_GRID, cycles: y1.efc
    };
    return { cfg, site, years, y1, capex, fin, eng, kpi: k, monthly: monthly(y1, load, prices), load, prices, weather: w, pvm };
  }
  function monthly(y1, load, prices) {
    const out = []; const h = y1.hourly;
    for (let m = 0; m < 12; m++) {
      const r = { m, pv: 0, load: 0, direct: 0, pvch: 0, bess: 0, imp: 0, exp: 0, curt: 0, pun: 0 };
      for (let d = MONTH_START[m]; d < MONTH_START[m] + MONTH_DAYS[m]; d++) for (let k = 0; k < 24; k++) {
        const i = d * 24 + k; r.load += load[i]; r.direct += h.pvDirect[i]; r.pvch += h.pvch[i]; r.bess += h.dis[i]; r.imp += h.imp[i]; r.exp += h.exp[i]; r.curt += h.curt[i]; r.pun += prices.pun[i];
      }
      r.pv = r.direct + r.pvch + r.exp + r.curt; r.pun /= MONTH_DAYS[m] * 24; out.push(r);
    }
    return out;
  }

  // ---------- incentivi, fiscalità, flussi di cassa ----------
  function npv(rate, cf) { let v = 0; for (let t = 0; t < cf.length; t++) v += cf[t] / Math.pow(1 + rate, t); return v; }
  function irr(cf) {
    let lo = -0.99, hi = 10.0, flo = npv(lo, cf), fhi = npv(hi, cf);
    if (!isFinite(flo) || flo * fhi > 0) return null;
    for (let k = 0; k < 200; k++) { const mid = (lo + hi) / 2, f = npv(mid, cf); if (Math.abs(f) < 1e-7) return mid; if (f * flo > 0) { lo = mid; flo = f; } else hi = mid; }
    return (lo + hi) / 2;
  }
  function payback(cf) {
    let c = 0;
    for (let t = 0; t < cf.length; t++) { const p = c; c += cf[t]; if (t > 0 && c >= 0 && p < 0) return t - 1 + (-p) / cf[t]; }
    return null;
  }
  function deprSchedule(base, ratePct, half, N) {
    const out = new Float64Array(N + 1); let left = base;
    for (let y = 1; y <= N && left > 1e-6; y++) { const q = Math.min(left, base * ratePct / 100 * (half && y === 1 ? 0.5 : 1)); out[y] = q; left -= q; }
    return out;
  }
  function tierAmount(base, tiers) {
    let prev = 0, extra = 0;
    for (const t of tiers) { const slice = Math.max(0, Math.min(base, t.upTo) - prev); extra += slice * t.pct / 100; prev = t.upTo; if (base <= prev) break; }
    return extra;
  }
  function annuity(P, r, n) { return r === 0 ? P / n : P * r / (1 - Math.pow(1 + r, -n)); }

  function finance(cfg, years, capex) {
    const f = cfg.finance, o = cfg.opex, pr = cfg.prices, N = f.years, b = cfg.bess;
    const infl = o.inflation / 100, esc = pr.escalation / 100, ires = f.ires / 100, irap = f.irap / 100;
    const kwp = cfg.pv.kwp, kwac = kwp / cfg.pv.dcac, kwh = b.enabled ? b.kwh : 0, kw = b.enabled ? b.kw : 0;
    const ground = cfg.pv.mount === 'ground_fixed' || cfg.pv.mount === 'tracker';
    const baseOf = s => s === 'pv' ? capex.pv : s === 'bess' ? capex.bess : capex.total;
    // incentivi
    const inc = (cfg.incentives || []).filter(i => i.enabled);
    const grantY = new Float64Array(N + 1), creditY = new Float64Array(N + 1), tariffY = new Float64Array(N + 1);
    let grantPv = 0, grantBess = 0, superExtraPv = 0, superExtraBess = 0; const incSummary = []; const superdeps = [];
    for (const i of inc) {
      const base = baseOf(i.base || 'all'), sharePv = (i.base === 'bess') ? 0 : (i.base === 'pv' ? 1 : capex.pv / Math.max(capex.total, 1));
      if (i.type === 'grant') {
        const a = Math.min(base * i.pct / 100, i.cap || Infinity); grantY[clamp(i.year || 0, 0, N)] += a;
        grantPv += a * sharePv; grantBess += a * (1 - sharePv); incSummary.push({ id: i.id, name: i.name, type: i.type, amount: a });
      } else if (i.type === 'taxcredit') {
        const a = Math.min(base * i.pct / 100, i.cap || Infinity), n = Math.max(1, i.years || 1), s0 = i.startYear || 1;
        for (let k = 0; k < n && s0 + k <= N; k++) creditY[s0 + k] += a / n;
        incSummary.push({ id: i.id, name: i.name, type: i.type, amount: a });
      } else if (i.type === 'superdep') {
        superdeps.push(i);
      } else if (i.type === 'interest_grant') {
        const L = Math.min(base * (i.financedPct || 100) / 100, i.cap || Infinity), r = i.rate / 100 / 2, n = (i.loanYears || 5) * 2;
        const rata = annuity(L, r, n); let bal = L, intTot = 0; for (let k = 0; k < n; k++) { const it = bal * r; intTot += it; bal -= rata - it; }
        const yrs = i.loanYears || 5; for (let k = 1; k <= yrs && k <= N; k++) grantY[k] += intTot / yrs;
        grantPv += intTot * sharePv; grantBess += intTot * (1 - sharePv);
        incSummary.push({ id: i.id, name: i.name, type: i.type, amount: intTot });
      } else if (i.type === 'tariff_export') {
        let tot = 0; for (let y = 1; y <= Math.min(N, i.years); y++) { const Y = years[y - 1], ef = Math.pow(1 + esc, y - 1); const v = i.strike * Y.exp / 1000 - Y.revExp * ef; tariffY[y] += v; tot += v; }
        incSummary.push({ id: i.id, name: i.name, type: i.type, amount: tot, note: 'differenziale CfD rispetto al prezzo di mercato, somma nominale' });
      } else if (i.type === 'tariff_energy') {
        let tot = 0; for (let y = 1; y <= Math.min(N, i.years); y++) { const Y = years[y - 1]; const e = i.on === 'production' ? Y.pv : Y.pvDirect + Y.bessToLoad; const v = i.value * e / 1000; tariffY[y] += v; tot += v; }
        incSummary.push({ id: i.id, name: i.name, type: i.type, amount: tot });
      } else if (i.type === 'capacity') {
        let tot = 0; for (let y = 1; y <= Math.min(N, i.years); y++) { const v = i.value * kw; tariffY[y] += v; tot += v; }
        incSummary.push({ id: i.id, name: i.name, type: i.type, amount: tot });
      }
    }
    // maggiorazione dell'ammortamento: base al netto dei contributi e crediti sugli stessi beni
    const otherAid = sum(grantY) + sum(creditY);
    for (const i of superdeps) {
      // spesa ammissibile: FV entro il massimale €/kWp, BESS entro α × spesa FV ammessa; poi al netto degli altri aiuti
      if (i.requiresEneaBC && !i.modulesEneaBC) { incSummary.push({ id: i.id, name: i.name, type: i.type, amount: 0, note: 'non applicata: moduli non iscritti al registro ENEA cat. B/C' }); continue; }
      const pvB = i.base === 'bess' ? 0 : Math.min(capex.pv, i.capPvKwp ? i.capPvKwp * kwp : Infinity);
      const bsB = i.base === 'pv' ? 0 : Math.min(capex.bess, i.bessAlpha ? i.bessAlpha * (i.base === 'bess' ? capex.pv : pvB) : Infinity);
      const gross = pvB + bsB, sharePv = gross > 0 ? pvB / gross : 0;
      const extra = tierAmount(Math.max(0, gross - otherAid * gross / Math.max(capex.total, 1)), i.tiers || []);
      superExtraPv += extra * sharePv; superExtraBess += extra * (1 - sharePv);
      incSummary.push({ id: i.id, name: i.name, type: i.type, amount: extra * ires, note: 'beneficio IRES nominale su ' + Math.round(extra) + ' € di maggiorazione' });
    }
    const deprPv = deprSchedule(Math.max(0, capex.pv - grantPv), f.deprPv, f.halfFirstYear, N);
    const deprBess = deprSchedule(Math.max(0, capex.bess - grantBess), f.deprBess, f.halfFirstYear, N);
    const extraPv = deprSchedule(superExtraPv, f.deprPv, f.halfFirstYear, N), extraBess = deprSchedule(superExtraBess, f.deprBess, f.halfFirstYear, N);
    // debito
    const debt = capex.total * f.debtPct / 100, r = f.debtRate / 100, rata = debt > 0 ? annuity(debt, r, f.debtTenor) : 0;
    let bal = debt;
    const rows = []; const cfProj = [], cfEq = [];
    cfProj.push(-capex.total + grantY[0]); cfEq.push(-capex.total + debt + grantY[0]);
    let carry = 0;
    for (let y = 1; y <= N; y++) {
      const Y = years[y - 1], ef = Math.pow(1 + esc, y - 1), of = Math.pow(1 + infl, y - 1);
      const energySaving = (Y.costBase - Y.costImp) * ef;
      const exportRev = Y.revExp * ef;
      const powerSaving = (sum(Y.peakBase) - sum(Y.peakProj)) * pr.powerChargeKwYear / 12 * ef;
      const revenue = energySaving + exportRev + powerSaving + tariffY[y];
      let opex = (o.pvOmKwp * kwp + (ground ? o.securityKwp * kwp : 0) + o.bessOmKwh * kwh + o.insurancePct / 100 * capex.total + o.imuEur + o.landLeaseEur + o.monitoringEur + o.adminEur) * of;
      let extraord = 0;
      if (y === o.inverterReplYear) extraord += o.inverterReplKw * kwac * of;
      const bessPriceF = Math.pow(1 - o.costDeclineBess / 100, y - 1) * of;
      if (Y.augKwh) extraord += Y.augKwh * o.augmentCostKwh * bessPriceF;
      if (Y.replKwh) extraord += Y.replKwh * (cfg.capex.bess.find(x => x.id === 'dc') || { value: 115 }).value * bessPriceF;
      const decomm = y === N ? o.decommEurKwp * kwp * of : 0;
      const residual = y === N ? capex.total * f.residualPct / 100 : 0;
      const ebitda = revenue - opex - extraord - decomm;
      const depr = deprPv[y] + deprBess[y], extra = extraPv[y] + extraBess[y];
      const interest = bal * r, principal = y <= f.debtTenor && debt > 0 ? rata - interest : 0;
      bal = y >= f.debtTenor ? 0 : Math.max(0, bal - principal);
      // imposte
      const iresBaseU = ebitda - depr - extra, irapBase = ebitda - depr;
      const taxU = (f.taxCapacity ? iresBaseU * ires : Math.max(0, iresBaseU) * ires) + (f.taxCapacity ? irapBase * irap : Math.max(0, irapBase) * irap);
      let iresBaseL = ebitda - depr - extra - interest, iresL;
      if (f.taxCapacity) iresL = iresBaseL * ires;
      else { const tb = iresBaseL + carry; if (tb < 0) { carry = tb; iresL = 0; } else { carry = 0; iresL = tb * ires; } }
      const taxL = iresL + (f.taxCapacity ? irapBase * irap : Math.max(0, irapBase) * irap);
      const cfp = ebitda - taxU + creditY[y] + grantY[y] + residual;
      const cfe = ebitda - taxL + creditY[y] + grantY[y] + residual - interest - principal;
      cfProj.push(cfp); cfEq.push(cfe);
      const ds = interest + principal;
      rows.push({ y, energySaving, exportRev, powerSaving, tariffs: tariffY[y], revenue, opex, extraord, decomm, ebitda, depr, superdep: extra, interest, principal,
        taxU, taxL, credits: creditY[y], grants: grantY[y], cfProj: cfp, cfEq: cfe, dscr: ds > 1 ? (ebitda - taxL + creditY[y]) / ds : null, debtBal: bal,
        pvMWh: Y.pv / 1000, selfMWh: (Y.pvDirect + Y.bessToLoad) / 1000, expMWh: Y.exp / 1000, impMWh: Y.imp / 1000, bessMWh: Y.bessOut / 1000, soh: Y.soh });
    }
    const wacc = f.wacc / 100, ke = f.ke / 100;
    const discCum = []; let acc = 0; cfProj.forEach((c, t) => { acc += c / Math.pow(1 + wacc, t); discCum.push(acc); });
    let dpb = null; for (let t = 1; t < discCum.length; t++) if (discCum[t] >= 0 && discCum[t - 1] < 0) { dpb = t - 1 + (-discCum[t - 1]) / (discCum[t] - discCum[t - 1]); break; }
    // LCOE FV / LCOS BESS (reali al tasso WACC, € per MWh)
    let ePv = 0, cPv = capex.pv, eB = 0, cB = capex.bess;
    const dcCost = (cfg.capex.bess.find(x => x.id === 'dc') || { value: 115 }).value;
    for (let y = 1; y <= N; y++) {
      const dfc = Math.pow(1 + wacc, y), Y = years[y - 1], of = Math.pow(1 + infl, y - 1);
      ePv += Y.pv / 1000 / dfc; eB += Y.bessOut / 1000 / dfc;
      cPv += ((o.pvOmKwp + (ground ? o.securityKwp : 0)) * kwp + o.insurancePct / 100 * capex.pv + o.imuEur + o.landLeaseEur + o.monitoringEur + (y === o.inverterReplYear ? o.inverterReplKw * kwac : 0)) * of / dfc;
      cB += (o.bessOmKwh * kwh + o.insurancePct / 100 * capex.bess + (Y.augKwh * o.augmentCostKwh + Y.replKwh * dcCost) * Math.pow(1 - o.costDeclineBess / 100, y - 1)) * of / dfc;
    }
    const totAid = sum(grantY) + sum(creditY) + (superExtraPv + superExtraBess) * ires;
    const warnings = [];
    if (totAid > capex.total) warnings.push('Il totale degli aiuti supera il 100% della spesa: verificare il cumulo (divieto di doppio finanziamento).');
    if (inc.some(i => i.id === 'tr50') && inc.some(i => i.id === 'iperamm2026')) warnings.push('Transizione 5.0 e iper-ammortamento 2026 sono in genere alternativi sugli stessi beni: verificare.');
    if (inc.some(i => i.id === 'iperamm2026') && years[0].pv > 1.05 * years[0].load) warnings.push('Iper-ammortamento: la produzione FV supera il 105% dei consumi, limite previsto dalla misura.');
    if (inc.some(i => i.id === 'tr50')) warnings.push('Transizione 5.0 è chiusa per i nuovi progetti FER: usare solo per confronto.');
    if (inc.some(i => i.id === 'pmiFer')) warnings.push('Il bando MIMIT autoproduzione FER PMI è chiuso: usare solo come scenario.');
    if (years[0].impOverLimit > 0) warnings.push('Il prelievo supera la potenza disponibile in alcune ore (' + Math.round(years[0].impOverLimit / 1000) + ' MWh/anno).');
    return {
      rows, cfProj, cfEq, debt, npvProject: npv(wacc, cfProj), irrProject: irr(cfProj), npvEquity: npv(ke, cfEq), irrEquity: irr(cfEq),
      paybackProject: payback(cfProj), paybackDisc: dpb, paybackEquity: payback(cfEq),
      lcoePv: ePv > 0 ? cPv / ePv : null, lcosBess: eB > 0 ? cB / eB : null,
      minDscr: Math.min(...rows.filter(r => r.dscr !== null && r.y <= f.debtTenor).map(r => r.dscr).concat([Infinity])),
      incentives: incSummary, totalAid: totAid, aidIntensity: totAid / Math.max(capex.total, 1), netCapex: capex.total - sum(grantY) - sum(creditY), warnings
    };
  }

  // ---------- 7. ingegneria ----------
  const STD_TR = [250, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150];
  const LV_AL = [[70, 165], [95, 200], [120, 230], [150, 260], [185, 295], [240, 345], [300, 390]];
  const MV_AL = [[35, 140], [50, 165], [70, 200], [95, 240], [120, 275], [150, 305], [185, 345], [240, 400]];
  function engineering(cfg, w, pvm, capex) {
    const mod = D.MODULES[cfg.pv.module] || D.MODULES.topcon620, inv = D.INVERTERS[cfg.pv.inverter] || D.INVERTERS.str350;
    const site = w.site, tMin = Math.min(...site.t) - 12, tAmbMax = Math.max(...site.t) + 12, tCellMax = tAmbMax + (mod.noct - 20) * 1.25;
    const vocCold = mod.voc * (1 + mod.betaVoc / 100 * (tMin - 25)), vmpCold = mod.vmp * (1 + mod.betaVmp / 100 * (tMin - 25));
    const vmpHot = mod.vmp * (1 + mod.betaVmp / 100 * (tCellMax - 25));
    const nMaxV = Math.floor(inv.vdcMax / vocCold), nMaxMppt = Math.floor(inv.mpptMax / vmpCold);
    const nMin = Math.ceil(inv.mpptMin / vmpHot), nMinFull = Math.ceil(inv.mpptFullMin / vmpHot);
    const Ns = Math.min(nMaxV, nMaxMppt);
    const stringKwp = Ns * mod.pmax / 1000;
    const hasPv = cfg.pv.kwp > 0; // configurazione "solo BESS": nessun generatore FV
    const nInv = hasPv ? Math.max(1, Math.round(cfg.pv.kwp / (cfg.pv.dcac * inv.pac))) : 0;
    const strings = hasPv ? Math.round(cfg.pv.kwp / stringKwp) : 0;
    const spInv = nInv ? Math.ceil(strings / nInv) : 0, spMppt = Math.ceil(spInv / inv.nMppt);
    const iMppt = spMppt * mod.imp, iscMppt = spMppt * mod.isc * 1.25 * (1 + mod.alphaIsc / 100 * (tCellMax - 25));
    const kwpReal = strings * stringKwp, kwac = nInv * inv.pac, nMod = strings * Ns;
    const modArea = nMod * mod.length * mod.width;
    const ground = cfg.pv.mount === 'ground_fixed' || cfg.pv.mount === 'tracker';
    const landHa = ground ? modArea / cfg.pv.gcr * 1.15 / 10000 : 0;
    const roofM2 = !ground ? modArea / (cfg.pv.mount === 'roof_ew' ? 0.85 : 0.60) : 0;
    const checks = !hasPv ? [] : [
      { id: 'S1', what: 'Tensione a vuoto alla Tmin ≤ Vdc max inverter', value: (Ns * vocCold).toFixed(0) + ' V', limit: '≤ ' + inv.vdcMax + ' V', ok: Ns * vocCold <= inv.vdcMax },
      { id: 'S2', what: 'Vmp alla Tmin ≤ limite superiore MPPT', value: (Ns * vmpCold).toFixed(0) + ' V', limit: '≤ ' + inv.mpptMax + ' V', ok: Ns * vmpCold <= inv.mpptMax },
      { id: 'S3', what: 'Vmp alla Tcella max ≥ limite inferiore MPPT a piena potenza', value: (Ns * vmpHot).toFixed(0) + ' V', limit: '≥ ' + inv.mpptFullMin + ' V', ok: Ns * vmpHot >= inv.mpptFullMin },
      { id: 'S4', what: 'Corrente di lavoro per MPPT', value: iMppt.toFixed(1) + ' A', limit: '≤ ' + inv.iMpptMax + ' A', ok: iMppt <= inv.iMpptMax },
      { id: 'S5', what: 'Corrente di cortocircuito per MPPT (×1,25, Tmax)', value: iscMppt.toFixed(1) + ' A', limit: '≤ ' + inv.iscMpptMax + ' A', ok: iscMppt <= inv.iscMpptMax },
      { id: 'S6', what: 'Stringhe per inverter entro gli ingressi disponibili', value: spInv + '', limit: '≤ ' + inv.nMppt * inv.stringsPerMppt, ok: spInv <= inv.nMppt * inv.stringsPerMppt },
      { id: 'S7', what: 'Rapporto DC/AC effettivo', value: (kwpReal / kwac).toFixed(2), limit: '1,00 – 1,40', ok: kwpReal / kwac >= 1 && kwpReal / kwac <= 1.4 }
    ];
    // cavi DC di stringa (rame, 70 °C)
    const rhoCu = 0.0216, rhoAl = 0.0345, Lstr = ground ? 70 : 50, Vstr = Ns * mod.vmp;
    const dcCable = [6, 10, 16].map(S => ({ S, dv: 2 * Lstr * mod.imp * rhoCu / S / Vstr * 100 })).find(x => x.dv <= 1.0) || { S: 16, dv: 2 * Lstr * mod.imp * rhoCu / 16 / Vstr * 100 };
    // cavo AC inverter -> quadro BT/cabina (alluminio, cosφ 1)
    const Iac = inv.pac * 1000 / (Math.sqrt(3) * inv.vac), Lac = ground ? 150 : 80;
    let acCable = null;
    for (let par = 1; par <= 4 && !acCable; par++) for (const [S, Iz] of LV_AL) {
      const dv = Math.sqrt(3) * Lac * (Iac / par) * rhoAl / S / inv.vac * 100;
      if (Iz * 0.8 >= Iac / par && dv <= 1.5) { acCable = { S, par, Iz, dv, I: Iac }; break; }
    }
    // trasformatori MT/BT
    const reqKva = kwac * 1.05 / 0.95;
    const nTr = hasPv ? Math.max(1, Math.ceil(reqKva / 3150)) : 0, trKva = hasPv ? (STD_TR.find(s => s >= reqKva / nTr) || 3150) : 0;
    const b = cfg.bess, bessOn = b.enabled;
    const unit = D.BESS_UNITS[b.unit] || D.BESS_UNITS.container5;
    const nUnits = bessOn ? Math.ceil(b.kwh / unit.kwh) : 0;
    const nBessTr = bessOn ? Math.max(1, Math.ceil(b.kw / 0.95 / 3150)) : 0, bessTrKva = bessOn ? (STD_TR.find(s => s >= b.kw / 0.95 / nBessTr) || 3150) : 0;
    // linea MT verso la cabina utente
    const Vmv = cfg.grid.voltageKv * 1000, Imv = (kwac + (bessOn ? b.kw : 0)) * 1000 / (Math.sqrt(3) * Vmv * 0.95), Lmv = ground ? 400 : 150;
    // sezione MT: portata (80 %), caduta ≤ 0,5 % e tenuta al cortocircuito di rete S ≥ Icc·√t / K (K = 92 Al/XLPE)
    const iccKa = cfg.grid.iccKa || 12.5, tFault = cfg.grid.tFaultS || 0.5, sMinSc = iccKa * 1000 * Math.sqrt(tFault) / 92;
    const mvc = MV_AL.find(([S, Iz]) => Iz * 0.8 >= Imv && S >= sMinSc && Math.sqrt(3) * Lmv * Imv * rhoAl / S / Vmv * 100 <= 0.5) || MV_AL[MV_AL.length - 1];
    const prot = [
      { code: '27.S1', fn: 'Minima tensione', setting: '0,85 Vn', time: '1,5 s' },
      { code: '27.S2', fn: 'Minima tensione (2ª soglia)', setting: '0,40 Vn', time: '0,2 s' },
      { code: '59.S1', fn: 'Massima tensione (media mobile 10 min)', setting: '1,10 Vn', time: '≤ 3 s' },
      { code: '59.S2', fn: 'Massima tensione', setting: '1,20 Vn', time: '0,6 s' },
      { code: '81>.S1', fn: 'Massima frequenza (soglia restrittiva)', setting: '50,2 Hz', time: '0,15 s' },
      { code: '81<.S1', fn: 'Minima frequenza (soglia restrittiva)', setting: '49,8 Hz', time: '0,15 s' },
      { code: '81>.S2', fn: 'Massima frequenza (soglia permissiva)', setting: '51,5 Hz', time: '1,0 s' },
      { code: '81<.S2', fn: 'Minima frequenza (soglia permissiva)', setting: '47,5 Hz', time: '4,0 s' },
      { code: '59N', fn: 'Massima tensione omopolare (SPI in MT)', setting: '5 % Vn', time: '25 s' },
      { code: '50/51', fn: 'Massima corrente di fase (SPG)', setting: 'I> 250 A, I>> 600 A (tipici)', time: '0,5 s / 0,12 s' },
      { code: '51N/67N', fn: 'Guasto a terra (SPG)', setting: 'secondo regolamento DSO', time: '0,17–0,45 s' }
    ];
    return {
      hasPv, module: mod, inverter: inv, tMin, tAmbMax, tCellMax, vocCold, vmpCold, vmpHot, Ns, nMin, nMinFull, nMaxV, nMaxMppt,
      strings, nInv, spInv, spMppt, iMppt, iscMppt, kwpReal, kwac, nMod, modArea, landHa, roofM2, checks,
      dcCable: { S: dcCable.S, dv: dcCable.dv, L: Lstr, type: 'H1Z2Z2-K 1,5 kV DC, rame' },
      acCable: acCable ? Object.assign(acCable, { L: Lac, type: 'ARG16R16 / ARE4R 0,6/1 kV, alluminio' }) : null,
      transformer: { n: nTr, kva: trKva, lv: inv.vac, mv: cfg.grid.voltageKv },
      bess: bessOn ? { unit, n: nUnits, kwhInst: nUnits * unit.kwh, cRate: b.kw / b.kwh, hours: b.kwh / b.kw, footprint: nUnits * unit.footprint, areaWithSpacing: nUnits * unit.footprint * 3.2 + 60, trKva: bessTrKva, nTr: nBessTr } : null,
      mvCable: { S: mvc[0], Iz: mvc[1], I: Imv, L: Lmv, sMinSc, iccKa, tFault, type: 'ARE4H5E 12/20 kV, alluminio' },
      iscContribution: kwac * 1000 / (Math.sqrt(3) * Vmv) * 1.2 + (bessOn ? b.kw * 1000 / (Math.sqrt(3) * Vmv) * 1.2 : 0),
      protections: prot, mdr: mdr(cfg, bessOn)
    };
  }
  function mdr(cfg, bessOn) {
    const L = [
      ['GEN', 'G', 'Relazione tecnica generale e Basis of Design'], ['GEN', 'G', 'Elenco elaborati (MDR)'], ['GEN', 'G', 'Cronoprogramma di progetto'],
      ['GEN', 'G', 'Piano di sicurezza e coordinamento (PSC)'], ['GEN', 'G', 'Piano di manutenzione dell\'opera'],
      ['CIV', 'C', 'Inquadramento territoriale e vincoli (aree idonee)'], ['CIV', 'C', 'Planimetria generale / layout di impianto'],
      ['CIV', 'C', 'Relazione geologica e geotecnica'], ['CIV', 'C', 'Relazione idraulica e invarianza idraulica'],
      ['CIV', 'C', 'Calcolo strutture di sostegno e fondazioni (NTC 2018)'], ['CIV', 'C', 'Viabilità, recinzione, cancelli, drenaggi'],
      ['ELE', 'E', 'Schema unifilare generale MT/BT'], ['ELE', 'E', 'Schemi di stringa e cablaggio DC'], ['ELE', 'E', 'Dimensionamento cavi DC/AC e cadute di tensione'],
      ['ELE', 'E', 'Calcolo correnti di cortocircuito e selettività'], ['ELE', 'E', 'Impianto di terra e protezione contro i fulmini (CEI EN 62305)'],
      ['ELE', 'E', 'Cabina di consegna/utente: layout e apparecchiature (CEI 0-16)'], ['ELE', 'E', 'Tarature SPG/SPI e regolamento di esercizio'],
      ['ELE', 'E', 'Specifica tecnica moduli FV'], ['ELE', 'E', 'Specifica tecnica inverter'], ['ELE', 'E', 'Specifica tecnica trasformatori MT/BT'],
      ['ELE', 'E', 'Elenco cavi e percorsi'], ['ELE', 'E', 'Impianto di illuminazione, videosorveglianza e antintrusione'],
      ['AUT', 'I', 'Architettura SCADA / monitoraggio / EMS'], ['AUT', 'I', 'Lista I/O e protocolli (Modbus TCP, IEC 61850)'],
      ['AUT', 'I', 'Controllore centrale di impianto (CCI) – CEI 0-16 All. O/T'],
      ['PRM', 'P', 'Pratica di connessione (TICA) e STMG/STMD'], ['PRM', 'P', 'Titolo autorizzativo (PAS / edilizia libera / AU)'],
      ['PRM', 'P', 'Pratica prevenzione incendi / valutazione VVF'], ['PRM', 'P', 'Pratiche GSE (RID/FER X) e Terna GAUDÌ'],
      ['ECO', 'K', 'Computo metrico estimativo e stima CAPEX'], ['ECO', 'K', 'Piano economico-finanziario e analisi incentivi'],
      ['COM', 'Q', 'Piano di collaudo e messa in servizio (CEI EN 62446-1)'], ['COM', 'Q', 'Verifiche prestazionali (PR) e collaudo funzionale']
    ];
    if (bessOn) L.push(
      ['BES', 'E', 'Specifica tecnica BESS (IEC 62933, IEC 62619, UL 9540A)'], ['BES', 'E', 'Schema unifilare BESS e PCS'],
      ['BES', 'E', 'Relazione di sicurezza BESS e analisi rischio incendio/thermal runaway'], ['BES', 'C', 'Layout area BESS, distanze e fondazioni'],
      ['BES', 'I', 'Logiche EMS: autoconsumo, arbitraggio, peak shaving'], ['BES', 'Q', 'Piano di prove FAT/SAT del BESS']);
    return L.map((r, k) => ({ code: 'FVB-' + r[0] + '-' + String(k + 1).padStart(3, '0'), area: r[0], disc: r[1], title: r[2], rev: 'A' }));
  }

  // ---------- sensitività ----------
  // ogni caso: [nome, variazione sfavorevole, variazione favorevole, ampiezza]; low = VAN nello scenario sfavorevole
  function sensitivity(cfg0) {
    const base = simulate(cfg0), b0 = base.fin.npvProject;
    const cases = [
      ['CAPEX', c => { c.capex.pv.forEach(x => x.value *= 1.2); c.capex.bess.forEach(x => x.value *= 1.2); }, c => { c.capex.pv.forEach(x => x.value *= 0.8); c.capex.bess.forEach(x => x.value *= 0.8); }, '±20%'],
      ['Prezzo energia (PUN)', c => { c.prices.pun *= 0.8; }, c => { c.prices.pun *= 1.2; }, '±20%'],
      ['Producibilità FV', c => { c.pv.yieldFactor = 0.92; }, c => { c.pv.yieldFactor = 1.08; }, '±8%'],
      ['OPEX', c => { c.opex.pvOmKwp *= 1.2; c.opex.bessOmKwh *= 1.2; c.opex.insurancePct *= 1.2; }, c => { c.opex.pvOmKwp *= 0.8; c.opex.bessOmKwh *= 0.8; c.opex.insurancePct *= 0.8; }, '±20%'],
      ['WACC', c => { c.finance.wacc += 2; }, c => { c.finance.wacc -= 2; }, '±2 pp'],
      ['Escalation prezzi', c => { c.prices.escalation -= 1.5; }, c => { c.prices.escalation += 1.5; }, '±1,5 pp'],
      ['Oneri e componenti variabili', c => { c.prices.chargesVar *= 0.7; }, c => { c.prices.chargesVar *= 1.3; }, '±30%']
    ];
    const out = [];
    for (const [name, lo, hi, range] of cases) {
      const a = normalizeConfig(cfg0), z = normalizeConfig(cfg0); lo(a); hi(z);
      const ra = simulate(a), rz = simulate(z);
      out.push({ name, range, low: ra.fin.npvProject, high: rz.fin.npvProject, irrLow: ra.fin.irrProject, irrHigh: rz.fin.irrProject });
    }
    out.sort((x, y) => Math.abs(y.high - y.low) - Math.abs(x.high - x.low));
    return { base: b0, items: out };
  }

  return { simulate, sensitivity, defaultConfig, normalizeConfig, capexModel, buildWeather, pvModel, loadModel, priceModel, dispatchYear, npv, irr, payback, tierAmount, H, MONTH_START, MONTH_DAYS, DATA: D };
});
