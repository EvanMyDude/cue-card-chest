/**
 * Backup utilities for pre-migration data export
 * Safely exports localStorage prompts before migration
 */

import { computeChecksum } from './checksum';
import type { Prompt } from '@/types/prompt';

export interface BackupManifest {
  version: number;
  exportedAt: string;
  totalPrompts: number;
  totalTags: number;
  checksums: Record<string, string>; // promptId -> checksum
  source: 'localStorage';
}

export interface BackupData {
  manifest: BackupManifest;
  prompts: Prompt[];
}

const MAX_BACKUP_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_PROMPTS = 5000;

/**
 * Detect if this is a first-time user (no device_id in IndexedDB)
 */
export async function isFirstTimeUser(): Promise<boolean> {
  try {
    const { getDB } = await import('./db');
    const db = await getDB();
    const deviceInfo = await db.get('device_info', 'current');
    return !deviceInfo?.device_id;
  } catch (err) {
    console.error('[Backup] Failed to check first-time user:', err);
    return false;
  }
}

/**
 * Export localStorage prompts to JSON backup
 */
export async function exportLocalStorageBackup(): Promise<BackupData | null> {
  try {
    // Load from localStorage (legacy storage)
    const storedPrompts = localStorage.getItem('prompts');
    if (!storedPrompts) {
      console.log('[Backup] No localStorage prompts found');
      return null;
    }

    const prompts: Prompt[] = JSON.parse(storedPrompts);
    
    if (prompts.length === 0) {
      console.log('[Backup] localStorage prompts array empty');
      return null;
    }

    // Enforce limits
    if (prompts.length > MAX_PROMPTS) {
      throw new Error(`Too many prompts (${prompts.length}). Maximum: ${MAX_PROMPTS}`);
    }

    // Compute checksums for all prompts
    const checksums: Record<string, string> = {};
    for (const prompt of prompts) {
      checksums[prompt.id] = await computeChecksum(prompt.title, prompt.content);
    }

    // Extract unique tags
    const tagSet = new Set<string>();
    prompts.forEach(p => p.tags.forEach(t => tagSet.add(t)));

    const manifest: BackupManifest = {
      version: 1,
      exportedAt: new Date().toISOString(),
      totalPrompts: prompts.length,
      totalTags: tagSet.size,
      checksums,
      source: 'localStorage',
    };

    const backup: BackupData = {
      manifest,
      prompts,
    };

    // Check size
    const backupJson = JSON.stringify(backup);
    if (backupJson.length > MAX_BACKUP_SIZE) {
      throw new Error(`Backup too large (${(backupJson.length / 1024 / 1024).toFixed(2)} MB). Maximum: 10 MB`);
    }

    console.log('[Backup] Exported:', {
      prompts: prompts.length,
      tags: tagSet.size,
      size: `${(backupJson.length / 1024).toFixed(2)} KB`,
    });

    return backup;
  } catch (err) {
    console.error('[Backup] Export failed:', err);
    throw err;
  }
}

/**
 * Download backup as JSON file
 */
export function downloadBackup(backup: BackupData): void {
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `prompts-backup-${dateStr}.json`;
  
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  console.log('[Backup] Downloaded:', filename);
}

/**
 * Validate backup data structure
 */
export function validateBackup(backup: any): backup is BackupData {
  if (!backup || typeof backup !== 'object') return false;
  if (!backup.manifest || !backup.prompts) return false;
  if (!Array.isArray(backup.prompts)) return false;
  
  const manifest = backup.manifest;
  if (typeof manifest.version !== 'number') return false;
  if (typeof manifest.exportedAt !== 'string') return false;
  if (typeof manifest.totalPrompts !== 'number') return false;
  if (typeof manifest.checksums !== 'object') return false;
  
  return true;
}
