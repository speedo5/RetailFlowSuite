import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, CheckCircle, Clock, Download, TrendingUp, Calendar } from 'lucide-react';
import { exportCommissions } from '@/lib/pdfGenerator';
import { commissionService } from '@/services/commissionService';
import { salesService } from '@/services/salesService';
import { useState, useEffect } from 'react';

export default function FOCommissions() {
  const { currentUser, products } = useApp();
  const [foCommissions, setFoCommissions] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load FO commissions and sales data from API
  useEffect(() => {
    const loadData = async () => {
      if (!currentUser?.id) return;

      try {
        setIsLoading(true);
        
        // Fetch commissions for this FO
        const commissionsRes = await commissionService.getAll({ userId: currentUser.id });
        let loadedCommissions: any[] = [];
        if (Array.isArray(commissionsRes)) {
          loadedCommissions = commissionsRes;
        } else if ((commissionsRes as any)?.data) {
          if (Array.isArray((commissionsRes as any).data)) {
            loadedCommissions = (commissionsRes as any).data;
          } else if ((commissionsRes.data as any).data && Array.isArray((commissionsRes.data as any).data)) {
            loadedCommissions = (commissionsRes.data as any).data;
          } else if ((commissionsRes as any).data.commissions && Array.isArray((commissionsRes as any).data.commissions)) {
            loadedCommissions = (commissionsRes as any).data.commissions;
          }
        }
        
        console.log('Loaded FO commissions:', loadedCommissions);
        setFoCommissions(loadedCommissions);

        // Fetch sales data for commission context
        const salesRes = await salesService.getAll({ foId: currentUser.id });
        let loadedSales: any[] = [];
        if (Array.isArray(salesRes)) {
          loadedSales = salesRes;
        } else if ((salesRes as any)?.data) {
          loadedSales = Array.isArray((salesRes as any).data)
            ? (salesRes as any).data
            : (salesRes as any).data.sales || [];
        }

        // Index sales by ID for quick lookup
        const salesIndex: Record<string, any> = {};
        loadedSales.forEach(s => {
          salesIndex[s.id || s._id] = s;
        });
        setSalesData(salesIndex);
      } catch (error) {
        console.error('Error loading commissions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [currentUser?.id]);
  const totalEarned = foCommissions.reduce((sum, c) => sum + (c.amount || 0), 0);
  const paidAmount = foCommissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + (c.amount || 0), 0);
  const pendingAmount = foCommissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + (c.amount || 0), 0);
  const reversedAmount = foCommissions.filter(c => c.status === 'reversed').reduce((sum, c) => sum + (c.amount || 0), 0);

  // Commission analytics
  const thisMonthCommissions = foCommissions.filter(c => {
    const commDate = new Date(c.createdAt);
    const now = new Date();
    return commDate.getMonth() === now.getMonth() && commDate.getFullYear() === now.getFullYear();
  });
  const thisMonthTotal = thisMonthCommissions.reduce((sum, c) => sum + (c.amount || 0), 0);

  // Product breakdown - count and sum by product
  const productBreakdown: Record<string, { count: number; total: number; productName: string }> = {};
  foCommissions.forEach(c => {
    const key = c.productId || 'unknown';
    if (!productBreakdown[key]) {
      productBreakdown[key] = { count: 0, total: 0, productName: c.productName || 'Unknown' };
    }
    productBreakdown[key].count += 1;
    productBreakdown[key].total += c.amount || 0;
  });

  const topProducts = Object.entries(productBreakdown)
    .map(([, data]) => data)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const avgCommissionPerSale = foCommissions.length > 0 ? Math.round(totalEarned / foCommissions.length) : 0;

  // Group by sale for a better view
  const commissionList = foCommissions
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">My Commissions</h1>
          <p className="text-muted-foreground">Track your earnings from phone sales</p>
        </div>
        <Button variant="outline" onClick={() => foCommissions.length > 0 && exportCommissions(foCommissions)} disabled={foCommissions.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading commissions...</div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="border shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">Ksh {totalEarned.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total Earned</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-success">Ksh {paidAmount.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Paid Out</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-warning">Ksh {pendingAmount.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">Ksh {thisMonthTotal.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">This Month</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Analytics Row */}
          <div className="grid gap-4 md:grid-cols-2 mb-6">
            {/* Top Products */}
            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Top Commission Products
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topProducts.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No commission data yet</div>
                ) : (
                  <div className="space-y-3">
                    {topProducts.map((product, idx) => (
                      <div key={product.productName} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </div>
                          <div>
                            <div className="font-medium">{product.productName}</div>
                            <div className="text-xs text-muted-foreground">{product.count} sale{product.count !== 1 ? 's' : ''}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-success">Ksh {product.total.toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Commission Summary */}
            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Commission Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b">
                    <span className="text-muted-foreground">Total Sales</span>
                    <span className="font-bold">{foCommissions.length}</span>
                  </div>
                  <div className="flex items-center justify-between pb-3 border-b">
                    <span className="text-muted-foreground">Avg Commission/Sale</span>
                    <span className="font-bold">Ksh {avgCommissionPerSale.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between pb-3 border-b">
                    <span className="text-muted-foreground">This Month Sales</span>
                    <span className="font-bold">{thisMonthCommissions.length}</span>
                  </div>
                  {reversedAmount > 0 && (
                    <div className="flex items-center justify-between pt-2 text-destructive">
                      <span className="text-muted-foreground">Reversed</span>
                      <span className="font-bold">-Ksh {reversedAmount.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Commission Records */}
      <Card className="border shadow-sm overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Commission History ({commissionList.length} sale{commissionList.length !== 1 ? 's' : ''})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {commissionList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No commissions yet</p>
              <p className="text-sm text-muted-foreground mt-1">Complete phone sales to earn commissions</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Product</th>
                    <th>IMEI</th>
                    <th>Commission</th>
                    <th>Status</th>
                    <th>Paid On</th>
                  </tr>
                </thead>
                <tbody>
                  {commissionList.map((commission: any, idx: number) => {
                    const dateObj = commission.createdAt ? new Date(commission.createdAt) : null;
                    const paidDateObj = commission.paidAt ? new Date(commission.paidAt) : null;
                    return (
                      <tr key={commission.id || commission._id || idx}>
                        <td className="text-muted-foreground whitespace-nowrap">
                          {dateObj ? dateObj.toLocaleString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : '—'}
                        </td>
                        <td className="font-medium">{commission.productName || 'Unknown'}</td>
                        <td className="font-mono text-sm text-muted-foreground">{commission.imei || '—'}</td>
                        <td className="font-bold text-success">Ksh {(commission.amount || 0).toLocaleString()}</td>
                        <td>
                          {commission.status === 'paid' ? (
                            <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Paid
                            </Badge>
                          ) : commission.status === 'reversed' ? (
                            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                              Reversed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </td>
                        <td className="text-muted-foreground whitespace-nowrap">
                          {paidDateObj ? paidDateObj.toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric'
                          }) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
