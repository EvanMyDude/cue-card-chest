import { useState, useMemo, useRef, useEffect } from 'react';
import { PromptForm } from '@/components/PromptForm';
import { SortablePromptCard } from '@/components/SortablePromptCard';
import { PromptPreviewDialog } from '@/components/PromptPreviewDialog';
import { SearchBar } from '@/components/SearchBar';
import { SyncCTA } from '@/components/SyncCTA';
import { SyncIndicator } from '@/components/SyncIndicator';
import { SyncSettingsDropdown } from '@/components/SyncSettingsDropdown';
import { MigrationWizard } from '@/components/MigrationWizard';
import { useAuth } from '@/hooks/useAuth';
import { useDeviceId } from '@/hooks/useDeviceId';
import { useSyncEnabled } from '@/hooks/useSyncEnabled';
import { usePrompts } from '@/hooks/usePrompts';
import { useSound } from '@/hooks/useSound';
import { BookOpen, Sparkles, GripVertical, Volume2, VolumeX } from 'lucide-react';
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
  const { user, isAuthenticated, isLoading: authLoading, signOut } = useAuth();
  const { deviceId, deviceName, registerDevice } = useDeviceId();
  const {
    syncEnabled,
    hasMigrated,
    savePreAuthSnapshot,
    completeMigration,
    getLocalPromptsFromStorage,
  } = useSyncEnabled(isAuthenticated);

  const {
    prompts,
    setPrompts,
    createPrompt,
    updatePrompt,
    deletePrompt,
    togglePin,
    reorderPrompts,
    fetchRemotePrompts,
    uploadToCloud,
    manualSync,
    syncState,
    isLoading,
  } = usePrompts({
    syncEnabled,
    userId: user?.id || null,
    deviceId,
    hasMigrated,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [previewPrompt, setPreviewPrompt] = useState<Prompt | null>(null);
  const [sortMode, setSortMode] = useState<'manual' | 'date'>(() => {
    const stored = localStorage.getItem('sort-mode');
    return (stored as 'manual' | 'date') || 'manual';
  });
  const [showMigrationWizard, setShowMigrationWizard] = useState(false);

  const { soundEnabled, setSoundEnabled, playClick, playSuccess } = useSound();
  const formRef = useRef<HTMLDivElement>(null);

  // Save sort mode to localStorage
  useEffect(() => {
    localStorage.setItem('sort-mode', sortMode);
  }, [sortMode]);

  // Register device when authenticated
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      registerDevice(user.id);
    }
  }, [isAuthenticated, user?.id, registerDevice]);

  // Check if migration wizard should be shown
  // Uses localStorage directly to avoid race conditions with React state
  useEffect(() => {
    if (!authLoading && isAuthenticated && !hasMigrated) {
      const localData = getLocalPromptsFromStorage();
      console.log(`[Sync] Auth complete, checking for local data: ${localData.length} prompts`);
      if (localData.length > 0) {
        setShowMigrationWizard(true);
      } else {
        // No local data, just mark as migrated and fetch from cloud
        console.log('[Sync] No local data, marking as migrated');
        completeMigration();
      }
    }
  }, [authLoading, isAuthenticated, hasMigrated, getLocalPromptsFromStorage, completeMigration]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handlePreAuth = () => {
    // Save snapshot before auth redirect
    savePreAuthSnapshot(prompts);
  };

  const handleSavePrompt = async (promptData: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>) => {
    playSuccess();
    if (editingPrompt) {
      await updatePrompt(editingPrompt.id, promptData);
      toast.success('Prompt updated successfully!');
      setEditingPrompt(null);
    } else {
      await createPrompt(promptData);
      toast.success('Prompt saved successfully!');
    }
  };

  const handleDeletePrompt = async (id: string) => {
    playClick();
    await deletePrompt(id);
    toast.success('Prompt deleted');
  };

  const handleTogglePin = async (id: string) => {
    playClick();
    await togglePin(id);
  };

  const handleEdit = (prompt: Prompt) => {
    setEditingPrompt(prompt);
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

    if (sortMode !== 'manual') {
      toast.info('Reordering is only available in Manual Order mode');
      return;
    }

    if (searchQuery) {
      toast.info('Clear the search to reorder prompts');
      return;
    }

    if (!over || active.id === over.id) return;

    playClick();

    const oldIndex = filteredPrompts.findIndex((p) => p.id === active.id);
    const newIndex = filteredPrompts.findIndex((p) => p.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

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

    reorderPrompts(reordered);
    toast.success('Order updated');
  };

  const handleDragStart = () => {
    if (sortMode !== 'manual') {
      toast.info('Switch to Manual Order mode to reorder prompts');
    }
  };

  const handleMigrationComplete = (mergedPrompts: Prompt[]) => {
    setPrompts(mergedPrompts);
    completeMigration();
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleImport = (importedPrompts: Prompt[]) => {
    setPrompts(importedPrompts);
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

  // Get local prompts for migration - use localStorage directly
  const getLocalPromptsForMigration = (): Prompt[] => {
    return getLocalPromptsFromStorage();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-2xl sm:text-4xl font-bold text-foreground">Prompt Library</h1>
              <Sparkles className="h-5 w-5 text-accent hidden sm:block" />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {/* Sync Indicator (when authenticated) */}
              {isAuthenticated && (
                <SyncIndicator
                  status={syncState.status}
                  lastSyncAt={syncState.lastSyncAt}
                  pendingChanges={syncState.pendingChanges}
                  error={syncState.error}
                />
              )}

              {/* Sync CTA (when not authenticated) */}
              {!isAuthenticated && !authLoading && (
                <SyncCTA onPreAuth={handlePreAuth} />
              )}

              {/* Sort buttons - hidden on mobile */}
              <Button
                variant={sortMode === 'manual' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  playClick();
                  setSortMode('manual');
                }}
                className="gap-2 hidden sm:flex"
              >
                <GripVertical className="h-4 w-4" />
                <span className="hidden md:inline">Manual Order</span>
              </Button>
              <Button
                variant={sortMode === 'date' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  playClick();
                  setSortMode('date');
                }}
                className="hidden sm:flex"
              >
                <span className="hidden md:inline">Sort by Date</span>
                <span className="md:hidden">Date</span>
              </Button>
              
              {/* Sound toggle - hidden on mobile */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  playClick();
                  setSoundEnabled(!soundEnabled);
                  toast.success(soundEnabled ? 'Sounds disabled' : 'Sounds enabled');
                }}
                title={soundEnabled ? 'Disable sounds' : 'Enable sounds'}
                className="hidden sm:flex"
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>

              {/* Settings Dropdown - always visible */}
              {isAuthenticated && (
                <SyncSettingsDropdown
                  prompts={prompts}
                  onImport={handleImport}
                  onSignOut={handleSignOut}
                  onManualSync={manualSync}
                  deviceName={deviceName}
                  userEmail={user?.email}
                />
              )}
            </div>
          </div>
          <p className="text-muted-foreground text-sm sm:text-base">
            {isAuthenticated
              ? 'Your prompts sync automatically across all devices.'
              : 'Save, organize, and reuse your AI prompts. All data persists locally.'}
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

      {/* Migration Wizard */}
      <MigrationWizard
        open={showMigrationWizard}
        onOpenChange={setShowMigrationWizard}
        localPrompts={getLocalPromptsForMigration()}
        onFetchRemote={fetchRemotePrompts}
        onComplete={handleMigrationComplete}
        onUploadToCloud={uploadToCloud}
      />
    </div>
  );
};

export default Index;
