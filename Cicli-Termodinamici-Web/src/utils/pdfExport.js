import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Exports a cycle page to PDF with diagrams, tables, and formulas.
 * @param {Object} options
 * @param {string} options.title - Cycle name
 * @param {string} options.accentColor - Hex color for accents
 * @param {Object} options.inputs - Input parameters used
 * @param {Object} options.stats - Result statistics
 * @param {Array} options.points - Thermodynamic state points
 * @param {Array} options.formulas - Formula entries
 * @param {React.RefObject} options.plotRefs - Object of {name: ref} for diagram containers
 * @param {React.RefObject} options.schematicRef - Ref to schematic container
 * @param {React.RefObject} options.formulasRef - Ref to formulas section container
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
    if (y + needed > 280) {
      addNewPage();
    }
  };

  // --- TITLE ---
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.setTextColor(accentColor);
  pdf.text(`Ciclo ${title}`, margin, y + 8);
  y += 16;

  pdf.setFontSize(10);
  pdf.setTextColor(100);
  pdf.text(`Generato il ${new Date().toLocaleDateString('it-IT')} - ThermoHub`, margin, y);
  y += 10;

  // --- INPUT PARAMETERS ---
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
  const inputEntries = Object.entries(inputs);
  const inputLabels = {
    p_high: 'Pressione Caldaia (bar)',
    p_low: 'Pressione Bassa (bar)',
    t_max: 'Temperatura Massima (°C)',
    t_min: 'Temperatura Ambiente (°C)',
    t_high: 'Temperatura Alta (°C)',
    t_low: 'Temperatura Bassa (°C)',
    t_evap: 'Temp. Evaporazione (°C)',
    t_cond: 'Temp. Condensazione (°C)',
    eta_t: 'Rendimento Turbina',
    eta_p: 'Rendimento Pompa',
    eta_c: 'Rendimento Compressore',
    eta_s: 'Rendimento Isentropico',
    mass_flow: 'Portata Massica (kg/s)',
    r: 'Rapporto di Compressione',
    rc: 'Rapporto di Combustione',
    beta: 'Rapporto Compressione (β)',
    sh: 'Surriscaldamento (K)',
    sc: 'Sottoraffreddamento (K)',
    p_ref: 'Pressione Riferimento (bar)',
  };

  for (const [key, val] of inputEntries) {
    const label = inputLabels[key] || key;
    pdf.text(`${label}: ${val}`, margin + 2, y);
    y += 5;
  }
  y += 4;

  // --- RESULTS ---
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
  for (const [key, val] of Object.entries(stats)) {
    const labels = {
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
      cooling_cap: 'Capacità Frigorifera (kW)',
      qlow: 'Calore Basso (kJ/kg)',
      qhigh: 'Calore Alto (kJ/kg)',
      win: 'Lavoro Compressore (kJ/kg)',
      Q_in: 'Calore Ingresso (kJ/kg)',
      Q_out: 'Calore Uscita (kJ/kg)',
      W_net: 'Lavoro Netto (kJ/kg)',
    };
    const label = labels[key] || key;
    const formatted = typeof val === 'number' ? val.toFixed(2) : val;
    pdf.text(`${label}: ${formatted}`, margin + 2, y);
    y += 5;
  }
  y += 4;

  // --- DIAGRAMS (screenshots) ---
  const captureElement = async (ref, name) => {
    if (!ref?.current) return null;
    try {
      const canvas = await html2canvas(ref.current, {
        backgroundColor: '#0B1120',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      return canvas;
    } catch (err) {
      console.warn(`Failed to capture ${name}:`, err);
      return null;
    }
  };

  for (const [name, ref] of Object.entries(plotRefs)) {
    const canvas = await captureElement(ref, name);
    if (canvas) {
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
  }

  // Capture schematic
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

  // --- COORDINATE TABLE ---
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
    const headers = ['Punto', 'T (°C)', 'P (bar)', 'h (kJ/kg)', 's (kJ/kg·K)', 'v (m³/kg)'];

    // Header row
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(255);
    pdf.setFillColor(...hexToRgb(accentColor));
    pdf.rect(margin, y - 4, contentW, 7, 'F');
    let x = margin + 2;
    headers.forEach((h, i) => {
      pdf.text(h, x, y);
      x += colW[i];
    });
    y += 6;

    // Data rows
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(40);
    points.forEach((pt, i) => {
      if (i % 2 === 0) {
        pdf.setFillColor(245);
        pdf.rect(margin, y - 4, contentW, 6, 'F');
      }
      x = margin + 2;
      const row = [
        pt.label || `${i + 1}`,
        fmtPDF(pt.t),
        fmtPDF(pt.p),
        fmtPDF(pt.h),
        fmtPDF(pt.s),
        fmtPDF(pt.v),
      ];
      row.forEach((val, j) => {
        pdf.text(String(val), x, y);
        x += colW[j];
      });
      y += 6;
    });
    y += 4;
  }

  // --- FORMULAS ---
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
    formulas.forEach((f) => {
      checkSpace(12);
      if (f.label) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.text(f.label, margin + 2, y);
        y += 5;
        pdf.setFont('helvetica', 'normal');
      }
      const text = f.latex
        .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
        .replace(/\\cdot/g, '·')
        .replace(/\\Delta/g, 'Δ')
        .replace(/\\eta/g, 'η')
        .replace(/\\alpha/g, 'α')
        .replace(/\\beta/g, 'β')
        .replace(/\\gamma/g, 'γ')
        .replace(/\\theta/g, 'θ')
        .replace(/\\pi/g, 'π')
        .replace(/\\sigma/g, 'σ')
        .replace(/\\infty/g, '∞')
        .replace(/\\left|\\right/g, '')
        .replace(/[{}\\]/g, '')
        .replace(/_/g, '_')
        .replace(/\^/g, '^');
      const valText = f.value !== undefined ? ` = ${typeof f.value === 'number' ? f.value.toFixed(2) : f.value}` : '';
      pdf.text(`${text}${valText}`, margin + 4, y);
      y += 6;
    });
  }

  // Save
  pdf.save(`Ciclo_${title.replace(/\s+/g, '_')}_ThermoHub.pdf`);
};

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [56, 189, 248];
}

function fmtPDF(v) {
  if (v === undefined || v === null || !Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1000) return v.toFixed(1);
  if (Math.abs(v) >= 100) return v.toFixed(2);
  if (Math.abs(v) >= 1) return v.toFixed(3);
  return v.toExponential(2);
}
