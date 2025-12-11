import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

const HAS_MIGRATED_KEY = 'promptLibrary_hasMigrated';
const MIGRATION_DISMISSED_KEY = 'promptLibrary_migrationDismissed';

interface UseSyncEnabledReturn {
  syncEnabled: boolean;
  hasMigrated: boolean;
  setHasMigrated: (migrated: boolean) => void;
  migrationDismissed: boolean;
  setMigrationDismissed: (dismissed: boolean) => void;
  clearMigrationState: () => void;
}

/**
 * syncEnabled is now DERIVED from auth state:
 * - true when user is authenticated (cloud is source of truth)
 * - false when not authenticated (local-only mode)
 * 
 * hasMigrated tracks whether this device has completed the initial migration
 * of local prompts to the cloud (per-device flag).
 * 
 * migrationDismissed tracks if user cancelled the migration wizard.
 * This allows cloud fetch to proceed without the wizard blocking forever.
 */
export function useSyncEnabled(): UseSyncEnabledReturn {
  const { isAuthenticated } = useAuth();
  
  // hasMigrated is per-device: tracks if local prompts were migrated
  const [hasMigrated, setHasMigratedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(HAS_MIGRATED_KEY);
    return stored === 'true';
  });

  // migrationDismissed tracks if user cancelled the migration wizard
  const [migrationDismissed, setMigrationDismissedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(MIGRATION_DISMISSED_KEY);
    return stored === 'true';
  });

  // Persist hasMigrated changes
  useEffect(() => {
    localStorage.setItem(HAS_MIGRATED_KEY, String(hasMigrated));
  }, [hasMigrated]);

  // Persist migrationDismissed changes
  useEffect(() => {
    localStorage.setItem(MIGRATION_DISMISSED_KEY, String(migrationDismissed));
  }, [migrationDismissed]);

  const setHasMigrated = useCallback((migrated: boolean) => {
    console.log('[useSyncEnabled] Setting hasMigrated:', migrated);
    setHasMigratedState(migrated);
  }, []);

  const setMigrationDismissed = useCallback((dismissed: boolean) => {
    console.log('[useSyncEnabled] Setting migrationDismissed:', dismissed);
    setMigrationDismissedState(dismissed);
  }, []);

  // Clear all migration state (useful for sign out or reset)
  const clearMigrationState = useCallback(() => {
    console.log('[useSyncEnabled] Clearing all migration state');
    setHasMigratedState(false);
    setMigrationDismissedState(false);
    localStorage.removeItem(HAS_MIGRATED_KEY);
    localStorage.removeItem(MIGRATION_DISMISSED_KEY);
  }, []);

  return {
    // syncEnabled is derived from auth - if logged in, sync is on
    syncEnabled: isAuthenticated,
    hasMigrated,
    setHasMigrated,
    migrationDismissed,
    setMigrationDismissed,
    clearMigrationState,
  };
}
