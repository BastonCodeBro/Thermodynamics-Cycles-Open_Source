import React from 'react';
import { BookOpen, Flame, Snowflake, Wind } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  simulatorLinks,
  thermodynamicFamilies,
  thermodynamicStudyPath,
} from '../data/thermodynamicLibrary';

const iconByFamily = {
  'gas-power': Wind,
  'external-heat': Flame,
  reversed: Snowflake,
  combined: Flame,
};

const ThermodynamicCyclesPage = () => {
  return (
    <section className="features-section cycle-page">
      <div className="section-header section-header-left">
        <div className="section-badge">Archivio didattico</div>
        <h2 className="section-title">
          Tutti i principali <span className="accent">cicli termodinamici</span>
        </h2>
        <p className="hero-description section-description">
          Una biblioteca ordinata per ripasso, teoria, schemi e collegamento rapido ai simulatori gia presenti nel sito.
        </p>
      </div>

      <div className="library-hero glass">
        <div className="library-hero-copy">
          <div className="section-subtitle">Percorso consigliato</div>
          <div className="study-path-grid">
            {thermodynamicStudyPath.map((item) => (
              <div key={item.title} className="study-path-step">
                <strong>{item.title}</strong>
                <p className="card-description">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="library-hero-panel">
          <div className="section-subtitle">Simulatori disponibili</div>
          <div className="simulator-chip-list">
            {simulatorLinks.map((link) => (
              <Link
                key={link.route}
                to={link.route}
                className="simulator-chip no-underline"
                style={{ '--chip-accent': link.accent }}
              >
                {link.title}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="library-family-list">
        {thermodynamicFamilies.map((family) => {
          const Icon = iconByFamily[family.id] ?? BookOpen;

          return (
            <section key={family.id} className="library-family glass">
              <div className="library-family-header">
                <div className="library-family-title-row">
                  <div
                    className="card-icon-wrapper"
                    style={{ background: `${family.accent}18`, color: family.accent }}
                  >
                    <Icon className="card-icon" />
                  </div>
                  <div>
                    <h3 className="card-title">{family.label}</h3>
                    <p className="card-description">{family.description}</p>
                  </div>
                </div>
              </div>

              <div className="library-cycle-grid">
                {family.cycles.map((cycle) => (
                  <article key={cycle.id} className="library-cycle">
                    <div className="library-cycle-top">
                      <h4>{cycle.title}</h4>
                      {cycle.route && (
                        <Link to={cycle.route} className="library-link no-underline">
                          Apri simulatore
                        </Link>
                      )}
                    </div>
                    <p>{cycle.focus}</p>
                    <div className="library-meta">
                      <span>Uso tipico</span>
                      <strong>{cycle.useCase}</strong>
                    </div>
                    <div className="library-formula">
                      <span>Formula guida</span>
                      <code>{cycle.formula}</code>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
};

export default ThermodynamicCyclesPage;
