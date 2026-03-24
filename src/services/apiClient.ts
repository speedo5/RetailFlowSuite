/**
 * =============================================================================
 * API CLIENT
 * =============================================================================
 * 
 * Core HTTP client for all API requests.
 * Handles authentication, error handling, and request/response formatting.
 * 
 * CONFIGURATION:
 * - Set VITE_API_URL in .env to point to your backend
 * - Tokens are stored in localStorage and automatically attached to requests
 * 
 * =============================================================================
 */

import { environment, debugLog } from '@/config/environment';

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  success: false;
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
}

// -----------------------------------------------------------------------------
// TOKEN MANAGEMENT
// -----------------------------------------------------------------------------

const TOKEN_KEY = 'auth_token';

export const tokenManager = {
  get: (): string | null => {
    return localStorage.getItem(TOKEN_KEY);
  },
  
  set: (token: string): void => {
    localStorage.setItem(TOKEN_KEY, token);
  },
  
  remove: (): void => {
    localStorage.removeItem(TOKEN_KEY);
  },
  
  isValid: (): boolean => {
    const token = tokenManager.get();
    if (!token) return false;
    
    // Basic JWT expiry check (optional - implement if needed)
    // You can decode the token and check exp claim
    return true;
  },
};

// -----------------------------------------------------------------------------
// API CLIENT
// -----------------------------------------------------------------------------

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = environment.apiUrl;
  }

  /**
   * Make an HTTP request to the API
   */
  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = tokenManager.get();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    debugLog(`API Request: ${options.method || 'GET'} ${endpoint}`);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Try to parse JSON body safely
      let data: any = undefined;
      try {
        data = await response.json();
      } catch (e) {
        // If there's no JSON body, leave data undefined
      }

      // Handle unauthorized centrally: clear token and redirect to login
      // in a guarded way to avoid navigation loops when many requests
      // receive 401 simultaneously (dev servers often cause this).
      if (response.status === 401) {
        debugLog('API Unauthorized (401) - clearing token and performing guarded redirect to /login');
        try { tokenManager.remove(); } catch (e) { /* ignore */ }

        if (typeof window !== 'undefined') {
          try {
            const currentPath = window.location.pathname || '/';
            const lastRedirect = sessionStorage.getItem('auth_redirect_ts');
            const now = Date.now();
            const REDIRECT_COOLDOWN = 5000; // ms - avoid redirect storm

            if (currentPath !== '/login' && (!lastRedirect || now - Number(lastRedirect) > REDIRECT_COOLDOWN)) {
              sessionStorage.setItem('auth_redirect_ts', String(now));
              window.location.href = '/login';
            }
          } catch (e) {
            // ignore sessionStorage or navigation failures
          }
        }

        throw new ApiClientError(
          (data && data.message) || 'Not authorized to access this route',
          401,
          data
        );
      }

      if (!response.ok) {
        debugLog('API Error:', data);
        throw new ApiClientError(
          (data && data.message) || 'Request failed',
          response.status,
          data
        );
      }

      debugLog('API Response:', data);
      return data;
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw error;
      }
      
      // Handle fetch errors (network issues, CORS, etc.)
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new ApiClientError(
          'Network error: Could not connect to the API server',
          0,
          undefined,
          error as Error
        );
      }
      
      // Handle JSON parsing errors
      if (error instanceof SyntaxError) {
        throw new ApiClientError(
          'Invalid response format from server',
          0,
          undefined,
          error as Error
        );
      }

      // Handle other unexpected errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new ApiClientError(
        errorMessage,
        0,
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  // Convenience methods
  async get<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    const queryString = params ? `?${new URLSearchParams(params)}` : '';
    return this.request<T>(`${endpoint}${queryString}`);
  }

  async post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }

  /**
   * Download a file (for exports)
   */
  async downloadFile(endpoint: string, filename: string): Promise<void> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = tokenManager.get();

    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      throw new ApiClientError('Download failed', response.status);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    a.remove();
  }
}

// Custom error class for API errors
export class ApiClientError extends Error {
  public readonly statusCode: number;
  public readonly responseBody: any;
  public readonly originalError?: Error;

  constructor(
    message: string,
    statusCode: number = 0,
    responseBody?: unknown,
    originalError?: Error
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    this.originalError = originalError;
  }

  /**
   * Get a user-friendly error message
   */
  getDisplayMessage(): string {
    if (this.statusCode === 0) {
      return 'Network error: Unable to connect to the server. Please check your internet connection.';
    }
    if (this.statusCode === 401) {
      return 'Authentication failed. Please log in again.';
    }
    if (this.statusCode === 403) {
      return 'Access denied. You do not have permission to perform this action.';
    }
    if (this.statusCode === 404) {
      return 'The requested resource was not found.';
    }
    if (this.statusCode === 409) {
      return 'Conflict: The operation could not be completed due to a conflict with existing data.';
    }
    if (this.statusCode === 422) {
      return 'Validation error: Please check your input and try again.';
    }
    if (this.statusCode >= 500) {
      return 'Server error: Please try again later.';
    }
    return this.message || 'An error occurred. Please try again.';
  }

  /**
   * Get detailed error info for logging/debugging
   */
  getDetailedInfo(): string {
    let details = `${this.name}: ${this.message}`;
    if (this.statusCode) {
      details += ` (Status: ${this.statusCode})`;
    }
    if (this.responseBody?.message) {
      details += ` - ${this.responseBody.message}`;
    }
    if (this.responseBody?.errors) {
      const errorList = Object.entries(this.responseBody.errors)
        .map(([field, msgs]: [string, any]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
        .join('; ');
      details += ` - Validation errors: ${errorList}`;
    }
    return details;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;
