/**
 * =============================================================================
 * TEAM LEADER COMMISSIONS PAGE
 * =============================================================================
 * 
 * Displays commission tracking for team leaders:
 * - Own commissions
 * - FO team member commissions (read-only)
 * - Summary statistics
 * 
 * API INTEGRATION:
 * - GET /commissions/my-commissions - Get own commissions
 * - GET /commissions?teamLeaderId=xxx - Get team FO commissions
 * 
 * =============================================================================
 */

import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  DollarSign, 
  CheckCircle, 
  Clock, 
  Users, 
  Search, 
  User,
  TrendingUp,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  ChevronRight,
  BarChart3
} from 'lucide-react';
import { CommissionStatus, Commission } from '@/types';
import { format } from 'date-fns';
import { commissionService } from '@/services/commissionService';
import { userService } from '@/services/userService';
import { toast } from 'sonner';

export default function TeamLeaderCommissions() {
  const { currentUser } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<CommissionStatus | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'my' | 'team'>('overview');
  const [selectedFO, setSelectedFO] = useState<string | null>(null);
  
  // API Data state
  const [teamFOs, setTeamFOs] = useState<any[]>([]);
  const [myCommissions, setMyCommissions] = useState<Commission[]>([]);
  const [teamCommissions, setTeamCommissions] = useState<Commission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load commission data from APIs
  useEffect(() => {
    const loadCommissionData = async () => {
      try {
        setIsLoading(true);

        // Fetch all FOs under this team leader
        let fos: any[] = [];
        try {
          const foResponse = await userService.getAll({ 
            teamLeaderId: currentUser?.id,
            role: 'field_officer'
          });
          
          if (Array.isArray(foResponse)) {
            fos = foResponse;
          } else if (foResponse?.data) {
            if (Array.isArray(foResponse.data)) {
              fos = foResponse.data;
            } else if (foResponse.data.users) {
              fos = foResponse.data.users;
            }
          }
        } catch (err) {
          console.error('Error loading team FOs:', err);
        }

        setTeamFOs(fos);

        // Fetch all commissions
        let allCommissions: Commission[] = [];
        try {
          const commissionResponse = await commissionService.getAll();
          
          if (Array.isArray(commissionResponse)) {
            allCommissions = commissionResponse;
          } else if (commissionResponse?.data) {
            if (Array.isArray(commissionResponse.data)) {
              allCommissions = commissionResponse.data;
            } else if ((commissionResponse.data as any).data && Array.isArray((commissionResponse.data as any).data)) {
              allCommissions = (commissionResponse.data as any).data;
            } else if ((commissionResponse.data as any).commissions && Array.isArray((commissionResponse.data as any).commissions)) {
              allCommissions = (commissionResponse.data as any).commissions;
            }
          }
        } catch (err) {
          console.error('Error loading commissions:', err);
          toast.error('Failed to load commissions');
        }

        // Filter my commissions
        const myComms = allCommissions.filter(c => 
          c.userId === currentUser?.id || c.foId === currentUser?.id
        );
        setMyCommissions(myComms);

        // Filter team commissions (FOs under this team leader)
        const teamFOIds = fos.map(fo => fo.id || fo._id).filter(Boolean);
        const teamComms = allCommissions.filter(c => 
          teamFOIds.includes(c.userId || c.foId)
        );
        setTeamCommissions(teamComms);

      } catch (error) {
        console.error('Error loading commission data:', error);
        toast.error('Failed to load commission data');
      } finally {
        setIsLoading(false);
      }
    };

    if (currentUser?.id) {
      loadCommissionData();
    }
  }, [currentUser?.id]);

  // Apply filters
  const filteredCommissions = useMemo(() => {
    let source = activeTab === 'my' ? myCommissions : teamCommissions;
    
    // Filter by selected FO if applicable
    if (activeTab === 'team' && selectedFO) {
      source = source.filter(c => c.userId === selectedFO);
    }
    
    return source.filter(c => {
      const matchesSearch = 
        c.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.saleId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.imei && c.imei.includes(searchTerm));
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [activeTab, myCommissions, teamCommissions, searchTerm, statusFilter, selectedFO]);

  // Group team commissions by FO
  const foSummaries = useMemo(() => {
    const map = new Map<string, { name: string; foCode?: string; pending: number; paid: number; count: number; total: number }>();
    
    teamCommissions.forEach(c => {
      const userId = c.userId || c.foId;
      if (!map.has(userId)) {
        const fo = teamFOs.find(f => (f.id || f._id) === userId);
        map.set(userId, { name: c.userName, foCode: fo?.foCode, pending: 0, paid: 0, count: 0, total: 0 });
      }
      const summary = map.get(userId)!;
      summary.count++;
      summary.total += c.amount;
      if (c.status === 'pending') {
        summary.pending += c.amount;
      } else if (c.status === 'paid') {
        summary.paid += c.amount;
      }
    });
    
    return Array.from(map.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [teamCommissions, teamFOs]);

  // Stats calculations
  const myStats = useMemo(() => ({
    total: myCommissions.reduce((sum, c) => sum + c.amount, 0),
    pending: myCommissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0),
    paid: myCommissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0),
    count: myCommissions.length,
    pendingCount: myCommissions.filter(c => c.status === 'pending').length,
    paidCount: myCommissions.filter(c => c.status === 'paid').length,
  }), [myCommissions]);

  const teamStats = useMemo(() => ({
    total: teamCommissions.reduce((sum, c) => sum + c.amount, 0),
    pending: teamCommissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0),
    paid: teamCommissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0),
    count: teamCommissions.length,
    pendingCount: teamCommissions.filter(c => c.status === 'pending').length,
    paidCount: teamCommissions.filter(c => c.status === 'paid').length,
    foCount: teamFOs.length,
  }), [teamCommissions, teamFOs]);

  const getStatusBadge = (status: CommissionStatus) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Pending</Badge>;
      case 'paid':
        return <Badge variant="outline" className="bg-success/10 text-success border-success/20">Paid</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Combined stats for overview
  const combinedStats = useMemo(() => ({
    total: myStats.total + teamStats.total,
    pending: myStats.pending + teamStats.pending,
    paid: myStats.paid + teamStats.paid,
  }), [myStats, teamStats]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="inline-flex animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading commission data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Team Commissions</h1>
          <p className="text-muted-foreground">Track your earnings and monitor team performance</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{teamStats.foCount} Field Officers</span>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-primary/10 via-background to-background">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Total Earnings</p>
                <p className="text-2xl font-bold text-foreground">Ksh {combinedStats.total.toLocaleString()}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>My: Ksh {myStats.total.toLocaleString()}</span>
                  <span className="text-muted-foreground/50">•</span>
                  <span>Team: Ksh {teamStats.total.toLocaleString()}</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-success/10 via-background to-background">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Paid Out</p>
                <p className="text-2xl font-bold text-success">Ksh {combinedStats.paid.toLocaleString()}</p>
                <div className="flex items-center gap-1 text-xs text-success/70">
                  <ArrowUpRight className="h-3 w-3" />
                  <span>{myStats.paidCount + teamStats.paidCount} transactions</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-xl bg-success/20 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-warning/10 via-background to-background">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-warning">Ksh {combinedStats.pending.toLocaleString()}</p>
                <div className="flex items-center gap-1 text-xs text-warning/70">
                  <Clock className="h-3 w-3" />
                  <span>Awaiting disbursement</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-xl bg-warning/20 flex items-center justify-center">
                <Clock className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-primary/10 via-background to-background">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">My Pending</p>
                <p className="text-2xl font-bold text-primary">Ksh {myStats.pending.toLocaleString()}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <DollarSign className="h-3 w-3" />
                  <span>{myStats.pendingCount} pending commissions</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as typeof activeTab); setSelectedFO(null); }} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <TabsList className="grid w-full sm:w-auto grid-cols-3">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="my" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">My Earnings</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Team</span>
            </TabsTrigger>
          </TabsList>

          {/* Filters */}
          {activeTab !== 'overview' && (
            <div className="flex gap-2">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-full sm:w-[200px]"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CommissionStatus | 'all')}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-md">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* My Commission Summary */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  My Commission Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Total Sales</span>
                  <span className="font-bold">{myStats.count}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-success/10">
                  <span className="text-sm text-muted-foreground">Paid</span>
                  <span className="font-bold text-success">Ksh {myStats.paid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-warning/10">
                  <span className="text-sm text-muted-foreground">Pending</span>
                  <span className="font-bold text-warning">Ksh {myStats.pending.toLocaleString()}</span>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full mt-2"
                  onClick={() => setActiveTab('my')}
                >
                  View My Commissions
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* Team Performance */}
            <Card className="border shadow-sm lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Team Performance - Top FOs
                </CardTitle>
              </CardHeader>
              <CardContent>
                {foSummaries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No team members found
                  </div>
                ) : (
                  <ScrollArea className="h-[280px]">
                    <div className="space-y-2">
                      {foSummaries.slice(0, 5).map((fo, index) => (
                        <div 
                          key={fo.id}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => { setActiveTab('team'); setSelectedFO(fo.id); }}
                        >
                          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{fo.name}</p>
                              {fo.foCode && (
                                <Badge variant="outline" className="text-xs">{fo.foCode}</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{fo.count} sales</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">Ksh {fo.total.toLocaleString()}</p>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-success">+{fo.paid.toLocaleString()}</span>
                              <span className="text-warning">{fo.pending.toLocaleString()}</span>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                {foSummaries.length > 5 && (
                  <Button 
                    variant="ghost" 
                    className="w-full mt-2"
                    onClick={() => setActiveTab('team')}
                  >
                    View All {foSummaries.length} FOs
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Transactions */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Recent Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[...myCommissions, ...teamCommissions]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 5)
                  .map((commission) => (
                    <div 
                      key={commission.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                          commission.userId === currentUser?.id ? 'bg-primary/10' : 'bg-muted'
                        }`}>
                          {commission.userId === currentUser?.id ? (
                            <User className="h-5 w-5 text-primary" />
                          ) : (
                            <Users className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{commission.productName}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{commission.userName}</span>
                            <span>•</span>
                            <span>{format(new Date(commission.createdAt), 'MMM d')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold">Ksh {commission.amount.toLocaleString()}</span>
                        {getStatusBadge(commission.status)}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Commissions Tab */}
        <TabsContent value="my">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  My Commission History
                </CardTitle>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-success" />
                    <span className="text-muted-foreground">Paid: Ksh {myStats.paid.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-warning" />
                    <span className="text-muted-foreground">Pending: Ksh {myStats.pending.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="divide-y">
                  {filteredCommissions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      No commissions found
                    </div>
                  ) : (
                    filteredCommissions.map((commission) => (
                      <div key={commission.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <DollarSign className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{commission.productName}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{format(new Date(commission.createdAt), 'MMM d, yyyy')}</span>
                              {commission.imei && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono">{commission.imei}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-lg">Ksh {commission.amount.toLocaleString()}</span>
                          {getStatusBadge(commission.status)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Commissions Tab */}
        <TabsContent value="team" className="space-y-4">
          {/* FO Quick Select */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedFO === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedFO(null)}
            >
              All FOs
            </Button>
            {foSummaries.map((fo) => (
              <Button
                key={fo.id}
                variant={selectedFO === fo.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFO(fo.id)}
                className="gap-2"
              >
                {fo.name}
                <Badge variant="secondary" className="ml-1 text-xs">
                  {fo.count}
                </Badge>
              </Button>
            ))}
          </div>

          {/* Team Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-primary">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Team Total</p>
                    <p className="text-2xl font-bold">Ksh {teamStats.total.toLocaleString()}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-primary/20" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-warning">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Team Pending</p>
                    <p className="text-2xl font-bold text-warning">Ksh {teamStats.pending.toLocaleString()}</p>
                  </div>
                  <Clock className="h-8 w-8 text-warning/20" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-success">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Team Paid</p>
                    <p className="text-2xl font-bold text-success">Ksh {teamStats.paid.toLocaleString()}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-success/20" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Team Commission List */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                {selectedFO 
                  ? `${foSummaries.find(f => f.id === selectedFO)?.name}'s Commissions`
                  : 'Team Commission Details'
                }
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <div className="divide-y">
                  {filteredCommissions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      No team commissions found
                    </div>
                  ) : (
                    filteredCommissions.map((commission) => (
                      <div key={commission.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{commission.userName}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{commission.productName}</span>
                              <span>•</span>
                              <span>{format(new Date(commission.createdAt), 'MMM d, yyyy')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-bold">Ksh {commission.amount.toLocaleString()}</span>
                          {getStatusBadge(commission.status)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
