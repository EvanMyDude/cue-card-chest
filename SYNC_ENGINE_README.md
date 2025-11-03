# Sync Engine & Hooks - Phase 3.3

## Overview
Offline-first synchronization engine with optimistic locking, conflict detection, and automatic retry logic. All permission checks handled server-side via RLS.

## Components

### 1. `src/lib/checksum.ts`
SHA-256 checksum utilities for content-based versioning.

```typescript
import { computeChecksum, normalizeText } from '@/lib/checksum';

// Compute checksum (matches server-side)
const checksum = await computeChecksum('Title', 'Content');

// Normalize text before comparison
const normalized = normalizeText('  Hello\r\nWorld  '); // "Hello\nWorld"
```

**Features:**
- SHA-256 hashing via Web Crypto API
- Text normalization (trim, line endings, trailing spaces)
- Matches Supabase `compute_checksum` function
- Deterministic output for conflict detection

---

### 2. `src/lib/syncEngine.ts`
Core synchronization logic with server communication.

```typescript
import { 
  performSync, 
  registerDevice, 
  onSyncEvent,
  setupNetworkListeners 
} from '@/lib/syncEngine';

// Register device on first login
const { deviceId } = await registerDevice('MacBook Pro', 'web');

// Perform bidirectional sync
const result = await performSync(deviceId, localPrompts, syncToken);
// { success: true, synced: 5, conflicts: [], syncToken: '...' }

// Subscribe to sync events
const unsubscribe = onSyncEvent(event => {
  console.log(event.status); // 'idle' | 'syncing' | 'offline' | 'error' | 'conflicts'
  if (event.conflicts) {
    // Handle conflicts
  }
});

// Set up network listeners
const cleanup = setupNetworkListeners(
  () => console.log('Online'),
  () => console.log('Offline')
);
```

**Features:**
- **Pull:** Fetch server changes since last sync token
- **Push:** Upload local changes with conflict detection
- **Retry:** Exponential backoff with jitter (max 5 attempts)
- **Conflict Detection:** 30-second window for last-write-wins
- **Event Emitter:** Real-time sync status updates
- **Network Awareness:** Auto-sync on reconnect

**Retry Configuration:**
- Base delay: 1s
- Max delay: 30s
- Jitter: ±30%
- Max attempts: 5

---

### 3. `src/hooks/useSyncQueue.ts`
Manages queued operations and flushes on reconnect.

```typescript
import { useSyncQueue } from '@/hooks/useSyncQueue';

const { status, queueOperation, flushQueue, retryParked } = useSyncQueue(
  deviceId,
  userId
);

// Status
console.log(status.pending);      // 3
console.log(status.processing);   // false
console.log(status.parkedItems);  // 1

// Queue operation
await queueOperation({
  operation: 'update',
  entity_type: 'prompt',
  entity_id: 'prompt-uuid',
  data: { title: 'New Title', content: '...' },
});

// Manually flush
await flushQueue();

// Retry parked items (failed 5+ times)
await retryParked();
```

**Features:**
- **Auto-flush:** Every 30 seconds when online
- **Queue Size Cap:** Max 1000 items (clears oldest on overflow)
- **Error Parking:** Items fail after 5 attempts, surfaced in UI
- **Network Aware:** Flushes on reconnect, pauses when offline
- **Attempt Tracking:** Increments on failure, resets on retry

---

### 4. `src/hooks/usePrompts.ts`
Main CRUD hook with offline-first pattern.

```typescript
import { usePrompts } from '@/hooks/usePrompts';

const {
  prompts,
  loading,
  syncStatus,
  conflicts,
  
  // CRUD
  getPrompt,
  createPrompt,
  updatePrompt,
  deletePrompt,
  reorderPrompts,
  
  // Sync
  syncNow,
  resolveConflict,
  refresh,
} = usePrompts();

// Create
const newPrompt = await createPrompt({
  title: 'My Prompt',
  content: 'Content...',
  tags: ['JavaScript'],
  isPinned: false,
  order: 0,
});

// Update
await updatePrompt('prompt-id', {
  title: 'Updated Title',
  tags: ['JavaScript', 'React'],
});

// Delete (soft delete)
await deletePrompt('prompt-id');

// Reorder
await reorderPrompts([prompt3, prompt1, prompt2]);

// Sync status
console.log(syncStatus); // 'idle' | 'syncing' | 'offline' | 'error' | 'conflicts'

// Resolve conflicts
if (conflicts.length > 0) {
  await resolveConflict('prompt-id', 'keep-current');
  // or 'use-revision'
}

// Manual sync
await syncNow();
```

**Features:**
- **Read from IndexedDB first:** Instant UI updates
- **Enqueue writes:** Queue operations when offline
- **Auto-sync:** Triggered on save or timer
- **Conflict Resolution:** UI-driven choice between versions
- **Tag Management:** Automatic upsert of tags
- **Optimistic Updates:** UI reflects changes immediately

**Flow:**
1. User creates/updates prompt
2. Saved to IndexedDB instantly
3. Added to sync queue
4. Synced to server when online
5. Conflicts detected and surfaced
6. User resolves conflicts manually

---

## Network Status Events

The sync engine emits real-time events for UI integration:

```typescript
onSyncEvent(event => {
  switch (event.status) {
    case 'idle':
      // All synced, no pending operations
      break;
    case 'syncing':
      // Sync in progress
      break;
    case 'offline':
      // Network unavailable
      break;
    case 'error':
      // Sync failed (check event.error)
      break;
    case 'conflicts':
      // Conflicts detected (check event.conflicts)
      break;
  }
});
```

---

## Conflict Resolution

When conflicts occur:

1. **Server wins in 30-second window:** Last-write-wins
2. **Beyond 30 seconds:** Conflict created
3. **User chooses:**
   - `keep-current`: Keep local version
   - `use-revision`: Use server version
4. **Revision marked resolved**
5. **All devices notified**

**Conflict Structure:**
```typescript
interface ConflictRecord {
  promptId: string;
  revisionId: string;
  serverVersion: {
    title: string;
    content: string;
    updatedAt: string;
  };
  clientVersion: {
    title: string;
    content: string;
    updatedAt: string;
  };
}
```

---

## Error Handling

### Queue Errors
- **Max attempts reached (5):** Item parked, exposed in UI
- **Queue overflow (>1000):** Clear oldest items
- **Retry parked:** Reset attempts and flush

### Sync Errors
- **Auth errors:** Don't retry, surface immediately
- **Network errors:** Retry with backoff
- **Server errors:** Retry up to max attempts

### Event Emission
All errors emitted via `onSyncEvent`:
```typescript
{
  status: 'error',
  message: 'Sync failed: Network error',
  error: Error,
  timestamp: '2024-11-03T12:00:00Z'
}
```

---

## Security

- ✅ **No service role key on client**
- ✅ **JWT authentication** for all edge functions
- ✅ **RLS policies** enforce user isolation
- ✅ **Device ID** is metadata only (no auth)
- ✅ **Server validates** all operations

---

## Performance

### Optimistic Updates
UI updates immediately, sync happens in background:
```
User saves → IndexedDB (0ms) → UI updates → Queue (10ms) → Sync (async)
```

### Batch Operations
Multiple prompts synced in single request:
```typescript
await performSync(deviceId, [prompt1, prompt2, prompt3], syncToken);
```

### Network Efficiency
- **Sync token:** Only pull changes since last sync
- **Checksum comparison:** Avoid unnecessary uploads
- **Gzip compression:** Automatic via fetch API

---

## Testing

### Unit Tests (Stubs Provided)

Run tests:
```bash
npm test checksum
npm test useSyncQueue
```

**Checksum Tests:**
- ✅ Text normalization
- ✅ Consistent hashing
- ✅ Format validation

**Sync Queue Tests (TODO):**
- Queue operations
- Flush behavior
- Retry logic
- Network listeners

---

## Next Steps

**Phase 3.4: UI Integration**
1. Wire `usePrompts` to existing components
2. Replace localStorage with IndexedDB
3. Add sync status indicators
4. Build conflict resolution dialog
5. Show parked items and retry UI

**Phase 3.5: Device Registration Flow**
1. Register device on first login
2. Store device_id in IndexedDB
3. Handle device name input
4. Manage multiple devices per user

---

## Architecture Diagram

```
┌─────────────┐
│   User UI   │
└──────┬──────┘
       │
       ▼
┌─────────────────┐      ┌──────────────┐
│  usePrompts()   │◄────►│  IndexedDB   │
└────────┬────────┘      └──────────────┘
         │
         ▼
┌─────────────────┐
│ useSyncQueue()  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  syncEngine     │◄────►│ Edge Funcs   │
└─────────────────┘      └──────┬───────┘
         │                       │
         ▼                       ▼
┌─────────────────┐      ┌──────────────┐
│ Network Events  │      │  Supabase    │
└─────────────────┘      └──────────────┘
```

---

## Notes

- **Not wired to UI yet** - awaiting Phase 3.4
- **Device registration not automated** - manual flow needed
- **Test coverage incomplete** - stubs provided
- **Production-ready patterns** - retry, backoff, parking
