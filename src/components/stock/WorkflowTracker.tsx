import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, UserCheck, User, ArrowRight, Package, CheckCircle2 } from 'lucide-react';
import { User as UserType, IMEI, StockAllocation } from '@/types';

interface WorkflowTrackerProps {
  currentUser: UserType;
  users: UserType[];
  imeis: IMEI[];
  stockAllocations: StockAllocation[];
}

interface HierarchyLevel {
  role: string;
  label: string;
  icon: React.ReactNode;
  users: UserType[];
  stockCount: number;
  soldCount: number;
  color: string;
}

export function WorkflowTracker({ currentUser, users, imeis, stockAllocations }: WorkflowTrackerProps) {
  // Calculate stats for each hierarchy level
  const hierarchyLevels: HierarchyLevel[] = [
    {
      role: 'admin',
      label: 'Admin (Warehouse)',
      icon: <Building2 className="h-5 w-5" />,
      users: users.filter(u => u.role === 'admin'),
      stockCount: imeis.filter(i => {
        // Check both currentOwnerId and currentHolderId
        const ownerId = i.currentOwnerId || (i as any).currentHolderId;
        const owner = users.find(u => u.id === ownerId);
        return owner?.role === 'admin' && i.status !== 'SOLD';
      }).length,
      soldCount: 0,
      color: 'bg-purple-500',
    },
    {
      role: 'regional_manager',
      label: 'Regional Managers',
      icon: <Users className="h-5 w-5" />,
      users: users.filter(u => u.role === 'regional_manager'),
      stockCount: imeis.filter(i => {
        const ownerId = i.currentOwnerId || (i as any).currentHolderId;
        const owner = users.find(u => u.id === ownerId);
        return owner?.role === 'regional_manager' && i.status !== 'SOLD';
      }).length,
      soldCount: 0,
      color: 'bg-blue-500',
    },
    {
      role: 'team_leader',
      label: 'Team Leaders',
      icon: <UserCheck className="h-5 w-5" />,
      users: users.filter(u => u.role === 'team_leader'),
      stockCount: imeis.filter(i => {
        const ownerId = i.currentOwnerId || (i as any).currentHolderId;
        const owner = users.find(u => u.id === ownerId);
        return owner?.role === 'team_leader' && i.status !== 'SOLD';
      }).length,
      soldCount: 0,
      color: 'bg-green-500',
    },
    {
      role: 'field_officer',
      label: 'Field Officers',
      icon: <User className="h-5 w-5" />,
      users: users.filter(u => u.role === 'field_officer'),
      stockCount: imeis.filter(i => {
        const ownerId = i.currentOwnerId || (i as any).currentHolderId;
        const owner = users.find(u => u.id === ownerId);
        return owner?.role === 'field_officer' && i.status !== 'SOLD';
      }).length,
      soldCount: imeis.filter(i => {
        const owner = users.find(u => u.id === i.soldBy);
        return owner?.role === 'field_officer' && i.status === 'SOLD';
      }).length,
      color: 'bg-orange-500',
    },
  ];

  // Calculate flow stats
  const recentAllocations = stockAllocations.filter(a => {
    const date = new Date(a.createdAt);
    const now = new Date();
    return (now.getTime() - date.getTime()) < 7 * 24 * 60 * 60 * 1000; // Last 7 days
  });

  const flowStats = {
    adminToRM: recentAllocations.filter(a => 
      (a.fromRole === 'admin' || (a as any).fromRole === 'admin') && 
      (a.toRole === 'regional_manager' || (a as any).toRole === 'regional_manager')
    ).length,
    rmToTL: recentAllocations.filter(a => 
      (a.fromRole === 'regional_manager' || (a as any).fromRole === 'regional_manager') && 
      (a.toRole === 'team_leader' || (a as any).toRole === 'team_leader')
    ).length,
    tlToFO: recentAllocations.filter(a => 
      (a.fromRole === 'team_leader' || (a as any).fromRole === 'team_leader') && 
      (a.toRole === 'field_officer' || (a as any).toRole === 'field_officer')
    ).length,
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          Stock Workflow Pipeline
        </CardTitle>
        <CardDescription>
          Real-time view of stock distribution across the organization hierarchy
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-4">
          {hierarchyLevels.map((level, index) => (
            <React.Fragment key={level.role}>
              {/* Level Card */}
              <div 
                className={`flex-1 min-w-[180px] rounded-lg border-2 p-4 transition-all ${
                  level.role === currentUser.role 
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                    : 'border-border bg-card'
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className={`p-2 rounded-full ${level.color} text-white`}>
                    {level.icon}
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">{level.label}</h4>
                    <p className="text-xs text-muted-foreground">
                      {level.users.length} user{level.users.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-muted/50 rounded p-2">
                    <p className="text-lg font-bold">{level.stockCount}</p>
                    <p className="text-xs text-muted-foreground">In Hand</p>
                  </div>
                  {level.role === 'field_officer' ? (
                    <div className="bg-green-100 dark:bg-green-900/30 rounded p-2">
                      <p className="text-lg font-bold text-green-600">{level.soldCount}</p>
                      <p className="text-xs text-muted-foreground">Sold</p>
                    </div>
                  ) : (
                    <div className="bg-blue-100 dark:bg-blue-900/30 rounded p-2">
                      <p className="text-lg font-bold text-blue-600">
                        {index < 3 ? Object.values(flowStats)[index] || 0 : 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Allocated (7d)</p>
                    </div>
                  )}
                </div>

                {level.role === currentUser.role && (
                  <Badge className="mt-3 w-full justify-center" variant="default">
                    You are here
                  </Badge>
                )}
              </div>

              {/* Arrow between levels */}
              {index < hierarchyLevels.length - 1 && (
                <div className="flex flex-col items-center gap-1 px-2">
                  <ArrowRight className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {index === 0 && flowStats.adminToRM > 0 && `${flowStats.adminToRM} items`}
                    {index === 1 && flowStats.rmToTL > 0 && `${flowStats.rmToTL} items`}
                    {index === 2 && flowStats.tlToFO > 0 && `${flowStats.tlToFO} items`}
                  </span>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Quick Legend */}
        <div className="flex items-center justify-center gap-6 pt-4 border-t text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-muted"></div>
            <span>Available Stock</span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4" />
            <span>Stock Flow Direction</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>Completed Sales</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
