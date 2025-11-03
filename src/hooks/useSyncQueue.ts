import { useState, useCallback, useEffect, useRef } from 'react';
import { useOfflineStorage } from './useOfflineStorage';
import { performSync, setupNetworkListeners, isOnline, type PushPromptData } from '@/lib/syncEngine';
import type { SyncQueueRecord } from '@/lib/db';

export interface SyncQueueStatus {
  pending: number;
  processing: boolean;
  lastSync?: string;
  errors: string[];
  parkedItems: number;
}

export interface UseSyncQueueResult {
  status: SyncQueueStatus;
  queueOperation: (operation: Omit<SyncQueueRecord, 'id' | 'created_at' | 'attempts'>) => Promise<void>;
  flushQueue: () => Promise<void>;
  clearQueue: () => Promise<void>;
  retryParked: () => Promise<void>;
}

const MAX_QUEUE_SIZE = 1000;
const MAX_ATTEMPTS = 5;
const AUTO_FLUSH_INTERVAL_MS = 30000; // 30 seconds

/**
 * Hook for managing sync queue operations
 * Handles queuing, flushing, retry logic, and error parking
 */
export function useSyncQueue(
  deviceId: string | undefined,
  userId: string | undefined
): UseSyncQueueResult {
  const storage = useOfflineStorage();
  
  const [status, setStatus] = useState<SyncQueueStatus>({
    pending: 0,
    processing: false,
    errors: [],
    parkedItems: 0,
  });

  const flushTimerRef = useRef<number>();
  const isFlushingRef = useRef(false);

  /**
   * Update queue status from IndexedDB
   */
  const updateStatus = useCallback(async () => {
    if (!storage.isReady) return;

    try {
      const queue = await storage.getSyncQueue();
      const pending = queue.filter(item => item.attempts < MAX_ATTEMPTS).length;
      const parked = queue.filter(item => item.attempts >= MAX_ATTEMPTS).length;

      setStatus(prev => ({
        ...prev,
        pending,
        parkedItems: parked,
      }));
    } catch (err) {
      console.error('[SyncQueue] Failed to update status:', err);
    }
  }, [storage]);

  /**
   * Add operation to sync queue
   */
  const queueOperation = useCallback(
    async (operation: Omit<SyncQueueRecord, 'id' | 'created_at' | 'attempts'>) => {
      if (!storage.isReady) {
        throw new Error('Storage not ready');
      }

      const queue = await storage.getSyncQueue();
      
      // Check queue size limit
      if (queue.length >= MAX_QUEUE_SIZE) {
        console.warn('[SyncQueue] Queue size limit reached, clearing oldest items');
        await storage.clearSyncQueue();
      }

      await storage.addToSyncQueue(operation);
      await updateStatus();

      // Trigger flush if online
      if (isOnline() && deviceId) {
        scheduleFlush();
      }
    },
    [storage, deviceId, updateStatus]
  );

  /**
   * Schedule automatic flush
   */
  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
    }

    flushTimerRef.current = window.setTimeout(() => {
      if (isOnline() && deviceId && !isFlushingRef.current) {
        flushQueue();
      }
    }, AUTO_FLUSH_INTERVAL_MS);
  }, [deviceId]);

  /**
   * Flush queue by syncing with server
   */
  const flushQueue = useCallback(async () => {
    if (!storage.isReady || !deviceId || !userId || isFlushingRef.current) {
      return;
    }

    if (!isOnline()) {
      console.log('[SyncQueue] Offline, skipping flush');
      return;
    }

    isFlushingRef.current = true;
    setStatus(prev => ({ ...prev, processing: true, errors: [] }));

    try {
      const queue = await storage.getSyncQueue();
      
      // Filter out parked items
      const activeQueue = queue.filter(item => item.attempts < MAX_ATTEMPTS);
      
      if (activeQueue.length === 0) {
        console.log('[SyncQueue] Queue empty, nothing to flush');
        setStatus(prev => ({ ...prev, processing: false }));
        isFlushingRef.current = false;
        return;
      }

      console.log('[SyncQueue] Flushing queue:', activeQueue.length, 'items');

      // Convert queue items to prompts for sync
      const prompts: PushPromptData[] = activeQueue
        .filter(item => item.entity_type === 'prompt')
        .map(item => item.data);

      // Get last sync token
      const deviceInfo = await storage.getDeviceInfo();
      const lastSyncToken = deviceInfo?.sync_token;

      // Perform sync
      const result = await performSync(deviceId, prompts, lastSyncToken);

      if (result.success) {
        // Update sync token
        await storage.setDeviceInfo({
          sync_token: result.syncToken,
          last_sync_at: new Date().toISOString(),
        });

        // Clear successfully synced items
        await storage.clearSyncQueue();
        
        setStatus(prev => ({
          ...prev,
          processing: false,
          lastSync: new Date().toISOString(),
          errors: result.errors,
        }));

        console.log('[SyncQueue] Flush successful');
      } else {
        // Increment attempt count for failed items
        const updatedQueue = activeQueue.map(item => ({
          ...item,
          attempts: item.attempts + 1,
        }));

        // Re-queue items (this is a simplification - in production you'd update individual records)
        await storage.clearSyncQueue();
        for (const item of updatedQueue) {
          await storage.addToSyncQueue({
            operation: item.operation,
            entity_type: item.entity_type,
            entity_id: item.entity_id,
            data: item.data,
          });
        }

        setStatus(prev => ({
          ...prev,
          processing: false,
          errors: result.errors,
        }));

        console.warn('[SyncQueue] Flush failed:', result.errors);
      }

      await updateStatus();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[SyncQueue] Flush error:', error);
      
      setStatus(prev => ({
        ...prev,
        processing: false,
        errors: [error.message],
      }));
    } finally {
      isFlushingRef.current = false;
    }
  }, [storage, deviceId, userId, updateStatus]);

  /**
   * Clear entire queue
   */
  const clearQueue = useCallback(async () => {
    if (!storage.isReady) return;

    await storage.clearSyncQueue();
    await updateStatus();
    
    console.log('[SyncQueue] Queue cleared');
  }, [storage, updateStatus]);

  /**
   * Retry parked items (reset attempt count)
   */
  const retryParked = useCallback(async () => {
    if (!storage.isReady) return;

    const queue = await storage.getSyncQueue();
    const parkedItems = queue.filter(item => item.attempts >= MAX_ATTEMPTS);

    if (parkedItems.length === 0) {
      console.log('[SyncQueue] No parked items to retry');
      return;
    }

    // Clear queue and re-add with reset attempts
    await storage.clearSyncQueue();
    
    for (const item of queue) {
      await storage.addToSyncQueue({
        operation: item.operation,
        entity_type: item.entity_type,
        entity_id: item.entity_id,
        data: item.data,
      });
    }

    await updateStatus();
    
    console.log('[SyncQueue] Retrying', parkedItems.length, 'parked items');

    // Trigger flush
    if (isOnline() && deviceId) {
      await flushQueue();
    }
  }, [storage, deviceId, updateStatus, flushQueue]);

  /**
   * Set up network listeners and auto-flush timer
   */
  useEffect(() => {
    if (!deviceId) return;

    const cleanupNetwork = setupNetworkListeners(
      () => {
        // When coming back online, flush queue
        if (!isFlushingRef.current) {
          flushQueue();
        }
      },
      () => {
        // When going offline, cancel scheduled flush
        if (flushTimerRef.current) {
          clearTimeout(flushTimerRef.current);
        }
      }
    );

    // Initial status update
    updateStatus();

    // Set up auto-flush interval
    scheduleFlush();

    return () => {
      cleanupNetwork();
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, [deviceId, flushQueue, scheduleFlush, updateStatus]);

  return {
    status,
    queueOperation,
    flushQueue,
    clearQueue,
    retryParked,
  };
}
