import { fluidPowerExtendedComponents } from './fluidPowerCatalogExtended';

export const FLUID_POWER_DOMAINS = [
  {
    id: 'hydraulic',
    label: 'Oleodinamica',
    accent: '#F59E0B',
    fluidLabel: 'Olio',
    activeColor: '#F97316',
  },
  {
    id: 'pneumatic',
    label: 'Pneumatica',
    accent: '#38BDF8',
    fluidLabel: 'Aria',
    activeColor: '#22D3EE',
  },
];

export const FLUID_POWER_CATEGORIES = [
  { id: 'utilizzatori', label: 'Utilizzatori' },
  { id: 'valvole-distributrici', label: 'Valvole distributrici' },
  { id: 'alimentazione', label: 'Alimentazione' },
  { id: 'ausiliari', label: 'Ausiliari' },
  { id: 'strumentazione-e-comandi', label: 'Strumentazione e comandi' },
  { id: 'simbologia-base', label: 'Simbologia base' },
];

const makeDirectionalValve = ({
  id,
  domain,
  label,
  description,
  family,
  states,
  returnPorts,
}) => ({
  id,
  domain,
  category: 'valvole-distributrici',
  label,
  description,
  symbol: `directional-${family.replace('/', '-')}`,
  defaultSize: { width: 176, height: 112 },
  ports: [
    { id: 'P', label: 'P', side: 'left', align: 0.5, kind: 'fluid' },
    { id: 'A', label: 'A', side: 'right', align: 0.3, kind: 'fluid' },
    ...(family === '3/2' ? [] : [{ id: 'B', label: 'B', side: 'right', align: 0.72, kind: 'fluid' }]),
    ...returnPorts.map((portId, index) => ({
      id: portId,
      label: portId,
      side: 'bottom',
      align: returnPorts.length === 1 ? 0.5 : index === 0 ? 0.35 : 0.68,
      kind: 'fluid',
    })),
  ],
  simBehavior: {
    kind: 'valve',
    family,
    supplyPort: 'P',
    workPorts: family === '3/2' ? ['A'] : ['A', 'B'],
    returnPorts,
    states,
    defaultState: states[0]?.id ?? null,
  },
});

export const componentCatalog = [
  {
    id: 'hydraulic-single-cylinder',
    domain: 'hydraulic',
    category: 'utilizzatori',
    label: 'Cilindro a singolo effetto',
    description: 'Attuatore lineare con una sola camera alimentata e ritorno elastico.',
    symbol: 'single-cylinder',
    defaultSize: { width: 176, height: 104 },
    ports: [{ id: 'A', label: 'A', side: 'left', align: 0.5, kind: 'fluid' }],
    simBehavior: {
      kind: 'actuator',
      actuatorType: 'single',
      workPorts: ['A'],
    },
  },
  {
    id: 'hydraulic-double-cylinder',
    domain: 'hydraulic',
    category: 'utilizzatori',
    label: 'Cilindro a doppio effetto',
    description: 'Attuatore lineare con due camere e due connessioni di lavoro.',
    symbol: 'double-cylinder',
    defaultSize: { width: 176, height: 104 },
    ports: [
      { id: 'A', label: 'A', side: 'left', align: 0.32, kind: 'fluid' },
      { id: 'B', label: 'B', side: 'right', align: 0.68, kind: 'fluid' },
    ],
    simBehavior: {
      kind: 'actuator',
      actuatorType: 'double',
      workPorts: ['A', 'B'],
    },
  },
  {
    id: 'hydraulic-rotary-motor',
    domain: 'hydraulic',
    category: 'utilizzatori',
    label: 'Motore oleodinamico',
    description: 'Utilizzatore rotativo bidirezionale con due linee di alimentazione.',
    symbol: 'rotary-motor',
    defaultSize: { width: 152, height: 104 },
    ports: [
      { id: 'A', label: 'A', side: 'left', align: 0.34, kind: 'fluid' },
      { id: 'B', label: 'B', side: 'right', align: 0.66, kind: 'fluid' },
    ],
    simBehavior: {
      kind: 'actuator',
      actuatorType: 'rotary',
      workPorts: ['A', 'B'],
    },
  },
  makeDirectionalValve({
    id: 'hydraulic-valve-3-2',
    domain: 'hydraulic',
    label: 'Valvola 3/2 monostabile',
    description: 'Distributore 3/2 con posizione di riposo e posizione attiva.',
    family: '3/2',
    returnPorts: ['R'],
    states: [
      { id: 'riposo', label: 'Riposo', routes: [['A', 'R']] },
      { id: 'attiva', label: 'Attiva', routes: [['P', 'A']] },
    ],
  }),
  makeDirectionalValve({
    id: 'hydraulic-valve-4-2',
    domain: 'hydraulic',
    label: 'Valvola 4/2 bistabile',
    description: 'Distributore 4/2 per attuatori a doppio effetto.',
    family: '4/2',
    returnPorts: ['T'],
    states: [
      { id: 'A+', label: 'Posizione A', routes: [['P', 'A'], ['B', 'T']] },
      { id: 'B+', label: 'Posizione B', routes: [['P', 'B'], ['A', 'T']] },
    ],
  }),
  makeDirectionalValve({
    id: 'hydraulic-valve-5-2',
    domain: 'hydraulic',
    label: 'Valvola 5/2 bistabile',
    description: 'Distributore con scarichi separati e due posizioni stabili.',
    family: '5/2',
    returnPorts: ['R1', 'R2'],
    states: [
      { id: 'A+', label: 'Posizione A', routes: [['P', 'A'], ['B', 'R2']] },
      { id: 'B+', label: 'Posizione B', routes: [['P', 'B'], ['A', 'R1']] },
    ],
  }),
  {
    id: 'hydraulic-pump',
    domain: 'hydraulic',
    category: 'alimentazione',
    label: 'Pompa idraulica',
    description: 'Genera la portata di olio verso il circuito.',
    symbol: 'pump',
    defaultSize: { width: 156, height: 108 },
    ports: [
      { id: 'drive', label: 'Albero', side: 'top', align: 0.5, kind: 'mechanical' },
      { id: 'S', label: 'S', side: 'left', align: 0.5, kind: 'fluid' },
      { id: 'P', label: 'P', side: 'right', align: 0.5, kind: 'fluid' },
    ],
    simBehavior: {
      kind: 'source',
      sourcePort: 'P',
      suctionPort: 'S',
    },
  },
  {
    id: 'hydraulic-prime-mover',
    domain: 'hydraulic',
    category: 'alimentazione',
    label: 'Motore primo',
    description: 'Motore elettrico o endotermico che trascina la pompa.',
    symbol: 'prime-mover',
    defaultSize: { width: 148, height: 96 },
    ports: [{ id: 'shaft', label: 'Albero', side: 'bottom', align: 0.5, kind: 'mechanical' }],
    simBehavior: {
      kind: 'driver',
    },
  },
  {
    id: 'hydraulic-reservoir',
    domain: 'hydraulic',
    category: 'alimentazione',
    label: 'Serbatoio',
    description: 'Raccoglie l’olio di ritorno e alimenta la pompa.',
    symbol: 'reservoir',
    defaultSize: { width: 156, height: 104 },
    ports: [
      { id: 'IN', label: 'T', side: 'top', align: 0.36, kind: 'fluid' },
      { id: 'OUT', label: 'S', side: 'top', align: 0.68, kind: 'fluid' },
    ],
    simBehavior: {
      kind: 'sink',
      sinkPorts: ['IN', 'OUT'],
    },
  },
  {
    id: 'hydraulic-flow-control',
    domain: 'hydraulic',
    category: 'ausiliari',
    label: 'Regolatore di flusso',
    description: 'Regola la portata con effetto didattico sul verso del flusso.',
    symbol: 'flow-control',
    defaultSize: { width: 132, height: 84 },
    ports: [
      { id: 'IN', label: 'IN', side: 'left', align: 0.5, kind: 'fluid' },
      { id: 'OUT', label: 'OUT', side: 'right', align: 0.5, kind: 'fluid' },
    ],
    simBehavior: {
      kind: 'auxiliary',
      passThroughRoutes: [['IN', 'OUT']],
    },
  },
  {
    id: 'hydraulic-check-valve',
    domain: 'hydraulic',
    category: 'ausiliari',
    label: 'Valvola di ritegno',
    description: 'Permette il passaggio in un solo verso nel circuito reale; qui vale come nodo passante.',
    symbol: 'check-valve',
    defaultSize: { width: 132, height: 84 },
    ports: [
      { id: 'IN', label: 'IN', side: 'left', align: 0.5, kind: 'fluid' },
      { id: 'OUT', label: 'OUT', side: 'right', align: 0.5, kind: 'fluid' },
    ],
    simBehavior: {
      kind: 'auxiliary',
      passThroughRoutes: [['IN', 'OUT']],
    },
  },
  {
    id: 'hydraulic-logic-valve',
    domain: 'hydraulic',
    category: 'ausiliari',
    label: 'Valvola logica',
    description: 'Nodo passante usato per rappresentare un comando logico semplificato.',
    symbol: 'logic-valve',
    defaultSize: { width: 132, height: 84 },
    ports: [
      { id: 'IN', label: 'IN', side: 'left', align: 0.5, kind: 'fluid' },
      { id: 'OUT', label: 'OUT', side: 'right', align: 0.5, kind: 'fluid' },
    ],
    simBehavior: {
      kind: 'auxiliary',
      passThroughRoutes: [['IN', 'OUT']],
    },
  },
  {
    id: 'hydraulic-limit-valve',
    domain: 'hydraulic',
    category: 'ausiliari',
    label: 'Finecorsa 3/2',
    description: 'Valvola 3/2 azionata meccanicamente, utile come comando simbolico.',
    symbol: 'limit-valve',
    defaultSize: { width: 160, height: 104 },
    ports: [
      { id: 'P', label: 'P', side: 'left', align: 0.5, kind: 'fluid' },
      { id: 'A', label: 'A', side: 'right', align: 0.35, kind: 'fluid' },
      { id: 'R', label: 'R', side: 'bottom', align: 0.5, kind: 'fluid' },
    ],
    simBehavior: {
      kind: 'valve',
      family: '3/2',
      supplyPort: 'P',
      workPorts: ['A'],
      returnPorts: ['R'],
      states: [
        { id: 'riposo', label: 'Riposo', routes: [['A', 'R']] },
        { id: 'attiva', label: 'Attiva', routes: [['P', 'A']] },
      ],
      defaultState: 'riposo',
    },
  },
  {
    id: 'pneumatic-single-cylinder',
    domain: 'pneumatic',
    category: 'utilizzatori',
    label: 'Cilindro a singolo effetto',
    description: 'Attuatore pneumatico con ritorno a molla.',
    symbol: 'single-cylinder',
    defaultSize: { width: 176, height: 104 },
    ports: [{ id: 'A', label: 'A', side: 'left', align: 0.5, kind: 'fluid' }],
    simBehavior: {
      kind: 'actuator',
      actuatorType: 'single',
      workPorts: ['A'],
    },
  },
  {
    id: 'pneumatic-double-cylinder',
    domain: 'pneumatic',
    category: 'utilizzatori',
    label: 'Cilindro a doppio effetto',
    description: 'Attuatore pneumatico con due camere di lavoro.',
    symbol: 'double-cylinder',
    defaultSize: { width: 176, height: 104 },
    ports: [
      { id: 'A', label: 'A', side: 'left', align: 0.32, kind: 'fluid' },
      { id: 'B', label: 'B', side: 'right', align: 0.68, kind: 'fluid' },
    ],
    simBehavior: {
      kind: 'actuator',
      actuatorType: 'double',
      workPorts: ['A', 'B'],
    },
  },
  {
    id: 'pneumatic-rotary-motor',
    domain: 'pneumatic',
    category: 'utilizzatori',
    label: 'Motore pneumatico',
    description: 'Utilizzatore rotativo pneumatico rappresentato in modo semplificato.',
    symbol: 'rotary-motor',
    defaultSize: { width: 152, height: 104 },
    ports: [
      { id: 'A', label: 'A', side: 'left', align: 0.34, kind: 'fluid' },
      { id: 'B', label: 'B', side: 'right', align: 0.66, kind: 'fluid' },
    ],
    simBehavior: {
      kind: 'actuator',
      actuatorType: 'rotary',
      workPorts: ['A', 'B'],
    },
  },
  makeDirectionalValve({
    id: 'pneumatic-valve-3-2',
    domain: 'pneumatic',
    label: 'Valvola 3/2 monostabile',
    description: 'Distributore 3/2 per cilindri a singolo effetto.',
    family: '3/2',
    returnPorts: ['R'],
    states: [
      { id: 'riposo', label: 'Riposo', routes: [['A', 'R']] },
      { id: 'attiva', label: 'Attiva', routes: [['P', 'A']] },
    ],
  }),
  makeDirectionalValve({
    id: 'pneumatic-valve-4-2',
    domain: 'pneumatic',
    label: 'Valvola 4/2 bistabile',
    description: 'Distributore per il comando di cilindri a doppio effetto.',
    family: '4/2',
    returnPorts: ['R'],
    states: [
      { id: 'A+', label: 'Posizione A', routes: [['P', 'A'], ['B', 'R']] },
      { id: 'B+', label: 'Posizione B', routes: [['P', 'B'], ['A', 'R']] },
    ],
  }),
  makeDirectionalValve({
    id: 'pneumatic-valve-5-2',
    domain: 'pneumatic',
    label: 'Valvola 5/2 bistabile',
    description: 'Distributore con doppio scarico per impianti pneumatici.',
    family: '5/2',
    returnPorts: ['R1', 'R2'],
    states: [
      { id: 'A+', label: 'Posizione A', routes: [['P', 'A'], ['B', 'R2']] },
      { id: 'B+', label: 'Posizione B', routes: [['P', 'B'], ['A', 'R1']] },
    ],
  }),
  {
    id: 'pneumatic-compressor',
    domain: 'pneumatic',
    category: 'alimentazione',
    label: 'Compressore',
    description: 'Sorgente d’aria compressa del circuito.',
    symbol: 'compressor',
    defaultSize: { width: 156, height: 108 },
    ports: [
      { id: 'drive', label: 'Albero', side: 'top', align: 0.5, kind: 'mechanical' },
      { id: 'S', label: 'S', side: 'left', align: 0.5, kind: 'fluid' },
      { id: 'P', label: 'P', side: 'right', align: 0.5, kind: 'fluid' },
    ],
    simBehavior: {
      kind: 'source',
      sourcePort: 'P',
      suctionPort: 'S',
    },
  },
  {
    id: 'pneumatic-prime-mover',
    domain: 'pneumatic',
    category: 'alimentazione',
    label: 'Motore primo',
    description: 'Elemento meccanico di trascinamento del compressore.',
    symbol: 'prime-mover',
    defaultSize: { width: 148, height: 96 },
    ports: [{ id: 'shaft', label: 'Albero', side: 'bottom', align: 0.5, kind: 'mechanical' }],
    simBehavior: {
      kind: 'driver',
    },
  },
  {
    id: 'pneumatic-frl',
    domain: 'pneumatic',
    category: 'alimentazione',
    label: 'Gruppo FRL',
    description: 'Filtro, regolatore e lubrificatore in un blocco unico.',
    symbol: 'frl',
    defaultSize: { width: 160, height: 96 },
    ports: [
      { id: 'IN', label: 'IN', side: 'left', align: 0.5, kind: 'fluid' },
      { id: 'OUT', label: 'OUT', side: 'right', align: 0.5, kind: 'fluid' },
    ],
    simBehavior: {
      kind: 'conditioning',
      passThroughRoutes: [['IN', 'OUT']],
    },
  },
  {
    id: 'pneumatic-exhaust',
    domain: 'pneumatic',
    category: 'alimentazione',
    label: 'Scarico atmosfera',
    description: 'Uscita di scarico dell’aria compressa.',
    symbol: 'exhaust',
    defaultSize: { width: 148, height: 88 },
    ports: [{ id: 'R', label: 'R', side: 'top', align: 0.5, kind: 'fluid' }],
    simBehavior: {
      kind: 'sink',
      sinkPorts: ['R'],
    },
  },
  {
    id: 'pneumatic-flow-control',
    domain: 'pneumatic',
    category: 'ausiliari',
    label: 'Regolatore di flusso',
    description: 'Nodo passante per la regolazione della velocità del cilindro.',
    symbol: 'flow-control',
    defaultSize: { width: 132, height: 84 },
    ports: [
      { id: 'IN', label: 'IN', side: 'left', align: 0.5, kind: 'fluid' },
      { id: 'OUT', label: 'OUT', side: 'right', align: 0.5, kind: 'fluid' },
    ],
    simBehavior: {
      kind: 'auxiliary',
      passThroughRoutes: [['IN', 'OUT']],
    },
  },
  {
    id: 'pneumatic-check-valve',
    domain: 'pneumatic',
    category: 'ausiliari',
    label: 'Valvola di ritegno',
    description: 'Nodo ausiliario passante per le esercitazioni di schema.',
    symbol: 'check-valve',
    defaultSize: { width: 132, height: 84 },
    ports: [
      { id: 'IN', label: 'IN', side: 'left', align: 0.5, kind: 'fluid' },
      { id: 'OUT', label: 'OUT', side: 'right', align: 0.5, kind: 'fluid' },
    ],
    simBehavior: {
      kind: 'auxiliary',
      passThroughRoutes: [['IN', 'OUT']],
    },
  },
  {
    id: 'pneumatic-logic-valve',
    domain: 'pneumatic',
    category: 'ausiliari',
    label: 'Valvola logica',
    description: 'Rappresentazione simbolica di una logica pneumatica semplificata.',
    symbol: 'logic-valve',
    defaultSize: { width: 132, height: 84 },
    ports: [
      { id: 'IN', label: 'IN', side: 'left', align: 0.5, kind: 'fluid' },
      { id: 'OUT', label: 'OUT', side: 'right', align: 0.5, kind: 'fluid' },
    ],
    simBehavior: {
      kind: 'auxiliary',
      passThroughRoutes: [['IN', 'OUT']],
    },
  },
  {
    id: 'pneumatic-limit-valve',
    domain: 'pneumatic',
    category: 'ausiliari',
    label: 'Finecorsa 3/2',
    description: 'Elemento di comando meccanico con logica 3/2.',
    symbol: 'limit-valve',
    defaultSize: { width: 160, height: 104 },
    ports: [
      { id: 'P', label: 'P', side: 'left', align: 0.5, kind: 'fluid' },
      { id: 'A', label: 'A', side: 'right', align: 0.35, kind: 'fluid' },
      { id: 'R', label: 'R', side: 'bottom', align: 0.5, kind: 'fluid' },
    ],
    simBehavior: {
      kind: 'valve',
      family: '3/2',
      supplyPort: 'P',
      workPorts: ['A'],
      returnPorts: ['R'],
      states: [
        { id: 'riposo', label: 'Riposo', routes: [['A', 'R']] },
        { id: 'attiva', label: 'Attiva', routes: [['P', 'A']] },
      ],
      defaultState: 'riposo',
    },
  },
  ...fluidPowerExtendedComponents,
];

const componentCatalogMap = new Map(componentCatalog.map((component) => [component.id, component]));

export const getComponentDefinition = (componentId) => componentCatalogMap.get(componentId) ?? null;

export const getComponentsByDomain = (domain) =>
  componentCatalog.filter((component) => component.domain === domain);

export const createInitialNodeState = (componentOrId) => {
  const component =
    typeof componentOrId === 'string' ? getComponentDefinition(componentOrId) : componentOrId;

  if (!component) {
    return {};
  }

  if (component.simBehavior.kind === 'valve') {
    return {
      currentState:
        component.simBehavior.defaultState ?? component.simBehavior.states?.[0]?.id ?? null,
    };
  }

  return {};
};
