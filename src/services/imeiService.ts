/**
 * =============================================================================
 * IMEI SERVICE
 * =============================================================================
 * 
 * Handles IMEI registration and inventory management.
 * 
 * API ENDPOINTS:
 * - GET    /imei           - List all IMEIs
 * - GET    /imei/:id       - Get single IMEI
 * - POST   /imei           - Register new IMEI (Admin only)
 * - POST   /imei/bulk      - Bulk register IMEIs (Admin only)
 * - PUT    /imei/:id       - Update IMEI (Admin only)
 * - GET    /imei/my-stock  - Get current user's stock
 * - GET    /imei/search/:imeiNumber - Search by IMEI number
 * 
 * SAMPLE REQUEST/RESPONSE:
 * ------------------------
 * POST /imei
 * Request: {
 *   imei: "123456789012345",
 *   productId: "prod123",
 *   commissionConfig: { foCommission: 500, teamLeaderCommission: 200, regionalManagerCommission: 100 }
 * }
 * Response: { success: true, data: { id, imei, productId, status, ... } }
 * 
 * =============================================================================
 */

import { apiClient, type ApiResponse } from './apiClient';
import type { IMEI } from '@/types';

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export interface RegisterIMEIRequest {
  imei: string;
  imei2?: string;
  productId: string;
  price?: number;
  source?: string;
  capacity?: string;
  commissionConfig?: {
    foCommission: number;
    teamLeaderCommission: number;
    regionalManagerCommission: number;
  };
  notes?: string;
}

export interface UpdateIMEIRequest {
  status?: string;
  price?: number;
  source?: string;
  capacity?: string;
  currentOwnerId?: string;
  commissionConfig?: {
    foCommission: number;
    teamLeaderCommission: number;
    regionalManagerCommission: number;
  };
  notes?: string;
}

export interface BulkRegisterRequest {
  imeis: RegisterIMEIRequest[];
}

export interface IMEIListParams {
  status?: string;
  productId?: string;
  search?: string;
  page?: number;
  limit?: number;
  currentHolderId?: string;
}

export interface IMEIListResponse {
  imeis: IMEI[];
  total: number;
  page: number;
  pages: number;
}

// -----------------------------------------------------------------------------
// SERVICE
// -----------------------------------------------------------------------------

export const imeiService = {
  /**
   * Get all IMEIs with optional filters
   */
  getAll: async (params?: IMEIListParams): Promise<ApiResponse<IMEIListResponse>> => {
    const queryParams: Record<string, string> = {};
    
    if (params?.status) queryParams.status = params.status;
    if (params?.productId) queryParams.productId = params.productId;
    if (params?.search) queryParams.search = params.search;
    if (params?.page) queryParams.page = params.page.toString();
    if (params?.limit) queryParams.limit = params.limit.toString();
    if (params?.currentHolderId) queryParams.currentHolderId = params.currentHolderId;
    
    return apiClient.get<IMEIListResponse>('/imei', queryParams);
  },

  /**
   * Get a single IMEI by ID
   */
  getById: async (id: string): Promise<ApiResponse<IMEI>> => {
    return apiClient.get<IMEI>(`/imei/${id}`);
  },

  /**
   * Register a new IMEI
   */
  register: async (imeiData: RegisterIMEIRequest): Promise<ApiResponse<IMEI>> => {
    return apiClient.post<IMEI>('/imei', imeiData);
  },

  /**
   * Register multiple IMEIs in bulk
   */
  bulkRegister: async (imeis: RegisterIMEIRequest[]): Promise<ApiResponse<IMEI[]>> => {
    return apiClient.post<IMEI[]>('/imei/bulk', { imeis });
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
  delete: async (id: string): Promise<ApiResponse<{ success: boolean }>> => {
    return apiClient.delete<{ success: boolean }>(`/imei/${id}`);
  },

  /**
   * Get current user's stock
   */
  getMyStock: async (): Promise<ApiResponse<IMEI[]>> => {
    return apiClient.get<IMEI[]>('/imei/my-stock');
  },

  /**
   * Search IMEI by number
   */
  search: async (imeiNumber: string): Promise<ApiResponse<IMEI>> => {
    return apiClient.get<IMEI>(`/imei/search/${imeiNumber}`);
  },
};

export default imeiService;
