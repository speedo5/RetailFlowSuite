/**
 * =============================================================================
 * REPORT SERVICE
 * =============================================================================
 * 
 * Handles report generation and exports.
 * 
 * API ENDPOINTS:
 * - GET /reports/sales          - Sales report
 * - GET /reports/commissions    - Commissions report
 * - GET /reports/inventory      - Inventory report
 * - GET /reports/reconciliation - Reconciliation report
 * - GET /reports/sales/export   - Export sales to Excel/CSV
 * 
 * SAMPLE REQUEST/RESPONSE:
 * ------------------------
 * GET /reports/sales?startDate=2024-01-01&endDate=2024-01-31&groupBy=day
 * Response: {
 *   success: true,
 *   data: {
 *     summary: { totalSales: 150, totalRevenue: 5250000, avgSaleValue: 35000 },
 *     breakdown: [
 *       { date: "2024-01-01", sales: 5, revenue: 175000 },
 *       { date: "2024-01-02", sales: 8, revenue: 280000 },
 *       ...
 *     ],
 *     byProduct: [...],
 *     byRegion: [...],
 *     bySeller: [...]
 *   }
 * }
 * 
 * =============================================================================
 */

import { apiClient, type ApiResponse } from './apiClient';

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export interface DateRangeParams {
  startDate: string;
  endDate: string;
}

export interface SalesReportParams extends DateRangeParams {
  groupBy?: 'day' | 'week' | 'month';
  region?: string;
  userId?: string;
}

export interface SalesReport {
  report?: Array<{
    _id: string;
    salesCount: number;
    totalRevenue: number;
    avgSale: number;
  }>;
  summary?: {
    totalSales: number;
    totalRevenue: number;
    avgSale: number;
    minSale: number;
    maxSale: number;
  };
  breakdown?: Array<{
    date: string;
    sales: number;
    revenue: number;
  }>;
  byProduct?: Array<{
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
  }>;
  byRegion?: Array<{
    region: string;
    sales: number;
    revenue: number;
  }>;
  bySeller?: Array<{
    userId: string;
    userName: string;
    foCode?: string;
    sales: number;
    revenue: number;
    commission: number;
  }>;
}

export interface CommissionsReport {
  byStatus?: Array<{
    _id: string;
    count: number;
    total: number;
  }>;
  byRole?: Array<{
    _id: string;
    count: number;
    total: number;
  }>;
  topEarners?: Array<{
    userId: string;
    name: string;
    role: string;
    count: number;
    total: number;
  }>;
  summary?: {
    totalPending: number;
    totalApproved: number;
    totalPaid: number;
    totalRejected: number;
  };
  byUser?: Array<{
    userId: string;
    userName: string;
    role: string;
    pending: number;
    approved: number;
    paid: number;
  }>;
}

export interface InventoryReport {
  summary: {
    totalDevices: number;
    inStock: number;
    allocated: number;
    sold: number;
    locked: number;
  };
  byProduct: Array<{
    productId: string;
    productName: string;
    category: string;
    inStock: number;
    allocated: number;
    sold: number;
  }>;
  byHolder: Array<{
    userId: string;
    userName: string;
    role: string;
    quantity: number;
  }>;
  lowStock: Array<{
    productId: string;
    productName: string;
    available: number;
    threshold: number;
  }>;
}

export interface ReconciliationReport {
  summary: {
    expectedRevenue: number;
    actualRevenue: number;
    variance: number;
    variancePercentage: number;
  };
  discrepancies: Array<{
    type: string;
    description: string;
    amount: number;
    date: string;
  }>;
  stockMovement: Array<{
    date: string;
    allocated: number;
    sold: number;
    recalled: number;
  }>;
}

// -----------------------------------------------------------------------------
// SERVICE
// -----------------------------------------------------------------------------

export const reportService = {
  /**
   * Get sales report
   */
  getSalesReport: async (params: SalesReportParams): Promise<ApiResponse<SalesReport>> => {
    const queryParams: Record<string, string> = {
      startDate: params.startDate,
      endDate: params.endDate,
    };
    if (params.groupBy) queryParams.groupBy = params.groupBy;
    if (params.region) queryParams.region = params.region;
    if (params.userId) queryParams.userId = params.userId;
    
    return apiClient.get<SalesReport>('/reports/sales', queryParams);
  },

  /**
   * Get commissions report
   */
  getCommissionsReport: async (params: DateRangeParams): Promise<ApiResponse<CommissionsReport>> => {
    return apiClient.get<CommissionsReport>('/reports/commissions', {
      startDate: params.startDate,
      endDate: params.endDate,
    });
  },

  /**
   * Get inventory report
   */
  getInventoryReport: async (): Promise<ApiResponse<InventoryReport>> => {
    return apiClient.get<InventoryReport>('/reports/inventory');
  },

  /**
   * Get allocation report
   */
  getAllocationReport: async (params: DateRangeParams): Promise<ApiResponse<any>> => {
    return apiClient.get<any>('/reports/allocations', {
      startDate: params.startDate,
      endDate: params.endDate,
    });
  },

  /**
   * Get performance report
   */
  getPerformanceReport: async (params: DateRangeParams): Promise<ApiResponse<any>> => {
    return apiClient.get<any>('/reports/performance', {
      startDate: params.startDate,
      endDate: params.endDate,
    });
  },

  /**
   * Get top selling products
   */
  getTopProducts: async (params: DateRangeParams & { limit?: number }): Promise<ApiResponse<any>> => {
    return apiClient.get<any>('/reports/top-products', {
      startDate: params.startDate,
      endDate: params.endDate,
      limit: params.limit?.toString() || '5',
    });
  },

  /**
   * Get active field officers
   */
  getActiveFOs: async (params: DateRangeParams): Promise<ApiResponse<any>> => {
    return apiClient.get<any>('/reports/active-fos', {
      startDate: params.startDate,
      endDate: params.endDate,
    });
  },

  /**
   * Get company performance (Watu/Mogo/Onfon)
   */
  getCompanyPerformance: async (params: DateRangeParams): Promise<ApiResponse<any>> => {
    return apiClient.get<any>('/reports/company-performance', {
      startDate: params.startDate,
      endDate: params.endDate,
    });
  },

  /**
   * Get comprehensive report with all metrics for all regions
   */
  getComprehensiveReport: async (params: DateRangeParams & { regions?: string[] }): Promise<ApiResponse<any>> => {
    const queryParams: Record<string, string> = {
      startDate: params.startDate,
      endDate: params.endDate,
    };
    if (params.regions && params.regions.length > 0) {
      queryParams.regions = params.regions.join(',');
    }
    return apiClient.get<any>('/reports/comprehensive', queryParams);
  },

  /**
   * Export sales report to Excel
   */
  exportSalesReport: async (params: SalesReportParams & { format?: 'excel' | 'csv' }): Promise<void> => {
    const queryString = new URLSearchParams({
      startDate: params.startDate,
      endDate: params.endDate,
      format: params.format || 'excel',
    }).toString();
    
    const filename = `sales-report-${params.startDate}-${params.endDate}.${params.format === 'csv' ? 'csv' : 'xlsx'}`;
    await apiClient.downloadFile(`/reports/sales/export?${queryString}`, filename);
  },

  /**
   * Export commissions report to Excel
   */
  exportCommissionsReport: async (params: DateRangeParams & { format?: 'excel' | 'csv' }): Promise<void> => {
    const queryString = new URLSearchParams({
      startDate: params.startDate,
      endDate: params.endDate,
      format: params.format || 'excel',
    }).toString();
    
    const filename = `commissions-report-${params.startDate}-${params.endDate}.${params.format === 'csv' ? 'csv' : 'xlsx'}`;
    await apiClient.downloadFile(`/reports/commissions/export?${queryString}`, filename);
  },

  /**
   * Export inventory report to Excel
   */
  exportInventoryReport: async (format: 'excel' | 'csv' = 'excel'): Promise<void> => {
    const filename = `inventory-report-${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`;
    await apiClient.downloadFile(`/reports/inventory/export?format=${format}`, filename);
  },

  // Performance Report Methods
  /**
   * Get performance overview
   */
  getPerformanceOverview: async (params: DateRangeParams): Promise<ApiResponse<any>> => {
    return apiClient.get<any>('/performance/overview', {
      startDate: params.startDate,
      endDate: params.endDate,
    });
  },

  /**
   * Get performance metrics by region
   */
  getPerformanceByRegion: async (params: DateRangeParams): Promise<ApiResponse<any>> => {
    return apiClient.get<any>('/performance/by-region', {
      startDate: params.startDate,
      endDate: params.endDate,
    });
  },

  /**
   * Get performance metrics by product
   */
  getPerformanceByProduct: async (params: DateRangeParams & { limit?: number }): Promise<ApiResponse<any>> => {
    return apiClient.get<any>('/performance/by-product', {
      startDate: params.startDate,
      endDate: params.endDate,
      limit: params.limit?.toString() || '10',
    });
  },

  /**
   * Get field officer performance
   */
  getPerformanceByFO: async (params: DateRangeParams & { limit?: number }): Promise<ApiResponse<any>> => {
    return apiClient.get<any>('/performance/by-fo', {
      startDate: params.startDate,
      endDate: params.endDate,
      limit: params.limit?.toString() || '20',
    });
  },

  /**
   * Get payment method breakdown
   */
  getPaymentMethodBreakdown: async (params: DateRangeParams): Promise<ApiResponse<any>> => {
    return apiClient.get<any>('/performance/payment-methods', {
      startDate: params.startDate,
      endDate: params.endDate,
    });
  },

  /**
   * Get comprehensive performance report
   */
  getComprehensiveReport: async (params: DateRangeParams): Promise<ApiResponse<any>> => {
    return apiClient.get<any>('/performance/comprehensive', {
      startDate: params.startDate,
      endDate: params.endDate,
    });
  },
};

export default reportService;
