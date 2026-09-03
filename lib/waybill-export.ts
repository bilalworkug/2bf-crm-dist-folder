import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export interface WaybillData {
  waybillNumber: string;
  handoverNumber: string;
  orderNumber: string;
  orderDate: string;
  customerName: string;
  customerCompany?: string | null;
  customerPhone?: string | null;
  customerLocation?: string | null;
  recipientType: string;
  recipientName: string;
  recipientPhone?: string | null;
  driverName?: string | null;
  transportCompany?: string | null;
  vehiclePlate?: string | null;
  notes?: string | null;
  items: {
    sku: string;
    productName: string;
    cartonsDispatched: number;
  }[];
  totalCartons: number;
  dispatcherName: string;
  dispatcherRole?: string;
}

export function generateWaybillPDF(data: WaybillData) {
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const dateStr = format(new Date(), 'PPP p');

  // ── Header & Branding ──
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(14, 14, pageWidth - 28, 22, 'F');

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('TWO BROTHERS FOOD COMPLEX P.L.C', 20, 23);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  doc.text('OFFICIAL DISPATCH WAYBILL & GATE PASS (FACTORY LOADING DOCK)', 20, 30);

  // ── Document Metadata Right Top ──
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${dateStr}`, pageWidth - 14, 42, { align: 'right' });

  // ── Waybill Info Box ──
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 46, pageWidth - 28, 44, 2, 2, 'FD');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Waybill No: ${data.waybillNumber || data.handoverNumber}`, 20, 54);
  doc.text(`Order No: ${data.orderNumber}`, 20, 61);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Order Date: ${data.orderDate}`, 20, 68);
  doc.text(`Handover ID: ${data.handoverNumber}`, 20, 75);
  doc.text(`Customer: ${data.customerCompany || data.customerName}`, 20, 82);

  // Right column of metadata box
  const rightColX = pageWidth / 2 + 5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Transport / 3PL: ${data.transportCompany || 'Self-Pickup'}`, rightColX, 54);
  doc.text(`Vehicle Plate: ${data.vehiclePlate || 'N/A'}`, rightColX, 61);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Driver / Transporter: ${data.driverName || 'N/A'}`, rightColX, 68);
  doc.text(`Receiver Contact: ${data.recipientName} (${data.recipientPhone || 'N/A'})`, rightColX, 75);
  doc.text(`Destination / Loc: ${data.customerLocation || 'Standard Delivery Point'}`, rightColX, 82);

  // ── Itemized Table ──
  const tableHead = [['#', 'Product SKU', 'Description / Item Name', 'Cartons Handed Over']];
  const tableBody = data.items.map((it, idx) => [
    idx + 1,
    it.sku || 'SKU',
    it.productName,
    it.cartonsDispatched.toLocaleString(),
  ]);

  // Add summary row
  tableBody.push(['', '', 'TOTAL CARTONS DISPATCHED & HANDED OVER', data.totalCartons.toLocaleString()]);

  autoTable(doc, {
    head: tableHead,
    body: tableBody,
    startY: 96,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 35 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 45, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Notes section
  if (data.notes) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139);
    doc.text(`Special Notes: ${data.notes}`, 14, finalY);
  }

  // ── Verification & Signatures Block ──
  const signBlockY = Math.max(finalY + 12, pageHeight - 55);
  const blockWidth = (pageWidth - 36) / 3;

  // 1. Loading Supervisor
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, signBlockY, blockWidth, 38);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('1. Factory Loading Supervisor', 17, signBlockY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Name: ${data.dispatcherName}`, 17, signBlockY + 13);
  doc.text(`Role: ${data.dispatcherRole || 'Dispatch'}`, 17, signBlockY + 18);
  doc.line(17, signBlockY + 30, 14 + blockWidth - 3, signBlockY + 30);
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Signature & Date Stamp', 17, signBlockY + 34);

  // 2. Gate Security Officer
  const block2X = 14 + blockWidth + 4;
  doc.rect(block2X, signBlockY, blockWidth, 38);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('2. Gate Security Verification', block2X + 3, signBlockY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Vehicle Plate Verified: [  ]`, block2X + 3, signBlockY + 13);
  doc.text(`Seal / Carton Count Verified: [  ]`, block2X + 3, signBlockY + 18);
  doc.line(block2X + 3, signBlockY + 30, block2X + blockWidth - 3, signBlockY + 30);
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Security Gate Pass Stamp & Time', block2X + 3, signBlockY + 34);

  // 3. Customer / Driver Receiver
  const block3X = block2X + blockWidth + 4;
  doc.rect(block3X, signBlockY, blockWidth, 38);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('3. Customer / Driver Receiver', block3X + 3, signBlockY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Received By: ${data.recipientName}`, block3X + 3, signBlockY + 13);
  doc.text(`Phone: ${data.recipientPhone || '—'}`, block3X + 3, signBlockY + 18);
  doc.line(block3X + 3, signBlockY + 30, block3X + blockWidth - 3, signBlockY + 30);
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Receiver Acknowledgment Signature', block3X + 3, signBlockY + 34);

  // ── Footer ──
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Two Brothers Food Complex P.L.C © 2026 — Factory Gate Pass — Original (Customer Copy)', 14, pageHeight - 8);
  doc.text('Page 1 of 1', pageWidth - 25, pageHeight - 8);

  const filename = `Waybill_${data.orderNumber}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
  doc.save(filename);
}
