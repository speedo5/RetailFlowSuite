import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { generateSaleReceipt, exportToCSV } from '@/lib/pdfGenerator';
import { exportToExcel } from '@/lib/excelExport';
import { Receipt, Search, Download, FileText, User, Calendar, Filter, Building2, Eye, X } from 'lucide-react';
import { PhoneSource } from '@/types';
import { salesService } from '@/services/salesService';
import { toast } from 'sonner';

export default function Receipts() {
  const { users, currentUser } = useApp();
  const [sales, setSales] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sellerFilter, setSellerFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [previewSale, setPreviewSale] = useState<any | null>(null);
  const [serverTotalCount, setServerTotalCount] = useState<number | null>(null);
  const [serverTotalAmount, setServerTotalAmount] = useState<number | null>(null);

  // Get manager's region - Regional Managers and Team Leaders only see their region's receipts
  const managerRegion = (currentUser?.role === 'regional_manager' || currentUser?.role === 'team_leader') ? currentUser?.region : null;

  // Filter field officers by region if user is Regional Manager or Team Leader
  const fieldOfficers = users.filter(u => {
    if (u.role !== 'field_officer') return false;
    if (!managerRegion) return true; // Admin sees all
    return u.region === managerRegion; // RM/TL sees only their region's FOs
  });
  
  // Check if current user can print receipts (Admin, Regional Manager, or Team Leader)
  const canPrintReceipt = currentUser?.role === 'admin' || currentUser?.role === 'regional_manager' || currentUser?.role === 'team_leader';

  // Fetch sales from API on component mount
  useEffect(() => {
    const fetchSales = async () => {
      try {
        setIsLoading(true);
        const dateRange = getDateRange();
        const params: any = {};
        if (sellerFilter && sellerFilter !== 'all') params.soldBy = sellerFilter;
        if (dateRange) {
          params.startDate = dateRange.start.toISOString();
          params.endDate = dateRange.end.toISOString();
        }

        // request a large limit so the UI can display all matching receipts
        params.limit = 100000;

        const response = await salesService.getAll(params);
        if (response && response.success) {
          let salesList = Array.isArray(response.data) ? response.data : [];
          
          // enrich sales with seller info (name/role/region) from users context when missing
          salesList = salesList.map((s: any) => {
            const user = users.find(u => u.id === s.createdBy);
            return {
              ...s,
              sellerName: s.sellerName || s.createdByName || user?.name || s.createdBy || 'Unknown',
              sellerRole: s.sellerRole || user?.role || s.role || '',
              sellerRegion: s.sellerRegion || s.region || user?.region || '',
              // precompute sellerLabel for exports/PDFs
              sellerLabel: s.sellerLabel || undefined,
            };
          });
          
          // Filter sales by region if user is Regional Manager (extra safety)
          if (managerRegion) {
            salesList = salesList.filter((sale: any) => sale.region === managerRegion);
          }

          setSales(salesList);

          // Robustly extract totals from possible response shapes
          const respAny = response as any;
          const totalsSource = respAny.data ?? respAny;
          const totalCount = typeof totalsSource?.total === 'number' ? totalsSource.total : (typeof respAny.total === 'number' ? respAny.total : null);
          const totalAmt = typeof totalsSource?.totalAmount === 'number' ? totalsSource.totalAmount : (typeof respAny.totalAmount === 'number' ? respAny.totalAmount : null);
          if (totalCount !== null) setServerTotalCount(totalCount);
          if (totalAmt !== null) setServerTotalAmount(totalAmt);
        }
      } catch (error) {
        console.error('Failed to fetch sales:', error);
        toast.error('Failed to load receipts');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSales();
  }, [managerRegion, users, sellerFilter, dateFilter]);

  const getSourceBadgeClass = (source: PhoneSource | undefined) => {
    switch (source) {
      case 'watu': return 'bg-watu text-white';
      case 'mogo': return 'bg-mogo text-white';
      case 'onfon': return 'bg-onfon text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getDateRange = () => {
    const now = new Date();
    switch (dateFilter) {
      case 'today':
        return { start: new Date(now.setHours(0, 0, 0, 0)), end: new Date() };
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        return { start: weekStart, end: new Date() };
      case 'month':
        const monthStart = new Date(now);
        monthStart.setMonth(now.getMonth() - 1);
        return { start: monthStart, end: new Date() };
      default:
        return null;
    }
  };

  // Helper: format seller display as "Name - [ROLE] Region" (e.g. "James Warue - [RM] Rift Valley")
  const getSellerLabel = (sale: any) => {
    const name = sale.sellerName || sale.seller?.name || sale.createdBy || 'Unknown';
    const roleRaw = sale.sellerRole || sale.createdByRole || sale.role || sale.seller?.role || '';
    const region = sale.region || sale.seller?.region || sale.sellerRegion || sale.createdByRegion || '';

    const r = String(roleRaw || '').toLowerCase();
    let roleAbbrev = '';
    if (r.includes('regional')) roleAbbrev = 'RM';
    else if (r.includes('field')) roleAbbrev = 'FO';
    else if (r.includes('team') || r.includes('leader') || r.includes('tl')) roleAbbrev = 'TL';
    else if (r.includes('admin')) roleAbbrev = 'Admin';
    else if (roleRaw) roleAbbrev = roleRaw;

    const rolePart = roleAbbrev ? `[${roleAbbrev}]` : '';

    if (rolePart && region) return `${name} - ${rolePart} ${region}`;
    if (rolePart) return `${name} - ${rolePart}`;
    if (region) return `${name} - ${region}`;
    return name;
  };

  const normalizeReceipt = (raw?: string) => {
    if (!raw) return `RCP-${String(3000).padStart(6, '0')}`;
    const s = String(raw);
    const match = s.match(/(\d+)/);
    if (!match) return s;
    let num = parseInt(match[1], 10);
    if (num < 3000) num = num + 1000;
    return `RCP-${String(num).padStart(6, '0')}`;
  };

  const filteredSales = sales.filter(sale => {
    const matchesSearch = 
      sale.etrReceiptNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.sellerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.imei?.includes(searchQuery);
    
    const matchesSeller = sellerFilter === 'all' || sale.createdBy === sellerFilter;
    
    const dateRange = getDateRange();
    const matchesDate = !dateRange || (
      new Date(sale.createdAt) >= dateRange.start && 
      new Date(sale.createdAt) <= dateRange.end
    );

    return matchesSearch && matchesSeller && matchesDate;
  });

  const handleExport = () => {
    // Enrich sales with computed seller labels & normalized receipt numbers for export
    const salesWithLabels = filteredSales.map(sale => ({
      ...sale,
      sellerLabel: getSellerLabel(sale),
      normalizedReceipt: normalizeReceipt(sale.etrReceiptNo || sale.receiptNumber),
    }));

    const columns = [
      { key: 'normalizedReceipt' as const, header: 'Receipt No' },
      { key: 'createdAt' as const, header: 'Date' },
      { key: 'clientName' as const, header: 'Client' },
      { key: 'clientPhone' as const, header: 'Client Phone' },
      { key: 'clientIdNumber' as const, header: 'Client ID' },
      { key: 'productName' as const, header: 'Product' },
      { key: 'source' as const, header: 'Source' },
      { key: 'imei' as const, header: 'IMEI' },
      { key: 'sellerLabel' as const, header: 'Seller' },
      { key: 'paymentMethod' as const, header: 'Payment' },
      { key: 'saleAmount' as const, header: 'Amount' },
    ];
    exportToExcel(salesWithLabels, 'receipts', columns);
  };

  const handleDownloadReceipt = async (sale: typeof sales[0]) => {
    try {
      setIsDownloading(true);
      // attach seller label so PDF generator can print role/region
      const saleWithSeller = {
        ...sale,
        sellerLabel: getSellerLabel(sale),
      };
      generateSaleReceipt(saleWithSeller);
    } catch (error) {
      console.error('Error downloading receipt:', error);
      toast.error('Failed to download receipt');
    } finally {
      setIsDownloading(false);
    }
  };

  const totalAmount = filteredSales.reduce((sum, s) => sum + s.saleAmount, 0);
  const totalVAT = filteredSales.reduce((sum, s) => sum + (s.vatAmount || 0), 0);

  return (
    <MainLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">ETR Receipts</h1>
            <p className="text-sm text-muted-foreground">View and export all generated receipts</p>
            {managerRegion && (
              <Badge className="mt-2 bg-blue-100 text-blue-800">
                <Building2 className="h-3 w-3 mr-1" />
                Region: {managerRegion}
              </Badge>
            )}
          </div>
          <Button onClick={handleExport} variant="outline" className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Export to Excel
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <Card className="border shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <Receipt className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold truncate">{serverTotalCount ?? filteredSales.length}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Receipts {managerRegion ? `(${managerRegion})` : ''}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold truncate">Ksh {(serverTotalAmount ?? totalAmount).toLocaleString()}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Sales {managerRegion ? `(${managerRegion})` : ''}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold truncate">Ksh {totalVAT.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Total VAT {managerRegion ? `(${managerRegion})` : ''}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold truncate">{new Set(filteredSales.map(s => s.createdBy)).size}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Active Sellers {managerRegion ? `(${managerRegion})` : ''}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search receipts, products, sellers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={sellerFilter} onValueChange={setSellerFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <User className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by seller" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sellers</SelectItem>
              {fieldOfficers.map(fo => (
                <SelectItem key={fo.id} value={fo.id}>{fo.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Receipts List - Mobile Cards + Desktop Table */}
        <div className="block lg:hidden space-y-3">
          {isLoading ? (
            <Card className="border shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
                <p className="text-muted-foreground">Loading receipts...</p>
              </CardContent>
            </Card>
          ) : filteredSales.length === 0 ? (
            <Card className="border shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No receipts found</p>
              </CardContent>
            </Card>
          ) : (
            filteredSales.map((sale) => (
              <Card key={sale.id} className="border shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-mono text-sm font-medium text-primary">{normalizeReceipt(sale.etrReceiptNo || sale.receiptNumber)}</p>
                      <p className="text-xs text-muted-foreground mb-2">
                        {new Date(sale.createdAt).toLocaleDateString()}
                      </p>
                      {sale.source && (
                        <p className="text-xs text-muted-foreground">
                          Source: <span className="font-medium capitalize">{sale.source}</span>
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {sale.paymentMethod.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{sale.productName}{sale.capacity ? ` - ${sale.capacity}` : ''}</p>
                  </div>
                  {sale.imei && (
                    <p className="text-xs font-mono text-muted-foreground mb-1">
                      IMEI: {sale.imei}
                    </p>
                  )}
                  {sale.clientName && (
                    <p className="text-xs text-muted-foreground mb-1">
                      Client: {sale.clientName} {sale.clientPhone ? `• ${sale.clientPhone}` : ''}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{getSellerLabel(sale)}</span>
                    <span className="font-bold text-success">Ksh {sale.saleAmount.toLocaleString()}</span>
                  </div>
                  {canPrintReceipt && (
                    <div className="flex gap-2 mt-3">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => setPreviewSale(sale)}
                        title="Preview receipt"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Desktop Table */}
        <Card className="border shadow-sm overflow-hidden hidden lg:block">
          {isLoading ? (
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
              <p className="text-muted-foreground">Loading receipts...</p>
            </CardContent>
          ) : filteredSales.length === 0 ? (
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No receipts found</p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Receipt No</th>
                    <th>Date</th>
                    <th>Client</th>
                    <th>Product</th>
                    <th>Source</th>
                    <th>IMEI</th>
                    <th>Seller</th>
                    <th>Payment</th>
                    <th>Amount</th>
                    {canPrintReceipt && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="font-mono text-sm text-primary">{normalizeReceipt(sale.etrReceiptNo || sale.receiptNumber)}</td>
                      <td className="text-sm">{new Date(sale.createdAt).toLocaleDateString()}</td>
                      <td>
                        {sale.clientName ? (
                          <div>
                            <p className="font-medium text-sm">{sale.clientName}</p>
                            {sale.clientPhone && <p className="text-xs text-muted-foreground">{sale.clientPhone}</p>}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="font-medium">{sale.productName}</td>
                      <td>
                        {sale.source ? (
                          <Badge className={`text-xs ${getSourceBadgeClass(sale.source)}`}>
                            {sale.source.toUpperCase()}
                          </Badge>
                        ) : '-'}
                      </td>
                      <td className="font-mono text-xs">{sale.imei || '-'}</td>
                      <td>
                        <div>
                          <p className="font-medium text-sm">{getSellerLabel(sale)}</p>
                          {sale.foCode && <p className="text-xs text-muted-foreground">{sale.foCode}</p>}
                        </div>
                      </td>
                      <td>
                        <Badge variant="outline" className="text-xs">
                          {sale.paymentMethod.toUpperCase()}
                        </Badge>
                        {sale.paymentReference && (
                          <p className="text-xs font-mono text-muted-foreground mt-1">{sale.paymentReference}</p>
                        )}
                      </td>
                      <td className="font-bold text-success">Ksh {sale.saleAmount.toLocaleString()}</td>
                      {canPrintReceipt && (
                        <td>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setPreviewSale(sale)}
                            title="Preview receipt"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Receipt Preview Modal */}
      <Dialog open={previewSale !== null} onOpenChange={(open) => !open && setPreviewSale(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receipt Preview</DialogTitle>
          </DialogHeader>
          
          {previewSale && (
            <div className="bg-white p-6 rounded-lg border font-mono text-sm space-y-4">
              {/* Header */}
              <div className="text-center border-b pb-4">
                <h3 className="font-bold text-lg">RECEIPT</h3>
                <p className="text-xs text-muted-foreground">Receipt #{normalizeReceipt(previewSale.etrReceiptNo || previewSale.receiptNumber)}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(previewSale.createdAt || previewSale.date || previewSale.createdAt).toLocaleDateString()} {new Date(previewSale.createdAt || previewSale.date || previewSale.createdAt).toLocaleTimeString()}
                </p>
              </div>

              {/* Customer Info */}
              <div className="space-y-1 text-xs">
                <p><span className="font-semibold">Client:</span> {previewSale.clientName}</p>
                <p><span className="font-semibold">Phone:</span> {previewSale.clientPhone}</p>
                <p><span className="font-semibold">ID:</span> {previewSale.clientIdNumber}</p>
                <p><span className="font-semibold">Source:</span> <span className="capitalize">{previewSale.source}</span></p>
              </div>

              {/* Product Details */}
              <div className="border-t pt-4">
                <h4 className="font-bold text-xs mb-2">Product Details:</h4>
                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <span><span className="font-semibold">Product:</span> {previewSale.productName}</span>
                    <span><span className="font-semibold">Price:</span> Ksh {previewSale.saleAmount.toLocaleString()}</span>
                  </div>
                  {previewSale.imei && (
                    <div>
                      <span className="font-semibold">IMEI:</span> {previewSale.imei}
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Info */}
              <div className="border-t pt-4 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="font-semibold">Payment Method:</span>
                  <span className="uppercase">{previewSale.paymentMethod}</span>
                </div>
                {previewSale.paymentReference && (
                  <div className="flex justify-between">
                    <span className="font-semibold">Ref:</span>
                    <span className="font-mono">{previewSale.paymentReference}</span>
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="border-t border-b py-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Total Amount</p>
                <p className="text-lg font-bold">Ksh {previewSale.saleAmount.toLocaleString()}</p>
              </div>

              {/* Seller Info */}
              {previewSale && (
                <div className="text-xs">
                  <p>
                    <span className="font-semibold">Seller:</span> {getSellerLabel(previewSale)}
                  </p>
                </div>
              )}

              {/* Footer */}
              <div className="text-center border-t pt-4 text-xs text-muted-foreground">
                <p>Thank you for your purchase!</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewSale(null)}>
              Close
            </Button>
            {previewSale && (
              <Button onClick={() => {
                handleDownloadReceipt(previewSale);
                setPreviewSale(null);
              }}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

