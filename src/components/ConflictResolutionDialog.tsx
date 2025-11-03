/**
 * Conflict resolution dialog for sync conflicts
 * Shows side-by-side comparison and resolution options
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, Smartphone, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import type { Prompt } from '@/types/prompt';

interface ConflictData {
  promptId: string;
  localVersion: Prompt;
  serverVersion: Prompt;
}

interface ConflictResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: ConflictData[];
  onResolve: (promptId: string, strategy: 'keep-current' | 'use-revision') => Promise<void>;
  onResolveAll: (strategy: 'keep-current' | 'use-revision') => Promise<void>;
}

export function ConflictResolutionDialog({
  open,
  onOpenChange,
  conflicts,
  onResolve,
  onResolveAll,
}: ConflictResolutionDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resolving, setResolving] = useState(false);

  const currentConflict = conflicts[currentIndex];

  const handleResolve = async (strategy: 'keep-current' | 'use-revision') => {
    if (!currentConflict) return;
    
    setResolving(true);
    try {
      await onResolve(currentConflict.promptId, strategy);
      
      // Move to next conflict or close
      if (currentIndex < conflicts.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        onOpenChange(false);
        setCurrentIndex(0);
      }
    } finally {
      setResolving(false);
    }
  };

  const handleResolveAll = async (strategy: 'keep-current' | 'use-revision') => {
    setResolving(true);
    try {
      await onResolveAll(strategy);
      onOpenChange(false);
      setCurrentIndex(0);
    } finally {
      setResolving(false);
    }
  };

  if (!currentConflict) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Sync Conflict Detected
          </DialogTitle>
          <DialogDescription>
            Conflict {currentIndex + 1} of {conflicts.length}: Changes were made on multiple devices
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This prompt was modified on different devices. Choose which version to keep.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 gap-4">
          {/* Local Version */}
          <div className="space-y-3 border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Your Local Version</h3>
              <Badge variant="secondary">Current Device</Badge>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{format(new Date(currentConflict.localVersion.updatedAt), 'PPp')}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Smartphone className="h-3 w-3" />
                <span>This Device</span>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Title</p>
                <p className="font-medium">{currentConflict.localVersion.title}</p>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground mb-1">Content</p>
                <ScrollArea className="h-[150px] border rounded p-2">
                  <p className="text-sm whitespace-pre-wrap">{currentConflict.localVersion.content}</p>
                </ScrollArea>
              </div>

              {currentConflict.localVersion.tags.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {currentConflict.localVersion.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Button
              onClick={() => handleResolve('keep-current')}
              disabled={resolving}
              className="w-full"
            >
              Keep This Version
            </Button>
          </div>

          {/* Server Version */}
          <div className="space-y-3 border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Server Version</h3>
              <Badge variant="secondary">Other Device</Badge>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{format(new Date(currentConflict.serverVersion.updatedAt), 'PPp')}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Smartphone className="h-3 w-3" />
                <span>Other Device</span>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Title</p>
                <p className="font-medium">{currentConflict.serverVersion.title}</p>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground mb-1">Content</p>
                <ScrollArea className="h-[150px] border rounded p-2">
                  <p className="text-sm whitespace-pre-wrap">{currentConflict.serverVersion.content}</p>
                </ScrollArea>
              </div>

              {currentConflict.serverVersion.tags.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {currentConflict.serverVersion.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Button
              onClick={() => handleResolve('use-revision')}
              disabled={resolving}
              className="w-full"
            >
              Keep This Version
            </Button>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex-1 text-sm text-muted-foreground">
            {conflicts.length > 1 && (
              <span>{conflicts.length - currentIndex - 1} more conflict{conflicts.length - currentIndex - 1 !== 1 ? 's' : ''} remaining</span>
            )}
          </div>
          {conflicts.length > 1 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleResolveAll('keep-current')}
                disabled={resolving}
              >
                Keep All Local
              </Button>
              <Button
                variant="outline"
                onClick={() => handleResolveAll('use-revision')}
                disabled={resolving}
              >
                Keep All Server
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
