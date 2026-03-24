/**
 * =============================================================================
 * INVENTORY REAL-TIME SYNC SERVICE
 * =============================================================================
 * 
 * Handles real-time synchronization of inventory between AdminPOS and TeamLeaderPOS.
 * Provides polling mechanism for inventory updates and inventory locking to prevent
 * double-selling when multiple users access the same stock.
 * 
 * FEATURES:
 * - Shared inventory pool: Team leaders can sell from the same inventory as admin
 * - Real-time polling: Automatically fetch inventory updates at regular intervals
 * - Inventory locking: Lock items during sale to prevent race conditions
 * - Notification system: Alert users about inventory changes
 * - Optimistic updates: Update local state immediately, sync with backend
 * 
 * =============================================================================
 */

import { apiClient, type ApiResponse } from './apiClient';
import type { IMEI } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

export interface InventorySyncConfig {
  enableRealTimeSync: boolean;
  pollIntervalMs: number; // Polling interval in milliseconds
  enableLocking: boolean; // Enable inventory locking to prevent double-selling
  syncOnFocus: boolean; // Sync when browser tab regains focus
}

export interface InventoryLock {
  imeiId: string;
  imei: string;
  lockedBy: string; // userId
  lockedAt: Date;
  expiresAt: Date;
  reason: string; // 'SALE_IN_PROGRESS', 'ALLOCATION', etc.
}

export interface InventorySyncEvent {
  type: 'INVENTORY_UPDATED' | 'ITEM_SOLD' | 'ITEM_LOCKED' | 'ITEM_UNLOCKED' | 'RESTOCK_RECEIVED' | 'SYNC_ERROR';
  timestamp: Date;
  data: any;
}

export interface SharedInventoryResponse {
  data: IMEI[];
  total: number;
  lastSyncTime: string;
  hasUpdates: boolean;
}

// ============================================================================
// INVENTORY REAL-TIME SYNC SERVICE
// ============================================================================

class InventoryRealtimeSyncService {
  private config: InventorySyncConfig = {
    enableRealTimeSync: true,
    pollIntervalMs: 3000, // Poll every 3 seconds
    enableLocking: true,
    syncOnFocus: true,
  };

  private pollIntervalId: NodeJS.Timeout | null = null;
  private lastSyncTime: number = 0;
  private listeners: Map<string, Function[]> = new Map();
  private visibilityHandler: (() => void) | null = null;

  constructor(config?: Partial<InventorySyncConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Initialize real-time sync for shared inventory
   * Starts polling and sets up event listeners
   */
  public async initializeSync(userId: string): Promise<void> {
    if (!this.config.enableRealTimeSync) {
      console.log('Real-time inventory sync is disabled');
      return;
    }

    console.log('Initializing real-time inventory sync for user:', userId);

    // Start polling
    this.startPolling();

    // Set up visibility handler to sync when tab regains focus
    if (this.config.syncOnFocus) {
      this.visibilityHandler = () => {
        if (document.visibilityState === 'visible') {
          console.log('Page visible, syncing inventory...');
          this.syncInventoryNow();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  /**
   * Stop real-time sync
   */
  public stopSync(): void {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }

    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

    console.log('Real-time inventory sync stopped');
  }

  /**
   * Start polling for inventory updates
   */
  private startPolling(): void {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
    }

    // First sync immediately
    this.syncInventoryNow();

    // Then poll at regular intervals
    this.pollIntervalId = setInterval(() => {
      this.syncInventoryNow();
    }, this.config.pollIntervalMs);

    console.log(`Started polling inventory every ${this.config.pollIntervalMs}ms`);
  }

  /**
   * Fetch shared inventory from backend
   * Used by both Admin and Team Leader POS
   * Uses existing /api/imei endpoint with ALLOCATED status filter
   */
  public async getSharedInventory(filters?: {
    status?: string;
    productId?: string;
    source?: string;
  }): Promise<IMEI[]> {
    try {
      const params = new URLSearchParams();
      // Default to ALLOCATED status for shared inventory
      params.append('status', filters?.status || 'ALLOCATED');
      if (filters?.productId) params.append('productId', filters.productId);
      if (filters?.source) params.append('source', filters.source);

      // Use existing /imei endpoint (not /imei/shared which may not exist)
      const endpoint = `/imei?${params.toString()}`;
      const response = await apiClient.get<any>(endpoint);

      // Handle multiple response formats from backend
      let inventory: IMEI[] = [];
      
      if (response.success && response.data) {
        // Check if data is an array
        if (Array.isArray(response.data)) {
          inventory = response.data;
        }
        // Check if data contains imeis array
        else if ((response.data as any).data && Array.isArray((response.data as any).data)) {
          inventory = (response.data as any).data;
        }
        // Check if data is wrapped in imeis property
        else if ((response.data as any).imeis && Array.isArray((response.data as any).imeis)) {
          inventory = (response.data as any).imeis;
        }
      }

      if (inventory.length > 0) {
        this.lastSyncTime = Date.now();
        this.emit('INVENTORY_UPDATED', {
          count: inventory.length,
          timestamp: new Date(),
        });
      }
      
      return inventory;
    } catch (error) {
      console.error('Error fetching shared inventory:', error);
      this.emit('SYNC_ERROR', { error, message: 'Failed to sync inventory' });
      throw error;
    }
  }

  /**
   * Sync inventory now (immediate sync)
   */
  public async syncInventoryNow(): Promise<IMEI[]> {
    return this.getSharedInventory();
  }

  /**
   * Lock an IMEI to prevent others from selling it
   * Called when a sale is in progress
   * Gracefully handles if endpoint doesn't exist
   */
  public async lockInventoryItem(
    imeiId: string,
    imeiNumber: string,
    userId: string,
    reason: string = 'SALE_IN_PROGRESS'
  ): Promise<{ success: boolean; lock?: InventoryLock; error?: string }> {
    if (!this.config.enableLocking) {
      return { success: true };
    }

    try {
      const response = await apiClient.post<InventoryLock>('/imei/lock', {
        imeiId,
        imei: imeiNumber,
        userId,
        reason,
        expiresIn: 60000, // Lock expires in 60 seconds
      });

      if (response.success && response.data) {
        this.emit('ITEM_LOCKED', {
          imeiId,
          imei: imeiNumber,
          lockedBy: userId,
          timestamp: new Date(),
        });
        return { success: true, lock: response.data };
      }

      return {
        success: false,
        error: response.message || 'Failed to lock inventory item',
      };
    } catch (error: any) {
      // If lock endpoint doesn't exist, allow sale to proceed (graceful degradation)
      if (error.status === 404) {
        console.warn('Inventory lock endpoint not available, proceeding without locking');
        return { success: true };
      }
      
      console.error('Error locking inventory item:', error);
      return {
        success: false,
        error: error.message || 'Failed to lock inventory item',
      };
    }
  }

  /**
   * Unlock an IMEI (called after sale completes or fails)
   * Gracefully handles if endpoint doesn't exist
   */
  public async unlockInventoryItem(imeiId: string): Promise<{ success: boolean }> {
    if (!this.config.enableLocking) {
      return { success: true };
    }

    try {
      const response = await apiClient.post('/imei/unlock', { imeiId });

      if (response.success) {
        this.emit('ITEM_UNLOCKED', { imeiId, timestamp: new Date() });
        return { success: true };
      }

      return { success: false };
    } catch (error: any) {
      // If unlock endpoint doesn't exist, just log and continue
      if (error.status === 404) {
        console.warn('Inventory unlock endpoint not available');
        return { success: true };
      }
      
      console.error('Error unlocking inventory item:', error);
      return { success: false };
    }
  }

  /**
   * Report item as sold (immediate sync to all POS systems)
   * Gracefully handles if endpoint doesn't exist
   */
  public async reportItemSold(
    imeiId: string,
    imeiNumber: string,
    saleId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await apiClient.post('/imei/report-sold', {
        imeiId,
        imei: imeiNumber,
        saleId,
        soldBy: userId,
      });

      if (response.success) {
        this.emit('ITEM_SOLD', {
          imeiId,
          imei: imeiNumber,
          saleId,
          soldBy: userId,
          timestamp: new Date(),
        });

        // Trigger immediate sync
        await this.syncInventoryNow();

        return { success: true };
      }

      return { success: false, error: response.message || 'Failed to report item as sold' };
    } catch (error: any) {
      // If report-sold endpoint doesn't exist, just trigger a sync instead
      if (error.status === 404) {
        console.warn('Report sold endpoint not available, triggering sync instead');
        await this.syncInventoryNow();
        return { success: true };
      }

      console.error('Error reporting item sold:', error);
      return { success: false, error: error.message || 'Failed to report item sold' };
    }
  }

  /**
   * Register event listener for inventory sync events
   */
  public on(eventType: InventorySyncEvent['type'], callback: Function): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);
  }

  /**
   * Remove event listener
   */
  public off(eventType: InventorySyncEvent['type'], callback: Function): void {
    if (this.listeners.has(eventType)) {
      const callbacks = this.listeners.get(eventType)!;
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to all listeners
   */
  private emit(eventType: InventorySyncEvent['type'], data: any): void {
    const callbacks = this.listeners.get(eventType) || [];
    callbacks.forEach(callback => {
      try {
        callback({
          type: eventType,
          timestamp: new Date(),
          data,
        } as InventorySyncEvent);
      } catch (error) {
        console.error(`Error in event listener for ${eventType}:`, error);
      }
    });
  }

  /**
   * Get configuration
   */
  public getConfig(): InventorySyncConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<InventorySyncConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Inventory sync config updated:', this.config);
  }

  /**
   * Get last sync time
   */
  public getLastSyncTime(): Date {
    return new Date(this.lastSyncTime);
  }
}

// Export singleton instance
export const inventoryRealtimeSyncService = new InventoryRealtimeSyncService({
  enableRealTimeSync: true,
  pollIntervalMs: 3000,
  enableLocking: true,
  syncOnFocus: true,
});
