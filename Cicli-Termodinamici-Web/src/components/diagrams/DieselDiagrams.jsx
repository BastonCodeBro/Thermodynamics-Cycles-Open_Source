import { useEffect } from 'react';
import { plotLayout, plotConfig, addTrace, genPvCurve, genTsCurve, genHsCurve } from '../shared/plotConfig';
import { renderPlot, cleanupPlot } from '../../utils/plotly';

const COLOR = '#EF4444';
const K = 1.4;

const pointAnnotations = (points, labels, color = COLOR) =>
  points.map((p, i) => ({
    x: p.x, y: p.y, text: labels[i] || `${i + 1}`,
    showarrow: true, arrowhead: 0, arrowsize: 1, arrowwidth: 1.5, arrowcolor: color,
    ax: 22, ay: -22, font: { color, size: 13, family: 'Inter' },
    bgcolor: '#0F172A', bordercolor: color, borderwidth: 1, borderpad: 4,
  }));

export const useDieselTsDiagram = (results, plotRef) => {
  useEffect(() => {
    const node = plotRef.current;
    if (!results || !node) return;
    const pts = results.points;
    const c12 = genTsCurve(pts[0], pts[1], 'isentropic');
    const c23 = genTsCurve(pts[1], pts[2], 'isobaric');
    const c34 = genTsCurve(pts[2], pts[3], 'isentropic');
    const c41 = genTsCurve(pts[3], pts[0], 'isochoric');
    const data = [
      addTrace(c12.x, c12.y, { color: COLOR, width: 3, mode: 'lines' }),
      addTrace(c23.x, c23.y, { color: '#F97316', width: 3, mode: 'lines' }),
      addTrace(c34.x, c34.y, { color: '#22D3EE', width: 3, mode: 'lines' }),
      addTrace(c41.x, c41.y, { color: '#60A5FA', width: 3, mode: 'lines' }),
      addTrace(pts.map(p => p.s), pts.map(p => p.t), { color: COLOR, mode: 'markers', markerSize: 10 }),
    ];
    const layout = plotLayout('Entropia s (kJ/kg·K)', 'Temperatura T (°C)');
    layout.annotations = pointAnnotations(
      pts.map(p => ({ x: p.s, y: p.t })),
      ['1\nAspiraz.', '2\nCompr.', '3\nCombust.', '4\nEspans.']
    );
    renderPlot(node, data, layout, plotConfig);
    return () => cleanupPlot(node);
  }, [results, plotRef]);
};

export const useDieselPvDiagram = (results, plotRef) => {
  useEffect(() => {
    const node = plotRef.current;
    if (!results || !node) return;
    const pts = results.points;
    const c12 = genPvCurve(pts[0], pts[1], 'isentropic', 60, K);
    const c23 = genPvCurve(pts[1], pts[2], 'isobaric', 60, K);
    const c34 = genPvCurve(pts[2], pts[3], 'isentropic', 60, K);
    const c41 = genPvCurve(pts[3], pts[0], 'isochoric', 60, K);
    const data = [
      addTrace(c12.x, c12.y, { color: '#F87171', width: 3, mode: 'lines' }),
      addTrace(c23.x, c23.y, { color: '#F97316', width: 3, mode: 'lines' }),
      addTrace(c34.x, c34.y, { color: '#22D3EE', width: 3, mode: 'lines' }),
      addTrace(c41.x, c41.y, { color: '#60A5FA', width: 3, mode: 'lines' }),
      addTrace(pts.map(p => p.v), pts.map(p => p.p), { color: '#F87171', mode: 'markers', markerSize: 10 }),
    ];
    const layout = plotLayout('Volume specifico v (m³/kg)', 'Pressione P (bar)');
    layout.annotations = pointAnnotations(
      pts.map(p => ({ x: p.v, y: p.p })),
      ['1', '2', '3', '4']
    );
    renderPlot(node, data, layout, plotConfig);
    return () => cleanupPlot(node);
  }, [results, plotRef]);
};

export const useDieselHsDiagram = (results, plotRef) => {
  useEffect(() => {
    const node = plotRef.current;
    if (!results || !node) return;
    const pts = results.points;
    const c12 = genHsCurve(pts[0], pts[1], 'isentropic');
    const c23 = genHsCurve(pts[1], pts[2], 'isobaric');
    const c34 = genHsCurve(pts[2], pts[3], 'isentropic');
    const c41 = genHsCurve(pts[3], pts[0], 'isochoric');
    const data = [
      addTrace(c12.x, c12.y, { color: COLOR, width: 3, mode: 'lines' }),
      addTrace(c23.x, c23.y, { color: '#F97316', width: 3, mode: 'lines' }),
      addTrace(c34.x, c34.y, { color: '#22D3EE', width: 3, mode: 'lines' }),
      addTrace(c41.x, c41.y, { color: '#60A5FA', width: 3, mode: 'lines' }),
      addTrace(pts.map(p => p.s), pts.map(p => p.h), { color: COLOR, mode: 'markers', markerSize: 10 }),
    ];
    const layout = plotLayout('Entropia s (kJ/kg·K)', 'Entalpia h (kJ/kg)');
    layout.annotations = pointAnnotations(
      pts.map(p => ({ x: p.s, y: p.h })),
      ['1', '2', '3', '4']
    );
    renderPlot(node, data, layout, plotConfig);
    return () => cleanupPlot(node);
  }, [results, plotRef]);
};
