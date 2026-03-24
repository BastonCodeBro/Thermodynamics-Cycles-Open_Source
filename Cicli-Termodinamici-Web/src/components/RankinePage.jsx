import { useState, useEffect, useRef, useCallback } from 'react';
import { solveFluid, getSaturationDomeFull } from '../utils/waterProps';
import { generateProcessPath } from '../utils/processPath';
import { Flame } from 'lucide-react';
import CyclePageLayout from './shared/CyclePageLayout';
import InputField from './shared/InputField';
import StatCard from './shared/StatCard';
import FormulasSection from './shared/FormulasSection';
import SchematicDiagram from './shared/SchematicDiagram';
import { exportToPDF } from '../utils/pdfExport';
import { plotLayout, plotConfig, addTrace, addDomeTrace } from './shared/plotConfig';
import { renderPlot, cleanupPlot } from '../utils/plotly';

const COLOR = '#38BDF8';
const SEGMENT_COLORS = ['#38BDF8', '#EF4444', '#22D3EE', '#60A5FA'];
const isFiniteNumber = (value) => Number.isFinite(value);

const pointAnnotations = (pts, labels, color) =>
  pts.map((p, i) => ({
    x: p.x, y: p.y,
    text: labels[i] || `${i + 1}`,
    showarrow: true, arrowhead: 0, arrowsize: 1, arrowwidth: 1.5, arrowcolor: color,
    ax: 22, ay: -22,
    font: { color, size: 13, family: 'Inter' },
    bgcolor: '#0F172A', bordercolor: color, borderwidth: 1, borderpad: 4,
  }));

const RankinePage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  const tsRef = useRef(null);
  const hsRef = useRef(null);
  const pvRef = useRef(null);
  const schematicRef = useRef(null);

  const [inputs, setInputs] = useState({
    p_high: 100, p_low: 0.1, t_max: 500, eta_t: 0.85, eta_p: 0.85, mass_flow: 1.0,
  });

  const nodeRef = activeTab === 0 ? tsRef : activeTab === 1 ? hsRef : pvRef;

  useEffect(() => {
    const node = nodeRef.current;
    if (!results || !node) return;

    const paths = results.segmentPaths;
    const renderActivePlot = () => {
      if (!paths || paths.length !== 4) return;
      if (activeTab === 0) {
        const data = [
          addDomeTrace(results.dome.s, results.dome.t),
          ...paths.map((path, k) =>
            addTrace(path.map(p => p.s), path.map(p => p.t), {
              name: `Tratto ${k + 1}`,
              color: SEGMENT_COLORS[k],
              width: 3,
              mode: 'lines',
            })
          ),
          addTrace(results.allPoints.map(p => p.s), results.allPoints.map(p => p.t), {
            name: 'Stati',
            color: COLOR,
            mode: 'markers',
            markerSize: 10,
          }),
        ];
        const layout = plotLayout('Entropia s (kJ/kg·K)', 'Temperatura T (°C)');
        layout.annotations = pointAnnotations(
          results.allPoints.map(p => ({ x: p.s, y: p.t })),
          ['1\nSaturaz.', '2\nPompa', '3\nCaldaia', '4\nTurbina'],
          COLOR
        );
        renderPlot(node, data, layout, plotConfig);
      } else if (activeTab === 1) {
        const data = [
          results.domeHs ? addDomeTrace(results.domeHs.s, results.domeHs.h) : null,
          ...paths.map((path, k) =>
            addTrace(path.map(p => p.s), path.map(p => p.h), {
              name: `Tratto ${k + 1}`,
              color: SEGMENT_COLORS[k],
              width: 3,
              mode: 'lines',
            })
          ),
          addTrace(results.allPoints.map(p => p.s), results.allPoints.map(p => p.h), {
            name: 'Stati',
            color: COLOR,
            mode: 'markers',
            markerSize: 10,
          }),
        ].filter(Boolean);
        const layout = plotLayout('Entropia s (kJ/kg·K)', 'Entalpia h (kJ/kg)');
        layout.annotations = pointAnnotations(
          results.allPoints.map(p => ({ x: p.s, y: p.h })),
          ['1', '2', '3', '4'],
          COLOR
        );
        renderPlot(node, data, layout, plotConfig);
      } else if (activeTab === 2) {
        const data = [
          ...paths.map((path, k) =>
            addTrace(path.map(p => p.v), path.map(p => p.p), {
              name: `Tratto ${k + 1}`,
              color: SEGMENT_COLORS[k],
              width: 3,
              mode: 'lines',
            })
          ),
          addTrace(results.allPoints.map(p => p.v), results.allPoints.map(p => p.p), {
            name: 'Stati',
            color: '#60A5FA',
            mode: 'markers',
            markerSize: 10,
          }),
        ];
        const layout = plotLayout('Volume specifico v (m³/kg)', 'Pressione P (bar)');
        layout.yaxis.type = 'log';
        layout.annotations = pointAnnotations(
          results.allPoints.map(p => ({ x: p.v, y: p.p })),
          ['1', '2', '3', '4'],
          COLOR
        );
        renderPlot(node, data, layout, plotConfig);
      }
    };

    renderActivePlot();
    return () => cleanupPlot(node);
  }, [results, activeTab, nodeRef]);

  const canCalculate = isFiniteNumber(inputs.p_high)
    && isFiniteNumber(inputs.p_low)
    && isFiniteNumber(inputs.t_max)
    && isFiniteNumber(inputs.eta_t)
    && isFiniteNumber(inputs.eta_p)
    && isFiniteNumber(inputs.mass_flow)
    && inputs.p_high > inputs.p_low
    && inputs.p_low > 0
    && inputs.eta_t > 0 && inputs.eta_t <= 1
    && inputs.eta_p > 0 && inputs.eta_p <= 1
    && inputs.mass_flow > 0;

  const calculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const st1 = await solveFluid({ p: inputs.p_low, q: 0 });
      const st2s = await solveFluid({ p: inputs.p_high, s: st1.s });
      const h2r = st1.h + (st2s.h - st1.h) / inputs.eta_p;
      const st2 = await solveFluid({ p: inputs.p_high, h: h2r });
      const st3 = await solveFluid({ p: inputs.p_high, t: inputs.t_max });
      const st4s = await solveFluid({ p: inputs.p_low, s: st3.s });
      const h4r = st3.h - (st3.h - st4s.h) * inputs.eta_t;
      const st4 = await solveFluid({ p: inputs.p_low, h: h4r });

      const wt = st3.h - st4.h;
      const wp = st2.h - st1.h;
      const q_in = st3.h - st2.h;
      const w_net = wt - wp;
      const q_out = q_in - w_net;

      const domeFull = await getSaturationDomeFull();
      const segmentPaths = await Promise.all([
        generateProcessPath(st1, st2, 'Water'),
        generateProcessPath(st2, st3, 'Water'),
        generateProcessPath(st3, st4, 'Water'),
        generateProcessPath(st4, st1, 'Water'),
      ]);

      setResults({
        allPoints: [st1, st2, st3, st4],
        segmentPaths,
        stats: { wt, wp, q_in, q_out, eta: (w_net / q_in) * 100, power: w_net * inputs.mass_flow },
        dome: domeFull.ts,
        domeHs: domeFull.hs,
      });
    } catch (err) {
      setError('Errore nel calcolo: verificare i parametri di ingresso.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = useCallback(async () => {
    if (!results) return;
    setDownloadingPDF(true);
    try {
      await exportToPDF({
        title: 'Rankine',
        accentColor: COLOR,
        inputs,
        stats: results.stats,
        points: results.allPoints.map((p, i) => ({
          label: ['1: Saturaz.', '2: Pompa', '3: Caldaia', '4: Turbina'][i],
          t: p.t, p: p.p, h: p.h, s: p.s, v: p.v,
        })),
        formulas: [
          { label: 'Lavoro Turbina', latex: 'w_t = h_3 - h_4', value: results.stats.wt },
          { label: 'Lavoro Pompa', latex: 'w_p = h_2 - h_1', value: results.stats.wp },
          { label: 'Calore Ingresso', latex: 'q_{in} = h_3 - h_2', value: results.stats.q_in },
          { label: 'Rendimento', latex: '\\eta = \\frac{w_t - w_p}{q_{in}}', value: results.stats.eta },
          { label: 'Punto 2 (uscita pompa reale)', latex: 'h_2 = h_1 + \\frac{h_{2s} - h_1}{\\eta_p}' },
          { label: 'Punto 4 (uscita turbina reale)', latex: 'h_4 = h_3 - \\eta_t (h_3 - h_{4s})' },
        ],
        plotRefs: { ts: tsRef, hs: hsRef, pv: pvRef },
        schematicRef,
      });
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setDownloadingPDF(false);
    }
  }, [results, inputs]);

  const diagramTabs = results ? [
    { id: 'ts', label: 'T-s', active: activeTab === 0, onClick: () => setActiveTab(0),
      content: <div ref={tsRef} className="plot-area" /> },
    { id: 'hs', label: 'h-s (Mollier)', active: activeTab === 1, onClick: () => setActiveTab(1),
      content: <div ref={hsRef} className="plot-area" /> },
    { id: 'pv', label: 'P-v', active: activeTab === 2, onClick: () => setActiveTab(2),
      content: <div ref={pvRef} className="plot-area" /> },
    { id: 'schema', label: 'Schema', active: activeTab === 3, onClick: () => setActiveTab(3),
      content: <div ref={schematicRef}><SchematicDiagram type="rankine" accentColor={COLOR} /></div> },
  ] : null;

  const formulasSection = results ? (
    <FormulasSection
      accentColor={COLOR}
      points={results.allPoints.map((p, i) => ({
        label: ['1: Sat.', '2: Pompa', '3: Caldaia', '4: Turb.'][i],
        t: p.t, p: p.p, h: p.h, s: p.s, v: p.v,
      }))}
      formulas={[
        { label: 'Punto 1 — Uscita condensatore (sat. liquido)', latex: 'P_1 = P_{low}, \\quad x_1 = 0' },
        { label: 'Punto 2 — Uscita pompa (reale)', latex: 'h_2 = h_1 + \\frac{h_{2s} - h_1}{\\eta_p}, \\quad s_2 \\approx s_1' },
        { label: 'Punto 3 — Uscita caldaia', latex: 'P_3 = P_{high}, \\quad T_3 = T_{max}' },
        { label: 'Punto 4 — Uscita turbina (reale)', latex: 'h_4 = h_3 - \\eta_t(h_3 - h_{4s}), \\quad s_4 \\approx s_3' },
        { label: 'Lavoro Turbina', latex: 'w_t = h_3 - h_4', value: results.stats.wt },
        { label: 'Lavoro Pompa', latex: 'w_p = h_2 - h_1', value: results.stats.wp },
        { label: 'Calore Ingresso', latex: 'q_{in} = h_3 - h_2', value: results.stats.q_in },
        { label: 'Rendimento Ciclo', latex: '\\eta = \\frac{w_t - w_p}{q_{in}} \\times 100', value: results.stats.eta, display: true },
        { label: 'Potenza Netta', latex: '\\dot{W}_{net} = \\dot{m} \\cdot (w_t - w_p)', value: results.stats.power },
      ]}
    />
  ) : null;

  const stats = results ? (
    <div className="stats-row">
      <StatCard label="Rendimento" value={`${results.stats.eta.toFixed(2)}%`} accent color={COLOR} />
      <StatCard label="Potenza Netta" value={`${(results.stats.power / 1000).toFixed(2)} MW`} />
      <StatCard label="Lavoro Turbina" value={`${results.stats.wt.toFixed(1)} kJ/kg`} />
      <StatCard label="Calore Fornito" value={`${results.stats.q_in.toFixed(1)} kJ/kg`} />
    </div>
  ) : null;

  return (
    <CyclePageLayout
      badge="Ciclo a Vapore"
      title="Ciclo"
      titleAccent="Rankine"
      accentColor={COLOR}
      loading={loading}
      error={error}
      results={results}
      onCalculate={calculate}
      canCalculate={canCalculate}
      stats={stats}
      diagramTabs={diagramTabs}
      formulasSection={formulasSection}
      onDownloadPDF={handleDownloadPDF}
      downloadingPDF={downloadingPDF}
      EmptyIcon={Flame}
    >
      <h3 className="card-title">Parametri di Ingresso</h3>
      <div className="inputs-grid">
        <InputField label="Pressione Caldaia" value={inputs.p_high} onChange={v => setInputs({ ...inputs, p_high: v })} unit="bar" accent={COLOR} />
        <InputField label="Pressione Condensatore" value={inputs.p_low} onChange={v => setInputs({ ...inputs, p_low: v })} unit="bar" accent={COLOR} />
        <InputField label="Temperatura Massima" value={inputs.t_max} onChange={v => setInputs({ ...inputs, t_max: v })} unit="°C" accent={COLOR} />
      </div>
      <div className="inputs-row">
        <InputField label="η Turbina" value={inputs.eta_t} onChange={v => setInputs({ ...inputs, eta_t: v })} step={0.01} min={0.5} max={1} accent={COLOR} />
        <InputField label="η Pompa" value={inputs.eta_p} onChange={v => setInputs({ ...inputs, eta_p: v })} step={0.01} min={0.5} max={1} accent={COLOR} />
      </div>
      <InputField label="Portata Massica" value={inputs.mass_flow} onChange={v => setInputs({ ...inputs, mass_flow: v })} unit="kg/s" step={0.1} accent={COLOR} />
    </CyclePageLayout>
  );
};

export default RankinePage;
