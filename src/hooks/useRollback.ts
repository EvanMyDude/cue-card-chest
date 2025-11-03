/**
 * Hook for managing rollback operations
 */

import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  executeRollback,
  parseBackupFile,
  getRollbackLogs,
  type RollbackOptions,
  type RollbackResult,
} from '@/lib/rollback';
import type { BackupData } from '@/lib/backup';

interface UseRollbackResult {
  isProcessing: boolean;
  logs: Array<{ timestamp: string; action: string; details: Record<string, any> }>;
  
  rollback: (backup: BackupData, options: RollbackOptions) => Promise<RollbackResult>;
  parseBackup: (fileOrJson: File | string) => Promise<BackupData>;
  refreshLogs: () => void;
}

export function useRollback(): UseRollbackResult {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState(() => getRollbackLogs());

  const rollback = useCallback(
    async (backup: BackupData, options: RollbackOptions): Promise<RollbackResult> => {
      setIsProcessing(true);

      try {
        const result = await executeRollback(backup, options);

        if (result.success) {
          toast({
            title: 'Rollback Complete',
            description: `Restored ${result.restoredCount} prompts`,
          });

          // Refresh logs
          setLogs(getRollbackLogs());
        } else {
          toast({
            title: 'Rollback Failed',
            description: result.error || 'An error occurred',
            variant: 'destructive',
          });
        }

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        
        toast({
          title: 'Rollback Error',
          description: errorMsg,
          variant: 'destructive',
        });

        return {
          success: false,
          restoredCount: 0,
          clearedSupabase: false,
          clearedIndexedDB: false,
          error: errorMsg,
        };
      } finally {
        setIsProcessing(false);
      }
    },
    [toast]
  );

  const parseBackup = useCallback(
    async (fileOrJson: File | string): Promise<BackupData> => {
      try {
        return await parseBackupFile(fileOrJson);
      } catch (err) {
        toast({
          title: 'Invalid Backup',
          description: err instanceof Error ? err.message : 'Failed to parse backup',
          variant: 'destructive',
        });
        throw err;
      }
    },
    [toast]
  );

  const refreshLogs = useCallback(() => {
    setLogs(getRollbackLogs());
  }, []);

  return {
    isProcessing,
    logs,
    rollback,
    parseBackup,
    refreshLogs,
  };
}
