# Offline Storage Layer - IndexedDB Implementation

## Overview
This implementation provides a robust IndexedDB layer for offline-first prompt management, matching the Supabase backend schema.

## Schema Version
**Current Version:** `1`

## Database Structure

### Stores

#### 1. **prompts**
- **Key:** `id` (UUID)
- **Indexes:**
  - `by-updated`: sorted by `updatedAt`
  - `by-pinned`: sorted by `isPinned`
  - `by-user`: filtered by `user_id`
- **Fields:** `id`, `user_id`, `device_id`, `title`, `content`, `checksum`, `isPinned`, `order`, `version`, `tokens`, `createdAt`, `updatedAt`, `archived_at`
- **Max Size:** 500KB per record
- **Max Content:** 100,000 characters
- **Max Title:** 500 characters

#### 2. **tags**
- **Key:** `id` (UUID)
- **Indexes:**
  - `by-name`: sorted alphabetically
  - `by-user`: filtered by `user_id`
- **Fields:** `id`, `user_id`, `name`, `created_at`

#### 3. **prompt_tags** (Junction table)
- **Composite Key:** `[prompt_id, tag_id]`
- **Indexes:**
  - `by-prompt`: all tags for a prompt
  - `by-tag`: all prompts for a tag
- **Fields:** `prompt_id`, `tag_id`

#### 4. **sync_queue**
- **Key:** `id` (auto-increment)
- **Indexes:**
  - `by-created`: FIFO order
  - `by-entity`: group by entity_id
- **Fields:** `id`, `operation`, `entity_type`, `entity_id`, `data`, `created_at`, `attempts`
- **Purpose:** Tracks pending changes to sync with server

#### 5. **device_info** (Single record)
- **Key:** `'current'` (constant)
- **Fields:** `key`, `device_id`, `device_name`, `device_type`, `last_sync_at`, `sync_token`
- **Purpose:** Stores current device registration and sync state

## API Usage

### Initialization
```typescript
import { useOfflineStorage } from '@/hooks/useOfflineStorage';

const {
  isReady,
  error,
  getPromptById,
  listPrompts,
  putPrompt,
  // ... other methods
} = useOfflineStorage();

// Wait for IndexedDB to be ready
if (!isReady) return <Loading />;
if (error) return <Error message={error.message} />;
```

### CRUD Operations

#### Prompts
```typescript
// Read
const prompt = await getPromptById('uuid-here');
const allPrompts = await listPrompts(userId);

// Create/Update
await putPrompt({
  id: 'new-uuid',
  user_id: userId,
  title: 'My Prompt',
  content: 'Prompt content...',
  checksum: 'computed-hash',
  isPinned: false,
  order: 0,
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// Bulk operations
await bulkPutPrompts([prompt1, prompt2, prompt3]);

// Soft delete (sets archived_at)
await softDeletePrompt('uuid-here');
```

#### Tags
```typescript
// Read
const tag = await getTagById('uuid-here');
const allTags = await listTags(userId);

// Create/Update
await putTag({
  id: 'new-uuid',
  user_id: userId,
  name: 'JavaScript',
  created_at: new Date().toISOString(),
});

// Bulk
await bulkPutTags([tag1, tag2]);

// Delete (hard delete)
await deleteTag('uuid-here');
```

#### Prompt-Tag Relationships
```typescript
// Get all tags for a prompt
const tags = await getPromptTags('prompt-uuid');

// Replace all tags for a prompt
await setPromptTags('prompt-uuid', ['tag-uuid-1', 'tag-uuid-2']);
```

#### Sync Queue
```typescript
// Add operation to queue
await addToSyncQueue({
  operation: 'update',
  entity_type: 'prompt',
  entity_id: 'prompt-uuid',
  data: { title: 'New Title', content: '...' },
});

// Get pending operations
const queue = await getSyncQueue();

// Clear after successful sync
await clearSyncQueue();
```

#### Device Info
```typescript
// Get current device
const device = await getDeviceInfo();

// Update device info
await setDeviceInfo({
  device_id: 'device-uuid',
  device_name: 'MacBook Pro',
  last_sync_at: new Date().toISOString(),
  sync_token: 'server-token',
});
```

## Schema Migrations

### Version 1 (Initial)
- Created all 5 stores with indexes
- Defined size limits and validation

### Future Migrations
When schema needs to change:

1. Increment `DB_VERSION` in `src/lib/db.ts`
2. Add migration logic in `initDB()` upgrade callback:

```typescript
// Example: Version 2 migration
if (oldVersion < 2) {
  const tx = transaction.objectStore('prompts');
  tx.createIndex('by-archived', 'archived_at');
}
```

## Size Caps & Validation

### Automatic Validation
All write operations automatically validate:
- ✅ UUID format (v4)
- ✅ Prompt size (max 500KB)
- ✅ Content length (max 100k chars)
- ✅ Title length (max 500 chars)

### Error Handling
```typescript
try {
  await putPrompt(largePrompt);
} catch (err) {
  if (err.message.includes('exceeds maximum size')) {
    // Handle size limit error
  }
}
```

## Performance Considerations

### Indexes
All frequently queried fields are indexed for O(log n) lookups:
- Prompts: `updatedAt`, `isPinned`, `user_id`
- Tags: `name`, `user_id`
- Prompt-Tags: `prompt_id`, `tag_id`
- Sync Queue: `created_at`, `entity_id`

### Transactions
- **Read operations:** Use readonly transactions
- **Bulk writes:** Single readwrite transaction for atomic updates
- **Cross-store operations:** Multi-store transactions when needed

### Async Patterns
- All operations return Promises (no blocking)
- React hook provides cancellation via component unmount
- Background DB initialization

## Debugging

### Check Store Contents
```typescript
import { getDBStats } from '@/lib/db';

const stats = await getDBStats();
console.log(stats);
// { prompts: 42, tags: 15, prompt_tags: 89, sync_queue: 3 }
```

### Export Data
```typescript
import { exportAllData } from '@/lib/db';

const backup = await exportAllData();
console.log(backup);
// { version: 1, exported_at: '...', data: { prompts, tags, ... } }
```

### Clear Stores
```typescript
import { clearStore } from '@/lib/db';

await clearStore('prompts');
await clearStore('sync_queue');
```

## Next Steps

**Phase 3.3:** Sync Engine
- Implement device registration on first login
- Build bidirectional sync logic
- Handle conflict resolution flow
- Add background sync with retry logic

**Phase 3.4:** UI Integration
- Wire `useOfflineStorage` to existing components
- Replace localStorage with IndexedDB
- Add sync status indicators
- Show conflict resolution UI

## Notes

- **Not wired to UI yet** - awaiting review before integration
- **No network calls** - pure offline storage layer
- **Schema versioning ready** - easy to migrate in future
- **Typed throughout** - full TypeScript support
