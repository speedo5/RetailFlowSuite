import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, IMEI, Sale, Product, Commission, Notification, ActivityLog, ActivityType, StockAllocation, UserStockBalance, UserRole } from '@/types';
import { mockIMEIs, mockSales, mockCommissions, mockNotifications, mockActivityLogs, mockStockAllocations, mockUserStockBalances } from '@/data/mockData';
import { productService } from '@/services/productService';
import { imeiService } from '@/services/imeiService';
import { authService } from '@/services/authService';
import { tokenManager } from '@/services/apiClient';
import { commissionService } from '@/services/commissionService';
import { salesService } from '@/services/salesService';
import { activityLogService } from '@/services/activityLogService';

// ============================================================================
// APP CONTEXT - Application State Management
// ============================================================================

interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  isSessionLoading: boolean;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  imeis: IMEI[];
  setImeis: React.Dispatch<React.SetStateAction<IMEI[]>>;
  sales: Sale[];
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  commissions: Commission[];
  setCommissions: React.Dispatch<React.SetStateAction<Commission[]>>;
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  activityLogs: ActivityLog[];
  setActivityLogs: React.Dispatch<React.SetStateAction<ActivityLog[]>>;
  stockAllocations: StockAllocation[];
  setStockAllocations: React.Dispatch<React.SetStateAction<StockAllocation[]>>;
  userStockBalances: UserStockBalance[];
  setUserStockBalances: React.Dispatch<React.SetStateAction<UserStockBalance[]>>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  logActivity: (type: ActivityType, action: string, description: string, metadata?: Record<string, any>) => void;
  allocateStock: (allocation: Omit<StockAllocation, 'id' | 'createdAt' | 'status'>) => { success: boolean; error?: string };
  recallStock: (imeiId: string, fromUserId: string, reason?: string) => { success: boolean; error?: string };
  getMyStock: (userId: string) => IMEI[];
  getMyAllocatableStock: (userId: string) => IMEI[];
  getAllocationHistory: (userId: string) => StockAllocation[];
  getRecallableStock: (userId: string) => { user: User; imeis: IMEI[] }[];
  reassignFO: (foId: string, newTeamLeaderId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [imeis, setImeis] = useState<IMEI[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [stockAllocations, setStockAllocations] = useState<StockAllocation[]>([]);
  const [userStockBalances, setUserStockBalances] = useState<UserStockBalance[]>([]);

  // Restore session from localStorage on app mount
  useEffect(() => {
    const restoreSession = async () => {
      const token = tokenManager.get();
      if (token) {
        try {
          const response = await authService.getCurrentUser();
          if (response.success && response.data) {
            const foCodeVal = response.data.foCode ?? response.data.fo_code ?? response.data.FOCode ?? response.data.focode;
            const userData: User = {
              id: response.data.id || response.data._id,
              _id: response.data._id,
              name: response.data.name,
              email: response.data.email,
              password: '',
              role: response.data.role,
              region: response.data.region,
              phone: response.data.phone,
              foCode: foCodeVal,
              createdAt: response.data.createdAt ? new Date(response.data.createdAt) : new Date(),
              isActive: response.data.isActive !== false,
              teamLeaderId: response.data.teamLeaderId,
              regionalManagerId: response.data.regionalManagerId,
            };
            setCurrentUser(userData);
          } else {
            // Token is invalid, clear it
            tokenManager.remove();
          }
        } catch (error) {
          console.warn('Failed to restore session from token:', error);
          tokenManager.remove();
        }
      }
      // Session restoration complete
      setIsSessionLoading(false);
    };

    restoreSession();
  }, []);

  // Fetch initial data from API on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Sales
        try {
          const salesRes = await salesService.getAll();
          if (salesRes.success && salesRes.data) {
            const salesList = Array.isArray(salesRes.data) 
              ? salesRes.data 
              : salesRes.data.data || salesRes.data.sales || salesRes.data.sales || [];
            setSales(salesList);
          }
        } catch (err) {
          console.warn('Failed to fetch sales from API:', err?.message || err);
        }

        // Commissions
        try {
          const response = await commissionService.getAll();
          if (response.success && response.data) {
            // Handle different response structures from backend
            let commissionsList: Commission[] = [];
            
            if (Array.isArray(response.data)) {
              // Direct array response
              commissionsList = response.data;
            } else if ((response.data as any).commissions && Array.isArray((response.data as any).commissions)) {
              // CommissionListResponse with commissions property
              commissionsList = (response.data as any).commissions;
            } else if ((response.data as any).data && Array.isArray((response.data as any).data)) {
              // Response with data property
              commissionsList = (response.data as any).data;
            }
            
            setCommissions(commissionsList);
          }
        } catch (err) {
          console.warn('Failed to fetch commissions from API:', err?.message || err);
        }

        // Products
        try {
          const prodRes = await productService.getAll();
          const fetchedProducts = Array.isArray(prodRes) ? prodRes : (prodRes as any)?.data || (prodRes as any)?.products || [];
          if (fetchedProducts && fetchedProducts.length > 0) setProducts(fetchedProducts);
        } catch (err) {
          console.warn('Failed to fetch products from API:', err?.message || err);
        }

        // IMEIs (load all recent IMEIs - request a large limit to avoid default pagination fallback)
        try {
          const imeisRes = await imeiService.getAll({ limit: 100000 });
          const rawImeis = Array.isArray(imeisRes) ? imeisRes : (imeisRes as any)?.data || (imeisRes as any)?.imeis || [];
          // Normalize IMEI objects so UI can always use `id` (map `_id` -> `id` when backend returns Mongo _id)
          const fetchedImeis = (rawImeis || []).map((i: any) => ({ ...i, id: i.id || i._id }));
          if (fetchedImeis && fetchedImeis.length > 0) setImeis(fetchedImeis as any);
        } catch (err) {
          console.warn('Failed to fetch IMEIs from API:', err?.message || err);
        }

      } catch (error) {
        console.warn('Failed to fetch initial data from API:', error?.message || error);
      }
    };

    fetchInitialData();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await authService.login({ email, password });
      
      if (response.success && response.data) {
        const foCodeVal = response.data.user.foCode ?? response.data.user.fo_code ?? response.data.user.FOCode ?? response.data.user.focode;
        const userData: User = {
          id: response.data.user.id || response.data.user._id,
          _id: response.data.user._id,
          name: response.data.user.name,
          email: response.data.user.email,
          password: '', // Don't store plain password
          role: response.data.user.role,
          region: response.data.user.region,
          phone: response.data.user.phone,
          foCode: foCodeVal,
          createdAt: response.data.user.createdAt ? new Date(response.data.user.createdAt) : new Date(),
          isActive: response.data.user.isActive !== false,
          teamLeaderId: response.data.user.teamLeaderId,
          regionalManagerId: response.data.user.regionalManagerId,
        };
        setCurrentUser(userData);
        return { success: true };
      } else {
        return { success: false, error: 'Invalid credentials' };
      }
    } catch (error: any) {
      return { success: false, error: error.message || 'Login failed' };
    }
  };

  const logout = (): void => {
    authService.logout();
    setCurrentUser(null);
  };

  const addNotification = (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    const newNotif: Notification = {
      ...notification,
      id: `notif-${Date.now()}`,
      read: false,
      createdAt: new Date(),
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const logActivity = (type: ActivityType, action: string, description: string, metadata?: Record<string, any>) => {
    if (!currentUser) return;
    const newLog: ActivityLog = {
      id: `log-${Date.now()}`,
      type,
      action,
      description,
      userId: currentUser.id,
      userName: currentUser.name,
      metadata,
      createdAt: new Date(),
    };
    // Optimistically update local state so UI reflects the activity immediately
    setActivityLogs(prev => [newLog, ...prev]);

    // Persist activity to backend (non-blocking). Map frontend fields to API payload.
    (async () => {
      try {
        await activityLogService.create({
          action,
          entityType: type === 'inventory' ? 'imei' : (type === 'allocation' ? 'stock_allocation' : type),
          details: {
            description,
            metadata: {
              ...metadata,
              performedBy: { id: currentUser.id, name: currentUser.name, email: currentUser.email },
            }
          }
        });
      } catch (err) {
        // If persistence fails, log to console but keep local entry to avoid losing UX feedback
        console.warn('Failed to persist activity log to server:', err);
      }
    })();
  };

  const allocateStock = (allocation: Omit<StockAllocation, 'id' | 'createdAt' | 'status'>): { success: boolean; error?: string } => {
    // Validate allocation
    if (allocation.imei) {
      // Phone allocation - check IMEI ownership
      const imei = imeis.find(i => i.imei === allocation.imei);
      if (!imei) {
        return { success: false, error: 'IMEI not found' };
      }
      if (imei.currentOwnerId !== allocation.fromUserId) {
        return { success: false, error: 'You do not own this stock' };
      }
      if (imei.status === 'SOLD' || imei.status === 'LOCKED') {
        return { success: false, error: 'This phone cannot be allocated' };
      }
    }

    // Create allocation record
    const newAllocation: StockAllocation = {
      ...allocation,
      id: `alloc-${Date.now()}`,
      status: 'completed',
      createdAt: new Date(),
      completedAt: new Date(),
    };

    setStockAllocations(prev => [newAllocation, ...prev]);

    // Update IMEI ownership if phone allocation
    if (allocation.imei) {
      setImeis(prev => prev.map(imei => {
        if (imei.imei === allocation.imei) {
          const updates: Partial<IMEI> = {
            status: 'ALLOCATED',
            currentOwnerId: allocation.toUserId,
            currentOwnerRole: allocation.toRole,
            allocatedAt: new Date(),
          };

          // Track allocation chain
          if (allocation.toRole === 'regional_manager') {
            updates.allocatedToRegionalManagerId = allocation.toUserId;
          } else if (allocation.toRole === 'team_leader') {
            updates.allocatedToTeamLeaderId = allocation.toUserId;
          } else if (allocation.toRole === 'field_officer') {
            updates.allocatedToFOId = allocation.toUserId;
          }

          return { ...imei, ...updates };
        }
        return imei;
      }));
    }

    // Log the activity
    logActivity('allocation', 'Stock Allocated', 
      `Allocated ${allocation.productName} to ${allocation.toUserName}`,
      { imei: allocation.imei, toUser: allocation.toUserId }
    );

    // Add notification
    addNotification({
      title: 'Stock Allocated',
      message: `${allocation.fromUserName} allocated ${allocation.productName} to you`,
      type: 'allocation',
      userId: allocation.toUserId,
    });

    return { success: true };
  };

  const getMyStock = (userId: string): IMEI[] => {
    return imeis.filter(imei => imei.currentOwnerId === userId);
  };

  const getMyAllocatableStock = (userId: string): IMEI[] => {
    return imeis.filter(imei => 
      imei.currentOwnerId === userId && 
      imei.status !== 'SOLD' && 
      imei.status !== 'LOCKED'
    );
  };

  const getAllocationHistory = (userId: string): StockAllocation[] => {
    return stockAllocations.filter(
      alloc => alloc.fromUserId === userId || alloc.toUserId === userId
    );
  };

  const getRecallableStock = (userId: string): { user: User; imeis: IMEI[] }[] => {
    const user = users.find(u => u.id === userId);
    if (!user) return [];

    let subordinates: User[] = [];
    
    if (user.role === 'admin') {
      // Admin can recall from regional managers, team leaders, and field officers
      subordinates = users.filter(u => 
        u.role === 'regional_manager' || u.role === 'team_leader' || u.role === 'field_officer'
      );
    } else if (user.role === 'regional_manager') {
      // Regional manager can recall from their team leaders and those team leaders' FOs
      const teamLeaders = users.filter(u => u.role === 'team_leader' && u.regionalManagerId === userId);
      const teamLeaderIds = teamLeaders.map(tl => tl.id);
      const fieldOfficers = users.filter(u => u.role === 'field_officer' && teamLeaderIds.includes(u.teamLeaderId || ''));
      subordinates = [...teamLeaders, ...fieldOfficers];
    } else if (user.role === 'team_leader') {
      // Team leader can recall from their field officers
      subordinates = users.filter(u => u.role === 'field_officer' && u.teamLeaderId === userId);
    }

    return subordinates.map(sub => ({
      user: sub,
      imeis: imeis.filter(imei => 
        imei.currentOwnerId === sub.id && 
        imei.status !== 'SOLD' && 
        imei.status !== 'LOCKED'
      ),
    })).filter(item => item.imeis.length > 0);
  };

  const recallStock = (imeiId: string, fromUserId: string, reason?: string): { success: boolean; error?: string } => {
    if (!currentUser) {
      return { success: false, error: 'Not logged in' };
    }

    const imei = imeis.find(i => i.id === imeiId);
    if (!imei) {
      return { success: false, error: 'IMEI not found' };
    }

    if (imei.currentOwnerId !== fromUserId) {
      return { success: false, error: 'This user does not own this stock' };
    }

    if (imei.status === 'SOLD' || imei.status === 'LOCKED') {
      return { success: false, error: 'This phone cannot be recalled' };
    }

    const fromUser = users.find(u => u.id === fromUserId);
    if (!fromUser) {
      return { success: false, error: 'User not found' };
    }

    // Check if current user can recall from this user
    const recallable = getRecallableStock(currentUser.id);
    const canRecall = recallable.some(r => r.user.id === fromUserId && r.imeis.some(i => i.id === imeiId));
    if (!canRecall) {
      return { success: false, error: 'You cannot recall stock from this user' };
    }

    // Create recall allocation record (reversed allocation)
    const recallAllocation: StockAllocation = {
      id: `recall-${Date.now()}`,
      productId: imei.productId,
      productName: imei.productName,
      imei: imei.imei,
      quantity: 1,
      fromUserId: fromUserId,
      fromUserName: fromUser.name,
      fromRole: fromUser.role,
      toUserId: currentUser.id,
      toUserName: currentUser.name,
      toRole: currentUser.role,
      level: currentUser.role === 'admin' ? 'regional' : currentUser.role === 'regional_manager' ? 'team' : 'fo',
      status: 'completed',
      createdAt: new Date(),
      completedAt: new Date(),
      notes: reason ? `RECALL: ${reason}` : 'RECALL: Stock recalled by management',
    };

    setStockAllocations(prev => [recallAllocation, ...prev]);

    // Update IMEI ownership back to the recalling user
    setImeis(prev => prev.map(i => {
      if (i.id === imeiId) {
        return {
          ...i,
          status: 'ALLOCATED' as const,
          currentOwnerId: currentUser.id,
          currentOwnerRole: currentUser.role,
          allocatedAt: new Date(),
        };
      }
      return i;
    }));

    // Log the activity
    logActivity('allocation', 'Stock Recalled', 
      `Recalled ${imei.productName} (${imei.imei}) from ${fromUser.name}${reason ? `: ${reason}` : ''}`,
      { imei: imei.imei, fromUser: fromUserId, reason }
    );

    // Add notification to the user who lost the stock
    addNotification({
      title: 'Stock Recalled',
      message: `${currentUser.name} has recalled ${imei.productName} from your inventory${reason ? `: ${reason}` : ''}`,
      type: 'allocation',
      userId: fromUserId,
    });

    return { success: true };
  };

  const reassignFO = (foId: string, newTeamLeaderId: string) => {
    const newTeamLeader = users.find(u => u.id === newTeamLeaderId);
    if (!newTeamLeader) return;

    setUsers(prev => prev.map(user => {
      if (user.id === foId) {
        return {
          ...user,
          teamLeaderId: newTeamLeaderId,
          regionalManagerId: newTeamLeader.regionalManagerId,
        };
      }
      return user;
    }));

    logActivity('user', 'FO Reassigned', 
      `Reassigned Field Officer to ${newTeamLeader.name}'s team`,
      { foId, newTeamLeaderId }
    );
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        isSessionLoading,
        users,
        setUsers,
        imeis,
        setImeis,
        sales,
        setSales,
        products,
        setProducts,
        commissions,
        setCommissions,
        notifications,
        setNotifications,
        activityLogs,
        setActivityLogs,
        stockAllocations,
        setStockAllocations,
        userStockBalances,
        setUserStockBalances,
        login,
        logout,
        addNotification,
        logActivity,
        allocateStock,
        recallStock,
        getMyStock,
        getMyAllocatableStock,
        getAllocationHistory,
        getRecallableStock,
        reassignFO,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
