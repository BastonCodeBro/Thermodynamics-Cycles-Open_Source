import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CyclePageLayout from './CyclePageLayout';
import StatCard from './StatCard';
import FormulasSection from './FormulasSection';
import SchematicDiagram from './SchematicDiagram';
import { plotLayout, plotConfig, addTrace, clampLogRange, pointAnnotations } from './plotConfig';
import { renderPlot, cleanupPlot } from '../../utils/plotly';
import { generateProcessPath } from '../../utils/processPath';

const IDEAL_COLOR = '#475569';
const DEFAULT_SEGMENT_COLORS = ['#38BDF8', '#F97316', '#22D3EE', '#60A5FA', '#F59E0B', '#A78BFA'];

const getArray = (value) => (Array.isArray(value) ? value : []);

const collectValues = (paths, key) => paths.flatMap((trace) => trace.map((point) => point[key])).filter(Number.isFinite);

const IdealGasCyclePage = ({
  badge,
  title,
  titleAccent,
  accentColor,
  EmptyIcon,
  emptyText,
  inputs,
  setInputs,
  canCalculate,
  renderInputs,
  buildResult,
  resolveResult,
  buildError,
  plotDefinitions,
  getPathOptions,
  modeOptions = [],
  activeMode,
  presets = [],
  insights,
  legendItems = [],
  segmentColors = DEFAULT_SEGMENT_COLORS,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  const schematicRef = useRef(null);
  const plotRefs = useMemo(
    () => Object.fromEntries(plotDefinitions.map((plot) => [plot.id, React.createRef()])),
    [plotDefinitions],
  );

  useEffect(() => {
    if (!results) return undefined;

    const renderAllPlots = async () => {
      const points = getArray(results.allPoints);
      const idealPoints = getArray(results.idealPoints);
      const pathOptions = getPathOptions({ results, mode: activeMode });

      const realPaths = await Promise.all(
        points.map((point, index) =>
          generateProcessPath(
            point,
            points[(index + 1) % points.length],
            'Air',
            72,
            pathOptions.real[index],
          ),
        ),
      );

      const idealPaths = idealPoints.length === points.length
        ? await Promise.all(
            idealPoints.map((point, index) =>
              generateProcessPath(
                point,
                idealPoints[(index + 1) % idealPoints.length],
                'Air',
                72,
                pathOptions.ideal[index],
              ),
            ),
          )
        : [];

      const renderers = plotDefinitions.map(async (plot) => {
        const plotRef = plotRefs[plot.id];
        if (!plotRef?.current) return;

        const data = [
          ...realPaths.map((path, index) =>
            addTrace(path.map((point) => point[plot.xKey]), path.map((point) => point[plot.yKey]), {
              name: `Tratto ${index + 1}`,
              color: segmentColors[index % segmentColors.length],
              width: 3,
              mode: 'lines',
            }),
          ),
          ...idealPaths.map((path) =>
            addTrace(path.map((point) => point[plot.xKey]), path.map((point) => point[plot.yKey]), {
              color: IDEAL_COLOR,
              width: 2,
              dash: 'dash',
              mode: 'lines',
            }),
          ),
          addTrace(points.map((point) => point[plot.xKey]), points.map((point) => point[plot.yKey]), {
            color: accentColor,
            mode: 'markers',
            markerSize: 10,
          }),
          ...(idealPoints.length === points.length
            ? [addTrace(idealPoints.map((point) => point[plot.xKey]), idealPoints.map((point) => point[plot.yKey]), {
              color: IDEAL_COLOR,
              mode: 'markers',
              markerSize: 7,
            })]
            : []),
        ];

        const allX = collectValues([...realPaths, ...idealPaths], plot.xKey);
        const allY = collectValues([...realPaths, ...idealPaths], plot.yKey);
        const layout = plotLayout(plot.xLabel, plot.yLabel, {
          xaxis: plot.logX ? { type: 'log', range: clampLogRange(allX, plot.logXRange) } : {},
          yaxis: plot.logY ? { type: 'log', range: clampLogRange(allY, plot.logYRange) } : {},
        });
        const annotations = plot.getAnnotations?.({ points, idealPoints, accentColor, idealColor: IDEAL_COLOR }) ?? [];
        layout.annotations = annotations.length > 0
          ? annotations
          : pointAnnotations(
              points.map((point) => ({ x: point[plot.xKey], y: point[plot.yKey] })),
              plot.annotationLabels ?? results.annotationLabels ?? points.map((_, index) => `${index + 1}`),
              accentColor,
            );

        renderPlot(plotRef.current, data, layout, plotConfig);
      });

      await Promise.all(renderers);
    };

    renderAllPlots();

    return () => {
      Object.values(plotRefs).forEach((plotRef) => cleanupPlot(plotRef.current));
    };
  }, [activeMode, accentColor, getPathOptions, plotDefinitions, plotRefs, results, segmentColors]);

  const calculate = async () => {
    setLoading(true);
    setError(null);
    try {
      setResults(await (resolveResult ?? buildResult)(inputs, activeMode));
    } catch (calculationError) {
      setError(buildError?.(calculationError, inputs, activeMode) ?? 'Parametri non validi per il ciclo selezionato.');
      console.error(calculationError);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPreset = (presetValues) => {
    setInputs((current) => ({
      ...current,
      ...presetValues,
    }));
  };

  const handleDownloadPDF = useCallback(async () => {
    if (!results) return;
    setDownloadingPDF(true);
    try {
      const { exportToPDF } = await import('../../utils/pdfExport');
      await exportToPDF({
        title: results.pdfTitle ?? titleAccent,
        accentColor,
        inputs,
        stats: results.stats,
        points: getArray(results.pdfPoints ?? results.formulaPoints ?? results.allPoints).map((point, index) => ({
          label: results.pdfPointLabels?.[index] ?? results.pointLabels?.[index] ?? `${index + 1}`,
          t: point.t,
          p: point.p,
          h: point.h,
          s: point.s,
          v: point.v,
        })),
        formulas: getArray(results.pdfFormulas ?? results.formulas),
        plotRefs,
        schematicRef,
      });
    } catch (downloadError) {
      console.error(downloadError);
    } finally {
      setDownloadingPDF(false);
    }
  }, [accentColor, inputs, plotRefs, results, titleAccent]);

  const formulasSection = results ? (
    <FormulasSection
      accentColor={accentColor}
      points={getArray(results.formulaPoints ?? results.allPoints).map((point, index) => ({
        label: results.formulaPointLabels?.[index] ?? results.pointLabels?.[index] ?? `${index + 1}`,
        t: point.t,
        p: point.p,
        h: point.h,
        s: point.s,
        v: point.v,
      }))}
      formulas={getArray(results.formulas)}
    />
  ) : null;

  const stats = results ? (
    <div className="stats-row">
      {getArray(results.statCards).map((card) => (
        <StatCard
          key={card.label}
          label={card.label}
          value={card.value}
          accent={Boolean(card.accent)}
          color={card.color}
        />
      ))}
    </div>
  ) : null;

  const diagramTabs = results
    ? [
        ...plotDefinitions.map((plot, index) => ({
          id: plot.id,
          label: plot.label,
          active: activeTab === index,
          onClick: () => setActiveTab(index),
          content: <div ref={plotRefs[plot.id]} className="plot-area" />,
        })),
        {
          id: 'schema',
          label: 'Schema',
          active: activeTab === plotDefinitions.length,
          onClick: () => setActiveTab(plotDefinitions.length),
          content: (
            <div ref={schematicRef}>
              <SchematicDiagram
                type={results.schematicType}
                accentColor={accentColor}
                points={results.schematicPoints ?? results.allPoints}
                pointLabels={results.pointLabels}
                summaryItems={results.summaryItems}
              />
            </div>
          ),
        },
      ]
    : null;

  return (
    <CyclePageLayout
      badge={badge}
      title={title}
      titleAccent={titleAccent}
      accentColor={accentColor}
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
      EmptyIcon={EmptyIcon}
      emptyText={emptyText}
      modeOptions={modeOptions}
      solverMeta={results?.solverMeta}
      presets={presets}
      onApplyPreset={handleApplyPreset}
      insights={insights}
      legendItems={legendItems}
    >
      {renderInputs({ inputs, setInputs, accentColor, mode: activeMode })}
    </CyclePageLayout>
  );
};

export default IdealGasCyclePage;
