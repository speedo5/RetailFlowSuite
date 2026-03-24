/**
 * =============================================================================
 * INVENTORY SERVICE (IMEI Management)
 * =============================================================================
 * 
 * Handles IMEI registration and inventory tracking.
 * 
 * API ENDPOINTS:
 * - GET    /imei              - List all IMEIs
 * - GET    /imei/:id          - Get IMEI by ID
 * - GET    /imei/search/:imei - Search by IMEI number
 * - POST   /imei              - Register new IMEI
 * - POST   /imei/bulk         - Bulk register IMEIs
 * - PUT    /imei/:id          - Update IMEI
 * - DELETE /imei/:id          - Delete IMEI
 * 
 * SAMPLE REQUEST/RESPONSE:
 * ------------------------
 * GET /imei?status=IN_STOCK&productId=prod-1
 * Response: { success: true, data: [...imeis], total: 100 }
 * 
 * POST /imei
 * Request: {
 *   imei: "356789012345678",
 *   imei2: "356789012345679",
 *   productId: "prod-1",
 *   source: "Safaricom",
 *   commissionConfig: { foCommission: 500, teamLeaderCommission: 200, regionalManagerCommission: 100 }
 * }
 * Response: { success: true, data: { id, imei, productId, status: "IN_STOCK", ... } }
 * 
 * =============================================================================
 */

import { apiClient, type ApiResponse } from './apiClient';
import type { IMEI } from '@/types';

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export type IMEIStatus = 'IN_STOCK' | 'ALLOCATED' | 'SOLD' | 'LOCKED' | 'LOST' | 'RETURNED';

export interface IMEIListParams {
  status?: IMEIStatus;
  productId?: string;
  currentHolderId?: string;
  source?: string;
  page?: number;
  limit?: number;
}

export interface RegisterIMEIRequest {
  imei: string;
  imei2?: string;
  productId: string;
  source?: string;
  notes?: string;
  commissionConfig?: {
    foCommission: number;
    teamLeaderCommission: number;
    regionalManagerCommission: number;
  };
}

export interface BulkRegisterIMEIRequest {
  imeis: Array<{
    imei: string;
    imei2?: string;
    productId: string;
    source?: string;
  }>;
}

export interface UpdateIMEIRequest {
  status?: IMEIStatus;
  notes?: string;
  commissionConfig?: {
    foCommission: number;
    teamLeaderCommission: number;
    regionalManagerCommission: number;
  };
}

export interface IMEIListResponse {
  imeis: IMEI[];
  total: number;
}

export interface BulkOperationResult {
  success: string[];
  failed: Array<{ imei: string; error: string }>;
}

// -----------------------------------------------------------------------------
// SERVICE
// -----------------------------------------------------------------------------

export const inventoryService = {
  /**
   * Get all IMEIs with optional filters
   */
  getAll: async (params?: IMEIListParams): Promise<ApiResponse<IMEIListResponse>> => {
    const queryParams: Record<string, string> = {};
    
    if (params?.status) queryParams.status = params.status;
    if (params?.productId) queryParams.productId = params.productId;
    if (params?.currentHolderId) queryParams.currentHolderId = params.currentHolderId;
    if (params?.page) queryParams.page = params.page.toString();
    if (params?.limit) queryParams.limit = params.limit.toString();
    
    return apiClient.get<IMEIListResponse>('/imei', queryParams);
  },

  /**
   * Get a single IMEI by ID
   */
  getById: async (id: string): Promise<ApiResponse<IMEI>> => {
    return apiClient.get<IMEI>(`/imei/${id}`);
  },

  /**
   * Search for an IMEI by IMEI number
   */
  searchByImei: async (imei: string): Promise<ApiResponse<IMEI>> => {
    return apiClient.get<IMEI>(`/imei/search/${imei}`);
  },

  /**
   * Register a new IMEI
   */
  register: async (imeiData: RegisterIMEIRequest): Promise<ApiResponse<IMEI>> => {
    return apiClient.post<IMEI>('/imei', imeiData);
  },

  /**
   * Bulk register multiple IMEIs
   */
  bulkRegister: async (data: BulkRegisterIMEIRequest): Promise<ApiResponse<BulkOperationResult>> => {
    return apiClient.post<BulkOperationResult>('/imei/bulk', data);
  },

  /**
   * Update an existing IMEI
   */
  update: async (id: string, imeiData: UpdateIMEIRequest): Promise<ApiResponse<IMEI>> => {
    return apiClient.put<IMEI>(`/imei/${id}`, imeiData);
  },

  /**
   * Delete an IMEI
   */
  delete: async (id: string): Promise<ApiResponse<void>> => {
    return apiClient.delete<void>(`/imei/${id}`);
  },

  /**
   * Get inventory summary by status
   */
  getSummary: async (): Promise<ApiResponse<Record<IMEIStatus, number>>> => {
    return apiClient.get<Record<IMEIStatus, number>>('/imei/summary');
  },
};

export default inventoryService;
