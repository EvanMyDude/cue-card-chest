import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Cloud, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Auth } from '@/components/Auth';
import { useDeviceRegistration } from '@/hooks/useDeviceRegistration';
import { useOfflineStorage } from '@/hooks/useOfflineStorage';

interface EnableSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

type Step = 'intro' | 'auth' | 'registering' | 'migrating' | 'complete';

export function EnableSyncDialog({ open, onOpenChange, onComplete }: EnableSyncDialogProps) {
  const { user } = useAuth();
  const deviceReg = useDeviceRegistration();
  const storage = useOfflineStorage();
  const [step, setStep] = useState<Step>('intro');
  const [error, setError] = useState<string | null>(null);
  const [migrationProgress, setMigrationProgress] = useState(0);

  const handleEnableSync = async () => {
    if (!user) {
      setStep('auth');
      return;
    }

    await startMigration();
  };

  const startMigration = async () => {
    try {
      setError(null);
      setStep('registering');

      // Register device if not already registered
      if (!deviceReg.deviceId) {
        await deviceReg.registerUserDevice();
      }

      if (!deviceReg.deviceId) {
        throw new Error('Failed to register device');
      }

      // Migrate local prompts to authenticated user
      setStep('migrating');
      await migrateLocalPrompts();

      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed');
      setStep('intro');
    }
  };

  const migrateLocalPrompts = async () => {
    if (!user || !storage.isReady) return;

    const { getDB } = await import('@/lib/db');
    const db = await getDB();
    
    // Get all prompts with 'local-user' ID
    const allPrompts = await db.getAll('prompts');
    const localPrompts = allPrompts.filter(p => p.user_id === 'local-user');

    if (localPrompts.length === 0) {
      setMigrationProgress(100);
      return;
    }

    // Update each prompt to use authenticated user ID
    for (let i = 0; i < localPrompts.length; i++) {
      const prompt = localPrompts[i];
      await db.put('prompts', {
        ...prompt,
        user_id: user.id,
        updatedAt: new Date().toISOString(),
      });
      
      setMigrationProgress(((i + 1) / localPrompts.length) * 100);
    }
  };

  // Auto-start migration when user signs in
  if (step === 'auth' && user) {
    startMigration();
  }

  const getProgressValue = () => {
    switch (step) {
      case 'intro': return 0;
      case 'auth': return 20;
      case 'registering': return 40;
      case 'migrating': return 40 + (migrationProgress * 0.4);
      case 'complete': return 100;
      default: return 0;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'complete' ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Cloud Sync Enabled!
              </>
            ) : (
              <>
                <Cloud className="h-5 w-5" />
                Enable Cloud Sync
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {step === 'complete' 
              ? 'Your prompts are now synced to the cloud.'
              : 'Sync your prompts across all your devices.'
            }
          </DialogDescription>
        </DialogHeader>

        <Progress value={getProgressValue()} className="w-full" />

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === 'intro' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enable cloud sync to access your prompts on any device. Your existing prompts will be migrated to your account.
              </p>
              <div className="space-y-2">
                <h4 className="font-medium text-sm">What happens:</h4>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                  <li>Sign in or create an account</li>
                  <li>Your local prompts will be synced to the cloud</li>
                  <li>Access your prompts on any device</li>
                  <li>Automatic backup and conflict resolution</li>
                </ul>
              </div>
              <Button onClick={handleEnableSync} className="w-full">
                Continue
              </Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full">
                Cancel
              </Button>
            </div>
          )}

          {step === 'auth' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Sign in or create an account to enable cloud sync.
              </p>
              <Auth />
            </div>
          )}

          {step === 'registering' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Registering device...</p>
            </div>
          )}

          {step === 'migrating' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Migrating local prompts... {Math.round(migrationProgress)}%
              </p>
            </div>
          )}

          {step === 'complete' && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Cloud sync is now enabled! Your prompts will automatically sync across all your devices.
                </AlertDescription>
              </Alert>
              <Button onClick={onComplete} className="w-full">
                Get Started
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
