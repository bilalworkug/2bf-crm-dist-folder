import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export interface PDFExportOptions {
  title: string;
  subtitle?: string;
  filename?: string;
  tables: {
    head: string[][];
    body: (string | number)[][];
    title?: string;
  }[];
}

async function getBase64ImageFromUrl(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function generatePDFReport(options: PDFExportOptions) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let currentY = 15;

  try {
    // Attempt to load the logo
    const logoBase64 = await getBase64ImageFromUrl('/logo.jpg');
    doc.addImage(logoBase64, 'JPEG', margin, currentY, 20, 20);
    
    // Header text
    doc.setFontSize(18);
    doc.setTextColor(20, 20, 20);
    doc.text('Two Brothers Food Complex', margin + 25, currentY + 8);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Operational Management System', margin + 25, currentY + 14);
    
    // Add date
    const dateStr = format(new Date(), 'MMM dd, yyyy HH:mm');
    doc.setFontSize(9);
    doc.text(`Generated: ${dateStr}`, pageWidth - margin, currentY + 8, { align: 'right' });

    currentY += 28;
  } catch (error) {
    console.error('Failed to load logo for PDF', error);
    doc.setFontSize(18);
    doc.text('Two Brothers Food Complex', margin, currentY + 8);
    currentY += 20;
  }

  // Draw separator line
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 8;

  // Document Title
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text(options.title, margin, currentY);
  currentY += 6;

  if (options.subtitle) {
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    doc.text(options.subtitle, margin, currentY);
    currentY += 6;
  }
  
  currentY += 4;

  // Add tables
  for (const table of options.tables) {
    if (table.title) {
      doc.setFontSize(12);
      doc.setTextColor(40, 40, 40);
      doc.text(table.title, margin, currentY + 2);
      currentY += 4;
    }

    autoTable(doc, {
      startY: currentY,
      head: table.head,
      body: table.body,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: margin, right: margin },
      didDrawPage: (data: any) => {
        const str = `Page ${(doc.internal as any).getNumberOfPages()}`;
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.text(str, pageWidth - margin, pageHeight - 10, { align: 'right' });
        doc.text('Two Brothers Food Complex CRM', margin, pageHeight - 10);
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;
  }

  // Save the PDF
  const filename = options.filename || `Report-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(filename);
}
