import React from 'react';
import { ArrowRight } from 'lucide-react';

const Hero = () => {
  const scrollToCycles = () => {
    const el = document.getElementById('cycles');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="hero-section">
      <div className="hero-glow" />
      <div className="hero-glow-2" />

      <div className="hero-content hero-enter">
        <div className="badge">
          <span className="badge-dot" />
          Simulatore Interattivo
        </div>

        <h1 className="hero-title">
          Cicli<br />
          <span className="gradient-text">Termodinamici</span>
        </h1>

        <p className="hero-description">
          Esplora, calcola e visualizza i principali cicli termodinamici con proprietà
          fluido accurate (IAPWS-97, CoolProp) e diagrammi interattivi.
        </p>

        <div className="hero-actions">
          <button className="btn-primary" onClick={scrollToCycles}>
            Inizia Ora <ArrowRight className="btn-icon" />
          </button>
          <a href="https://github.com/anomalyco/opencode" className="btn-outline" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </div>
      </div>
    </section>
  );
};

export default Hero;
