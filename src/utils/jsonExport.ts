import type { Prompt } from '@/types/prompt';
import { computeChecksum } from './mergePrompts';

export function exportPromptsToJSON(prompts: Prompt[], filename?: string): void {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
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

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `prompts-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importPromptsFromJSON(file: File): Promise<Prompt[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        let prompts: Prompt[];
        if (Array.isArray(data)) {
          prompts = data;
        } else if (data.prompts && Array.isArray(data.prompts)) {
          prompts = data.prompts;
        } else {
          throw new Error('Invalid format: expected prompts array');
        }
        
        const validPrompts = prompts
          .filter(p => p.title && p.content)
          .map(p => ({
            id: p.id || crypto.randomUUID(),
            title: String(p.title),
            content: String(p.content),
            tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
            isPinned: Boolean(p.isPinned),
            order: typeof p.order === 'number' ? p.order : Date.now(),
            createdAt: p.createdAt || new Date().toISOString(),
            updatedAt: p.updatedAt || new Date().toISOString(),
          }));
        
        resolve(validPrompts);
      } catch (error) {
        reject(new Error('Failed to parse JSON file'));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function mergeImportedPrompts(
  existing: Prompt[],
  imported: Prompt[]
): { merged: Prompt[]; newCount: number; duplicateCount: number } {
  const existingChecksums = new Set(
    existing.map(p => computeChecksum(p.title, p.content))
  );
  
  const newPrompts: Prompt[] = [];
  let duplicateCount = 0;
  
  for (const prompt of imported) {
    const checksum = computeChecksum(prompt.title, prompt.content);
    if (!existingChecksums.has(checksum)) {
      newPrompts.push({
        ...prompt,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      existingChecksums.add(checksum);
    } else {
      duplicateCount++;
    }
  }
  
  return {
    merged: [...newPrompts, ...existing],
    newCount: newPrompts.length,
    duplicateCount,
  };
}
