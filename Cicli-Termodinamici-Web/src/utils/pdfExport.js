import { formatValue } from './formatNumber';

let jsPdfPromise = null;
let html2CanvasPromise = null;

const getJsPDF = async () => {
  if (!jsPdfPromise) {
    jsPdfPromise = import('jspdf').then((module) => module.jsPDF);
  }
  return jsPdfPromise;
};

const getHtml2Canvas = async () => {
  if (!html2CanvasPromise) {
    html2CanvasPromise = import('html2canvas').then((module) => module.default);
  }
  return html2CanvasPromise;
};

/**
 * Exports a cycle page to PDF with diagrams, tables, and formulas.
 * @param {Object} options
 */
export const exportToPDF = async ({
  title,
  accentColor = '#38BDF8',
  inputs = {},
  stats = {},
  points = [],
  formulas = [],
  plotRefs = {},
  schematicRef,
}) => {
  const [jsPDF, html2canvas] = await Promise.all([getJsPDF(), getHtml2Canvas()]);
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageW = 210;
  const margin = 15;
  const contentW = pageW - 2 * margin;
  let y = margin;

  const addNewPage = () => {
    pdf.addPage();
    y = margin;
  };

  const checkSpace = (needed) => {
    if (y + needed > 280) addNewPage();
  };

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.setTextColor(accentColor);
  pdf.text(`Ciclo ${title}`, margin, y + 8);
  y += 16;

  pdf.setFontSize(10);
  pdf.setTextColor(100);
  pdf.text(`Generato il ${new Date().toLocaleDateString('it-IT')} da ThermoHub e Prof. Ing. Andrea Viola`, margin, y);
  y += 10;

  pdf.setDrawColor(200);
  pdf.line(margin, y, pageW - margin, y);
  y += 6;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(30);
  pdf.text('Parametri di Ingresso', margin, y);
  y += 7;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(60);

  const inputLabels = {
    p_high: 'Pressione Caldaia (bar)',
    p_low: 'Pressione Bassa (bar)',
    t_max: 'Temperatura Massima (C)',
    t_min: 'Temperatura Ambiente (C)',
    t_high: 'Temperatura Alta (C)',
    t_low: 'Temperatura Bassa (C)',
    t_evap: 'Temp. Evaporazione (C)',
    t_cond: 'Temp. Condensazione (C)',
    eta_t: 'Rendimento Turbina',
    eta_p: 'Rendimento Pompa',
    eta_c: 'Rendimento Compressore',
    eta_s: 'Rendimento Isentropico',
    mass_flow: 'Portata Massica (kg/s)',
    r: 'Rapporto di Compressione',
    rc: 'Rapporto di Combustione',
    beta: 'Rapporto Compressione (beta)',
    sh: 'Surriscaldamento (K)',
    sc: 'Sottoraffreddamento (K)',
    p_ref: 'Pressione Riferimento (bar)',
  };

  for (const [key, val] of Object.entries(inputs)) {
    pdf.text(`${inputLabels[key] || key}: ${val}`, margin + 2, y);
    y += 5;
  }
  y += 4;

  checkSpace(40);
  pdf.line(margin, y, pageW - margin, y);
  y += 6;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(30);
  pdf.text('Risultati', margin, y);
  y += 7;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(60);

  const statLabels = {
    eta: 'Rendimento (%)',
    power: 'Potenza Netta (kW)',
    wt: 'Lavoro Turbina (kJ/kg)',
    wp: 'Lavoro Pompa (kJ/kg)',
    wc: 'Lavoro Compressore (kJ/kg)',
    q_in: 'Calore Ingresso (kJ/kg)',
    q_out: 'Calore Uscita (kJ/kg)',
    bwr: 'Back Work Ratio (%)',
    cop: 'COP Frigorifero',
    cop_hp: 'COP Pompa di Calore',
    cooling_cap: 'Capacita Frigorifera (kW)',
    qlow: 'Calore Basso (kJ/kg)',
    qhigh: 'Calore Alto (kJ/kg)',
    win: 'Lavoro Compressore (kJ/kg)',
    Q_in: 'Calore Ingresso (kJ/kg)',
    Q_out: 'Calore Uscita (kJ/kg)',
    W_net: 'Lavoro Netto (kJ/kg)',
  };

  for (const [key, val] of Object.entries(stats)) {
    const formatted = typeof val === 'number' ? val.toFixed(2) : val;
    pdf.text(`${statLabels[key] || key}: ${formatted}`, margin + 2, y);
    y += 5;
  }
  y += 4;

  const captureElement = async (ref, name) => {
    if (!ref?.current) return null;
    try {
      return await html2canvas(ref.current, {
        backgroundColor: '#0B1120',
        scale: 3,
        useCORS: true,
        logging: false,
      });
    } catch (error) {
      console.warn(`Failed to capture ${name}:`, error);
      return null;
    }
  };

  for (const [name, ref] of Object.entries(plotRefs)) {
    const canvas = await captureElement(ref, name);
    if (!canvas) continue;

    checkSpace(90);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(30);
    const diagramLabels = {
      ts: 'Diagramma T-s',
      pv: 'Diagramma P-v',
      hs: 'Diagramma h-s (Mollier)',
      ph: 'Diagramma P-h',
    };
    pdf.text(diagramLabels[name] || name, margin, y);
    y += 5;

    const imgData = canvas.toDataURL('image/png');
    const imgW = contentW;
    const imgH = (canvas.height / canvas.width) * imgW;
    const finalH = Math.min(imgH, 80);
    const finalW = (finalH / imgH) * imgW;
    pdf.addImage(imgData, 'PNG', margin, y, finalW, finalH);
    y += finalH + 6;
  }

  if (schematicRef?.current) {
    const canvas = await captureElement(schematicRef, 'schematic');
    if (canvas) {
      checkSpace(90);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(30);
      pdf.text('Schema Impianto', margin, y);
      y += 5;

      const imgData = canvas.toDataURL('image/png');
      const imgW = contentW;
      const imgH = (canvas.height / canvas.width) * imgW;
      const finalH = Math.min(imgH, 80);
      const finalW = (finalH / imgH) * imgW;
      pdf.addImage(imgData, 'PNG', margin, y, finalW, finalH);
      y += finalH + 6;
    }
  }

  if (points.length > 0) {
    checkSpace(50);
    pdf.line(margin, y, pageW - margin, y);
    y += 6;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(30);
    pdf.text('Coordinate Termodinamiche', margin, y);
    y += 8;

    const colW = [22, 28, 28, 30, 30, 28];
    const headers = ['Punto', 'T (C)', 'P (bar)', 'h (kJ/kg)', 's (kJ/kg K)', 'v (m^3/kg)'];

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(255);
    pdf.setFillColor(...hexToRgb(accentColor));
    pdf.rect(margin, y - 4, contentW, 7, 'F');

    let x = margin + 2;
    headers.forEach((header, index) => {
      pdf.text(header, x, y);
      x += colW[index];
    });
    y += 6;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(40);
    points.forEach((point, index) => {
      if (index % 2 === 0) {
        pdf.setFillColor(245);
        pdf.rect(margin, y - 4, contentW, 6, 'F');
      }
      x = margin + 2;
      const row = [
        point.label || `${index + 1}`,
        fmtPDF(point.t),
        fmtPDF(point.p),
        fmtPDF(point.h),
        fmtPDF(point.s),
        fmtPDF(point.v),
      ];
      row.forEach((val, colIndex) => {
        pdf.text(String(val), x, y);
        x += colW[colIndex];
      });
      y += 6;
    });
    y += 4;
  }

  if (formulas.length > 0) {
    checkSpace(40);
    pdf.line(margin, y, pageW - margin, y);
    y += 6;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(30);
    pdf.text('Formule di Calcolo', margin, y);
    y += 8;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(40);

    formulas.forEach((formula) => {
      const formulaLineCount = formula.numeric ? 3 : formula.value !== undefined ? 2 : 1;
      checkSpace(8 + formulaLineCount * 5);
      if (formula.label) {
        pdf.setFont('helvetica', 'bold');
        pdf.text(formula.label, margin + 2, y);
        y += 5;
        pdf.setFont('helvetica', 'normal');
      }

      const text = latexToPlain(formula.latex);
      const valueText = formula.value !== undefined
        ? ` = ${typeof formula.value === 'number' ? formula.value.toFixed(2) : formula.value}`
        : '';
      pdf.text(`${text}${valueText}`, margin + 4, y);
      y += 6;

      if (formula.numeric) {
        pdf.setFontSize(8);
        pdf.setTextColor(90);
        pdf.text(`Sostituzione numerica: ${formula.numeric}`, margin + 8, y);
        y += 5;
        pdf.setFontSize(9);
        pdf.setTextColor(40);
      }
    });
  }

  pdf.save(`Ciclo_${title.replace(/\s+/g, '_')}_ThermoHub.pdf`);
};

function latexToPlain(latex) {
  return latex
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\cdot/g, '\u00B7')
    .replace(/\\times/g, '\u00D7')
    .replace(/\\Delta/g, '\u0394')
    .replace(/\\eta/g, '\u03B7')
    .replace(/\\alpha/g, '\u03B1')
    .replace(/\\beta/g, '\u03B2')
    .replace(/\\gamma/g, '\u03B3')
    .replace(/\\theta/g, '\u03B8')
    .replace(/\\pi/g, '\u03C0')
    .replace(/\\sigma/g, '\u03C3')
    .replace(/\\infty/g, '\u221E')
    .replace(/\\dot\{([^}]+)\}/g, '$1\u0307')
    .replace(/\\left|\\right/g, '')
    .replace(/\\quad/g, '  ')
    .replace(/\\,/g, ' ')
    .replace(/_\{([^}]+)\}/g, '_$1')
    .replace(/\^\{([^}]+)\}/g, '^$1')
    .replace(/[{}]/g, '')
    .replace(/\\/g, '');
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [56, 189, 248];
}

function fmtPDF(value) {
  return formatValue(value, 'generic');
}
