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
import { PhoneSource, PaymentMethod, IMEI, IMEIStatus } from '@/types';
import { ShoppingCart, Receipt, Search, CheckCircle, Smartphone, User, Building2 } from 'lucide-react';
import { salesService } from '@/services/salesService';
import { imeiService } from '@/services/imeiService';
import { inventoryService } from '@/services/inventoryService';
import { productService } from '@/services/productService';
import { commissionService } from '@/services/commissionService';

interface FOPortalProps {
  onSaleComplete?: () => void;
}

export default function FOPortal({ onSaleComplete }: FOPortalProps) {
  const { products, setProducts, imeis, setImeis, sales, setSales, currentUser, commissions, setCommissions, addNotification, users, stockAllocations } = useApp();
  const { toast } = useToast();
  
  const [selectedProduct, setSelectedProduct] = useState('');
  const [imeiSearch, setImeiSearch] = useState('');
  const [selectedImei, setSelectedImei] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [selectedSource, setSelectedSource] = useState<PhoneSource>('watu');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Client details
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientIdNumber, setClientIdNumber] = useState('');
  
  // API allocated IMEIs for current FO
  const [apiAllocatedImeis, setApiAllocatedImeis] = useState<any[]>([]);

  // Load allocated IMEIs from API on mount
  useEffect(() => {
    const loadAllocatedImeis = async () => {
      if (!currentUser || currentUser.role !== 'field_officer') {
        console.log('Skipping IMEI load - no FO user:', currentUser?.role);
        return;
      }

      try {
        console.log('Loading allocated IMEIs for FO:', currentUser.id, currentUser.name);

        // First, fetch latest products from server to replace mock data
        try {
          const productsRes = await productService.getAll();
          const fetchedProducts = Array.isArray(productsRes) ? productsRes : (productsRes as any)?.data || (productsRes as any)?.products || [];
          if (fetchedProducts && fetchedProducts.length > 0) {
            console.log('Fetched products from API:', fetchedProducts.length);
            setProducts(fetchedProducts);
          }
        } catch (prodErr) {
          console.warn('Could not fetch products from API, continuing with existing products:', prodErr?.message || prodErr);
        }

        // Try loading with currentHolderId filter first
        let response = await inventoryService.getAll({
          currentHolderId: currentUser.id,
          status: 'ALLOCATED',
        });

        // If that returns empty, try without currentHolderId filter (fallback for API that doesn't support it)
        let allocatedImeis: any[] = [];
        if (Array.isArray(response)) {
          allocatedImeis = response;
        } else if ((response as any)?.data) {
          if (Array.isArray((response as any).data)) {
            allocatedImeis = (response as any).data;
          } else if ((response as any).data?.imeis && Array.isArray((response as any).data.imeis)) {
            allocatedImeis = (response as any).data.imeis;
          }
        }

        // Fallback: if we got no results, try loading all ALLOCATED items and filter client-side
        if (allocatedImeis.length === 0) {
          console.log('No allocated IMEIs found with currentHolderId filter, trying fallback without filter...');
          response = await inventoryService.getAll({
            status: 'ALLOCATED',
          });
          
          if (Array.isArray(response)) {
            allocatedImeis = response;
          } else if ((response as any)?.data) {
            if (Array.isArray((response as any).data)) {
              allocatedImeis = (response as any).data;
            } else if ((response as any).data?.imeis && Array.isArray((response as any).data.imeis)) {
              allocatedImeis = (response as any).data.imeis;
            }
          }
        }

        console.log('Raw inventory response:', response);

        if (allocatedImeis.length > 0) {
          console.log('First IMEI details:', allocatedImeis[0]);
          
          // Map to internal format with normalized productId (match product.id when possible)
          const newImeis: IMEI[] = allocatedImeis.map((imei: any) => {
            // Extract raw product identifier from API response
            const rawProductId = typeof imei.productId === 'object' 
              ? imei.productId._id || imei.productId.id || imei.productId
              : imei.productId;

            // Try to find a matching product in the (recently fetched) products list
            const matchingProduct = (products || []).find(p => p.id === rawProductId || (p as any)._id === rawProductId || p.id === (imei.productId?._id || imei.productId?.id));

            const productId = matchingProduct ? matchingProduct.id : String(rawProductId);
            const productName = matchingProduct ? matchingProduct.name : (imei.productId?.name || 'Unknown');

            const mappedImei: IMEI = {
              id: imei._id || imei.id,
              imei: imei.imei,
              productId: productId,
              productName: productName,
              capacity: imei.capacity || '',
              status: 'ALLOCATED' as IMEIStatus,
              sellingPrice: imei.sellingPrice || imei.price || 0,
              commission: imei.commissionConfig?.foCommission || 0,
              commissionConfig: imei.commissionConfig,
              source: imei.source || 'watu' as PhoneSource,
              registeredAt: imei.registeredAt ? new Date(imei.registeredAt) : new Date(),
              currentOwnerId: imei.currentHolderId?._id || imei.currentHolderId?.id || (typeof imei.currentHolderId === 'string' ? imei.currentHolderId : currentUser?.id),
              currentOwnerRole: imei.currentHolderId?.role || 'field_officer',
            };
            return mappedImei;
          });

          console.log('Mapped IMEIs:', newImeis);

          // Update the global IMEIs list
          setImeis(prev => {
            const existingImeiNumbers = new Set(prev.map(i => i.imei));
            const newImeiItems = newImeis.filter((item: any) => !existingImeiNumbers.has(item.imei));
            console.log('Adding', newImeiItems.length, 'new IMEIs to context');
            console.log('All IMEIs after merge:', [...prev, ...newImeiItems].map(i => ({ imei: i.imei, productId: i.productId, status: i.status })));
            return [...prev, ...newImeiItems];
          });
        } else {
          console.log('No allocated IMEIs loaded from API. Will fall back to stock allocations from context.');
        }
        
        setApiAllocatedImeis(allocatedImeis);
      } catch (error: any) {
        console.error('Error loading allocated IMEIs:', error);
        console.error('Error details:', error?.message, error?.response);
      }
    };

    loadAllocatedImeis();
  }, [currentUser?.id, currentUser?.role]);

  // Load FO sales history, IMEIs, and commissions on mount (persistent fetch so data survives refresh)
  useEffect(() => {
    if (!currentUser?.id) return;

    const loadFOSales = async () => {
      try {
        const res = await salesService.getAll({ foId: currentUser.id });
        const fetchedSales = Array.isArray(res) ? res : (res as any)?.data || (res as any)?.sales || [];
        if (fetchedSales && fetchedSales.length >= 0) {
          setSales(fetchedSales);
        }
      } catch (err) {
        console.error('Error loading FO sales:', err);
      }
    };

    const loadFOImeis = async () => {
      try {
        const res = await imeiService.getAll({ currentHolderId: currentUser.id });
        const fetchedImeis = Array.isArray(res) ? res : (res as any)?.data || (res as any)?.imeis || [];
        if (Array.isArray(fetchedImeis)) {
          // Merge into context imeis without duplicating
          setImeis(prev => {
            const existing = Array.isArray(prev) ? prev : [];
            const existingSet = new Set(existing.map(i => i.imei));
            const newItems = fetchedImeis.filter((it: any) => it?.imei && !existingSet.has(it.imei));
            return [...existing, ...newItems];
          });
        }
      } catch (err) {
        console.error('Error loading FO IMEIs:', err);
      }
    };

    const loadFOCommissions = async () => {
      try {
        const res = await commissionService.getAll({ userId: currentUser.id });
        let fetchedCommissions: any[] = [];
        if (Array.isArray(res)) {
          fetchedCommissions = res;
        } else if ((res as any)?.data) {
          if (Array.isArray((res as any).data)) {
            fetchedCommissions = (res as any).data;
          } else if ((res.data as any).data && Array.isArray((res.data as any).data)) {
            fetchedCommissions = (res.data as any).data;
          } else if ((res as any).data.commissions && Array.isArray((res as any).data.commissions)) {
            fetchedCommissions = (res as any).data.commissions;
          }
        }
        if (fetchedCommissions && fetchedCommissions.length >= 0) {
          setCommissions(fetchedCommissions);
        }
      } catch (err) {
        console.error('Error loading FO commissions:', err);
      }
    };

    // Load all data in parallel without awaiting to prevent blocking render
    loadFOSales();
    loadFOImeis();
    loadFOCommissions();
  }, [currentUser?.id]);

  // Generate proper FO Code format
  const getFOCode = () => {
    // Prefer explicit FO code fields from the database if present
    const dbCode = (currentUser as any)?.foCode || (currentUser as any)?.fo_code || (currentUser as any)?.FOCode || (currentUser as any)?.focode;
    if (dbCode) {
      const codeStr = String(dbCode).trim();
      // If already formatted like FO-001, return as-is
      if (/^FO-\d{3}$/i.test(codeStr)) return codeStr.toUpperCase();
      // If numeric or short (e.g., "001" or "1"), format to FO-###
      const digits = (codeStr.match(/\d+/) || [codeStr])[0];
      if (digits) {
        const padded = String(Number(digits)).padStart(3, '0');
        return `FO-${padded}`;
      }
      // Otherwise return raw DB value
      return codeStr;
    }

    // Fallback: derive from users list index if DB value not present
    if (currentUser?.id) {
      const foIndex = users?.findIndex(u => (u as any).id === currentUser.id || (u as any)._id === currentUser.id) || 0;
      const codeNum = String(Math.max(foIndex + 1, 1)).padStart(3, '0');
      return `FO-${codeNum}`;
    }

    return 'FO-001';
  };

  const foCode = getFOCode();
  
  // Get team leader and regional manager info
  const teamLeader = users?.find(u => u.id === currentUser?.teamLeaderId);
  const regionalManager = users?.find(u => u.id === currentUser?.regionalManagerId);
  
  const product = products.find(p => p.id === selectedProduct);
  const isPhone = product?.category === 'Smartphones' || product?.category === 'Feature Phones';
  
  // Get all IMEIs available for this FO (from context + API allocated)
  const allocatedImeis = [
    // From context stockAllocations
    ...stockAllocations
      .filter(alloc => {
        const toUserId = typeof alloc.toUserId === 'object' ? alloc.toUserId.id : alloc.toUserId;
        return toUserId === currentUser?.id && alloc.status !== 'reversed' && alloc.imei;
      })
      .map(alloc => alloc.imei)
      .filter(imei => imei && imei.trim()),
    // From API allocated IMEIs
    ...apiAllocatedImeis.map(imei => imei.imei).filter(imei => imei),
  ];
  
  // Remove duplicates
  const uniqueAllocatedImeis = [...new Set(allocatedImeis)];
  
  // Helper: determine display price for an IMEI (prefer IMEI sellingPrice, fallback to IMEI.price, then product price)
  const getPriceForImei = (item: any) => {
    const prod = products.find(p => p.id === item.productId);
    return item.sellingPrice ?? item.price ?? prod?.price ?? 0;
  };
  
  console.log('FOPortal Debug - Allocated IMEIs sources:');
  console.log('  From context stockAllocations:', stockAllocations.filter(a => {
    const toUserId = typeof a.toUserId === 'object' ? a.toUserId.id : a.toUserId;
    return toUserId === currentUser?.id && a.status !== 'reversed' && a.imei;
  }).map(a => a.imei));
  console.log('  From API apiAllocatedImeis:', apiAllocatedImeis.map(i => i.imei));
  console.log('  Total unique allocated IMEIs:', uniqueAllocatedImeis);
  console.log('  Selected product:', selectedProduct);
  
  // Combine context IMEIs with API-allocated IMEIs (map API shape to our IMEI shape) so API-only items show up with prices
  const apiMappedImeis: IMEI[] = apiAllocatedImeis.map((imei: any) => {
    const rawProductId = typeof imei.productId === 'object' ? imei.productId._id || imei.productId.id || imei.productId : imei.productId;
    const matchingProduct = (products || []).find(p => p.id === rawProductId || (p as any)._id === rawProductId);
    const productId = matchingProduct ? matchingProduct.id : String(rawProductId);
    const productName = matchingProduct ? matchingProduct.name : (imei.productId?.name || 'Unknown');
    return {
      id: imei._id || imei.id,
      imei: imei.imei,
      productId,
      productName,
      capacity: imei.capacity || '',
      status: 'ALLOCATED' as IMEIStatus,
      sellingPrice: imei.sellingPrice || imei.price || 0,
      commission: imei.commissionConfig?.foCommission || 0,
      commissionConfig: imei.commissionConfig,
      source: imei.source || 'watu' as PhoneSource,
      registeredAt: imei.registeredAt ? new Date(imei.registeredAt) : new Date(),
      currentOwnerId: imei.currentHolderId?._id || imei.currentHolderId?.id || (typeof imei.currentHolderId === 'string' ? imei.currentHolderId : currentUser?.id),
      currentOwnerRole: imei.currentHolderId?.role || 'field_officer',
    };
  });
  
  const combinedImeisMap = new Map<string, IMEI>();
  imeis.forEach(i => combinedImeisMap.set(i.imei, i));
  apiMappedImeis.forEach(i => {
    if (!combinedImeisMap.has(i.imei)) combinedImeisMap.set(i.imei, i);
  });
  const combinedImeis = Array.from(combinedImeisMap.values());
  
  // For phones, get available IMEIs with search filter - ONLY allocated to this FO
  const availableImeis = combinedImeis.filter(i => {
    const isAllocatedToFO = uniqueAllocatedImeis.includes(i.imei);
    const isMatchingProduct = i.productId === selectedProduct;
    const isNotSold = i.status !== 'SOLD';
    const matchesSearch = imeiSearch ? i.imei.includes(imeiSearch) || (i.productName && i.productName.toLowerCase().includes(imeiSearch.toLowerCase())) : true;
    
    if (isAllocatedToFO && isNotSold) {
      console.log(`Available IMEI check - ${i.imei}: allocated=${isAllocatedToFO}, matchProduct=${isMatchingProduct}, notSold=${isNotSold}, matchSearch=${matchesSearch}`);
    }
    
    return isMatchingProduct && isAllocatedToFO && isNotSold && matchesSearch;
  });
  
  console.log('Available IMEIs to display:', availableImeis.map(i => ({ imei: i.imei, product: i.productName, status: i.status, price: i.sellingPrice })));

  const selectedImeiData = imeis.find(i => i.imei === selectedImei);
  
  // Fallback: if IMEI data not in context, try to get from API data
  const selectedImeiFromApi = !selectedImeiData && selectedImei 
    ? apiAllocatedImeis.find(i => i.imei === selectedImei)
    : null;

  // Calculate sale amount with proper fallbacks
  let saleAmount = 0;
  if (selectedImeiData?.sellingPrice && selectedImeiData.sellingPrice > 0) {
    saleAmount = selectedImeiData.sellingPrice;
  } else if (selectedImeiFromApi?.sellingPrice && selectedImeiFromApi.sellingPrice > 0) {
    saleAmount = selectedImeiFromApi.sellingPrice;
  } else if (selectedImeiFromApi?.price && selectedImeiFromApi.price > 0) {
    saleAmount = selectedImeiFromApi.price;
  } else if (product?.price && product.price > 0) {
    saleAmount = product.price * Math.max(quantity, 1);
  } else {
    saleAmount = 0;
  }
  
  const commission = selectedImeiData?.commission || selectedImeiFromApi?.commissionConfig?.foCommission || 0;

  // Calculate available stock for the selected product
  const getAvailableStockForProduct = () => {
    if (!selectedProduct) return 0;

    // Get all IMEIs for this product that are allocated to this FO and not sold
    const allAllocatedForProduct = combinedImeis.filter(i => {
      const productMatch = i.productId === selectedProduct;
      const isAllocated = uniqueAllocatedImeis.includes(i.imei);
      const isNotSold = i.status !== 'SOLD';

      const match = productMatch && isAllocated && isNotSold;
      if (!match && productMatch && uniqueAllocatedImeis.length > 0) {
        console.log('IMEI filtering - ID:', i.imei, 'ProductMatch:', productMatch, 'IsAllocated:', isAllocated, 'IsNotSold:', isNotSold, 'Status:', i.status);
      }
      return match;
    });

    console.log('Available stock for product', selectedProduct, ':', allAllocatedForProduct.length);
    return allAllocatedForProduct.length;
  };

  const availableStockForProduct = getAvailableStockForProduct();

  const canCompleteSale = () => {
    if (!selectedProduct || !product) return false;
    if (isPhone && !selectedImei) return false;
    
    // Check if IMEI is allocated to this FO (for phones)
    if (isPhone && selectedImei) {
      const isAllocatedToFO = uniqueAllocatedImeis.includes(selectedImei);
      if (!isAllocatedToFO) {
        return false;
      }
    }
    
    // Check if FO has available stock to sell
    if (availableStockForProduct <= 0) {
      return false;
    }
    
    // For non-phones, check if quantity doesn't exceed available stock
    if (!isPhone && quantity > availableStockForProduct) {
      return false;
    }
    
    // Remove redundant check for SOLD status
    const isNotSold = selectedImeiData?.status !== 'SOLD' && selectedImeiFromApi?.status !== 'SOLD';
    
    return true;
  };

  // --- FO Dashboard metrics ---
  const foSales = (sales || []).filter(s => {
    const saleAny = s as any;
    const foId = saleAny.foId || saleAny.fo?.id || saleAny.fo;
    return foId === currentUser?.id;
  });

  const getSaleAmount = (s: any) => (s as any).totalAmount ?? (s as any).amount ?? (s as any).saleAmount ?? 0;

  const totalSalesCount = foSales.length;
  const totalSalesValue = foSales.reduce((sum, s) => sum + (getSaleAmount(s) || 0), 0);

  const isSameDay = (dateA: Date, dateB: Date) => {
    return dateA.getFullYear() === dateB.getFullYear() && dateA.getMonth() === dateB.getMonth() && dateA.getDate() === dateB.getDate();
  };

  const today = new Date();
  const todaysSales = foSales.filter(s => {
    const saleAny = s as any;
    const d = saleAny.createdAt ? new Date(saleAny.createdAt) : saleAny.date ? new Date(saleAny.date) : null;
    return d ? isSameDay(d, today) : false;
  });
  const todaysSalesCount = todaysSales.length;
  const todaysSalesValue = todaysSales.reduce((sum, s) => sum + (getSaleAmount(s) || 0), 0);

  // Pending commissions: sum of sale commission fields or fallback to commissionCalc
  const pendingCommissions = foSales.reduce((sum, s) => {
    const saleAny = s as any;
    const c = saleAny.commissionAmount ?? saleAny.commission ?? saleAny.foCommission ?? 0;
    const paid = saleAny.commissionPaid === true || saleAny.commissionStatus === 'paid';
    return sum + (paid ? 0 : (c || 0));
  }, 0);

  // Available stock for FO (unique allocated IMEIs mapped to product counts)
  const availableImeisForFO = combinedImeis.filter(i => uniqueAllocatedImeis.includes(i.imei) && i.status !== 'SOLD');
  const availableStockCount = availableImeisForFO.length;

  // Top products sold by FO
  const productSalesCount: Record<string, number> = {};
  foSales.forEach(s => {
    // Try to derive product id from sale: supports single-item sales or items array
    const saleAny = s as any;
    const prodId = saleAny.productId || (saleAny.items && saleAny.items[0] && (saleAny.items[0].productId || saleAny.items[0].product)) || null;
    const pid = typeof prodId === 'object' ? (prodId._id || prodId.id) : prodId;
    if (!pid) return;
    productSalesCount[pid] = (productSalesCount[pid] || 0) + 1;
  });

  const topProducts = Object.entries(productSalesCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([pid, count]) => ({ product: products.find(p => p.id === pid || (p as any)._id === pid) || { id: pid, name: 'Unknown' }, count }));

  const recentSales = foSales
    .slice()
    .sort((a: any, b: any) => {
      const aDate = new Date((a as any).createdAt || (a as any).date || 0);
      const bDate = new Date((b as any).createdAt || (b as any).date || 0);
      return bDate.getTime() - aDate.getTime();
    })
    .slice(0, 6);

  const completeSale = async () => {
    if (!canCompleteSale() || !product) {
      toast({ title: 'Error', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }

    // Validate FO is logged in
    if (!currentUser?.id) {
      toast({ title: 'Error', description: 'You must be logged in as a Field Officer to complete a sale', variant: 'destructive' });
      return;
    }

    // Validate IMEI for phones only
    if (isPhone) {
      if (!selectedImei) {
        toast({ title: 'Error', description: 'Please select a valid phone IMEI', variant: 'destructive' });
        return;
      }

      if (!selectedImeiData && !selectedImeiFromApi) {
        console.error('Selected IMEI not found in imeis:', {
          selectedImei,
          loadedImeis: imeis.map(i => ({ imei: i.imei, id: i.id })),
        });
        toast({ title: 'Error', description: 'Invalid IMEI selected. Please select another phone.', variant: 'destructive' });
        return;
      }
    }

    // For phones, get IMEI ID; for accessories, imeiId is optional
    const imeiId = isPhone ? (selectedImeiData?.id || selectedImeiFromApi?.id || selectedImei) : undefined;
    
    if (isPhone && !imeiId) {
      toast({ title: 'Error', description: 'Cannot determine IMEI ID. Please select another phone.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare sale data for API - matching POS implementation
      const paymentMethodMap: Record<string, string> = {
        'cash': 'cash',
        'mpesa': 'mpesa',
      };

      const saleData: any = {
        paymentMethod: paymentMethodMap[paymentMethod] || 'cash',
        paymentReference: paymentReference || undefined,
        customerName: clientName || 'Walk-in Customer',
        customerPhone: clientPhone || '',
        customerIdNumber: clientIdNumber || '',
        customerEmail: '',
        notes: clientIdNumber || '',
        // Add FO information
        foId: currentUser?.id,
        foName: currentUser?.name || 'Field Officer',
        foCode,
        source: selectedSource || 'watu',
      };

      // Add imeiId for phones, productId + quantity for accessories
      if (isPhone && imeiId) {
        saleData.imeiId = imeiId;
        console.log('Sending phone sale with imeiId:', imeiId);
      } else if (!isPhone) {
        saleData.productId = selectedProduct;
        saleData.quantity = quantity;
        console.log('Sending accessory sale with productId:', selectedProduct, 'quantity:', quantity);
      }

      console.log('Sale data being sent:', saleData);

      // Create sale via API - matching POS approach
      const createdSaleRes = await salesService.create(saleData);
      
      if (!createdSaleRes || (!createdSaleRes.data && !Array.isArray(createdSaleRes))) {
        console.error('Invalid sale response:', createdSaleRes);
        throw new Error('Invalid response from server. Sale may not have been recorded.');
      }

      // Extract the Sale object from response
      const createdSale = (createdSaleRes as any).data ? (createdSaleRes as any).data : createdSaleRes;
      if (!createdSale || typeof createdSale !== 'object') {
        throw new Error('Invalid sale data received from server');
      }

      // Update local sales list with the actual Sale object
      setSales(prev => [...(prev || []), createdSale]);

      // Refresh IMEIs data to reflect updated status (like POS does)
      if (isPhone && selectedImei) {
        try {
          const updatedImeisResponse = await imeiService.getAll();
          let updatedImeis = [];
          
          if (updatedImeisResponse && typeof updatedImeisResponse === 'object') {
            if ((updatedImeisResponse as any).imeis && Array.isArray((updatedImeisResponse as any).imeis)) {
              updatedImeis = (updatedImeisResponse as any).imeis;
            } else if (Array.isArray((updatedImeisResponse as any).data)) {
              updatedImeis = (updatedImeisResponse as any).data;
            } else if (Array.isArray(updatedImeisResponse)) {
              updatedImeis = updatedImeisResponse as any;
            }
          }
          
          // Ensure we set an array and merge safely into context
          if (Array.isArray(updatedImeis)) {
            setImeis(prev => {
              const existing = Array.isArray(prev) ? prev : [];
              const existingSet = new Set(existing.map((i: any) => i.imei));
              const newItems = updatedImeis.filter((it: any) => it?.imei && !existingSet.has(it.imei));
              return [...existing, ...newItems];
            });
          }
         } catch (refreshError) {
           console.error('Error refreshing IMEIs:', refreshError);
           // Don't fail the entire sale if refresh fails
         }
       }

      // Add notification
      addNotification({
        title: 'Sale Completed',
        message: `Sale of ${quantity > 1 ? quantity + ' x ' : ''}${product.name}${selectedImei ? ` (IMEI: ${selectedImei.slice(-6)})` : ''} has been recorded`,
        type: 'sale',
      });

      toast({
        title: 'Sale Completed!',
        description: `Receipt generated. Amount: Ksh ${saleAmount.toLocaleString()}`,
      });

      // Reset form
      setSelectedProduct('');
      setImeiSearch('');
      setSelectedImei(null);
      setQuantity(1);
      setPaymentReference('');
      setPaymentMethod('cash');
      setClientName('');
      setClientPhone('');
      setClientIdNumber('');
      onSaleComplete?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete sale';
      console.error('Sale error:', error);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Support both legacy mock categories and server categories
  const phoneProducts = products
    .filter(p => ['phone', 'Smartphones', 'Feature Phones', 'Tablets'].includes(p.category as string))
    // Only show products that have allocated IMEIs available to this FO
    .filter(p => combinedImeis.some(i => i.productId === p.id && uniqueAllocatedImeis.includes(i.imei) && i.status !== 'SOLD'));

  const accessoryProducts = products
    .filter(p => ['accessory', 'Accessories', 'SIM Cards', 'Airtime'].includes(p.category as string))
    // Only show products that have allocated IMEIs available to this FO
    .filter(p => combinedImeis.some(i => i.productId === p.id && uniqueAllocatedImeis.includes(i.imei) && i.status !== 'SOLD'));

  console.log('FOPortal Debug - phoneProducts count:', phoneProducts.length, 'accessoryProducts count:', accessoryProducts.length);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-foreground">Sales POS</h1>
        <div className="text-sm text-muted-foreground space-y-1 mt-1">
          <p>FO Code: <span className="font-mono text-primary font-medium">{foCode}</span> • Field Officer: <span className="font-medium text-foreground">{currentUser?.name}</span></p>
          {teamLeader && (
            <p>Team Leader: <span className="font-medium text-foreground">{teamLeader.name}</span></p>
          )}
          {regionalManager && (
            <p>Regional Manager: <span className="font-medium text-foreground">{regionalManager.name}</span> {currentUser?.region && <span className="text-muted-foreground">({currentUser.region})</span>}</p>
          )}
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
                    // Count ONLY allocated items for this FO and product
                    const availableCount = combinedImeis.filter(i => 
                      i.productId === prod.id && 
                      uniqueAllocatedImeis.includes(i.imei) && 
                      i.status !== 'SOLD'
                    ).length;
                    
                    // Debug logging
                    const inStockCount = combinedImeis.filter(i => i.productId === prod.id && i.status !== 'SOLD').length; // Define inStockCount
                    const allocatedCount = combinedImeis.filter(i => i.productId === prod.id && uniqueAllocatedImeis.includes(i.imei)).length; // Define allocatedCount
                    if (availableCount === 0 && apiAllocatedImeis.length > 0) {
                      console.log('Product:', prod.name, '(ID:', prod.id, ') - InStock:', inStockCount, 'Allocated:', allocatedCount);
                      console.log('Matching IMEIs:', imeis.filter(i => i.productId === prod.id).map(i => ({ imei: i.imei, status: i.status })));
                      console.log('UniqueAllocated:', uniqueAllocatedImeis);
                    }
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
                          </div>
                        </div>
                        <span className={`text-sm font-medium ${availableCount > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                          {availableCount} available
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Accessories</Label>
                <div className="space-y-2">
                  {accessoryProducts.map((prod) => {
                    const availableAllocatedCount = combinedImeis.filter(i => i.productId === prod.id && uniqueAllocatedImeis.includes(i.imei) && i.status !== 'SOLD').length;
                    return (
                    <button
                      key={prod.id}
                      onClick={() => { setSelectedProduct(prod.id); setSelectedImei(null); }}
                      disabled={availableAllocatedCount === 0}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                        selectedProduct === prod.id
                          ? 'border-primary bg-primary/5'
                          : availableAllocatedCount === 0
                            ? 'border-border bg-muted/50 opacity-50 cursor-not-allowed'
                            : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="text-left">
                        <p className="font-medium text-foreground">{prod.name}</p>
                        <p className="text-sm text-muted-foreground">Ksh {prod.price.toLocaleString()}</p>
                      </div>
                      <span className={`text-sm font-medium ${availableAllocatedCount > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                        {availableAllocatedCount} in stock
                      </span>
                    </button>
                    );
                  })}
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
                        <span className="text-success font-medium">Ksh {(getPriceForImei(item) || 0).toLocaleString()}</span>
                        <p className="text-xs text-muted-foreground">Comm: Ksh {(item.commission || 0).toLocaleString()}</p>
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
                max={availableStockForProduct}
                value={quantity}
                onChange={(e) => setQuantity(Math.min(parseInt(e.target.value) || 1, availableStockForProduct))}
                disabled={availableStockForProduct === 0}
              />
              {availableStockForProduct < (product?.stockQuantity || 100) && (
                <p className="text-xs text-amber-600 mt-2">
                  Maximum available: {availableStockForProduct}
                </p>
              )}
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
              {/* Company Source Selection (for phones) */}
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
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant={paymentMethod === 'mpesa' ? 'default' : 'outline'}
                    className={paymentMethod === 'mpesa' ? 'bg-success hover:bg-success/90' : ''}
                    onClick={() => setPaymentMethod('mpesa')}
                  >
                    M-PESA
                  </Button>
                  <Button
                    type="button"
                    variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                    onClick={() => setPaymentMethod('cash')}
                  >
                    Cash
                  </Button>
                </div>
              </div>

              {/* Payment Reference */}
              {paymentMethod === 'mpesa' && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">M-PESA Reference (Optional)</Label>
                  <Input
                    placeholder="e.g. SJ7K2M5P4N"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value.toUpperCase())}
                  />
                </div>
              )}

              {/* Client Details */}
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
                    <span className="text-muted-foreground">Available in My Stock</span>
                    <span className="text-success font-medium">
                      {availableStockForProduct}
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
                {availableStockForProduct === 0 && (
                  <div className="bg-red-50 border border-red-200 p-3 rounded text-sm text-red-700">
                    <p className="font-medium">No available stock to sell</p>
                    <p className="text-xs mt-1">You must have allocated stock to make a sale</p>
                  </div>
                )}
                {isPhone && selectedImei && !uniqueAllocatedImeis.includes(selectedImei) && (
                  <div className="bg-red-50 border border-red-200 p-3 rounded text-sm text-red-700">
                    <p className="font-medium">This IMEI is not allocated to you</p>
                    <p className="text-xs mt-1">You can only sell units that are allocated to your account</p>
                  </div>
                )}
                {!isPhone && quantity > availableStockForProduct && (
                  <div className="bg-red-50 border border-red-200 p-3 rounded text-sm text-red-700">
                    <p className="font-medium">Quantity exceeds available stock</p>
                    <p className="text-xs mt-1">Maximum available: {availableStockForProduct}</p>
                  </div>
                )}
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
}
