/**
 * Dialog for rollback operations with safety confirmations
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Upload } from 'lucide-react';
import {
  executeRollback,
  parseBackupFile,
  logRollbackEvent,
  type RollbackOptions,
} from '@/lib/rollback';
import type { BackupData } from '@/lib/backup';

interface RollbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function RollbackDialog({ open, onOpenChange, onComplete }: RollbackDialogProps) {
  const { toast } = useToast();
  const [backup, setBackup] = useState<BackupData | null>(null);
  const [options, setOptions] = useState<RollbackOptions>({
    clearSupabase: false,
    clearIndexedDB: false,
    restoreToLocalStorage: true,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsedBackup = await parseBackupFile(file);
      setBackup(parsedBackup);
      
      toast({
        title: 'Backup Loaded',
        description: `Found ${parsedBackup.prompts.length} prompts from ${new Date(parsedBackup.manifest.exportedAt).toLocaleDateString()}`,
      });
    } catch (err) {
      toast({
        title: 'Invalid Backup File',
        description: err instanceof Error ? err.message : 'Failed to parse backup',
        variant: 'destructive',
      });
    }
  };

  const handleRollback = async () => {
    if (!backup) return;

    // Require confirmation for destructive operations
    const isDestructive = options.clearSupabase || options.clearIndexedDB;
    if (isDestructive && confirmText !== 'ROLLBACK') {
      toast({
        title: 'Confirmation Required',
        description: 'Please type ROLLBACK to confirm destructive operations',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    try {
      const result = await executeRollback(backup, options);

      if (result.success) {
        // Log the rollback
        logRollbackEvent('rollback', {
          restoredCount: result.restoredCount,
          clearedSupabase: result.clearedSupabase,
          clearedIndexedDB: result.clearedIndexedDB,
          backupDate: backup.manifest.exportedAt,
        });

        toast({
          title: 'Rollback Complete',
          description: `Restored ${result.restoredCount} prompts successfully`,
        });

        onComplete?.();
        onOpenChange(false);

        // Reload to apply changes
        setTimeout(() => window.location.reload(), 1000);
      } else {
        throw new Error(result.error || 'Rollback failed');
      }
    } catch (err) {
      toast({
        title: 'Rollback Failed',
        description: err instanceof Error ? err.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const isDestructive = options.clearSupabase || options.clearIndexedDB;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Rollback to Backup
          </DialogTitle>
          <DialogDescription>
            Restore your data from a previous backup. Choose your recovery options carefully.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="backup-file">Select Backup File</Label>
            <div className="flex items-center gap-2">
              <input
                id="backup-file"
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById('backup-file')?.click()}
                disabled={isProcessing}
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose File
              </Button>
              {backup && (
                <span className="text-sm text-muted-foreground">
                  {backup.prompts.length} prompts loaded
                </span>
              )}
            </div>
          </div>

          {/* Options */}
          {backup && (
            <div className="space-y-3 border rounded-lg p-4">
              <Label>Recovery Options</Label>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="restore-local"
                  checked={options.restoreToLocalStorage}
                  onCheckedChange={(checked) =>
                    setOptions(prev => ({ ...prev, restoreToLocalStorage: !!checked }))
                  }
                />
                <label
                  htmlFor="restore-local"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Restore to localStorage
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="clear-indexeddb"
                  checked={options.clearIndexedDB}
                  onCheckedChange={(checked) =>
                    setOptions(prev => ({ ...prev, clearIndexedDB: !!checked }))
                  }
                />
                <label
                  htmlFor="clear-indexeddb"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Clear local database (IndexedDB)
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="clear-supabase"
                  checked={options.clearSupabase}
                  onCheckedChange={(checked) =>
                    setOptions(prev => ({ ...prev, clearSupabase: !!checked }))
                  }
                />
                <label
                  htmlFor="clear-supabase"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Clear cloud data (Supabase)
                </label>
              </div>
            </div>
          )}

          {/* Destructive Warning */}
          {isDestructive && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold mb-2">Warning: Destructive Operation</p>
                <p className="text-sm mb-3">
                  You are about to permanently delete data. This cannot be undone.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="confirm-text">Type ROLLBACK to confirm</Label>
                  <input
                    id="confirm-text"
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="ROLLBACK"
                  />
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRollback}
            disabled={!backup || isProcessing || (isDestructive && confirmText !== 'ROLLBACK')}
          >
            {isProcessing ? 'Processing...' : 'Execute Rollback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
