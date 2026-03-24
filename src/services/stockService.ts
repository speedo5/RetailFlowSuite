/**
 * =============================================================================
 * STOCK ALLOCATION SERVICE
 * =============================================================================
 * 
 * Handles stock allocation workflow through the hierarchy:
 * Admin -> Regional Manager -> Team Leader -> Field Officer
 * 
 * API ENDPOINTS:
 * - GET  /stock-allocations                 - List all allocations
 * - GET  /stock-allocations/allocatable-users - Get users you can allocate to
 * - GET  /stock-allocations/available-stock   - Get stock available for allocation
 * - GET  /stock-allocations/recallable-stock  - Get stock you can recall
 * - GET  /stock-allocations/subordinates      - Get subordinates with stock counts
 * - GET  /stock-allocations/workflow-stats    - Get pipeline statistics
 * - GET  /stock-allocations/journey/:imeiId   - Get IMEI journey/history
 * - POST /stock-allocations                   - Allocate stock
 * - POST /stock-allocations/bulk              - Bulk allocate
 * - POST /stock-allocations/recall            - Recall stock
 * - POST /stock-allocations/bulk-recall       - Bulk recall
 * 
 * SAMPLE REQUEST/RESPONSE:
 * ------------------------
 * POST /stock-allocations
 * Request: { imeiId: "imei-1", toUserId: "user-5", notes: "Initial allocation" }
 * Response: { success: true, data: { id, fromUser, toUser, imei, status: "completed", ... } }
 * 
 * GET /stock-allocations/workflow-stats
 * Response: {
 *   success: true,
 *   data: {
 *     pipeline: { inStock: 50, atRegionalManagers: 20, atTeamLeaders: 30, atFieldOfficers: 100, sold: 200 },
 *     userCounts: { regionalManagers: 5, teamLeaders: 15, fieldOfficers: 50 },
 *     recentActivity: { allocations: [...], recalls: [...] }
 *   }
 * }
 * 
 * =============================================================================
 */

import { apiClient, type ApiResponse } from './apiClient';
import type { StockAllocation, IMEI, User } from '@/types';

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export interface AllocationListParams {
  fromUserId?: string;
  toUserId?: string;
  status?: 'pending' | 'completed' | 'recalled';
  type?: 'allocation' | 'recall';
  page?: number;
  limit?: number;
}

export interface AllocateRequest {
  imeiId: string;
  toUserId: string;
  notes?: string;
}

export interface BulkAllocateRequest {
  imeiIds: string[];
  toUserId: string;
  notes?: string;
}

export interface RecallRequest {
  imeiId: string;
  reason?: string;
}

export interface BulkRecallRequest {
  imeiIds: string[];
  reason?: string;
}

export interface WorkflowStats {
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
    allocations: StockAllocation[];
    recalls: StockAllocation[];
  };
}

export interface StockJourney {
  imei: IMEI;
  timeline: Array<{
    event: string;
    date: Date;
    user?: string;
    details?: string;
  }>;
  history: StockAllocation[];
}

export interface SubordinateWithStock {
  user: User;
  stockCount: number;
  recentAllocations: number;
  sellThroughRate: number;
}

export interface BulkOperationResult {
  success: string[];
  failed: Array<{ id: string; error: string }>;
}

// -----------------------------------------------------------------------------
// SERVICE
// -----------------------------------------------------------------------------

export const stockService = {
  /**
   * Get all stock allocations
   */
  getAllocations: async (params?: AllocationListParams): Promise<ApiResponse<StockAllocation[]>> => {
    const queryParams: Record<string, string> = {};
    
    if (params?.fromUserId) queryParams.fromUserId = params.fromUserId;
    if (params?.toUserId) queryParams.toUserId = params.toUserId;
    if (params?.status) queryParams.status = params.status;
    if (params?.type) queryParams.type = params.type;
    if (params?.page) queryParams.page = params.page.toString();
    if (params?.limit) queryParams.limit = params.limit.toString();
    
    return apiClient.get<StockAllocation[]>('/stock-allocations', queryParams);
  },

  /**
   * Get users that the current user can allocate stock to
   */
  getAllocatableUsers: async (): Promise<ApiResponse<User[]>> => {
    return apiClient.get<User[]>('/stock-allocations/allocatable-users');
  },

  /**
   * Get stock available for allocation (owned by current user)
   */
  getAvailableStock: async (): Promise<ApiResponse<IMEI[]>> => {
    return apiClient.get<IMEI[]>('/stock-allocations/available-stock');
  },

  /**
   * Get stock that can be recalled from subordinates
   */
  getRecallableStock: async (): Promise<ApiResponse<SubordinateWithStock[]>> => {
    return apiClient.get<SubordinateWithStock[]>('/stock-allocations/recallable-stock');
  },

  /**
   * Get subordinates with their stock counts
   */
  getSubordinatesWithStock: async (): Promise<ApiResponse<SubordinateWithStock[]>> => {
    return apiClient.get<SubordinateWithStock[]>('/stock-allocations/subordinates');
  },

  /**
   * Get workflow/pipeline statistics
   */
  getWorkflowStats: async (): Promise<ApiResponse<WorkflowStats>> => {
    return apiClient.get<WorkflowStats>('/stock-allocations/workflow-stats');
  },

  /**
   * Get complete journey/history for an IMEI
   */
  getStockJourney: async (imeiId: string): Promise<ApiResponse<StockJourney>> => {
    return apiClient.get<StockJourney>(`/stock-allocations/journey/${imeiId}`);
  },

  /**
   * Allocate a single IMEI to a user
   */
  allocate: async (data: AllocateRequest): Promise<ApiResponse<StockAllocation>> => {
    return apiClient.post<StockAllocation>('/stock-allocations', data);
  },

  /**
   * Bulk allocate multiple IMEIs to a user
   */
  bulkAllocate: async (data: BulkAllocateRequest): Promise<ApiResponse<BulkOperationResult>> => {
    return apiClient.post<BulkOperationResult>('/stock-allocations/bulk', data);
  },

  /**
   * Recall a single IMEI from a subordinate
   */
  recall: async (data: RecallRequest): Promise<ApiResponse<StockAllocation>> => {
    return apiClient.post<StockAllocation>('/stock-allocations/recall', data);
  },

  /**
   * Bulk recall multiple IMEIs
   */
  bulkRecall: async (data: BulkRecallRequest): Promise<ApiResponse<BulkOperationResult>> => {
    return apiClient.post<BulkOperationResult>('/stock-allocations/bulk-recall', data);
  },
};

export default stockService;
