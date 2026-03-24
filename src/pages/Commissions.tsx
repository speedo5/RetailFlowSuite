import { useState, useMemo, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, CheckCircle, Clock, Users, Download, Search, Filter, User, UserCog, Building2, Wallet, CreditCard, ChevronDown, Briefcase } from 'lucide-react';
import { exportCommissions } from '@/lib/pdfGenerator';
import { CommissionRole, CommissionStatus, Commission } from '@/types';
import { commissionService } from '@/services/commissionService';
import { toast } from 'sonner';

interface UserCommissionSummary {
  userId: string;
  userName: string;
  role: CommissionRole;
  region?: string;
  totalPending: number;
  totalPaid: number;
  pendingCount: number;
  paidCount: number;
  commissions: Commission[];
}

export default function Commissions() {
  const { commissions, setCommissions, users, currentUser, logActivity, addNotification } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<CommissionRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<CommissionStatus | 'all'>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'disbursement' | 'detailed'>('disbursement');
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch commissions from API on component mount
  useEffect(() => {
    const fetchCommissions = async () => {
      try {
        setIsLoading(true);
        const response = await commissionService.getAll();
        if (response.success && response.data) {
          let commissionsList: Commission[] = [];
          
          if (Array.isArray(response.data)) {
            // Direct array response
            commissionsList = response.data;
          } else if ((response.data as any).data && Array.isArray((response.data as any).data)) {
            // Response with data property
            commissionsList = (response.data as any).data;
          } else if ((response.data as any).commissions && Array.isArray((response.data as any).commissions)) {
            // CommissionListResponse with commissions property
            commissionsList = (response.data as any).commissions;
          }
          
          setCommissions(commissionsList);
        }
      } catch (error) {
        console.error('Failed to fetch commissions:', error);
        toast.error('Failed to load commissions');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCommissions();
  }, []);

  // Get unique regions
  const regions = useMemo(() => 
    Array.from(new Set(users.filter(u => u.region).map(u => u.region as string))),
    [users]
  );

  // Filter commissions based on user role
  const visibleCommissions = useMemo(() => {
    if (!currentUser) return commissions;
    
    if (currentUser.role === 'admin') {
      return commissions;
    }
    if (currentUser.role === 'regional_manager') {
      // Get all users in the RM's region AND include RM's own commissions
      const regionUserIds = users
        .filter(u => u.region === currentUser.region || u.id === currentUser.id)
        .map(u => u.id);
      
      // Include RM's own commissions plus all commissions for users in their region
      return commissions.filter(c => 
        regionUserIds.includes(c.userId) || c.region === currentUser.region
      );
    }
    if (currentUser.role === 'team_leader') {
      const foIds = users
        .filter(u => u.role === 'field_officer' && u.teamLeaderId === currentUser.id)
        .map(u => u.id);
      return commissions.filter(c => 
        c.userId === currentUser.id || 
        foIds.includes(c.userId)
      );
    }
    return commissions.filter(c => c.userId === currentUser.id);
  }, [commissions, users, currentUser]);

  // Apply filters
  const filteredCommissions = useMemo(() => {
    return visibleCommissions.filter(c => {
      const user = users.find(u => u.id === c.userId);
      const matchesSearch = 
        c.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.saleId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.imei && c.imei.includes(searchTerm));
      const matchesRole = roleFilter === 'all' || c.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchesRegion = regionFilter === 'all' || user?.region === regionFilter;
      return matchesSearch && matchesRole && matchesStatus && matchesRegion;
    });
  }, [visibleCommissions, searchTerm, roleFilter, statusFilter, regionFilter, users]);

  // Group commissions by user for disbursement view
  const userCommissionSummaries: UserCommissionSummary[] = useMemo(() => {
    const userMap = new Map<string, UserCommissionSummary>();
    
    filteredCommissions.forEach(c => {
      const user = users.find(u => u.id === c.userId);
      if (!userMap.has(c.userId)) {
        userMap.set(c.userId, {
          userId: c.userId,
          userName: c.userName,
          role: c.role,
          region: user?.region,
          totalPending: 0,
          totalPaid: 0,
          pendingCount: 0,
          paidCount: 0,
          commissions: [],
        });
      }
      
      const summary = userMap.get(c.userId)!;
      summary.commissions.push(c);
      
      if (c.status === 'pending') {
        summary.totalPending += c.amount;
        summary.pendingCount++;
      } else if (c.status === 'paid') {
        summary.totalPaid += c.amount;
        summary.paidCount++;
      }
    });
    
    return Array.from(userMap.values()).sort((a, b) => b.totalPending - a.totalPending);
  }, [filteredCommissions, users]);

  // Stats
  const totalCommissions = filteredCommissions.reduce((sum, c) => sum + c.amount, 0);
  const paidCommissions = filteredCommissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0);
  const pendingCommissions = filteredCommissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0);
  const pendingUsersCount = userCommissionSummaries.filter(u => u.totalPending > 0).length;

  // Group by role for quick stats
  const pendingByRole = useMemo(() => ({
    field_officer: userCommissionSummaries.filter(u => u.role === 'field_officer' && u.totalPending > 0),
    team_leader: userCommissionSummaries.filter(u => u.role === 'team_leader' && u.totalPending > 0),
    regional_manager: userCommissionSummaries.filter(u => u.role === 'regional_manager' && u.totalPending > 0),
  }), [userCommissionSummaries]);

  const handlePayUser = async (userId: string) => {
    const userCommissions = commissions.filter(c => c.userId === userId && c.status === 'pending');
    if (userCommissions.length === 0) return;

    try {
      setIsUpdating(true);
      const totalAmount = userCommissions.reduce((sum, c) => sum + c.amount, 0);
      const userName = userCommissions[0].userName;

      // Call API to pay commissions for this user
      const commissionIds = userCommissions.map(c => c.id);
      const response = await commissionService.bulkPay(commissionIds);

      if (response.success) {
        // Update local state with paid commissions
        setCommissions(prev => prev.map(c => {
          if (commissionIds.includes(c.id) && c.status === 'pending') {
            return { ...c, status: 'paid' as CommissionStatus, paidAt: new Date() };
          }
          return c;
        }));

        logActivity('commission', 'Commission Paid', 
          `Paid Ksh ${totalAmount.toLocaleString()} to ${userName} (${userCommissions.length} commissions)`,
          { userId, amount: totalAmount, count: userCommissions.length }
        );

        addNotification({
          title: 'Commission Paid',
          message: `Ksh ${totalAmount.toLocaleString()} paid to ${userName}`,
          type: 'commission',
          userId,
        });

        toast.success(`Paid Ksh ${totalAmount.toLocaleString()} to ${userName}`);
      } else {
        toast.error('Failed to pay commission');
      }
    } catch (error) {
      console.error('Error paying user:', error);
      toast.error('Error processing payment');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBulkPaySelected = async () => {
    if (selectedUsers.size === 0) {
      toast.error('Select users to pay');
      return;
    }

    try {
      setIsUpdating(true);
      let totalPaid = 0;
      let usersPaid = 0;
      const commissionIds: string[] = [];

      // Collect all pending commission IDs for selected users
      selectedUsers.forEach(userId => {
        const userCommissions = commissions.filter(c => c.userId === userId && c.status === 'pending');
        userCommissions.forEach(c => {
          commissionIds.push(c.id);
          totalPaid += c.amount;
        });
        if (userCommissions.length > 0) {
          usersPaid++;
        }
      });

      if (commissionIds.length === 0) {
        toast.error('No pending commissions to pay');
        setIsUpdating(false);
        return;
      }

      // Call API to pay selected commissions
      const response = await commissionService.bulkPay(commissionIds);

      if (response.success) {
        // Update local state
        setCommissions(prev => prev.map(c => {
          if (commissionIds.includes(c.id) && c.status === 'pending') {
            return { ...c, status: 'paid' as CommissionStatus, paidAt: new Date() };
          }
          return c;
        }));

        selectedUsers.forEach(userId => {
          const userPending = commissions.filter(c => c.userId === userId && c.status === 'pending');
          if (userPending.length > 0) {
            addNotification({
              title: 'Commission Paid',
              message: `Your pending commissions have been paid`,
              type: 'commission',
              userId,
            });
          }
        });

        logActivity('commission', 'Bulk Commission Payment', 
          `Paid Ksh ${totalPaid.toLocaleString()} to ${usersPaid} users`,
          { totalPaid, usersPaid }
        );

        toast.success(`Paid Ksh ${totalPaid.toLocaleString()} to ${usersPaid} users`);
        setSelectedUsers(new Set());
      } else {
        toast.error('Failed to pay commissions');
      }
    } catch (error) {
      console.error('Error bulk paying:', error);
      toast.error('Error processing payment');
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePayByRole = async (role: CommissionRole) => {
    const roleSummaries = pendingByRole[role];
    if (roleSummaries.length === 0) return;

    try {
      setIsUpdating(true);
      let totalPaid = 0;
      const userIds = new Set(roleSummaries.map(u => u.userId));
      const commissionIds: string[] = [];

      // Collect all pending commission IDs for users in this role
      commissions.forEach(c => {
        if (userIds.has(c.userId) && c.status === 'pending') {
          commissionIds.push(c.id);
          totalPaid += c.amount;
        }
      });

      if (commissionIds.length === 0) {
        toast.error('No pending commissions to pay');
        setIsUpdating(false);
        return;
      }

      // Call API to pay commissions
      const response = await commissionService.bulkPay(commissionIds);

      if (response.success) {
        // Update local state
        setCommissions(prev => prev.map(c => {
          if (commissionIds.includes(c.id) && c.status === 'pending') {
            return { ...c, status: 'paid' as CommissionStatus, paidAt: new Date() };
          }
          return c;
        }));

        const roleLabel = role === 'field_officer' ? 'Field Officers' : 
                          role === 'team_leader' ? 'Team Leaders' : 'Regional Managers';

        logActivity('commission', 'Bulk Commission Payment', 
          `Paid Ksh ${totalPaid.toLocaleString()} to ${roleSummaries.length} ${roleLabel}`,
          { totalPaid, role, count: roleSummaries.length }
        );

        toast.success(`Paid Ksh ${totalPaid.toLocaleString()} to ${roleSummaries.length} ${roleLabel}`);
      } else {
        toast.error('Failed to pay commissions');
      }
    } catch (error) {
      console.error('Error paying by role:', error);
      toast.error('Error processing payment');
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    const newSelection = new Set(selectedUsers);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUsers(newSelection);
  };

  const selectAllPending = () => {
    const pendingUserIds = userCommissionSummaries
      .filter(u => u.totalPending > 0)
      .map(u => u.userId);
    setSelectedUsers(new Set(pendingUserIds));
  };

  const getRoleIcon = (role: CommissionRole) => {
    switch (role) {
      case 'field_officer': return <User className="h-4 w-4" />;
      case 'team_leader': return <UserCog className="h-4 w-4" />;
      case 'regional_manager': return <Building2 className="h-4 w-4" />;
    }
  };

  const getRoleBadgeColor = (role: CommissionRole) => {
    switch (role) {
      case 'field_officer': return 'bg-success/10 text-success border-success/20';
      case 'team_leader': return 'bg-primary/10 text-primary border-primary/20';
      case 'regional_manager': return 'bg-warning/10 text-warning border-warning/20';
    }
  };

  const getRoleLabel = (role: CommissionRole) => {
    switch (role) {
      case 'field_officer': return 'Field Officer';
      case 'team_leader': return 'Team Leader';
      case 'regional_manager': return 'Regional Manager';
    }
  };

  const renderDisbursementCard = (summary: UserCommissionSummary) => (
    <div 
      key={summary.userId}
      className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
    >
      {currentUser?.role === 'admin' && summary.totalPending > 0 && (
        <Checkbox
          checked={selectedUsers.has(summary.userId)}
          onCheckedChange={() => toggleUserSelection(summary.userId)}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium truncate">{summary.userName}</span>
          <Badge variant="outline" className={getRoleBadgeColor(summary.role)}>
            {getRoleIcon(summary.role)}
            <span className="ml-1 hidden sm:inline">{getRoleLabel(summary.role)}</span>
          </Badge>
          {summary.region && (
            <Badge variant="secondary" className="hidden md:inline-flex">{summary.region}</Badge>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{summary.pendingCount + summary.paidCount} sales</span>
          {summary.totalPaid > 0 && (
            <span className="text-success">Ksh {summary.totalPaid.toLocaleString()} paid</span>
          )}
        </div>
      </div>
      <div className="text-right">
        {summary.totalPending > 0 ? (
          <>
            <p className="text-lg font-bold text-warning">Ksh {summary.totalPending.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{summary.pendingCount} pending</p>
          </>
        ) : (
          <p className="text-sm text-success flex items-center gap-1">
            <CheckCircle className="h-4 w-4" /> All paid
          </p>
        )}
      </div>
      {currentUser?.role === 'admin' && summary.totalPending > 0 && (
        <Button 
          size="sm" 
          onClick={() => handlePayUser(summary.userId)}
          disabled={isUpdating}
          className="shrink-0"
        >
          <Wallet className="h-4 w-4 mr-1" />
          {isUpdating ? 'Processing...' : 'Pay'}
        </Button>
      )}
    </div>
  );

  const renderRoleSection = (role: CommissionRole, summaries: UserCommissionSummary[]) => {
    const totalPending = summaries.reduce((sum, s) => sum + s.totalPending, 0);
    const roleLabel = role === 'field_officer' ? 'Field Officers' : 
                      role === 'team_leader' ? 'Team Leaders' : 'Regional Managers';
    const icon = getRoleIcon(role);
    
    if (summaries.length === 0) return null;

    return (
      <AccordionItem value={role} className="border rounded-lg overflow-hidden">
        <AccordionTrigger className="px-4 hover:no-underline hover:bg-muted/50">
          <div className="flex items-center justify-between w-full pr-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                role === 'field_officer' ? 'bg-success/10' : 
                role === 'team_leader' ? 'bg-primary/10' : 'bg-warning/10'
              }`}>
                {icon}
              </div>
              <div className="text-left">
                <p className="font-medium">{roleLabel}</p>
                <p className="text-sm text-muted-foreground">{summaries.length} people</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-lg font-bold text-warning">Ksh {totalPending.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">pending</p>
              </div>
              {currentUser?.role === 'admin' && (
                <Button 
                  size="sm" 
                  variant="outline"
                  disabled={isUpdating}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePayByRole(role);
                  }}
                >
                  {isUpdating ? 'Processing...' : 'Pay All'}
                </Button>
              )}
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-2">
            {summaries.map(renderDisbursementCard)}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  };

  return (
    <MainLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Commissions</h1>
            <p className="text-muted-foreground">Track and disburse sales commissions</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportCommissions(filteredCommissions)}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="border shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-xl font-bold">Ksh {totalCommissions.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Commissions</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-xl font-bold text-success">Ksh {paidCommissions.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Paid Out</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-xl font-bold text-warning">Ksh {pendingCommissions.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">{pendingUsersCount}</p>
                <p className="text-xs text-muted-foreground">Awaiting Payment</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RM Personal Commissions Section */}
        {currentUser?.role === 'regional_manager' && (() => {
          const rmOwnCommissions = filteredCommissions.filter(c => c.userId === currentUser.id);
          const rmOwnTotal = rmOwnCommissions.reduce((sum, c) => sum + c.amount, 0);
          const rmOwnPending = rmOwnCommissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0);
          const rmOwnPaid = rmOwnCommissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0);
          
          if (rmOwnTotal > 0) {
            return (
              <Card className="border-2 border-primary shadow-md mb-6 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Your Commissions (RM)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col items-start gap-1 p-3 bg-primary/10 rounded-lg">
                      <span className="text-xs font-medium text-muted-foreground">Total Earned</span>
                      <span className="text-xl font-bold">Ksh {rmOwnTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col items-start gap-1 p-3 bg-success/10 rounded-lg">
                      <span className="text-xs font-medium text-muted-foreground">Paid</span>
                      <span className="text-xl font-bold text-success">Ksh {rmOwnPaid.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col items-start gap-1 p-3 bg-warning/10 rounded-lg">
                      <span className="text-xs font-medium text-muted-foreground">Pending</span>
                      <span className="text-xl font-bold text-warning">Ksh {rmOwnPending.toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          }
          return null;
        })()}

        {/* Filters */}
        <Card className="border shadow-sm mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, product, or IMEI..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger className="w-full md:w-[150px]">
                  <SelectValue placeholder="Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {regions.map(region => (
                    <SelectItem key={region} value={region}>{region}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as CommissionRole | 'all')}>
                <SelectTrigger className="w-full md:w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="field_officer">Field Officers</SelectItem>
                  <SelectItem value="team_leader">Team Leaders</SelectItem>
                  <SelectItem value="regional_manager">Regional Managers</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CommissionStatus | 'all')}>
                <SelectTrigger className="w-full md:w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="reversed">Reversed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* View Mode Toggle */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'disbursement' | 'detailed')} className="mb-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="disbursement" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Disbursement View
            </TabsTrigger>
            <TabsTrigger value="detailed" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Detailed View
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {viewMode === 'disbursement' ? (
          <>
            {/* Commission Breakdown by Role (RM_TL_FO) */}
            {filteredCommissions.length > 0 && (
              <Card className="border shadow-sm mb-6 bg-gradient-to-r from-primary/5 to-transparent">
                <CardHeader>
                  <CardTitle className="text-base">Commission Summary by Role</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Regional Manager Commission */}
                    <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                      <div className="flex items-center gap-2 mb-3">
                        <Building2 className="h-5 w-5 text-warning" />
                        <span className="font-semibold text-warning">Regional Manager</span>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p className="text-xl font-bold">Ksh {filteredCommissions
                            .filter(c => c.role === 'regional_manager')
                            .reduce((sum, c) => sum + c.amount, 0)
                            .toLocaleString()}</p>
                        </div>
                        <div className="flex gap-3 text-xs">
                          <div>
                            <span className="text-muted-foreground">Pending: </span>
                            <span className="font-medium text-warning">Ksh {filteredCommissions
                              .filter(c => c.role === 'regional_manager' && c.status === 'pending')
                              .reduce((sum, c) => sum + c.amount, 0)
                              .toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Paid: </span>
                            <span className="font-medium text-success">Ksh {filteredCommissions
                              .filter(c => c.role === 'regional_manager' && c.status === 'paid')
                              .reduce((sum, c) => sum + c.amount, 0)
                              .toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Team Leader Commission */}
                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                      <div className="flex items-center gap-2 mb-3">
                        <Briefcase className="h-5 w-5 text-primary" />
                        <span className="font-semibold text-primary">Team Leader</span>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p className="text-xl font-bold">Ksh {filteredCommissions
                            .filter(c => c.role === 'team_leader')
                            .reduce((sum, c) => sum + c.amount, 0)
                            .toLocaleString()}</p>
                        </div>
                        <div className="flex gap-3 text-xs">
                          <div>
                            <span className="text-muted-foreground">Pending: </span>
                            <span className="font-medium text-warning">Ksh {filteredCommissions
                              .filter(c => c.role === 'team_leader' && c.status === 'pending')
                              .reduce((sum, c) => sum + c.amount, 0)
                              .toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Paid: </span>
                            <span className="font-medium text-success">Ksh {filteredCommissions
                              .filter(c => c.role === 'team_leader' && c.status === 'paid')
                              .reduce((sum, c) => sum + c.amount, 0)
                              .toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Field Officer Commission */}
                    <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="h-5 w-5 text-success" />
                        <span className="font-semibold text-success">Field Officer</span>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p className="text-xl font-bold">Ksh {filteredCommissions
                            .filter(c => c.role === 'field_officer')
                            .reduce((sum, c) => sum + c.amount, 0)
                            .toLocaleString()}</p>
                        </div>
                        <div className="flex gap-3 text-xs">
                          <div>
                            <span className="text-muted-foreground">Pending: </span>
                            <span className="font-medium text-warning">Ksh {filteredCommissions
                              .filter(c => c.role === 'field_officer' && c.status === 'pending')
                              .reduce((sum, c) => sum + c.amount, 0)
                              .toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Paid: </span>
                            <span className="font-medium text-success">Ksh {filteredCommissions
                              .filter(c => c.role === 'field_officer' && c.status === 'paid')
                              .reduce((sum, c) => sum + c.amount, 0)
                              .toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Bulk Actions */}
            {currentUser?.role === 'admin' && pendingUsersCount > 0 && (
              <Card className="border shadow-sm mb-4 bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <Button variant="outline" size="sm" onClick={selectAllPending}>
                        Select All Pending ({pendingUsersCount})
                      </Button>
                      {selectedUsers.size > 0 && (
                        <span className="text-sm text-muted-foreground">
                          {selectedUsers.size} selected
                        </span>
                      )}
                    </div>
                    {selectedUsers.size > 0 && (
                      <Button 
                        onClick={handleBulkPaySelected}
                        disabled={isUpdating}
                      >
                        <Wallet className="h-4 w-4 mr-2" />
                        {isUpdating ? 'Processing...' : `Pay Selected (Ksh ${userCommissionSummaries
                          .filter(u => selectedUsers.has(u.userId))
                          .reduce((sum, u) => sum + u.totalPending, 0)
                          .toLocaleString()})`}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Grouped by Role - Accordion */}
            <Accordion type="multiple" defaultValue={['field_officer', 'team_leader', 'regional_manager']} className="space-y-4">
              {renderRoleSection('field_officer', pendingByRole.field_officer)}
              {renderRoleSection('team_leader', pendingByRole.team_leader)}
              {renderRoleSection('regional_manager', pendingByRole.regional_manager)}
            </Accordion>

            {/* Users with no pending */}
            {userCommissionSummaries.filter(u => u.totalPending === 0).length > 0 && (
              <Card className="border shadow-sm mt-6">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    Fully Paid ({userCommissionSummaries.filter(u => u.totalPending === 0).length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {userCommissionSummaries
                      .filter(u => u.totalPending === 0)
                      .map(renderDisbursementCard)}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          /* Detailed Table View */
          <Card className="border shadow-sm overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                All Commission Records
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>IMEI</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCommissions.map((commission) => {
                      const user = users.find(u => u.id === commission.userId);
                      return (
                        <TableRow key={commission.id}>
                          <TableCell className="font-medium">{commission.userName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getRoleBadgeColor(commission.role)}>
                              {getRoleIcon(commission.role)}
                              <span className="ml-1">{getRoleLabel(commission.role)}</span>
                            </Badge>
                          </TableCell>
                          <TableCell>{user?.region || '-'}</TableCell>
                          <TableCell>{commission.productName}</TableCell>
                          <TableCell className="font-mono text-sm">{commission.imei || '-'}</TableCell>
                          <TableCell className="text-right font-bold text-success">
                            Ksh {commission.amount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {commission.status === 'paid' ? (
                              <span className="badge-success">Paid</span>
                            ) : commission.status === 'reversed' ? (
                              <span className="badge-destructive">Reversed</span>
                            ) : (
                              <span className="badge-warning">Pending</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(commission.createdAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredCommissions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No commissions found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
