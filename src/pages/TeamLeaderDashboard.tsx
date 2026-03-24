import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Users, TrendingUp, DollarSign, Phone, Search, Download, Calendar, Target, Award, Package, ShoppingCart, List, Grid } from 'lucide-react';
import { exportSales } from '@/lib/pdfGenerator';
import { userService } from '@/services/userService';
import { salesService } from '@/services/salesService';
import { commissionService } from '@/services/commissionService';
import * as stockAllocationService from '@/services/stockAllocationService';
import { toast } from 'sonner';

const TeamLeaderDashboard = () => {
  const { currentUser, products } = useApp();
  const [selectedFO, setSelectedFO] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // API Data state
  const [myFOs, setMyFOs] = useState<any[]>([]);
  const [teamSales, setTeamSales] = useState<any[]>([]);
  const [teamCommissions, setTeamCommissions] = useState<any[]>([]);
  const [allocatedStock, setAllocatedStock] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [foView, setFoView] = useState<'list' | 'grid'>('grid');
  const [commissionView, setCommissionView] = useState<'list' | 'grid'>('grid');

  // Load team members and statistics from APIs
  useEffect(() => {
    const loadTeamData = async () => {
      try {
        setIsLoading(true);
        
        if (!currentUser?.id || !currentUser?.region) return;

        // Fetch all team leaders in the current user's region
        const tlResponse = await userService.getAll({ role: 'team_leader', region: currentUser.region });
        const teamLeaders = Array.isArray(tlResponse) 
          ? tlResponse 
          : (tlResponse as any)?.data?.users || (tlResponse as any)?.data || [];

        // Fetch all field officers in the region
        const fosResponse = await userService.getAll({ role: 'field_officer', region: currentUser.region });
        const fos = Array.isArray(fosResponse) 
          ? fosResponse 
          : (fosResponse as any)?.data?.users || (fosResponse as any)?.data || [];
        
        // Remove duplicates and filter to only show FOs assigned to this team leader
        const allFOs = Array.from(
          new Map(fos.map((fo: any) => [fo.id || fo._id, fo])).values()
        );
        
        // Filter to only FOs assigned to this team leader
        const uniqueFOs = allFOs.filter((fo: any) => {
          // Handle both cases: teamLeaderId as object (populated) or as string (ID)
          const foTeamLeaderId = typeof fo.teamLeaderId === 'object' 
            ? (fo.teamLeaderId?._id || fo.teamLeaderId?.id)
            : (fo.teamLeaderId || (fo as any).team_leader_id);
          
          const currentUserId = currentUser.id || currentUser._id;
          const result = foTeamLeaderId === currentUserId;
          
          console.log(`🔍 FO ${fo.name}: foTeamLeaderId=${foTeamLeaderId}, currentUserId=${currentUserId}, match=${result}`);
          
          return result;
        });
        
        setMyFOs(uniqueFOs);

        // Fetch all sales
        const salesResponse = await salesService.getAll();
        const allSales = Array.isArray(salesResponse)
          ? salesResponse
          : (salesResponse as any)?.data?.sales || (salesResponse as any)?.data || [];
        
        // Filter sales by region FOs
        const foIds = uniqueFOs.map((fo: any) => fo.id || fo._id);
        const filteredSales = allSales.filter((s: any) => foIds.includes(s.createdBy) || foIds.includes(s.foId));
        setTeamSales(filteredSales);

        // Fetch all commissions
        const commsResponse = await commissionService.getAll();
        const allComms = Array.isArray(commsResponse)
          ? commsResponse
          : (commsResponse as any)?.data?.commissions || (commsResponse as any)?.data || [];
        
        // Filter commissions by region FOs (check both userId and foId for backward compatibility)
        const filteredComms = allComms.filter((c: any) => 
          foIds.includes(c.userId) || foIds.includes(c.foId)
        );
        setTeamCommissions(filteredComms);

        // Fetch allocated stock for the Team Leader
        try {
          const allocResponse = await stockAllocationService.getAvailableStock();
          if (allocResponse.success && allocResponse.data) {
            const stock = Array.isArray(allocResponse.data) ? allocResponse.data : (allocResponse.data as any)?.data || [];
            // Filter stock allocated to this Team Leader
            const tlAllocated = stock.filter((item: any) => item.currentHolderId === currentUser?.id || item.currentOwnerId === currentUser?.id);
            
            // Transform and enrich with product info
            const enrichedStock = tlAllocated.map((item: any) => {
              const productId = typeof item.productId === 'object' ? item.productId._id : item.productId;
              const productName = typeof item.productId === 'object' ? item.productId.name : item.productName;
              const product = products.find(p => p.id === productId);
              const sellingPrice = item.sellingPrice || product?.price || 0;
              
              return {
                id: item._id || item.id,
                imei: item.imei,
                productId: productId,
                productName: productName,
                capacity: item.capacity,
                status: item.status,
                sellingPrice: sellingPrice,
                commission: item.commission || 0,
                source: item.source || 'watu',
                registeredAt: item.registeredAt,
              };
            });
            
            setAllocatedStock(enrichedStock);
          }
        } catch (err) {
          console.error('Error loading allocated stock:', err);
          // Continue without allocated stock data
        }
      } catch (error: any) {
        console.error('Error loading team data:', error);
        toast.error('Failed to load team data');
      } finally {
        setIsLoading(false);
      }
    };

    loadTeamData();
  }, [currentUser?.id, currentUser?.region]);

  // Calculate stats
  const totalTeamSales = teamSales.reduce((sum, sale) => sum + (sale.saleAmount || 0), 0);
  const totalTeamCommissions = teamCommissions.reduce((sum, comm) => sum + (comm.amount || 0), 0);
  const phonesSold = teamSales.filter(sale => sale.imei).length;
  const todaysSales = teamSales.filter(
    sale => format(new Date(sale.createdAt), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  );

  // FO Performance data
  const foPerformance = myFOs.map((fo: any) => {
    const foSales = teamSales.filter(s => s.createdBy === fo.id || s.createdBy === fo._id);
    const foComms = teamCommissions.filter(c => {
      const foId = fo.id || fo._id;
      const commUserId = c.userId || c.foId;
      return foId && commUserId && (commUserId === foId || String(commUserId) === String(foId));
    });
    const foId = fo.id || fo._id || fo.name; // Ensure unique identifier
    
    console.log(`FO: ${fo.name} (${foId})`, {
      salesCount: foSales.length,
      commissionsCount: foComms.length,
      commissions: foComms.map((c: any) => ({ userId: c.userId, foId: c.foId, amount: c.amount }))
    });
    
    return {
      ...fo,
      id: foId, // Ensure id field is always set
      _id: fo._id || fo.id,
      totalSales: foSales.reduce((sum, s) => sum + (s.saleAmount || 0), 0),
      salesCount: foSales.length,
      phonesSold: foSales.filter(s => s.imei).length,
      totalCommissions: foComms.reduce((sum, c) => sum + (c.amount || 0), 0),
      unpaidCommissions: foComms.filter(c => c.status === 'pending').reduce((sum, c) => sum + (c.amount || 0), 0),
    };
  }).sort((a, b) => b.totalSales - a.totalSales);

  // Apply filters to sales
  const filteredTeamSales = teamSales.filter(sale => {
    const matchesFO = selectedFO === 'all' || sale.createdBy === selectedFO;
    const matchesDate = !dateFilter || format(new Date(sale.createdAt), 'yyyy-MM-dd') === dateFilter;
    const matchesSearch = !searchQuery || 
      sale.productName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.imei?.includes(searchQuery) ||
      sale.foName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.sellerName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesFO && matchesDate && matchesSearch;
  });

  const getSourceBadge = (source?: string) => {
    if (!source) return null;
    const colors: Record<string, string> = {
      watu: 'bg-blue-100 text-blue-800 border-blue-200',
      mogo: 'bg-green-100 text-green-800 border-green-200',
      onfon: 'bg-purple-100 text-purple-800 border-purple-200',
    };
    return (
      <Badge variant="outline" className={colors[source] || ''}>
        {source.charAt(0).toUpperCase() + source.slice(1)}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading team data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Team Dashboard</h1>
          <p className="text-muted-foreground">Manage your field officers and track their performance</p>
        </div>
        <Button 
          onClick={() => exportSales(filteredTeamSales)} 
          className="btn-brand"
          disabled={filteredTeamSales.length === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Team Members</p>
                <p className="text-2xl font-bold text-foreground">{myFOs.length}</p>
                <p className="text-xs text-muted-foreground">Field Officers</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Sales</p>
                <p className="text-2xl font-bold text-foreground">Ksh {totalTeamSales.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{teamSales.length} transactions</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Team Commissions</p>
                <p className="text-2xl font-bold text-foreground">Ksh {totalTeamCommissions.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total earned</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Phones Sold</p>
                <p className="text-2xl font-bold text-foreground">{phonesSold}</p>
                <p className="text-xs text-muted-foreground">{todaysSales.length} today</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Phone className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Allocated Stock */}
      <Card>
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
                if (!groupedByProduct[item.productName]) {
                  groupedByProduct[item.productName] = [];
                }
                groupedByProduct[item.productName].push(item);
                return groupedByProduct;
              }, {})).map(([productName, items]: [string, any[]]) => (
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
                      <span className="font-medium">Ksh {(items.reduce((sum, item) => sum + item.sellingPrice, 0)).toLocaleString()}</span>
                    </div>
                    {items[0]?.source && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Source</span>
                        <Badge variant="outline" className="capitalize">{items[0].source}</Badge>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* FO Performance Rankings */}
      <Card>
        <CardHeader className="flex items-center">
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            FO Performance Rankings
          </CardTitle>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant={foView === 'list' ? 'default' : 'outline'} onClick={() => setFoView('list')}>
              <List className="h-4 w-4" />
            </Button>
            <Button size="sm" variant={foView === 'grid' ? 'default' : 'outline'} onClick={() => setFoView('grid')}>
              <Grid className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {foPerformance.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No field officers assigned to your team yet.</p>
          ) : (
            // View toggle: list or grid
            foView === 'list' ? (
              <div className="space-y-4">
                {foPerformance.map((fo, index) => (
                  <div 
                    key={fo.id} 
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-amber-500 text-white' : 
                        index === 1 ? 'bg-gray-400 text-white' : 
                        index === 2 ? 'bg-amber-700 text-white' : 'bg-muted text-muted-foreground'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{fo.name}</p>
                        <p className="text-sm text-muted-foreground">{fo.foCode || 'No code'} • {fo.phone || 'No phone'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-8 text-right">
                      <div>
                        <p className="text-sm text-muted-foreground">Sales</p>
                        <p className="font-semibold text-foreground">Ksh {fo.totalSales.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Phones</p>
                        <p className="font-semibold text-foreground">{fo.phonesSold}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Commissions</p>
                        <p className="font-semibold text-foreground">Ksh {fo.totalCommissions.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {foPerformance.map((fo, index) => (
                  <div key={fo.id} className="p-4 rounded-lg border border-border bg-muted/20">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-foreground">{fo.name}</p>
                        <p className="text-sm text-muted-foreground">{fo.foCode || '-'}</p>
                      </div>
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-amber-500 text-white' : 
                        index === 1 ? 'bg-gray-400 text-white' : 
                        index === 2 ? 'bg-amber-700 text-white' : 'bg-muted text-muted-foreground'
                      }`}>{index + 1}</div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Sales</span>
                        <span className="font-medium">Ksh {fo.totalSales.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Phones Sold</span>
                        <span className="font-medium">{fo.phonesSold}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Commissions</span>
                        <span className="font-medium">Ksh {fo.totalCommissions.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Sales Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Team Sales Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by product, IMEI, or FO name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedFO} onValueChange={setSelectedFO}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by FO" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Field Officers</SelectItem>
                {myFOs.map((fo: any) => (
                  <SelectItem key={fo.id || fo._id || fo.name} value={fo.id || fo._id}>{fo.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="pl-10 w-full sm:w-[180px]"
              />
            </div>
          </div>

          {teamSales.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No sales found matching your filters.</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Field Officer</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>IMEI</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeamSales.map((sale: any) => (
                    <TableRow key={sale.id || sale._id || `${sale.createdBy}-${sale.createdAt}`}>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(sale.createdAt), 'MMM dd, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{sale.foName || sale.sellerName}</p>
                          <p className="text-xs text-muted-foreground">{sale.foCode}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{sale.productName}</TableCell>
                      <TableCell className="font-mono text-sm">{sale.imei || '-'}</TableCell>
                      <TableCell>{getSourceBadge(sale.source)}</TableCell>
                      <TableCell className="font-semibold">Ksh {sale.saleAmount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={sale.paymentMethod === 'mpesa' ? 'default' : 'secondary'}>
                          {sale.paymentMethod === 'mpesa' ? 'M-PESA' : 'Cash'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commission Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-green-500" />
            Team Commission Summary
          </CardTitle>
        </CardHeader>
        <div className="px-4 mt-2 flex items-center">
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant={commissionView === 'list' ? 'default' : 'outline'} onClick={() => setCommissionView('list')}>
              <List className="h-4 w-4" />
            </Button>
            <Button size="sm" variant={commissionView === 'grid' ? 'default' : 'outline'} onClick={() => setCommissionView('grid')}>
              <Grid className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardContent>
          {foPerformance.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No commission data available.</p>
          ) : (
            commissionView === 'list' ? (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field Officer</TableHead>
                      <TableHead>FO Code</TableHead>
                      <TableHead className="text-right">Total Earned</TableHead>
                      <TableHead className="text-right">Pending Payout</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {foPerformance.map((fo: any) => (
                      <TableRow key={fo.id || fo._id || fo.name}>
                        <TableCell className="font-medium">{fo.name}</TableCell>
                        <TableCell className="text-muted-foreground">{fo.foCode || '-'}</TableCell>
                        <TableCell className="text-right font-semibold">Ksh {fo.totalCommissions.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          {fo.unpaidCommissions > 0 ? (
                            <span className="text-amber-600 font-medium">Ksh {fo.unpaidCommissions.toLocaleString()}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={fo.unpaidCommissions > 0 ? 'outline' : 'default'}>
                            {fo.unpaidCommissions > 0 ? 'Pending' : 'All Paid'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {foPerformance.map((fo: any) => (
                  <div key={fo.id || fo._id || fo.name} className="p-4 rounded-lg border border-border bg-muted/20">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-foreground">{fo.name}</p>
                        <p className="text-sm text-muted-foreground">{fo.foCode || '-'}</p>
                      </div>
                      <Badge variant={fo.unpaidCommissions > 0 ? 'outline' : 'default'}>
                        {fo.unpaidCommissions > 0 ? 'Pending' : 'All Paid'}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Earned</span>
                        <span className="font-medium">Ksh {fo.totalCommissions.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Pending Payout</span>
                        <span className="font-medium">{fo.unpaidCommissions > 0 ? `Ksh ${fo.unpaidCommissions.toLocaleString()}` : '-'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamLeaderDashboard;
