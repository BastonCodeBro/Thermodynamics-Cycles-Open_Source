import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Flame } from 'lucide-react';
import { solveFluid, getSaturationDomeFull } from '../utils/waterProps';
import { generateProcessPath } from '../utils/processPath';
import CyclePageLayout from './shared/CyclePageLayout';
import InputField from './shared/InputField';
import StatCard from './shared/StatCard';
import FormulasSection from './shared/FormulasSection';
import SchematicDiagram from './shared/SchematicDiagram';
import {
  plotLayout,
  plotConfig,
  addTrace,
  addDomeTrace,
  addFillTrace,
} from './shared/plotConfig';
import { renderPlot, cleanupPlot } from '../utils/plotly';

const COLOR = '#38BDF8';
const IDEAL_COLOR = '#60A5FA';
const HEAT_COLOR = '#F97316';
const COOL_COLOR = '#22D3EE';
const TURBINE_COLOR = '#EF4444';
const PUMP_COLOR = '#F59E0B';
const LOSS_COLOR = '#CBD5E1';

const isFiniteNumber = (value) => Number.isFinite(value);
const directSegment = (from, to) => [{ ...from }, { ...to }];

const pointAnnotations = (points, labels, color) =>
  points.map((point, index) => ({
    x: point.x,
    y: point.y,
    text: labels[index],
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
    p_high: 100,
    p_low: 0.1,
    t_max: 500,
    eta_t: 0.85,
    eta_p: 0.85,
    mass_flow: 1.0,
  });

  useEffect(() => {
    if (!results) return undefined;

    const realLabels = ['1', '2', '3', '4'];

    const renderAllPlots = () => {
      if (tsRef.current) {
        const data = [
          results.dome?.ts?.s?.length
            ? addFillTrace(results.dome.ts.s, results.dome.ts.t, {
                fillcolor: 'rgba(56, 189, 248, 0.08)',
                name: 'Cupola di saturazione',
              })
            : null,
          results.dome?.ts?.s?.length ? addDomeTrace(results.dome.ts.s, results.dome.ts.t) : null,
          ...results.idealPaths.map((path, index) =>
            addTrace(path.map((point) => point.s), path.map((point) => point.t), {
              name: `Ideale ${index + 1}`,
              color: IDEAL_COLOR,
              width: 2,
              dash: 'dash',
              mode: 'lines',
            }),
          ),
          addTrace(results.actualPaths[0].map((point) => point.s), results.actualPaths[0].map((point) => point.t), {
            name: 'Pompa reale',
            color: PUMP_COLOR,
            width: 3,
            mode: 'lines',
          }),
          addTrace(results.actualPaths[1].map((point) => point.s), results.actualPaths[1].map((point) => point.t), {
            name: 'Caldaia',
            color: HEAT_COLOR,
            width: 3,
            mode: 'lines',
          }),
          addTrace(results.actualPaths[2].map((point) => point.s), results.actualPaths[2].map((point) => point.t), {
            name: 'Turbina reale',
            color: TURBINE_COLOR,
            width: 3,
            mode: 'lines',
          }),
          addTrace(results.actualPaths[3].map((point) => point.s), results.actualPaths[3].map((point) => point.t), {
            name: 'Condensatore',
            color: COOL_COLOR,
            width: 3,
            mode: 'lines',
          }),
          ...results.lossPaths.map((path, index) =>
            addTrace(path.map((point) => point.s), path.map((point) => point.t), {
              name: `Scarto ${index + 1}`,
              color: LOSS_COLOR,
              width: 1.5,
              dash: 'dot',
              mode: 'lines',
            }),
          ),
          addTrace(results.actualPoints.map((point) => point.s), results.actualPoints.map((point) => point.t), {
            name: 'Stati reali',
            color: COLOR,
            mode: 'markers',
            markerSize: 10,
          }),
          addTrace(results.idealPoints.map((point) => point.s), results.idealPoints.map((point) => point.t), {
            name: 'Stati ideali',
            color: IDEAL_COLOR,
            mode: 'markers',
            markerSize: 8,
          }),
        ].filter(Boolean);

        const layout = plotLayout('Entropia s (kJ/(kg·K))', 'Temperatura T (°C)');
        layout.annotations = [
          ...pointAnnotations(
            results.actualPoints.map((point) => ({ x: point.s, y: point.t })),
            realLabels,
            COLOR,
          ),
          ...pointAnnotations(
            [
              { x: results.idealPoints[1].s, y: results.idealPoints[1].t },
              { x: results.idealPoints[3].s, y: results.idealPoints[3].t },
            ],
            ['2s', '4s'],
            IDEAL_COLOR,
          ),
        ];
        renderPlot(tsRef.current, data, layout, plotConfig);
      }

      if (hsRef.current) {
        const data = [
          results.dome?.hs?.s?.length
            ? addFillTrace(results.dome.hs.s, results.dome.hs.h, {
                fillcolor: 'rgba(56, 189, 248, 0.08)',
                name: 'Cupola di saturazione',
              })
            : null,
          results.dome?.hs?.s?.length ? addDomeTrace(results.dome.hs.s, results.dome.hs.h) : null,
          ...results.idealPaths.map((path, index) =>
            addTrace(path.map((point) => point.s), path.map((point) => point.h), {
              name: `Ideale ${index + 1}`,
              color: IDEAL_COLOR,
              width: 2,
              dash: 'dash',
              mode: 'lines',
            }),
          ),
          addTrace(results.actualPaths[0].map((point) => point.s), results.actualPaths[0].map((point) => point.h), {
            name: 'Pompa reale',
            color: PUMP_COLOR,
            width: 3,
            mode: 'lines',
          }),
          addTrace(results.actualPaths[1].map((point) => point.s), results.actualPaths[1].map((point) => point.h), {
            name: 'Caldaia',
            color: HEAT_COLOR,
            width: 3,
            mode: 'lines',
          }),
          addTrace(results.actualPaths[2].map((point) => point.s), results.actualPaths[2].map((point) => point.h), {
            name: 'Turbina reale',
            color: TURBINE_COLOR,
            width: 3,
            mode: 'lines',
          }),
          addTrace(results.actualPaths[3].map((point) => point.s), results.actualPaths[3].map((point) => point.h), {
            name: 'Condensatore',
            color: COOL_COLOR,
            width: 3,
            mode: 'lines',
          }),
          ...results.lossPaths.map((path, index) =>
            addTrace(path.map((point) => point.s), path.map((point) => point.h), {
              name: `Scarto ${index + 1}`,
              color: LOSS_COLOR,
              width: 1.5,
              dash: 'dot',
              mode: 'lines',
            }),
          ),
          addTrace(results.actualPoints.map((point) => point.s), results.actualPoints.map((point) => point.h), {
            name: 'Stati reali',
            color: COLOR,
            mode: 'markers',
            markerSize: 10,
          }),
          addTrace(results.idealPoints.map((point) => point.s), results.idealPoints.map((point) => point.h), {
            name: 'Stati ideali',
            color: IDEAL_COLOR,
            mode: 'markers',
            markerSize: 8,
          }),
        ].filter(Boolean);

        const layout = plotLayout('Entropia s (kJ/(kg·K))', 'Entalpia h (kJ/kg)');
        layout.annotations = [
          ...pointAnnotations(
            results.actualPoints.map((point) => ({ x: point.s, y: point.h })),
            realLabels,
            COLOR,
          ),
          ...pointAnnotations(
            [
              { x: results.idealPoints[1].s, y: results.idealPoints[1].h },
              { x: results.idealPoints[3].s, y: results.idealPoints[3].h },
            ],
            ['2s', '4s'],
            IDEAL_COLOR,
          ),
        ];
        renderPlot(hsRef.current, data, layout, plotConfig);
      }

      if (pvRef.current) {
        const data = [
          results.dome?.pv?.v?.length
            ? addFillTrace(results.dome.pv.v, results.dome.pv.p, {
                fillcolor: 'rgba(56, 189, 248, 0.08)',
                name: 'Cupola di saturazione',
              })
            : null,
          results.dome?.pv?.v?.length ? addDomeTrace(results.dome.pv.v, results.dome.pv.p) : null,
          ...results.idealPaths.map((path, index) =>
            addTrace(path.map((point) => point.v), path.map((point) => point.p), {
              name: `Ideale ${index + 1}`,
              color: IDEAL_COLOR,
              width: 2,
              dash: 'dash',
              mode: 'lines',
            }),
          ),
          addTrace(results.actualPaths[0].map((point) => point.v), results.actualPaths[0].map((point) => point.p), {
            name: 'Pompa reale',
            color: PUMP_COLOR,
            width: 3,
            mode: 'lines',
          }),
          addTrace(results.actualPaths[1].map((point) => point.v), results.actualPaths[1].map((point) => point.p), {
            name: 'Caldaia',
            color: HEAT_COLOR,
            width: 3,
            mode: 'lines',
          }),
          addTrace(results.actualPaths[2].map((point) => point.v), results.actualPaths[2].map((point) => point.p), {
            name: 'Turbina reale',
            color: TURBINE_COLOR,
            width: 3,
            mode: 'lines',
          }),
          addTrace(results.actualPaths[3].map((point) => point.v), results.actualPaths[3].map((point) => point.p), {
            name: 'Condensatore',
            color: COOL_COLOR,
            width: 3,
            mode: 'lines',
          }),
          ...results.lossPaths.map((path, index) =>
            addTrace(path.map((point) => point.v), path.map((point) => point.p), {
              name: `Scarto ${index + 1}`,
              color: LOSS_COLOR,
              width: 1.5,
              dash: 'dot',
              mode: 'lines',
            }),
          ),
          addTrace(results.actualPoints.map((point) => point.v), results.actualPoints.map((point) => point.p), {
            name: 'Stati reali',
            color: COLOR,
            mode: 'markers',
            markerSize: 10,
          }),
          addTrace(results.idealPoints.map((point) => point.v), results.idealPoints.map((point) => point.p), {
            name: 'Stati ideali',
            color: IDEAL_COLOR,
            mode: 'markers',
            markerSize: 8,
          }),
        ].filter(Boolean);

        const layout = plotLayout('Volume specifico v (m³/kg)', 'Pressione P (bar)', {
          xaxis: { type: 'log' },
          yaxis: { type: 'log' },
        });
        layout.annotations = [
          ...pointAnnotations(
            results.actualPoints.map((point) => ({ x: point.v, y: point.p })),
            realLabels,
            COLOR,
          ),
          ...pointAnnotations(
            [
              { x: results.idealPoints[1].v, y: results.idealPoints[1].p },
              { x: results.idealPoints[3].v, y: results.idealPoints[3].p },
            ],
            ['2s', '4s'],
            IDEAL_COLOR,
          ),
        ];
        renderPlot(pvRef.current, data, layout, plotConfig);
      }
    };

    renderAllPlots();
    return () => {
      cleanupPlot(tsRef.current);
      cleanupPlot(hsRef.current);
      cleanupPlot(pvRef.current);
    };
  }, [results]);

  const canCalculate =
    isFiniteNumber(inputs.p_high) &&
    isFiniteNumber(inputs.p_low) &&
    isFiniteNumber(inputs.t_max) &&
    isFiniteNumber(inputs.eta_t) &&
    isFiniteNumber(inputs.eta_p) &&
    isFiniteNumber(inputs.mass_flow) &&
    inputs.p_high > inputs.p_low &&
    inputs.p_low > 0 &&
    inputs.eta_t > 0 &&
    inputs.eta_t <= 1 &&
    inputs.eta_p > 0 &&
    inputs.eta_p <= 1 &&
    inputs.mass_flow > 0;

  const calculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const st1 = await solveFluid({ p: inputs.p_low, q: 0 });
      const st2s = await solveFluid({ p: inputs.p_high, s: st1.s });
      const h2 = st1.h + (st2s.h - st1.h) / inputs.eta_p;
      const st2 = await solveFluid({ p: inputs.p_high, h: h2 });
      const st3 = await solveFluid({ p: inputs.p_high, t: inputs.t_max });
      const st4s = await solveFluid({ p: inputs.p_low, s: st3.s });
      const h4 = st3.h - (st3.h - st4s.h) * inputs.eta_t;
      const st4 = await solveFluid({ p: inputs.p_low, h: h4 });

      const wt = st3.h - st4.h;
      const wp = st2.h - st1.h;
      const qIn = st3.h - st2.h;
      const wNet = wt - wp;
      const qOut = qIn - wNet;

      const [boilerPath, condenserPath, pumpClosure, turbineClosure, dome] = await Promise.all([
        generateProcessPath(st2, st3, 'Water', 80),
        generateProcessPath(st4, st1, 'Water', 80),
        generateProcessPath(st2, st2s, 'Water', 30),
        generateProcessPath(st4, st4s, 'Water', 30),
        getSaturationDomeFull('Water'),
      ]);

      const idealPaths = [
        generateProcessPath(st1, st2s, 'Water', 56),
        generateProcessPath(st2s, st3, 'Water', 80),
        generateProcessPath(st3, st4s, 'Water', 56),
        generateProcessPath(st4s, st1, 'Water', 80),
      ];

      const resolvedIdealPaths = await Promise.all(idealPaths);

      setResults({
        actualPoints: [st1, st2, st3, st4],
        idealPoints: [st1, st2s, st3, st4s],
        actualPaths: [
          directSegment(st1, st2),
          boilerPath,
          directSegment(st3, st4),
          condenserPath,
        ],
        idealPaths: resolvedIdealPaths,
        lossPaths: [pumpClosure, turbineClosure],
        dome,
        stats: {
          wt,
          wp,
          q_in: qIn,
          q_out: qOut,
          eta: (wNet / qIn) * 100,
          power: wNet * inputs.mass_flow,
        },
      });
    } catch (calculationError) {
      setError('Errore nel calcolo: verifica che il punto 3 sia coerente con la pressione di caldaia.');
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
        title: 'Rankine',
        accentColor: COLOR,
        inputs,
        stats: results.stats,
        points: results.actualPoints.map((point, index) => ({
          label: ['1: Condensatore out', '2: Pompa out reale', '3: Caldaia out', '4: Turbina out reale'][index],
          t: point.t,
          p: point.p,
          h: point.h,
          s: point.s,
          v: point.v,
        })),
        formulas: [
          {
            label: 'Lavoro turbina',
            latex: 'w_t = h_3 - h_4',
            value: results.stats.wt,
            numeric: `${results.actualPoints[2].h.toFixed(2)} - ${results.actualPoints[3].h.toFixed(2)} = ${results.stats.wt.toFixed(2)} kJ/kg`,
          },
          {
            label: 'Lavoro pompa',
            latex: 'w_p = h_2 - h_1',
            value: results.stats.wp,
            numeric: `${results.actualPoints[1].h.toFixed(2)} - ${results.actualPoints[0].h.toFixed(2)} = ${results.stats.wp.toFixed(2)} kJ/kg`,
          },
          {
            label: 'Calore fornito',
            latex: 'q_{in} = h_3 - h_2',
            value: results.stats.q_in,
            numeric: `${results.actualPoints[2].h.toFixed(2)} - ${results.actualPoints[1].h.toFixed(2)} = ${results.stats.q_in.toFixed(2)} kJ/kg`,
          },
          {
            label: 'Rendimento',
            latex: '\\eta = \\frac{w_t - w_p}{q_{in}}',
            value: results.stats.eta,
            numeric: `((${results.stats.wt.toFixed(2)} - ${results.stats.wp.toFixed(2)}) / ${results.stats.q_in.toFixed(2)}) * 100 = ${results.stats.eta.toFixed(2)} %`,
          },
          {
            label: 'Pompa reale',
            latex: 'h_2 = h_1 + \\frac{h_{2s} - h_1}{\\eta_p}',
            numeric: `${results.actualPoints[0].h.toFixed(2)} + ((${results.idealPoints[1].h.toFixed(2)} - ${results.actualPoints[0].h.toFixed(2)}) / ${inputs.eta_p.toFixed(3)}) = ${results.actualPoints[1].h.toFixed(2)} kJ/kg`,
          },
          {
            label: 'Turbina reale',
            latex: 'h_4 = h_3 - \\eta_t (h_3 - h_{4s})',
            numeric: `${results.actualPoints[2].h.toFixed(2)} - ${inputs.eta_t.toFixed(3)} * (${results.actualPoints[2].h.toFixed(2)} - ${results.idealPoints[3].h.toFixed(2)}) = ${results.actualPoints[3].h.toFixed(2)} kJ/kg`,
          },
        ],
        plotRefs: { ts: tsRef, hs: hsRef, pv: pvRef },
        schematicRef,
      });
    } catch (downloadError) {
      console.error('PDF export error:', downloadError);
    } finally {
      setDownloadingPDF(false);
    }
  }, [inputs, results]);

  const schematicProps = results ? {
    points: results.actualPoints,
    pointLabels: ['1 Uscita condensatore', '2 Uscita pompa', '3 Uscita caldaia', '4 Uscita turbina'],
    summaryItems: [
      { label: 'Lavoro pompa', value: `${results.stats.wp.toFixed(1)} kJ/kg`, color: PUMP_COLOR },
      { label: 'Lavoro turbina', value: `${results.stats.wt.toFixed(1)} kJ/kg`, color: TURBINE_COLOR },
      { label: 'Calore in', value: `${results.stats.q_in.toFixed(1)} kJ/kg`, color: HEAT_COLOR },
      { label: 'Calore out', value: `${results.stats.q_out.toFixed(1)} kJ/kg`, color: COOL_COLOR },
      { label: 'Rendimento', value: `${results.stats.eta.toFixed(2)} %`, color: COLOR },
    ],
  } : null;

  const diagramTabs = results
    ? [
        {
          id: 'ts',
          label: 'T-s',
          active: activeTab === 0,
          onClick: () => setActiveTab(0),
          content: <div ref={tsRef} className="plot-area" />,
        },
        {
          id: 'hs',
          label: 'h-s',
          active: activeTab === 1,
          onClick: () => setActiveTab(1),
          content: <div ref={hsRef} className="plot-area" />,
        },
        {
          id: 'pv',
          label: 'P-v',
          active: activeTab === 2,
          onClick: () => setActiveTab(2),
          content: <div ref={pvRef} className="plot-area" />,
        },
        {
          id: 'schema',
          label: 'Schema',
          active: activeTab === 3,
          onClick: () => setActiveTab(3),
          content: (
            <div ref={schematicRef}>
              <SchematicDiagram type="rankine" accentColor={COLOR} {...schematicProps} />
            </div>
          ),
        },
      ]
    : null;

  const formulasSection = results ? (
    <FormulasSection
      accentColor={COLOR}
      points={[
        ...results.actualPoints.map((point, index) => ({
          label: ['1', '2', '3', '4'][index],
          t: point.t,
          p: point.p,
          h: point.h,
          s: point.s,
          v: point.v,
        })),
        {
          label: '2s',
          t: results.idealPoints[1].t,
          p: results.idealPoints[1].p,
          h: results.idealPoints[1].h,
          s: results.idealPoints[1].s,
          v: results.idealPoints[1].v,
        },
        {
          label: '4s',
          t: results.idealPoints[3].t,
          p: results.idealPoints[3].p,
          h: results.idealPoints[3].h,
          s: results.idealPoints[3].s,
          v: results.idealPoints[3].v,
        },
      ]}
      formulas={[
        { label: 'Punto 1', latex: 'P_1 = P_{low}, \\quad x_1 = 0' },
        { label: 'Punto 2s', latex: 's_{2s} = s_1, \\quad P_{2s} = P_{high}' },
        { label: 'Punto 2 reale', latex: 'h_2 = h_1 + \\frac{h_{2s} - h_1}{\\eta_p}' },
        { label: 'Punto 3', latex: 'P_3 = P_{high}, \\quad T_3 = T_{max}' },
        { label: 'Punto 4s', latex: 's_{4s} = s_3, \\quad P_{4s} = P_{low}' },
        { label: 'Punto 4 reale', latex: 'h_4 = h_3 - \\eta_t (h_3 - h_{4s})' },
        { label: 'Lavoro turbina', latex: 'w_t = h_3 - h_4', value: results.stats.wt, unit: 'kJ/kg' },
        { label: 'Lavoro pompa', latex: 'w_p = h_2 - h_1', value: results.stats.wp, unit: 'kJ/kg' },
        { label: 'Calore fornito', latex: 'q_{in} = h_3 - h_2', value: results.stats.q_in, unit: 'kJ/kg' },
        {
          label: 'Rendimento ciclo',
          latex: '\\eta = \\frac{w_t - w_p}{q_{in}} \\times 100',
          value: results.stats.eta,
          unit: '%',
          display: true,
        },
        { label: 'Potenza netta', latex: '\\dot{W}_{net} = \\dot{m}(w_t - w_p)', value: results.stats.power, unit: 'kW' },
      ]}
    />
  ) : null;

  const stats = results ? (
    <div className="stats-row">
      <StatCard label="Rendimento" value={`${results.stats.eta.toFixed(2)}%`} accent color={COLOR} />
      <StatCard label="Potenza netta" value={`${(results.stats.power / 1000).toFixed(2)} MW`} />
      <StatCard label="Lavoro turbina" value={`${results.stats.wt.toFixed(1)} kJ/kg`} />
      <StatCard label="Calore fornito" value={`${results.stats.q_in.toFixed(1)} kJ/kg`} />
    </div>
  ) : null;

  return (
    <CyclePageLayout
      badge="Ciclo a vapore"
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
      <h3 className="card-title">Parametri di ingresso</h3>
      <div className="inputs-grid">
        <InputField
          label="Pressione caldaia"
          value={inputs.p_high}
          onChange={(value) => setInputs({ ...inputs, p_high: value })}
          unit="bar"
          accent={COLOR}
        />
        <InputField
          label="Pressione condensatore"
          value={inputs.p_low}
          onChange={(value) => setInputs({ ...inputs, p_low: value })}
          unit="bar"
          accent={COLOR}
        />
        <InputField
          label="Temperatura massima"
          value={inputs.t_max}
          onChange={(value) => setInputs({ ...inputs, t_max: value })}
          unit="°C"
          accent={COLOR}
        />
      </div>
      <div className="inputs-row">
        <InputField
          label="Rend. Isentropico Turbina (ηt)"
          value={inputs.eta_t}
          onChange={(value) => setInputs({ ...inputs, eta_t: value })}
          step={0.01}
          min={0.5}
          max={1}
          accent={COLOR}
        />
        <InputField
          label="Rend. Isentropico Pompa (ηp)"
          value={inputs.eta_p}
          onChange={(value) => setInputs({ ...inputs, eta_p: value })}
          step={0.01}
          min={0.5}
          max={1}
          accent={COLOR}
        />
      </div>
      <InputField
        label="Portata massica"
        value={inputs.mass_flow}
        onChange={(value) => setInputs({ ...inputs, mass_flow: value })}
        unit="kg/s"
        step={0.1}
        accent={COLOR}
      />
    </CyclePageLayout>
  );
};

export default RankinePage;
