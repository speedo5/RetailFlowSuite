import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { IMEI, IMEIStatus, PhoneSource, Product, CommissionConfig } from '@/types';
import { Search, Plus, Smartphone, ShoppingCart, AlertTriangle, CheckCircle, Pencil, Trash2, Download, Package, DollarSign, FileSpreadsheet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { exportInventory } from '@/lib/pdfGenerator';
import { AddProductDialog } from '@/components/inventory/AddProductDialog';
import { BulkImportDialog } from '@/components/inventory/BulkImportDialog';
import { imeiService } from '@/services/imeiService';
import { productService } from '@/services/productService';

export default function Inventory() {
  const { imeis, setImeis, products, setProducts, currentUser } = useApp();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | IMEIStatus>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingImei, setEditingImei] = useState<IMEI | null>(null);
  const [deleteImei, setDeleteImei] = useState<IMEI | null>(null);
  const [newImei, setNewImei] = useState({ 
    imei: '', 
    productId: '', 
    sellingPrice: '', 
    source: 'watu' as PhoneSource,
    foCommission: '',
    teamLeaderCommission: '',
    regionalManagerCommission: '',
    capacity: '',
  });

  // Get manager's region - Regional Managers only see their region's inventory
  const managerRegion = currentUser?.role === 'regional_manager' ? currentUser?.region : null;

  // Load products and IMEIs on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load products
      const productsResponse = await productService.getAll();
      if (productsResponse.success && productsResponse.data) {
        const productsData = Array.isArray(productsResponse.data.products)
          ? productsResponse.data.products
          : Array.isArray(productsResponse.data)
            ? productsResponse.data
            : [];
        setProducts(productsData.map((p: any) => ({
          id: p.id || p._id,
          name: p.name,
          category: p.category,
          price: p.price,
          stockQuantity: p.stockQuantity || 0,
          createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
        })))
      }

      // Load IMEIs (request large limit to retrieve full inventory for stats)
      const imeisResponse = await imeiService.getAll({ limit: 100000 });
      if (imeisResponse.success && imeisResponse.data) {
        const imeisData = Array.isArray(imeisResponse.data.imeis)
          ? imeisResponse.data.imeis
          : Array.isArray(imeisResponse.data)
            ? imeisResponse.data
            : [];
        
        // Filter IMEIs based on user role
        let filteredImeis = imeisData;
        if (currentUser?.role === 'regional_manager') {
          // Regional Managers only see their allocated stock
          filteredImeis = imeisData.filter((i: any) => i.status === 'allocated');
        } else if (managerRegion) {
          // Team Leaders see by region
          filteredImeis = imeisData.filter((i: any) => i.region === managerRegion);
        }
        
        setImeis(filteredImeis.map((i: any) => {
          // Map backend status (in_stock, sold, etc.) to frontend format (IN_STOCK, SOLD, etc.)
          const statusMap: Record<string, IMEIStatus> = {
            'in_stock': 'IN_STOCK',
            'allocated': 'ALLOCATED',
            'sold': 'SOLD',
            'locked': 'LOCKED',
            'lost': 'LOST',
          };
          const status = statusMap[i.status?.toLowerCase()] || (i.status as IMEIStatus) || 'IN_STOCK';
          
          return {
            id: i.id || i._id,
            imei: i.imei,
            productId: i.productId?._id || i.productId || '',
            productName: i.productId?.name || 'Unknown',
            capacity: i.capacity || i.capacityDetail || i.productId?.capacity || '',
            status,
            sellingPrice: i.price || i.sellingPrice || 0, // Use price field from API, fallback to sellingPrice
            commission: i.commissionConfig ? 
              (i.commissionConfig.foCommission || 0) + 
              (i.commissionConfig.teamLeaderCommission || 0) + 
              (i.commissionConfig.regionalManagerCommission || 0) : 0,
            commissionConfig: i.commissionConfig,
            source: i.source || 'watu',
            registeredAt: i.registeredAt ? new Date(i.registeredAt) : new Date(),
          };
        }));
      }
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const phoneProducts = products.filter(p => 
    p.category === 'Smartphones' || 
    p.category === 'Feature Phones' || 
    p.category === 'Tablets'
  );
  const isAdmin = currentUser?.role === 'admin';

  const handleAddProduct = async (productData: Omit<Product, 'id' | 'createdAt'> & { specs?: string }) => {
    try {
      const response = await productService.create({
        name: productData.name,
        category: productData.category,
        price: productData.price,
        description: productData.specs,
      });

      if (response.success && response.data) {
        const newProduct: Product = {
          id: (response.data as any).id || (response.data as any)._id || `prod-${Date.now()}`,
          name: response.data.name,
          category: response.data.category,
          price: response.data.price,
          stockQuantity: 0,
          createdAt: response.data.createdAt ? new Date(response.data.createdAt) : new Date(),
        };
        setProducts([...products, newProduct]);
        toast({ title: 'Success', description: 'Product added successfully' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to add product', variant: 'destructive' });
      console.error('Error adding product:', error);
    }
  };

  const filteredImeis = imeis.filter(item => {
    const matchesSearch = item.imei.includes(searchQuery) || 
                         item.productName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const inStockImeis = filteredImeis.filter(i => i.status === 'IN_STOCK');
  const soldImeis = filteredImeis.filter(i => i.status === 'SOLD');
  const allocatedImeis = filteredImeis.filter(i => i.status === 'ALLOCATED');
  const lostImeis = filteredImeis.filter(i => i.status === 'LOST' || i.status === 'LOCKED');

  const validateIMEI = (imei: string, excludeId?: string) => {
    if (imei.length !== 15) return 'IMEI must be 15 digits';
    if (!/^\d+$/.test(imei)) return 'IMEI must contain only numbers';
    if (imeis.some(i => i.imei === imei && i.id !== excludeId)) return 'IMEI already exists';
    return null;
  };

  const handleRegisterIMEI = async () => {
    const validationError = validateIMEI(newImei.imei);
    if (validationError) {
      toast({ title: 'Validation Error', description: validationError, variant: 'destructive' });
      return;
    }
    if (!newImei.productId) {
      toast({ title: 'Validation Error', description: 'Please select a product', variant: 'destructive' });
      return;
    }
    const product = products.find(p => p.id === newImei.productId);
    if (!product) return;

    // Build commission config if any commission is set
    const foComm = parseFloat(newImei.foCommission) || 0;
    const tlComm = parseFloat(newImei.teamLeaderCommission) || 0;
    const rmComm = parseFloat(newImei.regionalManagerCommission) || 0;
    const totalCommission = foComm + tlComm + rmComm;

    const commissionConfig: CommissionConfig | undefined = totalCommission > 0 ? {
      foCommission: foComm,
      teamLeaderCommission: tlComm,
      regionalManagerCommission: rmComm,
    } : undefined;

    try {
      const response = await imeiService.register({
        imei: newImei.imei,
        productId: newImei.productId,
        price: parseFloat(newImei.sellingPrice) || undefined, // Include selling price
        source: newImei.source, // Include selected source company
        capacity: newImei.capacity,
        commissionConfig,
      });

      if (response.success && response.data) {
        const data = response.data as any;
        // Map backend status (in_stock, sold, etc.) to frontend format (IN_STOCK, SOLD, etc.)
        const statusMap: Record<string, IMEIStatus> = {
          'in_stock': 'IN_STOCK',
          'allocated': 'ALLOCATED',
          'sold': 'SOLD',
          'locked': 'LOCKED',
          'lost': 'LOST',
        };
        const status = statusMap[data.status?.toLowerCase()] || (data.status as IMEIStatus) || 'IN_STOCK';
        
        const newItem: IMEI = {
          id: data.id || data._id || `imei-${Date.now()}`,
          imei: data.imei,
          productId: newImei.productId,
          productName: product.name,
          capacity: newImei.capacity || data.capacity || '',
          status,
          sellingPrice: parseFloat(newImei.sellingPrice) || product.price,
          commission: totalCommission,
          commissionConfig,
          source: newImei.source,
          registeredAt: data.registeredAt ? new Date(data.registeredAt) : new Date(),
        };

        setImeis(prev => [...prev, newItem]);
        setIsDialogOpen(false);
        setNewImei({ 
          imei: '', 
          productId: '', 
          sellingPrice: '', 
          source: 'watu',
          foCommission: '',
          teamLeaderCommission: '',
          regionalManagerCommission: '',
          capacity: '',
        });
        toast({ title: 'Success', description: `IMEI ${newItem.imei} registered successfully` });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to register IMEI', variant: 'destructive' });
      console.error('Error registering IMEI:', error);
    }
  };

  const handleEditImei = async () => {
    if (!editingImei) return;
    const validationError = validateIMEI(editingImei.imei, editingImei.id);
    if (validationError) {
      toast({ title: 'Validation Error', description: validationError, variant: 'destructive' });
      return;
    }

    try {
      const commissionConfig = editingImei.commissionConfig || {
        foCommission: 0,
        teamLeaderCommission: 0,
        regionalManagerCommission: 0,
      };

      // Convert status to lowercase for API (IN_STOCK -> in_stock)
      const statusMap: Record<IMEIStatus, string> = {
        'IN_STOCK': 'in_stock',
        'ALLOCATED': 'allocated',
        'SOLD': 'sold',
        'LOCKED': 'locked',
        'LOST': 'lost',
      };
      const apiStatus = statusMap[editingImei.status] || editingImei.status.toLowerCase();

      const response = await imeiService.update(editingImei.id, {
        status: apiStatus,
        commissionConfig,
        price: editingImei.sellingPrice, // Save the selling price
        capacity: editingImei.capacity,
      });

      if (response.success && response.data) {
        const updated = response.data as any;
        // Map backend lowercase status (e.g. 'in_stock') to frontend enum (e.g. 'IN_STOCK')
        const backendToFrontendStatus: Record<string, IMEIStatus> = {
          'in_stock': 'IN_STOCK',
          'allocated': 'ALLOCATED',
          'sold': 'SOLD',
          'locked': 'LOCKED',
          'lost': 'LOST',
        };

        const updatedStatus = backendToFrontendStatus[(updated.status || '').toLowerCase()] || editingImei.status;

        const updatedItem: IMEI = {
          id: updated.id || updated._id,
          imei: updated.imei,
          productId: updated.productId?._id || updated.productId || editingImei.productId,
          productName: updated.productId?.name || editingImei.productName,
          capacity: updated.capacity ?? editingImei.capacity ?? '',
          status: updatedStatus,
          sellingPrice: updated.price ?? editingImei.sellingPrice,
          commission: (updated.commissionConfig?.foCommission || 0) + (updated.commissionConfig?.teamLeaderCommission || 0) + (updated.commissionConfig?.regionalManagerCommission || 0) || editingImei.commission,
          commissionConfig: updated.commissionConfig || editingImei.commissionConfig,
          source: updated.source || editingImei.source,
          registeredAt: updated.registeredAt ? new Date(updated.registeredAt) : editingImei.registeredAt,
        };

        setImeis(prev => prev.map(i => i.id === editingImei.id ? updatedItem : i));
        setEditingImei(null);
        toast({ title: 'Success', description: 'IMEI updated successfully' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update IMEI', variant: 'destructive' });
      console.error('Error updating IMEI:', error);
    }
  };

  const handleDeleteImei = async () => {
    if (!deleteImei) return;
    try {
      // Call the delete endpoint and ensure server confirms deletion
      const response = await imeiService.delete(deleteImei.id);
      if (response && (response as any).success) {
        setImeis(prev => prev.filter(i => i.id !== deleteImei.id));
        setDeleteImei(null);
        toast({ title: 'Success', description: 'IMEI deleted from inventory' });
      } else {
        // API responded but indicated failure
        const msg = (response as any)?.message || 'Failed to delete IMEI on server';
        toast({ title: 'Error', description: msg, variant: 'destructive' });
      }
    } catch (error: any) {
      // Surface server/authorization errors and keep item in UI
      toast({ title: 'Error', description: error?.message || 'Failed to delete IMEI', variant: 'destructive' });
      console.error('Error deleting IMEI:', error);
    }
  };

  const handleSell = (imei: IMEI) => {
    navigate(`/pos?imei=${imei.imei}&product=${imei.productId}`);
  };

  const getStatusBadge = (status: IMEIStatus) => {
    switch (status) {
      case 'IN_STOCK': return <span className="badge-success">In Stock</span>;
      case 'SOLD': return <span className="badge-info">Sold</span>;
      case 'LOCKED': return <span className="badge-warning">Locked</span>;
      case 'LOST': return <span className="badge-danger">Lost</span>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const statCards = [
    { label: 'Total IMEIs', value: imeis.length, icon: Smartphone, color: 'text-primary' },
    { label: 'In Stock', value: imeis.filter(i => i.status === 'IN_STOCK').length, icon: CheckCircle, color: 'text-success' },
    { label: 'Sold', value: imeis.filter(i => i.status === 'SOLD').length, icon: ShoppingCart, color: 'text-accent' },
    { label: 'Lost/Locked', value: imeis.filter(i => i.status === 'LOST' || i.status === 'LOCKED').length, icon: AlertTriangle, color: 'text-warning' },
  ];

  return (
    <MainLayout>
      <div className="animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Inventory</h1>
            <p className="text-muted-foreground">Manage IMEI registration and phone inventory</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <>
                <Button variant="outline" onClick={() => exportInventory(imeis)}>
                  <Download className="h-4 w-4 mr-2" />Export
                </Button>
                <Button variant="outline" onClick={() => setIsBulkImportOpen(true)}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Bulk Import</span>
                  <span className="sm:hidden">Import</span>
                </Button>
                <Button variant="outline" onClick={() => setIsAddProductOpen(true)}>
                  <Package className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Add Product</span>
                  <span className="sm:hidden">Product</span>
                </Button>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="btn-brand">
                      <Plus className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Register IMEI</span>
                      <span className="sm:hidden">IMEI</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Register New IMEI</DialogTitle>
                  <DialogDescription>Add a new phone to inventory with commission settings.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                  <div className="grid gap-2">
                    <Label>IMEI Number (15 digits)</Label>
                    <Input placeholder="Enter 15-digit IMEI" value={newImei.imei} onChange={(e) => setNewImei({ ...newImei, imei: e.target.value.replace(/\D/g, '').slice(0, 15) })} maxLength={15} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Product Model</Label>
                    <Select value={newImei.productId} onValueChange={(v) => {
                      const prod = products.find(p => p.id === v);
                      // Auto-populate capacity from product name if it contains GB
                      const extractCapacityFromName = (name: string) => {
                        if (!name) return '';
                        // Look for the last GB value in the name (typically storage)
                        const matches = name.match(/(\d+)\s*GB/gi);
                        if (matches && matches.length > 0) {
                          const lastMatch = matches[matches.length - 1];
                          return lastMatch.replace(/\s+/g, '');
                        }
                        return '';
                      };
                      const autoCapacity = extractCapacityFromName(prod?.name || '');
                      setNewImei({ 
                        ...newImei, 
                        productId: v, 
                        sellingPrice: prod?.price.toString() || '',
                        capacity: autoCapacity || newImei.capacity // Keep existing capacity if auto-extraction fails
                      });
                    }}>
                      <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                      <SelectContent>
                        {phoneProducts.map((product) => (<SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>))}
                      </SelectContent>
                  </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Source Company</Label>
                    <Select value={newImei.source} onValueChange={(v: PhoneSource) => setNewImei({ ...newImei, source: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="watu">Watu</SelectItem>
                        <SelectItem value="mogo">Mogo</SelectItem>
                        <SelectItem value="onfon">Onfon</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Capacity</Label>
                    <Input placeholder="e.g. 4GB|64GB (auto-filled from product name)" value={newImei.capacity} onChange={(e) => setNewImei({ ...newImei, capacity: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Selling Price (Ksh)</Label>
                    <Input type="number" value={newImei.sellingPrice} onChange={(e) => setNewImei({ ...newImei, sellingPrice: e.target.value })} />
                  </div>
                  
                  {/* Commission Configuration Section - Admin Only */}
                  {isAdmin && (
                    <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-border">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-success" />
                        Commission Configuration
                      </Label>
                      <p className="text-xs text-muted-foreground">Set commission amounts for each role when this phone is sold.</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">FO (Ksh)</Label>
                          <Input 
                            type="number" 
                            placeholder="0"
                            value={newImei.foCommission} 
                            onChange={(e) => setNewImei({ ...newImei, foCommission: e.target.value })} 
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Team Leader</Label>
                          <Input 
                            type="number" 
                            placeholder="0"
                            value={newImei.teamLeaderCommission} 
                            onChange={(e) => setNewImei({ ...newImei, teamLeaderCommission: e.target.value })} 
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Regional Mgr</Label>
                          <Input 
                            type="number" 
                            placeholder="0"
                            value={newImei.regionalManagerCommission} 
                            onChange={(e) => setNewImei({ ...newImei, regionalManagerCommission: e.target.value })} 
                          />
                        </div>
                      </div>
                      {(parseFloat(newImei.foCommission) || parseFloat(newImei.teamLeaderCommission) || parseFloat(newImei.regionalManagerCommission)) > 0 && (
                        <div className="text-xs text-success font-medium">
                          Total Commission: Ksh {(
                            (parseFloat(newImei.foCommission) || 0) + 
                            (parseFloat(newImei.teamLeaderCommission) || 0) + 
                            (parseFloat(newImei.regionalManagerCommission) || 0)
                          ).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleRegisterIMEI} className="btn-brand">Register</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {statCards.map((stat) => (
            <Card key={stat.label} className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <stat.icon className={`h-8 w-8 ${stat.color}`} />
                  <div>
                    <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by IMEI or model..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filter by status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="IN_STOCK">In Stock</SelectItem>
              <SelectItem value="SOLD">Sold</SelectItem>
              <SelectItem value="LOCKED">Locked</SelectItem>
              <SelectItem value="LOST">Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="available" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="available">Available <span className="ml-1 text-xs bg-success/20 text-success px-2 py-0.5 rounded-full">{isLoading ? '—' : inStockImeis.length}</span></TabsTrigger>
            <TabsTrigger value="sold">Sold <span className="ml-1 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">{isLoading ? '—' : soldImeis.length}</span></TabsTrigger>
            <TabsTrigger value="allocated">Allocated <span className="ml-1 text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">{isLoading ? '—' : allocatedImeis.length}</span></TabsTrigger>
            <TabsTrigger value="lost">Lost <span className="ml-1 text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded-full">{isLoading ? '—' : lostImeis.length}</span></TabsTrigger>
          </TabsList>
          <TabsContent value="available">
            <InventoryTable imeis={inStockImeis} getStatusBadge={getStatusBadge} onEdit={setEditingImei} onDelete={setDeleteImei} onSell={handleSell} showActions isAdmin={isAdmin} />
          </TabsContent>
          <TabsContent value="sold">
            <InventoryTable imeis={soldImeis} getStatusBadge={getStatusBadge} />
          </TabsContent>
          <TabsContent value="allocated">
            <InventoryTable imeis={allocatedImeis} getStatusBadge={getStatusBadge} />
          </TabsContent>
          <TabsContent value="lost">
            <InventoryTable imeis={lostImeis} getStatusBadge={getStatusBadge} onEdit={setEditingImei} onDelete={setDeleteImei} showActions isAdmin={isAdmin} />
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={!!editingImei} onOpenChange={(open) => !open && setEditingImei(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit IMEI</DialogTitle></DialogHeader>
            {editingImei && (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>IMEI</Label>
                  <Input value={editingImei.imei} onChange={(e) => setEditingImei({ ...editingImei, imei: e.target.value.replace(/\D/g, '').slice(0, 15) })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Selling Price</Label>
                    <Input type="number" value={editingImei.sellingPrice} onChange={(e) => setEditingImei({ ...editingImei, sellingPrice: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Total Commission</Label>
                    <Input type="number" value={editingImei.commission} onChange={(e) => setEditingImei({ ...editingImei, commission: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Capacity</Label>
                  <Input value={editingImei.capacity || ''} onChange={(e) => setEditingImei({ ...editingImei, capacity: e.target.value })} />
                </div>
                {isAdmin && editingImei.commissionConfig && (
                  <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-border">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-success" />
                      Commission Breakdown
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">FO (Ksh)</Label>
                        <Input 
                          type="number" 
                          value={editingImei.commissionConfig.foCommission} 
                          onChange={(e) => setEditingImei({ 
                            ...editingImei, 
                            commissionConfig: { 
                              ...editingImei.commissionConfig!, 
                              foCommission: parseFloat(e.target.value) || 0 
                            } 
                          })} 
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Team Leader</Label>
                        <Input 
                          type="number" 
                          value={editingImei.commissionConfig.teamLeaderCommission} 
                          onChange={(e) => setEditingImei({ 
                            ...editingImei, 
                            commissionConfig: { 
                              ...editingImei.commissionConfig!, 
                              teamLeaderCommission: parseFloat(e.target.value) || 0 
                            } 
                          })} 
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Regional Mgr</Label>
                        <Input 
                          type="number" 
                          value={editingImei.commissionConfig.regionalManagerCommission} 
                          onChange={(e) => setEditingImei({ 
                            ...editingImei, 
                            commissionConfig: { 
                              ...editingImei.commissionConfig!, 
                              regionalManagerCommission: parseFloat(e.target.value) || 0 
                            } 
                          })} 
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={editingImei.status} onValueChange={(v: IMEIStatus) => setEditingImei({ ...editingImei, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IN_STOCK">In Stock</SelectItem>
                      <SelectItem value="LOCKED">Locked</SelectItem>
                      <SelectItem value="LOST">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingImei(null)}>Cancel</Button>
              <Button onClick={handleEditImei} className="btn-brand">Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteImei} onOpenChange={(open) => !open && setDeleteImei(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete IMEI?</AlertDialogTitle>
              <AlertDialogDescription>This will permanently remove IMEI {deleteImei?.imei} from inventory.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteImei} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Add Product Dialog */}
        <AddProductDialog 
          open={isAddProductOpen} 
          onOpenChange={setIsAddProductOpen}
          onProductAdded={(product) => {
            setProducts([...products, product]);
            toast({ title: 'Success', description: 'Product added successfully' });
          }}
        />

        {/* Bulk Import Dialog */}
        <BulkImportDialog
          open={isBulkImportOpen}
          onOpenChange={setIsBulkImportOpen}
          onImport={(newImeis) => setImeis([...imeis, ...newImeis])}
          products={products}
        />
      </div>
    </MainLayout>
  );
}

interface InventoryTableProps {
  imeis: IMEI[];
  getStatusBadge: (status: IMEIStatus) => React.ReactNode;
  showActions?: boolean;
  onEdit?: (imei: IMEI) => void;
  onDelete?: (imei: IMEI) => void;
  onSell?: (imei: IMEI) => void;
  isAdmin?: boolean;
}

function InventoryTable({ imeis, getStatusBadge, showActions, onEdit, onDelete, onSell, isAdmin = false }: InventoryTableProps) {
  if (imeis.length === 0) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Smartphone className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No items found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Model</th>
              <th>IMEI</th>
              <th>Selling Price</th>
              <th>Commission</th>
              <th>Status</th>
              {showActions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {imeis.map((item, index) => (
              <tr key={item.id}>
                <td className="text-muted-foreground">{index + 1}</td>
                <td className="font-medium">{item.productName}</td>
                <td className="font-mono text-sm">{item.imei}</td>
                <td className="font-medium text-foreground">Ksh {item.sellingPrice.toLocaleString()}</td>
                <td className="text-success">Ksh {item.commission.toLocaleString()}</td>
                <td>{getStatusBadge(item.status)}</td>
                {showActions && (
                  <td>
                    <div className="flex gap-1">
                      {onSell && item.status === 'IN_STOCK' && (
                        <Button size="sm" variant="default" onClick={() => onSell(item)} className="bg-success hover:bg-success/90">
                          <ShoppingCart className="h-3 w-3 mr-1" />
                          Sell
                        </Button>
                      )}
                      {onEdit && (
                        <Button size="sm" variant="ghost" onClick={() => onEdit(item)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                            {onDelete && isAdmin && (
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(item)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
