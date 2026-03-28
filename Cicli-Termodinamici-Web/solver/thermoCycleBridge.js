import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CoolPropModule from 'coolprop-wasm/coolprop';
import {
  AIR,
  calcOttoCycle,
  calcDieselCycle,
  calcBraytonCycle,
  calcRegenerativeBraytonCycle,
  calcCarnotCycle,
  calcReverseCarnotCycle,
  calcDualCycle,
} from '../src/utils/idealGas.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOLPROP_WASM_PATH = path.join(__dirname, '..', 'public', 'coolprop.wasm');

let coolPropInstance = null;
let coolPropPromise = null;

const isDefined = (value) => value !== undefined && value !== null;
const buildLogSamples = (minValue, maxValue, steps) =>
  Array.from({ length: steps + 1 }, (_, index) => minValue * (maxValue / minValue) ** (index / steps));

const WATER_CRITICAL_POINT = {
  p: 220.64,
  t: 373.946,
  v: 0.003106,
  h: 2087.6,
  s: 4.412,
};

const fallbackDome = {
  ts: { s: [], t: [] },
  hs: { s: [], h: [] },
  ph: { h: [], p: [] },
  pv: { v: [], p: [] },
};

export const ensureNodeCoolProp = async () => {
  if (coolPropInstance) return coolPropInstance;

  if (!coolPropPromise) {
    coolPropPromise = CoolPropModule({
      locateFile: (filePath) => (filePath.endsWith('.wasm') ? COOLPROP_WASM_PATH : filePath),
    }).then((module) => {
      coolPropInstance = module;
      return module;
    }).catch((error) => {
      coolPropPromise = null;
      throw error;
    });
  }

  return coolPropPromise;
};

export const solveFluidNode = async (inputs, fluid = 'Water') => {
  const lib = await ensureNodeCoolProp();

  let p;
  let t;
  let h;
  let s;
  let q = -1;
  let density;

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
  } else {
    throw new Error(`Unsupported state specification for ${fluid}`);
  }

  if (![p, t, h, s].every(Number.isFinite)) {
    throw new Error(`Invalid thermodynamic state calculated for ${fluid}`);
  }

  density = lib.PropsSI('D', 'P', p, 'T', t, fluid);

  return {
    p: p / 1e5,
    t: t - 273.15,
    h: h / 1e3,
    s: s / 1e3,
    q,
    v: Number.isFinite(density) && density > 0 ? 1 / density : null,
  };
};

const buildDomeEnvelope = (liquid, vapor, criticalPoint) => ({
  s: [...liquid.s, criticalPoint.s, ...vapor.s.slice().reverse()],
  t: [...liquid.t, criticalPoint.t, ...vapor.t.slice().reverse()],
  h: [...liquid.h, criticalPoint.h, ...vapor.h.slice().reverse()],
  v: [...liquid.v, criticalPoint.v, ...vapor.v.slice().reverse()],
  p: [...liquid.p, criticalPoint.p, ...vapor.p.slice().reverse()],
});

export const getSaturationDomeFullNode = async (fluid = 'Water') => {
  const lib = await ensureNodeCoolProp();

  try {
    const pMin = lib.PropsSI('ptriple', 'D', 0, 'H', 0, fluid) / 1e5;
    const pCrit = lib.PropsSI('pcrit', 'D', 0, 'H', 0, fluid) / 1e5;
    const sampleMax = pCrit * 0.999;
    const steps = fluid === 'Water' ? 120 : 80;

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
        // skip invalid two-phase boundary samples
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
  } catch {
    return fallbackDome;
  }
};

const directSegment = (from, to) => [{ ...from }, { ...to }];

const buildRankineStateSet = async ({
  pHigh,
  pLow,
  etaT,
  etaP,
  variant,
  tMax,
  pReheat,
  tReheat,
}) => {
  const st1 = await solveFluidNode({ p: pLow, q: 0 }, 'Water');
  const st2s = await solveFluidNode({ p: pHigh, s: st1.s }, 'Water');
  const h2 = st1.h + (st2s.h - st1.h) / etaP;
  const st2 = await solveFluidNode({ p: pHigh, h: h2 }, 'Water');

  let st3;
  if (variant === 'simple') {
    st3 = await solveFluidNode({ p: pHigh, q: 1 }, 'Water');
  } else {
    st3 = await solveFluidNode({ p: pHigh, t: tMax }, 'Water');
  }

  if (variant !== 'reheat') {
    const st4s = await solveFluidNode({ p: pLow, s: st3.s }, 'Water');
    const h4 = st3.h - (st3.h - st4s.h) * etaT;
    const st4 = await solveFluidNode({ p: pLow, h: h4 }, 'Water');

    return {
      actualPoints: [st1, st2, st3, st4],
      idealPoints: [st1, st2s, st3, st4s],
      stats: {
        wt: st3.h - st4.h,
        wp: st2.h - st1.h,
        q_in: st3.h - st2.h,
      },
    };
  }

  const st4s = await solveFluidNode({ p: pReheat, s: st3.s }, 'Water');
  const h4 = st3.h - (st3.h - st4s.h) * etaT;
  const st4 = await solveFluidNode({ p: pReheat, h: h4 }, 'Water');
  const st5 = await solveFluidNode({ p: pReheat, t: tReheat }, 'Water');
  const st6s = await solveFluidNode({ p: pLow, s: st5.s }, 'Water');
  const h6 = st5.h - (st5.h - st6s.h) * etaT;
  const st6 = await solveFluidNode({ p: pLow, h: h6 }, 'Water');

  return {
    actualPoints: [st1, st2, st3, st4, st5, st6],
    idealPoints: [st1, st2s, st3, st4s, st5, st6s],
    stats: {
      wt: (st3.h - st4.h) + (st5.h - st6.h),
      wp: st2.h - st1.h,
      q_in: (st3.h - st2.h) + (st5.h - st4.h),
      wt_hp: st3.h - st4.h,
      wt_lp: st5.h - st6.h,
      q_reheat: st5.h - st4.h,
    },
  };
};

export const calcRankineCycleNode = async ({
  p_high,
  p_low,
  t_max,
  p_reheat,
  t_reheat,
  eta_t,
  eta_p,
  mass_flow,
  variant = 'simple',
}) => {
  const stateSet = await buildRankineStateSet({
    pHigh: p_high,
    pLow: p_low,
    etaT: eta_t,
    etaP: eta_p,
    variant,
    tMax: t_max,
    pReheat: p_reheat,
    tReheat: t_reheat,
  });

  const qOut = stateSet.stats.q_in - (stateSet.stats.wt - stateSet.stats.wp);
  const wNet = stateSet.stats.wt - stateSet.stats.wp;

  return {
    ...stateSet,
    actualPaths: variant === 'reheat'
      ? [
          directSegment(stateSet.actualPoints[0], stateSet.actualPoints[1]),
          directSegment(stateSet.actualPoints[1], stateSet.actualPoints[2]),
          directSegment(stateSet.actualPoints[2], stateSet.actualPoints[3]),
          directSegment(stateSet.actualPoints[3], stateSet.actualPoints[4]),
          directSegment(stateSet.actualPoints[4], stateSet.actualPoints[5]),
          directSegment(stateSet.actualPoints[5], stateSet.actualPoints[0]),
        ]
      : [
          directSegment(stateSet.actualPoints[0], stateSet.actualPoints[1]),
          directSegment(stateSet.actualPoints[1], stateSet.actualPoints[2]),
          directSegment(stateSet.actualPoints[2], stateSet.actualPoints[3]),
          directSegment(stateSet.actualPoints[3], stateSet.actualPoints[0]),
        ],
    idealPaths: stateSet.idealPoints.map((point, index) =>
      directSegment(point, stateSet.idealPoints[(index + 1) % stateSet.idealPoints.length])),
    lossPaths: variant === 'reheat'
      ? [
          directSegment(stateSet.actualPoints[1], stateSet.idealPoints[1]),
          directSegment(stateSet.actualPoints[3], stateSet.idealPoints[3]),
          directSegment(stateSet.actualPoints[5], stateSet.idealPoints[5]),
        ]
      : [
          directSegment(stateSet.actualPoints[1], stateSet.idealPoints[1]),
          directSegment(stateSet.actualPoints[3], stateSet.idealPoints[3]),
        ],
    dome: await getSaturationDomeFullNode('Water'),
    stats: {
      ...stateSet.stats,
      q_out: qOut,
      eta: stateSet.stats.q_in > 0 ? (wNet / stateSet.stats.q_in) * 100 : 0,
      power: wNet * mass_flow,
    },
  };
};

export const calcRefrigerationCycleNode = async ({
  t_evap,
  t_cond,
  sh,
  sc,
  eta_s,
  mass_flow,
  refrigerant = 'R134a',
}) => {
  const st1sat = await solveFluidNode({ t: t_evap, q: 1 }, refrigerant);
  const st1 = await solveFluidNode({ p: st1sat.p, t: t_evap + sh }, refrigerant);
  const st3sat = await solveFluidNode({ t: t_cond, q: 0 }, refrigerant);
  const st2s = await solveFluidNode({ p: st3sat.p, s: st1.s }, refrigerant);
  const h2r = st1.h + (st2s.h - st1.h) / eta_s;
  const st2r = await solveFluidNode({ p: st3sat.p, h: h2r }, refrigerant);
  const st3 = await solveFluidNode({ p: st3sat.p, t: t_cond - sc }, refrigerant);
  const st4 = await solveFluidNode({ p: st1sat.p, h: st3.h }, refrigerant);

  const win = st2r.h - st1.h;
  const qlow = st1.h - st4.h;
  const qhigh = st2r.h - st3.h;

  return {
    allPoints: [st1, st2r, st3, st4],
    idealPoint2s: st2s,
    segmentPaths: [
      directSegment(st1, st2r),
      directSegment(st2r, st3),
      directSegment(st3, st4),
      directSegment(st4, st1),
    ],
    idealCompPath: directSegment(st1, st2s),
    dome: (await getSaturationDomeFullNode(refrigerant)).ts,
    domePh: (await getSaturationDomeFullNode(refrigerant)).ph,
    stats: {
      win,
      qlow,
      qhigh,
      cop: qlow / win,
      cop_hp: qhigh / win,
      useful_capacity: qlow * mass_flow,
    },
  };
};

export const calcCombinedCycleNode = async ({
  p_low_air,
  beta,
  t_air_in,
  t_turb_in,
  eta_c,
  eta_t_gas,
  mass_flow_gas,
  eta_hrsg,
  p_high_steam,
  p_low_steam,
  eta_t_steam,
  eta_p_steam,
}) => {
  const brayton = calcBraytonCycle({
    p1Bar: p_low_air,
    t1C: t_air_in,
    p2Bar: p_low_air * beta,
    t3C: t_turb_in,
    etaComp: eta_c,
    etaTurb: eta_t_gas,
    massFlow: mass_flow_gas,
  });

  const rankine = await calcRankineCycleNode({
    p_high: p_high_steam,
    p_low: p_low_steam,
    eta_t: eta_t_steam,
    eta_p: eta_p_steam,
    mass_flow: 1,
    variant: 'simple',
  });

  const exhaustT = brayton.realPoints[3].t;
  const availableRecovery = Math.max(0, exhaustT - t_air_in);
  const recoveredHeatPerKgGas = AIR.cp * availableRecovery * Math.max(0, Math.min(1, eta_hrsg));
  const qSteamPerKg = rankine.stats.q_in;
  const massFlowSteam = qSteamPerKg > 0 ? (mass_flow_gas * recoveredHeatPerKgGas) / qSteamPerKg : 0;
  const braytonPower = brayton.stats.power;
  const rankinePower = (rankine.stats.wt - rankine.stats.wp) * massFlowSteam;
  const totalPower = braytonPower + rankinePower;
  const fuelHeatRate = brayton.stats.q_in * mass_flow_gas;

  return {
    brayton,
    rankine,
    massFlowSteam,
    stats: {
      eta_hrsg: eta_hrsg * 100,
      q_recovered: recoveredHeatPerKgGas * mass_flow_gas,
      power_brayton: braytonPower,
      power_rankine: rankinePower,
      power_total: totalPower,
      eta_total: fuelHeatRate > 0 ? (totalPower / fuelHeatRate) * 100 : 0,
      eta_brayton: brayton.stats.eta,
      eta_rankine: rankine.stats.eta,
    },
  };
};

export const validateThermoCyclePayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return {
      valid: false,
      errors: ['Payload solver assente o non valido.'],
    };
  }

  const errors = [];

  if (!payload.cycle || typeof payload.cycle !== 'object') {
    errors.push('Sezione "cycle" mancante.');
  }

  if (!payload.cycle?.id) {
    errors.push('Campo "cycle.id" mancante.');
  }

  if (!payload.inputs || typeof payload.inputs !== 'object') {
    errors.push('Sezione "inputs" non valida.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const getThermoCycleCapabilities = async () => {
  let coolPropReady = false;

  try {
    await ensureNodeCoolProp();
    coolPropReady = true;
  } catch {
    coolPropReady = false;
  }

  return {
    available: true,
    mode: 'bridge-prototype',
    engines: ['local-js', ...(coolPropReady ? ['coolprop-wasm-node'] : [])],
    plannedEngines: ['tespy', 'fluprodia', 'cantera', 'exerpy'],
    cycleFamilies: ['ideal-gas', 'steam', 'refrigeration', 'combined', 'combustion'],
    fluids: ['Air', 'Water', 'R134a', 'R410A', 'R32', 'R22', 'R290', 'R600a'],
    features: {
      exergy: false,
      combustion: false,
      offDesign: false,
      pressureLosses: false,
      diagramRendering: false,
      localFallbackCompatibility: true,
      coolPropNodeReady: coolPropReady,
    },
  };
};

const solveIdealGasCycle = (payload) => {
  const { cycle, inputs } = payload;

  switch (cycle.id) {
    case 'otto':
      return calcOttoCycle(inputs);
    case 'diesel':
      return calcDieselCycle(inputs);
    case 'dual':
      return calcDualCycle(inputs);
    case 'brayton':
      return cycle.variant === 'regenerative'
        ? calcRegenerativeBraytonCycle(inputs)
        : calcBraytonCycle(inputs);
    case 'carnot':
      return cycle.mode === 'reverse'
        ? calcReverseCarnotCycle(inputs)
        : calcCarnotCycle(inputs);
    default:
      throw new Error(`Ciclo ideale non supportato: ${cycle.id}`);
  }
};

export const solveThermoCyclePayload = async (payload) => {
  const validation = validateThermoCyclePayload(payload);
  if (!validation.valid) {
    return {
      ok: false,
      statusCode: 400,
      errors: validation.errors,
    };
  }

  const { cycle, inputs, workingFluid } = payload;
  let result;
  const warnings = [];

  switch (cycle.id) {
    case 'otto':
    case 'diesel':
    case 'dual':
    case 'brayton':
    case 'carnot':
      result = solveIdealGasCycle(payload);
      break;
    case 'rankine':
      result = await calcRankineCycleNode({
        ...inputs,
        variant: cycle.variant ?? 'simple',
      });
      break;
    case 'refrigeration':
    case 'vapor-compression':
      result = await calcRefrigerationCycleNode({
        ...inputs,
        refrigerant: workingFluid?.primary ?? 'R134a',
      });
      break;
    case 'combined':
      result = await calcCombinedCycleNode(inputs);
      warnings.push('Solver combinato locale prototipale: il blocco vapore usa il modello Rankine locale, non ancora TESPy.');
      break;
    default:
      return {
        ok: false,
        statusCode: 501,
        errors: [`Ciclo non supportato dal bridge locale: ${cycle.id}`],
      };
  }

  return {
    ok: true,
    statusCode: 200,
    result,
    solver: {
      source: 'external',
      engine: 'thermohub-local-cycle-bridge',
      diagramEngine: 'local-js',
      detail: 'Bridge locale cicli termodinamici con solver JS/CoolProp in Node',
      warnings,
      convergence: {
        success: true,
        iterations: 1,
      },
    },
  };
};
