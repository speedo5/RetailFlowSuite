/**
 * =============================================================================
 * COMMISSION SERVICE
 * =============================================================================
 * 
 * Handles commission tracking, approval, and payment.
 * 
 * API ENDPOINTS:
 * - GET  /commissions              - List all commissions
 * - GET  /commissions/my           - Get my commissions
 * - PUT  /commissions/:id/approve  - Approve commission
 * - PUT  /commissions/:id/pay      - Mark as paid
 * - PUT  /commissions/:id/reject   - Reject commission
 * - PUT  /commissions/bulk-approve - Bulk approve
 * - PUT  /commissions/bulk-pay     - Bulk pay
 * 
 * SAMPLE REQUEST/RESPONSE:
 * ------------------------
 * GET /commissions?userId=user-4&status=pending
 * Response: { success: true, data: [...commissions], total: 25 }
 * 
 * PUT /commissions/:id/approve
 * Response: { success: true, data: { id, status: "approved", approvedAt, approvedBy, ... } }
 * 
 * PUT /commissions/:id/pay
 * Response: { success: true, data: { id, status: "paid", paidAt, paymentReference, ... } }
 * 
 * =============================================================================
 */

import { apiClient, type ApiResponse } from './apiClient';
import type { Commission } from '@/types';

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export type CommissionStatus = 'pending' | 'approved' | 'paid' | 'rejected';

export interface CommissionListParams {
  userId?: string;
  status?: CommissionStatus;
  startDate?: string;
  endDate?: string;
  role?: string;
  page?: number;
  limit?: number;
}

export interface CommissionListResponse {
  commissions?: Commission[];
  data?: Commission[];
  total?: number;
  count?: number;
  summary?: {
    totalPending: number;
    totalApproved: number;
    totalPaid: number;
    pendingAmount: number;
    approvedAmount: number;
    paidAmount: number;
  };
}

export interface RejectCommissionRequest {
  reason: string;
}

export interface BulkOperationResult {
  success: string[];
  failed: Array<{ id: string; error: string }>;
}

// -----------------------------------------------------------------------------
// SERVICE
// -----------------------------------------------------------------------------

export const commissionService = {
  /**
   * Get all commissions with optional filters
   */
  getAll: async (params?: CommissionListParams): Promise<ApiResponse<CommissionListResponse>> => {
    const queryParams: Record<string, string> = {};
    
    if (params?.userId) queryParams.userId = params.userId;
    if (params?.status) queryParams.status = params.status;
    if (params?.startDate) queryParams.startDate = params.startDate;
    if (params?.endDate) queryParams.endDate = params.endDate;
    if (params?.role) queryParams.role = params.role;
    if (params?.page) queryParams.page = params.page.toString();
    if (params?.limit) queryParams.limit = params.limit.toString();
    
    return apiClient.get<CommissionListResponse>('/commissions', queryParams);
  },

  /**
   * Get commissions for the current user
   */
  getMyCommissions: async (): Promise<ApiResponse<Commission[]>> => {
    return apiClient.get<Commission[]>('/commissions/my');
  },

  /**
   * Get a single commission by ID
   */
  getById: async (id: string): Promise<ApiResponse<Commission>> => {
    return apiClient.get<Commission>(`/commissions/${id}`);
  },

  /**
   * Approve a commission
   */
  approve: async (id: string): Promise<ApiResponse<Commission>> => {
    return apiClient.put<Commission>(`/commissions/${id}/approve`);
  },

  /**
   * Mark a commission as paid
   */
  markPaid: async (id: string, paymentReference?: string): Promise<ApiResponse<Commission>> => {
    return apiClient.put<Commission>(`/commissions/${id}/pay`, { paymentReference });
  },

  /**
   * Reject a commission
   */
  reject: async (id: string, reason: string): Promise<ApiResponse<Commission>> => {
    return apiClient.put<Commission>(`/commissions/${id}/reject`, { reason });
  },

  /**
   * Bulk approve multiple commissions
   */
  bulkApprove: async (ids: string[]): Promise<ApiResponse<BulkOperationResult>> => {
    return apiClient.put<BulkOperationResult>('/commissions/bulk-approve', { ids });
  },

  /**
   * Bulk pay multiple commissions
   */
  bulkPay: async (ids: string[]): Promise<ApiResponse<BulkOperationResult>> => {
    return apiClient.put<BulkOperationResult>('/commissions/bulk-pay', { ids });
  },

  /**
   * Get commission summary for dashboard
   */
  getSummary: async (): Promise<ApiResponse<{
    pending: number;
    approved: number;
    paid: number;
    totalEarned: number;
    thisMonth: number;
  }>> => {
    return apiClient.get<{
      pending: number;
      approved: number;
      paid: number;
      totalEarned: number;
      thisMonth: number;
    }>('/commissions/summary');
  },
};

export default commissionService;
