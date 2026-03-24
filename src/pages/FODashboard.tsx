import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, ShoppingCart, Smartphone, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { salesService } from '@/services/salesService';
import { commissionService } from '@/services/commissionService';

export default function FODashboard() {
  const { sales, setSales, commissions, setCommissions, imeis, currentUser, users } = useApp();
  const [isLoading, setIsLoading] = useState(true);

  // Load FO-specific data on component mount
  useEffect(() => {
    const loadDashboardData = async () => {
      if (!currentUser?.id) return;

      try {
        setIsLoading(true);

        // Fetch FO's sales
        try {
          const salesRes = await salesService.getAll({ foId: currentUser.id });
          let loadedSales: any[] = [];
          if (Array.isArray(salesRes)) {
            loadedSales = salesRes;
          } else if ((salesRes as any)?.data) {
            loadedSales = Array.isArray((salesRes as any).data) 
              ? (salesRes as any).data 
              : (salesRes as any).data.sales || [];
          }
          if (loadedSales.length > 0) {
            setSales(loadedSales);
          }
        } catch (err) {
          console.error('Error loading sales:', err);
        }

        // Fetch FO's commissions
        try {
          const commissionsRes = await commissionService.getAll({ userId: currentUser.id });
          let loadedCommissions: any[] = [];
          if (Array.isArray(commissionsRes)) {
            loadedCommissions = commissionsRes;
          } else if ((commissionsRes as any)?.data) {
            loadedCommissions = Array.isArray((commissionsRes as any).data) 
              ? (commissionsRes as any).data 
              : (commissionsRes as any).data.commissions || [];
          }
          if (loadedCommissions.length > 0) {
            setCommissions(loadedCommissions);
          }
        } catch (err) {
          console.error('Error loading commissions:', err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [currentUser?.id, setSales, setCommissions]);

  const foSales = sales.filter(s => (s as any).foId === currentUser?.id || (s as any).foCode === currentUser?.id || (s as any).createdBy === currentUser?.id);
  const foCommissions = commissions.filter(c => (c as any).userId === currentUser?.id || (c as any).foId === currentUser?.id);

  // Get team leader and regional manager info
  const teamLeader = users?.find(u => u.id === currentUser?.teamLeaderId);
  const regionalManager = users?.find(u => u.id === currentUser?.regionalManagerId);

  // Calculate metrics with safe property access
  const totalSales = foSales.reduce((sum, s) => {
    const saleAny = s as any;
    return sum + (saleAny.saleAmount ?? saleAny.totalAmount ?? saleAny.amount ?? 0);
  }, 0);

  const totalCommissions = foCommissions.reduce((sum, c) => {
    return sum + ((c as any).amount ?? 0);
  }, 0);

  const phonesSold = foSales.filter(s => !!(s as any).imei).length;

  const todaySales = foSales.filter(s => {
    const saleAny = s as any;
    const saleDate = saleAny.createdAt ? new Date(saleAny.createdAt) : saleAny.date ? new Date(saleAny.date) : null;
    return saleDate ? saleDate.toDateString() === new Date().toDateString() : false;
  }).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Dashboard</h1>
        <div className="text-sm text-muted-foreground space-y-1 mt-1">
          <p>Welcome back, <span className="font-medium text-foreground">{currentUser?.name}</span></p>
          {teamLeader && (
            <p>Team Leader: <span className="font-medium text-foreground">{teamLeader.name}</span></p>
          )}
          {regionalManager && (
            <p>Regional Manager: <span className="font-medium text-foreground">{regionalManager.name}</span> {currentUser?.region && <span className="text-muted-foreground">({currentUser.region})</span>}</p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading your dashboard data...</div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">Ksh {totalSales.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Total Sales</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">Ksh {totalCommissions.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Commissions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Smartphone className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{phonesSold}</p>
                    <p className="text-sm text-muted-foreground">Phones Sold</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{todaySales}</p>
                    <p className="text-sm text-muted-foreground">Today's Sales</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Sales */}
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle>Recent Sales ({foSales.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {foSales.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No sales yet</p>
              ) : (
                <div className="space-y-3">
                  {foSales.slice(0, 5).map((sale, idx) => {
                    const saleAny = sale as any;
                    const saleAmount = saleAny.saleAmount ?? saleAny.totalAmount ?? saleAny.amount ?? 0;
                    const saleDate = saleAny.createdAt ? new Date(saleAny.createdAt) : saleAny.date ? new Date(saleAny.date) : null;
                    return (
                      <div key={sale.id || idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">{saleAny.productName || 'Sale'}</p>
                          <p className="text-sm text-muted-foreground">
                            {saleDate ? saleDate.toLocaleDateString() : '—'}
                          </p>
                        </div>
                        <p className="font-bold text-success">Ksh {saleAmount.toLocaleString()}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
