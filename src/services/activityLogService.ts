/**
 * =============================================================================
 * ACTIVITY LOG SERVICE
 * =============================================================================
 * 
 * Handles activity log retrieval and logging.
 * 
 * API ENDPOINTS:
 * - GET    /activity-logs           - Get all activity logs (with filtering)
 * - GET    /activity-logs/:id       - Get single activity log
 * - POST   /activity-logs           - Create activity log
 * - GET    /activity-logs/me/logs   - Get current user's activity logs
 * - GET    /activity-logs/entity/:entityType/:entityId - Get activity logs for entity
 * - GET    /activity-logs/stats/summary - Get activity statistics
 * - DELETE /activity-logs/:id       - Delete activity log (Admin only)
 * 
 * =============================================================================
 */

import { apiClient, type ApiResponse } from './apiClient';
import type { ActivityLog, ActivityType } from '@/types';

// Map frontend activity type to backend entity type
const typeToEntityType: Record<ActivityType, string> = {
  'sale': 'sale',
  'inventory': 'imei',
  'user': 'user',
  'commission': 'commission',
  'product': 'product',
  'system': 'system',
  'allocation': 'stock_allocation',
};

export interface ActivityLogListParams {
  entityType?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export interface CreateActivityLogRequest {
  action: string;
  entityType: string;
  entityId?: string;
  details?: {
    description?: string;
    metadata?: Record<string, any>;
  };
}

export interface ActivityLogListResponse {
  data: ActivityLog[];
  total: number;
  count: number;
  page: number;
  pages: number;
}

export interface ActivityStatsResponse {
  total: number;
  byType: Array<{ _id: string; count: number }>;
  topUsers: Array<{ _id: string; count: number }>;
}

export const activityLogService = {
  /**
   * Get all activity logs with optional filtering
   */
  getAll: async (params?: ActivityLogListParams): Promise<ApiResponse<ActivityLogListResponse>> => {
    const queryParams: Record<string, string> = {};
    
    if (params?.entityType) queryParams.entityType = params.entityType;
    if (params?.userId) queryParams.userId = params.userId;
    if (params?.startDate) queryParams.startDate = params.startDate;
    if (params?.endDate) queryParams.endDate = params.endDate;
    if (params?.page) queryParams.page = params.page.toString();
    if (params?.limit) queryParams.limit = params.limit.toString();
    if (params?.search) queryParams.search = params.search;
    
    return apiClient.get<ActivityLogListResponse>('/activity-logs', queryParams);
  },

  /**
   * Get a single activity log by ID
   */
  getById: async (id: string): Promise<ApiResponse<ActivityLog>> => {
    return apiClient.get<ActivityLog>(`/activity-logs/${id}`);
  },

  /**
   * Get current user's activity logs
   */
  getMyLogs: async (params?: Omit<ActivityLogListParams, 'userId'>): Promise<ApiResponse<ActivityLogListResponse>> => {
    const queryParams: Record<string, string> = {};
    
    if (params?.entityType) queryParams.entityType = params.entityType;
    if (params?.startDate) queryParams.startDate = params.startDate;
    if (params?.endDate) queryParams.endDate = params.endDate;
    if (params?.page) queryParams.page = params.page.toString();
    if (params?.limit) queryParams.limit = params.limit.toString();
    
    return apiClient.get<ActivityLogListResponse>('/activity-logs/me/logs', queryParams);
  },

  /**
   * Get activity logs for a specific entity
   */
  getEntityLogs: async (entityType: string, entityId: string, page: number = 1, limit: number = 20): Promise<ApiResponse<ActivityLogListResponse>> => {
    const queryParams: Record<string, string> = {
      page: page.toString(),
      limit: limit.toString()
    };
    
    return apiClient.get<ActivityLogListResponse>(`/activity-logs/entity/${entityType}/${entityId}`, queryParams);
  },

  /**
   * Create a new activity log
   */
  create: async (logData: CreateActivityLogRequest): Promise<ApiResponse<ActivityLog>> => {
    return apiClient.post<ActivityLog>('/activity-logs', logData);
  },

  /**
   * Log an activity (helper method)
   * Maps frontend activity type to backend entity type
   */
  logActivity: async (
    type: ActivityType,
    action: string,
    description: string,
    metadata?: Record<string, any>
  ): Promise<ApiResponse<ActivityLog>> => {
    const entityType = typeToEntityType[type] || type;
    
    return apiClient.post<ActivityLog>('/activity-logs', {
      action,
      entityType,
      details: {
        description,
        metadata
      }
    });
  },

  /**
   * Get activity statistics/summary
   */
  getStats: async (startDate?: string, endDate?: string): Promise<ApiResponse<ActivityStatsResponse>> => {
    const queryParams: Record<string, string> = {};
    
    if (startDate) queryParams.startDate = startDate;
    if (endDate) queryParams.endDate = endDate;
    
    return apiClient.get<ActivityStatsResponse>('/activity-logs/stats/summary', queryParams);
  },

  /**
   * Delete an activity log (Admin only)
   */
  delete: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    return apiClient.delete(`/activity-logs/${id}`);
  },
};
