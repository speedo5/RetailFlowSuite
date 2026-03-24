import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Users, 
  Globe, 
  Briefcase, 
  UserCheck, 
  TrendingUp, 
  DollarSign,
  Phone,
  Building2,
  RotateCcw,
  Package,
  ShoppingCart
} from 'lucide-react';
import { PhoneSource } from '@/types';
import { salesService } from '@/services/salesService';
import { userService } from '@/services/userService';
import { commissionService } from '@/services/commissionService';
import * as stockAllocationService from '@/services/stockAllocationService';
import { imeiService } from '@/services/imeiService';
import { toast } from 'sonner';

export default function RegionalDashboard() {
  const { currentUser } = useApp();
  const [activeTab, setActiveTab] = useState('overview');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  
  // Data from API
  const [loadedUsers, setLoadedUsers] = useState<any[]>([]);
  const [loadedSales, setLoadedSales] = useState<any[]>([]);
  const [loadedCommissions, setLoadedCommissions] = useState<any[]>([]);
  const [loadedImeis, setLoadedImeis] = useState<any[]>([]);
  const [allocatedStock, setAllocatedStock] = useState<any[]>([]);

  // Get current regional manager's region
  const myRegion = currentUser?.region;

  // Load data from database on mount
  useEffect(() => {
    if (!currentUser) return;

    const loadData = async () => {
      try {
        setIsLoading(true);

        // Load users from database
        const usersResponse = await userService.getAll();
        if (usersResponse.success && usersResponse.data) {
          const users = Array.isArray(usersResponse.data) ? usersResponse.data : (usersResponse.data as any)?.data || [];
          setLoadedUsers(users);
        }

        // Load sales from database
        const salesResponse = await salesService.getAll();
        if (salesResponse.success && salesResponse.data) {
          const sales = Array.isArray(salesResponse.data) ? salesResponse.data : (salesResponse.data as any)?.data || [];
          setLoadedSales(sales);
        }

        // Load commissions from database
        const commissionsResponse = await commissionService.getAll();
        if (commissionsResponse.success && commissionsResponse.data) {
          const commissions = Array.isArray(commissionsResponse.data) ? commissionsResponse.data : (commissionsResponse.data as any)?.data || [];
          setLoadedCommissions(commissions);
        }
        
        // Load allocated stock (current holder view) for the Regional Manager
        try {
          const stockResp = await stockAllocationService.getAvailableStock();
          if (stockResp && stockResp.success && stockResp.data) {
            const stock = Array.isArray(stockResp.data) ? stockResp.data : (stockResp.data as any)?.data || [];
            // API returns IMEI records whose `currentHolderId` is the current user for non-admins.
            // Set directly so items moved to TL (whose currentHolderId changes) will not appear here.
            setAllocatedStock(stock);
          }
        } catch (err) {
          console.error('Error loading allocated stock:', err);
        }

        // Load IMEIs to get source information
        try {
          const imeisResponse = await imeiService.getAll();
          if (imeisResponse && imeisResponse.success && imeisResponse.data) {
            const imeis = Array.isArray(imeisResponse.data) ? imeisResponse.data : (imeisResponse.data as any)?.data || [];
            setLoadedImeis(imeis);
          }
        } catch (err) {
          console.error('Error loading IMEIs:', err);
        }
      } catch (error) {
        console.error('Failed to load regional dashboard data:', error);
        toast.error('Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [currentUser]);

  // Get team leaders in this region
  const teamLeaders = useMemo(() => 
    loadedUsers.filter(u => 
      u.role === 'team_leader' && 
      (u.region === myRegion || u.regionalManagerId === currentUser?.id)
    ), [loadedUsers, myRegion, currentUser?.id]
  );

  // Get FOs under those team leaders
  const fieldOfficers = useMemo(() => 
    loadedUsers.filter(u => 
      u.role === 'field_officer' && 
      (u.region === myRegion || teamLeaders.some(tl => tl.id === u.teamLeaderId))
    ), [loadedUsers, myRegion, teamLeaders]
  );

  // All team member IDs (team leaders + FOs)
  const teamMemberIds = useMemo(() =>
    [...teamLeaders.map(t => t.id), ...fieldOfficers.map(f => f.id)],
    [teamLeaders, fieldOfficers]
  );

  // Get sales from this region's team (include sales created by the RM themself)
  const regionSales = useMemo(() => 
    loadedSales.filter(sale => {
      // Include sales by RM themselves
      const isCreatedByRM = sale.createdBy === currentUser?.id;
      
      // Include sales by team members (TL and FO)
      const matchesTeam = teamMemberIds.some(memberId => 
        memberId === sale.createdBy || memberId === sale.foId
      ) || fieldOfficers.some(fo => fo.foCode === sale.foCode);
      
      // Alternative: include if sale is in the same region
      const matchesRegion = sale.region === myRegion;
      
      const matchesSource = sourceFilter === 'all' || sale.source === sourceFilter;
      
      // include if it's from the team OR created by the regional manager OR in the same region
      return (matchesTeam || isCreatedByRM || matchesRegion) && matchesSource;
    }), [loadedSales, teamMemberIds, fieldOfficers, sourceFilter, currentUser?.id, myRegion]
  );

  // Get commissions for this region (RM's own commissions + team members' commissions)
  const regionCommissions = useMemo(() =>
    loadedCommissions.filter(comm =>
      // Include RM's own commissions (userId matches RM)
      comm.userId === currentUser?.id ||
      // Include team members' commissions (foId or userId matches FOs/TLs in region)
      fieldOfficers.some(fo => fo.id === comm.userId || fo.id === comm.foId) ||
      teamLeaders.some(tl => tl.id === comm.userId || tl.id === comm.foId)
    ), [loadedCommissions, fieldOfficers, teamLeaders, currentUser?.id]
  );

  // Stats
  const totalRevenue = useMemo(() =>
    regionSales.reduce((sum, s) => sum + s.saleAmount, 0),
    [regionSales]
  );
  
  const totalCommissions = useMemo(() =>
    regionCommissions.reduce((sum, c) => sum + c.amount, 0),
    [regionCommissions]
  );
  
  const pendingCommissions = useMemo(() =>
    regionCommissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0),
    [regionCommissions]
  );

  // Sales by source
  const salesBySource = useMemo(() => ({
    watu: regionSales.filter(s => s.source === 'watu').reduce((sum, s) => sum + s.saleAmount, 0),
    mogo: regionSales.filter(s => s.source === 'mogo').reduce((sum, s) => sum + s.saleAmount, 0),
    onfon: regionSales.filter(s => s.source === 'onfon').reduce((sum, s) => sum + s.saleAmount, 0),
  }), [regionSales]);

  const getSourceBadgeClass = (source: PhoneSource | string) => {
    switch (source) {
      case 'watu': return 'bg-watu text-white';
      case 'mogo': return 'bg-mogo text-white';
      case 'onfon': return 'bg-onfon text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  // Check access
  if (currentUser?.role !== 'regional_manager' && currentUser?.role !== 'admin') {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Access denied. Regional Manager only.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground flex items-center gap-2">
              <Globe className="h-6 w-6 text-primary" />
              Regional Dashboard
            </h1>
            <div className="text-sm text-muted-foreground mt-1 space-y-1">
              {myRegion && (
                <p>
                  <span className="font-medium text-foreground">{myRegion}</span> Region
                </p>
              )}
              {currentUser?.name && (
                <p>
                  Regional Manager: <span className="font-medium text-foreground">{currentUser.name}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => {
                setIsLoading(true);
                Promise.all([
                  userService.getAll(),
                  salesService.getAll(),
                  commissionService.getAll()
                ]).then(([usersRes, salesRes, commissionsRes]) => {
                  if (usersRes.success && usersRes.data) setLoadedUsers(Array.isArray(usersRes.data) ? usersRes.data : (usersRes.data as any)?.data || []);
                  if (salesRes.success && salesRes.data) setLoadedSales(Array.isArray(salesRes.data) ? salesRes.data : (salesRes.data as any)?.data || []);
                  if (commissionsRes.success && commissionsRes.data) setLoadedCommissions(Array.isArray(commissionsRes.data) ? commissionsRes.data : (commissionsRes.data as any)?.data || []);
                  // Refresh allocated stock
                  stockAllocationService.getAvailableStock().then((allocResponse) => {
                    if (allocResponse.success && allocResponse.data) {
                      const stock = Array.isArray(allocResponse.data) ? allocResponse.data : (allocResponse.data as any)?.data || [];
                      const rmAllocated = stock.filter((item: any) => item.currentHolderId === currentUser?.id || item.currentOwnerId === currentUser?.id);
                      setAllocatedStock(rmAllocated);
                    }
                  });
                  toast.success('Dashboard refreshed');
                }).catch(() => {
                  toast.error('Failed to refresh dashboard');
                }).finally(() => {
                  setIsLoading(false);
                });
              }}
              disabled={isLoading}
              className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
              title="Refresh dashboard data"
            >
              <RotateCcw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                <SelectItem value="watu">Watu</SelectItem>
                <SelectItem value="mogo">Mogo</SelectItem>
                <SelectItem value="onfon">Onfon</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <Card className="border shadow-sm">
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-success shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">Ksh {totalRevenue.toLocaleString()}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Region Revenue</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">{regionSales.length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Sales</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <Briefcase className="h-6 w-6 sm:h-8 sm:w-8 text-warning shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">{teamLeaders.length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Team Leaders</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <UserCheck className="h-6 w-6 sm:h-8 sm:w-8 text-success shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">{fieldOfficers.length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Field Officers</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Allocated Stock */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-500" />
              My Allocated Stock
              <Badge variant="outline" className="ml-auto">
                {allocatedStock.length} items
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allocatedStock.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
                <p className="text-muted-foreground">No stock allocated to you yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(allocatedStock.reduce((groupedByProduct: any, item: any) => {
                  const productName = typeof item.productId === 'object' ? item.productId.name : item.productName;
                  if (!groupedByProduct[productName]) {
                    groupedByProduct[productName] = [];
                  }
                  groupedByProduct[productName].push(item);
                  return groupedByProduct;
                }, {})).map(([productName, items]: [string, any[]]) => {
                  // Calculate total value using product price or fallback price
                  const totalValue = items.reduce((sum, item) => {
                    const price = typeof item.productId === 'object' && item.productId.price 
                      ? item.productId.price 
                      : item.sellingPrice || 0;
                    return sum + price;
                  }, 0);

                  // Get unique sources from all items by looking up IMEIs
                  const uniqueSources = Array.from(new Set(
                    items
                      .map((item: any) => {
                        // Try to get source from the imeiId directly if it's an object
                        if (typeof item.imeiId === 'object' && item.imeiId?.source) {
                          return item.imeiId.source;
                        }
                        // Try to find the IMEI in loadedImeis to get its source
                        const imeiId = typeof item.imeiId === 'string' ? item.imeiId : (typeof item.imeiId === 'object' ? item.imeiId?._id : null);
                        const imeiRecord = loadedImeis.find((i: any) => i.id === imeiId || i._id === imeiId);
                        return imeiRecord?.source || item.source;
                      })
                      .filter((s: any) => s)
                  ));

                  return (
                    <div key={productName} className="p-4 rounded-lg border border-border bg-muted/20">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-foreground">{productName}</p>
                          <p className="text-sm text-muted-foreground">{items.length} units</p>
                        </div>
                        <Badge variant="default">{items.length}</Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Value</span>
                          <span className="font-medium">Ksh {totalValue.toLocaleString()}</span>
                        </div>
                        {uniqueSources.length > 0 && (
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-muted-foreground">Source{uniqueSources.length > 1 ? 's' : ''}</span>
                            <div className="flex flex-wrap gap-1 justify-end">
                              {uniqueSources.map((source: any) => (
                                <Badge key={source} variant="outline" className="capitalize">{source}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Company-wise Sales */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {(['watu', 'mogo', 'onfon'] as PhoneSource[]).map(source => (
            <Card key={source} className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${getSourceBadgeClass(source)}`}>
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium capitalize">{source}</p>
                      <p className="text-xs text-muted-foreground">
                        {regionSales.filter(s => s.source === source).length} sales
                      </p>
                    </div>
                  </div>
                  <p className="text-lg font-bold">
                    Ksh {salesBySource[source].toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3 mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="team-leaders">Team Leaders</TabsTrigger>
            <TabsTrigger value="field-officers">Field Officers</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Recent Sales
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {regionSales.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No sales yet</p>
                  ) : (
                    <div className="space-y-3">
                      {regionSales.slice(0, 5).map(sale => (
                        <div key={sale.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <p className="font-medium text-sm">{sale.productName}</p>
                            <p className="text-xs text-muted-foreground">{sale.sellerName}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm text-success">Ksh {sale.saleAmount.toLocaleString()}</p>
                            {sale.source && (
                              <Badge className={`text-xs ${getSourceBadgeClass(sale.source)}`}>
                                {sale.source.toUpperCase()}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-warning" />
                    Commission Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg">
                      <span className="text-sm">Total Paid</span>
                      <span className="font-bold text-success">
                        Ksh {(totalCommissions - pendingCommissions).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-warning/10 rounded-lg">
                      <span className="text-sm">Pending</span>
                      <span className="font-bold text-warning">
                        Ksh {pendingCommissions.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <span className="text-sm font-medium">Total</span>
                      <span className="font-bold">
                        Ksh {totalCommissions.toLocaleString()}
                      </span>
                    </div>
                    
                    {/* Breakdown by Role */}
                    <div className="pt-4 border-t space-y-3">
                      <p className="text-sm font-medium text-muted-foreground">Breakdown by Role</p>
                      {(() => {
                        const rmCommissions = regionCommissions.filter(c => c.role === 'regional_manager');
                        const tlCommissions = regionCommissions.filter(c => c.role === 'team_leader');
                        const foCommissions = regionCommissions.filter(c => c.role === 'field_officer');
                        
                        const rmTotal = rmCommissions.reduce((sum, c) => sum + c.amount, 0);
                        const tlTotal = tlCommissions.reduce((sum, c) => sum + c.amount, 0);
                        const foTotal = foCommissions.reduce((sum, c) => sum + c.amount, 0);
                        
                        const rmPending = rmCommissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0);
                        const tlPending = tlCommissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0);
                        const foPending = foCommissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0);
                        
                        return (
                          <>
                            <div className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                              <span>RM</span>
                              <div className="text-right">
                                <p className="font-bold">Ksh {rmTotal.toLocaleString()}</p>
                                <p className="text-xs text-warning">{rmPending > 0 ? `Ksh ${rmPending.toLocaleString()} pending` : 'All Paid'}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                              <span>TL</span>
                              <div className="text-right">
                                <p className="font-bold">Ksh {tlTotal.toLocaleString()}</p>
                                <p className="text-xs text-warning">{tlPending > 0 ? `Ksh ${tlPending.toLocaleString()} pending` : 'All Paid'}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                              <span>FO</span>
                              <div className="text-right">
                                <p className="font-bold">Ksh {foTotal.toLocaleString()}</p>
                                <p className="text-xs text-warning">{foPending > 0 ? `Ksh ${foPending.toLocaleString()} pending` : 'All Paid'}</p>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Team Leaders Tab */}
          <TabsContent value="team-leaders">
            <Card className="border shadow-sm">
              <CardHeader className="border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-warning" />
                  Team Leaders in {myRegion || 'Your Region'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {teamLeaders.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No team leaders in this region</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {teamLeaders.map(tl => {
                      const tlFOs = fieldOfficers.filter(fo => fo.teamLeaderId === tl.id);
                      // Sales created by the team leader themself
                      const tlSelfSales = regionSales.filter(s => s.createdBy === tl.id || s.createdBy === tl._id);
                      // Sales created by FOs under this team leader
                      const tlFOSales = regionSales.filter(s =>
                        tlFOs.some(fo => fo.foCode === s.foCode || fo.id === s.createdBy || fo._id === s.createdBy)
                      );
                      // Merge and dedupe sales
                      const tlSalesMap = new Map<string, any>();
                      [...tlSelfSales, ...tlFOSales].forEach(s => { if (s?.id) tlSalesMap.set(s.id, s); });
                      const tlSales = Array.from(tlSalesMap.values());
                      const tlRevenue = tlSales.reduce((sum, s) => sum + (s.saleAmount || 0), 0);
                      
                      // Team leader commissions (filter by userId and role, not teamLeaderId)
                      const tlCommissionEntries = loadedCommissions.filter(c => (c.userId === tl.id || c.foId === tl.id) && c.role === 'team_leader');
                      const tlCommissionsTotal = tlCommissionEntries.reduce((sum, c) => sum + (c.amount || 0), 0);
                      const tlCommissionsPaid = tlCommissionEntries.filter(c => c.status === 'paid').reduce((sum, c) => sum + (c.amount || 0), 0);
                      const tlCommissionsPending = tlCommissionEntries.filter(c => c.status === 'pending').reduce((sum, c) => sum + (c.amount || 0), 0);
 
                       return (
                         <Card key={tl.id} className="border-l-4 border-l-warning bg-gradient-to-br from-warning/5 to-transparent hover:shadow-md transition-all">
                           <CardContent className="p-4">
                             {/* Header with name and contact */}
                             <div className="flex items-center gap-3 mb-4 pb-4 border-b">
                               <div className="h-12 w-12 rounded-full bg-warning flex items-center justify-center flex-shrink-0">
                                 <Briefcase className="h-6 w-6 text-warning-foreground" />
                               </div>
                               <div className="flex-1 min-w-0">
                                 <p className="font-semibold text-foreground">{tl.name}</p>
                                 <p className="text-sm text-muted-foreground truncate">{tl.email}</p>
                               </div>
                             </div>

                             {/* Primary metrics */}
                             <div className="grid grid-cols-2 gap-3 mb-4">
                               <div className="bg-success/10 rounded-lg p-3 border border-success/20">
                                 <p className="text-xs font-medium text-muted-foreground mb-1">Revenue</p>
                                 <p className="font-bold text-success text-lg">Ksh {tlRevenue.toLocaleString()}</p>
                               </div>
                               <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
                                 <p className="text-xs font-medium text-muted-foreground mb-1">Sales</p>
                                 <p className="font-bold text-blue-600 text-lg">{tlSales.length}</p>
                                 <p className="text-xs text-muted-foreground">{tlFOs.length} FOs</p>
                               </div>
                             </div>

                             {/* Commission metrics */}
                             <div className="space-y-2 pt-3 border-t">
                               <div className="flex items-center justify-between">
                                 <p className="text-sm font-medium text-foreground">Commission Total</p>
                                 <p className="font-semibold text-primary">Ksh {tlCommissionsTotal.toLocaleString()}</p>
                               </div>
                               <div className="flex items-center justify-between text-sm">
                                 <div className="flex gap-4">
                                   <div>
                                     <span className="text-muted-foreground">Paid: </span>
                                     <span className="font-medium text-green-600">Ksh {tlCommissionsPaid.toLocaleString()}</span>
                                   </div>
                                   <div>
                                     <span className="text-muted-foreground">Pending: </span>
                                     <span className="font-medium text-orange-600">Ksh {tlCommissionsPending.toLocaleString()}</span>
                                   </div>
                                 </div>
                               </div>
                             </div>

                             {/* Self sales badge */}
                             <div className="mt-3 pt-3 border-t">
                               <Badge variant="outline" className="bg-purple-500/10 text-purple-700 border-purple-500/30">
                                 TL Self Sales: {tlSelfSales.length}
                               </Badge>
                             </div>
                           </CardContent>
                         </Card>
                       );
                     })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Field Officers Tab */}
          <TabsContent value="field-officers">
            <Card className="border shadow-sm overflow-hidden">
              <CardHeader className="border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-success" />
                  Field Officers in {myRegion || 'Your Region'}
                </CardTitle>
              </CardHeader>
              {/* Mobile Cards */}
              <div className="block lg:hidden p-4 space-y-3">
                {fieldOfficers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No field officers in this region
                  </div>
                ) : (
                  <div className="space-y-3">
                    {fieldOfficers.map(fo => {
                      const foSales = regionSales.filter(s => s.foCode === fo.foCode || s.createdBy === fo.id || s.createdBy === fo._id);
                      const foRevenue = foSales.reduce((sum, s) => sum + s.saleAmount, 0);
                      const teamLeader = loadedUsers.find(u => u.id === fo.teamLeaderId);

                      return (
                        <Card key={fo.id} className="border border-success/20 bg-success/5">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-full bg-success flex items-center justify-center shrink-0">
                              <UserCheck className="h-5 w-5 text-success-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate">{fo.name}</p>
                                <Badge className="bg-success/20 text-success border-0 text-xs">
                                  {fo.foCode}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground truncate">{fo.email}</p>
                              {fo.phone && (
                                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                  <Phone className="h-3 w-3" /> {fo.phone}
                                </p>
                              )}
                              {teamLeader && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  TL: {teamLeader.name}
                                </p>
                              )}
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-muted-foreground">{foSales.length} sales</span>
                                <span className="font-bold text-success">Ksh {foRevenue.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>FO Code</th>
                      <th>Name</th>
                      <th>Team Leader</th>
                      <th>Phone</th>
                      <th>Sales</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fieldOfficers.map(fo => {
                      const foSales = regionSales.filter(s => s.foCode === fo.foCode || s.createdBy === fo.id);
                      const foRevenue = foSales.reduce((sum, s) => sum + s.saleAmount, 0);
                      const teamLeader = loadedUsers.find(u => u.id === fo.teamLeaderId);

                      return (
                        <tr key={fo.id}>
                          <td>
                            <Badge className="bg-success/20 text-success border-0">
                              {fo.foCode}
                            </Badge>
                          </td>
                          <td>
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-success flex items-center justify-center">
                                <UserCheck className="h-4 w-4 text-success-foreground" />
                              </div>
                              <div>
                                <p className="font-medium">{fo.name}</p>
                                <p className="text-xs text-muted-foreground">{fo.email}</p>
                              </div>
                            </div>
                          </td>
                          <td>{teamLeader?.name || '-'}</td>
                          <td className="text-muted-foreground">{fo.phone || '-'}</td>
                          <td>{foSales.length}</td>
                          <td className="font-bold text-success">Ksh {foRevenue.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}