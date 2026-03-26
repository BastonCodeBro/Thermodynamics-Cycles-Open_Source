import { THERMOHUB_AUTHOR, addPdfHeader, applyPdfFooters, hexToRgb } from './pdfBranding';

let jsPdfPromise = null;
let html2CanvasPromise = null;

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const DETAIL_MARGIN = 14;
const CONTENT_WIDTH = 182;
const SAFE_BOTTOM = 281;

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

const captureElement = async (html2canvas, ref, name) => {
  if (!ref?.current) {
    return null;
  }

  try {
    return await html2canvas(ref.current, {
      backgroundColor: '#07111F',
      scale: 2.5,
      useCORS: true,
      logging: false,
    });
  } catch (error) {
    console.warn(`Failed to capture ${name}:`, error);
    return null;
  }
};

const wrapParagraph = (pdf, text, width) => pdf.splitTextToSize(String(text), width);

const getCanvasSize = (canvas, maxWidth, maxHeight) => {
  const ratio = canvas.height / canvas.width;
  const width = Math.min(maxWidth, maxHeight / ratio);
  return {
    width,
    height: width * ratio,
  };
};

const getExamPalette = (exam, diagramMeta) => {
  const presets = {
    cogag: {
      accent: '#F59E0B',
      accentSoft: [255, 247, 237],
      secondary: '#38BDF8',
      dark: [9, 25, 51],
      darkSoft: [15, 34, 67],
      light: [248, 250, 252],
      line: [148, 163, 184],
    },
    'lng-electric': {
      accent: '#0EA5E9',
      accentSoft: [240, 249, 255],
      secondary: '#22C55E',
      dark: [9, 22, 45],
      darkSoft: [15, 42, 74],
      light: [248, 250, 252],
      line: [148, 163, 184],
    },
    'traditional-propulsion': {
      accent: '#1D4ED8',
      accentSoft: [239, 246, 255],
      secondary: '#F59E0B',
      dark: [15, 23, 42],
      darkSoft: [30, 41, 59],
      light: [248, 250, 252],
      line: [148, 163, 184],
    },
    'cargo-pump': {
      accent: '#0F766E',
      accentSoft: [240, 253, 250],
      secondary: '#F97316',
      dark: [10, 30, 38],
      darkSoft: [17, 58, 68],
      light: [248, 250, 252],
      line: [148, 163, 184],
    },
    default: {
      accent: '#F59E0B',
      accentSoft: [255, 251, 235],
      secondary: '#38BDF8',
      dark: [8, 15, 28],
      darkSoft: [15, 23, 42],
      light: [248, 250, 252],
      line: [148, 163, 184],
    },
  };

  return presets[diagramMeta?.type] ?? presets[exam.code === 'I159' ? 'lng-electric' : 'default'];
};

const drawBadge = (pdf, x, y, text, fillColor, textColor, width = null) => {
  const badgeWidth = width ?? Math.max(22, text.length * 2.4 + 10);
  pdf.setFillColor(...fillColor);
  pdf.roundedRect(x, y, badgeWidth, 8, 3, 3, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(...textColor);
  pdf.text(text, x + 4, y + 5.2);
  return badgeWidth;
};

const drawChipRow = (pdf, chips, startX, y, maxWidth, fillColor, textColor) => {
  let x = startX;
  let row = y;
  chips.forEach((chip) => {
    const width = Math.max(28, chip.length * 2.4 + 10);
    if (x + width > startX + maxWidth) {
      x = startX;
      row += 10;
    }
    drawBadge(pdf, x, row, chip, fillColor, textColor, width);
    x += width + 3;
  });
  return row + 8;
};

const addImagePanel = (pdf, canvas, x, y, width, height, fillColor, strokeColor, imagePadding = 4) => {
  if (!canvas) {
    return;
  }

  pdf.setFillColor(...fillColor);
  pdf.roundedRect(x, y, width, height, 6, 6, 'F');
  pdf.setDrawColor(...strokeColor);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(x, y, width, height, 6, 6, 'S');

  const maxWidth = width - imagePadding * 2;
  const maxHeight = height - imagePadding * 2;
  const imageSize = getCanvasSize(canvas, maxWidth, maxHeight);
  const imageX = x + (width - imageSize.width) / 2;
  const imageY = y + (height - imageSize.height) / 2;
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', imageX, imageY, imageSize.width, imageSize.height, undefined, 'FAST');
};

const addCoverPage = (pdf, { exam, palette, summaryCanvas, diagramCanvas }) => {
  const [accentR, accentG, accentB] = hexToRgb(palette.accent);
  const [secondaryR, secondaryG, secondaryB] = hexToRgb(palette.secondary);

  pdf.setFillColor(...palette.dark);
  pdf.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');

  pdf.setFillColor(...palette.darkSoft);
  pdf.circle(182, 54, 34, 'F');
  pdf.circle(26, 260, 22, 'F');

  pdf.setDrawColor(255, 255, 255);
  pdf.setLineWidth(0.18);
  pdf.line(14, 18, 196, 18);
  pdf.line(14, 279, 196, 279);
  pdf.line(18, 14, 18, 283);
  pdf.line(192, 14, 192, 283);

  drawBadge(pdf, 16, 18, `ESAME DI STATO ${exam.year}`, [accentR, accentG, accentB], [8, 15, 28], 40);
  drawBadge(pdf, 59, 18, exam.code, [255, 255, 255], [15, 23, 42], 18);

  const headlineLines = wrapParagraph(pdf, exam.headline, 124);
  const titleLines = wrapParagraph(pdf, `${exam.shortTitle} | Soluzione guidata`, 118);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(191, 219, 254);
  pdf.text(titleLines, 18, 44);

  pdf.setFontSize(20.5);
  pdf.setTextColor(255, 255, 255);
  pdf.text(headlineLines, 18, 60);

  pdf.setDrawColor(accentR, accentG, accentB);
  pdf.setLineWidth(1.2);
  pdf.line(18, 83, 84, 83);

  const intro = wrapParagraph(
    pdf,
    'Dossier tecnico con traccia, ipotesi, svolgimento ordinato, risultati finali e quesiti scelti.',
    54,
  );
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10.4);
  pdf.setTextColor(203, 213, 225);
  pdf.text(intro, 18, 102);

  drawChipRow(
    pdf,
    ['Traccia inclusa', 'Prima parte guidata', 'Schema tecnico', 'Quesiti svolti'],
    18,
    126,
    82,
    [255, 255, 255],
    [15, 23, 42],
  );

  const heroCanvas = diagramCanvas ?? summaryCanvas;
  if (heroCanvas) {
    addImagePanel(pdf, heroCanvas, 122, 92, 66, 72, [241, 245, 249], [accentR, accentG, accentB]);
  }

  const metrics = exam.firstPart.results.slice(0, 4);
  let cardsY = 166;
  metrics.forEach((result, index) => {
    const x = 18 + (index % 2) * 48;
    if (index > 0 && index % 2 === 0) {
      cardsY += 24;
    }

    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(x, cardsY, 44, 20, 4, 4, 'F');
    pdf.setDrawColor(index % 2 === 0 ? accentR : secondaryR, index % 2 === 0 ? accentG : secondaryG, index % 2 === 0 ? accentB : secondaryB);
    pdf.setLineWidth(0.45);
    pdf.roundedRect(x, cardsY, 44, 20, 4, 4, 'S');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(15, 23, 42);
    pdf.text(wrapParagraph(pdf, result.label.toUpperCase(), 36), x + 3, cardsY + 5.4);

    pdf.setFontSize(11.2);
    pdf.setTextColor(index % 2 === 0 ? accentR : secondaryR, index % 2 === 0 ? accentG : secondaryG, index % 2 === 0 ? accentB : secondaryB);
    pdf.text(String(result.value), x + 3, cardsY + 16);
  });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.2);
  pdf.setTextColor(148, 163, 184);
  pdf.text(`Autore PDF: ${THERMOHUB_AUTHOR}`, 18, 250);
  pdf.text(`Generato il ${new Date().toLocaleDateString('it-IT')}`, 18, 256);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10.5);
  pdf.setTextColor(255, 255, 255);
  pdf.text('ThermoHub', 18, 270);

  const closeNote = wrapParagraph(
    pdf,
    'L impostazione riprende un dossier di correzione: prima si legge il problema, poi si costruiscono ipotesi coerenti e infine si fissano i risultati utili all orale e alla revisione finale.',
    96,
  );
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.2);
  pdf.setTextColor(203, 213, 225);
  pdf.text(closeNote, 54, 270);
};

const drawPanel = (pdf, { x, y, width, height, title, bodyLines = [], fillColor, borderColor, titleColor, bodyColor, accentColor = null }) => {
  pdf.setFillColor(...fillColor);
  pdf.roundedRect(x, y, width, height, 5, 5, 'F');
  pdf.setDrawColor(...borderColor);
  pdf.setLineWidth(0.35);
  pdf.roundedRect(x, y, width, height, 5, 5, 'S');

  if (accentColor) {
    pdf.setFillColor(...accentColor);
    pdf.roundedRect(x, y, 4, height, 5, 5, 'F');
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(...titleColor);
  pdf.text(title, x + 8, y + 8);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.4);
  pdf.setTextColor(...bodyColor);
  let localY = y + 14;
  bodyLines.forEach((line) => {
    const wrapped = Array.isArray(line) ? line : wrapParagraph(pdf, line, width - 14);
    pdf.text(wrapped, x + 8, localY);
    localY += wrapped.length * 4.5 + 1.6;
  });
};

const addOverviewPage = (pdf, { exam, palette }) => {
  const [accentR, accentG, accentB] = hexToRgb(palette.accent);
  const [secondaryR, secondaryG, secondaryB] = hexToRgb(palette.secondary);

  pdf.addPage();
  pdf.setFillColor(...palette.light);
  pdf.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.setTextColor(15, 23, 42);
  pdf.text('Mappa della prova', 16, 24);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(71, 85, 105);
  pdf.text(
    wrapParagraph(
      pdf,
      'Questa pagina organizza la traccia come farebbe un docente in correzione: contesto, richieste, ipotesi guida e quesiti sviluppati nel PDF.',
      176,
    ),
    16,
    32,
  );

  drawPanel(pdf, {
    x: 16,
    y: 44,
    width: 84,
    height: 90,
    title: 'Scenario e richieste',
    bodyLines: exam.trace.map((paragraph, index) => `${index + 1}. ${paragraph}`),
    fillColor: [255, 255, 255],
    borderColor: [226, 232, 240],
    titleColor: [15, 23, 42],
    bodyColor: [51, 65, 85],
    accentColor: [accentR, accentG, accentB],
  });

  drawPanel(pdf, {
    x: 110,
    y: 44,
    width: 84,
    height: 90,
    title: 'Quesiti svolti',
    bodyLines: exam.selectedQuestions.map((question) => `${question.code}) ${question.title}`),
    fillColor: [255, 255, 255],
    borderColor: [226, 232, 240],
    titleColor: [15, 23, 42],
    bodyColor: [51, 65, 85],
    accentColor: [secondaryR, secondaryG, secondaryB],
  });

  drawPanel(pdf, {
    x: 16,
    y: 144,
    width: 178,
    height: 68,
    title: 'Ipotesi guida per lo svolgimento',
    bodyLines: exam.assumptions.map((assumption, index) => `${index + 1}. ${assumption}`),
    fillColor: [255, 255, 255],
    borderColor: [226, 232, 240],
    titleColor: [15, 23, 42],
    bodyColor: [51, 65, 85],
    accentColor: [accentR, accentG, accentB],
  });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(15, 23, 42);
  pdf.text('Risultati chiave da fissare subito', 16, 228);

  exam.firstPart.results.slice(0, 6).forEach((result, index) => {
    const x = 16 + (index % 3) * 60.5;
    const y = 236 + Math.floor(index / 3) * 23;
    const border = index % 2 === 0
      ? [accentR, accentG, accentB]
      : [secondaryR, secondaryG, secondaryB];

    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(x, y, 56.5, 18, 4, 4, 'F');
    pdf.setDrawColor(...border);
    pdf.setLineWidth(0.4);
    pdf.roundedRect(x, y, 56.5, 18, 4, 4, 'S');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.6);
    pdf.setTextColor(71, 85, 105);
    pdf.text(wrapParagraph(pdf, result.label.toUpperCase(), 49), x + 3, y + 5);

    pdf.setFontSize(10.2);
    pdf.setTextColor(15, 23, 42);
    pdf.text(String(result.value), x + 3, y + 13.5);
  });
};

const addTechnicalBoardPage = (pdf, { exam, diagramMeta, palette, summaryCanvas, diagramCanvas }) => {
  if (!summaryCanvas && !diagramCanvas) {
    return;
  }

  const [accentR, accentG, accentB] = hexToRgb(palette.accent);
  const [secondaryR, secondaryG, secondaryB] = hexToRgb(palette.secondary);

  pdf.addPage();
  pdf.setFillColor(245, 247, 250);
  pdf.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(15, 23, 42);
  pdf.text(diagramMeta?.title ?? 'Tavola tecnica della soluzione', 16, 22);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(71, 85, 105);
  pdf.text(
    wrapParagraph(
      pdf,
      diagramMeta?.caption ?? 'Vista d insieme utile per collegare i passaggi numerici alla logica impiantistica della traccia.',
      178,
    ),
    16,
    30,
  );

  if (diagramCanvas) {
    addImagePanel(pdf, diagramCanvas, 16, 42, 118, 122, [255, 255, 255], [accentR, accentG, accentB]);
  }

  drawPanel(pdf, {
    x: 142,
    y: 42,
    width: 52,
    height: summaryCanvas ? 70 : 122,
    title: 'Perche questa tavola aiuta',
    bodyLines: (diagramMeta?.highlights ?? [
      'Il diagramma collega il calcolo alla macchina reale.',
      'Serve come supporto rapido alla spiegazione orale.',
      'Aiuta a tenere insieme potenza, impianti e servizi ausiliari.',
    ]).map((item, index) => `${index + 1}. ${item}`),
    fillColor: [255, 255, 255],
    borderColor: [226, 232, 240],
    titleColor: [15, 23, 42],
    bodyColor: [51, 65, 85],
    accentColor: [secondaryR, secondaryG, secondaryB],
  });

  if (summaryCanvas) {
    addImagePanel(pdf, summaryCanvas, 142, 118, 52, 46, [255, 255, 255], [secondaryR, secondaryG, secondaryB], 3);
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(15, 23, 42);
  pdf.text('Esito sintetico della prima parte', 16, 182);

  exam.firstPart.results.slice(0, 6).forEach((result, index) => {
    const x = 16 + (index % 2) * 89;
    const y = 190 + Math.floor(index / 2) * 24;
    const border = index % 2 === 0
      ? [accentR, accentG, accentB]
      : [secondaryR, secondaryG, secondaryB];

    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(x, y, 85, 18, 4, 4, 'F');
    pdf.setDrawColor(...border);
    pdf.setLineWidth(0.45);
    pdf.roundedRect(x, y, 85, 18, 4, 4, 'S');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(71, 85, 105);
    pdf.text(wrapParagraph(pdf, result.label, 75), x + 4, y + 5.5);

    pdf.setFontSize(10.8);
    pdf.setTextColor(15, 23, 42);
    pdf.text(String(result.value), x + 4, y + 13.8);
  });

  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(9.2);
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    wrapParagraph(
      pdf,
      'Nella stampa finale questa tavola anticipa gli elementi che poi vengono ripresi nello svolgimento numerico e nei quesiti di seconda parte.',
      178,
    ),
    16,
    268,
  );
};

export const exportExamToPDF = async ({
  exam,
  diagramMeta = null,
  summaryRef,
  diagramRef,
}) => {
  const [jsPDF, html2canvas] = await Promise.all([getJsPDF(), getHtml2Canvas()]);
  const [summaryCanvas, diagramCanvas] = await Promise.all([
    captureElement(html2canvas, summaryRef, 'summary'),
    captureElement(html2canvas, diagramRef, 'diagram'),
  ]);

  const palette = getExamPalette(exam, diagramMeta);
  const [accentR, accentG, accentB] = hexToRgb(palette.accent);
  const [secondaryR, secondaryG, secondaryB] = hexToRgb(palette.secondary);

  const pdf = new jsPDF('p', 'mm', 'a4');

  addCoverPage(pdf, { exam, palette, summaryCanvas, diagramCanvas });
  addOverviewPage(pdf, { exam, palette });
  addTechnicalBoardPage(pdf, { exam, diagramMeta, palette, summaryCanvas, diagramCanvas });

  let y = 0;

  const startDetailPage = () => {
    pdf.addPage();
    y = addPdfHeader(pdf, {
      title: exam.shortTitle,
      subtitle: exam.headline,
      accentColor: palette.accent,
      label: 'Esami di Stato',
    });
  };

  const ensureSpace = (needed) => {
    if (y + needed > SAFE_BOTTOM) {
      startDetailPage();
    }
  };

  const addInfoBand = () => {
    ensureSpace(22);

    pdf.setFillColor(...palette.accentSoft);
    pdf.roundedRect(DETAIL_MARGIN, y, CONTENT_WIDTH, 16, 4, 4, 'F');
    pdf.setDrawColor(accentR, accentG, accentB);
    pdf.setLineWidth(0.35);
    pdf.roundedRect(DETAIL_MARGIN, y, CONTENT_WIDTH, 16, 4, 4, 'S');

    drawBadge(pdf, DETAIL_MARGIN + 4, y + 3.5, `${exam.code} ${exam.year}`, [accentR, accentG, accentB], [8, 15, 28], 24);
    drawBadge(pdf, DETAIL_MARGIN + 31, y + 3.5, 'DOSSIER PDF', [15, 23, 42], [255, 255, 255], 26);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.7);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`Generato il ${new Date().toLocaleDateString('it-IT')} da ${THERMOHUB_AUTHOR}`, DETAIL_MARGIN + 63, y + 8.9);
    pdf.text('Traccia originale, svolgimento guidato, risultati e quesiti scelti nello stesso PDF.', DETAIL_MARGIN + 63, y + 13.2);
    y += 20;
  };

  const addSectionTitle = (title, subtitle, variant = 'accent') => {
    ensureSpace(subtitle ? 18 : 12);
    const lineColor = variant === 'secondary'
      ? [secondaryR, secondaryG, secondaryB]
      : [accentR, accentG, accentB];

    pdf.setDrawColor(...lineColor);
    pdf.setLineWidth(0.9);
    pdf.line(DETAIL_MARGIN, y + 2, DETAIL_MARGIN + 18, y + 2);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(15, 23, 42);
    pdf.text(title, DETAIL_MARGIN, y + 8);

    if (subtitle) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.6);
      pdf.setTextColor(100, 116, 139);
      pdf.text(wrapParagraph(pdf, subtitle, CONTENT_WIDTH), DETAIL_MARGIN, y + 13);
      y += 18;
      return;
    }

    y += 12;
  };

  const addParagraphs = (paragraphs) => {
    paragraphs.forEach((paragraph, index) => {
      const lines = wrapParagraph(pdf, paragraph, CONTENT_WIDTH - 14);
      const boxHeight = Math.max(12, lines.length * 4.9 + 7);
      ensureSpace(boxHeight + 3);

      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(DETAIL_MARGIN, y, CONTENT_WIDTH, boxHeight, 4, 4, 'F');
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.35);
      pdf.roundedRect(DETAIL_MARGIN, y, CONTENT_WIDTH, boxHeight, 4, 4, 'S');
      pdf.setFillColor(index % 2 === 0 ? accentR : secondaryR, index % 2 === 0 ? accentG : secondaryG, index % 2 === 0 ? accentB : secondaryB);
      pdf.roundedRect(DETAIL_MARGIN, y, 4, boxHeight, 4, 4, 'F');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(71, 85, 105);
      pdf.text(`PARAGRAFO ${index + 1}`, DETAIL_MARGIN + 8, y + 5.5);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.6);
      pdf.setTextColor(30, 41, 59);
      pdf.text(lines, DETAIL_MARGIN + 8, y + 11);
      y += boxHeight + 3;
    });
  };

  const addNumberedCards = (items, variant = 'accent') => {
    items.forEach((item, index) => {
      const border = variant === 'secondary'
        ? [secondaryR, secondaryG, secondaryB]
        : [accentR, accentG, accentB];
      const fill = variant === 'secondary' ? [240, 249, 255] : palette.accentSoft;
      const lines = wrapParagraph(pdf, item, CONTENT_WIDTH - 22);
      const height = Math.max(11, lines.length * 4.7 + 7);
      ensureSpace(height + 3);

      pdf.setFillColor(...fill);
      pdf.roundedRect(DETAIL_MARGIN, y, CONTENT_WIDTH, height, 4, 4, 'F');
      pdf.setDrawColor(...border);
      pdf.setLineWidth(0.35);
      pdf.roundedRect(DETAIL_MARGIN, y, CONTENT_WIDTH, height, 4, 4, 'S');

      pdf.setFillColor(...border);
      pdf.circle(DETAIL_MARGIN + 8, y + 7.2, 3.8, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(255, 255, 255);
      pdf.text(String(index + 1), DETAIL_MARGIN + 6.8, y + 8.1);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.3);
      pdf.setTextColor(51, 65, 85);
      pdf.text(lines, DETAIL_MARGIN + 15, y + 7.7);
      y += height + 3;
    });
  };

  const addSteps = () => {
    exam.firstPart.steps.forEach((step, index) => {
      const titleLines = wrapParagraph(pdf, step.title, CONTENT_WIDTH - 28);
      const bodyHeight = step.body.reduce(
        (total, paragraph) => total + wrapParagraph(pdf, paragraph, CONTENT_WIDTH - 16).length * 4.6 + 2,
        0,
      );
      const height = Math.max(24, titleLines.length * 5 + bodyHeight + 12);
      ensureSpace(height + 4);

      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(DETAIL_MARGIN, y, CONTENT_WIDTH, height, 4.5, 4.5, 'F');
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.35);
      pdf.roundedRect(DETAIL_MARGIN, y, CONTENT_WIDTH, height, 4.5, 4.5, 'S');
      pdf.setFillColor(index % 2 === 0 ? accentR : secondaryR, index % 2 === 0 ? accentG : secondaryG, index % 2 === 0 ? accentB : secondaryB);
      pdf.roundedRect(DETAIL_MARGIN, y, 6, height, 4.5, 4.5, 'F');

      pdf.setFillColor(15, 23, 42);
      pdf.circle(DETAIL_MARGIN + 16, y + 9, 5.2, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(255, 255, 255);
      pdf.text(String(index + 1), DETAIL_MARGIN + 14.3, y + 10.2);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10.8);
      pdf.setTextColor(15, 23, 42);
      pdf.text(titleLines, DETAIL_MARGIN + 25, y + 7.5);

      let localY = y + 15.5 + (titleLines.length - 1) * 4.8;
      step.body.forEach((paragraph, paragraphIndex) => {
        const lines = wrapParagraph(pdf, paragraph, CONTENT_WIDTH - 16);
        pdf.setFont(paragraphIndex === step.body.length - 1 ? 'helvetica' : 'helvetica', paragraphIndex === step.body.length - 1 ? 'bold' : 'normal');
        pdf.setFontSize(paragraphIndex === step.body.length - 1 ? 9.5 : 9.2);
        pdf.setTextColor(paragraphIndex === step.body.length - 1 ? 30 : 51, paragraphIndex === step.body.length - 1 ? 41 : 65, paragraphIndex === step.body.length - 1 ? 59 : 85);
        pdf.text(lines, DETAIL_MARGIN + 12, localY);
        localY += lines.length * 4.6 + 2;
      });

      y += height + 4;
    });
  };

  const addResultsGrid = () => {
    const cardWidth = (CONTENT_WIDTH - 6) / 2;
    const rowHeights = [];

    for (let index = 0; index < exam.firstPart.results.length; index += 2) {
      const left = exam.firstPart.results[index];
      const right = exam.firstPart.results[index + 1];
      const leftLines = wrapParagraph(pdf, left.label.toUpperCase(), cardWidth - 10).length;
      const rightLines = right ? wrapParagraph(pdf, right.label.toUpperCase(), cardWidth - 10).length : 0;
      rowHeights.push(Math.max(19, 11 + Math.max(leftLines, rightLines) * 4.2));
    }

    let rowIndex = 0;
    let currentY = y;

    exam.firstPart.results.forEach((result, index) => {
      const rowHeight = rowHeights[Math.floor(index / 2)];
      if (index % 2 === 0) {
        ensureSpace(rowHeight + 4);
        currentY = y;
        rowIndex = Math.floor(index / 2);
      }

      const x = DETAIL_MARGIN + (index % 2) * (cardWidth + 6);
      const border = index % 2 === 0
        ? [accentR, accentG, accentB]
        : [secondaryR, secondaryG, secondaryB];
      const fill = index % 2 === 0 ? [255, 251, 235] : [240, 249, 255];

      pdf.setFillColor(...fill);
      pdf.roundedRect(x, currentY, cardWidth, rowHeight, 4, 4, 'F');
      pdf.setDrawColor(...border);
      pdf.setLineWidth(0.35);
      pdf.roundedRect(x, currentY, cardWidth, rowHeight, 4, 4, 'S');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(71, 85, 105);
      pdf.text(wrapParagraph(pdf, result.label.toUpperCase(), cardWidth - 10), x + 4, currentY + 5.2);

      pdf.setFontSize(11.4);
      pdf.setTextColor(15, 23, 42);
      pdf.text(String(result.value), x + 4, currentY + rowHeight - 4.2);

      if (index % 2 === 1 || index === exam.firstPart.results.length - 1) {
        y = currentY + rowHeights[rowIndex] + 4;
      }
    });
  };

  const addQuestions = () => {
    exam.selectedQuestions.forEach((question, index) => {
      const titleLines = wrapParagraph(pdf, question.title, CONTENT_WIDTH - 28);
      const bodyHeight = question.points.reduce(
        (total, point) => total + wrapParagraph(pdf, point, CONTENT_WIDTH - 20).length * 4.5 + 2,
        0,
      );
      const height = Math.max(24, titleLines.length * 4.8 + bodyHeight + 12);
      ensureSpace(height + 4);

      const border = index % 2 === 0
        ? [secondaryR, secondaryG, secondaryB]
        : [accentR, accentG, accentB];
      const fill = index % 2 === 0 ? [240, 249, 255] : [255, 251, 235];

      pdf.setFillColor(...fill);
      pdf.roundedRect(DETAIL_MARGIN, y, CONTENT_WIDTH, height, 4.5, 4.5, 'F');
      pdf.setDrawColor(...border);
      pdf.setLineWidth(0.4);
      pdf.roundedRect(DETAIL_MARGIN, y, CONTENT_WIDTH, height, 4.5, 4.5, 'S');

      pdf.setFillColor(...border);
      pdf.roundedRect(DETAIL_MARGIN + 4, y + 4, 18, 8, 3, 3, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.2);
      pdf.setTextColor(255, 255, 255);
      pdf.text(`Q ${question.code}`, DETAIL_MARGIN + 7, y + 9.2);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10.6);
      pdf.setTextColor(15, 23, 42);
      pdf.text(titleLines, DETAIL_MARGIN + 26, y + 8);

      let localY = y + 16 + (titleLines.length - 1) * 4.8;
      question.points.forEach((point, pointIndex) => {
        const lines = wrapParagraph(pdf, point, CONTENT_WIDTH - 20);
        pdf.setFillColor(...border);
        pdf.circle(DETAIL_MARGIN + 10, localY - 1.2, 1.3, 'F');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9.1);
        pdf.setTextColor(51, 65, 85);
        pdf.text(lines, DETAIL_MARGIN + 15, localY);
        localY += lines.length * 4.5 + 2;

        if (pointIndex < question.points.length - 1) {
          pdf.setDrawColor(203, 213, 225);
          pdf.setLineWidth(0.2);
          pdf.line(DETAIL_MARGIN + 15, localY - 1, DETAIL_MARGIN + CONTENT_WIDTH - 6, localY - 1);
          localY += 1;
        }
      });

      y += height + 4;
    });
  };

  startDetailPage();
  addInfoBand();

  addSectionTitle('Traccia ministeriale', 'Apertura ordinata della prova con il contesto di progetto e le richieste principali.');
  addParagraphs(exam.trace);

  addSectionTitle('Ipotesi di svolgimento', 'Assunzioni operative e numeriche usate per trasformare la traccia in un caso risolvibile.', 'secondary');
  addNumberedCards(exam.assumptions, 'secondary');

  addSectionTitle('Svolgimento dettagliato', 'Passaggi della prima parte con andamento progressivo: dati, formule e risultato utile.', 'accent');
  addSteps();

  addSectionTitle('Risultati finali', 'Valori da fissare subito per ripasso, correzione e discussione orale.');
  addResultsGrid();

  addSectionTitle('Schema funzionale essenziale', 'Collegamento sintetico fra macchina, impianto e flussi energetici.', 'secondary');
  addNumberedCards(exam.firstPart.schematic, 'accent');

  addSectionTitle('Quesiti svolti', 'Approfondimenti della seconda parte organizzati in forma schematica e leggibile.');
  addQuestions();

  applyPdfFooters(pdf, {
    accentColor: palette.accent,
    footerLabel: `ThermoHub | ${THERMOHUB_AUTHOR} | ${exam.shortTitle}`,
  });

  pdf.save(`${exam.shortTitle.replace(/\s+/g, '_')}_ThermoHub_svolto.pdf`);
};
