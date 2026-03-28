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

  test('emits typed connection states for pressure and return branches', () => {
    const toggledNodes = applyValveState(baseNodes, 'valve-1');
    const result = buildSimulationFlow(toggledNodes, baseConnections, 'hydraulic');

    expect(result.connectionStates.c1).toMatchObject({
      active: true,
      phase: 'pressure',
    });
    expect(result.connectionStates.c2).toMatchObject({
      active: true,
      phase: 'pressure',
    });
    expect(result.connectionStates.c3).toMatchObject({
      active: true,
      phase: 'return',
    });
    expect(result.measurements).toEqual(result.readings);
  });

  test('activates shaft and suction branches when they are present in the circuit', () => {
    const nodes = [
      ...baseNodes,
      {
        instanceId: 'driver-1',
        componentId: 'hydraulic-prime-mover',
        domain: 'hydraulic',
        x: 0,
        y: 0,
        rotation: 0,
        label: 'Motore primo 1',
        state: {},
      },
    ];
    const connections = [
      ...baseConnections,
      {
        id: 'c4',
        domain: 'hydraulic',
        kind: 'fluid',
        from: { nodeId: 'tank-1', portId: 'OUT' },
        to: { nodeId: 'pump-1', portId: 'S' },
        pathPoints: [],
      },
      {
        id: 'c5',
        domain: 'hydraulic',
        kind: 'mechanical',
        from: { nodeId: 'driver-1', portId: 'shaft' },
        to: { nodeId: 'pump-1', portId: 'drive' },
        pathPoints: [],
      },
    ];

    const toggledNodes = applyValveState(nodes, 'valve-1');
    const result = buildSimulationFlow(toggledNodes, connections, 'hydraulic');

    expect(result.connectionStates.c4).toMatchObject({
      active: true,
      phase: 'suction',
    });
    expect(result.connectionStates.c5).toMatchObject({
      active: true,
      phase: 'mechanical',
    });
    expect(result.activeNodes).toContain('driver-1');
  });

  test('reverses a double-acting hydraulic actuator without stopping the hydraulic routing logic', () => {
    const nodes = [
      {
        instanceId: 'pump-2',
        componentId: 'hydraulic-pump',
        domain: 'hydraulic',
        x: 0,
        y: 0,
        rotation: 0,
        label: 'Pompa idraulica 2',
        state: {},
      },
      {
        instanceId: 'valve-2',
        componentId: 'hydraulic-valve-4-2',
        domain: 'hydraulic',
        x: 0,
        y: 0,
        rotation: 0,
        label: 'Valvola 4/2 bistabile 1',
        state: { currentState: 'A+' },
      },
      {
        instanceId: 'cylinder-2',
        componentId: 'hydraulic-double-cylinder',
        domain: 'hydraulic',
        x: 0,
        y: 0,
        rotation: 0,
        label: 'Cilindro a doppio effetto 1',
        state: {},
      },
      {
        instanceId: 'tank-2',
        componentId: 'hydraulic-reservoir',
        domain: 'hydraulic',
        x: 0,
        y: 0,
        rotation: 0,
        label: 'Serbatoio 2',
        state: {},
      },
    ];
    const connections = [
      {
        id: 'd1',
        domain: 'hydraulic',
        kind: 'fluid',
        from: { nodeId: 'pump-2', portId: 'P' },
        to: { nodeId: 'valve-2', portId: 'P' },
        pathPoints: [],
      },
      {
        id: 'd2',
        domain: 'hydraulic',
        kind: 'fluid',
        from: { nodeId: 'valve-2', portId: 'A' },
        to: { nodeId: 'cylinder-2', portId: 'A' },
        pathPoints: [],
      },
      {
        id: 'd3',
        domain: 'hydraulic',
        kind: 'fluid',
        from: { nodeId: 'valve-2', portId: 'B' },
        to: { nodeId: 'cylinder-2', portId: 'B' },
        pathPoints: [],
      },
      {
        id: 'd4',
        domain: 'hydraulic',
        kind: 'fluid',
        from: { nodeId: 'valve-2', portId: 'T' },
        to: { nodeId: 'tank-2', portId: 'IN' },
        pathPoints: [],
      },
    ];

    const extension = buildSimulationFlow(nodes, connections, 'hydraulic');
    const retraction = buildSimulationFlow(applyValveState(nodes, 'valve-2'), connections, 'hydraulic');

    expect(extension.actuatorAction).toBe('estensione');
    expect(extension.connectionStates.d2.phase).toBe('pressure');
    expect(extension.connectionStates.d3.phase).toBe('return');
    expect(extension.connectionStates.d2.fluidPowerKw).toBeGreaterThan(0);

    expect(retraction.actuatorAction).toBe('ritrazione');
    expect(retraction.connectionStates.d3.phase).toBe('pressure');
    expect(retraction.connectionStates.d2.phase).toBe('return');
    expect(retraction.connectionStates.d3.fluidPowerKw).toBeGreaterThan(0);
  });

  test('reduces timing and branch power when a flow control is throttled', () => {
    const nodes = [
      baseNodes[0],
      { ...baseNodes[1], state: { currentState: 'attiva' } },
      baseNodes[2],
      baseNodes[3],
      {
        instanceId: 'fc-1',
        componentId: 'hydraulic-flow-control',
        domain: 'hydraulic',
        x: 0,
        y: 0,
        rotation: 0,
        label: 'Regolatore di flusso 1',
        state: { flowMultiplier: 0.25 },
      },
    ];
    const connections = [
      baseConnections[0],
      {
        id: 'fc2',
        domain: 'hydraulic',
        kind: 'fluid',
        from: { nodeId: 'valve-1', portId: 'A' },
        to: { nodeId: 'fc-1', portId: 'IN' },
        pathPoints: [],
      },
      {
        id: 'fc3',
        domain: 'hydraulic',
        kind: 'fluid',
        from: { nodeId: 'fc-1', portId: 'OUT' },
        to: { nodeId: 'cylinder-1', portId: 'A' },
        pathPoints: [],
      },
      baseConnections[2],
    ];

    const result = buildSimulationFlow(nodes, connections, 'hydraulic');

    expect(result.actuatorTiming.actualStrokeTime).toBeGreaterThan(2);
    expect(result.connectionStates.fc2.flowRate).toBeLessThan(22);
    expect(result.connectionStates.fc2.fluidPowerKw).toBeLessThan(result.connectionStates.c1.fluidPowerKw);
  });

  test('uses pneumatic pressure levels for a compressed-air circuit', () => {
    const nodes = [
      {
        instanceId: 'comp-1',
        componentId: 'pneumatic-compressor',
        domain: 'pneumatic',
        x: 0,
        y: 0,
        rotation: 0,
        label: 'Compressore 1',
        state: {},
      },
      {
        instanceId: 'valve-p-1',
        componentId: 'pneumatic-valve-4-2',
        domain: 'pneumatic',
        x: 0,
        y: 0,
        rotation: 0,
        label: 'Valvola 5/2 1',
        state: { currentState: 'A+' },
      },
      {
        instanceId: 'cyl-p-1',
        componentId: 'pneumatic-double-cylinder',
        domain: 'pneumatic',
        x: 0,
        y: 0,
        rotation: 0,
        label: 'Cilindro pneumatico 1',
        state: {},
      },
      {
        instanceId: 'exhaust-1',
        componentId: 'pneumatic-exhaust',
        domain: 'pneumatic',
        x: 0,
        y: 0,
        rotation: 0,
        label: 'Scarico 1',
        state: {},
      },
    ];
    const connections = [
      {
        id: 'p1',
        domain: 'pneumatic',
        kind: 'fluid',
        from: { nodeId: 'comp-1', portId: 'P' },
        to: { nodeId: 'valve-p-1', portId: 'P' },
        pathPoints: [],
      },
      {
        id: 'p2',
        domain: 'pneumatic',
        kind: 'fluid',
        from: { nodeId: 'valve-p-1', portId: 'A' },
        to: { nodeId: 'cyl-p-1', portId: 'A' },
        pathPoints: [],
      },
      {
        id: 'p3',
        domain: 'pneumatic',
        kind: 'fluid',
        from: { nodeId: 'valve-p-1', portId: 'B' },
        to: { nodeId: 'cyl-p-1', portId: 'B' },
        pathPoints: [],
      },
      {
        id: 'p4',
        domain: 'pneumatic',
        kind: 'fluid',
        from: { nodeId: 'valve-p-1', portId: 'R' },
        to: { nodeId: 'exhaust-1', portId: 'R' },
        pathPoints: [],
      },
    ];

    const result = buildSimulationFlow(nodes, connections, 'pneumatic');

    expect(result.valid).toBe(true);
    expect(result.connectionStates.p1.pressureIn).toBeLessThan(10);
    expect(result.connectionStates.p1.flowRate).toBeGreaterThan(100);
    expect(result.actuatorAction).toBe('estensione');
  });
});
