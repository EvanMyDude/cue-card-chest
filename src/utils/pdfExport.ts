import jsPDF from 'jspdf';
import type { Prompt } from '@/types/prompt';

export const exportPromptsToPDF = (prompts: Prompt[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - 2 * margin;
  let yPosition = margin;

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Prompt Library Export', margin, yPosition);
  yPosition += 15;

  // Export date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Exported: ${new Date().toLocaleDateString()}`, margin, yPosition);
  yPosition += 15;

  // Prompts
  prompts.forEach((prompt, index) => {
    // Check if we need a new page
    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = margin;
    }

    // Prompt number and title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const titleText = `${index + 1}. ${prompt.title}`;
    doc.text(titleText, margin, yPosition);
    yPosition += 8;

    // Tags
    if (prompt.tags.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      doc.text(`Tags: ${prompt.tags.join(', ')}`, margin, yPosition);
      doc.setTextColor(0, 0, 0);
      yPosition += 8;
    }

    // Content
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const contentLines = doc.splitTextToSize(prompt.content, maxWidth);
    
    contentLines.forEach((line: string) => {
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = margin;
      }
      doc.text(line, margin, yPosition);
      yPosition += 6;
    });

    // Metadata
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    const createdDate = new Date(prompt.createdAt).toLocaleDateString();
    const updatedDate = new Date(prompt.updatedAt).toLocaleDateString();
    doc.text(`Created: ${createdDate} | Last edited: ${updatedDate}`, margin, yPosition + 5);
    doc.setTextColor(0, 0, 0);
    yPosition += 20;

    // Separator line
    if (index < prompts.length - 1) {
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPosition - 5, pageWidth - margin, yPosition - 5);
    }
  });

  // Save the PDF
  doc.save(`prompt-library-${new Date().toISOString().split('T')[0]}.pdf`);
};
