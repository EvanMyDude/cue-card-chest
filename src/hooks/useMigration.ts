/**
 * Hook to orchestrate migration from localStorage to Supabase
 * Handles backup, device registration, and import flow
 */

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useOfflineStorage } from './useOfflineStorage';
import {
  isFirstTimeUser,
  exportLocalStorageBackup,
  downloadBackup,
  type BackupData,
} from '@/lib/backup';
import {
  importPromptsFromBackup,
  dryRunImport,
  type ImportResult,
  type ImportProgress,
} from '@/lib/importer';
import { registerDevice } from '@/lib/syncEngine';

export type MigrationPhase = 
  | 'idle'
  | 'checking'
  | 'backup-ready'
  | 'registering'
  | 'importing'
  | 'complete'
  | 'error';

export interface MigrationState {
  phase: MigrationPhase;
  needsBackup: boolean;
  backup: BackupData | null;
  deviceId: string | null;
  importProgress: ImportProgress | null;
  importResult: ImportResult | null;
  error: Error | null;
}

export interface UseMigrationResult {
  state: MigrationState;
  
  // Actions
  checkMigrationNeeded: () => Promise<boolean>;
  createBackup: () => Promise<void>;
  downloadBackupFile: () => void;
  registerUserDevice: (deviceName: string, deviceType?: string) => Promise<void>;
  importBackup: () => Promise<void>;
  skipMigration: () => Promise<void>;
  
  // Utilities
  reset: () => void;
}

/**
 * Hook for managing migration flow
 */
export function useMigration(): UseMigrationResult {
  const { user } = useAuth();
  const storage = useOfflineStorage();

  const [state, setState] = useState<MigrationState>({
    phase: 'idle',
    needsBackup: false,
    backup: null,
    deviceId: null,
    importProgress: null,
    importResult: null,
    error: null,
  });

  /**
   * Check if migration is needed
   * Now also checks if device needs registration (even without backup)
   */
  const checkMigrationNeeded = useCallback(async (): Promise<boolean> => {
    if (!storage.isReady || !user) return false;

    setState(prev => ({ ...prev, phase: 'checking' }));

    try {
      // Check if device is already registered
      const deviceInfo = await storage.getDeviceInfo();
      
      if (!deviceInfo?.device_id) {
        // Device not registered - check if there's a backup to import
        const isFirstTime = await isFirstTimeUser();
        
        if (isFirstTime) {
          const backup = await exportLocalStorageBackup();
          
          if (backup && backup.prompts.length > 0) {
            // Has backup to import
            setState(prev => ({
              ...prev,
              phase: 'backup-ready',
              needsBackup: true,
              backup,
            }));
            return true;
          }
        }
        
        // No backup, but still needs device registration
        // This will be handled by useDeviceRegistration auto-registration
        setState(prev => ({ ...prev, phase: 'idle', needsBackup: false }));
        return false;
      }

      setState(prev => ({ ...prev, phase: 'idle', needsBackup: false }));
      return false;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setState(prev => ({ ...prev, phase: 'error', error }));
      return false;
    }
  }, [storage.isReady, user]);

  /**
   * Create backup from localStorage
   */
  const createBackup = useCallback(async () => {
    setState(prev => ({ ...prev, phase: 'checking' }));

    try {
      const backup = await exportLocalStorageBackup();
      
      if (backup) {
        setState(prev => ({
          ...prev,
          phase: 'backup-ready',
          backup,
        }));
      } else {
        setState(prev => ({
          ...prev,
          phase: 'idle',
          error: new Error('No localStorage data found'),
        }));
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setState(prev => ({ ...prev, phase: 'error', error }));
    }
  }, []);

  /**
   * Download backup file
   */
  const downloadBackupFile = useCallback(() => {
    if (!state.backup) {
      console.warn('[Migration] No backup to download');
      return;
    }

    downloadBackup(state.backup);
  }, [state.backup]);

  /**
   * Register device with server
   */
  const registerUserDevice = useCallback(
    async (deviceName: string, deviceType: string = 'web') => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      setState(prev => ({ ...prev, phase: 'registering' }));

      try {
        const { deviceId, lastSeenAt } = await registerDevice(deviceName, deviceType);
        
        // Store device info in IndexedDB
        await storage.setDeviceInfo({
          device_id: deviceId,
          device_name: deviceName,
          device_type: deviceType,
          last_sync_at: lastSeenAt,
        });

        setState(prev => ({
          ...prev,
          deviceId,
        }));

        console.log('[Migration] Device registered:', deviceId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState(prev => ({ ...prev, phase: 'error', error }));
        throw error;
      }
    },
    [user, storage]
  );

  /**
   * Import backup to Supabase
   */
  const importBackup = useCallback(async () => {
    if (!state.backup || !user) {
      throw new Error('No backup or user not authenticated');
    }

    // Get or register device
    let deviceId = state.deviceId;
    if (!deviceId) {
      const deviceInfo = await storage.getDeviceInfo();
      if (!deviceInfo?.device_id) {
        throw new Error('Device not registered. Register device first.');
      }
      deviceId = deviceInfo.device_id;
    }

    setState(prev => ({ ...prev, phase: 'importing' }));

    try {
      const result = await importPromptsFromBackup(
        state.backup,
        user.id,
        deviceId,
        (progress) => {
          setState(prev => ({
            ...prev,
            importProgress: progress,
          }));
        }
      );

      setState(prev => ({
        ...prev,
        phase: 'complete',
        importResult: result,
      }));

      console.log('[Migration] Import complete:', result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setState(prev => ({ ...prev, phase: 'error', error }));
      throw error;
    }
  }, [state.backup, state.deviceId, user, storage]);

  /**
   * Skip migration (register device without importing)
   */
  const skipMigration = useCallback(async () => {
    setState(prev => ({ ...prev, phase: 'complete' }));
  }, []);

  /**
   * Reset migration state
   */
  const reset = useCallback(() => {
    setState({
      phase: 'idle',
      needsBackup: false,
      backup: null,
      deviceId: null,
      importProgress: null,
      importResult: null,
      error: null,
    });
  }, []);

  /**
   * Auto-check on mount
   */
  useEffect(() => {
    if (storage.isReady && user) {
      checkMigrationNeeded();
    }
  }, [storage.isReady, user]); // Don't include checkMigrationNeeded to avoid loop

  return {
    state,
    checkMigrationNeeded,
    createBackup,
    downloadBackupFile,
    registerUserDevice,
    importBackup,
    skipMigration,
    reset,
  };
}
