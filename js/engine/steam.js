// Proprietà dell'acqua/vapore secondo IAPWS-IF97 (regioni 1, 2 e 4).
// API pubblica in unità ingegneristiche: pressione [bar], temperatura [°C],
// entalpia [kJ/kg], entropia [kJ/(kg·K)], volume specifico [m³/kg].
// La regione 3 non è implementata: il campo di validità usato dal simulatore
// è p ≤ 165 bar (sotto il punto in cui la saturazione entra in regione 3).

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

// ------------------------------------------------------------ API pubblica
export const P_MAX_BAR = 165;

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
  const L = region1(p, T);
  const V = region2(p, T);
  return { T: T - TK, hL: L.h, hV: V.h, sL: L.s, sV: V.s, vL: L.v, vV: V.v };
}

/** Proprietà monofase (liquido o vapore surriscaldato) a p [bar], T [°C]. */
export function propsPT(pBar, TC) {
  const p = mpa(pBar);
  const T = TC + TK;
  const ts = tsatK(p);
  const r = T <= ts ? region1(p, T) : region2(p, T);
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
  const L = region1(p, ts);
  const V = region2(p, ts);
  if (h < L.h) {
    const T = solveT((t) => region1(p, t), h, BY_H, ts - (L.h - h) / 4.2, 273.15, ts);
    const r = region1(p, T);
    return { T: T - TK, p: pBar, h, s: r.s, v: r.v, x: 0, phase: 'liquido' };
  }
  if (h > V.h) {
    const T = solveT((t) => region2(p, t), h, BY_H, ts + (h - V.h) / 2.2, ts, 1073.15);
    const r = region2(p, T);
    return { T: T - TK, p: pBar, h, s: r.s, v: r.v, x: 1, phase: 'vapore' };
  }
  const x = (h - L.h) / (V.h - L.h);
  return { T: ts - TK, p: pBar, h, s: L.s + x * (V.s - L.s), v: L.v + x * (V.v - L.v), x, phase: 'bifase' };
}

/** Stato completo da p [bar] e s [kJ/(kg·K)]. */
export function propsPS(pBar, s) {
  const p = mpa(pBar);
  const ts = tsatK(p);
  const L = region1(p, ts);
  const V = region2(p, ts);
  if (s < L.s) {
    const T = solveT((t) => region1(p, t), s, BY_S, ts - 10, 273.15, ts);
    const r = region1(p, T);
    return { T: T - TK, p: pBar, h: r.h, s, v: r.v, x: 0, phase: 'liquido' };
  }
  if (s > V.s) {
    const T = solveT((t) => region2(p, t), s, BY_S, ts + 50, ts, 1073.15);
    const r = region2(p, T);
    return { T: T - TK, p: pBar, h: r.h, s, v: r.v, x: 1, phase: 'vapore' };
  }
  const x = (s - L.s) / (V.s - L.s);
  return { T: ts - TK, p: pBar, h: L.h + x * (V.h - L.h), s, v: L.v + x * (V.v - L.v), x, phase: 'bifase' };
}

export function hPS(pBar, s) {
  return propsPS(pBar, s).h;
}

// Funzioni esposte per i test di verifica IAPWS (unità SI MPa/K).
export const _internal = { region1, region2, psatMPa, tsatK };
