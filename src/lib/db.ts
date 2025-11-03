import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Prompt } from '@/types/prompt';

// Database schema version
export const DB_VERSION = 1;
export const DB_NAME = 'prompts-offline-db';

// Size limits
export const MAX_PROMPT_SIZE = 500 * 1024; // 500KB per prompt
export const MAX_CONTENT_LENGTH = 100000; // 100k characters
export const MAX_TITLE_LENGTH = 500;

// Database schema interfaces
export interface PromptRecord {
  id: string;
  user_id: string;
  device_id?: string;
  title: string;
  content: string;
  checksum: string;
  isPinned: boolean;
  order: number;
  version: number;
  tokens?: number;
  createdAt: string;
  updatedAt: string;
  archived_at?: string;
}

export interface TagRecord {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface PromptTagRecord {
  prompt_id: string;
  tag_id: string;
}

export interface SyncQueueRecord {
  id?: number;
  operation: 'create' | 'update' | 'delete';
  entity_type: 'prompt' | 'tag' | 'prompt_tag';
  entity_id: string;
  data: any;
  created_at: string;
  attempts: number;
}

export interface DeviceInfoRecord {
  key: 'current';
  device_id?: string;
  device_name?: string;
  device_type?: string;
  last_sync_at?: string;
  sync_token?: string;
}

// IndexedDB schema definition
interface PromptsDB extends DBSchema {
  prompts: {
    key: string;
    value: PromptRecord;
    indexes: {
      'by-updated': string;
      'by-pinned': number;
      'by-user': string;
    };
  };
  tags: {
    key: string;
    value: TagRecord;
    indexes: {
      'by-name': string;
      'by-user': string;
    };
  };
  prompt_tags: {
    key: [string, string]; // composite: [prompt_id, tag_id]
    value: PromptTagRecord;
    indexes: {
      'by-prompt': string;
      'by-tag': string;
    };
  };
  sync_queue: {
    key: number;
    value: SyncQueueRecord;
    indexes: {
      'by-created': string;
      'by-entity': string;
    };
  };
  device_info: {
    key: 'current';
    value: DeviceInfoRecord;
  };
}

let dbInstance: IDBPDatabase<PromptsDB> | null = null;

/**
 * Initialize and open the IndexedDB database
 */
export async function initDB(): Promise<IDBPDatabase<PromptsDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<PromptsDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      console.log(`[DB] Upgrading from v${oldVersion} to v${newVersion}`);

      // Version 1: Initial schema
      if (oldVersion < 1) {
        // Prompts store
        const promptsStore = db.createObjectStore('prompts', { keyPath: 'id' });
        promptsStore.createIndex('by-updated', 'updatedAt');
        promptsStore.createIndex('by-pinned', 'isPinned');
        promptsStore.createIndex('by-user', 'user_id');

        // Tags store
        const tagsStore = db.createObjectStore('tags', { keyPath: 'id' });
        tagsStore.createIndex('by-name', 'name');
        tagsStore.createIndex('by-user', 'user_id');

        // Prompt-Tags junction store
        const promptTagsStore = db.createObjectStore('prompt_tags', {
          keyPath: ['prompt_id', 'tag_id'],
        });
        promptTagsStore.createIndex('by-prompt', 'prompt_id');
        promptTagsStore.createIndex('by-tag', 'tag_id');

        // Sync queue store
        const syncQueueStore = db.createObjectStore('sync_queue', {
          keyPath: 'id',
          autoIncrement: true,
        });
        syncQueueStore.createIndex('by-created', 'created_at');
        syncQueueStore.createIndex('by-entity', 'entity_id');

        // Device info store (single record)
        db.createObjectStore('device_info', { keyPath: 'key' });
      }

      // Future migrations go here
      // if (oldVersion < 2) { ... }
    },
    blocked() {
      console.warn('[DB] Database upgrade blocked by another tab');
    },
    blocking() {
      console.warn('[DB] This tab is blocking database upgrade');
      dbInstance?.close();
      dbInstance = null;
    },
    terminated() {
      console.error('[DB] Database connection unexpectedly terminated');
      dbInstance = null;
    },
  });

  return dbInstance;
}

/**
 * Get the database instance, initializing if needed
 */
export async function getDB(): Promise<IDBPDatabase<PromptsDB>> {
  if (!dbInstance) {
    return await initDB();
  }
  return dbInstance;
}

/**
 * Close the database connection
 */
export function closeDB(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Validate prompt size before storing
 */
export function validatePromptSize(prompt: PromptRecord): void {
  const size = JSON.stringify(prompt).length;
  if (size > MAX_PROMPT_SIZE) {
    throw new Error(`Prompt exceeds maximum size of ${MAX_PROMPT_SIZE} bytes`);
  }
  if (prompt.content.length > MAX_CONTENT_LENGTH) {
    throw new Error(`Content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters`);
  }
  if (prompt.title.length > MAX_TITLE_LENGTH) {
    throw new Error(`Title exceeds maximum length of ${MAX_TITLE_LENGTH} characters`);
  }
}

/**
 * Validate record key format (UUID)
 */
export function validateUUID(id: string): void {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    throw new Error(`Invalid UUID format: ${id}`);
  }
}

/**
 * Clear all data from a specific store
 */
export async function clearStore(storeName: 'prompts' | 'tags' | 'prompt_tags' | 'sync_queue' | 'device_info'): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(storeName, 'readwrite');
  await tx.store.clear();
  await tx.done;
  console.log(`[DB] Cleared store: ${storeName}`);
}

/**
 * Get database statistics
 */
export async function getDBStats() {
  const db = await getDB();
  const tx = db.transaction(['prompts', 'tags', 'prompt_tags', 'sync_queue'], 'readonly');
  
  const [promptsCount, tagsCount, promptTagsCount, syncQueueCount] = await Promise.all([
    tx.objectStore('prompts').count(),
    tx.objectStore('tags').count(),
    tx.objectStore('prompt_tags').count(),
    tx.objectStore('sync_queue').count(),
  ]);

  await tx.done;

  return {
    prompts: promptsCount,
    tags: tagsCount,
    prompt_tags: promptTagsCount,
    sync_queue: syncQueueCount,
  };
}

/**
 * Export all data for backup
 */
export async function exportAllData() {
  const db = await getDB();
  const tx = db.transaction(['prompts', 'tags', 'prompt_tags', 'device_info'], 'readonly');

  const [prompts, tags, promptTags, deviceInfo] = await Promise.all([
    tx.objectStore('prompts').getAll(),
    tx.objectStore('tags').getAll(),
    tx.objectStore('prompt_tags').getAll(),
    tx.objectStore('device_info').get('current'),
  ]);

  await tx.done;

  return {
    version: DB_VERSION,
    exported_at: new Date().toISOString(),
    data: { prompts, tags, promptTags, deviceInfo },
  };
}
