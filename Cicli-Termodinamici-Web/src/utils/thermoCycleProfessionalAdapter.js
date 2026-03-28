const PROFESSIONAL_CYCLE_SOLVER_ENDPOINT = import.meta.env.VITE_THERMO_CYCLE_SOLVER_URL?.trim() ?? '';
const PROFESSIONAL_CYCLE_SOLVER_TIMEOUT_MS = 15000;

const CYCLE_FAMILY_MAP = {
  otto: 'ideal-gas',
  diesel: 'ideal-gas',
  dual: 'ideal-gas',
  brayton: 'ideal-gas',
  carnot: 'ideal-gas',
  rankine: 'steam',
  'vapor-compression': 'refrigeration',
  refrigeration: 'refrigeration',
  combined: 'combined',
};

const DEFAULT_PRIMARY_FLUID = {
  otto: 'Air',
  diesel: 'Air',
  dual: 'Air',
  brayton: 'Air',
  carnot: 'Air',
  rankine: 'Water',
  'vapor-compression': 'R134a',
  refrigeration: 'R134a',
  combined: 'Mixed',
};

const pickCycleFamily = (cycleId, explicitFamily) => explicitFamily ?? CYCLE_FAMILY_MAP[cycleId] ?? 'generic';

const pickPrimaryFluid = (cycleId, explicitFluid) => explicitFluid ?? DEFAULT_PRIMARY_FLUID[cycleId] ?? 'Generic';

const summarizeLocalResult = (localResult) => {
  if (!localResult || typeof localResult !== 'object') {
    return {
      available: false,
      shape: null,
    };
  }

  const shape = {};

  if (Array.isArray(localResult.points)) shape.points = localResult.points.length;
  if (Array.isArray(localResult.realPoints)) shape.realPoints = localResult.realPoints.length;
  if (Array.isArray(localResult.idealPoints)) shape.idealPoints = localResult.idealPoints.length;
  if (Array.isArray(localResult.actualPoints)) shape.actualPoints = localResult.actualPoints.length;
  if (Array.isArray(localResult.actualPaths)) shape.actualPaths = localResult.actualPaths.length;
  if (Array.isArray(localResult.idealPaths)) shape.idealPaths = localResult.idealPaths.length;
  if (Array.isArray(localResult.lossPaths)) shape.lossPaths = localResult.lossPaths.length;
  if (localResult.stats && typeof localResult.stats === 'object') shape.stats = Object.keys(localResult.stats);
  if (localResult.dome) shape.dome = true;
  if (localResult.brayton) shape.hasBrayton = true;
  if (localResult.rankine) shape.hasRankine = true;

  return {
    available: true,
    shape,
  };
};

export const buildThermoCycleSolverPayload = ({
  cycleId,
  variant = null,
  mode = null,
  family = null,
  primaryFluid = null,
  secondaryFluid = null,
  inputs = {},
  outputsRequested = {},
  solverPreferences = {},
  localResult = null,
} = {}) => ({
  adapter: 'thermohub-thermo-cycle-bridge',
  generatedAt: new Date().toISOString(),
  cycle: {
    id: cycleId ?? 'unknown',
    variant,
    family: pickCycleFamily(cycleId, family),
    mode: mode ?? 'didactic',
  },
  workingFluid: {
    primary: pickPrimaryFluid(cycleId, primaryFluid),
    secondary: secondaryFluid ?? null,
  },
  inputs: {
    ...inputs,
  },
  outputsRequested: {
    diagrams: ['ts', 'pv', 'hs', 'schematic'],
    includeStateTable: true,
    includeEnergyBalance: true,
    includeExergy: false,
    includePaths: true,
    ...outputsRequested,
  },
  solverPreferences: {
    engine: 'auto',
    diagramEngine: 'auto',
    accuracyLevel: 'technical',
    allowPressureLosses: true,
    allowOffDesign: false,
    allowCombustionChemistry: false,
    ...solverPreferences,
  },
  localReference: summarizeLocalResult(localResult),
});

const mergeCycleResult = (externalResult, localResult) => {
  if (!localResult || typeof localResult !== 'object') {
    return externalResult;
  }

  return {
    ...localResult,
    ...externalResult,
    stats: {
      ...(localResult.stats ?? {}),
      ...(externalResult.stats ?? {}),
    },
    diagramData: {
      ...(localResult.diagramData ?? {}),
      ...(externalResult.diagramData ?? {}),
    },
  };
};

export const normalizeExternalCycleResult = (response, localResult = null) => {
  if (!response || typeof response !== 'object' || !response.result || typeof response.result !== 'object') {
    return {
      result: localResult,
      solverMeta: {
        source: 'local',
        usedFallback: true,
        detail: 'Risposta solver cicli non valida.',
        warnings: [],
      },
    };
  }

  return {
    result: mergeCycleResult(response.result, localResult),
    solverMeta: {
      source: response.solver?.source ?? 'external',
      engine: response.solver?.engine ?? 'unknown',
      diagramEngine: response.solver?.diagramEngine ?? 'unknown',
      usedFallback: false,
      detail: response.solver?.detail ?? 'Solver professionale esterno',
      warnings: Array.isArray(response.solver?.warnings) ? response.solver.warnings : [],
      convergence: response.solver?.convergence ?? null,
    },
  };
};

export const solveWithProfessionalCycleSolver = async (payload) => {
  if (!PROFESSIONAL_CYCLE_SOLVER_ENDPOINT) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), PROFESSIONAL_CYCLE_SOLVER_TIMEOUT_MS);

  try {
    const response = await fetch(PROFESSIONAL_CYCLE_SOLVER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Solver HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export const resolveThermoCycleResult = async ({
  cycleId,
  variant = null,
  mode = null,
  family = null,
  primaryFluid = null,
  secondaryFluid = null,
  inputs = {},
  outputsRequested = {},
  solverPreferences = {},
  localResult = null,
} = {}) => {
  if (!PROFESSIONAL_CYCLE_SOLVER_ENDPOINT) {
    return {
      result: localResult,
      solverMeta: {
        source: 'local',
        usedFallback: false,
        detail: 'Solver locale ThermoHub',
        warnings: [],
      },
    };
  }

  const payload = buildThermoCycleSolverPayload({
    cycleId,
    variant,
    mode,
    family,
    primaryFluid,
    secondaryFluid,
    inputs,
    outputsRequested,
    solverPreferences,
    localResult,
  });

  try {
    const response = await solveWithProfessionalCycleSolver(payload);

    if (!response) {
      return {
        result: localResult,
        solverMeta: {
          source: 'local',
          usedFallback: true,
          detail: 'Endpoint professionale non configurato.',
          warnings: [],
        },
      };
    }

    return normalizeExternalCycleResult(response, localResult);
  } catch (error) {
    return {
      result: localResult,
      solverMeta: {
        source: 'local',
        usedFallback: true,
        detail: error.message,
        warnings: [`Fallback locale: solver professionale non disponibile (${error.message}).`],
      },
    };
  }
};

export const getThermoCycleSolverConfig = () => ({
  endpoint: PROFESSIONAL_CYCLE_SOLVER_ENDPOINT,
  enabled: Boolean(PROFESSIONAL_CYCLE_SOLVER_ENDPOINT),
});
