import { getComponentDefinition } from '../data/fluidPowerCatalog';
import { buildSimulationFlow } from './fluidPowerSimulation';

const PROFESSIONAL_SOLVER_ENDPOINT = import.meta.env.VITE_FLUID_POWER_SOLVER_URL?.trim() ?? '';
const PROFESSIONAL_SOLVER_TIMEOUT_MS = 12000;

const SUPPORTED_COMPONENT_TYPES = {
  source: 'source',
  valve: 'directional-valve',
  actuator: 'actuator',
  sink: 'sink',
  conditioning: 'conditioning',
  flowControl: 'flow-control',
  auxiliary: 'auxiliary',
  instrument: 'instrument',
  driver: 'driver',
};

const PROFESSIONAL_ENGINEERING_DEFAULTS = {
  source: {
    hydraulic: {
      nominalPressureBar: 140,
      nominalFlowRateLpm: 22,
      volumetricEfficiency: 0.92,
      mechanicalEfficiency: 0.88,
      displacementCcRev: 12,
      shaftSpeedRpm: 1450,
    },
  },
  valve: {
    hydraulic: {
      ratedPressureBar: 210,
      nominalFlowRateLpm: 30,
      pressureDropBar: 3.2,
    },
  },
  actuator: {
    hydraulic: {
      single: { boreMm: 50, rodMm: 0, strokeMm: 180, mechanicalEfficiency: 0.92 },
      double: { boreMm: 63, rodMm: 36, strokeMm: 250, mechanicalEfficiency: 0.9 },
      rotary: { displacementCcRev: 50, mechanicalEfficiency: 0.88, nominalPressureBar: 140 },
    },
  },
  flowControl: {
    hydraulic: { regulationRange: '25-100%', nominalFlowRateLpm: 18, pressureDropBar: 3.2 },
  },
  sink: {
    hydraulic: { reservoirVolumeL: 40, backPressureBar: 1.1 },
  },
};

const OPEN_HYDRAULICS_COMPONENT_MAP = {
  'hydraulic-pump': {
    className: 'OpenHydraulics.Components.MotorsPumps.ConstantDisplacementPump',
    supportLevel: 'native',
    portMap: {
      P: 'portP',
      S: 'portT',
    },
    notes: 'Mapped to ConstantDisplacementPump from OpenHydraulics.Components.MotorsPumps.',
  },
  'hydraulic-reservoir': {
    className: 'OpenHydraulics.Components.Volumes.Tank',
    supportLevel: 'native',
    portMap: {
      IN: 'port',
      OUT: 'port',
    },
    notes: 'Mapped to Tank from OpenHydraulics.Components.Volumes.',
  },
  'hydraulic-double-cylinder': {
    className: 'OpenHydraulics.Components.Cylinders.DoubleActingCylinder',
    supportLevel: 'native',
    portMap: {
      A: 'port_a',
      B: 'port_b',
    },
    notes: 'Mapped to DoubleActingCylinder from OpenHydraulics.Components.Cylinders.',
    usesSizingParameters: true,
  },
  'hydraulic-rotary-motor': {
    className: 'OpenHydraulics.Components.MotorsPumps.Motor',
    supportLevel: 'native',
    portMap: {
      A: 'port_a',
      B: 'port_b',
    },
    notes: 'Mapped to Motor from OpenHydraulics.Components.MotorsPumps.',
    usesSizingParameters: true,
  },
  'hydraulic-check-valve': {
    className: 'OpenHydraulics.Components.Valves.CheckValve',
    supportLevel: 'native',
    portMap: {
      IN: 'port_a',
      OUT: 'port_b',
    },
    notes: 'Mapped to CheckValve from OpenHydraulics.Components.Valves.',
  },
  'hydraulic-flow-control': {
    className: 'OpenHydraulics.Basic.VariableRestriction',
    supportLevel: 'native',
    portMap: {
      IN: 'port_a',
      OUT: 'port_b',
    },
    notes: 'Mapped to VariableRestriction from OpenHydraulics.Basic.',
    usesSizingParameters: true,
  },
  'hydraulic-valve-3-2': {
    className: 'OpenHydraulics.Components.Valves.DirectionalValves.V4_3CC',
    supportLevel: 'manual',
    portMap: {
      P: 'portP',
      A: 'portA',
      R: 'portT',
    },
    notes:
      'Inferred mapping to a 4-port/3-position directional valve. Requires manual metering/orifice tuning for strict equivalence.',
    usesSizingParameters: true,
    usesControlSignal: true,
    requiresUnusedBDrain: true,
  },
  'hydraulic-valve-4-2': {
    className: 'OpenHydraulics.Components.Valves.DirectionalValves.V4_3CC',
    supportLevel: 'manual',
    portMap: {
      P: 'portP',
      A: 'portA',
      B: 'portB',
      T: 'portT',
    },
    notes:
      'Inferred mapping to V4_3CC because OpenHydraulics documents a 4-port/3-position closed-center valve package. Manual state translation still required.',
    usesSizingParameters: true,
    usesControlSignal: true,
  },
  'hydraulic-limit-valve': {
    className: 'OpenHydraulics.Components.Valves.DirectionalValves.V4_3CC',
    supportLevel: 'manual',
    portMap: {
      P: 'portP',
      A: 'portA',
      R: 'portT',
    },
    notes:
      'Directional limit valve mapped to a generic closed-center directional valve shell; final actuation law still manual.',
    usesSizingParameters: true,
    usesControlSignal: true,
    requiresUnusedBDrain: true,
  },
};

const sanitizeModelicaIdentifier = (value) => {
  const normalized = (value ?? 'component').replace(/[^a-zA-Z0-9_]/g, '_');
  return /^[A-Za-z_]/.test(normalized) ? normalized : `c_${normalized}`;
};

const getOpenHydraulicsDescriptor = (componentId) =>
  OPEN_HYDRAULICS_COMPONENT_MAP[componentId] ?? null;

const litersPerMinuteToCubicMetersPerSecond = (value) => value / 60000;

const cubicCentimetersPerRevToCubicMeters = (value) => value / 1_000_000;

const millimetersToMeters = (value) => value / 1000;

const barToPascal = (value) => value * 100000;

const getProfessionalDefaults = (component, parameterOverrides) => {
  const kind = component?.simBehavior?.kind;

  if (kind === 'actuator') {
    return {
      ...(PROFESSIONAL_ENGINEERING_DEFAULTS.actuator.hydraulic?.[
        component.simBehavior.actuatorType
      ] ?? {}),
      nominalPressureBar: 140,
      ...parameterOverrides,
    };
  }

  if (kind && PROFESSIONAL_ENGINEERING_DEFAULTS[kind]?.hydraulic) {
    return {
      ...PROFESSIONAL_ENGINEERING_DEFAULTS[kind].hydraulic,
      ...parameterOverrides,
    };
  }

  return {
    ...parameterOverrides,
  };
};

const buildOpenHydraulicsModifiers = (componentId, specs) => {
  switch (componentId) {
    case 'hydraulic-pump':
      return {
        Dconst: cubicCentimetersPerRevToCubicMeters(specs.displacementCcRev ?? 12),
      };
    case 'hydraulic-double-cylinder':
      return {
        boreDiameter: millimetersToMeters(specs.boreMm ?? 63),
        rodDiameter: millimetersToMeters(specs.rodMm ?? 36),
        strokeLength: millimetersToMeters(specs.strokeMm ?? 250),
        q_nom: litersPerMinuteToCubicMetersPerSecond(specs.nominalFlowRateLpm ?? 22),
        maxPressure: barToPascal(specs.nominalPressureBar ?? 140),
      };
    case 'hydraulic-rotary-motor':
      return {
        Dconst: cubicCentimetersPerRevToCubicMeters(specs.displacementCcRev ?? 50),
      };
    case 'hydraulic-flow-control':
      return {
        q_nom: litersPerMinuteToCubicMetersPerSecond(specs.nominalFlowRateLpm ?? 18),
        dp_nom: barToPascal(specs.pressureDropBar ?? 3.2),
      };
    case 'hydraulic-valve-3-2':
      return {
        q_nom: litersPerMinuteToCubicMetersPerSecond(specs.nominalFlowRateLpm ?? 30),
        dp_nom: barToPascal(specs.pressureDropBar ?? 3.2),
        q_fraction_P2B: 0,
        q_fraction_B2T: 0,
      };
    case 'hydraulic-valve-4-2':
    case 'hydraulic-limit-valve':
      return {
        q_nom: litersPerMinuteToCubicMetersPerSecond(specs.nominalFlowRateLpm ?? 30),
        dp_nom: barToPascal(specs.pressureDropBar ?? 3.2),
      };
    case 'hydraulic-reservoir':
      return {
        p_const: barToPascal(specs.backPressureBar ?? 1.1),
      };
    default:
      return {};
  }
};

const getValveControlValue = (componentId, currentState) => {
  if (componentId === 'hydraulic-valve-4-2') {
    return currentState === 'B+' ? -1 : 1;
  }

  if (componentId === 'hydraulic-valve-3-2' || componentId === 'hydraulic-limit-valve') {
    return currentState === 'attiva' ? 1 : -1;
  }

  return 0;
};

const formatModifierValue = (value) => {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? `${value}` : `${Number(value.toFixed(9))}`;
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return JSON.stringify(value);
};

const buildModelicaModifierString = (modifiers) => {
  const entries = Object.entries(modifiers).filter(([, value]) => value != null);

  if (entries.length === 0) {
    return '';
  }

  return `(${entries.map(([key, value]) => `${key}=${formatModifierValue(value)}`).join(', ')})`;
};

const mapNodeToProfessionalComponent = (node) => {
  const component = getComponentDefinition(node.componentId);

  if (!component) {
    return null;
  }

  const parameterOverrides =
    typeof node.parameters === 'object' && node.parameters ? node.parameters : {};
  const professionalParameters =
    component.domain === 'hydraulic'
      ? getProfessionalDefaults(component, parameterOverrides)
      : { ...parameterOverrides };
  const openHydraulicsDescriptor = getOpenHydraulicsDescriptor(component.id);

  return {
    id: node.instanceId,
    componentId: component.id,
    label: node.label,
    domain: component.domain,
    kind: SUPPORTED_COMPONENT_TYPES[component.simBehavior?.kind] ?? 'unsupported',
    symbol: component.symbol,
    family: component.simBehavior?.family ?? null,
    actuatorType: component.simBehavior?.actuatorType ?? null,
    ports: component.ports.map((port) => ({
      id: port.id,
      label: port.label,
      side: port.side,
      kind: port.kind,
    })),
    professionalParameters,
    openHydraulics: openHydraulicsDescriptor
      ? {
        ...openHydraulicsDescriptor,
        modifiers: buildOpenHydraulicsModifiers(component.id, professionalParameters),
      }
      : {
        className: null,
        supportLevel: component.domain === 'hydraulic' ? 'unsupported' : 'outside-domain',
        portMap: {},
        modifiers: {},
        notes:
          component.domain === 'hydraulic'
            ? 'Nessun mapping OpenHydraulics automatico disponibile per questo componente.'
            : 'OpenHydraulics copre il dominio idraulico, non quello pneumatico.',
      },
    state: node.state ?? {},
    parameters: node.parameters ?? {},
  };
};

const buildOpenHydraulicsInstances = (components) => {
  const lines = components
    .filter((component) => component.openHydraulics?.className)
    .map((component) => {
      const instanceName = sanitizeModelicaIdentifier(component.id);
      const className = component.openHydraulics.className;
      const comment = component.openHydraulics.notes;
      const modifierString = buildModelicaModifierString(component.openHydraulics.modifiers ?? {});

      return `  ${className} ${instanceName}${modifierString}; // ${comment}`;
    });

  return lines.join('\n');
};

const buildValveControlSources = (components) => {
  const lines = components
    .filter((component) => component.openHydraulics?.usesControlSignal)
    .map((component) => {
      const stateValue = getValveControlValue(component.componentId, component.state?.currentState);
      const instanceName = sanitizeModelicaIdentifier(component.id);

      return `  Modelica.Blocks.Sources.Constant ${instanceName}_control(k=${formatModifierValue(stateValue)});`;
    });

  return lines.join('\n');
};

const buildAuxiliaryBoundaryInstances = (components) => {
  const lines = components
    .filter((component) => component.openHydraulics?.requiresUnusedBDrain)
    .map((component) => {
      const instanceName = sanitizeModelicaIdentifier(component.id);

      return `  OpenHydraulics.Components.Volumes.Tank ${instanceName}_unusedB_sink; // Boundary sink for unused B port`;
    });

  return lines.join('\n');
};

const buildOpenHydraulicsMappingComments = (components) => {
  const lines = components
    .filter(
      (component) =>
        !component.openHydraulics?.className ||
        component.openHydraulics.supportLevel !== 'native',
    )
    .map((component) => {
      const descriptor = component.openHydraulics;

      return `  // ${component.id} -> ${
        descriptor?.className ?? 'no automatic OpenHydraulics target'
      } [${descriptor?.supportLevel ?? 'unsupported'}]`;
    });

  return lines.join('\n');
};

const buildConnectionStatements = (components, connections) => {
  const componentMap = new Map(components.map((component) => [component.id, component]));
  const lines = connections.map((connection) => {
    const fromComponent = componentMap.get(connection.from.nodeId);
    const toComponent = componentMap.get(connection.to.nodeId);
    const fromPort =
      fromComponent?.openHydraulics?.portMap?.[connection.from.portId] ?? connection.from.portId;
    const toPort =
      toComponent?.openHydraulics?.portMap?.[connection.to.portId] ?? connection.to.portId;
    const canConnect =
      Boolean(fromComponent?.openHydraulics?.className) &&
      Boolean(toComponent?.openHydraulics?.className) &&
      fromComponent?.openHydraulics?.portMap?.[connection.from.portId] &&
      toComponent?.openHydraulics?.portMap?.[connection.to.portId];

    if (!canConnect) {
      return `  // unresolved connection: ${sanitizeModelicaIdentifier(connection.from.nodeId)}.${fromPort} -> ${sanitizeModelicaIdentifier(connection.to.nodeId)}.${toPort}`;
    }

    return `  connect(${sanitizeModelicaIdentifier(connection.from.nodeId)}.${fromPort}, ${sanitizeModelicaIdentifier(connection.to.nodeId)}.${toPort});`;
  });

  return lines.join('\n');
};

const buildAuxiliaryConnectionStatements = (components) => {
  const lines = [];

  components.forEach((component) => {
    const instanceName = sanitizeModelicaIdentifier(component.id);

    if (component.openHydraulics?.usesControlSignal) {
      lines.push(`  connect(${instanceName}_control.y, ${instanceName}.control);`);
    }

    if (component.openHydraulics?.requiresUnusedBDrain) {
      lines.push(`  connect(${instanceName}.portB, ${instanceName}_unusedB_sink.port);`);
    }
  });

  return lines.join('\n');
};

const buildHydraulicModelicaModel = (components, connections, domain) => {
  const lines = [
    'within ThermoHub.Generated;',
    `model FluidPowerCircuit_${domain}`,
    '  extends OpenHydraulics.Interfaces.PartialFluidCircuit;',
    '  import OpenHydraulics;',
    '  import Modelica;',
    buildOpenHydraulicsInstances(components) ||
      '  // Nessuna istanza OpenHydraulics generata automaticamente.',
    buildValveControlSources(components),
    buildAuxiliaryBoundaryInstances(components),
    buildOpenHydraulicsMappingComments(components) ||
      '  // Tutti i componenti del circuito hanno un mapping nativo OpenHydraulics.',
    'equation',
    buildConnectionStatements(components, connections) || '  // Nessun collegamento da tradurre.',
    buildAuxiliaryConnectionStatements(components),
    `end FluidPowerCircuit_${domain};`,
  ];

  return `${lines.join('\n')}`;
};

const buildFallbackModelicaModel = (components, connections, domain) => {
  const componentLines = components.flatMap((component, index) => [
    `  parameter String component_${index + 1}_id = "${component.id}";`,
    `  parameter String component_${index + 1}_kind = "${component.kind ?? 'unsupported'}";`,
    `  parameter String component_${index + 1}_componentId = "${component.componentId}";`,
  ]);
  const connectionLines = connections.flatMap((connection, index) => [
    `  parameter String connection_${index + 1}_id = "${connection.id}";`,
    `  parameter String connection_${index + 1}_from = "${connection.from.nodeId}.${connection.from.portId}";`,
    `  parameter String connection_${index + 1}_to = "${connection.to.nodeId}.${connection.to.portId}";`,
    `  parameter String connection_${index + 1}_kind = "${connection.kind}";`,
  ]);
  const lines = [
    'within ThermoHub.Generated;',
    `model FluidPowerCircuit_${domain}`,
    '  // Domain outside current OpenHydraulics automatic support. Metadata-only export.',
    ...componentLines,
    ...connectionLines,
    'equation',
    '  // Placeholder export for a professional solver backend.',
    `end FluidPowerCircuit_${domain};`,
  ];

  return `${lines.join('\n')}`;
};

export const buildProfessionalSolverPayload = (nodes, connections, domain) => {
  const components = nodes.map(mapNodeToProfessionalComponent).filter(Boolean);
  const circuitConnections = connections.map((connection) => ({
    id: connection.id,
    domain: connection.domain,
    kind: connection.kind,
    from: connection.from,
    to: connection.to,
    pathPoints: connection.pathPoints ?? [],
  }));

  const unsupportedComponents = components.filter((component) => component.kind === 'unsupported');
  const openHydraulics = {
    mappedComponents: components
      .filter((component) => component.openHydraulics?.className)
      .map((component) => ({
        id: component.id,
        componentId: component.componentId,
        className: component.openHydraulics.className,
        supportLevel: component.openHydraulics.supportLevel,
        portMap: component.openHydraulics.portMap,
        modifiers: component.openHydraulics.modifiers,
        parameters: component.professionalParameters,
        notes: component.openHydraulics.notes,
      })),
    unsupportedComponents: components
      .filter((component) => !component.openHydraulics?.className)
      .map((component) => ({
        id: component.id,
        componentId: component.componentId,
        reason: component.openHydraulics?.notes ?? 'Nessun mapping disponibile.',
      })),
  };
  const modelicaModel =
    domain === 'hydraulic'
      ? buildHydraulicModelicaModel(components, circuitConnections, domain)
      : buildFallbackModelicaModel(components, circuitConnections, domain);

  return {
    adapter: 'thermohub-openhydraulics-bridge',
    domain,
    generatedAt: new Date().toISOString(),
    componentCount: components.length,
    connectionCount: circuitConnections.length,
    unsupportedComponents: unsupportedComponents.map((component) => component.componentId),
    components,
    connections: circuitConnections,
    openHydraulics,
    modelica: {
      modelName: `ThermoHub.Generated.FluidPowerCircuit_${domain}`,
      source: modelicaModel,
    },
  };
};

const normalizeExternalSnapshot = (response, fallbackSnapshot) => {
  if (!response || typeof response !== 'object') {
    return {
      snapshot: fallbackSnapshot,
      solverMeta: {
        source: 'local',
        usedFallback: true,
        detail: 'Risposta solver esterno non valida.',
      },
    };
  }

  const snapshot = response.snapshot && typeof response.snapshot === 'object'
    ? {
      ...fallbackSnapshot,
      ...response.snapshot,
      connectionStates: {
        ...(fallbackSnapshot.connectionStates ?? {}),
        ...(response.snapshot.connectionStates ?? {}),
      },
      measurements: {
        ...(fallbackSnapshot.measurements ?? {}),
        ...(response.snapshot.measurements ?? {}),
      },
      readings: {
        ...(fallbackSnapshot.readings ?? {}),
        ...(response.snapshot.readings ?? {}),
      },
      warnings:
        Array.isArray(response.snapshot.warnings) && response.snapshot.warnings.length > 0
          ? response.snapshot.warnings
          : fallbackSnapshot.warnings,
    }
    : fallbackSnapshot;

  return {
    snapshot: {
      ...snapshot,
      summary: {
        ...(fallbackSnapshot.summary ?? {}),
        ...(snapshot.summary ?? {}),
      },
    },
    solverMeta: {
      source: response.solver?.source ?? 'external',
      usedFallback: false,
      detail: response.solver?.detail ?? 'Solver professionale esterno',
      warnings: Array.isArray(response.solver?.warnings) ? response.solver.warnings : [],
    },
  };
};

export const simulateWithProfessionalSolver = async (nodes, connections, domain) => {
  if (!PROFESSIONAL_SOLVER_ENDPOINT) {
    return null;
  }

  const payload = buildProfessionalSolverPayload(nodes, connections, domain);
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), PROFESSIONAL_SOLVER_TIMEOUT_MS);

  try {
    const response = await fetch(PROFESSIONAL_SOLVER_ENDPOINT, {
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

export const resolveFluidPowerSnapshot = async (nodes, connections, domain) => {
  const localSnapshot = buildSimulationFlow(nodes, connections, domain);

  if (!PROFESSIONAL_SOLVER_ENDPOINT) {
    return {
      snapshot: localSnapshot,
      solverMeta: {
        source: 'local',
        usedFallback: false,
        detail: 'Solver locale ThermoHub',
      },
    };
  }

  try {
    const response = await simulateWithProfessionalSolver(nodes, connections, domain);

    if (!response) {
      return {
        snapshot: localSnapshot,
        solverMeta: {
          source: 'local',
          usedFallback: true,
          detail: 'Endpoint professionale non configurato.',
        },
      };
    }

    return normalizeExternalSnapshot(response, localSnapshot);
  } catch (error) {
    return {
      snapshot: {
        ...localSnapshot,
        warnings: [
          ...(localSnapshot.warnings ?? []),
          `Fallback locale: solver professionale non disponibile (${error.message}).`,
        ],
      },
      solverMeta: {
        source: 'local',
        usedFallback: true,
        detail: error.message,
      },
    };
  }
};

export const getProfessionalSolverConfig = () => ({
  endpoint: PROFESSIONAL_SOLVER_ENDPOINT,
  enabled: Boolean(PROFESSIONAL_SOLVER_ENDPOINT),
});
