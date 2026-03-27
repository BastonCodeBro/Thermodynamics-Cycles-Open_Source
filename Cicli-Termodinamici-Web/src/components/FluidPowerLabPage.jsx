import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ChevronDown,
  Download,
  GraduationCap,
  Move,
  Play,
  RotateCcw,
  Trash2,
  Upload,
  Waves,
  Wrench,
} from 'lucide-react';
import {
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
import {
  buildBillOfMaterials,
  createDraftNodePayload,
  createProjectMeta,
  FLUID_POWER_PROJECT_STORAGE_KEY,
  hydrateProjectDocument,
  serializeProjectDocument,
  touchProjectMeta,
} from '../utils/fluidPowerProject';

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
  alimentazione: 'Sorgenti, ritorni e unità di servizio per alimentare correttamente il circuito.',
  'valvole-distributrici': 'Organi di comando per indirizzare il flusso e cambiare il moto dell'attuatore.',
  utilizzatori: 'Cilindri e motori che trasformano l'energia del fluido in lavoro utile.',
  ausiliari: 'Elementi di regolazione, protezione e logica per completare lo schema.',
  'strumentazione-e-comandi': 'Indicatori e comandi simbolici utili a leggere la funzione del circuito.',
  'simbologia-base': 'Segni grafici di supporto per ripassare la simbologia ISO del fluid power.',
};

const MODE_OPTIONS = [
  {
    id: 'didactic',
    label: 'Studente',
    description: 'Feedback semplice, checklist ed esito guidato del circuito.',
    Icon: GraduationCap,
  },
  {
    id: 'engineering',
    label: 'Ingegnere',
    description: 'Vista tecnica con inspector, porte e stato interno del circuito.',
    Icon: Wrench,
  },
];

const KIND_LABELS = {
  source: 'Sorgente',
  valve: 'Distributore',
  actuator: 'Utilizzatore',
  sink: 'Ritorno / scarico',
  conditioning: 'Condizionamento',
  auxiliary: 'Ausiliario',
  flowControl: 'Regolazione flusso',
  instrument: 'Strumento',
  display: 'Simbolo',
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
  nets: [],
  pendingPort: null,
  selectedEntity: null,
  lastRun: null,
  baselineRun: null,
  scenarioId: 'startup-sequence',
  timelineStep: 0,
  snapshot: {
    isRunning: false,
    activePorts: [],
    activeConnections: [],
    activeNodes: [],
    warnings: [],
    actuatorAction: null,
    readings: {},
    actuatorTiming: null,
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

const computeMidArrow = (points, arrowSize = 6) => {
  if (!points || points.length < 2) {
    return null;
  }

  const segments = [];
  let totalLength = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const length = distanceBetween(points[i], points[i + 1]);
    segments.push({ from: points[i], to: points[i + 1], length });
    totalLength += length;
  }

  if (totalLength === 0) {
    return null;
  }

  let target = totalLength / 2;
  let midPoint = points[0];
  let angle = 0;

  for (const segment of segments) {
    if (target <= segment.length) {
      const ratio = segment.length > 0 ? target / segment.length : 0;
      midPoint = {
        x: segment.from.x + (segment.to.x - segment.from.x) * ratio,
        y: segment.from.y + (segment.to.y - segment.from.y) * ratio,
      };
      angle = Math.atan2(segment.to.y - segment.from.y, segment.to.x - segment.from.x);
      break;
    }
    target -= segment.length;
  }

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const tip = { x: midPoint.x + cos * arrowSize, y: midPoint.y + sin * arrowSize };
  const left = { x: midPoint.x - cos * arrowSize + sin * arrowSize * 0.55, y: midPoint.y - sin * arrowSize - cos * arrowSize * 0.55 };
  const right = { x: midPoint.x - cos * arrowSize - sin * arrowSize * 0.55, y: midPoint.y - sin * arrowSize + cos * arrowSize * 0.55 };

  return `${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`;
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
    body: 'Lavora ad alte pressioni, offre grande forza sugli attuatori ed è ideale per presse, timonerie, gru e macchine operatrici.',
  },
  {
    title: 'Pneumatica',
    body: 'Usa aria compressa, risponde rapidamente ed è adatta ad automazioni, pick-and-place, serraggi e attuazioni leggere.',
  },
  {
    title: 'Metodo di studio',
    body: 'Individua sempre sorgente, regolazione, attuatore e ritorno: è la chiave per leggere sia lo schema simbolico sia il circuito reale.',
  },
];

const guidedCircuits = [
  'Cilindro semplice effetto con valvola 3/2 e serbatoio o scarico.',
  'Cilindro doppio effetto con distributore 5/2 e inversione di moto.',
  'Pompa + valvola limitatrice + distributore + attuatore come catena minima oleodinamica.',
  'Compressore + gruppo FRL + distributore + cilindro come catena minima pneumatica.',
];

const studentWorkflow = [
  'Costruisci la catena minima: sorgente, distributore, utilizzatore e ritorno/scarico.',
  'Avvia lo schema per verificare se il percorso del fluido raggiunge davvero l utilizzatore.',
  'Se il circuito non funziona, leggi l esito e correggi un errore alla volta.',
];

const engineeringWorkflow = [
  'Usa il canvas per controllare porte, instradamento e stato dei distributori.',
  'Seleziona un elemento per leggere dettagli tecnici, connessioni e coordinate.',
  'Esporta o importa il progetto JSON per mantenere lo stesso assetto tra piu sessioni.',
];

const modeLabel = (mode) => (mode === 'engineering' ? 'Ingegnere' : 'Studente');

const modeDescription = (mode) =>
  mode === 'engineering'
    ? 'Vista tecnica piu densa per leggere stato, porte e struttura del circuito.'
    : 'Vista semplificata con checklist, esito del circuito e spiegazioni passo passo.';

const getComponentTeachingNote = (component) => {
  if (component?.simBehavior?.kind === 'actuator') {
    if (component.simBehavior.actuatorType === 'single') {
      return '1 porta, ritorno a molla';
    }

    if (component.simBehavior.actuatorType === 'double') {
      return '2 porte di lavoro';
    }
  }

  if (component?.simBehavior?.kind === 'valve') {
    return `${component.simBehavior.family} ${component.simBehavior.workPorts?.length === 1 ? 'per singolo effetto' : 'per doppio effetto'}`;
  }

  if (component?.simBehavior?.kind === 'flowControl') {
    return 'Limitazione di portata';
  }

  if (component?.simBehavior?.kind === 'instrument') {
    return 'Strumento di misura';
  }

  return null;
};

const getMotionBadgeLabel = (component, motionState, isRunning) => {
  if (!isRunning || !motionState) {
    return null;
  }

  if (component?.simBehavior?.kind === 'actuator') {
    if (motionState.includes('ritra')) {
      return 'Rientra';
    }

    if (motionState.includes('esten')) {
      return 'Estende';
    }

    if (motionState.includes('rotazione')) {
      return motionState;
    }
  }

  if (component?.simBehavior?.kind === 'valve') {
    return 'Flusso instradato';
  }

  if (component?.simBehavior?.kind === 'flowControl') {
    return 'Flusso regolato';
  }

  if (component?.simBehavior?.kind === 'instrument') {
    return 'Misura attiva';
  }

  return 'Flusso attivo';
};

const getNodeCounts = (workspace) => {
  const counts = {
    source: 0,
    valve: 0,
    actuator: 0,
    sink: 0,
    flowControl: 0,
    instrument: 0,
  };

  workspace.nodes.forEach((node) => {
    const component = getComponentDefinition(node.componentId);
    const kind = component?.simBehavior?.kind;

    if (kind && counts[kind] !== undefined) {
      counts[kind] += 1;
    }
  });

  return counts;
};

const buildDidacticChecklist = (workspace, validation) => {
  const counts = getNodeCounts(workspace);

  return [
    { id: 'source', label: 'Sorgente presente', done: counts.source > 0 },
    { id: 'valve', label: 'Distributore presente', done: counts.valve > 0 },
    { id: 'actuator', label: 'Utilizzatore presente', done: counts.actuator > 0 },
    { id: 'sink', label: 'Ritorno o scarico presente', done: counts.sink > 0 },
    { id: 'simulation', label: 'Schema simulabile', done: validation.valid || workspace.snapshot.isRunning },
  ];
};

const buildDidacticFeedback = (workspace, validation, domainMeta) => {
  const warnings = workspace.snapshot.warnings ?? [];
  const hasWarnings = warnings.length > 0;
  const summary = workspace.snapshot.summary;
  const action = workspace.snapshot.actuatorAction;

  if (workspace.snapshot.isRunning) {
    return {
      verdict: 'Funziona',
      tone: 'success',
      summary: `Il ${domainMeta.fluidLabel.toLowerCase()} arriva al circuito utile e produce ${action ?? 'un azionamento corretto'}.`,
      nextSuggestion: 'Prova a commutare il distributore per osservare una seconda configurazione del circuito.',
      flowExplanation: summary
        ? `${summary.sourceLabel} alimenta ${summary.valveLabel}, che porta il flusso verso ${summary.actuatorLabel}.`
        : 'La sorgente alimenta il distributore e il distributore comanda l utilizzatore.',
    };
  }

  if (hasWarnings && validation.valid) {
    return {
      verdict: 'Errato',
      tone: 'error',
      summary: warnings[0],
      nextSuggestion: 'Controlla soprattutto la posizione del distributore e i collegamenti che raggiungono l utilizzatore.',
      flowExplanation: 'Il circuito ha gli elementi giusti, ma nella configurazione attuale il flusso non comanda correttamente l utilizzatore.',
    };
  }

  if (validation.valid) {
    return {
      verdict: 'Incompleto',
      tone: 'info',
      summary: 'Lo schema è pronto, ma non è ancora stato avviato nella configurazione corrente.',
      nextSuggestion: 'Avvia lo schema o commuta il distributore se vuoi vedere il movimento dell'attuatore.',
      flowExplanation: 'Il circuito contiene già la catena minima: ora va verificata la direzione del flusso in simulazione.',
    };
  }

  return {
    verdict: 'Incompleto',
    tone: 'warning',
    summary: validation.warnings?.[0] ?? 'Completa la catena minima prima di avviare la simulazione.',
    nextSuggestion: 'Parti sempre da sorgente, distributore, utilizzatore e ritorno o scarico.',
    flowExplanation: 'Finché manca uno di questi elementi il simulatore non può chiudere il percorso del fluido.',
  };
};

const buildInspector = (workspace) => {
  if (!workspace.selectedEntity) {
    return {
      title: 'Nessuna selezione',
      subtitle: 'Seleziona un componente o un collegamento nel canvas per vedere i dettagli tecnici.',
      rows: [],
      ports: [],
    };
  }

  if (workspace.selectedEntity.type === 'connection') {
    const connection = workspace.connections.find((item) => item.id === workspace.selectedEntity.id);

    if (!connection) {
      return {
        title: 'Collegamento non disponibile',
        subtitle: 'La selezione corrente non è più presente nel canvas.',
        rows: [],
        ports: [],
      };
    }

    const fromNode = workspace.nodes.find((node) => node.instanceId === connection.from.nodeId);
    const toNode = workspace.nodes.find((node) => node.instanceId === connection.to.nodeId);

    return {
      title: 'Collegamento selezionato',
      subtitle: `${fromNode?.label ?? connection.from.nodeId} -> ${toNode?.label ?? connection.to.nodeId}`,
      rows: [
        ['Tipo', connection.kind === 'mechanical' ? 'Meccanico' : 'Fluido'],
        ['Dominio', connection.domain],
        ['Porta origine', connection.from.portId],
        ['Porta arrivo', connection.to.portId],
        [
          'Stato',
          workspace.snapshot.activeConnections.includes(connection.id) ? 'Attivo in simulazione' : 'In attesa',
        ],
      ],
      ports: [],
    };
  }

  const node = workspace.nodes.find((item) => item.instanceId === workspace.selectedEntity.id);
  const component = node ? getComponentDefinition(node.componentId) : null;

  if (!node || !component) {
    return {
      title: 'Componente non disponibile',
      subtitle: 'La selezione corrente non è più presente nel canvas.',
      rows: [],
      ports: [],
    };
  }

  const connectionCount = workspace.connections.filter(
    (connection) =>
      connection.from.nodeId === node.instanceId || connection.to.nodeId === node.instanceId,
  ).length;

  return {
    title: node.label,
    subtitle: component.label,
    rows: [
      ['Famiglia', KIND_LABELS[component.simBehavior.kind] ?? 'Componente'],
      ['Biblioteca', node.libraryId ?? component.id],
      ['Vendor ref', node.vendorRef?.trim() ? node.vendorRef : 'n/d'],
      ['Porte collegate', `${connectionCount}`],
      ['Posizione', `${node.x}, ${node.y}`],
      ['Rotazione', `${node.rotation ?? 0} deg`],
      [
        'Stato interno',
        node.state?.currentState ? node.state.currentState : describeActuatorState(node, component),
      ],
      [
        'Attivo',
        workspace.snapshot.activeNodes.includes(node.instanceId) ? 'Si' : 'No',
      ],
    ],
    ports: component.ports.map((port) => `${port.label} (${port.side})`),
  };
};

const FluidPowerLabPage = () => {
  const [projectMeta, setProjectMeta] = useState(() => createProjectMeta());
  const [domain, setDomain] = useState('hydraulic');
  const [search, setSearch] = useState('');
  const [storageStatus, setStorageStatus] = useState('Autosave locale pronto.');
  const [workspaces, setWorkspaces] = useState({
    hydraulic: createWorkspace(),
    pneumatic: createWorkspace(),
  });
  const [expandedGroups, setExpandedGroups] = useState(createExpandedGroupState);
  const [draggingNode, setDraggingNode] = useState(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const canvasRef = useRef(null);
  const importInputRef = useRef(null);

  const workspace = workspaces[domain];
  const domainMeta = getDomainMeta(domain);
  const groups = useMemo(() => paletteGroups(domain, search), [domain, search]);
  const hasSearch = search.trim().length > 0;
  const isStudentMode = projectMeta.mode !== 'engineering';

  const refreshPaths = useCallback((nodes, connections) =>
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
    }), []);

  const normalizeWorkspace = useCallback((incomingWorkspace) => {
    const base = createWorkspace();
    const mergedWorkspace = {
      ...base,
      ...incomingWorkspace,
    };

    return {
      ...mergedWorkspace,
      nodes: incomingWorkspace?.nodes ?? base.nodes,
      connections: refreshPaths(
        incomingWorkspace?.nodes ?? base.nodes,
        incomingWorkspace?.connections ?? base.connections,
      ),
      pendingPort: null,
      selectedEntity: incomingWorkspace?.selectedEntity ?? null,
      snapshot: incomingWorkspace?.snapshot ?? base.snapshot,
      message: incomingWorkspace?.message ?? base.message,
    };
  }, [refreshPaths]);

  useEffect(() => {
    try {
      const rawDocument = window.localStorage.getItem(FLUID_POWER_PROJECT_STORAGE_KEY);

      if (!rawDocument) {
        setIsHydrated(true);
        return;
      }

      const hydrated = hydrateProjectDocument(rawDocument, createWorkspace);

      setProjectMeta(hydrated.meta);
      setWorkspaces({
        hydraulic: normalizeWorkspace(hydrated.workspaces.hydraulic),
        pneumatic: normalizeWorkspace(hydrated.workspaces.pneumatic),
      });
      setStorageStatus('Progetto locale ripristinato.');
    } catch {
      setStorageStatus('Autosave locale non valido: viene ignorato.');
    } finally {
      setIsHydrated(true);
    }
  }, [normalizeWorkspace]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    try {
      const serialized = serializeProjectDocument(projectMeta, workspaces);
      window.localStorage.setItem(FLUID_POWER_PROJECT_STORAGE_KEY, serialized);
      setStorageStatus('Autosave locale aggiornato.');
    } catch {
      setStorageStatus('Impossibile salvare il progetto nel browser.');
    }
  }, [isHydrated, projectMeta, workspaces]);

  const validation = useMemo(
    () => validateCircuit(workspace.nodes, workspace.connections, domain),
    [workspace.connections, workspace.nodes, domain],
  );

  const didacticChecklist = useMemo(
    () => buildDidacticChecklist(workspace, validation),
    [workspace, validation],
  );

  const didacticFeedback = useMemo(
    () => buildDidacticFeedback(workspace, validation, domainMeta),
    [workspace, validation, domainMeta],
  );

  const inspector = useMemo(() => buildInspector(workspace), [workspace]);
  const bomItems = useMemo(() => buildBillOfMaterials(workspace), [workspace]);

  const updateWorkspace = useCallback((updater) => {
    setWorkspaces((current) => ({
      ...current,
      [domain]: updater(current[domain]),
    }));
  }, [domain]);

  const addNode = (componentId, dropPosition) => {
    const component = getComponentDefinition(componentId);
    if (!component) {
      return;
    }

    updateWorkspace((current) => {
      const existingCount = current.nodes.filter((node) => node.componentId === componentId).length;
      const nextLabel = `${component.label} ${existingCount + 1}`;
      const node = createDraftNodePayload(
        componentId,
        createNodeId(),
        snap(dropPosition?.x ?? 48 + (existingCount % 3) * 192),
        snap(dropPosition?.y ?? 56 + Math.floor(existingCount / 3) * 144),
        nextLabel,
      );

      if (!node) {
        return current;
      }

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
  }, [draggingNode, domain, refreshPaths, updateWorkspace]);

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
          message: 'Ogni porta può ospitare un solo collegamento nella prima versione del simulatore.',
        };
      }

      if (hasConnection(current.connections, current.pendingPort, portRef)) {
        return {
          ...current,
          pendingPort: null,
          message: 'Queste due porte sono già collegate.',
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
      const currentValidation = validateCircuit(current.nodes, current.connections, domain);
      if (!currentValidation.valid) {
        return {
          ...current,
          snapshot: {
            ...createWorkspace().snapshot,
            warnings: currentValidation.warnings,
          },
          message: currentValidation.warnings[0],
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

  const handleModeChange = (mode) => {
    if (projectMeta.mode === mode) {
      return;
    }

    setProjectMeta((current) => touchProjectMeta({
      ...current,
      mode,
    }));

    updateWorkspace((current) => ({
      ...current,
      message:
        mode === 'engineering'
          ? 'Vista tecnica attiva: seleziona componenti e collegamenti per leggerne i dettagli.'
          : 'Modalita studente attiva: usa checklist, esito e suggerimenti per capire il circuito.',
    }));
  };

  const handleExportProject = () => {
    try {
      const serialized = serializeProjectDocument(projectMeta, workspaces);
      const blob = new Blob([serialized], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const dateStamp = new Date().toISOString().slice(0, 10);

      anchor.href = url;
      anchor.download = `fluid-power-${projectMeta.mode}-${dateStamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      setStorageStatus('Progetto esportato in JSON.');
    } catch {
      setStorageStatus('Impossibile esportare il progetto.');
    }
  };

  const openImportDialog = () => {
    importInputRef.current?.click();
  };

  const handleImportProject = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const rawDocument = await file.text();
      const hydrated = hydrateProjectDocument(rawDocument, createWorkspace);

      setProjectMeta(hydrated.meta);
      setWorkspaces({
        hydraulic: normalizeWorkspace(hydrated.workspaces.hydraulic),
        pneumatic: normalizeWorkspace(hydrated.workspaces.pneumatic),
      });
      setStorageStatus('Progetto importato dal file JSON.');
    } catch {
      setStorageStatus('Il file selezionato non è un progetto Fluid Power valido.');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <section className="features-section cycle-page fluid-power-page">
      <div className="section-header">
        <div className="section-badge">{`Modalita ${modeLabel(projectMeta.mode)}`}</div>
        <h2 className="section-title">
          Impianti <span style={{ color: domainMeta.accent }}>Oleodinamici / Pneumatici</span>
        </h2>
        <p className="hero-description fluid-page-description">
          {isStudentMode
            ? 'Costruisci un circuito, avvialo e capisci subito se il percorso del fluido funziona davvero.'
            : 'Analizza il circuito con una vista tecnica più ricca, mantenendo lo stesso editor e la stessa simulazione.'}
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
                {isStudentMode
                  ? 'Palette compatta e organizzata per montare lo schema senza perdersi nei componenti.'
                  : 'Palette tecnica per costruire e leggere il circuito mantenendo i riferimenti simbolici.'}
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
            <div className="fluid-toolbar-top">
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

              <div className="fluid-mode-switch" role="group" aria-label="Modalita laboratorio">
                <span className="fluid-mode-switch-label">Modalita</span>
                {MODE_OPTIONS.map((option) => {
                  const Icon = option.Icon;
                  const active = projectMeta.mode === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`fluid-mode-option ${active ? 'fluid-mode-option-active' : ''}`}
                      onClick={() => handleModeChange(option.id)}
                      aria-pressed={active}
                    >
                      <Icon size={16} />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="fluid-toolbar-bottom">
              <div className="fluid-toolbar-actions fluid-toolbar-actions-secondary">
                <button className="btn-outline fluid-toolbar-btn" onClick={handleExportProject}>
                  <Download size={18} />
                  Esporta JSON
                </button>
                <button className="btn-outline fluid-toolbar-btn" onClick={openImportDialog}>
                  <Upload size={18} />
                  Importa JSON
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

            <div className="fluid-storage-note">
              <strong>{modeLabel(projectMeta.mode)}</strong>
              <span>{modeDescription(projectMeta.mode)}</span>
              <em>{storageStatus}</em>
            </div>

            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="fluid-hidden-input"
              onChange={handleImportProject}
            />
          </div>

          <div className="fluid-canvas-panel glass">
            <div className="fluid-panel-header">
              <div>
                <div className="section-subtitle">Canvas di simulazione</div>
                <p className="section-note">
                  {isStudentMode
                    ? 'Trascina i simboli, collega le porte e guarda se il circuito compie davvero l azione attesa.'
                    : 'Trascina i simboli, collega le porte e controlla la struttura tecnica del circuito selezionato.'}
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
                  {workspace.connections.map((connection) => {
                    const isActive = workspace.snapshot.activeConnections.includes(connection.id);
                    const isMechanical = connection.kind === 'mechanical';
                    const isSelected =
                      workspace.selectedEntity?.type === 'connection' &&
                      workspace.selectedEntity.id === connection.id;
                    const midArrow = isActive && !isMechanical
                      ? computeMidArrow(connection.pathPoints, 6)
                      : null;

                    return (
                      <g key={connection.id}>
                        <path
                          d={pointsToPath(connection.pathPoints)}
                          className={`fluid-connection ${isActive ? 'fluid-connection-active' : ''} ${isMechanical ? 'fluid-connection-mechanical' : ''} ${isSelected ? 'fluid-connection-selected' : ''}`}
                          onClick={() =>
                            updateWorkspace((current) => ({
                              ...current,
                              selectedEntity: { type: 'connection', id: connection.id },
                            }))
                          }
                        />
                        {midArrow && (
                          <polygon
                            points={midArrow}
                            fill={domainMeta.activeColor}
                            opacity="0.9"
                          />
                        )}
                      </g>
                    );
                  })}
                </svg>

                {workspace.nodes.map((node) => {
                  const component = getComponentDefinition(node.componentId);
                  const isSelected =
                    workspace.selectedEntity?.type === 'node' && workspace.selectedEntity.id === node.instanceId;
                  const isActive = workspace.snapshot.activeNodes.includes(node.instanceId);
                  const teachingNote = getComponentTeachingNote(component);
                  const motionState =
                    workspace.snapshot.isRunning && isActive
                      ? workspace.snapshot.actuatorAction ?? 'flow'
                      : null;
                  const motionBadge = getMotionBadgeLabel(
                    component,
                    motionState,
                    workspace.snapshot.isRunning && isActive,
                  );
                  const reading = workspace.snapshot.readings?.[node.instanceId] ?? null;
                  const isInstrument = component.symbol === 'instrument';
                  const isFlowControl = component.simBehavior.kind === 'flowControl';
                  const flowPct = isFlowControl
                    ? Math.round((node.state?.flowMultiplier ?? component.simBehavior.flowMultiplier ?? 1.0) * 100)
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
                            onClick={(e) => { e.stopPropagation(); toggleValve(node.instanceId); }}
                            aria-label={`Commuta ${node.label}`}
                          >
                            {describeActuatorState(node, component)}
                          </button>
                        )}
                        {isFlowControl && (
                          <button
                            className="fluid-node-toggle fluid-node-toggle-throttle"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateWorkspace((current) => ({
                                ...current,
                                nodes: current.nodes.map((n) => {
                                  if (n.instanceId !== node.instanceId) {
                                    return n;
                                  }
                                  const currentPct = Math.round((n.state?.flowMultiplier ?? 1.0) * 100);
                                  const nextPct = currentPct >= 100 ? 25 : currentPct >= 50 ? 100 : currentPct >= 25 ? 50 : 25;
                                  return {
                                    ...n,
                                    state: { ...n.state, flowMultiplier: nextPct / 100 },
                                  };
                                }),
                                snapshot: createWorkspace().snapshot,
                              }));
                            }}
                            aria-label={`Apertura ${flowPct}%`}
                          >
                            {flowPct}%
                          </button>
                        )}
                      </div>
                      <FluidPowerSymbol
                        component={component}
                        active={isActive}
                        label={node.label}
                        motionState={motionState}
                        nodeState={node.state ?? null}
                        reading={reading}
                      />
                      {(motionBadge || teachingNote || (isInstrument && reading?.active)) && (
                        <div className="fluid-node-footer">
                          {motionBadge && <span className="fluid-node-motion-badge">{motionBadge}</span>}
                          {isInstrument && reading?.active && (
                            <span className="fluid-node-reading-badge">
                              {reading.pressure != null ? `${reading.pressure} bar` : ''}
                              {reading.flowRate != null ? `${reading.flowRate} L/min` : ''}
                            </span>
                          )}
                          {teachingNote && <span className="fluid-node-teaching-note">{teachingNote}</span>}
                        </div>
                      )}
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
            <div className="section-subtitle">
              {isStudentMode ? 'Pannello studente' : 'Pannello tecnico'}
            </div>

            {isStudentMode ? (
              <>
                <div className={`fluid-mode-banner fluid-mode-banner-${didacticFeedback.tone}`}>
                  <div className="fluid-mode-banner-topline">
                    <span className="fluid-mode-badge">Esito circuito</span>
                    <strong>{didacticFeedback.verdict}</strong>
                  </div>
                  <p>{didacticFeedback.summary}</p>
                  <div className="fluid-mode-banner-foot">
                    <span>{didacticFeedback.nextSuggestion}</span>
                  </div>
                </div>

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
                  {workspace.snapshot.actuatorTiming && (
                    <div className="fluid-simulation-card">
                      <span className="stat-card-label">Tempo corsa</span>
                      <strong className="stat-card-value">
                        {workspace.snapshot.actuatorTiming.actualStrokeTime}s
                      </strong>
                      {workspace.snapshot.actuatorTiming.flowMultiplier < 1 && (
                        <span className="stat-card-detail">
                          (x{workspace.snapshot.actuatorTiming.flowMultiplier} portata)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="fluid-checklist-panel">
                  <div className="section-subtitle">Checklist didattica</div>
                  <div className="fluid-checklist-list">
                    {didacticChecklist.map((item) => (
                      <div
                        key={item.id}
                        className={`fluid-checklist-item ${item.done ? 'fluid-checklist-item-done' : ''}`}
                      >
                        <strong>{item.done ? 'OK' : 'Da completare'}</strong>
                        <span>{item.label}</span>
                      </div>
                    ))}
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
                  <p className="fluid-flow-explanation">{didacticFeedback.flowExplanation}</p>
                  {workspace.snapshot.summary && (
                    <div className="fluid-summary-row">
                      <span>{workspace.snapshot.summary.sourceLabel}</span>
                      <span>{workspace.snapshot.summary.valveLabel}</span>
                      <span>{workspace.snapshot.summary.actuatorLabel}</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="fluid-simulation-grid">
                  <div className="fluid-simulation-card">
                    <span className="stat-card-label">Modalita</span>
                    <strong className="stat-card-value">Ingegnere</strong>
                  </div>
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
                  {workspace.snapshot.actuatorTiming && (
                    <div className="fluid-simulation-card">
                      <span className="stat-card-label">Tempo corsa</span>
                      <strong className="stat-card-value">
                        {workspace.snapshot.actuatorTiming.actualStrokeTime}s
                      </strong>
                      {workspace.snapshot.actuatorTiming.flowMultiplier < 1 && (
                        <span className="stat-card-detail">
                          (x{workspace.snapshot.actuatorTiming.flowMultiplier} portata)
                        </span>
                      )}
                    </div>
                  )}
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

                <div className="fluid-inspector-panel">
                  <div className="section-subtitle">Inspector tecnico</div>
                  <div className="fluid-inspector-card">
                    <h3 className="card-title">{inspector.title}</h3>
                    <p className="card-description">{inspector.subtitle}</p>
                    <div className="fluid-inspector-rows">
                      {inspector.rows.map(([label, value]) => (
                        <div key={label} className="fluid-inspector-row">
                          <span>{label}</span>
                          <strong>{value}</strong>
                        </div>
                      ))}
                    </div>
                    {inspector.ports.length > 0 && (
                      <div className="fluid-inspector-ports">
                        <span className="stat-card-label">Porte</span>
                        <div className="fluid-chip-row">
                          {inspector.ports.map((port) => (
                            <span key={port} className="fluid-status-chip">{port}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="fluid-inspector-panel">
                  <div className="section-subtitle">Distinta rapida</div>
                  <div className="fluid-bom-list">
                    {bomItems.length === 0 ? (
                      <p className="section-note">Nessun componente presente nel workspace corrente.</p>
                    ) : (
                      bomItems.map((item) => (
                        <div key={item.componentId} className="fluid-bom-item">
                          <strong>{item.label}</strong>
                          <span>{`${item.quantity} x ${item.category}`}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="fluid-guide-grid">
        <section className="fluid-guide-panel glass">
          <div className="section-subtitle">
            {isStudentMode ? 'Come usarlo per studiare' : 'Uso tecnico rapido'}
          </div>
          <ul className="fluid-guide-list">
            {(isStudentMode ? studentWorkflow : engineeringWorkflow).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="fluid-guide-panel glass">
          <div className="section-subtitle">
            {isStudentMode ? 'Circuiti guida da provare' : 'Controlli rapidi sul circuito'}
          </div>
          <ul className="fluid-guide-list">
            {(isStudentMode ? guidedCircuits : [
              'Verifica il tipo di porta prima di creare collegamenti fluidici o meccanici.',
              'Controlla la posizione del distributore quando il percorso non raggiunge l utilizzatore.',
              'Usa import/export JSON per salvare una configurazione di lavoro o confronto.',
              'Seleziona un collegamento o un componente per leggere i dettagli dell elemento attivo.',
            ]).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
};

export default FluidPowerLabPage;
