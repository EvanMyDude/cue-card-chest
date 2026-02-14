import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

type Client = SupabaseClient<Database>;

/**
 * Ensures all tag names exist in the `tags` table for this user.
 * Returns a Map of tag name → tag UUID.
 */
export async function ensureTagIds(
  client: Client,
  userId: string,
  tagNames: string[]
): Promise<Map<string, string>> {
  if (tagNames.length === 0) return new Map();

  const uniqueNames = [...new Set(tagNames.map(t => t.trim()).filter(Boolean))];
  const nameToId = new Map<string, string>();

  // Fetch existing tags for this user matching the given names
  const { data: existing, error: fetchErr } = await client
    .from('tags')
    .select('id, name')
    .eq('user_id', userId)
    .in('name', uniqueNames);

  if (fetchErr) throw fetchErr;

  for (const tag of existing || []) {
    nameToId.set(tag.name, tag.id);
  }

  // Insert any missing tags
  const missing = uniqueNames.filter(name => !nameToId.has(name));
  if (missing.length > 0) {
    const { data: inserted, error: insertErr } = await client
      .from('tags')
      .insert(missing.map(name => ({ name, user_id: userId })))
      .select('id, name');

    if (insertErr) throw insertErr;

    for (const tag of inserted || []) {
      nameToId.set(tag.name, tag.id);
    }
  }

  return nameToId;
}

/**
 * Syncs the prompt_tags junction rows for a single prompt.
 * Diffs current DB state against desired tag names: deletes removed, inserts added.
 */
export async function syncPromptTags(
  client: Client,
  userId: string,
  promptId: string,
  tagNames: string[]
): Promise<void> {
  const cleanNames = tagNames.map(t => t.trim()).filter(Boolean);
  const nameToId = await ensureTagIds(client, userId, cleanNames);

  // Fetch current junction rows for this prompt
  const { data: currentRows, error: fetchErr } = await client
    .from('prompt_tags')
    .select('tag_id')
    .eq('prompt_id', promptId);

  if (fetchErr) throw fetchErr;

  const currentTagIds = new Set((currentRows || []).map(r => r.tag_id));
  const desiredTagIds = new Set(cleanNames.map(n => nameToId.get(n)!).filter(Boolean));

  // Delete removed tags
  const toRemove = [...currentTagIds].filter(id => !desiredTagIds.has(id));
  if (toRemove.length > 0) {
    const { error: delErr } = await client
      .from('prompt_tags')
      .delete()
      .eq('prompt_id', promptId)
      .in('tag_id', toRemove);

    if (delErr) throw delErr;
  }

  // Insert new tags
  const toAdd = [...desiredTagIds].filter(id => !currentTagIds.has(id));
  if (toAdd.length > 0) {
    const { error: insErr } = await client
      .from('prompt_tags')
      .insert(toAdd.map(tag_id => ({ prompt_id: promptId, tag_id })));

    if (insErr) throw insErr;
  }
}

/**
 * Fetches tag names for a batch of prompts in a single query.
 * Returns Map<promptId, tagNames[]>. Gracefully returns empty on error.
 */
export async function fetchTagsForPrompts(
  client: Client,
  userId: string,
  promptIds: string[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (promptIds.length === 0) return result;

  try {
    const { data, error } = await client
      .from('prompt_tags')
      .select('prompt_id, tags(name)')
      .in('prompt_id', promptIds);

    if (error) throw error;

    for (const row of data || []) {
      const promptId = row.prompt_id;
      // tags is the joined row from the tags table
      const tagName = (row.tags as any)?.name;
      if (!tagName) continue;

      const existing = result.get(promptId) || [];
      existing.push(tagName);
      result.set(promptId, existing);
    }
  } catch (err) {
    console.warn('[TagSync] Failed to fetch tags, falling back to empty:', err);
  }

  return result;
}

/**
 * Batch-syncs tags for multiple prompts (used during migration/upload).
 * Uses delete-all + insert pattern for simplicity.
 */
export async function syncAllPromptTags(
  client: Client,
  userId: string,
  prompts: { id: string; tags: string[] }[]
): Promise<void> {
  // Collect all unique tag names across all prompts
  const allNames = [...new Set(prompts.flatMap(p => p.tags.map(t => t.trim()).filter(Boolean)))];
  if (allNames.length === 0) return;

  const nameToId = await ensureTagIds(client, userId, allNames);

  for (const prompt of prompts) {
    const cleanNames = prompt.tags.map(t => t.trim()).filter(Boolean);
    if (cleanNames.length === 0) continue;

    // Delete existing junction rows for this prompt
    await client
      .from('prompt_tags')
      .delete()
      .eq('prompt_id', prompt.id);

    // Insert new junction rows
    const rows = cleanNames
      .map(name => nameToId.get(name))
      .filter((id): id is string => !!id)
      .map(tag_id => ({ prompt_id: prompt.id, tag_id }));

    if (rows.length > 0) {
      const { error } = await client
        .from('prompt_tags')
        .insert(rows);

      if (error) {
        console.warn(`[TagSync] Failed to sync tags for prompt ${prompt.id}:`, error);
      }
    }
  }
}
