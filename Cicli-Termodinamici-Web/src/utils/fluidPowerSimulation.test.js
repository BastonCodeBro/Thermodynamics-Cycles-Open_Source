import { applyValveState, buildSimulationFlow, validateCircuit } from './fluidPowerSimulation';

const baseNodes = [
  {
    instanceId: 'pump-1',
    componentId: 'hydraulic-pump',
    domain: 'hydraulic',
    x: 0,
    y: 0,
    rotation: 0,
    label: 'Pompa idraulica 1',
    state: {},
  },
  {
    instanceId: 'valve-1',
    componentId: 'hydraulic-valve-3-2',
    domain: 'hydraulic',
    x: 0,
    y: 0,
    rotation: 0,
    label: 'Valvola 3/2 monostabile 1',
    state: { currentState: 'riposo' },
  },
  {
    instanceId: 'cylinder-1',
    componentId: 'hydraulic-single-cylinder',
    domain: 'hydraulic',
    x: 0,
    y: 0,
    rotation: 0,
    label: 'Cilindro a singolo effetto 1',
    state: {},
  },
  {
    instanceId: 'tank-1',
    componentId: 'hydraulic-reservoir',
    domain: 'hydraulic',
    x: 0,
    y: 0,
    rotation: 0,
    label: 'Serbatoio 1',
    state: {},
  },
];

const baseConnections = [
  {
    id: 'c1',
    domain: 'hydraulic',
    kind: 'fluid',
    from: { nodeId: 'pump-1', portId: 'P' },
    to: { nodeId: 'valve-1', portId: 'P' },
    pathPoints: [],
  },
  {
    id: 'c2',
    domain: 'hydraulic',
    kind: 'fluid',
    from: { nodeId: 'valve-1', portId: 'A' },
    to: { nodeId: 'cylinder-1', portId: 'A' },
    pathPoints: [],
  },
  {
    id: 'c3',
    domain: 'hydraulic',
    kind: 'fluid',
    from: { nodeId: 'valve-1', portId: 'R' },
    to: { nodeId: 'tank-1', portId: 'IN' },
    pathPoints: [],
  },
];

describe('fluidPowerSimulation', () => {
  test('validates a minimal didactic hydraulic circuit', () => {
    const result = validateCircuit(baseNodes, baseConnections, 'hydraulic');

    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  test('activates exhaust path when valve is in rest position for single-acting cylinder', () => {
    const result = buildSimulationFlow(baseNodes, baseConnections, 'hydraulic');

    expect(result.valid).toBe(true);
    expect(result.isRunning).toBe(true);
    expect(result.actuatorAction).toBe('ritorno a molla');
    expect(result.warnings[0]).toMatch(/ritorno a molla/i);
  });

  test('toggles the valve state and builds an active simulation snapshot', () => {
    const toggledNodes = applyValveState(baseNodes, 'valve-1');
    const result = buildSimulationFlow(toggledNodes, baseConnections, 'hydraulic');

    expect(toggledNodes[1].state.currentState).toBe('attiva');
    expect(result.valid).toBe(true);
    expect(result.isRunning).toBe(true);
    expect(result.actuatorAction).toBe('estensione');
    expect(result.activeConnections).toEqual(expect.arrayContaining(['c1', 'c2', 'c3']));
  });
});
