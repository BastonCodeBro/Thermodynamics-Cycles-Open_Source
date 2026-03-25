import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Flame } from 'lucide-react';
import CyclePageLayout from './shared/CyclePageLayout';
import InputField from './shared/InputField';
import StatCard from './shared/StatCard';
import FormulasSection from './shared/FormulasSection';
import SchematicDiagram from './shared/SchematicDiagram';
import { plotLayout, plotConfig, addTrace } from './shared/plotConfig';
import { renderPlot, cleanupPlot } from '../utils/plotly';
import { calcDieselCycle } from '../utils/idealGas';
import { generateProcessPath } from '../utils/processPath';

const COLOR = '#EF4444';
const SEGMENT_COLORS = [COLOR, '#F97316', '#22D3EE', '#60A5FA'];
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

const DieselPage = () => {
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
    r: 18,
    rc: 2,
    p_low: 1.0,
    t_min: 25,
    eta_s: 0.9,
    mass_flow: 1.0,
  });

  useEffect(() => {
    const node = activeTab === 0 ? tsRef.current : activeTab === 1 ? pvRef.current : activeTab === 2 ? hsRef.current : null;
    if (!results || !node) return;

    const renderActivePlot = async () => {
      const pts = results.allPoints;
      const pathOptions = [
        { processType: 'polytropic', model: 'ideal-gas' },
        { processType: 'isobaric', model: 'ideal-gas' },
        { processType: 'polytropic', model: 'ideal-gas' },
        { processType: 'isochoric', model: 'ideal-gas' },
      ];

      const paths = await Promise.all([
        generateProcessPath(pts[0], pts[1], 'Air', 64, pathOptions[0]),
        generateProcessPath(pts[1], pts[2], 'Air', 64, pathOptions[1]),
        generateProcessPath(pts[2], pts[3], 'Air', 64, pathOptions[2]),
        generateProcessPath(pts[3], pts[0], 'Air', 64, pathOptions[3]),
      ]);

      if (activeTab === 0) {
        const data = [
          ...paths.map((path, index) =>
            addTrace(path.map((p) => p.s), path.map((p) => p.t), {
              name: `Tratto ${index + 1}`,
              color: SEGMENT_COLORS[index],
              width: 3,
              mode: 'lines',
            }),
          ),
          addTrace(pts.map((p) => p.s), pts.map((p) => p.t), {
            color: COLOR,
            mode: 'markers',
            markerSize: 10,
          }),
        ];
        const layout = plotLayout('Entropia s (kJ/kg K)', 'Temperatura T (C)');
        layout.annotations = pointAnnotations(
          pts.map((p) => ({ x: p.s, y: p.t })),
          ['1\nInizio', '2\nCompressione', '3\nCombustione', '4\nEspansione'],
          COLOR,
        );
        renderPlot(node, data, layout, plotConfig);
      } else if (activeTab === 1) {
        const data = [
          ...paths.map((path, index) =>
            addTrace(path.map((p) => p.v), path.map((p) => p.p), {
              name: `Tratto ${index + 1}`,
              color: SEGMENT_COLORS[index],
              width: 3,
              mode: 'lines',
            }),
          ),
          addTrace(pts.map((p) => p.v), pts.map((p) => p.p), {
            color: COLOR,
            mode: 'markers',
            markerSize: 10,
          }),
        ];
        const layout = plotLayout('Volume specifico v (m^3/kg)', 'Pressione P (bar)', {
          xaxis: { type: 'log' },
          yaxis: { type: 'log' },
        });
        layout.annotations = pointAnnotations(pts.map((p) => ({ x: p.v, y: p.p })), ['1', '2', '3', '4'], COLOR);
        renderPlot(node, data, layout, plotConfig);
      } else {
        const data = [
          ...paths.map((path, index) =>
            addTrace(path.map((p) => p.s), path.map((p) => p.h), {
              name: `Tratto ${index + 1}`,
              color: SEGMENT_COLORS[index],
              width: 3,
              mode: 'lines',
            }),
          ),
          addTrace(pts.map((p) => p.s), pts.map((p) => p.h), {
            color: COLOR,
            mode: 'markers',
            markerSize: 10,
          }),
        ];
        const layout = plotLayout('Entropia s (kJ/kg K)', 'Entalpia h (kJ/kg)');
        layout.annotations = pointAnnotations(pts.map((p) => ({ x: p.s, y: p.h })), ['1', '2', '3', '4'], COLOR);
        renderPlot(node, data, layout, plotConfig);
      }
    };

    renderActivePlot();
    return () => cleanupPlot(node);
  }, [results, activeTab]);

  const canCalculate = isFiniteNumber(inputs.r)
    && isFiniteNumber(inputs.rc)
    && isFiniteNumber(inputs.p_low)
    && isFiniteNumber(inputs.t_min)
    && isFiniteNumber(inputs.eta_s)
    && isFiniteNumber(inputs.mass_flow)
    && inputs.r > 1
    && inputs.rc > 1
    && inputs.p_low > 0
    && inputs.eta_s > 0
    && inputs.eta_s <= 1
    && inputs.mass_flow > 0;

  const calculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const cycle = calcDieselCycle({
        p1Bar: inputs.p_low,
        t1C: inputs.t_min,
        r: inputs.r,
        rc: inputs.rc,
        eta: inputs.eta_s,
        massFlow: inputs.mass_flow,
      });

      setResults({
        allPoints: cycle.points,
        stats: cycle.stats,
      });
    } catch (calculationError) {
      setError('Parametri non validi: controlla rapporto di compressione, rapporto di combustione e rendimento.');
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
        title: 'Diesel',
        accentColor: COLOR,
        inputs,
        stats: results.stats,
        points: results.allPoints.map((p, index) => ({
          label: ['1: Inizio', '2: Compr.', '3: Comb.', '4: Esp.'][index],
          t: p.t,
          p: p.p,
          h: p.h,
          s: p.s,
          v: p.v,
        })),
        formulas: [
          { label: 'Rendimento ideale Diesel', latex: '\\eta_{diesel} = 1 - \\frac{1}{r^{k-1}} \\cdot \\frac{r_c^k - 1}{k(r_c-1)}', value: results.stats.eta_ideal },
          { label: 'Lavoro netto', latex: 'w_{net} = q_{in} - q_{out}', value: results.stats.q_in - results.stats.q_out },
          { label: 'Rendimento reale', latex: '\\eta = \\frac{w_{net}}{q_{in}}', value: results.stats.eta },
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
    pointLabels: ['1 Inizio compressione', '2 Fine compressione', '3 Fine combustione', '4 Fine espansione'],
    summaryItems: [
      { label: 'Lavoro netto', value: `${(results.stats.q_in - results.stats.q_out).toFixed(1)} kJ/kg`, color: COLOR },
      { label: 'Calore in', value: `${results.stats.q_in.toFixed(1)} kJ/kg`, color: '#F97316' },
      { label: 'Calore out', value: `${results.stats.q_out.toFixed(1)} kJ/kg`, color: '#60A5FA' },
      { label: 'Rendimento', value: `${results.stats.eta.toFixed(2)} %`, color: COLOR },
    ],
  } : null;

  const diagramTabs = results ? [
    { id: 'ts', label: 'T-s', active: activeTab === 0, onClick: () => setActiveTab(0), content: <div ref={tsRef} className="plot-area" /> },
    { id: 'pv', label: 'P-v', active: activeTab === 1, onClick: () => setActiveTab(1), content: <div ref={pvRef} className="plot-area" /> },
    { id: 'hs', label: 'h-s', active: activeTab === 2, onClick: () => setActiveTab(2), content: <div ref={hsRef} className="plot-area" /> },
    { id: 'schema', label: 'Schema', active: activeTab === 3, onClick: () => setActiveTab(3), content: <div ref={schematicRef}><SchematicDiagram type="diesel" accentColor={COLOR} {...schematicProps} /></div> },
  ] : null;

  const formulasSection = results ? (
    <FormulasSection
      accentColor={COLOR}
      points={results.allPoints.map((p, index) => ({
        label: ['1: Inizio', '2: Compr.', '3: Comb.', '4: Esp.'][index],
        t: p.t,
        p: p.p,
        h: p.h,
        s: p.s,
        v: p.v,
      }))}
      formulas={[
        { label: 'Rapporto di compressione', latex: 'r = \\frac{v_1}{v_2}', value: inputs.r },
        { label: 'Rapporto di combustione', latex: 'r_c = \\frac{v_3}{v_2}', value: inputs.rc },
        { label: '1 -> 2', latex: 'Compressione politropica reale' },
        { label: '2 -> 3', latex: 'Apporto di calore a pressione costante' },
        { label: '3 -> 4', latex: 'Espansione politropica reale' },
        { label: '4 -> 1', latex: 'Cessione di calore a volume costante' },
        { label: 'Calore in ingresso', latex: 'q_{in} = c_p (T_3 - T_2)', value: results.stats.q_in },
        { label: 'Calore in uscita', latex: 'q_{out} = c_v (T_4 - T_1)', value: results.stats.q_out },
        { label: 'Rendimento ideale Diesel', latex: '\\eta_{diesel} = 1 - \\frac{1}{r^{k-1}} \\cdot \\frac{r_c^k - 1}{k(r_c-1)}', value: results.stats.eta_ideal, display: true },
        { label: 'Rendimento reale', latex: '\\eta = \\frac{q_{in} - q_{out}}{q_{in}} \\times 100', value: results.stats.eta },
      ]}
    />
  ) : null;

  const stats = results ? (
    <div className="stats-row">
      <StatCard label="Rendimento" value={`${results.stats.eta.toFixed(2)}%`} accent color={COLOR} />
      <StatCard label="Lavoro Netto" value={`${(results.stats.q_in - results.stats.q_out).toFixed(1)} kJ/kg`} />
      <StatCard label="T Massima" value={`${results.allPoints[2].t.toFixed(0)} C`} />
      <StatCard label="Calore In" value={`${results.stats.q_in.toFixed(1)} kJ/kg`} />
    </div>
  ) : null;

  return (
    <CyclePageLayout
      badge="Accensione per Compressione"
      title="Ciclo"
      titleAccent="Diesel"
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
      <h3 className="card-title">Parametri Motore</h3>
      <div className="inputs-grid">
        <InputField label="Rapporto di Compressione" value={inputs.r} onChange={(value) => setInputs({ ...inputs, r: value })} accent={COLOR} />
        <InputField label="Rapporto di Combustione" value={inputs.rc} onChange={(value) => setInputs({ ...inputs, rc: value })} step={0.1} accent={COLOR} />
        <InputField label="Pressione Iniziale" value={inputs.p_low} onChange={(value) => setInputs({ ...inputs, p_low: value })} unit="bar" accent={COLOR} />
      </div>
      <div className="inputs-row">
        <InputField label="Temperatura Iniziale" value={inputs.t_min} onChange={(value) => setInputs({ ...inputs, t_min: value })} unit="C" accent={COLOR} />
        <InputField label="Rendimento Isentropico" value={inputs.eta_s} onChange={(value) => setInputs({ ...inputs, eta_s: value })} step={0.01} min={0.5} max={1} accent={COLOR} />
      </div>
      <InputField label="Portata Massica" value={inputs.mass_flow} onChange={(value) => setInputs({ ...inputs, mass_flow: value })} unit="kg/s" step={0.1} accent={COLOR} />
    </CyclePageLayout>
  );
};

export default DieselPage;
