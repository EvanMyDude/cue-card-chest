import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PromptPack {
  id: string;
  name: string;
  description: string | null;
  version: number;
  is_active: boolean;
}

interface ImportResult {
  imported: number;
  skipped: number;
  packName?: string;
  message: string;
}

export function usePromptPacks() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActivePacks = async (): Promise<PromptPack[]> => {
    const { data, error } = await supabase
      .from('prompt_packs')
      .select('id, name, description, version, is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch packs:', error);
      throw new Error('Failed to fetch prompt packs');
    }

    return data || [];
  };

  const importPack = async (packId: string, deviceId?: string): Promise<ImportResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('import-pack', {
        body: { packId, deviceId },
      });

      if (fnError) {
        console.error('Import pack error:', fnError);
        throw new Error(fnError.message || 'Failed to import pack');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data as ImportResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import pack';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const getStarterPackId = (): string => {
    // The seeded starter pack ID
    return 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  };

  return {
    fetchActivePacks,
    importPack,
    getStarterPackId,
    isLoading,
    error,
  };
}
