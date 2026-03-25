import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Zap } from 'lucide-react';
import CyclePageLayout from './shared/CyclePageLayout';
import InputField from './shared/InputField';
import StatCard from './shared/StatCard';
import FormulasSection from './shared/FormulasSection';
import SchematicDiagram from './shared/SchematicDiagram';
import { plotLayout, plotConfig, addTrace, clampLogRange, pointAnnotations } from './shared/plotConfig';
import { renderPlot, cleanupPlot } from '../utils/plotly';
import { calcOttoCycle } from '../utils/idealGas';
import { generateProcessPath } from '../utils/processPath';

const COLOR = '#FCD34D';
const SEGMENT_COLORS = [COLOR, '#EF4444', '#22D3EE', '#60A5FA'];
const IDEAL_COLOR = '#475569';
const isFiniteNumber = (value) => Number.isFinite(value);

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
    r: 8.5,
    p_low: 1.0,
    t_min: 25,
    t_max: 1200,
    eta_s: 0.9,
    mass_flow: 1.0,
  });

  useEffect(() => {
    if (!results) return;

    const renderAllPlots = async () => {
      const pts = results.allPoints;
      const idealPts = results.idealPoints;

      const realPathOptions = [
        { processType: 'polytropic', model: 'ideal-gas' },
        { processType: 'isochoric', model: 'ideal-gas' },
        { processType: 'polytropic', model: 'ideal-gas' },
        { processType: 'isochoric', model: 'ideal-gas' },
      ];

      const idealPathOptions = [
        { processType: 'isentropic', model: 'ideal-gas' },
        { processType: 'isochoric', model: 'ideal-gas' },
        { processType: 'isentropic', model: 'ideal-gas' },
        { processType: 'isochoric', model: 'ideal-gas' },
      ];

      const [realPaths, idealPaths] = await Promise.all([
        Promise.all([
          generateProcessPath(pts[0], pts[1], 'Air', 64, realPathOptions[0]),
          generateProcessPath(pts[1], pts[2], 'Air', 64, realPathOptions[1]),
          generateProcessPath(pts[2], pts[3], 'Air', 64, realPathOptions[2]),
          generateProcessPath(pts[3], pts[0], 'Air', 64, realPathOptions[3]),
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

      if (tsRef.current) {
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
          addTrace(pts.map((p) => p.s), pts.map((p) => p.t), {
            color: COLOR,
            mode: 'markers',
            markerSize: 10,
          }),
          addTrace(idealPts.map((p) => p.s), idealPts.map((p) => p.t), {
            color: IDEAL_COLOR,
            mode: 'markers',
            markerSize: 7,
          }),
        ];
        const layout = plotLayout('Entropia s (kJ/(kg\u00B7K))', 'Temperatura T (\u00B0C)');
        layout.annotations = [
          ...pointAnnotations(
            pts.map((p) => ({ x: p.s, y: p.t })),
            ['1\nAspirazione', '2\nCompressione', '3\nCombustione', '4\nEspansione'],
            COLOR,
          ),
          ...pointAnnotations(
            [
              { x: idealPts[1].s, y: idealPts[1].t },
              { x: idealPts[3].s, y: idealPts[3].t },
            ],
            ['2s', '4s'],
            IDEAL_COLOR,
          ),
        ];
        renderPlot(tsRef.current, data, layout, plotConfig);
      }

      if (pvRef.current) {
        const pvData = [
          ...realPaths.map((path, index) =>
            addTrace(path.map((p) => p.v), path.map((p) => p.p), {
              name: `Tratto ${index + 1}`,
              color: SEGMENT_COLORS[index],
              width: 3,
              mode: 'lines',
            }),
          ),
          ...addIdealTraces((p) => p.v, (p) => p.p),
          addTrace(pts.map((p) => p.v), pts.map((p) => p.p), {
            color: COLOR,
            mode: 'markers',
            markerSize: 10,
          }),
          addTrace(idealPts.map((p) => p.v), idealPts.map((p) => p.p), {
            color: IDEAL_COLOR,
            mode: 'markers',
            markerSize: 7,
          }),
        ];
        const allV = pvData.flatMap((t) => t.x);
        const allP = pvData.flatMap((t) => t.y);
        const layout = plotLayout('Volume specifico v (m\u00B3/kg)', 'Pressione P (bar)', {
          xaxis: { type: 'log', range: clampLogRange(allV, { minMag: -3, maxMag: 2 }) },
          yaxis: { type: 'log', range: clampLogRange(allP, { minMag: -1, maxMag: 3 }) },
        });
        layout.annotations = [
          ...pointAnnotations(pts.map((p) => ({ x: p.v, y: p.p })), ['1', '2', '3', '4'], COLOR),
          ...pointAnnotations(
            [
              { x: idealPts[1].v, y: idealPts[1].p },
              { x: idealPts[3].v, y: idealPts[3].p },
            ],
            ['2s', '4s'],
            IDEAL_COLOR,
          ),
        ];
        renderPlot(pvRef.current, pvData, layout, plotConfig);
      }

      if (hsRef.current) {
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
          addTrace(pts.map((p) => p.s), pts.map((p) => p.h), {
            color: COLOR,
            mode: 'markers',
            markerSize: 10,
          }),
          addTrace(idealPts.map((p) => p.s), idealPts.map((p) => p.h), {
            color: IDEAL_COLOR,
            mode: 'markers',
            markerSize: 7,
          }),
        ];
        const layout = plotLayout('Entropia s (kJ/(kg\u00B7K))', 'Entalpia h (kJ/kg)');
        layout.annotations = [
          ...pointAnnotations(pts.map((p) => ({ x: p.s, y: p.h })), ['1', '2', '3', '4'], COLOR),
          ...pointAnnotations(
            [
              { x: idealPts[1].s, y: idealPts[1].h },
              { x: idealPts[3].s, y: idealPts[3].h },
            ],
            ['2s', '4s'],
            IDEAL_COLOR,
          ),
        ];
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

  const canCalculate = isFiniteNumber(inputs.r)
    && isFiniteNumber(inputs.p_low)
    && isFiniteNumber(inputs.t_min)
    && isFiniteNumber(inputs.t_max)
    && isFiniteNumber(inputs.eta_s)
    && isFiniteNumber(inputs.mass_flow)
    && inputs.r > 1
    && inputs.p_low > 0
    && inputs.t_max > inputs.t_min
    && inputs.eta_s > 0
    && inputs.eta_s <= 1
    && inputs.mass_flow > 0;

  const calculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const cycle = calcOttoCycle({
        p1Bar: inputs.p_low,
        t1C: inputs.t_min,
        r: inputs.r,
        t3C: inputs.t_max,
        eta: inputs.eta_s,
        massFlow: inputs.mass_flow,
      });

      setResults({
        allPoints: cycle.points,
        idealPoints: cycle.idealPoints,
        stats: cycle.stats,
      });
    } catch (calculationError) {
      setError('Dati non validi: controlla rapporto di compressione, temperatura massima e rendimento.');
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
        title: 'Otto',
        accentColor: COLOR,
        inputs,
        stats: results.stats,
        points: results.allPoints.map((p, index) => ({
          label: ['1: Aspir.', '2: Compr.', '3: Comb.', '4: Esp.'][index],
          t: p.t,
          p: p.p,
          h: p.h,
          s: p.s,
          v: p.v,
        })),
        formulas: [
          {
            label: 'Rendimento ideale',
            latex: '\\eta_{otto} = 1 - \\frac{1}{r^{k-1}}',
            value: results.stats.eta_ideal,
            numeric: `(1 - 1 / ${inputs.r.toFixed(3)}^(1.4 - 1)) \u00D7 100 = ${results.stats.eta_ideal.toFixed(2)} %`,
          },
          {
            label: 'Lavoro netto',
            latex: 'w_{net} = q_{in} - q_{out}',
            value: results.stats.q_in - results.stats.q_out,
            numeric: `${results.stats.q_in.toFixed(2)} - ${results.stats.q_out.toFixed(2)} = ${(results.stats.q_in - results.stats.q_out).toFixed(2)} kJ/kg`,
          },
          {
            label: 'Rendimento reale',
            latex: '\\eta = \\frac{w_{net}}{q_{in}}',
            value: results.stats.eta,
            numeric: `((${(results.stats.q_in - results.stats.q_out).toFixed(2)}) / ${results.stats.q_in.toFixed(2)}) \u00D7 100 = ${results.stats.eta.toFixed(2)} %`,
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
    { id: 'schema', label: 'Schema', active: activeTab === 3, onClick: () => setActiveTab(3), content: <div ref={schematicRef}><SchematicDiagram type="otto" accentColor={COLOR} {...schematicProps} /></div> },
  ] : null;

  const formulasSection = results ? (
    <FormulasSection
      accentColor={COLOR}
      points={results.allPoints.map((p, index) => ({
        label: ['1: Aspir.', '2: Compr.', '3: Comb.', '4: Esp.'][index],
        t: p.t,
        p: p.p,
        h: p.h,
        s: p.s,
        v: p.v,
      }))}
      formulas={[
        { label: 'Rapporto di compressione', latex: 'r = \\frac{v_1}{v_2}', value: inputs.r },
        { label: '1 -> 2', latex: 'Compressione politropica reale con v_2 = \\frac{v_1}{r}' },
        { label: '2 -> 3', latex: 'Apporto di calore a volume costante' },
        { label: '3 -> 4', latex: 'Espansione politropica reale fino a v_4 = v_1' },
        { label: '4 -> 1', latex: 'Cessione di calore a volume costante' },
        { label: 'Calore in ingresso', latex: 'q_{in} = c_v (T_3 - T_2)', value: results.stats.q_in },
        { label: 'Calore in uscita', latex: 'q_{out} = c_v (T_4 - T_1)', value: results.stats.q_out },
        { label: 'Rendimento ideale', latex: '\\eta_{otto} = 1 - \\frac{1}{r^{k-1}}', value: results.stats.eta_ideal, display: true },
        { label: 'Rendimento reale', latex: '\\eta = \\frac{q_{in} - q_{out}}{q_{in}} \\times 100', value: results.stats.eta },
      ]}
    />
  ) : null;

  const stats = results ? (
    <div className="stats-row">
      <StatCard label="Rendimento" value={`${results.stats.eta.toFixed(2)}%`} accent color={COLOR} />
      <StatCard label="Lavoro Netto" value={`${(results.stats.q_in - results.stats.q_out).toFixed(1)} kJ/kg`} />
      <StatCard label="Calore In" value={`${results.stats.q_in.toFixed(1)} kJ/kg`} />
      <StatCard label="Calore Out" value={`${results.stats.q_out.toFixed(1)} kJ/kg`} />
    </div>
  ) : null;

  return (
    <CyclePageLayout
      badge="Accensione Comandata"
      title="Ciclo"
      titleAccent="Otto"
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
      EmptyIcon={Zap}
    >
      <h3 className="card-title">Parametri Motore</h3>
      <div className="inputs-grid">
        <InputField label="Rapporto di Compressione" value={inputs.r} onChange={(value) => setInputs({ ...inputs, r: value })} accent={COLOR} />
        <InputField label="Pressione Iniziale" value={inputs.p_low} onChange={(value) => setInputs({ ...inputs, p_low: value })} unit="bar" accent={COLOR} />
        <InputField label="Temperatura Iniziale" value={inputs.t_min} onChange={(value) => setInputs({ ...inputs, t_min: value })} unit="°C" accent={COLOR} />
      </div>
      <div className="inputs-row">
        <InputField label="Temperatura Massima" value={inputs.t_max} onChange={(value) => setInputs({ ...inputs, t_max: value })} unit="°C" accent={COLOR} />
        <InputField label="Rendimento Isentropico" value={inputs.eta_s} onChange={(value) => setInputs({ ...inputs, eta_s: value })} step={0.01} min={0.5} max={1} accent={COLOR} />
      </div>
      <InputField label="Portata Massica" value={inputs.mass_flow} onChange={(value) => setInputs({ ...inputs, mass_flow: value })} unit="kg/s" step={0.1} accent={COLOR} />
    </CyclePageLayout>
  );
};

export default OttoPage;
