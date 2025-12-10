import { useState, useMemo, useRef, useEffect } from 'react';
import { PromptForm } from '@/components/PromptForm';
import { SortablePromptCard } from '@/components/SortablePromptCard';
import { PromptPreviewDialog } from '@/components/PromptPreviewDialog';
import { SearchBar } from '@/components/SearchBar';
import { ExportButton } from '@/components/ExportButton';
import { SyncCTA } from '@/components/SyncCTA';
import { SyncIndicator } from '@/components/SyncIndicator';
import { SyncSettingsDropdown } from '@/components/SyncSettingsDropdown';
import { AuthModal } from '@/components/AuthModal';
import { MigrationWizard } from '@/components/MigrationWizard';
import { ConflictResolver } from '@/components/ConflictResolver';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useSound } from '@/hooks/useSound';
import { useAuth } from '@/hooks/useAuth';
import { useSyncEnabled } from '@/hooks/useSyncEnabled';
import { useSyncQueue } from '@/hooks/useSyncQueue';
import { usePrompts } from '@/hooks/usePrompts';
import { MergeConflict } from '@/utils/mergePrompts';
import { BookOpen, Sparkles, GripVertical, Volume2, VolumeX, LogOut } from 'lucide-react';
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
  // Auth & Sync state
  const { user, isAuthenticated, isLoading: authLoading, signOut } = useAuth();
  const { syncEnabled, setSyncEnabled } = useSyncEnabled();
  const { syncStatus, pendingCount, lastSyncAt } = useSyncQueue();
  
  // Use the unified prompts hook
  const { 
    prompts, 
    isLoading: promptsLoading, 
    createPrompt, 
    updatePrompt, 
    deletePrompt,
    refreshPrompts 
  } = usePrompts();

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [previewPrompt, setPreviewPrompt] = useState<Prompt | null>(null);
  const [sortMode, setSortMode] = useLocalStorage<'manual' | 'date'>('sort-mode', 'manual');
  const { soundEnabled, setSoundEnabled, playClick, playSuccess } = useSound();
  const formRef = useRef<HTMLDivElement>(null);

  // Modal state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [migrationWizardOpen, setMigrationWizardOpen] = useState(false);
  const [conflicts, setConflicts] = useState<MergeConflict[]>([]);
  const [activeConflict, setActiveConflict] = useState<MergeConflict | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle auth state changes
  useEffect(() => {
    if (isAuthenticated && syncEnabled && !migrationWizardOpen) {
      // User just authenticated, refresh prompts from cloud
      refreshPrompts();
    }
  }, [isAuthenticated, syncEnabled]);

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
    const prompt = prompts.find(p => p.id === id);
    if (prompt) {
      await updatePrompt(id, { isPinned: !prompt.isPinned });
    }
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

  const handleDragEnd = async (event: DragEndEvent) => {
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
    
    // Update order for all reordered prompts
    for (let idx = 0; idx < reorderedVisible.length; idx++) {
      const prompt = reorderedVisible[idx];
      if (prompt.order !== idx) {
        await updatePrompt(prompt.id, { order: idx });
      }
    }
    
    toast.success('Order updated');
  };

  const handleDragStart = () => {
    if (sortMode !== 'manual') {
      toast.info('Switch to Manual Order mode to reorder prompts');
    }
  };

  // Sync handlers
  const handleSyncClick = () => {
    if (isAuthenticated) {
      // Already authenticated, open migration wizard
      setMigrationWizardOpen(true);
    } else {
      // Need to authenticate first
      setAuthModalOpen(true);
    }
  };

  const handleAuthSuccess = () => {
    setAuthModalOpen(false);
    // Open migration wizard after successful auth
    setMigrationWizardOpen(true);
  };

  const handleMigrationComplete = (mergedPrompts: Prompt[], newConflicts: MergeConflict[]) => {
    setSyncEnabled(true);
    setMigrationWizardOpen(false);
    
    if (newConflicts.length > 0) {
      setConflicts(newConflicts);
      toast.info(`${newConflicts.length} conflict(s) need your attention`);
    } else {
      toast.success('Sync enabled! Your prompts are now synced to the cloud.');
    }
    
    refreshPrompts();
  };

  const handleDisconnectSync = async () => {
    setSyncEnabled(false);
    await signOut();
    toast.success('Sync disconnected. Your prompts are now stored locally only.');
  };

  const handleImportPrompts = async (newPrompts: Prompt[]) => {
    for (const prompt of newPrompts) {
      await createPrompt({
        title: prompt.title,
        content: prompt.content,
        tags: prompt.tags,
        isPinned: prompt.isPinned,
        order: prompt.order,
      });
    }
  };

  const handleResolveConflict = async (resolved: Prompt[]) => {
    // Apply resolution
    for (const prompt of resolved) {
      await updatePrompt(prompt.id, prompt);
    }
    
    // Remove from conflicts list
    setConflicts(prev => prev.filter(c => c.promptId !== activeConflict?.promptId));
    setActiveConflict(null);
    
    toast.success('Conflict resolved');
  };

  const handleSignOut = async () => {
    await signOut();
    setSyncEnabled(false);
    toast.success('Signed out successfully');
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

  // Check for conflicts in visible prompts
  const promptsWithConflicts = useMemo(() => {
    const conflictIds = new Set(conflicts.map(c => c.promptId));
    return filteredPrompts.map(p => ({
      ...p,
      hasConflict: conflictIds.has(p.id),
    }));
  }, [filteredPrompts, conflicts]);

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
            <div className="flex items-center gap-2">
              {/* Sync indicator (show when sync is enabled) */}
              {syncEnabled && isAuthenticated && (
                <SyncIndicator 
                  status={syncStatus} 
                  pendingCount={pendingCount} 
                  lastSyncAt={lastSyncAt} 
                />
              )}
              
              {/* Sync CTA (show when sync is not enabled) */}
              {!syncEnabled && (
                <SyncCTA onClick={handleSyncClick} />
              )}

              {/* Sort buttons */}
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
                <span className="hidden sm:inline">Manual Order</span>
              </Button>
              <Button
                variant={sortMode === 'date' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  playClick();
                  setSortMode('date');
                }}
              >
                <span className="hidden sm:inline">Sort by Date</span>
                <span className="sm:hidden">Date</span>
              </Button>
              
              {/* Sound toggle */}
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
              
              {/* Export button */}
              <ExportButton prompts={prompts} onExport={playSuccess} />
              
              {/* Settings dropdown with import/export */}
              <SyncSettingsDropdown
                prompts={prompts}
                onImport={handleImportPrompts}
                onDisconnectSync={handleDisconnectSync}
                syncEnabled={syncEnabled}
              />

              {/* Sign out button (show when authenticated) */}
              {isAuthenticated && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <p className="text-muted-foreground">
            {syncEnabled && isAuthenticated
              ? 'Your prompts sync automatically across all your devices.'
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
          {conflicts.length > 0 && (
            <>
              <span>•</span>
              <span className="text-amber-500">Conflicts: {conflicts.length}</span>
            </>
          )}
        </div>

        {/* Prompts Grid */}
        {promptsLoading ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4 animate-pulse">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Loading prompts...</p>
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
                {promptsWithConflicts.map((prompt) => (
                  <SortablePromptCard
                    key={prompt.id}
                    prompt={prompt}
                    onEdit={handleEdit}
                    onDelete={handleDeletePrompt}
                    onTogglePin={handleTogglePin}
                    onPreview={setPreviewPrompt}
                    isDragEnabled={sortMode === 'manual'}
                    hasConflict={prompt.hasConflict}
                    onResolveConflict={() => {
                      const conflict = conflicts.find(c => c.promptId === prompt.id);
                      if (conflict) {
                        setActiveConflict(conflict);
                      }
                    }}
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

      {/* Dialogs */}
      <PromptPreviewDialog
        prompt={previewPrompt}
        open={!!previewPrompt}
        onOpenChange={(open) => !open && setPreviewPrompt(null)}
        onEdit={handleEdit}
        onTogglePin={handleTogglePin}
      />

      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        onSuccess={handleAuthSuccess}
      />

      <MigrationWizard
        open={migrationWizardOpen}
        onOpenChange={setMigrationWizardOpen}
        localPrompts={prompts}
        onMigrationComplete={handleMigrationComplete}
      />

      <ConflictResolver
        conflict={activeConflict}
        open={!!activeConflict}
        onOpenChange={(open) => !open && setActiveConflict(null)}
        onResolve={handleResolveConflict}
      />
    </div>
  );
};

export default Index;
