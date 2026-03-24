/**
 * API Service for Finetech POS
 * 
 * This file provides a centralized API client for connecting to the backend.
 * Configure the API_BASE_URL to point to your backend server.
 * 
 * For local development: http://localhost:5000/api
 * For production: Update to your production API URL
 */

// Configuration - Update this for your environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Token management
let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
};

export const getAuthToken = (): string | null => {
  if (!authToken) {
    authToken = localStorage.getItem('auth_token');
  }
  return authToken;
};

// Base fetch wrapper with auth
const apiFetch = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'API request failed');
  }

  return data;
};

// ============================================
// AUTH API
// ============================================
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await apiFetch<{ success: boolean; token: string; data: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    // Server returns token inside `data.token` while older clients expected `token` at top-level.
    const token = (response as any).token || (response as any).data?.token;
    if (token) setAuthToken(token);
    return response;
  },

  register: async (userData: {
    name: string;
    email: string;
    password: string;
    role: string;
    region: string;
    phone?: string;
  }) => {
    return apiFetch<{ success: boolean; token: string; data: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  getMe: async () => {
    return apiFetch<{ success: boolean; data: any }>('/auth/me');
  },

  logout: () => {
    setAuthToken(null);
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    return apiFetch<{ success: boolean }>('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
};

// ============================================
// USERS API
// ============================================
export const usersApi = {
  getAll: async (params?: { role?: string; region?: string; page?: number; limit?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.role) queryParams.append('role', params.role);
    if (params?.region) queryParams.append('region', params.region);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    return apiFetch<{ success: boolean; data: any[]; total: number }>(`/users?${queryParams}`);
  },

  getById: async (id: string) => {
    return apiFetch<{ success: boolean; data: any }>(`/users/${id}`);
  },

  create: async (userData: {
    name: string;
    email: string;
    password: string;
    role: string;
    region: string;
    phone?: string;
    teamLeaderId?: string;
    regionalManagerId?: string;
  }) => {
    return apiFetch<{ success: boolean; data: any }>('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  update: async (id: string, userData: Partial<{
    name: string;
    email: string;
    role: string;
    region: string;
    phone: string;
    isActive: boolean;
  }>) => {
    return apiFetch<{ success: boolean; data: any }>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  delete: async (id: string) => {
    return apiFetch<{ success: boolean }>(`/users/${id}`, {
      method: 'DELETE',
    });
  },

  assignTeamLeader: async (foId: string, teamLeaderId: string) => {
    return apiFetch<{ success: boolean; data: any }>(`/users/${foId}/assign-team-leader`, {
      method: 'PUT',
      body: JSON.stringify({ teamLeaderId }),
    });
  },

  getFieldOfficers: async () => {
    return apiFetch<{ success: boolean; data: any[] }>('/users/field-officers');
  },

  getTeamLeaders: async () => {
    return apiFetch<{ success: boolean; data: any[] }>('/users/team-leaders');
  },
};

// ============================================
// PRODUCTS API
// ============================================
export const productsApi = {
  getAll: async (params?: { category?: string; page?: number; limit?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.category) queryParams.append('category', params.category);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    return apiFetch<{ success: boolean; data: any[]; total: number }>(`/products?${queryParams}`);
  },

  getById: async (id: string) => {
    return apiFetch<{ success: boolean; data: any }>(`/products/${id}`);
  },

  create: async (productData: {
    name: string;
    category: string;
    price: number;
    brand?: string;
    commissionConfig?: {
      foCommission: number;
      teamLeaderCommission: number;
      regionalManagerCommission: number;
    };
  }) => {
    return apiFetch<{ success: boolean; data: any }>('/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    });
  },

  update: async (id: string, productData: Partial<{
    name: string;
    category: string;
    price: number;
    brand: string;
    commissionConfig: {
      foCommission: number;
      teamLeaderCommission: number;
      regionalManagerCommission: number;
    };
  }>) => {
    return apiFetch<{ success: boolean; data: any }>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    });
  },

  delete: async (id: string) => {
    return apiFetch<{ success: boolean }>(`/products/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============================================
// IMEI/INVENTORY API
// ============================================
export const imeiApi = {
  getAll: async (params?: { 
    status?: string; 
    productId?: string; 
    currentHolderId?: string;
    page?: number; 
    limit?: number 
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.productId) queryParams.append('productId', params.productId);
    if (params?.currentHolderId) queryParams.append('currentHolderId', params.currentHolderId);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    return apiFetch<{ success: boolean; data: any[]; total: number }>(`/imei?${queryParams}`);
  },

  getById: async (id: string) => {
    return apiFetch<{ success: boolean; data: any }>(`/imei/${id}`);
  },

  getByImei: async (imei: string) => {
    return apiFetch<{ success: boolean; data: any }>(`/imei/search/${imei}`);
  },

  register: async (imeiData: {
    imei: string;
    imei2?: string;
    productId: string;
    source?: string;
    commissionConfig?: {
      foCommission: number;
      teamLeaderCommission: number;
      regionalManagerCommission: number;
    };
    notes?: string;
  }) => {
    return apiFetch<{ success: boolean; data: any }>('/imei', {
      method: 'POST',
      body: JSON.stringify(imeiData),
    });
  },

  bulkRegister: async (imeis: Array<{
    imei: string;
    imei2?: string;
    productId: string;
    source?: string;
  }>) => {
    return apiFetch<{ success: boolean; data: { success: string[]; failed: any[] } }>('/imei/bulk', {
      method: 'POST',
      body: JSON.stringify({ imeis }),
    });
  },

  update: async (id: string, imeiData: Partial<{
    status: string;
    notes: string;
    commissionConfig: {
      foCommission: number;
      teamLeaderCommission: number;
      regionalManagerCommission: number;
    };
  }>) => {
    return apiFetch<{ success: boolean; data: any }>(`/imei/${id}`, {
      method: 'PUT',
      body: JSON.stringify(imeiData),
    });
  },

  delete: async (id: string) => {
    return apiFetch<{ success: boolean }>(`/imei/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============================================
// STOCK ALLOCATION API
// ============================================
export const stockAllocationApi = {
  getAll: async (params?: { 
    fromUserId?: string; 
    toUserId?: string; 
    status?: string;
    type?: string;
    page?: number; 
    limit?: number 
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.fromUserId) queryParams.append('fromUserId', params.fromUserId);
    if (params?.toUserId) queryParams.append('toUserId', params.toUserId);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.type) queryParams.append('type', params.type);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    return apiFetch<{ success: boolean; data: any[]; total: number }>(`/stock-allocations?${queryParams}`);
  },

  getAllocatableUsers: async () => {
    return apiFetch<{ success: boolean; data: any[] }>('/stock-allocations/allocatable-users');
  },

  getAvailableStock: async () => {
    return apiFetch<{ success: boolean; data: any[] }>('/stock-allocations/available-stock');
  },

  getRecallableStock: async () => {
    return apiFetch<{ success: boolean; data: any[] }>('/stock-allocations/recallable-stock');
  },

  getSubordinatesWithStock: async () => {
    return apiFetch<{ success: boolean; data: any[] }>('/stock-allocations/subordinates');
  },

  getWorkflowStats: async () => {
    return apiFetch<{ 
      success: boolean; 
      data: {
        pipeline: {
          inStock: number;
          atRegionalManagers: number;
          atTeamLeaders: number;
          atFieldOfficers: number;
          sold: number;
          total: number;
        };
        userCounts: {
          regionalManagers: number;
          teamLeaders: number;
          fieldOfficers: number;
        };
        recentActivity: {
          allocations: any[];
          recalls: any[];
        };
      }
    }>('/stock-allocations/workflow-stats');
  },

  getStockJourney: async (imeiId: string) => {
    return apiFetch<{ 
      success: boolean; 
      data: {
        imei: any;
        timeline: any[];
        history: any[];
      }
    }>(`/stock-allocations/journey/${imeiId}`);
  },

  allocate: async (imeiId: string, toUserId: string, notes?: string) => {
    return apiFetch<{ success: boolean; data: any }>('/stock-allocations', {
      method: 'POST',
      body: JSON.stringify({ imeiId, toUserId, notes }),
    });
  },

  bulkAllocate: async (imeiIds: string[], toUserId: string, notes?: string) => {
    return apiFetch<{ success: boolean; data: { success: string[]; failed: any[] } }>('/stock-allocations/bulk', {
      method: 'POST',
      body: JSON.stringify({ imeiIds, toUserId, notes }),
    });
  },

  recall: async (imeiId: string, reason?: string) => {
    return apiFetch<{ success: boolean; data: any }>('/stock-allocations/recall', {
      method: 'POST',
      body: JSON.stringify({ imeiId, reason }),
    });
  },

  bulkRecall: async (imeiIds: string[], reason?: string) => {
    return apiFetch<{ success: boolean; data: { success: string[]; failed: any[] } }>('/stock-allocations/bulk-recall', {
      method: 'POST',
      body: JSON.stringify({ imeiIds, reason }),
    });
  },
};

// ============================================
// SALES API
// ============================================
export const salesApi = {
  getAll: async (params?: { 
    foId?: string; 
    startDate?: string; 
    endDate?: string;
    page?: number; 
    limit?: number 
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.foId) queryParams.append('foId', params.foId);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    return apiFetch<{ success: boolean; data: any[]; total: number }>(`/sales?${queryParams}`);
  },

  getById: async (id: string) => {
    return apiFetch<{ success: boolean; data: any }>(`/sales/${id}`);
  },

  create: async (saleData: {
    imeiId: string;
    paymentMethod: string;
    paymentReference?: string;
    clientName?: string;
    clientPhone?: string;
    clientIdNumber?: string;
  }) => {
    return apiFetch<{ success: boolean; data: any }>('/sales', {
      method: 'POST',
      body: JSON.stringify(saleData),
    });
  },

  getReceipt: async (id: string) => {
    return apiFetch<{ success: boolean; data: any }>(`/sales/${id}/receipt`);
  },
};

// ============================================
// COMMISSIONS API
// ============================================
export const commissionsApi = {
  getAll: async (params?: { 
    userId?: string; 
    status?: string; 
    startDate?: string; 
    endDate?: string;
    page?: number; 
    limit?: number 
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.userId) queryParams.append('userId', params.userId);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    return apiFetch<{ success: boolean; data: any[]; total: number }>(`/commissions?${queryParams}`);
  },

  getMyCommissions: async () => {
    return apiFetch<{ success: boolean; data: any[] }>('/commissions/my');
  },

  approve: async (id: string) => {
    return apiFetch<{ success: boolean; data: any }>(`/commissions/${id}/approve`, {
      method: 'PUT',
    });
  },

  markPaid: async (id: string) => {
    return apiFetch<{ success: boolean; data: any }>(`/commissions/${id}/pay`, {
      method: 'PUT',
    });
  },

  reject: async (id: string, reason: string) => {
    return apiFetch<{ success: boolean; data: any }>(`/commissions/${id}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  },

  bulkApprove: async (ids: string[]) => {
    return apiFetch<{ success: boolean; data: any }>('/commissions/bulk-approve', {
      method: 'PUT',
      body: JSON.stringify({ ids }),
    });
  },

  bulkPay: async (ids: string[]) => {
    return apiFetch<{ success: boolean; data: any }>('/commissions/bulk-pay', {
      method: 'PUT',
      body: JSON.stringify({ ids }),
    });
  },
};

// ============================================
// DASHBOARD API
// ============================================
export const dashboardApi = {
  getStats: async () => {
    return apiFetch<{ 
      success: boolean; 
      data: {
        totalRevenue: number;
        todayRevenue: number;
        totalSales: number;
        todaySales: number;
        totalPhones: number;
        phonesInStock: number;
        phonesSold: number;
        pendingCommissions: number;
      }
    }>('/dashboard/stats');
  },

  getSalesChart: async (period: 'week' | 'month' | 'year' = 'week') => {
    return apiFetch<{ success: boolean; data: any[] }>(`/dashboard/sales-chart?period=${period}`);
  },

  getTopSellers: async (limit: number = 10) => {
    return apiFetch<{ success: boolean; data: any[] }>(`/dashboard/top-performers?limit=${limit}`);
  },

  getRegionStats: async () => {
    return apiFetch<{ success: boolean; data: any[] }>('/dashboard/regional-stats');
  },
};

// ============================================
// REPORTS API
// ============================================
export const reportsApi = {
  getSalesReport: async (startDate: string, endDate: string, groupBy: 'day' | 'week' | 'month' = 'day') => {
    return apiFetch<{ success: boolean; data: any }>(`/reports/sales?startDate=${startDate}&endDate=${endDate}&groupBy=${groupBy}`);
  },

  getCommissionsReport: async (startDate: string, endDate: string) => {
    return apiFetch<{ success: boolean; data: any }>(`/reports/commissions?startDate=${startDate}&endDate=${endDate}`);
  },

  getInventoryReport: async () => {
    return apiFetch<{ success: boolean; data: any }>('/reports/inventory');
  },

  getReconciliationReport: async (startDate: string, endDate: string) => {
    return apiFetch<{ success: boolean; data: any }>(`/reports/reconciliation?startDate=${startDate}&endDate=${endDate}`);
  },

  exportSalesReport: async (startDate: string, endDate: string, format: 'csv' | 'excel' = 'excel') => {
    const response = await fetch(`${API_BASE_URL}/reports/sales/export?startDate=${startDate}&endDate=${endDate}&format=${format}`, {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    });
    return response.blob();
  },
};

export default {
  auth: authApi,
  users: usersApi,
  products: productsApi,
  imei: imeiApi,
  stockAllocation: stockAllocationApi,
  sales: salesApi,
  commissions: commissionsApi,
  dashboard: dashboardApi,
  reports: reportsApi,
};