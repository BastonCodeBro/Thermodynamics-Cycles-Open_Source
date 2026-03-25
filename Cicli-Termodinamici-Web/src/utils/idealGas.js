export const AIR = {
  cp: 1.005,
  cv: 0.718,
  k: 1.4,
  R: 0.287,
};

const toK = (tC) => tC + 273.15;
const toC = (tK) => tK - 273.15;

const linspace = (a, b, n) =>
  Array.from({ length: Math.max(n, 2) }, (_, i) => a + ((b - a) * i) / (Math.max(n, 2) - 1));

export function createIdealGasPoint(
  name,
  tC,
  pBar,
  {
    cp = AIR.cp,
    k = AIR.k,
    R = AIR.R,
    hRef = 0,
    sRef = 0,
    tRefC = 0,
    pRefBar = 1,
  } = {},
) {
  const tK = toK(tC);
  const tRefK = toK(tRefC);

  return {
    name,
    t: tC,
    p: pBar,
    h: hRef + cp * (tC - tRefC),
    s: sRef + cp * Math.log(tK / tRefK) - R * Math.log(pBar / pRefBar),
    v: (R * tK) / (pBar * 100),
    cp,
    k,
    R,
  };
}

export function inferIdealGasProcess(pt1, pt2) {
  const dvRel = Math.abs(pt2.v - pt1.v) / Math.max(Math.abs(pt1.v), 1e-15);
  const dpRel = Math.abs(pt2.p - pt1.p) / Math.max(Math.abs(pt1.p), 1e-15);
  const dsAbs = Math.abs(pt2.s - pt1.s);
  const dtAbs = Math.abs(pt2.t - pt1.t);

  if (dvRel < 1e-3) return 'isochoric';
  if (dpRel < 1e-3) return 'isobaric';
  if (dsAbs < 1e-3) return 'isentropic';
  if (dtAbs < 1e-3) return 'isothermal';
  return 'polytropic';
}

function finalizePath(states, pt1, pt2) {
  if (states.length < 2) return [{ ...pt1 }, { ...pt2 }];
  states[0] = { ...pt1 };
  states[states.length - 1] = { ...pt2 };
  return states;
}

export function generateIdealGasPath(pt1, pt2, processType = 'auto', options = {}) {
  const { n = 64, nExp = null } = options;

  const cp = pt1.cp ?? AIR.cp;
  const k = pt1.k ?? AIR.k;
  const R = pt1.R ?? AIR.R;
  const cv = cp - R;

  const p1 = pt1.p;
  const p2 = pt2.p;
  const t1K = toK(pt1.t);
  const v1 = pt1.v;
  const v2 = pt2.v;
  const h1 = pt1.h;
  const s1 = pt1.s;
  const s2 = pt2.s;

  const kind = processType === 'auto' ? inferIdealGasProcess(pt1, pt2) : processType;

  if (kind === 'isentropic') {
    const vVals = linspace(v1, v2, n);
    const states = vVals.map((v) => {
      const p = p1 * (v1 / v) ** k;
      const tK = (p * v * 100) / R;
      return { p, v, t: toC(tK), h: h1 + cp * (tK - t1K), s: s1, cp, k, R };
    });
    return finalizePath(states, pt1, pt2);
  }

  if (kind === 'isochoric') {
    const sVals = linspace(s1, s2, n);
    const states = sVals.map((s) => {
      const tK = t1K * Math.exp((s - s1) / cv);
      return {
        p: (R * tK) / (v1 * 100),
        v: v1,
        t: toC(tK),
        h: h1 + cp * (tK - t1K),
        s,
        cp,
        k,
        R,
      };
    });
    return finalizePath(states, pt1, pt2);
  }

  if (kind === 'isobaric') {
    const sVals = linspace(s1, s2, n);
    const states = sVals.map((s) => {
      const tK = t1K * Math.exp((s - s1) / cp);
      return {
        p: p1,
        v: (R * tK) / (p1 * 100),
        t: toC(tK),
        h: h1 + cp * (tK - t1K),
        s,
        cp,
        k,
        R,
      };
    });
    return finalizePath(states, pt1, pt2);
  }

  if (kind === 'isothermal') {
    const vVals = linspace(v1, v2, n);
    const states = vVals.map((v) => ({
      p: p1 * (v1 / v),
      v,
      t: pt1.t,
      h: h1,
      s: s1 + R * Math.log(v / v1),
      cp,
      k,
      R,
    }));
    return finalizePath(states, pt1, pt2);
  }

  if (kind === 'polytropic') {
    let exponent = nExp;
    if (exponent == null) {
      if (Math.abs(v2 - v1) < 1e-15) {
        exponent = Number.POSITIVE_INFINITY;
      } else if (Math.abs(p1 - p2) < 1e-15) {
        exponent = 0;
      } else {
        exponent = Math.log(p1 / p2) / Math.log(v2 / v1);
      }
    }

    if (!Number.isFinite(exponent)) return generateIdealGasPath(pt1, pt2, 'isochoric', { n });
    if (Math.abs(exponent) < 1e-12) return generateIdealGasPath(pt1, pt2, 'isobaric', { n });

    const vVals = linspace(v1, v2, n);
    const states = vVals.map((v) => {
      const p = p1 * (v1 / v) ** exponent;
      const tK = (p * v * 100) / R;
      return {
        p,
        v,
        t: toC(tK),
        h: h1 + cp * (tK - t1K),
        s: s1 + cv * Math.log(tK / t1K) + R * Math.log(v / v1),
        cp,
        k,
        R,
      };
    });
    return finalizePath(states, pt1, pt2);
  }

  const tVals = linspace(pt1.t, pt2.t, n);
  const pVals = linspace(p1, p2, n);
  const hVals = linspace(pt1.h, pt2.h, n);
  const sVals = linspace(s1, s2, n);
  const vVals = linspace(v1, v2, n);

  return finalizePath(
    tVals.map((t, index) => ({
      t,
      p: pVals[index],
      h: hVals[index],
      s: sVals[index],
      v: vVals[index],
      cp,
      k,
      R,
    })),
    pt1,
    pt2,
  );
}

export function calcOttoCycle({
  p1Bar,
  t1C,
  r,
  t3C,
  eta = 0.85,
  k = AIR.k,
  cv = AIR.cv,
  massFlow = 1,
}) {
  const R = cv * (k - 1);
  const cp = cv * k;
  const t1K = toK(t1C);
  const t3K = toK(t3C);

  const v1 = (R * t1K) / (p1Bar * 100);
  const v2 = v1 / r;

  const t2sK = t1K * r ** (k - 1);
  const t2K = t1K + (t2sK - t1K) / eta;
  const p2 = p1Bar * (t2K / t1K) * (v1 / v2);

  const p3 = p2 * (t3K / t2K);

  const t4sK = t3K * (1 / r) ** (k - 1);
  const t4K = t3K - eta * (t3K - t4sK);
  const p4 = p3 * (t4K / t3K) * (v2 / v1);

  const ref = { tRefC: t1C, pRefBar: p1Bar };
  const p1 = createIdealGasPoint('1', t1C, p1Bar, { cp, k, R });
  const p2r = createIdealGasPoint('2', toC(t2K), p2, { cp, k, R, hRef: p1.h, sRef: p1.s, ...ref });
  const p3r = createIdealGasPoint('3', t3C, p3, { cp, k, R, hRef: p1.h, sRef: p1.s, ...ref });
  const p4r = createIdealGasPoint('4', toC(t4K), p4, { cp, k, R, hRef: p1.h, sRef: p1.s, ...ref });

  const qIn = cv * (t3K - t2K);
  const qOut = cv * (t4K - t1K);
  const wNet = qIn - qOut;

  const ideal = (eta === 1) ? { points: [p1, p2r, p3r, p4r] } : calcOttoCycle({ p1Bar, t1C, r, t3C, eta: 1, k, cv, massFlow });

  return {
    points: [p1, p2r, p3r, p4r],
    idealPoints: ideal.points,
    stats: {
      wc: cv * (t2K - t1K),
      wt: cv * (t3K - t4K),
      q_in: qIn,
      q_out: qOut,
      eta: qIn > 0 ? (100 * wNet) / qIn : 0,
      eta_ideal: (1 - 1 / r ** (k - 1)) * 100,
      power: wNet * massFlow,
    },
  };
}

export function calcDieselCycle({
  p1Bar,
  t1C,
  r,
  rc,
  eta = 0.85,
  k = AIR.k,
  cv = AIR.cv,
  massFlow = 1,
}) {
  const R = cv * (k - 1);
  const cp = cv * k;
  const t1K = toK(t1C);

  const v1 = (R * t1K) / (p1Bar * 100);
  const v2 = v1 / r;

  const t2sK = t1K * r ** (k - 1);
  const t2K = t1K + (t2sK - t1K) / eta;
  const p2 = p1Bar * (t2K / t1K) * (v1 / v2);

  const p3 = p2;
  const v3 = v2 * rc;
  const t3K = t2K * rc;

  const t4sK = t3K * (v3 / v1) ** (k - 1);
  const t4K = t3K - eta * (t3K - t4sK);
  const p4 = p3 * (t4K / t3K) * (v3 / v1);

  const ref = { tRefC: t1C, pRefBar: p1Bar };
  const p1 = createIdealGasPoint('1', t1C, p1Bar, { cp, k, R });
  const p2r = createIdealGasPoint('2', toC(t2K), p2, { cp, k, R, hRef: p1.h, sRef: p1.s, ...ref });
  const p3r = createIdealGasPoint('3', toC(t3K), p3, { cp, k, R, hRef: p1.h, sRef: p1.s, ...ref });
  const p4r = createIdealGasPoint('4', toC(t4K), p4, { cp, k, R, hRef: p1.h, sRef: p1.s, ...ref });

  const qIn = cp * (t3K - t2K);
  const qOut = cv * (t4K - t1K);
  const wNet = qIn - qOut;

  const ideal = (eta === 1) ? { points: [p1, p2r, p3r, p4r] } : calcDieselCycle({ p1Bar, t1C, r, rc, eta: 1, k, cv, massFlow });

  return {
    points: [p1, p2r, p3r, p4r],
    idealPoints: ideal.points,
    stats: {
      wc: cv * (t2K - t1K),
      wt: wNet + cv * (t2K - t1K),
      q_in: qIn,
      q_out: qOut,
      eta: qIn > 0 ? (100 * wNet) / qIn : 0,
      eta_ideal: (1 - (1 / r ** (k - 1)) * ((rc ** k - 1) / (k * (rc - 1)))) * 100,
      power: wNet * massFlow,
    },
  };
}

export function calcBraytonCycle({
  p1Bar,
  t1C,
  p2Bar,
  t3C,
  etaComp = 1,
  etaTurb = 1,
  cp = AIR.cp,
  k = AIR.k,
  massFlow = 1,
}) {
  const t1K = toK(t1C);
  const t3K = toK(t3C);
  const R = (cp * (k - 1)) / k;
  const ratio = p2Bar / p1Bar;

  const t2sK = t1K * ratio ** ((k - 1) / k);
  const t2rK = t1K + (t2sK - t1K) / etaComp;

  const p4Bar = p1Bar;
  const t4sK = t3K * (p4Bar / p2Bar) ** ((k - 1) / k);
  const t4rK = t3K - etaTurb * (t3K - t4sK);

  const ref = { tRefC: t1C, pRefBar: p1Bar };
  const p1 = createIdealGasPoint('1', t1C, p1Bar, { cp, k, R });
  const p2s = createIdealGasPoint('2s', toC(t2sK), p2Bar, { cp, k, R, hRef: p1.h, sRef: p1.s, ...ref });
  const p2r = createIdealGasPoint('2', toC(t2rK), p2Bar, { cp, k, R, hRef: p1.h, sRef: p1.s, ...ref });
  const p3 = createIdealGasPoint('3', t3C, p2Bar, {
    cp,
    k,
    R,
    hRef: p2r.h,
    sRef: p2r.s,
    tRefC: toC(t2rK),
    pRefBar: p2Bar,
  });
  const p4s = createIdealGasPoint('4s', toC(t4sK), p4Bar, {
    cp,
    k,
    R,
    hRef: p3.h,
    sRef: p3.s,
    tRefC: t3C,
    pRefBar: p2Bar,
  });
  const p4r = createIdealGasPoint('4', toC(t4rK), p4Bar, {
    cp,
    k,
    R,
    hRef: p3.h,
    sRef: p3.s,
    tRefC: t3C,
    pRefBar: p2Bar,
  });

  const wc = cp * (t2rK - t1K);
  const wt = cp * (t3K - t4rK);
  const qIn = cp * (t3K - t2rK);
  const wNet = wt - wc;

  return {
    realPoints: [p1, p2r, p3, p4r],
    idealPoints: [p1, p2s, p3, p4s],
    stats: {
      wc,
      wt,
      q_in: qIn,
      eta: qIn > 0 ? (100 * wNet) / qIn : 0,
      bwr: wt > 0 ? (100 * wc) / wt : 0,
      power: wNet * massFlow,
    },
  };
}

export function calcCarnotCycle({
  tHighC,
  tLowC,
  pRefBar = 1,
  ds = 0.5,
  massFlow = 1,
}) {
  const thK = toK(tHighC);
  const tlK = toK(tLowC);

  const s1 = 1;
  const s2 = s1 + ds;

  const p2 = pRefBar * Math.exp(-(s2 - s1) / AIR.R);
  const p3 = p2 * (tlK / thK) ** (AIR.k / (AIR.k - 1));
  const p4 = p3 * Math.exp((s2 - s1) / AIR.R);

  const p1 = createIdealGasPoint('1', tHighC, pRefBar, { cp: AIR.cp, k: AIR.k, R: AIR.R });
  const p2r = createIdealGasPoint('2', tHighC, p2, {
    cp: AIR.cp,
    k: AIR.k,
    R: AIR.R,
    hRef: p1.h,
    sRef: s1,
    tRefC: tHighC,
    pRefBar,
  });
  const p3r = createIdealGasPoint('3', tLowC, p3, {
    cp: AIR.cp,
    k: AIR.k,
    R: AIR.R,
    hRef: p2r.h,
    sRef: s2,
    tRefC: tHighC,
    pRefBar: p2,
  });
  const p4r = createIdealGasPoint('4', tLowC, p4, {
    cp: AIR.cp,
    k: AIR.k,
    R: AIR.R,
    hRef: p3r.h,
    sRef: s1,
    tRefC: tLowC,
    pRefBar: p3,
  });

  const qIn = thK * ds;
  const qOut = tlK * ds;
  const wNet = qIn - qOut;

  return {
    points: [p1, p2r, p3r, p4r],
    stats: {
      Q_in: qIn,
      Q_out: qOut,
      W_net: wNet,
      eta: (1 - tlK / thK) * 100,
      power: wNet * massFlow,
      ds,
    },
  };
}
