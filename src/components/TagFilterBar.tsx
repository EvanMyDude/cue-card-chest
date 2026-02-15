import { X } from 'lucide-react';

interface TagFilterBarProps {
  allTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onClearTags: () => void;
}

export function TagFilterBar({ allTags, selectedTags, onToggleTag, onClearTags }: TagFilterBarProps) {
  if (allTags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-3 animate-fade-in">
      {selectedTags.length > 0 && (
        <button
          onClick={onClearTags}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-destructive/10 text-[11px] font-medium text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      )}
      {allTags.map((tag) => {
        const isActive = selectedTags.includes(tag);
        return (
          <button
            key={tag}
            onClick={() => onToggleTag(tag)}
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors ${
              isActive
                ? 'bg-primary/15 text-primary border-primary/30'
                : 'bg-secondary/80 text-secondary-foreground/70 border-border/50 hover:bg-secondary hover:text-secondary-foreground'
            }`}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}
