import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
}

export function PromptPreviewDialog({ 
  prompt, 
  open, 
  onOpenChange,
  onEdit,
  onTogglePin,
  onDelete
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
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-2xl mb-2">{prompt.title}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Updated {formatDate(prompt.updatedAt)} • {prompt.content.length} characters
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onTogglePin(prompt.id)}
              >
                {prompt.isPinned ? (
                  <PinOff className="h-5 w-5 text-accent" />
                ) : (
                  <Pin className="h-5 w-5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDeleteClick}
                className="hover:bg-destructive hover:text-destructive-foreground"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {prompt.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {[...prompt.tags].sort((a, b) => a.localeCompare(b)).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-sm">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="bg-secondary/50 rounded-lg p-6 border border-border">
            <p className="text-foreground whitespace-pre-wrap leading-relaxed">
              {prompt.content}
            </p>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={handleCopy}
              className="flex-1 gap-2"
            >
              <Copy className="h-4 w-4" />
              Copy Content
            </Button>
            <Button
              variant="outline"
              onClick={handleEdit}
              className="gap-2"
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
