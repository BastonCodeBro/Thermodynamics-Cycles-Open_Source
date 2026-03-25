const CP_AIR = 1.005;
const CV_AIR = 0.718;

export const plotLayout = (xTitle, yTitle, extra = {}) => {
  const { xaxis: extraX, yaxis: extraY, ...rest } = extra;
  return {
    autosize: true,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    xaxis: {
      title: xTitle,
      gridcolor: '#1E293B',
      color: '#94A3B8',
      zerolinecolor: '#334155',
      ...extraX,
    },
    yaxis: {
      title: yTitle,
      gridcolor: '#1E293B',
      color: '#94A3B8',
      zerolinecolor: '#334155',
      ...extraY,
    },
    margin: { t: 30, r: 20, b: 50, l: 60 },
    font: { color: '#E2E8F0', family: 'Inter, system-ui, sans-serif', size: 12 },
    showlegend: false,
    hovermode: 'closest',
    ...rest,
  };
};

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

export const addFillTrace = (x, y, { color = '#38BDF8', fillcolor, name = '' } = {}) => ({
  x,
  y,
  type: 'scatter',
  mode: 'lines',
  name,
  line: { color: 'rgba(0,0,0,0)', width: 0 },
  fill: 'toself',
  fillcolor: fillcolor || color.replace(')', ', 0.08)').replace('rgb', 'rgba'),
  hoverinfo: 'skip',
});

const linspace = (a, b, n) =>
  Array.from({ length: Math.max(n, 2) }, (_, i) => a + ((b - a) * i) / (Math.max(n, 2) - 1));

const toK = (c) => c + 273.15;
const toC = (k) => k - 273.15;

export const genTsCurve = (pt1, pt2, processType, n = 48) => {
  if (processType === 'isentropic') {
    const s = (pt1.s + pt2.s) / 2;
    return { x: linspace(s, s, n), y: linspace(pt1.t, pt2.t, n) };
  }
  if (processType === 'isothermal') {
    return { x: linspace(pt1.s, pt2.s, n), y: linspace(pt1.t, pt1.t, n) };
  }
  if (processType === 'isochoric') {
    const T1 = toK(pt1.t);
    const s1 = pt1.s;
    const sVals = linspace(pt1.s, pt2.s, n);
    const tVals = sVals.map((s) => toC(T1 * Math.exp(((s - s1) * 1000) / CV_AIR)));
    return { x: sVals, y: tVals };
  }
  return { x: linspace(pt1.s, pt2.s, n), y: linspace(pt1.t, pt2.t, n) };
};

export const genPvCurve = (pt1, pt2, processType, n = 60, k = 1.4) => {
  if (processType === 'isentropic') {
    const vVals = linspace(pt1.v, pt2.v, n);
    const pVals = vVals.map((v) => pt1.p * (pt1.v / v) ** k);
    return { x: vVals, y: pVals };
  }
  if (processType === 'isothermal') {
    const vVals = linspace(pt1.v, pt2.v, n);
    const pVals = vVals.map((v) => pt1.p * pt1.v / v);
    return { x: vVals, y: pVals };
  }
  if (processType === 'isobaric') {
    return { x: linspace(pt1.v, pt2.v, n), y: linspace(pt1.p, pt2.p, n) };
  }
  if (processType === 'isochoric') {
    return { x: linspace(pt1.v, pt1.v, n), y: linspace(pt1.p, pt2.p, n) };
  }
  return { x: linspace(pt1.v, pt2.v, n), y: linspace(pt1.p, pt2.p, n) };
};

export const genHsCurve = (pt1, pt2, processType, n = 48) => {
  if (processType === 'isentropic') {
    const s = (pt1.s + pt2.s) / 2;
    return { x: linspace(s, s, n), y: linspace(pt1.h, pt2.h, n) };
  }
  if (processType === 'isothermal') {
    return { x: linspace(pt1.s, pt2.s, n), y: linspace(pt1.h, pt1.h, n) };
  }
  if (processType === 'isochoric') {
    const T1 = toK(pt1.t);
    const s1 = pt1.s;
    const sVals = linspace(pt1.s, pt2.s, n);
    const hVals = sVals.map((s) => CP_AIR * toC(T1 * Math.exp(((s - s1) * 1000) / CV_AIR)));
    return { x: sVals, y: hVals };
  }
  return { x: linspace(pt1.s, pt2.s, n), y: linspace(pt1.h, pt2.h, n) };
};

export const genTsCurveReal = (pt1, pt2, n = 48) => ({
  x: linspace(pt1.s, pt2.s, n),
  y: linspace(pt1.t, pt2.t, n),
});

export const genPhCurveReal = (pt1, pt2, n = 48) => ({
  x: linspace(pt1.h, pt2.h, n),
  y: linspace(pt1.p, pt2.p, n),
});
