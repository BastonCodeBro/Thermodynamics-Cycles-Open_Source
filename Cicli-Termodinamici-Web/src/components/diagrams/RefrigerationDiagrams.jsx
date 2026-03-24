import { useEffect } from 'react';
import { plotLayout, plotConfig, addTrace, addDomeTrace, genTsCurveReal, genPhCurveReal } from '../shared/plotConfig';
import { renderPlot, cleanupPlot } from '../../utils/plotly';

const COLOR = '#10B981';

const pointAnnotations = (points, labels, color = COLOR) =>
  points.map((p, i) => ({
    x: p.x, y: p.y, text: labels[i] || `${i + 1}`,
    showarrow: true, arrowhead: 0, arrowsize: 1, arrowwidth: 1.5, arrowcolor: color,
    ax: 22, ay: -22, font: { color, size: 13, family: 'Inter' },
    bgcolor: '#0F172A', bordercolor: color, borderwidth: 1, borderpad: 4,
  }));

export const useRefrigerationTsDiagram = (results, plotRef) => {
  useEffect(() => {
    const node = plotRef.current;
    if (!results || !node) return;
    const pts = results.points;
    const c12 = genTsCurveReal(pts[0], pts[1]);
    const c23 = genTsCurveReal(pts[1], pts[2]);
    const c34 = genTsCurveReal(pts[2], pts[3]);
    const c41 = genTsCurveReal(pts[3], pts[0]);
    const data = [
      addDomeTrace(results.dome.s, results.dome.t),
      addTrace(c12.x, c12.y, { color: COLOR, width: 3, mode: 'lines' }),
      addTrace(c23.x, c23.y, { color: '#EF4444', width: 3, mode: 'lines' }),
      addTrace(c34.x, c34.y, { color: '#60A5FA', width: 3, mode: 'lines' }),
      addTrace(c41.x, c41.y, { color: '#A78BFA', width: 3, mode: 'lines' }),
      addTrace(pts.map(p => p.s), pts.map(p => p.t), { color: COLOR, mode: 'markers', markerSize: 8 }),
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
    const c12 = genPhCurveReal(pts[0], pts[1]);
    const c23 = genPhCurveReal(pts[1], pts[2]);
    const c34 = genPhCurveReal(pts[2], pts[3]);
    const c41 = genPhCurveReal(pts[3], pts[0]);
    const data = [
      results.domePh ? addDomeTrace(results.domePh.h, results.domePh.p) : null,
      addTrace(c12.x, c12.y, { color: COLOR, width: 3, mode: 'lines' }),
      addTrace(c23.x, c23.y, { color: '#EF4444', width: 3, mode: 'lines' }),
      addTrace(c34.x, c34.y, { color: '#60A5FA', width: 3, mode: 'lines' }),
      addTrace(c41.x, c41.y, { color: '#A78BFA', width: 3, mode: 'lines' }),
      addTrace(pts.map(p => p.h), pts.map(p => p.p), { color: '#34D399', mode: 'markers', markerSize: 8 }),
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
