import { useEffect } from 'react';
import { plotLayout, plotConfig, addTrace, addDomeTrace } from '../shared/plotConfig';
import { renderPlot, cleanupPlot } from '../../utils/plotly';

const COLOR = '#10B981';

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

export const useRefrigerationTsDiagram = (results, plotRef) => {
  useEffect(() => {
    const node = plotRef.current;
    if (!results || !node) return;
    const pts = results.points;
    const data = [
      addDomeTrace(results.dome.s, results.dome.t),
      addTrace(
        [...pts.map(p => p.s), pts[0].s],
        [...pts.map(p => p.t), pts[0].t],
        { name: 'Ciclo Frigorifero', color: COLOR, mode: 'lines+markers', markerSize: 8 }
      ),
    ];
    const layout = plotLayout('Entropia s (kJ/kg·K)', 'Temperatura T (°C)');
    layout.annotations = pointAnnotations(
      pts.map(p => ({ x: p.s, y: p.t })),
      ['1\nEvap.', '2\nComp.', '3\nCond.', '4\nValv.']
    );
    renderPlot(node, data, layout, plotConfig);
    return () => cleanupPlot(node);
  }, [results, plotRef]);
};

export const useRefrigerationPhDiagram = (results, plotRef) => {
  useEffect(() => {
    const node = plotRef.current;
    if (!results || !node) return;
    const pts = results.points;
    const data = [
      results.domePh ? addDomeTrace(results.domePh.h, results.domePh.p) : null,
      addTrace(
        [...pts.map(p => p.h), pts[0].h],
        [...pts.map(p => p.p), pts[0].p],
        { name: 'Ciclo Frigorifero P-h', color: '#34D399', mode: 'lines+markers', markerSize: 8 }
      ),
    ].filter(Boolean);
    const layout = plotLayout('Entalpia h (kJ/kg)', 'Pressione P (bar)');
    layout.yaxis.type = 'log';
    layout.annotations = pointAnnotations(
      pts.map(p => ({ x: p.h, y: p.p })),
      ['1', '2', '3', '4']
    );
    renderPlot(node, data, layout, plotConfig);
    return () => cleanupPlot(node);
  }, [results, plotRef]);
};
