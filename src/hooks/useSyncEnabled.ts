import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

const MIGRATION_COMPLETED_KEY = 'promptLibrary_hasMigrated';

interface UseSyncEnabledReturn {
  syncEnabled: boolean;
  hasMigrated: boolean;
  setHasMigrated: (migrated: boolean) => void;
}

export function useSyncEnabled(): UseSyncEnabledReturn {
  const { isAuthenticated } = useAuth();
  
  const [hasMigrated, setHasMigratedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(MIGRATION_COMPLETED_KEY);
    return stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem(MIGRATION_COMPLETED_KEY, String(hasMigrated));
  }, [hasMigrated]);

  const setHasMigrated = useCallback((migrated: boolean) => {
    setHasMigratedState(migrated);
  }, []);

  // syncEnabled is true if user is authenticated
  // OR if they've previously completed migration on this device (for offline access)
  const syncEnabled = isAuthenticated || hasMigrated;

  return {
    syncEnabled,
    hasMigrated,
    setHasMigrated,
  };
}
