import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flame } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import CyclePageLayout from './shared/CyclePageLayout';
import InputField from './shared/InputField';
import StatCard from './shared/StatCard';
import FormulasSection from './shared/FormulasSection';
import SchematicDiagram from './shared/SchematicDiagram';
import { plotLayout, plotConfig, addTrace, addDomeTrace, addFillTrace, pointAnnotations } from './shared/plotConfig';
import { renderPlot, cleanupPlot } from '../utils/plotly';
import { calcRankineCycle } from '../utils/rankineCycles';

const COLOR = '#38BDF8';
const PATH_COLORS = ['#60A5FA', '#F97316', '#EF4444', '#22D3EE', '#A78BFA', '#F59E0B'];
const IDEAL_COLOR = '#64748B';

const VARIANTS = {
  simple: {
    label: 'Rankine semplice',
    title: 'Rankine',
    schematicType: 'rankine',
  },
  hirn: {
    label: 'Rankine-Hirn',
    title: 'Rankine-Hirn',
    schematicType: 'rankine',
  },
  reheat: {
    label: 'Rankine con risurriscaldamento',
    title: 'Rankine con Risurriscaldamento',
    schematicType: 'reheat-rankine',
  },
};

const presetMap = {
  simple: [
    { label: 'Base', values: { p_high: 80, p_low: 0.08, eta_t: 0.86, eta_p: 0.85, mass_flow: 1.4 } },
    { label: 'Caso esame', values: { p_high: 100, p_low: 0.06, eta_t: 0.88, eta_p: 0.86, mass_flow: 1.8 } },
    { label: 'Caso inefficiente', values: { p_high: 55, p_low: 0.12, eta_t: 0.76, eta_p: 0.78, mass_flow: 1.2 } },
  ],
  hirn: [
    { label: 'Base', values: { p_high: 90, p_low: 0.08, t_max: 480, eta_t: 0.86, eta_p: 0.85, mass_flow: 1.4 } },
    { label: 'Caso esame', values: { p_high: 120, p_low: 0.06, t_max: 520, eta_t: 0.88, eta_p: 0.86, mass_flow: 1.8 } },
    { label: 'Caso inefficiente', values: { p_high: 70, p_low: 0.12, t_max: 420, eta_t: 0.77, eta_p: 0.79, mass_flow: 1.2 } },
  ],
  reheat: [
    { label: 'Base', values: { p_high: 110, p_low: 0.08, t_max: 500, p_reheat: 22, t_reheat: 480, eta_t: 0.87, eta_p: 0.85, mass_flow: 1.5 } },
    { label: 'Caso esame', values: { p_high: 140, p_low: 0.06, t_max: 540, p_reheat: 28, t_reheat: 520, eta_t: 0.89, eta_p: 0.86, mass_flow: 1.9 } },
    { label: 'Caso inefficiente', values: { p_high: 85, p_low: 0.12, t_max: 440, p_reheat: 14, t_reheat: 410, eta_t: 0.78, eta_p: 0.79, mass_flow: 1.2 } },
  ],
};

const getPointLabels = (variant) => (
  variant === 'reheat'
    ? [
        '1 Uscita condensatore',
        '2 Uscita pompa',
        '3 Ingresso turbina HP',
        '4 Uscita turbina HP',
        '5 Uscita risurriscaldatore',
        '6 Uscita turbina LP',
      ]
    : [
        '1 Uscita condensatore',
        '2 Uscita pompa',
        variant === 'hirn' ? '3 Vapore surriscaldato' : '3 Vapore saturo secco',
        '4 Uscita turbina',
      ]
);

const getPointTable = (points, variant) =>
  points.map((point, index) => ({
    label: getPointLabels(variant)[index] ?? `${index + 1}`,
    t: point.t,
    p: point.p,
    h: point.h,
    s: point.s,
    v: point.v,
  }));

const buildFormulas = (stats, variant, values) => {
  const base = [
    { label: 'Lavoro pompa', latex: 'w_p = h_2 - h_1', value: stats.wp },
    { label: 'Lavoro turbina', latex: 'w_t = h_3 - h_4', value: stats.wt },
    { label: 'Calore in caldaia', latex: 'q_{in} = h_3 - h_2', value: stats.q_in },
    { label: 'Calore al condensatore', latex: 'q_{out} = h_4 - h_1', value: stats.q_out },
    { label: 'Rendimento', latex: '\\eta = \\frac{w_t - w_p}{q_{in}} \\times 100', value: stats.eta, display: true },
  ];

  if (variant === 'simple') {
    return [
      { label: '1 → 2', description: 'Compressione del liquido in pompa' },
      { label: '2 → 3', description: 'Riscaldamento ed evaporazione fino a vapore saturo secco' },
      { label: '3 → 4', description: 'Espansione reale in turbina' },
      { label: '4 → 1', description: 'Condensazione a pressione quasi costante' },
      ...base,
    ];
  }

  if (variant === 'hirn') {
    return [
      { label: 'Temperatura vapore vivo', latex: 'T_3 = T_{max}', value: values.t_max, unit: 'degC' },
      { label: '2 → 3', description: 'Caldaia con surriscaldamento finale del vapore' },
      { label: '3 → 4', description: 'Espansione reale dalla zona surriscaldata' },
      ...base,
    ];
  }

  return [
    { label: 'Pressione di reheat', latex: 'P_{rh} = P_4 = P_5', value: values.p_reheat, unit: 'bar' },
    { label: 'Temperatura di reheat', latex: 'T_5 = T_{reheat}', value: values.t_reheat, unit: 'degC' },
    { label: 'Espansione HP', latex: 'w_{t,HP} = h_3 - h_4', value: stats.wt_hp },
    { label: 'Calore di reheat', latex: 'q_{rh} = h_5 - h_4', value: stats.q_reheat },
    { label: 'Espansione LP', latex: 'w_{t,LP} = h_5 - h_6', value: stats.wt_lp },
    { label: 'Lavoro pompa', latex: 'w_p = h_2 - h_1', value: stats.wp },
    { label: 'Calore totale', latex: 'q_{in} = (h_3 - h_2) + (h_5 - h_4)', value: stats.q_in },
    { label: 'Rendimento', latex: '\\eta = \\frac{(w_{t,HP} + w_{t,LP}) - w_p}{q_{in}} \\times 100', value: stats.eta, display: true },
  ];
};

const RankinePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const variant = VARIANTS[searchParams.get('variant')] ? searchParams.get('variant') : 'simple';
  const [inputs, setInputs] = useState({
    p_high: 90,
    p_low: 0.08,
    t_max: 480,
    p_reheat: 22,
    t_reheat: 460,
    eta_t: 0.86,
    eta_p: 0.85,
    mass_flow: 1.4,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  const tsRef = useRef(null);
  const hsRef = useRef(null);
  const pvRef = useRef(null);
  const schematicRef = useRef(null);

  const modeOptions = useMemo(
    () => Object.entries(VARIANTS).map(([key, config]) => ({
      label: config.label,
      active: key === variant,
      onClick: () => {
        const next = new URLSearchParams(searchParams);
        next.set('variant', key);
        setSearchParams(next);
      },
    })),
    [searchParams, setSearchParams, variant],
  );

  useEffect(() => {
    if (!results) return undefined;
    const tsNode = tsRef.current;
    const hsNode = hsRef.current;
    const pvNode = pvRef.current;

    const renderAllPlots = () => {
      const labels = results.pointLabels.map((_, index) => `${index + 1}`);

      if (tsRef.current) {
        const data = [
          results.dome?.ts?.s?.length
            ? addFillTrace(results.dome.ts.s, results.dome.ts.t, {
                fillcolor: 'rgba(56, 189, 248, 0.08)',
                name: 'Cupola di saturazione',
              })
            : null,
          results.dome?.ts?.s?.length ? addDomeTrace(results.dome.ts.s, results.dome.ts.t) : null,
          ...results.actualPaths.map((path, index) =>
            addTrace(path.map((point) => point.s), path.map((point) => point.t), {
              color: PATH_COLORS[index % PATH_COLORS.length],
              width: 3,
              mode: 'lines',
            }),
          ),
          ...results.idealPaths.map((path) =>
            addTrace(path.map((point) => point.s), path.map((point) => point.t), {
              color: IDEAL_COLOR,
              width: 2,
              dash: 'dash',
              mode: 'lines',
            }),
          ),
          ...results.lossPaths.map((path) =>
            addTrace(path.map((point) => point.s), path.map((point) => point.t), {
              color: '#94A3B8',
              width: 1.5,
              dash: 'dot',
              mode: 'lines',
            }),
          ),
          addTrace(results.actualPoints.map((point) => point.s), results.actualPoints.map((point) => point.t), {
            color: COLOR,
            mode: 'markers',
            markerSize: 9,
          }),
          addTrace(results.idealPoints.map((point) => point.s), results.idealPoints.map((point) => point.t), {
            color: IDEAL_COLOR,
            mode: 'markers',
            markerSize: 6,
          }),
        ].filter(Boolean);
        const layout = plotLayout('Entropia s (kJ/(kg K))', 'Temperatura T (degC)');
        layout.annotations = pointAnnotations(
          results.actualPoints.map((point) => ({ x: point.s, y: point.t })),
          labels,
          COLOR,
        );
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
          ...results.actualPaths.map((path, index) =>
            addTrace(path.map((point) => point.s), path.map((point) => point.h), {
              color: PATH_COLORS[index % PATH_COLORS.length],
              width: 3,
              mode: 'lines',
            }),
          ),
          ...results.idealPaths.map((path) =>
            addTrace(path.map((point) => point.s), path.map((point) => point.h), {
              color: IDEAL_COLOR,
              width: 2,
              dash: 'dash',
              mode: 'lines',
            }),
          ),
          addTrace(results.actualPoints.map((point) => point.s), results.actualPoints.map((point) => point.h), {
            color: COLOR,
            mode: 'markers',
            markerSize: 9,
          }),
        ].filter(Boolean);
        const layout = plotLayout('Entropia s (kJ/(kg K))', 'Entalpia h (kJ/kg)');
        layout.annotations = pointAnnotations(
          results.actualPoints.map((point) => ({ x: point.s, y: point.h })),
          labels,
          COLOR,
        );
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
          ...results.actualPaths.map((path, index) =>
            addTrace(path.map((point) => point.v), path.map((point) => point.p), {
              color: PATH_COLORS[index % PATH_COLORS.length],
              width: 3,
              mode: 'lines',
            }),
          ),
          addTrace(results.actualPoints.map((point) => point.v), results.actualPoints.map((point) => point.p), {
            color: COLOR,
            mode: 'markers',
            markerSize: 9,
          }),
        ].filter(Boolean);
        const layout = plotLayout('Volume specifico v (m^3/kg)', 'Pressione P (bar)', {
          xaxis: { type: 'log' },
          yaxis: { type: 'log', nticks: 8 },
        });
        layout.annotations = pointAnnotations(
          results.actualPoints.map((point) => ({ x: point.v, y: point.p })),
          labels,
          COLOR,
        );
        renderPlot(pvRef.current, data, layout, plotConfig);
      }
    };

    renderAllPlots();
    return () => {
      cleanupPlot(tsNode);
      cleanupPlot(hsNode);
      cleanupPlot(pvNode);
    };
  }, [results]);

  const canCalculate = Number.isFinite(inputs.p_high)
    && Number.isFinite(inputs.p_low)
    && Number.isFinite(inputs.eta_t)
    && Number.isFinite(inputs.eta_p)
    && Number.isFinite(inputs.mass_flow)
    && inputs.p_high > inputs.p_low
    && inputs.p_low > 0
    && inputs.eta_t > 0
    && inputs.eta_t <= 1
    && inputs.eta_p > 0
    && inputs.eta_p <= 1
    && inputs.mass_flow > 0
    && (variant === 'simple' || (Number.isFinite(inputs.t_max) && inputs.t_max > 100))
    && (variant !== 'reheat' || (
      Number.isFinite(inputs.p_reheat)
      && Number.isFinite(inputs.t_reheat)
      && inputs.p_reheat > inputs.p_low
      && inputs.p_reheat < inputs.p_high
      && inputs.t_reheat > 100
    ));

  const calculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const cycle = await calcRankineCycle({
        ...inputs,
        variant,
      });

      setResults({
        ...cycle,
        pointLabels: getPointLabels(variant),
      });
    } catch (calculationError) {
      setError(
        variant === 'reheat'
          ? 'Controlla i dati: P caldaia > P condensatore, P reheat compresa tra le due, temperature coerenti e rendimenti tra 0 e 1.'
          : 'Controlla i dati: P caldaia > P condensatore, portata positiva e rendimenti di turbina e pompa compresi tra 0 e 1.',
      );
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
        title: VARIANTS[variant].title,
        accentColor: COLOR,
        inputs,
        stats: results.stats,
        points: getPointTable(results.actualPoints, variant),
        formulas: buildFormulas(results.stats, variant, inputs),
        plotRefs: { ts: tsRef, hs: hsRef, pv: pvRef },
        schematicRef,
      });
    } catch (downloadError) {
      console.error(downloadError);
    } finally {
      setDownloadingPDF(false);
    }
  }, [inputs, results, variant]);

  const formulasSection = results ? (
    <FormulasSection
      accentColor={COLOR}
      points={getPointTable(results.actualPoints, variant)}
      formulas={buildFormulas(results.stats, variant, inputs)}
    />
  ) : null;

  const stats = results ? (
    <div className="stats-row">
      <StatCard label="Rendimento" value={`${results.stats.eta.toFixed(2)}%`} accent color={COLOR} />
      <StatCard label="Potenza netta" value={`${results.stats.power.toFixed(1)} kW`} />
      <StatCard
        label={variant === 'reheat' ? 'Lavoro turbina HP' : 'Lavoro turbina'}
        value={`${(variant === 'reheat' ? results.stats.wt_hp : results.stats.wt).toFixed(1)} kJ/kg`}
      />
      <StatCard
        label={variant === 'reheat' ? 'Lavoro turbina LP' : 'Calore in'}
        value={`${(variant === 'reheat' ? results.stats.wt_lp : results.stats.q_in).toFixed(1)} kJ/kg`}
      />
    </div>
  ) : null;

  const diagramTabs = results ? [
    { id: 'ts', label: 'T-s', active: activeTab === 0, onClick: () => setActiveTab(0), content: <div ref={tsRef} className="plot-area" /> },
    { id: 'hs', label: 'h-s', active: activeTab === 1, onClick: () => setActiveTab(1), content: <div ref={hsRef} className="plot-area" /> },
    { id: 'pv', label: 'P-v', active: activeTab === 2, onClick: () => setActiveTab(2), content: <div ref={pvRef} className="plot-area" /> },
    {
      id: 'schema',
      label: 'Schema',
      active: activeTab === 3,
      onClick: () => setActiveTab(3),
      content: (
        <div ref={schematicRef}>
          <SchematicDiagram
            type={VARIANTS[variant].schematicType}
            accentColor={COLOR}
            points={results.actualPoints}
            pointLabels={results.pointLabels}
            summaryItems={[
              { label: 'Lavoro turbina', value: `${results.stats.wt.toFixed(1)} kJ/kg`, color: '#F97316' },
              { label: 'Lavoro pompa', value: `${results.stats.wp.toFixed(1)} kJ/kg`, color: '#60A5FA' },
              { label: 'Calore in', value: `${results.stats.q_in.toFixed(1)} kJ/kg`, color: '#EF4444' },
              ...(variant === 'reheat'
                ? [{ label: 'Reheat', value: `${results.stats.q_reheat.toFixed(1)} kJ/kg`, color: '#A78BFA' }]
                : []),
              { label: 'Rendimento', value: `${results.stats.eta.toFixed(2)} %`, color: COLOR },
            ]}
          />
        </div>
      ),
    },
  ] : null;

  return (
    <CyclePageLayout
      badge="Impianti a Vapore"
      title="Ciclo"
      titleAccent={VARIANTS[variant].title}
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
      emptyText="Seleziona la variante del Rankine e imposta pressioni, rendimenti e, se serve, surriscaldamento o risurriscaldamento."
      modeOptions={modeOptions}
      presets={presetMap[variant]}
      onApplyPreset={(values) => setInputs((current) => ({ ...current, ...values }))}
      insights={{
        takeaways: variant === 'reheat'
          ? [
              'Il reheat aggiunge calore tra due espansioni e mantiene più alta la qualità del vapore nel tratto finale.',
              'Osserva come cambiano i punti 4, 5 e 6 sul diagramma T-s: qui si legge davvero il vantaggio didattico del reheat.',
              'La potenza netta cresce quando la seconda espansione sfrutta bene il nuovo apporto di calore.',
            ]
          : variant === 'hirn'
            ? [
                'Il surriscaldamento sposta il punto 3 fuori dalla cupola e rende più sicura l\'espansione in turbina.',
                'Confronta Hirn con Rankine semplice per vedere come cambiano lavoro di turbina e calore in caldaia.',
                'La pompa incide poco sul bilancio energetico ma va comunque letta nel rendimento globale.',
              ]
            : [
                'Il Rankine semplice è il riferimento da cui partire per leggere tutte le varianti reali del ciclo a vapore.',
                'Il tratto 4 → 1 rappresenta la chiusura al condensatore e chiarisce dove si scarica il calore verso l\'ambiente.',
                'Il lavoro pompa è piccolo rispetto al lavoro turbina, ma non nullo.',
              ],
        commonMistake: variant === 'reheat'
          ? 'Mettere la pressione di reheat sopra la pressione di caldaia o sotto quella di condensazione: fisicamente il secondo stadio va sempre fra le due.'
           : 'Confondere il Rankine semplice con l\'Hirn: nel semplice il punto 3 è vapore saturo secco, nell\'Hirn è vapore surriscaldato.',
      }}
      legendItems={[
        { label: 'Apporto di calore', color: '#EF4444' },
        { label: 'Espansione utile', color: '#F97316' },
        { label: 'Pompaggio', color: '#60A5FA' },
        { label: 'Condensazione/raffreddamento', color: '#22D3EE' },
      ]}
    >
      <h3 className="card-title">Parametri del vapore</h3>
      <p className="input-hint">
        {variant === 'simple'
          ? 'Nel Rankine semplice il vapore entra in turbina come saturo secco: non serve fissare una temperatura massima.'
          : variant === 'hirn'
            ? 'Nel ciclo Hirn aggiungi surriscaldamento in caldaia per migliorare l\'espansione in turbina.'
            : 'Nel reheat il vapore espande in due stadi con un nuovo apporto di calore alla pressione intermedia.'}
      </p>
      <div className="inputs-grid">
        <InputField label="Pressione caldaia" value={inputs.p_high} onChange={(value) => setInputs((prev) => ({ ...prev, p_high: value }))} unit="bar" accent={COLOR} />
        <InputField label="Pressione condensatore" value={inputs.p_low} onChange={(value) => setInputs((prev) => ({ ...prev, p_low: value }))} unit="bar" accent={COLOR} />
        {variant !== 'simple' && (
          <InputField label="Temperatura vapore vivo" value={inputs.t_max} onChange={(value) => setInputs((prev) => ({ ...prev, t_max: value }))} unit="degC" accent={COLOR} />
        )}
      </div>
      {variant === 'reheat' && (
        <div className="inputs-row">
          <InputField label="Pressione reheat" value={inputs.p_reheat} onChange={(value) => setInputs((prev) => ({ ...prev, p_reheat: value }))} unit="bar" accent={COLOR} />
          <InputField label="Temperatura reheat" value={inputs.t_reheat} onChange={(value) => setInputs((prev) => ({ ...prev, t_reheat: value }))} unit="degC" accent={COLOR} />
        </div>
      )}
      <div className="inputs-row">
        <InputField label="Rendimento turbina" value={inputs.eta_t} onChange={(value) => setInputs((prev) => ({ ...prev, eta_t: value }))} step={0.01} min={0.5} max={1} accent={COLOR} />
        <InputField label="Rendimento pompa" value={inputs.eta_p} onChange={(value) => setInputs((prev) => ({ ...prev, eta_p: value }))} step={0.01} min={0.5} max={1} accent={COLOR} />
      </div>
      <InputField label="Portata massica" value={inputs.mass_flow} onChange={(value) => setInputs((prev) => ({ ...prev, mass_flow: value }))} unit="kg/s" step={0.1} accent={COLOR} />
    </CyclePageLayout>
  );
};

export default RankinePage;
