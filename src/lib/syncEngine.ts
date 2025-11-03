import { supabase } from '@/integrations/supabase/client';
import { computeChecksum } from './checksum';
import type { PromptRecord, TagRecord } from './db';

// Sync status types
export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error' | 'conflicts';

export interface SyncEvent {
  status: SyncStatus;
  message?: string;
  error?: Error;
  conflicts?: ConflictRecord[];
  timestamp: string;
}

export interface ConflictRecord {
  promptId: string;
  revisionId: string;
  serverVersion: {
    title: string;
    content: string;
    updatedAt: string;
  };
  clientVersion: {
    title: string;
    content: string;
    updatedAt: string;
  };
}

export interface SyncResult {
  success: boolean;
  synced: number;
  conflicts: ConflictRecord[];
  errors: string[];
  syncToken?: string;
}

export interface PushPromptData {
  id: string;
  title: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  order: number;
  updatedAt: string;
}

// Retry configuration
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const JITTER_FACTOR = 0.3;

// Event listeners for sync status
type SyncEventListener = (event: SyncEvent) => void;
const syncEventListeners = new Set<SyncEventListener>();

/**
 * Subscribe to sync status events
 */
export function onSyncEvent(listener: SyncEventListener): () => void {
  syncEventListeners.add(listener);
  return () => syncEventListeners.delete(listener);
}

/**
 * Emit sync event to all listeners
 */
function emitSyncEvent(event: SyncEvent): void {
  syncEventListeners.forEach(listener => {
    try {
      listener(event);
    } catch (err) {
      console.error('[SyncEngine] Event listener error:', err);
    }
  });
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoff(attempt: number): number {
  const exponentialDelay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
  const jitter = exponentialDelay * JITTER_FACTOR * (Math.random() * 2 - 1);
  return Math.floor(exponentialDelay + jitter);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Register or update device with the server
 */
export async function registerDevice(
  deviceName: string,
  deviceType: string = 'web'
): Promise<{ deviceId: string; lastSeenAt: string }> {
  console.log('[SyncEngine] Registering device:', deviceName);

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase.functions.invoke('register-device', {
    body: { deviceName, deviceType },
  });

  if (error) {
    console.error('[SyncEngine] Device registration failed:', error);
    throw error;
  }

  if (!data?.deviceId) {
    throw new Error('Invalid response from register-device');
  }

  console.log('[SyncEngine] Device registered:', data.deviceId);
  return data;
}

/**
 * Pull changes from server since last sync
 */
export async function pullFromServer(
  deviceId: string,
  lastSyncToken?: string
): Promise<{
  prompts: PromptRecord[];
  tags: TagRecord[];
  syncToken: string;
}> {
  console.log('[SyncEngine] Pulling from server, token:', lastSyncToken);

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase.functions.invoke('sync-prompts', {
    body: {
      deviceId,
      lastSyncAt: lastSyncToken || null,
      prompts: [], // Pull only, no push
    },
  });

  if (error) {
    console.error('[SyncEngine] Pull failed:', error);
    throw error;
  }

  if (!data) {
    throw new Error('Invalid response from sync-prompts');
  }

  console.log('[SyncEngine] Pulled:', {
    prompts: data.serverPrompts?.length || 0,
    syncToken: data.syncToken,
  });

  // Transform server response to local format
  const prompts: PromptRecord[] = (data.serverPrompts || []).map((p: any) => ({
    id: p.id,
    user_id: p.user_id,
    device_id: p.device_id,
    title: p.title,
    content: p.content,
    checksum: p.checksum,
    isPinned: p.is_pinned,
    order: p.order_index,
    version: p.version,
    tokens: p.tokens,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    archived_at: p.archived_at,
  }));

  // Extract unique tags from server prompts
  const tagMap = new Map<string, TagRecord>();
  (data.serverPrompts || []).forEach((p: any) => {
    (p.tags || []).forEach((tag: any) => {
      if (!tagMap.has(tag.id)) {
        tagMap.set(tag.id, {
          id: tag.id,
          user_id: tag.user_id,
          name: tag.name,
          created_at: tag.created_at,
        });
      }
    });
  });

  return {
    prompts,
    tags: Array.from(tagMap.values()),
    syncToken: data.syncToken,
  };
}

/**
 * Push local changes to server with conflict detection
 */
export async function pushToServer(
  deviceId: string,
  prompts: PushPromptData[],
  lastSyncToken?: string
): Promise<{
  synced: PromptRecord[];
  conflicts: ConflictRecord[];
  syncToken: string;
}> {
  console.log('[SyncEngine] Pushing to server:', prompts.length, 'prompts');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  // Compute checksums for all prompts
  const promptsWithChecksums = await Promise.all(
    prompts.map(async (p) => ({
      id: p.id,
      title: p.title,
      content: p.content,
      checksum: await computeChecksum(p.title, p.content),
      tags: p.tags,
      isPinned: p.isPinned,
      order: p.order,
      updatedAt: p.updatedAt,
    }))
  );

  const { data, error } = await supabase.functions.invoke('sync-prompts', {
    body: {
      deviceId,
      lastSyncAt: lastSyncToken || null,
      prompts: promptsWithChecksums,
    },
  });

  if (error) {
    console.error('[SyncEngine] Push failed:', error);
    throw error;
  }

  if (!data) {
    throw new Error('Invalid response from sync-prompts');
  }

  console.log('[SyncEngine] Push result:', {
    synced: data.synced?.length || 0,
    conflicts: data.conflicts?.length || 0,
  });

  // Transform synced prompts
  const synced: PromptRecord[] = (data.synced || []).map((p: any) => ({
    id: p.id,
    user_id: p.user_id,
    device_id: p.device_id,
    title: p.title,
    content: p.content,
    checksum: p.checksum,
    isPinned: p.is_pinned,
    order: p.order_index,
    version: p.version,
    tokens: p.tokens,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    archived_at: p.archived_at,
  }));

  // Transform conflicts
  const conflicts: ConflictRecord[] = (data.conflicts || []).map((c: any) => ({
    promptId: c.promptId,
    revisionId: c.revisionId,
    serverVersion: {
      title: c.serverVersion.title,
      content: c.serverVersion.content,
      updatedAt: c.serverVersion.updatedAt,
    },
    clientVersion: {
      title: c.clientVersion.title,
      content: c.clientVersion.content,
      updatedAt: c.clientVersion.updatedAt,
    },
  }));

  return {
    synced,
    conflicts,
    syncToken: data.syncToken,
  };
}

/**
 * Resolve a conflict by choosing a resolution strategy
 */
export async function resolveConflict(
  promptId: string,
  revisionId: string,
  strategy: 'keep-current' | 'use-revision' | 'manual-merge',
  mergedData?: { title: string; content: string }
): Promise<void> {
  console.log('[SyncEngine] Resolving conflict:', { promptId, strategy });

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  const { error } = await supabase.functions.invoke('resolve-conflict', {
    body: {
      promptId,
      revisionId,
      strategy,
      mergedData,
    },
  });

  if (error) {
    console.error('[SyncEngine] Conflict resolution failed:', error);
    throw error;
  }

  console.log('[SyncEngine] Conflict resolved');
}

/**
 * Execute sync operation with retry logic
 */
export async function syncWithRetry<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[SyncEngine] ${operationName} attempt ${attempt + 1} failed:`, err);

      // Don't retry on auth errors
      if (lastError.message.includes('auth') || lastError.message.includes('Unauthorized')) {
        throw lastError;
      }

      // Wait before retry (except on last attempt)
      if (attempt < MAX_RETRIES - 1) {
        const delay = calculateBackoff(attempt);
        console.log(`[SyncEngine] Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  throw new Error(`${operationName} failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

/**
 * Full bidirectional sync cycle
 */
export async function performSync(
  deviceId: string,
  localPrompts: PushPromptData[],
  lastSyncToken?: string
): Promise<SyncResult> {
  console.log('[SyncEngine] Starting sync cycle');
  
  emitSyncEvent({
    status: 'syncing',
    message: 'Synchronizing...',
    timestamp: new Date().toISOString(),
  });

  const errors: string[] = [];
  let synced = 0;
  let conflicts: ConflictRecord[] = [];
  let finalSyncToken = lastSyncToken;

  try {
    // Push local changes first
    if (localPrompts.length > 0) {
      const pushResult = await syncWithRetry(
        () => pushToServer(deviceId, localPrompts, lastSyncToken),
        'push'
      );
      
      synced = pushResult.synced.length;
      conflicts = pushResult.conflicts;
      finalSyncToken = pushResult.syncToken;

      if (conflicts.length > 0) {
        emitSyncEvent({
          status: 'conflicts',
          message: `${conflicts.length} conflict(s) detected`,
          conflicts,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Pull any new server changes
    const pullResult = await syncWithRetry(
      () => pullFromServer(deviceId, finalSyncToken),
      'pull'
    );

    finalSyncToken = pullResult.syncToken;

    console.log('[SyncEngine] Sync cycle complete');
    
    emitSyncEvent({
      status: conflicts.length > 0 ? 'conflicts' : 'idle',
      message: 'Sync complete',
      conflicts: conflicts.length > 0 ? conflicts : undefined,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      synced,
      conflicts,
      errors,
      syncToken: finalSyncToken,
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('[SyncEngine] Sync failed:', error);
    
    errors.push(error.message);
    
    emitSyncEvent({
      status: 'error',
      message: error.message,
      error,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      synced,
      conflicts,
      errors,
      syncToken: finalSyncToken,
    };
  }
}

/**
 * Check if we're online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Set up network status listeners
 */
export function setupNetworkListeners(
  onOnline?: () => void,
  onOffline?: () => void
): () => void {
  const handleOnline = () => {
    console.log('[SyncEngine] Network: online');
    emitSyncEvent({
      status: 'idle',
      message: 'Back online',
      timestamp: new Date().toISOString(),
    });
    onOnline?.();
  };

  const handleOffline = () => {
    console.log('[SyncEngine] Network: offline');
    emitSyncEvent({
      status: 'offline',
      message: 'Working offline',
      timestamp: new Date().toISOString(),
    });
    onOffline?.();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Emit initial state
  if (!navigator.onLine) {
    handleOffline();
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
