import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SyncContextType {
  syncEnabled: boolean;
  setSyncEnabled: (enabled: boolean) => void;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [syncEnabled, setSyncEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem('sync-enabled');
    return stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sync-enabled', String(syncEnabled));
  }, [syncEnabled]);

  return (
    <SyncContext.Provider value={{ syncEnabled, setSyncEnabled }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncContext() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSyncContext must be used within a SyncProvider');
  }
  return context;
}
