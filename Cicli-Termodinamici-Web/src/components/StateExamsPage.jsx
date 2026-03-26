import React, { useDeferredValue, useMemo, useState } from 'react';
import { Download, ExternalLink, FileText, Search } from 'lucide-react';
import { examTopicBadges, stateExams } from '../data/stateExamsData';
import { exportExamToPDF } from '../utils/examPdfExport';

const StateExamsPage = () => {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(stateExams[0]?.id ?? '');
  const [downloadingId, setDownloadingId] = useState(null);
  const deferredQuery = useDeferredValue(query);

  const filteredExams = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    if (!normalized) {
      return stateExams;
    }

    return stateExams.filter((exam) =>
      `${exam.shortTitle} ${exam.headline} ${exam.code} ${exam.year}`.toLowerCase().includes(normalized),
    );
  }, [deferredQuery]);

  const selectedExam = filteredExams.find((exam) => exam.id === selectedId) ?? filteredExams[0] ?? null;

  const handleDownload = async (exam) => {
    setDownloadingId(exam.id);
    try {
      await exportExamToPDF(exam);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <section className="features-section cycle-page">
      <div className="section-header section-header-left">
        <div className="section-badge">Esami di Stato</div>
        <h2 className="section-title">
          Tracce e <span className="accent">svolgimenti dettagliati</span>
        </h2>
        <p className="hero-description section-description">
          Ogni scheda contiene la traccia, le ipotesi di progetto, lo svolgimento guidato, due quesiti svolti e il pulsante per scaricare il PDF completo.
        </p>
      </div>

      <div className="exam-overview glass">
        <div className="exam-overview-copy">
          <div className="section-subtitle">Cosa trovano gli studenti</div>
          <p className="card-description">
            Archivio ordinato per anno, svolgimento ragionato e PDF con traccia + soluzione completa.
          </p>
        </div>
        <div className="tag-row">
          {examTopicBadges.map((badge) => (
            <span key={badge} className="topic-tag">
              {badge}
            </span>
          ))}
        </div>
      </div>

      <div className="exam-layout">
        <aside className="exam-sidebar glass">
          <div className="input-field">
            <label className="input-label" htmlFor="exam-search">Cerca esame</label>
            <div className="search-input-shell">
              <Search size={16} />
              <input
                id="exam-search"
                className="glass-input exam-search-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Es. 2025, LNG, petroliera"
              />
            </div>
          </div>

          <div className="exam-list">
            {filteredExams.map((exam) => (
              <button
                key={exam.id}
                type="button"
                className={`exam-list-item ${selectedExam?.id === exam.id ? 'exam-list-item-active' : ''}`}
                onClick={() => setSelectedId(exam.id)}
              >
                <span className="exam-list-year">{exam.year}</span>
                <strong>{exam.shortTitle}</strong>
                <span>{exam.headline}</span>
              </button>
            ))}
          </div>
        </aside>

        {selectedExam ? (
          <article className="exam-detail glass">
            <div className="exam-detail-header">
              <div>
                <div className="section-badge">{selectedExam.code}</div>
                <h3 className="section-title exam-detail-title">{selectedExam.shortTitle}</h3>
                <p className="card-description exam-detail-description">{selectedExam.headline}</p>
              </div>

              <div className="exam-action-group">
                <a
                  href={selectedExam.sourcePdf}
                  className="btn-outline no-underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={18} />
                  Traccia originale
                </a>
                <button
                  className="btn-primary"
                  onClick={() => handleDownload(selectedExam)}
                  disabled={downloadingId === selectedExam.id}
                >
                  <Download size={18} />
                  {downloadingId === selectedExam.id ? 'Generazione PDF...' : 'Scarica PDF svolto'}
                </button>
              </div>
            </div>

            <section className="exam-block">
              <div className="exam-block-title">
                <FileText size={18} />
                <h4>Traccia sintetica</h4>
              </div>
              {selectedExam.trace.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>

            <section className="exam-block">
              <div className="exam-block-title">
                <h4>Ipotesi adottate</h4>
              </div>
              <ul className="exam-bullet-list">
                {selectedExam.assumptions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section className="exam-block">
              <div className="exam-block-title">
                <h4>Prima parte svolta</h4>
              </div>
              <div className="exam-step-list">
                {selectedExam.firstPart.steps.map((step) => (
                  <div key={step.title} className="exam-step">
                    <h5>{step.title}</h5>
                    {step.body.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                ))}
              </div>
            </section>

            <section className="exam-block">
              <div className="exam-block-title">
                <h4>Risultati finali</h4>
              </div>
              <div className="exam-results-grid">
                {selectedExam.firstPart.results.map((result) => (
                  <div key={result.label} className="exam-result-card">
                    <span>{result.label}</span>
                    <strong>{result.value}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="exam-block">
              <div className="exam-block-title">
                <h4>Schema funzionale essenziale</h4>
              </div>
              <ul className="exam-bullet-list">
                {selectedExam.firstPart.schematic.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section className="exam-block">
              <div className="exam-block-title">
                <h4>Due quesiti svolti</h4>
              </div>
              <div className="exam-question-list">
                {selectedExam.selectedQuestions.map((question) => (
                  <article key={question.code} className="exam-question">
                    <h5>{question.code}) {question.title}</h5>
                    <ul className="exam-bullet-list">
                      {question.points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          </article>
        ) : (
          <div className="exam-detail glass">
            <div className="empty-state">
              <FileText size={42} className="empty-icon" />
              <p>Nessun esame corrisponde alla ricerca inserita.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default StateExamsPage;
