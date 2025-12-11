import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

const HAS_MIGRATED_KEY = 'promptLibrary_hasMigrated';

interface UseSyncEnabledReturn {
  syncEnabled: boolean;
  hasMigrated: boolean;
  setHasMigrated: (migrated: boolean) => void;
}

/**
 * syncEnabled is now DERIVED from auth state:
 * - true when user is authenticated (cloud is source of truth)
 * - false when not authenticated (local-only mode)
 * 
 * hasMigrated tracks whether this device has completed the initial migration
 * of local prompts to the cloud (per-device flag).
 */
export function useSyncEnabled(): UseSyncEnabledReturn {
  const { isAuthenticated } = useAuth();
  
  // hasMigrated is per-device: tracks if local prompts were migrated
  const [hasMigrated, setHasMigratedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(HAS_MIGRATED_KEY);
    return stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem(HAS_MIGRATED_KEY, String(hasMigrated));
  }, [hasMigrated]);

  const setHasMigrated = useCallback((migrated: boolean) => {
    setHasMigratedState(migrated);
  }, []);

  return {
    // syncEnabled is derived from auth - if logged in, sync is on
    syncEnabled: isAuthenticated,
    hasMigrated,
    setHasMigrated,
  };
}
