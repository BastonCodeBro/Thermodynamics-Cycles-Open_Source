import { useState, useEffect, useRef, useCallback } from 'react';
import { solveFluid } from '../utils/waterProps';
import { Zap } from 'lucide-react';
import CyclePageLayout from './shared/CyclePageLayout';
import InputField from './shared/InputField';
import StatCard from './shared/StatCard';
import FormulasSection from './shared/FormulasSection';
import SchematicDiagram from './shared/SchematicDiagram';
import { exportToPDF } from '../utils/pdfExport';
import { plotLayout, plotConfig, addTrace, genPvCurve, genTsCurve, genHsCurve } from './shared/plotConfig';
import { renderPlot, cleanupPlot } from '../utils/plotly';

const COLOR = '#FCD34D';
const K = 1.4;
const isFiniteNumber = (value) => Number.isFinite(value);

const pointAnnotations = (pts, labels, color) =>
  pts.map((p, i) => ({
    x: p.x, y: p.y, text: labels[i] || `${i + 1}`,
    showarrow: true, arrowhead: 0, arrowsize: 1, arrowwidth: 1.5, arrowcolor: color,
    ax: 22, ay: -22, font: { color, size: 13, family: 'Inter' },
    bgcolor: '#0F172A', bordercolor: color, borderwidth: 1, borderpad: 4,
  }));

const OttoPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  const tsRef = useRef(null);
  const pvRef = useRef(null);
  const hsRef = useRef(null);
  const schematicRef = useRef(null);

  const [inputs, setInputs] = useState({
    r: 8.5, p_low: 1.0, t_min: 25, t_max: 1200, eta_s: 0.9, mass_flow: 1.0,
  });

  useEffect(() => {
    const refs = [tsRef, pvRef, hsRef];
    const node = refs[activeTab]?.current || (activeTab === 3 ? null : null);
    if (!results || activeTab > 2) return;
    if (!node) return;
    const pts = results.allPoints;

    if (activeTab === 0) {
      const c12 = genTsCurve(pts[0], pts[1], 'isentropic');
      const c23 = genTsCurve(pts[1], pts[2], 'isochoric');
      const c34 = genTsCurve(pts[2], pts[3], 'isentropic');
      const c41 = genTsCurve(pts[3], pts[0], 'isochoric');
      const data = [
        addTrace(c12.x, c12.y, { color: COLOR, width: 3, mode: 'lines' }),
        addTrace(c23.x, c23.y, { color: '#EF4444', width: 3, mode: 'lines' }),
        addTrace(c34.x, c34.y, { color: '#22D3EE', width: 3, mode: 'lines' }),
        addTrace(c41.x, c41.y, { color: '#60A5FA', width: 3, mode: 'lines' }),
        addTrace(pts.map(p => p.s), pts.map(p => p.t), { color: COLOR, mode: 'markers', markerSize: 10 }),
      ];
      const layout = plotLayout('Entropia s (kJ/kg·K)', 'Temperatura T (°C)');
      layout.annotations = pointAnnotations(pts.map(p => ({ x: p.s, y: p.t })),
        ['1\nAspiraz.', '2\nCompr.', '3\nCombust.', '4\nEspans.'], COLOR);
      renderPlot(node, data, layout, plotConfig);
    } else if (activeTab === 1) {
      const c12 = genPvCurve(pts[0], pts[1], 'isentropic', 60, K);
      const c23 = genPvCurve(pts[1], pts[2], 'isochoric', 60, K);
      const c34 = genPvCurve(pts[2], pts[3], 'isentropic', 60, K);
      const c41 = genPvCurve(pts[3], pts[0], 'isochoric', 60, K);
      const data = [
        addTrace(c12.x, c12.y, { color: '#FBBF24', width: 3, mode: 'lines' }),
        addTrace(c23.x, c23.y, { color: '#EF4444', width: 3, mode: 'lines' }),
        addTrace(c34.x, c34.y, { color: '#22D3EE', width: 3, mode: 'lines' }),
        addTrace(c41.x, c41.y, { color: '#60A5FA', width: 3, mode: 'lines' }),
        addTrace(pts.map(p => p.v), pts.map(p => p.p), { color: '#FBBF24', mode: 'markers', markerSize: 10 }),
      ];
      const layout = plotLayout('Volume specifico v (m³/kg)', 'Pressione P (bar)');
      layout.annotations = pointAnnotations(pts.map(p => ({ x: p.v, y: p.p })), ['1', '2', '3', '4'], COLOR);
      renderPlot(node, data, layout, plotConfig);
    } else if (activeTab === 2) {
      const c12 = genHsCurve(pts[0], pts[1], 'isentropic');
      const c23 = genHsCurve(pts[1], pts[2], 'isochoric');
      const c34 = genHsCurve(pts[2], pts[3], 'isentropic');
      const c41 = genHsCurve(pts[3], pts[0], 'isochoric');
      const data = [
        addTrace(c12.x, c12.y, { color: COLOR, width: 3, mode: 'lines' }),
        addTrace(c23.x, c23.y, { color: '#EF4444', width: 3, mode: 'lines' }),
        addTrace(c34.x, c34.y, { color: '#22D3EE', width: 3, mode: 'lines' }),
        addTrace(c41.x, c41.y, { color: '#60A5FA', width: 3, mode: 'lines' }),
        addTrace(pts.map(p => p.s), pts.map(p => p.h), { color: COLOR, mode: 'markers', markerSize: 10 }),
      ];
      const layout = plotLayout('Entropia s (kJ/kg·K)', 'Entalpia h (kJ/kg)');
      layout.annotations = pointAnnotations(pts.map(p => ({ x: p.s, y: p.h })), ['1', '2', '3', '4'], COLOR);
      renderPlot(node, data, layout, plotConfig);
    }
    return () => { if (node) cleanupPlot(node); };
  }, [results, activeTab]);

  const canCalculate = isFiniteNumber(inputs.r) && isFiniteNumber(inputs.p_low)
    && isFiniteNumber(inputs.t_min) && isFiniteNumber(inputs.t_max)
    && isFiniteNumber(inputs.eta_s) && isFiniteNumber(inputs.mass_flow)
    && inputs.r > 1 && inputs.p_low > 0 && inputs.t_max > inputs.t_min
    && inputs.eta_s > 0 && inputs.eta_s <= 1 && inputs.mass_flow > 0;

  const calculate = async () => {
    setLoading(true);
    setError(null);
    const fluid = 'Air';
    try {
      const st1 = await solveFluid({ p: inputs.p_low, t: inputs.t_min }, fluid);
      const v2 = st1.v / inputs.r;
      const st2s = await solveFluid({ v: v2, s: st1.s }, fluid);
      const T2r = st1.t + (st2s.t - st1.t) / inputs.eta_s;
      const st2r = await solveFluid({ v: v2, t: T2r }, fluid);
      const st3 = await solveFluid({ v: v2, t: inputs.t_max }, fluid);
      const st4s = await solveFluid({ v: st1.v, s: st3.s }, fluid);
      const T4r = st3.t - inputs.eta_s * (st3.t - st4s.t);
      const st4r = await solveFluid({ v: st1.v, t: T4r }, fluid);

      const getU = (s) => s.h - s.p * s.v;
      const u1 = getU(st1), u2 = getU(st2r), u3 = getU(st3), u4 = getU(st4r);
      const wc = u2 - u1, wt = u3 - u4, q_in = u3 - u2, w_net = wt - wc;
      const eta_ideal = (1 - 1 / Math.pow(inputs.r, K - 1)) * 100;

      setResults({
        allPoints: [st1, st2r, st3, st4r],
        stats: { wc, wt, q_in, q_out: q_in - w_net, eta: (w_net / q_in) * 100, eta_ideal, power: w_net * inputs.mass_flow },
      });
    } catch (err) {
      setError('Dati non validi: il rapporto di compressione o la T_max potrebbero essere fuori scala.');
      console.error(err);
    } finally { setLoading(false); }
  };

  const handleDownloadPDF = useCallback(async () => {
    if (!results) return;
    setDownloadingPDF(true);
    try {
      await exportToPDF({
        title: 'Otto', accentColor: COLOR, inputs, stats: results.stats,
        points: results.allPoints.map((p, i) => ({
          label: ['1: Aspir.', '2: Compr.', '3: Comb.', '4: Espans.'][i],
          t: p.t, p: p.p, h: p.h, s: p.s, v: p.v,
        })),
        formulas: [
          { label: 'Rendimento ideale', latex: '\\eta_{otto} = 1 - \\frac{1}{r^{k-1}}', value: results.stats.eta_ideal },
          { label: 'Rendimento reale', latex: '\\eta = \\frac{w_{net}}{q_{in}}', value: results.stats.eta },
        ],
        plotRefs: { ts: tsRef, pv: pvRef, hs: hsRef }, schematicRef,
      });
    } catch (err) { console.error(err); }
    finally { setDownloadingPDF(false); }
  }, [results, inputs]);

  const diagramTabs = results ? [
    { id: 'ts', label: 'T-s', active: activeTab === 0, onClick: () => setActiveTab(0), content: <div ref={tsRef} className="plot-area" /> },
    { id: 'pv', label: 'P-v', active: activeTab === 1, onClick: () => setActiveTab(1), content: <div ref={pvRef} className="plot-area" /> },
    { id: 'hs', label: 'h-s', active: activeTab === 2, onClick: () => setActiveTab(2), content: <div ref={hsRef} className="plot-area" /> },
    { id: 'schema', label: 'Schema', active: activeTab === 3, onClick: () => setActiveTab(3), content: <div ref={schematicRef}><SchematicDiagram type="otto" accentColor={COLOR} /></div> },
  ] : null;

  const formulasSection = results ? (
    <FormulasSection accentColor={COLOR}
      points={results.allPoints.map((p, i) => ({
        label: ['1: Aspir.', '2: Compr.', '3: Comb.', '4: Espans.'][i],
        t: p.t, p: p.p, h: p.h, s: p.s, v: p.v,
      }))}
      formulas={[
        { label: 'Rapporto di compressione', latex: 'r = \\frac{V_1}{V_2} = \\frac{v_1}{v_2}', value: inputs.r },
        { label: 'Punto 1 — Aspirazione', latex: 'P_1 = P_{low}, \\quad T_1 = T_{amb}, \\quad v_1 = v_{ref}' },
        { label: 'Punto 2 — Fine compressione', latex: 'v_2 = \\frac{v_1}{r}, \\quad T_2 = T_1 + \\frac{T_{2s} - T_1}{\\eta_s}' },
        { label: 'Punto 3 — Fine combustione (isocora)', latex: 'v_3 = v_2, \\quad T_3 = T_{max}' },
        { label: 'Punto 4 — Fine espansione', latex: 'v_4 = v_1, \\quad T_4 = T_3 - \\eta_s(T_3 - T_{4s})' },
        { label: 'Energia interna', latex: 'u = h - P \\cdot v' },
        { label: 'Lavoro compressione', latex: 'w_c = u_2 - u_1', value: results.stats.wc },
        { label: 'Lavoro espansione', latex: 'w_t = u_3 - u_4', value: results.stats.wt },
        { label: 'Calore Ingresso', latex: 'q_{in} = u_3 - u_2', value: results.stats.q_in },
        { label: 'Rendimento ideale', latex: '\\eta_{otto} = 1 - \\frac{1}{r^{k-1}}', value: results.stats.eta_ideal, display: true },
        { label: 'Rendimento reale', latex: '\\eta = \\frac{w_t - w_c}{q_{in}} \\times 100', value: results.stats.eta },
      ]}
    />
  ) : null;

  const stats = results ? (
    <div className="stats-row">
      <StatCard label="Rendimento" value={`${results.stats.eta.toFixed(2)}%`} accent color={COLOR} />
      <StatCard label="Lavoro Netto" value={`${(results.stats.wt - results.stats.wc).toFixed(1)} kJ/kg`} />
      <StatCard label="Calore In" value={`${results.stats.q_in.toFixed(1)} kJ/kg`} />
      <StatCard label="Calore Out" value={`${results.stats.q_out.toFixed(1)} kJ/kg`} />
    </div>
  ) : null;

  return (
    <CyclePageLayout badge="Accensione Comandata" title="Ciclo" titleAccent="Otto" accentColor={COLOR}
      loading={loading} error={error} results={results} onCalculate={calculate} canCalculate={canCalculate}
      stats={stats} diagramTabs={diagramTabs} formulasSection={formulasSection}
      onDownloadPDF={handleDownloadPDF} downloadingPDF={downloadingPDF} EmptyIcon={Zap}>
      <h3 className="card-title">Parametri Motore</h3>
      <div className="inputs-grid">
        <InputField label="Rapporto di Compressione" value={inputs.r} onChange={v => setInputs({ ...inputs, r: v })} accent={COLOR} />
        <InputField label="Temperatura Ambiente" value={inputs.t_min} onChange={v => setInputs({ ...inputs, t_min: v })} unit="°C" accent={COLOR} />
        <InputField label="Temperatura Massima" value={inputs.t_max} onChange={v => setInputs({ ...inputs, t_max: v })} unit="°C" accent={COLOR} />
      </div>
      <div className="inputs-row">
        <InputField label="η Isentropico" value={inputs.eta_s} onChange={v => setInputs({ ...inputs, eta_s: v })} step={0.01} min={0.5} max={1} accent={COLOR} />
        <InputField label="Portata Massica" value={inputs.mass_flow} onChange={v => setInputs({ ...inputs, mass_flow: v })} unit="kg/s" step={0.1} accent={COLOR} />
      </div>
    </CyclePageLayout>
  );
};

export default OttoPage;
