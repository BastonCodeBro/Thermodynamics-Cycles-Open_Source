import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { BookOpenText, FileText, Zap, Flame, Snowflake, RotateCw, Wind, Droplets } from 'lucide-react';
import Layout from './components/Layout';
import Hero from './components/Hero';
import CycleCard from './components/CycleCard';

const RankinePage = React.lazy(() => import('./components/RankinePage'));
const BraytonPage = React.lazy(() => import('./components/BraytonPage'));
const OttoPage = React.lazy(() => import('./components/OttoPage'));
const DieselPage = React.lazy(() => import('./components/DieselPage'));
const RefrigerationPage = React.lazy(() => import('./components/RefrigerationPage'));
const CarnotPage = React.lazy(() => import('./components/CarnotPage'));
const SteamLabPage = React.lazy(() => import('./components/SteamLabPage'));
const FluidPowerLabPage = React.lazy(() => import('./components/FluidPowerLabPage'));
const ThermodynamicCyclesPage = React.lazy(() => import('./components/ThermodynamicCyclesPage'));
const StateExamsPage = React.lazy(() => import('./components/StateExamsPage'));

const learningAreas = [
  {
    title: 'Cicli Termodinamici',
    id: 'cicli-termodinamici',
    description: 'Teoria ordinata, formule guida e collegamenti rapidi a tutti i simulatori del sito.',
    Icon: BookOpenText,
    color: '#38BDF8',
  },
  {
    title: 'Oleodinamica / Pneumatica',
    id: 'impianti-fluidici',
    description: 'Laboratorio interattivo con simboli, componenti reali e circuiti guida da costruire sul canvas.',
    Icon: Droplets,
    color: '#22D3EE',
  },
  {
    title: 'Esami di Stato',
    id: 'esami-di-stato',
    description: 'Archivio completo con tracce, svolgimenti dettagliati e PDF scaricabili per gli studenti.',
    Icon: FileText,
    color: '#F59E0B',
  },
];

const simulators = [
  {
    title: 'Ciclo Rankine',
    id: 'rankine',
    description: 'Il cuore delle centrali a vapore. Analizza vaporizzazione, espansione e condensazione con i dati IAPWS-97.',
    Icon: Flame,
    color: '#38BDF8',
  },
  {
    title: 'Ciclo Brayton',
    id: 'brayton',
    description: 'Turbine a gas e motori aeronautici. Calcola rendimenti con compressore e turbina reali.',
    Icon: Wind,
    color: '#818CF8',
  },
  {
    title: 'Ciclo Otto',
    id: 'otto',
    description: 'Motore a accensione comandata (benzina). Analizza compressione e combustione isocora.',
    Icon: Zap,
    color: '#FCD34D',
  },
  {
    title: 'Ciclo Diesel',
    id: 'diesel',
    description: "Motore a accensione spontanea. Varia il rapporto di combustione e osserva l'effetto sul rendimento.",
    Icon: Flame,
    color: '#EF4444',
  },
  {
    title: 'Ciclo Frigorifero',
    id: 'frigo',
    description: 'Refrigerazione a compressione di vapore con R134a. Calcola COP e capacita frigorifera.',
    Icon: Snowflake,
    color: '#10B981',
  },
  {
    title: 'Ciclo Carnot',
    id: 'carnot',
    description: 'Il ciclo ideale di riferimento. Il rendimento massimo teoricamente raggiungibile tra due temperature.',
    Icon: RotateCw,
    color: '#A78BFA',
  },
  {
    title: 'Laboratorio Vapore',
    id: 'laboratorio-vapore',
    description: 'Porta nel web il flusso avanzato del tool desktop: costruzione manuale stati e percorso su diagrammi.',
    Icon: Flame,
    color: '#38BDF8',
  },
  {
    title: 'Impianti Oleodinamici / Pneumatici',
    id: 'impianti-fluidici',
    description: 'Costruisci circuiti fluidici trascinando utilizzatori, valvole, pompe e compressori in un canvas interattivo.',
    Icon: Droplets,
    color: '#22D3EE',
  },
];

const workflowSteps = [
  {
    label: '1. Spiega',
    description: 'Apri la libreria dei cicli e usa formule, casi tipici e collegamenti ai simulatori.',
  },
  {
    label: '2. Costruisci',
    description: 'Passa al laboratorio fluidico per schemi oleodinamici e pneumatici guidati.',
  },
  {
    label: '3. Verifica',
    description: 'Chiudi il percorso con le tracce ministeriali svolte e il download PDF per la classe.',
  },
];

const teachingHighlights = [
  'Percorso pensato per lezione, esercitazione e ripasso finale.',
  'Materiali leggibili anche da mobile durante studio individuale.',
  'Archivio esami con traccia originale e PDF svolto scaricabile.',
];

const LandingPage = () => (
  <>
    <Hero />
    <section className="features-section home-gateway-section" id="sections">
      <div className="section-header section-header-left">
        <div className="section-badge">Percorso Completo</div>
        <h2 className="section-title">
          Tre aree per <span className="accent">studiare, esercitarsi e ripassare</span>
        </h2>
      </div>
      <div className="cards-grid cards-grid-three">
        {learningAreas.map((area) => (
          <CycleCard key={area.id} {...area} />
        ))}
      </div>
    </section>

    <section className="features-section home-workflow-section">
      <div className="home-workflow-layout glass">
        <div className="home-workflow-copy">
          <div className="section-badge">Metodo</div>
          <h2 className="section-title">
            Un flusso chiaro <span className="accent">per classe e studio autonomo</span>
          </h2>
          <p className="hero-description section-description">
            Il sito e organizzato per accompagnare dalla spiegazione al compito svolto, senza far saltare tra strumenti scollegati.
          </p>
        </div>

        <div className="home-workflow-steps">
          {workflowSteps.map((step) => (
            <article key={step.label} className="home-workflow-step">
              <strong>{step.label}</strong>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>

    <section className="features-section" id="cycles">
      <div className="section-header section-header-left">
        <div className="section-badge">Simulatori e Laboratori</div>
        <h2 className="section-title">
          Strumenti interattivi <span className="accent">gia pronti per la classe</span>
        </h2>
      </div>
      <div className="cards-grid">
        {simulators.map((cycle) => (
          <CycleCard key={cycle.id} {...cycle} />
        ))}
      </div>
    </section>

    <section className="features-section home-highlight-section">
      <div className="home-highlight-panel glass">
        <div className="home-highlight-lead">
          <div className="section-badge">Per i tuoi studenti</div>
          <h2 className="section-title">
            Materiale da usare subito <span className="accent">anche come supporto allo studio</span>
          </h2>
        </div>
        <div className="home-highlight-list">
          {teachingHighlights.map((item) => (
            <div key={item} className="home-highlight-item">
              <span className="hero-pillar-dot" />
              <p>{item}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  </>
);

const NotFoundPage = () => (
  <section className="features-section cycle-page">
    <div className="section-header">
      <div className="section-badge">404</div>
      <h2 className="section-title">Pagina non trovata</h2>
    </div>
  </section>
);

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<LandingPage />} />
        <Route
          path="cicli-termodinamici"
          element={<React.Suspense fallback={null}><ThermodynamicCyclesPage /></React.Suspense>}
        />
        <Route
          path="rankine"
          element={<React.Suspense fallback={null}><RankinePage /></React.Suspense>}
        />
        <Route
          path="brayton"
          element={<React.Suspense fallback={null}><BraytonPage /></React.Suspense>}
        />
        <Route
          path="otto"
          element={<React.Suspense fallback={null}><OttoPage /></React.Suspense>}
        />
        <Route
          path="diesel"
          element={<React.Suspense fallback={null}><DieselPage /></React.Suspense>}
        />
        <Route
          path="frigo"
          element={<React.Suspense fallback={null}><RefrigerationPage /></React.Suspense>}
        />
        <Route
          path="carnot"
          element={<React.Suspense fallback={null}><CarnotPage /></React.Suspense>}
        />
        <Route
          path="laboratorio-vapore"
          element={<React.Suspense fallback={null}><SteamLabPage /></React.Suspense>}
        />
        <Route
          path="impianti-fluidici"
          element={<React.Suspense fallback={null}><FluidPowerLabPage /></React.Suspense>}
        />
        <Route
          path="esami-di-stato"
          element={<React.Suspense fallback={null}><StateExamsPage /></React.Suspense>}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
