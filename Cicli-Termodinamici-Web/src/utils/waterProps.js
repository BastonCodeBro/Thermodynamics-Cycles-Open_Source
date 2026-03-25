import CoolPropModule from 'coolprop-wasm/coolprop';

let CoolPropInstance = null;
let initPromise = null;

const WATER_CRITICAL_POINT = {
  p: 220.64,
  t: 373.946,
  v: 0.003106,
  h: 2087.6,
  s: 4.412,
};

export const ensureCoolProp = async () => {
  if (CoolPropInstance) return CoolPropInstance;
  if (!initPromise) {
    initPromise = CoolPropModule({
      locateFile: (path) => (path.endsWith('.wasm') ? '/coolprop.wasm' : path),
    })
      .then((module) => {
        CoolPropInstance = module;
        return CoolPropInstance;
      })
      .catch((error) => {
        console.error('Failed to initialize CoolProp:', error);
        initPromise = null;
        throw error;
      });
  }
  return initPromise;
};

const isDefined = (value) => value !== undefined && value !== null;
const buildLogSamples = (minValue, maxValue, steps) =>
  Array.from({ length: steps + 1 }, (_, index) => minValue * (maxValue / minValue) ** (index / steps));

/**
 * Calculates fluid properties.
 * Units: bar, C, kJ/kg, kJ/(kg K), m^3/kg
 */
export const solveFluid = async (inputs, fluid = 'Water') => {
  const lib = await ensureCoolProp();
  try {
    let p;
    let t;
    let h;
    let s;
    let q = -1;
    let d;

    if (isDefined(inputs.p) && isDefined(inputs.t)) {
      p = inputs.p * 1e5;
      t = inputs.t + 273.15;
      h = lib.PropsSI('H', 'P', p, 'T', t, fluid);
      s = lib.PropsSI('S', 'P', p, 'T', t, fluid);
    } else if (isDefined(inputs.p) && isDefined(inputs.h)) {
      p = inputs.p * 1e5;
      h = inputs.h * 1e3;
      t = lib.PropsSI('T', 'P', p, 'H', h, fluid);
      s = lib.PropsSI('S', 'P', p, 'H', h, fluid);
    } else if (isDefined(inputs.p) && isDefined(inputs.s)) {
      p = inputs.p * 1e5;
      s = inputs.s * 1e3;
      t = lib.PropsSI('T', 'P', p, 'S', s, fluid);
      h = lib.PropsSI('H', 'P', p, 'S', s, fluid);
    } else if (isDefined(inputs.p) && isDefined(inputs.q)) {
      p = inputs.p * 1e5;
      q = inputs.q;
      t = lib.PropsSI('T', 'P', p, 'Q', q, fluid);
      h = lib.PropsSI('H', 'P', p, 'Q', q, fluid);
      s = lib.PropsSI('S', 'P', p, 'Q', q, fluid);
    } else if (isDefined(inputs.t) && isDefined(inputs.q)) {
      t = inputs.t + 273.15;
      q = inputs.q;
      p = lib.PropsSI('P', 'T', t, 'Q', q, fluid);
      h = lib.PropsSI('H', 'T', t, 'Q', q, fluid);
      s = lib.PropsSI('S', 'T', t, 'Q', q, fluid);
    } else if (isDefined(inputs.v) && isDefined(inputs.s)) {
      d = 1 / inputs.v;
      s = inputs.s * 1e3;
      p = lib.PropsSI('P', 'D', d, 'S', s, fluid);
      t = lib.PropsSI('T', 'D', d, 'S', s, fluid);
      h = lib.PropsSI('H', 'D', d, 'S', s, fluid);
    } else if (isDefined(inputs.v) && isDefined(inputs.h)) {
      d = 1 / inputs.v;
      h = inputs.h * 1e3;
      p = lib.PropsSI('P', 'D', d, 'H', h, fluid);
      t = lib.PropsSI('T', 'D', d, 'H', h, fluid);
      s = lib.PropsSI('S', 'D', d, 'H', h, fluid);
    } else if (isDefined(inputs.v) && isDefined(inputs.t)) {
      d = 1 / inputs.v;
      t = inputs.t + 273.15;
      p = lib.PropsSI('P', 'D', d, 'T', t, fluid);
      h = lib.PropsSI('H', 'D', d, 'T', t, fluid);
      s = lib.PropsSI('S', 'D', d, 'T', t, fluid);
    } else if (isDefined(inputs.v) && isDefined(inputs.p)) {
      d = 1 / inputs.v;
      p = inputs.p * 1e5;
      t = lib.PropsSI('T', 'D', d, 'P', p, fluid);
      h = lib.PropsSI('H', 'D', d, 'P', p, fluid);
      s = lib.PropsSI('S', 'D', d, 'P', p, fluid);
    } else {
      throw new Error(`Unsupported state specification for ${fluid}`);
    }

    if (![p, t, h, s].every(Number.isFinite)) {
      throw new Error(`Invalid thermodynamic state calculated for ${fluid}`);
    }

    const finalV = inputs.v ?? (1 / lib.PropsSI('D', 'P', p, 'T', t, fluid));
    return {
      p: p / 1e5,
      t: t - 273.15,
      h: h / 1e3,
      s: s / 1e3,
      q,
      v: finalV,
    };
  } catch (error) {
    console.error(`CoolProp Solve Error (${fluid}):`, error, inputs);
    throw error;
  }
};

const buildDomeEnvelope = (liquid, vapor, criticalPoint) => ({
  s: [...liquid.s, criticalPoint.s, ...vapor.s.slice().reverse()],
  t: [...liquid.t, criticalPoint.t, ...vapor.t.slice().reverse()],
  h: [...liquid.h, criticalPoint.h, ...vapor.h.slice().reverse()],
  v: [...liquid.v, criticalPoint.v, ...vapor.v.slice().reverse()],
  p: [...liquid.p, criticalPoint.p, ...vapor.p.slice().reverse()],
});

const fallbackDome = {
  ts: { s: [], t: [] },
  hs: { s: [], h: [] },
  ph: { h: [], p: [] },
  pv: { v: [], p: [] },
};

export const getSaturationDomeFull = async (fluid = 'Water') => {
  const lib = await ensureCoolProp();
  try {
    const pMin = lib.PropsSI('ptriple', 'D', 0, 'H', 0, fluid) / 1e5;
    const pCrit = lib.PropsSI('pcrit', 'D', 0, 'H', 0, fluid) / 1e5;
    const sampleMax = pCrit * 0.999;
    const steps = fluid === 'Water' ? 140 : 90;

    const liquid = { p: [], t: [], v: [], h: [], s: [] };
    const vapor = { p: [], t: [], v: [], h: [], s: [] };

    for (const pressure of buildLogSamples(pMin, sampleMax, steps)) {
      try {
        const pressurePa = pressure * 1e5;
        const tSat = lib.PropsSI('T', 'P', pressurePa, 'Q', 0, fluid) - 273.15;
        const hL = lib.PropsSI('H', 'P', pressurePa, 'Q', 0, fluid) / 1e3;
        const sL = lib.PropsSI('S', 'P', pressurePa, 'Q', 0, fluid) / 1e3;
        const vL = 1 / lib.PropsSI('D', 'P', pressurePa, 'Q', 0, fluid);
        const hV = lib.PropsSI('H', 'P', pressurePa, 'Q', 1, fluid) / 1e3;
        const sV = lib.PropsSI('S', 'P', pressurePa, 'Q', 1, fluid) / 1e3;
        const vV = 1 / lib.PropsSI('D', 'P', pressurePa, 'Q', 1, fluid);

        liquid.p.push(pressure);
        liquid.t.push(tSat);
        liquid.v.push(vL);
        liquid.h.push(hL);
        liquid.s.push(sL);

        vapor.p.push(pressure);
        vapor.t.push(tSat);
        vapor.v.push(vV);
        vapor.h.push(hV);
        vapor.s.push(sV);
      } catch {
        // Skip invalid two-phase points close to the boundaries.
      }
    }

    if (liquid.p.length < 2 || vapor.p.length < 2) {
      return fallbackDome;
    }

    const lastLiquidIndex = liquid.p.length - 1;
    const lastVaporIndex = vapor.p.length - 1;
    const criticalPoint = fluid === 'Water'
      ? WATER_CRITICAL_POINT
      : {
          p: pCrit,
          t: (liquid.t[lastLiquidIndex] + vapor.t[lastVaporIndex]) / 2,
          v: (liquid.v[lastLiquidIndex] + vapor.v[lastVaporIndex]) / 2,
          h: (liquid.h[lastLiquidIndex] + vapor.h[lastVaporIndex]) / 2,
          s: (liquid.s[lastLiquidIndex] + vapor.s[lastVaporIndex]) / 2,
        };

    const envelope = buildDomeEnvelope(liquid, vapor, criticalPoint);

    return {
      ts: { s: envelope.s, t: envelope.t },
      hs: { s: envelope.s, h: envelope.h },
      ph: { h: envelope.h, p: envelope.p },
      pv: { v: envelope.v, p: envelope.p },
    };
  } catch (error) {
    console.error(`Failed to build saturation dome for ${fluid}:`, error);
    return fallbackDome;
  }
};

export const getSaturationDome = async (fluid = 'Water') => {
  const dome = await getSaturationDomeFull(fluid);
  return dome.ts;
};
