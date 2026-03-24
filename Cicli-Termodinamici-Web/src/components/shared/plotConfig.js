const R_AIR = 0.287;
const CP_AIR = 1.005;
const CV_AIR = 0.718;

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

/**
 * Generate correct polytropic curve points between two states for P-v diagram.
 */
export const genPvCurve = (pt1, pt2, type = 'isentropic', n = 60, k = 1.4) => {
  const x = [], y = [];
  const v1 = pt1.v, v2 = pt2.v;
  const P1 = pt1.p, P2 = pt2.p;

  if (Math.abs(v1 - v2) < 1e-12 && Math.abs(P1 - P2) < 1e-12) {
    return { x: [v1], y: [P1] };
  }

  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let v, P;
    switch (type) {
      case 'isentropic':
        v = v1 + (v2 - v1) * t;
        P = P1 * Math.pow(v1 / v, k);
        break;
      case 'isochoric':
        v = v1;
        P = P1 + (P2 - P1) * t;
        break;
      case 'isobaric':
        v = v1 + (v2 - v1) * t;
        P = P1;
        break;
      case 'isothermal': {
        v = v1 + (v2 - v1) * t;
        const C = P1 * v1;
        P = C / v;
        break;
      }
      default:
        v = v1 + (v2 - v1) * t;
        P = P1 + (P2 - P1) * t;
    }
    x.push(v);
    y.push(P);
  }
  return { x, y };
};

/**
 * Generate correct curve points between two states for T-s diagram.
 */
export const genTsCurve = (pt1, pt2, type = 'isentropic', n = 60, cp = CP_AIR, R = R_AIR) => {
  const x = [], y = [];
  const s1 = pt1.s, s2 = pt2.s;
  const T1 = pt1.t, T2 = pt2.t;
  const T1K = T1 + 273.15;

  if (Math.abs(s1 - s2) < 1e-12 && Math.abs(T1 - T2) < 1e-12) {
    return { x: [s1], y: [T1] };
  }

  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let s, T;
    switch (type) {
      case 'isentropic':
        s = s1;
        T = T1 + (T2 - T1) * t;
        break;
      case 'isochoric': {
        T = T1 + (T2 - T1) * t;
        const TK = T + 273.15;
        s = s1 + CV_AIR * Math.log(TK / T1K);
        break;
      }
      case 'isobaric': {
        T = T1 + (T2 - T1) * t;
        const TK = T + 273.15;
        s = s1 + cp * Math.log(TK / T1K);
        break;
      }
      case 'isothermal':
        s = s1 + (s2 - s1) * t;
        T = T1;
        break;
      default:
        s = s1 + (s2 - s1) * t;
        T = T1 + (T2 - T1) * t;
    }
    x.push(s);
    y.push(T);
  }
  return { x, y };
};

/**
 * Generate correct curve points between two states for h-s diagram (ideal gas).
 */
export const genHsCurve = (pt1, pt2, type = 'isentropic', n = 60, cp = CP_AIR, R = R_AIR) => {
  const x = [], y = [];
  const s1 = pt1.s, s2 = pt2.s;
  const h1 = pt1.h, h2 = pt2.h;

  if (Math.abs(s1 - s2) < 1e-12 && Math.abs(h1 - h2) < 1e-12) {
    return { x: [s1], y: [h1] };
  }

  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let s, h;
    switch (type) {
      case 'isentropic':
        s = s1;
        h = h1 + (h2 - h1) * t;
        break;
      case 'isochoric':
      case 'isobaric': {
        s = s1 + (s2 - s1) * t;
        if (Math.abs(s2 - s1) < 1e-12) {
          h = h1;
        } else {
          const ratio = Math.exp((s - s1) / cp);
          const ratioEnd = Math.exp((s2 - s1) / cp);
          h = h1 + (h2 - h1) * (ratio - 1) / (ratioEnd - 1 || 1);
        }
        break;
      }
      case 'isothermal': {
        s = s1 + (s2 - s1) * t;
        const T1K = (pt1.t !== undefined ? pt1.t : h1 / cp) + 273.15;
        h = cp * T1K;
        break;
      }
      default:
        s = s1 + (s2 - s1) * t;
        h = h1 + (h2 - h1) * t;
    }
    x.push(s);
    y.push(h);
  }
  return { x, y };
};

/**
 * Generate curve between two points on a real-gas T-s diagram.
 */
export const genTsCurveReal = (pt1, pt2, n = 40) => {
  const x = [], y = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    x.push(pt1.s + (pt2.s - pt1.s) * t);
    y.push(pt1.t + (pt2.t - pt1.t) * t);
  }
  return { x, y };
};

/**
 * Generate curve between two points on a real-gas h-s diagram.
 */
export const genHsCurveReal = (pt1, pt2, n = 40) => {
  const x = [], y = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    x.push(pt1.s + (pt2.s - pt1.s) * t);
    y.push(pt1.h + (pt2.h - pt1.h) * t);
  }
  return { x, y };
};

/**
 * Generate curve between two points on a P-v diagram for real gas.
 */
export const genPvCurveReal = (pt1, pt2, n = 40) => {
  const x = [], y = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    x.push(pt1.v + (pt2.v - pt1.v) * t);
    y.push(pt1.p + (pt2.p - pt1.p) * t);
  }
  return { x, y };
};

/**
 * Generate curve between two points on a P-h diagram for real gas.
 */
export const genPhCurveReal = (pt1, pt2, n = 40) => {
  const x = [], y = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    x.push(pt1.h + (pt2.h - pt1.h) * t);
    y.push(pt1.p + (pt2.p - pt1.p) * t);
  }
  return { x, y };
};
