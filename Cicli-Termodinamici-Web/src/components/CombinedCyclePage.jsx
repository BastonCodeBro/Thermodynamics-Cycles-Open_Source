import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Factory } from 'lucide-react';
import CyclePageLayout from './shared/CyclePageLayout';
import InputField from './shared/InputField';
import StatCard from './shared/StatCard';
import FormulasSection from './shared/FormulasSection';
import SchematicDiagram from './shared/SchematicDiagram';
import { plotLayout, plotConfig, addTrace, addDomeTrace, addFillTrace, pointAnnotations } from './shared/plotConfig';
import { renderPlot, cleanupPlot } from '../utils/plotly';
import { generateProcessPath } from '../utils/processPath';
import { calcCombinedCycle } from '../utils/combinedCycle';
import { resolveCycleDisplayResult } from '../utils/thermoCycleResolver';

const COLOR = '#F59E0B';

const CombinedCyclePage = () => {
  const [inputs, setInputs] = useState({
    p_low_air: 1,
    beta: 10,
    t_air_in: 20,
    t_turb_in: 1100,
    eta_c: 0.86,
    eta_t_gas: 0.89,
    mass_flow_gas: 3,
    eta_hrsg: 0.72,
    p_high_steam: 90,
    p_low_steam: 0.08,
    eta_t_steam: 0.86,
    eta_p_steam: 0.85,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  const gasTsRef = useRef(null);
  const steamTsRef = useRef(null);
  const schematicRef = useRef(null);

  useEffect(() => {
    if (!results) return undefined;
    const gasNode = gasTsRef.current;
    const steamNode = steamTsRef.current;

    const renderAllPlots = async () => {
      const gasPoints = results.brayton.realPoints;
      const steamPoints = results.rankine.actualPoints;
      const gasPathOptions = [
        { processType: 'polytropic', model: 'ideal-gas' },
        { processType: 'isobaric', model: 'ideal-gas' },
        { processType: 'polytropic', model: 'ideal-gas' },
        { processType: 'isobaric', model: 'ideal-gas' },
      ];
      const gasPaths = await Promise.all(
        gasPoints.map((point, index) =>
          generateProcessPath(point, gasPoints[(index + 1) % gasPoints.length], 'Air', 64, gasPathOptions[index]),
        ),
      );

      if (gasTsRef.current) {
        const data = [
          ...gasPaths.map((path, index) =>
            addTrace(path.map((point) => point.s), path.map((point) => point.t), {
              color: ['#60A5FA', '#F97316', '#34D399', '#94A3B8'][index],
              width: 3,
              mode: 'lines',
            }),
          ),
          addTrace(gasPoints.map((point) => point.s), gasPoints.map((point) => point.t), {
            color: COLOR,
            mode: 'markers',
            markerSize: 9,
          }),
        ];
        const layout = plotLayout('Entropia s (kJ/(kg K))', 'Temperatura T (degC)');
        layout.annotations = pointAnnotations(gasPoints.map((point) => ({ x: point.s, y: point.t })), ['1', '2', '3', '4'], COLOR);
        renderPlot(gasTsRef.current, data, layout, plotConfig);
      }

      if (steamTsRef.current) {
        const data = [
          results.rankine.dome?.ts?.s?.length
            ? addFillTrace(results.rankine.dome.ts.s, results.rankine.dome.ts.t, {
              fillcolor: 'rgba(56, 189, 248, 0.08)',
              name: 'Cupola di saturazione',
            })
            : null,
          results.rankine.dome?.ts?.s?.length ? addDomeTrace(results.rankine.dome.ts.s, results.rankine.dome.ts.t) : null,
          ...results.rankine.actualPaths.map((path, index) =>
            addTrace(path.map((point) => point.s), path.map((point) => point.t), {
              color: ['#F59E0B', '#F97316', '#EF4444', '#22D3EE'][index] ?? '#38BDF8',
              width: 3,
              mode: 'lines',
            }),
          ),
          addTrace(steamPoints.map((point) => point.s), steamPoints.map((point) => point.t), {
            color: '#38BDF8',
            mode: 'markers',
            markerSize: 9,
          }),
        ].filter(Boolean);
        const layout = plotLayout('Entropia s (kJ/(kg K))', 'Temperatura T (degC)');
        layout.annotations = pointAnnotations(steamPoints.map((point) => ({ x: point.s, y: point.t })), ['1', '2', '3', '4'], '#38BDF8');
        renderPlot(steamTsRef.current, data, layout, plotConfig);
      }
    };

    renderAllPlots();
    return () => {
      cleanupPlot(gasNode);
      cleanupPlot(steamNode);
    };
  }, [results]);

  const canCalculate = Number.isFinite(inputs.p_low_air)
    && Number.isFinite(inputs.beta)
    && Number.isFinite(inputs.t_air_in)
    && Number.isFinite(inputs.t_turb_in)
    && Number.isFinite(inputs.eta_c)
    && Number.isFinite(inputs.eta_t_gas)
    && Number.isFinite(inputs.mass_flow_gas)
    && Number.isFinite(inputs.eta_hrsg)
    && Number.isFinite(inputs.p_high_steam)
    && Number.isFinite(inputs.p_low_steam)
    && Number.isFinite(inputs.eta_t_steam)
    && Number.isFinite(inputs.eta_p_steam)
    && inputs.beta > 1
    && inputs.t_turb_in > inputs.t_air_in
    && inputs.mass_flow_gas > 0
    && inputs.eta_hrsg > 0
    && inputs.eta_hrsg <= 1
    && inputs.p_high_steam > inputs.p_low_steam;

  const calculate = async () => {
    setLoading(true);
    setError(null);
    try {
      setResults(await resolveCycleDisplayResult({
        cycleId: 'combined',
        family: 'combined',
        primaryFluid: 'Mixed',
        inputs,
        computeLocalResult: async () => calcCombinedCycle(inputs),
        mapResultToDisplay: (cycle) => cycle,
      }));
    } catch (calculationError) {
      setError('Controlla i dati: il blocco Brayton deve avere T turbina maggiore di T ingresso, e il blocco Rankine richiede P caldaia > P condensatore con rendimenti tra 0 e 1.');
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
        title: 'Ciclo combinato gas-vapore',
        accentColor: COLOR,
        inputs,
        stats: results.stats,
        points: [
          ...results.brayton.realPoints.map((point, index) => ({
            label: `G${index + 1}`,
            t: point.t,
            p: point.p,
            h: point.h,
            s: point.s,
            v: point.v,
          })),
          ...results.rankine.actualPoints.map((point, index) => ({
            label: `V${index + 1}`,
            t: point.t,
            p: point.p,
            h: point.h,
            s: point.s,
            v: point.v,
          })),
        ],
        formulas: [
          { label: 'Recupero HRSG', latex: 'q_{rec} = \\eta_{HRSG} \\dot{m}_{gas} c_p (T_4 - T_1)', value: results.stats.q_recovered },
          { label: 'Potenza Brayton', latex: '\\dot{W}_{gas} = \\dot{m}_{gas}(w_t - w_c)', value: results.stats.power_brayton },
          { label: 'Potenza Rankine', latex: '\\dot{W}_{vap} = \\dot{m}_{vap}(w_t - w_p)', value: results.stats.power_rankine },
          { label: 'Potenza totale', latex: '\\dot{W}_{tot} = \\dot{W}_{gas} + \\dot{W}_{vap}', value: results.stats.power_total },
          { label: 'Rendimento totale', latex: '\\eta_{tot} = \\frac{\\dot{W}_{tot}}{\\dot{Q}_{fuel}}', value: results.stats.eta_total },
        ],
        plotRefs: { gas_ts: gasTsRef, steam_ts: steamTsRef },
        schematicRef,
      });
    } catch (downloadError) {
      console.error(downloadError);
    } finally {
      setDownloadingPDF(false);
    }
  }, [inputs, results]);

  const formulasSection = results ? (
    <FormulasSection
      accentColor={COLOR}
      points={[
        ...results.brayton.realPoints.map((point, index) => ({
          label: `G${index + 1}`,
          t: point.t,
          p: point.p,
          h: point.h,
          s: point.s,
          v: point.v,
        })),
        ...results.rankine.actualPoints.map((point, index) => ({
          label: `V${index + 1}`,
          t: point.t,
          p: point.p,
          h: point.h,
          s: point.s,
          v: point.v,
        })),
      ]}
      formulas={[
        { label: 'Recupero HRSG', latex: 'q_{rec} = \\eta_{HRSG} \\dot{m}_{gas} c_p (T_4 - T_1)', value: results.stats.q_recovered },
        { label: 'Portata vapore', latex: '\\dot{m}_{vap} = \\frac{\\dot{Q}_{rec}}{q_{in,Rankine}}', value: results.massFlowSteam, unit: 'kg/s' },
        { label: 'Potenza Brayton', latex: '\\dot{W}_{gas} = \\dot{m}_{gas}(w_t - w_c)', value: results.stats.power_brayton, unit: 'kW' },
        { label: 'Potenza Rankine', latex: '\\dot{W}_{vap} = \\dot{m}_{vap}(w_t - w_p)', value: results.stats.power_rankine, unit: 'kW' },
        { label: 'Potenza totale', latex: '\\dot{W}_{tot} = \\dot{W}_{gas} + \\dot{W}_{vap}', value: results.stats.power_total, unit: 'kW' },
        { label: 'Rendimento totale', latex: '\\eta_{tot} = \\frac{\\dot{W}_{tot}}{\\dot{Q}_{fuel}} \\times 100', value: results.stats.eta_total, unit: '%', display: true },
      ]}
    />
  ) : null;

  const stats = results ? (
    <div className="stats-row">
      <StatCard label="Rendimento totale" value={`${results.stats.eta_total.toFixed(2)}%`} accent color={COLOR} />
      <StatCard label="Potenza Brayton" value={`${results.stats.power_brayton.toFixed(1)} kW`} />
      <StatCard label="Potenza Rankine" value={`${results.stats.power_rankine.toFixed(1)} kW`} />
      <StatCard label="Potenza totale" value={`${results.stats.power_total.toFixed(1)} kW`} />
    </div>
  ) : null;

  const diagramTabs = results ? [
    { id: 'gas-ts', label: 'T-s gas', active: activeTab === 0, onClick: () => setActiveTab(0), content: <div ref={gasTsRef} className="plot-area" /> },
    { id: 'steam-ts', label: 'T-s vapore', active: activeTab === 1, onClick: () => setActiveTab(1), content: <div ref={steamTsRef} className="plot-area" /> },
    {
      id: 'schema',
      label: 'Schema',
      active: activeTab === 2,
      onClick: () => setActiveTab(2),
      content: (
        <div ref={schematicRef}>
          <SchematicDiagram
            type="combined"
            accentColor={COLOR}
            points={[
              results.brayton.realPoints[0],
              results.rankine.actualPoints[1],
              results.brayton.realPoints[2],
              results.brayton.realPoints[3],
              results.rankine.actualPoints[2],
              results.rankine.actualPoints[3],
            ]}
            pointLabels={['G1 Ingresso comp.', 'V2 Uscita pompa', 'G3 Ingresso turbina', 'G4 Scarico gas', 'V3 Vapore vivo', 'V4 Scarico turbina']}
            summaryItems={[
              { label: 'Q recuperato', value: `${results.stats.q_recovered.toFixed(1)} kW`, color: '#F59E0B' },
              { label: 'Portata vapore', value: `${results.massFlowSteam.toFixed(2)} kg/s`, color: '#38BDF8' },
              { label: 'P Brayton', value: `${results.stats.power_brayton.toFixed(1)} kW`, color: '#34D399' },
              { label: 'P Rankine', value: `${results.stats.power_rankine.toFixed(1)} kW`, color: '#38BDF8' },
              { label: 'Rendimento totale', value: `${results.stats.eta_total.toFixed(2)} %`, color: COLOR },
            ]}
          />
        </div>
      ),
    },
  ] : null;

  return (
    <CyclePageLayout
      badge="Impianto Integrato"
      title="Ciclo"
      titleAccent="Combinato Gas-Vapore"
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
      EmptyIcon={Factory}
      emptyText="Imposta il blocco gas e il blocco vapore per vedere come il recupero HRSG alza il rendimento globale."
      solverMeta={results?.solverMeta}
      presets={[
        { label: 'Base', values: { p_low_air: 1, beta: 10, t_air_in: 20, t_turb_in: 1100, eta_c: 0.86, eta_t_gas: 0.89, mass_flow_gas: 3, eta_hrsg: 0.72, p_high_steam: 90, p_low_steam: 0.08, eta_t_steam: 0.86, eta_p_steam: 0.85 } },
        { label: 'Caso esame', values: { p_low_air: 1, beta: 11, t_air_in: 15, t_turb_in: 1150, eta_c: 0.87, eta_t_gas: 0.9, mass_flow_gas: 3.4, eta_hrsg: 0.76, p_high_steam: 100, p_low_steam: 0.07, eta_t_steam: 0.87, eta_p_steam: 0.86 } },
        { label: 'Caso inefficiente', values: { p_low_air: 1, beta: 7.5, t_air_in: 30, t_turb_in: 980, eta_c: 0.76, eta_t_gas: 0.82, mass_flow_gas: 2.8, eta_hrsg: 0.52, p_high_steam: 70, p_low_steam: 0.12, eta_t_steam: 0.78, eta_p_steam: 0.8 } },
      ]}
      onApplyPreset={(values) => setInputs((current) => ({ ...current, ...values }))}
      insights={{
        takeaways: [
          'La turbina a gas produce il primo lavoro utile e fornisce la sorgente di recupero per l HRSG.',
          'La portata di vapore nasce dal calore recuperato: non viene imposta a mano in questa fase didattica.',
          'Il rendimento totale cresce quando il blocco Brayton scarica ancora gas abbastanza caldi da alimentare bene il Rankine.',
        ],
        commonMistake: 'Sommare i rendimenti percentuali dei due cicli: quello corretto si ottiene sommando le potenze e confrontandole con il calore combustibile del blocco gas.',
      }}
      legendItems={[
        { label: 'Recupero HRSG', color: '#F59E0B' },
        { label: 'Potenza blocco gas', color: '#34D399' },
        { label: 'Potenza blocco vapore', color: '#38BDF8' },
        { label: 'Compressione/pompaggio', color: '#60A5FA' },
      ]}
    >
      <h3 className="card-title">Blocco gas</h3>
      <p className="input-hint">
        Parti dal Brayton: questo blocco fornisce sia potenza diretta sia il calore residuo che l HRSG gira al ciclo a vapore.
      </p>
      <div className="inputs-grid">
        <InputField label="Pressione aria in ingresso" value={inputs.p_low_air} onChange={(value) => setInputs((prev) => ({ ...prev, p_low_air: value }))} unit="bar" accent={COLOR} />
        <InputField label="Rapporto di compressione" value={inputs.beta} onChange={(value) => setInputs((prev) => ({ ...prev, beta: value }))} accent={COLOR} />
        <InputField label="Temperatura aria ingresso" value={inputs.t_air_in} onChange={(value) => setInputs((prev) => ({ ...prev, t_air_in: value }))} unit="degC" accent={COLOR} />
      </div>
      <div className="inputs-row">
        <InputField label="Temperatura ingresso turbina" value={inputs.t_turb_in} onChange={(value) => setInputs((prev) => ({ ...prev, t_turb_in: value }))} unit="degC" accent={COLOR} />
        <InputField label="Portata gas" value={inputs.mass_flow_gas} onChange={(value) => setInputs((prev) => ({ ...prev, mass_flow_gas: value }))} unit="kg/s" step={0.1} accent={COLOR} />
      </div>
      <div className="inputs-row">
        <InputField label="Rendimento compressore" value={inputs.eta_c} onChange={(value) => setInputs((prev) => ({ ...prev, eta_c: value }))} step={0.01} min={0.5} max={1} accent={COLOR} />
        <InputField label="Rendimento turbina gas" value={inputs.eta_t_gas} onChange={(value) => setInputs((prev) => ({ ...prev, eta_t_gas: value }))} step={0.01} min={0.5} max={1} accent={COLOR} />
      </div>
      <h3 className="card-title">HRSG e blocco vapore</h3>
      <p className="input-hint">
        In questa versione didattica la portata di vapore non si imposta: nasce dal recupero termico disponibile nell HRSG e quindi dipende dal blocco gas.
      </p>
      <div className="inputs-row">
        <InputField label="Efficienza HRSG" value={inputs.eta_hrsg} onChange={(value) => setInputs((prev) => ({ ...prev, eta_hrsg: value }))} step={0.01} min={0.3} max={1} accent={COLOR} />
        <InputField label="Pressione caldaia vapore" value={inputs.p_high_steam} onChange={(value) => setInputs((prev) => ({ ...prev, p_high_steam: value }))} unit="bar" accent={COLOR} />
      </div>
      <div className="inputs-row">
        <InputField label="Pressione condensatore" value={inputs.p_low_steam} onChange={(value) => setInputs((prev) => ({ ...prev, p_low_steam: value }))} unit="bar" accent={COLOR} />
        <InputField label="Rendimento turbina vapore" value={inputs.eta_t_steam} onChange={(value) => setInputs((prev) => ({ ...prev, eta_t_steam: value }))} step={0.01} min={0.5} max={1} accent={COLOR} />
      </div>
      <InputField label="Rendimento pompa" value={inputs.eta_p_steam} onChange={(value) => setInputs((prev) => ({ ...prev, eta_p_steam: value }))} step={0.01} min={0.5} max={1} accent={COLOR} />
    </CyclePageLayout>
  );
};

export default CombinedCyclePage;

