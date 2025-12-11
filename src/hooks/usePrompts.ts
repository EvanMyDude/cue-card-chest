import { useState, useEffect, useCallback } from 'react';
import { Prompt } from '@/types/prompt';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useSyncEnabled } from './useSyncEnabled';
import { useDeviceId } from './useDeviceId';
import { useSyncQueue, SyncAction } from './useSyncQueue';

const LOCAL_STORAGE_KEY = 'prompts';

interface UsePromptsReturn {
  prompts: Prompt[];
  isLoading: boolean;
  error: string | null;
  createPrompt: (data: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Prompt>;
  updatePrompt: (id: string, data: Partial<Prompt>) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  refreshPrompts: () => Promise<void>;
}

function getLocalPrompts(): Prompt[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

function setLocalPrompts(prompts: Prompt[]): void {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(prompts));
}

export function usePrompts(): UsePromptsReturn {
  const { user, isAuthenticated } = useAuth();
  const { syncEnabled } = useSyncEnabled();
  const { deviceId } = useDeviceId();
  const { queueChange, syncStatus } = useSyncQueue();

  const [prompts, setPrompts] = useState<Prompt[]>(() => getLocalPrompts());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch prompts from Supabase when sync is enabled and user is authenticated
  const fetchRemotePrompts = useCallback(async () => {
    if (!syncEnabled || !isAuthenticated || !user) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('prompts')
        .select(`
          id,
          title,
          content,
          is_pinned,
          order_index,
          created_at,
          updated_at,
          prompt_tags (
            tags (name)
          )
        `)
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('order_index', { ascending: true });

      if (fetchError) throw fetchError;

      const remotePrompts: Prompt[] = (data || []).map(p => ({
        id: p.id,
        title: p.title,
        content: p.content,
        tags: p.prompt_tags?.map((pt: any) => pt.tags?.name).filter(Boolean) || [],
        isPinned: p.is_pinned || false,
        order: p.order_index || 0,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }));

      setPrompts(remotePrompts);
      setLocalPrompts(remotePrompts); // Cache locally
    } catch (e) {
      console.error('Error fetching prompts:', e);
      setError('Failed to load prompts from cloud');
      // Fall back to local
      setPrompts(getLocalPrompts());
    } finally {
      setIsLoading(false);
    }
  }, [syncEnabled, isAuthenticated, user]);

  // Load prompts on mount and when sync state changes
  useEffect(() => {
    if (syncEnabled && isAuthenticated) {
      fetchRemotePrompts();
    } else {
      setPrompts(getLocalPrompts());
    }
  }, [syncEnabled, isAuthenticated, fetchRemotePrompts]);

  const createPrompt = useCallback(async (
    data: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Prompt> => {
    const now = new Date().toISOString();
    const newPrompt: Prompt = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    // Update local state immediately
    const updated = [...prompts, newPrompt];
    setPrompts(updated);
    setLocalPrompts(updated);

    // Sync to cloud if enabled
    if (syncEnabled && isAuthenticated && user) {
      try {
        // Checksum is computed automatically by database trigger
        const { error: insertError } = await supabase.from('prompts').insert({
          id: newPrompt.id,
          user_id: user.id,
          device_id: deviceId,
          title: newPrompt.title,
          content: newPrompt.content,
          is_pinned: newPrompt.isPinned,
          order_index: newPrompt.order,
          checksum: '', // Will be overwritten by trigger
        });

        if (insertError) throw insertError;

        // Handle tags
        if (newPrompt.tags.length > 0) {
          for (const tagName of newPrompt.tags) {
            // Get or create tag
            let { data: existingTag } = await supabase
              .from('tags')
              .select('id')
              .eq('user_id', user.id)
              .eq('name', tagName)
              .single();

            if (!existingTag) {
              const { data: newTag } = await supabase
                .from('tags')
                .insert({ user_id: user.id, name: tagName })
                .select('id')
                .single();
              existingTag = newTag;
            }

            if (existingTag) {
              await supabase.from('prompt_tags').insert({
                prompt_id: newPrompt.id,
                tag_id: existingTag.id,
              });
            }
          }
        }
      } catch (e) {
        console.error('Error syncing new prompt:', e);
        queueChange('create', newPrompt);
      }
    }

    return newPrompt;
  }, [prompts, syncEnabled, isAuthenticated, user, deviceId, queueChange]);

  const updatePrompt = useCallback(async (id: string, data: Partial<Prompt>): Promise<void> => {
    const now = new Date().toISOString();
    
    const updated = prompts.map(p => 
      p.id === id ? { ...p, ...data, updatedAt: now } : p
    );
    setPrompts(updated);
    setLocalPrompts(updated);

    const updatedPrompt = updated.find(p => p.id === id);
    if (!updatedPrompt) return;

    if (syncEnabled && isAuthenticated && user) {
      try {
        const { error: updateError } = await supabase.from('prompts')
          .update({
            title: updatedPrompt.title,
            content: updatedPrompt.content,
            is_pinned: updatedPrompt.isPinned,
            order_index: updatedPrompt.order,
            device_id: deviceId,
          })
          .eq('id', id)
          .eq('user_id', user.id);

        if (updateError) throw updateError;
      } catch (e) {
        console.error('Error syncing prompt update:', e);
        queueChange('update', updatedPrompt);
      }
    }
  }, [prompts, syncEnabled, isAuthenticated, user, deviceId, queueChange]);

  const deletePrompt = useCallback(async (id: string): Promise<void> => {
    const promptToDelete = prompts.find(p => p.id === id);
    const updated = prompts.filter(p => p.id !== id);
    setPrompts(updated);
    setLocalPrompts(updated);

    if (syncEnabled && isAuthenticated && user && promptToDelete) {
      try {
        const { error: deleteError } = await supabase.from('prompts')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);

        if (deleteError) throw deleteError;
      } catch (e) {
        console.error('Error syncing prompt deletion:', e);
        queueChange('delete', promptToDelete);
      }
    }
  }, [prompts, syncEnabled, isAuthenticated, user, queueChange]);

  const refreshPrompts = useCallback(async () => {
    if (syncEnabled && isAuthenticated) {
      await fetchRemotePrompts();
    } else {
      setPrompts(getLocalPrompts());
    }
  }, [syncEnabled, isAuthenticated, fetchRemotePrompts]);

  return {
    prompts,
    isLoading,
    error,
    createPrompt,
    updatePrompt,
    deletePrompt,
    refreshPrompts,
  };
}
