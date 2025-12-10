import { Prompt } from '@/types/prompt';
import { computeChecksumSync } from './checksum';

/**
 * Export prompts to a JSON file download
 */
export function exportPromptsToJSON(prompts: Prompt[]): void {
  const exportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    promptCount: prompts.length,
    prompts: prompts.map(p => ({
      id: p.id,
      title: p.title,
      content: p.content,
      tags: p.tags,
      isPinned: p.isPinned,
      order: p.order,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `prompt-library-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

interface ImportResult {
  prompts: Prompt[];
  errors: string[];
}

/**
 * Import prompts from a JSON file
 */
export async function importPromptsFromJSON(file: File): Promise<ImportResult> {
  const errors: string[] = [];
  
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (!data.prompts || !Array.isArray(data.prompts)) {
      throw new Error('Invalid file format: missing prompts array');
    }

    const prompts: Prompt[] = data.prompts.map((p: any, index: number) => {
      // Validate required fields
      if (!p.title || typeof p.title !== 'string') {
        errors.push(`Prompt ${index + 1}: missing or invalid title`);
        return null;
      }
      if (!p.content || typeof p.content !== 'string') {
        errors.push(`Prompt ${index + 1}: missing or invalid content`);
        return null;
      }

      return {
        id: p.id || crypto.randomUUID(),
        title: p.title,
        content: p.content,
        tags: Array.isArray(p.tags) ? p.tags : [],
        isPinned: Boolean(p.isPinned),
        order: typeof p.order === 'number' ? p.order : index,
        createdAt: p.createdAt || new Date().toISOString(),
        updatedAt: p.updatedAt || new Date().toISOString(),
      };
    }).filter(Boolean) as Prompt[];

    return { prompts, errors };
  } catch (e) {
    errors.push(`Failed to parse file: ${e instanceof Error ? e.message : 'Unknown error'}`);
    return { prompts: [], errors };
  }
}

/**
 * Deduplicate prompts by checksum (title + content)
 */
export function dedupeByChecksum(
  existing: Prompt[],
  imported: Prompt[]
): { toAdd: Prompt[]; duplicates: number } {
  const existingChecksums = new Set(
    existing.map(p => computeChecksumSync(p.title, p.content))
  );

  const toAdd: Prompt[] = [];
  let duplicates = 0;

  for (const prompt of imported) {
    const checksum = computeChecksumSync(prompt.title, prompt.content);
    if (existingChecksums.has(checksum)) {
      duplicates++;
    } else {
      toAdd.push(prompt);
      existingChecksums.add(checksum); // Prevent duplicates within import
    }
  }

  return { toAdd, duplicates };
}
