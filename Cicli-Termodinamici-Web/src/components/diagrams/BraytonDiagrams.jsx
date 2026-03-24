import { useEffect } from 'react';
import { plotLayout, plotConfig, addTrace } from '../shared/plotConfig';
import { renderPlot, cleanupPlot } from '../../utils/plotly';

const COLOR = '#818CF8';

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

export const useBraytonTsDiagram = (results, plotRef) => {
  useEffect(() => {
    const node = plotRef.current;
    if (!results || !node) return;
    const pts = results.points;
    const data = [
      addTrace(
        [...pts.map(p => p.s), pts[0].s],
        [...pts.map(p => p.t), pts[0].t],
        { name: 'Ciclo Brayton', color: COLOR, mode: 'lines+markers', markerSize: 10 }
      ),
    ];
    if (results.idealPoints) {
      data.push(addTrace(
        [...results.idealPoints.map(p => p.s), results.idealPoints[0].s],
        [...results.idealPoints.map(p => p.t), results.idealPoints[0].t],
        { name: 'Ciclo Ideale', color: '#475569', width: 2, dash: 'dash', mode: 'lines', markerSize: 0 }
      ));
    }
    const layout = plotLayout('Entropia s (kJ/kg·K)', 'Temperatura T (°C)');
    layout.annotations = pointAnnotations(
      pts.map(p => ({ x: p.s, y: p.t })),
      ['1\nAspiraz.', '2\nComp.', '3\nCombust.', '4\nTurbina']
    );
    renderPlot(node, data, layout, plotConfig);
    return () => cleanupPlot(node);
  }, [results, plotRef]);
};

export const useBraytonPvDiagram = (results, plotRef) => {
  useEffect(() => {
    const node = plotRef.current;
    if (!results || !node) return;
    const pts = results.points;
    const data = [
      addTrace(
        [...pts.map(p => p.v), pts[0].v],
        [...pts.map(p => p.p), pts[0].p],
        { name: 'Ciclo Brayton P-v', color: '#A78BFA', mode: 'lines+markers', markerSize: 10 }
      ),
    ];
    if (results.idealPoints) {
      const idealFull = results.idealPoints;
      data.push(addTrace(
        [...idealFull.map(p => p.v || 0), idealFull[0]?.v || 0],
        [...idealFull.map(p => p.p), idealFull[0]?.p],
        { name: 'Ideale P-v', color: '#475569', width: 2, dash: 'dash', mode: 'lines', markerSize: 0 }
      ));
    }
    const layout = plotLayout('Volume specifico v (m³/kg)', 'Pressione P (bar)');
    layout.yaxis.type = 'log';
    layout.annotations = pointAnnotations(
      pts.map(p => ({ x: p.v, y: p.p })),
      ['1', '2', '3', '4']
    );
    renderPlot(node, data, layout, plotConfig);
    return () => cleanupPlot(node);
  }, [results, plotRef]);
};
