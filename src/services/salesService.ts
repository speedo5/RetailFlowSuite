/**
 * =============================================================================
 * SALES SERVICE
 * =============================================================================
 * 
 * Handles sales transactions and receipts.
 * 
 * API ENDPOINTS:
 * - GET  /sales            - List all sales
 * - GET  /sales/:id        - Get sale by ID
 * - POST /sales            - Create a sale
 * - GET  /sales/:id/receipt - Get sale receipt
 * 
 * SAMPLE REQUEST/RESPONSE:
 * ------------------------
 * GET /sales?foId=user-4&startDate=2024-01-01&endDate=2024-01-31
 * Response: { success: true, data: [...sales], total: 50 }
 * 
 * POST /sales
 * Request: {
 *   imeiId: "imei-1",
 *   paymentMethod: "M-Pesa",
 *   paymentReference: "QHR7Y8Z9X",
 *   clientName: "John Doe",
 *   clientPhone: "+254712345678",
 *   clientIdNumber: "12345678"
 * }
 * Response: {
 *   success: true,
 *   data: {
 *     id: "sale-1",
 *     imei: {...},
 *     product: {...},
 *     saleAmount: 35000,
 *     commission: 500,
 *     seller: {...},
 *     client: {...},
 *     paymentMethod: "M-Pesa",
 *     createdAt: "2024-01-15T10:30:00Z"
 *   }
 * }
 * 
 * =============================================================================
 */

import { apiClient, type ApiResponse } from './apiClient';
import type { Sale } from '@/types';

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export interface SalesListParams {
  foId?: string;
  teamLeaderId?: string;
  soldBy?: string;
  region?: string;
  regionalManagerId?: string;
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
  page?: number;
  limit?: number;
}

export interface CreateSaleRequest {
  imeiId?: string;
  productId?: string;
  quantity?: number;
  paymentMethod: 'Cash' | 'M-Pesa' | 'Bank Transfer' | 'Credit';
  paymentReference?: string;
  customerName?: string;
  customerPhone?: string;
  customerIdNumber?: string;
  customerEmail?: string;
  source?: 'watu' | 'mogo' | 'onfon';
  foId?: string;
  foName?: string;
  foCode?: string;
  notes?: string;
  // Express sale fields
  saleType?: 'NORMAL' | 'EXPRESS';
  assignedRmId?: string;
  assignedTlId?: string;
  assignedFoId?: string;
  rmCommission?: number;
  tlCommission?: number;
  foCommission?: number;
  soldByAdmin?: boolean;
}

export interface SalesListResponse {
  sales?: Sale[];
  data?: Sale[];
  total?: number;
  count?: number;
  page?: number;
  pages?: number;
  totalAmount?: number;
}

export interface SaleReceipt {
  sale: Sale;
  companyInfo: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
  receiptNumber: string;
  generatedAt: Date;
}

// -----------------------------------------------------------------------------
// SERVICE
// -----------------------------------------------------------------------------

export const salesService = {
  /**
   * Get all sales with optional filters
   */
  getAll: async (params?: SalesListParams): Promise<ApiResponse<SalesListResponse>> => {
    const queryParams: Record<string, string> = {};
    
    if (params?.foId) queryParams.foId = params.foId;
    if (params?.soldBy) queryParams.soldBy = params.soldBy;
    if (params?.region) queryParams.region = params.region;
    if (params?.teamLeaderId) queryParams.teamLeaderId = params.teamLeaderId;
    if (params?.startDate) queryParams.startDate = params.startDate;
    if (params?.endDate) queryParams.endDate = params.endDate;
    if (params?.paymentMethod) queryParams.paymentMethod = params.paymentMethod;
    if (params?.page) queryParams.page = params.page.toString();
    if (params?.limit) queryParams.limit = params.limit.toString();
    
    return apiClient.get<SalesListResponse>('/sales', queryParams);
  },

  /**
   * Get a single sale by ID
   */
  getById: async (id: string): Promise<ApiResponse<Sale>> => {
    return apiClient.get<Sale>(`/sales/${id}`);
  },

  /**
   * Create a new sale
   */
  create: async (saleData: CreateSaleRequest): Promise<ApiResponse<Sale>> => {
    return apiClient.post<Sale>('/sales', saleData);
  },

  /**
   * Get a sale receipt for printing
   */
  getReceipt: async (saleId: string): Promise<ApiResponse<SaleReceipt>> => {
    return apiClient.get<SaleReceipt>(`/sales/${saleId}/receipt`);
  },

  /**
   * Get sales by current user (for Field Officers)
   */
  getMySales: async (params?: { startDate?: string; endDate?: string }): Promise<ApiResponse<Sale[]>> => {
    const queryParams: Record<string, string> = {};
    if (params?.startDate) queryParams.startDate = params.startDate;
    if (params?.endDate) queryParams.endDate = params.endDate;
    
    return apiClient.get<Sale[]>('/sales/my', queryParams);
  },

  /**
   * Get today's sales summary
   */
  getTodaySummary: async (): Promise<ApiResponse<{ count: number; total: number; commission: number }>> => {
    return apiClient.get<{ count: number; total: number; commission: number }>('/sales/today');
  },
};

export default salesService;
