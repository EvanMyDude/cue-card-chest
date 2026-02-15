import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Edit, Pin, PinOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DeleteConfirmationDialog } from '@/components/DeleteConfirmationDialog';
import type { Prompt } from '@/types/prompt';

interface PromptPreviewDialogProps {
  prompt: Prompt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (prompt: Prompt) => void;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  onTagClick?: (tag: string) => void;
}

export function PromptPreviewDialog({
  prompt,
  open,
  onOpenChange,
  onEdit,
  onTogglePin,
  onDelete,
  onTagClick
}: PromptPreviewDialogProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!prompt) return null;

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    onDelete(prompt.id);
    setShowDeleteConfirm(false);
    onOpenChange(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.content);
      toast.success('Copied to clipboard!');
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleEdit = () => {
    onEdit(prompt);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-card border-border/60">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl font-semibold mb-1.5 tracking-tight">{prompt.title}</DialogTitle>
              <p className="text-[11px] font-medium text-muted-foreground tracking-wide uppercase">
                Updated {formatDate(prompt.updatedAt)} · {prompt.content.length} characters
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onTogglePin(prompt.id)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                {prompt.isPinned ? (
                  <PinOff className="h-4 w-4 text-primary" />
                ) : (
                  <Pin className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDeleteClick}
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 mt-4">
          {prompt.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[...prompt.tags].sort((a, b) => a.localeCompare(b)).map((tag) => (
                <span
                  key={tag}
                  onClick={onTagClick ? () => { onTagClick(tag); onOpenChange(false); } : undefined}
                  className={`inline-flex items-center px-2.5 py-1 rounded-md bg-secondary text-xs font-medium text-secondary-foreground border border-border/50${
                    onTagClick ? ' cursor-pointer hover:bg-secondary/60' : ''
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="bg-input/30 rounded-lg p-5 border border-border/40">
            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
              {prompt.content}
            </p>
          </div>

          <div className="flex gap-2 pt-4 border-t border-border/40">
            <Button
              onClick={handleCopy}
              className="flex-1 gap-2 h-10 font-medium bg-primary hover:bg-primary/90"
            >
              <Copy className="h-4 w-4" />
              Copy Content
            </Button>
            <Button
              variant="outline"
              onClick={handleEdit}
              className="gap-2 h-10 border-border/60 text-muted-foreground hover:text-foreground"
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          </div>
        </div>
      </DialogContent>

      <DeleteConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleConfirmDelete}
      />
    </Dialog>
  );
}
