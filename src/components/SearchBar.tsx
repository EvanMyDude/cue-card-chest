import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative group">
      <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
      <Input
        type="text"
        placeholder="Search prompts..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 pr-4 h-11 bg-input/50 border-border/60 text-sm placeholder:text-muted-foreground/50 focus-visible:border-primary/50 focus-visible:ring-primary/20"
      />
      {!value && (
        <div className="absolute right-3.5 top-1/2 transform -translate-y-1/2 hidden sm:flex items-center gap-0.5">
          <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border/60 text-[10px] font-mono text-muted-foreground">
            /
          </kbd>
        </div>
      )}
    </div>
  );
}
