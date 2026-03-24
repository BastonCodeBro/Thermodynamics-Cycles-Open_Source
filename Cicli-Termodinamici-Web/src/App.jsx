import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Hero from './components/Hero';
import CycleCard from './components/CycleCard';
import { Zap, Flame, Snowflake, RotateCw, Wind } from 'lucide-react';

const RankinePage = React.lazy(() => import('./components/RankinePage'));
const BraytonPage = React.lazy(() => import('./components/BraytonPage'));
const OttoPage = React.lazy(() => import('./components/OttoPage'));
const DieselPage = React.lazy(() => import('./components/DieselPage'));
const RefrigerationPage = React.lazy(() => import('./components/RefrigerationPage'));
const CarnotPage = React.lazy(() => import('./components/CarnotPage'));

const cycles = [
  {
    title: "Ciclo Rankine",
    id: "rankine",
    description: "Il cuore delle centrali a vapore. Analizza vaporizzazione, espansione e condensazione con i dati IAPWS-97.",
    Icon: Flame,
    color: '#38BDF8',
  },
  {
    title: "Ciclo Brayton",
    id: "brayton",
    description: "Turbine a gas e motori aeronautici. Calcola rendimenti con compressore e turbina reali.",
    Icon: Wind,
    color: '#818CF8',
  },
  {
    title: "Ciclo Otto",
    id: "otto",
    description: "Motore a accensione comandata (benzina). Analizza compressione e combustione isocora.",
    Icon: Zap,
    color: '#FCD34D',
  },
  {
    title: "Ciclo Diesel",
    id: "diesel",
    description: "Motore a accensione spontanea. Varia il rapporto di combustione e osserva l'effetto sul rendimento.",
    Icon: Flame,
    color: '#EF4444',
  },
  {
    title: "Ciclo Frigorifero",
    id: "frigo",
    description: "Refrigerazione a compressione di vapore con R134a. Calcola COP e capacità frigorifera.",
    Icon: Snowflake,
    color: '#10B981',
  },
  {
    title: "Ciclo Carnot",
    id: "carnot",
    description: "Il ciclo ideale di riferimento. Il rendimento massimo teoricamente raggiungibile tra due temperature.",
    Icon: RotateCw,
    color: '#A78BFA',
  },
];

const LandingPage = () => (
  <>
    <Hero />
    <section className="features-section" id="cycles">
      <div className="section-header">
        <div className="section-badge">Esplora i Cicli</div>
        <h2 className="section-title">
          L&apos;intera Termodinamica <br />
          <span className="accent">a portata di click</span>.
        </h2>
      </div>
      <div className="cards-grid">
        {cycles.map((cycle) => (
          <CycleCard key={cycle.id} {...cycle} />
        ))}
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
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
