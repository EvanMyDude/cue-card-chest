/**
 * Rollback utilities for restoring data from backups
 * Provides safe data recovery and cloud cleanup options
 */

import { supabase } from '@/integrations/supabase/client';
import type { BackupData } from './backup';
import type { Prompt } from '@/types/prompt';

export interface RollbackOptions {
  clearSupabase?: boolean;
  clearIndexedDB?: boolean;
  restoreToLocalStorage?: boolean;
}

export interface RollbackResult {
  success: boolean;
  restoredCount: number;
  clearedSupabase: boolean;
  clearedIndexedDB: boolean;
  error?: string;
}

/**
 * Restore prompts from backup to localStorage
 */
export async function restoreToLocalStorage(backup: BackupData): Promise<number> {
  try {
    // Backup prompts are already in the correct format (Prompt type)
    const prompts: Prompt[] = backup.prompts;

    // Store in localStorage
    localStorage.setItem('prompts', JSON.stringify(prompts));
    
    console.log(`[Rollback] Restored ${prompts.length} prompts to localStorage`);
    return prompts.length;
  } catch (err) {
    console.error('[Rollback] Failed to restore to localStorage:', err);
    throw new Error('Failed to restore data to localStorage');
  }
}

/**
 * Clear all user prompts from Supabase
 */
export async function clearSupabaseData(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  try {
    // First get all prompt IDs for the user
    const { data: userPrompts, error: selectError } = await supabase
      .from('prompts')
      .select('id')
      .eq('user_id', user.id);

    if (selectError) throw selectError;

    if (userPrompts && userPrompts.length > 0) {
      const promptIds = userPrompts.map(p => p.id);

      // Delete prompt_tags first (foreign key constraint)
      const { error: tagError } = await supabase
        .from('prompt_tags')
        .delete()
        .in('prompt_id', promptIds);

      if (tagError) throw tagError;

      // Delete prompts
      const { error: promptError } = await supabase
        .from('prompts')
        .delete()
        .eq('user_id', user.id);

      if (promptError) throw promptError;
    }

    console.log('[Rollback] Cleared all Supabase data');
  } catch (err) {
    console.error('[Rollback] Failed to clear Supabase data:', err);
    throw new Error('Failed to clear cloud data');
  }
}

/**
 * Clear IndexedDB data
 */
export async function clearIndexedDBData(): Promise<void> {
  try {
    const { getDB } = await import('./db');
    const db = await getDB();
    
    // Clear all stores
    const tx = db.transaction(['prompts', 'tags', 'prompt_tags', 'sync_queue', 'device_info'], 'readwrite');
    
    await Promise.all([
      tx.objectStore('prompts').clear(),
      tx.objectStore('tags').clear(),
      tx.objectStore('prompt_tags').clear(),
      tx.objectStore('sync_queue').clear(),
      tx.objectStore('device_info').clear(),
    ]);

    await tx.done;
    
    console.log('[Rollback] Cleared all IndexedDB data');
  } catch (err) {
    console.error('[Rollback] Failed to clear IndexedDB:', err);
    throw new Error('Failed to clear local database');
  }
}

/**
 * Parse backup file from JSON string or File object
 */
export async function parseBackupFile(fileOrJson: File | string): Promise<BackupData> {
  try {
    let json: string;
    
    if (fileOrJson instanceof File) {
      json = await fileOrJson.text();
    } else {
      json = fileOrJson;
    }
    
    const backup = JSON.parse(json);
    
    // Basic validation
    if (!backup.manifest || !backup.prompts || !Array.isArray(backup.prompts)) {
      throw new Error('Invalid backup format');
    }
    
    return backup as BackupData;
  } catch (err) {
    console.error('[Rollback] Failed to parse backup:', err);
    throw new Error('Invalid backup file');
  }
}

/**
 * Execute full rollback operation
 */
export async function executeRollback(
  backup: BackupData,
  options: RollbackOptions
): Promise<RollbackResult> {
  const result: RollbackResult = {
    success: false,
    restoredCount: 0,
    clearedSupabase: false,
    clearedIndexedDB: false,
  };

  try {
    // Step 1: Clear Supabase if requested
    if (options.clearSupabase) {
      await clearSupabaseData();
      result.clearedSupabase = true;
    }

    // Step 2: Clear IndexedDB if requested
    if (options.clearIndexedDB) {
      await clearIndexedDBData();
      result.clearedIndexedDB = true;
    }

    // Step 3: Restore to localStorage if requested
    if (options.restoreToLocalStorage) {
      result.restoredCount = await restoreToLocalStorage(backup);
    }

    result.success = true;
    return result;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    return result;
  }
}

/**
 * Log rollback event for audit trail
 */
export function logRollbackEvent(
  action: 'backup' | 'rollback' | 'clear',
  details: Record<string, any>
): void {
  const event = {
    timestamp: new Date().toISOString(),
    action,
    details,
  };

  try {
    const logs = JSON.parse(localStorage.getItem('rollback_logs') || '[]');
    logs.push(event);
    
    // Keep only last 50 events
    if (logs.length > 50) {
      logs.splice(0, logs.length - 50);
    }
    
    localStorage.setItem('rollback_logs', JSON.stringify(logs));
    console.log('[Rollback] Event logged:', event);
  } catch (err) {
    console.error('[Rollback] Failed to log event:', err);
  }
}

/**
 * Get rollback logs
 */
export function getRollbackLogs(): Array<{
  timestamp: string;
  action: string;
  details: Record<string, any>;
}> {
  try {
    return JSON.parse(localStorage.getItem('rollback_logs') || '[]');
  } catch {
    return [];
  }
}
