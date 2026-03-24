import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Package, Send, History, Users, Smartphone, Search, ArrowDownRight, ArrowUpRight, CheckCircle2, Layers, RotateCcw, AlertTriangle, User, Eye, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { IMEI, StockAllocation as StockAllocationType } from '@/types';
import { BulkAllocationDialog } from '@/components/stock/BulkAllocationDialog';
import { WorkflowTracker } from '@/components/stock/WorkflowTracker';
import { StockJourney } from '@/components/stock/StockJourney';
import * as stockAllocationService from '@/services/stockAllocationService';
import { userService } from '@/services/userService';
import { inventoryService } from '@/services/inventoryService';
import { imeiService } from '@/services/imeiService';

export default function StockAllocation() {
  const { currentUser, users, imeis, stockAllocations, setImeis, setStockAllocations, products } = useApp();
  
  // Load from API instead of context
  const [loadedImeis, setLoadedImeis] = useState<IMEI[]>([]);
  const [loadedAllocations, setLoadedAllocations] = useState<StockAllocationType[]>([]);
  const [loadedUsers, setLoadedUsers] = useState<typeof users>(users); // Initialize with context users as fallback
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('my-stock');
  const [allocateDialogOpen, setAllocateDialogOpen] = useState(false);
  const [bulkAllocateOpen, setBulkAllocateOpen] = useState(false);
  const [selectedImei, setSelectedImei] = useState<IMEI | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState('');
  
  // Recall state
  const [recallDialogOpen, setRecallDialogOpen] = useState(false);
  const [bulkRecallDialogOpen, setBulkRecallDialogOpen] = useState(false);
  const [selectedRecallImei, setSelectedRecallImei] = useState<{ imei: IMEI; userId: string } | null>(null);
  const [selectedRecallImeis, setSelectedRecallImeis] = useState<{ imei: IMEI; userId: string }[]>([]);
  const [recallReason, setRecallReason] = useState('');
  
  // Stock journey state
  const [journeyImei, setJourneyImei] = useState<IMEI | null>(null);
  const [journeyDialogOpen, setJourneyDialogOpen] = useState(false);

  // Load data from API on mount
  useEffect(() => {
    if (!currentUser) return;

    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Load allocations FIRST so we have them when transforming stock
        let allocations: StockAllocationType[] = [];
        const allocResponse = await stockAllocationService.getAllocations();
        if (allocResponse.success && allocResponse.data) {
          allocations = Array.isArray(allocResponse.data) ? allocResponse.data : (allocResponse.data as any)?.data || [];
          setLoadedAllocations(allocations);
          setStockAllocations(allocations);
        }
        
        let transformedStock: IMEI[] = [];

        // Load ALL IMEIs (both allocated and unallocated) to get complete stock view
        try {
          const imeiResponse = await imeiService.getAll();
          if (imeiResponse.success && imeiResponse.data) {
            const imeiData = Array.isArray(imeiResponse.data) 
              ? imeiResponse.data 
              : (imeiResponse.data as any)?.imeis || (imeiResponse.data as any)?.data || [];
            
            // Transform all IMEIs
            transformedStock = imeiData.map((item: any) => {
              const productId = typeof item.productId === 'object' ? item.productId._id : item.productId;
              const productName = typeof item.productId === 'object' ? item.productId.name : item.productName;
              
              // Look up product to get selling price if not in item
              const product = products.find(p => p.id === productId);
              const sellingPrice = item.sellingPrice || product?.price || 0;
              
              return {
                id: item._id || item.id,
                imei: item.imei,
                productId: productId,
                productName: productName,
                capacity: item.capacity,
                status: item.status || 'IN_STOCK',
                sellingPrice: sellingPrice,
                commission: item.commission || 0,
                source: item.source || 'watu',
                registeredAt: item.registeredAt,
                currentOwnerId: item.currentHolderId || item.currentOwnerId,
                currentOwnerRole: item.currentOwnerRole,
                soldBy: item.soldBy,
                allocatedAt: item.allocatedAt,
              };
            });
            setLoadedImeis(transformedStock);
            setImeis(transformedStock);
          }
        } catch (imeiErr) {
          console.error('Error loading IMEIs:', imeiErr);
        }

        // Load all users from API for role-based filtering
        // Skip API call for field officers - they don't have permission
        let allUsers: typeof users = [];
        if (currentUser?.role !== 'field_officer') {
          try {
            const usersResponse = await userService.getAll();
            console.log('=== USERS API RESPONSE ===');
            console.log('Raw response:', usersResponse);
            
            if (Array.isArray(usersResponse)) {
              allUsers = usersResponse;
            } else if (usersResponse?.data) {
              if (Array.isArray(usersResponse.data)) {
                allUsers = usersResponse.data;
              } else if (usersResponse.data.users) {
                allUsers = usersResponse.data.users;
              } else if ((usersResponse.data as any).success && Array.isArray((usersResponse.data as any).data)) {
                allUsers = (usersResponse.data as any).data;
              }
            }
            
            console.log('Parsed users from API:', allUsers.length);
            console.log('Users breakdown:', {
              admins: allUsers.filter(u => u.role === 'admin').length,
              regionalManagers: allUsers.filter(u => u.role === 'regional_manager').length,
              teamLeaders: allUsers.filter(u => u.role === 'team_leader').length,
              fieldOfficers: allUsers.filter(u => u.role === 'field_officer').length,
            });
            console.log('All users:', allUsers.map(u => ({ id: u.id, name: u.name, role: u.role })));
            
            // Always use API users if we got any
            if (allUsers.length > 0) {
              console.log('✓ Using API users:', allUsers.length);
              setLoadedUsers(allUsers);
            } else {
              // Fallback to context users if API returned empty
              console.warn('⚠️ No users from API, using context users:', users.length);
              console.log('Context users:', users.map(u => ({ id: u.id, name: u.name, role: u.role })));
              setLoadedUsers(users);
            }
          } catch (err) {
            console.error('❌ Error loading users from API:', err);
            console.warn('⚠️ Falling back to context users:', users.length);
            console.log('Context users:', users.map(u => ({ id: u.id, name: u.name, role: u.role })));
            setLoadedUsers(users);
          }
        } else {
          // Field officers use context users directly
          console.log('⚠️ User role is field_officer, skipping API call and using context users:', users.length);
          setLoadedUsers(users);
        }
      } catch (error) {
        console.error('Failed to load stock allocation data:', error);
        console.warn('Using fallback data from context');
        setLoadedUsers(users);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [currentUser]);

  // Sync loadedUsers with context users if loadedUsers becomes empty
  useEffect(() => {
    if (loadedUsers.length === 0 && users.length > 0) {
      console.log('⚠️ loadedUsers is empty, syncing with context users:', users.length);
      setLoadedUsers(users);
    }
  }, [users, loadedUsers.length]);

  // Get current user's stock from loaded data
  // For admin/managers: includes own stock + unallocated inventory
  // For FOs: only their allocated stock
  const myStock = useMemo(() => {
    if (!currentUser) return [];

    const normalizeOwnerId = (imei: any) => {
      const ownerRef = imei.currentOwnerId || (imei as any).currentHolderId;
      if (!ownerRef) return null;
      if (typeof ownerRef === 'string') return ownerRef;
      return ownerRef._id || ownerRef.id || null;
    };

    console.log('Computing myStock for user:', currentUser.id, 'role:', currentUser.role, 'Total loadedImeis:', loadedImeis.length);
    console.log('All loadedImeis:', loadedImeis.map(i => ({ imei: i.imei, product: i.productName, owner: normalizeOwnerId(i), status: i.status })));

    const ownedStock = loadedImeis.filter(imei => {
      const ownerId = normalizeOwnerId(imei);
      const statusUpper = imei.status ? imei.status.toUpperCase() : 'IN_STOCK';
      return ownerId === currentUser.id && statusUpper !== 'SOLD' && statusUpper !== 'LOCKED';
    });

    console.log('Owned stock items:', ownedStock.length, ownedStock.map(i => ({ imei: i.imei, product: i.productName })));

    // For admin only: also include unallocated inventory
    // Regional managers, team leaders, and field officers only see their allocated stock
    if (currentUser.role === 'admin') {
      const unallocatedStock = loadedImeis.filter(imei => {
        const ownerId = normalizeOwnerId(imei);
        const isUnallocated = !ownerId; // Works for both null and undefined
        // Check status - make case-insensitive and accept any unallocated status
        const statusUpper = imei.status ? imei.status.toUpperCase() : 'IN_STOCK';
        const validStatus = statusUpper === 'IN_STOCK' || statusUpper === 'ALLOCATED' || !imei.status;
        const isValid = isUnallocated && validStatus;

        console.log('Checking item:', imei.imei, {
          currentOwnerId: imei.currentOwnerId,
          ownerId,
          isUnallocated,
          status: imei.status,
          statusUpper,
          validStatus,
          isValid
        });

        return isValid;
      });
      console.log('Unallocated stock items:', unallocatedStock.length, unallocatedStock.map(i => ({ imei: i.imei, product: i.productName })));
      const result = [...ownedStock, ...unallocatedStock];
      console.log('Final myStock:', result.length, result.map(i => ({ imei: i.imei, product: i.productName })));
      return result;
    }

    // Regional managers, team leaders, and field officers: only their allocated stock
    console.log('Final myStock (allocated only):', ownedStock.length, ownedStock.map(i => ({ imei: i.imei, product: i.productName })));
    return ownedStock;
  }, [currentUser, loadedImeis]);

  // Get users who can receive stock based on current user's role
  const eligibleRecipients = useMemo(() => {
    if (!currentUser) {
      console.log('❌ No currentUser for eligible recipients');
      return [];
    }
    
    // Always try both sources: first loadedUsers, then context users
    let usersToFilter = [...loadedUsers];
    
    // If loadedUsers is empty, add context users
    if (usersToFilter.length === 0 && users.length > 0) {
      console.log('⚠️ loadedUsers empty, adding context users');
      usersToFilter = [...users];
    }
    
    // Ensure all users have IDs - generate if missing
    usersToFilter = usersToFilter.map((user, index) => ({
      ...user,
      id: user.id || `user-${user.name?.replace(/\s+/g, '-')}-${index}`
    }));
    
    console.log('=== ELIGIBLE RECIPIENTS COMPUTATION ===');
    console.log('✓ Current user:', { id: currentUser.id, name: currentUser.name, role: currentUser.role });
    console.log('✓ Total users to filter:', usersToFilter.length);
    console.log('✓ LoadedUsers:', loadedUsers.length, '| Context Users:', users.length);
    
    const allUsersSummary = usersToFilter.map(u => ({ id: u.id, name: u.name, role: u.role }));
    console.log('All available users:', allUsersSummary);
    
    // Count users by role
    const usersByRole = {
      admin: usersToFilter.filter(u => u.role === 'admin').length,
      regional_manager: usersToFilter.filter(u => u.role === 'regional_manager').length,
      team_leader: usersToFilter.filter(u => u.role === 'team_leader').length,
      field_officer: usersToFilter.filter(u => u.role === 'field_officer').length,
    };
    console.log('📊 Users by role:', usersByRole);
    
    let result = [];
    switch (currentUser.role) {
      case 'admin':
        // Admin: Try RMs first, then ANY non-admin user, then ALL users
        result = usersToFilter.filter(u => u.role === 'regional_manager');
        console.log('🔹 ADMIN MODE - Step 1: Looking for regional_manager role');
        console.log('  Found:', result.length);
        
        if (result.length === 0) {
          console.log('🔹 ADMIN MODE - Step 2: No RMs by role, looking for ANY non-admin user');
          result = usersToFilter.filter(u => u.id !== currentUser.id && u.role !== 'admin');
          console.log('  Found:', result.length);
          
          if (result.length === 0) {
            console.log('🔹 ADMIN MODE - Step 3: No non-admin users, using ALL users except self');
            result = usersToFilter.filter(u => u.id !== currentUser.id);
            console.log('  Found:', result.length);
          }
        }
        console.log('📋 Final admin recipients:', result.map(u => ({ id: u.id, name: u.name, role: u.role })));
        return result;
        
      case 'regional_manager':
        result = usersToFilter.filter(u => u.role === 'team_leader' && u.regionalManagerId === currentUser.id);
        if (result.length > 0) {
          console.log('🔹 RM MODE - Found linked TLs:', result.length);
          return result;
        }
        
        result = usersToFilter.filter(u => u.role === 'team_leader');
        if (result.length > 0) {
          console.log('🔹 RM MODE - Found all TLs:', result.length);
          return result;
        }
        
        result = usersToFilter.filter(u => u.role !== 'admin' && u.id !== currentUser.id);
        console.log('🔹 RM MODE - Showing all non-admin users:', result.length);
        return result;
        
      case 'team_leader':
        result = usersToFilter.filter(u => u.role === 'field_officer' && u.teamLeaderId === currentUser.id);
        if (result.length > 0) {
          console.log('🔹 TL MODE - Found linked FOs:', result.length);
          return result;
        }
        
        result = usersToFilter.filter(u => u.role === 'field_officer');
        if (result.length > 0) {
          console.log('🔹 TL MODE - Found all FOs:', result.length);
          return result;
        }
        
        result = usersToFilter.filter(u => u.id !== currentUser.id);
        console.log('🔹 TL MODE - Showing all other users:', result.length);
        return result;
        
      default:
        console.log('❌ Unknown role:', currentUser.role);
        return [];
    }
  }, [currentUser, loadedUsers, users]);

  // Get allocation history from loaded data
  const allocationHistory = useMemo(() => {
    if (!currentUser) return [];
    return loadedAllocations.filter(
      a => a.fromUserId === currentUser.id || a.toUserId === currentUser.id
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [currentUser, loadedAllocations]);

  // Filter stock by search
  const filteredStock = myStock.filter(imei =>
    imei.imei.includes(searchQuery) ||
    imei.productName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get recipient stats from loaded data
  const recipientStats = useMemo(() => {
    return eligibleRecipients.map(recipient => {
      const recipientStock = loadedImeis.filter(i => i.currentOwnerId === recipient.id);
      const availableStock = recipientStock.filter(i => i.status === 'ALLOCATED' || i.status === 'IN_STOCK');
      const soldStock = recipientStock.filter(i => i.status === 'SOLD');
      return {
        ...recipient,
        totalStock: availableStock.length,
        soldStock: soldStock.length,
      };
    });
  }, [eligibleRecipients, loadedImeis]);

  // Get recallable stock from loaded data
  const recallableStock = useMemo(() => {
    if (!currentUser) return [];
    
    const usersToFilter = loadedUsers.length > 0 ? loadedUsers : users;
    let subordinates: typeof users = [];
    
    if (currentUser.role === 'admin') {
      subordinates = usersToFilter.filter(u => 
        u.role === 'regional_manager' || u.role === 'team_leader' || u.role === 'field_officer'
      );
    } else if (currentUser.role === 'regional_manager') {
      const teamLeaders = usersToFilter.filter(u => u.role === 'team_leader' && u.regionalManagerId === currentUser.id);
      const teamLeaderIds = teamLeaders.map(tl => tl.id);
      const fieldOfficers = usersToFilter.filter(u => u.role === 'field_officer' && teamLeaderIds.includes(u.teamLeaderId || ''));
      subordinates = [...teamLeaders, ...fieldOfficers];
    } else if (currentUser.role === 'team_leader') {
      subordinates = usersToFilter.filter(u => u.role === 'field_officer' && u.teamLeaderId === currentUser.id);
    }

    return subordinates
      .map(sub => ({
        // Normalize user id field to support both `id` and `_id` shapes
        user: { ...sub, id: sub.id || (sub as any)._id },
        imeis: loadedImeis.filter(imei => {
          const ownerRef = (imei.currentOwnerId || (imei as any).currentHolderId);
          const ownerId = ownerRef?._id || ownerRef?.id || ownerRef;
          return ownerId === (sub.id || (sub as any)._id) && imei.status !== 'SOLD' && imei.status !== 'LOCKED';
        }),
      }))
      .filter(item => item.user && item.user.id && item.imeis.length > 0);
  }, [currentUser, loadedUsers, users, loadedImeis]);

  const totalRecallableItems = useMemo(() => {
    return recallableStock.reduce((acc, item) => acc + item.imeis.length, 0);
  }, [recallableStock]);

  const handleAllocate = (imei: IMEI) => {
    console.log('=== ALLOCATE DIALOG OPENED ===');
    console.log('IMEI:', imei.imei, 'Product:', imei.productName);
    console.log('Eligible recipients available:', eligibleRecipients.length);
    console.log('Recipients:', eligibleRecipients.map(r => ({ id: r.id, name: r.name, role: r.role })));
    setSelectedImei(imei);
    setSelectedRecipient(''); // Reset recipient selection when opening dialog
    setAllocateDialogOpen(true);
  };

  const handleViewJourney = (imei: IMEI) => {
    setJourneyImei(imei);
    setJourneyDialogOpen(true);
  };

  const handleRecall = (imei: IMEI, userId: string) => {
    setSelectedRecallImei({ imei, userId });
    setRecallDialogOpen(true);
  };

  const confirmRecall = async () => {
    if (!selectedRecallImei || !currentUser) return;

    try {
      setIsSaving(true);
      const response = await stockAllocationService.recallStock({
        imeiId: selectedRecallImei.imei.id,
        fromUserId: selectedRecallImei.userId,
        reason: recallReason,
      });

      if (response.success) {
        const usersToSearch = loadedUsers.length > 0 ? loadedUsers : users;
        const user = usersToSearch.find(u => u.id === selectedRecallImei.userId);
        toast.success(`Stock recalled from ${user?.name || 'user'}`);
        
        // Update local state
        setLoadedImeis(prev => prev.map(imei => {
          if (imei.id === selectedRecallImei.imei.id) {
            return {
              ...imei,
              status: 'ALLOCATED',
              currentOwnerId: currentUser.id,
              currentOwnerRole: currentUser.role,
              allocatedAt: new Date(),
            };
          }
          return imei;
        }));

        // Add recall allocation record
        const newAllocation: StockAllocationType = {
          id: response.data?.id || `recall-${Date.now()}`,
          productId: selectedRecallImei.imei.productId,
          productName: selectedRecallImei.imei.productName,
          imei: selectedRecallImei.imei.imei,
          quantity: 1,
          fromUserId: selectedRecallImei.userId,
          fromUserName: user?.name || 'Unknown',
          fromRole: user?.role || 'field_officer',
          toUserId: currentUser.id,
          toUserName: currentUser.name,
          toRole: currentUser.role,
          level: currentUser.role === 'admin' ? 'admin' : currentUser.role === 'regional_manager' ? 'regional_manager' : 'field_officer',
          status: 'completed',
          createdAt: new Date(),
          completedAt: new Date(),
          notes: recallReason ? `RECALL: ${recallReason}` : 'RECALL: Stock recalled',
        };
        
        setLoadedAllocations(prev => [newAllocation, ...prev]);
        
        setRecallDialogOpen(false);
        setSelectedRecallImei(null);
        setRecallReason('');
      } else {
        toast.error((response as any).error || 'Failed to recall stock');
      }
    } catch (error: any) {
      console.error('Recall error:', error);
      toast.error(error.message || 'Failed to recall stock');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleRecallSelection = (imei: IMEI, userId: string) => {
    const exists = selectedRecallImeis.some(r => r.imei.id === imei.id);
    if (exists) {
      setSelectedRecallImeis(prev => prev.filter(r => r.imei.id !== imei.id));
    } else {
      setSelectedRecallImeis(prev => [...prev, { imei, userId }]);
    }
  };

  const confirmBulkRecall = async () => {
    if (selectedRecallImeis.length === 0 || !currentUser) return;

    try {
      setIsSaving(true);
      
      // Group by fromUserId for bulk recall API call
      const groupedByUser = selectedRecallImeis.reduce((acc, item) => {
        if (!acc[item.userId]) {
          acc[item.userId] = [];
        }
        acc[item.userId].push(item.imei.id);
        return acc;
      }, {} as Record<string, string[]>);

      const response = await stockAllocationService.bulkRecallStock({
        imeiIds: selectedRecallImeis.map(r => r.imei.id),
        fromUserIds: Object.keys(groupedByUser),
        reason: recallReason,
      });

      if (response.success) {
        // Update local state
        const recalledImeiIds = new Set(selectedRecallImeis.map(r => r.imei.id));
        setLoadedImeis(prev => prev.map(imei => {
          if (recalledImeiIds.has(imei.id)) {
            return {
              ...imei,
              status: 'ALLOCATED',
              currentOwnerId: currentUser.id,
              currentOwnerRole: currentUser.role,
              allocatedAt: new Date(),
            };
          }
          return imei;
        }));

        // Add recall records
        const usersToSearch = loadedUsers.length > 0 ? loadedUsers : users;
        selectedRecallImeis.forEach(({ imei, userId }) => {
          const fromUser = usersToSearch.find(u => u.id === userId);
          const newAllocation: StockAllocationType = {
            id: `recall-${Date.now()}-${imei.id}`,
            productId: imei.productId,
            productName: imei.productName,
            imei: imei.imei,
            quantity: 1,
            fromUserId: userId,
            fromUserName: fromUser?.name || 'Unknown',
            fromRole: fromUser?.role || 'field_officer',
            toUserId: currentUser.id,
            toUserName: currentUser.name,
            toRole: currentUser.role,
            level: currentUser.role === 'admin' ? 'admin' : currentUser.role === 'regional_manager' ? 'regional_manager' : 'field_officer',
            status: 'completed',
            createdAt: new Date(),
            completedAt: new Date(),
            notes: recallReason ? `RECALL: ${recallReason}` : 'RECALL: Bulk recall',
          };
          
          setLoadedAllocations(prev => [newAllocation, ...prev]);
        });

        toast.success(`Successfully recalled ${selectedRecallImeis.length} item(s)`);
        setBulkRecallDialogOpen(false);
        setSelectedRecallImeis([]);
        setRecallReason('');
      } else {
        toast.error((response as any).error || 'Failed to recall stock');
      }
    } catch (error: any) {
      console.error('Bulk recall error:', error);
      toast.error(error.message || 'Failed to recall stock');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmAllocation = async () => {
    console.log('=== CONFIRM ALLOCATION ===');
    console.log('Selected IMEI:', selectedImei?.id, selectedImei?.imei);
    console.log('Selected Recipient:', selectedRecipient);
    console.log('Current User:', currentUser?.id);
    
    if (!selectedImei || !selectedRecipient || !currentUser) {
      console.log('❌ Missing required data');
      toast.error('Missing required data for allocation');
      return;
    }

    let usersToSearch = loadedUsers.length > 0 ? loadedUsers : users;
    console.log('Searching for recipient in:', usersToSearch.length, 'users');
    
    // Ensure all users have IDs - generate if missing
    usersToSearch = usersToSearch.map((user, index) => ({
      ...user,
      id: user.id || `user-${user.name?.replace(/\s+/g, '-')}-${index}`
    }));
    
    // Try to find by ID first, then by name (for users with undefined IDs)
    let recipient = usersToSearch.find(u => u.id === selectedRecipient);
    let recipientId = recipient?.id;
    
    if (!recipient && selectedRecipient.startsWith('user-')) {
      // Fallback: extract name from the generated ID and search by name
      const namePart = selectedRecipient.replace('user-', '').split('-').slice(0, -1).join(' ');
      recipient = usersToSearch.find(u => u.name === namePart.replace(/-/g, ' '));
      console.log('Found recipient by name:', recipient?.name, 'ID:', recipient?.id);
      // Use the recipient's ID (which is now guaranteed to be generated if missing)
      recipientId = recipient?.id || selectedRecipient;
    }
    
      console.log('Found recipient:', recipient?.name);
    console.log('Using recipientId:', recipientId);

    try {
      setIsSaving(true);
      console.log('Calling allocateStock with:', {
        imeiId: selectedImei.id,
        toUserId: recipientId,
        notes: `Allocation from ${currentUser.name} to ${recipient?.name || recipientId}`,
      });
      
      const response = await stockAllocationService.allocateStock({
        imeiId: selectedImei.id,
        toUserId: recipientId,
        notes: `Allocation from ${currentUser.name} to ${recipient?.name || recipientId}`,
      });

      console.log('Allocation response:', response);

      if (response.success) {
        // Also update the IMEI status and owner in the database
        try {
          await imeiService.update(selectedImei.id, {
            status: 'allocated',
            currentOwnerId: recipientId,
          });
          console.log('IMEI updated successfully');
        } catch (imeiUpdateError) {
          console.error('Failed to update IMEI status:', imeiUpdateError);
          // Continue anyway as the allocation was successful
        }
        
        toast.success(`Stock allocated to ${recipient?.name || recipientId}`);
        
        // Update local state
        setLoadedImeis(prev => prev.map(imei => {
          if (imei.id === selectedImei.id) {
            return {
              ...imei,
                status: 'ALLOCATED',
                  currentOwnerId: recipientId,
                  currentOwnerRole: recipient?.role || 'field_officer',
                  allocatedAt: new Date(),
            };
          }
          return imei;
        }));

        // Add to allocations
        const newAllocation: StockAllocationType = {
          id: response.data?.id || `alloc-${Date.now()}`,
          productId: selectedImei.productId,
          productName: selectedImei.productName,
          imei: selectedImei.imei,
          quantity: 1,
          fromUserId: currentUser.id,
          fromUserName: currentUser.name,
          fromRole: currentUser.role,
          toUserId: recipientId,
          toUserName: recipient?.name || recipientId,
          toRole: recipient?.role || 'field_officer',
          level: recipient?.role === 'regional_manager' ? 'regional_manager' : recipient?.role === 'team_leader' ? 'team_leader' : 'field_officer',
          status: 'completed',
          createdAt: new Date(),
          completedAt: new Date(),
        };
        
        setLoadedAllocations(prev => [newAllocation, ...prev]);
        
        setAllocateDialogOpen(false);
        setSelectedImei(null);
        setSelectedRecipient('');
      } else {
        const errorMsg = (response as any).error || (response as any).message || 'Failed to allocate stock';
        console.error('Allocation failed:', errorMsg);
        toast.error(errorMsg);
      }
    } catch (error: any) {
      console.error('Allocation error:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to allocate stock. Please check the server logs.';
      console.error('Full error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
      toast.error(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      IN_STOCK: 'default',
      ALLOCATED: 'secondary',
      SOLD: 'outline',
    };
    return <Badge variant={variants[status] || 'default'}>{status.replace('_', ' ')}</Badge>;
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-purple-100 text-purple-800',
      regional_manager: 'bg-blue-100 text-blue-800',
      team_leader: 'bg-green-100 text-green-800',
      field_officer: 'bg-orange-100 text-orange-800',
    };
    return (
      <Badge className={colors[role] || 'bg-gray-100 text-gray-800'}>
        {role.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  if (!currentUser) {
    return <MainLayout><div className="p-8">Please log in to view stock allocation.</div></MainLayout>;
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading stock allocation data...</p>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (currentUser.role === 'field_officer') {
    return (
      <MainLayout>
        <div className="p-8">
          <h1 className="text-2xl font-bold mb-4">My Stock</h1>
          <p className="text-muted-foreground mb-6">View the stock allocated to you from the database inventory for selling.</p>
          
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Available Stock (from Database)</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{myStock.length}</div>
                <p className="text-xs text-muted-foreground">Phones ready to sell</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>My Allocated Phones</CardTitle>
                  <CardDescription>Phones assigned to you from database inventory for selling</CardDescription>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    setIsLoading(true);
                    stockAllocationService.getAvailableStock()
                      .then(res => {
                        if (res.success && res.data) {
                          const stock = Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
                          const transformedStock = stock.map((item: any) => {
                            const productId = typeof item.productId === 'object' ? item.productId._id : item.productId;
                            const productName = typeof item.productId === 'object' ? item.productId.name : item.productName;
                            
                            // Look up product to get selling price if not in item
                            const product = products.find(p => p.id === productId);
                            const sellingPrice = item.sellingPrice || product?.price || 0;
                            
                            // Look up allocation date from stockAllocations
                            const allocationRecord = loadedAllocations.find(alloc => alloc.imei === item.imei);
                            const allocatedAt = allocationRecord?.createdAt || item.allocatedAt;
                            
                            return {
                              id: item._id || item.id,
                              imei: item.imei,
                              productId: productId,
                              productName: productName,
                              capacity: item.capacity,
                              status: item.status,
                              sellingPrice: sellingPrice,
                              commission: item.commission || 0,
                              source: item.source || 'watu',
                              registeredAt: item.registeredAt,
                              currentOwnerId: item.currentHolderId,
                              currentOwnerRole: item.currentOwnerRole,
                              allocatedAt: allocatedAt,
                            };
                          });
                          setLoadedImeis(transformedStock);
                          toast.success(`Loaded ${transformedStock.length} items from database`);
                        }
                      })
                      .catch(() => toast.error('Failed to refresh inventory'))
                      .finally(() => setIsLoading(false));
                  }}
                  disabled={isLoading}
                >
                  <RotateCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>IMEI</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Allocated Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myStock.map(imei => (
                    <TableRow key={imei.id || imei.imei}>
                      <TableCell className="font-medium">{imei.productName}</TableCell>
                      <TableCell className="font-mono">{imei.imei}</TableCell>
                      <TableCell>KES {(imei.sellingPrice || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{imei.source}</Badge>
                      </TableCell>
                      <TableCell>{imei.allocatedAt ? format(new Date(imei.allocatedAt), 'PPP') : '-'}</TableCell>
                    </TableRow>
                  ))}
                  {myStock.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No stock allocated to you yet. Stock from database will appear here when allocated.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 md:p-8 w-full mx-auto" style={{ maxWidth: '98vw' }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Stock Allocation</h1>
            <p className="text-muted-foreground">
              Manage and allocate stock to your {currentUser.role === 'admin' ? 'regional managers' : currentUser.role === 'regional_manager' ? 'team leaders' : 'field officers'}
            </p>
          </div>
          <Button onClick={() => setBulkAllocateOpen(true)} disabled={myStock.length === 0 || eligibleRecipients.length === 0} className="w-full sm:w-auto">
            <Layers className="h-4 w-4 mr-2" />
            Bulk Allocate
          </Button>
        </div>

        {/* Workflow Pipeline Tracker */}
        <WorkflowTracker 
          currentUser={currentUser}
          users={loadedUsers}
          imeis={loadedImeis}
          stockAllocations={loadedAllocations}
        />

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Stock</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{myStock.length}</div>
              <p className="text-xs text-muted-foreground">Available for allocation</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recipients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{eligibleRecipients.length}</div>
              <p className="text-xs text-muted-foreground">Can receive stock</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Allocations Made</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {allocationHistory.filter(a => a.fromUserId === currentUser.id).length}
              </div>
              <p className="text-xs text-muted-foreground">Total outgoing</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Received</CardTitle>
              <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {allocationHistory.filter(a => a.toUserId === currentUser.id).length}
              </div>
              <p className="text-xs text-muted-foreground">Total incoming</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4 h-auto">
            <TabsTrigger value="my-stock" className="text-xs sm:text-sm">My Stock</TabsTrigger>
            <TabsTrigger value="recipients" className="text-xs sm:text-sm">Recipients</TabsTrigger>
            <TabsTrigger value="recall" className="flex items-center justify-center gap-0.5 sm:gap-1 text-xs sm:text-sm">
              <RotateCcw className="h-3 w-3" />
              <span className="hidden xs:inline">Recall</span>
              {totalRecallableItems > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs">{totalRecallableItems}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm">History</TabsTrigger>
          </TabsList>

          <TabsContent value="my-stock" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4">
                  <div>
                    <CardTitle>Available Stock</CardTitle>
                    <CardDescription>Phones in your stock pool ready for allocation (from database inventory)</CardDescription>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="relative flex-1 sm:flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by IMEI or product..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-full"
                      />
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        setIsLoading(true);
                        stockAllocationService.getAvailableStock()
                          .then(res => {
                            if (res.success && res.data) {
                              const stock = Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
                              const transformedStock = stock.map((item: any) => ({
                                id: item._id || item.id,
                                imei: item.imei,
                                productId: typeof item.productId === 'object' ? item.productId._id : item.productId,
                                productName: typeof item.productId === 'object' ? item.productId.name : item.productName,
                                capacity: item.capacity,
                                status: item.status,
                                sellingPrice: item.sellingPrice || 0,
                                commission: item.commission || 0,
                                source: item.source || 'watu',
                                registeredAt: item.registeredAt,
                                currentOwnerId: item.currentHolderId,
                                currentOwnerRole: item.currentOwnerRole,
                                allocatedAt: item.allocatedAt,
                              }));
                              setLoadedImeis(transformedStock);
                              toast.success(`Loaded ${transformedStock.length} items from database`);
                            }
                          })
                          .catch(() => toast.error('Failed to refresh inventory'))
                          .finally(() => setIsLoading(false));
                      }}
                      disabled={isLoading}
                    >
                      <RotateCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>IMEI</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStock.map(imei => (
                      <TableRow key={imei.id || imei.imei}>
                        <TableCell className="font-medium">{imei.productName}</TableCell>
                        <TableCell className="font-mono">{imei.imei}</TableCell>
                        <TableCell>KES {(imei.sellingPrice || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{imei.source}</Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(imei.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleViewJourney(imei)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Journey
                            </Button>
                            <Button size="sm" onClick={() => handleAllocate(imei)} disabled={eligibleRecipients.length === 0}>
                              <Send className="h-4 w-4 mr-1" />
                              Allocate
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredStock.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No stock available for allocation
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recipients" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Stock Recipients</CardTitle>
                <CardDescription>
                  {currentUser.role === 'admin' ? 'Regional Managers' : currentUser.role === 'regional_manager' ? 'Team Leaders' : 'Field Officers'} who can receive stock from you
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {recipientStats.map(recipient => {
                    // Calculate allocations to this recipient in last 7 days
                    const recentAllocations = stockAllocations.filter(a => {
                      const date = new Date(a.createdAt);
                      const now = new Date();
                      return a.toUserId === recipient?.id && 
                             a.fromUserId === currentUser.id &&
                             (now.getTime() - date.getTime()) < 7 * 24 * 60 * 60 * 1000;
                    }).length;

                    // Calculate their subordinates' performance (if they have any)
                    const subordinateCount = users.filter(u => {
                      if (recipient?.role === 'regional_manager') {
                        return u.role === 'team_leader' && u.regionalManagerId === recipient?.id;
                      } else if (recipient?.role === 'team_leader') {
                        return u.role === 'field_officer' && u.teamLeaderId === recipient?.id;
                      }
                      return false;
                    }).length;

                    const totalStockNum = (recipient?.totalStock || 0) + (recipient?.soldStock || 0);
                    const sellThroughRate = totalStockNum > 0
                      ? Math.round(((recipient?.soldStock || 0) / totalStockNum) * 100)
                      : 0;

                    return (
                      <Card key={recipient.id} className="hover:border-primary/50 transition-colors">
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                              <Users className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold">{recipient?.name || 'Unknown'}</h3>
                              <p className="text-sm text-muted-foreground">{recipient?.region || 'No region'}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {recipient?.role ? recipient.role.replace('_', ' ') : 'unknown'}
                            </Badge>
                          </div>
                          
                          {/* Performance indicators */}
                          <div className="mt-4 pt-4 border-t">
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="bg-muted/50 rounded-lg p-2">
                                <p className="text-xl font-bold">{recipient?.totalStock ?? 0}</p>
                                <p className="text-xs text-muted-foreground">In Hand</p>
                              </div>
                              <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-2">
                                <p className="text-xl font-bold text-green-600">{recipient?.soldStock ?? 0}</p>
                                <p className="text-xs text-muted-foreground">Sold</p>
                              </div>
                              <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-2">
                                <p className="text-xl font-bold text-blue-600">{sellThroughRate}%</p>
                                <p className="text-xs text-muted-foreground">Sell Rate</p>
                              </div>
                            </div>
                          </div>

                          {/* Workflow info */}
                          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              <span>{recentAllocations} received (7d)</span>
                            </div>
                            {subordinateCount > 0 && (
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                <span>{subordinateCount} subordinates</span>
                              </div>
                            )}
                          </div>

                          {/* Quick allocate button */}
                          <Button 
                            className="w-full mt-4" 
                            size="sm"
                            disabled={myStock.length === 0}
                            onClick={() => {
                              setSelectedRecipient(recipient.id);
                              if (myStock.length > 0) {
                                setSelectedImei(myStock[0]);
                                setAllocateDialogOpen(true);
                              }
                            }}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Allocate Stock
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {recipientStats.length === 0 && (
                    <div className="col-span-full text-center text-muted-foreground py-8">
                      No recipients available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Allocation History</CardTitle>
                <CardDescription>All stock movements involving you</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>IMEI</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allocationHistory.map(allocation => (
                      <TableRow key={allocation.id}>
                        <TableCell>{format(new Date(allocation.createdAt), 'PPP')}</TableCell>
                        <TableCell className="font-medium">{allocation.productName}</TableCell>
                        <TableCell className="font-mono text-sm">{allocation.imei || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {allocation.fromUserId === currentUser.id ? (
                              <ArrowUpRight className="h-4 w-4 text-red-500" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4 text-green-500" />
                            )}
                            <span>{allocation.fromUserName || 'Unknown'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {allocation.toUserId === currentUser.id ? (
                              <ArrowDownRight className="h-4 w-4 text-green-500" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4 text-red-500" />
                            )}
                            <span>{allocation.toUserName || 'Unknown'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="capitalize">{allocation.status}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {allocationHistory.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No allocation history yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recall Stock Tab */}
          <TabsContent value="recall" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <RotateCcw className="h-5 w-5 text-warning" />
                      Recall Stock
                    </CardTitle>
                    <CardDescription>
                      Recall unsold stock from your subordinates back to your inventory
                    </CardDescription>
                  </div>
                  {selectedRecallImeis.length > 0 && (
                    <Button 
                      variant="destructive"
                      className="w-full sm:w-auto"
                      onClick={() => setBulkRecallDialogOpen(true)}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Recall Selected ({selectedRecallImeis.length})
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {recallableStock.length === 0 ? (
                  <div className="text-center py-12">
                    <RotateCcw className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No stock available for recall</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your subordinates either have no stock or all their stock has been sold
                    </p>
                  </div>
                ) : (
                  <Accordion type="multiple" className="w-full">
                    {recallableStock.map(({ user, imeis: userImeis }) => (
                      <AccordionItem key={user.id || (user as any)._id} value={user.id || (user as any)._id}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="text-left">
                              <p className="font-medium">{user.name}</p>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {user.role.replace('_', ' ')}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {user.region || 'No region'}
                                </span>
                              </div>
                            </div>
                            <Badge className="ml-auto mr-4 bg-warning/10 text-warning border-warning/20">
                              {userImeis.length} item{userImeis.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12">
                                  <Checkbox 
                                    checked={userImeis.every(i => selectedRecallImeis.some(r => r.imei.id === i.id))}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        const newItems = userImeis
                                          .filter(i => !selectedRecallImeis.some(r => r.imei.id === i.id))
                                          .map(imei => ({ imei, userId: user.id }));
                                        setSelectedRecallImeis(prev => [...prev, ...newItems]);
                                      } else {
                                        setSelectedRecallImeis(prev => 
                                          prev.filter(r => !userImeis.some(i => i.id === r.imei.id))
                                        );
                                      }
                                    }}
                                  />
                                </TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead>IMEI</TableHead>
                                <TableHead>Price</TableHead>
                                <TableHead>Source</TableHead>
                                <TableHead>Allocated</TableHead>
                                <TableHead>Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {userImeis.map(imei => (
                                <TableRow key={imei.id || imei.imei}>
                                  <TableCell>
                                    <Checkbox 
                                      checked={selectedRecallImeis.some(r => r.imei.id === imei.id)}
                                      onCheckedChange={() => toggleRecallSelection(imei, user.id)}
                                    />
                                  </TableCell>
                                  <TableCell className="font-medium">{imei.productName}</TableCell>
                                  <TableCell className="font-mono text-sm">{imei.imei}</TableCell>
                                  <TableCell>KES {(imei.sellingPrice || 0).toLocaleString()}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{imei.source}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    {imei.allocatedAt ? format(new Date(imei.allocatedAt), 'PP') : '-'}
                                  </TableCell>
                                  <TableCell>
                                    <Button 
                                      size="sm" 
                                      variant="destructive"
                                      onClick={() => handleRecall(imei, user.id)}
                                    >
                                      <RotateCcw className="h-4 w-4 mr-1" />
                                      Recall
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Allocate Dialog */}
        <Dialog open={allocateDialogOpen} onOpenChange={setAllocateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Allocate Stock</DialogTitle>
              <DialogDescription>
                Assign this phone to a {currentUser.role === 'admin' ? 'regional manager' : currentUser.role === 'regional_manager' ? 'team leader' : 'field officer'}
              </DialogDescription>
            </DialogHeader>
            {selectedImei && (
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-semibold">{selectedImei.productName}</p>
                      <p className="text-sm text-muted-foreground font-mono">{selectedImei.imei}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-4 text-sm">
                    <span>Price: <strong>KES {(selectedImei.sellingPrice || 0).toLocaleString()}</strong></span>
                    <span>Source: <Badge variant="outline">{selectedImei.source}</Badge></span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Allocate To</Label>
                  {eligibleRecipients.length === 0 ? (
                    <div className="text-sm bg-red-50 dark:bg-red-950 p-4 rounded border border-red-200 dark:border-red-800 space-y-2">
                      <p className="font-semibold text-red-900 dark:text-red-100">❌ No recipients available</p>
                      <div className="text-xs text-red-800 dark:text-red-200 space-y-1">
                        <p>📊 System Status:</p>
                        <p>• Your role: <strong>{currentUser?.role || 'unknown'}</strong></p>
                        <p>• Users from API: <strong>{loadedUsers.length}</strong></p>
                        <p>• Users from Context: <strong>{users.length}</strong></p>
                        <p>• Total users: <strong>{Math.max(loadedUsers.length, users.length)}</strong></p>
                        <p className="mt-2">💡 To fix:</p>
                        <p>Create users in the system first, or use context users with proper role setup</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 p-2 rounded">
                        ✓ {eligibleRecipients.length} recipient(s) available
                      </div>
                      <Select value={selectedRecipient} onValueChange={(value) => {
                        console.log('✓ Recipient selected:', value);
                        setSelectedRecipient(value);
                      }}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={`Choose from ${eligibleRecipients.filter(r => r.id).length} recipient(s)`} />
                        </SelectTrigger>
                        <SelectContent className="w-full">
                          {eligibleRecipients
                            .map((recipient, index) => ({
                              ...recipient,
                              effectiveId: recipient.id || `user-${recipient.name?.replace(/\s+/g, '-')}-${index}`
                            }))
                            .map((recipient) => (
                              <SelectItem key={recipient.effectiveId} value={recipient.effectiveId}>
                                <span>{recipient.name || recipient.effectiveId}</span>
                                {recipient.region && <span className="ml-2 text-xs text-gray-500">({recipient.region})</span>}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {selectedRecipient && (
                        <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 p-2 rounded">
                          ✓ Selected: {eligibleRecipients.find(r => (r.id || `user-${r.name?.replace(/\s+/g, '-')}`) === selectedRecipient)?.name}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setAllocateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={confirmAllocation} disabled={!selectedRecipient}>
                <Send className="h-4 w-4 mr-1" />
                Confirm Allocation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Allocation Dialog */}
        <BulkAllocationDialog
          open={bulkAllocateOpen}
          onOpenChange={setBulkAllocateOpen}
          stock={myStock}
          recipients={eligibleRecipients}
          currentUser={currentUser}
          onAllocate={async (imeis, recipientId) => {
            try {
              setIsSaving(true);
              const usersToSearch = loadedUsers.length > 0 ? loadedUsers : users;
              let recipient = usersToSearch.find(u => u.id === recipientId || (u as any)._id === recipientId || u.name === recipientId);
              if (!recipient) {
                // Try a looser match by normalized name (some UIs generate ids like `user-Name-Index`)
                const nameFromId = typeof recipientId === 'string' && recipientId.startsWith('user-')
                  ? recipientId.replace('user-', '').split('-').slice(0, -1).join(' ')
                  : null;
                if (nameFromId) {
                  recipient = usersToSearch.find(u => u.name === nameFromId) as any;
                }
              }
              if (!recipient) {
                // Don't fail client-side — backend will attempt to resolve by id or name.
                console.warn('Recipient not found locally, sending identifier to backend for lookup:', recipientId);
              }

              const response = await stockAllocationService.bulkAllocateStock({
                imeiIds: imeis.map(i => i.id),
                toUserId: recipientId,
                notes: `Bulk allocation from ${currentUser?.name || 'Admin'}`,
              });

              if (!response || !response.success) {
                throw new Error((response as any)?.message || 'Bulk allocation failed');
              }

              const results = response.data as any;
              const successImeis: string[] = Array.isArray(results?.success) ? results.success : [];
              const failedResults: any[] = Array.isArray(results?.failed) ? results.failed : [];

              if (successImeis.length === 0) {
                // Nothing succeeded
                const reasons = failedResults.map(f => `${f.imeiId || f.imei || ''}: ${f.reason || f}`).join('; ');
                toast.error(`No items allocated. ${reasons}`);
                return;
              }

              // Update only successfully allocated IMEIs in DB
              try {
                const updatePromises = imeis
                  .filter(i => successImeis.includes(i.imei) || successImeis.includes(i.id) )
                  .map(imei =>
                    imeiService.update(imei.id, {
                      status: 'allocated',
                      currentOwnerId: recipientId,
                    }).catch(err => {
                      console.error(`Failed to update IMEI ${imei.id}:`, err);
                    })
                  );
                await Promise.all(updatePromises);
              } catch (imeiUpdateError) {
                console.error('Failed to update IMEIs:', imeiUpdateError);
              }

              // Update local state only for successfully allocated IMEIs
              const successImeisSet = new Set(successImeis);
              setLoadedImeis(prev => prev.map(imei => {
                if (successImeisSet.has(imei.imei) || successImeisSet.has(imei.id)) {
                  return {
                    ...imei,
                    status: 'ALLOCATED',
                    currentOwnerId: recipientId,
                    currentOwnerRole: (recipient && recipient.role) ? recipient.role : 'field_officer',
                    allocatedAt: new Date(),
                  };
                }
                return imei;
              }));

              // Add allocation records only for successful ones
              imeis.forEach(imei => {
                if (!(successImeisSet.has(imei.imei) || successImeisSet.has(imei.id))) return;
                const newAllocation: StockAllocationType = {
                  id: `alloc-${Date.now()}-${imei.id}`,
                  productId: imei.productId,
                  productName: imei.productName,
                  imei: imei.imei,
                  quantity: 1,
                  fromUserId: currentUser?.id || '',
                  fromUserName: currentUser?.name || 'Admin',
                  fromRole: currentUser?.role || 'admin',
                  toUserId: recipientId,
                  toUserName: recipient?.name || recipientId,
                  toRole: recipient?.role || 'field_officer',
                  level: recipient?.role === 'regional_manager' ? 'regional_manager' : recipient?.role === 'team_leader' ? 'team_leader' : 'field_officer',
                  status: 'completed',
                  createdAt: new Date(),
                  completedAt: new Date(),
                };

                setLoadedAllocations(prev => [newAllocation, ...prev]);
              });

              // Show summary toast
              if (failedResults.length > 0) {
                toast.success(`Allocated ${successImeis.length} item(s) to ${recipient?.name || recipientId}. ${failedResults.length} failed.`);
              } else {
                toast.success(`Allocated ${successImeis.length} item(s) to ${recipient?.name || recipientId}`);
              }

              // Close dialog
              setBulkAllocateOpen(false);
            } catch (error: any) {
              console.error('Bulk allocation error:', error);
              throw error; // rethrow so dialog can display an error
            } finally {
              setIsSaving(false);
            }
          }}
        />

        {/* Single Recall Dialog */}
        <Dialog open={recallDialogOpen} onOpenChange={setRecallDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Recall Stock
              </DialogTitle>
              <DialogDescription>
                This will recall the stock back to your inventory. The user will be notified.
              </DialogDescription>
            </DialogHeader>
            {selectedRecallImei && (
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-semibold">{selectedRecallImei.imei.productName}</p>
                      <p className="text-sm text-muted-foreground font-mono">{selectedRecallImei.imei.imei}</p>
                    </div>
                  </div>
                  <div className="mt-3 text-sm">
                    <span>Currently with: <strong>{(loadedUsers.length > 0 ? loadedUsers : users).find(u => u.id === selectedRecallImei.userId)?.name}</strong></span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Reason for Recall (Optional)</Label>
                  <Textarea
                    placeholder="e.g., Stock reallocation, end of assignment period..."
                    value={recallReason}
                    onChange={(e) => setRecallReason(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setRecallDialogOpen(false);
                setSelectedRecallImei(null);
                setRecallReason('');
              }}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmRecall}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Confirm Recall
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Recall Dialog */}
        <Dialog open={bulkRecallDialogOpen} onOpenChange={setBulkRecallDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Bulk Recall Stock
              </DialogTitle>
              <DialogDescription>
                You are about to recall {selectedRecallImeis.length} item(s). All affected users will be notified.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="max-h-48 overflow-y-auto space-y-2">
                {selectedRecallImeis.map(({ imei, userId }, idx) => (
                  <div key={imei.id || imei.imei || `recall-${idx}`} className="flex items-center justify-between p-2 bg-muted rounded-lg text-sm">
                    <div>
                      <span className="font-medium">{imei.productName}</span>
                      <span className="text-muted-foreground ml-2 font-mono">{imei.imei}</span>
                    </div>
                    <span className="text-muted-foreground">
                      from {(loadedUsers.length > 0 ? loadedUsers : users).find(u => u.id === userId)?.name}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Reason for Recall (Optional)</Label>
                <Textarea
                  placeholder="e.g., Stock reallocation, inventory audit..."
                  value={recallReason}
                  onChange={(e) => setRecallReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setBulkRecallDialogOpen(false);
                setRecallReason('');
              }}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmBulkRecall}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Recall All ({selectedRecallImeis.length})
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stock Journey Dialog - use API-loaded users and allocations so journey shows DB data */}
        {journeyImei && (
          <StockJourney
            imei={journeyImei}
            users={loadedUsers.length > 0 ? loadedUsers : users}
            allocations={loadedAllocations.length > 0 ? loadedAllocations : stockAllocations}
            open={journeyDialogOpen}
            onOpenChange={(open) => {
              setJourneyDialogOpen(open);
              if (!open) setJourneyImei(null);
            }}
          />
        )}
      </div>
    </MainLayout>
  );
}
