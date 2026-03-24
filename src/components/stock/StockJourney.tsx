import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Building2, Users, UserCheck, User, Package, CheckCircle2, Clock, MapPin, Calendar, Smartphone, History, ShoppingCart } from 'lucide-react';
import { User as UserType, IMEI, StockAllocation } from '@/types';
import { format } from 'date-fns';

interface StockJourneyProps {
  imei: IMEI;
  users: UserType[];
  allocations: StockAllocation[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface JourneyStep {
  id: string;
  action: string;
  description: string;
  user?: UserType;
  role?: string;
  timestamp: Date;
  icon: React.ReactNode;
  color: string;
  isRecall?: boolean;
  isSale?: boolean;
}

const getRoleIcon = (role: string) => {
  switch (role) {
    case 'admin':
      return <Building2 className="h-4 w-4" />;
    case 'regional_manager':
      return <Users className="h-4 w-4" />;
    case 'team_leader':
      return <UserCheck className="h-4 w-4" />;
    case 'field_officer':
      return <User className="h-4 w-4" />;
    default:
      return <User className="h-4 w-4" />;
  }
};

const getRoleColor = (role: string) => {
  switch (role) {
    case 'admin':
      return 'bg-purple-500';
    case 'regional_manager':
      return 'bg-blue-500';
    case 'team_leader':
      return 'bg-green-500';
    case 'field_officer':
      return 'bg-orange-500';
    default:
      return 'bg-muted';
  }
};

export function StockJourney({ imei, users, allocations, open, onOpenChange }: StockJourneyProps) {
  // Build the journey from allocations
  const imeiAllocations = allocations
    .filter(a => a.imei === imei.imei)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const journeySteps: JourneyStep[] = [];

  // Registration step
  journeySteps.push({
    id: 'registration',
    action: 'Registered',
    description: `IMEI registered in the system from ${imei.source.toUpperCase()}`,
    timestamp: imei.registeredAt,
    icon: <Package className="h-4 w-4" />,
    color: 'bg-primary',
  });

  // Allocation steps
  imeiAllocations.forEach(alloc => {
    const toUser = users.find(u => u.id === alloc.toUserId);
    const fromUser = users.find(u => u.id === alloc.fromUserId);
    
    const isRecall = alloc.notes?.startsWith('RECALL:');
    
    if (isRecall) {
      journeySteps.push({
        id: alloc.id,
        action: 'Recalled',
        description: `Stock recalled from ${fromUser?.name || 'Unknown'} to ${toUser?.name || 'Unknown'}`,
        user: toUser,
        role: alloc.toRole,
        timestamp: alloc.createdAt,
        icon: getRoleIcon(alloc.toRole),
        color: 'bg-red-500',
        isRecall: true,
      });
    } else {
      const readableToRole = alloc.toRole ? alloc.toRole.replace('_', ' ') : 'Unknown role';
      journeySteps.push({
        id: alloc.id,
        action: `Allocated to ${readableToRole}`,
        description: `${fromUser?.name || 'Unknown'} allocated to ${toUser?.name || 'Unknown'}`,
        user: toUser,
        role: alloc.toRole,
        timestamp: alloc.createdAt,
        icon: getRoleIcon(alloc.toRole || ''),
        color: getRoleColor(alloc.toRole || ''),
      });
    }
  });

  // Sale step if sold
  if (imei.status === 'SOLD' && imei.soldAt) {
    const seller = users.find(u => u.id === imei.soldBy);
    journeySteps.push({
      id: 'sale',
      action: 'Sold to Customer',
      description: seller ? `Sold by ${seller.name}` : 'Sold to customer',
      user: seller,
      role: seller?.role,
      timestamp: imei.soldAt,
      icon: <ShoppingCart className="h-4 w-4" />,
      color: 'bg-green-600',
      isSale: true,
    });
  }

  // Current holder
  const currentHolder = users.find(u => u.id === imei.currentOwnerId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Stock Journey
          </DialogTitle>
          <DialogDescription>
            Complete allocation history for this device
          </DialogDescription>
        </DialogHeader>

        {/* Device Info */}
        <Card className="bg-muted/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Smartphone className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{imei.productName}</h3>
                <p className="text-sm font-mono text-muted-foreground">{imei.imei}</p>
              </div>
              <div className="text-right">
                <Badge 
                  variant={imei.status === 'SOLD' ? 'default' : 'secondary'}
                  className={imei.status === 'SOLD' ? 'bg-green-600' : ''}
                >
                  {(imei.status || '').replace('_', ' ') || 'Unknown'}
                </Badge>
                <p className="text-sm text-muted-foreground mt-1">{imei.source?.toUpperCase() || 'UNKNOWN'}</p>
              </div>
            </div>
            
            {currentHolder && imei.status !== 'SOLD' && (
              <div className="mt-4 pt-4 border-t flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Currently with: </span>
                <Badge variant="outline">{currentHolder.name}</Badge>
                <Badge className={`${getRoleColor(currentHolder.role || '')} text-white`}>
                  {(currentHolder.role || '').replace('_', ' ') || 'Unknown'}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Journey Timeline */}
        <ScrollArea className="max-h-[400px]">
          <div className="relative pl-8 space-y-4">
            {/* Timeline line */}
            <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border" />

            {journeySteps.map((step, index) => (
              <div key={step.id} className="relative">
                {/* Timeline dot */}
                <div className={`absolute left-[-20px] p-1.5 rounded-full ${step.color} text-white`}>
                  {step.icon}
                </div>

                {/* Step content */}
                <Card className={`ml-4 ${step.isSale ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : step.isRecall ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : ''}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="font-medium">{step.action}</h4>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                        {step.user && (
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {step.user.region || 'No region'}
                            </Badge>
                          </div>
                        )}
                      </div>
                      <div className="text-right text-sm text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(step.timestamp), 'PP')}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(step.timestamp), 'p')}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Summary */}
        <div className="flex items-center justify-between pt-4 border-t text-sm">
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">Total Steps:</span>
            <Badge variant="secondary">{journeySteps.length}</Badge>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">Days in System:</span>
            <Badge variant="secondary">
              {Math.ceil((new Date().getTime() - new Date(imei.registeredAt).getTime()) / (1000 * 60 * 60 * 24))}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {imei.status === 'SOLD' ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <Clock className="h-4 w-4 text-yellow-500" />
            )}
            <span className={imei.status === 'SOLD' ? 'text-green-600' : 'text-muted-foreground'}>
              {imei.status === 'SOLD' ? 'Journey Complete' : 'Awaiting Sale'}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
