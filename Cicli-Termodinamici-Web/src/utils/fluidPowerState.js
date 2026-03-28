import { createProjectMeta, touchProjectMeta } from './fluidPowerProject';

export const createEmptyFluidPowerSnapshot = () => ({
  valid: false,
  verdict: 'incomplete',
  isRunning: false,
  activePorts: [],
  activeConnections: [],
  activeNodes: [],
  connectionStates: {},
  netStates: {},
  warnings: [],
  actuatorAction: null,
  measurements: {},
  readings: {},
  actuatorTiming: null,
  summary: null,
  solverMeta: {
    source: 'local',
    usedFallback: false,
    detail: 'Solver locale ThermoHub',
  },
  events: [],
});

export const createFluidPowerWorkspace = () => ({
  nodes: [],
  connections: [],
  nets: [],
  pendingPort: null,
  selectedEntity: null,
  lastRun: null,
  baselineRun: null,
  scenarioId: 'startup-sequence',
  timelineStep: 0,
  snapshot: createEmptyFluidPowerSnapshot(),
  message: 'Trascina i componenti nel canvas e collega le porte per costruire il circuito.',
});

export const createFluidPowerFeatureState = () => ({
  projectMeta: createProjectMeta(),
  ui: {
    activeDomain: 'hydraulic',
  },
  workspaces: {
    hydraulic: createFluidPowerWorkspace(),
    pneumatic: createFluidPowerWorkspace(),
  },
});

export const touchFluidPowerProjectMeta = (projectMeta) => touchProjectMeta(projectMeta);
