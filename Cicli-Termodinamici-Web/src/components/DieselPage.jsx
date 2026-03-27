import React, { useState } from 'react';
import { Flame } from 'lucide-react';
import InputField from './shared/InputField';
import IdealGasCyclePage from './shared/IdealGasCyclePage';
import { calcDieselCycle } from '../utils/idealGas';
import { pointAnnotations } from './shared/plotConfig';

const COLOR = '#EF4444';

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
  { label: 'Base', values: { r: 18, rc: 2, p_low: 1, t_min: 25, eta_s: 0.9, mass_flow: 1 } },
  { label: 'Caso esame', values: { r: 16, rc: 1.9, p_low: 1, t_min: 20, eta_s: 0.87, mass_flow: 1.1 } },
  { label: 'Caso inefficiente', values: { r: 13, rc: 2.4, p_low: 1, t_min: 35, eta_s: 0.76, mass_flow: 1 } },
];

const insights = {
  takeaways: [
    'Il rapporto di cut-off sposta durata e intensità del calore immesso a pressione costante.',
    'A parità di r, aumentare rc abbassa il rendimento ideale ma può contenere il picco di pressione.',
    'Nel grafico P-v il tratto 2-3 orizzontale distingue subito il Diesel dall\'Otto.',
  ],
  commonMistake: 'Usare rc come se fosse un rapporto di compressione: rc è il rapporto tra i volumi durante la combustione isobara.',
};

const legendItems = [
  { label: 'Calore entrante', color: '#F97316' },
  { label: 'Calore uscente', color: '#60A5FA' },
  { label: 'Lavoro utile', color: COLOR },
  { label: 'Compressione/pompaggio', color: '#475569' },
];

const DieselPage = () => {
  const [inputs, setInputs] = useState({
    r: 18,
    rc: 2,
    p_low: 1.0,
    t_min: 25,
    eta_s: 0.9,
    mass_flow: 1.0,
  });

  const canCalculate = Number.isFinite(inputs.r)
    && Number.isFinite(inputs.rc)
    && Number.isFinite(inputs.p_low)
    && Number.isFinite(inputs.t_min)
    && Number.isFinite(inputs.eta_s)
    && Number.isFinite(inputs.mass_flow)
    && inputs.r > 1
    && inputs.rc > 1
    && inputs.p_low > 0
    && inputs.eta_s > 0
    && inputs.eta_s <= 1
    && inputs.mass_flow > 0;

  return (
    <IdealGasCyclePage
      badge="Accensione per Compressione"
      title="Ciclo"
      titleAccent="Diesel"
      accentColor={COLOR}
      EmptyIcon={Flame}
      emptyText="Imposta rapporto di compressione e cut-off per vedere come cambia il bilancio del ciclo Diesel."
      inputs={inputs}
      setInputs={setInputs}
      canCalculate={canCalculate}
      plotDefinitions={plotDefinitions}
      getPathOptions={() => ({
        real: [
          { processType: 'polytropic', model: 'ideal-gas' },
          { processType: 'isobaric', model: 'ideal-gas' },
          { processType: 'polytropic', model: 'ideal-gas' },
          { processType: 'isochoric', model: 'ideal-gas' },
        ],
        ideal: [
          { processType: 'isentropic', model: 'ideal-gas' },
          { processType: 'isobaric', model: 'ideal-gas' },
          { processType: 'isentropic', model: 'ideal-gas' },
          { processType: 'isochoric', model: 'ideal-gas' },
        ],
      })}
      buildResult={async (values) => {
        const cycle = calcDieselCycle({
          p1Bar: values.p_low,
          t1C: values.t_min,
          r: values.r,
          rc: values.rc,
          eta: values.eta_s,
          massFlow: values.mass_flow,
        });
        const netWork = cycle.stats.q_in - cycle.stats.q_out;
        return {
          allPoints: cycle.points,
          idealPoints: cycle.idealPoints,
          schematicType: 'diesel',
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
            { label: 'T massima', value: `${cycle.points[2].t.toFixed(0)} degC` },
            { label: 'Calore in', value: `${cycle.stats.q_in.toFixed(1)} kJ/kg` },
          ],
          formulas: [
            { label: 'Rapporto di compressione', latex: 'r = \\frac{v_1}{v_2}', value: values.r },
            { label: 'Rapporto di cut-off', latex: 'r_c = \\frac{v_3}{v_2}', value: values.rc },
            { label: '1 → 2', description: 'Compressione reale' },
            { label: '2 → 3', description: 'Apporto di calore a pressione costante' },
            { label: '3 → 4', description: 'Espansione reale' },
            { label: '4 → 1', description: 'Cessione di calore a volume costante' },
            { label: 'Calore in ingresso', latex: 'q_{in} = c_p (T_3 - T_2)', value: cycle.stats.q_in },
            { label: 'Calore in uscita', latex: 'q_{out} = c_v (T_4 - T_1)', value: cycle.stats.q_out },
            { label: 'Rendimento ideale', latex: '\\eta_{diesel} = 1 - \\frac{1}{r^{k-1}} \\cdot \\frac{r_c^k - 1}{k(r_c-1)}', value: cycle.stats.eta_ideal, display: true },
            { label: 'Rendimento reale', latex: '\\eta = \\frac{q_{in} - q_{out}}{q_{in}} \\times 100', value: cycle.stats.eta },
          ],
          pdfTitle: 'Diesel',
          formulaPointLabels: ['1: Inizio', '2: Compr.', '3: Comb.', '4: Esp.'],
          pdfPointLabels: ['1: Inizio', '2: Compr.', '3: Comb.', '4: Esp.'],
          pdfFormulas: [
            {
              label: 'Rendimento ideale Diesel',
              latex: '\\eta_{diesel} = 1 - \\frac{1}{r^{k-1}} \\cdot \\frac{r_c^k - 1}{k(r_c-1)}',
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
      }}
      buildError={() => 'Controlla i dati: servono r > 1, rc > 1 e un rendimento isentropico compreso tra 0 e 1.'}
      renderInputs={({ inputs: values, setInputs: updateInputs, accentColor }) => (
        <>
          <h3 className="card-title">Parametri motore</h3>
          <p className="input-hint">
            Qui il parametro chiave insieme a r e il cut-off: ti dice per quanto tempo il calore entra a pressione quasi costante durante la combustione.
          </p>
          <div className="inputs-grid">
            <InputField label="Rapporto di compressione" value={values.r} onChange={(value) => updateInputs((prev) => ({ ...prev, r: value }))} accent={accentColor} />
            <InputField label="Rapporto di cut-off" value={values.rc} onChange={(value) => updateInputs((prev) => ({ ...prev, rc: value }))} step={0.1} accent={accentColor} />
            <InputField label="Pressione iniziale" value={values.p_low} onChange={(value) => updateInputs((prev) => ({ ...prev, p_low: value }))} unit="bar" accent={accentColor} />
          </div>
          <div className="inputs-row">
            <InputField label="Temperatura iniziale" value={values.t_min} onChange={(value) => updateInputs((prev) => ({ ...prev, t_min: value }))} unit="degC" accent={accentColor} />
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

export default DieselPage;

