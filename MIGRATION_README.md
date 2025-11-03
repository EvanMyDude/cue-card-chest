# Phase 4: Migration and Import Flow

## Overview
Safe migration from localStorage to Supabase with automatic backup and deduplication.

## Phase 4.1: Pre-Migration Backup

### Features
- **First-time detection**: Checks for `device_id` in IndexedDB
- **Automatic export**: Exports localStorage prompts to JSON
- **Download prompt**: User downloads backup before first sync
- **Checksum manifest**: Includes checksums for all prompts
- **Size limits**: Max 10 MB / 5,000 prompts

### Usage

```typescript
import { 
  isFirstTimeUser, 
  exportLocalStorageBackup, 
  downloadBackup 
} from '@/lib/backup';

// Check if first-time user
const isFirstTime = await isFirstTimeUser();

if (isFirstTime) {
  // Export localStorage data
  const backup = await exportLocalStorageBackup();
  
  if (backup) {
    // Prompt user to download
    downloadBackup(backup);
    
    console.log('Backup:', {
      prompts: backup.manifest.totalPrompts,
      tags: backup.manifest.totalTags,
      exportedAt: backup.manifest.exportedAt,
    });
  }
}
```

### Backup Format

```json
{
  "manifest": {
    "version": 1,
    "exportedAt": "2024-11-03T12:00:00.000Z",
    "totalPrompts": 42,
    "totalTags": 15,
    "checksums": {
      "prompt-id-1": "abc123...",
      "prompt-id-2": "def456..."
    },
    "source": "localStorage"
  },
  "prompts": [
    {
      "id": "prompt-id-1",
      "title": "My Prompt",
      "content": "Content...",
      "tags": ["JavaScript"],
      "isPinned": false,
      "order": 0,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-02T00:00:00.000Z"
    }
  ]
}
```

---

## Phase 4.2: Import Logic

### Features
- **Checksum deduplication**: Query Supabase for existing checksums
- **Batch imports**: ≤200 records per batch
- **Tag mapping**: Automatic tag upsert and relationship creation
- **Progress reporting**: Real-time progress callbacks
- **Dry run**: Validate before importing
- **ID mapping**: Maps legacy IDs to new UUIDs

### Usage

```typescript
import { 
  importPromptsFromBackup, 
  dryRunImport 
} from '@/lib/importer';

// Dry run (validate without writing)
const dryRun = await dryRunImport(backup, userId);
console.log('Would import:', dryRun.wouldImport);
console.log('Would skip:', dryRun.wouldSkip);

// Actual import with progress
const result = await importPromptsFromBackup(
  backup,
  userId,
  deviceId,
  (progress) => {
    console.log(progress.phase, progress.message);
    console.log(`${progress.current} / ${progress.total}`);
  }
);

console.log('Import result:', {
  imported: result.imported,
  skipped: result.skipped,
  errors: result.errors,
});
```

### Import Flow

```
1. Validation
   └─ Check backup structure
   
2. Checking for duplicates
   └─ Query Supabase for existing checksums
   └─ Build deduplication set
   
3. Preparing imports
   └─ Filter out duplicates
   └─ Generate new UUIDs
   └─ Map old IDs to new IDs
   
4. Importing (batched)
   └─ Batch 1: 200 prompts + tags
   └─ Batch 2: 200 prompts + tags
   └─ ...
   └─ Progress callbacks
   
5. Complete
   └─ Return summary
```

### Deduplication Logic

```typescript
// For each prompt in backup:
const checksum = backup.manifest.checksums[prompt.id];

// Query existing prompts
const existing = await supabase
  .from('prompts')
  .select('checksum')
  .eq('user_id', userId)
  .in('checksum', allChecksums);

// Skip if checksum exists
if (existingChecksums.has(checksum)) {
  result.skipped++;
  continue;
}

// Otherwise, import with new UUID
const newId = crypto.randomUUID();
result.promptIdMap[oldId] = newId;
```

### Tag Handling

```typescript
// 1. Collect all unique tag names from batch
const allTags = new Set<string>();
batch.forEach(item => {
  item.prompt.tags.forEach(tag => allTags.add(tag));
});

// 2. Check existing tags
const existingTags = await supabase
  .from('tags')
  .select('id, name')
  .eq('user_id', userId)
  .in('name', Array.from(allTags));

// 3. Create missing tags
const missingTags = [...allTags].filter(name => !existingTags.has(name));
await supabase.from('tags').insert(newTags);

// 4. Create prompt-tag relationships
await supabase.from('prompt_tags').insert(relationships);
```

---

## Testing Instructions

### Dry Run Test

```typescript
// 1. Load backup file
const backupFile = await fetch('/path/to/backup.json');
const backup = await backupFile.json();

// 2. Validate structure
import { validateBackup } from '@/lib/backup';
const isValid = validateBackup(backup);
console.assert(isValid, 'Backup should be valid');

// 3. Dry run
const dryRun = await dryRunImport(backup, userId);
console.log('Dry run:', dryRun);

// Expected output:
// {
//   wouldImport: 42,
//   wouldSkip: 0,
//   errors: []
// }
```

### Full Import Test

```typescript
// 1. Export backup
const backup = await exportLocalStorageBackup();
console.assert(backup !== null, 'Should export backup');

// 2. Download backup
downloadBackup(backup!);
// → User should see browser download: "prompts-backup-2024-11-03.json"

// 3. Import
const result = await importPromptsFromBackup(
  backup!,
  userId,
  deviceId,
  (progress) => {
    console.log(progress);
  }
);

// Expected progress:
// { phase: 'validating', current: 0, total: 42, message: '...' }
// { phase: 'checking', current: 0, total: 42, message: '...' }
// { phase: 'importing', current: 200, total: 42, message: '...' }
// { phase: 'complete', current: 42, total: 42, message: '...' }

console.assert(result.imported + result.skipped === backup.prompts.length);
console.assert(result.errors.length === 0, 'Should have no errors');
```

### Edge Cases

```typescript
// Test: Empty localStorage
const backup1 = await exportLocalStorageBackup();
console.assert(backup1 === null, 'Should return null for empty storage');

// Test: Duplicate import (all should be skipped)
const result1 = await importPromptsFromBackup(backup, userId, deviceId);
const result2 = await importPromptsFromBackup(backup, userId, deviceId);
console.assert(result2.skipped === backup.prompts.length);
console.assert(result2.imported === 0);

// Test: Size limit
const largeBackup = { ...backup, prompts: Array(6000).fill(backup.prompts[0]) };
try {
  await exportLocalStorageBackup(); // Should throw
  console.assert(false, 'Should throw on size limit');
} catch (err) {
  console.assert(err.message.includes('Too many prompts'));
}
```

---

## Error Handling

### Backup Errors

```typescript
try {
  const backup = await exportLocalStorageBackup();
} catch (err) {
  if (err.message.includes('Too many prompts')) {
    toast.error('Too many prompts. Maximum: 5,000');
  } else if (err.message.includes('too large')) {
    toast.error('Backup file too large. Maximum: 10 MB');
  } else {
    toast.error('Failed to create backup');
  }
}
```

### Import Errors

```typescript
const result = await importPromptsFromBackup(backup, userId, deviceId);

if (result.errors.length > 0) {
  toast.error(`Import completed with ${result.errors.length} error(s)`);
  console.error('Import errors:', result.errors);
} else {
  toast.success(`Imported ${result.imported} prompts`);
}

if (result.skipped > 0) {
  toast.info(`Skipped ${result.skipped} duplicate prompts`);
}
```

---

## Next Steps

**Phase 4.3: UI Components**
- Create `MigrationDialog.tsx` for backup/import flow
- Add confirmation dialog before import
- Show progress bar during import
- Display import summary

**Phase 4.4: Integration**
- Trigger backup on first login (no device_id)
- Prompt user to download before sync
- Auto-import after device registration
- Clear localStorage after successful import

---

## Notes

- **Zero data loss**: Always backup before migration
- **Idempotent**: Re-importing same backup skips duplicates
- **Chunked writes**: Never exceeds 200 records per batch
- **Progress reporting**: Real-time callbacks for UI
- **Dry run available**: Test before writing
- **Error recovery**: Partial imports logged with errors
