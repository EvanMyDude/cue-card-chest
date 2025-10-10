import { useState, useMemo } from 'react';
import { PromptForm } from '@/components/PromptForm';
import { PromptCard } from '@/components/PromptCard';
import { SearchBar } from '@/components/SearchBar';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { BookOpen, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { Prompt } from '@/types/prompt';

const Index = () => {
  const [prompts, setPrompts] = useLocalStorage<Prompt[]>('prompts', []);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);

  const handleSavePrompt = (promptData: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingPrompt) {
      setPrompts(
        prompts.map((p) =>
          p.id === editingPrompt.id
            ? { ...p, ...promptData, updatedAt: new Date().toISOString() }
            : p
        )
      );
      toast.success('Prompt updated successfully!');
      setEditingPrompt(null);
    } else {
      const newPrompt: Prompt = {
        ...promptData,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setPrompts([newPrompt, ...prompts]);
      toast.success('Prompt saved successfully!');
    }
  };

  const handleDeletePrompt = (id: string) => {
    setPrompts(prompts.filter((p) => p.id !== id));
    toast.success('Prompt deleted');
  };

  const handleDuplicatePrompt = (prompt: Prompt) => {
    const duplicated: Prompt = {
      ...prompt,
      id: crypto.randomUUID(),
      title: `${prompt.title} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPinned: false,
    };
    setPrompts([duplicated, ...prompts]);
    toast.success('Prompt duplicated!');
  };

  const handleTogglePin = (id: string) => {
    setPrompts(
      prompts.map((p) =>
        p.id === id ? { ...p, isPinned: !p.isPinned } : p
      )
    );
  };

  const filteredPrompts = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return prompts
      .filter((prompt) => {
        if (!query) return true;
        return (
          prompt.title.toLowerCase().includes(query) ||
          prompt.content.toLowerCase().includes(query) ||
          prompt.tags.some((tag) => tag.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) {
          return a.isPinned ? -1 : 1;
        }
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [prompts, searchQuery]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-4xl font-bold text-foreground">Prompt Library</h1>
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <p className="text-muted-foreground">
            Save, organize, and reuse your AI prompts. All data persists locally.
          </p>
        </div>

        {/* Form */}
        <div className="mb-8">
          <PromptForm
            onSave={handleSavePrompt}
            editingPrompt={editingPrompt}
            onCancelEdit={() => setEditingPrompt(null)}
          />
        </div>

        {/* Search */}
        <div className="mb-6">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>

        {/* Stats */}
        <div className="mb-6 flex gap-4 text-sm text-muted-foreground">
          <span>Total: {prompts.length}</span>
          <span>•</span>
          <span>Pinned: {prompts.filter((p) => p.isPinned).length}</span>
          {searchQuery && (
            <>
              <span>•</span>
              <span>Results: {filteredPrompts.length}</span>
            </>
          )}
        </div>

        {/* Prompts Grid */}
        {filteredPrompts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPrompts.map((prompt) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                onEdit={setEditingPrompt}
                onDelete={handleDeletePrompt}
                onDuplicate={handleDuplicatePrompt}
                onTogglePin={handleTogglePin}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-foreground">
              {searchQuery ? 'No prompts found' : 'No prompts yet'}
            </h3>
            <p className="text-muted-foreground">
              {searchQuery
                ? 'Try a different search term'
                : 'Create your first prompt above to get started'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
