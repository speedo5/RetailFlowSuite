import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { RevenueChart, SalesPieChart } from '@/components/dashboard/Charts';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { dashboardService, type DashboardStats, type MappedDashboardStats, type TopSeller, type ChartDataPoint } from '@/services/dashboardService';
import { userService } from '@/services/userService';
import { salesService } from '@/services/salesService';
import { toast } from 'sonner';
import { ApiClientError } from '@/services/apiClient';
import { 
  DollarSign, 
  ShoppingCart, 
  Smartphone, 
  TrendingUp,
  Package,
  Users,
  AlertCircle,
  BarChart3
} from 'lucide-react';

export default function Dashboard() {
  const { currentUser, sales, users, products, commissions, imeis } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect users to their role-specific default page when they land on root
  useEffect(() => {
    if (!currentUser) return;
    // Only auto-redirect when on the root dashboard path
    if (location.pathname && location.pathname !== '/') return;

    switch (currentUser.role) {
      case 'regional_manager':
        navigate('/regional', { replace: true });
        break;
      case 'team_leader':
        navigate('/team-leader', { replace: true });
        break;
      case 'field_officer':
        navigate('/fo', { replace: true });
        break;
      default:
        // admin and others stay on the admin dashboard
        break;
    }
  }, [currentUser, location.pathname, navigate]);
  
  // State for API data
  const [stats, setStats] = useState<MappedDashboardStats | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [topSellers, setTopSellers] = useState<TopSeller[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch dashboard data on mount
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        const [statsRes, chartRes, sellersRes, salesRes] = await Promise.all([
          dashboardService.getStats(),
          dashboardService.getSalesChart('week'),
          dashboardService.getTopSellers(5),
          salesService.getAll({ limit: 5 }),
        ]);

        // Map the API response to the expected format
        if (statsRes.data) {
          const apiData = statsRes.data as DashboardStats;
          // compute additional values from context where possible
          const totalCommissionsPaid = (Array.isArray(commissions) ? commissions : [])
            .filter(c => c.status === 'paid')
            .reduce((sum, c) => sum + (c.amount || 0), 0);

          const pendingCommissionsVal = apiData.commissions?.pending || (
            (Array.isArray(commissions) ? commissions : []).filter(c => c.status === 'pending').reduce((s, c) => s + (c.amount || 0), 0)
          );

          const totalPhoneStockFromProducts = (Array.isArray(products) ? products : []).reduce((s, p) => s + (p.stockQuantity || 0), 0);
          const imeiInStockCount = (Array.isArray(imeis) ? imeis : []).filter(i => i.status === 'IN_STOCK').length;

          const mappedStats: MappedDashboardStats = {
            totalRevenue: apiData.sales?.month?.revenue || 0,
            todayRevenue: apiData.sales?.today?.revenue || 0,
            totalSales: apiData.sales?.month?.count || 0,
            todaySales: apiData.sales?.today?.count || 0,
            totalPhones: apiData.stock?.total || totalPhoneStockFromProducts + imeiInStockCount,
            phonesInStock: (apiData.stock as any)?.inStock ?? apiData.stock?.total ?? totalPhoneStockFromProducts + imeiInStockCount,
            phonesSold: apiData.sales?.month?.count || sales.length,
            allocatedPhones: apiData.stock?.allocated || 0,
            pendingCommissions: pendingCommissionsVal || 0,
            totalCommissionsPaid: totalCommissionsPaid || 0,
          };
          setStats(mappedStats);
        }
        if (chartRes.data) setChartData(chartRes.data);
        
        // Prefer top sellers from API if available, otherwise compute from sales context
        // Helper to resolve unknown seller names via API lookup
        const resolveSellerNames = async (list: TopSeller[]) => {
          if (!Array.isArray(list) || list.length === 0) {
            setTopSellers(list);
            return;
          }

          const resolved = await Promise.all(list.map(async (s) => {
            if (s.userName && s.userName !== 'Unknown') return s;
            if (!s.userId) return s;
            try {
              const res = await userService.getById(s.userId);
              if (res && (res as any).data) {
                const u = (res as any).data as any;
                return { ...s, userName: u.name || s.userName, foCode: u.foCode || s.foCode };
              }
            } catch (e) {
              // ignore
            }
            return s;
          }));

          setTopSellers(resolved);
        };

        if (sellersRes && sellersRes.data && Array.isArray(sellersRes.data) && sellersRes.data.length > 0) {
          // use API list but resolve missing names
          await resolveSellerNames(sellersRes.data as TopSeller[]);
        } else {
          // Build seller map from sales data
          const sellerMap = new Map<string, { name: string; count: number; revenue: number }>();
          const sourceSales = Array.isArray(sales) ? sales : [];

          sourceSales.forEach((sale) => {
            const foId = sale.foId || sale.createdBy;
            if (!foId) return;

            let sellerName = sale.sellerName || sale.foName;
            if (!sellerName) {
              const seller = users.find(u => u.id === foId);
              sellerName = seller?.name || 'Unknown';
            }

            if (!sellerMap.has(foId)) sellerMap.set(foId, { name: sellerName, count: 0, revenue: 0 });
            const data = sellerMap.get(foId)!;
            data.count += 1;
            data.revenue += sale.saleAmount || 0;
          });

          const calculated = Array.from(sellerMap.entries())
            .map(([userId, data]) => {
              const userObj = users.find(u => u.id === userId);
              const finalName = data.name !== 'Unknown' ? data.name : (userObj?.name || 'Unknown');
              return {
                userId,
                userName: finalName,
                foCode: userObj?.foCode || '',
                region: userObj?.region || '',
                salesCount: data.count,
                totalRevenue: data.revenue,
                commission: 0,
              };
            })
            .sort((a, b) => b.totalRevenue - a.totalRevenue)
            .slice(0, 5);

          // resolve missing names for calculated list
          await resolveSellerNames(calculated);
        }

        // Handle both data and sales fields for recent sales
        // Robustly parse recent sales response (support array or object shapes)
        const salesDataRaw = salesRes?.data;
        let parsedRecent: any[] = [];
        if (Array.isArray(salesDataRaw)) {
          parsedRecent = salesDataRaw.slice(0, 5);
        } else if (salesDataRaw) {
          parsedRecent = (salesDataRaw as any).data || (salesDataRaw as any).sales || [];
        }

        // Enrich recent sales with seller names from users array
        const enrichRecentSales = (salesList: any[]) => {
          return salesList.map(sale => {
            const userId = sale.createdBy || sale.foId;
            const user = users.find(u => u.id === userId);
            return {
              ...sale,
              sellerName: sale.sellerName || sale.foName || user?.name || 'Unknown',
            };
          });
        };

        if (Array.isArray(parsedRecent) && parsedRecent.length > 0) {
          setRecentSales(enrichRecentSales(parsedRecent.slice(0, 5)));
        } else {
          // Fallback: Use sales from context (most reliable)
          const recentFromContext = (Array.isArray(sales) ? sales : [])
            .slice()
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5);
          setRecentSales(enrichRecentSales(recentFromContext));
        }
      } catch (error) {
        // Provide richer logging for ApiClientError instances
        if (error instanceof ApiClientError) {
          console.error('API client error:', error.getDetailedInfo());
          toast.error(error.getDisplayMessage());
        } else {
          console.error('Failed to load dashboard data:', error);
          toast.error((error as any)?.message || 'Failed to load dashboard data');
        }
        
        // Use context data as fallback on error
        const sellerMap = new Map<string, { name: string; count: number; revenue: number }>();
        sales.forEach((sale) => {
          const foId = sale.foId || sale.createdBy;
          let sellerName = sale.sellerName || sale.foName;
          if (!sellerName) {
            const seller = users.find(u => u.id === foId);
            sellerName = seller?.name || 'Unknown';
          }
          
          if (!sellerMap.has(foId)) {
            sellerMap.set(foId, { name: sellerName, count: 0, revenue: 0 });
          }
          const data = sellerMap.get(foId)!;
          data.count += 1;
          data.revenue += sale.saleAmount || 0;
        });
        
        const calculated = Array.from(sellerMap.entries())
          .map(([userId, data]) => {
            const userObj = users.find(u => u.id === userId);
            const finalName = data.name !== 'Unknown' ? data.name : (userObj?.name || 'Unknown');
            return {
              userId,
              userName: finalName,
              foCode: userObj?.foCode || '',
              region: userObj?.region || '',
              salesCount: data.count,
              totalRevenue: data.revenue,
              commission: 0,
            };
          })
          .sort((a, b) => b.totalRevenue - a.totalRevenue)
          .slice(0, 5);
        
        // Try to resolve unknown names via API before setting
        try {
          const resolved = await Promise.all(calculated.map(async (s) => {
            if (s.userName && s.userName !== 'Unknown') return s;
            if (!s.userId) return s;
            try {
              const res = await userService.getById(s.userId);
              if (res && (res as any).data) {
                const u = (res as any).data as any;
                return { ...s, userName: u.name || s.userName, foCode: u.foCode || s.foCode };
              }
            } catch (e) {
              // ignore
            }
            return s;
          }));
          setTopSellers(resolved);
        } catch (e) {
          setTopSellers(calculated);
        }
        
        const recentFromContext = sales
          .slice()
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5)
          .map(sale => {
            const userId = sale.createdBy || sale.foId;
            const user = users.find(u => u.id === userId);
            return {
              ...sale,
              sellerName: sale.sellerName || sale.foName || user?.name || 'Unknown',
            };
          });
        setRecentSales(recentFromContext);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [sales, users, products, commissions, imeis]);

  // Transform chart data to match component format
  const transformedChartData = useMemo(() => {
    return chartData.map((point: any) => {
      // Handle both point.date and point._id field names
      const dateStr = point.date || point._id;
      // Parse date string in format YYYY-MM-DD
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      return {
        name: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        value: point.revenue || point.sales || 0,
      };
    });
  }, [chartData]);

  // Calculate stats from context if API stats are not available
  const calculatedStats = useMemo(() => {
    if (stats) return stats;
    
    const totalRevenue = sales.reduce((sum, s) => sum + (s.saleAmount || 0), 0);
    const totalSalesCount = sales.length;
    
    // Get today's sales
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySales = sales.filter(s => {
      const saleDate = new Date(s.createdAt);
      saleDate.setHours(0, 0, 0, 0);
      return saleDate.getTime() === today.getTime();
    });
    const todayRevenue = todaySales.reduce((sum, s) => sum + (s.saleAmount || 0), 0);
    
    // derive inventory and commission figures from context
    const totalPhoneStock = (products || []).reduce((sum, p) => sum + (p.stockQuantity || 0), 0);
    const imeiInStock = (imeis || []).filter(i => i.status === 'IN_STOCK').length;
    const imeiAllocated = (imeis || []).filter(i => i.status === 'ALLOCATED').length;
    // Total phones in stock = IN_STOCK + ALLOCATED (both are available in the system)
    const phonesInStock = totalPhoneStock + imeiInStock + imeiAllocated;
    const phonesSold = totalSalesCount; // best-effort fallback
    const pendingCommissions = (commissions || []).filter(c => c.status === 'pending').reduce((s, c) => s + (c.amount || 0), 0);
    const totalCommissionsPaid = (commissions || []).filter(c => c.status === 'paid').reduce((s, c) => s + (c.amount || 0), 0);

    return {
      totalRevenue,
      todayRevenue,
      totalSales: totalSalesCount,
      todaySales: todaySales.length,
      totalPhones: totalPhoneStock + imeiInStock + imeiAllocated,
      phonesInStock,
      phonesSold,
      allocatedPhones: imeiAllocated,
      pendingCommissions,
      totalCommissionsPaid,
    };
  }, [stats, sales, products, commissions, imeis]);

  // Calculate sales by category from recent sales
  const salesByCategoryData = useMemo(() => {
    const categoryMap = new Map<string, number>();
    recentSales.forEach((sale) => {
      const category = sale.productName || 'Other';
      categoryMap.set(category, (categoryMap.get(category) || 0) + sale.saleAmount);
    });
    
    return Array.from(categoryMap.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  }, [recentSales]);

  return (
    <MainLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-heading font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {currentUser?.name}. Here's your business overview.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Total Revenue Card */}
          <StatCard
            title="Total Revenue"
            value={isLoading ? '...' : `Ksh ${(calculatedStats?.totalRevenue || 0).toLocaleString()}`}
            subtitle="This month"
            icon={DollarSign}
            variant="primary"
            trend={{ value: 12.5, isPositive: true }}
          />
          
          {/* Today's Sales Card */}
          <StatCard
            title="Today's Sales"
            value={isLoading ? '...' : calculatedStats?.todaySales || 0}
            subtitle={`Ksh ${isLoading ? '...' : (calculatedStats?.todayRevenue || 0).toLocaleString()}`}
            icon={ShoppingCart}
            variant="success"
            trend={{ value: 8.2, isPositive: true }}
          />

          {/* Phones in Stock | Allocated Stock Card */}
          <Card className="border shadow-sm">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Smartphone className="h-5 w-5 text-accent" />
                    <p className="text-sm text-muted-foreground">Phones In Stock</p>
                  </div>
                  <p className="text-3xl font-bold text-foreground">
                    {isLoading ? '...' : (calculatedStats?.phonesInStock || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Available</p>
                </div>
                <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-5 w-5 text-warning" />
                    <p className="text-sm text-muted-foreground">Allocated</p>
                  </div>
                  <p className="text-3xl font-bold text-foreground">
                    {isLoading ? '...' : (calculatedStats?.allocatedPhones || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Field Officers</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Commission | Paid Commission Card */}
          <Card className="border shadow-sm">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/30">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-warning" />
                    <p className="text-sm text-muted-foreground">Pending</p>
                  </div>
                  <p className="text-3xl font-bold text-foreground">
                    {isLoading ? '...' : `Ksh ${(calculatedStats?.pendingCommissions || 0).toLocaleString()}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">To be paid</p>
                </div>
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-5 w-5 text-success" />
                    <p className="text-sm text-muted-foreground">Paid</p>
                  </div>
                  <p className="text-3xl font-bold text-foreground">
                    {isLoading ? '...' : `Ksh ${(calculatedStats?.totalCommissionsPaid || 0).toLocaleString()}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <RevenueChart data={transformedChartData} />
          </div>
          {/* Company Performance */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Company Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground">Loading...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
                    <p className="text-2xl font-bold text-primary">Ksh {(calculatedStats?.totalRevenue || 0).toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-success/10">
                    <p className="text-xs text-muted-foreground mb-1">Total Sales</p>
                    <p className="text-2xl font-bold text-success">{calculatedStats?.totalSales || 0}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-accent/10">
                    <p className="text-xs text-muted-foreground mb-1">Phones in Stock</p>
                    <p className="text-2xl font-bold text-accent">{calculatedStats?.phonesInStock || 0}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-warning/10">
                    <p className="text-xs text-muted-foreground mb-1">Pending Commissions</p>
                    <p className="text-2xl font-bold text-warning">Ksh {(calculatedStats?.pendingCommissions || 0).toLocaleString()}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row - Sales by Category */}
        <div className="mb-8">
          <SalesPieChart data={salesByCategoryData} />
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Performers */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Top Field Officers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground">Loading...</p>
                </div>
              ) : topSellers.length > 0 ? (
                <div className="space-y-3">
                  {topSellers.map((seller, index) => (
                    <div key={seller.userId} className="p-3 rounded-lg bg-gradient-to-r from-primary/5 to-transparent border border-primary/10">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                            index === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{seller.userName || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{seller.salesCount} sales</p>
                          </div>
                        </div>
                        <p className="font-bold text-primary">Ksh {seller.totalRevenue.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No sellers yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Sales */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Recent Sales
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground">Loading...</p>
                </div>
              ) : recentSales.length > 0 ? (
                <div className="space-y-4">
                  {recentSales.map((sale) => (
                    <div key={sale.id} className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                        <Smartphone className="h-5 w-5 text-secondary-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{sale.productName}</p>
                        <p className="text-sm text-muted-foreground">
                          {sale.sellerName} • {sale.imei ? `IMEI: ${sale.imei.slice(-6)}` : 'Accessory'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-foreground">Ksh {sale.saleAmount.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(sale.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No sales yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
