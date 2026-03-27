import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Snowflake } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { solveFluid, getSaturationDomeFull } from '../utils/waterProps';
import { generateProcessPath } from '../utils/processPath';
import CyclePageLayout from './shared/CyclePageLayout';
import InputField from './shared/InputField';
import StatCard from './shared/StatCard';
import FormulasSection from './shared/FormulasSection';
import SchematicDiagram from './shared/SchematicDiagram';
import { plotLayout, plotConfig, addTrace, addDomeTrace, pointAnnotations } from './shared/plotConfig';
import { renderPlot, cleanupPlot } from '../utils/plotly';

const COLOR = '#10B981';
const SEGMENT_COLORS = ['#10B981', '#EF4444', '#60A5FA', '#A78BFA'];
const MODES = {
  refrigerator: {
    label: 'Frigorifero',
    title: 'Frigorifero',
  },
  'heat-pump': {
    label: 'Pompa di calore',
    title: 'Pompa di Calore',
  },
};

const REFRIGERANTS = [
  { id: 'R134a', name: 'R134a' },
  { id: 'R410A', name: 'R410A' },
  { id: 'R32', name: 'R32' },
  { id: 'R22', name: 'R22' },
  { id: 'R290', name: 'R290 (Propano)' },
  { id: 'R600a', name: 'R600a (Isobutano)' },
];

const presetMap = {
  refrigerator: [
    { label: 'Base', values: { t_evap: -10, t_cond: 40, sh: 5, sc: 5, eta_s: 0.8, mass_flow: 0.1 } },
    { label: 'Caso esame', values: { t_evap: -15, t_cond: 38, sh: 6, sc: 4, eta_s: 0.82, mass_flow: 0.12 } },
    { label: 'Caso inefficiente', values: { t_evap: -5, t_cond: 52, sh: 10, sc: 1, eta_s: 0.68, mass_flow: 0.1 } },
  ],
  'heat-pump': [
    { label: 'Base', values: { t_evap: 0, t_cond: 45, sh: 5, sc: 5, eta_s: 0.8, mass_flow: 0.1 } },
    { label: 'Caso esame', values: { t_evap: 5, t_cond: 50, sh: 4, sc: 4, eta_s: 0.83, mass_flow: 0.12 } },
    { label: 'Caso inefficiente', values: { t_evap: -5, t_cond: 58, sh: 8, sc: 2, eta_s: 0.7, mass_flow: 0.1 } },
  ],
};

const RefrigerationPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = MODES[searchParams.get('mode')] ? searchParams.get('mode') : 'refrigerator';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [refrigerant, setRefrigerant] = useState('R134a');
  const [inputs, setInputs] = useState({
    t_evap: -10,
    t_cond: 40,
    sh: 5,
    sc: 5,
    eta_s: 0.8,
    mass_flow: 0.1,
  });

  const tsRef = useRef(null);
  const phRef = useRef(null);
  const schematicRef = useRef(null);

  const modeOptions = useMemo(
    () => Object.entries(MODES).map(([key, config]) => ({
      label: config.label,
      active: key === mode,
      onClick: () => {
        const next = new URLSearchParams(searchParams);
        next.set('mode', key);
        setSearchParams(next);
      },
    })),
    [mode, searchParams, setSearchParams],
  );

  useEffect(() => {
    if (!results) return undefined;
    const tsNode = tsRef.current;
    const phNode = phRef.current;

    const renderAllPlots = async () => {
      const pts = results.allPoints;
      const paths = results.segmentPaths;
      if (!paths || paths.length !== 4) return;

      if (tsRef.current) {
        const data = [
          addDomeTrace(results.dome.s, results.dome.t),
          results.idealCompPath ? addTrace(
            results.idealCompPath.map((point) => point.s),
            results.idealCompPath.map((point) => point.t),
            { name: 'Compressione ideale', color: '#475569', width: 2, dash: 'dash', mode: 'lines' },
          ) : null,
          ...paths.map((path, index) =>
            addTrace(path.map((point) => point.s), path.map((point) => point.t), {
              name: `Tratto ${index + 1}`,
              color: SEGMENT_COLORS[index],
              width: 3,
              mode: 'lines',
            }),
          ),
          addTrace(pts.map((point) => point.s), pts.map((point) => point.t), { name: 'Stati', color: COLOR, mode: 'markers', markerSize: 8 }),
        ].filter(Boolean);
        const layout = plotLayout('Entropia s (kJ/(kg K))', 'Temperatura T (degC)');
        layout.annotations = [
          ...pointAnnotations(pts.map((point) => ({ x: point.s, y: point.t })), ['1', '2', '3', '4'], COLOR),
          ...(results.idealPoint2s
            ? pointAnnotations([{ x: results.idealPoint2s.s, y: results.idealPoint2s.t }], ['2s'], '#475569')
            : []),
        ];
        renderPlot(tsRef.current, data, layout, plotConfig);
      }

      if (phRef.current) {
        const data = [
          results.domePh ? addDomeTrace(results.domePh.h, results.domePh.p) : null,
          results.idealCompPath ? addTrace(
            results.idealCompPath.map((point) => point.h),
            results.idealCompPath.map((point) => point.p),
            { name: 'Compressione ideale', color: '#475569', width: 2, dash: 'dash', mode: 'lines' },
          ) : null,
          ...paths.map((path, index) =>
            addTrace(path.map((point) => point.h), path.map((point) => point.p), {
              name: `Tratto ${index + 1}`,
              color: SEGMENT_COLORS[index],
              width: 3,
              mode: 'lines',
            }),
          ),
          addTrace(pts.map((point) => point.h), pts.map((point) => point.p), { name: 'Stati', color: COLOR, mode: 'markers', markerSize: 8 }),
        ].filter(Boolean);
        const layout = plotLayout('Entalpia h (kJ/kg)', 'Pressione P (bar)');
        layout.yaxis.type = 'log';
        layout.yaxis.nticks = 8;
        layout.annotations = [
          ...pointAnnotations(pts.map((point) => ({ x: point.h, y: point.p })), ['1', '2', '3', '4'], COLOR),
          ...(results.idealPoint2s
            ? pointAnnotations([{ x: results.idealPoint2s.h, y: results.idealPoint2s.p }], ['2s'], '#475569')
            : []),
        ];
        renderPlot(phRef.current, data, layout, plotConfig);
      }
    };

    renderAllPlots();
    return () => {
      cleanupPlot(tsNode);
      cleanupPlot(phNode);
    };
  }, [results]);

  const canCalculate = Number.isFinite(inputs.t_evap)
    && Number.isFinite(inputs.t_cond)
    && Number.isFinite(inputs.sh)
    && Number.isFinite(inputs.sc)
    && Number.isFinite(inputs.eta_s)
    && Number.isFinite(inputs.mass_flow)
    && inputs.t_cond > inputs.t_evap
    && inputs.sh >= 0
    && inputs.sc >= 0
    && inputs.eta_s > 0
    && inputs.eta_s <= 1
    && inputs.mass_flow > 0;

  const calculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const st1sat = await solveFluid({ t: inputs.t_evap, q: 1 }, refrigerant);
      const st1 = await solveFluid({ p: st1sat.p, t: inputs.t_evap + inputs.sh }, refrigerant);
      const st3sat = await solveFluid({ t: inputs.t_cond, q: 0 }, refrigerant);
      const st2s = await solveFluid({ p: st3sat.p, s: st1.s }, refrigerant);
      const h2r = st1.h + (st2s.h - st1.h) / inputs.eta_s;
      const st2r = await solveFluid({ p: st3sat.p, h: h2r }, refrigerant);
      const st3 = await solveFluid({ p: st3sat.p, t: inputs.t_cond - inputs.sc }, refrigerant);
      const st4 = await solveFluid({ p: st1sat.p, h: st3.h }, refrigerant);

      const win = st2r.h - st1.h;
      const qlow = st1.h - st4.h;
      const qhigh = st2r.h - st3.h;
      const domeFull = await getSaturationDomeFull(refrigerant);
      const [segmentPaths, idealCompPath] = await Promise.all([
        Promise.all([
          generateProcessPath(st1, st2r, refrigerant),
          generateProcessPath(st2r, st3, refrigerant),
          generateProcessPath(st3, st4, refrigerant),
          generateProcessPath(st4, st1, refrigerant),
        ]),
        generateProcessPath(st1, st2s, refrigerant),
      ]);

      setResults({
        allPoints: [st1, st2r, st3, st4],
        idealPoint2s: st2s,
        segmentPaths,
        idealCompPath,
        stats: {
          win,
          qlow,
          qhigh,
          cop: qlow / win,
          cop_hp: qhigh / win,
          useful_capacity: (mode === 'heat-pump' ? qhigh : qlow) * inputs.mass_flow,
        },
        dome: domeFull.ts,
        domePh: domeFull.ph,
      });
    } catch (calculationError) {
      setError('Controlla il salto termico tra evaporazione e condensazione: il ciclo deve avere una sorgente calda più alta della fredda e stati fisicamente accessibili per il refrigerante scelto.');
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
        title: MODES[mode].title,
        accentColor: COLOR,
        inputs: { ...inputs, refrigerant },
        stats: results.stats,
        points: results.allPoints.map((point, index) => ({
          label: ['1: Evap.', '2: Comp.', '3: Cond.', '4: Valv.'][index],
          t: point.t,
          p: point.p,
          h: point.h,
          s: point.s,
          v: point.v,
        })),
        formulas: [
          { label: 'Lavoro compressore', latex: 'w_{in} = h_2 - h_1', value: results.stats.win },
          { label: 'Calore lato freddo', latex: 'q_L = h_1 - h_4', value: results.stats.qlow },
          { label: 'Calore lato caldo', latex: 'q_H = h_2 - h_3', value: results.stats.qhigh },
          { label: 'COP frigorifero', latex: 'COP_{ref} = \\frac{q_L}{w_{in}}', value: results.stats.cop },
          { label: 'COP pompa di calore', latex: 'COP_{HP} = \\frac{q_H}{w_{in}}', value: results.stats.cop_hp },
        ],
        plotRefs: { ts: tsRef, ph: phRef },
        schematicRef,
      });
    } catch (downloadError) {
      console.error(downloadError);
    } finally {
      setDownloadingPDF(false);
    }
  }, [inputs, mode, refrigerant, results]);

  const formulasSection = results ? (
    <FormulasSection
      accentColor={COLOR}
      points={results.allPoints.map((point, index) => ({
        label: ['1: Evap.', '2: Comp.', '3: Cond.', '4: Valv.'][index],
        t: point.t,
        p: point.p,
        h: point.h,
        s: point.s,
        v: point.v,
      }))}
      formulas={[
        { label: 'Punto 1', latex: 'P_1 = P_{sat}(T_{evap}), \\; T_1 = T_{evap} + \\Delta T_{sh}' },
        { label: 'Punto 2', latex: 'h_2 = h_1 + \\frac{h_{2s} - h_1}{\\eta_s}, \\; P_2 = P_{sat}(T_{cond})' },
        { label: 'Punto 3', latex: 'P_3 = P_2, \\; T_3 = T_{cond} - \\Delta T_{sc}' },
        { label: 'Punto 4', latex: 'h_4 = h_3, \\; P_4 = P_1' },
        { label: 'Lavoro compressore', latex: 'w_{in} = h_2 - h_1', value: results.stats.win },
        { label: 'Capacita lato freddo', latex: 'q_L = h_1 - h_4', value: results.stats.qlow },
        { label: 'Capacita lato caldo', latex: 'q_H = h_2 - h_3', value: results.stats.qhigh },
        { label: 'COP frigorifero', latex: 'COP_{ref} = \\frac{q_L}{w_{in}}', value: results.stats.cop, display: true },
        { label: 'COP pompa di calore', latex: 'COP_{HP} = \\frac{q_H}{w_{in}}', value: results.stats.cop_hp, display: true },
      ]}
    />
  ) : null;

  const stats = results ? (
    <div className="stats-row">
      <StatCard label={mode === 'heat-pump' ? 'COP pompa di calore' : 'COP frigorifero'} value={(mode === 'heat-pump' ? results.stats.cop_hp : results.stats.cop).toFixed(2)} accent color={COLOR} />
      <StatCard label={mode === 'heat-pump' ? 'COP frigorifero' : 'COP pompa di calore'} value={(mode === 'heat-pump' ? results.stats.cop : results.stats.cop_hp).toFixed(2)} />
      <StatCard label={mode === 'heat-pump' ? 'Potenza termica utile' : 'Capacita frigorifera'} value={`${results.stats.useful_capacity.toFixed(2)} kW`} />
      <StatCard label="Lavoro compressore" value={`${results.stats.win.toFixed(1)} kJ/kg`} />
    </div>
  ) : null;

  const diagramTabs = results ? [
    { id: 'ts', label: 'T-s', active: activeTab === 0, onClick: () => setActiveTab(0), content: <div ref={tsRef} className="plot-area" /> },
    { id: 'ph', label: 'P-h', active: activeTab === 1, onClick: () => setActiveTab(1), content: <div ref={phRef} className="plot-area" /> },
    {
      id: 'schema',
      label: 'Schema',
      active: activeTab === 2,
      onClick: () => setActiveTab(2),
      content: (
        <div ref={schematicRef}>
          <SchematicDiagram
            type="refrigeration"
            accentColor={COLOR}
            points={results.allPoints}
            pointLabels={['1 Uscita evaporatore', '2 Uscita compressore', '3 Uscita condensatore', '4 Uscita valvola']}
            summaryItems={[
              { label: 'Lavoro compressore', value: `${results.stats.win.toFixed(1)} kJ/kg`, color: COLOR },
              { label: 'Calore lato freddo', value: `${results.stats.qlow.toFixed(1)} kJ/kg`, color: '#38BDF8' },
              { label: 'Calore lato caldo', value: `${results.stats.qhigh.toFixed(1)} kJ/kg`, color: '#F87171' },
              { label: mode === 'heat-pump' ? 'COP_HP' : 'COP', value: `${(mode === 'heat-pump' ? results.stats.cop_hp : results.stats.cop).toFixed(2)}`, color: COLOR },
            ]}
          />
        </div>
      ),
    },
  ] : null;

  return (
    <CyclePageLayout
      badge="Sistemi Inversi"
      title="Ciclo"
      titleAccent={MODES[mode].title}
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
      EmptyIcon={Snowflake}
      emptyText="Scegli refrigerante e condizioni operative per leggere il ciclo sul lato freddo o sul lato caldo."
      modeOptions={modeOptions}
      activeMode={mode}
      presets={presetMap[mode]}
      onApplyPreset={(values) => setInputs((current) => ({ ...current, ...values }))}
      insights={{
        takeaways: mode === 'heat-pump'
          ? [
            'La pompa di calore valorizza il lato caldo: guarda qH e COP_HP.',
            'Il compressore sposta il fluido su un livello di pressione che permette la cessione di calore all\'ambiente da riscaldare.',
            'Un salto termico troppo grande tra evaporazione e condensazione penalizza subito il COP.',
          ]
          : [
            'Nel frigorifero il lato utile è l\'evaporatore: per questo conta qL.',
            'Surriscaldamento e sottoraffreddamento cambiano le posizioni dei punti 1 e 3 sul diagramma P-h.',
            'Il punto 2s ti aiuta a leggere quanto la compressione reale si allontana da quella ideale.',
          ],
        commonMistake: 'Usare lo stesso COP senza distinguere il lato utile: frigorifero e pompa di calore hanno lo stesso ciclo ma obiettivi energetici diversi.',
      }}
      legendItems={[
        { label: 'Calore entrante', color: '#38BDF8' },
        { label: 'Calore uscente', color: '#F87171' },
        { label: 'Lavoro compressore', color: COLOR },
        { label: 'Laminazione', color: '#A78BFA' },
      ]}
    >
      <h3 className="card-title">Parametri refrigerante</h3>
      <p className="input-hint">
        {mode === 'heat-pump'
          ? 'Qui il lato utile è il condensatore: guarda soprattutto temperatura di condensazione, COP_HP e potenza termica resa.'
          : 'Qui il lato utile è l\'evaporatore: temperatura di evaporazione, surriscaldamento e COP spiegano quasi tutto il comportamento del ciclo.'}
      </p>
      <div className="inputs-grid">
        <div className="input-field">
          <label className="input-label" style={{ color: COLOR }}>Refrigerante</label>
          <select
            value={refrigerant}
            onChange={(event) => setRefrigerant(event.target.value)}
            className="glass-input"
            style={{ '--focus-color': COLOR }}
          >
            {REFRIGERANTS.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="inputs-grid">
        <InputField label="Temperatura evaporazione" value={inputs.t_evap} onChange={(value) => setInputs((prev) => ({ ...prev, t_evap: value }))} unit="degC" accent={COLOR} />
        <InputField label="Temperatura condensazione" value={inputs.t_cond} onChange={(value) => setInputs((prev) => ({ ...prev, t_cond: value }))} unit="degC" accent={COLOR} />
      </div>
      <div className="inputs-row">
        <InputField label="Surriscaldamento" value={inputs.sh} onChange={(value) => setInputs((prev) => ({ ...prev, sh: value }))} unit="K" min={0} accent={COLOR} />
        <InputField label="Sottoraffreddamento" value={inputs.sc} onChange={(value) => setInputs((prev) => ({ ...prev, sc: value }))} unit="K" min={0} accent={COLOR} />
      </div>
      <div className="inputs-row">
        <InputField label="Rendimento compressore" value={inputs.eta_s} onChange={(value) => setInputs((prev) => ({ ...prev, eta_s: value }))} step={0.01} min={0.5} max={1} accent={COLOR} />
        <InputField label="Portata massica" value={inputs.mass_flow} onChange={(value) => setInputs((prev) => ({ ...prev, mass_flow: value }))} unit="kg/s" step={0.01} accent={COLOR} />
      </div>
    </CyclePageLayout>
  );
};

export default RefrigerationPage;

