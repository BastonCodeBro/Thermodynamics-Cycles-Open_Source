import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ChevronDown, Move, Play, RotateCcw, Trash2, Waves } from 'lucide-react';
import {
  createInitialNodeState,
  FLUID_POWER_CATEGORIES,
  FLUID_POWER_DOMAINS,
  getComponentDefinition,
  getComponentsByDomain,
} from '../data/fluidPowerCatalog';
import FluidPowerSymbol from './fluidPower/FluidPowerSymbol';
import {
  applyValveState,
  buildSimulationFlow,
  getValveRouteInfo,
  validateCircuit,
} from '../utils/fluidPowerSimulation';

const GRID_SIZE = 24;
const CANVAS_WIDTH = 1160;
const CANVAS_HEIGHT = 760;
const CANVAS_PADDING = 24;
const PORT_LEAD = 38;
const DEFAULT_EXPANDED_GROUPS = [
  'alimentazione',
  'valvole-distributrici',
  'utilizzatori',
  'ausiliari',
];

const CATEGORY_COPY = {
  alimentazione: 'Sorgenti, ritorni e unita di servizio per alimentare correttamente il circuito.',
  'valvole-distributrici': 'Organi di comando per indirizzare il flusso e cambiare il moto dell attuatore.',
  utilizzatori: 'Cilindri e motori che trasformano l energia del fluido in lavoro utile.',
  ausiliari: 'Elementi di regolazione, protezione e logica per completare lo schema.',
  'strumentazione-e-comandi': 'Indicatori e comandi simbolici utili a leggere la funzione del circuito.',
  'simbologia-base': 'Segni grafici di supporto per ripassare la simbologia ISO del fluid power.',
};

const createExpandedGroupState = () =>
  Object.fromEntries(
    FLUID_POWER_DOMAINS.map(({ id: domainId }) => [
      domainId,
      Object.fromEntries(
        FLUID_POWER_CATEGORIES.map(({ id: categoryId }) => [
          categoryId,
          DEFAULT_EXPANDED_GROUPS.includes(categoryId),
        ]),
      ),
    ]),
  );

const createWorkspace = () => ({
  nodes: [],
  connections: [],
  pendingPort: null,
  selectedEntity: null,
  snapshot: {
    isRunning: false,
    activePorts: [],
    activeConnections: [],
    activeNodes: [],
    warnings: [],
    actuatorAction: null,
    summary: null,
  },
  message: 'Trascina i componenti nel canvas e collega le porte per costruire il circuito.',
});

const snap = (value) => Math.max(16, Math.round(value / GRID_SIZE) * GRID_SIZE);

const toEntityLabel = (node, component) => node.label ?? `${component.label}`;

const getDomainMeta = (domain) =>
  FLUID_POWER_DOMAINS.find((item) => item.id === domain) ?? FLUID_POWER_DOMAINS[0];

const createNodeId = () =>
  `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createConnectionId = () =>
  `connection-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const isHorizontalSide = (side) => side === 'left' || side === 'right';

const getPortLeadPoint = (point, side, distance = PORT_LEAD) => {
  if (side === 'left') {
    return { x: point.x - distance, y: point.y };
  }
  if (side === 'right') {
    return { x: point.x + distance, y: point.y };
  }
  if (side === 'top') {
    return { x: point.x, y: point.y - distance };
  }

  return { x: point.x, y: point.y + distance };
};

const dedupePoints = (points) =>
  points.filter(
    (point, index, array) =>
      index === 0 || point.x !== array[index - 1].x || point.y !== array[index - 1].y,
  );

const distanceBetween = (first, second) => Math.hypot(second.x - first.x, second.y - first.y);

const moveTowards = (from, to, distance) => {
  const totalDistance = distanceBetween(from, to);

  if (totalDistance === 0) {
    return { ...from };
  }

  return {
    x: from.x + ((to.x - from.x) * distance) / totalDistance,
    y: from.y + ((to.y - from.y) * distance) / totalDistance,
  };
};

const getPortPosition = (node, component, port) => {
  const width = component.defaultSize.width;
  const height = component.defaultSize.height;

  if (port.side === 'left') {
    return { x: node.x, y: node.y + height * port.align };
  }
  if (port.side === 'right') {
    return { x: node.x + width, y: node.y + height * port.align };
  }
  if (port.side === 'top') {
    return { x: node.x + width * port.align, y: node.y };
  }

  return { x: node.x + width * port.align, y: node.y + height };
};

const computeConnectionPath = (start, end, startPort, endPort) => {
  const startLead = getPortLeadPoint(start, startPort.side);
  const endLead = getPortLeadPoint(end, endPort.side);
  const points = [start, startLead];
  const middleX = startLead.x + (endLead.x - startLead.x) / 2;
  const middleY = startLead.y + (endLead.y - startLead.y) / 2;

  if (isHorizontalSide(startPort.side) && isHorizontalSide(endPort.side)) {
    if (startPort.side === endPort.side) {
      const detourX =
        startPort.side === 'right'
          ? Math.max(startLead.x, endLead.x) + PORT_LEAD
          : Math.min(startLead.x, endLead.x) - PORT_LEAD;

      points.push({ x: detourX, y: startLead.y }, { x: detourX, y: endLead.y });
    } else {
      points.push({ x: middleX, y: startLead.y }, { x: middleX, y: endLead.y });
    }
  } else if (!isHorizontalSide(startPort.side) && !isHorizontalSide(endPort.side)) {
    if (startPort.side === endPort.side) {
      const detourY =
        startPort.side === 'bottom'
          ? Math.max(startLead.y, endLead.y) + PORT_LEAD
          : Math.min(startLead.y, endLead.y) - PORT_LEAD;

      points.push({ x: startLead.x, y: detourY }, { x: endLead.x, y: detourY });
    } else {
      points.push({ x: startLead.x, y: middleY }, { x: endLead.x, y: middleY });
    }
  } else {
    points.push(
      isHorizontalSide(startPort.side)
        ? { x: middleX, y: startLead.y }
        : { x: startLead.x, y: middleY },
      isHorizontalSide(startPort.side)
        ? { x: middleX, y: endLead.y }
        : { x: endLead.x, y: middleY },
    );
  }

  points.push(endLead, end);
  return dedupePoints(points);
};

const pointsToPath = (points) => {
  if (points.length === 0) {
    return '';
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 1; index < points.length; index += 1) {
    const previousPoint = points[index - 1];
    const currentPoint = points[index];
    const nextPoint = points[index + 1];

    if (!nextPoint) {
      path += ` L ${currentPoint.x} ${currentPoint.y}`;
      continue;
    }

    const radius = Math.min(
      16,
      distanceBetween(previousPoint, currentPoint) / 2,
      distanceBetween(currentPoint, nextPoint) / 2,
    );

    if (radius < 1) {
      path += ` L ${currentPoint.x} ${currentPoint.y}`;
      continue;
    }

    const cornerStart = moveTowards(currentPoint, previousPoint, radius);
    const cornerEnd = moveTowards(currentPoint, nextPoint, radius);

    path += ` L ${cornerStart.x} ${cornerStart.y}`;
    path += ` Q ${currentPoint.x} ${currentPoint.y} ${cornerEnd.x} ${cornerEnd.y}`;
  }

  return path;
};

const describeActuatorState = (node, component) => {
  const routeInfo = getValveRouteInfo(node, component);
  return routeInfo?.state?.label ?? 'Stato';
};

const isPortCompatible = (firstPort, secondPort, domain) => {
  if (!firstPort || !secondPort) {
    return false;
  }

  if (firstPort.kind !== secondPort.kind) {
    return false;
  }

  if (firstPort.kind === 'fluid' && (firstPort.domain !== domain || secondPort.domain !== domain)) {
    return false;
  }

  return true;
};

const hasConnection = (connections, firstRef, secondRef) =>
  connections.some(
    (connection) =>
      (connection.from.nodeId === firstRef.nodeId &&
        connection.from.portId === firstRef.portId &&
        connection.to.nodeId === secondRef.nodeId &&
        connection.to.portId === secondRef.portId) ||
      (connection.from.nodeId === secondRef.nodeId &&
        connection.from.portId === secondRef.portId &&
        connection.to.nodeId === firstRef.nodeId &&
        connection.to.portId === firstRef.portId),
  );

const isPortOccupied = (connections, ref) =>
  connections.some(
    (connection) =>
      (connection.from.nodeId === ref.nodeId && connection.from.portId === ref.portId) ||
      (connection.to.nodeId === ref.nodeId && connection.to.portId === ref.portId),
  );

const paletteGroups = (domain, search) => {
  const normalizedSearch = search.trim().toLowerCase();
  const items = getComponentsByDomain(domain).filter((component) =>
    normalizedSearch.length === 0
      ? true
      : `${component.label} ${component.description}`.toLowerCase().includes(normalizedSearch),
  );

  return FLUID_POWER_CATEGORIES.map((category) => ({
    ...category,
    items: items.filter((component) => component.category === category.id),
  })).filter((group) => group.items.length > 0);
};

const theoryCards = [
  {
    title: 'Oleodinamica',
    body: 'Lavora ad alte pressioni, offre grande forza sugli attuatori ed e ideale per presse, timonerie, gru e macchine operatrici.',
  },
  {
    title: 'Pneumatica',
    body: 'Usa aria compressa, risponde rapidamente ed e adatta ad automazioni, pick-and-place, serraggi e attuazioni leggere.',
  },
  {
    title: 'Metodo di studio',
    body: 'Individua sempre sorgente, regolazione, attuatore e ritorno: e la chiave per leggere sia lo schema simbolico sia il circuito reale.',
  },
];

const guidedCircuits = [
  'Cilindro semplice effetto con valvola 3/2 e serbatoio o scarico.',
  'Cilindro doppio effetto con distributore 5/2 e inversione di moto.',
  'Pompa + valvola limitatrice + distributore + attuatore come catena minima oleodinamica.',
  'Compressore + gruppo FRL + distributore + cilindro come catena minima pneumatica.',
];

const FluidPowerLabPage = () => {
  const [domain, setDomain] = useState('hydraulic');
  const [search, setSearch] = useState('');
  const [workspaces, setWorkspaces] = useState({
    hydraulic: createWorkspace(),
    pneumatic: createWorkspace(),
  });
  const [expandedGroups, setExpandedGroups] = useState(createExpandedGroupState);
  const [draggingNode, setDraggingNode] = useState(null);
  const canvasRef = useRef(null);

  const workspace = workspaces[domain];
  const domainMeta = getDomainMeta(domain);
  const groups = useMemo(() => paletteGroups(domain, search), [domain, search]);
  const hasSearch = search.trim().length > 0;

  const updateWorkspace = useCallback((updater) => {
    setWorkspaces((current) => ({
      ...current,
      [domain]: updater(current[domain]),
    }));
  }, [domain]);

  const refreshPaths = (nodes, connections) =>
    connections.map((connection) => {
      const fromNode = nodes.find((node) => node.instanceId === connection.from.nodeId);
      const toNode = nodes.find((node) => node.instanceId === connection.to.nodeId);
      const fromComponent = fromNode ? getComponentDefinition(fromNode.componentId) : null;
      const toComponent = toNode ? getComponentDefinition(toNode.componentId) : null;
      const fromPort = fromComponent?.ports.find((port) => port.id === connection.from.portId);
      const toPort = toComponent?.ports.find((port) => port.id === connection.to.portId);

      if (!fromNode || !toNode || !fromComponent || !toComponent || !fromPort || !toPort) {
        return connection;
      }

      const points = computeConnectionPath(
        getPortPosition(fromNode, fromComponent, fromPort),
        getPortPosition(toNode, toComponent, toPort),
        fromPort,
        toPort,
      );

      return {
        ...connection,
        pathPoints: points,
      };
    });

  const addNode = (componentId, dropPosition) => {
    const component = getComponentDefinition(componentId);
    if (!component) {
      return;
    }

    updateWorkspace((current) => {
      const existingCount = current.nodes.filter((node) => node.componentId === componentId).length;
      const node = {
        instanceId: createNodeId(),
        componentId,
        domain: component.domain,
        x: snap(dropPosition?.x ?? 48 + (existingCount % 3) * 192),
        y: snap(dropPosition?.y ?? 56 + Math.floor(existingCount / 3) * 144),
        rotation: 0,
        label: `${component.label} ${existingCount + 1}`,
        state: createInitialNodeState(component),
      };

      return {
        ...current,
        nodes: [...current.nodes, node],
        message: `${component.label} aggiunto nel canvas.`,
        selectedEntity: { type: 'node', id: node.instanceId },
      };
    });
  };

  useEffect(() => {
    if (!draggingNode) {
      return undefined;
    }

    const handlePointerMove = (event) => {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) {
        return;
      }

      updateWorkspace((current) => {
        const nodes = current.nodes.map((node) => {
          if (node.instanceId !== draggingNode.nodeId) {
            return node;
          }

          const component = getComponentDefinition(node.componentId);
          const maxX = CANVAS_WIDTH - component.defaultSize.width - CANVAS_PADDING;
          const maxY = CANVAS_HEIGHT - component.defaultSize.height - CANVAS_PADDING;
          const x = snap(event.clientX - canvasRect.left - draggingNode.offsetX);
          const y = snap(event.clientY - canvasRect.top - draggingNode.offsetY);

          return {
            ...node,
            x: Math.min(Math.max(CANVAS_PADDING, x), maxX),
            y: Math.min(Math.max(CANVAS_PADDING, y), maxY),
          };
        });

        return {
          ...current,
          nodes,
          connections: refreshPaths(nodes, current.connections),
        };
      });
    };

    const handlePointerUp = () => {
      setDraggingNode(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingNode, domain, updateWorkspace]);

  const handleNodePointerDown = (event, node) => {
    if (event.target.closest('[data-port-button="true"]') || event.target.closest('button')) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    setDraggingNode({
      nodeId: node.instanceId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    });
    updateWorkspace((current) => ({
      ...current,
      selectedEntity: { type: 'node', id: node.instanceId },
    }));
  };

  const handleCanvasDrop = (event) => {
    event.preventDefault();
    const componentId = event.dataTransfer.getData('text/fluid-component');
    const rect = canvasRef.current?.getBoundingClientRect();
    const component = getComponentDefinition(componentId);
    if (!componentId || !component || !rect) {
      return;
    }

    addNode(componentId, {
      x: event.clientX - rect.left - component.defaultSize.width / 2,
      y: event.clientY - rect.top - component.defaultSize.height / 2,
    });
  };

  const toggleGroup = (groupId) => {
    setExpandedGroups((current) => ({
      ...current,
      [domain]: {
        ...current[domain],
        [groupId]: !current[domain]?.[groupId],
      },
    }));
  };

  const handlePortClick = (node, component, port) => {
    const portRef = {
      nodeId: node.instanceId,
      portId: port.id,
      kind: port.kind,
      domain: component.domain,
      label: port.label,
      nodeLabel: toEntityLabel(node, component),
    };

    updateWorkspace((current) => {
      if (!current.pendingPort) {
        return {
          ...current,
          pendingPort: portRef,
          message: `Porta ${port.label} selezionata. Scegli la seconda porta per creare il collegamento.`,
        };
      }

      if (current.pendingPort.nodeId === portRef.nodeId && current.pendingPort.portId === portRef.portId) {
        return {
          ...current,
          pendingPort: null,
          message: 'Selezione porta annullata.',
        };
      }

      if (current.pendingPort.nodeId === portRef.nodeId) {
        return {
          ...current,
          pendingPort: null,
          message: 'Collega componenti diversi: i ponti interni non sono previsti nel v1.',
        };
      }

      if (!isPortCompatible(current.pendingPort, portRef, domain)) {
        return {
          ...current,
          pendingPort: null,
          message: 'Porte incompatibili: collega solo porte dello stesso tipo.',
        };
      }

      if (isPortOccupied(current.connections, current.pendingPort) || isPortOccupied(current.connections, portRef)) {
        return {
          ...current,
          pendingPort: null,
          message: 'Ogni porta puo ospitare un solo collegamento nella prima versione del simulatore.',
        };
      }

      if (hasConnection(current.connections, current.pendingPort, portRef)) {
        return {
          ...current,
          pendingPort: null,
          message: 'Queste due porte sono gia collegate.',
        };
      }

      const fromNode = current.nodes.find((item) => item.instanceId === current.pendingPort.nodeId);
      const toNode = current.nodes.find((item) => item.instanceId === portRef.nodeId);
      const fromComponent = fromNode ? getComponentDefinition(fromNode.componentId) : null;
      const toComponent = toNode ? getComponentDefinition(toNode.componentId) : null;
      const fromPort = fromComponent?.ports.find((item) => item.id === current.pendingPort.portId);
      const toPort = toComponent?.ports.find((item) => item.id === portRef.portId);

      if (!fromNode || !toNode || !fromComponent || !toComponent || !fromPort || !toPort) {
        return {
          ...current,
          pendingPort: null,
          message: 'Impossibile completare il collegamento richiesto.',
        };
      }

      const connection = {
        id: createConnectionId(),
        domain,
        kind: port.kind,
        from: { nodeId: fromNode.instanceId, portId: fromPort.id },
        to: { nodeId: toNode.instanceId, portId: toPort.id },
        pathPoints: computeConnectionPath(
          getPortPosition(fromNode, fromComponent, fromPort),
          getPortPosition(toNode, toComponent, toPort),
          fromPort,
          toPort,
        ),
      };

      return {
        ...current,
        pendingPort: null,
        connections: [...current.connections, connection],
        selectedEntity: { type: 'connection', id: connection.id },
        message: `Collegamento creato tra ${current.pendingPort.label} e ${portRef.label}.`,
      };
    });
  };

  const removeSelectedEntity = () => {
    updateWorkspace((current) => {
      if (!current.selectedEntity) {
        return {
          ...current,
          message: 'Seleziona prima un componente o un collegamento da eliminare.',
        };
      }

      if (current.selectedEntity.type === 'node') {
        const nodes = current.nodes.filter((node) => node.instanceId !== current.selectedEntity.id);
        const connections = current.connections.filter(
          (connection) =>
            connection.from.nodeId !== current.selectedEntity.id &&
            connection.to.nodeId !== current.selectedEntity.id,
        );

        return {
          ...current,
          nodes,
          connections,
          selectedEntity: null,
          pendingPort: null,
          message: 'Componente eliminato dallo schema.',
          snapshot: createWorkspace().snapshot,
        };
      }

      return {
        ...current,
        connections: current.connections.filter(
          (connection) => connection.id !== current.selectedEntity.id,
        ),
        selectedEntity: null,
        pendingPort: null,
        message: 'Collegamento eliminato dallo schema.',
        snapshot: createWorkspace().snapshot,
      };
    });
  };

  const clearWorkspace = () => {
    updateWorkspace(() => ({
      ...createWorkspace(),
      message: 'Schema svuotato. Puoi ricominciare con un nuovo circuito.',
    }));
  };

  const resetSimulation = () => {
    updateWorkspace((current) => ({
      ...current,
      snapshot: createWorkspace().snapshot,
      message: 'Simulazione azzerata, schema mantenuto nel canvas.',
    }));
  };

  const startSimulation = () => {
    updateWorkspace((current) => {
      const validation = validateCircuit(current.nodes, current.connections, domain);
      if (!validation.valid) {
        return {
          ...current,
          snapshot: {
            ...createWorkspace().snapshot,
            warnings: validation.warnings,
          },
          message: validation.warnings[0],
        };
      }

      const snapshot = buildSimulationFlow(current.nodes, current.connections, domain);
      return {
        ...current,
        snapshot,
        message: snapshot.warnings[0] ?? 'Schema pronto.',
      };
    });
  };

  const toggleValve = (nodeId) => {
    updateWorkspace((current) => {
      const nodes = applyValveState(current.nodes, nodeId);
      const valveNode = nodes.find((node) => node.instanceId === nodeId);
      const valveComponent = valveNode ? getComponentDefinition(valveNode.componentId) : null;

      return {
        ...current,
        nodes,
        snapshot: createWorkspace().snapshot,
        message: valveNode && valveComponent
          ? `Distributore commutato su ${describeActuatorState(valveNode, valveComponent)}.`
          : current.message,
      };
    });
  };

  return (
    <section className="features-section cycle-page fluid-power-page">
      <div className="section-header">
        <div className="section-badge">Nuova sezione didattica</div>
        <h2 className="section-title">
          Impianti <span style={{ color: domainMeta.accent }}>Oleodinamici / Pneumatici</span>
        </h2>
        <p className="hero-description fluid-page-description">
          Costruisci un circuito libero, collega le porte e avvia una simulazione visiva per capire
          il percorso del fluido e l'azione dei distributori.
        </p>
      </div>

      <div className="fluid-theory-intro">
        {theoryCards.map((card) => (
          <article key={card.title} className="fluid-theory-card glass">
            <h3 className="card-title">{card.title}</h3>
            <p className="card-description">{card.body}</p>
          </article>
        ))}
      </div>

      <div className="fluid-page-layout">
        <aside className="fluid-sidebar glass">
          <div className="fluid-sidebar-intro">
            <div>
              <div className="section-subtitle">Catalogo componenti</div>
              <p className="section-note">
                Palette piu compatta e divisa per famiglie per comporre lo schema con meno scroll.
              </p>
            </div>
          </div>

          <div className="fluid-domain-tabs">
            {FLUID_POWER_DOMAINS.map((item) => (
              <button
                key={item.id}
                className={`fluid-domain-tab ${domain === item.id ? 'fluid-domain-tab-active' : ''}`}
                style={domain === item.id ? { borderColor: item.accent, color: item.accent } : {}}
                onClick={() => setDomain(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="input-field">
            <label className="input-label" htmlFor="fluid-power-search">Cerca componente</label>
            <input
              id="fluid-power-search"
              className="glass-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Es. cilindro, 5/2, compressore"
            />
          </div>

          <div className="fluid-legend glass">
            <div className="fluid-legend-item">
              <span className="fluid-legend-dot fluid-legend-dot-fluid" style={{ background: domainMeta.accent }} />
              <span>{domainMeta.fluidLabel} / linea di processo</span>
            </div>
            <div className="fluid-legend-item">
              <span className="fluid-legend-dot fluid-legend-dot-active" />
              <span>Linea attiva in simulazione</span>
            </div>
            <div className="fluid-legend-item">
              <span className="fluid-legend-dot fluid-legend-dot-mechanical" />
              <span>Collegamento meccanico</span>
            </div>
          </div>

          <div className="fluid-palette-groups">
            {groups.map((group) => (
              <div key={group.id} className="fluid-palette-group glass">
                <button
                  type="button"
                  className="fluid-palette-group-toggle"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={hasSearch ? true : expandedGroups[domain]?.[group.id] ?? false}
                >
                  <div className="fluid-palette-group-copy">
                    <div className="fluid-palette-group-topline">
                      <span className="section-subtitle">{group.label}</span>
                      <span className="fluid-palette-count">{group.items.length}</span>
                    </div>
                    <p className="section-note">{CATEGORY_COPY[group.id]}</p>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`fluid-palette-chevron ${
                      hasSearch || expandedGroups[domain]?.[group.id] ? 'fluid-palette-chevron-open' : ''
                    }`}
                  />
                </button>

                {(hasSearch || expandedGroups[domain]?.[group.id]) && (
                  <div className="fluid-palette-list">
                    {group.items.map((component) => (
                      <div
                        key={component.id}
                        className="fluid-palette-card glass"
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData('text/fluid-component', component.id);
                          event.dataTransfer.effectAllowed = 'copy';
                        }}
                      >
                        <FluidPowerSymbol component={component} className="fluid-symbol-palette" />
                        <div className="fluid-palette-copy">
                          <h3 className="card-title">{component.label}</h3>
                          <p className="card-description">{component.description}</p>
                        </div>
                        <button
                          className="btn-outline fluid-palette-btn"
                          onClick={() => addNode(component.id)}
                          aria-label={`Aggiungi ${component.label}`}
                        >
                          Aggiungi
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {groups.length === 0 && (
              <div className="fluid-palette-empty glass">
                Nessun componente trovato per la ricerca corrente.
              </div>
            )}
          </div>
        </aside>

        <div className="fluid-workspace">
          <div className="fluid-toolbar glass">
            <div className="fluid-toolbar-actions">
              <button className="btn-primary fluid-toolbar-btn" onClick={startSimulation}>
                <Play size={18} />
                Avvia schema
              </button>
              <button className="btn-outline fluid-toolbar-btn" onClick={resetSimulation}>
                <RotateCcw size={18} />
                Reset simulazione
              </button>
              <button className="btn-outline fluid-toolbar-btn" onClick={clearWorkspace}>
                <Trash2 size={18} />
                Pulisci schema
              </button>
              <button className="btn-outline fluid-toolbar-btn" onClick={removeSelectedEntity}>
                <Trash2 size={18} />
                Elimina selezione
              </button>
            </div>
            <div className="fluid-status-strip">
              <div className="fluid-status-chip">
                <Move size={16} />
                <span>{workspace.nodes.length} componenti</span>
              </div>
              <div className="fluid-status-chip">
                <Waves size={16} />
                <span>{workspace.connections.length} collegamenti</span>
              </div>
              <div className="fluid-status-chip">
                <Activity size={16} />
                <span>{workspace.snapshot.isRunning ? 'Schema attivo' : 'Schema fermo'}</span>
              </div>
            </div>
          </div>

          <div className="fluid-canvas-panel glass">
            <div className="fluid-panel-header">
              <div>
                <div className="section-subtitle">Canvas di simulazione</div>
                <p className="section-note">
                  Trascina i simboli, clicca le porte per collegarle e commuta i distributori prima di avviare.
                </p>
              </div>
              <div className="fluid-message-banner">{workspace.message}</div>
            </div>

            <div
              ref={canvasRef}
              className="fluid-canvas"
              style={{
                '--fluid-canvas-width': `${CANVAS_WIDTH}px`,
                '--fluid-canvas-height': `${CANVAS_HEIGHT}px`,
                '--fluid-active-color': domainMeta.activeColor,
                '--fluid-accent-color': domainMeta.accent,
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleCanvasDrop}
            >
              <div className="fluid-canvas-stage">
                <svg className="fluid-connections-layer" viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}>
                  <defs>
                    <marker
                      id={`fluid-active-arrow-${domain}`}
                      markerWidth="10"
                      markerHeight="10"
                      refX="8"
                      refY="5"
                      orient="auto"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill={domainMeta.activeColor} />
                    </marker>
                  </defs>
                  {workspace.connections.map((connection) => {
                    const isActive = workspace.snapshot.activeConnections.includes(connection.id);
                    const isMechanical = connection.kind === 'mechanical';
                    const isSelected =
                      workspace.selectedEntity?.type === 'connection' &&
                      workspace.selectedEntity.id === connection.id;

                    return (
                      <path
                        key={connection.id}
                        d={pointsToPath(connection.pathPoints)}
                        className={`fluid-connection ${isActive ? 'fluid-connection-active' : ''} ${isMechanical ? 'fluid-connection-mechanical' : ''} ${isSelected ? 'fluid-connection-selected' : ''}`}
                        markerEnd={
                          isActive && !isMechanical ? `url(#fluid-active-arrow-${domain})` : undefined
                        }
                        onClick={() =>
                          updateWorkspace((current) => ({
                            ...current,
                            selectedEntity: { type: 'connection', id: connection.id },
                          }))
                        }
                      />
                    );
                  })}
                </svg>

                {workspace.nodes.map((node) => {
                  const component = getComponentDefinition(node.componentId);
                  const isSelected =
                    workspace.selectedEntity?.type === 'node' && workspace.selectedEntity.id === node.instanceId;
                  const isActive = workspace.snapshot.activeNodes.includes(node.instanceId);
                  const motionState =
                    workspace.snapshot.isRunning && isActive
                      ? workspace.snapshot.actuatorAction ?? 'flow'
                      : null;

                  return (
                    <div
                      key={node.instanceId}
                      className={`fluid-node glass ${isSelected ? 'fluid-node-selected' : ''} ${isActive ? 'fluid-node-active' : ''}`}
                      style={{
                        width: component.defaultSize.width,
                        height: component.defaultSize.height,
                        left: node.x,
                        top: node.y,
                      }}
                      onPointerDown={(event) => handleNodePointerDown(event, node)}
                      onClick={() =>
                        updateWorkspace((current) => ({
                          ...current,
                          selectedEntity: { type: 'node', id: node.instanceId },
                        }))
                      }
                    >
                      <div className="fluid-node-header">
                        <span className="fluid-node-title">{node.label}</span>
                        {component.simBehavior.kind === 'valve' && (
                          <button
                            className="fluid-node-toggle"
                            onClick={() => toggleValve(node.instanceId)}
                            aria-label={`Commuta ${node.label}`}
                          >
                            {describeActuatorState(node, component)}
                          </button>
                        )}
                      </div>
                      <FluidPowerSymbol
                        component={component}
                        active={isActive}
                        label={node.label}
                        motionState={motionState}
                      />
                      {component.ports.map((port) => {
                        const position = getPortPosition(node, component, port);
                        const portKey = `${node.instanceId}:${port.id}`;
                        const isPortActive = workspace.snapshot.activePorts.includes(portKey);
                        const isPending =
                          workspace.pendingPort?.nodeId === node.instanceId &&
                          workspace.pendingPort?.portId === port.id;

                        return (
                          <button
                            key={port.id}
                            type="button"
                            data-port-button="true"
                            className={`fluid-port fluid-port-side-${port.side} fluid-port-kind-${port.kind} ${
                              isPortActive ? 'fluid-port-active' : ''
                            } ${isPending ? 'fluid-port-pending' : ''}`}
                            style={{ left: position.x - node.x - 9, top: position.y - node.y - 9 }}
                            onClick={(event) => {
                              event.stopPropagation();
                              handlePortClick(node, component, port);
                            }}
                            aria-label={`Porta ${port.label} di ${node.label}`}
                          >
                            <span className="fluid-port-tail" aria-hidden="true" />
                            <span className="fluid-port-label" aria-hidden="true">{port.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}

                {workspace.nodes.length === 0 && (
                  <div className="fluid-empty-state">
                    <Activity size={44} className="empty-icon" />
                    <p>Il canvas e vuoto. Trascina un componente dalla sinistra oppure usa il pulsante "Aggiungi".</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="fluid-simulation-panel glass">
            <div className="section-subtitle">Pannello simulazione</div>
            <div className="fluid-simulation-grid">
              <div className="fluid-simulation-card">
                <span className="stat-card-label">Stato</span>
                <strong className="stat-card-value">
                  {workspace.snapshot.isRunning ? 'Attivo' : 'In attesa'}
                </strong>
              </div>
              <div className="fluid-simulation-card">
                <span className="stat-card-label">Azione</span>
                <strong className="stat-card-value">
                  {workspace.snapshot.actuatorAction ?? 'Nessuna'}
                </strong>
              </div>
              <div className="fluid-simulation-card">
                <span className="stat-card-label">Dominio</span>
                <strong className="stat-card-value">{domainMeta.label}</strong>
              </div>
            </div>

            {workspace.snapshot.warnings.length > 0 && (
              <div className="fluid-warning-list">
                {workspace.snapshot.warnings.map((warning, index) => (
                  <div key={`${warning}-${index}`} className="error-banner">
                    <p>{warning}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="fluid-summary">
              <p className="section-note">
                Catena minima richiesta: sorgente {'->'} distributore {'->'} utilizzatore {'->'} ritorno/scarico.
              </p>
              {workspace.snapshot.summary && (
                <div className="fluid-summary-row">
                  <span>{workspace.snapshot.summary.sourceLabel}</span>
                  <span>{workspace.snapshot.summary.valveLabel}</span>
                  <span>{workspace.snapshot.summary.actuatorLabel}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="fluid-guide-grid">
        <section className="fluid-guide-panel glass">
          <div className="section-subtitle">Componenti da riconoscere</div>
          <ul className="fluid-guide-list">
            <li>Pompa o compressore come sorgente di energia del fluido.</li>
            <li>Serbatoio o scarico come riferimento del ritorno.</li>
            <li>Distributori 3/2, 4/2 e 5/2 come organi di comando della direzione.</li>
            <li>Valvole di massima, regolatori e FRL come organi di protezione e condizionamento.</li>
            <li>Cilindri e motori come utilizzatori finali del circuito.</li>
          </ul>
        </section>

        <section className="fluid-guide-panel glass">
          <div className="section-subtitle">Circuiti guida da provare</div>
          <ul className="fluid-guide-list">
            {guidedCircuits.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
};

export default FluidPowerLabPage;
