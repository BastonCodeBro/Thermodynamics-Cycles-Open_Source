import React, { useMemo, useState } from 'react';
import { Wind } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import InputField from './shared/InputField';
import IdealGasCyclePage from './shared/IdealGasCyclePage';
import { calcBraytonCycle, calcRegenerativeBraytonCycle } from '../utils/idealGas';
import { pointAnnotations } from './shared/plotConfig';
import { resolveCycleDisplayResult } from '../utils/thermoCycleResolver';

const COLOR = '#818CF8';
const MODES = {
  simple: {
    label: 'Brayton semplice',
    schematicType: 'brayton',
  },
  regenerative: {
    label: 'Brayton rigenerativo',
    schematicType: 'regenerative-brayton',
  },
};

const plotDefinitions = [
  {
    id: 'ts',
    label: 'T-s',
    xKey: 's',
    yKey: 't',
    xLabel: 'Entropia s (kJ/(kg K))',
    yLabel: 'Temperatura T (degC)',
    getAnnotations: ({ points, accentColor }) =>
      pointAnnotations(points.map((point) => ({ x: point.s, y: point.t })), points.map((_, index) => `${index + 1}`), accentColor),
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

const presetMap = {
  simple: [
    { label: 'Base', values: { p_low: 1, beta: 10, t_min: 20, t_max: 1000, eta_c: 0.85, eta_t: 0.88, mass_flow: 1 } },
    { label: 'Caso esame', values: { p_low: 1, beta: 12, t_min: 15, t_max: 1100, eta_c: 0.87, eta_t: 0.9, mass_flow: 1.4 } },
    { label: 'Caso inefficiente', values: { p_low: 1, beta: 7, t_min: 35, t_max: 900, eta_c: 0.74, eta_t: 0.8, mass_flow: 1 } },
  ],
  regenerative: [
    { label: 'Base', values: { p_low: 1, beta: 8, t_min: 20, t_max: 980, eta_c: 0.85, eta_t: 0.88, epsilon_reg: 0.7, mass_flow: 1 } },
    { label: 'Caso esame', values: { p_low: 1, beta: 7.5, t_min: 20, t_max: 1020, eta_c: 0.86, eta_t: 0.89, epsilon_reg: 0.8, mass_flow: 1.2 } },
    { label: 'Caso inefficiente', values: { p_low: 1, beta: 12, t_min: 30, t_max: 980, eta_c: 0.76, eta_t: 0.82, epsilon_reg: 0.35, mass_flow: 1 } },
  ],
};

const buildBraytonDisplayResult = (cycle, values, activeMode) => {
  const pointLabels = activeMode === 'regenerative'
    ? ['1 Ingresso compressore', '2 Uscita compressore', '5 Uscita rigeneratore', '3 Ingresso turbina', '4 Uscita turbina', '6 Scarico rigenerato']
    : ['1 Aspirazione', '2 Uscita compressore', '3 Ingresso turbina', '4 Scarico turbina'];

  const formulas = activeMode === 'regenerative'
    ? [
      { label: 'Rapporto di compressione', latex: '\\beta = \\frac{P_2}{P_1}', value: values.beta },
      { label: 'Efficacia rigeneratore', latex: '\\epsilon_{reg} = \\frac{T_5 - T_2}{T_4 - T_2}', value: cycle.stats.epsilon_reg, unit: '%' },
      { label: 'Calore nel combustore', latex: 'q_{in} = c_p (T_3 - T_5)', value: cycle.stats.q_in },
      { label: 'Guadagno dal rigeneratore', latex: 'q_{rec} = c_p (T_5 - T_2)', value: cycle.stats.regen_gain },
      { label: 'Back work ratio', latex: 'BWR = \\frac{w_c}{w_t} \\times 100', value: cycle.stats.bwr },
      { label: 'Rendimento reale', latex: '\\eta = \\frac{w_t - w_c}{q_{in}} \\times 100', value: cycle.stats.eta, display: true },
    ]
    : [
      { label: 'Rapporto di compressione', latex: '\\beta = \\frac{P_2}{P_1}', value: values.beta },
      { label: '1 -> 2', description: 'Compressione politropica reale nel compressore' },
      { label: '2 -> 3', description: 'Apporto di calore a pressione costante' },
      { label: '3 -> 4', description: 'Espansione politropica reale in turbina' },
      { label: '4 -> 1', description: 'Cessione di calore a pressione costante' },
      { label: 'Lavoro compressore', latex: 'w_c = c_p (T_2 - T_1)', value: cycle.stats.wc },
      { label: 'Lavoro turbina', latex: 'w_t = c_p (T_3 - T_4)', value: cycle.stats.wt },
      { label: 'Calore in ingresso', latex: 'q_{in} = c_p (T_3 - T_2)', value: cycle.stats.q_in },
      { label: 'Back work ratio', latex: 'BWR = \\frac{w_c}{w_t} \\times 100', value: cycle.stats.bwr },
      { label: 'Rendimento reale', latex: '\\eta = \\frac{w_t - w_c}{q_{in}} \\times 100', value: cycle.stats.eta, display: true },
    ];

  return {
    allPoints: cycle.realPoints,
    idealPoints: cycle.idealPoints,
    schematicType: MODES[activeMode].schematicType,
    pointLabels,
    summaryItems: [
      { label: 'Lavoro compressore', value: `${cycle.stats.wc.toFixed(1)} kJ/kg`, color: '#60A5FA' },
      { label: 'Lavoro turbina', value: `${cycle.stats.wt.toFixed(1)} kJ/kg`, color: '#34D399' },
      { label: 'Calore in', value: `${cycle.stats.q_in.toFixed(1)} kJ/kg`, color: '#F97316' },
      ...(activeMode === 'regenerative'
        ? [{ label: 'Guadagno rig.', value: `${cycle.stats.regen_gain.toFixed(1)} kJ/kg`, color: '#22D3EE' }]
        : []),
      { label: 'Rendimento', value: `${cycle.stats.eta.toFixed(2)} %`, color: COLOR },
    ],
    statCards: [
      { label: 'Rendimento', value: `${cycle.stats.eta.toFixed(2)}%`, accent: true, color: COLOR },
      { label: 'Potenza netta', value: `${cycle.stats.power.toFixed(2)} kW` },
      { label: 'BWR', value: `${cycle.stats.bwr.toFixed(1)}%` },
      { label: activeMode === 'regenerative' ? 'Recupero' : 'Calore in', value: activeMode === 'regenerative' ? `${cycle.stats.regen_gain.toFixed(1)} kJ/kg` : `${cycle.stats.q_in.toFixed(1)} kJ/kg` },
    ],
    formulas,
    pdfTitle: activeMode === 'regenerative' ? 'Brayton rigenerativo' : 'Brayton-Joule',
    formulaPointLabels: pointLabels,
    pdfPointLabels: pointLabels,
    pdfFormulas: formulas,
    stats: cycle.stats,
  };
};

const BraytonPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = MODES[searchParams.get('variant')] ? searchParams.get('variant') : 'simple';
  const [inputs, setInputs] = useState({
    p_low: 1.0,
    beta: 10,
    t_min: 20,
    t_max: 1000,
    eta_c: 0.85,
    eta_t: 0.88,
    epsilon_reg: 0.75,
    mass_flow: 1.0,
  });

  const modeOptions = useMemo(
    () => Object.entries(MODES).map(([key, config]) => ({
      label: config.label,
      active: key === mode,
      onClick: () => {
        const next = new URLSearchParams(searchParams);
        next.set('variant', key);
        setSearchParams(next);
      },
    })),
    [mode, searchParams, setSearchParams],
  );

  const canCalculate = Number.isFinite(inputs.p_low)
    && Number.isFinite(inputs.beta)
    && Number.isFinite(inputs.t_min)
    && Number.isFinite(inputs.t_max)
    && Number.isFinite(inputs.eta_c)
    && Number.isFinite(inputs.eta_t)
    && Number.isFinite(inputs.mass_flow)
    && inputs.p_low > 0
    && inputs.beta > 1
    && inputs.t_max > inputs.t_min
    && inputs.eta_c > 0
    && inputs.eta_c <= 1
    && inputs.eta_t > 0
    && inputs.eta_t <= 1
    && inputs.mass_flow > 0
    && (mode !== 'regenerative' || (Number.isFinite(inputs.epsilon_reg) && inputs.epsilon_reg >= 0 && inputs.epsilon_reg <= 1));

  return (
    <IdealGasCyclePage
      badge="Turbina a Gas"
      title="Ciclo"
      titleAccent={mode === 'regenerative' ? 'Brayton Rigenerativo' : 'Brayton-Joule'}
      accentColor={COLOR}
      EmptyIcon={Wind}
      emptyText="Imposta il rapporto di compressione e osserva come cambiano lavori, BWR e rendimento del ciclo."
      inputs={inputs}
      setInputs={setInputs}
      canCalculate={canCalculate}
      plotDefinitions={plotDefinitions}
      getPathOptions={({ mode: activeMode }) => activeMode === 'regenerative'
        ? {
            real: [
              { processType: 'polytropic', model: 'ideal-gas' },
              { processType: 'isobaric', model: 'ideal-gas' },
              { processType: 'isobaric', model: 'ideal-gas' },
              { processType: 'polytropic', model: 'ideal-gas' },
              { processType: 'isobaric', model: 'ideal-gas' },
              { processType: 'isobaric', model: 'ideal-gas' },
            ],
            ideal: [
              { processType: 'isentropic', model: 'ideal-gas' },
              { processType: 'isobaric', model: 'ideal-gas' },
              { processType: 'isobaric', model: 'ideal-gas' },
              { processType: 'isentropic', model: 'ideal-gas' },
              { processType: 'isobaric', model: 'ideal-gas' },
              { processType: 'isobaric', model: 'ideal-gas' },
            ],
          }
        : {
            real: [
              { processType: 'polytropic', model: 'ideal-gas' },
              { processType: 'isobaric', model: 'ideal-gas' },
              { processType: 'polytropic', model: 'ideal-gas' },
              { processType: 'isobaric', model: 'ideal-gas' },
            ],
            ideal: [
              { processType: 'isentropic', model: 'ideal-gas' },
              { processType: 'isobaric', model: 'ideal-gas' },
              { processType: 'isentropic', model: 'ideal-gas' },
              { processType: 'isobaric', model: 'ideal-gas' },
            ],
          }}
      resolveResult={async (values, activeMode) => {
        const pHigh = values.p_low * values.beta;

        return resolveCycleDisplayResult({
          cycleId: 'brayton',
          variant: activeMode === 'regenerative' ? 'regenerative' : null,
          family: 'ideal-gas',
          inputs: activeMode === 'regenerative'
            ? {
                p1Bar: values.p_low,
                t1C: values.t_min,
                p2Bar: pHigh,
                t3C: values.t_max,
                etaComp: values.eta_c,
                etaTurb: values.eta_t,
                epsilonReg: values.epsilon_reg,
                massFlow: values.mass_flow,
              }
            : {
                p1Bar: values.p_low,
                t1C: values.t_min,
                p2Bar: pHigh,
                t3C: values.t_max,
                etaComp: values.eta_c,
                etaTurb: values.eta_t,
                massFlow: values.mass_flow,
              },
          computeLocalResult: async () => (activeMode === 'regenerative'
            ? calcRegenerativeBraytonCycle({
                p1Bar: values.p_low,
                t1C: values.t_min,
                p2Bar: pHigh,
                t3C: values.t_max,
                etaComp: values.eta_c,
                etaTurb: values.eta_t,
                epsilonReg: values.epsilon_reg,
                massFlow: values.mass_flow,
              })
            : calcBraytonCycle({
                p1Bar: values.p_low,
                t1C: values.t_min,
                p2Bar: pHigh,
                t3C: values.t_max,
                etaComp: values.eta_c,
                etaTurb: values.eta_t,
                massFlow: values.mass_flow,
              })),
          mapResultToDisplay: (cycle) => buildBraytonDisplayResult(cycle, values, activeMode),
        });
      }}
      buildError={() => mode === 'regenerative'
        ? 'Controlla i dati: beta > 1, T massima > T ingresso, rendimenti tra 0 e 1 ed efficacia del rigeneratore compresa tra 0 e 1.'
        : 'Controlla i dati: beta > 1, T massima > T ingresso e rendimenti di compressore e turbina compresi tra 0 e 1.'}
      renderInputs={({ inputs: values, setInputs: updateInputs, accentColor, mode: activeMode }) => (
        <>
          <h3 className="card-title">Parametri aria</h3>
          <p className="input-hint">
            {activeMode === 'regenerative'
              ? 'Nel Brayton rigenerativo controlla soprattutto il rapporto tra T4 e T2: il recupero funziona solo se i gas in uscita turbina restano abbastanza caldi.'
              : 'Nel Brayton semplice il punto chiave e il compromesso tra lavoro di turbina, lavoro di compressore e calore richiesto nel combustore.'}
          </p>
          <div className="inputs-grid">
            <InputField label="Pressione iniziale" value={values.p_low} onChange={(value) => updateInputs((prev) => ({ ...prev, p_low: value }))} unit="bar" accent={accentColor} />
            <InputField label="Rapporto di compressione" value={values.beta} onChange={(value) => updateInputs((prev) => ({ ...prev, beta: value }))} accent={accentColor} />
            <InputField label="Temperatura ingresso" value={values.t_min} onChange={(value) => updateInputs((prev) => ({ ...prev, t_min: value }))} unit="degC" accent={accentColor} />
          </div>
          <div className="inputs-row">
            <InputField label="Temperatura massima" value={values.t_max} onChange={(value) => updateInputs((prev) => ({ ...prev, t_max: value }))} unit="degC" accent={accentColor} />
            <InputField label="Rendimento compressore" value={values.eta_c} onChange={(value) => updateInputs((prev) => ({ ...prev, eta_c: value }))} step={0.01} min={0.5} max={1} accent={accentColor} />
          </div>
          <div className="inputs-row">
            <InputField label="Rendimento turbina" value={values.eta_t} onChange={(value) => updateInputs((prev) => ({ ...prev, eta_t: value }))} step={0.01} min={0.5} max={1} accent={accentColor} />
            <InputField label="Portata massica" value={values.mass_flow} onChange={(value) => updateInputs((prev) => ({ ...prev, mass_flow: value }))} unit="kg/s" step={0.1} accent={accentColor} />
          </div>
          {activeMode === 'regenerative' && (
            <InputField label="Efficacia rigeneratore" value={values.epsilon_reg} onChange={(value) => updateInputs((prev) => ({ ...prev, epsilon_reg: value }))} step={0.01} min={0} max={1} accent={accentColor} />
          )}
        </>
      )}
      modeOptions={modeOptions}
      activeMode={mode}
      presets={presetMap[mode]}
      insights={{
        takeaways: [
          'Nel Brayton semplice il lavoro netto e la differenza tra turbina e compressore.',
          'Un BWR alto significa che il compressore sta mangiando molta della potenza prodotta.',
          mode === 'regenerative'
            ? 'La rigenerazione riduce il combustibile richiesto ma solo se T4 rimane sopra T2.'
            : 'Il tratto 2-3 isobaro lega direttamente combustore, T massima e calore in ingresso.',
        ],
        commonMistake: 'Confondere beta con il rapporto di temperatura: beta agisce sulle temperature isentropiche, ma i rendimenti reali spostano gli stati 2 e 4.',
      }}
      legendItems={[
        { label: 'Calore entrante', color: '#F97316' },
        { label: 'Calore uscente', color: '#94A3B8' },
        { label: 'Lavoro utile', color: '#34D399' },
        { label: 'Compressione', color: '#60A5FA' },
      ]}
    />
  );
};

export default BraytonPage;
