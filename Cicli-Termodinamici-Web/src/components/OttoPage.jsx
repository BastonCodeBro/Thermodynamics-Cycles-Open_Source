import React, { useState } from 'react';
import { Zap } from 'lucide-react';
import InputField from './shared/InputField';
import IdealGasCyclePage from './shared/IdealGasCyclePage';
import { calcOttoCycle } from '../utils/idealGas';
import { pointAnnotations } from './shared/plotConfig';
import { resolveCycleDisplayResult } from '../utils/thermoCycleResolver';

const COLOR = '#FCD34D';

const plotDefinitions = [
  {
    id: 'ts',
    label: 'T-s',
    xKey: 's',
    yKey: 't',
    xLabel: 'Entropia s (kJ/(kg K))',
    yLabel: 'Temperatura T (degC)',
    getAnnotations: ({ points, idealPoints, accentColor, idealColor }) => [
      ...pointAnnotations(points.map((point) => ({ x: point.s, y: point.t })), ['1', '2', '3', '4'], accentColor),
      ...pointAnnotations(
        [
          { x: idealPoints[1]?.s, y: idealPoints[1]?.t },
          { x: idealPoints[3]?.s, y: idealPoints[3]?.t },
        ].filter((point) => point.x !== undefined),
        ['2s', '4s'],
        idealColor,
      ),
    ],
  },
  {
    id: 'pv',
    label: 'P-v',
    xKey: 'v',
    yKey: 'p',
    xLabel: 'Volume specifico v (m^3/kg)',
    yLabel: 'Pressione P (bar)',
    logX: true,
    logY: true,
  },
  {
    id: 'hs',
    label: 'h-s',
    xKey: 's',
    yKey: 'h',
    xLabel: 'Entropia s (kJ/(kg K))',
    yLabel: 'Entalpia h (kJ/kg)',
  },
];

const presets = [
  { label: 'Base', values: { r: 8.5, p_low: 1, t_min: 25, t_max: 1200, eta_s: 0.9, mass_flow: 1 } },
  { label: 'Caso esame', values: { r: 10, p_low: 1, t_min: 20, t_max: 1350, eta_s: 0.88, mass_flow: 1.2 } },
  { label: 'Caso inefficiente', values: { r: 7.2, p_low: 1, t_min: 35, t_max: 1050, eta_s: 0.78, mass_flow: 1 } },
];

const insights = {
  takeaways: [
    'A parita di T massima il rapporto di compressione e la leva principale sul rendimento ideale.',
    'Il divario tra 2-2s e 4-4s mostra subito l effetto delle irreversibilita.',
    'Nel ciclo Otto l apporto di calore avviene a volume costante: confrontalo con Diesel e Duale.',
  ],
  commonMistake: 'Confondere il rapporto di compressione con il rapporto di pressione: qui conta il rapporto tra i volumi del cilindro.',
};

const legendItems = [
  { label: 'Calore entrante', color: '#F97316' },
  { label: 'Calore uscente', color: '#60A5FA' },
  { label: 'Lavoro utile', color: COLOR },
  { label: 'Compressione', color: '#475569' },
];

const buildOttoDisplayResult = (cycle, values) => {
  const netWork = cycle.stats.q_in - cycle.stats.q_out;

  return {
    allPoints: cycle.points,
    idealPoints: cycle.idealPoints,
    schematicType: 'otto',
    pointLabels: ['1 Inizio compressione', '2 Fine compressione', '3 Fine combustione', '4 Fine espansione'],
    summaryItems: [
      { label: 'Lavoro netto', value: `${netWork.toFixed(1)} kJ/kg`, color: COLOR },
      { label: 'Calore in', value: `${cycle.stats.q_in.toFixed(1)} kJ/kg`, color: '#F97316' },
      { label: 'Calore ceduto', value: `${cycle.stats.q_out.toFixed(1)} kJ/kg`, color: '#60A5FA' },
      { label: 'Rendimento', value: `${cycle.stats.eta.toFixed(2)} %`, color: COLOR },
    ],
    statCards: [
      { label: 'Rendimento', value: `${cycle.stats.eta.toFixed(2)}%`, accent: true, color: COLOR },
      { label: 'Lavoro netto', value: `${netWork.toFixed(1)} kJ/kg` },
      { label: 'Calore in', value: `${cycle.stats.q_in.toFixed(1)} kJ/kg` },
      { label: 'Calore ceduto', value: `${cycle.stats.q_out.toFixed(1)} kJ/kg` },
    ],
    formulas: [
      { label: 'Rapporto di compressione', latex: 'r = \\frac{v_1}{v_2}', value: values.r },
      { label: '1 -> 2', description: 'Compressione reale con', latex: 'v_2 = \\frac{v_1}{r}' },
      { label: '2 -> 3', description: 'Apporto di calore a volume costante' },
      { label: '3 -> 4', description: 'Espansione reale fino a', latex: 'v_4 = v_1' },
      { label: '4 -> 1', description: 'Cessione di calore a volume costante' },
      { label: 'Calore in ingresso', latex: 'q_{in} = c_v (T_3 - T_2)', value: cycle.stats.q_in },
      { label: 'Calore in uscita', latex: 'q_{out} = c_v (T_4 - T_1)', value: cycle.stats.q_out },
      { label: 'Rendimento ideale', latex: '\\eta_{otto} = 1 - \\frac{1}{r^{k-1}}', value: cycle.stats.eta_ideal, display: true },
      { label: 'Rendimento reale', latex: '\\eta = \\frac{q_{in} - q_{out}}{q_{in}} \\times 100', value: cycle.stats.eta },
    ],
    pdfTitle: 'Otto',
    formulaPointLabels: ['1: Aspir.', '2: Compr.', '3: Comb.', '4: Esp.'],
    pdfPointLabels: ['1: Aspir.', '2: Compr.', '3: Comb.', '4: Esp.'],
    pdfFormulas: [
      {
        label: 'Rendimento ideale',
        latex: '\\eta_{otto} = 1 - \\frac{1}{r^{k-1}}',
        value: cycle.stats.eta_ideal,
      },
      {
        label: 'Lavoro netto',
        latex: 'w_{net} = q_{in} - q_{out}',
        value: netWork,
      },
      {
        label: 'Rendimento reale',
        latex: '\\eta = \\frac{w_{net}}{q_{in}}',
        value: cycle.stats.eta,
      },
    ],
    stats: cycle.stats,
  };
};

const OttoPage = () => {
  const [inputs, setInputs] = useState({
    r: 8.5,
    p_low: 1.0,
    t_min: 25,
    t_max: 1200,
    eta_s: 0.9,
    mass_flow: 1.0,
  });

  const canCalculate = Number.isFinite(inputs.r)
    && Number.isFinite(inputs.p_low)
    && Number.isFinite(inputs.t_min)
    && Number.isFinite(inputs.t_max)
    && Number.isFinite(inputs.eta_s)
    && Number.isFinite(inputs.mass_flow)
    && inputs.r > 1
    && inputs.p_low > 0
    && inputs.t_max > inputs.t_min
    && inputs.eta_s > 0
    && inputs.eta_s <= 1
    && inputs.mass_flow > 0;

  return (
    <IdealGasCyclePage
      badge="Accensione Comandata"
      title="Ciclo"
      titleAccent="Otto"
      accentColor={COLOR}
      EmptyIcon={Zap}
      emptyText="Imposta un caso motore e lancia il calcolo per confrontare ciclo reale e ideale."
      inputs={inputs}
      setInputs={setInputs}
      canCalculate={canCalculate}
      plotDefinitions={plotDefinitions}
      getPathOptions={() => ({
        real: [
          { processType: 'polytropic', model: 'ideal-gas' },
          { processType: 'isochoric', model: 'ideal-gas' },
          { processType: 'polytropic', model: 'ideal-gas' },
          { processType: 'isochoric', model: 'ideal-gas' },
        ],
        ideal: [
          { processType: 'isentropic', model: 'ideal-gas' },
          { processType: 'isochoric', model: 'ideal-gas' },
          { processType: 'isentropic', model: 'ideal-gas' },
          { processType: 'isochoric', model: 'ideal-gas' },
        ],
      })}
      resolveResult={async (values) => resolveCycleDisplayResult({
        cycleId: 'otto',
        family: 'ideal-gas',
        inputs: {
          p1Bar: values.p_low,
          t1C: values.t_min,
          r: values.r,
          t3C: values.t_max,
          eta: values.eta_s,
          massFlow: values.mass_flow,
        },
        computeLocalResult: async () => calcOttoCycle({
          p1Bar: values.p_low,
          t1C: values.t_min,
          r: values.r,
          t3C: values.t_max,
          eta: values.eta_s,
          massFlow: values.mass_flow,
        }),
        mapResultToDisplay: (cycle) => buildOttoDisplayResult(cycle, values),
      })}
      buildError={() => 'Controlla i dati: servono r > 1, T massima maggiore di T iniziale e rendimento isentropico compreso tra 0 e 1.'}
      renderInputs={({ inputs: values, setInputs: updateInputs, accentColor }) => (
        <>
          <h3 className="card-title">Parametri motore</h3>
          <p className="input-hint">
            Parti da r e dalla temperatura massima: nel ciclo Otto la combustione e isocora, quindi il confronto con Diesel e Duale si legge bene gia dai punti 2, 3 e 4.
          </p>
          <div className="inputs-grid">
            <InputField label="Rapporto di compressione" value={values.r} onChange={(value) => updateInputs((prev) => ({ ...prev, r: value }))} accent={accentColor} />
            <InputField label="Pressione iniziale" value={values.p_low} onChange={(value) => updateInputs((prev) => ({ ...prev, p_low: value }))} unit="bar" accent={accentColor} />
            <InputField label="Temperatura iniziale" value={values.t_min} onChange={(value) => updateInputs((prev) => ({ ...prev, t_min: value }))} unit="degC" accent={accentColor} />
          </div>
          <div className="inputs-row">
            <InputField label="Temperatura massima" value={values.t_max} onChange={(value) => updateInputs((prev) => ({ ...prev, t_max: value }))} unit="degC" accent={accentColor} />
            <InputField label="Rendimento isentropico" value={values.eta_s} onChange={(value) => updateInputs((prev) => ({ ...prev, eta_s: value }))} step={0.01} min={0.5} max={1} accent={accentColor} />
          </div>
          <InputField label="Portata massica" value={values.mass_flow} onChange={(value) => updateInputs((prev) => ({ ...prev, mass_flow: value }))} unit="kg/s" step={0.1} accent={accentColor} />
        </>
      )}
      presets={presets}
      insights={insights}
      legendItems={legendItems}
    />
  );
};

export default OttoPage;
