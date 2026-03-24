/**
 * =============================================================================
 * STOCK ALLOCATION SERVICE
 * =============================================================================
 * 
 * Handles stock allocation workflow through the hierarchy:
 * Admin -> Regional Manager -> Team Leader -> Field Officer
 * 
 * API ENDPOINTS:
 * - GET  /api/stock-allocations                 - List all allocations
 * - GET  /api/stock-allocations/available-stock - Get stock available for allocation
 * - GET  /api/stock-allocations/recallable-stock - Get stock you can recall
 * - GET  /api/stock-allocations/subordinates    - Get subordinates with stock counts
 * - POST /api/stock-allocations                 - Allocate stock
 * - POST /api/stock-allocations/bulk            - Bulk allocate
 * - POST /api/stock-allocations/recall          - Recall stock
 * - POST /api/stock-allocations/bulk-recall     - Bulk recall
 * 
 * =============================================================================
 */

import { apiClient, type ApiResponse } from './apiClient';
import type { StockAllocation, IMEI } from '@/types';

// ============================================================
// TYPES
// ============================================================

export interface AllocationRequest {
  imeiId: string;
  toUserId: string;
  notes?: string;
}

export interface BulkAllocationRequest {
  imeiIds: string[];
  toUserId: string;
  notes?: string;
}

export interface RecallRequest {
  imeiId: string;
  fromUserId: string;
  reason?: string;
}

export interface BulkRecallRequest {
  imeiIds: string[];
  fromUserIds: string[];
  reason?: string;
}

export interface AllocationListParams {
  fromUserId?: string;
  toUserId?: string;
  status?: string;
  type?: string;
  page?: number;
  limit?: number;
}

// ============================================================
// API FUNCTIONS
// ============================================================

/**
 * Get all allocations with optional filters
 */
export const getAllocations = async (params?: AllocationListParams): Promise<ApiResponse<StockAllocation[]>> => {
  try {
    const queryParams = params ? (Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined).map(([k, v]) => [k, String(v)])
    ) as Record<string, string>) : undefined;
    const response = await apiClient.get<StockAllocation[]>('/stock-allocations', queryParams);
    return response as ApiResponse<StockAllocation[]>;
  } catch (error) {
    throw error;
  }
};

/**
 * Get stock available for allocation by current user
 */
export const getAvailableStock = async (): Promise<ApiResponse<IMEI[]>> => {
  try {
    const response = await apiClient.get<IMEI[]>('/stock-allocations/available-stock');
    return response as ApiResponse<IMEI[]>;
  } catch (error) {
    throw error;
  }
};

/**
 * Get stock that can be recalled from subordinates
 */
export const getRecallableStock = async (): Promise<ApiResponse<any[]>> => {
  try {
    const response = await apiClient.get<any[]>('/stock-allocations/recallable-stock');
    return response as ApiResponse<any[]>;
  } catch (error) {
    throw error;
  }
};

/**
 * Get subordinates with their stock counts
 */
export const getSubordinatesWithStock = async (): Promise<ApiResponse<any[]>> => {
  try {
    const response = await apiClient.get<any[]>('/stock-allocations/subordinates');
    return response as ApiResponse<any[]>;
  } catch (error) {
    throw error;
  }
};

/**
 * Get workflow statistics
 */
export const getWorkflowStats = async (): Promise<ApiResponse<any>> => {
  try {
    const response = await apiClient.get<any>('/stock-allocations/workflow-stats');
    return response as ApiResponse<any>;
  } catch (error) {
    throw error;
  }
};

/**
 * Get stock journey for a specific IMEI
 */
export const getStockJourney = async (imeiId: string): Promise<ApiResponse<any>> => {
  try {
    const response = await apiClient.get<any>(`/stock-allocations/journey/${imeiId}`);
    return response as ApiResponse<any>;
  } catch (error) {
    throw error;
  }
};

/**
 * Allocate stock to a user
 */
export const allocateStock = async (request: AllocationRequest): Promise<ApiResponse<StockAllocation>> => {
  try {
    const response = await apiClient.post<StockAllocation>('/stock-allocations', request);
    return response as ApiResponse<StockAllocation>;
  } catch (error) {
    throw error;
  }
};

/**
 * Bulk allocate stock to a user
 */
export const bulkAllocateStock = async (request: BulkAllocationRequest): Promise<ApiResponse<any>> => {
  try {
    const response = await apiClient.post<any>('/stock-allocations/bulk', request);
    return response as ApiResponse<any>;
  } catch (error) {
    throw error;
  }
};

/**
 * Recall stock from a user
 */
export const recallStock = async (request: RecallRequest): Promise<ApiResponse<StockAllocation>> => {
  try {
    const response = await apiClient.post<StockAllocation>('/stock-allocations/recall', request);
    return response as ApiResponse<StockAllocation>;
  } catch (error) {
    throw error;
  }
};

/**
 * Bulk recall stock from users
 */
export const bulkRecallStock = async (request: BulkRecallRequest): Promise<ApiResponse<any>> => {
  try {
    const response = await apiClient.post<any>('/stock-allocations/bulk-recall', request);
    return response as ApiResponse<any>;
  } catch (error) {
    throw error;
  }
};

export default {
  getAllocations,
  getAvailableStock,
  getRecallableStock,
  getSubordinatesWithStock,
  getWorkflowStats,
  getStockJourney,
  allocateStock,
  bulkAllocateStock,
  recallStock,
  bulkRecallStock,
};
