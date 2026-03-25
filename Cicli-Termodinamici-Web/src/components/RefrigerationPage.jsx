import React, { useState, useEffect, useRef, useCallback } from 'react';
import { solveFluid, getSaturationDomeFull } from '../utils/waterProps';
import { generateProcessPath } from '../utils/processPath';
import { Snowflake } from 'lucide-react';
import CyclePageLayout from './shared/CyclePageLayout';
import InputField from './shared/InputField';
import StatCard from './shared/StatCard';
import FormulasSection from './shared/FormulasSection';
import SchematicDiagram from './shared/SchematicDiagram';
import { plotLayout, plotConfig, addTrace, addDomeTrace, pointAnnotations } from './shared/plotConfig';
import { renderPlot, cleanupPlot } from '../utils/plotly';

const COLOR = '#10B981';
const SEGMENT_COLORS = ['#10B981', '#EF4444', '#60A5FA', '#A78BFA'];
const isFiniteNumber = (value) => Number.isFinite(value);

const REFRIGERANTS = [
  { id: 'R134a', name: 'R134a' },
  { id: 'R410A', name: 'R410A' },
  { id: 'R32', name: 'R32' },
  { id: 'R22', name: 'R22' },
  { id: 'R290', name: 'R290 (Propano)' },
  { id: 'R600a', name: 'R600a (Isobutano)' },
];

const RefrigerationPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  const tsRef = useRef(null);
  const phRef = useRef(null);
  const schematicRef = useRef(null);

  const [inputs, setInputs] = useState({
    t_evap: -10, t_cond: 40, sh: 5, sc: 5, eta_s: 0.8, mass_flow: 0.1,
  });
  const [refrigerant, setRefrigerant] = useState('R134a');

  useEffect(() => {
    if (!results) return;

    const renderAllPlots = async () => {
      const pts = results.allPoints;
      const paths = results.segmentPaths;
      if (!paths || paths.length !== 4) return;

      if (tsRef.current) {
        const data = [
          addDomeTrace(results.dome.s, results.dome.t),
          results.idealCompPath ? addTrace(
            results.idealCompPath.map(p => p.s),
            results.idealCompPath.map(p => p.t),
            { name: 'Compressione ideale', color: '#475569', width: 2, dash: 'dash', mode: 'lines' },
          ) : null,
          ...paths.map((path, k) =>
            addTrace(path.map(p => p.s), path.map(p => p.t), {
              name: `Tratto ${k + 1}`,
              color: SEGMENT_COLORS[k],
              width: 3,
              mode: 'lines',
            })
          ),
          addTrace(pts.map(p => p.s), pts.map(p => p.t), { name: 'Stati', color: COLOR, mode: 'markers', markerSize: 8 }),
          results.idealPoint2s ? addTrace(
            [results.idealPoint2s.s], [results.idealPoint2s.t],
            { name: '2s', color: '#475569', mode: 'markers', markerSize: 7 },
          ) : null,
        ].filter(Boolean);
        const layout = plotLayout('Entropia s (kJ/kg\u00B7K)', 'Temperatura T (\u00B0C)');
        layout.annotations = [
          ...pointAnnotations(pts.map(p => ({ x: p.s, y: p.t })),
            ['1\nEvap.', '2\nComp.', '3\nCond.', '4\nValv.'], COLOR),
          ...(results.idealPoint2s ? pointAnnotations(
            [{ x: results.idealPoint2s.s, y: results.idealPoint2s.t }],
            ['2s'], '#475569',
          ) : []),
        ];
        renderPlot(tsRef.current, data, layout, plotConfig);
      }

      if (phRef.current) {
        const data = [
          results.domePh ? addDomeTrace(results.domePh.h, results.domePh.p) : null,
          results.idealCompPath ? addTrace(
            results.idealCompPath.map(p => p.h),
            results.idealCompPath.map(p => p.p),
            { name: 'Compressione ideale', color: '#475569', width: 2, dash: 'dash', mode: 'lines' },
          ) : null,
          ...paths.map((path, k) =>
            addTrace(path.map(p => p.h), path.map(p => p.p), {
              name: `Tratto ${k + 1}`,
              color: SEGMENT_COLORS[k],
              width: 3,
              mode: 'lines',
            })
          ),
          addTrace(pts.map(p => p.h), pts.map(p => p.p), { name: 'Stati', color: '#34D399', mode: 'markers', markerSize: 8 }),
          results.idealPoint2s ? addTrace(
            [results.idealPoint2s.h], [results.idealPoint2s.p],
            { name: '2s', color: '#475569', mode: 'markers', markerSize: 7 },
          ) : null,
        ].filter(Boolean);
        const layout = plotLayout('Entalpia h (kJ/kg)', 'Pressione P (bar)');
        layout.yaxis.type = 'log';
        layout.yaxis.nticks = 8;
        layout.annotations = [
          ...pointAnnotations(pts.map(p => ({ x: p.h, y: p.p })),
            ['1', '2', '3', '4'], COLOR),
          ...(results.idealPoint2s ? pointAnnotations(
            [{ x: results.idealPoint2s.h, y: results.idealPoint2s.p }],
            ['2s'], '#475569',
          ) : []),
        ];
        renderPlot(phRef.current, data, layout, plotConfig);
      }
    };

    renderAllPlots();
    return () => {
      cleanupPlot(tsRef.current);
      cleanupPlot(phRef.current);
    };
  }, [results]);

  const canCalculate = isFiniteNumber(inputs.t_evap) && isFiniteNumber(inputs.t_cond)
    && isFiniteNumber(inputs.sh) && isFiniteNumber(inputs.sc)
    && isFiniteNumber(inputs.eta_s) && isFiniteNumber(inputs.mass_flow)
    && inputs.t_cond > inputs.t_evap && inputs.sh >= 0 && inputs.sc >= 0
    && inputs.eta_s > 0 && inputs.eta_s <= 1 && inputs.mass_flow > 0;

  const calculate = async () => {
    setLoading(true);
    setError(null);
    const fluid = refrigerant;
    try {
      const st1sat = await solveFluid({ t: inputs.t_evap, q: 1 }, fluid);
      const st1 = await solveFluid({ p: st1sat.p, t: inputs.t_evap + inputs.sh }, fluid);
      const st3sat = await solveFluid({ t: inputs.t_cond, q: 0 }, fluid);
      const st2s = await solveFluid({ p: st3sat.p, s: st1.s }, fluid);
      const h2r = st1.h + (st2s.h - st1.h) / inputs.eta_s;
      const st2r = await solveFluid({ p: st3sat.p, h: h2r }, fluid);
      const st3 = await solveFluid({ p: st3sat.p, t: inputs.t_cond - inputs.sc }, fluid);
      const st4 = await solveFluid({ p: st1sat.p, h: st3.h }, fluid);

      const win = st2r.h - st1.h;
      const qlow = st1.h - st4.h;

      const domeFull = await getSaturationDomeFull(fluid);
      const [segmentPaths, idealCompPath] = await Promise.all([
        Promise.all([
          generateProcessPath(st1, st2r, fluid),
          generateProcessPath(st2r, st3, fluid),
          generateProcessPath(st3, st4, fluid),
          generateProcessPath(st4, st1, fluid),
        ]),
        generateProcessPath(st1, st2s, fluid),
      ]);

      setResults({
        allPoints: [st1, st2r, st3, st4],
        idealPoint2s: st2s,
        segmentPaths,
        idealCompPath,
        stats: { win, qlow, qhigh: st2r.h - st3.h, cop: qlow / win, cop_hp: (st2r.h - st3.h) / win, cooling_cap: qlow * inputs.mass_flow },
        dome: domeFull.ts,
        domePh: domeFull.ph,
      });
    } catch (err) {
      setError('Parametri non validi: verificare le temperature di evaporazione e condensazione.');
      console.error(err);
    } finally { setLoading(false); }
  };

  const handleDownloadPDF = useCallback(async () => {
    if (!results) return;
    setDownloadingPDF(true);
    try {
      const { exportToPDF } = await import('../utils/pdfExport');
      await exportToPDF({
        title: 'Frigorifero', accentColor: COLOR, inputs, stats: results.stats,
        points: results.allPoints.map((p, i) => ({
          label: ['1: Evap.', '2: Comp.', '3: Cond.', '4: Valv.'][i],
          t: p.t, p: p.p, h: p.h, s: p.s, v: p.v,
        })),
        formulas: [
          {
            label: 'COP Frigorifero',
            latex: 'COP_{ref} = \\frac{q_L}{w_{in}} = \\frac{h_1 - h_4}{h_2 - h_1}',
            value: results.stats.cop,
            numeric: `(${results.allPoints[0].h.toFixed(2)} - ${results.allPoints[3].h.toFixed(2)}) / (${results.allPoints[1].h.toFixed(2)} - ${results.allPoints[0].h.toFixed(2)}) = ${results.stats.cop.toFixed(2)}`,
          },
          {
            label: 'COP Pompa di Calore',
            latex: 'COP_{hp} = \\frac{q_H}{w_{in}} = \\frac{h_2 - h_3}{h_2 - h_1}',
            value: results.stats.cop_hp,
            numeric: `(${results.allPoints[1].h.toFixed(2)} - ${results.allPoints[2].h.toFixed(2)}) / (${results.allPoints[1].h.toFixed(2)} - ${results.allPoints[0].h.toFixed(2)}) = ${results.stats.cop_hp.toFixed(2)}`,
          },
        ],
        plotRefs: { ts: tsRef, ph: phRef }, schematicRef,
      });
    } catch (err) { console.error(err); }
    finally { setDownloadingPDF(false); }
  }, [results, inputs]);

  const schematicProps = results ? {
    points: results.allPoints,
    pointLabels: ['1 Uscita evaporatore', '2 Uscita compressore', '3 Uscita condensatore', '4 Uscita valvola'],
    summaryItems: [
      { label: 'Lavoro compressore', value: `${results.stats.win.toFixed(1)} kJ/kg`, color: COLOR },
      { label: 'Calore utile QL', value: `${results.stats.qlow.toFixed(1)} kJ/kg`, color: '#38BDF8' },
      { label: 'Calore alto QH', value: `${results.stats.qhigh.toFixed(1)} kJ/kg`, color: '#F87171' },
      { label: 'COP', value: `${results.stats.cop.toFixed(2)}`, color: COLOR },
    ],
  } : null;

  const diagramTabs = results ? [
    { id: 'ts', label: 'T-s', active: activeTab === 0, onClick: () => setActiveTab(0), content: <div ref={tsRef} className="plot-area" /> },
    { id: 'ph', label: 'P-h', active: activeTab === 1, onClick: () => setActiveTab(1), content: <div ref={phRef} className="plot-area" /> },
    { id: 'schema', label: 'Schema', active: activeTab === 2, onClick: () => setActiveTab(2), content: <div ref={schematicRef}><SchematicDiagram type="refrigeration" accentColor={COLOR} {...schematicProps} /></div> },
  ] : null;

  const formulasSection = results ? (
    <FormulasSection accentColor={COLOR}
      points={results.allPoints.map((p, i) => ({
        label: ['1: Evap.', '2: Comp.', '3: Cond.', '4: Valv.'][i],
        t: p.t, p: p.p, h: p.h, s: p.s, v: p.v,
      }))}
      formulas={[
        { label: 'Punto 1 — Uscita evaporatore', latex: 'P_1 = P_{sat}(T_{evap}), \\quad T_1 = T_{evap} + \\Delta T_{sh}' },
        { label: 'Punto 2 — Uscita compressore (reale)', latex: 'h_2 = h_1 + \\frac{h_{2s} - h_1}{\\eta_s}, \\quad P_2 = P_{sat}(T_{cond})' },
        { label: 'Punto 3 — Uscita condensatore', latex: 'P_3 = P_2, \\quad T_3 = T_{cond} - \\Delta T_{sc}' },
        { label: 'Punto 4 — Uscita valvola (isentalpica)', latex: 'h_4 = h_3, \\quad P_4 = P_1' },
        { label: 'Lavoro Compressore', latex: 'w_{in} = h_2 - h_1', value: results.stats.win },
        { label: 'Capacità Frigorifera', latex: 'q_L = h_1 - h_4', value: results.stats.qlow },
        { label: 'Calore Alto', latex: 'q_H = h_2 - h_3', value: results.stats.qhigh },
        { label: 'COP Frigorifero', latex: 'COP_{ref} = \\frac{h_1 - h_4}{h_2 - h_1}', value: results.stats.cop, display: true },
        { label: 'COP Pompa di Calore', latex: 'COP_{hp} = \\frac{h_2 - h_3}{h_2 - h_1}', value: results.stats.cop_hp, display: true },
        { label: 'Potenza Frigorifera', latex: '\\dot{Q}_L = \\dot{m} \\cdot q_L', value: results.stats.cooling_cap },
      ]}
    />
  ) : null;

  const stats = results ? (
    <div className="stats-row">
      <StatCard label="COP Frigorifero" value={results.stats.cop.toFixed(2)} accent color={COLOR} />
      <StatCard label="COP Pompa di Calore" value={results.stats.cop_hp.toFixed(2)} />
      <StatCard label="Capacità Frigorifera" value={`${results.stats.cooling_cap.toFixed(2)} kW`} />
      <StatCard label="Lavoro Compressore" value={`${results.stats.win.toFixed(1)} kJ/kg`} />
    </div>
  ) : null;

  return (
    <CyclePageLayout badge="Sistemi di Raffreddamento" title="Ciclo" titleAccent="Frigorifero" accentColor={COLOR}
      loading={loading} error={error} results={results} onCalculate={calculate} canCalculate={canCalculate}
      stats={stats} diagramTabs={diagramTabs} formulasSection={formulasSection}
      onDownloadPDF={handleDownloadPDF} downloadingPDF={downloadingPDF} EmptyIcon={Snowflake}>
      <h3 className="card-title">Parametri Refrigerante</h3>
      <div className="inputs-grid">
        <div className="input-field">
          <label className="input-label" style={{ color: COLOR }}>Refrigerante</label>
          <select
            value={refrigerant}
            onChange={e => setRefrigerant(e.target.value)}
            style={{
              background: '#1E293B', color: '#E2E8F0', border: `1px solid ${COLOR}40`,
              borderRadius: '8px', padding: '8px 12px', fontSize: '14px', width: '100%',
            }}
          >
            {REFRIGERANTS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      </div>
      <div className="inputs-grid">
        <InputField label="Temperatura Evaporazione" value={inputs.t_evap} onChange={v => setInputs({ ...inputs, t_evap: v })} unit="°C" accent={COLOR} />
        <InputField label="Temperatura Condensazione" value={inputs.t_cond} onChange={v => setInputs({ ...inputs, t_cond: v })} unit="°C" accent={COLOR} />
      </div>
      <div className="inputs-row">
        <InputField label="Surriscaldamento" value={inputs.sh} onChange={v => setInputs({ ...inputs, sh: v })} unit="K" min={0} accent={COLOR} />
        <InputField label="Sottoraffreddamento" value={inputs.sc} onChange={v => setInputs({ ...inputs, sc: v })} unit="K" min={0} accent={COLOR} />
      </div>
      <div className="inputs-row">
        <InputField label="η Compressore" value={inputs.eta_s} onChange={v => setInputs({ ...inputs, eta_s: v })} step={0.01} min={0.5} max={1} accent={COLOR} />
        <InputField label="Portata Massica" value={inputs.mass_flow} onChange={v => setInputs({ ...inputs, mass_flow: v })} unit="kg/s" step={0.01} accent={COLOR} />
      </div>
    </CyclePageLayout>
  );
};

export default RefrigerationPage;
