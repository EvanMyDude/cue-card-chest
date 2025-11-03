import { Card } from '@/components/ui/card';
import { useState, useMemo, useRef, useEffect } from 'react';
import { PromptForm } from '@/components/PromptForm';
import { SortablePromptCard } from '@/components/SortablePromptCard';
import { PromptPreviewDialog } from '@/components/PromptPreviewDialog';
import { SearchBar } from '@/components/SearchBar';
import { ExportButton } from '@/components/ExportButton';
import { SyncStatusBanner } from '@/components/SyncStatusBanner';
import { SettingsDialog } from '@/components/SettingsDialog';
import { ConflictResolutionDialog } from '@/components/ConflictResolutionDialog';
import { usePrompts } from '@/hooks/usePrompts';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useSound } from '@/hooks/useSound';
import { BookOpen, Sparkles, GripVertical, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
  const { 
    prompts, 
    loading, 
    syncStatus, 
    conflicts,
    queuePending,
    queueParked,
    createPrompt, 
    updatePrompt, 
    deletePrompt, 
    reorderPrompts,
    syncNow,
    resolveConflict,
    retryParked,
    refresh,
  } = usePrompts();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [previewPrompt, setPreviewPrompt] = useState<Prompt | null>(null);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [sortMode, setSortMode] = useLocalStorage<'manual' | 'date'>('sort-mode', 'manual');
  const { soundEnabled, setSoundEnabled, playClick, playSuccess } = useSound();
  const formRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleSavePrompt = async (promptData: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>) => {
    playSuccess();
    try {
      if (editingPrompt) {
        await updatePrompt(editingPrompt.id, promptData);
        toast.success('Prompt updated successfully!');
        setEditingPrompt(null);
      } else {
        await createPrompt(promptData);
        toast.success('Prompt saved successfully!');
      }
    } catch (error) {
      console.error('Error saving prompt:', error);
      toast.error('Failed to save prompt');
    }
  };

  const handleDeletePrompt = async (id: string) => {
    playClick();
    try {
      await deletePrompt(id);
      toast.success('Prompt deleted');
    } catch (error) {
      console.error('Error deleting prompt:', error);
      toast.error('Failed to delete prompt');
    }
  };

  const handleTogglePin = async (id: string) => {
    playClick();
    try {
      const prompt = prompts.find(p => p.id === id);
      if (prompt) {
        await updatePrompt(id, { isPinned: !prompt.isPinned });
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
      toast.error('Failed to update prompt');
    }
  };

  const handleEdit = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    // Scroll form into view smoothly
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  useEffect(() => {
    if (editingPrompt) {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [editingPrompt]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Only allow reordering in manual mode
    if (sortMode !== 'manual') {
      toast.info('Reordering is only available in Manual Order mode');
      return;
    }

    // Avoid confusing partial updates while searching
    if (searchQuery) {
      toast.info('Clear the search to reorder prompts');
      return;
    }

    if (!over || active.id === over.id) return;

    playClick();

    const oldIndex = filteredPrompts.findIndex((p) => p.id === active.id);
    const newIndex = filteredPrompts.findIndex((p) => p.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Keep reordering within the same pin group to avoid confusing jumps
    const activePinned = filteredPrompts[oldIndex].isPinned;
    const overPinned = filteredPrompts[newIndex].isPinned;
    if (activePinned !== overPinned) {
      toast.info('Reorder within pinned or unpinned groups');
      return;
    }

    const reorderedVisible = arrayMove(filteredPrompts, oldIndex, newIndex);
    const reordered = reorderedVisible.map((p, idx) => ({
      ...p,
      order: idx,
    }));

    reorderPrompts(reordered).catch((error) => {
      console.error('Error reordering prompts:', error);
      toast.error('Failed to update order');
    });
    toast.success('Order updated');
  };

  const handleDragStart = () => {
    if (sortMode !== 'manual') {
      toast.info('Switch to Manual Order mode to reorder prompts');
    }
  };

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    prompts.forEach(prompt => {
      prompt.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [prompts]);

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

  // Show conflicts dialog when conflicts exist
  useEffect(() => {
    if (conflicts.length > 0 && !conflictDialogOpen) {
      setConflictDialogOpen(true);
    }
  }, [conflicts.length, conflictDialogOpen]);

  const handleResolveConflict = async (promptId: string, strategy: 'keep-current' | 'use-revision') => {
    try {
      await resolveConflict(promptId, strategy);
      toast.success('Conflict resolved');
    } catch (error) {
      console.error('Error resolving conflict:', error);
      toast.error('Failed to resolve conflict');
    }
  };

  const handleResolveAllConflicts = async (strategy: 'keep-current' | 'use-revision') => {
    try {
      for (const conflict of conflicts) {
        await resolveConflict(conflict.promptId, strategy);
      }
      toast.success('All conflicts resolved');
    } catch (error) {
      console.error('Error resolving conflicts:', error);
      toast.error('Failed to resolve all conflicts');
    }
  };

  const handleClearLocal = async () => {
    try {
      const { clearIndexedDBData } = await import('@/lib/rollback');
      await clearIndexedDBData();
      await refresh();
      toast.success('Local data cleared successfully');
    } catch (error) {
      console.error('Error clearing local data:', error);
      toast.error('Failed to clear local data');
    }
  };

  const conflictData = conflicts.map((c) => ({
    promptId: c.promptId,
    localVersion: c.clientVersion as unknown as Prompt,
    serverVersion: c.serverVersion as unknown as Prompt,
  }));

  return (
    <div className="min-h-screen bg-background">
      <SyncStatusBanner
        status={syncStatus}
        conflictCount={conflicts.length}
        parkedCount={queueParked}
        onResolveConflicts={() => setConflictDialogOpen(true)}
        onRetryParked={retryParked}
      />
      
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
                onClick={() => {
                  playClick();
                  setSortMode('manual');
                }}
                className="gap-2"
              >
                <GripVertical className="h-4 w-4" />
                Manual Order
              </Button>
              <Button
                variant={sortMode === 'date' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  playClick();
                  setSortMode('date');
                }}
              >
                Sort by Date
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  playClick();
                  setSoundEnabled(!soundEnabled);
                  toast.success(soundEnabled ? 'Sounds disabled' : 'Sounds enabled');
                }}
                title={soundEnabled ? 'Disable sounds' : 'Enable sounds'}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              <ExportButton prompts={prompts} onExport={playSuccess} />
              <SettingsDialog
                lastSyncTime={Date.now()}
                queuePending={queuePending}
                queueParked={queueParked}
                onManualSync={syncNow}
                onRetryParked={retryParked}
                onClearLocal={handleClearLocal}
              />
            </div>
          </div>
          <p className="text-muted-foreground">
            Save, organize, and reuse your AI prompts. All data persists locally.
          </p>
        </div>

        {/* Form */}
        <div ref={formRef} className="mb-8">
          <PromptForm
            onSave={handleSavePrompt}
            editingPrompt={editingPrompt}
            onCancelEdit={() => setEditingPrompt(null)}
            onGenerateTitle={playSuccess}
            onCancel={playClick}
            existingTags={allTags}
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
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="p-6 space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-20 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-16" />
                </div>
              </Card>
            ))}
          </div>
        ) : filteredPrompts.length > 0 ? (
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
                    onEdit={handleEdit}
                    onDelete={handleDeletePrompt}
                    onTogglePin={handleTogglePin}
                    onPreview={setPreviewPrompt}
                    isDragEnabled={sortMode === 'manual'}
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

      <PromptPreviewDialog
        prompt={previewPrompt}
        open={!!previewPrompt}
        onOpenChange={(open) => !open && setPreviewPrompt(null)}
        onEdit={handleEdit}
        onTogglePin={handleTogglePin}
      />

      <ConflictResolutionDialog
        open={conflictDialogOpen}
        onOpenChange={setConflictDialogOpen}
        conflicts={conflictData}
        onResolve={handleResolveConflict}
        onResolveAll={handleResolveAllConflicts}
      />
    </div>
  );
};

export default Index;
