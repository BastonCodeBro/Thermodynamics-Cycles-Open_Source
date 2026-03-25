import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
import CyclePageLayout from './shared/CyclePageLayout';
import InputField from './shared/InputField';
import StatCard from './shared/StatCard';
import FormulasSection from './shared/FormulasSection';
import SchematicDiagram from './shared/SchematicDiagram';
import { plotLayout, plotConfig, addTrace } from './shared/plotConfig';
import { renderPlot, cleanupPlot } from '../utils/plotly';
import { calcCarnotCycle } from '../utils/idealGas';
import { generateProcessPath } from '../utils/processPath';

const COLOR = '#A78BFA';
const SEGMENT_COLORS = [COLOR, '#EF4444', '#22D3EE', '#60A5FA'];
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

const CarnotPage = () => {
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
    t_high: 500,
    t_low: 25,
    p_ref: 1.0,
    mass_flow: 1.0,
  });

  useEffect(() => {
    if (!results) return;

    const renderAllPlots = async () => {
      const pts = results.allPoints;
      const pathOptions = [
        { processType: 'isothermal', model: 'ideal-gas' },
        { processType: 'isentropic', model: 'ideal-gas' },
        { processType: 'isothermal', model: 'ideal-gas' },
        { processType: 'isentropic', model: 'ideal-gas' },
      ];

      const paths = await Promise.all([
        generateProcessPath(pts[0], pts[1], 'Air', 64, pathOptions[0]),
        generateProcessPath(pts[1], pts[2], 'Air', 64, pathOptions[1]),
        generateProcessPath(pts[2], pts[3], 'Air', 64, pathOptions[2]),
        generateProcessPath(pts[3], pts[0], 'Air', 64, pathOptions[3]),
      ]);

      if (tsRef.current) {
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
        const layout = plotLayout('Entropia s (kJ/(kg·K))', 'Temperatura T (°C)');
        layout.annotations = pointAnnotations(
          pts.map((p) => ({ x: p.s, y: p.t })),
          ['1\nIsoterma TH', '2\nAdiabatica', '3\nIsoterma TL', '4\nAdiabatica'],
          COLOR,
        );
        renderPlot(tsRef.current, data, layout, plotConfig);
      }

      if (pvRef.current) {
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
        const layout = plotLayout('Volume specifico v (m³/kg)', 'Pressione P (bar)', {
          xaxis: { type: 'log' },
          yaxis: { type: 'log' },
        });
        layout.annotations = pointAnnotations(pts.map((p) => ({ x: p.v, y: p.p })), ['1', '2', '3', '4'], COLOR);
        renderPlot(pvRef.current, data, layout, plotConfig);
      }

      if (hsRef.current) {
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
        const layout = plotLayout('Entropia s (kJ/(kg·K))', 'Entalpia h (kJ/kg)');
        layout.annotations = pointAnnotations(pts.map((p) => ({ x: p.s, y: p.h })), ['1', '2', '3', '4'], COLOR);
        renderPlot(hsRef.current, data, layout, plotConfig);
      }
    };

    renderAllPlots();
    return () => {
      cleanupPlot(tsRef.current);
      cleanupPlot(pvRef.current);
      cleanupPlot(hsRef.current);
    };
  }, [results]);

  const canCalculate = isFiniteNumber(inputs.t_high)
    && isFiniteNumber(inputs.t_low)
    && isFiniteNumber(inputs.p_ref)
    && isFiniteNumber(inputs.mass_flow)
    && inputs.t_high > inputs.t_low
    && inputs.p_ref > 0
    && inputs.mass_flow > 0;

  const calculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const cycle = calcCarnotCycle({
        tHighC: inputs.t_high,
        tLowC: inputs.t_low,
        pRefBar: inputs.p_ref,
        massFlow: inputs.mass_flow,
      });

      setResults({
        allPoints: cycle.points,
        stats: cycle.stats,
      });
    } catch (calculationError) {
      setError('Parametri non validi: la temperatura alta deve essere maggiore di quella bassa.');
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
        title: 'Carnot',
        accentColor: COLOR,
        inputs,
        stats: results.stats,
        points: results.allPoints.map((p, index) => ({
          label: ['1: TH', '2: Adiab.', '3: TL', '4: Adiab.'][index],
          t: p.t,
          p: p.p,
          h: p.h,
          s: p.s,
          v: p.v,
        })),
        formulas: [
          {
            label: 'Calore assorbito',
            latex: 'Q_{in} = T_H \\cdot \\Delta s',
            value: results.stats.Q_in,
            numeric: `${(inputs.t_high + 273.15).toFixed(2)} * ${results.stats.ds.toFixed(4)} = ${results.stats.Q_in.toFixed(2)} kJ/kg`,
          },
          {
            label: 'Calore ceduto',
            latex: 'Q_{out} = T_L \\cdot \\Delta s',
            value: results.stats.Q_out,
            numeric: `${(inputs.t_low + 273.15).toFixed(2)} * ${results.stats.ds.toFixed(4)} = ${results.stats.Q_out.toFixed(2)} kJ/kg`,
          },
          {
            label: 'Lavoro netto',
            latex: 'W_{net} = Q_{in} - Q_{out}',
            value: results.stats.W_net,
            numeric: `${results.stats.Q_in.toFixed(2)} - ${results.stats.Q_out.toFixed(2)} = ${results.stats.W_net.toFixed(2)} kJ/kg`,
          },
          {
            label: 'Rendimento Carnot',
            latex: '\\eta = 1 - \\frac{T_L}{T_H}',
            value: results.stats.eta,
            numeric: `(1 - ${(inputs.t_low + 273.15).toFixed(2)} / ${(inputs.t_high + 273.15).toFixed(2)}) * 100 = ${results.stats.eta.toFixed(2)} %`,
          },
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
    pointLabels: ['1 Isoterma TH', '2 Fine espansione', '3 Isoterma TL', '4 Fine compressione'],
    summaryItems: [
      { label: 'Q in', value: `${results.stats.Q_in.toFixed(1)} kJ/kg`, color: '#EF4444' },
      { label: 'Q out', value: `${results.stats.Q_out.toFixed(1)} kJ/kg`, color: '#60A5FA' },
      { label: 'Lavoro netto', value: `${results.stats.W_net.toFixed(1)} kJ/kg`, color: COLOR },
      { label: 'Rendimento', value: `${results.stats.eta.toFixed(2)} %`, color: COLOR },
    ],
  } : null;

  const diagramTabs = results ? [
    { id: 'ts', label: 'T-s', active: activeTab === 0, onClick: () => setActiveTab(0), content: <div ref={tsRef} className="plot-area" /> },
    { id: 'pv', label: 'P-v', active: activeTab === 1, onClick: () => setActiveTab(1), content: <div ref={pvRef} className="plot-area" /> },
    { id: 'hs', label: 'h-s', active: activeTab === 2, onClick: () => setActiveTab(2), content: <div ref={hsRef} className="plot-area" /> },
    { id: 'schema', label: 'Schema', active: activeTab === 3, onClick: () => setActiveTab(3), content: <div ref={schematicRef}><SchematicDiagram type="carnot" accentColor={COLOR} {...schematicProps} /></div> },
  ] : null;

  const formulasSection = results ? (
    <FormulasSection
      accentColor={COLOR}
      points={results.allPoints.map((p, index) => ({
        label: ['1: TH', '2: Adiab.', '3: TL', '4: Adiab.'][index],
        t: p.t,
        p: p.p,
        h: p.h,
        s: p.s,
        v: p.v,
      }))}
      formulas={[
        { label: '1 -> 2', latex: 'Espansione isoterma a T_H' },
        { label: '2 -> 3', latex: 'Espansione isentropica' },
        { label: '3 -> 4', latex: 'Compressione isoterma a T_L' },
        { label: '4 -> 1', latex: 'Compressione isentropica' },
        { label: 'Calore assorbito', latex: 'Q_{in} = T_H \\cdot \\Delta s', value: results.stats.Q_in },
        { label: 'Calore ceduto', latex: 'Q_{out} = T_L \\cdot \\Delta s', value: results.stats.Q_out },
        { label: 'Lavoro netto', latex: 'W_{net} = Q_{in} - Q_{out}', value: results.stats.W_net },
        { label: 'Rendimento Carnot', latex: '\\eta = 1 - \\frac{T_L}{T_H}', value: results.stats.eta, display: true },
      ]}
    />
  ) : null;

  const stats = results ? (
    <div className="stats-row">
      <StatCard label="Rendimento Carnot" value={`${results.stats.eta.toFixed(2)}%`} accent color={COLOR} />
      <StatCard label="Potenza Netta" value={`${results.stats.power.toFixed(1)} kW`} />
      <StatCard label="Calore In" value={`${results.stats.Q_in.toFixed(1)} kJ/kg`} />
      <StatCard label="Calore Out" value={`${results.stats.Q_out.toFixed(1)} kJ/kg`} />
    </div>
  ) : null;

  return (
    <CyclePageLayout
      badge="Ciclo Ideale"
      title="Ciclo"
      titleAccent="Carnot"
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
      EmptyIcon={RotateCw}
    >
      <h3 className="card-title">Parametri del Ciclo</h3>
      <p className="input-hint">
        Ciclo di Carnot ideale su gas ideale. Il rendimento dipende solo dalle temperature assolute delle sorgenti.
      </p>
      <div className="inputs-grid">
        <InputField label="Temperatura Alta" value={inputs.t_high} onChange={(value) => setInputs({ ...inputs, t_high: value })} unit="°C" accent={COLOR} />
        <InputField label="Temperatura Bassa" value={inputs.t_low} onChange={(value) => setInputs({ ...inputs, t_low: value })} unit="°C" accent={COLOR} />
      </div>
      <div className="inputs-row">
        <InputField label="Pressione di Riferimento" value={inputs.p_ref} onChange={(value) => setInputs({ ...inputs, p_ref: value })} unit="bar" accent={COLOR} />
        <InputField label="Portata Massica" value={inputs.mass_flow} onChange={(value) => setInputs({ ...inputs, mass_flow: value })} unit="kg/s" step={0.1} accent={COLOR} />
      </div>
    </CyclePageLayout>
  );
};

export default CarnotPage;
