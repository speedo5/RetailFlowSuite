/**
 * =============================================================================
 * PRODUCT SERVICE
 * =============================================================================
 * 
 * Handles product catalog management.
 * 
 * API ENDPOINTS:
 * - GET    /products       - List all products
 * - GET    /products/:id   - Get product by ID
 * - POST   /products       - Create product (Admin only)
 * - PUT    /products/:id   - Update product
 * - DELETE /products/:id   - Delete product (Admin only)
 * 
 * SAMPLE REQUEST/RESPONSE:
 * ------------------------
 * GET /products?category=Smartphones
 * Response: { success: true, data: [...products], total: 50 }
 * 
 * POST /products
 * Request: {
 *   name: "Samsung Galaxy A54",
 *   category: "Smartphones", 
 *   price: 35000,
 *   brand: "Samsung",
 *   commissionConfig: { foCommission: 500, teamLeaderCommission: 200, regionalManagerCommission: 100 }
 * }
 * Response: { success: true, data: { id, name, category, price, ... } }
 * 
 * =============================================================================
 */

import { apiClient, type ApiResponse } from './apiClient';
import type { Product } from '@/types';

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export interface ProductListParams {
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
}

export interface CreateProductRequest {
  name: string;
  category: string;
  price: number;
  brand?: string;
  description?: string;
  commissionConfig?: {
    foCommission: number;
    teamLeaderCommission: number;
    regionalManagerCommission: number;
  };
}

export interface UpdateProductRequest {
  name?: string;
  category?: string;
  price?: number;
  brand?: string;
  description?: string;
  commissionConfig?: {
    foCommission: number;
    teamLeaderCommission: number;
    regionalManagerCommission: number;
  };
}

export interface ProductListResponse {
  products: Product[];
  total: number;
}

// -----------------------------------------------------------------------------
// SERVICE
// -----------------------------------------------------------------------------

export const productService = {
  /**
   * Get all products with optional filters
   */
  getAll: async (params?: ProductListParams): Promise<ApiResponse<ProductListResponse>> => {
    const queryParams: Record<string, string> = {};
    
    if (params?.category) queryParams.category = params.category;
    if (params?.brand) queryParams.brand = params.brand;
    if (params?.page) queryParams.page = params.page.toString();
    if (params?.limit) queryParams.limit = params.limit.toString();
    
    return apiClient.get<ProductListResponse>('/products', queryParams);
  },

  /**
   * Get a single product by ID
   */
  getById: async (id: string): Promise<ApiResponse<Product>> => {
    return apiClient.get<Product>(`/products/${id}`);
  },

  /**
   * Create a new product
   */
  create: async (productData: CreateProductRequest): Promise<ApiResponse<Product>> => {
    return apiClient.post<Product>('/products', productData);
  },

  /**
   * Update an existing product
   */
  update: async (id: string, productData: UpdateProductRequest): Promise<ApiResponse<Product>> => {
    return apiClient.put<Product>(`/products/${id}`, productData);
  },

  /**
   * Delete a product
   */
  delete: async (id: string): Promise<ApiResponse<void>> => {
    return apiClient.delete<void>(`/products/${id}`);
  },

  /**
   * Get product categories
   */
  getCategories: async (): Promise<ApiResponse<string[]>> => {
    return apiClient.get<string[]>('/products/categories');
  },
};

export default productService;
