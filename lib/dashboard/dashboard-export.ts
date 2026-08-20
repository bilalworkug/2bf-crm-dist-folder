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
  // Try-catch handled in header component to show toast
  const doc = new jsPDF();
  const dateStr = format(new Date(), 'PPP p');
  const roleDisplay = userRole.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  // ── Header ──
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Two Brothers Food Complex P.L.C', 14, 20);
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50);
  doc.text('2BF Factory ERP — Dashboard Report', 14, 28);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${dateStr}`, 14, 38);
  doc.text(`By: ${userName} (${roleDisplay})`, 14, 44);
  doc.text(`Period: ${filters.dateRange.charAt(0).toUpperCase() + filters.dateRange.slice(1)}`, 14, 50);

  // ── Executive Summary ──
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', 14, 65);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60);
  
  const summary = [];
  if (data.totalProduced > 0) summary.push(['Total Produced', data.totalProduced.toLocaleString()]);
  if (data.totalInStock > 0) summary.push(['Available Stock', data.totalInStock.toLocaleString()]);
  if (data.totalDispatched > 0) summary.push(['Total Dispatched', data.totalDispatched.toLocaleString()]);
  if (data.totalDelivered > 0) summary.push(['Total Delivered', data.totalDelivered.toLocaleString()]);
  if (data.totalOrders > 0) summary.push(['Total Orders', data.totalOrders.toLocaleString()]);
  if (data.pendingOrders > 0) summary.push(['Pending Orders', data.pendingOrders.toLocaleString()]);
  if (data.totalCustomers > 0) summary.push(['Total Customers', data.totalCustomers.toLocaleString()]);
  if (data.totalReturned > 0) summary.push(['Total Returned', data.totalReturned.toLocaleString()]);

  // If no summary metrics show up, just put a generic row
  if (summary.length === 0) {
    summary.push(['Status', 'No significant activity found for this period.']);
  }

  let y = 73;
  for (const [label, value] of summary) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`${value}`, 50, y);
    y += 6;
  }

  // ── Product Performance Table ──
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text('Product Performance', 14, y + 10);

  const tableColumn = ['Product', 'Produced', 'Available', 'Allocated', 'Dispatched', 'Delivered', 'Returned', 'Total'];
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
      total.toLocaleString()
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
      returned: acc.returned + p.returned 
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
    overallTotal.toLocaleString()
  ]);

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: y + 15,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [241, 245, 249] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    willDrawCell: (data: any) => {
      if (data.row.index === tableRows.length - 1) {
        doc.setFont('helvetica', 'bold');
      }
    }
  });

  // ── Warehouse Overview ──
  if (data.warehouseOverview && data.warehouseOverview.length > 0) {
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Warehouse Overview', 14, finalY);

    const whColumns = ['Warehouse', 'Available Stock', 'Received Today', 'Dispatched Today', 'Status'];
    const whRows = data.warehouseOverview.map(w => [
      w.warehouseName,
      w.availableStock.toLocaleString(),
      w.receivedToday.toLocaleString(),
      w.dispatchedToday.toLocaleString(),
      w.status.charAt(0).toUpperCase() + w.status.slice(1)
    ]);
    
    autoTable(doc, {
      head: [whColumns],
      body: whRows,
      startY: finalY + 5,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
  }

  // ── Footer ──
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.setFont('helvetica', 'normal');
    doc.text('Two Brothers Food Complex P.L.C © 2026 — 2BF Factory ERP — Confidential', 14, doc.internal.pageSize.height - 10);
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 10);
  }

  const safeDate = format(new Date(), 'yyyy-MM-dd');
  doc.save(`2BF-Dashboard-${roleDisplay.replace(/\s+/g, '')}-${safeDate}.pdf`);
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

  // ── Sheet 1: Executive Summary ──
  const summaryData: any[][] = [
    ['Two Brothers Food Complex P.L.C'],
    ['2BF Factory ERP — Dashboard Report'],
    [],
    ['Generated', dateStr],
    ['By', `${userName} (${roleDisplay})`],
    ['Period', filters.dateRange.charAt(0).toUpperCase() + filters.dateRange.slice(1)],
    [],
    ['EXECUTIVE SUMMARY'],
  ];
  
  if (data.totalProduced > 0) summaryData.push(['Total Produced', data.totalProduced]);
  if (data.totalInStock > 0) summaryData.push(['Available Stock', data.totalInStock]);
  if (data.totalDispatched > 0) summaryData.push(['Total Dispatched', data.totalDispatched]);
  if (data.totalDelivered > 0) summaryData.push(['Total Delivered', data.totalDelivered]);
  if (data.totalOrders > 0) summaryData.push(['Total Orders', data.totalOrders]);
  if (data.pendingOrders > 0) summaryData.push(['Pending Orders', data.pendingOrders]);
  if (data.totalCustomers > 0) summaryData.push(['Total Customers', data.totalCustomers]);
  if (data.totalReturned > 0) summaryData.push(['Total Returned', data.totalReturned]);

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  summaryWs['!cols'] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Executive Summary');

  // ── Sheet 2: Product Performance ──
  const productHeader = ['Product', 'Produced', 'Available', 'Allocated', 'Dispatched', 'Delivered', 'Returned', 'Total Activity'];
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
      returned: acc.returned + p.returned 
    }),
    { produced: 0, inStock: 0, allocated: 0, dispatched: 0, delivered: 0, returned: 0 }
  );
  const overallTotal = totals.produced + totals.inStock + totals.allocated + totals.dispatched + totals.delivered + totals.returned;
  productRows.push(['TOTAL', totals.produced, totals.inStock, totals.allocated, totals.dispatched, totals.delivered, totals.returned, overallTotal]);

  const productWs = XLSX.utils.aoa_to_sheet([productHeader, ...productRows]);
  productWs['!cols'] = [{ wch: 35 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, productWs, 'Product Performance');

  // ── Sheet 3: Warehouse Overview ──
  if (data.warehouseOverview && data.warehouseOverview.length > 0) {
    const whHeader = ['Warehouse', 'Available Stock', 'Received Today', 'Dispatched Today', 'Status'];
    const whRows = data.warehouseOverview.map(w => [w.warehouseName, w.availableStock, w.receivedToday, w.dispatchedToday, w.status]);
    const whWs = XLSX.utils.aoa_to_sheet([whHeader, ...whRows]);
    whWs['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, whWs, 'Warehouse Overview');
  }

  const safeDate = format(new Date(), 'yyyy-MM-dd');
  XLSX.writeFile(wb, `2BF-Dashboard-${roleDisplay.replace(/\s+/g, '')}-${safeDate}.xlsx`);
}
