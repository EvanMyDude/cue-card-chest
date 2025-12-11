import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Cloud, Check, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import type { Prompt } from '@/types/prompt';
import { mergePrompts, MergeConflict, resolveConflict } from '@/utils/mergePrompts';
import { ConflictResolutionDialog } from './ConflictResolutionDialog';

interface MigrationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  localPrompts: Prompt[];
  onFetchRemote: () => Promise<Prompt[]>;
  onComplete: (mergedPrompts: Prompt[]) => void;
  onUploadToCloud: (prompts: Prompt[]) => Promise<{ success: boolean; error?: string }>;
}

type Step = 'preview' | 'fetching' | 'merging' | 'conflicts' | 'uploading' | 'complete' | 'error';

export function MigrationWizard({
  open,
  onOpenChange,
  localPrompts,
  onFetchRemote,
  onComplete,
  onUploadToCloud,
}: MigrationWizardProps) {
  const [step, setStep] = useState<Step>('preview');
  const [progress, setProgress] = useState(0);
  const [remotePrompts, setRemotePrompts] = useState<Prompt[]>([]);
  const [conflicts, setConflicts] = useState<MergeConflict[]>([]);
  const [mergedPrompts, setMergedPrompts] = useState<Prompt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);

  const resetState = () => {
    setStep('preview');
    setProgress(0);
    setRemotePrompts([]);
    setConflicts([]);
    setMergedPrompts([]);
    setError(null);
  };

  const handleStartMigration = async () => {
    setStep('fetching');
    setProgress(20);

    try {
      // Fetch remote prompts
      const remote = await onFetchRemote();
      setRemotePrompts(remote);
      setProgress(40);

      // Merge prompts
      setStep('merging');
      const result = mergePrompts(localPrompts, remote);
      setProgress(60);

      // Combine all prompts
      const allMerged = [...result.merged, ...result.remoteOnly, ...result.localOnly];
      setMergedPrompts(allMerged);

      if (result.conflicts.length > 0) {
        setConflicts(result.conflicts);
        setStep('conflicts');
        setShowConflictDialog(true);
      } else {
        // No conflicts, proceed to upload
        await handleUpload(allMerged);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed');
      setStep('error');
    }
  };

  const handleConflictsResolved = async (resolvedConflicts: MergeConflict[]) => {
    setShowConflictDialog(false);
    
    // Apply resolutions
    const resolvedPrompts: Prompt[] = [];
    for (const conflict of resolvedConflicts) {
      const resolved = resolveConflict(conflict, conflict.resolvedBy || 'remote');
      resolvedPrompts.push(...resolved);
    }

    const finalMerged = [...mergedPrompts, ...resolvedPrompts];
    await handleUpload(finalMerged);
  };

  const handleUpload = async (promptsToUpload: Prompt[]) => {
    setStep('uploading');
    setProgress(80);

    const { success, error: uploadError } = await onUploadToCloud(promptsToUpload);

    if (success) {
      setProgress(100);
      setStep('complete');
      setMergedPrompts(promptsToUpload);
    } else {
      setError(uploadError || 'Upload failed');
      setStep('error');
    }
  };

  const handleComplete = () => {
    onComplete(mergedPrompts);
    onOpenChange(false);
    resetState();
    toast.success('Migration complete! Your prompts are now synced.');
  };

  const handleSkip = () => {
    onOpenChange(false);
    resetState();
  };

  const getStepContent = () => {
    switch (step) {
      case 'preview':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="p-4 rounded-full bg-primary/10">
                <Cloud className="h-12 w-12 text-primary" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Ready to sync your prompts</h3>
              <p className="text-muted-foreground">
                You have <strong>{localPrompts.length}</strong> local prompts to migrate to the cloud.
              </p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">What happens next:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3" />
                  Check for existing cloud prompts
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3" />
                  Merge and deduplicate automatically
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3" />
                  Resolve any conflicts (if needed)
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3" />
                  Upload all prompts to cloud
                </li>
              </ul>
            </div>
          </div>
        );

      case 'fetching':
      case 'merging':
      case 'uploading':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">
                {step === 'fetching' && 'Checking for existing prompts...'}
                {step === 'merging' && 'Merging prompts...'}
                {step === 'uploading' && 'Uploading to cloud...'}
              </h3>
              <Progress value={progress} className="w-full" />
            </div>
          </div>
        );

      case 'conflicts':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <AlertCircle className="h-12 w-12 text-accent" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Conflicts detected</h3>
              <p className="text-muted-foreground">
                Found <strong>{conflicts.length}</strong> prompts with conflicting changes.
              </p>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="p-4 rounded-full bg-success/10">
                <Check className="h-12 w-12 text-success" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Migration complete!</h3>
              <p className="text-muted-foreground">
                <strong>{mergedPrompts.length}</strong> prompts are now synced to the cloud.
              </p>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="p-4 rounded-full bg-destructive/10">
                <AlertCircle className="h-12 w-12 text-destructive" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Migration failed</h3>
              <p className="text-muted-foreground">{error}</p>
            </div>
          </div>
        );
    }
  };

  const getFooterButtons = () => {
    switch (step) {
      case 'preview':
        return (
          <>
            <Button variant="ghost" onClick={handleSkip}>
              Skip for now
            </Button>
            <Button onClick={handleStartMigration}>
              Start Migration
            </Button>
          </>
        );

      case 'complete':
        return (
          <Button onClick={handleComplete} className="w-full">
            Done
          </Button>
        );

      case 'error':
        return (
          <>
            <Button variant="ghost" onClick={handleSkip}>
              Cancel
            </Button>
            <Button onClick={handleStartMigration}>
              Retry
            </Button>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Dialog open={open && !showConflictDialog} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sync your prompts</DialogTitle>
            <DialogDescription>
              Migrate your local prompts to the cloud
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {getStepContent()}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {getFooterButtons()}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConflictResolutionDialog
        open={showConflictDialog}
        onOpenChange={setShowConflictDialog}
        conflicts={conflicts}
        onResolve={handleConflictsResolved}
      />
    </>
  );
}
