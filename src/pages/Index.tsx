import { useState, useMemo } from 'react';
import { PromptForm } from '@/components/PromptForm';
import { SortablePromptCard } from '@/components/SortablePromptCard';
import { SearchBar } from '@/components/SearchBar';
import { ExportButton } from '@/components/ExportButton';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { BookOpen, Sparkles, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { Prompt } from '@/types/prompt';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

const Index = () => {
  const [prompts, setPrompts] = useLocalStorage<Prompt[]>('prompts', []);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [sortMode, setSortMode] = useState<'manual' | 'date'>('date');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
        order: Date.now(),
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
      order: Date.now(),
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Only allow reordering in manual mode
    if (sortMode !== 'manual') {
      toast.info('Reordering is only available in Manual Order mode');
      return;
    }

    if (over && active.id !== over.id) {
      const oldIndex = prompts.findIndex((p) => p.id === active.id);
      const newIndex = prompts.findIndex((p) => p.id === over.id);

      const reordered = arrayMove(prompts, oldIndex, newIndex).map((p, idx) => ({
        ...p,
        order: idx,
      }));

      setPrompts(reordered);
      toast.success('Order updated');
    }
  };

  const handleDragStart = () => {
    if (sortMode !== 'manual') {
      toast.info('Switch to Manual Order mode to reorder prompts');
    }
  };

  const filteredPrompts = useMemo(() => {
    const query = searchQuery.toLowerCase();
    let filtered = prompts.filter((prompt) => {
      if (!query) return true;
      return (
        prompt.title.toLowerCase().includes(query) ||
        prompt.content.toLowerCase().includes(query) ||
        prompt.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    });

    // Sort based on mode
    if (sortMode === 'manual') {
      filtered = filtered.sort((a, b) => {
        if (a.isPinned !== b.isPinned) {
          return a.isPinned ? -1 : 1;
        }
        return (a.order || 0) - (b.order || 0);
      });
    } else {
      filtered = filtered.sort((a, b) => {
        if (a.isPinned !== b.isPinned) {
          return a.isPinned ? -1 : 1;
        }
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    }

    return filtered;
  }, [prompts, searchQuery, sortMode]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-4xl font-bold text-foreground">Prompt Library</h1>
              <Sparkles className="h-5 w-5 text-accent" />
            </div>
            <div className="flex gap-2">
              <Button
                variant={sortMode === 'manual' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortMode('manual')}
                className="gap-2"
              >
                <GripVertical className="h-4 w-4" />
                Manual Order
              </Button>
              <Button
                variant={sortMode === 'date' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortMode('date')}
              >
                Sort by Date
              </Button>
              <ExportButton prompts={prompts} />
            </div>
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
          <DndContext
            sensors={sortMode === 'manual' ? sensors : []}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            onDragStart={handleDragStart}
          >
            <SortableContext
              items={filteredPrompts.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPrompts.map((prompt) => (
                  <SortablePromptCard
                    key={prompt.id}
                    prompt={prompt}
                    onEdit={setEditingPrompt}
                    onDelete={handleDeletePrompt}
                    onDuplicate={handleDuplicatePrompt}
                    onTogglePin={handleTogglePin}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
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
