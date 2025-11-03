import { useState, useCallback, useEffect } from 'react';
import { useOfflineStorage } from './useOfflineStorage';
import { useSyncQueue } from './useSyncQueue';
import { useAuth } from './useAuth';
import { computeChecksum } from '@/lib/checksum';
import { onSyncEvent, type SyncStatus, type ConflictRecord } from '@/lib/syncEngine';
import type { Prompt } from '@/types/prompt';
import type { PromptRecord } from '@/lib/db';

export interface UsePromptsResult {
  prompts: Prompt[];
  loading: boolean;
  syncStatus: SyncStatus;
  conflicts: ConflictRecord[];
  
  // CRUD operations
  getPrompt: (id: string) => Promise<Prompt | null>;
  createPrompt: (data: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Prompt>;
  updatePrompt: (id: string, data: Partial<Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<Prompt>;
  deletePrompt: (id: string) => Promise<void>;
  reorderPrompts: (prompts: Prompt[]) => Promise<void>;
  
  // Sync operations
  syncNow: () => Promise<void>;
  resolveConflict: (promptId: string, strategy: 'keep-current' | 'use-revision') => Promise<void>;
  
  // Utilities
  refresh: () => Promise<void>;
}

/**
 * Main hook for prompt CRUD operations with offline-first sync
 * Reads from IndexedDB first, enqueues writes when offline
 */
export function usePrompts(): UsePromptsResult {
  const { user } = useAuth();
  const storage = useOfflineStorage();
  
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [deviceId, setDeviceId] = useState<string>();

  // Initialize sync queue
  const syncQueue = useSyncQueue(deviceId, user?.id);

  /**
   * Load device ID from IndexedDB
   */
  useEffect(() => {
    if (!storage.isReady) return;

    storage.getDeviceInfo().then(info => {
      if (info?.device_id) {
        setDeviceId(info.device_id);
      }
    });
  }, [storage]);

  /**
   * Load prompts from IndexedDB
   */
  const loadPrompts = useCallback(async () => {
    if (!storage.isReady || !user) {
      return;
    }

    try {
      const loadedPrompts = await storage.listPrompts(user.id);
      setPrompts(loadedPrompts);
    } catch (err) {
      console.error('[usePrompts] Failed to load prompts:', err);
    }
  }, [storage, user]);

  /**
   * Initial load
   */
  useEffect(() => {
    if (!storage.isReady) return;

    setLoading(true);
    loadPrompts().finally(() => setLoading(false));
  }, [storage.isReady, loadPrompts]);

  /**
   * Subscribe to sync events
   */
  useEffect(() => {
    return onSyncEvent(event => {
      setSyncStatus(event.status);
      
      if (event.conflicts) {
        setConflicts(event.conflicts);
      }
      
      if (event.status === 'idle' && event.conflicts === undefined) {
        setConflicts([]);
      }
    });
  }, []);

  /**
   * Get single prompt by ID
   */
  const getPrompt = useCallback(
    async (id: string): Promise<Prompt | null> => {
      if (!storage.isReady) return null;
      return await storage.getPromptById(id);
    },
    [storage]
  );

  /**
   * Create new prompt
   */
  const createPrompt = useCallback(
    async (data: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>): Promise<Prompt> => {
      if (!storage.isReady || !user) {
        throw new Error('Storage not ready or user not authenticated');
      }

      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const checksum = await computeChecksum(data.title, data.content);

      const promptRecord: PromptRecord = {
        id,
        user_id: user.id,
        device_id: deviceId,
        title: data.title,
        content: data.content,
        checksum,
        isPinned: data.isPinned,
        order: data.order,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };

      // Save to IndexedDB
      await storage.putPrompt(promptRecord);

      // Handle tags
      if (data.tags.length > 0) {
        const existingTags = await storage.listTags(user.id);
        const tagMap = new Map(existingTags.map(t => [t.name, t.id]));
        const tagIds: string[] = [];

        for (const tagName of data.tags) {
          let tagId = tagMap.get(tagName);
          if (!tagId) {
            tagId = crypto.randomUUID();
            await storage.putTag({
              id: tagId,
              user_id: user.id,
              name: tagName,
              created_at: now,
            });
          }
          tagIds.push(tagId);
        }

        await storage.setPromptTags(id, tagIds);
      }

      // Queue for sync
      await syncQueue.queueOperation({
        operation: 'create',
        entity_type: 'prompt',
        entity_id: id,
        data: {
          id,
          title: data.title,
          content: data.content,
          tags: data.tags,
          isPinned: data.isPinned,
          order: data.order,
          updatedAt: now,
        },
      });

      await loadPrompts();

      const newPrompt: Prompt = {
        id,
        title: data.title,
        content: data.content,
        tags: data.tags,
        isPinned: data.isPinned,
        order: data.order,
        createdAt: now,
        updatedAt: now,
      };

      return newPrompt;
    },
    [storage, user, deviceId, syncQueue, loadPrompts]
  );

  /**
   * Update existing prompt
   */
  const updatePrompt = useCallback(
    async (
      id: string,
      data: Partial<Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>>
    ): Promise<Prompt> => {
      if (!storage.isReady || !user) {
        throw new Error('Storage not ready or user not authenticated');
      }

      const existing = await storage.getPromptById(id);
      if (!existing) {
        throw new Error('Prompt not found');
      }

      const now = new Date().toISOString();
      const title = data.title ?? existing.title;
      const content = data.content ?? existing.content;
      const checksum = await computeChecksum(title, content);

      // Fetch the PromptRecord from IndexedDB
      const existingPromptRecords = await storage.listPrompts(user.id);
      const matchingPrompt = existingPromptRecords.find(p => p.id === id);
      
      // We need to get the raw PromptRecord for version info
      const rawRecord = matchingPrompt ? 
        await (async () => {
          const db = await import('@/lib/db').then(m => m.getDB());
          return await db.get('prompts', id);
        })() : null;
      
      if (!rawRecord) {
        throw new Error('Prompt record not found');
      }

      const updatedRecord: PromptRecord = {
        id: rawRecord.id,
        user_id: rawRecord.user_id,
        device_id: rawRecord.device_id,
        title,
        content,
        checksum,
        isPinned: data.isPinned ?? existing.isPinned,
        order: data.order ?? existing.order,
        version: rawRecord.version + 1,
        tokens: rawRecord.tokens,
        createdAt: rawRecord.createdAt,
        updatedAt: now,
        archived_at: rawRecord.archived_at,
      };

      await storage.putPrompt(updatedRecord);

      // Handle tags if provided
      if (data.tags !== undefined) {
        const existingTags = await storage.listTags(user.id);
        const tagMap = new Map(existingTags.map(t => [t.name, t.id]));
        const tagIds: string[] = [];

        for (const tagName of data.tags) {
          let tagId = tagMap.get(tagName);
          if (!tagId) {
            tagId = crypto.randomUUID();
            await storage.putTag({
              id: tagId,
              user_id: user.id,
              name: tagName,
              created_at: now,
            });
          }
          tagIds.push(tagId);
        }

        await storage.setPromptTags(id, tagIds);
      }

      // Queue for sync
      await syncQueue.queueOperation({
        operation: 'update',
        entity_type: 'prompt',
        entity_id: id,
        data: {
          id,
          title,
          content,
          tags: data.tags ?? existing.tags,
          isPinned: data.isPinned ?? existing.isPinned,
          order: data.order ?? existing.order,
          updatedAt: now,
        },
      });

      await loadPrompts();

      return {
        ...existing,
        ...data,
        id,
        title,
        content,
        updatedAt: now,
      };
    },
    [storage, user, syncQueue, loadPrompts]
  );

  /**
   * Soft delete prompt
   */
  const deletePrompt = useCallback(
    async (id: string): Promise<void> => {
      if (!storage.isReady) {
        throw new Error('Storage not ready');
      }

      await storage.softDeletePrompt(id);

      // Queue for sync
      await syncQueue.queueOperation({
        operation: 'delete',
        entity_type: 'prompt',
        entity_id: id,
        data: { id },
      });

      await loadPrompts();
    },
    [storage, syncQueue, loadPrompts]
  );

  /**
   * Reorder prompts
   */
  const reorderPrompts = useCallback(
    async (reorderedPrompts: Prompt[]): Promise<void> => {
      if (!storage.isReady || !user) {
        throw new Error('Storage not ready or user not authenticated');
      }

      const now = new Date().toISOString();
      const updates: PromptRecord[] = [];
      const db = await import('@/lib/db').then(m => m.getDB());

      for (let i = 0; i < reorderedPrompts.length; i++) {
        const prompt = reorderedPrompts[i];
        const rawRecord = await db.get('prompts', prompt.id);
        
        if (rawRecord) {
          updates.push({
            ...rawRecord,
            order: i,
            updatedAt: now,
          });
        }
      }

      await storage.bulkPutPrompts(updates);

      // Queue each update
      for (const update of updates) {
        await syncQueue.queueOperation({
          operation: 'update',
          entity_type: 'prompt',
          entity_id: update.id,
          data: {
            id: update.id,
            title: update.title,
            content: update.content,
            tags: [], // Tags not changed during reorder
            isPinned: update.isPinned,
            order: update.order,
            updatedAt: update.updatedAt,
          },
        });
      }

      await loadPrompts();
    },
    [storage, user, syncQueue, loadPrompts]
  );

  /**
   * Manually trigger sync
   */
  const syncNow = useCallback(async () => {
    await syncQueue.flushQueue();
    await loadPrompts();
  }, [syncQueue, loadPrompts]);

  /**
   * Resolve a conflict
   */
  const resolveConflict = useCallback(
    async (promptId: string, strategy: 'keep-current' | 'use-revision'): Promise<void> => {
      // Find conflict
      const conflict = conflicts.find(c => c.promptId === promptId);
      if (!conflict) {
        throw new Error('Conflict not found');
      }

      // Call resolve conflict edge function
      await import('@/lib/syncEngine').then(({ resolveConflict }) =>
        resolveConflict(promptId, conflict.revisionId, strategy)
      );

      // Remove from conflicts
      setConflicts(prev => prev.filter(c => c.promptId !== promptId));

      // Refresh prompts
      await loadPrompts();
    },
    [conflicts, loadPrompts]
  );

  /**
   * Refresh prompts from IndexedDB
   */
  const refresh = useCallback(async () => {
    setLoading(true);
    await loadPrompts();
    setLoading(false);
  }, [loadPrompts]);

  return {
    prompts,
    loading,
    syncStatus,
    conflicts,
    getPrompt,
    createPrompt,
    updatePrompt,
    deletePrompt,
    reorderPrompts,
    syncNow,
    resolveConflict,
    refresh,
  };
}
