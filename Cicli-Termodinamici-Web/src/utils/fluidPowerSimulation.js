import { getComponentDefinition } from '../data/fluidPowerCatalog';

const toPortKey = (nodeId, portId) => `${nodeId}:${portId}`;

const fromPortKey = (portKey) => {
  const [nodeId, portId] = portKey.split(':');
  return { nodeId, portId };
};

const uniqueArray = (items) => [...new Set(items)];

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
    component.simBehavior.kind === 'auxiliary'
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

export const buildSimulationFlow = (nodes, connections, domain) => {
  const validation = validateCircuit(nodes, connections, domain);
  if (!validation.valid) {
    return {
      valid: false,
      isRunning: false,
      warnings: validation.warnings,
      activePorts: [],
      activeConnections: [],
      activeNodes: [],
      actuatorAction: null,
      summary: null,
    };
  }

  const nodeLookup = new Map(nodes.map((node) => [node.instanceId, node]));
  const sourceNode = nodeLookup.get(validation.details.sourceId);
  const valveNode = nodeLookup.get(validation.details.valveId);
  const actuatorNode = nodeLookup.get(validation.details.actuatorId);
  const sinkNode = nodeLookup.get(validation.details.sinkId);

  const sourceComponent = getComponentDefinition(sourceNode.componentId);
  const valveComponent = getComponentDefinition(valveNode.componentId);
  const actuatorComponent = getComponentDefinition(actuatorNode.componentId);
  const routeInfo = getValveRouteInfo(valveNode, valveComponent);

  if (!routeInfo?.activeWorkPort) {
    return {
      valid: false,
      isRunning: false,
      warnings: ['Metti il distributore in posizione di alimentazione prima di avviare lo schema.'],
      activePorts: [],
      activeConnections: [],
      activeNodes: [],
      actuatorAction: null,
      summary: null,
    };
  }

  const activeWorkPath =
    validation.details.workConnectivity.find(
      (item) => item.valvePort === routeInfo.activeWorkPort,
    )?.path ?? null;

  if (!activeWorkPath) {
    return {
      valid: false,
      isRunning: false,
      warnings: ["La posizione attuale del distributore non raggiunge l'utilizzatore selezionato."],
      activePorts: [],
      activeConnections: [],
      activeNodes: [],
      actuatorAction: null,
      summary: null,
    };
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

  if (actuatorComponent.simBehavior.actuatorType === 'double' && routeInfo.exhaustWorkPort) {
    const passiveLink = validation.details.workConnectivity.find(
      (item) => item.valvePort === routeInfo.exhaustWorkPort,
    );

    if (passiveLink) {
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

  return {
    valid: true,
    isRunning: true,
    warnings: [`Schema avviato: ${action} dell'utilizzatore.`],
    activePorts: uniqueArray(activePortKeys),
    activeConnections: uniqueArray(activeConnectionIds),
    activeNodes: uniqueArray(activeNodeIds),
    actuatorAction: action,
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
