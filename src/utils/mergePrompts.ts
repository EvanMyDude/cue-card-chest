import { Prompt } from '@/types/prompt';

export interface MergeConflict {
  promptId: string;
  local: Prompt;
  remote: Prompt;
  timeDifferenceMs: number;
}

export interface MergeResult {
  merged: Prompt[];
  conflicts: MergeConflict[];
  stats: {
    localOnly: number;
    remoteOnly: number;
    identical: number;
    autoMerged: number;
    conflicted: number;
  };
}

const CONFLICT_WINDOW_MS = 30 * 1000; // 30 seconds

/**
 * Pure function to merge local and remote prompts.
 * 
 * Logic:
 * 1. Match by ID
 * 2. Same content (by checksum or title+content) → no conflict
 * 3. Different content, <30 seconds apart → last-write-wins (auto-merge)
 * 4. Different content, >30 seconds apart → conflict requiring manual resolution
 */
export function mergePrompts(
  local: Prompt[],
  remote: Prompt[],
  checksumFn?: (p: Prompt) => string
): MergeResult {
  const localMap = new Map(local.map(p => [p.id, p]));
  const remoteMap = new Map(remote.map(p => [p.id, p]));
  
  const merged: Prompt[] = [];
  const conflicts: MergeConflict[] = [];
  const stats = {
    localOnly: 0,
    remoteOnly: 0,
    identical: 0,
    autoMerged: 0,
    conflicted: 0,
  };

  // Default checksum function compares title + content
  const getChecksum = checksumFn || ((p: Prompt) => `${p.title.trim()}|${p.content.trim()}`);

  // Process all local prompts
  for (const [id, localPrompt] of localMap) {
    const remotePrompt = remoteMap.get(id);
    
    if (!remotePrompt) {
      // Local only - add to merged
      merged.push(localPrompt);
      stats.localOnly++;
      continue;
    }

    // Both exist - check for conflicts
    const localChecksum = getChecksum(localPrompt);
    const remoteChecksum = getChecksum(remotePrompt);

    if (localChecksum === remoteChecksum) {
      // Identical content - use remote (has server timestamps)
      merged.push(remotePrompt);
      stats.identical++;
      continue;
    }

    // Content differs - check timestamps
    const localTime = new Date(localPrompt.updatedAt).getTime();
    const remoteTime = new Date(remotePrompt.updatedAt).getTime();
    const timeDiff = Math.abs(localTime - remoteTime);

    if (timeDiff <= CONFLICT_WINDOW_MS) {
      // Within conflict window - last write wins
      const winner = localTime > remoteTime ? localPrompt : remotePrompt;
      merged.push(winner);
      stats.autoMerged++;
    } else {
      // Outside window - create conflict
      conflicts.push({
        promptId: id,
        local: localPrompt,
        remote: remotePrompt,
        timeDifferenceMs: timeDiff,
      });
      stats.conflicted++;
      // Add remote version to merged for now (user will resolve)
      merged.push({ ...remotePrompt, hasConflict: true } as Prompt & { hasConflict: boolean });
    }
  }

  // Add remote-only prompts
  for (const [id, remotePrompt] of remoteMap) {
    if (!localMap.has(id)) {
      merged.push(remotePrompt);
      stats.remoteOnly++;
    }
  }

  return { merged, conflicts, stats };
}

/**
 * Resolve a conflict by choosing a side or keeping both
 */
export function resolveConflict(
  conflict: MergeConflict,
  resolution: 'local' | 'remote' | 'both'
): Prompt[] {
  switch (resolution) {
    case 'local':
      return [conflict.local];
    case 'remote':
      return [conflict.remote];
    case 'both':
      // Keep both - create a copy of local with new ID
      const localCopy: Prompt = {
        ...conflict.local,
        id: crypto.randomUUID(),
        title: `${conflict.local.title} (local copy)`,
      };
      return [conflict.remote, localCopy];
  }
}
