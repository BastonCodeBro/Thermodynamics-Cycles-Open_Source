import { solveFluid } from './waterProps';

/**
 * Sample thermodynamic states along the process connecting pt1 → pt2 (real fluid).
 * Classification mirrors calcolatore_acqua.generate_path (IAPWS97).
 * Units: p bar, T °C, h kJ/kg, s kJ/kg·K, v m³/kg
 */
export async function generateProcessPath(pt1, pt2, fluid = 'Water', numPoints = 48) {
  const dp = pt2.p - pt1.p;
  const ds = pt2.s - pt1.s;
  const dh = pt2.h - pt1.h;
  const dv = Math.abs(pt2.v - pt1.v);

  const isIsobaric = Math.abs(dp) < 1e-2;
  const isIsentropic = Math.abs(ds) < 2e-2;
  const isIsenthalpic = Math.abs(dh) < 1e-1;
  const isIsochoric = dv < 1e-6;

  const n = Math.max(numPoints, 2);
  const states = [];

  const linspace = (a, b, count) =>
    Array.from({ length: count }, (_, i) => a + ((b - a) * i) / (count - 1));

  try {
    if (isIsobaric) {
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const h = pt1.h + (pt2.h - pt1.h) * t;
        states.push(await solveFluid({ p: pt1.p, h }, fluid));
      }
    } else if (isIsentropic) {
      const pMin = Math.min(pt1.p, pt2.p);
      const pMax = Math.max(pt1.p, pt2.p);
      let pVals;
      if (pMin > 0 && pMax > 0 && pMax / pMin > 1.001) {
        pVals = Array.from({ length: n }, (_, i) => pMin * (pMax / pMin) ** (i / (n - 1)));
      } else {
        pVals = linspace(pt1.p, pt2.p, n);
      }
      for (const p of pVals) {
        states.push(await solveFluid({ p, s: pt1.s }, fluid));
      }
    } else if (isIsenthalpic) {
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const p = pt1.p + (pt2.p - pt1.p) * t;
        states.push(await solveFluid({ p, h: pt1.h }, fluid));
      }
    } else if (isIsochoric) {
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const p = pt1.p + (pt2.p - pt1.p) * t;
        states.push(await solveFluid({ p, v: pt1.v }, fluid));
      }
    } else {
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const p = pt1.p + (pt2.p - pt1.p) * t;
        const h = pt1.h + (pt2.h - pt1.h) * t;
        states.push(await solveFluid({ p, h }, fluid));
      }
    }
  } catch (e) {
    console.warn('generateProcessPath: fallback to endpoints', e);
    return [pt1, pt2];
  }

  if (states.length < 2) return [pt1, pt2];

  states[0] = { ...pt1 };
  states[states.length - 1] = { ...pt2 };
  return states;
}
