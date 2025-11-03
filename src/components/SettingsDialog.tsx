/**
 * Settings and admin panel
 * Manual sync, rollback, device info, queue management
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Settings, RefreshCw, Database, Smartphone, Clock, AlertCircle } from 'lucide-react';
import { RollbackDialog } from './RollbackDialog';
import { ConfirmationDialog } from './ConfirmationDialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface SettingsDialogProps {
  deviceId?: string;
  lastSyncTime?: number;
  queuePending: number;
  queueParked: number;
  onManualSync: () => Promise<void>;
  onRetryParked: () => Promise<void>;
  onClearLocal: () => Promise<void>;
}

export function SettingsDialog({
  deviceId,
  lastSyncTime,
  queuePending,
  queueParked,
  onManualSync,
  onRetryParked,
  onClearLocal,
}: SettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await onManualSync();
      toast.success('Sync completed');
    } catch (error) {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleRetryParked = async () => {
    try {
      await onRetryParked();
      toast.success('Retrying failed items');
    } catch (error) {
      toast.error('Failed to retry items');
    }
  };

  const handleClearLocal = async () => {
    try {
      await onClearLocal();
      toast.success('Local data cleared');
      setClearConfirmOpen(false);
    } catch (error) {
      toast.error('Failed to clear local data');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Sync Settings</DialogTitle>
            <DialogDescription>
              Manage your sync settings and local data
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Device Info */}
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <Smartphone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1 space-y-1">
                  <h3 className="font-medium text-sm">Device Information</h3>
                  <p className="text-sm text-muted-foreground">
                    {deviceId ? `Device ID: ${deviceId.slice(0, 8)}...` : 'Not registered'}
                  </p>
                </div>
              </div>
            </Card>

            {/* Sync Status */}
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1 space-y-1">
                  <h3 className="font-medium text-sm">Sync Status</h3>
                  <p className="text-sm text-muted-foreground">
                    {lastSyncTime 
                      ? `Last sync: ${format(new Date(lastSyncTime), 'PPp')}`
                      : 'Never synced'
                    }
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleManualSync}
                  disabled={syncing}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </Button>
              </div>
            </Card>

            {/* Queue Status */}
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <Database className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1 space-y-2">
                  <h3 className="font-medium text-sm">Queue Status</h3>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pending operations:</span>
                      <Badge variant="secondary">{queuePending}</Badge>
                    </div>
                    {queueParked > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Failed operations:</span>
                        <Badge variant="destructive">{queueParked}</Badge>
                      </div>
                    )}
                  </div>
                </div>
                {queueParked > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRetryParked}
                  >
                    Retry Failed
                  </Button>
                )}
              </div>
            </Card>

            <Separator />

            {/* Actions */}
            <div className="space-y-2">
              <h3 className="font-medium text-sm">Data Management</h3>
              
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => {
                  setRollbackOpen(true);
                  setOpen(false);
                }}
              >
                <Database className="h-4 w-4" />
                Restore from Backup
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                onClick={() => setClearConfirmOpen(true)}
              >
                <AlertCircle className="h-4 w-4" />
                Clear Local Data
              </Button>
            </div>

            {/* Warning */}
            <Card className="p-4 bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                <div className="text-sm text-orange-900 dark:text-orange-200">
                  <p className="font-medium mb-1">Backup Regularly</p>
                  <p>Always download a backup before performing destructive operations.</p>
                </div>
              </div>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <RollbackDialog
        open={rollbackOpen}
        onOpenChange={setRollbackOpen}
        onComplete={() => {
          setRollbackOpen(false);
          setOpen(true);
        }}
      />

      <ConfirmationDialog
        open={clearConfirmOpen}
        onOpenChange={setClearConfirmOpen}
        onConfirm={handleClearLocal}
        title="Clear Local Data"
        description="This will remove all local data from IndexedDB. Cloud data will not be affected. This action cannot be undone."
        confirmText="Clear Local Data"
        variant="destructive"
      />
    </>
  );
}
