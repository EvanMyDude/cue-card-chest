import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PromptCard } from './PromptCard';
import type { Prompt } from '@/types/prompt';

interface SortablePromptCardProps {
  prompt: Prompt;
  onEdit: (prompt: Prompt) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
}

export const SortablePromptCard = ({
  prompt,
  onEdit,
  onDelete,
  onTogglePin,
}: SortablePromptCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: prompt.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div {...listeners} className="absolute top-2 left-2 p-2 cursor-grab active:cursor-grabbing opacity-0 hover:opacity-100 transition-opacity z-10">
        <div className="w-6 h-6 flex items-center justify-center rounded bg-muted/50">
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
      <PromptCard
        prompt={prompt}
        onEdit={onEdit}
        onDelete={onDelete}
        onTogglePin={onTogglePin}
      />
    </div>
  );
};
