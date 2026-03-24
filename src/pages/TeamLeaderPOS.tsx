import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { generateReceiptNumber } from '@/lib/pdfGenerator';
import { Sale, PhoneSource, PaymentMethod } from '@/types';
import { ShoppingCart, Wallet, CreditCard, Receipt, Search, CheckCircle, Smartphone, Building2, User, Zap } from 'lucide-react';
import { salesService } from '@/services/salesService';
import { inventoryService } from '@/services/inventoryService';
import { imeiService } from '@/services/imeiService';
import { inventoryRealtimeSyncService } from '@/services/inventoryRealtimeSyncService';

interface TeamLeaderPOSProps {
  onSaleComplete?: () => void;
}

export default function TeamLeaderPOS({ onSaleComplete }: TeamLeaderPOSProps) {
  try {
    const { products, imeis, setImeis, sales, setSales, currentUser, commissions, setCommissions, addNotification, users, stockAllocations } = useApp();
    const { toast } = useToast();
  
  const [selectedProduct, setSelectedProduct] = useState('');
  const [imeiSearch, setImeiSearch] = useState('');
  const [selectedImei, setSelectedImei] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [selectedSource, setSelectedSource] = useState<PhoneSource>('watu');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [lockedImeiIds, setLockedImeiIds] = useState<Set<string>>(new Set());
  
  // Client details
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientIdNumber, setClientIdNumber] = useState('');

  // Initialize real-time sync with shared inventory pool (non-blocking)
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'team_leader') {
      return;
    }

    try {
      // Initialize async without blocking component render
      setTimeout(() => {
        inventoryRealtimeSyncService.initializeSync(currentUser.id).catch(() => {
          // Silently fail if sync doesn't work
        });
      }, 100);

      // Setup listeners
      const handleInventoryUpdate = () => loadSharedInventory();
      const handleItemSold = (event: any) => {
        if (event?.data?.imeiId) {
          setImeis(prev => prev.filter(i => i.id !== event.data.imeiId));
        }
      };

      inventoryRealtimeSyncService.on('INVENTORY_UPDATED', handleInventoryUpdate);
      inventoryRealtimeSyncService.on('ITEM_SOLD', handleItemSold);

      return () => {
        inventoryRealtimeSyncService.off('INVENTORY_UPDATED', handleInventoryUpdate);
        inventoryRealtimeSyncService.off('ITEM_SOLD', handleItemSold);
        try {
          inventoryRealtimeSyncService.stopSync();
        } catch (e) {
          // Ignore errors on cleanup
        }
      };
    } catch (error) {
      console.warn('Sync setup failed:', error);
    }
  }, [currentUser?.id, currentUser?.role]);

  // Load shared inventory from all sources (not just team allocation)
  const loadSharedInventory = async () => {
    if (!currentUser || currentUser.role !== 'team_leader') {
      return;
    }

    setIsSyncing(true);
    try {
      // Load all available inventory (from shared pool)
      const response = await inventoryService.getAll({
        status: 'ALLOCATED',
      });

      // Handle multiple response formats
      let sharedInventory: any[] = [];
      if (Array.isArray(response)) {
        sharedInventory = response;
      } else if ((response as any)?.data && Array.isArray((response as any).data)) {
        sharedInventory = (response as any).data;
      } else if ((response as any)?.imeis && Array.isArray((response as any).imeis)) {
        sharedInventory = (response as any).imeis;
      }

      if (sharedInventory.length > 0) {
        // Map to internal format
        const newImeis = sharedInventory.map((imei: any) => {
          const productId = typeof imei.productId === 'object' 
            ? imei.productId._id || imei.productId.id 
            : imei.productId;
          const productName = typeof imei.productId === 'object' 
            ? imei.productId.name 
            : 'Unknown';
          
          return {
            id: imei._id || imei.id,
            imei: imei.imei,
            productId: productId,
            productName: productName,
            capacity: imei.capacity || '',
            status: 'ALLOCATED' as const,
            sellingPrice: imei.sellingPrice || imei.price || 0,
            price: imei.sellingPrice || imei.price || 0,
            commission: imei.commissionConfig?.teamLeaderCommission || 0,
            commissionConfig: imei.commissionConfig,
            category: typeof imei.productId === 'object' ? imei.productId.category : '',
            source: imei.source || 'watu' as PhoneSource,
            registeredAt: imei.registeredAt ? new Date(imei.registeredAt) : new Date(),
            currentOwnerId: imei.currentHolderId?._id || imei.currentHolderId?.id,
            currentOwnerName: typeof imei.currentHolderId === 'object' ? imei.currentHolderId.name : 'Unknown',
            currentOwnerRole: imei.currentHolderId?.role || 'field_officer',
          };
        });

        setImeis(newImeis);
        setLastSyncTime(new Date());
      } else {
        // No inventory - set empty
        setImeis([]);
      }
    } catch (error: any) {
      console.warn('Could not load inventory from API, using local data:', error?.message);
      // Don't show toast on initial load, just log
    } finally {
      setIsSyncing(false);
    }
  };

  // Initial load of shared inventory
  useEffect(() => {
    const init = async () => {
      await loadSharedInventory();
    };
    if (currentUser?.role === 'team_leader') {
      init();
    }
  }, [currentUser?.id]);

  // Generate proper TL Code format
  const getTLCode = () => {
    if (currentUser?.foCode && currentUser.foCode.startsWith('TL-')) {
      return currentUser.foCode;
    }
    if (currentUser?.id) {
      const tlIndex = users?.findIndex(u => u.id === currentUser.id) || 0;
      const codeNum = String(Math.max(tlIndex + 1, 1)).padStart(3, '0');
      return `TL-${codeNum}`;
    }
    return 'TL-001';
  };

  const tlCode = getTLCode();
  
  // Get regional manager info
  const regionalManager = users?.find(u => u.id === currentUser?.regionalManagerId);
  
  const product = products.find(p => p.id === selectedProduct);
  const isPhone = product?.category === 'Smartphones' || product?.category === 'Feature Phones';
  
  // Team leader can sell from shared inventory pool (all available phones)
  const availableImeis = imeis.filter(i => {
    const isAllocated = i.status === 'ALLOCATED';
    const isMatchingProduct = i.productId === selectedProduct;
    const matchesSearch = imeiSearch ? i.imei.includes(imeiSearch) || i.productName.toLowerCase().includes(imeiSearch.toLowerCase()) : true;
    const isNotLocked = !lockedImeiIds.has(i.id);
    
    return isAllocated && isMatchingProduct && matchesSearch && isNotLocked;
  });

  const selectedImeiData = imeis.find(i => i.imei === selectedImei);
  const saleAmount = selectedImeiData?.sellingPrice || (product?.price || 0) * quantity;
  const commission = selectedImeiData?.commission || 0;

  const canCompleteSale = () => {
    if (!selectedProduct || !product) return false;
    if (isPhone && !selectedImei) return false;
    return true;
  };

  const completeSale = async () => {
    if (!canCompleteSale() || !product) {
      toast({ title: 'Error', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    const imeiId = imeis.find(i => i.imei === selectedImei)?.id;

    try {
      // Lock the IMEI to prevent others from selling it
      if (selectedImei && imeiId) {
        const lockResult = await inventoryRealtimeSyncService.lockInventoryItem(
          imeiId,
          selectedImei,
          currentUser?.id || '',
          'SALE_IN_PROGRESS'
        );

        if (!lockResult.success) {
          throw new Error(lockResult.error || 'Failed to lock inventory item. Another user may be selling this item.');
        }

        setLockedImeiIds(prev => new Set([...prev, imeiId]));
      }

      const receiptNo = generateReceiptNumber(sales.length);
      const etrReceiptNo = receiptNo;
      const vatAmount = 0;

      const newSale: Sale = {
        id: `sale-${Date.now()}`,
        productId: selectedProduct,
        productName: product.name,
        imei: selectedImei || undefined,
        quantity: isPhone ? 1 : quantity,
        saleAmount,
        paymentMethod,
        paymentReference: paymentReference || undefined,
        etrReceiptNo,
        etrSerial: 'KRA-5678',
        vatAmount,
        foCode: tlCode,
        foName: currentUser?.name,
        foId: currentUser?.id,
        teamLeaderId: currentUser?.id,
        regionalManagerId: currentUser?.regionalManagerId,
        sellerName: currentUser?.name,
        sellerEmail: currentUser?.email,
        source: isPhone ? selectedSource : undefined,
        clientName: clientName || undefined,
        clientPhone: clientPhone || undefined,
        clientIdNumber: clientIdNumber || undefined,
        createdBy: currentUser?.id || '',
        createdAt: new Date(),
      };

      const apiPaymentMethod = paymentMethod === 'cash' ? 'Cash' : 'M-Pesa';

      const saleResponse = await salesService.create({
        ...newSale,
        paymentMethod: apiPaymentMethod as any,
      });
      
      if (!saleResponse.success || !saleResponse.data) {
        throw new Error(saleResponse.message || 'Failed to create sale');
      }

      const createdSale = saleResponse.data;
      setSales([...sales, createdSale]);

      // Update IMEI status if phone was sold
      if (selectedImei && imeiId) {
        try {
          // Try to report the item as sold (non-blocking)
          try {
            const reportResult = await inventoryRealtimeSyncService.reportItemSold(
              imeiId,
              selectedImei,
              createdSale.id,
              currentUser?.id || ''
            );
            if (!reportResult.success) {
              console.warn('Sync report failed:', reportResult.error);
            }
          } catch (syncErr) {
            console.warn('Sync service error (non-blocking):', syncErr);
          }

          // Update IMEI status
          await imeiService.update(imeiId, {
            status: 'SOLD',
          });
          
          // Update local IMEI list
          setImeis(imeis.filter(i => i.id !== imeiId));
          
          // Remove from locked set
          setLockedImeiIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(imeiId);
            return newSet;
          });
        } catch (imeiError) {
          console.warn('IMEI update error:', imeiError);
        }
      }

      // Create commission record if applicable
      if (commission > 0) {
        setCommissions(prev => [...prev, {
          id: `comm-${Date.now()}`,
          saleId: createdSale.id,
          userId: currentUser?.id || '',
          userName: currentUser?.name || '',
          role: 'team_leader' as const,
          productId: product.id,
          productName: product.name,
          imei: selectedImei || undefined,
          amount: commission,
          status: 'pending',
          createdAt: new Date(),
          foId: currentUser?.id || '',
          foName: currentUser?.name || '',
        }]);
      }

      addNotification({
        title: 'Sale Completed',
        message: `${currentUser?.name} sold ${product.name}${selectedImei ? ` (IMEI: ${selectedImei.slice(-6)})` : ''}`,
        type: 'sale',
      });

      toast({
        title: 'Sale Completed!',
        description: `Receipt ${etrReceiptNo} generated and saved to system.`,
      });

      // Reset form
      setSelectedProduct('');
      setImeiSearch('');
      setSelectedImei(null);
      setQuantity(1);
      setPaymentReference('');
      setClientName('');
      setClientPhone('');
      setClientIdNumber('');
      onSaleComplete?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete sale';
      console.error('Sale error:', error);
      
      // Unlock the IMEI if sale failed
      if (selectedImei && imeiId) {
        try {
          await inventoryRealtimeSyncService.unlockInventoryItem(imeiId);
          setLockedImeiIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(imeiId);
            return newSet;
          });
        } catch (unlockError) {
          console.error('Failed to unlock IMEI:', unlockError);
        }
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const phoneProducts = products.filter(p => p.category === 'Smartphones' || p.category === 'Feature Phones');
  const accessoryProducts = products.filter(p => p.category === 'Accessories');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Team Leader POS</h1>
            <div className="text-sm text-muted-foreground space-y-1 mt-1">
              <p>TL Code: <span className="font-mono text-primary font-medium">{tlCode}</span> • Team Leader: <span className="font-medium text-foreground">{currentUser?.name}</span></p>
              {regionalManager && (
                <p>Regional Manager: <span className="font-medium text-foreground">{regionalManager.name}</span> {currentUser?.region && <span className="text-muted-foreground">({currentUser.region})</span>}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Zap className={`h-4 w-4 ${isSyncing ? 'text-warning animate-pulse' : 'text-success'}`} />
              <span>{isSyncing ? 'Syncing...' : 'Synced'}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadSharedInventory}
              disabled={isSyncing}
              className="text-xs"
            >
              {isSyncing ? 'Syncing...' : 'Manual Sync'}
            </Button>
            <p className="text-xs text-muted-foreground mt-1">
              Last sync: {lastSyncTime.toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Product Selection */}
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Select Product
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Phones</Label>
                <div className="space-y-2">
                  {phoneProducts.map((prod) => {
                    const availableCount = imeis.filter(i => 
                      i.productId === prod.id && 
                      i.status === 'ALLOCATED' &&
                      !lockedImeiIds.has(i.id)
                    ).length;
                    
                    return (
                      <button
                        key={prod.id}
                        onClick={() => { setSelectedProduct(prod.id); setSelectedImei(null); setImeiSearch(''); }}
                        disabled={availableCount === 0}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                          selectedProduct === prod.id
                            ? 'border-primary bg-primary/5'
                            : availableCount === 0
                              ? 'border-border bg-muted/50 opacity-50 cursor-not-allowed'
                              : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Smartphone className="h-5 w-5 text-muted-foreground" />
                          <div className="text-left">
                            <p className="font-medium text-foreground">{prod.name}</p>
                            <p className="text-sm text-muted-foreground">Ksh {prod.price.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">From shared pool</p>
                          </div>
                        </div>
                        <span className={`text-sm font-medium ${availableCount > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                          {availableCount} in pool
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Accessories</Label>
                <div className="space-y-2">
                  {accessoryProducts.map((prod) => (
                    <button
                      key={prod.id}
                      onClick={() => { setSelectedProduct(prod.id); setSelectedImei(null); }}
                      disabled={prod.stockQuantity === 0}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                        selectedProduct === prod.id
                          ? 'border-primary bg-primary/5'
                          : prod.stockQuantity === 0
                            ? 'border-border bg-muted/50 opacity-50 cursor-not-allowed'
                            : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="text-left">
                        <p className="font-medium text-foreground">{prod.name}</p>
                        <p className="text-sm text-muted-foreground">Ksh {prod.price.toLocaleString()}</p>
                      </div>
                      <span className={`text-sm font-medium ${prod.stockQuantity > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                        {prod.stockQuantity} in stock
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* IMEI Selection for Phones */}
        {isPhone && (
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" />
                Select IMEI
                <span className="text-sm font-normal text-destructive">* Required</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by IMEI number..."
                  value={imeiSearch}
                  onChange={(e) => setImeiSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              {availableImeis.length > 0 ? (
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {availableImeis.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedImei(item.imei)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                        selectedImei === item.imei
                          ? 'border-success bg-success/5'
                          : 'border-border hover:border-success/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {selectedImei === item.imei ? (
                          <CheckCircle className="h-5 w-5 text-success" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
                        )}
                        <div className="text-left">
                          <span className="font-mono text-foreground">{item.imei}</span>
                          <p className="text-xs text-muted-foreground">{item.capacity}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-success font-medium">Ksh {item.sellingPrice.toLocaleString()}</span>
                        <p className="text-xs text-muted-foreground">Comm: Ksh {item.commission.toLocaleString()}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Smartphone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No IMEIs available{imeiSearch ? ' matching your search' : ''}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quantity for accessories */}
        {!isPhone && selectedProduct && (
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Quantity</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                type="number"
                min={1}
                max={product?.stockQuantity || 100}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              />
            </CardContent>
          </Card>
        )}

        {/* Payment Method */}
        {selectedProduct && (isPhone ? selectedImei : true) && (
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Payment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isPhone && (
                <div>
                  <Label className="mb-2 block flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Selling From Company *
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['watu', 'mogo', 'onfon'] as PhoneSource[]).map((source) => (
                      <Button
                        key={source}
                        type="button"
                        variant={selectedSource === source ? 'default' : 'outline'}
                        className={`capitalize ${
                          selectedSource === source 
                            ? source === 'watu' ? 'bg-watu hover:bg-watu/90 text-white' 
                            : source === 'mogo' ? 'bg-mogo hover:bg-mogo/90 text-white'
                            : 'bg-onfon hover:bg-onfon/90 text-white'
                            : ''
                        }`}
                        onClick={() => setSelectedSource(source)}
                      >
                        {source}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label className="mb-2 block">Payment Method</Label>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Cash Only</span>
                </div>
              </div>

              <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-border">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Client Details
                </Label>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Client Name</Label>
                    <Input
                      placeholder="e.g. Susan Andego"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Phone Number</Label>
                    <Input
                      placeholder="e.g. 0712345678"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">ID Number</Label>
                    <Input
                      placeholder="e.g. 12345678"
                      value={clientIdNumber}
                      onChange={(e) => setClientIdNumber(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Summary */}
        <Card className="border shadow-sm bg-muted/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Order Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedProduct && product ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Product</span>
                    <span className="font-medium">{product.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Available in Shared Pool</span>
                    <span className="text-success font-medium">
                      {imeis.filter(i => i.productId === selectedProduct && i.status === 'ALLOCATED' && !lockedImeiIds.has(i.id)).length}
                    </span>
                  </div>
                  {selectedImei && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IMEI</span>
                      <span className="font-mono text-sm">{selectedImei}</span>
                    </div>
                  )}
                  {!isPhone && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Quantity</span>
                      <span>{quantity}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment</span>
                    <span className="uppercase">{paymentMethod}</span>
                  </div>
                  {commission > 0 && (
                    <div className="flex justify-between text-success">
                      <span>Your Commission</span>
                      <span className="font-medium">Ksh {commission.toLocaleString()}</span>
                    </div>
                  )}
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary">Ksh {saleAmount.toLocaleString()}</span>
                  </div>
                </div>
                <Button 
                  className="w-full h-12 text-base" 
                  onClick={completeSale}
                  disabled={!canCompleteSale() || isSubmitting}
                  type="button"
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  {isSubmitting ? 'Processing...' : 'Complete Sale'}
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select a product to start</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    );
  } catch (error) {
    console.error('TeamLeaderPOS component error:', error);
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="border-destructive bg-destructive/5">
          <CardHeader>
            <CardTitle>Error Loading Team Leader POS</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive mb-4">An error occurred while loading the POS interface.</p>
            <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : 'Unknown error'}</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Reload Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
}
