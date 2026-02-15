import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Edit, Trash2, Pin, PinOff } from 'lucide-react';
import { toast } from 'sonner';
import { DeleteConfirmationDialog } from '@/components/DeleteConfirmationDialog';
import type { Prompt } from '@/types/prompt';

interface PromptCardProps {
  prompt: Prompt;
  onEdit: (prompt: Prompt) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onPreview?: (prompt: Prompt) => void;
  onTagClick?: (tag: string) => void;
}

export function PromptCard({ prompt, onEdit, onDelete, onTogglePin, onPreview, onTagClick }: PromptCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    onDelete(prompt.id);
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <Card className={`group relative p-5 transition-all duration-200 border-border/60 bg-card hover:border-border card-glow ${
        prompt.isPinned ? 'border-primary/25 bg-primary/[0.02]' : ''
      }`}>
        {/* Pin indicator dot */}
        {prompt.isPinned && (
          <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary/60" />
        )}

        {/* Title + meta */}
        <div
          className="cursor-pointer mb-3"
          onClick={() => onPreview?.(prompt)}
        >
          <h3 className="text-sm font-semibold mb-1.5 text-foreground leading-snug line-clamp-1">
            {prompt.title}
          </h3>
          <p className="text-[11px] font-medium text-muted-foreground tracking-wide uppercase">
            {formatDate(prompt.updatedAt)} · {prompt.content.length} chars
          </p>
        </div>

        {/* Content preview */}
        <div
          className="mb-4 cursor-pointer"
          onClick={() => onPreview?.(prompt)}
        >
          <p className="text-[13px] text-muted-foreground/80 line-clamp-3 whitespace-pre-wrap leading-relaxed">
            {prompt.content}
          </p>
        </div>

        {/* Tags */}
        {prompt.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {[...prompt.tags].sort((a, b) => a.localeCompare(b)).map((tag) => (
              <span
                key={tag}
                onClick={onTagClick ? (e) => { e.stopPropagation(); onTagClick(tag); } : undefined}
                className={`inline-flex items-center px-2 py-0.5 rounded-md bg-secondary/80 text-[11px] font-medium text-secondary-foreground/70 border border-border/50${
                  onTagClick ? ' cursor-pointer hover:bg-secondary hover:text-secondary-foreground' : ''
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Actions — visible on hover */}
        <div className="flex items-center gap-1.5 pt-3 border-t border-border/40">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            className="flex-1 h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(prompt);
            }}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(prompt.id);
            }}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            {prompt.isPinned ? (
              <PinOff className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Pin className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDeleteClick}
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </Card>

      <DeleteConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
