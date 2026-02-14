import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ImportResult {
  imported: number;
  skipped: number;
  packName?: string;
  message: string;
}

const STARTER_PACK_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

export function usePromptPacks() {
  const [isLoading, setIsLoading] = useState(false);

  const importPack = async (packId: string, deviceId?: string): Promise<ImportResult> => {
    setIsLoading(true);

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
    } finally {
      setIsLoading(false);
    }
  };

  function getStarterPackId(): string {
    return STARTER_PACK_ID;
  }

  return {
    importPack,
    getStarterPackId,
    isLoading,
  };
}
