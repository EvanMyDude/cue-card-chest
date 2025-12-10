import { Prompt } from '@/types/prompt';
import { MergeConflict, resolveConflict } from '@/utils/mergePrompts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ConflictResolverProps {
  conflict: MergeConflict | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolve: (resolved: Prompt[]) => void;
}

export function ConflictResolver({
  conflict,
  open,
  onOpenChange,
  onResolve,
}: ConflictResolverProps) {
  if (!conflict) return null;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const handleResolve = (resolution: 'local' | 'remote' | 'both') => {
    const resolved = resolveConflict(conflict, resolution);
    onResolve(resolved);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Resolve Sync Conflict</DialogTitle>
          <DialogDescription>
            This prompt was edited on multiple devices. Choose which version to keep.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          {/* Local version */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="outline">Local (This Device)</Badge>
              <span className="text-xs text-muted-foreground">
                {formatDate(conflict.local.updatedAt)}
              </span>
            </div>
            <h4 className="font-semibold">{conflict.local.title}</h4>
            <ScrollArea className="h-48 rounded border p-3">
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {conflict.local.content}
              </pre>
            </ScrollArea>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => handleResolve('local')}
            >
              Keep Local
            </Button>
          </div>

          {/* Remote version */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="outline">Cloud (Remote)</Badge>
              <span className="text-xs text-muted-foreground">
                {formatDate(conflict.remote.updatedAt)}
              </span>
            </div>
            <h4 className="font-semibold">{conflict.remote.title}</h4>
            <ScrollArea className="h-48 rounded border p-3">
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {conflict.remote.content}
              </pre>
            </ScrollArea>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => handleResolve('remote')}
            >
              Keep Cloud
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Decide Later
          </Button>
          <Button onClick={() => handleResolve('both')}>
            Keep Both Versions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
