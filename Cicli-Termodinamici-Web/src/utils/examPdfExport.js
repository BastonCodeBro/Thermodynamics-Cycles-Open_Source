let jsPdfPromise = null;

const getJsPDF = async () => {
  if (!jsPdfPromise) {
    jsPdfPromise = import('jspdf').then((module) => module.jsPDF);
  }
  return jsPdfPromise;
};

const addWrappedParagraph = (pdf, text, margin, y, pageWidth, lineHeight = 5) => {
  const lines = pdf.splitTextToSize(text, pageWidth);
  lines.forEach((line) => {
    if (y > 280) {
      pdf.addPage();
      y = 18;
    }
    pdf.text(line, margin, y);
    y += lineHeight;
  });
  return y + 1;
};

export const exportExamToPDF = async (exam) => {
  const jsPDF = await getJsPDF();
  const pdf = new jsPDF('p', 'mm', 'a4');
  const margin = 16;
  const pageWidth = 210 - margin * 2;
  let y = 18;

  const addSectionTitle = (title, color = [17, 24, 39]) => {
    if (y > 270) {
      pdf.addPage();
      y = 18;
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(...color);
    pdf.text(title, margin, y);
    y += 8;
  };

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.setTextColor(8, 145, 178);
  pdf.text(`${exam.shortTitle}`, margin, y);
  y += 9;

  pdf.setFontSize(12);
  pdf.setTextColor(17, 24, 39);
  pdf.text(exam.headline, margin, y);
  y += 8;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(100, 116, 139);
  pdf.text(`Materiale didattico ThermoHub - generato il ${new Date().toLocaleDateString('it-IT')}`, margin, y);
  y += 10;

  addSectionTitle('Traccia');
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(31, 41, 55);
  exam.trace.forEach((paragraph) => {
    y = addWrappedParagraph(pdf, paragraph, margin, y, pageWidth);
  });

  addSectionTitle('Ipotesi di svolgimento');
  exam.assumptions.forEach((item, index) => {
    y = addWrappedParagraph(pdf, `${index + 1}. ${item}`, margin, y, pageWidth);
  });

  addSectionTitle('Svolgimento dettagliato');
  exam.firstPart.steps.forEach((step) => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    y = addWrappedParagraph(pdf, step.title, margin, y, pageWidth);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    step.body.forEach((paragraph) => {
      y = addWrappedParagraph(pdf, paragraph, margin, y, pageWidth);
    });
    y += 1;
  });

  addSectionTitle('Risultati finali', [8, 145, 178]);
  exam.firstPart.results.forEach((result) => {
    y = addWrappedParagraph(pdf, `- ${result.label}: ${result.value}`, margin, y, pageWidth);
  });

  addSectionTitle('Schema funzionale essenziale');
  exam.firstPart.schematic.forEach((line) => {
    y = addWrappedParagraph(pdf, `- ${line}`, margin, y, pageWidth);
  });

  addSectionTitle('Quesiti svolti');
  exam.selectedQuestions.forEach((question) => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    y = addWrappedParagraph(pdf, `${question.code}) ${question.title}`, margin, y, pageWidth);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    question.points.forEach((point, index) => {
      y = addWrappedParagraph(pdf, `${index + 1}. ${point}`, margin, y, pageWidth);
    });
    y += 1;
  });

  pdf.save(`${exam.shortTitle.replace(/\s+/g, '_')}_svolto.pdf`);
};
