import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MergeConflict } from '@/utils/mergePrompts';

interface ConflictResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: MergeConflict[];
  onResolve: (resolvedConflicts: MergeConflict[]) => void;
}

export function ConflictResolutionDialog({
  open,
  onOpenChange,
  conflicts,
  onResolve,
}: ConflictResolutionDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resolutions, setResolutions] = useState<Map<string, 'local' | 'remote' | 'both'>>(new Map());

  const currentConflict = conflicts[currentIndex];
  const currentResolution = currentConflict ? resolutions.get(currentConflict.promptId) : undefined;
  const allResolved = conflicts.every(c => resolutions.has(c.promptId));

  const handleResolve = (resolution: 'local' | 'remote' | 'both') => {
    if (!currentConflict) return;
    
    setResolutions(prev => new Map(prev).set(currentConflict.promptId, resolution));
    
    // Auto-advance to next conflict if not at the end
    if (currentIndex < conflicts.length - 1) {
      setTimeout(() => setCurrentIndex(currentIndex + 1), 300);
    }
  };

  const handleComplete = () => {
    const resolved = conflicts.map(conflict => ({
      ...conflict,
      resolvedBy: resolutions.get(conflict.promptId) || 'remote',
    }));
    onResolve(resolved);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!currentConflict) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Resolve Conflicts</DialogTitle>
          <DialogDescription>
            {currentIndex + 1} of {conflicts.length} conflicts • Choose which version to keep
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="sm"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex(currentIndex - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <div className="flex gap-1">
            {conflicts.map((c, i) => (
              <div
                key={c.promptId}
                className={`w-2 h-2 rounded-full cursor-pointer transition-colors ${
                  i === currentIndex
                    ? 'bg-primary'
                    : resolutions.has(c.promptId)
                    ? 'bg-success'
                    : 'bg-muted'
                }`}
                onClick={() => setCurrentIndex(i)}
              />
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={currentIndex === conflicts.length - 1}
            onClick={() => setCurrentIndex(currentIndex + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Local version */}
          <Card
            className={`p-4 cursor-pointer transition-all ${
              currentResolution === 'local'
                ? 'ring-2 ring-primary bg-primary/5'
                : 'hover:bg-secondary/50'
            }`}
            onClick={() => handleResolve('local')}
          >
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline">Local</Badge>
              {currentResolution === 'local' && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </div>
            <h4 className="font-semibold mb-1 line-clamp-1">
              {currentConflict.local.title}
            </h4>
            <p className="text-xs text-muted-foreground mb-2">
              Updated: {formatDate(currentConflict.local.updatedAt)}
            </p>
            <ScrollArea className="h-32">
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {currentConflict.local.content}
              </p>
            </ScrollArea>
          </Card>

          {/* Remote version */}
          <Card
            className={`p-4 cursor-pointer transition-all ${
              currentResolution === 'remote'
                ? 'ring-2 ring-primary bg-primary/5'
                : 'hover:bg-secondary/50'
            }`}
            onClick={() => handleResolve('remote')}
          >
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline">Cloud</Badge>
              {currentResolution === 'remote' && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </div>
            <h4 className="font-semibold mb-1 line-clamp-1">
              {currentConflict.remote.title}
            </h4>
            <p className="text-xs text-muted-foreground mb-2">
              Updated: {formatDate(currentConflict.remote.updatedAt)}
            </p>
            <ScrollArea className="h-32">
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {currentConflict.remote.content}
              </p>
            </ScrollArea>
          </Card>
        </div>

        <Button
          variant="secondary"
          className={`w-full ${currentResolution === 'both' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => handleResolve('both')}
        >
          {currentResolution === 'both' && <Check className="h-4 w-4 mr-2" />}
          Keep Both (create a copy)
        </Button>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleComplete} disabled={!allResolved}>
            {allResolved ? 'Complete' : `Resolve ${conflicts.length - resolutions.size} more`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
