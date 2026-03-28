import { getComponentDefinition } from '../data/fluidPowerCatalog';
import { createEmptyFluidPowerSnapshot } from './fluidPowerState';

const toPortKey = (nodeId, portId) => `${nodeId}:${portId}`;

const fromPortKey = (portKey) => {
  const [nodeId, portId] = portKey.split(':');
  return { nodeId, portId };
};

const uniqueArray = (items) => [...new Set(items)];

const normalizePortRef = (portRef) =>
  typeof portRef === 'string' ? fromPortKey(portRef) : portRef;

const addAdjacencyEdge = (adjacency, fromKey, toKey, meta) => {
  if (!adjacency.has(fromKey)) {
    adjacency.set(fromKey, []);
  }

  adjacency.get(fromKey).push({ target: toKey, meta });
};

const buildNodeLookup = (nodes, domain) => {
  const scopedNodes = nodes.filter((node) => {
    const component = getComponentDefinition(node.componentId);
    return component?.domain === domain;
  });

  return new Map(scopedNodes.map((node) => [node.instanceId, node]));
};

const getFluidPorts = (component) => component.ports.filter((port) => port.kind === 'fluid');

const getNodeFaults = (node) => [
  ...(Array.isArray(node.faults) ? node.faults : []),
  ...(Array.isArray(node.state?.faults) ? node.state.faults : []),
];

const getValveStateDefinition = (node, component) => {
  if (component?.simBehavior.kind !== 'valve') {
    return null;
  }

  return (
    component.simBehavior.states.find((state) => state.id === node.state?.currentState) ??
    component.simBehavior.states[0] ??
    null
  );
};

export const getValveRouteInfo = (node, component) => {
  if (component?.simBehavior.kind !== 'valve') {
    return null;
  }

  const state = getValveStateDefinition(node, component);
  const supplyPort = component.simBehavior.supplyPort;
  const workPorts = component.simBehavior.workPorts ?? [];
  const returnPorts = component.simBehavior.returnPorts ?? [];

  const supplyRoute = state?.routes.find((route) => route.includes(supplyPort)) ?? null;
  const exhaustRoute =
    state?.routes.find(
      (route) =>
        route.some((portId) => workPorts.includes(portId)) &&
        route.some((portId) => returnPorts.includes(portId)),
    ) ?? null;

  return {
    state,
    supplyPort,
    activeWorkPort: supplyRoute?.find((portId) => portId !== supplyPort) ?? null,
    exhaustWorkPort: exhaustRoute?.find((portId) => workPorts.includes(portId)) ?? null,
    activeReturnPort: exhaustRoute?.find((portId) => returnPorts.includes(portId)) ?? null,
  };
};

const getPassiveRoutes = (node, component) => {
  if (!component) {
    return [];
  }

  if (
    component.simBehavior.kind === 'conditioning' ||
    component.simBehavior.kind === 'auxiliary' ||
    component.simBehavior.kind === 'flowControl' ||
    component.simBehavior.kind === 'instrument'
  ) {
    return component.simBehavior.passThroughRoutes ?? [];
  }

  return [];
};

const buildAdjacency = (nodes, connections, domain, kind = 'fluid') => {
  const nodeLookup = buildNodeLookup(nodes, domain);
  const adjacency = new Map();

  for (const node of nodeLookup.values()) {
    const component = getComponentDefinition(node.componentId);
    const ports = kind === 'fluid' ? getFluidPorts(component) : [];

    ports.forEach((port) => {
      adjacency.set(toPortKey(node.instanceId, port.id), []);
    });

    const internalRoutes = getPassiveRoutes(node, component);
    internalRoutes.forEach(([fromPort, toPort]) => {
      const fromKey = toPortKey(node.instanceId, fromPort);
      const toKey = toPortKey(node.instanceId, toPort);
      addAdjacencyEdge(adjacency, fromKey, toKey, { type: 'internal', nodeId: node.instanceId });
      addAdjacencyEdge(adjacency, toKey, fromKey, { type: 'internal', nodeId: node.instanceId });
    });
  }

  connections
    .filter((connection) => connection.kind === kind && connection.domain === domain)
    .forEach((connection) => {
      const fromKey = toPortKey(connection.from.nodeId, connection.from.portId);
      const toKey = toPortKey(connection.to.nodeId, connection.to.portId);

      if (!adjacency.has(fromKey) || !adjacency.has(toKey)) {
        return;
      }

      addAdjacencyEdge(adjacency, fromKey, toKey, {
        type: 'connection',
        connectionId: connection.id,
      });
      addAdjacencyEdge(adjacency, toKey, fromKey, {
        type: 'connection',
        connectionId: connection.id,
      });
    });

  return { adjacency, nodeLookup };
};

const findPath = (adjacency, startRefs, endRefs) => {
  const startKeys = startRefs.map((ref) => toPortKey(ref.nodeId, ref.portId));
  const endKeys = new Set(endRefs.map((ref) => toPortKey(ref.nodeId, ref.portId)));
  const queue = [];
  const visited = new Set();
  const previous = new Map();

  startKeys.forEach((key) => {
    if (!adjacency.has(key)) {
      return;
    }

    visited.add(key);
    queue.push(key);
    previous.set(key, null);
  });

  while (queue.length > 0) {
    const currentKey = queue.shift();

    if (endKeys.has(currentKey)) {
      const ports = [];
      const connectionIds = [];
      const nodeIds = new Set();
      let cursor = currentKey;

      while (cursor) {
        const portRef = fromPortKey(cursor);
        ports.unshift(portRef);
        nodeIds.add(portRef.nodeId);

        const prevStep = previous.get(cursor);
        if (prevStep?.meta?.connectionId) {
          connectionIds.unshift(prevStep.meta.connectionId);
        }
        cursor = prevStep?.key ?? null;
      }

      return {
        ports,
        connectionIds: uniqueArray(connectionIds),
        nodeIds: [...nodeIds],
      };
    }

    const neighbors = adjacency.get(currentKey) ?? [];
    neighbors.forEach((neighbor) => {
      if (visited.has(neighbor.target)) {
        return;
      }

      visited.add(neighbor.target);
      previous.set(neighbor.target, { key: currentKey, meta: neighbor.meta });
      queue.push(neighbor.target);
    });
  }

  return null;
};

const getRef = (nodeId, portId) => ({ nodeId, portId });

const getPortRefs = (node, portIds) => portIds.map((portId) => getRef(node.instanceId, portId));

const getSinkPortIds = (component) =>
  component.simBehavior.sinkPorts ?? getFluidPorts(component).map((port) => port.id);

const buildConnectivityDetails = (adjacency, valveNode, valveComponent, actuatorNode, actuatorComponent) => {
  const details = [];

  for (const valvePort of valveComponent.simBehavior.workPorts ?? []) {
    for (const actuatorPort of actuatorComponent.simBehavior.workPorts ?? []) {
      const path = findPath(
        adjacency,
        [getRef(valveNode.instanceId, valvePort)],
        [getRef(actuatorNode.instanceId, actuatorPort)],
      );

      if (path) {
        details.push({
          valvePort,
          actuatorPort,
          path,
        });
      }
    }
  }

  return details;
};

const buildGenericWarnings = ({ sources, valves, actuators, sinks }) => {
  const warnings = [];

  if (sources.length === 0) {
    warnings.push('Inserisci almeno una pompa o un compressore.');
  }
  if (valves.length === 0) {
    warnings.push('Inserisci almeno una valvola distributrice.');
  }
  if (actuators.length === 0) {
    warnings.push('Inserisci almeno un utilizzatore da comandare.');
  }
  if (sinks.length === 0) {
    warnings.push('Inserisci un ritorno/scarico coerente con il dominio scelto.');
  }

  return warnings;
};

export const validateCircuit = (nodes, connections, domain) => {
  const nodeLookup = buildNodeLookup(nodes, domain);
  const scopedNodes = [...nodeLookup.values()];
  const componentByNodeId = new Map(
    scopedNodes.map((node) => [node.instanceId, getComponentDefinition(node.componentId)]),
  );
  const sources = scopedNodes.filter(
    (node) => componentByNodeId.get(node.instanceId)?.simBehavior.kind === 'source',
  );
  const valves = scopedNodes.filter(
    (node) => componentByNodeId.get(node.instanceId)?.simBehavior.kind === 'valve',
  );
  const actuators = scopedNodes.filter(
    (node) => componentByNodeId.get(node.instanceId)?.simBehavior.kind === 'actuator',
  );
  const sinks = scopedNodes.filter(
    (node) => componentByNodeId.get(node.instanceId)?.simBehavior.kind === 'sink',
  );

  const genericWarnings = buildGenericWarnings({ sources, valves, actuators, sinks });
  if (genericWarnings.length > 0) {
    return {
      valid: false,
      warnings: genericWarnings,
    };
  }

  const { adjacency } = buildAdjacency(nodes, connections, domain, 'fluid');

  for (const sourceNode of sources) {
    const sourceComponent = componentByNodeId.get(sourceNode.instanceId);
    const sourcePortId = sourceComponent.simBehavior.sourcePort;

    for (const valveNode of valves) {
      const valveComponent = componentByNodeId.get(valveNode.instanceId);
      const supplyPath = findPath(
        adjacency,
        [getRef(sourceNode.instanceId, sourcePortId)],
        getPortRefs(valveNode, [valveComponent.simBehavior.supplyPort]),
      );

      if (!supplyPath) {
        continue;
      }

      for (const actuatorNode of actuators) {
        const actuatorComponent = componentByNodeId.get(actuatorNode.instanceId);
        const workConnectivity = buildConnectivityDetails(
          adjacency,
          valveNode,
          valveComponent,
          actuatorNode,
          actuatorComponent,
        );

        const actuatorReady =
          actuatorComponent.simBehavior.actuatorType === 'single'
            ? workConnectivity.length >= 1
            : uniqueArray(workConnectivity.map((item) => item.actuatorPort)).length >= 2;

        if (!actuatorReady) {
          continue;
        }

        for (const sinkNode of sinks) {
          const sinkComponent = componentByNodeId.get(sinkNode.instanceId);
          const returnPath = findPath(
            adjacency,
            getPortRefs(valveNode, valveComponent.simBehavior.returnPorts ?? []),
            getPortRefs(sinkNode, getSinkPortIds(sinkComponent)),
          );

          if (!returnPath) {
            continue;
          }

          return {
            valid: true,
            warnings: [],
            details: {
              sourceId: sourceNode.instanceId,
              valveId: valveNode.instanceId,
              actuatorId: actuatorNode.instanceId,
              sinkId: sinkNode.instanceId,
              paths: {
                supplyPath,
                returnPath,
              },
              workConnectivity,
            },
          };
        }
      }
    }
  }

  return {
    valid: false,
    warnings: [
      'Lo schema non e coerente: verifica alimentazione, distributore, utilizzatore e ritorno/scarico.',
    ],
  };
};

const buildSuctionPath = (adjacency, sourceNode, sourceComponent, sinkNode, sinkComponent) => {
  const suctionPort = sourceComponent?.simBehavior?.suctionPort;
  if (!suctionPort) {
    return null;
  }

  return findPath(
    adjacency,
    getPortRefs(sinkNode, getSinkPortIds(sinkComponent)),
    [getRef(sourceNode.instanceId, suctionPort)],
  );
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const resolveSignalForPath = (pathPorts, nodeLookup, phase = 'pressure', domain = 'hydraulic') => {
  const defaults = getDomainSignalDefaults(domain);
  const restrictions = collectRestrictionsOnPath(pathPorts, nodeLookup);
  let pressure =
    phase === 'pressure'
      ? defaults.nominalPressureBar
      : phase === 'suction'
        ? defaults.suctionPressureBar
        : defaults.returnPressureBar;
  let flowRate = defaults.nominalFlowRateLpm;
  let velocityFactor = phase === 'pressure' ? 1 : phase === 'mechanical' ? 1.8 : 0.78;

  for (const restriction of restrictions) {
    if (
      restriction.type === 'flowControl' ||
      restriction.type === 'clogged' ||
      restriction.type === 'wornPump'
    ) {
      flowRate *= restriction.flowMultiplier;
      pressure *= 0.55 + 0.45 * restriction.flowMultiplier;
      velocityFactor *= restriction.flowMultiplier;
    }

    if (restriction.type === 'reliefValve' || restriction.type === 'lowPrv') {
      const crackingPressure = restriction.crackingPressure ?? 80;
      if (pressure > crackingPressure) {
        pressure = crackingPressure;
        flowRate *= 0.3;
        velocityFactor *= 0.55;
      }
    }
  }

  return {
    pressure: Math.round(pressure * 10) / 10,
    flowRate: Math.round(flowRate * 10) / 10,
    velocityFactor: Math.round(clamp(velocityFactor, 0.12, 2.4) * 100) / 100,
  };
};

const buildConnectionStateEntries = (
  path,
  phase,
  nodeLookup,
  flowDirection = 'forward',
  domain = 'hydraulic',
) => {
  if (!path) {
    return {};
  }

  const signal = resolveSignalForPath(path.ports ?? [], nodeLookup, phase, domain);
  const fluidPowerKw =
    phase === 'mechanical' || signal.flowRate == null || signal.pressure == null
      ? null
      : Math.round(((signal.pressure * signal.flowRate) / 600) * 100) / 100;

  return Object.fromEntries(
    uniqueArray(path.connectionIds ?? []).map((connectionId) => [
      connectionId,
      {
        active: true,
        phase,
        flowDirection,
        flowRate: phase === 'mechanical' ? null : signal.flowRate,
        pressureIn: phase === 'mechanical' ? null : signal.pressure,
        pressureOut:
          phase === 'mechanical'
            ? null
            : Math.round(
                Math.max(signal.pressure - (phase === 'pressure' ? 8 : 3), 0) * 10,
              ) / 10,
        fluidPowerKw,
        velocityFactor: signal.velocityFactor,
      },
    ]),
  );
};

const mergeConnectionStateEntries = (...collections) => {
  const merged = {};

  for (const collection of collections) {
    for (const [connectionId, state] of Object.entries(collection ?? {})) {
      merged[connectionId] = {
        ...(merged[connectionId] ?? {}),
        ...state,
      };
    }
  }

  return merged;
};

const materializeConnectionStates = (connections, activeStates) =>
  Object.fromEntries(
    connections.map((connection) => [
      connection.id,
      {
        active: false,
        phase: connection.kind === 'mechanical' ? 'mechanical' : 'pressure',
        flowDirection: null,
        flowRate: null,
        pressureIn: null,
        pressureOut: null,
        fluidPowerKw: null,
        velocityFactor: 1,
        ...(activeStates[connection.id] ?? {}),
      },
    ]),
  );

const buildMechanicalStates = (connections, nodeLookup, sourceNode) => {
  const connectionStates = {};
  const activeNodeIds = [];

  for (const connection of connections) {
    if (connection.kind !== 'mechanical') {
      continue;
    }

    const fromNode = nodeLookup.get(connection.from.nodeId);
    const toNode = nodeLookup.get(connection.to.nodeId);
    const fromComponent = fromNode ? getComponentDefinition(fromNode.componentId) : null;
    const toComponent = toNode ? getComponentDefinition(toNode.componentId) : null;
    const sourceOnFromSide = fromNode?.instanceId === sourceNode.instanceId;
    const sourceOnToSide = toNode?.instanceId === sourceNode.instanceId;
    const driverOnFromSide = fromComponent?.simBehavior?.kind === 'driver';
    const driverOnToSide = toComponent?.simBehavior?.kind === 'driver';

    if (
      (sourceOnFromSide && driverOnToSide) ||
      (sourceOnToSide && driverOnFromSide)
    ) {
      connectionStates[connection.id] = {
        active: true,
        phase: 'mechanical',
        flowDirection: null,
        flowRate: null,
        pressureIn: null,
        pressureOut: null,
        velocityFactor: 1.8,
      };
      activeNodeIds.push(connection.from.nodeId, connection.to.nodeId);
    }
  }

  return {
    connectionStates,
    activeNodeIds: uniqueArray(activeNodeIds),
  };
};

const buildStoppedSnapshot = (warnings, verdict = 'incomplete') => ({
  ...createEmptyFluidPowerSnapshot(),
  warnings,
  verdict,
});

const buildExhaustPathFromActuator = (adjacency, actuatorNode, actuatorComponent, valveNode, valveComponent, routeInfo, sinkNode, sinkComponent) => {
  if (!routeInfo.exhaustWorkPort || !routeInfo.activeReturnPort) {
    return null;
  }

  const actuatorWorkPorts = actuatorComponent.simBehavior.workPorts ?? [];
  const fromRefs = actuatorWorkPorts.map((portId) => getRef(actuatorNode.instanceId, portId));
  const toRefs = [getRef(valveNode.instanceId, routeInfo.exhaustWorkPort)];

  const actuatorToValve = findPath(adjacency, fromRefs, toRefs);
  if (!actuatorToValve) {
    return null;
  }

  const valveReturnRefs = [getRef(valveNode.instanceId, routeInfo.activeReturnPort)];
  const sinkPortIds = getSinkPortIds(sinkComponent);
  const sinkRefs = getPortRefs(sinkNode, sinkPortIds);

  const returnToSink = findPath(adjacency, valveReturnRefs, sinkRefs);
  if (!returnToSink) {
    return null;
  }

  return {
    ports: [...actuatorToValve.ports, ...returnToSink.ports],
    connectionIds: uniqueArray([...actuatorToValve.connectionIds, ...returnToSink.connectionIds]),
    nodeIds: uniqueArray([...actuatorToValve.nodeIds, ...returnToSink.nodeIds]),
  };
};

export const buildSimulationFlow = (nodes, connections, domain) => {
  const validation = validateCircuit(nodes, connections, domain);
  if (!validation.valid) {
    return buildStoppedSnapshot(validation.warnings);
  }

  const nodeLookup = new Map(nodes.map((node) => [node.instanceId, node]));
  const sourceNode = nodeLookup.get(validation.details.sourceId);
  const valveNode = nodeLookup.get(validation.details.valveId);
  const actuatorNode = nodeLookup.get(validation.details.actuatorId);
  const sinkNode = nodeLookup.get(validation.details.sinkId);

  const sourceComponent = getComponentDefinition(sourceNode.componentId);
  const valveComponent = getComponentDefinition(valveNode.componentId);
  const actuatorComponent = getComponentDefinition(actuatorNode.componentId);
  const sinkComponent = getComponentDefinition(sinkNode.componentId);
  const routeInfo = getValveRouteInfo(valveNode, valveComponent);
  const { adjacency } = buildAdjacency(nodes, connections, domain, 'fluid');
  const suctionPath = buildSuctionPath(
    adjacency,
    sourceNode,
    sourceComponent,
    sinkNode,
    sinkComponent,
  );
  const mechanicalState = buildMechanicalStates(connections, nodeLookup, sourceNode);

  if (!routeInfo?.activeWorkPort) {
    if (routeInfo?.exhaustWorkPort && actuatorComponent.simBehavior.actuatorType === 'single') {
      const exhaustPath = buildExhaustPathFromActuator(
        adjacency,
        actuatorNode,
        actuatorComponent,
        valveNode,
        valveComponent,
        routeInfo,
        sinkNode,
        sinkComponent,
      );

      if (exhaustPath) {
        const action = 'ritorno a molla';
        const allActivePorts = uniqueArray(
          exhaustPath.ports.map((port) => toPortKey(port.nodeId, port.portId)),
        );
        const activeConnectionIds = uniqueArray([
          ...exhaustPath.connectionIds,
          ...(suctionPath?.connectionIds ?? []),
          ...Object.keys(mechanicalState.connectionStates),
        ]);
        const measurements = computeReadings(
          allActivePorts,
          activeConnectionIds,
          nodes,
          nodeLookup,
          domain,
        );

        return {
          ...createEmptyFluidPowerSnapshot(),
          valid: true,
          verdict: 'valid',
          isRunning: true,
          warnings: [`Schema avviato: ${action} dell'utilizzatore (scarico attraverso il distributore).`],
          activePorts: allActivePorts,
          activeConnections: activeConnectionIds,
          activeNodes: uniqueArray([
            ...exhaustPath.nodeIds,
            ...(suctionPath?.nodeIds ?? []),
            sourceNode.instanceId,
            valveNode.instanceId,
            actuatorNode.instanceId,
            sinkNode.instanceId,
            ...mechanicalState.activeNodeIds,
          ]),
          actuatorAction: action,
          connectionStates: materializeConnectionStates(
            connections,
            mergeConnectionStateEntries(
              buildConnectionStateEntries(exhaustPath, 'return', nodeLookup, 'reverse', domain),
              buildConnectionStateEntries(suctionPath, 'suction', nodeLookup, 'forward', domain),
              mechanicalState.connectionStates,
            ),
          ),
          measurements,
          readings: measurements,
          actuatorTiming: computeActuatorTiming(
            actuatorNode,
            actuatorComponent,
            allActivePorts,
            nodeLookup,
          ),
          summary: {
            sourceLabel: sourceComponent.label,
            valveLabel: valveComponent.label,
            actuatorLabel: actuatorComponent.label,
          },
        };
      }

      return buildStoppedSnapshot([
        'Il distributore e in riposo: la pompa e bloccata. La valvola limitatrice (PRV) devia la portata al serbatoio. Collega il percorso di scarico A->R al serbatoio per osservare il ritorno dell\'utilizzatore.',
      ], 'faulted');
    }

    return buildStoppedSnapshot([
      'Metti il distributore in posizione di alimentazione prima di avviare lo schema.',
    ]);
  }

  const activeWorkPath =
    validation.details.workConnectivity.find(
      (item) => item.valvePort === routeInfo.activeWorkPort,
    )?.path ?? null;

  if (!activeWorkPath) {
    return buildStoppedSnapshot([
      "La posizione attuale del distributore non raggiunge l'utilizzatore selezionato.",
    ]);
  }

  const activePortKeys = [
    ...validation.details.paths.supplyPath.ports.map((port) => toPortKey(port.nodeId, port.portId)),
    ...activeWorkPath.ports.map((port) => toPortKey(port.nodeId, port.portId)),
    ...validation.details.paths.returnPath.ports.map((port) => toPortKey(port.nodeId, port.portId)),
  ];
  const activeConnectionIds = [
    ...validation.details.paths.supplyPath.connectionIds,
    ...activeWorkPath.connectionIds,
    ...validation.details.paths.returnPath.connectionIds,
  ];
  const activeNodeIds = [
    ...validation.details.paths.supplyPath.nodeIds,
    ...activeWorkPath.nodeIds,
    ...validation.details.paths.returnPath.nodeIds,
    sourceNode.instanceId,
    valveNode.instanceId,
    actuatorNode.instanceId,
    sinkNode.instanceId,
  ];
  let passiveExhaustPath = null;

  if (actuatorComponent.simBehavior.actuatorType === 'double' && routeInfo.exhaustWorkPort) {
    const passiveLink = validation.details.workConnectivity.find(
      (item) => item.valvePort === routeInfo.exhaustWorkPort,
    );

    if (passiveLink) {
      passiveExhaustPath = passiveLink.path;
      activePortKeys.push(
        ...passiveLink.path.ports.map((port) => toPortKey(port.nodeId, port.portId)),
      );
      activeConnectionIds.push(...passiveLink.path.connectionIds);
      activeNodeIds.push(...passiveLink.path.nodeIds);
    }
  }

  const action =
    actuatorComponent.simBehavior.actuatorType === 'single'
      ? 'estensione'
      : actuatorComponent.simBehavior.actuatorType === 'rotary'
        ? routeInfo.activeWorkPort === 'A'
          ? 'rotazione oraria'
          : 'rotazione antioraria'
        : routeInfo.activeWorkPort === 'A'
          ? 'estensione'
          : 'ritrazione';

  const allActivePorts = uniqueArray(activePortKeys);
  const pathConnectionStates = mergeConnectionStateEntries(
    buildConnectionStateEntries(validation.details.paths.supplyPath, 'pressure', nodeLookup, 'forward', domain),
    buildConnectionStateEntries(activeWorkPath, 'pressure', nodeLookup, 'forward', domain),
    buildConnectionStateEntries(validation.details.paths.returnPath, 'return', nodeLookup, 'forward', domain),
    buildConnectionStateEntries(passiveExhaustPath, 'return', nodeLookup, 'reverse', domain),
    buildConnectionStateEntries(suctionPath, 'suction', nodeLookup, 'forward', domain),
    mechanicalState.connectionStates,
  );

  const allActiveConnections = uniqueArray([
    ...activeConnectionIds,
    ...(suctionPath?.connectionIds ?? []),
    ...Object.keys(mechanicalState.connectionStates),
  ]);
  const allActiveNodes = uniqueArray([
    ...activeNodeIds,
    ...(suctionPath?.nodeIds ?? []),
    ...mechanicalState.activeNodeIds,
  ]);

  const measurements = computeReadings(
    allActivePorts,
    allActiveConnections,
    nodes,
    nodeLookup,
    domain,
  );

  const actuatorTiming = computeActuatorTiming(
    actuatorNode,
    actuatorComponent,
    allActivePorts,
    nodeLookup,
  );

  return {
    ...createEmptyFluidPowerSnapshot(),
    valid: true,
    verdict: 'valid',
    isRunning: true,
    warnings: [`Schema avviato: ${action} dell'utilizzatore.`],
    activePorts: allActivePorts,
    activeConnections: allActiveConnections,
    activeNodes: allActiveNodes,
    actuatorAction: action,
    connectionStates: materializeConnectionStates(connections, pathConnectionStates),
    measurements,
    readings: measurements,
    actuatorTiming,
    summary: {
      sourceLabel: sourceComponent.label,
      valveLabel: valveComponent.label,
      actuatorLabel: actuatorComponent.label,
    },
  };
};

export const applyValveState = (nodes, nodeId, nextState) =>
  nodes.map((node) => {
    if (node.instanceId !== nodeId) {
      return node;
    }

    const component = getComponentDefinition(node.componentId);
    if (component?.simBehavior.kind !== 'valve') {
      return node;
    }

    const states = component.simBehavior.states ?? [];
    const currentIndex = states.findIndex((state) => state.id === node.state?.currentState);
    const fallbackIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextStateId =
      nextState ??
      states[(fallbackIndex + 1) % Math.max(states.length, 1)]?.id ??
      node.state?.currentState;

    return {
      ...node,
      state: {
        ...node.state,
        currentState: nextStateId,
      },
    };
  });

const DOMAIN_SIGNAL_DEFAULTS = {
  hydraulic: {
    nominalPressureBar: 140,
    nominalFlowRateLpm: 22,
    returnPressureBar: 4.5,
    suctionPressureBar: 0.9,
  },
  pneumatic: {
    nominalPressureBar: 6.5,
    nominalFlowRateLpm: 280,
    returnPressureBar: 1.15,
    suctionPressureBar: 1.0,
  },
};

export const getDomainSignalDefaults = (domain = 'hydraulic') =>
  DOMAIN_SIGNAL_DEFAULTS[domain] ?? DOMAIN_SIGNAL_DEFAULTS.hydraulic;

const collectRestrictionsOnPath = (pathPorts, nodeLookup) => {
  const restrictions = [];

  for (const portRef of pathPorts) {
    const normalizedRef = normalizePortRef(portRef);
    const node = nodeLookup.get(normalizedRef.nodeId);
    if (!node) {
      continue;
    }

    const component = getComponentDefinition(node.componentId);
    if (!component) {
      continue;
    }

    if (component.simBehavior.kind === 'flowControl') {
      const multiplier = node.state?.flowMultiplier ?? component.simBehavior.flowMultiplier ?? 1.0;
      restrictions.push({
        nodeId: node.instanceId,
        type: 'flowControl',
        flowMultiplier: Math.max(0.05, Math.min(1.0, multiplier)),
      });
    }

    if (component.simBehavior.kind === 'auxiliary' && component.symbolVariant?.style === 'pressure-relief') {
      const crackingPressure = node.state?.crackingPressure ?? 80;
      restrictions.push({
        nodeId: node.instanceId,
        type: 'reliefValve',
        crackingPressure,
      });
    }

    for (const fault of getNodeFaults(node)) {
      if (fault.type === 'clogged-filter') {
        restrictions.push({ nodeId: node.instanceId, type: 'clogged', flowMultiplier: 0.2 });
      }
      if (fault.type === 'worn-pump') {
        restrictions.push({ nodeId: node.instanceId, type: 'wornPump', flowMultiplier: 0.4 });
      }
      if (fault.type === 'low-prv') {
        restrictions.push({ nodeId: node.instanceId, type: 'lowPrv', crackingPressure: 20 });
      }
    }
  }

  return restrictions;
};

export const computeReadings = (
  activePorts,
  activeConnections,
  nodes,
  nodeLookup,
  domain = 'hydraulic',
) => {
  const readings = {};
  const defaults = getDomainSignalDefaults(domain);

  for (const node of nodeLookup.values()) {
    const component = getComponentDefinition(node.componentId);
    if (!component) {
      continue;
    }

    const isInstrument =
      component.symbol === 'instrument' ||
      component.simBehavior.kind === 'instrument';

    if (!isInstrument) {
      continue;
    }

    const nodeIsActive = activePorts.some((pk) => pk.startsWith(`${node.instanceId}:`));
    if (!nodeIsActive) {
      readings[node.instanceId] = { pressure: 0, flowRate: 0, active: false };
      continue;
    }

    const style = component.symbolVariant?.style;
    let pressure = defaults.nominalPressureBar * 0.85;
    let flowRate = defaults.nominalFlowRateLpm * 0.9;

    for (const portRef of activePorts) {
      if (!portRef.startsWith(`${node.instanceId}:`)) {
        continue;
      }
    }

    const restrictions = collectRestrictionsOnPath(activePorts, nodeLookup);
    for (const r of restrictions) {
      if (r.type === 'flowControl' || r.type === 'clogged' || r.type === 'wornPump') {
        flowRate *= r.flowMultiplier;
        pressure *= (0.6 + 0.4 * r.flowMultiplier);
      }
      if (r.type === 'reliefValve' || r.type === 'lowPrv') {
        const cracking = r.crackingPressure ?? 80;
        if (pressure > cracking) {
          pressure = cracking;
          flowRate *= 0.3;
        }
      }
    }

    readings[node.instanceId] = {
      pressure: style === 'manometer' || style === 'pressure-switch'
        ? Math.round(pressure * 10) / 10
        : null,
      flowRate: style === 'flowmeter' || style === 'counter'
        ? Math.round(flowRate * 10) / 10
        : null,
      active: true,
      unit: style === 'manometer' || style === 'pressure-switch' ? 'bar' : 'L/min',
    };
  }

  return readings;
};

export const computeActuatorTiming = (actuatorNode, actuatorComponent, activePorts, nodeLookup) => {
  if (!actuatorNode || actuatorComponent?.simBehavior?.kind !== 'actuator') {
    return null;
  }

  const isActive = activePorts.some((pk) => pk.startsWith(`${actuatorNode.instanceId}:`));
  if (!isActive) {
    return null;
  }

  let flowMultiplier = 1.0;
  for (const portKey of activePorts) {
    const [nodeId] = portKey.split(':');
    const node = nodeLookup.get(nodeId);
    if (!node) {
      continue;
    }
    const comp = getComponentDefinition(node.componentId);
    if (comp?.simBehavior?.kind === 'flowControl') {
      const m = node.state?.flowMultiplier ?? comp.simBehavior.flowMultiplier ?? 1.0;
      flowMultiplier = Math.min(flowMultiplier, m);
    }
  }

  const baseStrokeTime = actuatorComponent.simBehavior.actuatorType === 'rotary' ? 3.0 : 2.0;
  const actualStrokeTime = baseStrokeTime / Math.max(0.05, flowMultiplier);

  return {
    baseStrokeTime,
    flowMultiplier: Math.round(flowMultiplier * 100) / 100,
    actualStrokeTime: Math.round(actualStrokeTime * 10) / 10,
    unit: 's',
  };
};
