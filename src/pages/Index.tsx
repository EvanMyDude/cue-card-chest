import { useState, useMemo, useRef, useEffect } from 'react';
import { PromptForm } from '@/components/PromptForm';
import { SortablePromptCard } from '@/components/SortablePromptCard';
import { PromptPreviewDialog } from '@/components/PromptPreviewDialog';
import { SearchBar } from '@/components/SearchBar';
import { TagFilterBar } from '@/components/TagFilterBar';
import { SyncCTA } from '@/components/SyncCTA';
import { SyncIndicator } from '@/components/SyncIndicator';
import { SyncSettingsDropdown } from '@/components/SyncSettingsDropdown';
import { MigrationWizard } from '@/components/MigrationWizard';
import { useAuth } from '@/hooks/useAuth';
import { useDeviceId } from '@/hooks/useDeviceId';
import { useSyncEnabled } from '@/hooks/useSyncEnabled';
import { usePrompts } from '@/hooks/usePrompts';
import { useSound } from '@/hooks/useSound';
import { GripVertical, Clock, Volume2, VolumeX } from 'lucide-react';
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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const { soundEnabled, setSoundEnabled, playClick, playSuccess } = useSound();
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('sort-mode', sortMode);
  }, [sortMode]);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      registerDevice(user.id);
    }
  }, [isAuthenticated, user?.id, registerDevice]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && !hasMigrated) {
      const localData = getLocalPromptsFromStorage();
      console.log(`[Sync] Auth complete, checking for local data: ${localData.length} prompts`);
      if (localData.length > 0) {
        setShowMigrationWizard(true);
      } else {
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

    if (searchQuery || selectedTags.length > 0) {
      toast.info('Clear the search and tag filters to reorder prompts');
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

  const handleToggleTag = (tag: string) => {
    playClick();
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleClearTags = () => {
    playClick();
    setSelectedTags([]);
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
    const filtered = prompts.filter((prompt) => {
      const matchesSearch = !query || (
        prompt.title.toLowerCase().includes(query) ||
        prompt.content.toLowerCase().includes(query) ||
        prompt.tags.some((tag) => tag.toLowerCase().includes(query))
      );
      const matchesTags = selectedTags.length === 0 ||
        selectedTags.every((tag) => prompt.tags.includes(tag));
      return matchesSearch && matchesTags;
    });

    return filtered.sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      if (sortMode === 'manual') {
        return (a.order || 0) - (b.order || 0);
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [prompts, searchQuery, selectedTags, sortMode]);

  return (
    <div className="min-h-screen bg-background bg-dot-grid bg-gradient-wash noise-overlay">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* ── Header toolbar ─────────────────────────── */}
        <header className="flex items-center justify-between gap-4 mb-6 animate-fade-in">
          {/* Left: Logo + title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
              <span className="text-primary font-semibold text-sm">/</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight truncate">
              Prompt Library
            </h1>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isAuthenticated && (
              <SyncIndicator
                status={syncState.status}
                lastSyncAt={syncState.lastSyncAt}
                pendingChanges={syncState.pendingChanges}
                error={syncState.error}
              />
            )}

            {!isAuthenticated && !authLoading && (
              <SyncCTA onPreAuth={() => savePreAuthSnapshot(prompts)} />
            )}

            {/* Sort toggle */}
            <div className="hidden sm:flex items-center rounded-lg border border-border bg-secondary/50 p-0.5">
              <button
                onClick={() => { playClick(); setSortMode('manual'); }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  sortMode === 'manual'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <GripVertical className="h-3.5 w-3.5" />
                Manual
              </button>
              <button
                onClick={() => { playClick(); setSortMode('date'); }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  sortMode === 'date'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                Date
              </button>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                playClick();
                setSoundEnabled(!soundEnabled);
                toast.success(soundEnabled ? 'Sounds disabled' : 'Sounds enabled');
              }}
              title={soundEnabled ? 'Disable sounds' : 'Enable sounds'}
              className="hidden sm:flex h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>

            <SyncSettingsDropdown
              prompts={prompts}
              onImport={setPrompts}
              onSignOut={signOut}
              onManualSync={isAuthenticated ? manualSync : undefined}
              deviceName={deviceName}
              userEmail={isAuthenticated ? user?.email : undefined}
              deviceId={deviceId}
            />
          </div>
        </header>

        {/* ── Separator ──────────────────────────────── */}
        <div className="h-px bg-border mb-8" />

        {/* ── Prompt form ────────────────────────────── */}
        <div ref={formRef} className="mb-8 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
          <PromptForm
            onSave={handleSavePrompt}
            editingPrompt={editingPrompt}
            onCancelEdit={() => setEditingPrompt(null)}
            onGenerateTitle={playSuccess}
            onCancel={playClick}
            existingTags={allTags}
          />
        </div>

        {/* ── Search + stats ─────────────────────────── */}
        <div className="mb-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <TagFilterBar
            allTags={allTags}
            selectedTags={selectedTags}
            onToggleTag={handleToggleTag}
            onClearTags={handleClearTags}
          />
        </div>

        <div className="mb-6 flex items-center gap-3 text-xs font-medium text-muted-foreground animate-fade-in" style={{ animationDelay: '150ms' }}>
          <span className="tabular-nums">{prompts.length} prompts</span>
          <span className="w-1 h-1 rounded-full bg-border" />
          <span className="tabular-nums">{prompts.filter((p) => p.isPinned).length} pinned</span>
          {(searchQuery || selectedTags.length > 0) && (
            <>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span className="tabular-nums">{filteredPrompts.length} results</span>
            </>
          )}
          {selectedTags.length > 0 && (
            <>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span className="tabular-nums">{selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} active</span>
            </>
          )}
        </div>

        {/* ── Card grid ──────────────────────────────── */}
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
                {filteredPrompts.map((prompt, i) => (
                  <div
                    key={prompt.id}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                  >
                    <SortablePromptCard
                      prompt={prompt}
                      onEdit={handleEdit}
                      onDelete={handleDeletePrompt}
                      onTogglePin={handleTogglePin}
                      onPreview={setPreviewPrompt}
                      onTagClick={handleToggleTag}
                      isDragEnabled={sortMode === 'manual'}
                    />
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="text-center py-20 animate-fade-in">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-secondary border border-border mb-5">
              <span className="text-2xl text-muted-foreground font-light">/</span>
            </div>
            <h3 className="text-lg font-semibold mb-2 text-foreground">
              {searchQuery ? 'No prompts found' : 'No prompts yet'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
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
        onDelete={handleDeletePrompt}
        onTagClick={handleToggleTag}
      />

      <MigrationWizard
        open={showMigrationWizard}
        onOpenChange={setShowMigrationWizard}
        localPrompts={getLocalPromptsFromStorage()}
        onFetchRemote={fetchRemotePrompts}
        onComplete={handleMigrationComplete}
        onUploadToCloud={uploadToCloud}
      />
    </div>
  );
};

export default Index;
