import { useEffect } from 'react';
import { plotLayout, plotConfig, addTrace } from '../shared/plotConfig';
import { renderPlot, cleanupPlot } from '../../utils/plotly';

const COLOR = '#A78BFA';

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

export const useCarnotTsDiagram = (results, plotRef) => {
  useEffect(() => {
    const node = plotRef.current;
    if (!results || !node) return;
    const pts = results.points;
    const data = [
      addTrace(
        [...pts.map(p => p.s), pts[0].s],
        [...pts.map(p => p.t), pts[0].t],
        { name: 'Ciclo Carnot', color: COLOR, mode: 'lines+markers', markerSize: 10 }
      ),
    ];
    const layout = plotLayout('Entropia s (kJ/kg·K)', 'Temperatura T (°C)');
    layout.annotations = pointAnnotations(
      pts.map(p => ({ x: p.s, y: p.t })),
      ['1\nIsoT esp.', '2\nAdiab.', '3\nIsoT compr.', '4\nAdiab.']
    );
    renderPlot(node, data, layout, plotConfig);
    return () => cleanupPlot(node);
  }, [results, plotRef]);
};

export const useCarnotPvDiagram = (results, plotRef) => {
  useEffect(() => {
    const node = plotRef.current;
    if (!results || !node) return;
    const pts = results.points;
    const data = [
      addTrace(
        [...pts.map(p => p.v || 0), pts[0].v || 0],
        [...pts.map(p => p.p), pts[0].p],
        { name: 'Ciclo Carnot P-v', color: '#C4B5FD', mode: 'lines+markers', markerSize: 10 }
      ),
    ];
    const layout = plotLayout('Volume specifico v (m³/kg)', 'Pressione P (bar)');
    layout.yaxis.type = 'log';
    layout.annotations = pointAnnotations(
      pts.map(p => ({ x: p.v || 0, y: p.p })),
      ['1', '2', '3', '4']
    );
    renderPlot(node, data, layout, plotConfig);
    return () => cleanupPlot(node);
  }, [results, plotRef]);
};
