import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flame, Loader2, Download } from 'lucide-react';
import InputField from './shared/InputField';
import FormulasSection from './shared/FormulasSection';
import StatCard from './shared/StatCard';
import { solveFluid, getSaturationDomeFull } from '../utils/waterProps';
import { generateProcessPath } from '../utils/processPath';
import {
  plotLayout,
  plotConfig,
  addTrace,
  addDomeTrace,
  addFillTrace,
} from './shared/plotConfig';
import { renderPlot, cleanupPlot } from '../utils/plotly';

const COLOR = '#38BDF8';
const PATH_COLORS = ['#38BDF8', '#EF4444', '#22D3EE', '#60A5FA', '#A78BFA', '#F59E0B'];

const PROPERTY_META = {
  p: { label: 'Pressione', unit: 'bar', defaultValue: 1 },
  t: { label: 'Temperatura', unit: 'C', defaultValue: 100 },
  h: { label: 'Entalpia', unit: 'kJ/kg', defaultValue: 2800 },
  s: { label: 'Entropia', unit: 'kJ/kg K', defaultValue: 7 },
  v: { label: 'Volume specifico', unit: 'm^3/kg', defaultValue: 1 },
  q: { label: 'Titolo x', unit: '-', defaultValue: 0.9 },
};

const MODE_SPECS = [
  {
    id: 'pt',
    label: 'P + T',
    build: ({ a, b }) => ({ p: a, t: b }),
    fields: [
      { key: 'a', label: 'Pressione', unit: 'bar' },
      { key: 'b', label: 'Temperatura', unit: 'C' },
    ],
  },
  {
    id: 'ph',
    label: 'P + h',
    build: ({ a, b }) => ({ p: a, h: b }),
    fields: [
      { key: 'a', label: 'Pressione', unit: 'bar' },
      { key: 'b', label: 'Entalpia', unit: 'kJ/kg' },
    ],
  },
  {
    id: 'ps',
    label: 'P + s',
    build: ({ a, b }) => ({ p: a, s: b }),
    fields: [
      { key: 'a', label: 'Pressione', unit: 'bar' },
      { key: 'b', label: 'Entropia', unit: 'kJ/kg K' },
    ],
  },
  {
    id: 'pq',
    label: 'P + x',
    build: ({ a, b }) => ({ p: a, q: b }),
    fields: [
      { key: 'a', label: 'Pressione', unit: 'bar' },
      { key: 'b', label: 'Titolo x', unit: '-' },
    ],
  },
  {
    id: 'tq',
    label: 'T + x',
    build: ({ a, b }) => ({ t: a, q: b }),
    fields: [
      { key: 'a', label: 'Temperatura', unit: 'C' },
      { key: 'b', label: 'Titolo x', unit: '-' },
    ],
  },
];

const TRANSFORMATION_SPECS = [
  {
    id: 'isobaric',
    label: 'Isobara (P cost)',
    constantKey: 'p',
    allowedTargets: ['t', 'h', 's', 'v', 'q'],
  },
  {
    id: 'isothermal',
    label: 'Isoterma (T cost)',
    constantKey: 't',
    allowedTargets: ['p', 'v', 'q'],
  },
  {
    id: 'isochoric',
    label: 'Isocora (v cost)',
    constantKey: 'v',
    allowedTargets: ['p', 't', 'h', 's'],
  },
  {
    id: 'isenthalpic',
    label: 'Isentalpica (h cost)',
    constantKey: 'h',
    allowedTargets: ['p', 'v'],
  },
  {
    id: 'isentropic',
    label: 'Isentropica (s cost)',
    constantKey: 's',
    allowedTargets: ['p', 'v'],
  },
];

const pointAnnotations = (points, mapperX, mapperY) =>
  points.map((point, index) => ({
    x: mapperX(point),
    y: mapperY(point),
    text: point.name || `${index + 1}`,
    showarrow: true,
    arrowhead: 0,
    arrowsize: 1,
    arrowwidth: 1.5,
    arrowcolor: COLOR,
    ax: 18,
    ay: -18,
    font: { color: COLOR, size: 12, family: 'Inter' },
    bgcolor: '#0F172A',
    bordercolor: COLOR,
    borderwidth: 1,
    borderpad: 4,
  }));

const buildDerivedInputs = (point, transformation, targetKey, targetValue) => {
  if (!point || !transformation) {
    throw new Error('Missing transformation context.');
  }
  if (targetKey === transformation.constantKey) {
    throw new Error('Target property must differ from the invariant property.');
  }

  return {
    [transformation.constantKey]: point[transformation.constantKey],
    [targetKey]: targetValue,
  };
};

const SteamLabPage = () => {
  const [mode, setMode] = useState('pt');
  const [pointName, setPointName] = useState('');
  const [form, setForm] = useState({ a: 1, b: 100 });
  const [derivedName, setDerivedName] = useState('');
  const [transformationId, setTransformationId] = useState('isobaric');
  const [startPointName, setStartPointName] = useState('');
  const [targetKey, setTargetKey] = useState('t');
  const [targetValue, setTargetValue] = useState(150);
  const [points, setPoints] = useState([]);
  const [segmentPaths, setSegmentPaths] = useState([]);
  const [dome, setDome] = useState(null);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [closeCycle, setCloseCycle] = useState(true);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  const tsRef = useRef(null);
  const hsRef = useRef(null);
  const pvRef = useRef(null);
  const formulasRef = useRef(null);

  const modeSpec = useMemo(
    () => MODE_SPECS.find((entry) => entry.id === mode) ?? MODE_SPECS[0],
    [mode],
  );

  const transformationSpec = useMemo(
    () => TRANSFORMATION_SPECS.find((entry) => entry.id === transformationId) ?? TRANSFORMATION_SPECS[0],
    [transformationId],
  );

  const availableTargets = useMemo(
    () => transformationSpec.allowedTargets.map((key) => ({ key, ...PROPERTY_META[key] })),
    [transformationSpec],
  );

  const startPoint = useMemo(
    () => points.find((point) => point.name === startPointName) ?? null,
    [points, startPointName],
  );

  useEffect(() => {
    let cancelled = false;
    const loadDome = async () => {
      try {
        const domeData = await getSaturationDomeFull('Water');
        if (!cancelled) setDome(domeData);
      } catch (loadError) {
        console.error(loadError);
      }
    };
    loadDome();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (points.length > 0 && !startPointName) {
      setStartPointName(points[0].name);
    }
    if (points.length === 0 && startPointName) {
      setStartPointName('');
    }
  }, [points, startPointName]);

  useEffect(() => {
    if (!transformationSpec.allowedTargets.includes(targetKey)) {
      const nextTarget = transformationSpec.allowedTargets[0];
      setTargetKey(nextTarget);
      setTargetValue(PROPERTY_META[nextTarget].defaultValue);
    }
  }, [targetKey, transformationSpec]);

  useEffect(() => {
    const buildPaths = async () => {
      if (points.length < 2) {
        setSegmentPaths([]);
        return;
      }

      const pairs = [];
      for (let index = 0; index < points.length - 1; index += 1) {
        pairs.push([points[index], points[index + 1]]);
      }
      if (closeCycle && points.length > 2) {
        pairs.push([points[points.length - 1], points[0]]);
      }

      try {
        const paths = await Promise.all(
          pairs.map(([from, to]) => generateProcessPath(from, to, 'Water', 72)),
        );
        setSegmentPaths(paths);
      } catch (pathError) {
        console.error(pathError);
        setSegmentPaths([]);
      }
    };

    buildPaths();
  }, [closeCycle, points]);

  useEffect(() => {
    if (points.length === 0) return undefined;

    const renderAllPlots = () => {
      if (tsRef.current) {
        const data = [
          dome?.ts?.s?.length
            ? addFillTrace(dome.ts.s, dome.ts.t, {
                fillcolor: 'rgba(56, 189, 248, 0.08)',
                name: 'Cupola di saturazione',
              })
            : null,
          dome?.ts?.s?.length ? addDomeTrace(dome.ts.s, dome.ts.t) : null,
          ...segmentPaths.map((path, index) =>
            addTrace(path.map((point) => point.s), path.map((point) => point.t), {
              name: `Tratto ${index + 1}`,
              color: PATH_COLORS[index % PATH_COLORS.length],
              width: 3,
              mode: 'lines',
            }),
          ),
          addTrace(points.map((point) => point.s), points.map((point) => point.t), {
            color: COLOR,
            mode: 'markers',
            markerSize: 9,
          }),
        ].filter(Boolean);
        const layout = plotLayout('Entropia s (kJ/(kg·K))', 'Temperatura T (°C)');
        layout.annotations = pointAnnotations(points, (point) => point.s, (point) => point.t);
        renderPlot(tsRef.current, data, layout, plotConfig);
      }

      if (hsRef.current) {
        const data = [
          dome?.hs?.s?.length
            ? addFillTrace(dome.hs.s, dome.hs.h, {
                fillcolor: 'rgba(56, 189, 248, 0.08)',
                name: 'Cupola di saturazione',
              })
            : null,
          dome?.hs?.s?.length ? addDomeTrace(dome.hs.s, dome.hs.h) : null,
          ...segmentPaths.map((path, index) =>
            addTrace(path.map((point) => point.s), path.map((point) => point.h), {
              name: `Tratto ${index + 1}`,
              color: PATH_COLORS[index % PATH_COLORS.length],
              width: 3,
              mode: 'lines',
            }),
          ),
          addTrace(points.map((point) => point.s), points.map((point) => point.h), {
            color: COLOR,
            mode: 'markers',
            markerSize: 9,
          }),
        ].filter(Boolean);
        const layout = plotLayout('Entropia s (kJ/(kg·K))', 'Entalpia h (kJ/kg)');
        layout.annotations = pointAnnotations(points, (point) => point.s, (point) => point.h);
        renderPlot(hsRef.current, data, layout, plotConfig);
      }

      if (pvRef.current) {
        const data = [
          dome?.pv?.v?.length
            ? addFillTrace(dome.pv.v, dome.pv.p, {
                fillcolor: 'rgba(56, 189, 248, 0.08)',
                name: 'Cupola di saturazione',
              })
            : null,
          dome?.pv?.v?.length ? addDomeTrace(dome.pv.v, dome.pv.p) : null,
          ...segmentPaths.map((path, index) =>
            addTrace(path.map((point) => point.v), path.map((point) => point.p), {
              name: `Tratto ${index + 1}`,
              color: PATH_COLORS[index % PATH_COLORS.length],
              width: 3,
              mode: 'lines',
            }),
          ),
          addTrace(points.map((point) => point.v), points.map((point) => point.p), {
            color: COLOR,
            mode: 'markers',
            markerSize: 9,
          }),
        ].filter(Boolean);
        const layout = plotLayout('Volume specifico v (m\u00B3/kg)', 'Pressione P (bar)', {
          xaxis: { type: 'log', range: [-4, 2] },
          yaxis: { type: 'log', nticks: 8 },
        });
        layout.annotations = pointAnnotations(points, (point) => point.v, (point) => point.p);
        renderPlot(pvRef.current, data, layout, plotConfig);
      }
    };

    renderAllPlots();
    return () => {
      cleanupPlot(tsRef.current);
      cleanupPlot(hsRef.current);
      cleanupPlot(pvRef.current);
    };
  }, [dome, points, segmentPaths]);

  const addPoint = async () => {
    setAdding(true);
    setError(null);
    try {
      const state = await solveFluid(modeSpec.build(form), 'Water');
      const name = pointName.trim() || `${points.length + 1}`;
      setPoints((current) => [...current, { ...state, name, origin: 'free' }]);
      setPointName('');
    } catch (addError) {
      setError('Impossibile costruire lo stato richiesto: controlla la coppia di proprieta scelta.');
      console.error(addError);
    } finally {
      setAdding(false);
    }
  };

  const addDerivedPoint = async () => {
    if (!startPoint) {
      setError('Seleziona un punto di partenza prima di creare una trasformazione.');
      return;
    }

    setAdding(true);
    setError(null);
    try {
      const state = await solveFluid(
        buildDerivedInputs(startPoint, transformationSpec, targetKey, targetValue),
        'Water',
      );
      const name = derivedName.trim() || `${points.length + 1}`;
      setPoints((current) => [
        ...current,
        {
          ...state,
          name,
          origin: 'derived',
          sourcePoint: startPoint.name,
          transformation: transformationSpec.id,
        },
      ]);
      setDerivedName('');
    } catch (addError) {
      setError('Trasformazione non risolvibile con i dati scelti. Prova un target fisicamente compatibile.');
      console.error(addError);
    } finally {
      setAdding(false);
    }
  };

  const removeLastPoint = () => {
    setPoints((current) => current.slice(0, -1));
    setError(null);
  };

  const clearPoints = () => {
    setPoints([]);
    setSegmentPaths([]);
    setError(null);
  };

  const handleDownloadPDF = useCallback(async () => {
    if (points.length === 0) return;
    setDownloadingPDF(true);
    try {
      const { exportToPDF } = await import('../utils/pdfExport');
      await exportToPDF({
        title: 'Laboratorio Vapore',
        accentColor: COLOR,
        inputs: { modalita: mode, punti: points.length, ciclo: closeCycle ? 'Chiuso' : 'Aperto' },
        stats: {},
        points: points.map((point) => ({
          label: point.name,
          t: point.t,
          p: point.p,
          h: point.h,
          s: point.s,
          v: point.v,
        })),
        formulas: points
          .filter((point) => point.origin === 'derived')
          .map((point) => ({
            label: `${point.name} da ${point.sourcePoint} (${point.transformation})`,
            latex:
              point.transformation === 'isobaric'
                ? 'P = cost'
                : point.transformation === 'isothermal'
                  ? 'T = cost'
                  : point.transformation === 'isochoric'
                    ? 'v = cost'
                    : point.transformation === 'isenthalpic'
                      ? 'h = cost'
                      : 's = cost',
          })),
        plotRefs: { ts: tsRef, hs: hsRef, pv: pvRef },
        schematicRef: formulasRef,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setDownloadingPDF(false);
    }
  }, [points, mode, closeCycle]);

  const stats = points.length > 0 ? (
    <div className="stats-row">
      <StatCard label="Punti" value={`${points.length}`} accent color={COLOR} />
      <StatCard label="Tratti" value={`${segmentPaths.length}`} />
      <StatCard label="Ciclo" value={closeCycle && points.length > 2 ? 'Chiuso' : 'Aperto'} />
      <StatCard label="Ultimo punto" value={points[points.length - 1]?.name || '-'} />
    </div>
  ) : null;

  const currentConstantValue = startPoint ? startPoint[transformationSpec.constantKey] : null;

  return (
    <section className="features-section cycle-page">
      <div className="section-header">
        <div className="section-badge">Modalita avanzata</div>
        <h2 className="section-title">
          Laboratorio <span style={{ color: COLOR }}>Vapore</span>
        </h2>
      </div>

      <div className="cycle-layout">
        <div className="cycle-inputs glass">
          <h3 className="card-title">Strumento derivato dal desktop</h3>
          <p className="input-hint">
            Costruisci punti dell&apos;acqua o del vapore con coppie di proprieta indipendenti oppure
            parti da uno stato esistente e applica una trasformazione termodinamica guidata.
          </p>

          <div className="steam-lab-section">
            <div className="section-subtitle">1. Punto indipendente</div>

            <div className="input-field">
              <label className="input-label" htmlFor="steam-lab-name">Nome punto</label>
              <input
                id="steam-lab-name"
                className="glass-input"
                value={pointName}
                onChange={(event) => setPointName(event.target.value)}
                placeholder="Es. 1, A, ingresso turbina"
              />
            </div>

            <div className="input-field">
              <label className="input-label" htmlFor="steam-lab-mode">Coppia di proprieta</label>
              <select
                id="steam-lab-mode"
                className="glass-input"
                value={mode}
                onChange={(event) => {
                  setMode(event.target.value);
                  setForm({ a: null, b: null });
                }}
              >
                {MODE_SPECS.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.label}</option>
                ))}
              </select>
            </div>

            <div className="inputs-row">
              {modeSpec.fields.map((field) => (
                <InputField
                  key={field.key}
                  label={field.label}
                  unit={field.unit}
                  value={form[field.key]}
                  onChange={(value) => setForm({ ...form, [field.key]: value })}
                  accent={COLOR}
                />
              ))}
            </div>

            <button className="btn-primary" onClick={addPoint} disabled={adding}>
              Aggiungi punto libero
            </button>
          </div>

          <div className="steam-lab-section-divider" />

          <div className="steam-lab-section">
            <div className="section-subtitle">2. Punto da trasformazione</div>
            <p className="section-note">
              Seleziona un punto iniziale, scegli la trasformazione da mantenere costante e imposta
              la proprieta finale desiderata.
            </p>

            <div className="input-field">
              <label className="input-label" htmlFor="steam-lab-derived-name">Nome nuovo punto</label>
              <input
                id="steam-lab-derived-name"
                className="glass-input"
                value={derivedName}
                onChange={(event) => setDerivedName(event.target.value)}
                placeholder="Es. 2, B, uscita pompa"
              />
            </div>

            <div className="input-field">
              <label className="input-label" htmlFor="steam-lab-start-point">Punto di partenza</label>
              <select
                id="steam-lab-start-point"
                className="glass-input"
                value={startPointName}
                onChange={(event) => setStartPointName(event.target.value)}
                disabled={points.length === 0}
              >
                {points.length === 0 ? (
                  <option value="">Nessun punto disponibile</option>
                ) : (
                  points.map((point) => (
                    <option key={point.name} value={point.name}>{point.name}</option>
                  ))
                )}
              </select>
            </div>

            <div className="input-field">
              <label className="input-label" htmlFor="steam-lab-transformation">Trasformazione</label>
              <select
                id="steam-lab-transformation"
                className="glass-input"
                value={transformationId}
                onChange={(event) => setTransformationId(event.target.value)}
                disabled={points.length === 0}
              >
                {TRANSFORMATION_SPECS.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.label}</option>
                ))}
              </select>
            </div>

            <div className="inputs-row">
              <div className="input-field">
                <label className="input-label" htmlFor="steam-lab-constant">
                  Proprieta costante
                </label>
                <input
                  id="steam-lab-constant"
                  className="glass-input input-readonly"
                  value={
                    startPoint && currentConstantValue !== null
                      ? `${PROPERTY_META[transformationSpec.constantKey].label}: ${currentConstantValue.toFixed(4)} ${PROPERTY_META[transformationSpec.constantKey].unit}`
                      : 'Seleziona prima un punto'
                  }
                  readOnly
                />
              </div>

              <div className="input-field">
                <label className="input-label" htmlFor="steam-lab-target-property">Proprieta target</label>
                <select
                  id="steam-lab-target-property"
                  className="glass-input"
                  value={targetKey}
                  onChange={(event) => {
                    const nextKey = event.target.value;
                    setTargetKey(nextKey);
                    setTargetValue(PROPERTY_META[nextKey].defaultValue);
                  }}
                  disabled={points.length === 0}
                >
                  {availableTargets.map((entry) => (
                    <option key={entry.key} value={entry.key}>{entry.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <InputField
              label={PROPERTY_META[targetKey].label}
              unit={PROPERTY_META[targetKey].unit}
              value={targetValue}
              onChange={setTargetValue}
              accent={COLOR}
            />

            <button className="btn-primary" onClick={addDerivedPoint} disabled={adding || points.length === 0}>
              Aggiungi punto derivato
            </button>
          </div>

          <div className="steam-lab-section-divider" />

          <div className="steam-lab-section">
            <div className="section-subtitle">3. Gestione punti</div>
            <div className="action-row">
              <button className="btn-outline" onClick={removeLastPoint} disabled={points.length === 0}>
                Rimuovi ultimo
              </button>
              <button className="btn-outline" onClick={clearPoints} disabled={points.length === 0}>
                Svuota
              </button>
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={closeCycle}
                onChange={(event) => setCloseCycle(event.target.checked)}
              />
              <span>Chiudi automaticamente il ciclo quando ci sono almeno 3 punti</span>
            </label>

            {points.length > 0 && (
              <div className="points-chip-list">
                {points.map((point) => (
                  <span key={point.name} className="point-chip" style={{ borderColor: `${COLOR}55`, color: COLOR }}>
                    {point.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="cycle-results">
          {error && (
            <div className="error-banner">
              <Flame size={18} />
              <p>{error}</p>
            </div>
          )}

          {points.length > 0 ? (
            <div className="results-grid">
              <div className="glass diagram-tabs-wrapper">
                <div className="diagram-tabs-bar">
                  <button
                    className={`diagram-tab ${activeTab === 0 ? 'diagram-tab-active' : ''}`}
                    onClick={() => setActiveTab(0)}
                    style={activeTab === 0 ? { borderColor: COLOR, color: COLOR } : {}}
                  >
                    T-s
                  </button>
                  <button
                    className={`diagram-tab ${activeTab === 1 ? 'diagram-tab-active' : ''}`}
                    onClick={() => setActiveTab(1)}
                    style={activeTab === 1 ? { borderColor: COLOR, color: COLOR } : {}}
                  >
                    h-s
                  </button>
                  <button
                    className={`diagram-tab ${activeTab === 2 ? 'diagram-tab-active' : ''}`}
                    onClick={() => setActiveTab(2)}
                    style={activeTab === 2 ? { borderColor: COLOR, color: COLOR } : {}}
                  >
                    P-v
                  </button>
                </div>
                <div className="diagram-tab-content">
                  <div className={activeTab === 0 ? 'diagram-panel-active' : 'diagram-panel-hidden'}>
                    <div ref={tsRef} className="plot-area" />
                  </div>
                  <div className={activeTab === 1 ? 'diagram-panel-active' : 'diagram-panel-hidden'}>
                    <div ref={hsRef} className="plot-area" />
                  </div>
                  <div className={activeTab === 2 ? 'diagram-panel-active' : 'diagram-panel-hidden'}>
                    <div ref={pvRef} className="plot-area" />
                  </div>
                </div>
              </div>
              {stats}
            </div>
          ) : (
            <div className="empty-state glass">
              <Flame size={48} className="empty-icon" />
              <p>Aggiungi almeno un punto per iniziare il laboratorio vapore.</p>
            </div>
          )}
        </div>
      </div>

      {points.length > 0 && (
        <div className="formulas-section-wrapper" ref={formulasRef}>
          <FormulasSection
            accentColor={COLOR}
            coordTitle="Punti del laboratorio vapore"
            points={points.map((point) => ({
              label: point.name,
              t: point.t,
              p: point.p,
              h: point.h,
              s: point.s,
              v: point.v,
            }))}
            formulas={points
              .filter((point) => point.origin === 'derived')
              .map((point) => ({
                label: `${point.name} da ${point.sourcePoint}`,
                latex:
                  point.transformation === 'isobaric'
                    ? 'P = cost'
                    : point.transformation === 'isothermal'
                      ? 'T = cost'
                      : point.transformation === 'isochoric'
                        ? 'v = cost'
                        : point.transformation === 'isenthalpic'
                          ? 'h = cost'
                          : 's = cost',
              }))}
          />
        </div>
      )}

      {points.length > 0 && (
        <div className="pdf-download-wrapper">
          <button
            onClick={handleDownloadPDF}
            disabled={downloadingPDF}
            className="btn-primary btn-pdf-download"
            style={{ background: `linear-gradient(135deg, ${COLOR}, ${COLOR}CC)` }}
          >
            {downloadingPDF ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
            {downloadingPDF ? 'Generazione PDF...' : 'Scarica PDF'}
          </button>
        </div>
      )}
    </section>
  );
};

export default SteamLabPage;
