import { useEffect } from 'react';
import { plotLayout, plotConfig, addTrace, genPvCurve, genTsCurve, genHsCurve } from '../shared/plotConfig';
import { renderPlot, cleanupPlot } from '../../utils/plotly';

const COLOR = '#818CF8';
const K_A = 1.4;
const K_G = 1.33;

const pointAnnotations = (points, labels, color = COLOR) =>
  points.map((p, i) => ({
    x: p.x, y: p.y, text: labels[i] || `${i + 1}`,
    showarrow: true, arrowhead: 0, arrowsize: 1, arrowwidth: 1.5, arrowcolor: color,
    ax: 22, ay: -22, font: { color, size: 13, family: 'Inter' },
    bgcolor: '#0F172A', bordercolor: color, borderwidth: 1, borderpad: 4,
  }));

export const useBraytonTsDiagram = (results, plotRef) => {
  useEffect(() => {
    const node = plotRef.current;
    if (!results || !node) return;
    const pts = results.points;
    const c12 = genTsCurve(pts[0], pts[1], 'isentropic');
    const c23 = genTsCurve(pts[1], pts[2], 'isobaric');
    const c34 = genTsCurve(pts[2], pts[3], 'isentropic');
    const c41 = genTsCurve(pts[3], pts[0], 'isobaric');
    const data = [
      addTrace(c12.x, c12.y, { color: COLOR, width: 3, mode: 'lines' }),
      addTrace(c23.x, c23.y, { color: '#F97316', width: 3, mode: 'lines' }),
      addTrace(c34.x, c34.y, { color: '#22D3EE', width: 3, mode: 'lines' }),
      addTrace(c41.x, c41.y, { color: '#60A5FA', width: 3, mode: 'lines' }),
      addTrace(pts.map(p => p.s), pts.map(p => p.t), { color: COLOR, mode: 'markers', markerSize: 10 }),
    ];
    if (results.idealPoints) {
      const ip = results.idealPoints;
      const ic12 = genTsCurve(ip[0], ip[1], 'isentropic');
      const ic23 = genTsCurve(ip[1], ip[2], 'isobaric');
      const ic34 = genTsCurve(ip[2], ip[3], 'isentropic');
      const ic41 = genTsCurve(ip[3], ip[0], 'isobaric');
      data.push(
        addTrace(ic12.x, ic12.y, { color: '#475569', width: 2, dash: 'dash', mode: 'lines' }),
        addTrace(ic23.x, ic23.y, { color: '#475569', width: 2, dash: 'dash', mode: 'lines' }),
        addTrace(ic34.x, ic34.y, { color: '#475569', width: 2, dash: 'dash', mode: 'lines' }),
        addTrace(ic41.x, ic41.y, { color: '#475569', width: 2, dash: 'dash', mode: 'lines' }),
      );
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
    const c12 = genPvCurve(pts[0], pts[1], 'isentropic', 60, K_A);
    const c23 = genPvCurve(pts[1], pts[2], 'isobaric', 60, K_A);
    const c34 = genPvCurve(pts[2], pts[3], 'isentropic', 60, K_G);
    const c41 = genPvCurve(pts[3], pts[0], 'isobaric', 60, K_G);
    const data = [
      addTrace(c12.x, c12.y, { color: '#A78BFA', width: 3, mode: 'lines' }),
      addTrace(c23.x, c23.y, { color: '#F97316', width: 3, mode: 'lines' }),
      addTrace(c34.x, c34.y, { color: '#22D3EE', width: 3, mode: 'lines' }),
      addTrace(c41.x, c41.y, { color: '#60A5FA', width: 3, mode: 'lines' }),
      addTrace(pts.map(p => p.v), pts.map(p => p.p), { color: '#A78BFA', mode: 'markers', markerSize: 10 }),
    ];
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

export const useBraytonHsDiagram = (results, plotRef) => {
  useEffect(() => {
    const node = plotRef.current;
    if (!results || !node) return;
    const pts = results.points;
    const c12 = genHsCurve(pts[0], pts[1], 'isentropic');
    const c23 = genHsCurve(pts[1], pts[2], 'isobaric');
    const c34 = genHsCurve(pts[2], pts[3], 'isentropic');
    const c41 = genHsCurve(pts[3], pts[0], 'isobaric');
    const data = [
      addTrace(c12.x, c12.y, { color: COLOR, width: 3, mode: 'lines' }),
      addTrace(c23.x, c23.y, { color: '#F97316', width: 3, mode: 'lines' }),
      addTrace(c34.x, c34.y, { color: '#22D3EE', width: 3, mode: 'lines' }),
      addTrace(c41.x, c41.y, { color: '#60A5FA', width: 3, mode: 'lines' }),
      addTrace(pts.map(p => p.s), pts.map(p => p.h), { color: COLOR, mode: 'markers', markerSize: 10 }),
    ];
    if (results.idealPoints) {
      const ip = results.idealPoints;
      const ic12 = genHsCurve(ip[0], ip[1], 'isentropic');
      const ic23 = genHsCurve(ip[1], ip[2], 'isobaric');
      const ic34 = genHsCurve(ip[2], ip[3], 'isentropic');
      const ic41 = genHsCurve(ip[3], ip[0], 'isobaric');
      data.push(
        addTrace(ic12.x, ic12.y, { color: '#475569', width: 2, dash: 'dash', mode: 'lines' }),
        addTrace(ic23.x, ic23.y, { color: '#475569', width: 2, dash: 'dash', mode: 'lines' }),
        addTrace(ic34.x, ic34.y, { color: '#475569', width: 2, dash: 'dash', mode: 'lines' }),
        addTrace(ic41.x, ic41.y, { color: '#475569', width: 2, dash: 'dash', mode: 'lines' }),
      );
    }
    const layout = plotLayout('Entropia s (kJ/kg·K)', 'Entalpia h (kJ/kg)');
    layout.annotations = pointAnnotations(
      pts.map(p => ({ x: p.s, y: p.h })),
      ['1', '2', '3', '4']
    );
    renderPlot(node, data, layout, plotConfig);
    return () => cleanupPlot(node);
  }, [results, plotRef]);
};
