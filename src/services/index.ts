/**
 * =============================================================================
 * SERVICES INDEX
 * =============================================================================
 * 
 * This file exports all service modules for the Finetech POS application.
 * Services handle all API communication and business logic.
 * 
 * INTEGRATION GUIDE:
 * -----------------
 * 1. Each service corresponds to a backend API module
 * 2. Services use the apiClient for HTTP requests
 * 3. Replace mock implementations with real API calls as needed
 * 
 * =============================================================================
 */

// Core API client - handles all HTTP requests
export { default as apiClient } from './apiClient';

// Individual service modules
export { authService } from './authService';
export { userService } from './userService';
export { productService } from './productService';
export { inventoryService } from './inventoryService';
export { stockService } from './stockService';
export { salesService } from './salesService';
export { commissionService } from './commissionService';
export { dashboardService } from './dashboardService';
export { reportService } from './reportService';
export { activityLogService } from './activityLogService';
export { inventoryRealtimeSyncService } from './inventoryRealtimeSyncService';

// Re-export types for convenience
export type { ApiResponse, PaginatedResponse, ApiError } from './apiClient';
