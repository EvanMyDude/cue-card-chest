import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import type { Prompt } from '@/types/prompt';

interface PromptFormProps {
  onSave: (prompt: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>) => void;
  editingPrompt?: Prompt | null;
  onCancelEdit?: () => void;
}

export function PromptForm({ onSave, editingPrompt, onCancelEdit }: PromptFormProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (editingPrompt) {
      setTitle(editingPrompt.title);
      setContent(editingPrompt.content);
      setTags(editingPrompt.tags);
    }
  }, [editingPrompt]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const autoTitle = title.trim() || content.split('\n')[0].slice(0, 50) || 'Untitled Prompt';
    
    onSave({
      title: autoTitle,
      content: content.trim(),
      tags,
      isPinned: editingPrompt?.isPinned || false,
    });

    setTitle('');
    setContent('');
    setTags([]);
    setTagInput('');
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (!tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleCancel = () => {
    setTitle('');
    setContent('');
    setTags([]);
    setTagInput('');
    onCancelEdit?.();
  };

  return (
    <Card className="p-6 border-border bg-card">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            placeholder="Prompt title (optional - auto-fills from content)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-secondary border-border"
          />
        </div>

        <div>
          <Textarea
            placeholder="Write your prompt here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={8}
            className="resize-none bg-secondary border-border"
          />
          <p className="text-sm text-muted-foreground mt-2">
            {content.length} characters
          </p>
        </div>

        <div>
          <Input
            placeholder="Add tags (press Enter)"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            className="bg-secondary border-border"
          />
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
          <Button type="submit" className="flex-1">
            {editingPrompt ? 'Update Prompt' : 'Save Prompt'}
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
