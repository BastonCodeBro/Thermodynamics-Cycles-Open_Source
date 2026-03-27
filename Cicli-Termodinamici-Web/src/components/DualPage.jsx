import React, { useState } from 'react';
import { Flame } from 'lucide-react';
import InputField from './shared/InputField';
import IdealGasCyclePage from './shared/IdealGasCyclePage';
import { calcDualCycle } from '../utils/idealGas';
import { pointAnnotations } from './shared/plotConfig';

const COLOR = '#FB923C';

const plotDefinitions = [
  {
    id: 'ts',
    label: 'T-s',
    xKey: 's',
    yKey: 't',
    xLabel: 'Entropia s (kJ/(kg K))',
    yLabel: 'Temperatura T (degC)',
    getAnnotations: ({ points, accentColor }) =>
      pointAnnotations(points.map((point) => ({ x: point.s, y: point.t })), ['1', '2', '3', '4', '5'], accentColor),
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
  { label: 'Base', values: { r: 16, alpha: 1.4, rc: 1.3, p_low: 1, t_min: 25, eta_s: 0.88, mass_flow: 1 } },
  { label: 'Caso esame', values: { r: 18, alpha: 1.5, rc: 1.25, p_low: 1, t_min: 20, eta_s: 0.9, mass_flow: 1.1 } },
  { label: 'Caso inefficiente', values: { r: 13, alpha: 1.25, rc: 1.45, p_low: 1, t_min: 35, eta_s: 0.76, mass_flow: 1 } },
];

const DualPage = () => {
  const [inputs, setInputs] = useState({
    r: 16,
    alpha: 1.4,
    rc: 1.3,
    p_low: 1,
    t_min: 25,
    eta_s: 0.88,
    mass_flow: 1,
  });

  const canCalculate = Number.isFinite(inputs.r)
    && Number.isFinite(inputs.alpha)
    && Number.isFinite(inputs.rc)
    && Number.isFinite(inputs.p_low)
    && Number.isFinite(inputs.t_min)
    && Number.isFinite(inputs.eta_s)
    && Number.isFinite(inputs.mass_flow)
    && inputs.r > 1
    && inputs.alpha > 1
    && inputs.rc > 1
    && inputs.p_low > 0
    && inputs.eta_s > 0
    && inputs.eta_s <= 1
    && inputs.mass_flow > 0;

  return (
    <IdealGasCyclePage
      badge="Combustione Mista"
      title="Ciclo"
      titleAccent="Duale o Sabathe"
      accentColor={COLOR}
      EmptyIcon={Flame}
      emptyText="Inserisci r, rapporto di pressione isocora e cut-off per vedere la combustione mista del ciclo Duale."
      inputs={inputs}
      setInputs={setInputs}
      canCalculate={canCalculate}
      plotDefinitions={plotDefinitions}
      getPathOptions={() => ({
        real: [
          { processType: 'polytropic', model: 'ideal-gas' },
          { processType: 'isochoric', model: 'ideal-gas' },
          { processType: 'isobaric', model: 'ideal-gas' },
          { processType: 'polytropic', model: 'ideal-gas' },
          { processType: 'isochoric', model: 'ideal-gas' },
        ],
        ideal: [
          { processType: 'isentropic', model: 'ideal-gas' },
          { processType: 'isochoric', model: 'ideal-gas' },
          { processType: 'isobaric', model: 'ideal-gas' },
          { processType: 'isentropic', model: 'ideal-gas' },
          { processType: 'isochoric', model: 'ideal-gas' },
        ],
      })}
      buildResult={async (values) => {
        const cycle = calcDualCycle({
          p1Bar: values.p_low,
          t1C: values.t_min,
          r: values.r,
          alpha: values.alpha,
          rc: values.rc,
          eta: values.eta_s,
          massFlow: values.mass_flow,
        });
        const netWork = cycle.stats.q_in - cycle.stats.q_out;
        return {
          allPoints: cycle.points,
          idealPoints: cycle.idealPoints,
          schematicType: 'dual',
          pointLabels: ['1 Inizio compressione', '2 Fine compressione', '3 Fine calore CV', '4 Fine calore CP', '5 Fine espansione'],
          summaryItems: [
            { label: 'Lavoro netto', value: `${netWork.toFixed(1)} kJ/kg`, color: COLOR },
            { label: 'Calore isocoro', value: `${cycle.stats.q_in_cv.toFixed(1)} kJ/kg`, color: '#F97316' },
            { label: 'Calore isobaro', value: `${cycle.stats.q_in_cp.toFixed(1)} kJ/kg`, color: '#22D3EE' },
            { label: 'Rendimento', value: `${cycle.stats.eta.toFixed(2)} %`, color: COLOR },
          ],
          statCards: [
            { label: 'Rendimento', value: `${cycle.stats.eta.toFixed(2)}%`, accent: true, color: COLOR },
            { label: 'Lavoro netto', value: `${netWork.toFixed(1)} kJ/kg` },
            { label: 'T massima', value: `${cycle.points[3].t.toFixed(0)} degC` },
            { label: 'Calore totale', value: `${cycle.stats.q_in.toFixed(1)} kJ/kg` },
          ],
          formulas: [
            { label: 'Rapporto di compressione', latex: 'r = \\frac{v_1}{v_2}', value: values.r },
            { label: 'Rapporto di pressione isocora', latex: '\\alpha = \\frac{P_3}{P_2}', value: values.alpha },
            { label: 'Rapporto di cut-off', latex: 'r_c = \\frac{v_4}{v_3}', value: values.rc },
            { label: '2 → 3', description: 'Apporto di calore a volume costante' },
            { label: '3 → 4', description: 'Apporto di calore a pressione costante' },
            { label: 'Calore isocoro', latex: 'q_{cv} = c_v (T_3 - T_2)', value: cycle.stats.q_in_cv },
            { label: 'Calore isobaro', latex: 'q_{cp} = c_p (T_4 - T_3)', value: cycle.stats.q_in_cp },
            { label: 'Calore totale', latex: 'q_{in} = q_{cv} + q_{cp}', value: cycle.stats.q_in },
            { label: 'Rendimento reale', latex: '\\eta = \\frac{q_{in} - q_{out}}{q_{in}} \\times 100', value: cycle.stats.eta, display: true },
          ],
          pdfTitle: 'Duale o Sabathe',
          formulaPointLabels: ['1', '2', '3', '4', '5'],
          pdfPointLabels: ['1', '2', '3', '4', '5'],
          pdfFormulas: [
            { label: 'Calore isocoro', latex: 'q_{cv} = c_v (T_3 - T_2)', value: cycle.stats.q_in_cv },
            { label: 'Calore isobaro', latex: 'q_{cp} = c_p (T_4 - T_3)', value: cycle.stats.q_in_cp },
            { label: 'Calore totale', latex: 'q_{in} = q_{cv} + q_{cp}', value: cycle.stats.q_in },
            { label: 'Rendimento reale', latex: '\\eta = \\frac{q_{in} - q_{out}}{q_{in}}', value: cycle.stats.eta },
          ],
          stats: cycle.stats,
        };
      }}
      buildError={() => 'Controlla i dati: r, alpha e rc devono essere maggiori di 1 e il rendimento isentropico deve restare tra 0 e 1.'}
      renderInputs={({ inputs: values, setInputs: updateInputs, accentColor }) => (
        <>
          <h3 className="card-title">Parametri motore</h3>
          <p className="input-hint">
            Usa alpha per la quota isocora e rc per la quota isobara: il Duale diventa davvero chiaro quando li fai variare separatamente e lo confronti con Otto e Diesel.
          </p>
          <div className="inputs-grid">
            <InputField label="Rapporto di compressione" value={values.r} onChange={(value) => updateInputs((prev) => ({ ...prev, r: value }))} accent={accentColor} />
            <InputField label="Rapporto di pressione alpha" value={values.alpha} onChange={(value) => updateInputs((prev) => ({ ...prev, alpha: value }))} step={0.05} accent={accentColor} />
            <InputField label="Rapporto di cut-off" value={values.rc} onChange={(value) => updateInputs((prev) => ({ ...prev, rc: value }))} step={0.05} accent={accentColor} />
          </div>
          <div className="inputs-row">
            <InputField label="Pressione iniziale" value={values.p_low} onChange={(value) => updateInputs((prev) => ({ ...prev, p_low: value }))} unit="bar" accent={accentColor} />
            <InputField label="Temperatura iniziale" value={values.t_min} onChange={(value) => updateInputs((prev) => ({ ...prev, t_min: value }))} unit="degC" accent={accentColor} />
          </div>
          <div className="inputs-row">
            <InputField label="Rendimento isentropico" value={values.eta_s} onChange={(value) => updateInputs((prev) => ({ ...prev, eta_s: value }))} step={0.01} min={0.5} max={1} accent={accentColor} />
            <InputField label="Portata massica" value={values.mass_flow} onChange={(value) => updateInputs((prev) => ({ ...prev, mass_flow: value }))} unit="kg/s" step={0.1} accent={accentColor} />
          </div>
        </>
      )}
      presets={presets}
      insights={{
        takeaways: [
          'Il Duale somma una fase isocora e una isobara: per questo cade tra Otto e Diesel.',
          'Separare q_cv e q_cp aiuta a capire quanto della combustione avviene vicino al PMS.',
          'A parità di r, aumentare alpha intensifica la quota isocora mentre rc allunga la parte isobara.',
        ],
        commonMistake: 'Usare alpha e rc come se controllassero la stessa cosa: alpha agisce sul salto di pressione isocoro, rc sull\'estensione della fase isobara.',
      }}
      legendItems={[
        { label: 'Calore isocoro', color: '#F97316' },
        { label: 'Calore isobaro', color: '#22D3EE' },
        { label: 'Lavoro utile', color: COLOR },
        { label: 'Compressione', color: '#475569' },
      ]}
    />
  );
};

export default DualPage;

