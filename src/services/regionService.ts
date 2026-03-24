import { apiClient } from './apiClient';

interface Region {
  _id?: string;
  name: string;
  managerId?: string;
  managerName?: string;
  description?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface RegionResponse {
  success: boolean;
  data: Region | Region[];
  message?: string;
}

export const regionService = {
  /**
   * Get all regions
   */
  async getRegions(): Promise<Region[]> {
    try {
      const response = await apiClient.get<Region[]>('/regions');
      return response.data;
    } catch (error) {
      console.error('Error fetching regions:', error);
      throw error;
    }
  },

  /**
   * Get single region by ID
   */
  async getRegion(id: string): Promise<Region> {
    try {
      const response = await apiClient.get<Region>(`/regions/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching region:', error);
      throw error;
    }
  },

  /**
   * Create new region
   */
  async createRegion(regionData: { name: string; managerId?: string; description?: string }): Promise<Region> {
    try {
      const response = await apiClient.post<Region>('/regions', regionData);
      return response.data;
    } catch (error) {
      console.error('Error creating region:', error);
      throw error;
    }
  },

  /**
   * Update region
   */
  async updateRegion(id: string, regionData: { managerId?: string; description?: string }): Promise<Region> {
    try {
      const response = await apiClient.put<Region>(`/regions/${id}`, regionData);
      return response.data;
    } catch (error) {
      console.error('Error updating region:', error);
      throw error;
    }
  },

  /**
   * Delete region
   */
  async deleteRegion(id: string): Promise<void> {
    try {
      await apiClient.delete(`/regions/${id}`);
    } catch (error) {
      console.error('Error deleting region:', error);
      throw error;
    }
  },

  /**
   * Get region stats
   */
  async getRegionStats(id: string): Promise<any> {
    try {
      const response = await apiClient.get(`/regions/${id}/stats`);
      return response.data;
    } catch (error) {
      console.error('Error fetching region stats:', error);
      throw error;
    }
  }
};
