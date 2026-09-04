import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { CompleteExecutiveData } from './executive-types';

export async function exportExecutiveToPDF(
  data: CompleteExecutiveData,
  userName: string,
  userRole: string = 'Admin'
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const dateStr = format(new Date(), 'dd MMM yyyy, HH:mm');
  const safeDate = format(new Date(), 'yyyy-MM-dd');
  const reportRef = `2BF-EXEC-${Date.now().toString(36).toUpperCase()}`;
  const periodLabel = data.filters.datePreset.replace(/_/g, ' ').toUpperCase();

  // Helper function to draw corporate header
  const drawCorporateHeader = (pageNumber: number, totalPages: number) => {
    // Navy Background Header Box
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 35, 'F');

    // Emerald Brand Accent Line
    doc.setFillColor(16, 185, 129); // emerald-500
    doc.rect(0, 35, pageWidth, 1.8, 'F');

    // Corporate Monogram Emblem
    doc.setFillColor(30, 41, 59); // slate-800
    doc.roundedRect(14, 7, 18, 18, 2.5, 2.5, 'F');
    doc.setFillColor(16, 185, 129); // emerald accent
    doc.roundedRect(14, 7, 2, 18, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('2BF', 23, 18.5, { align: 'center' });

    // Company & Report Titles
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(255, 255, 255);
    doc.text('TWO BROTHERS FOOD COMPLEX P.L.C.', 37, 13);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('Factory ERP & Executive Intelligence Center • C-Suite Management Briefing', 37, 19);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(234, 179, 8); // amber-400
    doc.text('STRICTLY CONFIDENTIAL — BOARD & EXECUTIVE AUDIT ONLY', 37, 26);

    // Top Right Metadata
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225); // slate-300
    doc.text(`Generated: ${dateStr}`, pageWidth - 14, 12, { align: 'right' });
    doc.text(`Audited By: ${userName} (${userRole})`, pageWidth - 14, 18, { align: 'right' });
    doc.text(`Scope: ${periodLabel}`, pageWidth - 14, 24, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(148, 163, 184);
    doc.text(`DOC REF: ${reportRef}`, pageWidth - 14, 30, { align: 'right' });
  };

  // Helper function to draw running footer
  const drawCorporateFooter = (pageNumber: number, totalPages: number) => {
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'Two Brothers Food Complex P.L.C. © 2026 — Factory ERP Executive Intelligence Center — Internal Commercial Disclosure',
      14,
      pageHeight - 7
    );
    doc.setFont('helvetica', 'bold');
    doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
  };

  // ═════════════════════════════════════════════════════════════
  // PAGE 1: EXECUTIVE BRIEFING, KPIS, HIGHLIGHTS & AR EXPOSURE
  // ═════════════════════════════════════════════════════════════
  drawCorporateHeader(1, 2);

  let currentY = 44;

  // Section 1 Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Core Commercial & Financial Position', 14, currentY);

  currentY += 4;
  const cardWidth = (pageWidth - 28 - 9) / 4;
  const cardHeight = 18;

  const coreKpis = [
    {
      label: 'BOOKED SALES REVENUE',
      value: `ETB ${(data.finances.totalRevenue / 1000).toFixed(1)}k`,
      sub: `${data.customers.reduce((s, c) => s + c.totalOrders, 0)} Orders Booked`,
      color: [16, 185, 129], // emerald
    },
    {
      label: 'CASH INFLOWS RECONCILED',
      value: `ETB ${(data.finances.totalCollections / 1000).toFixed(1)}k`,
      sub: `${data.finances.collectionRatePct}% Collection Ratio`,
      color: [37, 99, 235], // blue
    },
    {
      label: 'TOTAL RECEIVABLES (AR)',
      value: `ETB ${(data.finances.outstandingBalance / 1000).toFixed(1)}k`,
      sub: `${data.finances.creditUtilizationPct}% Limit Utilized`,
      color: [225, 29, 72], // rose
    },
    {
      label: 'FINISHED GOODS OUTPUT',
      value: `${data.production.producedThisMonth.toLocaleString()} u`,
      sub: `Peak Hour: ${data.production.peakHour}`,
      color: [99, 102, 241], // indigo
    },
  ];

  coreKpis.forEach((kpi, idx) => {
    const x = 14 + idx * (cardWidth + 3);
    // Background card
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

    // Colored accent strip
    doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.roundedRect(x, currentY, 1.8, cardHeight, 1, 1, 'F');

    // Card Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + 4, currentY + 5);

    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(kpi.value, x + 4, currentY + 11.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.sub, x + 4, currentY + 15.5);
  });

  currentY += cardHeight + 8;

  // Section 2: Executive Snapshots Highlights (4 Cards)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Period Snapshot Highlights', 14, currentY);

  currentY += 4;
  const snapWidth = (pageWidth - 28 - 9) / 4;
  const snapHeight = 16;

  data.snapshots.slice(0, 4).forEach((snap, idx) => {
    const x = 14 + idx * (snapWidth + 3);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, currentY, snapWidth, snapHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(snap.title.toUpperCase(), x + 3.5, currentY + 4.5);

    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    const truncName = snap.name.length > 20 ? snap.name.slice(0, 20) + '...' : snap.name;
    doc.text(truncName, x + 3.5, currentY + 9.5);

    doc.setFontSize(8);
    doc.setTextColor(37, 99, 235);
    doc.text(snap.metric, x + 3.5, currentY + 13.5);
  });

  currentY += snapHeight + 8;

  // Section 3: Strategic Recommendations
  if (data.recommendations.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('3. Strategic Recommendations & Operational Watchpoints', 14, currentY);

    currentY += 4;
    data.recommendations.slice(0, 3).forEach((r) => {
      doc.setFillColor(254, 252, 232); // soft amber
      doc.setDrawColor(254, 240, 138);
      doc.roundedRect(14, currentY, pageWidth - 28, 8.5, 1, 1, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(180, 83, 9); // amber-700
      doc.text(`[${r.priority.toUpperCase()}] ${r.title}:`, 17, currentY + 5.5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      const msg = r.message.length > 95 ? r.message.slice(0, 95) + '...' : r.message;
      doc.text(msg, 62, currentY + 5.5);

      doc.setFont('helvetica', 'bold');
      doc.text(r.metric, pageWidth - 17, currentY + 5.5, { align: 'right' });

      currentY += 10;
    });
    currentY += 2;
  }

  // Section 4: Accounts Receivable (AR) Aging & Exposure
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('4. Accounts Receivable (AR) Aging & Credit Exposure', 14, currentY);

  const arColumns = ['Current Terms', '1–30 Days Overdue', '31–60 Days Overdue', '61–90 Days Overdue', '90+ Days Critical', 'Total Outstanding'];
  const arRows = [
    [
      `ETB ${data.finances.arAging.current.toLocaleString()}`,
      `ETB ${data.finances.arAging.days1To30.toLocaleString()}`,
      `ETB ${data.finances.arAging.days31To60.toLocaleString()}`,
      `ETB ${data.finances.arAging.days61To90.toLocaleString()}`,
      `ETB ${data.finances.arAging.days90Plus.toLocaleString()}`,
      `ETB ${data.finances.arAging.totalReceivables.toLocaleString()}`,
    ],
  ];

  autoTable(doc, {
    head: [arColumns],
    body: arRows,
    startY: currentY + 3,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 3,
      font: 'helvetica',
      textColor: [30, 41, 59],
      halign: 'center',
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { textColor: [16, 185, 129], fontStyle: 'bold' },
      4: { textColor: [225, 29, 72], fontStyle: 'bold' },
      5: { fontStyle: 'bold', textColor: [15, 23, 42] },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 7;

  // Commercial Split Bar on Page 1
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Commercial Split Ratio:', 14, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Immediate / Cash Sales: ${data.finances.cashVsCreditRatio.cashPct}% (ETB ${data.finances.cashSalesAmount.toLocaleString()})  |  Credit Terms: ${data.finances.cashVsCreditRatio.creditPct}% (ETB ${data.finances.creditSalesAmount.toLocaleString()})`,
    50,
    currentY
  );

  drawCorporateFooter(1, 2);

  // ═════════════════════════════════════════════════════════════
  // PAGE 2: CUSTOMER COMMERCIAL LEDGER & PRODUCT VELOCITY
  // ═════════════════════════════════════════════════════════════
  doc.addPage();
  drawCorporateHeader(2, 2);
  currentY = 44;

  // Section 5: Customer Commercial Intelligence
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('5. Customer Accounts & Commercial Performance', 14, currentY);

  const customerColumns = [
    'Customer Account',
    'Location',
    'Revenue (ETB)',
    'Orders',
    'AOV (ETB)',
    'Outstanding',
    'Credit %',
    'Behavior Rating',
  ];

  const customerRows = data.customers.slice(0, 10).map((c) => [
    c.name,
    c.city || 'Addis Ababa',
    c.totalRevenue.toLocaleString(),
    c.totalOrders.toString(),
    c.averageOrderValue.toLocaleString(),
    c.outstandingBalance > 0 ? `ETB ${c.outstandingBalance.toLocaleString()}` : 'ETB 0',
    `${c.creditUtilizationPct}%`,
    c.paymentBehavior,
  ]);

  autoTable(doc, {
    head: [customerColumns],
    body: customerRows,
    startY: currentY + 3,
    theme: 'grid',
    styles: {
      fontSize: 7.2,
      cellPadding: 2.2,
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
      0: { fontStyle: 'bold', cellWidth: 42 },
      1: { cellWidth: 26 },
      2: { halign: 'right', fontStyle: 'bold' },
      3: { halign: 'center' },
      4: { halign: 'right' },
      5: { halign: 'right', textColor: [225, 29, 72] },
      6: { halign: 'center' },
      7: { halign: 'center', fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Section 6: Product Commercial Velocity & Inventory Health
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('6. Finished Goods SKU Commercial Velocity & Stock Runway', 14, currentY);

  const productColumns = [
    'SKU Code',
    'Product Description',
    'Produced',
    'Units Sold',
    'Revenue (ETB)',
    'Current Stock',
    'Daily Velocity',
    'Stock Status',
  ];

  const productRows = data.products.slice(0, 10).map((p) => [
    p.sku,
    p.name,
    p.unitsProduced.toLocaleString(),
    p.unitsSold.toLocaleString(),
    p.revenue.toLocaleString(),
    p.currentStock.toLocaleString(),
    `${p.stockVelocity} u/day`,
    p.stockStatus,
  ]);

  autoTable(doc, {
    head: [productColumns],
    body: productRows,
    startY: currentY + 3,
    theme: 'grid',
    styles: {
      fontSize: 7.2,
      cellPadding: 2.2,
      font: 'helvetica',
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [16, 185, 129], // emerald
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 24 },
      1: { fontStyle: 'bold', cellWidth: 46 },
      2: { halign: 'center' },
      3: { halign: 'center', fontStyle: 'bold' },
      4: { halign: 'right', fontStyle: 'bold' },
      5: { halign: 'center' },
      6: { halign: 'center' },
      7: { halign: 'center', fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Section 7: Warehouse Network Facilities
  if (data.warehouses.length > 0 && currentY < pageHeight - 35) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('7. Warehouse Network Facility Storage Distribution', 14, currentY);

    const whColumns = ['Facility', 'Code', 'Location', 'Stock (units)', 'Capacity (units)', 'Util %', 'Dock Ops'];
    const whRows = data.warehouses.map((w) => [
      w.name,
      w.code,
      w.location,
      w.totalStockUnits.toLocaleString(),
      w.capacityUnits.toLocaleString(),
      `${w.utilizationPct}%`,
      w.activityCount.toString(),
    ]);

    autoTable(doc, {
      head: [whColumns],
      body: whRows,
      startY: currentY + 3,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 2,
        font: 'helvetica',
        textColor: [30, 41, 59],
      },
      headStyles: {
        fillColor: [71, 85, 105], // slate-600
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { fontStyle: 'bold' },
        3: { halign: 'center', fontStyle: 'bold' },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'center' },
      },
    });
  }

  drawCorporateFooter(2, 2);

  doc.save(`2BF-Executive-Briefing-${periodLabel}-${safeDate}.pdf`);
}

// ─────────────────────────────────────────────────────────────
// EXCEL PRO WORKBOOK GENERATOR (MULTI-TABBED)
// ─────────────────────────────────────────────────────────────
export async function exportExecutiveToExcel(
  data: CompleteExecutiveData,
  userName: string,
  userRole: string = 'Admin'
) {
  const wb = XLSX.utils.book_new();
  const dateStr = format(new Date(), 'PPP p');
  const safeDate = format(new Date(), 'yyyy-MM-dd');
  const periodLabel = data.filters.datePreset.replace(/_/g, ' ').toUpperCase();

  // ── Tab 1: Executive KPI Overview ──
  const overviewRows = [
    ['TWO BROTHERS FOOD COMPLEX P.L.C.'],
    ['2BF FACTORY ERP — EXECUTIVE INTELLIGENCE PRO WORKBOOK'],
    [],
    ['Report Date', dateStr],
    ['Generated By', `${userName} (${userRole})`],
    ['Active Period Scope', periodLabel],
    [],
    ['EXECUTIVE SUMMARY METRICS'],
    ['Booked Sales Revenue (ETB)', data.finances.totalRevenue],
    ['Cash Collections Reconciled (ETB)', data.finances.totalCollections],
    ['Collection Ratio (%)', data.finances.collectionRatePct],
    ['Total Accounts Receivable (ETB)', data.finances.outstandingBalance],
    ['Active Credit Exposure (ETB)', data.finances.creditExposure],
    ['Approved Credit Limit (ETB)', data.finances.totalCreditLimit],
    ['Credit Limit Utilization (%)', data.finances.creditUtilizationPct],
    ['Total Finished Goods Produced (units)', data.production.producedThisMonth],
    ['Factory Peak Output Hour', data.production.peakHour],
    [],
    ['ACCOUNTS RECEIVABLE AGING'],
    ['Current Terms', data.finances.arAging.current],
    ['1–30 Days Overdue', data.finances.arAging.days1To30],
    ['31–60 Days Overdue', data.finances.arAging.days31To60],
    ['61–90 Days Overdue', data.finances.arAging.days61To90],
    ['90+ Days Critical', data.finances.arAging.days90Plus],
    ['Total Outstanding Balance', data.finances.arAging.totalReceivables],
  ];

  const wsOverview = XLSX.utils.aoa_to_sheet(overviewRows);
  wsOverview['!cols'] = [{ wch: 36 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsOverview, 'Executive Overview');

  // ── Tab 2: Customer Commercial Intelligence ──
  const customerHeaders = [
    'Customer Name',
    'Location',
    'Phone',
    'Booked Revenue (ETB)',
    'Orders Count',
    'Average Order Value (ETB)',
    'First Purchase Date',
    'Last Purchase Date',
    'Days Since Last Order',
    'Outstanding Balance (ETB)',
    'Credit Limit (ETB)',
    'Credit Utilization (%)',
    'Payment Rating',
    'Favorite Product',
  ];

  const customerRows = data.customers.map((c) => [
    c.name,
    c.city || 'Addis Ababa',
    c.phone || 'N/A',
    c.totalRevenue,
    c.totalOrders,
    c.averageOrderValue,
    c.firstPurchaseDate || 'N/A',
    c.lastPurchaseDate || 'N/A',
    c.daysSinceLastPurchase >= 999 ? 'N/A' : c.daysSinceLastPurchase,
    c.outstandingBalance,
    c.creditLimit,
    c.creditUtilizationPct,
    c.paymentBehavior,
    c.favoriteProductName || 'N/A',
  ]);

  const wsCustomers = XLSX.utils.aoa_to_sheet([customerHeaders, ...customerRows]);
  wsCustomers['!cols'] = [
    { wch: 30 },
    { wch: 18 },
    { wch: 16 },
    { wch: 22 },
    { wch: 14 },
    { wch: 24 },
    { wch: 18 },
    { wch: 18 },
    { wch: 22 },
    { wch: 24 },
    { wch: 20 },
    { wch: 20 },
    { wch: 18 },
    { wch: 25 },
  ];
  XLSX.utils.book_append_sheet(wb, wsCustomers, 'Customer Intelligence');

  // ── Tab 3: Product Commercial Velocity ──
  const productHeaders = [
    'SKU',
    'Product Name',
    'Category',
    'Unit Price (ETB)',
    'Revenue Generated (ETB)',
    'Units Produced',
    'Units Sold',
    'Current Stock',
    'Velocity (Units/Day)',
    'Days Inventory Runway',
    'Return Rate (%)',
    'Stock Status',
  ];

  const productRows = data.products.map((p) => [
    p.sku,
    p.name,
    p.category,
    p.price,
    p.revenue,
    p.unitsProduced,
    p.unitsSold,
    p.currentStock,
    p.stockVelocity,
    p.daysOfInventoryLeft >= 999 ? 'No Demand' : p.daysOfInventoryLeft,
    p.returnRatePct,
    p.stockStatus,
  ]);

  const wsProducts = XLSX.utils.aoa_to_sheet([productHeaders, ...productRows]);
  wsProducts['!cols'] = [
    { wch: 16 },
    { wch: 32 },
    { wch: 16 },
    { wch: 18 },
    { wch: 24 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 },
    { wch: 20 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, wsProducts, 'Product Velocity');

  // ── Tab 4: Warehouse Facilities ──
  const whHeaders = [
    'Facility Name',
    'Facility Code',
    'Location',
    'Finished Goods Units',
    'Capacity (Units)',
    'Capacity Utilized (%)',
    'Dock Movements',
    'Receipts Count',
    'Dispatches Count',
    'Low Stock SKUs',
  ];

  const whRows = data.warehouses.map((w) => [
    w.name,
    w.code,
    w.location,
    w.totalStockUnits,
    w.capacityUnits,
    w.utilizationPct,
    w.activityCount,
    w.receiptsCount,
    w.dispatchesCount,
    w.lowStockItemsCount,
  ]);

  const wsWarehouses = XLSX.utils.aoa_to_sheet([whHeaders, ...whRows]);
  wsWarehouses['!cols'] = [
    { wch: 26 },
    { wch: 16 },
    { wch: 18 },
    { wch: 22 },
    { wch: 18 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, wsWarehouses, 'Warehouse Network');

  // ── Tab 5: Sales Trends ──
  const trendHeaders = ['Time Period', 'Revenue (ETB)', 'Orders Count', 'Average Order Value (ETB)', 'New Customers', 'Repeat Customers'];
  const trendRows = data.salesTrends.map((t) => [
    t.periodLabel,
    t.revenue,
    t.ordersCount,
    t.averageOrderValue,
    t.newCustomersCount,
    t.repeatCustomersCount,
  ]);

  const wsTrends = XLSX.utils.aoa_to_sheet([trendHeaders, ...trendRows]);
  wsTrends['!cols'] = [{ wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 26 }, { wch: 16 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsTrends, 'Sales Trends');

  XLSX.writeFile(wb, `2BF-Executive-Workbook-${periodLabel}-${safeDate}.xlsx`);
}
