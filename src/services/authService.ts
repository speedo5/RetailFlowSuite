/**
 * =============================================================================
 * AUTHENTICATION SERVICE
 * =============================================================================
 * 
 * Handles user authentication, login, logout, and session management.
 * 
 * API ENDPOINTS:
 * - POST /auth/login          - Login with email/password
 * - POST /auth/register       - Register new user (Admin only)
 * - GET  /auth/me             - Get current user profile
 * - PUT  /auth/change-password - Change password
 * 
 * SAMPLE REQUEST/RESPONSE:
 * ------------------------
 * POST /auth/login
 * Request:  { email: "user@example.com", password: "password123" }
 * Response: { success: true, token: "jwt...", data: { id, name, email, role } }
 * 
 * =============================================================================
 */

import { apiClient, tokenManager, type ApiResponse } from './apiClient';
import type { User } from '@/types';

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role: string;
  region?: string;
  phone?: string;
  teamLeaderId?: string;
  regionalManagerId?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// -----------------------------------------------------------------------------
// SERVICE
// -----------------------------------------------------------------------------

export const authService = {
  /**
   * Login with email and password
   * On success, stores the JWT token for subsequent requests
   */
  login: async (credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> => {
    const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
    
    // Store token on successful login
    if (response.success && response.data.token) {
      tokenManager.set(response.data.token);
    }
    
    return response;
  },

  /**
   * Register a new user (Admin only)
   */
  register: async (userData: RegisterRequest): Promise<ApiResponse<User>> => {
    return apiClient.post<User>('/auth/register', userData);
  },

  /**
   * Get the current authenticated user's profile
   */
  getCurrentUser: async (): Promise<ApiResponse<User>> => {
    return apiClient.get<User>('/auth/me');
  },

  /**
   * Change the current user's password
   */
  changePassword: async (data: ChangePasswordRequest): Promise<ApiResponse<void>> => {
    return apiClient.put<void>('/auth/update-password', data);
  },

  /**
   * Logout - clears the stored token
   */
  logout: (): void => {
    tokenManager.remove();
  },

  /**
   * Check if user is currently authenticated
   */
  isAuthenticated: (): boolean => {
    return tokenManager.isValid();
  },

  /**
   * Get the stored auth token
   */
  getToken: (): string | null => {
    return tokenManager.get();
  },
};

export default authService;
