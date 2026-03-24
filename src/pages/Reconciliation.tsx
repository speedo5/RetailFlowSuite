import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  FileBarChart, CheckCircle, AlertTriangle, Download, Calendar,
  Building2, TrendingUp, DollarSign, Package, AlertCircle, RefreshCw, Loader
} from 'lucide-react';
import { PhoneSource } from '@/types';
import { salesService } from '@/services/salesService';
import { imeiService } from '@/services/imeiService';
import { commissionService } from '@/services/commissionService';
import { exportToCSV } from '@/lib/pdfGenerator';

type DiscrepancyType = 'imei_mismatch' | 'missing_payment' | 'double_sale' | 'missing_receipt';

interface Discrepancy {
  id: string;
  type: DiscrepancyType;
  severity: 'high' | 'medium' | 'low';
  description: string;
  relatedId?: string;
  source?: PhoneSource;
}

export default function Reconciliation() {
  const { sales, setSales, imeis, setImeis, commissions, setCommissions, currentUser } = useApp();
  const [selectedSource, setSelectedSource] = useState<'all' | PhoneSource>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [serverTotalCount, setServerTotalCount] = useState<number | null>(null);
  const [serverTotalAmount, setServerTotalAmount] = useState<number | null>(null);
  const [serverImeisSoldCount, setServerImeisSoldCount] = useState<number | null>(null);
  const [serverImeisInStockCount, setServerImeisInStockCount] = useState<number | null>(null);

  // Get manager's region if they are a regional manager
  const managerRegion = currentUser?.role === 'regional_manager' ? currentUser?.region : null;

  // Load reconciliation data from API on mount
  useEffect(() => {
    loadReconciliationData();
  }, [managerRegion]);

  const loadReconciliationData = async () => {
    try {
      setIsLoading(true);

      // Load all sales (request large limit and prefer server-returned totals)
      const salesResponse = await salesService.getAll({ limit: 100000 });
      let salesData = Array.isArray(salesResponse.data?.sales)
        ? salesResponse.data.sales
        : Array.isArray(salesResponse.data)
          ? salesResponse.data
          : [];
      // Capture server totals if provided
      const totalFromResp = (salesResponse as any)?.data?.total ?? (salesResponse as any)?.total ?? null;
      const totalAmountFromResp = (salesResponse as any)?.data?.totalAmount ?? (salesResponse as any)?.totalAmount ?? null;
      setServerTotalCount(typeof totalFromResp === 'number' ? totalFromResp : null);
      setServerTotalAmount(typeof totalAmountFromResp === 'number' ? totalAmountFromResp : null);
      // Filter by manager's region if regional manager
      if (managerRegion) {
        salesData = salesData.filter((s: any) => s.region === managerRegion);
      }
      // Normalize sales data to ensure source field is present and lowercase (do NOT default to a company)
      const normalizedSales = salesData.map((s: any) => ({
        ...s,
        source: (s.source || s.phoneSource || '').toLowerCase(),
      }));
      setSales(normalizedSales);

      // Load all IMEIs (request large limit and capture server-side counts)
      const imeisResponse = await imeiService.getAll({ limit: 100000 });
      let imeisData = Array.isArray(imeisResponse.data?.imeis)
        ? imeisResponse.data.imeis
        : Array.isArray(imeisResponse.data)
          ? imeisResponse.data
          : [];
      // Filter by manager's region if regional manager
      if (managerRegion) {
        imeisData = imeisData.filter((i: any) => i.region === managerRegion);
      }
      // Normalize IMEI data with proper status mapping (same as Inventory.tsx)
      const normalizedImeis = imeisData.map((i: any) => {
        const statusMap: Record<string, string> = {
          'in_stock': 'IN_STOCK',
          'allocated': 'ALLOCATED',
          'sold': 'SOLD',
          'locked': 'LOCKED',
          'lost': 'LOST',
        };
        const status = statusMap[i.status?.toLowerCase()] || i.status || 'IN_STOCK';
        // Normalize source: use lowercase to ensure consistency
        const source = ((i.source || i.phoneSource || '') as string).toLowerCase() as PhoneSource;
        
        return {
          id: i.id || i._id,
          imei: i.imei,
          productId: i.productId?._id || i.productId || '',
          productName: i.productId?.name || i.productName || 'Unknown',
          capacity: i.capacity || i.capacityDetail || i.productId?.capacity || '',
          status,
          sellingPrice: i.price || i.sellingPrice || 0,
          commission: i.commissionConfig ? 
            (i.commissionConfig.foCommission || 0) + 
            (i.commissionConfig.teamLeaderCommission || 0) + 
            (i.commissionConfig.regionalManagerCommission || 0) : 0,
          commissionConfig: i.commissionConfig,
          source,
          registeredAt: i.registeredAt ? new Date(i.registeredAt) : new Date(),
        };
      });
      // Prefer server-provided imei counts when available
      const imeisTotalSoldFromResp = (imeisResponse as any)?.data?.soldCount ?? (imeisResponse as any)?.soldCount ?? null;
      const imeisTotalInStockFromResp = (imeisResponse as any)?.data?.inStockCount ?? (imeisResponse as any)?.inStockCount ?? null;
      const soldCount = normalizedImeis.filter(i => i.status === 'SOLD').length;
      const inStockCount = normalizedImeis.filter(i => i.status === 'IN_STOCK').length;
      setServerImeisSoldCount(typeof imeisTotalSoldFromResp === 'number' ? imeisTotalSoldFromResp : soldCount);
      setServerImeisInStockCount(typeof imeisTotalInStockFromResp === 'number' ? imeisTotalInStockFromResp : inStockCount);
      setImeis(normalizedImeis);

      // Load all commissions
      const commissionsResponse = await commissionService.getAll();
      let commissionsData: any[] = [];
      
      if (Array.isArray(commissionsResponse.data)) {
        commissionsData = commissionsResponse.data;
      } else if ((commissionsResponse.data as any)?.data && Array.isArray((commissionsResponse.data as any).data)) {
        commissionsData = (commissionsResponse.data as any).data;
      } else if ((commissionsResponse.data as any)?.commissions && Array.isArray((commissionsResponse.data as any).commissions)) {
        commissionsData = (commissionsResponse.data as any).commissions;
      }
      
      // Filter by manager's region if regional manager
      if (managerRegion) {
        commissionsData = commissionsData.filter((c: any) => c.region === managerRegion);
      }
      setCommissions(commissionsData);

      setLastRefresh(new Date());
      console.log('Reconciliation data loaded from API');
    } catch (error) {
      console.error('Error loading reconciliation data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter sales by source (based on IMEI source)
  const getSaleSource = (saleImei?: string): PhoneSource | undefined => {
    if (!saleImei) return undefined;
    const imei = imeis.find(i => i.imei === saleImei);
    return imei?.source;
  };

  const filteredSales = selectedSource === 'all' 
    ? sales 
    : sales.filter(s => s.source === selectedSource || getSaleSource(s.imei) === selectedSource);

  // Calculate reconciliation data
  const totalSalesAmount = filteredSales.reduce((sum, s) => sum + s.saleAmount, 0);
  const totalVAT = filteredSales.reduce((sum, s) => sum + s.vatAmount, 0);
  const phoneSales = filteredSales.filter(s => s.imei);
  const accessorySales = filteredSales.filter(s => !s.imei);
  
  const mpesaSales = filteredSales.filter(s => s.paymentMethod === 'mpesa');
  const cashSales = filteredSales.filter(s => s.paymentMethod === 'cash');
  
  const totalCommissions = commissions.reduce((sum, c) => sum + c.amount, 0);
  const netRevenue = totalSalesAmount - totalCommissions;

  // Company-wise breakdown
    const companyBreakdown = {
    watu: {
      // Use filteredSales so company totals reflect region and selected source
      sales: filteredSales.filter(s => (s.source?.toLowerCase() === 'watu') || getSaleSource(s.imei)?.toLowerCase() === 'watu'),
      imeis: imeis.filter(i => (i.source?.toLowerCase() === 'watu')),
    },
    mogo: {
      sales: filteredSales.filter(s => (s.source?.toLowerCase() === 'mogo') || getSaleSource(s.imei)?.toLowerCase() === 'mogo'),
      imeis: imeis.filter(i => (i.source?.toLowerCase() === 'mogo')),
    },
    onfon: {
      sales: filteredSales.filter(s => (s.source?.toLowerCase() === 'onfon') || getSaleSource(s.imei)?.toLowerCase() === 'onfon'),
      imeis: imeis.filter(i => (i.source?.toLowerCase() === 'onfon')),
    },
  };

  // Discrepancy detection
  const detectDiscrepancies = (): Discrepancy[] => {
    const discrepancies: Discrepancy[] = [];

    // Check for IMEI sold but no sale record
    const soldImeis = imeis.filter(i => i.status === 'SOLD');
    const salesWithImei = sales.filter(s => s.imei);
    
    soldImeis.forEach(imei => {
      const hasSale = salesWithImei.some(s => s.imei === imei.imei);
      if (!hasSale) {
        discrepancies.push({
          id: `disc-${imei.id}`,
          type: 'imei_mismatch',
          severity: 'high',
          description: `IMEI ${imei.imei.slice(-6)} marked as SOLD but no sale record found`,
          relatedId: imei.id,
          source: imei.source,
        });
      }
    });

    // Check for M-PESA sales without payment reference
    mpesaSales.forEach(sale => {
      if (!sale.paymentReference) {
        discrepancies.push({
          id: `disc-pay-${sale.id}`,
          type: 'missing_payment',
          severity: 'medium',
          description: `M-PESA sale ${sale.etrReceiptNo} has no payment reference`,
          relatedId: sale.id,
          source: sale.source || getSaleSource(sale.imei),
        });
      }
    });

    // Check for sales without ETR receipt
    sales.forEach(sale => {
      if (!sale.etrReceiptNo) {
        discrepancies.push({
          id: `disc-etr-${sale.id}`,
          type: 'missing_receipt',
          severity: 'medium',
          description: `Sale of ${sale.productName} has no ETR receipt`,
          relatedId: sale.id,
          source: sale.source || getSaleSource(sale.imei),
        });
      }
    });

    // Check for duplicate IMEI sales
    const imeiSalesMap = new Map<string, number>();
    salesWithImei.forEach(sale => {
      if (sale.imei) {
        imeiSalesMap.set(sale.imei, (imeiSalesMap.get(sale.imei) || 0) + 1);
      }
    });
    imeiSalesMap.forEach((count, imei) => {
      if (count > 1) {
        const relatedImei = imeis.find(i => i.imei === imei);
        discrepancies.push({
          id: `disc-dup-${imei}`,
          type: 'double_sale',
          severity: 'high',
          description: `IMEI ${imei.slice(-6)} appears in ${count} sales`,
          relatedId: imei,
          source: relatedImei?.source,
        });
      }
    });

    return discrepancies;
  };

  const discrepancies = detectDiscrepancies();
  const filteredDiscrepancies = selectedSource === 'all'
    ? discrepancies
    : discrepancies.filter(d => d.source === selectedSource);

  const allOk = filteredDiscrepancies.length === 0;

  const getSourceColor = (source: PhoneSource) => {
    switch (source) {
      case 'watu': return 'bg-watu text-white';
      case 'mogo': return 'bg-mogo text-white';
      case 'onfon': return 'bg-onfon text-white';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-warning text-warning-foreground';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const inStockTotal = imeis.filter(i => i.status === 'IN_STOCK').length;

  const reconciliationItems = [
    { label: 'Revenue', value: `Ksh ${(serverTotalAmount ?? totalSalesAmount).toLocaleString()}`, ok: true },
    { label: 'Sales', value: `${(serverTotalCount ?? filteredSales.length)}`, ok: true },
    { label: 'Phones Sold', value: `${(serverImeisSoldCount ?? phoneSales.length)} units`, ok: true },
    { label: 'In Stock', value: `${serverImeisInStockCount ?? inStockTotal}`, ok: true },
    { label: 'Accessory Sales', value: `${accessorySales.length} units`, ok: true },
    { label: 'M-PESA Transactions', value: `Ksh ${mpesaSales.reduce((s, sale) => s + sale.saleAmount, 0).toLocaleString()}`, ok: mpesaSales.every(s => s.paymentReference) },
    { label: 'Cash Transactions', value: `Ksh ${cashSales.reduce((s, sale) => s + sale.saleAmount, 0).toLocaleString()}`, ok: true },
    { label: 'VAT Collected', value: `Ksh ${totalVAT.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, ok: true },
    { label: 'Total Commissions', value: `Ksh ${totalCommissions.toLocaleString()}`, ok: true },
    { label: 'Net Revenue', value: `Ksh ${netRevenue.toLocaleString()}`, ok: true },
  ];


  const handleExportReconciliation = () => {
    // Prepare sales data for export
    const salesForExport = filteredSales.map(sale => ({
      receiptNo: sale.etrReceiptNo || 'N/A',
      date: new Date(sale.createdAt).toLocaleDateString(),
      product: sale.productName,
      imei: sale.imei || 'N/A',
      quantity: sale.quantity,
      amount: sale.saleAmount,
      vat: sale.vatAmount,
      total: sale.saleAmount + sale.vatAmount,
      paymentMethod: sale.paymentMethod,
      paymentRef: sale.paymentReference || 'N/A',
      sellerName: sale.sellerName || 'N/A',
      foCode: sale.foCode || 'N/A',
      source: sale.source || getSaleSource(sale.imei) || 'N/A',
      clientName: sale.clientName || 'N/A',
      clientPhone: sale.clientPhone || 'N/A',
    }));

    // Prepare summary data
    const summaryData = [
      { metric: 'Report Date', value: new Date().toLocaleDateString() },
      { metric: 'Source Filter', value: selectedSource === 'all' ? 'All Sources' : selectedSource },
      { metric: 'Total Sales Amount', value: serverTotalAmount ?? totalSalesAmount },
      { metric: 'Sales Count', value: serverTotalCount ?? filteredSales.length },
      { metric: 'Total VAT', value: totalVAT },
      { metric: 'Total Commissions', value: totalCommissions },
      { metric: 'Net Revenue', value: netRevenue },
      { metric: 'Phone Sales Count', value: serverImeisSoldCount ?? phoneSales.length },
      { metric: 'In Stock Count', value: serverImeisInStockCount ?? inStockTotal },
      { metric: 'Accessory Sales Count', value: accessorySales.length },
      { metric: 'M-PESA Transactions', value: mpesaSales.length },
      { metric: 'Cash Transactions', value: cashSales.length },
      { metric: 'Discrepancies Found', value: filteredDiscrepancies.length },
    ];

    // Prepare company performance data
    const companyPerformanceData = (['watu', 'mogo', 'onfon'] as PhoneSource[]).map(source => {
      const data = companyBreakdown[source];
      const revenue = data.sales.reduce((sum, s) => sum + s.saleAmount, 0);
      const vat = data.sales.reduce((sum, s) => sum + s.vatAmount, 0);
      const soldCount = data.imeis.filter(i => i.status === 'SOLD').length;
      const inStockCount = data.imeis.filter(i => i.status === 'IN_STOCK').length;
      const allocatedCount = data.imeis.filter(i => i.status === 'ALLOCATED').length;
      const lockedCount = data.imeis.filter(i => i.status === 'LOCKED').length;
      const lostCount = data.imeis.filter(i => i.status === 'LOST').length;
      const totalImeis = data.imeis.length;
      const mpesaCount = data.sales.filter(s => s.paymentMethod === 'mpesa').length;
      const cashCount = data.sales.filter(s => s.paymentMethod === 'cash').length;
      const mpesaAmount = data.sales.filter(s => s.paymentMethod === 'mpesa').reduce((sum, s) => sum + s.saleAmount, 0);
      const cashAmount = data.sales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.saleAmount, 0);
      const totalStockValue = data.imeis.filter(i => i.status === 'IN_STOCK').reduce((sum, i) => sum + i.sellingPrice, 0);
      
      return {
        company: source.toUpperCase(),
        totalSales: data.sales.length,
        totalRevenue: revenue,
        totalVAT: vat,
        totalWithVAT: revenue + vat,
        phoneSold: soldCount,
        allocated: allocatedCount,
        inStock: inStockCount,
        locked: lockedCount,
        lost: lostCount,
        totalPhones: totalImeis,
        inStockValue: totalStockValue,
        mpesaTransactions: mpesaCount,
        mpesaAmount: mpesaAmount,
        cashTransactions: cashCount,
        cashAmount: cashAmount,
      };
    });

    // Export sales as main file
    exportToCSV(salesForExport, `reconciliation-sales-${new Date().toISOString().split('T')[0]}`, [
      { key: 'receiptNo', header: 'Receipt No' },
      { key: 'date', header: 'Date' },
      { key: 'product', header: 'Product' },
      { key: 'imei', header: 'IMEI' },
      { key: 'quantity', header: 'Quantity' },
      { key: 'amount', header: 'Amount (Ksh)' },
      { key: 'vat', header: 'VAT (Ksh)' },
      { key: 'total', header: 'Total (Ksh)' },
      { key: 'paymentMethod', header: 'Payment Method' },
      { key: 'paymentRef', header: 'Payment Ref' },
      { key: 'sellerName', header: 'Seller' },
      { key: 'foCode', header: 'FO Code' },
      { key: 'source', header: 'Source' },
      { key: 'clientName', header: 'Client Name' },
      { key: 'clientPhone', header: 'Client Phone' },
    ]);

    // Export company performance
    exportToCSV(companyPerformanceData, `company-performance-${new Date().toISOString().split('T')[0]}`, [
      { key: 'company', header: 'Company' },
      { key: 'totalSales', header: 'Total Sales' },
      { key: 'totalRevenue', header: 'Revenue (Ksh)' },
      { key: 'totalVAT', header: 'VAT (Ksh)' },
      { key: 'totalWithVAT', header: 'Total with VAT (Ksh)' },
      { key: 'phoneSold', header: 'Phones Sold' },
      { key: 'inStock', header: 'In Stock' },
      { key: 'totalPhones', header: 'Total Phones' },
      { key: 'mpesaTransactions', header: 'M-PESA Count' },
      { key: 'mpesaAmount', header: 'M-PESA Amount (Ksh)' },
      { key: 'cashTransactions', header: 'Cash Count' },
      { key: 'cashAmount', header: 'Cash Amount (Ksh)' },
    ]);

    // Also export summary
    exportToCSV(summaryData, `reconciliation-summary-${new Date().toISOString().split('T')[0]}`, [
      { key: 'metric', header: 'Metric' },
      { key: 'value', header: 'Value' },
    ]);
  };

  return (
    <MainLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">Reconciliation</h1>
            <p className="text-sm text-muted-foreground">Verify sales, payments, inventory, and commissions</p>
            <div className="flex items-center gap-2 mt-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={loadReconciliationData}
                disabled={isLoading}
                className="gap-2"
              >
                {isLoading ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {isLoading ? 'Loading...' : 'Refresh'}
              </Button>
              <span className="text-xs text-muted-foreground">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={selectedSource} onValueChange={(v: any) => setSelectedSource(v)}>
              <SelectTrigger className="w-[140px]">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="watu">Watu</SelectItem>
                <SelectItem value="mogo">Mogo</SelectItem>
                <SelectItem value="onfon">Onfon</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              <Calendar className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Select Period</span>
            </Button>
            <Button onClick={handleExportReconciliation} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Download className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>

        {/* Status Banner */}
        <Card className={`border shadow-sm mb-6 ${allOk ? 'bg-success/5 border-success/20' : 'bg-warning/5 border-warning/20'}`}>
          <CardContent className="p-4 flex items-center gap-4">
            {allOk ? (
              <>
                <CheckCircle className="h-8 w-8 text-success shrink-0" />
                <div>
                  <p className="font-bold text-success">All Records Reconciled</p>
                  <p className="text-sm text-muted-foreground">Sales, payments, inventory, and commissions are aligned.</p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="h-8 w-8 text-warning shrink-0" />
                <div>
                  <p className="font-bold text-warning">{filteredDiscrepancies.length} Discrepancies Found</p>
                  <p className="text-sm text-muted-foreground">Some records need attention. Please review the items below.</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Company-wise Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {(['watu', 'mogo', 'onfon'] as PhoneSource[]).map((source) => {
            const data = companyBreakdown[source];
            const revenue = data.sales.reduce((sum, s) => sum + s.saleAmount, 0);
            const soldCount = data.imeis.filter(i => i.status === 'SOLD').length;
            const inStockCount = data.imeis.filter(i => i.status === 'IN_STOCK').length;
            
            return (
              <Card key={source} className="border shadow-sm overflow-hidden">
                <CardHeader className={`py-3 ${getSourceColor(source)}`}>
                  <CardTitle className="text-lg capitalize flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    {source}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <DollarSign className="h-4 w-4" /> Revenue
                    </span>
                    <span className="font-bold">Ksh {revenue.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> Sales
                    </span>
                    <span className="font-bold">{data.sales.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Package className="h-4 w-4" /> Phones Sold
                    </span>
                    <span className="font-bold text-success">{soldCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Package className="h-4 w-4" /> In Stock
                    </span>
                    <span className="font-bold text-primary">{inStockCount}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Discrepancies Section */}
        {filteredDiscrepancies.length > 0 && (
          <Card className="border shadow-sm mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-warning" />
                Detected Discrepancies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredDiscrepancies.map((disc) => (
                  <div key={disc.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                    <AlertTriangle className={`h-5 w-5 shrink-0 ${
                      disc.severity === 'high' ? 'text-destructive' : 'text-warning'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{disc.description}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge className={getSeverityColor(disc.severity)}>
                          {disc.severity}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {disc.type.replace('_', ' ')}
                        </Badge>
                        {disc.source && (
                          <Badge className={getSourceColor(disc.source)}>
                            {disc.source}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reconciliation Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {reconciliationItems.map((item, index) => (
            <Card key={index} className="border shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="text-lg font-bold text-foreground">{item.value}</p>
                </div>
                {item.ok ? (
                  <CheckCircle className="h-6 w-6 text-success shrink-0" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-warning shrink-0" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detailed Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales by Payment Method */}
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Sales by Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">M-PESA</p>
                    <p className="text-sm text-muted-foreground">{mpesaSales.length} transactions</p>
                  </div>
                  <p className="font-bold">Ksh {mpesaSales.reduce((s, sale) => s + sale.saleAmount, 0).toLocaleString()}</p>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">Cash</p>
                    <p className="text-sm text-muted-foreground">{cashSales.length} transactions</p>
                  </div>
                  <p className="font-bold">Ksh {cashSales.reduce((s, sale) => s + sale.saleAmount, 0).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Commission Summary */}
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Commission Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-success/5">
                  <div>
                    <p className="font-medium text-success">Paid</p>
                    <p className="text-sm text-muted-foreground">{commissions.filter(c => c.status === 'paid').length} records</p>
                  </div>
                  <p className="font-bold text-success">
                    Ksh {commissions.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-warning/5">
                  <div>
                    <p className="font-medium text-warning">Pending</p>
                    <p className="text-sm text-muted-foreground">{commissions.filter(c => c.status === 'pending').length} records</p>
                  </div>
                  <p className="font-bold text-warning">
                    Ksh {commissions.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
