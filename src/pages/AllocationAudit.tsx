import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronUp, User } from 'lucide-react';
import { format } from 'date-fns';
import * as stockAllocationService from '@/services/stockAllocationService';

export default function AllocationAudit() {
  const { currentUser, stockAllocations, setStockAllocations, users, imeis } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Fetch allocations from API on mount
  useEffect(() => {
    const fetchAllocations = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log('📋 Fetching stock allocations from API...');
        
        const response = await stockAllocationService.getAllocations();
        
        if (response.success && response.data) {
          const allocations = Array.isArray(response.data) ? response.data : (typeof response.data === 'object' && response.data !== null && 'data' in response.data ? (response.data as any).data : []) || [];
          console.log('✓ Allocations loaded:', allocations.length);
          setStockAllocations(allocations);
        } else {
          const errorMsg = 'Failed to load allocations';
          setError(errorMsg);
          console.warn('⚠️', errorMsg, response);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load allocations';
        setError(errorMsg);
        console.error('❌ Error fetching allocations:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllocations();
  }, [setStockAllocations]);

  // Filter allocations
  const filteredAllocations = useMemo(() => {
    return stockAllocations
      .filter(alloc => {
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const fromName = typeof alloc.fromUserId === 'object' && alloc.fromUserId
            ? alloc.fromUserId.name
            : alloc.fromUserName;
          const toName = typeof alloc.toUserId === 'object' && alloc.toUserId
            ? alloc.toUserId.name
            : alloc.toUserName;
          const matchesProduct = typeof alloc.productId === 'object' && alloc.productId
            ? alloc.productId.name?.toLowerCase().includes(query)
            : alloc.productName?.toLowerCase().includes(query);
          const matchesImei = alloc.imei?.includes(query);
          const matchesUser = fromName?.toLowerCase().includes(query) || 
                              toName?.toLowerCase().includes(query);
          if (!matchesProduct && !matchesImei && !matchesUser) return false;
        }
        
        // Level filter - check both toLevel and level fields
        const toLevel = alloc.toLevel || alloc.level;
        if (levelFilter !== 'all' && toLevel !== levelFilter) return false;
        
        // Status filter
        if (statusFilter !== 'all' && alloc.status !== statusFilter) return false;
        
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [stockAllocations, searchQuery, levelFilter, statusFilter]);

  // Group allocations by recipient user
  const groupedAllocations = useMemo(() => {
    const grouped: Record<string, any> = {};
    
    filteredAllocations.forEach(alloc => {
      const toUserName = typeof alloc.toUserId === 'object' && alloc.toUserId
        ? alloc.toUserId.name
        : alloc.toUserName || 'Unknown User';
      let toUserId: any = '';
      if (typeof alloc.toUserId === 'object' && alloc.toUserId) {
        toUserId = (alloc.toUserId as any)._id || (alloc.toUserId as any).id;
      } else {
        toUserId = alloc.toUserId;
      }
      const toUserRole = typeof alloc.toUserId === 'object' && alloc.toUserId
        ? alloc.toUserId.role
        : alloc.toRole;
      const toUserImage = typeof alloc.toUserId === 'object' && alloc.toUserId
        ? (alloc.toUserId as any).avatar || (alloc.toUserId as any).profileImage
        : null;

      const key = toUserId || toUserName;
      
      if (!grouped[key]) {
        grouped[key] = {
          userId: toUserId,
          name: toUserName,
          role: toUserRole,
          avatar: toUserImage,
          allocations: [],
        };
      }
      
      grouped[key].allocations.push(alloc);
    });

    return Object.values(grouped);
  }, [filteredAllocations]);

  // Pagination logic
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return groupedAllocations.slice(start, start + itemsPerPage);
  }, [groupedAllocations, currentPage]);

  const totalPages = Math.ceil(groupedAllocations.length / itemsPerPage);

  // Stats
  const stats = useMemo(() => {
    return {
      total: filteredAllocations.length,
      users: groupedAllocations.length,
      completed: filteredAllocations.filter(a => a.status === 'completed').length,
      pending: filteredAllocations.filter(a => a.status === 'pending').length,
      reversed: filteredAllocations.filter(a => a.status === 'reversed').length,
      toRegional: filteredAllocations.filter(a => {
        const level = (a.toLevel || a.level) as string;
        return level === 'regional_manager';
      }).length,
      toTeam: filteredAllocations.filter(a => {
        const level = (a.toLevel || a.level) as string;
        return level === 'team_leader';
      }).length,
      toFO: filteredAllocations.filter(a => {
        const level = (a.toLevel || a.level) as string;
        return level === 'field_officer';
      }).length,
    };
  }, [filteredAllocations, groupedAllocations]);

  const getRoleBadge = (role: string | undefined) => {
    if (!role) {
      return (
        <Badge className="bg-gray-100 text-gray-800">
          Unknown
        </Badge>
      );
    }
    
    const colors: Record<string, string> = {
      admin: 'bg-purple-100 text-purple-800',
      regional_manager: 'bg-blue-100 text-blue-800',
      team_leader: 'bg-green-100 text-green-800',
      field_officer: 'bg-orange-100 text-orange-800',
    };
    return (
      <Badge className={colors[role] || 'bg-gray-100 text-gray-800'}>
        {role.replace('_', ' ')}
      </Badge>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'reversed':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const toggleUserExpanded = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 md:p-8 w-full mx-auto" style={{ maxWidth: '98vw' }}>
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Allocation Records</h1>
          <p className="text-muted-foreground mt-1">
            {stats.total} records found
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 w-full mb-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold">{stats.completed}</p>
              <p className="text-sm text-muted-foreground mt-2">Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold">{stats.pending}</p>
              <p className="text-sm text-muted-foreground mt-2">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold">{stats.reversed}</p>
              <p className="text-sm text-muted-foreground mt-2">Reversed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold">{stats.toRegional}</p>
              <p className="text-sm text-muted-foreground mt-2">To Regional</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold">{stats.toTeam}</p>
              <p className="text-sm text-muted-foreground mt-2">To Team</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold">{stats.toFO}</p>
              <p className="text-sm text-muted-foreground mt-2">To FO</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by product, IMEI, or user..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full"
                />
              </div>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="regional_manager">Regional Manager</SelectItem>
                  <SelectItem value="team_leader">Team Leader</SelectItem>
                  <SelectItem value="field_officer">Field Officer</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reversed">Reversed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <p className="font-semibold">Error loading allocations</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
            <p className="text-muted-foreground">Loading allocation records...</p>
          </div>
        ) : paginatedUsers.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">No allocation records found</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* User Allocation Cards */}
            <div className="space-y-4">
              {paginatedUsers.map((userGroup, idx) => {
                const isExpanded = expandedUsers.has(userGroup.userId || userGroup.name);
                const userKey = userGroup.userId || userGroup.name;

                return (
                  <Card key={`${userKey}-${idx}`} className="overflow-hidden">
                    {/* User Header */}
                    <div 
                      className="p-4 sm:p-6 cursor-pointer hover:bg-gray-50 transition-colors border-b"
                      onClick={() => toggleUserExpanded(userKey)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="h-10 w-10 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold">{userGroup.name}</h3>
                              {getRoleBadge(userGroup.role)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                {userGroup.allocations.length} device{userGroup.allocations.length !== 1 ? 's' : ''}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {userGroup.allocations.filter(a => a.status === 'completed').length} completed
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Allocations */}
                    {isExpanded && (
                      <CardContent className="pt-4 space-y-3 pb-4">
                        {userGroup.allocations.map((allocation, allocIdx) => {
                          const fromUserName = typeof allocation.fromUserId === 'object' && allocation.fromUserId
                            ? allocation.fromUserId.name
                            : allocation.fromUserName || 'Admin';
                          const productName = typeof allocation.productId === 'object' && allocation.productId
                            ? allocation.productId.name
                            : allocation.productName || 'Unknown Product';

                          return (
                            <div 
                              key={`${userKey}-alloc-${allocIdx}`}
                              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200"
                            >
                              <div className="flex-1 w-full sm:w-auto">
                                <p className="text-sm font-mono text-gray-700 mb-1">{allocation.imei || 'N/A'}</p>
                                <p className="text-sm font-medium text-gray-900">{productName}</p>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-gray-600">From:</span>
                                <Badge variant="outline">{fromUserName}</Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className="bg-blue-100 text-blue-800">{userGroup.role?.replace('_', ' ') || 'Unknown'}</Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                {getStatusIcon(allocation.status)}
                                <span className="text-sm font-medium capitalize">{allocation.status}</span>
                              </div>
                              <div className="text-xs text-gray-500">
                                {format(new Date(allocation.createdAt), 'MMM dd, yyyy h:mm a')}
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, groupedAllocations.length)} of {groupedAllocations.length} users
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1 text-sm rounded ${
                          currentPage === page
                            ? 'bg-blue-600 text-white'
                            : 'border hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
