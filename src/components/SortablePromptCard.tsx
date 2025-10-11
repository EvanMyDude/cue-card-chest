import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PromptCard } from './PromptCard';
import type { Prompt } from '@/types/prompt';

interface SortablePromptCardProps {
  prompt: Prompt;
  onEdit: (prompt: Prompt) => void;
  onDelete: (id: string) => void;
  onDuplicate: (prompt: Prompt) => void;
  onTogglePin: (id: string) => void;
}

export const SortablePromptCard = ({
  prompt,
  onEdit,
  onDelete,
  onDuplicate,
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
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <PromptCard
        prompt={prompt}
        onEdit={onEdit}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onTogglePin={onTogglePin}
      />
    </div>
  );
};
