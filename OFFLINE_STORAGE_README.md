# Offline Storage System

## Overview

This document describes the offline-first storage architecture using IndexedDB for local persistence and Supabase for cloud sync.

## Architecture

### Storage Layers

1. **IndexedDB (Primary Local Store)**
   - Managed by `src/lib/db.ts`
   - Stores prompts, tags, prompt-tag relationships, sync queue, and device info
   - Provides offline-first capabilities
   - Auto-syncs when online

2. **localStorage (Legacy)**
   - Previous storage mechanism
   - Used for migration source data
   - Being phased out in favor of IndexedDB

3. **Supabase (Cloud Backend)**
   - Source of truth for multi-device sync
   - Handles conflict resolution
   - Stores version history

### Data Flow

```
User Action
    ↓
IndexedDB Write (instant)
    ↓
Sync Queue (if changes)
    ↓
Supabase Sync (when online)
    ↓
Conflict Check & Resolution
    ↓
Update Local State
```

## Components

### 1. Database Layer (`src/lib/db.ts`)

#### Object Stores

**prompts**
- Primary key: `id` (UUID)
- Indexes: `user_id`, `version`, `is_archived`
- Fields: title, content, tags, version, checksum, timestamps

**tags**
- Primary key: `id` (UUID)
- Index: `user_id`
- Auto-created from prompt tags

**prompt_tags**
- Composite key: `[prompt_id, tag_id]`
- Junction table for many-to-many relationship

**sync_queue**
- Primary key: `id` (auto-increment)
- Tracks pending operations
- Fields: operation, prompt_id, retry_count, status

**device_info**
- Single record per device
- Stores device_id, last_sync_at, sync_token

#### Size Limits

- Maximum prompt size: 1MB
- Maximum title length: 500 chars
- Maximum content length: 100,000 chars
- Maximum database size: 50MB per user

### 2. Offline Storage Hook (`src/hooks/useOfflineStorage.ts`)

Provides high-level API for IndexedDB operations:

```typescript
interface UseOfflineStorageResult {
  isReady: boolean;
  
  // Prompts
  getAllPrompts: () => Promise<PromptRecord[]>;
  getPrompt: (id: string) => Promise<PromptRecord | undefined>;
  savePrompt: (prompt: PromptRecord) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  
  // Tags
  getAllTags: () => Promise<TagRecord[]>;
  saveTag: (tag: TagRecord) => Promise<void>;
  
  // Device Info
  getDeviceInfo: () => Promise<DeviceInfoRecord | undefined>;
  setDeviceInfo: (info: DeviceInfoRecord) => Promise<void>;
  
  // Utilities
  clearAll: () => Promise<void>;
  getStats: () => Promise<DBStats>;
}
```

### 3. Sync Queue (`src/hooks/useSyncQueue.ts`)

Manages offline operations and sync:

```typescript
interface SyncQueueStatus {
  pendingCount: number;
  isProcessing: boolean;
  lastSync: Date | null;
  errors: string[];
  parkedCount: number;
}

interface UseSyncQueueResult {
  status: SyncQueueStatus;
  queueOperation: (op: SyncOperation) => Promise<void>;
  flushQueue: () => Promise<void>;
  clearQueue: () => Promise<void>;
  retryParked: () => Promise<void>;
}
```

## Usage Examples

### Basic Prompt Operations

```typescript
import { useOfflineStorage } from '@/hooks/useOfflineStorage';

function MyComponent() {
  const storage = useOfflineStorage();

  // Wait for IndexedDB to be ready
  useEffect(() => {
    if (!storage.isReady) return;
    
    loadPrompts();
  }, [storage.isReady]);

  const loadPrompts = async () => {
    const prompts = await storage.getAllPrompts();
    console.log(prompts);
  };

  const savePrompt = async () => {
    await storage.savePrompt({
      id: 'uuid-here',
      user_id: 'user-id',
      title: 'My Prompt',
      content: 'Prompt content',
      version: 1,
      checksum: 'calculated-checksum',
      is_archived: false,
      is_pinned: false,
      order_index: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  };

  return <div>...</div>;
}
```

### Sync Queue Operations

```typescript
import { useSyncQueue } from '@/hooks/useSyncQueue';

function SyncStatus() {
  const syncQueue = useSyncQueue();

  // Queue an operation
  const queueUpdate = async () => {
    await syncQueue.queueOperation({
      operation: 'update',
      prompt_id: 'uuid',
      payload: { title: 'Updated' },
      created_at: Date.now(),
    });
  };

  // Manual sync trigger
  const syncNow = async () => {
    await syncQueue.flushQueue();
  };

  // Retry failed operations
  const retryFailed = async () => {
    await syncQueue.retryParked();
  };

  return (
    <div>
      <p>Pending: {syncQueue.status.pendingCount}</p>
      <p>Parked: {syncQueue.status.parkedCount}</p>
      <button onClick={syncNow}>Sync Now</button>
      {syncQueue.status.parkedCount > 0 && (
        <button onClick={retryFailed}>Retry Failed</button>
      )}
    </div>
  );
}
```

### Complete CRUD with Auto-Sync

```typescript
import { usePrompts } from '@/hooks/usePrompts';

function PromptManager() {
  const {
    prompts,
    loading,
    syncStatus,
    conflicts,
    createPrompt,
    updatePrompt,
    deletePrompt,
    syncNow,
  } = usePrompts();

  const handleCreate = async () => {
    await createPrompt({
      title: 'New Prompt',
      content: 'Content here',
      tags: ['tag1', 'tag2'],
      isPinned: false,
      order: 0,
    });
    // Automatically queued for sync
  };

  const handleUpdate = async (id: string) => {
    await updatePrompt(id, {
      title: 'Updated Title',
    });
    // Automatically queued for sync
  };

  const handleDelete = async (id: string) => {
    await deletePrompt(id);
    // Soft delete, queued for sync
  };

  return (
    <div>
      <div>Status: {syncStatus}</div>
      {conflicts.length > 0 && (
        <div>Conflicts detected: {conflicts.length}</div>
      )}
      
      {loading ? (
        <div>Loading...</div>
      ) : (
        prompts.map(prompt => (
          <div key={prompt.id}>
            <h3>{prompt.title}</h3>
            <button onClick={() => handleUpdate(prompt.id)}>Edit</button>
            <button onClick={() => handleDelete(prompt.id)}>Delete</button>
          </div>
        ))
      )}
      
      <button onClick={handleCreate}>New Prompt</button>
      <button onClick={syncNow}>Sync Now</button>
    </div>
  );
}
```

## Sync Behavior

### Auto-Sync Triggers

1. **Network Reconnection**: Flushes queue when online
2. **Periodic Timer**: Syncs every 30 seconds when online
3. **User Action**: Manual sync via `syncNow()`
4. **App Focus**: Syncs when app regains focus

### Conflict Detection

Conflicts occur when:
- Two devices edit the same prompt
- Edits happen within 30-second window
- Checksums don't match

Resolution options:
- Keep local version
- Use server version
- Merge changes (manual)

### Queue Management

**Queue Limits**
- Max queue size: 1,000 operations
- Max retries per operation: 5 attempts
- Retry backoff: Exponential with jitter

**Parking Failed Items**
- Operations that fail 5 times are "parked"
- Parked items don't block queue
- User can manually retry parked items

## Performance Optimization

### Batch Operations

```typescript
// Instead of multiple single writes
for (const prompt of prompts) {
  await storage.savePrompt(prompt); // Slow
}

// Use batch operations
const tx = db.transaction('prompts', 'readwrite');
const store = tx.objectStore('prompts');

for (const prompt of prompts) {
  store.put(prompt);
}

await tx.done; // Fast
```

### Indexing Strategy

- Index frequently queried fields
- Use compound indexes for multi-field queries
- Avoid over-indexing (increases write time)

### Memory Management

- Clear unused data periodically
- Archive old prompts instead of deleting
- Monitor database size with `getStats()`

## Migration from localStorage

See `MIGRATION_README.md` for full migration details.

Quick overview:
1. Detect first-time user (no device_info in IndexedDB)
2. Export localStorage prompts to backup
3. Import backup to Supabase
4. Download IndexedDB for offline access
5. Clear localStorage after confirmation

## Troubleshooting

### Common Issues

**IndexedDB not ready**
- Symptom: `isReady` is false
- Cause: Database initialization failed
- Solution: Check browser console for errors, ensure IndexedDB is enabled

**Sync queue growing unbounded**
- Symptom: `pendingCount` keeps increasing
- Cause: Network issues or auth problems
- Solution: Check network, verify auth state, retry parked items

**Conflicts not resolving**
- Symptom: Conflict count stays non-zero
- Cause: User hasn't chosen resolution
- Solution: Call `resolveConflict()` with chosen strategy

**Data not persisting**
- Symptom: Data lost after refresh
- Cause: Not waiting for operations to complete
- Solution: Always await async operations

### Debugging Tools

```typescript
// Check database stats
const stats = await storage.getStats();
console.log('Database stats:', stats);

// Export all data for inspection
import { exportAllData } from '@/lib/db';
const data = await exportAllData();
console.log('All data:', data);

// Check sync queue status
console.log('Queue status:', syncQueue.status);

// View rollback logs
import { getRollbackLogs } from '@/lib/rollback';
const logs = getRollbackLogs();
console.log('Rollback history:', logs);
```

## Best Practices

1. **Always Check isReady**: Wait for IndexedDB before operations
2. **Handle Errors**: Wrap operations in try-catch
3. **Validate Data**: Check size limits before writing
4. **Monitor Queue**: Display pending count to users
5. **Test Offline**: Verify app works without network
6. **Backup Regularly**: Create backups before destructive ops
7. **Clean Up**: Archive or delete old data periodically

## Security

1. **User Isolation**: All queries filtered by `user_id`
2. **RLS Policies**: Supabase enforces row-level security
3. **Client-Side Validation**: Size and format checks
4. **No Service Keys**: Client never has admin access
5. **Audit Logging**: All operations logged for accountability

## Future Improvements

- [ ] Compression for large prompts
- [ ] Delta sync (only changed fields)
- [ ] Conflict prevention (edit locks)
- [ ] P2P sync between devices
- [ ] Background sync with Service Workers
- [ ] Automatic schema migrations
- [ ] Query result caching
- [ ] Full-text search indexing

## Related Documentation

- `SYNC_ENGINE_README.md`: Sync implementation details
- `MIGRATION_README.md`: Migration from localStorage
- `ROLLBACK.md`: Data recovery procedures
- `TESTING.md`: Testing guidelines
