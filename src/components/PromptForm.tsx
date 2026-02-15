import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { Prompt } from '@/types/prompt';

/**
 * Generate a concise title from prompt content (client-side).
 * Extracts the first meaningful sentence/phrase, cleans it up,
 * and caps it at ~50 chars on a word boundary.
 */
function generateTitleFromContent(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return 'Untitled Prompt';

  // Take first line or first sentence
  const firstLine = trimmed.split('\n')[0].trim();
  // Try to find first sentence (period, question mark, exclamation)
  const sentenceMatch = firstLine.match(/^(.+?[.!?])\s/);
  let candidate = sentenceMatch ? sentenceMatch[1] : firstLine;

  // Remove markdown formatting
  candidate = candidate
    .replace(/^#+\s*/, '')      // Remove heading markers
    .replace(/\*\*/g, '')       // Remove bold
    .replace(/\*/g, '')         // Remove italic
    .replace(/`/g, '')          // Remove code ticks
    .replace(/^\s*[-*]\s+/, '') // Remove list markers
    .trim();

  // Truncate to ~50 chars on a word boundary
  if (candidate.length > 50) {
    candidate = candidate.slice(0, 50).replace(/\s+\S*$/, '').trim();
    // Remove trailing punctuation that looks odd
    candidate = candidate.replace(/[,;:\-]$/, '').trim();
  }

  return candidate || 'Untitled Prompt';
}

interface PromptFormProps {
  onSave: (prompt: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>) => void;
  editingPrompt?: Prompt | null;
  onCancelEdit?: () => void;
  onGenerateTitle?: () => void;
  onCancel?: () => void;
  existingTags?: string[];
}

export function PromptForm({ onSave, editingPrompt, onCancelEdit, onGenerateTitle, onCancel, existingTags = [] }: PromptFormProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  // Title generation is now client-side (instant), but we keep this state
  // to avoid changing the component's interface in case anything references it
  const isGeneratingTitle = false;
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  useEffect(() => {
    if (editingPrompt) {
      setTitle(editingPrompt.title);
      setContent(editingPrompt.content);
      setTags(editingPrompt.tags);
    }
  }, [editingPrompt]);

  const generateSmartTitle = () => {
    if (!content.trim()) {
      toast.error('Please enter some content first');
      return;
    }

    onGenerateTitle?.();
    const generated = generateTitleFromContent(content);
    setTitle(generated);
    toast.success('Title generated!');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let finalTitle = title.trim();

    if (!finalTitle && content.trim()) {
      finalTitle = generateTitleFromContent(content);
    }

    if (!finalTitle) {
      finalTitle = 'Untitled Prompt';
    }
    
    onSave({
      title: finalTitle,
      content: content.trim(),
      tags,
      isPinned: editingPrompt?.isPinned || false,
      order: editingPrompt?.order ?? 0,
    });

    setTitle('');
    setContent('');
    setTags([]);
    setTagInput('');
  };

  const suggestedTags = useMemo(() => {
    if (!tagInput.trim()) return [];
    
    const input = tagInput.toLowerCase();
    const availableTags = existingTags.filter(tag => !tags.includes(tag));
    
    return availableTags
      .filter(tag => tag.toLowerCase().includes(input))
      .sort((a, b) => {
        const aStarts = a.toLowerCase().startsWith(input);
        const bStarts = b.toLowerCase().startsWith(input);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.localeCompare(b);
      })
      .slice(0, 10);
  }, [tagInput, existingTags, tags]);

  const addTag = (newTag: string) => {
    const tag = newTag.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput('');
    setSelectedSuggestionIndex(-1);
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (selectedSuggestionIndex >= 0 && suggestedTags[selectedSuggestionIndex]) {
        addTag(suggestedTags[selectedSuggestionIndex]);
      } else {
        addTag(tagInput);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev < suggestedTags.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Escape') {
      setTagInput('');
      setSelectedSuggestionIndex(-1);
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleCancel = () => {
    onCancel?.();
    setTitle('');
    setContent('');
    setTags([]);
    setTagInput('');
    setSelectedSuggestionIndex(-1);
    onCancelEdit?.();
  };

  useEffect(() => {
    setSelectedSuggestionIndex(-1);
  }, [suggestedTags.length]);

  return (
    <Card className="p-6 border-border bg-card">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="flex gap-2">
            <Input
              placeholder="Prompt title (optional - AI will generate if empty)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-secondary border-border flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={generateSmartTitle}
              disabled={!content.trim() || isGeneratingTitle}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Smart Title
            </Button>
          </div>
        </div>

        <div>
          <Textarea
            placeholder="Write your prompt here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={8}
            className="resize-y bg-secondary border-border min-h-[200px]"
          />
          <p className="text-sm text-muted-foreground mt-2">
            {content.length} characters
          </p>
        </div>

        <div className="relative">
          <Input
            placeholder="Add tags (press Enter)"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            className="bg-secondary border-border text-foreground"
          />
          {tagInput.trim() && suggestedTags.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
              {suggestedTags.map((tag, index) => (
                <div
                  key={tag}
                  className={`px-3 py-2 cursor-pointer text-sm transition-colors ${
                    index === selectedSuggestionIndex 
                      ? 'bg-accent text-accent-foreground' 
                      : 'text-foreground hover:bg-accent/50'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addTag(tag);
                  }}
                  onMouseEnter={() => setSelectedSuggestionIndex(index)}
                >
                  {tag}
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={isGeneratingTitle}>
            {isGeneratingTitle ? 'Generating Title...' : editingPrompt ? 'Update Prompt' : 'Save Prompt'}
          </Button>
          {editingPrompt && (
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
