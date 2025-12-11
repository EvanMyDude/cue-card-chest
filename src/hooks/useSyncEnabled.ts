import { useState, useEffect, useCallback } from 'react';

const SYNC_ENABLED_KEY = 'promptLibrary_syncEnabled';

interface UseSyncEnabledReturn {
  syncEnabled: boolean;
  setSyncEnabled: (enabled: boolean) => void;
}

export function useSyncEnabled(): UseSyncEnabledReturn {
  const [syncEnabled, setSyncEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(SYNC_ENABLED_KEY);
    return stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem(SYNC_ENABLED_KEY, String(syncEnabled));
  }, [syncEnabled]);

  const setSyncEnabled = useCallback((enabled: boolean) => {
    setSyncEnabledState(enabled);
  }, []);

  return {
    syncEnabled,
    setSyncEnabled,
  };
}
