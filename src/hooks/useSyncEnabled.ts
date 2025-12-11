import { useState, useEffect, useCallback } from 'react';
import type { Prompt } from '@/types/prompt';

const MIGRATION_SNAPSHOT_KEY = 'prompts_migration_snapshot';
const HAS_MIGRATED_KEY = 'prompt-library-has-migrated';

export function useSyncEnabled(isAuthenticated: boolean) {
  // syncEnabled is derived from authentication state
  const syncEnabled = isAuthenticated;
  
  const [hasMigrated, setHasMigrated] = useState<boolean>(() => {
    return localStorage.getItem(HAS_MIGRATED_KEY) === 'true';
  });

  // Update hasMigrated in localStorage
  useEffect(() => {
    localStorage.setItem(HAS_MIGRATED_KEY, String(hasMigrated));
  }, [hasMigrated]);

  /**
   * Save a snapshot of local prompts before auth redirect
   * This protects against data loss during OAuth/magic link redirects
   */
  const savePreAuthSnapshot = useCallback((prompts: Prompt[]) => {
    if (prompts.length > 0) {
      localStorage.setItem(MIGRATION_SNAPSHOT_KEY, JSON.stringify(prompts));
    }
  }, []);

  /**
   * Get the pre-auth snapshot if it exists
   */
  const getPreAuthSnapshot = useCallback((): Prompt[] | null => {
    const snapshot = localStorage.getItem(MIGRATION_SNAPSHOT_KEY);
    if (!snapshot) return null;
    
    try {
      return JSON.parse(snapshot);
    } catch {
      return null;
    }
  }, []);

  /**
   * Clear the pre-auth snapshot after successful migration
   */
  const clearPreAuthSnapshot = useCallback(() => {
    localStorage.removeItem(MIGRATION_SNAPSHOT_KEY);
  }, []);

  /**
   * Check if we need to show the migration wizard
   * - User is authenticated
   * - User hasn't migrated yet on this device
   * - There are local prompts to migrate (either in localStorage or snapshot)
   */
  const shouldShowMigrationWizard = useCallback((localPrompts: Prompt[]): boolean => {
    if (!isAuthenticated) return false;
    if (hasMigrated) return false;
    
    const snapshot = getPreAuthSnapshot();
    const hasLocalData = localPrompts.length > 0 || (snapshot && snapshot.length > 0);
    
    return hasLocalData;
  }, [isAuthenticated, hasMigrated, getPreAuthSnapshot]);

  /**
   * Mark migration as complete for this device
   */
  const completeMigration = useCallback(() => {
    setHasMigrated(true);
    clearPreAuthSnapshot();
  }, [clearPreAuthSnapshot]);

  /**
   * Reset migration state (useful for testing or re-syncing)
   */
  const resetMigrationState = useCallback(() => {
    setHasMigrated(false);
    clearPreAuthSnapshot();
  }, [clearPreAuthSnapshot]);

  return {
    syncEnabled,
    hasMigrated,
    savePreAuthSnapshot,
    getPreAuthSnapshot,
    clearPreAuthSnapshot,
    shouldShowMigrationWizard,
    completeMigration,
    resetMigrationState,
  };
}
