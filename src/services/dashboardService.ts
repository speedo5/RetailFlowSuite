/**
 * =============================================================================
 * DASHBOARD SERVICE
 * =============================================================================
 * 
 * Provides dashboard statistics and analytics.
 * 
 * API ENDPOINTS:
 * - GET /dashboard/stats        - Overall statistics
 * - GET /dashboard/sales-chart  - Sales chart data
 * - GET /dashboard/top-sellers  - Top performing sellers
 * - GET /dashboard/region-stats - Regional statistics
 * 
 * SAMPLE REQUEST/RESPONSE:
 * ------------------------
 * GET /dashboard/stats
 * Response: {
 *   success: true,
 *   data: {
 *     totalRevenue: 5000000,
 *     todayRevenue: 150000,
 *     totalSales: 250,
 *     todaySales: 15,
 *     totalPhones: 500,
 *     phonesInStock: 200,
 *     phonesSold: 250,
 *     pendingCommissions: 45000
 *   }
 * }
 * 
 * GET /dashboard/sales-chart?period=week
 * Response: {
 *   success: true,
 *   data: [
 *     { date: "2024-01-08", sales: 15, revenue: 525000 },
 *     { date: "2024-01-09", sales: 12, revenue: 420000 },
 *     ...
 *   ]
 * }
 * 
 * =============================================================================
 */

import { apiClient, type ApiResponse } from './apiClient';

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export interface DashboardStats {
  sales?: {
    today?: { count: number; revenue: number };
    month?: { count: number; revenue: number };
  };
  stock?: {
    total: number;
    allocated: number;
  };
  commissions?: {
    pending: number;
    pendingCount: number;
  };
  users?: Record<string, number>;
}

// Mapped dashboard stats for frontend display
export interface MappedDashboardStats {
  totalRevenue: number;
  todayRevenue: number;
  totalSales: number;
  todaySales: number;
  totalPhones: number;
  phonesInStock: number;
  phonesSold: number;
  allocatedPhones: number;
  pendingCommissions: number;
  totalCommissionsPaid: number;
}

export interface ChartDataPoint {
  date: string;
  sales: number;
  revenue: number;
}

export interface TopSeller {
  userId: string;
  userName: string;
  foCode?: string;
  region?: string;
  salesCount: number;
  totalRevenue: number;
  commission: number;
}

export interface RegionStats {
  region: string;
  salesCount: number;
  revenue: number;
  phonesInStock: number;
  activeFieldOfficers: number;
}

// -----------------------------------------------------------------------------
// SERVICE
// -----------------------------------------------------------------------------

export const dashboardService = {
  /**
   * Get overall dashboard statistics
   */
  getStats: async (): Promise<ApiResponse<DashboardStats>> => {
    return apiClient.get<DashboardStats>('/dashboard/stats');
  },

  /**
   * Get sales chart data
   */
  getSalesChart: async (period: 'day' | 'week' | 'month' | 'year' = 'week'): Promise<ApiResponse<ChartDataPoint[]>> => {
    return apiClient.get<ChartDataPoint[]>('/dashboard/sales-chart', { period });
  },

  /**
   * Get top sellers leaderboard
   */
  getTopSellers: async (limit: number = 10): Promise<ApiResponse<TopSeller[]>> => {
    return apiClient.get<TopSeller[]>('/dashboard/top-performers', { limit: limit.toString() });
  },

  /**
   * Get regional statistics
   */
  getRegionStats: async (): Promise<ApiResponse<RegionStats[]>> => {
    return apiClient.get<RegionStats[]>('/dashboard/regional-stats');
  },
};

export default dashboardService;
