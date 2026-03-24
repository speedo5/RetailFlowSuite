import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale, Commission, Product, IMEI } from '@/types';
import { format } from 'date-fns';

// Receipt counter starting at 3000 (as per requirements)
let receiptCounter = 3000;

export function getNextReceiptNumber(): number {
  return receiptCounter++;
}

export function generateReceiptNumber(salesCount: number): string {
  return `RCP-${String(3000 + salesCount).padStart(6, '0')}`;
}

export function generateSaleReceipt(sale: Sale, sellerName?: string): void {
  const doc = new jsPDF({
    unit: 'mm',
    format: [80, 200], // Receipt paper width, adjusted height
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 4;
  let y = 6;

  // Colors
  const navy = [0, 51, 102] as [number, number, number];

  // Helper for centered text
  const centerText = (text: string, yPos: number, fontSize: number = 10, color: number[] = [0, 0, 0]) => {
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(text, pageWidth / 2, yPos, { align: 'center' });
  };

  // Normalize receipt number to 3000-series
  const normalizeReceipt = (raw?: string) => {
    if (!raw) return `RCP-${String(3000).padStart(6, '0')}`;
    const s = String(raw);
    const match = s.match(/(\d+)/);
    if (!match) return s;
    let num = parseInt(match[1], 10);
    if (num < 3000) num = num + 1000;
    return `RCP-${String(num).padStart(6, '0')}`;
  };

  // ===== RECEIPT BADGE =====
  doc.setFillColor(navy[0], navy[1], navy[2]);
  doc.roundedRect(pageWidth / 2 - 20, y, 40, 6, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  const receiptNo = normalizeReceipt(sale.etrReceiptNo || sale.receiptNumber);
  doc.text(`RECEIPT ${receiptNo}`, pageWidth / 2, y + 4.2, { align: 'center' });
  y += 10;

  // ===== COMPANY NAME =====
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  centerText('MARTIS FINETECH MEDIA', y, 11);
  y += 6;

  // ===== COMPANY DETAILS (two columns) =====
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text('P.O Box 1996 - 00101, Nairobi', margin, y);
  doc.text('Cell: 0740488618', pageWidth - margin, y, { align: 'right' });
  y += 6;

  // ===== SEPARATOR LINE =====
  doc.setDrawColor(navy[0], navy[1], navy[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // ===== PIN & DATE ROW =====
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Pin A015773214N`, margin, y);
  doc.text(`Date ${format(new Date(sale.createdAt), 'dd/MM/yyyy HH:mm:ss')}`, pageWidth - margin, y, { align: 'right' });
  y += 5;

  // ===== CLIENT SECTION HEADER =====
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.text('CLIENT DETAILS', margin, y);
  y += 4;

  // ===== CLIENT INFO =====
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  const clientName = sale.clientName || 'N/A';
  const clientPhone = sale.clientPhone || 'N/A';
  doc.text(`Name: ${clientName}`, margin, y);
  y += 4;
  doc.text(`Phone: ${clientPhone}`, margin, y);
  y += 4;
  if (sale.clientIdNumber) {
    doc.text(`ID/No: ${sale.clientIdNumber}`, margin, y);
    y += 4;
  }
  y += 2;

  // ===== SEPARATOR LINE =====
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 2;

  // ===== TABLE HEADER (4 columns: Qty, Description, @, Ksh Cts) =====
  const tableStartY = y;
  doc.setFillColor(navy[0], navy[1], navy[2]);
  doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  
  // 4 column layout with wider spacing for description
  const col1 = margin + 2;       // Qty (narrow)
  const col2 = margin + 10;      // Description (wider)
  const col3 = pageWidth - margin - 16;  // @ (moved slightly right)
  const col4 = pageWidth - margin - 2;   // Ksh Cts
  
  doc.text('Qty', col1, y + 5);
  doc.text('Description', col2, y + 5);
  doc.text('@', col3, y + 5);
  doc.text('Ksh Cts', col4, y + 5, { align: 'right' });
  y += 9;

  // ===== TABLE ROWS - PRODUCT =====
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  // Price formatting - combine Ksh and Cts
  const priceKsh = Math.floor(sale.saleAmount || 0);
  const priceStr = `${priceKsh.toLocaleString()}.00`;
  
  // Row 1: Quantity and Price
  const rowHeight = 10;
  doc.setFontSize(9);
  doc.text(String(sale.quantity || 1), col1, y + 5);
  doc.text(String(sale.productName || 'Product'), col2, y + 5);
  doc.text(priceStr, pageWidth - margin - 2, y + 5, { align: 'right' });
  y += rowHeight;

  // Row 2: IMEI (indented under description)
  if (sale.imei) {
    doc.setFontSize(8);
    doc.text(`IMEI: ${String(sale.imei)}`, col2, y + 4);
    y += rowHeight;
  }

  // Row 3: Capacity (if available)
  const capacity = (sale as any).capacity || (sale as any).imeiCapacity;
  if (capacity) {
    doc.setFontSize(8);
    doc.text(`Capacity: ${String(capacity)}`, col2, y + 4);
    y += rowHeight;
  }

  // Row 4: Unit price indicator
  doc.setFontSize(8);
  doc.text(`@ ${priceStr}`, col2, y + 4);
  y += rowHeight;

  // Draw table grid
  const tableEndY = y;
  const tableHeight = tableEndY - tableStartY;
  
  doc.setDrawColor(navy[0], navy[1], navy[2]);
  doc.setLineWidth(0.3);
  
  // Outer border
  doc.rect(margin, tableStartY, pageWidth - margin * 2, tableHeight);
  
  // Vertical lines (3 dividers for 4 columns)
  doc.line(margin + 8, tableStartY + 7, margin + 8, tableEndY);  // After Qty
  doc.line(col3 - 2, tableStartY + 7, col3 - 2, tableEndY);  // Before @

  y += 4;

  // ===== SEPARATOR LINE =====
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // E.&.O.E and Receipt No
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text('E.&.O.E', margin, y);
  
  // Receipt number in red
  doc.setTextColor(255, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(`No. ${receiptNo}`, margin + 14, y);
  y += 6;

  // ===== DISCLAIMER =====
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  centerText('Goods once sold cannot be returned.', y, 7);
  y += 5;

  // ===== SELLER/FO DETAILS (Hidden from main section) =====
  const foName = String(sellerName || sale.foName || sale.sellerName || 'Admin');
  const foCode = String((sale as any).foCode || '');
  const source = String((sale as any).source || '');
  
  // Show only FO Code and Source if available (no "Seller:" label)
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  
  if (foCode && foCode !== '') {
    centerText(`FO Code: ${foCode}`, y, 7, [50, 50, 50]);
    y += 3.5;
  }
  
  if (source && source !== '') {
    centerText(`Source: ${source.toUpperCase()}`, y, 7, [50, 50, 50]);
    y += 3.5;
  }
  
  y += 2;

  // ===== SOLD BY FOOTER =====
  doc.setFontSize(6);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(150, 150, 150);
  centerText(`Sold by: ${foName}`, y, 6);

  // Save
  const receiptFileName = `Receipt-${receiptNo}.pdf`;
  doc.save(receiptFileName);
}

export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns: { key: keyof T; header: string }[]
): void {
  const headers = columns.map(c => c.header).join(',');
  const rows = data.map(item =>
    columns.map(c => {
      const value = item[c.key];
      if (value && typeof value === 'object' && 'getTime' in value) {
        return new Date(value as Date).toLocaleDateString();
      }
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      return value ?? '';
    }).join(',')
  );

  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCommissions(commissions: Commission[]): void {
  // Transform commissions to include all necessary fields with proper formatting
  const transformedData = commissions.map(c => ({
    ...c,
    // Ensure field names are properly set
    userName: c.userName || c.foName || 'N/A',
    role: c.role || 'field_officer',
    productName: c.productName || 'N/A',
    imei: c.imei || 'N/A',
    saleId: c.saleId || 'N/A',
    amount: c.amount || 0,
    status: c.status || 'pending',
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
  }));

  exportToCSV(transformedData, 'commissions-report', [
    { key: 'userName', header: 'Recipient Name' },
    { key: 'role', header: 'Role' },
    { key: 'productName', header: 'Product' },
    { key: 'saleId', header: 'Sale ID' },
    { key: 'imei', header: 'IMEI' },
    { key: 'amount', header: 'Amount (Ksh)' },
    { key: 'status', header: 'Status' },
    { key: 'createdAt', header: 'Date' },
  ]);
}

export function exportProducts(products: Product[]): void {
  exportToCSV(products, 'products-catalog', [
    { key: 'name', header: 'Product Name' },
    { key: 'category', header: 'Category' },
    { key: 'price', header: 'Price (Ksh)' },
    { key: 'stockQuantity', header: 'Stock' },
    { key: 'createdAt', header: 'Added Date' },
  ]);
}

export function exportInventory(imeis: IMEI[]): void {
  exportToCSV(imeis, 'inventory-report', [
    { key: 'productName', header: 'Model' },
    { key: 'imei', header: 'IMEI' },
    { key: 'capacity', header: 'Capacity' },
    { key: 'sellingPrice', header: 'Price (Ksh)' },
    { key: 'commission', header: 'Commission (Ksh)' },
    { key: 'status', header: 'Status' },
    { key: 'registeredAt', header: 'Registered' },
  ]);
}

export function exportSales(sales: Sale[]): void {
  exportToCSV(sales, 'sales-report', [
    { key: 'etrReceiptNo', header: 'Receipt No' },
    { key: 'productName', header: 'Product' },
    { key: 'imei', header: 'IMEI' },
    { key: 'quantity', header: 'Qty' },
    { key: 'saleAmount', header: 'Amount (Ksh)' },
    { key: 'paymentMethod', header: 'Payment' },
    { key: 'paymentReference', header: 'Reference' },
    { key: 'clientName', header: 'Client Name' },
    { key: 'clientPhone', header: 'Client Phone' },
    { key: 'sellerName', header: 'Sold By' },
    { key: 'foCode', header: 'FO Code' },
    { key: 'createdAt', header: 'Date' },
  ]);
}
