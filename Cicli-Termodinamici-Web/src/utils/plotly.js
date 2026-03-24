let plotlyPromise = null;

const getPlotly = async () => {
  if (!plotlyPromise) {
    plotlyPromise = import('plotly.js-basic-dist-min').then((module) => module.default);
  }
  return plotlyPromise;
};

export const renderPlot = async (plotNode, data, layout, config) => {
  if (!plotNode) return;
  const Plotly = await getPlotly();
  if (!plotNode.isConnected) return;
  await Plotly.react(plotNode, data, layout, config);
};

export const cleanupPlot = async (plotNode) => {
  if (!plotNode) return;
  const Plotly = await getPlotly();
  Plotly.purge(plotNode);
};

