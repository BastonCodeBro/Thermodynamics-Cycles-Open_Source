import React from 'react';
import { Play, RotateCcw, AlertCircle, Loader2, Download } from 'lucide-react';

const CyclePageLayout = ({
  badge,
  title,
  titleAccent,
  accentColor = '#38BDF8',
  loading,
  error,
  results,
  onCalculate,
  canCalculate = true,
  stats,
  children,
  EmptyIcon = RotateCcw,
  emptyText = 'Inserisci i parametri e clicca su "Esegui Calcolo"',
  diagramTabs,
  formulasSection,
  onDownloadPDF,
  downloadingPDF,
}) => {
  return (
    <div className="features-section cycle-page">
      <div className="section-header">
        <div className="section-badge">{badge}</div>
        <h2 className="section-title">
          {title} <span style={{ color: accentColor }}>{titleAccent}</span>
        </h2>
      </div>

      <div className="cycle-layout">
        <div className="cycle-inputs glass">
          {children}
          <button
            disabled={loading || !canCalculate}
            onClick={onCalculate}
            className="btn-primary w-full justify-center"
            style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}CC)` }}
            aria-disabled={loading || !canCalculate}
          >
            {loading ? <Loader2 className="animate-spin" /> : <Play size={18} />}
            Esegui Calcolo
          </button>
        </div>

        <div className="cycle-results">
          {error && (
            <div className="error-banner">
              <AlertCircle size={18} />
              <p>{error}</p>
            </div>
          )}
          {results ? (
            <div className="results-grid">
              {diagramTabs && (
                <div className="glass diagram-tabs-wrapper">
                  <div className="diagram-tabs-bar">
                    {diagramTabs.map((tab, i) => (
                      <button
                        key={tab.id || i}
                        className={`diagram-tab ${tab.active ? 'diagram-tab-active' : ''}`}
                        onClick={tab.onClick}
                        style={tab.active ? { borderColor: accentColor, color: accentColor } : {}}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <div className="diagram-tab-content">
                    {diagramTabs.map((tab, i) => (
                      <div
                        key={tab.id || i}
                        className={tab.active ? 'diagram-panel-active' : 'diagram-panel-hidden'}
                      >
                        {tab.content}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {stats}
            </div>
          ) : (
            <div className="empty-state glass">
              <EmptyIcon size={48} className="empty-icon" />
              <p>{emptyText}</p>
            </div>
          )}
        </div>
      </div>

      {results && formulasSection && (
        <div className="formulas-section-wrapper">
          {formulasSection}
        </div>
      )}

      {results && onDownloadPDF && (
        <div className="pdf-download-wrapper">
          <button
            onClick={onDownloadPDF}
            disabled={downloadingPDF}
            className="btn-primary btn-pdf-download"
            style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}CC)` }}
          >
            {downloadingPDF ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
            {downloadingPDF ? 'Generazione PDF...' : 'Scarica PDF'}
          </button>
        </div>
      )}
    </div>
  );
};

export default CyclePageLayout;
