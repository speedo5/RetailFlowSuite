import * as XLSX from 'xlsx';
import { Sale, Commission, User } from '@/types';
import { format } from 'date-fns';

// Define regions
export const REGIONS = ['Nairobi', 'Central', 'Coast', 'Western', 'Rift Valley', 'Eastern', 'Nyanza', 'North Eastern'];

// Company info for headers
const COMPANY_INFO = {
  name: 'MARTIS FINETECH MEDIA',
  address: 'P.O Box 1996 - 00101, Nairobi',
  phone: '0740488618',
  pin: 'A015773214N',
};

interface ReportData {
  date: string;
  foName: string;
  phoneModel: string;
  imei: string;
  qty: number;
  sellingPrice: number;
  commission: number;
  paymentMode: string;
}

interface RegionReportData {
  region: string;
  data: ReportData[];
  totalUnits: number;
  totalRevenue: number;
  totalCommission: number;
}

// Format date for display
const formatDate = (date: Date): string => {
  return format(date, 'dd/MM/yyyy');
};

// Generate report data for a specific region
const generateRegionReportData = (
  sales: Sale[],
  commissions: Commission[],
  users: User[],
  region: string,
  startDate: Date,
  endDate: Date
): RegionReportData => {
  // Filter sales by region and date range
  // Normalize region matching (case-insensitive) and include sales that have a direct `region` field
  const regionNormalized = (region || '').toString().toLowerCase().trim();
  const regionUsers = users.filter(u => (u.region || '').toString().toLowerCase().trim() === regionNormalized);
  // Normalize user ids to strings for safe comparison with sale IDs
  const regionUserIds = regionUsers.map(u => String(u.id));
  console.log(`🔍 generateRegionReportData for region "${region}":`, { 
    regionUsersCount: regionUsers.length, 
    regionUserIds,
    totalSalesCount: sales.length,
    dateRange: `${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`
  });
  
  const regionSales = sales.filter(sale => {
    const saleDate = new Date(sale.createdAt);
    const isInDateRange = saleDate >= startDate && saleDate <= endDate;

    // Robust extraction of sale region
    const getSaleRegion = (s: any) => {
      if (!s) return '';
      if (typeof s.region === 'string') return s.region;
      if (s.region && typeof s.region === 'object') {
        // common shapes: { name: 'Nairobi' } or { region: 'Nairobi' }
        return s.region.name || s.region.region || '';
      }
      return s.regionName || s.createdByRegion || '';
    };

    const saleRegion = (getSaleRegion(sale) || '').toString().toLowerCase().trim();

    const saleRegionalManagerId = sale.regionalManagerId ? String(sale.regionalManagerId) : '';
    const saleFoId = sale.foId ? String(sale.foId) : '';
    const saleCreatedBy = sale.createdBy ? String(sale.createdBy) : '';
    const saleAssignedRm = sale.assignedRmId ? String(sale.assignedRmId) : '';
    const saleAssignedTl = sale.assignedTlId ? String(sale.assignedTlId) : '';
    const saleAssignedFo = sale.assignedFoId ? String(sale.assignedFoId) : '';

    // If sale was assigned to a region/manager via assignedRmId/assignedTlId/assignedFoId, prefer that mapping
    const isAssignedToRegion =
      (saleAssignedRm && regionUserIds.includes(saleAssignedRm)) ||
      (saleAssignedTl && regionUserIds.includes(saleAssignedTl)) ||
      (saleAssignedFo && regionUserIds.includes(saleAssignedFo));

    const isRegionSale =
      // Direct region field on sale (case-insensitive)
      (saleRegion && saleRegion === regionNormalized) ||
      // Assigned mapping takes precedence
      isAssignedToRegion ||
      // Regional manager / FO based matching (compare normalized string IDs)
      (saleRegionalManagerId && regionUserIds.includes(saleRegionalManagerId)) ||
      (saleFoId && regionUserIds.includes(saleFoId)) ||
      // Creator user belongs to region
      (saleCreatedBy && regionUserIds.includes(saleCreatedBy)) ||
      // Some APIs may include creator region on the sale
      ((sale.createdByRegion || '').toString().toLowerCase().trim() === regionNormalized);

    return isInDateRange && isRegionSale;
  });
  console.log(`✅ Region "${region}" filtered sales:`, regionSales.length);

  const reportData: ReportData[] = regionSales.map(sale => {
    // Get commission for this sale (FO commission)
    const saleCommissions = commissions.filter(c => c.saleId === sale.id);
    const totalCommission = saleCommissions.reduce((sum, c) => sum + c.amount, 0);
    
    // Get seller name — try soldBy first, then foId, then createdBy (Admin/RM/TL/FO who made the sale)
    let sellerName = sale.sellerName || 'N/A';
    
    // If sellerName is still not available, find the user from the database
    if (!sellerName || sellerName === 'N/A') {
      const sellerId = sale.soldBy || sale.foId || sale.createdBy;
      const sellerUser = users.find(u => u.id === sellerId);
      sellerName = sellerUser?.name || sale.foName || sale.sellerName || 'Unknown';
    }
    
    return {
      date: formatDate(new Date(sale.createdAt)),
      foName: sellerName,
      phoneModel: sale.productName,
      imei: sale.imei || 'N/A',
      qty: sale.quantity,
      sellingPrice: sale.saleAmount,
      commission: totalCommission,
      paymentMode: sale.paymentMethod === 'mpesa' ? 'M-PESA' : 'Cash',
    };
  });

  const totalUnits = reportData.reduce((sum, r) => sum + r.qty, 0);
  const totalRevenue = reportData.reduce((sum, r) => sum + r.sellingPrice, 0);
  const totalCommission = reportData.reduce((sum, r) => sum + r.commission, 0);

  return {
    region,
    data: reportData,
    totalUnits,
    totalRevenue,
    totalCommission,
  };
};

// Create worksheet for a region
const createRegionSheet = (
  regionData: RegionReportData,
  startDate: Date,
  endDate: Date
): XLSX.WorkSheet => {
  const ws = XLSX.utils.aoa_to_sheet([]);
  
  // Row counter
  let rowIndex = 0;

  // Company header
  XLSX.utils.sheet_add_aoa(ws, [[COMPANY_INFO.name]], { origin: { r: rowIndex, c: 0 } });
  rowIndex++;
  
  XLSX.utils.sheet_add_aoa(ws, [['WEEKLY SALES & STOCK REPORT']], { origin: { r: rowIndex, c: 0 } });
  rowIndex++;
  
  const periodStr = `Period: ${format(startDate, 'do MMMM yyyy')} – ${format(endDate, 'do MMMM yyyy')}`;
  XLSX.utils.sheet_add_aoa(ws, [[periodStr]], { origin: { r: rowIndex, c: 0 } });
  rowIndex++;
  
  XLSX.utils.sheet_add_aoa(ws, [[`Region: ${regionData.region.toUpperCase()}`]], { origin: { r: rowIndex, c: 0 } });
  rowIndex++;
  
  // Empty row
  rowIndex++;
  
  // Table headers
  const headers = ['Date', 'FO Name', 'Phone Model', 'IMEI', 'Qty', 'Selling Price', 'Commission', 'Payment Mode'];
  XLSX.utils.sheet_add_aoa(ws, [headers], { origin: { r: rowIndex, c: 0 } });
  rowIndex++;
  
  // Data rows
  regionData.data.forEach(row => {
    XLSX.utils.sheet_add_aoa(ws, [[
      row.date,
      row.foName,
      row.phoneModel,
      row.imei,
      row.qty,
      row.sellingPrice,
      row.commission,
      row.paymentMode,
    ]], { origin: { r: rowIndex, c: 0 } });
    rowIndex++;
  });
  
  // Empty row
  rowIndex++;
  
  // Totals section
  XLSX.utils.sheet_add_aoa(ws, [[`Total Units Sold: ${regionData.totalUnits}`]], { origin: { r: rowIndex, c: 0 } });
  rowIndex++;
  
  XLSX.utils.sheet_add_aoa(ws, [[`Total Revenue: KES ${regionData.totalRevenue.toLocaleString()}`]], { origin: { r: rowIndex, c: 0 } });
  rowIndex++;
  
  XLSX.utils.sheet_add_aoa(ws, [[`Total Commission: KES ${regionData.totalCommission.toLocaleString()}`]], { origin: { r: rowIndex, c: 0 } });
  
  // Set column widths
  ws['!cols'] = [
    { wch: 12 },  // Date
    { wch: 20 },  // FO Name
    { wch: 25 },  // Phone Model
    { wch: 18 },  // IMEI
    { wch: 5 },   // Qty
    { wch: 15 },  // Selling Price
    { wch: 12 },  // Commission
    { wch: 15 },  // Payment Mode
  ];
  
  return ws;
};

// Create worksheet for products/inventory
const createInventorySheet = (
  products: any[],
  imeis: any[]
): XLSX.WorkSheet => {
  const ws = XLSX.utils.aoa_to_sheet([]);
  
  // Row counter
  let rowIndex = 0;

  // Company header
  XLSX.utils.sheet_add_aoa(ws, [[COMPANY_INFO.name]], { origin: { r: rowIndex, c: 0 } });
  rowIndex++;
  
  XLSX.utils.sheet_add_aoa(ws, [['INVENTORY & STOCK REPORT']], { origin: { r: rowIndex, c: 0 } });
  rowIndex++;
  
  XLSX.utils.sheet_add_aoa(ws, [[`Generated: ${format(new Date(), 'do MMMM yyyy HH:mm')}`]], { origin: { r: rowIndex, c: 0 } });
  rowIndex++;
  
  // Empty row
  rowIndex++;
  
  // Phones section
  XLSX.utils.sheet_add_aoa(ws, [['PHONES INVENTORY']], { origin: { r: rowIndex, c: 0 } });
  rowIndex++;
  
  const phoneHeaders = ['Product Name', 'Category', 'Stock Quantity', 'Unit Price', 'Available IMEIs', 'Total Value'];
  XLSX.utils.sheet_add_aoa(ws, [phoneHeaders], { origin: { r: rowIndex, c: 0 } });
  rowIndex++;
  
  // Filter products by category and add data
  // Normalize category checks to be case-insensitive and accept plural forms
  const isPhoneCategory = (c: any) => {
    if (!c) return true; // treat undefined as phone by previous behavior
    const v = String(c).toLowerCase();
    return v.includes('phone');
  };
  const isAccessoryCategory = (c: any) => {
    if (!c) return false;
    const v = String(c).toLowerCase();
    return v.includes('accessor');
  };

  const phones = products.filter((p: any) => isPhoneCategory(p.category));
  phones.forEach((phone: any) => {
    const availableImeis = imeis.filter((i: any) => i.productId === phone.id && String(i.status || '').toUpperCase() === 'IN_STOCK').length;
    // If IMEIs exist for this product prefer IMEI count as the authoritative stock units
    const units = availableImeis > 0 ? availableImeis : (Number(phone.stockQuantity || 0));
    const unitPrice = Number(phone.unitPrice || 0);
    const totalValue = units * unitPrice;

    XLSX.utils.sheet_add_aoa(ws, [[
      phone.name,
      phone.category || 'Phone',
      units,
      unitPrice,
      availableImeis,
      totalValue,
    ]], { origin: { r: rowIndex, c: 0 } });
    rowIndex++;
  });
  
  // Empty row
  rowIndex++;
  
  // Accessories section
  XLSX.utils.sheet_add_aoa(ws, [['ACCESSORIES INVENTORY']], { origin: { r: rowIndex, c: 0 } });
  rowIndex++;
  
  const accessoryHeaders = ['Product Name', 'Category', 'Stock Quantity', 'Unit Price', 'Total Value'];
  XLSX.utils.sheet_add_aoa(ws, [accessoryHeaders], { origin: { r: rowIndex, c: 0 } });
  rowIndex++;
  
  const accessories = products.filter((p: any) => isAccessoryCategory(p.category));
  accessories.forEach((accessory: any) => {
    const totalValue = (accessory.stockQuantity || 0) * (accessory.unitPrice || 0);
    
    XLSX.utils.sheet_add_aoa(ws, [[
      accessory.name,
      accessory.category || 'Accessory',
      accessory.stockQuantity || 0,
      accessory.unitPrice || 0,
      totalValue,
    ]], { origin: { r: rowIndex, c: 0 } });
    rowIndex++;
  });
  
  // Empty row
  rowIndex++;
  
  // Summary section
  XLSX.utils.sheet_add_aoa(ws, [['INVENTORY SUMMARY']], { origin: { r: rowIndex, c: 0 } });
  rowIndex++;
  
  // Compute totals. For phones prefer IMEI counts where available to avoid double-counting.
  const totalImeiInStock = imeis.filter((i: any) => String(i.status || '').toUpperCase() === 'IN_STOCK').length;
  const totalPhoneStock = phones.reduce((sum: number, p: any) => {
    const imeiCount = imeis.filter((i: any) => i.productId === p.id && String(i.status || '').toUpperCase() === 'IN_STOCK').length;
    return sum + (imeiCount > 0 ? imeiCount : (Number(p.stockQuantity || 0)));
  }, 0);
  const totalAccessoryStock = accessories.reduce((sum: number, a: any) => sum + (Number(a.stockQuantity || 0)), 0);

  const totalPhoneValue = phones.reduce((sum: number, p: any) => {
    const imeiCount = imeis.filter((i: any) => i.productId === p.id && String(i.status || '').toUpperCase() === 'IN_STOCK').length;
    const units = imeiCount > 0 ? imeiCount : (Number(p.stockQuantity || 0));
    return sum + units * (Number(p.unitPrice || 0));
  }, 0);
  const totalAccessoryValue = accessories.reduce((sum: number, a: any) => sum + (Number(a.stockQuantity || 0) * Number(a.unitPrice || 0)), 0);
  
  XLSX.utils.sheet_add_aoa(ws, [['Total Phone Units', totalPhoneStock]], { origin: { r: rowIndex, c: 0 } });
  rowIndex++;
  XLSX.utils.sheet_add_aoa(ws, [['Total Phone Value', `KES ${totalPhoneValue.toLocaleString()}`]], { origin: { r: rowIndex, c: 0 } });
  rowIndex++;
  XLSX.utils.sheet_add_aoa(ws, [['Total Accessory Units', totalAccessoryStock]], { origin: { r: rowIndex, c: 0 } });
  rowIndex++;
  XLSX.utils.sheet_add_aoa(ws, [['Total Accessory Value', `KES ${totalAccessoryValue.toLocaleString()}`]], { origin: { r: rowIndex, c: 0 } });
  rowIndex++;
  XLSX.utils.sheet_add_aoa(ws, [['Total IMEI in Stock', totalImeiInStock]], { origin: { r: rowIndex, c: 0 } });
  
  // Set column widths
  ws['!cols'] = [
    { wch: 25 },  // Product Name
    { wch: 15 },  // Category
    { wch: 15 },  // Stock Quantity
    { wch: 12 },  // Unit Price
    { wch: 15 },  // Available IMEIs / Total Value
    { wch: 15 },  // Total Value
  ];
  
  return ws;
};

// Export sales report to Excel with multiple sheets (one per region)
export const exportSalesReportToExcel = (
  sales: Sale[],
  commissions: Commission[],
  users: User[],
  startDate: Date,
  endDate: Date,
  selectedRegions: string[], // Empty array means all regions
  products: any[] = [],
  imeis: any[] = []
): void => {
  console.log('📊 exportSalesReportToExcel called with:', { 
    salesCount: sales.length, 
    commissionsCount: commissions.length,
    usersCount: users.length,
    productsCount: products.length,
    imeisCount: imeis.length,
    selectedRegions,
    startDate: format(startDate, 'yyyy-MM-dd'),
    endDate: format(endDate, 'yyyy-MM-dd')
  });
  
  const wb = XLSX.utils.book_new();
  
  const regionsToExport = selectedRegions.length > 0 ? selectedRegions : REGIONS;
  console.log('🌍 Regions to export:', regionsToExport);
  
  regionsToExport.forEach(region => {
    const regionData = generateRegionReportData(sales, commissions, users, region, startDate, endDate);
    console.log(`📋 Region "${region}" data rows:`, regionData.data.length);
    
    // Only add sheet if there's data
    if (regionData.data.length > 0) {
      const ws = createRegionSheet(regionData, startDate, endDate);
      // Sheet name max 31 chars
      const sheetName = region.substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
  });
  
  // Add inventory sheet if products data is provided
  if (products.length > 0 || imeis.length > 0) {
    console.log('📦 Adding inventory sheet to workbook');
    const inventoryWs = createInventorySheet(products, imeis);
    XLSX.utils.book_append_sheet(wb, inventoryWs, 'Inventory');
  }
  
  // If no sheets were added, add an empty summary sheet
  if (wb.SheetNames.length === 0) {
    console.warn('⚠️ No sales data found - creating empty sheet');
    const ws = XLSX.utils.aoa_to_sheet([
      [COMPANY_INFO.name],
      ['WEEKLY SALES & STOCK REPORT'],
      [`Period: ${format(startDate, 'do MMMM yyyy')} – ${format(endDate, 'do MMMM yyyy')}`],
      [''],
      ['No sales data found for the selected period and regions.'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'No Data');
  }
  
  // Generate filename
  const dateRangeStr = `${format(startDate, 'd')}-${format(endDate, 'd_MMM_yyyy')}`;
  const regionStr = selectedRegions.length === 1 ? selectedRegions[0] : 'AllRegions';
  const filename = `Sales_Report_${regionStr}_${dateRangeStr}.xlsx`;
  console.log('✅ Creating Excel file:', filename);
  
// Download the file using proper binary output
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Export single region report (for Regional Managers)
export const exportSingleRegionReport = (
  sales: Sale[],
  commissions: Commission[],
  users: User[],
  region: string,
  startDate: Date,
  endDate: Date,
  products: any[] = [],
  imeis: any[] = []
): void => {
  exportSalesReportToExcel(sales, commissions, users, startDate, endDate, [region], products, imeis);
};

// Print report (opens print dialog)
export const printReport = (
  sales: Sale[],
  commissions: Commission[],
  users: User[],
  startDate: Date,
  endDate: Date,
  selectedRegions: string[]
): void => {
  console.log('🖨️ printReport called with:', { 
    salesCount: sales.length, 
    commissionsCount: commissions.length,
    usersCount: users.length,
    selectedRegions
  });
  
  const regionsToProcess = selectedRegions.length > 0 ? selectedRegions : REGIONS;
  console.log('🌍 Regions to print:', regionsToProcess);
  
  // Create printable HTML
  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Sales Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .page-break { page-break-after: always; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 18px; }
        .header p { margin: 5px 0; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
        th, td { border: 1px solid #000; padding: 5px; text-align: left; }
        th { background-color: #f0f0f0; font-weight: bold; }
        .totals { margin-top: 10px; font-weight: bold; }
        .totals p { margin: 5px 0; }
        @media print {
          .page-break { page-break-after: always; }
        }
      </style>
    </head>
    <body>
  `;
  
  regionsToProcess.forEach((region, index) => {
    const regionData = generateRegionReportData(sales, commissions, users, region, startDate, endDate);
    console.log(`📋 Region "${region}" print data rows:`, regionData.data.length);
    
    if (regionData.data.length > 0) {
      htmlContent += `
        <div class="${index < regionsToProcess.length - 1 ? 'page-break' : ''}">
          <div class="header">
            <h1>${COMPANY_INFO.name}</h1>
            <p>WEEKLY SALES & STOCK REPORT</p>
            <p>Period: ${format(startDate, 'do MMMM yyyy')} – ${format(endDate, 'do MMMM yyyy')}</p>
            <p>Region: ${region.toUpperCase()}</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>FO Name</th>
                <th>Phone Model</th>
                <th>IMEI</th>
                <th>Qty</th>
                <th>Selling Price</th>
                <th>Commission</th>
                <th>Payment Mode</th>
              </tr>
            </thead>
            <tbody>
              ${regionData.data.map(row => `
                <tr>
                  <td>${row.date}</td>
                  <td>${row.foName}</td>
                  <td>${row.phoneModel}</td>
                  <td>${row.imei}</td>
                  <td>${row.qty}</td>
                  <td>KES ${row.sellingPrice.toLocaleString()}</td>
                  <td>KES ${row.commission.toLocaleString()}</td>
                  <td>${row.paymentMode}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="totals">
            <p>Total Units Sold: ${regionData.totalUnits}</p>
            <p>Total Revenue: KES ${regionData.totalRevenue.toLocaleString()}</p>
            <p>Total Commission: KES ${regionData.totalCommission.toLocaleString()}</p>
          </div>
        </div>
      `;
    }
  });
  
  htmlContent += '</body></html>';
  
  // Open print window
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    // Wait for the new window to finish loading before invoking print
    printWindow.onload = () => {
      try {
        printWindow.print();
      } catch (err) {
        console.error('Print failed:', err);
      }
    };
    // Optionally close the print window after printing (browser may block closing)
    try {
      printWindow.onafterprint = () => {
        try { printWindow.close(); } catch (e) { /* ignore */ }
      };
    } catch (e) {
      // some browsers don't support onafterprint on popup windows
    }
  }
};

/**
 * Generate comprehensive Excel report with one sheet per region
 * Called from Reports.tsx with API data from /api/reports/comprehensive
 */
export const exportComprehensiveReportToExcel = (
  apiData: any,
  startDate: Date,
  endDate: Date
): void => {
  try {
    const workbook = XLSX.utils.book_new();

    // Create Summary Sheet
    const summarySheetData = [
      [COMPANY_INFO.name],
      ['COMPREHENSIVE PERFORMANCE REPORT'],
      [`Period: ${format(startDate, 'do MMMM yyyy')} – ${format(endDate, 'do MMMM yyyy')}`],
      [`Generated: ${format(new Date(), 'do MMMM yyyy HH:mm')}`],
      [''],
      ['OVERALL SUMMARY'],
      ['Total Revenue', `Ksh ${apiData.summary?.totalRevenue?.toLocaleString() || 0}`],
      ['Total Sales', apiData.summary?.totalSales || 0],
      ['Total Commissions Paid', `Ksh ${apiData.summary?.totalCommissions?.toLocaleString() || 0}`],
      ['Average Sale Value', `Ksh ${Math.round(apiData.summary?.avgSale || 0).toLocaleString()}`],
      ['Number of Regions', apiData.summary?.regionsCount || 0],
      [''],
      ['REGIONS PERFORMANCE'],
      ['Region', 'Total Sales', 'Total Revenue', 'Total Commissions', 'Avg Sale Value'],
    ];

    // Add data for each region
    if (apiData.regionReports && Array.isArray(apiData.regionReports)) {
      apiData.regionReports.forEach((region: any) => {
        summarySheetData.push([
          region.region,
          region.summary?.totalSales || 0,
          `Ksh ${region.summary?.totalRevenue?.toLocaleString() || 0}`,
          `Ksh ${region.summary?.totalCommissions?.toLocaleString() || 0}`,
          `Ksh ${Math.round(region.summary?.avgSale || 0).toLocaleString()}`,
        ]);
      });
    }

    const summarySheet = XLSX.utils.aoa_to_sheet(summarySheetData);
    summarySheet['!cols'] = [
      { wch: 20 },
      { wch: 15 },
      { wch: 18 },
      { wch: 20 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Create a detailed sheet for each region
    if (apiData.regionReports && Array.isArray(apiData.regionReports)) {
      apiData.regionReports.forEach((region: any) => {
        const regionSheetData = [];

        // Header
        regionSheetData.push([COMPANY_INFO.name]);
        regionSheetData.push([`${region.region.toUpperCase()} REGION - SALES REPORT`]);
        regionSheetData.push([`Period: ${format(startDate, 'do MMMM yyyy')} – ${format(endDate, 'do MMMM yyyy')}`]);
        regionSheetData.push(['']);

        // Region Summary
        regionSheetData.push(['REGION SUMMARY']);
        regionSheetData.push(['Total Sales', region.summary?.totalSales || 0]);
        regionSheetData.push(['Total Revenue', `Ksh ${region.summary?.totalRevenue?.toLocaleString() || 0}`]);
        regionSheetData.push(['Total Commissions', `Ksh ${region.summary?.totalCommissions?.toLocaleString() || 0}`]);
        regionSheetData.push(['Average Sale Value', `Ksh ${Math.round(region.summary?.avgSale || 0).toLocaleString()}`]);
        regionSheetData.push(['']);

        // Detailed Sales Data
        regionSheetData.push(['DETAILED SALES TRANSACTIONS']);
        regionSheetData.push([
          'Date',
          'FO Name',
          'FO Code',
          'Phone Model',
          'IMEI',
          'Qty',
          'Selling Price',
          'Commission',
          'Payment Mode',
        ]);

        if (region.detailedSales && Array.isArray(region.detailedSales)) {
          region.detailedSales.forEach((sale: any) => {
            regionSheetData.push([
              sale.date,
              sale.foName,
              sale.foCode,
              sale.phoneModel,
              sale.imei,
              sale.qty,
              `Ksh ${sale.sellingPrice.toLocaleString()}`,
              `Ksh ${sale.commission.toLocaleString()}`,
              sale.paymentMode,
            ]);
          });
        }

        regionSheetData.push(['']);

        // Top Products
        regionSheetData.push(['TOP PRODUCTS']);
        regionSheetData.push(['Product Name', 'Revenue']);

        if (region.topProducts && Array.isArray(region.topProducts)) {
          region.topProducts.forEach((product: any) => {
            regionSheetData.push([
              product.name,
              `Ksh ${product.value.toLocaleString()}`,
            ]);
          });
        }

        regionSheetData.push(['']);

        // FO Performance
        regionSheetData.push(['FIELD OFFICER PERFORMANCE']);
        regionSheetData.push(['FO Name', 'FO Code', 'Sales Revenue', 'Commissions Earned']);

        if (region.foData && Array.isArray(region.foData)) {
          region.foData.forEach((fo: any) => {
            regionSheetData.push([
              fo.name,
              fo.foCode,
              `Ksh ${fo.sales.toLocaleString()}`,
              `Ksh ${fo.commissions.toLocaleString()}`,
            ]);
          });
        }

        // Create worksheet
        const regionSheet = XLSX.utils.aoa_to_sheet(regionSheetData);
        regionSheet['!cols'] = [
          { wch: 12 },
          { wch: 20 },
          { wch: 10 },
          { wch: 25 },
          { wch: 18 },
          { wch: 5 },
          { wch: 15 },
          { wch: 12 },
          { wch: 15 },
        ];

        // Sheet name - max 31 characters
        const sheetName = region.region.substring(0, 31);
        XLSX.utils.book_append_sheet(workbook, regionSheet, sheetName);
      });
    }

    // Generate Excel file
    const dateRangeStr = `${format(startDate, 'd')}-${format(endDate, 'd_MMM_yyyy')}`;
    const filename = `Comprehensive_Report_${dateRangeStr}.xlsx`;
    XLSX.writeFile(workbook, filename);
  } catch (error) {
    console.error('Failed to generate comprehensive Excel report:', error);
    throw error;
  }
};

/**
 * Generate comprehensive Excel report with one sheet per region
 * Called from Reports.tsx with API data
 */
export const generateRegionalExcelReport = async (
  reportData: any,
  startDate: Date,
  endDate: Date
): Promise<void> => {
  try {
    const workbook = XLSX.utils.book_new();
    
    // Create summary sheet
    const summaryData = [
      ['MARTIS FINETECH MEDIA - COMPREHENSIVE PERFORMANCE REPORT'],
      [''],
      ['Report Period', `${formatDate(startDate)} to ${formatDate(endDate)}`],
      ['Generated', formatDate(new Date())],
      [''],
      ['SUMMARY METRICS'],
      ['Total Sales', reportData.overview?.totalSales || 0],
      ['Total Revenue', `KES ${(reportData.overview?.totalRevenue || 0).toLocaleString()}`],
      ['Average Sale Value', `KES ${Math.round(reportData.overview?.avgSaleValue || 0).toLocaleString()}`],
      [''],
      ['REGIONAL BREAKDOWN'],
    ];

    // Add regional data to summary
    (reportData.byRegion || []).forEach((region: any) => {
      summaryData.push([
        region._id || 'Unknown',
        region.totalRevenue,
        region.salesCount,
        region.foCount || 0
      ]);
    });

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Create sheet for each region
    (reportData.byRegion || []).forEach((region: any) => {
      const regionName = region._id || 'Unknown';
      const regionSheetData = [
        [`${regionName.toUpperCase()} REGION - PERFORMANCE REPORT`],
        [`Report Period: ${formatDate(startDate)} to ${formatDate(endDate)}`],
        [''],
        ['Performance Metrics'],
        ['Total Sales', region.salesCount || 0],
        ['Total Revenue', `KES ${(region.totalRevenue || 0).toLocaleString()}`],
        ['Average Sale Value', `KES ${Math.round((region.totalRevenue || 0) / (region.salesCount || 1)).toLocaleString()}`],
        ['Active FOs', region.foCount || 0],
        [''],
        ['TOP PRODUCTS'],
        ['Product', 'Units Sold', 'Revenue'],
      ];

      // Add top products for region
      (reportData.byProduct || []).slice(0, 5).forEach((product: any) => {
        regionSheetData.push([
          product.productName || 'Unknown',
          product.unitsSold || 0,
          `KES ${(product.totalRevenue || 0).toLocaleString()}`
        ]);
      });

      regionSheetData.push(['']);
      regionSheetData.push(['FIELD OFFICER PERFORMANCE']);
      regionSheetData.push(['FO Name', 'Sales Count', 'Revenue', 'Commissions']);

      // Add FO data
      (reportData.byFO || []).forEach((fo: any) => {
        regionSheetData.push([
          fo.foName || fo.foCode || 'Unknown',
          fo.salesCount || 0,
          `KES ${(fo.totalRevenue || 0).toLocaleString()}`,
          `KES ${(fo.commissions?.total || 0).toLocaleString()}`
        ]);
      });

      regionSheetData.push(['']);
      regionSheetData.push(['PAYMENT METHOD BREAKDOWN']);
      regionSheetData.push(['Method', 'Count', 'Total']);

      // Add payment methods
      (reportData.paymentMethods || []).forEach((payment: any) => {
        regionSheetData.push([
          payment._id || 'Unknown',
          payment.count || 0,
          `KES ${(payment.total || 0).toLocaleString()}`
        ]);
      });

      const regionSheet = XLSX.utils.aoa_to_sheet(regionSheetData);
      
      // Set column widths
      regionSheet['!cols'] = [
        { wch: 25 },
        { wch: 15 },
        { wch: 18 },
        { wch: 18 }
      ];

      XLSX.utils.book_append_sheet(workbook, regionSheet, regionName.substring(0, 31));
    });

    // Generate Excel file
    const filename = `Performance-Report-${formatDate(startDate)}-to-${formatDate(endDate)}.xlsx`;
    XLSX.writeFile(workbook, filename);
  } catch (error) {
    console.error('Failed to generate regional report:', error);
    throw error;
  }
};

// General Excel export function
export function exportToExcel<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns: { key: keyof T; header: string }[]
): void {
  const headers = columns.map(c => c.header);
  const rows = data.map(item =>
    columns.map(c => {
      const value = item[c.key];
      if (value && typeof value === 'object' && 'getTime' in value) {
        return new Date(value as Date).toLocaleDateString();
      }
      return value ?? '';
    })
  );

  const worksheetData = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
