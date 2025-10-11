import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Edit, Trash2, Pin, PinOff } from 'lucide-react';
import { toast } from 'sonner';
import type { Prompt } from '@/types/prompt';

interface PromptCardProps {
  prompt: Prompt;
  onEdit: (prompt: Prompt) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
}

export function PromptCard({ prompt, onEdit, onDelete, onTogglePin }: PromptCardProps) {
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

  return (
    <Card className={`p-5 transition-all hover:shadow-lg border-border bg-card ${
      prompt.isPinned ? 'ring-2 ring-accent/50' : ''
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold mb-1 truncate text-foreground">
            {prompt.title}
          </h3>
          <p className="text-xs text-muted-foreground">
            {formatDate(prompt.updatedAt)} • {prompt.content.length} chars
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onTogglePin(prompt.id)}
          className="ml-2 shrink-0"
        >
          {prompt.isPinned ? (
            <PinOff className="h-4 w-4 text-accent" />
          ) : (
            <Pin className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="mb-3">
        <p className="text-sm text-foreground line-clamp-3 whitespace-pre-wrap">
          {prompt.content}
        </p>
      </div>

      {prompt.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {[...prompt.tags].sort((a, b) => a.localeCompare(b)).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopy}
          className="flex-1"
        >
          <Copy className="h-4 w-4 mr-2" />
          Copy
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(prompt)}
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDelete(prompt.id)}
          className="hover:bg-destructive hover:text-destructive-foreground"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
