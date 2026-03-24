export const plotLayout = (xTitle, yTitle, extra = {}) => ({
  autosize: true,
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  xaxis: {
    title: xTitle,
    gridcolor: '#1E293B',
    color: '#94A3B8',
    zerolinecolor: '#334155',
    ...extra.xaxis,
  },
  yaxis: {
    title: yTitle,
    gridcolor: '#1E293B',
    color: '#94A3B8',
    zerolinecolor: '#334155',
    ...extra.yaxis,
  },
  margin: { t: 30, r: 20, b: 50, l: 60 },
  font: { color: '#E2E8F0', family: 'Inter, system-ui, sans-serif', size: 12 },
  showlegend: false,
  hovermode: 'closest',
  ...extra,
});

export const plotConfig = {
  responsive: true,
  displayModeBar: false,
};

export const addTrace = (x, y, { name = '', color = '#38BDF8', width = 3, dash, mode = 'lines+markers', markerSize = 6 } = {}) => ({
  x,
  y,
  type: 'scatter',
  mode,
  name,
  line: { color, width, dash },
  marker: { size: markerSize, color },
});

export const addDomeTrace = (s, t) => ({
  x: s,
  y: t,
  type: 'scatter',
  mode: 'lines',
  name: 'Saturazione',
  line: { color: '#475569', width: 2, dash: 'dot' },
  hoverinfo: 'skip',
});
