import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { DashboardFilters } from './dashboard-types';
import { DashboardData } from './dashboard-queries';
import { format } from 'date-fns';

export async function exportDashboardToPDF(
  data: DashboardData,
  filters: DashboardFilters,
  userName: string,
  userRole: string
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const dateStr = format(new Date(), 'dd MMM yyyy, HH:mm');
  const roleDisplay = userRole.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const periodDisplay = (filters.dateRange || 'Period').replace(/_/g, ' ').toUpperCase();

  // ── 1. CORPORATE HEADER BANNER ──
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 32, 'F');

  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 32, pageWidth, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('TWO BROTHERS FOOD COMPLEX P.L.C', 14, 12);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`2BF Factory ERP — ${roleDisplay} Operations Report`, 14, 18);
  doc.text('CONFIDENTIAL OPERATIONAL DISCLOSURE', 14, 24);

  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240);
  doc.text(`Generated: ${dateStr}`, pageWidth - 14, 12, { align: 'right' });
  doc.text(`User: ${userName} (${roleDisplay})`, pageWidth - 14, 18, { align: 'right' });
  doc.text(`Period Scope: ${periodDisplay}`, pageWidth - 14, 24, { align: 'right' });

  let currentY = 42;

  // ── 2. EXECUTIVE METRIC TILES ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Key Operational Highlights', 14, currentY);

  currentY += 4;
  const cardWidth = (pageWidth - 28 - 9) / 4;
  const cardHeight = 17;

  const kpis = [
    {
      label: 'SALES REVENUE',
      value: data.salesValue > 0 ? `ETB ${(data.salesValue / 1000).toFixed(1)}k` : 'ETB 0',
      sub: `${data.totalOrders} Orders Booked`,
      color: [16, 185, 129],
    },
    {
      label: 'CASH COLLECTIONS',
      value: data.paidAmount > 0 ? `ETB ${(data.paidAmount / 1000).toFixed(1)}k` : 'ETB 0',
      sub: 'Reconciled Inflow',
      color: [37, 99, 235],
    },
    {
      label: 'OUTSTANDING AR',
      value: data.outstandingAmount > 0 ? `ETB ${(data.outstandingAmount / 1000).toFixed(1)}k` : 'ETB 0',
      sub: 'Customer Debt',
      color: [225, 29, 72],
    },
    {
      label: 'FACTORY OUTPUT',
      value: `${data.totalProduced.toLocaleString()} u`,
      sub: `${data.totalDispatched.toLocaleString()} Dispatched`,
      color: [99, 102, 241],
    },
  ];

  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * (cardWidth + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

    doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.roundedRect(x, currentY, 1.5, cardHeight, 1, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + 3.5, currentY + 5);

    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(kpi.value, x + 3.5, currentY + 10.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.sub, x + 3.5, currentY + 14.5);
  });

  currentY += cardHeight + 8;

  // ── 3. PRODUCT PERFORMANCE TABLE ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Finished Goods & Product Line Throughput', 14, currentY);

  const tableColumn = [
    'Product Description',
    'Produced',
    'Available Stock',
    'Allocated',
    'Dispatched',
    'Delivered',
    'Returned',
    'Total Volume',
  ];

  const tableRows = data.productPerformance.map(p => {
    const total = p.produced + p.inStock + p.allocated + p.dispatched + p.delivered + p.returned;
    return [
      p.productName,
      p.produced.toLocaleString(),
      p.inStock.toLocaleString(),
      p.allocated.toLocaleString(),
      p.dispatched.toLocaleString(),
      p.delivered.toLocaleString(),
      p.returned.toLocaleString(),
      total.toLocaleString(),
    ];
  });

  // Totals row
  const totals = data.productPerformance.reduce(
    (acc, p) => ({
      produced: acc.produced + p.produced,
      inStock: acc.inStock + p.inStock,
      allocated: acc.allocated + p.allocated,
      dispatched: acc.dispatched + p.dispatched,
      delivered: acc.delivered + p.delivered,
      returned: acc.returned + p.returned,
    }),
    { produced: 0, inStock: 0, allocated: 0, dispatched: 0, delivered: 0, returned: 0 }
  );

  const overallTotal = totals.produced + totals.inStock + totals.allocated + totals.dispatched + totals.delivered + totals.returned;

  tableRows.push([
    'TOTAL',
    totals.produced.toLocaleString(),
    totals.inStock.toLocaleString(),
    totals.allocated.toLocaleString(),
    totals.dispatched.toLocaleString(),
    totals.delivered.toLocaleString(),
    totals.returned.toLocaleString(),
    overallTotal.toLocaleString(),
  ]);

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: currentY + 3,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2.5,
      font: 'helvetica',
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 46 },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center' },
      6: { halign: 'center' },
      7: { halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    willDrawCell: (hookData: any) => {
      if (hookData.row.index === tableRows.length - 1) {
        doc.setFont('helvetica', 'bold');
        hookData.cell.styles.fillColor = [241, 245, 249];
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // ── 4. WAREHOUSE OVERVIEW TABLE ──
  if (data.warehouseOverview && data.warehouseOverview.length > 0) {
    if (currentY > pageHeight - 45) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Warehouse Network Facility Distribution', 14, currentY);

    const whColumns = ['Warehouse Facility', 'Stock On Hand (units)', 'Received (units)', 'Dispatched (units)', 'Status'];
    const whRows = data.warehouseOverview.map(w => [
      w.warehouseName,
      w.availableStock.toLocaleString(),
      w.receivedToday.toLocaleString(),
      w.dispatchedToday.toLocaleString(),
      w.status.toUpperCase(),
    ]);

    autoTable(doc, {
      head: [whColumns],
      body: whRows,
      startY: currentY + 3,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        font: 'helvetica',
        textColor: [30, 41, 59],
      },
      headStyles: {
        fillColor: [16, 185, 129],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
        1: { halign: 'center', fontStyle: 'bold' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center', fontStyle: 'bold' },
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
  }

  // ── 5. RUNNING FOOTER ──
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'Two Brothers Food Complex P.L.C. © 2026 — 2BF Factory ERP — Confidential Internal Report',
      14,
      pageHeight - 7
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
  }

  const safeDate = format(new Date(), 'yyyy-MM-dd');
  doc.save(`2BF-Report-${roleDisplay.replace(/\s+/g, '')}-${safeDate}.pdf`);
}

export async function exportDashboardToExcel(
  data: DashboardData,
  filters: DashboardFilters,
  userName: string,
  userRole: string
) {
  const wb = XLSX.utils.book_new();
  const dateStr = format(new Date(), 'PPP p');
  const roleDisplay = userRole.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  // ── Sheet 1: Executive Operations Summary ──
  const summaryData: any[][] = [
    ['TWO BROTHERS FOOD COMPLEX P.L.C.'],
    ['2BF FACTORY ERP — OPERATIONS REPORT'],
    [],
    ['Report Date', dateStr],
    ['Generated By', `${userName} (${roleDisplay})`],
    ['Period Scope', (filters.dateRange || 'Period').toUpperCase()],
    [],
    ['OPERATIONAL & FINANCIAL SUMMARY'],
    ['Booked Sales Revenue (ETB)', data.salesValue],
    ['Cash Collections Reconciled (ETB)', data.paidAmount],
    ['Total Accounts Receivable (ETB)', data.outstandingAmount],
    ['Total Finished Goods Produced (units)', data.totalProduced],
    ['Current Stock Available (units)', data.totalInStock],
    ['Total Cartons Dispatched (units)', data.totalDispatched],
    ['Total Cartons Delivered (units)', data.totalDelivered],
    ['Customer Orders Count', data.totalOrders],
    ['Orders Pending Fulfillment', data.pendingOrders],
    ['Total Registered Customers', data.totalCustomers],
    ['Total Returned Units', data.totalReturned],
  ];

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  summaryWs['!cols'] = [{ wch: 36 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  // ── Sheet 2: Product Performance ──
  const productHeader = ['Product Type', 'Produced (units)', 'Available (units)', 'Allocated (units)', 'Dispatched (units)', 'Delivered (units)', 'Returned (units)', 'Total Activity (units)'];
  const productRows = data.productPerformance.map(p => {
    const total = p.produced + p.inStock + p.allocated + p.dispatched + p.delivered + p.returned;
    return [p.productName, p.produced, p.inStock, p.allocated, p.dispatched, p.delivered, p.returned, total];
  });

  const totals = data.productPerformance.reduce(
    (acc, p) => ({
      produced: acc.produced + p.produced,
      inStock: acc.inStock + p.inStock,
      allocated: acc.allocated + p.allocated,
      dispatched: acc.dispatched + p.dispatched,
      delivered: acc.delivered + p.delivered,
      returned: acc.returned + p.returned,
    }),
    { produced: 0, inStock: 0, allocated: 0, dispatched: 0, delivered: 0, returned: 0 }
  );
  const overallTotal = totals.produced + totals.inStock + totals.allocated + totals.dispatched + totals.delivered + totals.returned;
  productRows.push(['TOTAL', totals.produced, totals.inStock, totals.allocated, totals.dispatched, totals.delivered, totals.returned, overallTotal]);

  const productWs = XLSX.utils.aoa_to_sheet([productHeader, ...productRows]);
  productWs['!cols'] = [{ wch: 35 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, productWs, 'Products');

  // ── Sheet 3: Warehouse Overview ──
  if (data.warehouseOverview && data.warehouseOverview.length > 0) {
    const whHeader = ['Warehouse', 'Available Quantity (units)', 'Received Quantity (units)', 'Dispatched Quantity (units)', 'Status'];
    const whRows = data.warehouseOverview.map(w => [w.warehouseName, w.availableStock, w.receivedToday, w.dispatchedToday, w.status]);
    const whWs = XLSX.utils.aoa_to_sheet([whHeader, ...whRows]);
    whWs['!cols'] = [{ wch: 30 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, whWs, 'Warehouses');
  }

  const safeDate = format(new Date(), 'yyyy-MM-dd');
  XLSX.writeFile(wb, `2BF-Report-${roleDisplay.replace(/\s+/g, '')}-${safeDate}.xlsx`);
}
