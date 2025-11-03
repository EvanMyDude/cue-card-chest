/**
 * Import logic with deduplication and progress reporting
 * Safely imports prompts from backup with checksum-based deduplication
 */

import { supabase } from '@/integrations/supabase/client';
import { computeChecksum } from './checksum';
import type { Prompt } from '@/types/prompt';
import type { BackupData } from './backup';

export interface ImportProgress {
  phase: 'validating' | 'checking' | 'importing' | 'complete';
  current: number;
  total: number;
  message: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  merged: number;
  errors: string[];
  promptIdMap: Record<string, string>; // oldId -> newId
}

const BATCH_SIZE = 200;

type ProgressCallback = (progress: ImportProgress) => void;

/**
 * Import prompts from backup with deduplication
 */
export async function importPromptsFromBackup(
  backup: BackupData,
  userId: string,
  deviceId: string,
  onProgress?: ProgressCallback
): Promise<ImportResult> {
  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    merged: 0,
    errors: [],
    promptIdMap: {},
  };

  try {
    // Phase 1: Validation
    onProgress?.({
      phase: 'validating',
      current: 0,
      total: backup.prompts.length,
      message: 'Validating backup data...',
    });

    if (!backup.manifest || !backup.prompts) {
      throw new Error('Invalid backup format');
    }

    if (backup.prompts.length === 0) {
      return result;
    }

    // Phase 2: Check existing checksums in Supabase
    onProgress?.({
      phase: 'checking',
      current: 0,
      total: backup.prompts.length,
      message: 'Checking for duplicates...',
    });

    const checksums = Object.values(backup.manifest.checksums);
    const { data: existingPrompts, error: checkError } = await supabase
      .from('prompts')
      .select('id, checksum')
      .eq('user_id', userId)
      .in('checksum', checksums);

    if (checkError) {
      throw new Error(`Failed to check existing prompts: ${checkError.message}`);
    }

    const existingChecksums = new Set(existingPrompts?.map(p => p.checksum) || []);
    console.log('[Importer] Found', existingChecksums.size, 'existing prompts');

    // Phase 3: Prepare imports (deduplicate)
    const toImport: Array<{
      prompt: Prompt;
      checksum: string;
      newId: string;
    }> = [];

    for (const prompt of backup.prompts) {
      const checksum = backup.manifest.checksums[prompt.id];
      
      if (!checksum) {
        result.errors.push(`Missing checksum for prompt: ${prompt.id}`);
        continue;
      }

      if (existingChecksums.has(checksum)) {
        result.skipped++;
        continue;
      }

      const newId = crypto.randomUUID();
      result.promptIdMap[prompt.id] = newId;
      
      toImport.push({
        prompt,
        checksum,
        newId,
      });
    }

    console.log('[Importer] To import:', toImport.length, 'prompts');

    // Phase 4: Import in batches
    onProgress?.({
      phase: 'importing',
      current: 0,
      total: toImport.length,
      message: 'Importing prompts...',
    });

    const batches = chunkArray(toImport, BATCH_SIZE);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      try {
        await importBatch(batch, userId, deviceId);
        result.imported += batch.length;
        
        onProgress?.({
          phase: 'importing',
          current: result.imported,
          total: toImport.length,
          message: `Imported ${result.imported} of ${toImport.length} prompts...`,
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        result.errors.push(`Batch ${batchIndex + 1} failed: ${error.message}`);
        console.error('[Importer] Batch import failed:', error);
      }
    }

    // Phase 5: Complete
    onProgress?.({
      phase: 'complete',
      current: toImport.length,
      total: toImport.length,
      message: 'Import complete',
    });

    console.log('[Importer] Import result:', result);
    return result;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    result.errors.push(error.message);
    throw error;
  }
}

/**
 * Import a batch of prompts with tags
 */
async function importBatch(
  batch: Array<{ prompt: Prompt; checksum: string; newId: string }>,
  userId: string,
  deviceId: string
): Promise<void> {
  const now = new Date().toISOString();

  // Collect all unique tag names
  const allTags = new Set<string>();
  batch.forEach(item => {
    item.prompt.tags.forEach(tag => allTags.add(tag));
  });

  // Upsert tags
  const tagNameToId: Record<string, string> = {};
  
  if (allTags.size > 0) {
    const { data: existingTags } = await supabase
      .from('tags')
      .select('id, name')
      .eq('user_id', userId)
      .in('name', Array.from(allTags));

    // Map existing tags
    existingTags?.forEach(tag => {
      tagNameToId[tag.name] = tag.id;
    });

    // Create missing tags
    const missingTags = Array.from(allTags).filter(name => !tagNameToId[name]);
    
    if (missingTags.length > 0) {
      const newTags = missingTags.map(name => ({
        id: crypto.randomUUID(),
        user_id: userId,
        name,
        created_at: now,
      }));

      const { data: createdTags, error: tagError } = await supabase
        .from('tags')
        .insert(newTags)
        .select('id, name');

      if (tagError) {
        throw new Error(`Failed to create tags: ${tagError.message}`);
      }

      createdTags?.forEach(tag => {
        tagNameToId[tag.name] = tag.id;
      });
    }
  }

  // Insert prompts
  const promptRecords = batch.map(item => ({
    id: item.newId,
    user_id: userId,
    device_id: deviceId,
    title: item.prompt.title,
    content: item.prompt.content,
    checksum: item.checksum,
    is_pinned: item.prompt.isPinned,
    order_index: item.prompt.order,
    version: 1,
    created_at: item.prompt.createdAt || now,
    updated_at: item.prompt.updatedAt || now,
  }));

  const { error: promptError } = await supabase
    .from('prompts')
    .insert(promptRecords);

  if (promptError) {
    throw new Error(`Failed to insert prompts: ${promptError.message}`);
  }

  // Insert prompt-tag relationships
  const promptTagRecords: Array<{ prompt_id: string; tag_id: string }> = [];
  
  batch.forEach(item => {
    item.prompt.tags.forEach(tagName => {
      const tagId = tagNameToId[tagName];
      if (tagId) {
        promptTagRecords.push({
          prompt_id: item.newId,
          tag_id: tagId,
        });
      }
    });
  });

  if (promptTagRecords.length > 0) {
    const { error: relationError } = await supabase
      .from('prompt_tags')
      .insert(promptTagRecords);

    if (relationError) {
      // Non-fatal - log but don't fail
      console.warn('[Importer] Failed to insert some tag relationships:', relationError);
    }
  }
}

/**
 * Dry run import (validate without writing)
 */
export async function dryRunImport(
  backup: BackupData,
  userId: string
): Promise<{
  wouldImport: number;
  wouldSkip: number;
  errors: string[];
}> {
  const result = {
    wouldImport: 0,
    wouldSkip: 0,
    errors: [] as string[],
  };

  try {
    // Check existing checksums
    const checksums = Object.values(backup.manifest.checksums);
    const { data: existingPrompts, error } = await supabase
      .from('prompts')
      .select('checksum')
      .eq('user_id', userId)
      .in('checksum', checksums);

    if (error) {
      throw new Error(`Failed to check existing prompts: ${error.message}`);
    }

    const existingChecksums = new Set(existingPrompts?.map(p => p.checksum) || []);

    // Count what would be imported
    for (const prompt of backup.prompts) {
      const checksum = backup.manifest.checksums[prompt.id];
      
      if (!checksum) {
        result.errors.push(`Missing checksum for prompt: ${prompt.id}`);
        continue;
      }

      if (existingChecksums.has(checksum)) {
        result.wouldSkip++;
      } else {
        result.wouldImport++;
      }
    }

    console.log('[Importer] Dry run result:', result);
    return result;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    result.errors.push(error.message);
    throw error;
  }
}

/**
 * Chunk array into smaller batches
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
