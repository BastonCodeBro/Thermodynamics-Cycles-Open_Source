import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { formatValue } from '../../utils/formatNumber';

const KaTeX = ({ math, display = false, color }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      try {
        katex.render(math, ref.current, {
          throwOnError: false,
          displayMode: display,
          output: 'html',
        });
      } catch {
        ref.current.textContent = math;
      }
    }
  }, [math, display]);
  return (
    <span
      ref={ref}
      className={display ? 'katex-display' : 'katex-inline'}
      style={color ? { color } : {}}
    />
  );
};

const FormulasSection = ({ points, formulas, coordTitle = 'Coordinate Termodinamiche', accentColor = '#38BDF8' }) => {
  if (!points || points.length === 0) return null;

  const headers = ['Punto', 'T (\u00B0C)', 'P (bar)', 'h (kJ/kg)', 's (kJ/(kg\u00B7K))', 'v (m\u00B3/kg)'];
  const fmt = (v) => formatValue(v, 'generic');

  return (
    <div className="formulas-section glass">
      <h3 className="formulas-title" style={{ color: accentColor }}>{coordTitle}</h3>
      <div className="coord-table-wrapper">
        <table className="coord-table">
          <thead>
            <tr>
              {headers.map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {points.map((pt, i) => (
              <tr key={i}>
                <td className="coord-point-label" style={{ color: accentColor }}>
                  {pt.label || `${i + 1}`}
                </td>
                <td>{fmt(pt.t)}</td>
                <td>{fmt(pt.p)}</td>
                <td>{fmt(pt.h)}</td>
                <td>{fmt(pt.s)}</td>
                <td>{fmt(pt.v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formulas && formulas.length > 0 && (
        <>
          <h3 className="formulas-title" style={{ color: accentColor, marginTop: '1.5rem' }}>
            Formule di Calcolo
          </h3>
          <div className="formulas-list">
            {formulas.map((f, i) => (
              <div key={i} className="formula-item">
                {f.label && (
                  <span className="formula-label">{f.label}</span>
                )}
                <KaTeX math={f.latex} display={!!f.display} color={accentColor} />
                {f.value !== undefined && (
                  <span className="formula-value">
                    {' = '}
                    {typeof f.value === 'number' ? formatValue(f.value, 'energy') : f.value}
                    {f.unit && ` ${f.unit}`}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export { KaTeX };
export default FormulasSection;
