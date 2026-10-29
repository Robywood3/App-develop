// Proprietà dell'acqua/vapore secondo IAPWS-IF97 (regioni 1, 2, 3 e 4).
// API pubblica in unità ingegneristiche: pressione [bar], temperatura [°C],
// entalpia [kJ/kg], entropia [kJ/(kg·K)], volume specifico [m³/kg].
// La regione 3 (equazione di Helmholtz in ρ, T) è risolta in densità per
// iterazione; il campo usato dal simulatore è p ≤ 200 bar (subcritico).

const R_W = 0.461526; // kJ/(kg·K)
const TK = 273.15;

// ---------------------------------------------------------------- Regione 1
const R1_I = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 8, 8, 21, 23, 29, 30, 31, 32];
const R1_J = [-2, -1, 0, 1, 2, 3, 4, 5, -9, -7, -1, 0, 1, 3, -3, 0, 1, 3, 17, -4, 0, 6, -5, -2, 10, -8, -11, -6, -29, -31, -38, -39, -40, -41];
const R1_N = [
  0.14632971213167, -0.84548187169114, -0.3756360367204e1, 0.33855169168385e1, -0.95791963387872,
  0.15772038513228, -0.16616417199501e-1, 0.81214629983568e-3, 0.28319080123804e-3, -0.60706301565874e-3,
  -0.18990068218419e-1, -0.32529748770505e-1, -0.21841717175414e-1, -0.5283835796993e-4, -0.47184321073267e-3,
  -0.30001780793026e-3, 0.47661393906987e-4, -0.44141845330846e-5, -0.72694996297594e-15, -0.31679644845054e-4,
  -0.28270797985312e-5, -0.85205128120103e-9, -0.22425281908e-5, -0.65171222895601e-6, -0.14341729937924e-12,
  -0.40516996860117e-6, -0.12734301741641e-8, -0.17424871230634e-9, -0.68762131295531e-18, 0.14478307828521e-19,
  0.26335781662795e-22, -0.11947622640071e-22, 0.18228094581404e-23, -0.93537087292458e-25,
];

function region1(pMPa, T) {
  const pi = pMPa / 16.53;
  const tau = 1386 / T;
  const a = 7.1 - pi;
  const b = tau - 1.222;
  let g = 0, gp = 0, gt = 0, gtt = 0;
  for (let i = 0; i < 34; i++) {
    const I = R1_I[i], J = R1_J[i], n = R1_N[i];
    const aI = Math.pow(a, I), bJ = Math.pow(b, J);
    g += n * aI * bJ;
    gp += -n * I * Math.pow(a, I - 1) * bJ;
    gt += n * aI * J * Math.pow(b, J - 1);
    gtt += n * aI * J * (J - 1) * Math.pow(b, J - 2);
  }
  return {
    T,
    p: pMPa,
    v: (R_W * T / (pMPa * 1000)) * pi * gp,
    h: R_W * T * tau * gt,
    s: R_W * (tau * gt - g),
    cp: -R_W * tau * tau * gtt,
  };
}

// ---------------------------------------------------------------- Regione 2
const R2_J0 = [0, 1, -5, -4, -3, -2, -1, 2, 3];
const R2_N0 = [
  -0.96927686500217e1, 0.10086655968018e2, -0.5608791128302e-2, 0.71452738081455e-1, -0.40710498223928,
  0.14240819171444e1, -0.4383951131945e1, -0.28408632460772, 0.21268463753307e-1,
];
const R2_I = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 5, 6, 6, 6, 7, 7, 7, 8, 8, 9, 10, 10, 10, 16, 16, 18, 20, 20, 20, 21, 22, 23, 24, 24, 24];
const R2_J = [0, 1, 2, 3, 6, 1, 2, 4, 7, 36, 0, 1, 3, 6, 35, 1, 2, 3, 7, 3, 16, 35, 0, 11, 25, 8, 36, 13, 4, 10, 14, 29, 50, 57, 20, 35, 48, 21, 53, 39, 26, 40, 58];
const R2_N = [
  -0.17731742473213e-2, -0.17834862292358e-1, -0.45996013696365e-1, -0.57581259083432e-1, -0.5032527872793e-1,
  -0.33032641670203e-4, -0.18948987516315e-3, -0.39392777243355e-2, -0.43797295650573e-1, -0.26674547914087e-4,
  0.20481737692309e-7, 0.43870667284435e-6, -0.3227767723857e-4, -0.15033924542148e-2, -0.40668253562649e-1,
  -0.78847309559367e-9, 0.12790717852285e-7, 0.48225372718507e-6, 0.22922076337661e-5, -0.16714766451061e-10,
  -0.21171472321355e-2, -0.23895741934104e2, -0.5905956432427e-17, -0.12621808899101e-5, -0.38946842435739e-1,
  0.11256211360459e-10, -0.82311340897998e1, 0.19809712802088e-7, 0.10406965210174e-18, -0.10234747095929e-12,
  -0.10018179379511e-8, -0.80882908646985e-10, 0.10693031879409, -0.33662250574171, 0.89185845355421e-24,
  0.30629316876232e-12, -0.42002467698208e-5, -0.59056029685639e-25, 0.37826947613457e-5, -0.12768608934681e-14,
  0.73087610595061e-28, 0.55414715350778e-16, -0.9436970724121e-6,
];

function region2(pMPa, T) {
  const pi = pMPa;
  const tau = 540 / T;
  let g0 = Math.log(pi), g0t = 0, g0tt = 0;
  for (let i = 0; i < 9; i++) {
    const J = R2_J0[i], n = R2_N0[i];
    g0 += n * Math.pow(tau, J);
    g0t += n * J * Math.pow(tau, J - 1);
    g0tt += n * J * (J - 1) * Math.pow(tau, J - 2);
  }
  const b = tau - 0.5;
  let gr = 0, grp = 0, grt = 0, grtt = 0;
  for (let i = 0; i < 43; i++) {
    const I = R2_I[i], J = R2_J[i], n = R2_N[i];
    const pI = Math.pow(pi, I), bJ = Math.pow(b, J);
    gr += n * pI * bJ;
    grp += n * I * Math.pow(pi, I - 1) * bJ;
    grt += n * pI * J * Math.pow(b, J - 1);
    grtt += n * pI * J * (J - 1) * Math.pow(b, J - 2);
  }
  return {
    T,
    p: pMPa,
    v: (R_W * T / (pMPa * 1000)) * pi * (1 / pi + grp),
    h: R_W * T * tau * (g0t + grt),
    s: R_W * (tau * (g0t + grt) - (g0 + gr)),
    cp: -R_W * tau * tau * (g0tt + grtt),
  };
}

// ---------------------------------------------------------------- Regione 4
const R4_N = [
  0.11670521452767e4, -0.72421316703206e6, -0.17073846940092e2, 0.1202082470247e5, -0.32325550322333e7,
  0.1491510861353e2, -0.48232657361591e4, 0.40511340542057e6, -0.23855557567849, 0.65017534844798e3,
];

function psatMPa(T) {
  const n = R4_N;
  const th = T + n[8] / (T - n[9]);
  const A = th * th + n[0] * th + n[1];
  const B = n[2] * th * th + n[3] * th + n[4];
  const C = n[5] * th * th + n[6] * th + n[7];
  return Math.pow((2 * C) / (-B + Math.sqrt(B * B - 4 * A * C)), 4);
}

function tsatK(pMPa) {
  const n = R4_N;
  const be = Math.pow(pMPa, 0.25);
  const E = be * be + n[2] * be + n[5];
  const F = n[0] * be * be + n[3] * be + n[6];
  const G = n[1] * be * be + n[4] * be + n[7];
  const D = (2 * G) / (-F - Math.sqrt(F * F - 4 * E * G));
  return (n[9] + D - Math.sqrt((n[9] + D) * (n[9] + D) - 4 * (n[8] + n[9] * D))) / 2;
}

// ---------------------------------------------------------------- Regione 3
const R3_I = [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 8, 9, 9, 10, 10, 11];
const R3_J = [0, 1, 2, 7, 10, 12, 23, 2, 6, 15, 17, 0, 2, 6, 7, 22, 26, 0, 2, 4, 16, 26, 0, 2, 4, 26, 1, 3, 26, 0, 2, 26, 2, 26, 2, 26, 0, 1, 26];
const R3_N1 = 0.10658070028513e1;
const R3_N = [
  -0.15732845290239e2, 0.20944396974307e2, -0.76867707878716e1, 0.26185947787954e1, -0.2808078114862e1,
  0.12053369696517e1, -0.84566812812502e-2, -0.12654315477714e1, -0.11524407806681e1, 0.88521043984318,
  -0.64207765181607, 0.38493460186671, -0.85214708824206, 0.48972281541877e1, -0.30502617256965e1,
  0.39420536879154e-1, 0.12558408424308, -0.2799932969871, 0.1389979956946e1, -0.2018991502357e1,
  -0.82147637173963e-2, -0.47596035734923, 0.439840744735e-1, -0.44476435428739, 0.90572070719733,
  0.70522450087967, 0.10770512626332, -0.32913623258954, -0.50871062041158, -0.22175400873096e-1,
  0.94260751665092e-1, 0.16436278447961, -0.13503372241348e-1, -0.14834345352472e-1, 0.57922953628084e-3,
  0.32308904703711e-2, 0.80964802996215e-4, -0.16557679795037e-3, -0.44923899061815e-4,
];
const RHO_C = 322, T_C = 647.096;

// Energia libera di Helmholtz adimensionale e derivate in (δ, τ).
function phi3(rho, T) {
  const d = rho / RHO_C, t = T_C / T;
  let f = R3_N1 * Math.log(d), fd = R3_N1 / d, fdd = -R3_N1 / (d * d), ft = 0, ftt = 0, fdt = 0;
  for (let i = 0; i < 39; i++) {
    const I = R3_I[i], J = R3_J[i], n = R3_N[i];
    const dI = Math.pow(d, I), tJ = Math.pow(t, J);
    f += n * dI * tJ;
    if (I > 0) {
      fd += n * I * Math.pow(d, I - 1) * tJ;
      fdt += n * I * Math.pow(d, I - 1) * J * Math.pow(t, J - 1);
      if (I > 1) fdd += n * I * (I - 1) * Math.pow(d, I - 2) * tJ;
    }
    if (J > 0) {
      ft += n * dI * J * Math.pow(t, J - 1);
      if (J > 1) ftt += n * dI * J * (J - 1) * Math.pow(t, J - 2);
    }
  }
  return { d, t, f, fd, fdd, ft, ftt, fdt };
}

/** Regione 3 da densità [kg/m³] e temperatura [K]. */
function region3(rho, T) {
  const q = phi3(rho, T);
  const { d, t } = q;
  const p = (rho * R_W * T * d * q.fd) / 1000; // MPa
  const den = 2 * d * q.fd + d * d * q.fdd;
  return {
    T, p, rho,
    v: 1 / rho,
    h: R_W * T * (t * q.ft + d * q.fd),
    s: R_W * (t * q.ft - q.f),
    cp: R_W * (-t * t * q.ftt + ((d * q.fd - d * t * q.fdt) ** 2) / den),
    dpdrho: (R_W * T * den) / 1000,
  };
}

// Densità in regione 3 alla pressione [MPa] e temperatura [K] (Newton smorzato dal valore iniziale).
function rho3(pMPa, T, rho0) {
  let rho = rho0;
  for (let k = 0; k < 100; k++) {
    const r = region3(rho, T);
    const dp = r.dpdrho > 1e-6 ? r.dpdrho : 1e-6;
    let step = (pMPa - r.p) / dp;
    const lim = 0.2 * rho;
    if (step > lim) step = lim;
    if (step < -lim) step = -lim;
    rho += step;
    if (Math.abs(step) < 1e-10 * rho) break;
  }
  return rho;
}

// Frontiera regioni 2-3.
function pB23(T) { return 0.34805185628969e3 - 0.11671859879975e1 * T + 0.10192970039326e-2 * T * T; }
function tB23(pMPa) { return 0.57254459862746e3 + Math.sqrt((pMPa - 0.1391883977887e2) / 0.10192970039326e-2); }

// Densità approssimate di liquido e vapore saturi (Wagner-Pruß, equazioni ausiliarie) come valori iniziali.
function rhoSatGuess(T) {
  const th = 1 - T / T_C;
  const rl = RHO_C * (1 + 1.99274064 * th ** (1 / 3) + 1.09965342 * th ** (2 / 3) - 0.510839303 * th ** (5 / 3)
    - 1.75493479 * th ** (16 / 3) - 45.5170352 * th ** (43 / 3) - 6.74694450e5 * th ** (110 / 3));
  const rv = RHO_C * Math.exp(-2.0315024 * th ** (2 / 6) - 2.6830294 * th ** (4 / 6) - 5.38626492 * th ** (8 / 6)
    - 17.2991605 * th ** (18 / 6) - 44.7586581 * th ** (37 / 6) - 63.9201063 * th ** (71 / 6));
  return { rl, rv };
}

const T13 = 623.15;
const P_SAT_T13 = 16.5291642526; // MPa, pressione di saturazione a 623,15 K

/** Liquido monofase a (p, T) con T ≤ Tsat: regione 1 o 3. */
function liquidPT(pMPa, T) {
  if (T <= T13) return region1(pMPa, T);
  const g = rhoSatGuess(Math.min(T, T_C - 0.5)).rl;
  return region3(rho3(pMPa, T, Math.max(g, 1 / region1(pMPa, T13).v * 0.98)), T);
}

/** Vapore monofase a (p, T) con T ≥ Tsat: regione 2 o 3. */
function vaporPT(pMPa, T) {
  if (T <= T13 || pMPa <= pB23(T)) return region2(pMPa, T);
  const r2 = region2(pMPa, tB23(pMPa));
  return region3(rho3(pMPa, T, 1 / r2.v), T);
}

// ------------------------------------------------------------ API pubblica
export const P_MAX_BAR = 200;

function mpa(pBar) {
  return pBar / 10;
}

/** Temperatura di saturazione [°C] alla pressione [bar]. */
export function Tsat(pBar) {
  return tsatK(mpa(pBar)) - TK;
}

/** Pressione di saturazione [bar] alla temperatura [°C]. */
export function psat(TC) {
  return psatMPa(TC + TK) * 10;
}

/** Proprietà di liquido e vapore saturi alla pressione [bar]. */
export function satP(pBar) {
  const p = mpa(pBar);
  const T = tsatK(p);
  let L, V;
  if (p <= P_SAT_T13) {
    L = region1(p, T);
    V = region2(p, T);
  } else {
    const g = rhoSatGuess(T);
    L = region3(rho3(p, T, g.rl), T);
    V = region3(rho3(p, T, g.rv), T);
  }
  return { T: T - TK, hL: L.h, hV: V.h, sL: L.s, sV: V.s, vL: L.v, vV: V.v };
}

/** Proprietà monofase (liquido o vapore surriscaldato) a p [bar], T [°C]. */
export function propsPT(pBar, TC) {
  const p = mpa(pBar);
  const T = TC + TK;
  const ts = tsatK(p);
  const r = T <= ts ? liquidPT(p, T) : vaporPT(p, T);
  return { T: TC, p: pBar, h: r.h, s: r.s, v: r.v, cp: r.cp, x: T <= ts ? 0 : 1 };
}

export function hPT(pBar, TC) {
  return propsPT(pBar, TC).h;
}

export function sPT(pBar, TC) {
  return propsPT(pBar, TC).s;
}

// Newton monodimensionale sulla temperatura in una regione monofase.
function solveT(fn, target, deriv, Tguess, Tmin, Tmax) {
  let T = Math.min(Math.max(Tguess, Tmin), Tmax);
  for (let k = 0; k < 50; k++) {
    const r = fn(T);
    const err = deriv.value(r) - target;
    const d = deriv.slope(r, T);
    let dT = -err / d;
    if (dT > 100) dT = 100;
    if (dT < -100) dT = -100;
    T = Math.min(Math.max(T + dT, Tmin), Tmax);
    if (Math.abs(dT) < 1e-7) break;
  }
  return T;
}

const BY_H = { value: (r) => r.h, slope: (r) => r.cp };
const BY_S = { value: (r) => r.s, slope: (r, T) => r.cp / T };

/** Stato completo da p [bar] e h [kJ/kg]. */
export function propsPH(pBar, h) {
  const p = mpa(pBar);
  const ts = tsatK(p);
  const sat = satP(pBar);
  const L = { h: sat.hL, s: sat.sL, v: sat.vL };
  const V = { h: sat.hV, s: sat.sV, v: sat.vV };
  if (h < L.h) {
    const T = solveT((t) => liquidPT(p, t), h, BY_H, ts - (L.h - h) / 4.2, 273.15, ts);
    const r = liquidPT(p, T);
    return { T: T - TK, p: pBar, h, s: r.s, v: r.v, x: 0, phase: 'liquido' };
  }
  if (h > V.h) {
    const T = solveT((t) => vaporPT(p, t), h, BY_H, ts + (h - V.h) / 2.2, ts, 1073.15);
    const r = vaporPT(p, T);
    return { T: T - TK, p: pBar, h, s: r.s, v: r.v, x: 1, phase: 'vapore' };
  }
  const x = (h - L.h) / (V.h - L.h);
  return { T: ts - TK, p: pBar, h, s: L.s + x * (V.s - L.s), v: L.v + x * (V.v - L.v), x, phase: 'bifase' };
}

/** Stato completo da p [bar] e s [kJ/(kg·K)]. */
export function propsPS(pBar, s) {
  const p = mpa(pBar);
  const ts = tsatK(p);
  const sat = satP(pBar);
  const L = { h: sat.hL, s: sat.sL, v: sat.vL };
  const V = { h: sat.hV, s: sat.sV, v: sat.vV };
  if (s < L.s) {
    const T = solveT((t) => liquidPT(p, t), s, BY_S, ts - 10, 273.15, ts);
    const r = liquidPT(p, T);
    return { T: T - TK, p: pBar, h: r.h, s, v: r.v, x: 0, phase: 'liquido' };
  }
  if (s > V.s) {
    const T = solveT((t) => vaporPT(p, t), s, BY_S, ts + 50, ts, 1073.15);
    const r = vaporPT(p, T);
    return { T: T - TK, p: pBar, h: r.h, s, v: r.v, x: 1, phase: 'vapore' };
  }
  const x = (s - L.s) / (V.s - L.s);
  return { T: ts - TK, p: pBar, h: L.h + x * (V.h - L.h), s, v: L.v + x * (V.v - L.v), x, phase: 'bifase' };
}

export function hPS(pBar, s) {
  return propsPS(pBar, s).h;
}

// Funzioni esposte per i test di verifica IAPWS (unità SI MPa/K).
export const _internal = { region1, region2, region3, psatMPa, tsatK, pB23, tB23 };
