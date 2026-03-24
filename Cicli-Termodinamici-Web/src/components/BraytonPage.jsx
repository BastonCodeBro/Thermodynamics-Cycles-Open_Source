import { useState, useEffect, useRef, useCallback } from 'react';
import { solveFluid } from '../utils/waterProps';
import { Wind } from 'lucide-react';
import CyclePageLayout from './shared/CyclePageLayout';
import InputField from './shared/InputField';
import StatCard from './shared/StatCard';
import FormulasSection from './shared/FormulasSection';
import SchematicDiagram from './shared/SchematicDiagram';
import { exportToPDF } from '../utils/pdfExport';
import { plotLayout, plotConfig, addTrace } from './shared/plotConfig';
import { renderPlot, cleanupPlot } from '../utils/plotly';

const COLOR = '#818CF8';
const isFiniteNumber = (value) => Number.isFinite(value);

const pointAnnotations = (pts, labels, color) =>
  pts.map((p, i) => ({
    x: p.x, y: p.y, text: labels[i] || `${i + 1}`,
    showarrow: true, arrowhead: 0, arrowsize: 1, arrowwidth: 1.5, arrowcolor: color,
    ax: 22, ay: -22, font: { color, size: 13, family: 'Inter' },
    bgcolor: '#0F172A', bordercolor: color, borderwidth: 1, borderpad: 4,
  }));

const BraytonPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  const tsRef = useRef(null);
  const pvRef = useRef(null);
  const schematicRef = useRef(null);

  const [inputs, setInputs] = useState({
    p_low: 1.0, beta: 10, t_min: 20, t_max: 1000, eta_c: 0.85, eta_t: 0.88, mass_flow: 1.0,
  });

  useEffect(() => {
    const node = activeTab === 0 ? tsRef.current : activeTab === 1 ? pvRef.current : null;
    if (!results || !node) return;

    const renderActivePlot = async () => {
      if (activeTab === 0) {
        const data = [
          addTrace(
            [...results.allPoints.map(p => p.s), results.allPoints[0].s],
            [...results.allPoints.map(p => p.t), results.allPoints[0].t],
            { name: 'Ciclo Brayton', color: COLOR, mode: 'lines+markers', markerSize: 10 }
          ),
        ];
        if (results.idealPoints) {
          data.push(addTrace(
            [...results.idealPoints.map(p => p.s), results.idealPoints[0].s],
            [...results.idealPoints.map(p => p.t), results.idealPoints[0].t],
            { name: 'Ideale', color: '#475569', width: 2, dash: 'dash', mode: 'lines', markerSize: 0 }
          ));
        }
        const layout = plotLayout('Entropia s (kJ/kg·K)', 'Temperatura T (°C)');
        layout.annotations = pointAnnotations(
          results.allPoints.map(p => ({ x: p.s, y: p.t })),
          ['1\nAspiraz.', '2\nComp.', '3\nCombust.', '4\nTurbina'],
          COLOR
        );
        renderPlot(node, data, layout, plotConfig);
      } else if (activeTab === 1) {
        const data = [
          addTrace(
            [...results.allPoints.map(p => p.v), results.allPoints[0].v],
            [...results.allPoints.map(p => p.p), results.allPoints[0].p],
            { name: 'Ciclo P-v', color: '#A78BFA', mode: 'lines+markers', markerSize: 10 }
          ),
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
  }, [results, activeTab]);

  const canCalculate = isFiniteNumber(inputs.p_low) && isFiniteNumber(inputs.beta)
    && isFiniteNumber(inputs.t_min) && isFiniteNumber(inputs.t_max)
    && isFiniteNumber(inputs.eta_c) && isFiniteNumber(inputs.eta_t)
    && isFiniteNumber(inputs.mass_flow)
    && inputs.p_low > 0 && inputs.beta > 1 && inputs.t_max > inputs.t_min
    && inputs.eta_c > 0 && inputs.eta_c <= 1 && inputs.eta_t > 0 && inputs.eta_t <= 1
    && inputs.mass_flow > 0;

  const calculate = async () => {
    setLoading(true);
    setError(null);
    const fluid = 'Air';
    try {
      const st1 = await solveFluid({ p: inputs.p_low, t: inputs.t_min }, fluid);
      const pHigh = inputs.p_low * inputs.beta;

      const st2s = await solveFluid({ p: pHigh, s: st1.s }, fluid);
      const h2r = st1.h + (st2s.h - st1.h) / inputs.eta_c;
      const st2r = await solveFluid({ p: pHigh, h: h2r }, fluid);

      const st3 = await solveFluid({ p: pHigh, t: inputs.t_max }, fluid);

      const st4s = await solveFluid({ p: inputs.p_low, s: st3.s }, fluid);
      const h4r = st3.h - (st3.h - st4s.h) * inputs.eta_t;
      const st4r = await solveFluid({ p: inputs.p_low, h: h4r }, fluid);

      const wc = st2r.h - st1.h;
      const wt = st3.h - st4r.h;
      const q_in = st3.h - st2r.h;
      const w_net = wt - wc;

      setResults({
        allPoints: [st1, st2r, st3, st4r],
        idealPoints: [st1, st2s, st3, st4s],
        stats: { wt, wc, q_in, eta: (w_net / q_in) * 100, power: w_net * inputs.mass_flow, bwr: (wc / wt) * 100 },
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
        title: 'Brayton-Joule', accentColor: COLOR, inputs, stats: results.stats,
        points: results.allPoints.map((p, i) => ({
          label: ['1: Aspiraz.', '2: Comp.', '3: Comb.', '4: Turb.'][i],
          t: p.t, p: p.p, h: p.h, s: p.s, v: p.v,
        })),
        formulas: [
          { label: 'Lavoro Compressore', latex: 'w_c = h_2 - h_1', value: results.stats.wc },
          { label: 'Lavoro Turbina', latex: 'w_t = h_3 - h_4', value: results.stats.wt },
          { label: 'Calore Ingresso', latex: 'q_{in} = h_3 - h_2', value: results.stats.q_in },
          { label: 'Rendimento', latex: '\\eta = \\frac{w_t - w_c}{q_{in}}', value: results.stats.eta },
          { label: 'Back Work Ratio', latex: 'BWR = \\frac{w_c}{w_t}', value: results.stats.bwr },
        ],
        plotRefs: { ts: tsRef, pv: pvRef }, schematicRef,
      });
    } catch (err) { console.error('PDF export error:', err); }
    finally { setDownloadingPDF(false); }
  }, [results, inputs]);

  const diagramTabs = results ? [
    { id: 'ts', label: 'T-s', active: activeTab === 0, onClick: () => setActiveTab(0),
      content: <div ref={tsRef} className="plot-area" /> },
    { id: 'pv', label: 'P-v', active: activeTab === 1, onClick: () => setActiveTab(1),
      content: <div ref={pvRef} className="plot-area" /> },
    { id: 'schema', label: 'Schema', active: activeTab === 2, onClick: () => setActiveTab(2),
      content: <div ref={schematicRef}><SchematicDiagram type="brayton" accentColor={COLOR} /></div> },
  ] : null;

  const formulasSection = results ? (
    <FormulasSection accentColor={COLOR}
      points={results.allPoints.map((p, i) => ({
        label: ['1: Aspir.', '2: Comp.', '3: Comb.', '4: Turb.'][i],
        t: p.t, p: p.p, h: p.h, s: p.s, v: p.v,
      }))}
      formulas={[
        { label: 'Punto 1 — Aspirazione', latex: 'P_1 = P_{low}, \\quad T_1 = T_{amb}' },
        { label: 'Punto 2 — Uscita compressore (reale)', latex: 'h_2 = h_1 + \\frac{h_{2s} - h_1}{\\eta_c}, \\quad P_2 = P_1 \\cdot \\beta' },
        { label: 'Punto 3 — Uscita camera combustione', latex: 'P_3 = P_2, \\quad T_3 = T_{max}' },
        { label: 'Punto 4 — Uscita turbina (reale)', latex: 'h_4 = h_3 - \\eta_t(h_3 - h_{4s}), \\quad P_4 = P_1' },
        { label: 'Lavoro Compressore', latex: 'w_c = h_2 - h_1', value: results.stats.wc },
        { label: 'Lavoro Turbina', latex: 'w_t = h_3 - h_4', value: results.stats.wt },
        { label: 'Calore Ingresso', latex: 'q_{in} = h_3 - h_2', value: results.stats.q_in },
        { label: 'Rendimento', latex: '\\eta = \\frac{w_t - w_c}{q_{in}} \\times 100', value: results.stats.eta, display: true },
        { label: 'Back Work Ratio', latex: 'BWR = \\frac{w_c}{w_t} \\times 100', value: results.stats.bwr },
        { label: 'Potenza Netta', latex: '\\dot{W}_{net} = \\dot{m} \\cdot (w_t - w_c)', value: results.stats.power },
      ]}
    />
  ) : null;

  const stats = results ? (
    <div className="stats-row">
      <StatCard label="Rendimento" value={`${results.stats.eta.toFixed(2)}%`} accent color={COLOR} />
      <StatCard label="Potenza Netta" value={`${(results.stats.power / 1000).toFixed(2)} MW`} />
      <StatCard label="BWR" value={`${results.stats.bwr.toFixed(1)}%`} />
      <StatCard label="Calore In" value={`${results.stats.q_in.toFixed(1)} kJ/kg`} />
    </div>
  ) : null;

  return (
    <CyclePageLayout badge="Turbina a Gas" title="Ciclo" titleAccent="Brayton-Joule" accentColor={COLOR}
      loading={loading} error={error} results={results} onCalculate={calculate} canCalculate={canCalculate}
      stats={stats} diagramTabs={diagramTabs} formulasSection={formulasSection}
      onDownloadPDF={handleDownloadPDF} downloadingPDF={downloadingPDF} EmptyIcon={Wind}>
      <h3 className="card-title">Parametri Aria</h3>
      <div className="inputs-grid">
        <InputField label="Rapporto di Compressione (β)" value={inputs.beta} onChange={v => setInputs({ ...inputs, beta: v })} accent={COLOR} />
        <InputField label="Temperatura Ambiente" value={inputs.t_min} onChange={v => setInputs({ ...inputs, t_min: v })} unit="°C" accent={COLOR} />
        <InputField label="Temperatura Turbina In" value={inputs.t_max} onChange={v => setInputs({ ...inputs, t_max: v })} unit="°C" accent={COLOR} />
      </div>
      <div className="inputs-row">
        <InputField label="η Compressore" value={inputs.eta_c} onChange={v => setInputs({ ...inputs, eta_c: v })} step={0.01} min={0.5} max={1} accent={COLOR} />
        <InputField label="η Turbina" value={inputs.eta_t} onChange={v => setInputs({ ...inputs, eta_t: v })} step={0.01} min={0.5} max={1} accent={COLOR} />
      </div>
      <InputField label="Portata Massica" value={inputs.mass_flow} onChange={v => setInputs({ ...inputs, mass_flow: v })} unit="kg/s" step={0.1} accent={COLOR} />
    </CyclePageLayout>
  );
};

export default BraytonPage;
