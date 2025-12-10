import { useState, useEffect, useCallback } from 'react';
import { Prompt } from '@/types/prompt';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useSyncEnabled } from './useSyncEnabled';

const QUEUE_KEY = 'promptLibrary_syncQueue';

export type SyncAction = 'create' | 'update' | 'delete';
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

interface QueuedChange {
  id: string;
  action: SyncAction;
  prompt: Prompt;
  timestamp: string;
  retryCount: number;
}

interface UseSyncQueueReturn {
  syncStatus: SyncStatus;
  pendingCount: number;
  lastSyncAt: string | null;
  queueChange: (action: SyncAction, prompt: Prompt) => void;
  flushQueue: () => Promise<void>;
  clearQueue: () => void;
}

export function useSyncQueue(): UseSyncQueueReturn {
  const { user, isAuthenticated } = useAuth();
  const { syncEnabled } = useSyncEnabled();
  
  const [queue, setQueue] = useState<QueuedChange[]>(() => {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  });
  
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  // Persist queue to localStorage
  useEffect(() => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }, [queue]);

  // Check online status
  useEffect(() => {
    const handleOnline = () => {
      if (syncStatus === 'offline') {
        setSyncStatus('idle');
      }
    };
    
    const handleOffline = () => {
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (!navigator.onLine) {
      setSyncStatus('offline');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncStatus]);

  const queueChange = useCallback((action: SyncAction, prompt: Prompt) => {
    if (!syncEnabled) return;

    const change: QueuedChange = {
      id: crypto.randomUUID(),
      action,
      prompt,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };

    setQueue(prev => [...prev, change]);
  }, [syncEnabled]);

  const flushQueue = useCallback(async () => {
    if (!syncEnabled || !isAuthenticated || !user || queue.length === 0) {
      return;
    }

    if (!navigator.onLine) {
      setSyncStatus('offline');
      return;
    }

    setSyncStatus('syncing');

    const failedChanges: QueuedChange[] = [];

    for (const change of queue) {
      try {
        switch (change.action) {
          case 'create':
            await supabase.from('prompts').insert({
              id: change.prompt.id,
              user_id: user.id,
              title: change.prompt.title,
              content: change.prompt.content,
              is_pinned: change.prompt.isPinned,
              order_index: change.prompt.order,
              checksum: '', // Will be overwritten by trigger
            });
            break;

          case 'update':
            await supabase.from('prompts')
              .update({
                title: change.prompt.title,
                content: change.prompt.content,
                is_pinned: change.prompt.isPinned,
                order_index: change.prompt.order,
              })
              .eq('id', change.prompt.id)
              .eq('user_id', user.id);
            break;

          case 'delete':
            await supabase.from('prompts')
              .delete()
              .eq('id', change.prompt.id)
              .eq('user_id', user.id);
            break;
        }
      } catch (error) {
        console.error('Sync error:', error);
        if (change.retryCount < 3) {
          failedChanges.push({ ...change, retryCount: change.retryCount + 1 });
        }
      }
    }

    setQueue(failedChanges);
    
    if (failedChanges.length > 0) {
      setSyncStatus('error');
    } else {
      setSyncStatus('idle');
      setLastSyncAt(new Date().toISOString());
    }
  }, [syncEnabled, isAuthenticated, user, queue]);

  // Auto-flush when coming online
  useEffect(() => {
    if (syncStatus === 'idle' && queue.length > 0 && navigator.onLine && isAuthenticated) {
      flushQueue();
    }
  }, [syncStatus, queue.length, isAuthenticated, flushQueue]);

  const clearQueue = useCallback(() => {
    setQueue([]);
    localStorage.removeItem(QUEUE_KEY);
  }, []);

  return {
    syncStatus,
    pendingCount: queue.length,
    lastSyncAt,
    queueChange,
    flushQueue,
    clearQueue,
  };
}
