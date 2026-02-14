import { useState, useEffect, useCallback } from 'react';
import type { Prompt } from '@/types/prompt';

const MIGRATION_SNAPSHOT_KEY = 'prompts_migration_snapshot';
const HAS_MIGRATED_KEY = 'prompt-library-has-migrated';
const LOCAL_STORAGE_KEY = 'prompts';

export function useSyncEnabled(isAuthenticated: boolean) {
  const syncEnabled = isAuthenticated;

  const [hasMigrated, setHasMigrated] = useState<boolean>(() => {
    return localStorage.getItem(HAS_MIGRATED_KEY) === 'true';
  });

  useEffect(() => {
    localStorage.setItem(HAS_MIGRATED_KEY, String(hasMigrated));
  }, [hasMigrated]);

  const savePreAuthSnapshot = useCallback((prompts: Prompt[]) => {
    if (prompts.length > 0) {
      localStorage.setItem(MIGRATION_SNAPSHOT_KEY, JSON.stringify(prompts));
    }
  }, []);

  const completeMigration = useCallback(() => {
    setHasMigrated(true);
    localStorage.removeItem(MIGRATION_SNAPSHOT_KEY);
  }, []);

  const getLocalPromptsFromStorage = useCallback((): Prompt[] => {
    const snapshot = localStorage.getItem(MIGRATION_SNAPSHOT_KEY);
    if (snapshot) {
      try {
        const parsed = JSON.parse(snapshot);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log(`[Sync] Found ${parsed.length} prompts in pre-auth snapshot`);
          return parsed;
        }
      } catch {}
    }

    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          console.log(`[Sync] Found ${parsed.length} prompts in localStorage`);
          return parsed;
        }
      } catch {}
    }

    return [];
  }, []);

  return {
    syncEnabled,
    hasMigrated,
    savePreAuthSnapshot,
    completeMigration,
    getLocalPromptsFromStorage,
  };
}
