import type { Prompt } from '@/types/prompt';

export interface MergeConflict {
  promptId: string;
  local: Prompt;
  remote: Prompt;
  resolvedBy?: 'local' | 'remote' | 'both';
}

export interface MergeResult {
  merged: Prompt[];
  conflicts: MergeConflict[];
  localOnly: Prompt[];
  remoteOnly: Prompt[];
}

/**
 * Compute a simple checksum for a prompt based on title and content
 */
export function computeChecksum(title: string, content: string): string {
  const str = JSON.stringify({ title: title.trim(), content: content.trim() });
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

/**
 * Merge local and remote prompts with conflict detection
 * @param local - Local prompts from localStorage
 * @param remote - Remote prompts from Supabase
 * @param conflictWindowMs - Time window for auto-merge (default 30 seconds)
 */
export function mergePrompts(
  local: Prompt[],
  remote: Prompt[],
  conflictWindowMs: number = 30000
): MergeResult {
  const merged: Prompt[] = [];
  const conflicts: MergeConflict[] = [];
  const localOnly: Prompt[] = [];
  const remoteOnly: Prompt[] = [];

  const localMap = new Map(local.map(p => [p.id, p]));
  const remoteMap = new Map(remote.map(p => [p.id, p]));

  // Process local prompts
  for (const localPrompt of local) {
    const remotePrompt = remoteMap.get(localPrompt.id);

    if (!remotePrompt) {
      // Only exists locally
      localOnly.push(localPrompt);
      continue;
    }

    // Both exist - check for conflicts
    const localChecksum = computeChecksum(localPrompt.title, localPrompt.content);
    const remoteChecksum = computeChecksum(remotePrompt.title, remotePrompt.content);

    if (localChecksum === remoteChecksum) {
      // No conflict - same content, take whichever has more metadata
      merged.push({
        ...remotePrompt,
        isPinned: localPrompt.isPinned || remotePrompt.isPinned,
        order: Math.min(localPrompt.order, remotePrompt.order),
      });
    } else {
      // Content differs - check timestamps
      const localTime = new Date(localPrompt.updatedAt).getTime();
      const remoteTime = new Date(remotePrompt.updatedAt).getTime();
      const timeDiff = Math.abs(localTime - remoteTime);

      if (timeDiff <= conflictWindowMs) {
        // Within conflict window - last write wins
        const winner = localTime > remoteTime ? localPrompt : remotePrompt;
        merged.push(winner);
      } else {
        // Outside window - mark as conflict for user resolution
        conflicts.push({
          promptId: localPrompt.id,
          local: localPrompt,
          remote: remotePrompt,
        });
      }
    }
  }

  // Find remote-only prompts
  for (const remotePrompt of remote) {
    if (!localMap.has(remotePrompt.id)) {
      remoteOnly.push(remotePrompt);
    }
  }

  return { merged, conflicts, localOnly, remoteOnly };
}

/**
 * Resolve a conflict by choosing a side
 */
export function resolveConflict(
  conflict: MergeConflict,
  resolution: 'local' | 'remote' | 'both'
): Prompt[] {
  if (resolution === 'local') {
    return [conflict.local];
  } else if (resolution === 'remote') {
    return [conflict.remote];
  } else {
    // Keep both - create a copy of the local with a new ID
    const localCopy: Prompt = {
      ...conflict.local,
      id: crypto.randomUUID(),
      title: `${conflict.local.title} (Local Copy)`,
    };
    return [conflict.remote, localCopy];
  }
}

/**
 * Deduplicate prompts by checksum
 */
export function dedupeByChecksum(prompts: Prompt[]): Prompt[] {
  const seen = new Map<string, Prompt>();
  
  for (const prompt of prompts) {
    const checksum = computeChecksum(prompt.title, prompt.content);
    const existing = seen.get(checksum);
    
    if (!existing || new Date(prompt.updatedAt) > new Date(existing.updatedAt)) {
      seen.set(checksum, prompt);
    }
  }
  
  return Array.from(seen.values());
}
