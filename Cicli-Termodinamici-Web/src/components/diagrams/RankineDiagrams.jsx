import { useEffect } from 'react';
import { plotLayout, plotConfig, addTrace, addDomeTrace } from '../shared/plotConfig';
import { renderPlot, cleanupPlot } from '../../utils/plotly';

const COLOR = '#38BDF8';

const pointAnnotations = (points, labels) =>
  points.map((p, i) => ({
    x: p.x,
    y: p.y,
    text: labels[i] || `${i + 1}`,
    showarrow: true,
    arrowhead: 0,
    arrowsize: 1,
    arrowwidth: 1.5,
    arrowcolor: COLOR,
    ax: 20,
    ay: -20,
    font: { color: COLOR, size: 13, family: 'Inter' },
    bgcolor: '#0F172A',
    bordercolor: COLOR,
    borderwidth: 1,
    borderpad: 4,
  }));

export const useRankineTsDiagram = (results, plotRef) => {
  useEffect(() => {
    const node = plotRef.current;
    if (!results || !node) return;
    const pts = results.points;
    const data = [
      addDomeTrace(results.dome.s, results.dome.t),
      addTrace(
        [...pts.map(p => p.s), pts[0].s],
        [...pts.map(p => p.t), pts[0].t],
        { name: 'Ciclo Rankine', color: COLOR, mode: 'lines+markers', markerSize: 10 }
      ),
    ];
    const layout = plotLayout('Entropia s (kJ/kg·K)', 'Temperatura T (°C)');
    layout.annotations = pointAnnotations(
      pts.map(p => ({ x: p.s, y: p.t })),
      ['1\nSaturaz.', '2\nPompa', '3\nCaldaia', '4\nTurbina']
    );
    renderPlot(node, data, { ...layout }, plotConfig);
    return () => cleanupPlot(node);
  }, [results, plotRef]);
};

export const useRankineHsDiagram = (results, plotRef) => {
  useEffect(() => {
    const node = plotRef.current;
    if (!results || !node) return;
    const pts = results.points;
    const data = [
      results.domeHs ? addDomeTrace(results.domeHs.s, results.domeHs.h) : null,
      addTrace(
        [...pts.map(p => p.s), pts[0].s],
        [...pts.map(p => p.h), pts[0].h],
        { name: 'Ciclo Rankine h-s', color: '#38BDF8', mode: 'lines+markers', markerSize: 10 }
      ),
    ].filter(Boolean);
    const layout = plotLayout('Entropia s (kJ/kg·K)', 'Entalpia h (kJ/kg)');
    layout.annotations = pointAnnotations(
      pts.map(p => ({ x: p.s, y: p.h })),
      ['1', '2', '3', '4']
    );
    renderPlot(node, data, layout, plotConfig);
    return () => cleanupPlot(node);
  }, [results, plotRef]);
};

export const useRankinePvDiagram = (results, plotRef) => {
  useEffect(() => {
    const node = plotRef.current;
    if (!results || !node) return;
    const pts = results.points;
    const vData = pts.map(p => p.v);
    const pData = pts.map(p => p.p);
    const data = [
      addTrace(
        [...vData, vData[0]],
        [...pData, pData[0]],
        { name: 'Ciclo Rankine P-v', color: '#60A5FA', mode: 'lines+markers', markerSize: 10 }
      ),
    ];
    const layout = plotLayout('Volume specifico v (m³/kg)', 'Pressione P (bar)');
    layout.yaxis.type = 'log';
    layout.annotations = pointAnnotations(
      pts.map((p) => ({ x: p.v, y: p.p })),
      ['1', '2', '3', '4']
    );
    renderPlot(node, data, layout, plotConfig);
    return () => cleanupPlot(node);
  }, [results, plotRef]);
};
