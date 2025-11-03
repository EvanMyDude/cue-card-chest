/**
 * Migration wizard for first-time users
 * Guides through backup, device registration, and import
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Download, Smartphone, Upload, AlertCircle } from 'lucide-react';
import { useMigration } from '@/hooks/useMigration';

interface MigrationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function MigrationWizard({ open, onOpenChange, onComplete }: MigrationWizardProps) {
  const [deviceName, setDeviceName] = useState('');
  const migration = useMigration();
  const [step, setStep] = useState<'welcome' | 'backup' | 'register' | 'import' | 'complete'>('welcome');

  const handleStartMigration = async () => {
    setStep('backup');
    await migration.createBackup();
  };

  const handleDownloadBackup = () => {
    migration.downloadBackupFile();
  };

  const handleSkipBackup = () => {
    setStep('register');
  };

  const handleRegisterDevice = async () => {
    if (!deviceName.trim()) {
      return;
    }
    await migration.registerUserDevice(deviceName.trim());
    if (migration.state.deviceId) {
      setStep('import');
    }
  };

  const handleImportData = async () => {
    await migration.importBackup();
    if (migration.state.phase === 'complete') {
      setStep('complete');
    }
  };

  const handleSkipMigration = () => {
    migration.skipMigration();
    onComplete();
    onOpenChange(false);
  };

  const handleComplete = () => {
    onComplete();
    onOpenChange(false);
  };

  const getProgressValue = () => {
    if (migration.state.importProgress) {
      const { current, total } = migration.state.importProgress;
      return total > 0 ? (current / total) * 100 : 0;
    }
    switch (step) {
      case 'welcome': return 0;
      case 'backup': return 20;
      case 'register': return 40;
      case 'import': return 60;
      case 'complete': return 100;
      default: return 0;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'complete' ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Migration Complete!
              </>
            ) : (
              'Welcome to Cloud Sync'
            )}
          </DialogTitle>
          <DialogDescription>
            {step === 'complete' 
              ? 'Your data has been successfully synced to the cloud.'
              : 'Migrate your local data to enable cloud sync across all your devices.'
            }
          </DialogDescription>
        </DialogHeader>

        <Progress value={getProgressValue()} className="w-full" />

        <div className="space-y-4 py-4">
          {migration.state.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{migration.state.error.message}</AlertDescription>
            </Alert>
          )}

          {step === 'welcome' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This wizard will help you migrate your local prompts to cloud storage, enabling sync across all your devices.
              </p>
              <div className="space-y-2">
                <h4 className="font-medium">What will happen:</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Create a backup of your local data</li>
                  <li>Register this device</li>
                  <li>Import your prompts to the cloud</li>
                </ul>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleStartMigration} className="flex-1">
                  Start Migration
                </Button>
                <Button variant="outline" onClick={handleSkipMigration}>
                  Skip for Now
                </Button>
              </div>
            </div>
          )}

          {step === 'backup' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <Download className="h-8 w-8 text-primary" />
                <div className="flex-1">
                  <h4 className="font-medium">Backup Created</h4>
                  <p className="text-sm text-muted-foreground">
                    {migration.state.backup?.prompts.length || 0} prompts ready to migrate
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleDownloadBackup} variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Download Backup (Optional)
                </Button>
                <Button onClick={handleSkipBackup} className="flex-1">
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 'register' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <Smartphone className="h-8 w-8 text-primary" />
                <div className="flex-1">
                  <h4 className="font-medium">Register Device</h4>
                  <p className="text-sm text-muted-foreground">
                    Give this device a name to identify it
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="device-name">Device Name</Label>
                <Input
                  id="device-name"
                  placeholder="e.g., My Laptop, Work Desktop"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRegisterDevice()}
                />
              </div>
              <Button onClick={handleRegisterDevice} disabled={!deviceName.trim()} className="w-full">
                Register Device
              </Button>
            </div>
          )}

          {step === 'import' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <Upload className="h-8 w-8 text-primary" />
                <div className="flex-1">
                  <h4 className="font-medium">Import Data</h4>
                  <p className="text-sm text-muted-foreground">
                    Ready to import {migration.state.backup?.prompts.length || 0} prompts
                  </p>
                </div>
              </div>

              {migration.state.phase === 'importing' && migration.state.importProgress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Importing prompts...</span>
                    <span>{migration.state.importProgress.current} / {migration.state.importProgress.total}</span>
                  </div>
                  <Progress value={getProgressValue()} />
                </div>
              )}

              <Button 
                onClick={handleImportData} 
                disabled={migration.state.phase === 'importing'}
                className="w-full"
              >
                {migration.state.phase === 'importing' ? 'Importing...' : 'Start Import'}
              </Button>
            </div>
          )}

          {step === 'complete' && (
            <div className="space-y-4">
              {migration.state.importResult && (
                <div className="p-4 border rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Imported:</span>
                    <span className="font-medium text-green-600">{migration.state.importResult.imported}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Skipped (duplicates):</span>
                    <span className="font-medium text-muted-foreground">{migration.state.importResult.skipped}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Errors:</span>
                    <span className="font-medium text-destructive">{migration.state.importResult.errors.length}</span>
                  </div>
                </div>
              )}
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Your prompts are now synced to the cloud and will be available on all your devices.
                </AlertDescription>
              </Alert>
              <Button onClick={handleComplete} className="w-full">
                Get Started
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
