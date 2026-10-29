// Verifica delle proprietà IF97 con i valori di controllo della release IAPWS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { _internal, Tsat, psat, propsPH, propsPS, hPT, satP } from '../js/engine/steam.js';

const { region1, region2, region3, psatMPa, tsatK, pB23 } = _internal;
const close = (a, b, rel = 1e-8) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${a} ≠ ${b}`);

test('regione 1: valori di verifica IAPWS-IF97', () => {
  let r = region1(3, 300);
  close(r.v, 0.100215168e-2);
  close(r.h, 0.115331273e3);
  close(r.s, 0.392294792);
  close(r.cp, 0.417301218e1);
  r = region1(80, 300);
  close(r.h, 0.184142828e3);
  r = region1(3, 500);
  close(r.h, 0.975542239e3);
  close(r.s, 0.258041912e1);
});

test('regione 2: valori di verifica IAPWS-IF97', () => {
  let r = region2(0.0035, 300);
  close(r.v, 0.394913866e2);
  close(r.h, 0.254991145e4);
  close(r.s, 0.852238967e1);
  r = region2(0.0035, 700);
  close(r.h, 0.333568375e4);
  r = region2(30, 700);
  close(r.v, 0.542946619e-2);
  close(r.h, 0.263149474e4);
  close(r.s, 0.517540298e1);
});

test('regione 4: saturazione', () => {
  close(psatMPa(300), 0.353658941e-2);
  close(psatMPa(500), 0.263889776e1);
  close(tsatK(0.1), 0.372755919e3);
  close(tsatK(1), 0.453035632e3);
  close(tsatK(10), 0.584149488e3);
  close(Tsat(1.01325), 99.9743, 1e-5); // ITS-90
  close(psat(Tsat(40)), 40, 1e-9);
});

test('funzioni inverse p-h e p-s coerenti con p-T', () => {
  for (const [p, T] of [[120, 560], [30, 300], [5, 250], [0.05, 20], [150, 200]]) {
    const h = hPT(p, T);
    close(propsPH(p, h).T, T, 1e-7);
    const s = propsPH(p, h).s;
    close(propsPS(p, s).h, h, 1e-7);
  }
  const wet = propsPH(0.05, 2300);
  assert.equal(wet.phase, 'bifase');
  assert.ok(wet.x > 0.8 && wet.x < 0.95);
});

test('regione 3: valori di controllo IAPWS (tabella 33) e frontiera B23', () => {
  for (const [T, rho, p, h, s, cp] of [[650, 500, 0.255837018e2, 0.186343019e4, 0.405427273e1, 0.138935717e2],
    [650, 200, 0.222930643e2, 0.237512401e4, 0.485438792e1, 0.446579342e2], [750, 500, 0.783095639e2, 0.225868845e4, 0.446971906e1, 0.634165359e1]]) {
    const r = region3(rho, T);
    close(r.p, p, 1e-8); close(r.h, h, 1e-8); close(r.s, s, 1e-8); close(r.cp, cp, 1e-6);
  }
  close(pB23(0.62315e3), 0.165291643e2, 1e-8);
  // saturazione oltre 165 bar (tabelle IAPWS: 200 bar → 365,75 °C, h' 1826,6, h'' 2412,3 kJ/kg)
  const s200 = satP(200);
  close(s200.T, 365.75, 1e-3);
  assert.ok(Math.abs(s200.hL - 1826.6) < 2 && Math.abs(s200.hV - 2412.3) < 2);
  // inverse coerenti in regione 3 (liquido compresso e vapore vicino alla saturazione)
  for (const [p, T] of [[173, 352], [173, 360], [190, 355], [185, 600]]) {
    const h = hPT(p, T);
    close(propsPH(p, h).T, T, 1e-7);
    close(propsPS(p, propsPH(p, h).s).h, h, 1e-7);
  }
});
