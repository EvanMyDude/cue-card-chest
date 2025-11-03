import { useState, useCallback, useEffect } from 'react';
import {
  getDB,
  validatePromptSize,
  validateUUID,
  clearStore,
  type PromptRecord,
  type TagRecord,
  type PromptTagRecord,
  type SyncQueueRecord,
  type DeviceInfoRecord,
} from '@/lib/db';
import type { Prompt } from '@/types/prompt';

export interface UseOfflineStorageResult {
  // Prompts
  getPromptById: (id: string) => Promise<Prompt | null>;
  listPrompts: (userId: string) => Promise<Prompt[]>;
  putPrompt: (prompt: PromptRecord) => Promise<void>;
  bulkPutPrompts: (prompts: PromptRecord[]) => Promise<void>;
  softDeletePrompt: (id: string) => Promise<void>;
  
  // Tags
  getTagById: (id: string) => Promise<TagRecord | null>;
  listTags: (userId: string) => Promise<TagRecord[]>;
  putTag: (tag: TagRecord) => Promise<void>;
  bulkPutTags: (tags: TagRecord[]) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  
  // Prompt-Tags relationships
  getPromptTags: (promptId: string) => Promise<TagRecord[]>;
  setPromptTags: (promptId: string, tagIds: string[]) => Promise<void>;
  
  // Sync queue
  addToSyncQueue: (record: Omit<SyncQueueRecord, 'id' | 'created_at' | 'attempts'>) => Promise<void>;
  getSyncQueue: () => Promise<SyncQueueRecord[]>;
  clearSyncQueue: () => Promise<void>;
  
  // Device info
  getDeviceInfo: () => Promise<DeviceInfoRecord | null>;
  setDeviceInfo: (info: Partial<DeviceInfoRecord>) => Promise<void>;
  
  // Utilities
  clearAllStores: () => Promise<void>;
  isReady: boolean;
  error: Error | null;
}

/**
 * React hook for offline storage operations
 * Provides typed CRUD operations for prompts, tags, and sync management
 */
export function useOfflineStorage(): UseOfflineStorageResult {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    getDB()
      .then(() => {
        setIsReady(true);
        console.log('[OfflineStorage] IndexedDB ready');
      })
      .catch((err) => {
        console.error('[OfflineStorage] Failed to initialize DB:', err);
        setError(err);
      });
  }, []);

  // ==================== PROMPTS ====================

  const getPromptById = useCallback(async (id: string): Promise<Prompt | null> => {
    try {
      validateUUID(id);
      const db = await getDB();
      const promptRecord = await db.get('prompts', id);
      
      if (!promptRecord || promptRecord.archived_at) return null;
      
      // Fetch associated tags
      const tagRecords = await getPromptTags(id);
      
      return convertToPrompt(promptRecord, tagRecords);
    } catch (err) {
      console.error('[OfflineStorage] getPromptById error:', err);
      throw err;
    }
  }, []);

  const listPrompts = useCallback(async (userId: string): Promise<Prompt[]> => {
    try {
      const db = await getDB();
      const tx = db.transaction(['prompts', 'prompt_tags', 'tags'], 'readonly');
      
      // Get all non-archived prompts for user
      const allPrompts = await tx.objectStore('prompts').index('by-user').getAll(userId);
      const activePrompts = allPrompts.filter(p => !p.archived_at);
      
      // Fetch tags for each prompt
      const promptsWithTags = await Promise.all(
        activePrompts.map(async (promptRecord) => {
          const tagRecords = await getPromptTagsInternal(promptRecord.id, tx);
          return convertToPrompt(promptRecord, tagRecords);
        })
      );
      
      await tx.done;
      
      // Sort by pinned, then order_index, then updated_at
      return promptsWithTags.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        if (a.order !== b.order) return a.order - b.order;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    } catch (err) {
      console.error('[OfflineStorage] listPrompts error:', err);
      throw err;
    }
  }, []);

  const putPrompt = useCallback(async (prompt: PromptRecord): Promise<void> => {
    try {
      validateUUID(prompt.id);
      validatePromptSize(prompt);
      
      const db = await getDB();
      await db.put('prompts', prompt);
      console.log(`[OfflineStorage] Saved prompt: ${prompt.id}`);
    } catch (err) {
      console.error('[OfflineStorage] putPrompt error:', err);
      throw err;
    }
  }, []);

  const bulkPutPrompts = useCallback(async (prompts: PromptRecord[]): Promise<void> => {
    try {
      prompts.forEach(p => {
        validateUUID(p.id);
        validatePromptSize(p);
      });
      
      const db = await getDB();
      const tx = db.transaction('prompts', 'readwrite');
      
      await Promise.all(prompts.map(p => tx.store.put(p)));
      await tx.done;
      
      console.log(`[OfflineStorage] Bulk saved ${prompts.length} prompts`);
    } catch (err) {
      console.error('[OfflineStorage] bulkPutPrompts error:', err);
      throw err;
    }
  }, []);

  const softDeletePrompt = useCallback(async (id: string): Promise<void> => {
    try {
      validateUUID(id);
      const db = await getDB();
      const prompt = await db.get('prompts', id);
      
      if (!prompt) {
        console.warn(`[OfflineStorage] Prompt not found for soft delete: ${id}`);
        return;
      }
      
      prompt.archived_at = new Date().toISOString();
      await db.put('prompts', prompt);
      console.log(`[OfflineStorage] Soft deleted prompt: ${id}`);
    } catch (err) {
      console.error('[OfflineStorage] softDeletePrompt error:', err);
      throw err;
    }
  }, []);

  // ==================== TAGS ====================

  const getTagById = useCallback(async (id: string): Promise<TagRecord | null> => {
    try {
      validateUUID(id);
      const db = await getDB();
      return (await db.get('tags', id)) || null;
    } catch (err) {
      console.error('[OfflineStorage] getTagById error:', err);
      throw err;
    }
  }, []);

  const listTags = useCallback(async (userId: string): Promise<TagRecord[]> => {
    try {
      const db = await getDB();
      const tags = await db.getAllFromIndex('tags', 'by-user', userId);
      return tags.sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      console.error('[OfflineStorage] listTags error:', err);
      throw err;
    }
  }, []);

  const putTag = useCallback(async (tag: TagRecord): Promise<void> => {
    try {
      validateUUID(tag.id);
      const db = await getDB();
      await db.put('tags', tag);
      console.log(`[OfflineStorage] Saved tag: ${tag.name}`);
    } catch (err) {
      console.error('[OfflineStorage] putTag error:', err);
      throw err;
    }
  }, []);

  const bulkPutTags = useCallback(async (tags: TagRecord[]): Promise<void> => {
    try {
      tags.forEach(t => validateUUID(t.id));
      
      const db = await getDB();
      const tx = db.transaction('tags', 'readwrite');
      
      await Promise.all(tags.map(t => tx.store.put(t)));
      await tx.done;
      
      console.log(`[OfflineStorage] Bulk saved ${tags.length} tags`);
    } catch (err) {
      console.error('[OfflineStorage] bulkPutTags error:', err);
      throw err;
    }
  }, []);

  const deleteTag = useCallback(async (id: string): Promise<void> => {
    try {
      validateUUID(id);
      const db = await getDB();
      const tx = db.transaction(['tags', 'prompt_tags'], 'readwrite');
      
      // Delete tag
      await tx.objectStore('tags').delete(id);
      
      // Delete all prompt_tag relationships
      const tagIndex = tx.objectStore('prompt_tags').index('by-tag');
      const relations = await tagIndex.getAll(id);
      await Promise.all(
        relations.map(r => 
          tx.objectStore('prompt_tags').delete([r.prompt_id, r.tag_id])
        )
      );
      
      await tx.done;
      console.log(`[OfflineStorage] Deleted tag: ${id}`);
    } catch (err) {
      console.error('[OfflineStorage] deleteTag error:', err);
      throw err;
    }
  }, []);

  // ==================== PROMPT-TAGS ====================

  const getPromptTags = useCallback(async (promptId: string): Promise<TagRecord[]> => {
    const db = await getDB();
    const tx = db.transaction(['prompt_tags', 'tags'], 'readonly');
    const tags = await getPromptTagsInternal(promptId, tx);
    await tx.done;
    return tags;
  }, []);

  const setPromptTags = useCallback(async (promptId: string, tagIds: string[]): Promise<void> => {
    try {
      validateUUID(promptId);
      tagIds.forEach(validateUUID);
      
      const db = await getDB();
      const tx = db.transaction('prompt_tags', 'readwrite');
      
      // Remove existing tags
      const existingRelations = await tx.store.index('by-prompt').getAll(promptId);
      await Promise.all(
        existingRelations.map(r => 
          tx.store.delete([r.prompt_id, r.tag_id])
        )
      );
      
      // Add new tags
      await Promise.all(
        tagIds.map(tagId =>
          tx.store.put({ prompt_id: promptId, tag_id: tagId })
        )
      );
      
      await tx.done;
      console.log(`[OfflineStorage] Updated tags for prompt: ${promptId}`);
    } catch (err) {
      console.error('[OfflineStorage] setPromptTags error:', err);
      throw err;
    }
  }, []);

  // ==================== SYNC QUEUE ====================

  const addToSyncQueue = useCallback(
    async (record: Omit<SyncQueueRecord, 'id' | 'created_at' | 'attempts'>): Promise<void> => {
      try {
        const db = await getDB();
        await db.add('sync_queue', {
          ...record,
          created_at: new Date().toISOString(),
          attempts: 0,
        });
        console.log(`[OfflineStorage] Added to sync queue: ${record.operation} ${record.entity_type}`);
      } catch (err) {
        console.error('[OfflineStorage] addToSyncQueue error:', err);
        throw err;
      }
    },
    []
  );

  const getSyncQueue = useCallback(async (): Promise<SyncQueueRecord[]> => {
    try {
      const db = await getDB();
      return await db.getAllFromIndex('sync_queue', 'by-created');
    } catch (err) {
      console.error('[OfflineStorage] getSyncQueue error:', err);
      throw err;
    }
  }, []);

  const clearSyncQueue = useCallback(async (): Promise<void> => {
    try {
      await clearStore('sync_queue');
    } catch (err) {
      console.error('[OfflineStorage] clearSyncQueue error:', err);
      throw err;
    }
  }, []);

  // ==================== DEVICE INFO ====================

  const getDeviceInfo = useCallback(async (): Promise<DeviceInfoRecord | null> => {
    try {
      const db = await getDB();
      return (await db.get('device_info', 'current')) || null;
    } catch (err) {
      console.error('[OfflineStorage] getDeviceInfo error:', err);
      throw err;
    }
  }, []);

  const setDeviceInfo = useCallback(async (info: Partial<DeviceInfoRecord>): Promise<void> => {
    try {
      const db = await getDB();
      const existing = await db.get('device_info', 'current');
      
      await db.put('device_info', {
        key: 'current',
        ...existing,
        ...info,
      });
      
      console.log('[OfflineStorage] Updated device info');
    } catch (err) {
      console.error('[OfflineStorage] setDeviceInfo error:', err);
      throw err;
    }
  }, []);

  // ==================== UTILITIES ====================

  const clearAllStores = useCallback(async (): Promise<void> => {
    try {
      await Promise.all([
        clearStore('prompts'),
        clearStore('tags'),
        clearStore('prompt_tags'),
        clearStore('sync_queue'),
      ]);
      console.log('[OfflineStorage] Cleared all stores');
    } catch (err) {
      console.error('[OfflineStorage] clearAllStores error:', err);
      throw err;
    }
  }, []);

  return {
    getPromptById,
    listPrompts,
    putPrompt,
    bulkPutPrompts,
    softDeletePrompt,
    getTagById,
    listTags,
    putTag,
    bulkPutTags,
    deleteTag,
    getPromptTags,
    setPromptTags,
    addToSyncQueue,
    getSyncQueue,
    clearSyncQueue,
    getDeviceInfo,
    setDeviceInfo,
    clearAllStores,
    isReady,
    error,
  };
}

// ==================== HELPERS ====================

/**
 * Convert PromptRecord to Prompt type with tags
 */
function convertToPrompt(record: PromptRecord, tags: TagRecord[]): Prompt {
  return {
    id: record.id,
    title: record.title,
    content: record.content,
    tags: tags.map(t => t.name),
    isPinned: record.isPinned,
    order: record.order,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Internal helper to get tags for a prompt within a transaction
 */
async function getPromptTagsInternal(
  promptId: string,
  tx: any
): Promise<TagRecord[]> {
  const relations = await tx.objectStore('prompt_tags').index('by-prompt').getAll(promptId);
  const tags = await Promise.all(
    relations.map((r: PromptTagRecord) => tx.objectStore('tags').get(r.tag_id))
  );
  return tags.filter((t: TagRecord | undefined): t is TagRecord => t !== undefined);
}
