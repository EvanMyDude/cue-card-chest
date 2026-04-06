import { X } from 'lucide-react';

export type TagFilterMode = 'or' | 'and';

interface TagFilterBarProps {
  allTags: string[];
  selectedTags: string[];
  filterMode: TagFilterMode;
  onToggleTag: (tag: string) => void;
  onFilterModeChange: (mode: TagFilterMode) => void;
  onClearTags: () => void;
}

export function TagFilterBar({
  allTags,
  selectedTags,
  filterMode,
  onToggleTag,
  onFilterModeChange,
  onClearTags,
}: TagFilterBarProps) {
  if (allTags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-3 animate-fade-in">
      <div className="inline-flex items-center gap-2 mr-1">
        <span className="text-[11px] font-medium text-muted-foreground">Match</span>
        <div className="inline-flex items-center rounded-lg border border-border bg-secondary/50 p-0.5">
          <button
            type="button"
            onClick={() => onFilterModeChange('or')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              filterMode === 'or'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Any
          </button>
          <button
            type="button"
            onClick={() => onFilterModeChange('and')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              filterMode === 'and'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
        </div>
      </div>
      {selectedTags.length > 0 && (
        <button
          type="button"
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
            type="button"
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
