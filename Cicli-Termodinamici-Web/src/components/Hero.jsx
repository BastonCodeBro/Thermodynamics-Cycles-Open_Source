import React from 'react';
import { ArrowRight, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import heroBg from '../assets/hero-bg.png';

const heroPillars = [
  'Cicli termodinamici con simulatori interattivi',
  'Impianti oleodinamici e pneumatici da costruire sul canvas',
  'Esami di stato svolti con PDF pronti per gli studenti',
];

const heroStats = [
  { value: '3', label: 'Aree didattiche' },
  { value: '8', label: 'Tracce svolte' },
  { value: '7+', label: 'Simulatori attivi' },
];

const Hero = () => {
  const scrollToCycles = () => {
    const el = document.getElementById('sections');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="hero-section">
      <div className="hero-backdrop" />
      <div className="hero-grid" />

      <div className="hero-shell">
        <div className="hero-copy hero-animate-in">
          <div className="hero-brand-row">
            <span className="hero-brand">ThermoHub</span>
            <div className="badge">
              <span className="badge-dot" />
              Piattaforma didattica
            </div>
          </div>

          <h1 className="hero-title">
            Termodinamica, impianti fluidici ed esami di stato
            <span className="gradient-text"> nello stesso spazio di studio</span>
          </h1>

          <p className="hero-description hero-description-wide">
            Un ambiente unico per spiegare i cicli, simulare gli impianti, ripassare le tracce
            ministeriali e consegnare agli studenti PDF gia pronti con svolgimento completo.
          </p>

          <div className="hero-actions">
            <button className="btn-primary" onClick={scrollToCycles}>
              Esplora il sito <ArrowRight className="btn-icon" />
            </button>
            <Link to="/esami-di-stato" className="btn-outline no-underline">
              <FileText size={18} />
              Vai agli esami
            </Link>
          </div>

          <div className="hero-pillars">
            {heroPillars.map((pillar) => (
              <div key={pillar} className="hero-pillar">
                <span className="hero-pillar-dot" />
                <span>{pillar}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="hero-media hero-animate-in-delayed">
          <img
            src={heroBg}
            alt="Turbina con sovrapposizione del ciclo termodinamico"
            className="hero-media-image"
          />
          <div className="hero-media-shade" />
          <div className="hero-media-label hero-media-label-top">Brayton, recupero, diagrammi</div>
          <div className="hero-media-label hero-media-label-bottom">Dalla teoria al compito svolto</div>

          <div className="hero-stat-row">
            {heroStats.map((item) => (
              <div key={item.label} className="hero-stat">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
