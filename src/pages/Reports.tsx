import { useState, useMemo, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  TrendingUp, 
  ShoppingCart, 
  DollarSign, 
  Users, 
  Package,
  Download,
  BarChart3,
  AlertTriangle,
  CalendarIcon,
  FileSpreadsheet,
  Printer,
  Lock
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { exportSalesReportToExcel, printReport } from '@/lib/excelExport';
import { cn } from '@/lib/utils';
import { salesService } from '@/services/salesService';
import { commissionService } from '@/services/commissionService';
import { userService } from '@/services/userService';
import { regionService } from '@/services/regionService';
import { toast } from 'sonner';

export default function Reports() {
  const { currentUser } = useApp();
  
  // State for API-loaded data
  const [loadedSales, setLoadedSales] = useState<any[]>([]);
  const [loadedCommissions, setLoadedCommissions] = useState<any[]>([]);
  const [loadedUsers, setLoadedUsers] = useState<any[]>([]);
  const [loadedProducts, setLoadedProducts] = useState<any[]>([]);
  const [loadedImeis, setLoadedImeis] = useState<any[]>([]);
  const [registeredRegions, setRegisteredRegions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [serverTotalCount, setServerTotalCount] = useState<number | null>(null);
  const [serverTotalAmount, setServerTotalAmount] = useState<number | null>(null);
  
  // Check if user can generate reports (Admin or Regional Manager only)
  const canGenerateReports = currentUser?.role === 'admin' || currentUser?.role === 'regional_manager';
  
  // Get user's region if Regional Manager
  const userRegion = currentUser?.role === 'regional_manager' ? currentUser.region : null;
  
  // Date range state - default to last 4 weeks
  const [startDate, setStartDate] = useState<Date>(startOfWeek(subWeeks(new Date(), 4), { weekStartsOn: 1 }));
  const [endDate, setEndDate] = useState<Date>(new Date());
  // Selected regions (Admin can select multiple, RM gets their own region only)
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [regionsInitialized, setRegionsInitialized] = useState(false);
  
  // Load reports data from API when filters change
  useEffect(() => {
    const loadReportsData = async () => {
      try {
        setIsLoading(true);
        console.log('📥 Loading reports data from API...');
        
        // Fetch registered regions
        try {
          const regionsData = await regionService.getRegions();
          const regionNames = (Array.isArray(regionsData) ? regionsData : []).map((r: any) => r.name).filter(Boolean);
          console.log('🌍 Registered regions loaded:', regionNames);
          setRegisteredRegions(regionNames);
        } catch (err) {
          console.warn('⚠️ Failed to load regions, using fallback:', err);
          setRegisteredRegions([]);
        }
        
        // Fetch sales (request totals for current date range & selected regions)
        const baseParams: any = {};
        if (startDate) {
          const sd = new Date(startDate);
          sd.setHours(0, 0, 0, 0);
          baseParams.startDate = sd.toISOString();
        }
        if (endDate) {
          const ed = new Date(endDate);
          ed.setHours(23, 59, 59, 999);
          baseParams.endDate = ed.toISOString();
        }

        // If viewing as Regional Manager, request only their region
        if (userRegion) {
          const params = { ...baseParams, region: userRegion };
          const salesRes = await salesService.getAll(params);
          let salesData: any[] = [];
          if (salesRes && salesRes.success) {
            salesData = Array.isArray(salesRes.data) ? salesRes.data : (salesRes.data as any).sales || [];
            const s = salesRes as any;
            const src = s.data ?? s;
            const tCount = src?.total ?? s?.total ?? src?.count ?? s?.count ?? null;
            const tAmt = src?.totalAmount ?? s?.totalAmount ?? src?.total_amount ?? s?.total_amount ?? null;
            if (typeof tCount === 'number') setServerTotalCount(Number(tCount));
            if (typeof tAmt === 'number') setServerTotalAmount(Number(tAmt));
          }
          console.log('📊 Sales loaded (RM):', salesData.length);
          setLoadedSales(salesData);
        } else {
          // Admin: selectedRegions controls which regions to include. If none selected, empty result
          if (!selectedRegions || selectedRegions.length === 0) {
            setLoadedSales([]);
            setServerTotalCount(0);
            setServerTotalAmount(0);
          } else if (registeredRegions.length > 0 && selectedRegions.length === registeredRegions.length) {
            // All regions selected: request without region filter to get complete totals
            const salesRes = await salesService.getAll(baseParams);
            let salesData: any[] = [];
            if (salesRes && salesRes.success) {
              salesData = Array.isArray(salesRes.data) ? salesRes.data : (salesRes.data as any).sales || [];
              const s = salesRes as any;
              const src = s.data ?? s;
              const tCount = src?.total ?? s?.total ?? src?.count ?? s?.count ?? null;
              const tAmt = src?.totalAmount ?? s?.totalAmount ?? src?.total_amount ?? s?.total_amount ?? null;
              if (typeof tCount === 'number') setServerTotalCount(Number(tCount));
              if (typeof tAmt === 'number') setServerTotalAmount(Number(tAmt));
            }
            console.log('📊 Sales loaded (all regions):', salesData.length);
            setLoadedSales(salesData);
          } else {
            // Partial region selection: fetch each region and aggregate
            let allSales: any[] = [];
            let aggCount = 0;
            let aggAmount = 0;
            for (const r of selectedRegions) {
              const params = { ...baseParams, region: r };
              const res = await salesService.getAll(params);
              if (res && res.success) {
                const arr = Array.isArray(res.data) ? res.data : (res.data as any).sales || [];
                allSales = allSales.concat(arr);
                const r = res as any;
                const rsrc = r.data ?? r;
                const rc = rsrc?.total ?? r?.total ?? rsrc?.count ?? r?.count ?? null;
                const ra = rsrc?.totalAmount ?? r?.totalAmount ?? rsrc?.total_amount ?? r?.total_amount ?? null;
                aggCount += typeof rc === 'number' ? Number(rc) : arr.length;
                aggAmount += typeof ra === 'number' ? Number(ra) : arr.reduce((s: number, item: any) => s + (item.saleAmount || 0), 0);
              }
            }
            console.log('📊 Sales loaded (partial regions):', allSales.length);
            setLoadedSales(allSales);
            setServerTotalCount(aggCount);
            setServerTotalAmount(aggAmount);
          }
        }
        
        // Fetch commissions
        const commissionsRes = await commissionService.getAll();
        let commissionsData: any[] = [];
        if (commissionsRes.success && commissionsRes.data) {
          if (Array.isArray(commissionsRes.data)) {
            commissionsData = commissionsRes.data;
          } else if ((commissionsRes.data as any).data && Array.isArray((commissionsRes.data as any).data)) {
            commissionsData = (commissionsRes.data as any).data;
          } else if ((commissionsRes.data as any).commissions && Array.isArray((commissionsRes.data as any).commissions)) {
            commissionsData = (commissionsRes.data as any).commissions;
          }
        }
        console.log('💰 Commissions loaded:', commissionsData.length);
        setLoadedCommissions(commissionsData);
        
        // Fetch users
        const usersRes = await userService.getAll();
        let usersData: any[] = [];
        if (Array.isArray(usersRes)) {
          usersData = usersRes;
        } else if (usersRes?.data) {
          if (Array.isArray(usersRes.data)) {
            usersData = usersRes.data;
          } else if ((usersRes.data as any).users) {
            usersData = (usersRes.data as any).users;
          }
        }
        console.log('👥 Users loaded:', usersData.length);
        setLoadedUsers(usersData);
        
        // Products and IMEIs are loaded from API where available
        console.log('📦 Products and IMEIs loaded from API (if provided)');
        
        console.log('✅ Reports data loaded successfully');
      } catch (error) {
        console.error('❌ Error loading reports data:', error);
        toast.error('Failed to load reports data');
        // Do not fallback to context data — keep API data empty to surface the error
      } finally {
        setIsLoading(false);
      }
    };
    
    loadReportsData();
  }, [currentUser?.id, startDate, endDate, userRegion, selectedRegions, registeredRegions.length]);
  
  // Use API-loaded data only (no fallbacks to context)
  const reportSales = loadedSales;
  const reportCommissions = loadedCommissions;
  const reportUsers = loadedUsers;
  const reportProducts = loadedProducts;
  const reportImeis = loadedImeis;
  
  // Use registered regions or fallback to all regions from data
  const availableRegions = registeredRegions.length > 0 ? registeredRegions : 
    Array.from(new Set(reportUsers.map((u: any) => u.region).filter(Boolean)));
  
  // Initialize selected regions after available regions are loaded
  useEffect(() => {
    if (!regionsInitialized && availableRegions.length > 0 && !userRegion) {
      setSelectedRegions([...availableRegions]);
      setRegionsInitialized(true);
      console.log('🔧 Initialized selectedRegions with all available regions:', availableRegions);
    }
  }, [availableRegions, regionsInitialized, userRegion]);

  // Toggle region selection
  const toggleRegion = (region: string) => {
    if (userRegion) return; // RM cannot change their region
    
    setSelectedRegions(prev => 
      prev.includes(region) 
        ? prev.filter(r => r !== region)
        : [...prev, region]
    );
  };

  // Select/deselect all regions
  const toggleAllRegions = () => {
    if (userRegion) return;
    
    if (selectedRegions.length === availableRegions.length) {
      setSelectedRegions([]);
    } else {
      setSelectedRegions([...availableRegions]);
    }
    console.log('🔄 Toggle all regions - selectedRegions updated');
  };

  // Filter sales based on date range and regions
  const filteredSales = useMemo(() => {
    console.log('📊 Filtering sales:', { 
      totalSales: reportSales.length, 
      startDate: format(startDate, 'yyyy-MM-dd'), 
      endDate: format(endDate, 'yyyy-MM-dd'),
      userRegion,
      selectedRegions
    });

    const regionsToFilter = userRegion ? [userRegion] : selectedRegions;
    console.log('🔍 Regions to filter:', { selectedRegions, regionsToFilter });
    
    const regionUserIds = reportUsers.filter(u => regionsToFilter.includes(u.region || '')).map(u => u.id);
    console.log('👥 Region user IDs:', regionUserIds);
    
    const filtered = reportSales.filter((sale: any) => {
      const saleDate = new Date(sale.createdAt);
      const startBoundary = startDate ? new Date(new Date(startDate).setHours(0,0,0,0)) : null;
      const endBoundary = endDate ? new Date(new Date(endDate).setHours(23,59,59,999)) : null;
      const isInDateRange = (
        (!startBoundary || saleDate >= startBoundary) &&
        (!endBoundary || saleDate <= endBoundary)
      );
      
      // More lenient region filter - check multiple fields
      const isRegionSale = 
        !userRegion || // Admin with no region filter always matches
        (sale.region && regionsToFilter.includes(sale.region)) ||
        (sale.regionalManagerId && regionUserIds.includes(sale.regionalManagerId)) ||
        (sale.foId && regionUserIds.includes(sale.foId)) ||
        regionUserIds.includes(sale.createdBy);
      
      return isInDateRange && isRegionSale;
    });
    
    console.log('✅ Filtered sales:', filtered.length);
    return filtered;
  }, [reportSales, startDate, endDate, selectedRegions, userRegion, reportUsers]);

  // Stats
  const totalRevenue = serverTotalAmount ?? filteredSales.reduce((sum, s) => sum + (s.saleAmount || 0), 0);
  const totalSalesCount = serverTotalCount ?? filteredSales.length;
  const filteredCommissions = reportCommissions.filter((c: any) => 
    filteredSales.some(s => s.id === c.saleId)
  );
  const totalCommissionsPaid = filteredCommissions.filter((c: any) => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0);
  const activeFOs = reportUsers.filter((u: any) => u.role === 'field_officer').length;

  // Top selling products
  const productSales: Record<string, { name: string; sales: number }> = {};
  filteredSales.forEach(sale => {
    const productId = sale.productId || 'unknown';
    const productName = sale.productName || 'Unknown Product';
    if (!productSales[productId]) {
      productSales[productId] = { name: productName, sales: 0 };
    }
    productSales[productId].sales += sale.saleAmount;
  });
  const topProducts = Object.values(productSales)
    .filter(p => p.sales > 0)
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5)
    .map(p => ({ name: p.name, value: p.sales }));

  // FO Performance
  const foPerformance: Record<string, { name: string; sales: number; commissions: number }> = {};
  filteredSales.forEach((sale: any) => {
    const foId = sale.foId || sale.createdBy;
    if (foId) {
      // Get FO name from multiple sources
      let foName = sale.sellerName || sale.foName || sale.createdByName;
      if (!foName) {
        const user = reportUsers.find((u: any) => u.id === foId);
        foName = user?.name || 'Unknown';
      }
      
      if (!foPerformance[foId]) {
        foPerformance[foId] = { name: foName, sales: 0, commissions: 0 };
      }
      foPerformance[foId].sales += sale.saleAmount;
      foPerformance[foId].name = foName;
    }
  });
  filteredCommissions.forEach((c: any) => {
    const foId = c.foId;
    if (foId) {
      const user = reportUsers.find((u: any) => u.id === foId);
      const name = user?.name || c.foName || 'Unknown';
      if (!foPerformance[foId]) {
        foPerformance[foId] = { name, sales: 0, commissions: 0 };
      }
      foPerformance[foId].commissions += c.amount;
    }
  });
  const foData = Object.values(foPerformance)
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5);

  // Company performance breakdown (computed from filtered sales revenue)
  const companyTotals = {
    watu: 0,
    mogo: 0,
    onfon: 0,
  };
  filteredSales.forEach((s: any) => {
    const src = (s.source || '').toString().toLowerCase();
    if (src === 'watu') companyTotals.watu += Number(s.saleAmount || 0);
    else if (src === 'mogo') companyTotals.mogo += Number(s.saleAmount || 0);
    else if (src === 'onfon') companyTotals.onfon += Number(s.saleAmount || 0);
  });
  const companyTotalSum = companyTotals.watu + companyTotals.mogo + companyTotals.onfon || 0;
  const companyPerformance = [
    { name: 'Watu', value: companyTotalSum > 0 ? Math.round((companyTotals.watu / companyTotalSum) * 100) : 0 },
    { name: 'Mogo', value: companyTotalSum > 0 ? Math.round((companyTotals.mogo / companyTotalSum) * 100) : 0 },
    { name: 'Onfon', value: companyTotalSum > 0 ? Math.round((companyTotals.onfon / companyTotalSum) * 100) : 0 },
  ];

  const COMPANY_COLORS = ['#10b981', '#8b5cf6', '#f97316'];

  // Inventory summary (computed from merged products and IMEIs)
  const totalProducts = reportProducts.length;
  const imeisInStock = reportImeis.filter(i => (i.status || '').toString().toUpperCase() === 'IN_STOCK').length;
  const productStockSum = reportProducts.reduce((sum, p) => sum + (Number(p.stockQuantity || 0)), 0);
  const totalStock = productStockSum + imeisInStock;

  const lowStockItems = reportProducts.filter(p => (p.category === 'accessory' && (Number(p.stockQuantity || 0) < 10)) ||
    (p.category === 'phone' && reportImeis.filter(i => i.productId === p.id && (i.status || '').toString().toUpperCase() === 'IN_STOCK').length < 5)
  ).length;

  const categoryBreakdown = [
    { name: 'Phones', count: imeisInStock },
    { name: 'Accessories', count: reportProducts.filter(p => p.category === 'accessory').reduce((sum, p) => sum + (Number(p.stockQuantity || 0)), 0) },
  ];

  // Handle export to Excel
  const handleExportExcel = () => {
    const regionsToExport = userRegion ? [userRegion] : selectedRegions;
    console.log('📥 Exporting Excel:', { regionsToExport, selectedRegions, salesCount: filteredSales.length, productsCount: reportProducts.length });
    // Export using full unfiltered data - let the export function handle region filtering
    exportSalesReportToExcel(reportSales, reportCommissions, reportUsers, startDate, endDate, regionsToExport, reportProducts, reportImeis);
    toast.success(`Exported report for ${regionsToExport.length} region(s)`);
  };

  // Handle print
  const handlePrint = () => {
    const regionsToPrint = userRegion ? [userRegion] : selectedRegions;
    console.log('🖨️ Printing report:', { regionsToPrint, selectedRegions, salesCount: reportSales.length });
    // Print using full unfiltered data - let the print function handle region filtering
    printReport(reportSales, reportCommissions, reportUsers, startDate, endDate, regionsToPrint);
    toast.success(`Printing report for ${regionsToPrint.length} region(s)`);
  };

  // If user doesn't have permission to generate reports
  if (!canGenerateReports) {
    return (
      <MainLayout>
        <div className="animate-fade-in flex flex-col items-center justify-center min-h-[60vh] text-center">
          <Lock className="h-16 w-16 text-muted-foreground mb-4" />
          <h1 className="text-2xl font-heading font-bold text-foreground mb-2">Access Restricted</h1>
          <p className="text-muted-foreground max-w-md">
            Only Admin and Regional Managers can generate and view reports. 
            Please contact your supervisor for access.
          </p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Reports & Analytics</h1>
            <p className="text-muted-foreground">
              {userRegion 
                ? `View sales performance for ${userRegion} Region`
                : 'View sales performance, inventory status, and FO metrics'
              }
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
            <Button variant="default" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print Report
            </Button>
          </div>
        </div>

        {/* Filters Section */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Report Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date Range */}
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(startDate, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => date && setStartDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(endDate, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => date && setEndDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="text-sm text-muted-foreground">
                Period: {format(startDate, 'do MMM')} – {format(endDate, 'do MMM yyyy')}
              </div>
            </div>

            {/* Region Selection (Admin only) */}
            {!userRegion && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Select Regions</Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={toggleAllRegions}
                    className="text-xs"
                  >
                    {selectedRegions.length === availableRegions.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-3">
                  {availableRegions.map(region => (
                    <div key={region} className="flex items-center space-x-2">
                      <Checkbox
                        id={region}
                        checked={selectedRegions.includes(region)}
                        onCheckedChange={() => toggleRegion(region)}
                      />
                      <Label 
                        htmlFor={region} 
                        className={cn(
                          "text-sm cursor-pointer",
                          selectedRegions.includes(region) ? "text-foreground font-medium" : "text-muted-foreground"
                        )}
                      >
                        {region}
                      </Label>
                    </div>
                  ))}
                </div>
                {selectedRegions.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No regions selected. Select at least one region to view reports.
                  </p>
                )}
              </div>
            )}

            {/* Regional Manager - Show their region */}
            {userRegion && (
              <div className="flex items-center gap-2 bg-muted/50 p-3 rounded-lg">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Viewing data for: <span className="font-medium text-foreground">{userRegion} Region</span>
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-600 font-medium">Total Revenue</p>
                  <p className="text-2xl font-bold text-foreground">Ksh {totalRevenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Selected period</p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-primary font-medium">Total Sales</p>
                  <p className="text-2xl font-bold text-foreground">{totalSalesCount}</p>
                  <p className="text-xs text-muted-foreground">Transactions</p>
                </div>
                <ShoppingCart className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-success font-medium">Commissions Paid</p>
                  <p className="text-2xl font-bold text-foreground">Ksh {totalCommissionsPaid.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Selected period</p>
                </div>
                <DollarSign className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-accent font-medium">Active FOs</p>
                  <p className="text-2xl font-bold text-foreground">{activeFOs}</p>
                  <p className="text-xs text-muted-foreground">of {reportUsers.length} total</p>
                </div>
                <Users className="h-8 w-8 text-accent" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Selling Products */}
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5 text-success" />
                Top Selling Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topProducts.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={topProducts} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => `Ksh ${value.toLocaleString()}`} />
                    <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No sales data for selected period
                </div>
              )}
            </CardContent>
          </Card>

          {/* FO Performance */}
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-accent" />
                Field Officer Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {foData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={foData} margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => `Ksh ${value.toLocaleString()}`} />
                    <Bar dataKey="sales" fill="#8b5cf6" name="Sales" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="commissions" fill="#f97316" name="Commissions" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No FO data for selected period
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Company Performance */}
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-primary" />
                Company Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={250}>
                  <RechartsPie>
                    <Pie
                      data={companyPerformance}
                      cx="35%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {companyPerformance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COMPANY_COLORS[index % COMPANY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                      formatter={(value, entry: any) => (
                        <span className="text-foreground">
                          {value} <span className="font-bold ml-4">{entry.payload.value}%</span>
                        </span>
                      )}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Inventory Summary */}
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5 text-success" />
                Inventory Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Total Products</p>
                  <p className="text-3xl font-bold text-foreground">{totalProducts}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Total Stock Units</p>
                  <p className="text-3xl font-bold text-foreground">{totalStock}</p>
                </div>
              </div>

              {lowStockItems > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-destructive">{lowStockItems} items need restocking</span>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-2">By Category</p>
                {categoryBreakdown.map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="text-muted-foreground">{cat.name}</span>
                    <span className="font-medium">{cat.count} units</span>
                  </div>
                ))}
              </div>

              <Button variant="outline" className="w-full" onClick={handleExportExcel}>
                <Download className="h-4 w-4 mr-2" />
                Export Full Report
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
