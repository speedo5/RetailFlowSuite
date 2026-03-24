import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useApp } from '@/context/AppContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { 
  History, Search, Download, ShoppingCart, Package, Users, 
  DollarSign, Settings, Smartphone, Filter 
} from 'lucide-react';
import { ActivityType } from '@/types';
import { activityLogService } from '@/services/activityLogService';
import { exportToCSV } from '@/lib/pdfGenerator';
import { toast as sonnerToast } from 'sonner';

export default function ActivityLog() {
  const { hasPermission } = usePermissions();
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ActivityType>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch activity logs from API
  useEffect(() => {
    const fetchActivityLogs = async () => {
      try {
        setIsLoading(true);
        
        // Map activity type to entity type for API
        const entityTypeMap: Record<ActivityType | 'all', string> = {
          'sale': 'sale',
          'inventory': 'imei',
          'user': 'user',
          'commission': 'commission',
          'product': 'product',
          'system': 'system',
          'allocation': 'stock_allocation',
          'all': ''
        };

        // Calculate date range based on filter
        let startDate: string | undefined;
        let endDate: string | undefined;

        if (dateFilter !== 'all') {
          const now = new Date();
          endDate = now.toISOString();

          if (dateFilter === 'today') {
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);
            startDate = today.toISOString();
          } else if (dateFilter === 'week') {
            const weekAgo = new Date(now);
            weekAgo.setDate(now.getDate() - 7);
            startDate = weekAgo.toISOString();
          } else if (dateFilter === 'month') {
            const monthAgo = new Date(now);
            monthAgo.setMonth(now.getMonth() - 1);
            startDate = monthAgo.toISOString();
          }
        }

        const response = await activityLogService.getAll({
          entityType: typeFilter === 'all' ? undefined : entityTypeMap[typeFilter],
          search: searchQuery || undefined,
          startDate,
          endDate,
          page,
          limit: 50
        });

        console.log('📋 Activity Log Response:', response);

        if (response.success) {
          // Handle both response structures: response.data as array or response.data.data as array
          const logsData = Array.isArray(response.data) ? response.data : (response.data?.data || []);
          const pagesCount = response.data?.pages || 1;
          
          console.log('✓ Logs loaded:', logsData.length, 'Pages:', pagesCount);
          setActivityLogs(logsData);
          setTotalPages(pagesCount);
        } else {
          console.warn('⚠️ Response not successful:', response);
          setActivityLogs([]);
        }
      } catch (error) {
        console.error('❌ Failed to fetch activity logs:', error);
        setActivityLogs([]);
        sonnerToast.error('Failed to load activity logs');
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivityLogs();
  }, [searchQuery, typeFilter, dateFilter, page]);

  if (!hasPermission('viewActivityLog')) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Card className="p-8 text-center">
            <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You don't have permission to view activity logs.</p>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const getTypeIcon = (type: ActivityType) => {
    switch (type) {
      case 'sale': return <ShoppingCart className="h-4 w-4" />;
      case 'inventory': return <Smartphone className="h-4 w-4" />;
      case 'user': return <Users className="h-4 w-4" />;
      case 'commission': return <DollarSign className="h-4 w-4" />;
      case 'product': return <Package className="h-4 w-4" />;
      case 'system': return <Settings className="h-4 w-4" />;
      case 'allocation': return <Package className="h-4 w-4" />;
      default: return <History className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (log: any) => {
    // Map entity type from API to activity type for display
    const entityTypeToActivityType: Record<string, ActivityType> = {
      'sale': 'sale',
      'imei': 'inventory',
      'user': 'user',
      'commission': 'commission',
      'product': 'product',
      'system': 'system',
      'stock_allocation': 'allocation'
    };

    const type = (entityTypeToActivityType[log.entityType] || 'system') as ActivityType;

    const colors: Record<ActivityType, string> = {
      sale: 'bg-success/10 text-success',
      inventory: 'bg-primary/10 text-primary',
      user: 'bg-accent/10 text-accent',
      commission: 'bg-warning/10 text-warning',
      product: 'bg-muted text-muted-foreground',
      system: 'bg-destructive/10 text-destructive',
      allocation: 'bg-primary/10 text-primary',
    };
    return (
      <Badge variant="outline" className={colors[type]}>
        {getTypeIcon(type)}
        <span className="ml-1 capitalize">{log.entityType.replace('_', ' ')}</span>
      </Badge>
    );
  };

  const handleExport = () => {
    // Transform activity logs for export
    const exportData = activityLogs.map(log => ({
      action: log.action,
      entityType: log.entityType?.replace('_', ' ') || '',
      userName: log.userId?.name || 'Unknown User',
      userEmail: log.userId?.email || 'N/A',
      description: log.details?.description || log.details?.path || (typeof log.details === 'string' ? log.details : 'Activity recorded'),
      timestamp: format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm'),
      createdAt: new Date(log.createdAt).toISOString(),
    }));

    const columns = [
      { key: 'timestamp' as const, header: 'Date & Time' },
      { key: 'action' as const, header: 'Action' },
      { key: 'entityType' as const, header: 'Type' },
      { key: 'userName' as const, header: 'User' },
      { key: 'userEmail' as const, header: 'Email' },
      { key: 'description' as const, header: 'Details' },
    ];

    exportToCSV(exportData, 'activity-log', columns);
    sonnerToast.success('Activity log exported successfully');
  };

  return (
    <MainLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Activity Log</h1>
            <p className="text-muted-foreground">Track all system activities and changes</p>
          </div>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="sale">Sales</SelectItem>
              <SelectItem value="inventory">Inventory</SelectItem>
              <SelectItem value="user">Users</SelectItem>
              <SelectItem value="commission">Commissions</SelectItem>
              <SelectItem value="product">Products</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={(v: any) => setDateFilter(v)}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Activity List */}
        <Card className="border shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
                <p className="text-muted-foreground">Loading activity logs...</p>
              </div>
            ) : activityLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <History className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No activities found</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-border">
                  {activityLogs.map((log) => (
                    <div key={log._id || log.id} className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                          {getTypeIcon(
                            (() => {
                              const entityTypeToActivityType: Record<string, ActivityType> = {
                                'sale': 'sale',
                                'imei': 'inventory',
                                'user': 'user',
                                'commission': 'commission',
                                'product': 'product',
                                'system': 'system',
                                'stock_allocation': 'allocation'
                              };
                              return (entityTypeToActivityType[log.entityType] || 'system') as ActivityType;
                            })()
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-foreground">{log.action}</p>
                            <p className="text-sm font-semibold text-primary">by {log.userId?.name || 'Unknown User'}</p>
                            {getTypeBadge(log)}
                          </div>
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <span>{log.userId?.email || 'N/A'}</span>
                            <span>•</span>
                            <span>{format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 p-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === totalPages}
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
