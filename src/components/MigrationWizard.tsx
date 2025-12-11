import { useState, useEffect, useMemo } from 'react';
import { Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Prompt } from '@/types/prompt';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useDeviceId } from '@/hooks/useDeviceId';
import { mergePrompts, MergeConflict } from '@/utils/mergePrompts';
import { getPreAuthSnapshot, clearPreAuthSnapshot } from '@/hooks/usePrompts';

interface MigrationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  localPrompts: Prompt[]; // Fallback if no snapshot
  onMigrationComplete: (mergedPrompts: Prompt[], conflicts: MergeConflict[]) => void;
  onDismiss?: () => void; // Called when user cancels - signals to allow cloud fetch
}

type MigrationStep = 'ready' | 'registering' | 'fetching' | 'merging' | 'uploading' | 'complete' | 'error';

export function MigrationWizard({
  open,
  onOpenChange,
  localPrompts,
  onMigrationComplete,
  onDismiss,
}: MigrationWizardProps) {
  const { user } = useAuth();
  const { deviceId, deviceName, deviceType } = useDeviceId();
  
  const [step, setStep] = useState<MigrationStep>('ready');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [stats, setStats] = useState({ uploaded: 0, merged: 0, conflicts: 0 });

  // Use the protected snapshot if available, otherwise fall back to localPrompts prop
  // This ensures we use the data captured BEFORE the OAuth redirect
  const promptsToMigrate = useMemo(() => {
    const snapshot = getPreAuthSnapshot();
    if (snapshot.length > 0) {
      console.log('[MigrationWizard] Using protected snapshot:', snapshot.length, 'prompts');
      return snapshot;
    }
    console.log('[MigrationWizard] Using localPrompts prop:', localPrompts.length, 'prompts');
    return localPrompts;
  }, [localPrompts]);

  useEffect(() => {
    if (open && step === 'ready') {
      // Reset state when opening
      setProgress(0);
      setErrorMessage('');
      setStats({ uploaded: 0, merged: 0, conflicts: 0 });
    }
  }, [open, step]);

  const runMigration = async () => {
    if (!user) {
      setErrorMessage('Not authenticated');
      setStep('error');
      return;
    }

    try {
      // Step 1: Register device
      setStep('registering');
      setProgress(10);

      const { error: deviceError } = await supabase.from('devices').upsert({
        id: deviceId,
        user_id: user.id,
        device_name: deviceName,
        device_type: deviceType,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'id' });

      if (deviceError) {
        console.error('Device registration error:', deviceError);
        // Continue anyway - device registration is optional
      }

      // Step 2: Fetch existing cloud prompts
      setStep('fetching');
      setProgress(30);

      const { data: remoteData, error: fetchError } = await supabase
        .from('prompts')
        .select(`
          id,
          title,
          content,
          is_pinned,
          order_index,
          created_at,
          updated_at,
          prompt_tags (
            tags (name)
          )
        `)
        .eq('user_id', user.id)
        .is('archived_at', null);

      if (fetchError) throw fetchError;

      const remotePrompts: Prompt[] = (remoteData || []).map(p => ({
        id: p.id,
        title: p.title,
        content: p.content,
        tags: p.prompt_tags?.map((pt: any) => pt.tags?.name).filter(Boolean) || [],
        isPinned: p.is_pinned || false,
        order: p.order_index || 0,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }));

      console.log('[MigrationWizard] Cloud has', remotePrompts.length, 'prompts');
      console.log('[MigrationWizard] Local has', promptsToMigrate.length, 'prompts to migrate');

      // Step 3: Merge local and remote
      setStep('merging');
      setProgress(50);

      const { merged, conflicts, stats: mergeStats } = mergePrompts(promptsToMigrate, remotePrompts);

      setStats({
        uploaded: mergeStats.localOnly,
        merged: mergeStats.autoMerged + mergeStats.identical,
        conflicts: mergeStats.conflicted,
      });

      // Step 4: Upload local-only prompts
      setStep('uploading');

      const localOnly = promptsToMigrate.filter(
        lp => !remotePrompts.some(rp => rp.id === lp.id)
      );

      console.log('[MigrationWizard] Uploading', localOnly.length, 'local-only prompts');

      for (let i = 0; i < localOnly.length; i++) {
        const prompt = localOnly[i];
        setProgress(50 + Math.round((i / Math.max(localOnly.length, 1)) * 40));

        const { error: insertError } = await supabase.from('prompts').insert({
          id: prompt.id,
          user_id: user.id,
          device_id: deviceId,
          title: prompt.title,
          content: prompt.content,
          is_pinned: prompt.isPinned,
          order_index: prompt.order,
          checksum: '', // Will be computed by trigger
        });

        if (insertError) {
          console.error('Error uploading prompt:', insertError);
          // Continue with other prompts
        }

        // Handle tags
        if (prompt.tags.length > 0) {
          for (const tagName of prompt.tags) {
            let { data: existingTag } = await supabase
              .from('tags')
              .select('id')
              .eq('user_id', user.id)
              .eq('name', tagName)
              .single();

            if (!existingTag) {
              const { data: newTag } = await supabase
                .from('tags')
                .insert({ user_id: user.id, name: tagName })
                .select('id')
                .single();
              existingTag = newTag;
            }

            if (existingTag) {
              await supabase.from('prompt_tags').upsert({
                prompt_id: prompt.id,
                tag_id: existingTag.id,
              }, { onConflict: 'prompt_id,tag_id' });
            }
          }
        }
      }

      // Complete - clear the snapshot since migration succeeded
      setStep('complete');
      setProgress(100);
      
      console.log('[MigrationWizard] Migration complete, clearing snapshot');
      clearPreAuthSnapshot();

      onMigrationComplete(merged, conflicts);

    } catch (err) {
      console.error('Migration error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Migration failed');
      setStep('error');
    }
  };

  // Handle dialog close (cancel or X button)
  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      // User is closing/cancelling the dialog
      console.log('[MigrationWizard] Dialog dismissed, clearing snapshot');
      clearPreAuthSnapshot();
      
      // Notify parent to set migrationDismissed so cloud fetch can proceed
      if (onDismiss) {
        onDismiss();
      }
    }
    onOpenChange(isOpen);
  };

  const getStepDescription = () => {
    switch (step) {
      case 'ready':
        return `Ready to migrate ${promptsToMigrate.length} local prompt${promptsToMigrate.length !== 1 ? 's' : ''} to the cloud.`;
      case 'registering':
        return 'Registering this device...';
      case 'fetching':
        return 'Checking for existing cloud prompts...';
      case 'merging':
        return 'Merging local and cloud data...';
      case 'uploading':
        return 'Uploading prompts to cloud...';
      case 'complete':
        return 'Migration complete!';
      case 'error':
        return errorMessage || 'An error occurred during migration.';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Migrate to Cloud</DialogTitle>
          <DialogDescription>
            Your local prompts will be synced to the cloud.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Progress indicator */}
          {step !== 'ready' && step !== 'error' && (
            <Progress value={progress} className="h-2" />
          )}

          {/* Status icon and message */}
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              {step === 'complete' ? (
                <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 p-2">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
              ) : step === 'error' ? (
                <div className="rounded-full bg-destructive/10 p-2">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
              ) : step !== 'ready' ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : null}
            </div>
            <div className="flex-1">
              <p className="text-sm">{getStepDescription()}</p>
            </div>
          </div>

          {/* Stats (show on complete) */}
          {step === 'complete' && (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{stats.uploaded}</div>
                <div className="text-xs text-muted-foreground">Uploaded</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.merged}</div>
                <div className="text-xs text-muted-foreground">Merged</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.conflicts}</div>
                <div className="text-xs text-muted-foreground">Conflicts</div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            {step === 'ready' && (
              <>
                <Button variant="ghost" onClick={() => handleClose(false)}>
                  Cancel
                </Button>
                <Button onClick={runMigration}>
                  Start Migration
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            )}
            {step === 'complete' && (
              <Button onClick={() => handleClose(false)}>
                Done
              </Button>
            )}
            {step === 'error' && (
              <>
                <Button variant="ghost" onClick={() => handleClose(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setStep('ready')}>
                  Try Again
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
