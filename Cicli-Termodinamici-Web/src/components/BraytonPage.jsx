import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Wind } from 'lucide-react';
import CyclePageLayout from './shared/CyclePageLayout';
import InputField from './shared/InputField';
import StatCard from './shared/StatCard';
import FormulasSection from './shared/FormulasSection';
import SchematicDiagram from './shared/SchematicDiagram';
import { plotLayout, plotConfig, addTrace } from './shared/plotConfig';
import { renderPlot, cleanupPlot } from '../utils/plotly';
import { calcBraytonCycle } from '../utils/idealGas';
import { generateProcessPath } from '../utils/processPath';

const COLOR = '#818CF8';
const SEGMENT_COLORS = [COLOR, '#F97316', '#22D3EE', '#60A5FA'];
const IDEAL_COLOR = '#475569';
const isFiniteNumber = (value) => Number.isFinite(value);

const pointAnnotations = (pts, labels, color) =>
  pts.map((p, index) => ({
    x: p.x,
    y: p.y,
    text: labels[index] || `${index + 1}`,
    showarrow: true,
    arrowhead: 0,
    arrowsize: 1,
    arrowwidth: 1.5,
    arrowcolor: color,
    ax: 22,
    ay: -22,
    font: { color, size: 13, family: 'Inter' },
    bgcolor: '#0F172A',
    bordercolor: color,
    borderwidth: 1,
    borderpad: 4,
  }));

const BraytonPage = () => {
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
    p_low: 1.0,
    beta: 10,
    t_min: 20,
    t_max: 1000,
    eta_c: 0.85,
    eta_t: 0.88,
    mass_flow: 1.0,
  });

  useEffect(() => {
    const node = activeTab === 0 ? tsRef.current : activeTab === 1 ? pvRef.current : activeTab === 2 ? hsRef.current : null;
    if (!results || !node) return;

    const renderActivePlot = async () => {
      const realPts = results.allPoints;
      const idealPts = results.idealPoints;

      const realPathOptions = [
        { processType: 'polytropic', model: 'ideal-gas' },
        { processType: 'isobaric', model: 'ideal-gas' },
        { processType: 'polytropic', model: 'ideal-gas' },
        { processType: 'isobaric', model: 'ideal-gas' },
      ];

      const idealPathOptions = [
        { processType: 'isentropic', model: 'ideal-gas' },
        { processType: 'isobaric', model: 'ideal-gas' },
        { processType: 'isentropic', model: 'ideal-gas' },
        { processType: 'isobaric', model: 'ideal-gas' },
      ];

      const [realPaths, idealPaths] = await Promise.all([
        Promise.all([
          generateProcessPath(realPts[0], realPts[1], 'Air', 64, realPathOptions[0]),
          generateProcessPath(realPts[1], realPts[2], 'Air', 64, realPathOptions[1]),
          generateProcessPath(realPts[2], realPts[3], 'Air', 64, realPathOptions[2]),
          generateProcessPath(realPts[3], realPts[0], 'Air', 64, realPathOptions[3]),
        ]),
        Promise.all([
          generateProcessPath(idealPts[0], idealPts[1], 'Air', 64, idealPathOptions[0]),
          generateProcessPath(idealPts[1], idealPts[2], 'Air', 64, idealPathOptions[1]),
          generateProcessPath(idealPts[2], idealPts[3], 'Air', 64, idealPathOptions[2]),
          generateProcessPath(idealPts[3], idealPts[0], 'Air', 64, idealPathOptions[3]),
        ]),
      ]);

      const addIdealTraces = (mapperX, mapperY) =>
        idealPaths.map((path) => addTrace(path.map(mapperX), path.map(mapperY), {
          color: IDEAL_COLOR,
          width: 2,
          dash: 'dash',
          mode: 'lines',
        }));

      if (activeTab === 0) {
        const data = [
          ...realPaths.map((path, index) =>
            addTrace(path.map((p) => p.s), path.map((p) => p.t), {
              name: `Tratto ${index + 1}`,
              color: SEGMENT_COLORS[index],
              width: 3,
              mode: 'lines',
            }),
          ),
          ...addIdealTraces((p) => p.s, (p) => p.t),
          addTrace(realPts.map((p) => p.s), realPts.map((p) => p.t), {
            color: COLOR,
            mode: 'markers',
            markerSize: 10,
          }),
        ];
        const layout = plotLayout('Entropia s (kJ/kg K)', 'Temperatura T (C)');
        layout.annotations = pointAnnotations(
          realPts.map((p) => ({ x: p.s, y: p.t })),
          ['1\nAspirazione', '2\nCompressore', '3\nCombustore', '4\nTurbina'],
          COLOR,
        );
        renderPlot(node, data, layout, plotConfig);
      } else if (activeTab === 1) {
        const data = [
          ...realPaths.map((path, index) =>
            addTrace(path.map((p) => p.v), path.map((p) => p.p), {
              name: `Tratto ${index + 1}`,
              color: SEGMENT_COLORS[index],
              width: 3,
              mode: 'lines',
            }),
          ),
          ...addIdealTraces((p) => p.v, (p) => p.p),
          addTrace(realPts.map((p) => p.v), realPts.map((p) => p.p), {
            color: COLOR,
            mode: 'markers',
            markerSize: 10,
          }),
        ];
        const layout = plotLayout('Volume specifico v (m^3/kg)', 'Pressione P (bar)', {
          xaxis: { type: 'log' },
          yaxis: { type: 'log' },
        });
        layout.annotations = pointAnnotations(realPts.map((p) => ({ x: p.v, y: p.p })), ['1', '2', '3', '4'], COLOR);
        renderPlot(node, data, layout, plotConfig);
      } else {
        const data = [
          ...realPaths.map((path, index) =>
            addTrace(path.map((p) => p.s), path.map((p) => p.h), {
              name: `Tratto ${index + 1}`,
              color: SEGMENT_COLORS[index],
              width: 3,
              mode: 'lines',
            }),
          ),
          ...addIdealTraces((p) => p.s, (p) => p.h),
          addTrace(realPts.map((p) => p.s), realPts.map((p) => p.h), {
            color: COLOR,
            mode: 'markers',
            markerSize: 10,
          }),
        ];
        const layout = plotLayout('Entropia s (kJ/kg K)', 'Entalpia h (kJ/kg)');
        layout.annotations = pointAnnotations(realPts.map((p) => ({ x: p.s, y: p.h })), ['1', '2', '3', '4'], COLOR);
        renderPlot(node, data, layout, plotConfig);
      }
    };

    renderActivePlot();
    return () => cleanupPlot(node);
  }, [results, activeTab]);

  const canCalculate = isFiniteNumber(inputs.p_low)
    && isFiniteNumber(inputs.beta)
    && isFiniteNumber(inputs.t_min)
    && isFiniteNumber(inputs.t_max)
    && isFiniteNumber(inputs.eta_c)
    && isFiniteNumber(inputs.eta_t)
    && isFiniteNumber(inputs.mass_flow)
    && inputs.p_low > 0
    && inputs.beta > 1
    && inputs.t_max > inputs.t_min
    && inputs.eta_c > 0
    && inputs.eta_c <= 1
    && inputs.eta_t > 0
    && inputs.eta_t <= 1
    && inputs.mass_flow > 0;

  const calculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const pHigh = inputs.p_low * inputs.beta;
      const cycle = calcBraytonCycle({
        p1Bar: inputs.p_low,
        t1C: inputs.t_min,
        p2Bar: pHigh,
        t3C: inputs.t_max,
        etaComp: inputs.eta_c,
        etaTurb: inputs.eta_t,
        massFlow: inputs.mass_flow,
      });

      setResults({
        allPoints: cycle.realPoints,
        idealPoints: cycle.idealPoints,
        stats: cycle.stats,
      });
    } catch (calculationError) {
      setError('Parametri non validi: controlla rapporto di compressione, temperature e rendimenti.');
      console.error(calculationError);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = useCallback(async () => {
    if (!results) return;
    setDownloadingPDF(true);
    try {
      const { exportToPDF } = await import('../utils/pdfExport');
      await exportToPDF({
        title: 'Brayton-Joule',
        accentColor: COLOR,
        inputs,
        stats: results.stats,
        points: results.allPoints.map((p, index) => ({
          label: ['1: Aspir.', '2: Comp.', '3: Comb.', '4: Turb.'][index],
          t: p.t,
          p: p.p,
          h: p.h,
          s: p.s,
          v: p.v,
        })),
        formulas: [
          { label: 'Lavoro compressore', latex: 'w_c = c_p (T_2 - T_1)', value: results.stats.wc },
          { label: 'Lavoro turbina', latex: 'w_t = c_p (T_3 - T_4)', value: results.stats.wt },
          { label: 'Calore in ingresso', latex: 'q_{in} = c_p (T_3 - T_2)', value: results.stats.q_in },
          { label: 'Back work ratio', latex: 'BWR = \\frac{w_c}{w_t}', value: results.stats.bwr },
          { label: 'Rendimento reale', latex: '\\eta = \\frac{w_t - w_c}{q_{in}}', value: results.stats.eta },
        ],
        plotRefs: { ts: tsRef, pv: pvRef, hs: hsRef },
        schematicRef,
      });
    } catch (downloadError) {
      console.error(downloadError);
    } finally {
      setDownloadingPDF(false);
    }
  }, [results, inputs]);

  const schematicProps = results ? {
    points: results.allPoints,
    pointLabels: ['1 Aspirazione', '2 Uscita compressore', '3 Ingresso turbina', '4 Scarico turbina'],
    summaryItems: [
      { label: 'Lavoro compressore', value: `${results.stats.wc.toFixed(1)} kJ/kg`, color: '#60A5FA' },
      { label: 'Lavoro turbina', value: `${results.stats.wt.toFixed(1)} kJ/kg`, color: '#34D399' },
      { label: 'Calore in', value: `${results.stats.q_in.toFixed(1)} kJ/kg`, color: '#F97316' },
      { label: 'Rendimento', value: `${results.stats.eta.toFixed(2)} %`, color: COLOR },
    ],
  } : null;

  const diagramTabs = results ? [
    { id: 'ts', label: 'T-s', active: activeTab === 0, onClick: () => setActiveTab(0), content: <div ref={tsRef} className="plot-area" /> },
    { id: 'pv', label: 'P-v', active: activeTab === 1, onClick: () => setActiveTab(1), content: <div ref={pvRef} className="plot-area" /> },
    { id: 'hs', label: 'h-s', active: activeTab === 2, onClick: () => setActiveTab(2), content: <div ref={hsRef} className="plot-area" /> },
    { id: 'schema', label: 'Schema', active: activeTab === 3, onClick: () => setActiveTab(3), content: <div ref={schematicRef}><SchematicDiagram type="brayton" accentColor={COLOR} {...schematicProps} /></div> },
  ] : null;

  const formulasSection = results ? (
    <FormulasSection
      accentColor={COLOR}
      points={results.allPoints.map((p, index) => ({
        label: ['1: Aspir.', '2: Comp.', '3: Comb.', '4: Turb.'][index],
        t: p.t,
        p: p.p,
        h: p.h,
        s: p.s,
        v: p.v,
      }))}
      formulas={[
        { label: 'Rapporto di compressione in pressione', latex: '\\beta = \\frac{P_2}{P_1}', value: inputs.beta },
        { label: '1 -> 2', latex: 'Compressione politropica reale nel compressore' },
        { label: '2 -> 3', latex: 'Apporto di calore a pressione costante' },
        { label: '3 -> 4', latex: 'Espansione politropica reale in turbina' },
        { label: '4 -> 1', latex: 'Cessione di calore a pressione costante' },
        { label: 'Lavoro compressore', latex: 'w_c = c_p (T_2 - T_1)', value: results.stats.wc },
        { label: 'Lavoro turbina', latex: 'w_t = c_p (T_3 - T_4)', value: results.stats.wt },
        { label: 'Calore in ingresso', latex: 'q_{in} = c_p (T_3 - T_2)', value: results.stats.q_in },
        { label: 'Back work ratio', latex: 'BWR = \\frac{w_c}{w_t} \\times 100', value: results.stats.bwr },
        { label: 'Rendimento reale', latex: '\\eta = \\frac{w_t - w_c}{q_{in}} \\times 100', value: results.stats.eta, display: true },
      ]}
    />
  ) : null;

  const stats = results ? (
    <div className="stats-row">
      <StatCard label="Rendimento" value={`${results.stats.eta.toFixed(2)}%`} accent color={COLOR} />
      <StatCard label="Potenza Netta" value={`${results.stats.power.toFixed(2)} kW`} />
      <StatCard label="BWR" value={`${results.stats.bwr.toFixed(1)}%`} />
      <StatCard label="Calore In" value={`${results.stats.q_in.toFixed(1)} kJ/kg`} />
    </div>
  ) : null;

  return (
    <CyclePageLayout
      badge="Turbina a Gas"
      title="Ciclo"
      titleAccent="Brayton-Joule"
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
      EmptyIcon={Wind}
    >
      <h3 className="card-title">Parametri Aria</h3>
      <div className="inputs-grid">
        <InputField label="Pressione Iniziale" value={inputs.p_low} onChange={(value) => setInputs({ ...inputs, p_low: value })} unit="bar" accent={COLOR} />
        <InputField label="Rapporto di Compressione" value={inputs.beta} onChange={(value) => setInputs({ ...inputs, beta: value })} accent={COLOR} />
        <InputField label="Temperatura Ingresso" value={inputs.t_min} onChange={(value) => setInputs({ ...inputs, t_min: value })} unit="C" accent={COLOR} />
      </div>
      <div className="inputs-row">
        <InputField label="Temperatura Massima" value={inputs.t_max} onChange={(value) => setInputs({ ...inputs, t_max: value })} unit="C" accent={COLOR} />
        <InputField label="Rendimento Compressore" value={inputs.eta_c} onChange={(value) => setInputs({ ...inputs, eta_c: value })} step={0.01} min={0.5} max={1} accent={COLOR} />
      </div>
      <div className="inputs-row">
        <InputField label="Rendimento Turbina" value={inputs.eta_t} onChange={(value) => setInputs({ ...inputs, eta_t: value })} step={0.01} min={0.5} max={1} accent={COLOR} />
        <InputField label="Portata Massica" value={inputs.mass_flow} onChange={(value) => setInputs({ ...inputs, mass_flow: value })} unit="kg/s" step={0.1} accent={COLOR} />
      </div>
    </CyclePageLayout>
  );
};

export default BraytonPage;
