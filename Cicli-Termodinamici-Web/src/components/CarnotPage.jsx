import React, { useMemo, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import InputField from './shared/InputField';
import IdealGasCyclePage from './shared/IdealGasCyclePage';
import { calcCarnotCycle, calcReverseCarnotCycle } from '../utils/idealGas';
import { pointAnnotations } from './shared/plotConfig';

const COLOR = '#A78BFA';
const MODES = {
  engine: {
    label: 'Motore',
    title: 'Carnot',
    schematicType: 'carnot',
  },
  reverse: {
    label: 'Carnot inverso',
    title: 'Carnot Inverso',
    schematicType: 'reverse-carnot',
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
      pointAnnotations(points.map((point) => ({ x: point.s, y: point.t })), ['1', '2', '3', '4'], accentColor),
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

const presets = {
  engine: [
    { label: 'Base', values: { t_high: 500, t_low: 25, p_ref: 1, ds: 0.5, mass_flow: 1 } },
    { label: 'Caso esame', values: { t_high: 650, t_low: 35, p_ref: 1, ds: 0.45, mass_flow: 1.2 } },
    { label: 'Caso inefficiente', values: { t_high: 420, t_low: 55, p_ref: 1, ds: 0.55, mass_flow: 1 } },
  ],
  reverse: [
    { label: 'Base', values: { t_high: 35, t_low: -5, p_ref: 2, ds: 0.45, mass_flow: 1 } },
    { label: 'Caso esame', values: { t_high: 45, t_low: -10, p_ref: 2.2, ds: 0.5, mass_flow: 1 } },
    { label: 'Caso inefficiente', values: { t_high: 55, t_low: 5, p_ref: 2, ds: 0.4, mass_flow: 1 } },
  ],
};

const CarnotPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = MODES[searchParams.get('mode')] ? searchParams.get('mode') : 'engine';
  const [inputs, setInputs] = useState({
    t_high: 500,
    t_low: 25,
    p_ref: 1.0,
    ds: 0.5,
    mass_flow: 1.0,
  });

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

  const canCalculate = Number.isFinite(inputs.t_high)
    && Number.isFinite(inputs.t_low)
    && Number.isFinite(inputs.p_ref)
    && Number.isFinite(inputs.mass_flow)
    && Number.isFinite(inputs.ds)
    && inputs.t_high > inputs.t_low
    && inputs.p_ref > 0
    && inputs.mass_flow > 0
    && inputs.ds > 0;

  return (
    <IdealGasCyclePage
      badge="Ciclo Ideale"
      title="Ciclo"
      titleAccent={MODES[mode].title}
      accentColor={COLOR}
      EmptyIcon={RotateCw}
      emptyText="Definisci le due sorgenti termiche per calcolare il limite teorico di rendimento o di COP."
      inputs={inputs}
      setInputs={setInputs}
      canCalculate={canCalculate}
      plotDefinitions={plotDefinitions}
      getPathOptions={({ mode: activeMode }) => activeMode === 'reverse'
        ? {
          real: [
            { processType: 'isothermal', model: 'ideal-gas' },
            { processType: 'isentropic', model: 'ideal-gas' },
            { processType: 'isothermal', model: 'ideal-gas' },
            { processType: 'isentropic', model: 'ideal-gas' },
          ],
          ideal: [],
        }
        : {
          real: [
            { processType: 'isothermal', model: 'ideal-gas' },
            { processType: 'isentropic', model: 'ideal-gas' },
            { processType: 'isothermal', model: 'ideal-gas' },
            { processType: 'isentropic', model: 'ideal-gas' },
          ],
          ideal: [],
        }}
      buildResult={async (values, activeMode) => {
        const cycle = activeMode === 'reverse'
          ? calcReverseCarnotCycle({
            tHighC: values.t_high,
            tLowC: values.t_low,
            pRefBar: values.p_ref,
            ds: values.ds,
            massFlow: values.mass_flow,
          })
          : calcCarnotCycle({
            tHighC: values.t_high,
            tLowC: values.t_low,
            pRefBar: values.p_ref,
            ds: values.ds,
            massFlow: values.mass_flow,
          });

        const summaryItems = activeMode === 'reverse'
          ? [
            { label: 'Q fredda', value: `${cycle.stats.Q_low.toFixed(1)} kJ/kg`, color: '#3B82F6' },
            { label: 'Q calda', value: `${cycle.stats.Q_high.toFixed(1)} kJ/kg`, color: '#EF4444' },
            { label: 'COP frigorifero', value: `${cycle.stats.cop.toFixed(2)}`, color: COLOR },
            { label: 'COP pompa di calore', value: `${cycle.stats.cop_hp.toFixed(2)}`, color: COLOR },
          ]
          : [
            { label: 'Q in', value: `${cycle.stats.Q_in.toFixed(1)} kJ/kg`, color: '#EF4444' },
            { label: 'Q out', value: `${cycle.stats.Q_out.toFixed(1)} kJ/kg`, color: '#3B82F6' },
            { label: 'Lavoro netto', value: `${cycle.stats.W_net.toFixed(1)} kJ/kg`, color: COLOR },
            { label: 'Rendimento', value: `${cycle.stats.eta.toFixed(2)} %`, color: COLOR },
          ];

        const formulas = activeMode === 'reverse'
          ? [
            { label: 'Calore assorbito al freddo', latex: 'Q_L = T_L \\cdot \\Delta s', value: cycle.stats.Q_low },
            { label: 'Calore ceduto al caldo', latex: 'Q_H = T_H \\cdot \\Delta s', value: cycle.stats.Q_high },
            { label: 'Lavoro assorbito', latex: 'W_{in} = Q_H - Q_L', value: cycle.stats.W_in },
            { label: 'COP frigorifero', latex: 'COP_R = \\frac{Q_L}{W_{in}} = \\frac{T_L}{T_H - T_L}', value: cycle.stats.cop, display: true },
            { label: 'COP pompa di calore', latex: 'COP_{HP} = \\frac{Q_H}{W_{in}}', value: cycle.stats.cop_hp, display: true },
          ]
          : [
            { label: '1 → 2', description: 'Espansione isoterma a', latex: 'T_H' },
            { label: '2 → 3', description: 'Espansione isentropica' },
            { label: '3 → 4', description: 'Compressione isoterma a', latex: 'T_L' },
            { label: '4 → 1', description: 'Compressione isentropica' },
            { label: 'Calore assorbito', latex: 'Q_{in} = T_H \\cdot \\Delta s', value: cycle.stats.Q_in },
            { label: 'Calore ceduto', latex: 'Q_{out} = T_L \\cdot \\Delta s', value: cycle.stats.Q_out },
            { label: 'Lavoro netto', latex: 'W_{net} = Q_{in} - Q_{out}', value: cycle.stats.W_net },
            { label: 'Rendimento Carnot', latex: '\\eta = 1 - \\frac{T_L}{T_H}', value: cycle.stats.eta, display: true },
          ];

        return {
          allPoints: cycle.points,
          idealPoints: [],
          schematicType: MODES[activeMode].schematicType,
          pointLabels: activeMode === 'reverse'
            ? ['1 Uscita evaporatore ideale', '2 Fine evaporazione isoterma', '3 Fine compressione isentropica', '4 Fine condensazione isoterma']
            : ['1 Isoterma TH', '2 Fine espansione', '3 Isoterma TL', '4 Fine compressione'],
          summaryItems,
          statCards: activeMode === 'reverse'
            ? [
              { label: 'COP frigorifero', value: cycle.stats.cop.toFixed(2), accent: true, color: COLOR },
              { label: 'COP pompa di calore', value: cycle.stats.cop_hp.toFixed(2) },
              { label: 'Lavoro assorbito', value: `${cycle.stats.W_in.toFixed(1)} kJ/kg` },
              { label: 'Potenza richiesta', value: `${cycle.stats.power.toFixed(1)} kW` },
            ]
            : [
              { label: 'Rendimento Carnot', value: `${cycle.stats.eta.toFixed(2)}%`, accent: true, color: COLOR },
              { label: 'Potenza netta', value: `${cycle.stats.power.toFixed(1)} kW` },
              { label: 'Calore in', value: `${cycle.stats.Q_in.toFixed(1)} kJ/kg` },
              { label: 'Calore out', value: `${cycle.stats.Q_out.toFixed(1)} kJ/kg` },
            ],
          formulas,
          pdfTitle: MODES[activeMode].title,
          formulaPointLabels: ['1', '2', '3', '4'],
          pdfPointLabels: ['1', '2', '3', '4'],
          pdfFormulas: formulas,
          stats: cycle.stats,
        };
      }}
      buildError={() => 'Servono T calda maggiore di T fredda, pressione di riferimento positiva e variazione di entropia maggiore di zero.'}
      renderInputs={({ inputs: values, setInputs: updateInputs, accentColor, mode: activeMode }) => (
        <>
          <h3 className="card-title">Parametri del ciclo</h3>
          <p className="input-hint">
            {activeMode === 'reverse'
              ? 'Carnot inverso ideale: utile per confrontare il COP massimo teorico di un frigorifero o di una pompa di calore.'
              : 'Motore di Carnot ideale su gas ideale: il rendimento dipende solo dalle temperature assolute delle sorgenti.'}
          </p>
          <div className="inputs-grid">
            <InputField label={activeMode === 'reverse' ? 'Temperatura calda' : 'Temperatura alta'} value={values.t_high} onChange={(value) => updateInputs((prev) => ({ ...prev, t_high: value }))} unit="degC" accent={accentColor} />
            <InputField label={activeMode === 'reverse' ? 'Temperatura fredda' : 'Temperatura bassa'} value={values.t_low} onChange={(value) => updateInputs((prev) => ({ ...prev, t_low: value }))} unit="degC" accent={accentColor} />
          </div>
          <div className="inputs-row">
            <InputField label="Pressione di riferimento" value={values.p_ref} onChange={(value) => updateInputs((prev) => ({ ...prev, p_ref: value }))} unit="bar" accent={accentColor} />
            <InputField label="Variazione di entropia" value={values.ds} onChange={(value) => updateInputs((prev) => ({ ...prev, ds: value }))} step={0.05} min={0.1} accent={accentColor} />
          </div>
          <InputField label="Portata massica" value={values.mass_flow} onChange={(value) => updateInputs((prev) => ({ ...prev, mass_flow: value }))} unit="kg/s" step={0.1} accent={accentColor} />
        </>
      )}
      modeOptions={modeOptions}
      activeMode={mode}
      presets={presets[mode]}
      insights={{
        takeaways: activeModeSummary(mode),
        commonMistake: mode === 'reverse'
          ? 'Confrontare il COP reale con il rendimento di un motore: il COP è un rapporto diverso e può essere maggiore di 1.'
          : 'Usare gradi Celsius nella formula del rendimento: Carnot richiede sempre temperature assolute.',
      }}
      legendItems={[
        { label: 'Calore dalla sorgente calda', color: '#EF4444' },
        { label: 'Calore verso sorgente fredda', color: '#3B82F6' },
        { label: 'Lavoro', color: COLOR },
      ]}
    />
  );
};

const activeModeSummary = (mode) => (
  mode === 'reverse'
    ? [
      'Ridurre il salto termico tra sorgente calda e fredda aumenta subito il COP teorico.',
      'Il Carnot inverso fornisce un riferimento massimo: nessun frigorifero reale può superarlo.',
      'Confronta COP_R e COP_HP per capire se stai guardando il lato freddo o il lato caldo dell\'impianto.',
    ]
    : [
      'Il rendimento cresce se T_H aumenta o se T_L diminuisce.',
      'I tratti isentropici chiudono il ciclo senza scambio termico.',
      'Carnot è il riferimento teorico da usare per leggere quanto un ciclo reale è lontano dal limite.',
    ]
);

export default CarnotPage;

