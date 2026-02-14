import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Prompt } from '@/types/prompt';
import { syncPromptTags, fetchTagsForPrompts, syncAllPromptTags } from '@/utils/tagSync';

const LOCAL_STORAGE_KEY = 'prompts';

interface UsePromptsOptions {
  syncEnabled: boolean;
  userId: string | null;
  deviceId: string;
  hasMigrated: boolean;
}

interface SyncState {
  status: 'idle' | 'syncing' | 'synced' | 'error' | 'offline';
  lastSyncAt: Date | null;
  pendingChanges: number;
  error: string | null;
}

export function usePrompts({ syncEnabled, userId, deviceId, hasMigrated }: UsePromptsOptions) {
  const [prompts, setPromptsState] = useState<Prompt[]>(() => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });

  const [syncState, setSyncState] = useState<SyncState>({
    status: 'idle',
    lastSyncAt: null,
    pendingChanges: 0,
    error: null,
  });

  const [isLoading, setIsLoading] = useState(false);
  const syncQueueRef = useRef<Map<string, 'create' | 'update' | 'delete'>>(new Map());

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(prompts));
  }, [prompts]);

  const fetchRemotePrompts = useCallback(async () => {
    if (!syncEnabled || !userId) return [];

    setIsLoading(true);
    setSyncState(prev => ({ ...prev, status: 'syncing' }));

    try {
      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .eq('user_id', userId)
        .is('archived_at', null)
        .order('order_index', { ascending: true });

      if (error) throw error;

      const promptIds = (data || []).map(p => p.id);
      const tagsMap = await fetchTagsForPrompts(supabase, userId, promptIds);

      const remotePrompts: Prompt[] = (data || []).map(p => ({
        id: p.id,
        title: p.title,
        content: p.content,
        tags: tagsMap.get(p.id) || [],
        isPinned: p.is_pinned || false,
        order: p.order_index || 0,
        createdAt: p.created_at || new Date().toISOString(),
        updatedAt: p.updated_at || new Date().toISOString(),
      }));

      setSyncState({
        status: 'synced',
        lastSyncAt: new Date(),
        pendingChanges: 0,
        error: null,
      });

      return remotePrompts;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch prompts';
      setSyncState(prev => ({
        ...prev,
        status: 'error',
        error: message,
      }));
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [syncEnabled, userId]);

  useEffect(() => {
    if (syncEnabled && userId && hasMigrated) {
      console.log('[Sync] Migration complete, fetching remote prompts...');
      fetchRemotePrompts().then(remote => {
        console.log(`[Sync] Fetched ${remote.length} prompts from cloud`);
        if (remote.length > 0) {
          setPromptsState(remote);
        }
      });
    }
  }, [syncEnabled, userId, hasMigrated, fetchRemotePrompts]);

  const safeOrderIndex = (order: number | undefined): number => {
    if (typeof order !== 'number' || order > 2147483647 || order < 0) {
      return 0;
    }
    return Math.floor(order);
  };

  const createPrompt = useCallback(async (promptData: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newPrompt: Prompt = {
      ...promptData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setPromptsState(prev => [newPrompt, ...prev]);

    if (syncEnabled && userId) {
      try {
        const { error } = await supabase.from('prompts').insert({
          id: newPrompt.id,
          user_id: userId,
          device_id: deviceId,
          title: newPrompt.title,
          content: newPrompt.content,
          is_pinned: newPrompt.isPinned,
          order_index: safeOrderIndex(newPrompt.order),
          checksum: '',
        });

        if (error) throw error;

        try {
          await syncPromptTags(supabase, userId, newPrompt.id, newPrompt.tags);
        } catch (tagErr) {
          console.warn('[TagSync] Failed to sync tags for new prompt:', tagErr);
        }

        setSyncState(prev => ({ ...prev, status: 'synced', lastSyncAt: new Date() }));
      } catch (error) {
        console.error('Failed to sync new prompt:', error);
        syncQueueRef.current.set(newPrompt.id, 'create');
        setSyncState(prev => ({
          ...prev,
          status: 'error',
          pendingChanges: syncQueueRef.current.size,
          error: 'Failed to sync',
        }));
      }
    }

    return newPrompt;
  }, [syncEnabled, userId, deviceId]);

  const updatePrompt = useCallback(async (id: string, updates: Partial<Omit<Prompt, 'id' | 'createdAt'>>) => {
    const updatedAt = new Date().toISOString();

    setPromptsState(prev =>
      prev.map(p => (p.id === id ? { ...p, ...updates, updatedAt } : p))
    );

    if (syncEnabled && userId) {
      try {
        const { error } = await supabase
          .from('prompts')
          .update({
            title: updates.title,
            content: updates.content,
            is_pinned: updates.isPinned,
            order_index: updates.order !== undefined ? safeOrderIndex(updates.order) : undefined,
            device_id: deviceId,
          })
          .eq('id', id)
          .eq('user_id', userId);

        if (error) throw error;

        if (updates.tags !== undefined) {
          try {
            await syncPromptTags(supabase, userId, id, updates.tags);
          } catch (tagErr) {
            console.warn('[TagSync] Failed to sync tags for prompt update:', tagErr);
          }
        }

        setSyncState(prev => ({ ...prev, status: 'synced', lastSyncAt: new Date() }));
      } catch (error) {
        console.error('Failed to sync prompt update:', error);
        syncQueueRef.current.set(id, 'update');
        setSyncState(prev => ({
          ...prev,
          status: 'error',
          pendingChanges: syncQueueRef.current.size,
        }));
      }
    }
  }, [syncEnabled, userId, deviceId]);

  const deletePrompt = useCallback(async (id: string) => {
    setPromptsState(prev => prev.filter(p => p.id !== id));

    if (syncEnabled && userId) {
      try {
        const { error } = await supabase
          .from('prompts')
          .delete()
          .eq('id', id)
          .eq('user_id', userId);

        if (error) throw error;

        setSyncState(prev => ({ ...prev, status: 'synced', lastSyncAt: new Date() }));
      } catch (error) {
        console.error('Failed to sync prompt deletion:', error);
        syncQueueRef.current.set(id, 'delete');
        setSyncState(prev => ({
          ...prev,
          status: 'error',
          pendingChanges: syncQueueRef.current.size,
        }));
      }
    }
  }, [syncEnabled, userId]);

  const togglePin = useCallback(async (id: string) => {
    const prompt = prompts.find(p => p.id === id);
    if (prompt) {
      await updatePrompt(id, { isPinned: !prompt.isPinned });
    }
  }, [prompts, updatePrompt]);

  const reorderPrompts = useCallback(async (reorderedPrompts: Prompt[]) => {
    setPromptsState(reorderedPrompts);

    if (syncEnabled && userId) {
      const updates = reorderedPrompts.map((p, idx) => ({
        id: p.id,
        order_index: idx,
      }));

      for (const update of updates) {
        await supabase
          .from('prompts')
          .update({ order_index: update.order_index })
          .eq('id', update.id)
          .eq('user_id', userId);
      }
    }
  }, [syncEnabled, userId]);

  const setPrompts = useCallback((newPrompts: Prompt[]) => {
    setPromptsState(newPrompts);
  }, []);

  const uploadToCloud = useCallback(async (promptsToUpload: Prompt[]) => {
    if (!syncEnabled || !userId) {
      console.error('[Sync] Upload failed: not authenticated');
      return { success: false, error: 'Not authenticated' };
    }

    console.log(`[Sync] Uploading ${promptsToUpload.length} prompts to cloud...`);
    setSyncState(prev => ({ ...prev, status: 'syncing' }));

    try {
      for (const prompt of promptsToUpload) {
        console.log(`[Sync] Uploading prompt: ${prompt.id} - ${prompt.title}`);
        const { error } = await supabase.from('prompts').upsert({
          id: prompt.id,
          user_id: userId,
          device_id: deviceId,
          title: prompt.title,
          content: prompt.content,
          is_pinned: prompt.isPinned,
          order_index: safeOrderIndex(prompt.order),
          checksum: '',
        });

        if (error) {
          console.error('[Sync] Upload error:', error);
          throw error;
        }
      }

      try {
        await syncAllPromptTags(supabase, userId, promptsToUpload);
      } catch (tagErr) {
        console.warn('[TagSync] Failed to sync tags during upload:', tagErr);
      }

      console.log('[Sync] Upload complete!');
      setSyncState({
        status: 'synced',
        lastSyncAt: new Date(),
        pendingChanges: 0,
        error: null,
      });

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      console.error('[Sync] Upload failed:', message);
      setSyncState(prev => ({ ...prev, status: 'error', error: message }));
      return { success: false, error: message };
    }
  }, [syncEnabled, userId, deviceId]);

  const manualSync = useCallback(async () => {
    if (!syncEnabled || !userId) {
      console.log('[Sync] Manual sync skipped - not authenticated');
      return;
    }
    
    console.log('[Sync] Manual sync triggered');
    const remote = await fetchRemotePrompts();
    if (remote.length > 0) {
      setPromptsState(remote);
      console.log(`[Sync] Manual sync complete - loaded ${remote.length} prompts`);
    }
  }, [syncEnabled, userId, fetchRemotePrompts]);

  return {
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
  };
}
