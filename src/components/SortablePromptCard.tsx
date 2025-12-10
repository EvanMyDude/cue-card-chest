import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PromptCard } from './PromptCard';
import { ConflictBadge } from './ConflictBadge';
import type { Prompt } from '@/types/prompt';

interface SortablePromptCardProps {
  prompt: Prompt;
  onEdit: (prompt: Prompt) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onPreview?: (prompt: Prompt) => void;
  isDragEnabled?: boolean;
  hasConflict?: boolean;
  onResolveConflict?: () => void;
}

export const SortablePromptCard = ({
  prompt,
  onEdit,
  onDelete,
  onTogglePin,
  onPreview,
  isDragEnabled = true,
  hasConflict = false,
  onResolveConflict,
}: SortablePromptCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: prompt.id, disabled: !isDragEnabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="relative group">
      <div 
        {...listeners}
        role="button"
        tabIndex={0}
        aria-label="Drag to reorder"
        className="absolute top-2 left-2 p-2 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity z-10 pointer-events-auto touch-none select-none"
      >
        <div className="w-6 h-6 flex items-center justify-center rounded bg-muted/80 hover:bg-muted">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-muted-foreground">
            <circle cx="3" cy="3" r="1" fill="currentColor"/>
            <circle cx="9" cy="3" r="1" fill="currentColor"/>
            <circle cx="3" cy="6" r="1" fill="currentColor"/>
            <circle cx="9" cy="6" r="1" fill="currentColor"/>
            <circle cx="3" cy="9" r="1" fill="currentColor"/>
            <circle cx="9" cy="9" r="1" fill="currentColor"/>
          </svg>
        </div>
      </div>
      {hasConflict && onResolveConflict && (
        <div className="absolute top-2 right-2 z-10">
          <ConflictBadge onClick={onResolveConflict} />
        </div>
      )}
      <div className="group">
        <PromptCard
          prompt={prompt}
          onEdit={onEdit}
          onDelete={onDelete}
          onTogglePin={onTogglePin}
          onPreview={onPreview}
        />
      </div>
    </div>
  );
};
