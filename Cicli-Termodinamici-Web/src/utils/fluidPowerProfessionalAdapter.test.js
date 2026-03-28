import {
  buildProfessionalSolverPayload,
  getProfessionalSolverConfig,
  resolveFluidPowerSnapshot,
} from './fluidPowerProfessionalAdapter';

const nodes = [
  {
    instanceId: 'pump-1',
    componentId: 'hydraulic-pump',
    domain: 'hydraulic',
    x: 0,
    y: 0,
    rotation: 0,
    label: 'Pompa idraulica 1',
    state: {},
    parameters: {},
  },
  {
    instanceId: 'valve-1',
    componentId: 'hydraulic-valve-3-2',
    domain: 'hydraulic',
    x: 0,
    y: 0,
    rotation: 0,
    label: 'Valvola 3/2 1',
    state: { currentState: 'attiva' },
    parameters: {},
  },
  {
    instanceId: 'cylinder-1',
    componentId: 'hydraulic-single-cylinder',
    domain: 'hydraulic',
    x: 0,
    y: 0,
    rotation: 0,
    label: 'Cilindro 1',
    state: {},
    parameters: {},
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
    parameters: {},
  },
];

const connections = [
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

describe('fluidPowerProfessionalAdapter', () => {
  test('builds a professional solver payload with modelica export', () => {
    const payload = buildProfessionalSolverPayload(nodes, connections, 'hydraulic');

    expect(payload.adapter).toBe('thermohub-openhydraulics-bridge');
    expect(payload.domain).toBe('hydraulic');
    expect(payload.components).toHaveLength(4);
    expect(payload.connections).toHaveLength(3);
    expect(payload.openHydraulics.mappedComponents.length).toBeGreaterThan(0);
    expect(payload.modelica.source).toMatch(/OpenHydraulics\.Components|connect\(/i);
    expect(payload.modelica.source).toContain('extends OpenHydraulics.Interfaces.PartialFluidCircuit;');
    expect(payload.modelica.source).toContain('OpenHydraulics.Components.MotorsPumps.ConstantDisplacementPump pump_1(Dconst=0.000012);');
    expect(payload.modelica.source).toContain('Modelica.Blocks.Sources.Constant valve_1_control(k=1);');
    expect(payload.modelica.source).toContain('connect(pump_1.portP, valve_1.portP);');
    expect(payload.modelica.source).toContain('connect(valve_1_control.y, valve_1.control);');
    expect(payload.openHydraulics.mappedComponents[0].modifiers).toBeDefined();
  });

  test('falls back to the local solver when no professional endpoint is configured', async () => {
    const result = await resolveFluidPowerSnapshot(nodes, connections, 'hydraulic');

    expect(getProfessionalSolverConfig().enabled).toBe(false);
    expect(result.snapshot.valid).toBe(true);
    expect(result.snapshot.isRunning).toBe(true);
    expect(result.solverMeta.source).toBe('local');
    expect(result.solverMeta.usedFallback).toBe(false);
  });
});
