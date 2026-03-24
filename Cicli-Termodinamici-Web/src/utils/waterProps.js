import CoolPropModule from 'coolprop-wasm/coolprop';

let CoolPropInstance = null;
let initPromise = null;

export const ensureCoolProp = async () => {
  if (CoolPropInstance) return CoolPropInstance;
  if (!initPromise) {
    initPromise = CoolPropModule({
      locateFile: (path) => path.endsWith('.wasm') ? '/coolprop.wasm' : path
    }).then(module => {
      CoolPropInstance = module;
      return CoolPropInstance;
    }).catch(err => {
      console.error("Failed to initialize CoolProp:", err);
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
};

/**
 * Calculates fluid properties.
 * bar, °C, kJ/kg, kJ/kg·K, m³/kg
 */
export const solveFluid = async (inputs, fluid = 'Water') => {
  const lib = await ensureCoolProp();
  try {
    let p, t, h, s, q = -1, d;
    
    if (inputs.p !== undefined && inputs.t !== undefined && inputs.t !== null) {
      p = inputs.p * 1e5;
      t = inputs.t + 273.15;
      h = lib.PropsSI('H', 'P', p, 'T', t, fluid);
      s = lib.PropsSI('S', 'P', p, 'T', t, fluid);
    } else if (inputs.p !== undefined && inputs.h !== undefined && inputs.h !== null) {
      p = inputs.p * 1e5;
      h = inputs.h * 1e3;
      t = lib.PropsSI('T', 'P', p, 'H', h, fluid);
      s = lib.PropsSI('S', 'P', p, 'H', h, fluid);
    } else if (inputs.p !== undefined && inputs.s !== undefined && inputs.s !== null) {
      p = inputs.p * 1e5;
      s = inputs.s * 1e3;
      t = lib.PropsSI('T', 'P', p, 'S', s, fluid);
      h = lib.PropsSI('H', 'P', p, 'S', s, fluid);
    } else if (inputs.p !== undefined && inputs.q !== undefined && inputs.q !== null) {
      p = inputs.p * 1e5;
      q = inputs.q;
      t = lib.PropsSI('T', 'P', p, 'Q', q, fluid);
      h = lib.PropsSI('H', 'P', p, 'Q', q, fluid);
      s = lib.PropsSI('S', 'P', p, 'Q', q, fluid);
    } else if (inputs.t !== undefined && inputs.q !== undefined && inputs.q !== null) {
      t = inputs.t + 273.15;
      q = inputs.q;
      p = lib.PropsSI('P', 'T', t, 'Q', q, fluid);
      h = lib.PropsSI('H', 'T', t, 'Q', q, fluid);
      s = lib.PropsSI('S', 'T', t, 'Q', q, fluid);
    } else if (inputs.v !== undefined && inputs.s !== undefined && inputs.s !== null) {
      d = 1 / inputs.v;
      s = inputs.s * 1e3;
      p = lib.PropsSI('P', 'D', d, 'S', s, fluid);
      t = lib.PropsSI('T', 'D', d, 'S', s, fluid);
      h = lib.PropsSI('H', 'D', d, 'S', s, fluid);
    } else if (inputs.v !== undefined && inputs.h !== undefined && inputs.h !== null) {
      d = 1 / inputs.v;
      h = inputs.h * 1e3;
      p = lib.PropsSI('P', 'D', d, 'H', h, fluid);
      t = lib.PropsSI('T', 'D', d, 'H', h, fluid);
      s = lib.PropsSI('S', 'D', d, 'H', h, fluid);
    } else if (inputs.v !== undefined && (inputs.t !== undefined && inputs.t !== null)) {
      d = 1 / inputs.v;
      t = inputs.t + 273.15;
      p = lib.PropsSI('P', 'D', d, 'T', t, fluid);
      h = lib.PropsSI('H', 'D', d, 'T', t, fluid);
      s = lib.PropsSI('S', 'D', d, 'T', t, fluid);
    } else if (inputs.v !== undefined && (inputs.p !== undefined && inputs.p !== null)) {
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

    const final_v = inputs.v || 1 / lib.PropsSI('D', 'P', p, 'T', t, fluid);
    return {
      p: p / 1e5,
      t: t - 273.15,
      h: h / 1e3,
      s: s / 1e3,
      q: q,
      v: final_v
    };
  } catch (e) {
    console.error(`CoolProp Solve Error (${fluid}):`, e, inputs);
    throw e;
  }
};

export const getSaturationDome = async (fluid = 'Water') => {
  const lib = await ensureCoolProp();
  try {
    const pMin = lib.PropsSI('ptriple', 'D', 0, 'H', 0, fluid);
    const pMax = lib.PropsSI('pcrit', 'D', 0, 'H', 0, fluid) * 0.999;

    const steps = 30;
    const s_liq = [], t_liq = [], s_vap = [], t_vap = [];

    for (let i = 0; i <= steps; i++) {
      const p = pMin * Math.pow(pMax/pMin, i/steps);
      try {
        s_liq.push(lib.PropsSI('S', 'P', p, 'Q', 0, fluid) / 1e3);
        t_liq.push(lib.PropsSI('T', 'P', p, 'Q', 0, fluid) - 273.15);
        s_vap.push(lib.PropsSI('S', 'P', p, 'Q', 1, fluid) / 1e3);
        t_vap.push(lib.PropsSI('T', 'P', p, 'Q', 1, fluid) - 273.15);
      } catch { /* skip failed pressure steps */ }
    }

    return {
      s: [...s_liq, ...s_vap.reverse()],
      t: [...t_liq, ...t_vap.reverse()]
    };
  } catch {
    return { s: [], t: [] };
  }
};

export const getSaturationDomeFull = async (fluid = 'Water') => {
  const lib = await ensureCoolProp();
  try {
    const pMin = lib.PropsSI('ptriple', 'D', 0, 'H', 0, fluid);
    const pMax = lib.PropsSI('pcrit', 'D', 0, 'H', 0, fluid) * 0.999;

    const steps = 30;
    const s_liq = [], t_liq = [], h_liq = [], p_arr = [];
    const s_vap = [], t_vap = [], h_vap = [];

    for (let i = 0; i <= steps; i++) {
      const p = pMin * Math.pow(pMax / pMin, i / steps);
      try {
        s_liq.push(lib.PropsSI('S', 'P', p, 'Q', 0, fluid) / 1e3);
        t_liq.push(lib.PropsSI('T', 'P', p, 'Q', 0, fluid) - 273.15);
        h_liq.push(lib.PropsSI('H', 'P', p, 'Q', 0, fluid) / 1e3);
        p_arr.push(p / 1e5);
        s_vap.push(lib.PropsSI('S', 'P', p, 'Q', 1, fluid) / 1e3);
        t_vap.push(lib.PropsSI('T', 'P', p, 'Q', 1, fluid) - 273.15);
        h_vap.push(lib.PropsSI('H', 'P', p, 'Q', 1, fluid) / 1e3);
      } catch { /* skip failed steps */ }
    }

    return {
      ts: {
        s: [...s_liq, ...s_vap.reverse()],
        t: [...t_liq, ...t_vap.reverse()]
      },
      hs: {
        s: [...s_liq, ...s_vap.reverse()],
        h: [...h_liq, ...h_vap.reverse()]
      },
      ph: {
        h: [...h_liq, ...h_vap.reverse()],
        p: [...p_arr, ...p_arr.reverse()]
      }
    };
  } catch {
    return { ts: { s: [], t: [] }, hs: { s: [], h: [] }, ph: { h: [], p: [] } };
  }
};
